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
    <aside className="w-60 bg-primary min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">Mr. Park</h1>
        <p className="text-sm text-white/60 mt-1">주차 관리 시스템</p>
      </div>

      <nav className="flex-1 px-3">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                isActive
                  ? "bg-white/20 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/40 text-center">v1.0 Beta</p>
      </div>
    </aside>
  );
}