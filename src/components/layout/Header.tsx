"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const [profile, setProfile] = useState<{ name: string | null; email: string; role: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name, email, role")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data);
      }
    }
    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function getPageTitle(): string {
    if (pathname.startsWith("/dashboard")) return "대시보드";
    if (pathname.startsWith("/entry")) return "데이터 입력";
    if (pathname.startsWith("/monthly")) return "월주차 관리";
    if (pathname.startsWith("/analytics")) return "매출 분석";
    if (pathname.startsWith("/settings")) return "설정";
    return "Mr. Park";
  }

  return (
    <header className="h-16 bg-white border-b border-light-gray flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-dark">{getPageTitle()}</h2>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
        >
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {profile?.name?.charAt(0) || "U"}
            </span>
          </div>
          <span className="text-sm text-dark">{profile?.name || "사용자"}</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-light-gray z-20 py-1">
              <div className="px-4 py-2 border-b border-light-gray">
                <p className="text-xs text-mr-gray">{profile?.email}</p>
                <p className="text-xs text-mr-gray mt-1">
                  {profile?.role === "admin" ? "관리자" : "팀원"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-error hover:bg-red-50 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}