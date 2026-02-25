// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";

interface AttendanceInfo {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  workingMinutes: number;
  workerId: string | null;
}

interface ShiftInfo {
  startTime: string;
  endTime: string;
  shiftName: string;
}

interface CheckoutRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reject_reason: string | null;
  approved_at: string | null;
  memo: string | null;
}

export default function CrewAttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceInfo>({
    isCheckedIn: false, isCheckedOut: false,
    checkInTime: null, checkOutTime: null,
    workingMinutes: 0, workerId: null,
  });
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [latestRequest, setLatestRequest] = useState<CheckoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"checking" | "ok" | "far" | "error">("checking");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutMemo, setCheckoutMemo] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useCrewToast();

  const loadLatestRequest = useCallback(async (wid: string) => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("checkout_requests")
      .select("id, status, requested_at, reject_reason, approved_at, memo")
      .eq("worker_id", wid)
      .gte("requested_at", `${today}T00:00:00`)
      .order("requested_at", { ascending: false })
      .limit(1)
      .single();
    setLatestRequest(data || null);
  }, []);

  useEffect(() => {
    let channel: any = null;

    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/crew/login"); return; }

      const savedStoreId = localStorage.getItem("crew_store_id");
      if (!savedStoreId) { router.replace("/crew/select-store"); return; }
      setStoreId(savedStoreId);

      const { data: worker } = await supabase
        .from("workers").select("id").eq("user_id", user.id).single();
      if (!worker) { setLoading(false); return; }

      // 오늘 출근 정보
      const today = new Date().toISOString().split("T")[0];
      const { data: ad } = await supabase
        .from("worker_attendance").select("*")
        .eq("worker_id", worker.id).eq("work_date", today).single();

      if (ad && ad.check_in) {
        const cin = new Date(ad.check_in);
        const cout = ad.check_out ? new Date(ad.check_out) : null;
        const now = new Date();
        const mins = cout
          ? Math.floor((cout.getTime() - cin.getTime()) / 60000)
          : Math.floor((now.getTime() - cin.getTime()) / 60000);
        setAttendance({
          isCheckedIn: true, isCheckedOut: !!ad.check_out,
          checkInTime: cin, checkOutTime: cout,
          workingMinutes: mins, workerId: worker.id,
        });
      } else {
        setAttendance(prev => ({ ...prev, workerId: worker.id }));
      }

      await loadLatestRequest(worker.id);

      // 근무조
      const { data: sd } = await supabase
        .from("store_shifts").select("*").eq("store_id", savedStoreId).limit(1).single();
      if (sd) setShift({ startTime: sd.start_time || "09:00", endTime: sd.end_time || "18:00", shiftName: sd.name || "주간" });

      setLoading(false);
      checkLocation();

      // ── Realtime 구독 ──
      channel = supabase
        .channel(`crew-checkout-${worker.id}`)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "checkout_requests",
          filter: `worker_id=eq.${worker.id}`,
        }, (payload) => {
          const u = payload.new as any;
          const reqDate = new Date(u.requested_at).toISOString().split("T")[0];
          const todayStr = new Date().toISOString().split("T")[0];
          if (reqDate !== todayStr) return;

          setLatestRequest({
            id: u.id, status: u.status, requested_at: u.requested_at,
            reject_reason: u.reject_reason || null,
            approved_at: u.approved_at || null, memo: u.memo || null,
          });

          if (u.status === "approved") {
            showToast("퇴근이 승인되었습니다! 🎉", "success");
            setAttendance(prev => ({ ...prev, isCheckedOut: true }));
          } else if (u.status === "rejected") {
            showToast("퇴근요청이 반려되었습니다", "error", 3500);
          }
        })
        .subscribe();
    };

    init();
    return () => { if (channel) createClient().removeChannel(channel); };
  }, [router, loadLatestRequest, showToast]);

  // 근무시간 실시간
  useEffect(() => {
    if (!attendance.isCheckedIn || attendance.isCheckedOut || !attendance.checkInTime) return;
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() - attendance.checkInTime!.getTime()) / 60000);
      setAttendance(prev => ({ ...prev, workingMinutes: mins }));
    }, 60000);
    return () => clearInterval(interval);
  }, [attendance.isCheckedIn, attendance.isCheckedOut, attendance.checkInTime]);

  const checkLocation = () => {
    setLocationStatus("checking");
    if (!navigator.geolocation) { setLocationStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus("ok"),
      () => setLocationStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckIn = async () => {
    if (!attendance.workerId || !storeId) return;
    setActionLoading(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    try {
      const { error } = await supabase.from("worker_attendance").upsert({
        worker_id: attendance.workerId, store_id: storeId,
        work_date: today, check_in: now.toISOString(), status: "present",
      }, { onConflict: "worker_id,work_date" });
      if (error) throw error;
      setAttendance({ ...attendance, isCheckedIn: true, isCheckedOut: false, checkInTime: now, checkOutTime: null, workingMinutes: 0 });
      showToast("출근이 기록되었습니다 ☀️", "success");
    } catch { showToast("출근 기록에 실패했습니다", "error"); }
    finally { setActionLoading(false); }
  };

  const handleCheckoutRequest = async () => {
    if (!attendance.workerId || !storeId) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("checkout_requests").insert({
        worker_id: attendance.workerId, store_id: storeId,
        requested_at: new Date().toISOString(), status: "pending",
        memo: checkoutMemo || null,
      });
      if (error) throw error;
      await loadLatestRequest(attendance.workerId);
      setShowCheckoutModal(false);
      setCheckoutMemo("");
      showToast("퇴근 요청이 전송되었습니다 🌙", "info");
    } catch { showToast("퇴근 요청에 실패했습니다", "error"); }
    finally { setActionLoading(false); }
  };

  const handleReRequest = async () => {
    if (!attendance.workerId || !storeId) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("checkout_requests").insert({
        worker_id: attendance.workerId, store_id: storeId,
        requested_at: new Date().toISOString(), status: "pending",
        memo: "재요청", previous_request_id: latestRequest?.id || null,
      });
      if (error) throw error;
      await loadLatestRequest(attendance.workerId);
      showToast("퇴근 재요청이 전송되었습니다", "info");
    } catch { showToast("재요청에 실패했습니다", "error"); }
    finally { setActionLoading(false); }
  };

  const fmt = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const fmtWork = (m: number) => `${Math.floor(m / 60)}시간 ${m % 60}분`;

  const getStatus = () => {
    if (attendance.isCheckedOut) return "checkedOut";
    if (latestRequest?.status === "pending") return "pending";
    if (latestRequest?.status === "rejected") return "rejected";
    if (attendance.isCheckedIn) return "working";
    return "notCheckedIn";
  };
  const status = getStatus();

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
    </div>
  );

  return (
    <>
      <style>{`
        .att-page { min-height: 100dvh; background: #F8FAFC; }
        .att-content { padding: 20px 16px; }
        .loc-status { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; margin-bottom: 20px; font-size: 14px; }
        .loc-status.ok { background: #DCFCE7; border-color: #86EFAC; color: #166534; }
        .loc-status.error { background: #FEE2E2; border-color: #FECACA; color: #991B1B; }
        .att-card { background: #fff; border-radius: 16px; border: 1px solid #E2E8F0; padding: 24px 20px; text-align: center; margin-bottom: 20px; }
        .att-card.done { background: #F0FDF4; border-color: #86EFAC; }
        .att-icon { font-size: 40px; margin-bottom: 10px; }
        .att-title { font-size: 20px; font-weight: 700; color: #1A1D2B; }
        .att-time { font-size: 15px; color: #1428A0; font-weight: 600; margin-top: 6px; }
        .att-sub { font-size: 14px; color: #64748B; margin-top: 4px; }
        .s-banner { border-radius: 14px; padding: 16px; margin-bottom: 16px; }
        .s-banner.pending { background: #FEF3C7; border: 1.5px solid #FCD34D; }
        .s-banner.rejected { background: #FEF2F2; border: 1.5px solid #FECACA; }
        .s-banner.approved { background: #F0FDF4; border: 1.5px solid #86EFAC; }
        .s-banner-hd { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .s-banner.pending .s-banner-hd { color: #92400E; }
        .s-banner.rejected .s-banner-hd { color: #991B1B; }
        .s-banner.approved .s-banner-hd { color: #166534; }
        .s-banner-body { font-size: 14px; line-height: 1.5; }
        .s-banner.pending .s-banner-body { color: #A16207; }
        .s-banner.rejected .s-banner-body { color: #7F1D1D; }
        .s-banner.approved .s-banner-body { color: #166534; }
        .s-banner-reason { background: rgba(0,0,0,0.06); border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #7F1D1D; margin: 10px 0; line-height: 1.5; }
        .s-banner-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; background: #1428A0; color: #fff; }
        .s-banner-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .att-btn { width: 100%; padding: 18px; border-radius: 14px; border: none; font-size: 17px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
        .att-btn.in { background: #1428A0; color: #fff; }
        .att-btn.out { background: #F5B731; color: #1A1D2B; }
        .att-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .shift-info { background: #F1F5F9; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
        .shift-info-t { font-size: 13px; font-weight: 600; color: #64748B; margin-bottom: 8px; }
        .shift-info-v { font-size: 15px; font-weight: 600; color: #1A1D2B; }
        .hist-link { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; cursor: pointer; }
        .hist-link:active { background: #F8FAFC; }
        .modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 200; padding: 16px; }
        .modal-c { background: #fff; border-radius: 20px 20px 0 0; padding: 24px 20px; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0)); width: 100%; max-width: 500px; }
        .modal-t { font-size: 18px; font-weight: 700; color: #1A1D2B; margin-bottom: 16px; text-align: center; }
        .modal-i { background: #F1F5F9; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 14px; color: #475569; }
        .modal-ta { width: 100%; padding: 14px; border: 1.5px solid #E2E8F0; border-radius: 10px; font-size: 15px; resize: none; margin-bottom: 16px; font-family: inherit; box-sizing: border-box; }
        .modal-ta:focus { outline: none; border-color: #1428A0; }
        .modal-btns { display: flex; gap: 12px; }
        .modal-b { flex: 1; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; }
        .modal-b.cc { background: #F1F5F9; color: #475569; }
        .modal-b.sb { background: #F5B731; color: #1A1D2B; }
      `}</style>

      <div className="att-page">
        <CrewHeader title="출퇴근" showBack />
        <div className="att-content">
          {/* GPS - 미출근 시만 */}
          {!attendance.isCheckedIn && (
            <div className={`loc-status ${locationStatus}`}>
              {locationStatus === "checking" && <>📍 위치 확인 중...</>}
              {locationStatus === "ok" && <>✅ 매장 근처 확인됨 - 출근 가능</>}
              {locationStatus === "error" && (
                <>❌ 위치 확인 불가
                  <button onClick={checkLocation} style={{ marginLeft: 8, padding: "4px 10px", fontSize: 12, background: "#fff", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" }}>재시도</button>
                </>
              )}
            </div>
          )}

          {/* 출근 상태 카드 */}
          <div className={`att-card ${status === "checkedOut" ? "done" : ""}`}>
            {status === "checkedOut" ? (
              <><div className="att-icon">✅</div><div className="att-title">퇴근 완료</div>
                <div className="att-time">{attendance.checkInTime && fmt(attendance.checkInTime)} ~ {attendance.checkOutTime && fmt(attendance.checkOutTime)}</div>
                <div className="att-sub">총 근무: {fmtWork(attendance.workingMinutes)}</div></>
            ) : attendance.isCheckedIn ? (
              <><div className="att-icon">🟢</div><div className="att-title">출근 중</div>
                <div className="att-time">{attendance.checkInTime && fmt(attendance.checkInTime)}~</div>
                <div className="att-sub">근무시간: {fmtWork(attendance.workingMinutes)}</div></>
            ) : (
              <><div className="att-icon">⚪</div><div className="att-title">미출근</div>
                <div className="att-sub">출근 버튼을 눌러주세요</div></>
            )}
          </div>

          {/* 상태 배너 */}
          {status === "pending" && (
            <div className="s-banner pending">
              <div className="s-banner-hd">🟡 퇴근 요청 대기 중</div>
              <div className="s-banner-body">관리자가 확인 중입니다. 승인되면 자동으로 알려드려요.</div>
            </div>
          )}
          {status === "rejected" && latestRequest && (
            <div className="s-banner rejected">
              <div className="s-banner-hd">🔴 퇴근 요청이 반려되었습니다</div>
              <div className="s-banner-reason">{latestRequest.reject_reason || "사유가 기록되지 않았습니다."}</div>
              <button className="s-banner-btn" onClick={handleReRequest} disabled={actionLoading}>
                {actionLoading ? "처리 중..." : "🔄 퇴근 재요청하기"}
              </button>
            </div>
          )}
          {status === "checkedOut" && (
            <div className="s-banner approved">
              <div className="s-banner-hd">✅ 오늘 근무가 완료되었습니다</div>
              <div className="s-banner-body">수고하셨습니다! 내일 또 뵙겠습니다 👋</div>
            </div>
          )}

          {/* 출퇴근 버튼 */}
          {status === "notCheckedIn" && (
            <button className="att-btn in" onClick={handleCheckIn} disabled={actionLoading || locationStatus !== "ok"}>
              {actionLoading ? "처리 중..." : "☀️ 출근하기"}
            </button>
          )}
          {status === "working" && (
            <button className="att-btn out" onClick={() => setShowCheckoutModal(true)} disabled={actionLoading}>
              🌙 퇴근 요청
            </button>
          )}

          {/* 근무 정보 */}
          {shift && (
            <div className="shift-info">
              <div className="shift-info-t">오늘 근무 정보</div>
              <div className="shift-info-v">{shift.shiftName} | {shift.startTime} ~ {shift.endTime}</div>
            </div>
          )}

          {/* 이력 링크 */}
          <div className="hist-link" onClick={() => router.push("/crew/attendance/history")}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1D2B" }}>📋 내 요청 이력 보기</span>
            <span style={{ color: "#94A3B8", fontSize: 18 }}>→</span>
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />

        {/* 퇴근 요청 모달 */}
        {showCheckoutModal && (
          <div className="modal-ov" onClick={() => setShowCheckoutModal(false)}>
            <div className="modal-c" onClick={e => e.stopPropagation()}>
              <div className="modal-t">퇴근 요청</div>
              <div className="modal-i">
                <div>퇴근 시간: {fmt(new Date())}</div>
                <div>총 근무: {fmtWork(attendance.workingMinutes)}</div>
              </div>
              <textarea className="modal-ta" placeholder="메모 (선택)" rows={3}
                value={checkoutMemo} onChange={e => setCheckoutMemo(e.target.value)} />
              <div className="modal-btns">
                <button className="modal-b cc" onClick={() => setShowCheckoutModal(false)}>취소</button>
                <button className="modal-b sb" onClick={handleCheckoutRequest} disabled={actionLoading}>
                  {actionLoading ? "처리 중..." : "요청하기"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
