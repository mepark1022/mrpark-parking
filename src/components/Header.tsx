// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "대시보드",
  "/entry": "데이터 입력",
  "/monthly": "월주차 관리",
  "/monthly/register": "월주차 등록",
  "/analytics": "매출 분석",
  "/settings": "설정",
  "/settings/stores": "매장 관리",
  "/settings/workers": "근무자 관리",
  "/settings/default-workers": "기본 근무자 설정",
  "/settings/team": "팀원 관리",
};

export default function Header() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", user.id).single();
      setUserName(profile?.name || profile?.email?.split("@")[0] || "사용자");
      setUserEmail(profile?.email || user.email || "");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const title = PAGE_TITLES[pathname] || "Mr. Park";

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1428A0 0%, #1e3abf 100%)" }}>
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-gray-800">{userName}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-14 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-52 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}