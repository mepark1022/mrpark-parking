// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── SVG 아이콘 ── */
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
  { id: "home",        label: "홈",     path: "/crew",              Icon: IconHome },
  { id: "parking",    label: "현황",   path: "/crew/parking-list", Icon: IconCar },
  { id: "attendance", label: "출퇴근", path: "/crew/attendance",   Icon: IconClock },
  { id: "settings",   label: "설정",   path: "/crew/settings",     Icon: IconGear },
];

export default function CrewBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [exitReqCount, setExitReqCount] = useState(0);

  // 전역 출차요청 폴링 (모든 CREW 페이지에서 동작)
  useEffect(() => {
    let prevCount = -1; // -1 = 초기 로드 (알림 안 보냄)

    // 브라우저 알림 권한 요청
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const poll = async () => {
      const sid = typeof window !== "undefined" ? localStorage.getItem("crew_store_id") : null;
      if (!sid) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("mepark_tickets")
        .select("id, plate_number")
        .eq("store_id", sid)
        .eq("status", "exit_requested");
      const count = data?.length || 0;

      // 새 출차요청 감지 → 브라우저 알림 + 진동
      if (count > prevCount && prevCount >= 0) {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const plate = data?.[0]?.plate_number || "차량";
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
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => {
    if (path === "/crew") return pathname === "/crew";
    return pathname.startsWith(path);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 -4px 20px rgba(10,19,82,0.3)",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: "8px 4px calc(16px + env(safe-area-inset-bottom, 10px))",
    }}>
      {NAV_ITEMS.map(({ id, label, path, Icon }) => {
        const active = isActive(path);
        const hasBadge = id === "parking" && exitReqCount > 0;
        return (
          <div
            key={id}
            onClick={() => router.push(path)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* 아이콘 박스: 활성=골드 둥근사각형 */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: active ? "#F5B731" : "transparent",
              boxShadow: active ? "0 4px 12px rgba(245,183,49,0.4)" : "none",
              transition: "all 0.2s",
              position: "relative",
            }}>
              <Icon active={active} />
              {/* 출차요청 빨간 뱃지 */}
              {hasBadge && (
                <div style={{
                  position: "absolute", top: -2, right: -4,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: "#DC2626", border: "2px solid #0a1352",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                  animation: "crewBadgePulse 1.5s ease-in-out infinite",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{exitReqCount}</span>
                </div>
              )}
            </div>

            {/* 라벨 */}
            <span style={{
              fontSize: 11,
              fontWeight: active ? 800 : 600,
              color: active ? "#F5B731" : "rgba(255,255,255,0.75)",
              letterSpacing: "-0.3px",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              {label}
            </span>
          </div>
        );
      })}
      <style>{`
        @keyframes crewBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// 하단 네비 공간 확보용 스페이서
export function CrewNavSpacer() {
  return (
    <div style={{ height: "calc(80px + env(safe-area-inset-bottom, 10px))" }} />
  );
}
