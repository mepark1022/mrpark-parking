// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";

const tabs = [
  {
    id: "dashboard",
    path: "/dashboard",
    label: "홈",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#1428A0" : "#94a3b8"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-8 9 8M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    id: "entry",
    path: "/entry",
    label: "입력",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#1428A0" : "#94a3b8"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    id: "workers",
    path: "/workers",
    label: "근무자",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#1428A0" : "#94a3b8"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: "accident",
    path: "/accident",
    label: "사고",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#1428A0" : "#94a3b8"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: "more",
    path: "/more",
    label: "더보기",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.5" fill={active ? "#1428A0" : "#94a3b8"} />
        <circle cx="12" cy="12" r="1.5" fill={active ? "#1428A0" : "#94a3b8"} />
        <circle cx="19" cy="12" r="1.5" fill={active ? "#1428A0" : "#94a3b8"} />
      </svg>
    ),
  },
];

// "더보기" 메뉴에 포함될 경로들
const moreRoutes = ["/parking-status", "/monthly", "/analytics", "/stores", "/team", "/settings", "/guide", "/more"];

export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  // 로그인 페이지에서는 탭바 숨김
  if (pathname === "/login") return null;

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.id === "more") {
      return moreRoutes.some((r) => pathname.startsWith(r));
    }
    return pathname.startsWith(tab.path);
  };

  const handleClick = (tab: typeof tabs[0]) => {
    if (tab.id === "more") {
      router.push("/more");
    } else {
      router.push(tab.path);
    }
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
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          justifyContent: "space-around",
          padding: "6px 0 8px",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        }}
      >
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <div
            key={tab.id}
            onClick={() => handleClick(tab)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              padding: "4px 12px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div
              style={{
                width: 36,
                height: 28,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? "rgba(20,40,160,0.08)" : "transparent",
                transition: "background 0.2s",
              }}
            >
              {tab.icon(active)}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? "#1428A0" : "#94a3b8",
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
