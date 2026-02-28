// @ts-nocheck
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { LogoDefault } from "@/components/Logo";

const C = {
  navy: "#1428A0",
  navyDark: "#0a1352",
  gold: "#F5B731",
  textPrimary: "#1a1d26",
  textSecondary: "#5c6370",
  textMuted: "#8b919d",
  border: "#e2e4e9",
  borderLight: "#eef0f3",
};

const menuGroups = [
  {
    title: "주차 관리",
    items: [
      {
        path: "/parking-status",
        label: "입차 현황",
        desc: "매장별 입차 데이터 조회",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="7" rx="2" /><path d="M5 11l2-5h10l2 5" /><circle cx="7.5" cy="15.5" r="1.5" /><circle cx="16.5" cy="15.5" r="1.5" /></svg>),
        color: "#16a34a", bg: "#dcfce7",
      },
      {
        path: "/monthly",
        label: "월주차 관리",
        desc: "월주차 계약 관리",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
        color: "#1428A0", bg: "#ecf0ff",
      },
      {
        path: "/analytics",
        label: "매출 분석",
        desc: "매출 데이터 분석",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5B731" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>),
        color: "#F5B731", bg: "#fef9e7",
      },
    ],
  },
  {
    title: "관리",
    items: [
      {
        path: "/stores",
        label: "매장 관리",
        desc: "매장 정보 및 운영 설정",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>),
        color: "#16a34a", bg: "#dcfce7",
      },
      {
        path: "/team",
        label: "팀원 초대",
        desc: "팀원 초대 및 관리",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>),
        color: "#7c3aed", bg: "#f3e8ff",
      },
      {
        path: "/settings",
        label: "설정",
        desc: "시스템 설정",
        icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>),
        color: "#475569", bg: "#f1f5f9",
      },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState("사용자");
  const [userRole, setUserRole] = useState("admin");
  const [orgName, setOrgName] = useState("");

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
    if (profile) {
      if (profile.name) setUserName(profile.name);
      if (profile.role) setUserRole(profile.role);
    }
    const { data: org } = await supabase.from("organizations").select("name").limit(1).single();
    if (org?.name) setOrgName(org.name);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleLabel = userRole === "admin" ? "관리자" : userRole === "superadmin" ? "슈퍼 관리자" : "CREW";

  return (
    <AppLayout>
      <div style={{ padding: "14px 16px", maxWidth: 500, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

        {/* 프로필 카드 */}
        <div style={{
          background: `linear-gradient(135deg, ${C.navyDark}, ${C.navy})`,
          borderRadius: 14, padding: "16px 18px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: C.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: C.navyDark,
          }}>{userName.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{userName}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {roleLabel}{orgName ? ` \u00b7 ${orgName}` : ""}
            </div>
          </div>
          <div style={{
            padding: "4px 10px", borderRadius: 8,
            background: "rgba(245,183,49,0.2)", fontSize: 10, fontWeight: 700, color: C.gold,
          }}>{roleLabel}</div>
        </div>

        {/* 메뉴 그룹 */}
        {menuGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.textMuted,
              letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2,
            }}>{group.title}</div>
            <div style={{
              background: "#fff", borderRadius: 14, overflow: "hidden",
              border: `1px solid ${C.borderLight}`,
            }}>
              {group.items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => router.push(item.path)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", cursor: "pointer",
                    borderBottom: i < group.items.length - 1 ? `1px solid ${C.borderLight}` : "none",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: item.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{item.desc}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 기능안내 */}
        <div
          onClick={() => router.push("/guide")}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 14, marginBottom: 14,
            background: `linear-gradient(135deg, ${C.navyDark}, ${C.navy})`,
            cursor: "pointer",
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: C.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: C.navyDark,
          }}>?</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>ME.PARK 2.0 기능안내</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>새로운 기능을 확인하세요</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, textAlign: "center",
            border: "1px solid rgba(220,38,38,0.2)", background: "#fff",
            color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer",
            marginBottom: 14, fontFamily: "inherit",
          }}
        >로그아웃</button>

        {/* 하단 정보 */}
        <div style={{ textAlign: "center", padding: "8px 0 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <LogoDefault theme="light" />
          <div style={{ fontSize: 10, color: C.textMuted }}>{orgName || "(주)미스터팍"} · v2.0.0</div>
        </div>

      </div>
    </AppLayout>
  );
}
