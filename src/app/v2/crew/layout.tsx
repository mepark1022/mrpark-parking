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

const NAV_ITEMS = [
  { id: "home",       label: "홈",     path: "/v2/crew",             Icon: IconHome },
  { id: "parking",    label: "현황",   path: "/v2/crew/parking",     Icon: IconCar },
  { id: "attendance", label: "출퇴근", path: "/v2/crew/attendance",  Icon: IconClock },
  { id: "settings",   label: "설정",   path: "/v2/crew/settings",    Icon: IconGear },
];

// BottomNav 숨기는 경로
const HIDE_NAV_PATHS = ["/v2/crew/login", "/v2/crew/select-store"];

// ── BottomNav 컴포넌트 ──
function CrewV2BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [exitReqCount, setExitReqCount] = useState(0);

  // 출차요청 폴링 (v1 API 사용)
  useEffect(() => {
    let prevCount = -1;

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

        if (count > prevCount && prevCount >= 0) {
          // 진동
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          // 브라우저 알림
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const plate = exitReqs[0]?.plate_number || "차량";
            const diff = count - prevCount;
            new Notification("🚗 출차요청", {
              body: diff === 1 ? `${plate} 출차요청이 도착했습니다` : `${plate} 외 ${diff - 1}건 출차요청`,
              icon: "/icons/icon-192x192.png",
              tag: "exit-request",
              renotify: true,
            });
          }
        }
        setExitReqCount(count);
        prevCount = count;
      } catch { /* 네트워크 에러 무시 */ }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => {
    if (path === "/v2/crew") return pathname === "/v2/crew";
    return pathname.startsWith(path);
  };

  return (
    <>
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
