// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";

const tabs = [
  {
    id: "dashboard",
    path: "/dashboard",
    label: "홈",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#1428A0" : "rgba(255,255,255,0.45)"}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M9 17V7h5a3.5 3.5 0 0 1 0 7H9" />
      </svg>
    ),
  },
  {
    id: "entry",
    path: "/entry",
    label: "일일입력",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#1428A0" : "rgba(255,255,255,0.45)"}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    id: "workers",
    path: "/workers",
    label: "근무자",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#1428A0" : "rgba(255,255,255,0.45)"}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3.2" />
        <path d="M2.5 21c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" />
        <circle cx="18" cy="8.5" r="2.3" strokeWidth={2} />
        <path d="M21.5 21c0-2.9-1.57-5.4-3.5-5.4" strokeWidth={2} />
      </svg>
    ),
  },
  {
    id: "accident",
    path: "/accident",
    label: "사고",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#1428A0" : "rgba(255,255,255,0.45)"}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 2.5 20.5h19L12 3.5z" />
        <line x1="12" y1="10.5" x2="12" y2="15.5" strokeWidth={2.4} />
        <circle cx="12" cy="18" r="1.3" fill={active ? "#1428A0" : "rgba(255,255,255,0.45)"} stroke="none" />
      </svg>
    ),
  },
  {
    id: "more",
    path: "/more",
    label: "더보기",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "#1428A0" : "rgba(255,255,255,0.45)"}>
        <circle cx="5.5" cy="12" r="2.2" />
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="18.5" cy="12" r="2.2" />
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
          alignItems: "center",
          padding: "8px 4px calc(14px + env(safe-area-inset-bottom, 16px))",
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <div
              key={tab.id}
              onClick={() => handleClick(tab)}
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
              {/* 아이콘 박스 */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "#F5B731" : "transparent",
                  boxShadow: active ? "0 4px 14px rgba(245,183,49,0.4)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {tab.icon(active)}
              </div>

              {/* 라벨 */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 800 : 600,
                  color: active ? "#F5B731" : "rgba(255,255,255,0.4)",
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
