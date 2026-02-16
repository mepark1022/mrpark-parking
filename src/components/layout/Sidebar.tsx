// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/entry", label: "데이터 입력", icon: "📝" },
  { href: "/monthly", label: "월주차 관리", icon: "🅿️" },
  { href: "/analytics", label: "매출 분석", icon: "📈" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #0f1d6b 0%, #1428A0 50%, #1e3abf 100%)" }}>
      <div className="p-6 pb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Mr. Park</h1>
        <p className="text-xs text-blue-200/70 mt-1 tracking-wide">주차 관리 시스템</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-white text-primary font-semibold shadow-md shadow-black/10"
                  : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mx-3 mb-3 rounded-xl bg-white/10 backdrop-blur-sm">
        <p className="text-xs text-blue-200/60 text-center">v1.0 Beta</p>
      </div>
    </aside>
  );
}