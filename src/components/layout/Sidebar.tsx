// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoGNB } from "@/components/Logo";

const menuItems = [
  { href: "/dashboard", label: "대시보드", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  )},
  { href: "/entry", label: "데이터 입력", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  )},
  { href: "/parking-status", label: "입차 현황", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="7" rx="2"/><path d="M5 11l2-5h10l2 5"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>
  )},
  { href: "/monthly", label: "월주차 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><circle cx="12" cy="15" r="1"/></svg>
  )},
  { href: "/analytics", label: "매출 분석", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  )},
  { href: "/workers", label: "근무자 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  )},
  { href: "/stores", label: "매장 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
  { href: "/team", label: "팀원 초대", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
  )},
  { href: "/accident", label: "사고보고", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ), badge: true },
  { href: "/settings", label: "설정", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  )},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
className="w-60 min-h-screen flex flex-col relative overflow-hidden fixed top-0 left-0 z-50"
    style={{ background: "linear-gradient(180deg, #020617 0%, #0a1352 30%, #0f1d6b 70%, #162050 100%)" }}
    >
      {/* Decorative glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -60, left: -60, width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,183,49,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="p-6 pb-5">
        <LogoGNB theme="dark" />
      </div>

      {/* Menu Label */}
      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", padding: "12px 24px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>메뉴</div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 relative"
              style={{
                background: isActive ? "rgba(255,255,255,0.15)" : undefined,
                color: "#fff",
                fontWeight: isActive ? 700 : 600,
                fontSize: 15,
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2"
                  style={{ width: 3, height: 20, borderRadius: "0 3px 3px 0", background: "#F5B731" }}
                />
              )}
              <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className="ml-auto flex items-center justify-center"
                  style={{
                    width: 18, height: 18, borderRadius: 9,
                    background: "#dc2626", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                  }}
                >2</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#F5B731", fontSize: 15, fontWeight: 800, color: "#0a1352",
          }}
        >이</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">이지섭</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>슈퍼 관리자</div>
        </div>
      </div>
    </aside>
  );
}