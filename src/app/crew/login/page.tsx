// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/* ────────────────────────────────────────────
   CREW 로고 (Split Badge 스타일)
──────────────────────────────────────────── */
function CrewLogo({ size = "large" }: { size?: "large" | "small" }) {
  const isLarge = size === "large";
  const fontSize = isLarge ? 20 : 16;
  const crewSize = isLarge ? 13 : 11;
  const padding = isLarge ? "12px 16px" : "10px 14px";
  const badgeSize = isLarge ? 18 : 14;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {/* ME.PARK 부분 */}
      <div style={{
        padding,
        border: "2.5px solid #fff",
        borderRadius: "10px 0 0 10px",
        borderRight: "none",
      }}>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.3px",
        }}>ME.PARK</span>
      </div>
      {/* CREW 부분 */}
      <div style={{
        padding,
        background: "#F5B731",
        borderRadius: "0 10px 10px 0",
        position: "relative",
      }}>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: crewSize,
          fontWeight: 800,
          color: "#1A1D2B",
          letterSpacing: "3px",
        }}>CREW</span>
        {/* 버전 뱃지 */}
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          width: badgeSize,
          height: badgeSize,
          background: "#1428A0",
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: isLarge ? 9 : 7,
            fontWeight: 800,
            color: "#fff",
          }}>2</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   메인 컴포넌트
──────────────────────────────────────────── */
export default function CrewLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  // 이미 로그인 되어있는지 확인
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 크루 권한 확인
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, org_id")
          .eq("id", user.id)
          .single();
        
        if (profile && (profile.role === "crew" || profile.role === "admin")) {
          // 매장 배정 확인
          const { data: storeMembers } = await supabase
            .from("store_members")
            .select("store_id")
            .eq("user_id", user.id);
          
          if (storeMembers && storeMembers.length > 0) {
            // 매장이 1개면 바로 저장
            if (storeMembers.length === 1) {
              localStorage.setItem("crew_store_id", storeMembers[0].store_id);
            }
            router.replace("/crew");
            return;
          }
          // 매장 배정 없으면 로그인 화면 유지 (에러 표시)
          setError("배정된 매장이 없습니다. 관리자에게 문의하세요.");
        }
      }
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, [router]);

  async function handleKakaoLogin() {
    setLoading(true);
    setError("");
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/crew/auth/callback`,
        },
      });
      
      if (error) {
        setError("로그인 중 오류가 발생했습니다.");
        setLoading(false);
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  // 인증 확인 중
  if (checkingAuth) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#1428A0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .crew-login {
          min-height: 100dvh;
          min-height: 100vh;
          background: linear-gradient(165deg, #0f1f8a 0%, #1428A0 40%, #1e36c0 100%);
          display: flex;
          flex-direction: column;
        }
        
        .crew-login-top {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px 40px;
          gap: 16px;
        }
        
        .crew-login-subtitle {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 8px;
        }
        
        .crew-login-card {
          background: #fff;
          border-radius: 24px 24px 0 0;
          padding: 32px 24px 40px;
          padding-bottom: calc(40px + env(safe-area-inset-bottom, 0));
        }
        
        .crew-login-title {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .crew-kakao-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          background: #FEE500;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #191919;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        
        .crew-kakao-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .crew-kakao-btn:active:not(:disabled) {
          opacity: 0.9;
        }
        
        .crew-login-error {
          margin-top: 16px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          font-size: 14px;
          color: #dc2626;
          text-align: center;
        }
        
        .crew-login-help {
          margin-top: 24px;
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.6;
        }
        
        .crew-login-disclaimer {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          padding: 16px 24px 0;
        }
        
        @media (min-width: 480px) {
          .crew-login {
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
          }
          
          .crew-login-top {
            padding: 0 0 32px;
            flex: none;
          }
          
          .crew-login-card {
            width: 100%;
            max-width: 380px;
            border-radius: 20px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.2);
          }
        }
      `}</style>

      <div className="crew-login">
        {/* 상단: 로고 */}
        <div className="crew-login-top">
          <CrewLogo size="large" />
          <div className="crew-login-subtitle">주차 크루 전용 앱</div>
        </div>

        {/* 하단: 로그인 카드 */}
        <div className="crew-login-card">
          <div className="crew-login-title">로그인</div>
          
          <button
            className="crew-kakao-btn"
            onClick={handleKakaoLogin}
            disabled={loading}
          >
            {loading ? (
              <span>연결 중...</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.38C1.5 9.42 2.88 11.22 4.95 12.24L4.14 15.18C4.08 15.39 4.32 15.57 4.5 15.45L7.95 13.14C8.28 13.2 8.64 13.23 9 13.23C13.14 13.23 16.5 10.59 16.5 7.35C16.5 4.14 13.14 1.5 9 1.5Z" fill="#191919"/>
                </svg>
                <span>카카오로 시작하기</span>
              </>
            )}
          </button>

          {error && (
            <div className="crew-login-error">{error}</div>
          )}

          <div className="crew-login-help">
            관리자가 등록한 크루만 이용 가능합니다.<br />
            문의: 관리자에게 연락하세요.
          </div>
        </div>

        <div className="crew-login-disclaimer">
          로그인 시 서비스 이용약관에 동의합니다.
        </div>
      </div>
    </>
  );
}
