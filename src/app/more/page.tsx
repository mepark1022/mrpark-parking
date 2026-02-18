// @ts-nocheck
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { LogoIcon } from "@/components/Logo";

const menuGroups = [
  {
    title: "주차 관리",
    items: [
      {
        path: "/monthly",
        label: "월주차 관리",
        desc: "월주차 계약을 관리합니다",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        color: "#1428A0",
      },
      {
        path: "/analytics",
        label: "매출 분석",
        desc: "매출 데이터를 분석합니다",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5B731" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
        color: "#F5B731",
      },
    ],
  },
  {
    title: "관리",
    items: [
      {
        path: "/stores",
        label: "매장 관리",
        desc: "매장 정보와 운영 설정을 관리합니다",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
        color: "#16a34a",
      },
      {
        path: "/team",
        label: "팀원 초대",
        desc: "팀원을 초대하고 관리합니다",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        ),
        color: "#7c3aed",
      },
      {
        path: "/settings",
        label: "설정",
        desc: "시스템 설정을 관리합니다",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        ),
        color: "#475569",
      },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <AppLayout>
      {/* 프로필 카드 */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: 20, marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #0a1352, #1428A0)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: "#fff",
        }}>V</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>발렛맨</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>슈퍼 관리자 · (주)미스터팍</div>
        </div>
      </div>

      {/* 메뉴 그룹 */}
      {menuGroups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#94a3b8",
            letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4,
          }}>{group.title}</div>
          <div style={{
            background: "#fff", borderRadius: 16, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            {group.items.map((item, i) => (
              <div
                key={i}
                onClick={() => router.push(item.path)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", cursor: "pointer",
                  borderBottom: i < group.items.length - 1 ? "1px solid rgba(226,232,240,0.5)" : "none",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${item.color}10`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.desc}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 로그아웃 */}
      <div
        onClick={handleLogout}
        style={{
          padding: "12px 0", borderRadius: 12, textAlign: "center",
          border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626",
          fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 16,
        }}
      >로그아웃</div>

      {/* 하단 정보 */}
      <div style={{ textAlign: "center", padding: "12px 0 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <LogoIcon size={32} />
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}><span style={{ color: "#F5B731" }}>ME</span>.PARK</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>(주)미스터팍 · v2.0.0</div>
      </div>
    </AppLayout>
  );
}
