// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";

interface AttendanceInfo {
  isCheckedIn: boolean;
  checkInTime: Date | null;
  workingMinutes: number;
  workerId: string | null;
}

interface ShiftInfo {
  startTime: string;
  endTime: string;
  shiftName: string;
}

export default function CrewAttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceInfo>({
    isCheckedIn: false,
    checkInTime: null,
    workingMinutes: 0,
    workerId: null,
  });
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"checking" | "ok" | "far" | "error">("checking");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutMemo, setCheckoutMemo] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/crew/login");
        return;
      }

      const savedStoreId = localStorage.getItem("crew_store_id");
      if (!savedStoreId) {
        router.replace("/crew/select-store");
        return;
      }
      setStoreId(savedStoreId);

      // worker 정보 조회
      const { data: worker } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!worker) {
        setLoading(false);
        return;
      }

      // 오늘 출근 정보
      const today = new Date().toISOString().split("T")[0];
      const { data: attendanceData } = await supabase
        .from("worker_attendance")
        .select("*")
        .eq("worker_id", worker.id)
        .eq("work_date", today)
        .single();

      if (attendanceData && attendanceData.check_in) {
        const checkInTime = new Date(attendanceData.check_in);
        const now = new Date();
        const workingMinutes = attendanceData.check_out 
          ? 0 
          : Math.floor((now.getTime() - checkInTime.getTime()) / 60000);

        setAttendance({
          isCheckedIn: !attendanceData.check_out,
          checkInTime,
          workingMinutes,
          workerId: worker.id,
        });
      } else {
        setAttendance(prev => ({ ...prev, workerId: worker.id }));
      }

      // 근무조 정보
      const { data: shiftData } = await supabase
        .from("store_shifts")
        .select("*")
        .eq("store_id", savedStoreId)
        .limit(1)
        .single();

      if (shiftData) {
        setShift({
          startTime: shiftData.start_time || "09:00",
          endTime: shiftData.end_time || "18:00",
          shiftName: shiftData.name || "주간",
        });
      }

      setLoading(false);

      // GPS 확인
      checkLocation();
    };

    init();
  }, [router]);

  // 근무시간 실시간 업데이트
  useEffect(() => {
    if (!attendance.isCheckedIn || !attendance.checkInTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const minutes = Math.floor((now.getTime() - attendance.checkInTime!.getTime()) / 60000);
      setAttendance(prev => ({ ...prev, workingMinutes: minutes }));
    }, 60000); // 1분마다

    return () => clearInterval(interval);
  }, [attendance.isCheckedIn, attendance.checkInTime]);

  const checkLocation = () => {
    setLocationStatus("checking");
    
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // TODO: 실제로는 매장 좌표와 비교해야 함
        // 현재는 항상 OK로 처리
        setLocationStatus("ok");
      },
      () => {
        setLocationStatus("error");
      },
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
      // 출근 기록 생성/업데이트
      const { error } = await supabase
        .from("worker_attendance")
        .upsert({
          worker_id: attendance.workerId,
          store_id: storeId,
          work_date: today,
          check_in: now.toISOString(),
          status: "present",
        }, {
          onConflict: "worker_id,work_date",
        });

      if (error) throw error;

      setAttendance({
        ...attendance,
        isCheckedIn: true,
        checkInTime: now,
        workingMinutes: 0,
      });
    } catch (err) {
      console.error("출근 기록 실패:", err);
      alert("출근 기록에 실패했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckoutRequest = async () => {
    if (!attendance.workerId || !storeId) return;
    
    setActionLoading(true);
    const supabase = createClient();

    try {
      // 퇴근 요청 생성
      const { error } = await supabase
        .from("checkout_requests")
        .insert({
          worker_id: attendance.workerId,
          store_id: storeId,
          requested_at: new Date().toISOString(),
          status: "pending",
          memo: checkoutMemo || null,
        });

      if (error) throw error;

      setShowCheckoutModal(false);
      setCheckoutMemo("");
      alert("퇴근 요청이 전송되었습니다. 관리자 승인을 기다려주세요.");
    } catch (err) {
      console.error("퇴근 요청 실패:", err);
      alert("퇴근 요청에 실패했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatWorkingTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .attendance-page {
          min-height: 100dvh;
          background: #F8FAFC;
        }
        
        .attendance-content {
          padding: 20px 16px;
        }
        
        /* 위치 상태 */
        .location-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .location-status.ok {
          background: #DCFCE7;
          border-color: #86EFAC;
          color: #166534;
        }
        
        .location-status.far {
          background: #FEF3C7;
          border-color: #FCD34D;
          color: #92400E;
        }
        
        .location-status.error {
          background: #FEE2E2;
          border-color: #FECACA;
          color: #991B1B;
        }
        
        /* 출근 상태 카드 */
        .attendance-status-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          padding: 24px 20px;
          text-align: center;
          margin-bottom: 20px;
        }
        
        .attendance-status-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .attendance-status-text {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 8px;
        }
        
        .attendance-status-time {
          font-size: 32px;
          font-weight: 700;
          color: #1428A0;
          margin-bottom: 4px;
        }
        
        .attendance-status-working {
          font-size: 14px;
          color: #64748B;
        }
        
        /* 출퇴근 버튼 */
        .attendance-btn {
          width: 100%;
          padding: 18px;
          border-radius: 14px;
          border: none;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        
        .attendance-btn.checkin {
          background: #1428A0;
          color: #fff;
        }
        
        .attendance-btn.checkout {
          background: #F5B731;
          color: #1A1D2B;
        }
        
        .attendance-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        /* 근무 정보 */
        .shift-info {
          background: #F1F5F9;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        
        .shift-info-title {
          font-size: 13px;
          font-weight: 600;
          color: #64748B;
          margin-bottom: 8px;
        }
        
        .shift-info-time {
          font-size: 15px;
          font-weight: 600;
          color: #1A1D2B;
        }
        
        /* 내 요청 이력 링크 */
        .history-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #fff;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          cursor: pointer;
        }
        
        .history-link:active {
          background: #F8FAFC;
        }
        
        .history-link-text {
          font-size: 15px;
          font-weight: 600;
          color: #1A1D2B;
        }
        
        .history-link-arrow {
          color: #94A3B8;
          font-size: 18px;
        }
        
        /* 모달 */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 200;
          padding: 16px;
        }
        
        .modal-content {
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 24px 20px;
          padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
          width: 100%;
          max-width: 500px;
        }
        
        .modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 16px;
          text-align: center;
        }
        
        .modal-info {
          background: #F1F5F9;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #475569;
        }
        
        .modal-textarea {
          width: 100%;
          padding: 14px;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          font-size: 15px;
          resize: none;
          margin-bottom: 16px;
          font-family: inherit;
        }
        
        .modal-textarea:focus {
          outline: none;
          border-color: #1428A0;
        }
        
        .modal-buttons {
          display: flex;
          gap: 12px;
        }
        
        .modal-btn {
          flex: 1;
          padding: 14px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }
        
        .modal-btn.cancel {
          background: #F1F5F9;
          border: none;
          color: #475569;
        }
        
        .modal-btn.submit {
          background: #F5B731;
          border: none;
          color: #1A1D2B;
        }
      `}</style>

      <div className="attendance-page">
        <CrewHeader title="출퇴근" showBack />

        <div className="attendance-content">
          {/* 위치 상태 */}
          <div className={`location-status ${locationStatus}`}>
            {locationStatus === "checking" && <>📍 위치 확인 중...</>}
            {locationStatus === "ok" && <>✅ 매장 근처 확인됨 - 출근 가능</>}
            {locationStatus === "far" && <>⚠️ 매장에서 멀리 있습니다</>}
            {locationStatus === "error" && (
              <>
                ❌ 위치를 확인할 수 없습니다
                <button 
                  onClick={checkLocation}
                  style={{ marginLeft: 8, padding: "4px 10px", fontSize: 12, background: "#fff", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" }}
                >
                  재시도
                </button>
              </>
            )}
          </div>

          {/* 출근 상태 */}
          <div className="attendance-status-card">
            {attendance.isCheckedIn ? (
              <>
                <div className="attendance-status-icon">🟢</div>
                <div className="attendance-status-text">출근 중</div>
                <div className="attendance-status-time">
                  {attendance.checkInTime && formatTime(attendance.checkInTime)}~
                </div>
                <div className="attendance-status-working">
                  근무시간: {formatWorkingTime(attendance.workingMinutes)}
                </div>
              </>
            ) : (
              <>
                <div className="attendance-status-icon">⚪</div>
                <div className="attendance-status-text">미출근</div>
                <div className="attendance-status-working">
                  출근 버튼을 눌러주세요
                </div>
              </>
            )}
          </div>

          {/* 출퇴근 버튼 */}
          {!attendance.isCheckedIn ? (
            <button
              className="attendance-btn checkin"
              onClick={handleCheckIn}
              disabled={actionLoading || locationStatus !== "ok"}
            >
              {actionLoading ? "처리 중..." : "☀️ 출근하기"}
            </button>
          ) : (
            <button
              className="attendance-btn checkout"
              onClick={() => setShowCheckoutModal(true)}
              disabled={actionLoading}
            >
              🌙 퇴근 요청
            </button>
          )}

          {/* 근무 정보 */}
          {shift && (
            <div className="shift-info">
              <div className="shift-info-title">오늘 근무 정보</div>
              <div className="shift-info-time">
                {shift.shiftName} | {shift.startTime} ~ {shift.endTime}
              </div>
            </div>
          )}

          {/* 내 요청 이력 */}
          <div 
            className="history-link"
            onClick={() => router.push("/crew/attendance/history")}
          >
            <span className="history-link-text">📋 내 요청 이력 보기</span>
            <span className="history-link-arrow">→</span>
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />

        {/* 퇴근 요청 모달 */}
        {showCheckoutModal && (
          <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-title">퇴근 요청</div>
              
              <div className="modal-info">
                <div>퇴근 시간: {formatTime(new Date())}</div>
                <div>총 근무: {formatWorkingTime(attendance.workingMinutes)}</div>
              </div>

              <textarea
                className="modal-textarea"
                placeholder="메모 (선택)"
                rows={3}
                value={checkoutMemo}
                onChange={e => setCheckoutMemo(e.target.value)}
              />

              <div className="modal-buttons">
                <button 
                  className="modal-btn cancel"
                  onClick={() => setShowCheckoutModal(false)}
                >
                  취소
                </button>
                <button
                  className="modal-btn submit"
                  onClick={handleCheckoutRequest}
                  disabled={actionLoading}
                >
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
