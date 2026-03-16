// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";
import { getToday } from "@/lib/utils/date";

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

interface StoreInfo {
  id: string;
  name: string;
}

interface AttendanceInfo {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  workingMinutes: number;
}

interface ParkingStats {
  total: number;
  valet: number;
  occupancyRate: number;
  todayRevenue: number;
}

export default function CrewHomePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [attendance, setAttendance] = useState<AttendanceInfo>({
    isCheckedIn: false,
    isCheckedOut: false,
    checkInTime: null,
    checkOutTime: null,
    workingMinutes: 0,
  });
  const [stats, setStats] = useState<ParkingStats>({
    total: 0,
    valet: 0,
    occupancyRate: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [exitReqCount, setExitReqCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const ctx = await getUserContext();
      
      if (!ctx.userId) {
        router.replace("/crew/login");
        return;
      }

      if (ctx.role !== "crew" && ctx.role !== "admin" && ctx.role !== "owner" && ctx.role !== "super_admin") {
        router.replace("/crew/login");
        return;
      }

      // 프로필에서 이름 가져오기
      const { data: profile } = await supabase
        .from("profiles").select("name").eq("id", ctx.userId).single();
      setUser({ id: ctx.userId, name: profile?.name || "크루", role: ctx.role });

      // 콜백에서 온 경우: 쿠키 → localStorage 이전
      const crewStoreCookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith("crew_store_id="));
      if (crewStoreCookie) {
        const cookieStoreId = crewStoreCookie.split("=")[1];
        if (cookieStoreId) {
          localStorage.setItem("crew_store_id", cookieStoreId);
          // 매장명도 이전
          const nameCookie = document.cookie
            .split("; ")
            .find((c) => c.startsWith("crew_store_name="));
          if (nameCookie) {
            const cookieName = decodeURIComponent(nameCookie.split("=")[1] || "");
            if (cookieName) localStorage.setItem("crew_store_name", cookieName);
          }
        }
      }

      // 선택된 매장 확인
      let storeId = localStorage.getItem("crew_store_id");
      
      if (!storeId) {
        router.replace("/crew/select-store");
        return;
      }

      // 매장 정보 조회
      const { data: storeData } = await supabase
        .from("stores")
        .select("id, name")
        .eq("id", storeId)
        .single();

      if (storeData) {
        setStore(storeData);
        localStorage.setItem("crew_store_name", storeData.name);
      }

      // 오늘 출근 정보 조회
      const today = getToday();
      
      // workers 테이블에서 현재 사용자의 worker 정보 찾기
      let { data: worker } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", ctx.userId)
        .limit(1)
        .maybeSingle();
      
      // worker 레코드가 없는 사용자 → 자동 생성 (중복 방지)
      if (!worker) {
        const { data: prof } = await supabase.from("profiles").select("name, org_id").eq("id", ctx.userId).single();
        if (prof) {
          const displayName = prof.name || (ctx.role === "crew" ? "크루" : "관리자");
          const { data: newWorker, error: insertErr } = await supabase.from("workers").insert({
            org_id: prof.org_id,
            user_id: ctx.userId,
            name: displayName,
            phone: "",
            status: "active",
          }).select("id").single();
          if (newWorker) {
            worker = newWorker;
          } else if (insertErr?.code === "23505") {
            const { data: existing } = await supabase
              .from("workers").select("id").eq("user_id", ctx.userId).limit(1).maybeSingle();
            if (existing) worker = existing;
          }
        }
      }

      if (worker) {
        const { data: attendanceData } = await supabase
          .from("worker_attendance")
          .select("*")
          .eq("worker_id", worker.id)
          .eq("date", today)
          .maybeSingle();

        if (attendanceData && attendanceData.check_in) {
          // check_in은 "HH:MM" 형식 → 오늘 날짜와 결합
          const [h, m] = attendanceData.check_in.split(":");
          const checkInTime = new Date();
          checkInTime.setHours(parseInt(h), parseInt(m), 0, 0);
          const now = new Date();
          
          let workingMinutes = 0;
          let checkOutTimeStr: string | null = null;
          
          if (attendanceData.check_out) {
            // 퇴근함 → 총 근무시간 계산
            const [oh, om] = attendanceData.check_out.split(":");
            const checkOutTime = new Date();
            checkOutTime.setHours(parseInt(oh), parseInt(om), 0, 0);
            workingMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
            checkOutTimeStr = checkOutTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
          } else {
            // 출근 중 → 현재까지 근무시간
            workingMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
          }
          
          setAttendance({
            isCheckedIn: !attendanceData.check_out,
            isCheckedOut: !!attendanceData.check_out,
            checkInTime: checkInTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
            checkOutTime: checkOutTimeStr,
            workingMinutes,
          });
        }
      }

      // 주차 현황 조회 (mepark_tickets 사용)
      const { data: tickets } = await supabase
        .from("mepark_tickets")
        .select("id, parking_type, paid_amount, status")
        .eq("store_id", storeId)
        .in("status", ["parking", "exit_requested", "car_ready"]);

      if (tickets) {
        const parkingTickets = tickets.filter(t => t.status === "parking");
        const valetCount = parkingTickets.filter(t => t.parking_type === "valet").length;
        const exitReq = tickets.filter(t => t.status === "exit_requested").length;
        setExitReqCount(exitReq);
        
        // 오늘 매출 (완료된 티켓)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { data: completedTickets } = await supabase
          .from("mepark_tickets")
          .select("paid_amount")
          .eq("store_id", storeId)
          .eq("status", "completed")
          .gte("exit_at", todayStart.toISOString());

        const todayRevenue = completedTickets?.reduce((sum, t) => sum + (t.paid_amount || 0), 0) || 0;

        // 총 주차면수 조회
        const { data: lots } = await supabase
          .from("parking_lots")
          .select("self_spaces, mechanical_normal, mechanical_suv")
          .eq("store_id", storeId);

        const totalSpaces = lots?.reduce((sum, lot) => 
          sum + (lot.self_spaces || 0) + (lot.mechanical_normal || 0) + (lot.mechanical_suv || 0), 0) || 100;

        setStats({
          total: parkingTickets.length,
          valet: valetCount,
          occupancyRate: Math.round((parkingTickets.length / totalSpaces) * 100),
          todayRevenue,
        });
      }

      // 최근 알림 (퇴근요청 반려 등)
      if (worker) {
        const { data: recentRequests } = await supabase
          .from("checkout_requests")
          .select("*")
          .eq("worker_id", worker.id)
          .eq("status", "rejected")
          .order("updated_at", { ascending: false })
          .limit(3);

        if (recentRequests && recentRequests.length > 0) {
          setNotifications(recentRequests.map(req => ({
            id: req.id,
            type: "rejected",
            message: "퇴근요청이 반려되었습니다",
            reason: req.reject_reason || "사유 확인 필요",
            time: new Date(req.updated_at).toLocaleString("ko-KR"),
          })));
        }
      }

      setLoading(false);
    };

    init();

    // 5초 폴링 - 출차요청 감지 (진동만, 알림은 CrewBottomNav에서 처리)
    let prevCount = 0;
    const supabaseRt = createClient();
    const pollInterval = setInterval(async () => {
      const sid = localStorage.getItem("crew_store_id");
      if (!sid) return;
      const { data } = await supabaseRt
        .from("mepark_tickets")
        .select("id")
        .eq("store_id", sid)
        .eq("status", "exit_requested");
      const count = data?.length || 0;
      if (count > prevCount) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      setExitReqCount(count);
      prevCount = count;
    }, 5000);

    return () => { clearInterval(pollInterval); };
  }, [router]);

  const handleStoreChange = () => {
    router.push("/crew/select-store");
  };

  const formatWorkingTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  const formatRevenue = (amount: number) => {
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만`;
    }
    return amount.toLocaleString();
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
        .crew-home {
          min-height: 100dvh;
          background: #F8FAFC;
        }
        
        .crew-home-content {
          padding: 16px;
        }
        
        /* 출근 상태 카드 */
        .crew-status-card {
          background: linear-gradient(135deg, #1428A0 0%, #1e36c0 100%);
          border-radius: 16px;
          padding: 20px;
          color: #fff;
          margin-bottom: 16px;
        }
        
        .crew-status-name {
          font-size: 17px;
          font-weight: 700;
        }
        
        .crew-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.15);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
        }
        
        .crew-status-badge.checked-in {
          background: #F5B731;
          color: #1A1D2B;
        }
        
        .crew-status-badge.not-checked {
          background: #475569;
          color: #CBD5E1;
        }
        
        .crew-status-badge.checked-out {
          background: rgba(100, 116, 139, 0.3);
        }
        
        
        /* KPI 배너 통합형 (안 D) */
        .crew-kpi-banner {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 1px 6px rgba(20,40,160,0.06);
        }
        .crew-kpi-divider {
          height: 3px;
          background: linear-gradient(90deg, #1428A0 0%, #D97706 33%, #16A34A 66%, #EA580C 100%);
        }
        .crew-kpi-row {
          display: flex;
          align-items: stretch;
        }
        .crew-kpi-item {
          flex: 1;
          padding: 14px 8px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          border-right: 1px solid #F1F5F9;
        }
        .crew-kpi-item:last-child { border-right: none; }
        .crew-kpi-icon { margin-bottom: 4px; }
        .crew-kpi-value {
          font-family: 'Outfit', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #1A1D2B;
          line-height: 1;
        }
        .crew-kpi-label {
          font-size: 10px;
          color: #94A3B8;
          font-weight: 600;
        }
        
        /* 빠른 메뉴 */
        .crew-section-title {
          font-size: 15px;
          font-weight: 800;
          color: #1A1D2B;
          margin-bottom: 12px;
        }
        
        .crew-quick-menu {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }
        
        .crew-quick-btn {
          background: #fff;
          border: 1px solid #F1F5F9;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100px;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        
        .crew-quick-btn:active {
          transform: scale(0.97);
          background: #F8FAFC;
        }

        .crew-quick-tip::after {
          content: attr(data-tip);
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(20, 40, 160, 0.92);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 0 0 16px 16px;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.2s, transform 0.2s;
          pointer-events: none;
          line-height: 1.4;
        }
        .crew-quick-tip:hover::after {
          opacity: 1;
          transform: translateY(0);
        }
        @media (hover: none) {
          .crew-quick-tip:active::after {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .crew-quick-label {
          font-size: 15px;
          font-weight: 800;
          color: #1A1D2B;
          text-align: left;
        }
        
        .crew-quick-emoji {
          align-self: flex-end;
          line-height: 1;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .crew-quick-emoji::before {
          content: '';
          position: absolute;
          top: 2px; left: 15%; right: 15%; height: 40%;
          background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%);
          border-radius: 12px 12px 50% 50%;
          z-index: 1;
        }
        .crew-quick-emoji svg { position: relative; z-index: 2; }
        .crew-quick-emoji.icon-car {
          background: linear-gradient(135deg, #1E3A8A 0%, #1428A0 50%, #0F1D6B 100%);
          box-shadow: 0 4px 12px rgba(20,40,160,0.35), inset 0 1px 1px rgba(255,255,255,0.3);
        }
        .crew-quick-emoji.icon-exit {
          background: linear-gradient(135deg, #059669 0%, #16A34A 50%, #0D7A37 100%);
          box-shadow: 0 4px 12px rgba(22,163,74,0.35), inset 0 1px 1px rgba(255,255,255,0.3);
        }
        .crew-quick-emoji.icon-accident {
          background: linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #C2410C 100%);
          box-shadow: 0 4px 12px rgba(234,88,12,0.35), inset 0 1px 1px rgba(255,255,255,0.3);
        }
        .crew-quick-emoji.icon-monthly {
          background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%);
          box-shadow: 0 4px 12px rgba(124,58,237,0.35), inset 0 1px 1px rgba(255,255,255,0.3);
        }
        
        /* 알림 섹션 */
        .crew-notifications {
          margin-bottom: 20px;
        }
        
        .crew-notification-card {
          background: #FEF3C7;
          border: 1px solid #FCD34D;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 10px;
        }
        
        .crew-notification-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #92400E;
          margin-bottom: 6px;
        }
        
        .crew-notification-reason {
          font-size: 13px;
          color: #A16207;
          line-height: 1.5;
        }
        
        .crew-notification-action {
          margin-top: 10px;
        }
        
        .crew-notification-btn {
          padding: 8px 14px;
          background: #F59E0B;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
        }
      `}</style>

      <div className="crew-home">
        <CrewHeader
          title=""
          showLogo
          storeName={store?.name || "매장 선택"}
          onStoreChange={handleStoreChange}
        />

        {/* ─── 출차요청 배너 ─── */}
        {exitReqCount > 0 && (
          <div
            onClick={() => router.push("/crew/parking-list")}
            style={{
              background: "#EA580C", color: "#fff",
              padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🚗</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>출차요청 {exitReqCount}건!</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>즉시 처리가 필요합니다</div>
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.25)", borderRadius: 8,
              padding: "6px 12px", fontSize: 13, fontWeight: 700,
            }}>처리하기 →</div>
          </div>
        )}

        <div className="crew-home-content">
          {/* 출근 상태 카드 */}
          <div className="crew-status-card">
            {/* 상단: 이름 + 매장 버튼 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="crew-status-name">{user?.name} 크루</div>
              <button
                onClick={handleStoreChange}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 12px",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)",
                  cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#F5B731" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                {store?.name || "매장"}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.6)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            {/* 출근 상태 + 근무시간 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className={`crew-status-badge ${attendance.isCheckedOut ? "checked-out" : attendance.isCheckedIn ? "checked-in" : "not-checked"}`}>
                {attendance.isCheckedOut
                  ? `✅ 퇴근 (${attendance.checkInTime}~${attendance.checkOutTime})`
                  : attendance.isCheckedIn
                    ? `● 출근 중 (${attendance.checkInTime}~)`
                    : "● 미출근"}
              </div>
              {(attendance.isCheckedIn || attendance.isCheckedOut) && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  ⏱️ {attendance.isCheckedOut ? "총 근무시간" : "근무시간"}: {formatWorkingTime(attendance.workingMinutes)}
                </div>
              )}
            </div>
          </div>

        {/* KPI 배너 통합형 (안 D) */}
          <div className="crew-kpi-banner">
            <div className="crew-kpi-divider" />
            <div className="crew-kpi-row">
              <div className="crew-kpi-item">
                <div className="crew-kpi-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 17H3v-5l2.5-5h11L19 12v5h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 12h14"/>
                  </svg>
                </div>
                <div className="crew-kpi-value">{stats.total}</div>
                <div className="crew-kpi-label">현재입차</div>
              </div>
              <div className="crew-kpi-item">
                <div className="crew-kpi-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div className="crew-kpi-value">{stats.valet}</div>
                <div className="crew-kpi-label">발렛</div>
              </div>
              <div className="crew-kpi-item">
                <div className="crew-kpi-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                  </svg>
                </div>
                <div className="crew-kpi-value">{stats.occupancyRate}%</div>
                <div className="crew-kpi-label">점유율</div>
              </div>
              <div className="crew-kpi-item">
                <div className="crew-kpi-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="crew-kpi-value" style={{ fontSize: stats.todayRevenue >= 10000 ? 16 : 22 }}>
                  {formatRevenue(stats.todayRevenue)}
                </div>
                <div className="crew-kpi-label">오늘매출</div>
              </div>
            </div>
          </div>

          {/* 알림 (반려된 퇴근요청 등) */}
          {notifications.length > 0 && (
            <div className="crew-notifications">
              <div className="crew-section-title">🔔 알림</div>
              {notifications.slice(0, 1).map(noti => (
                <div key={noti.id} className="crew-notification-card">
                  <div className="crew-notification-header">
                    🔴 {noti.message}
                  </div>
                  <div className="crew-notification-reason">
                    사유: {noti.reason}
                  </div>
                  <div className="crew-notification-action">
                    <button 
                      className="crew-notification-btn"
                      onClick={() => router.push("/crew/attendance/history")}
                    >
                      확인하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 빠른 메뉴 */}
          <div className="crew-section-title">빠른 메뉴</div>
          <div className="crew-quick-menu">
            <button className="crew-quick-btn crew-quick-tip" onClick={() => router.push("/crew/entry")} data-tip="번호판 인식 또는 수동으로 입차 등록">
              <span className="crew-quick-label">입차 등록</span>
              <span className="crew-quick-emoji icon-car">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 17H3v-5l2.5-5h11L19 12v5h-2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="7.5" cy="17.5" r="1.8" stroke="#F5B731" strokeWidth="1.5"/>
                  <circle cx="16.5" cy="17.5" r="1.8" stroke="#F5B731" strokeWidth="1.5"/>
                  <path d="M5 12h14" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                </svg>
              </span>
            </button>
            <button className="crew-quick-btn crew-quick-tip" onClick={() => router.push("/crew/parking-list")} data-tip="주차 중 차량 확인 및 출차 처리">
              <span className="crew-quick-label">출차 처리</span>
              <span className="crew-quick-emoji icon-exit">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="3" stroke="#fff" strokeWidth="1.8"/>
                  <path d="M12 9l4 3-4 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="17" cy="7" r="2.5" fill="#F5B731" stroke="#fff" strokeWidth="0.8"/>
                  <text x="17" y="8.2" textAnchor="middle" fontSize="3.5" fontWeight="900" fill="#1A1D2B">P</text>
                </svg>
              </span>
            </button>
            <button className="crew-quick-btn crew-quick-tip" onClick={() => router.push("/crew/accident")} data-tip="사고 발생 시 사진과 함께 보고">
              <span className="crew-quick-label">사고 보고</span>
              <span className="crew-quick-emoji icon-accident">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3L2 20h20L12 3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.1)"/>
                  <path d="M12 10v4" stroke="#F5B731" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="12" cy="17" r="1" fill="#F5B731"/>
                </svg>
              </span>
            </button>
            <button className="crew-quick-btn crew-quick-tip" onClick={() => router.push("/crew/monthly")} data-tip="월주차 계약 차량 검색 및 조회">
              <span className="crew-quick-label">월주차 조회</span>
              <span className="crew-quick-emoji icon-monthly">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="17" rx="3" stroke="#fff" strokeWidth="1.8"/>
                  <path d="M3 9h18" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                  <path d="M8 2v4M16 2v4" stroke="#F5B731" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="8" cy="13" r="1.2" fill="#F5B731"/><circle cx="12" cy="13" r="1.2" fill="rgba(255,255,255,0.5)"/><circle cx="16" cy="13" r="1.2" fill="rgba(255,255,255,0.5)"/>
                  <circle cx="8" cy="17" r="1.2" fill="rgba(255,255,255,0.5)"/><circle cx="12" cy="17" r="1.2" fill="rgba(255,255,255,0.5)"/>
                </svg>
              </span>
            </button>
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />
      </div>
    </>
  );
}
