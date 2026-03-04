// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";

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
            }}>
              <Icon active={active} />
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
    </div>
  );
}

// 하단 네비 공간 확보용 스페이서
export function CrewNavSpacer() {
  return (
    <div style={{ height: "calc(80px + env(safe-area-inset-bottom, 10px))" }} />
  );
}
