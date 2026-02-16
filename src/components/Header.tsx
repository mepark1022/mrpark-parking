// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "대시보드",
  "/entry": "데이터 입력",
  "/monthly": "월주차 관리",
  "/monthly/register": "월주차 관리",
  "/analytics": "매출 분석",
  "/settings": "설정",
  "/settings/stores": "설정",
  "/settings/workers": "설정",
  "/settings/default-workers": "설정",
  "/settings/team": "설정",
};

export default function Header() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

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
      setUserName(profile?.name || profile?.email || user.email || "");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const title = PAGE_TITLES[pathname] || "Mr. Park";

  return (
    <header className="h-14 border-b border-light-gray bg-white flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-dark">{title}</h2>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 text-sm text-mr-gray hover:text-dark"
        >
          <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-xs">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span>{userName}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-12 bg-white border border-light-gray rounded-lg shadow-lg py-1 w-36 z-50">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-error hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}