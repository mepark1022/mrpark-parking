// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoAppIcon } from "@/components/Logo";

const pageTitles: Record<string, { title: string; desc: string }> = {
  "/dashboard": { title: "대시보드", desc: "전체 매장의 주차 현황을 한눈에 확인합니다" },
  "/entry": { title: "데이터 입력", desc: "일일 주차 데이터를 입력합니다" },
  "/parking-status": { title: "입차 현황", desc: "매장별 입차 데이터를 조회하고 검색합니다" },
  "/monthly": { title: "월주차 관리", desc: "월주차 계약을 관리합니다" },
  "/analytics": { title: "매출 분석", desc: "매출 데이터를 분석합니다" },
  "/workers": { title: "근무자 관리", desc: "출퇴근, 명부, 근태, 연차를 관리합니다" },
  "/stores": { title: "매장 관리", desc: "매장 정보와 운영 설정을 관리합니다" },
  "/team": { title: "팀원 초대", desc: "팀원을 초대하고 관리합니다" },
  "/accident": { title: "사고보고", desc: "주차 사고를 보고하고 관리합니다" },
  "/settings": { title: "설정", desc: "시스템 설정을 관리합니다" },
  "/more": { title: "더보기", desc: "" },
};

const roleBadge = {
  admin: { label: "Admin", bg: "#1428A015", color: "#1428A0" },
  crew: { label: "CREW", bg: "#16a34a15", color: "#16a34a" },
  viewer: { label: "Viewer", bg: "#94a3b815", color: "#94a3b8" },
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userInfo, setUserInfo] = useState(null);

  const matchedKey = Object.keys(pageTitles).find((key) => pathname.startsWith(key));
  const page = matchedKey ? pageTitles[matchedKey] : pageTitles["/dashboard"];

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, role, org_id")
        .eq("id", user.id)
        .single();
      setUserInfo({
        name: profile?.name || user.user_metadata?.name || user.email?.split("@")[0],
        email: user.email,
        role: profile?.role || "viewer",
        orgId: profile?.org_id,
      });
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const badge = userInfo ? roleBadge[userInfo.role] || roleBadge.viewer : null;

  return (
    <>
      {/* PC 헤더 */}
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
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{page.title}</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{page.desc}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 사용자 정보 */}
          {userInfo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#1428A0", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
              }}>
                {userInfo.name?.charAt(0) || "?"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.2 }}>
                  {userInfo.name}
                  <span style={{
                    marginLeft: 6, padding: "2px 6px", borderRadius: 4,
                    fontSize: 10, fontWeight: 700,
                    background: badge?.bg, color: badge?.color,
                  }}>
                    {badge?.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{userInfo.email}</div>
              </div>
            </div>
          )}

          <button style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid #e2e8f0", background: "#fff",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          <button style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid #e2e8f0", background: "#fff",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#dc2626", border: "2px solid #fff" }} />
          </button>

          <button onClick={handleLogout} style={{
            padding: "6px 14px", borderRadius: 8,
            border: "1px solid #e2e8f0", background: "#fff",
            fontSize: 12, color: "#475569", cursor: "pointer", fontWeight: 600,
          }}>
            로그아웃
          </button>
        </div>
      </div>

      {/* 모바일 헤더 */}
      <div
        className="flex md:hidden"
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
          padding: "14px 16px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoAppIcon size={28} />
          <div>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{page.title}</div>
            {page.desc && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 }}>{page.desc}</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* 모바일 사용자 이니셜 */}
          {userInfo && (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              {userInfo.name?.charAt(0) || "?"}
            </div>
          )}
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div style={{ position: "absolute", top: -1, right: -1, width: 7, height: 7, borderRadius: "50%", background: "#dc2626", border: "2px solid #0a1352" }} />
          </div>
        </div>
      </div>
    </>
  );
}
