// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

const pageTitles: Record<string, { title: string; desc: string }> = {
  "/dashboard": { title: "대시보드", desc: "전체 매장의 주차 현황을 한눈에 확인합니다" },
  "/entry": { title: "데이터 입력", desc: "일일 주차 데이터를 입력합니다" },
  "/monthly": { title: "월주차 관리", desc: "월주차 계약을 관리합니다" },
  "/analytics": { title: "매출 분석", desc: "매출 데이터를 분석합니다" },
  "/workers": { title: "근무자 관리", desc: "출퇴근, 명부, 근태, 연차를 관리합니다" },
  "/stores": { title: "매장 관리", desc: "매장 정보와 운영 설정을 관리합니다" },
  "/team": { title: "팀원 초대", desc: "팀원을 초대하고 관리합니다" },
  "/accident": { title: "사고보고", desc: "주차 사고를 보고하고 관리합니다" },
  "/settings": { title: "설정", desc: "시스템 설정을 관리합니다" },
  "/more": { title: "더보기", desc: "" },
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // 현재 경로에 맞는 제목 찾기
  const matchedKey = Object.keys(pageTitles).find((key) => pathname.startsWith(key));
  const page = matchedKey ? pageTitles[matchedKey] : pageTitles["/dashboard"];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* ════════════════════════════════════════════ */}
      {/* PC 헤더 (768px 이상에서만 표시)             */}
      {/* ════════════════════════════════════════════ */}
      <div
        className="hidden md:flex"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 28px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* 좌측: 페이지 제목 */}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            {page.title}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
            {page.desc}
          </div>
        </div>

        {/* 우측: 검색 + 알림 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 검색 버튼 */}
          <button
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid #e2e8f0", background: "#fff",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* 알림 벨 */}
          <button
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid #e2e8f0", background: "#fff",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              position: "relative",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div style={{
              position: "absolute", top: 2, right: 2,
              width: 8, height: 8, borderRadius: "50%",
              background: "#dc2626", border: "2px solid #fff",
            }} />
          </button>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid #e2e8f0", background: "#fff",
              fontSize: 12, color: "#475569",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* 모바일 헤더 (768px 미만에서만 표시)          */}
      {/* ════════════════════════════════════════════ */}
      <div
        className="flex md:hidden"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
          padding: "14px 16px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* 좌측: 페이지 제목 */}
        <div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>
            {page.title}
          </div>
          {page.desc && (
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 }}>
              {page.desc}
            </div>
          )}
        </div>

        {/* 우측: 알림 아이콘 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div style={{
              position: "absolute", top: -1, right: -1,
              width: 7, height: 7, borderRadius: "50%",
              background: "#dc2626", border: "2px solid #0a1352",
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
