// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

/**
 * CREW v2 레이아웃
 * - /v2/crew/login, /v2/crew/select-store → BottomNav 숨김
 * - 그 외 → BottomNav 표시 + 출차요청 폴링
 */

// ── SVG 아이콘 ──
const IconHome = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? "#1428A0" : "rgba(255,255,255,0.75)"}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const IconCar = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? "#1428A0" : "rgba(255,255,255,0.75)"}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3v-5l2.5-5h11L19 12v5h-2" />
    <circle cx="7.5" cy="17.5" r="1.5" />
    <circle cx="16.5" cy="17.5" r="1.5" />
    <path d="M5 12h14" />
  </svg>
);

const IconClock = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? "#1428A0" : "rgba(255,255,255,0.75)"}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" strokeWidth={2.2} />
  </svg>
);

const IconGear = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? "#1428A0" : "rgba(255,255,255,0.75)"}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconReport = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? "#1428A0" : "rgba(255,255,255,0.75)"}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {/* 클립보드 */}
    <path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" />
    <rect x="9" y="3" width="6" height="8" rx="1" />
    {/* 내부 줄 */}
    <path d="M7 16h10M7 18h6" strokeWidth={1.8} />
  </svg>
);

const NAV_ITEMS = [
  { id: "home",       label: "홈",     path: "/v2/crew",                  Icon: IconHome },
  { id: "parking",    label: "현황",   path: "/v2/crew/parking",          Icon: IconCar },
  { id: "attendance", label: "출퇴근", path: "/v2/crew/attendance",       Icon: IconClock },
  { id: "daily-report", label: "마감", path: "/v2/crew/daily-report/new", Icon: IconReport },
  { id: "settings",   label: "설정",   path: "/v2/crew/settings",         Icon: IconGear },
];

// BottomNav 숨기는 경로
const HIDE_NAV_PATHS = ["/v2/crew/login", "/v2/crew/select-store", "/v2/crew/entry/qr"];

// ── BottomNav 컴포넌트 ──
function CrewV2BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [exitReqCount, setExitReqCount] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; line1: string; line2: string | null }[]>([]);

  // 토스트 추가 (최대 3개 누적, 5초 후 자동 제거)
  const addToast = useCallback((line1: string, line2: string | null) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, line1, line2 }].slice(-3));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  // 출차요청 폴링 (v1 API 사용)
  useEffect(() => {
    // 신규 감지: count가 아닌 ticket id 셋으로 비교 (처리+신규 동시 발생 누락 방지)
    let seenIds = new Set<string>();
    let prevStore: string | null = null;

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const poll = async () => {
      const sid = localStorage.getItem("crew_store_id");
      if (!sid) return;
      try {
        const res = await fetch(`/api/v1/tickets/active?store_id=${sid}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const { data } = await res.json();
        const tickets = data?.tickets || [];
        const exitReqs = tickets.filter((t: any) => t.status === "exit_requested");
        const count = exitReqs.length;

        // 매장 전환 시: 현재 건은 베이스라인으로만 등록(알림 없음)
        if (sid !== prevStore) {
          seenIds = new Set(exitReqs.map((t: any) => t.id));
          prevStore = sid;
          setExitReqCount(count);
          return;
        }

        // 신규 출차요청 = 이전 폴에 없던 id (count 동일해도 감지됨)
        const newReqs = exitReqs.filter((t: any) => !seenIds.has(t.id));

        if (newReqs.length > 0) {
          const diff = newReqs.length;
          const primary = newReqs[0];
          // 진동
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          // 브라우저 알림
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const plate = primary?.plate_number || "차량";
            new Notification("🚗 출차요청", {
              body: diff === 1 ? `${plate} 출차요청이 도착했습니다` : `${plate} 외 ${diff - 1}건 출차요청`,
              icon: "/icons/icon-192x192.png",
              tag: "exit-request",
              renotify: true,
            });
          }
          // 앱 내 토스트 (v4.2 표기 규칙)
          const last4 =
            primary?.plate_last4 ||
            (primary?.plate_number || "").replace(/[^0-9]/g, "").slice(-4) ||
            "차량";
          if (diff > 1) {
            // 다중 누적 → "1234 · 외 N건" (위치 라인 생략)
            addToast(`${last4} · 외 ${diff - 1}건`, null);
          } else {
            // 동일 4자리 충돌 여부 (현재 활성 티켓 중 같은 last4 2건 이상)
            const sameLast4 = primary?.plate_last4
              ? tickets.filter((t: any) => t.plate_last4 === primary.plate_last4).length
              : 0;
            const collision = sameLast4 > 1;
            const lotName = primary?.parking_lots?.name || null;
            const loc = primary?.parking_location || null;
            const locParts = [lotName ? `🅿️ ${lotName}` : null, loc].filter(Boolean) as string[];
            if (collision) {
              // 충돌 → "1234 · 흰색 SUV" + 둘째줄 위치
              const carDesc =
                [primary?.car_color, primary?.car_type].filter(Boolean).join(" ") || "차종미입력";
              addToast(`${last4} · ${carDesc}`, locParts.length ? locParts.join(" · ") : null);
            } else {
              // 충돌 없음 → 위치 있으면 한 줄, 없으면 4자리만
              addToast(locParts.length ? `${last4} · ${locParts.join(" · ")}` : `${last4}`, null);
            }
          }
        }

        // 매 폴마다 갱신: 처리된 건 제거 + 신규 반영
        seenIds = new Set(exitReqs.map((t: any) => t.id));
        setExitReqCount(count);
      } catch { /* 네트워크 에러 무시 */ }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [addToast]);

  const isActive = (path: string) => {
    if (path === "/v2/crew") return pathname === "/v2/crew";
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* ── 출차요청 앱 내 토스트 (상단 고정, 누적) ── */}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: 12, right: 12, zIndex: 300,
          display: "flex", flexDirection: "column", gap: 8,
          pointerEvents: "none",
        }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              onClick={() => {
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
                router.push("/v2/crew/parking");
              }}
              style={{
                pointerEvents: "auto",
                background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
                borderRadius: 14, padding: "12px 14px",
                borderLeft: "4px solid #F5B731",
                boxShadow: "0 8px 24px rgba(10,19,82,0.45)",
                display: "flex", alignItems: "flex-start", gap: 10,
                cursor: "pointer",
                animation: "crewV2ToastIn 0.3s cubic-bezier(0.16,1,0.3,1)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#F5B731",
                  letterSpacing: "-0.2px", marginBottom: 4,
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}>
                  🚗 출차요청
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800, color: "#fff",
                  letterSpacing: "-0.3px", fontFamily: "'Noto Sans KR', sans-serif",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {t.line1}
                </div>
                {t.line2 && (
                  <div style={{
                    fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)",
                    marginTop: 2, fontFamily: "'Noto Sans KR', sans-serif",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {t.line2}
                  </div>
                )}
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
                style={{
                  width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1,
                }}
              >
                ✕
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -4px 20px rgba(10,19,82,0.3)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "8px 4px calc(16px + env(safe-area-inset-bottom, 10px))",
      }}>
        {NAV_ITEMS.map(({ id, label, path, Icon }) => {
          const active = isActive(path);
          const hasBadge = id === "parking" && exitReqCount > 0;
          return (
            <div key={id} onClick={() => router.push(path)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "#F5B731" : "transparent",
                boxShadow: active ? "0 4px 12px rgba(245,183,49,0.4)" : "none",
                transition: "all 0.2s", position: "relative",
              }}>
                <Icon active={active} />
                {hasBadge && (
                  <div style={{
                    position: "absolute", top: -2, right: -4,
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: "#DC2626", border: "2px solid #0a1352",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", animation: "crewV2BadgePulse 1.5s ease-in-out infinite",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{exitReqCount}</span>
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: active ? 800 : 600,
                color: active ? "#F5B731" : "rgba(255,255,255,0.75)",
                letterSpacing: "-0.3px", fontFamily: "'Noto Sans KR', sans-serif",
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes crewV2BadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes crewV2ToastIn {
          0% { opacity: 0; transform: translateY(-16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── 하단 스페이서 ──
function NavSpacer() {
  return <div style={{ height: "calc(80px + env(safe-area-inset-bottom, 10px))" }} />;
}

// ── Layout ──
export default function CrewV2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PATHS.some(p => pathname.startsWith(p));

  return (
    <>
      {children}
      {!hideNav && (
        <>
          <NavSpacer />
          <CrewV2BottomNav />
        </>
      )}
    </>
  );
}
