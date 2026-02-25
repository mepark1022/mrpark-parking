// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";

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
  checkInTime: string | null;
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
    checkInTime: null,
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
      const today = new Date().toISOString().split("T")[0];
      
      // workers 테이블에서 현재 사용자의 worker 정보 찾기
      const { data: worker } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", ctx.userId)
        .single();

      if (worker) {
        const { data: attendanceData } = await supabase
          .from("worker_attendance")
          .select("*")
          .eq("worker_id", worker.id)
          .eq("date", today)
          .single();

        if (attendanceData && attendanceData.check_in) {
          const checkInTime = new Date(attendanceData.check_in);
          const now = new Date();
          const workingMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
          
          setAttendance({
            isCheckedIn: !attendanceData.check_out,
            checkInTime: checkInTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
            workingMinutes: attendanceData.check_out ? 0 : workingMinutes,
          });
        }
      }

      // 주차 현황 조회 (mepark_tickets 사용)
      const { data: tickets } = await supabase
        .from("mepark_tickets")
        .select("id, parking_type, paid_amount")
        .eq("store_id", storeId)
        .eq("status", "parking");

      if (tickets) {
        const valetCount = tickets.filter(t => t.parking_type === "valet").length;
        
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
          total: tickets.length,
          valet: valetCount,
          occupancyRate: Math.round((tickets.length / totalSpaces) * 100),
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
        
        .crew-status-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        
        .crew-status-avatar {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
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
          font-weight: 500;
        }
        
        .crew-status-badge.checked-in {
          background: rgba(22, 163, 74, 0.3);
        }
        
        .crew-status-badge.not-checked {
          background: rgba(234, 88, 12, 0.3);
        }
        
        .crew-status-time {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          opacity: 0.85;
        }
        
        /* 통계 그리드 */
        .crew-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .crew-stat-card {
          background: #fff;
          border-radius: 12px;
          padding: 14px 10px;
          text-align: center;
          border: 1px solid #E2E8F0;
        }
        
        .crew-stat-icon {
          font-size: 20px;
          margin-bottom: 6px;
        }
        
        .crew-stat-value {
          font-size: 22px;
          font-weight: 700;
          color: #1A1D2B;
        }
        
        .crew-stat-label {
          font-size: 11px;
          color: #64748B;
          margin-top: 2px;
        }
        
        /* 빠른 메뉴 */
        .crew-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .crew-quick-menu {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .crew-quick-btn {
          background: #fff;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .crew-quick-btn:active {
          transform: scale(0.97);
          background: #F8FAFC;
        }
        
        .crew-quick-icon {
          font-size: 28px;
        }
        
        .crew-quick-label {
          font-size: 14px;
          font-weight: 600;
          color: #1A1D2B;
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
          showStoreSelector
          storeName={store?.name || "매장 선택"}
          onStoreChange={handleStoreChange}
        />

        <div className="crew-home-content">
          {/* 출근 상태 카드 */}
          <div className="crew-status-card">
            <div className="crew-status-header">
              <div className="crew-status-avatar">👤</div>
              <div>
                <div className="crew-status-name">{user?.name} 크루</div>
                <div className={`crew-status-badge ${attendance.isCheckedIn ? "checked-in" : "not-checked"}`}>
                  {attendance.isCheckedIn ? "🟢 출근 중" : "⚪ 미출근"}
                  {attendance.checkInTime && ` (${attendance.checkInTime}~)`}
                </div>
              </div>
            </div>
            {attendance.isCheckedIn && (
              <div className="crew-status-time">
                ⏱️ 근무시간: {formatWorkingTime(attendance.workingMinutes)}
              </div>
            )}
          </div>

          {/* 통계 */}
          <div className="crew-stats-grid">
            <div className="crew-stat-card">
              <div className="crew-stat-icon">🚗</div>
              <div className="crew-stat-value">{stats.total}</div>
              <div className="crew-stat-label">현재</div>
            </div>
            <div className="crew-stat-card">
              <div className="crew-stat-icon">🅿️</div>
              <div className="crew-stat-value">{stats.valet}</div>
              <div className="crew-stat-label">발렛</div>
            </div>
            <div className="crew-stat-card">
              <div className="crew-stat-icon">📊</div>
              <div className="crew-stat-value">{stats.occupancyRate}%</div>
              <div className="crew-stat-label">점유</div>
            </div>
            <div className="crew-stat-card">
              <div className="crew-stat-icon">💰</div>
              <div className="crew-stat-value">{formatRevenue(stats.todayRevenue)}</div>
              <div className="crew-stat-label">매출</div>
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
          <div className="crew-section-title">━━ 빠른 메뉴 ━━</div>
          <div className="crew-quick-menu">
            <button className="crew-quick-btn" onClick={() => router.push("/crew/entry")}>
              <span className="crew-quick-icon">🚗</span>
              <span className="crew-quick-label">입차 등록</span>
            </button>
            <button className="crew-quick-btn" onClick={() => router.push("/crew/parking-list")}>
              <span className="crew-quick-icon">🚙</span>
              <span className="crew-quick-label">출차 처리</span>
            </button>
            <button className="crew-quick-btn" onClick={() => router.push("/crew/accident")}>
              <span className="crew-quick-icon">⚠️</span>
              <span className="crew-quick-label">사고보고</span>
            </button>
            <button className="crew-quick-btn" onClick={() => router.push("/crew/monthly")}>
              <span className="crew-quick-icon">📅</span>
              <span className="crew-quick-label">월주차</span>
            </button>
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />
      </div>
    </>
  );
}
