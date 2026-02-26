// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";

const tabs = [
  {
    id: "dashboard",
    path: "/dashboard",
    label: "홈",
    isHome: true,
    icon: (active: boolean) => (
      <span style={{
        fontFamily: "'Outfit', sans-serif",
        fontSize: 20,
        fontWeight: 900,
        color: "#1428A0",
        lineHeight: 1,
      }}>P</span>
    ),
  },
  {
    id: "entry",
    path: "/entry",
    label: "일일입력",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#F5B731" : "rgba(255,255,255,0.4)"}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: "workers",
    path: "/workers",
    label: "근무자",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#F5B731" : "rgba(255,255,255,0.4)"}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
        <circle cx="18" cy="8.5" r="2.2" />
        <path d="M21 21v-.5a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    id: "accident",
    path: "/accident",
    label: "사고",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#F5B731" : "rgba(255,255,255,0.4)"}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4 2.5 20h19L12 4z" />
        <line x1="12" y1="10" x2="12" y2="14" strokeWidth={2} />
        <circle cx="12" cy="17" r="0.8" fill={active ? "#F5B731" : "rgba(255,255,255,0.4)"} stroke="none" />
      </svg>
    ),
  },
  {
    id: "more",
    path: "/more",
    label: "더보기",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#F5B731" : "rgba(255,255,255,0.4)"}>
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    ),
  },
];

const moreRoutes = ["/parking-status", "/monthly", "/analytics", "/stores", "/team", "/settings", "/guide", "/more"];

export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.id === "more") return moreRoutes.some((r) => pathname.startsWith(r));
    return pathname.startsWith(tab.path);
  };

  const handleClick = (tab: typeof tabs[0]) => {
    router.push(tab.id === "more" ? "/more" : tab.path);
  };

  return (
    <>
      <style>{`
        .mobile-tab-bar { display: flex !important; }
        @media (min-width: 768px) { .mobile-tab-bar { display: none !important; } }
      `}</style>
      <div
        className="mobile-tab-bar"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: "#1428A0",
          justifyContent: "space-around",
          alignItems: "flex-end",
          padding: "0 4px calc(8px + env(safe-area-inset-bottom, 10px))",
          height: "auto",
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab);
          const isHome = (tab as any).isHome;

          if (isHome) {
            // ★ P(홈) 버튼: 큰 골드 원형, 위로 floating
            return (
              <div
                key={tab.id}
                onClick={() => handleClick(tab)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  marginTop: -16,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#F5B731",
                    boxShadow: "0 4px 16px rgba(245,183,49,0.5)",
                  }}
                >
                  {tab.icon(active)}
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#F5B731",
                    letterSpacing: "-0.3px",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  {tab.label}
                </span>
              </div>
            );
          }

          // ★ 나머지 탭: 아이콘+라벨만, 골드원형 없음
          return (
            <div
              key={tab.id}
              onClick={() => handleClick(tab)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                paddingTop: 12,
              }}
            >
              {tab.icon(active)}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#F5B731" : "rgba(255,255,255,0.35)",
                  letterSpacing: "-0.3px",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
