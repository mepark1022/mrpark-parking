// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * CREW v2 홈 페이지
 * - GET /api/v1/auth/me — 사용자 정보
 * - GET /api/v1/tickets/active?store_id=xxx — 현재 주차 현황
 * - Supabase 직접 호출 없음 (API-first)
 */

interface UserInfo {
  name: string;
  role: string;
  emp_no: string;
  password_changed: boolean;
}

interface ParkingStats {
  total: number;
  valet: number;
  self: number;
  exitRequested: number;
  carReady: number;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "슈퍼관리자",
  admin: "관리자",
  owner: "오너",
  crew: "크루",
  field_member: "현장직원",
};

export default function CrewV2HomePage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [stats, setStats] = useState<ParkingStats>({ total: 0, valet: 0, self: 0, exitRequested: 0, carReady: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  // 시간 업데이트 (1분)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 초기 로드
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(sname || "매장");
    loadData(sid);
  }, [router]);

  const loadData = useCallback(async (sid: string) => {
    try {
      // 병렬 호출
      const [meRes, ticketsRes] = await Promise.all([
        fetch("/api/v1/auth/me", { credentials: "include" }),
        fetch(`/api/v1/tickets/active?store_id=${sid}`, { credentials: "include" }),
      ]);

      // 인증 실패
      if (!meRes.ok) {
        router.replace("/v2/crew/login?error=session_expired");
        return;
      }

      const { data: me } = await meRes.json();
      setUser({
        name: me?.employee?.name || me?.emp_no || "크루",
        role: me?.role || "crew",
        emp_no: me?.emp_no || "",
        password_changed: me?.password_changed ?? true,
      });

      // 티켓 통계
      if (ticketsRes.ok) {
        const { data: ticketData } = await ticketsRes.json();
        const tickets = ticketData?.tickets || [];
        setStats({
          total: tickets.length,
          valet: tickets.filter((t: any) => t.parking_type === "valet").length,
          self: tickets.filter((t: any) => t.parking_type === "self").length,
          exitRequested: tickets.filter((t: any) => t.status === "exit_requested").length,
          carReady: tickets.filter((t: any) => t.status === "car_ready").length,
        });
      }
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(storeId);
  };

  // 시간 포맷
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .cv2-home { min-height: 100dvh; background: #F8FAFC; }
        .cv2-home-header {
          background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
          padding: 20px 20px 24px;
          padding-top: calc(20px + env(safe-area-inset-top, 0));
        }
        .cv2-quick-btn {
          flex: 1; padding: 18px 12px; border-radius: 16px;
          border: none; display: flex; flex-direction: column;
          align-items: center; gap: 8px; cursor: pointer;
          transition: all 0.15s; -webkit-tap-highlight-color: transparent;
        }
        .cv2-quick-btn:active { transform: scale(0.96); }
        .cv2-stat-card {
          background: #fff; border-radius: 14px; border: 1px solid #E2E8F0;
          padding: 16px; text-align: center;
        }
      `}</style>

      <div className="cv2-home">
        {/* ── 헤더 ── */}
        <div className="cv2-home-header">
          {/* 상단: 사용자 + 매장 변경 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                {user?.name}님
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  color: "#F5B731", background: "rgba(245,183,49,0.15)",
                  padding: "3px 8px", borderRadius: 6,
                }}>
                  {ROLE_LABEL[user?.role || "crew"] || user?.role}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                📍 {storeName}
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("crew_store_id");
                localStorage.removeItem("crew_store_name");
                router.push("/v2/crew/select-store");
              }}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              매장변경
            </button>
          </div>

          {/* 시간 */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
              {timeStr}
            </span>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{dateStr}</span>
          </div>

          {/* 비밀번호 변경 권장 */}
          {user && !user.password_changed && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 10,
              background: "rgba(245,183,49,0.15)", border: "1px solid rgba(245,183,49,0.3)",
              fontSize: 13, color: "#F5B731", display: "flex", alignItems: "center", gap: 8,
            }}>
              ⚠️ 초기 비밀번호를 변경해 주세요
            </div>
          )}
        </div>

        {/* ── 주차 현황 카드 ── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0",
            padding: 20, position: "relative",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B" }}>🚗 현재 주차 현황</span>
              <button onClick={handleRefresh} disabled={refreshing}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: refreshing ? 0.4 : 1 }}>
                🔄
              </button>
            </div>

            {/* 총 대수 */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 48, fontWeight: 900, color: "#1428A0", lineHeight: 1 }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>현재 주차 대수</div>
            </div>

            {/* 상세 4칸 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <div className="cv2-stat-card">
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>발렛</div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: "#1428A0" }}>{stats.valet}</div>
              </div>
              <div className="cv2-stat-card">
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>자주식</div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: "#475569" }}>{stats.self}</div>
              </div>
              <div className="cv2-stat-card" style={stats.exitRequested > 0 ? { background: "#FEF2F2", borderColor: "#FECACA" } : {}}>
                <div style={{ fontSize: 11, color: stats.exitRequested > 0 ? "#DC2626" : "#64748B", marginBottom: 4 }}>출차요청</div>
                <div style={{
                  fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800,
                  color: stats.exitRequested > 0 ? "#DC2626" : "#475569",
                }}>
                  {stats.exitRequested}
                </div>
              </div>
              <div className="cv2-stat-card" style={stats.carReady > 0 ? { background: "#F0FDF4", borderColor: "#BBF7D0" } : {}}>
                <div style={{ fontSize: 11, color: stats.carReady > 0 ? "#16A34A" : "#64748B", marginBottom: 4 }}>차량준비</div>
                <div style={{
                  fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800,
                  color: stats.carReady > 0 ? "#16A34A" : "#475569",
                }}>
                  {stats.carReady}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 빠른 액션 ── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {/* 입차 등록 */}
            <button
              className="cv2-quick-btn"
              style={{ background: "#1428A0", color: "#fff" }}
              onClick={() => router.push("/v2/crew/entry")}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>입차 등록</span>
            </button>

            {/* 주차 현황 */}
            <button
              className="cv2-quick-btn"
              style={{ background: "#fff", color: "#1A1D2B", border: "1px solid #E2E8F0" }}
              onClick={() => router.push("/v2/crew/parking")}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="22" height="18" rx="2" ry="2" />
                  <path d="M1 9h22" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>주차 현황</span>
              {stats.exitRequested > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#DC2626",
                  background: "#FEF2F2", padding: "2px 8px", borderRadius: 10,
                }}>
                  출차요청 {stats.exitRequested}건
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── 출차요청 알림 (있을 때만) ── */}
        {stats.exitRequested > 0 && (
          <div style={{ padding: "16px 16px 0" }}>
            <div
              onClick={() => router.push("/v2/crew/parking")}
              style={{
                background: "#FEF2F2", border: "1.5px solid #FECACA",
                borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
                animation: "cv2AlertPulse 2s ease-in-out infinite",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🔔</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>
                    출차요청 {stats.exitRequested}건
                  </div>
                  <div style={{ fontSize: 12, color: "#991B1B", marginTop: 2 }}>
                    터치하여 확인하세요
                  </div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        )}

        {/* ── 안내 ── */}
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
            미팍Ticket CREW v2 · API-first
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cv2AlertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.2); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>
    </>
  );
}
