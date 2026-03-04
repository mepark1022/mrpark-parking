// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";

interface UserInfo {
  name: string;
  email: string;
  storeName: string;
}

export default function CrewSettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.replace("/crew/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", authUser.id)
        .single();

      const storeId = localStorage.getItem("crew_store_id");
      let storeName = "매장 미선택";
      
      if (storeId) {
        const { data: store } = await supabase
          .from("stores")
          .select("name")
          .eq("id", storeId)
          .single();
        
        if (store) storeName = store.name;
      }

      setUser({
        name: profile?.name || "크루",
        email: authUser.email || "",
        storeName,
      });
      setLoading(false);
    };

    init();
  }, [router]);

  const handleLogout = async () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    
    setLoggingOut(true);
    const supabase = createClient();
    
    // 캐시 + 로컬스토리지 + 쿠키 정리
    const { clearOrgCache } = await import("@/lib/utils/org");
    clearOrgCache();
    await supabase.auth.signOut();
    localStorage.removeItem("crew_store_id");
    localStorage.removeItem("crew_store_name");
    // 쿠키도 제거
    document.cookie = "crew_store_id=; path=/; max-age=0";
    document.cookie = "crew_store_name=; path=/; max-age=0";
    router.replace("/crew/login");
  };

  const handleAddToHomeScreen = () => {
    alert(
      "홈화면 추가 방법:\n\n" +
      "📱 iPhone:\n" +
      "Safari 하단 공유 버튼 → '홈 화면에 추가'\n\n" +
      "📱 Android:\n" +
      "Chrome 메뉴(⋮) → '홈 화면에 추가'"
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .settings-page {
          min-height: 100dvh;
          background: #F8FAFC;
        }
        
        .settings-content {
          padding: 16px;
        }
        
        /* 프로필 카드 */
        .settings-profile {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .settings-profile-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
        }
        
        .settings-avatar {
          width: 52px;
          height: 52px;
          background: #1428A0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #fff;
        }
        
        .settings-name {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
        }
        
        .settings-email {
          font-size: 13px;
          color: #64748B;
          margin-top: 2px;
        }
        
        .settings-store {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: #F1F5F9;
          border-radius: 10px;
          font-size: 14px;
          color: #475569;
        }
        
        /* 메뉴 섹션 */
        .settings-section {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #E2E8F0;
          margin-bottom: 16px;
          overflow: hidden;
        }
        
        .settings-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #64748B;
          padding: 14px 16px 8px;
        }
        
        .settings-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          cursor: pointer;
          border-bottom: 1px solid #F1F5F9;
        }
        
        .settings-item:last-child {
          border-bottom: none;
        }
        
        .settings-item:active {
          background: #F8FAFC;
        }
        
        .settings-item-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .settings-item-icon {
          width: 34px;
          height: 34px;
          background: #EEF2FF;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .settings-item-text {
          font-size: 15px;
          color: #1A1D2B;
        }
        
        .settings-item-arrow {
          color: #94A3B8;
          font-size: 16px;
        }
        
        .settings-item-value {
          font-size: 14px;
          color: #64748B;
        }
        
        /* 로그아웃 버튼 */
        .settings-logout {
          width: 100%;
          padding: 16px;
          background: #fff;
          border: 1px solid #FECACA;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          color: #DC2626;
          cursor: pointer;
          margin-top: 8px;
        }
        
        .settings-logout:active {
          background: #FEF2F2;
        }
        
        .settings-logout:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        /* 버전 정보 */
        .settings-version {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
          color: #94A3B8;
        }
      `}</style>

      <div className="settings-page">
        <CrewHeader title="설정" />

        <div className="settings-content">
          {/* 프로필 */}
          <div className="settings-profile">
            <div className="settings-profile-header">
              <div className="settings-avatar">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <div className="settings-name">{user?.name}</div>
                <div className="settings-email">{user?.email}</div>
              </div>
            </div>
            <div className="settings-store">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>{user?.storeName} 소속</span>
            </div>
          </div>

          {/* 앱 설정 */}
          <div className="settings-section">
            <div className="settings-section-title">앱 설정</div>
            <div
              className="settings-item"
              onClick={() => router.push("/crew/select-store")}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                </div>
                <span className="settings-item-text">매장 변경</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
            <div
              className="settings-item"
              onClick={handleAddToHomeScreen}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" strokeWidth={3} strokeLinecap="round" />
                  </svg>
                </div>
                <span className="settings-item-text">홈화면 추가 안내</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>

          {/* 앱 정보 */}
          <div className="settings-section">
            <div className="settings-section-title">앱 정보</div>
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1428A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={3} strokeLinecap="round" />
                  </svg>
                </div>
                <span className="settings-item-text">버전</span>
              </div>
              <span className="settings-item-value">2.0.0</span>
            </div>
          </div>

          {/* 로그아웃 */}
          <button 
            className="settings-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>

          <div className="settings-version">
            미팍Ticket © 2026 미스터팍
          </div>
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />
      </div>
    </>
  );
}
