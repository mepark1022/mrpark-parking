// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";
import AttendanceMapView from "@/components/crew/AttendanceMapView";

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
  created_at: string;
  request_date: string;
  requested_checkout_time: string | null;
  reject_reason: string | null;
  approved_at: string | null;
  request_reason: string | null;
}

// 두 좌표 간 거리 계산 (Haversine, 미터)
function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [currentCoords, setCurrentCoords] = useState<{lat: number; lng: number} | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [checkoutMemo, setCheckoutMemo] = useState("");
  const [missingCheckouts, setMissingCheckouts] = useState<any[]>([]);
  const [selectedMissing, setSelectedMissing] = useState<any | null>(null);
  const [missingLoading, setMissingLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<{name: string; address: string; lat: number | null; lng: number | null; gpsRadius: number} | null>(null);
  const [checkInCoords, setCheckInCoords] = useState<{lat: number; lng: number} | null>(null);
  const [checkOutCoords, setCheckOutCoords] = useState<{lat: number; lng: number} | null>(null);
  const router = useRouter();
  const { showToast } = useCrewToast();

  const loadLatestRequest = useCallback(async (wid: string) => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("checkout_requests")
      .select("id, status, created_at, request_date, requested_checkout_time, request_reason, reject_reason, approved_at")
      .eq("worker_id", wid)
      .eq("request_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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

      // 매장 정보 로드 (이름, 주소, 좌표)
      const { data: storeData } = await supabase
        .from("stores").select("name, road_address, latitude, longitude, gps_radius_meters")
        .eq("id", savedStoreId).single();
      if (storeData) {
        setStoreInfo({
          name: storeData.name || "",
          address: storeData.road_address || "",
          lat: storeData.latitude ? parseFloat(storeData.latitude) : null,
          lng: storeData.longitude ? parseFloat(storeData.longitude) : null,
          gpsRadius: storeData.gps_radius_meters ?? 150,
        });
      }

      let { data: worker } = await supabase
        .from("workers").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      
      // worker 레코드가 없는 admin/super_admin → 자동 생성
      if (!worker) {
        const { data: prof } = await supabase.from("profiles").select("name, role, org_id").eq("id", user.id).single();
        if (prof && (prof.role === "super_admin" || prof.role === "admin" || prof.role === "owner")) {
          const { data: newWorker, error: insertErr } = await supabase.from("workers").insert({
            org_id: prof.org_id,
            user_id: user.id,
            name: prof.name || "관리자",
            phone: "",
            status: "active",
          }).select("id").single();
          if (!insertErr && newWorker) {
            worker = newWorker;
            // 현재 매장에 store_members도 추가
            if (savedStoreId && prof.org_id) {
              await supabase.from("store_members").upsert({
                user_id: user.id, store_id: savedStoreId, org_id: prof.org_id,
              }, { onConflict: "user_id,store_id" }).catch(() => {});
            }
          }
        }
        if (!worker) { setLoading(false); checkLocation(); return; }
      }

      // 오늘 출근 정보
      const today = new Date().toISOString().split("T")[0];
      const { data: ad } = await supabase
        .from("worker_attendance").select("*")
        .eq("worker_id", worker.id).eq("date", today).maybeSingle();

      if (ad && ad.check_in) {
        // check_in/check_out은 "HH:MM" 형식 → 오늘 날짜와 결합
        const [ch, cm] = ad.check_in.split(":");
        const cin = new Date(); cin.setHours(parseInt(ch), parseInt(cm), 0, 0);
        let cout: Date | null = null;
        if (ad.check_out) {
          const [oh, om] = ad.check_out.split(":");
          cout = new Date(); cout.setHours(parseInt(oh), parseInt(om), 0, 0);
        }
        const now = new Date();
        const mins = cout
          ? Math.floor((cout.getTime() - cin.getTime()) / 60000)
          : Math.floor((now.getTime() - cin.getTime()) / 60000);
        setAttendance({
          isCheckedIn: true, isCheckedOut: !!ad.check_out,
          checkInTime: cin, checkOutTime: cout,
          workingMinutes: mins, workerId: worker.id,
        });
        // GPS 좌표 복원
        if (ad.check_in_lat && ad.check_in_lng) {
          setCheckInCoords({ lat: parseFloat(ad.check_in_lat), lng: parseFloat(ad.check_in_lng) });
        }
        if (ad.check_out_lat && ad.check_out_lng) {
          setCheckOutCoords({ lat: parseFloat(ad.check_out_lat), lng: parseFloat(ad.check_out_lng) });
        }
      } else {
        setAttendance(prev => ({ ...prev, workerId: worker.id }));
      }

      await loadLatestRequest(worker.id);

      // 근무조
      const { data: sd } = await supabase
        .from("store_shifts").select("*").eq("store_id", savedStoreId).limit(1).maybeSingle();
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
          const reqDate = u.request_date;
          const todayStr = new Date().toISOString().split("T")[0];
          if (reqDate !== todayStr) return;

          setLatestRequest({
            id: u.id, status: u.status, created_at: u.created_at,
            request_date: u.request_date, requested_checkout_time: u.requested_checkout_time || null,
            reject_reason: u.reject_reason || null,
            approved_at: u.approved_at || null, request_reason: u.request_reason || null,
          });

          if (u.status === "approved") {
            showToast("퇴근수정이 승인되었습니다! 🎉", "success");
          } else if (u.status === "rejected") {
            showToast("퇴근수정 요청이 반려되었습니다", "error", 3500);
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
    setCurrentAddress("");
    if (!navigator.geolocation) { setLocationStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setLocationStatus("ok");
        
        // 역지오코딩 — 카카오 API (좌표 → 주소)
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data.address) {
            const display = data.building_name 
              ? `${data.address}\n${data.road_address} (${data.building_name})`
              : data.road_address 
                ? `${data.address}\n${data.road_address}`
                : data.address;
            setCurrentAddress(display);
          } else {
            setCurrentAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        } catch {
          setCurrentAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
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
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", authUser?.id).single();
      const oid = prof?.org_id;

      // GPS 좌표 + 매장 거리 계산
      const gpsData: any = {};
      if (currentCoords) {
        gpsData.check_in_lat = currentCoords.lat;
        gpsData.check_in_lng = currentCoords.lng;
        if (storeInfo?.lat && storeInfo?.lng) {
          gpsData.check_in_distance_m = getDistanceM(currentCoords.lat, currentCoords.lng, storeInfo.lat, storeInfo.lng);
        }
      }

      // 기존 레코드 확인
      const { data: existing } = await supabase
        .from("worker_attendance").select("id")
        .eq("worker_id", attendance.workerId).eq("date", today).maybeSingle();

      if (existing) {
        const { error } = await supabase.from("worker_attendance").update({
          check_in: timeStr, status: "present", store_id: storeId, ...gpsData,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worker_attendance").insert({
          org_id: oid, worker_id: attendance.workerId, store_id: storeId,
          date: today, check_in: timeStr, status: "present", ...gpsData,
        });
        if (error) throw error;
      }
      if (currentCoords) setCheckInCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
      setAttendance({ ...attendance, isCheckedIn: true, isCheckedOut: false, checkInTime: now, checkOutTime: null, workingMinutes: 0 });
      showToast("출근이 기록되었습니다 ☀️", "success");
    } catch (e: any) { showToast(`출근 기록 실패: ${e?.message || ""}`, "error"); }
    finally { setActionLoading(false); }
  };

  // ── 직접 퇴근 (GPS 범위 내) ──
  const handleCheckOut = async () => {
    if (!attendance.workerId || !storeId) return;
    setActionLoading(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // GPS 좌표 + 매장 거리 계산
    const gpsData: any = {};
    if (currentCoords) {
      gpsData.check_out_lat = currentCoords.lat;
      gpsData.check_out_lng = currentCoords.lng;
      if (storeInfo?.lat && storeInfo?.lng) {
        gpsData.check_out_distance_m = getDistanceM(currentCoords.lat, currentCoords.lng, storeInfo.lat, storeInfo.lng);
      }
    }

    try {
      const { data: existing } = await supabase
        .from("worker_attendance").select("id")
        .eq("worker_id", attendance.workerId).eq("date", today).maybeSingle();

      if (existing) {
        const { error } = await supabase.from("worker_attendance").update({
          check_out: timeStr, ...gpsData,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        // 출근 기록 없이 퇴근만 하는 예외 상황
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", authUser?.id).single();
        const { error } = await supabase.from("worker_attendance").insert({
          org_id: prof?.org_id, worker_id: attendance.workerId, store_id: storeId,
          date: today, check_out: timeStr, status: "present", ...gpsData,
        });
        if (error) throw error;
      }
      if (currentCoords) setCheckOutCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
      setAttendance({ ...attendance, isCheckedOut: true, checkOutTime: now });
      showToast("퇴근이 기록되었습니다 🌙", "success");
    } catch (e: any) { showToast(`퇴근 기록 실패: ${e?.message || ""}`, "error"); }
    finally { setActionLoading(false); }
  };

  // ── 퇴근수정 요청 (깜빡했을 때 관리자에게 요청) ──
  const handleCorrectionRequest = async () => {
    if (!attendance.workerId || !storeId || !selectedMissing) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", authUser?.id).single();
      const { error } = await supabase.from("checkout_requests").insert({
        org_id: prof?.org_id,
        worker_id: attendance.workerId, store_id: selectedMissing.store_id || storeId,
        request_date: selectedMissing.date,
        requested_checkout_time: "18:00",
        request_reason: checkoutMemo || "퇴근 미처리 수정 요청",
        status: "pending",
      });
      if (error) throw error;
      await loadLatestRequest(attendance.workerId);
      setShowCorrectionModal(false);
      setCheckoutMemo("");
      setSelectedMissing(null);
      showToast("퇴근수정 요청이 전송되었습니다 📋", "info");
    } catch (e: any) { showToast(`요청 실패: ${e?.message || "알 수 없는 오류"}`, "error"); }
    finally { setActionLoading(false); }
  };

  const handleReRequest = async () => {
    if (!attendance.workerId || !storeId || !latestRequest) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", authUser?.id).single();
      const { error } = await supabase.from("checkout_requests").insert({
        org_id: prof?.org_id,
        worker_id: attendance.workerId, store_id: storeId,
        request_date: latestRequest.request_date,
        requested_checkout_time: latestRequest.requested_checkout_time,
        request_reason: `재요청: ${latestRequest.request_reason || "퇴근 미처리 수정"}`,
        status: "pending",
      });
      if (error) throw error;
      await loadLatestRequest(attendance.workerId);
      showToast("수정 재요청이 전송되었습니다", "info");
    } catch { showToast("재요청에 실패했습니다", "error"); }
    finally { setActionLoading(false); }
  };

  // ── 퇴근수정 모달 열기 → 미퇴근 이력 자동 조회 ──
  const openCorrectionModal = async () => {
    setShowCorrectionModal(true);
    setSelectedMissing(null);
    setCheckoutMemo("");
    setMissingLoading(true);
    try {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("worker_attendance")
        .select("id, date, check_in, check_out, status, store_id, stores:store_id(name)")
        .eq("worker_id", attendance.workerId)
        .not("check_in", "is", null)
        .is("check_out", null)
        .lt("date", today)
        .order("date", { ascending: false })
        .limit(30);
      setMissingCheckouts(data || []);
    } catch { setMissingCheckouts([]); }
    finally { setMissingLoading(false); }
  };

  const fmt = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const fmtWork = (m: number) => `${Math.floor(m / 60)}시간 ${m % 60}분`;

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
        .loc-box { background: #fff; border-radius: 14px; border: 1.5px solid #E2E8F0; padding: 14px 16px; margin-bottom: 20px; }
        .loc-box.ok { background: #F0FDF4; border-color: #86EFAC; }
        .loc-box.error { background: #FEE2E2; border-color: #FECACA; }
        .loc-box.checking { background: #F8FAFC; }
        .loc-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #1A1D2B; }
        .loc-label { flex: 1; color: #166534; }
        .loc-addr { margin-top: 8px; font-size: 15px; font-weight: 700; color: #1428A0; line-height: 1.5; padding-left: 26px; white-space: pre-line; }
        .loc-refresh { background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px; }
        .loc-retry-btn { margin-left: auto; padding: 6px 12px; font-size: 12px; font-weight: 600; background: #fff; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; color: #991B1B; }
        .loc-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #94A3B8; border-top-color: #1428A0; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
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
        .modal-c { background: #fff; border-radius: 20px 20px 0 0; padding: 24px 20px; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0)); width: 100%; max-width: 500px; max-height: 85dvh; overflow-y: auto; }
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
          {/* GPS 위치 - 미출근 또는 출근 중(퇴근 전) */}
          {!attendance.isCheckedOut && (
            <div className={`loc-box ${locationStatus}`}>
              {locationStatus === "checking" && (
                <div className="loc-row">
                  <span className="loc-spinner"></span>
                  <span>위치 확인 중...</span>
                </div>
              )}
              {locationStatus === "ok" && (
                <>
                  <div className="loc-row">
                    <span>📍</span>
                    <span className="loc-label">현재 내 위치</span>
                    <button onClick={checkLocation} className="loc-refresh">🔄</button>
                  </div>
                  <div className="loc-addr">
                    {currentAddress || "주소 불러오는 중..."}
                  </div>
                </>
              )}
              {locationStatus === "error" && (
                <div className="loc-row">
                  <span>❌</span>
                  <span>위치 확인 불가</span>
                  <button onClick={checkLocation} className="loc-retry-btn">재시도</button>
                </div>
              )}
            </div>
          )}

          {/* 매장 지도 - 출근 중 또는 퇴근 완료 시 표시 */}
          {(attendance.isCheckedIn || attendance.isCheckedOut) && storeInfo && (
            <div style={{ marginBottom: 16 }}>
              {/* 매장명 + 반경 안내 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🏪</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1D2B" }}>{storeInfo.name}</span>
                </div>
                <span style={{ fontSize: 12, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                  반경 {storeInfo.gpsRadius}m
                </span>
              </div>

              {/* 지도 */}
              <AttendanceMapView
                storeLat={storeInfo.lat}
                storeLng={storeInfo.lng}
                checkInCoords={checkInCoords}
                checkOutCoords={checkOutCoords}
                currentCoords={!attendance.isCheckedOut ? currentCoords : null}
                gpsRadius={storeInfo.gpsRadius}
              />

              {/* 거리 정보 */}
              {storeInfo.lat && storeInfo.lng && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {currentCoords && !attendance.isCheckedOut && (
                    <div style={{ flex: 1, minWidth: 100, background: "#EFF6FF", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#1D4ED8", fontWeight: 600 }}>📱 현재 거리</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8", marginTop: 2 }}>
                        {getDistanceM(currentCoords.lat, currentCoords.lng, storeInfo.lat, storeInfo.lng)}m
                      </div>
                    </div>
                  )}
                  {checkInCoords && (
                    <div style={{ flex: 1, minWidth: 100, background: "#F0FDF4", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>🟢 출근 거리</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#166534", marginTop: 2 }}>
                        {getDistanceM(checkInCoords.lat, checkInCoords.lng, storeInfo.lat, storeInfo.lng)}m
                      </div>
                    </div>
                  )}
                  {checkOutCoords && (
                    <div style={{ flex: 1, minWidth: 100, background: "#FEF2F2", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 600 }}>🔴 퇴근 거리</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", marginTop: 2 }}>
                        {getDistanceM(checkOutCoords.lat, checkOutCoords.lng, storeInfo.lat, storeInfo.lng)}m
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 출근 상태 카드 - compact */}
          <div style={{
            background: attendance.isCheckedOut ? "#F0FDF4" : attendance.isCheckedIn ? "#fff" : "#fff",
            border: `1.5px solid ${attendance.isCheckedOut ? "#86EFAC" : attendance.isCheckedIn ? "#BFDBFE" : "#E2E8F0"}`,
            borderRadius: 14, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <div style={{ fontSize: 28 }}>
              {attendance.isCheckedOut ? "✅" : attendance.isCheckedIn ? "🟢" : "⚪"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1D2B" }}>
                {attendance.isCheckedOut ? "퇴근 완료" : attendance.isCheckedIn ? "출근 중" : "미출근"}
              </div>
              {attendance.isCheckedOut ? (
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                  {attendance.checkInTime && fmt(attendance.checkInTime)} ~ {attendance.checkOutTime && fmt(attendance.checkOutTime)}
                  &nbsp;·&nbsp;총 {fmtWork(attendance.workingMinutes)}
                </div>
              ) : attendance.isCheckedIn ? (
                <div style={{ fontSize: 13, color: "#1428A0", marginTop: 2 }}>
                  {attendance.checkInTime && fmt(attendance.checkInTime)}~ &nbsp;·&nbsp; {fmtWork(attendance.workingMinutes)}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>출근 버튼을 눌러주세요</div>
              )}
            </div>
          </div>

          {/* 퇴근수정 요청 상태 배너 */}
          {latestRequest?.status === "pending" && (
            <div className="s-banner pending">
              <div className="s-banner-hd">🟡 퇴근수정 요청 대기 중</div>
              <div className="s-banner-body">관리자가 확인 중입니다. 승인되면 자동으로 알려드려요.</div>
            </div>
          )}
          {latestRequest?.status === "rejected" && (
            <div className="s-banner rejected">
              <div className="s-banner-hd">🔴 퇴근수정 요청이 반려되었습니다</div>
              <div className="s-banner-reason">{latestRequest.reject_reason || "사유가 기록되지 않았습니다."}</div>
              <button className="s-banner-btn" onClick={handleReRequest} disabled={actionLoading}>
                {actionLoading ? "처리 중..." : "🔄 수정 재요청하기"}
              </button>
            </div>
          )}
          {attendance.isCheckedOut && (
            <div className="s-banner approved">
              <div className="s-banner-hd">✅ 오늘 근무가 완료되었습니다</div>
              <div className="s-banner-body">수고하셨습니다! 내일 또 뵙겠습니다 👋</div>
            </div>
          )}

          {/* 출퇴근 버튼 */}
          {!attendance.isCheckedIn && !attendance.isCheckedOut && (
            <button className="att-btn in" onClick={handleCheckIn} disabled={actionLoading || locationStatus !== "ok"}>
              {actionLoading ? "처리 중..." : "☀️ 출근하기"}
            </button>
          )}
          {attendance.isCheckedIn && !attendance.isCheckedOut && (
            <button className="att-btn out" onClick={handleCheckOut} disabled={actionLoading || locationStatus !== "ok"}>
              {actionLoading ? "처리 중..." : "🌙 퇴근하기"}
            </button>
          )}

          {/* 근무 정보 */}
          {shift && (
            <div className="shift-info">
              <div className="shift-info-t">오늘 근무 정보</div>
              <div className="shift-info-v">{shift.shiftName} | {shift.startTime} ~ {shift.endTime}</div>
            </div>
          )}

          {/* 퇴근수정 요청 + 이력 링크 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="hist-link" onClick={openCorrectionModal}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1D2B" }}>📋 퇴근수정 요청</span>
              <span style={{ color: "#94A3B8", fontSize: 12 }}>퇴근 미처리 시</span>
            </div>
            <div className="hist-link" onClick={() => router.push("/crew/attendance/history")}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1D2B" }}>📜 내 요청 이력 보기</span>
              <span style={{ color: "#94A3B8", fontSize: 18 }}>→</span>
            </div>
            {attendance.isCheckedOut && (
              <button
                onClick={() => router.push("/crew")}
                style={{
                  width: "100%", padding: 16, borderRadius: 12, border: "1.5px solid #1428A0",
                  background: "#fff", color: "#1428A0", fontSize: 15, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                🏠 홈으로 돌아가기
              </button>
            )}
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />

        {/* 퇴근수정 요청 모달 */}
        {showCorrectionModal && (
          <div className="modal-ov" onClick={() => setShowCorrectionModal(false)}>
            <div className="modal-c" onClick={e => e.stopPropagation()}>
              <div className="modal-t">퇴근수정 요청</div>

              {/* Step 1: 미퇴근 이력 선택 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>① 미퇴근 날짜 선택</div>
                {missingLoading ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8", fontSize: 13 }}>
                    <span className="loc-spinner" style={{ marginRight: 8 }}></span>조회 중...
                  </div>
                ) : missingCheckouts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8", fontSize: 13, background: "#F8FAFC", borderRadius: 10 }}>
                    미퇴근 이력이 없습니다 ✓
                  </div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {missingCheckouts.map(m => {
                      const d = new Date(m.date + "T00:00:00");
                      const wd = ["일","월","화","수","목","금","토"][d.getDay()];
                      const isSelected = selectedMissing?.id === m.id;
                      return (
                        <div key={m.id} onClick={() => setSelectedMissing(isSelected ? null : m)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${isSelected ? "#1428A0" : "#E2E8F0"}`,
                            background: isSelected ? "#EEF2FF" : "#fff",
                            transition: "all 0.15s",
                          }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${isSelected ? "#1428A0" : "#CBD5E1"}`,
                            background: isSelected ? "#1428A0" : "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B" }}>
                              {`${d.getMonth()+1}월 ${d.getDate()}일 (${wd})`}
                            </div>
                            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                              출근 {m.check_in}{m.stores?.name ? ` · ${m.stores.name}` : ""}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "3px 8px", borderRadius: 6 }}>
                            미퇴근
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: 사유 입력 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>② 사유 입력</div>
                <textarea className="modal-ta" placeholder="예: 퇴근 처리를 깜빡했습니다" rows={2}
                  value={checkoutMemo} onChange={e => setCheckoutMemo(e.target.value)}
                  style={{ marginBottom: 0 }} />
              </div>

              {/* Step 3: 요청 버튼 */}
              <div className="modal-btns">
                <button className="modal-b cc" onClick={() => setShowCorrectionModal(false)}>취소</button>
                <button className="modal-b sb" onClick={handleCorrectionRequest}
                  disabled={actionLoading || !selectedMissing || !checkoutMemo.trim()}>
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
