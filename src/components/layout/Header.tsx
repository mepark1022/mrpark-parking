// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "대시보드", subtitle: "전사 주차 운영 현황을 한눈에 확인하세요" },
  "/entry": { title: "데이터 입력", subtitle: "매장별 일일 주차 데이터를 입력합니다" },
  "/monthly": { title: "월주차 관리", subtitle: "월주차 계약을 등록하고 관리합니다" },
  "/analytics": { title: "매출 분석", subtitle: "발렛 매출과 주차 매출을 분석합니다" },
  "/workers": { title: "근무자 관리", subtitle: "출퇴근, 명부, 근태, 연차를 관리합니다" },
  "/stores": { title: "매장 관리", subtitle: "매장 정보와 운영 설정을 관리합니다" },
  "/team": { title: "팀원 초대", subtitle: "팀원을 초대하고 권한을 관리합니다" },
  "/accident": { title: "사고보고", subtitle: "현장 사고를 보고하고 처리합니다" },
  "/settings": { title: "설정", subtitle: "시스템 설정을 관리합니다" },
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const matchedKey = Object.keys(pageTitles).find(
    (key) => pathname === key || pathname.startsWith(key + "/")
  );
  const { title, subtitle } = pageTitles[matchedKey || "/dashboard"] || { title: "VALETMAN", subtitle: "" };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header
      className="flex items-center justify-between px-8 py-5"
      style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div
          className="flex items-center gap-2"
          style={{
            background: "#f8fafc", borderRadius: 10, padding: "8px 14px",
            border: "1px solid #e2e8f0",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="검색..."
            className="border-0 bg-transparent outline-none"
            style={{ fontSize: 13, color: "#1e293b", width: 140 }}
          />
        </div>

        {/* Bell */}
        <div
          className="relative flex items-center justify-center cursor-pointer"
          style={{
            width: 40, height: 40, borderRadius: 10, background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <div
            className="absolute"
            style={{
              top: 8, right: 8, width: 8, height: 8, borderRadius: 4,
              background: "#dc2626", border: "2px solid #fff",
            }}
          />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: 40, height: 40, borderRadius: 10, background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </header>
  );
}