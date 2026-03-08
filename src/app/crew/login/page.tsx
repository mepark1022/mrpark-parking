// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { useRouter, useSearchParams } from "next/navigation";

/* ────────────────────────────────────────────
   미팍Ticket 로고 (P아이콘 + 미팍Ticket 텍스트)
──────────────────────────────────────────── */
function MeparkLogo({ dark = true }: { dark?: boolean }) {
  const textColor = dark ? "#fff" : "#1A1D2B";
  const circleBg = dark ? "rgba(255,255,255,0.15)" : "#fff";
  const iconBg = dark ? "rgba(255,255,255,0.18)" : "#1428A0";
  const pColor = "#fff";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {/* P 아이콘 */}
      <div style={{
        width: 60, height: 60, background: iconBg, borderRadius: 16,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        border: dark ? "2px solid rgba(255,255,255,0.2)" : "none",
      }}>
        <div style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: circleBg, borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: circleBg, borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: pColor, marginTop: -4 }}>P</span>
        <span style={{ position: "absolute", bottom: 9, left: "50%", transform: "translateX(-50%)", width: 24, height: 5, background: "#F5B731", borderRadius: 2.5 }} />
      </div>
      {/* 미팍Ticket */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 28, fontWeight: 800, color: textColor }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   메인 컴포넌트
──────────────────────────────────────────── */
export default function CrewLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#1428A0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>로딩 중...</div>
      </div>
    }>
      <CrewLoginContent />
    </Suspense>
  );
}

function CrewLoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 콜백에서 전달된 에러 메시지 처리
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        no_code: "인증 코드가 없습니다. 다시 시도해주세요.",
        auth_failed: "인증에 실패했습니다. 다시 시도해주세요.",
        user_not_found: "사용자 정보를 가져올 수 없습니다.",
        no_profile: "등록되지 않은 계정입니다. 관리자에게 문의하세요.",
        no_access: "크루 권한이 없습니다. 관리자에게 문의하세요.",
        no_stores: "배정된 매장이 없습니다. 관리자에게 문의하세요.",
      };
      setError(errorMessages[errorParam] || "로그인 중 오류가 발생했습니다.");
    }
  }, [searchParams]);

  // 이미 로그인 되어있는지 확인
  useEffect(() => {
    const checkAuth = async () => {
      const ctx = await getUserContext();
      
      if (ctx.userId && (ctx.role === "crew" || ctx.role === "admin" || ctx.role === "owner" || ctx.role === "super_admin")) {
        // 이미 선택된 매장이 있으면 바로 홈
        const savedStore = localStorage.getItem("crew_store_id");
        if (savedStore) {
          router.replace("/crew");
          return;
        }
        // 없으면 매장 선택으로
        router.replace("/crew/select-store");
        return;
      }
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, [router]);

  async function handleSocialLogin(provider: "google") {
    setLoading(true);
    setError("");
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
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
        
        .crew-google-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #d0d5dd;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #344054;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        
        .crew-google-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .crew-google-btn:active:not(:disabled) {
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
          <MeparkLogo dark={true} />
          <div className="crew-login-subtitle">주차 크루 전용</div>
        </div>

        {/* 하단: 로그인 카드 */}
        <div className="crew-login-card">
          <div className="crew-login-title">로그인</div>
          
          <button
            className="crew-google-btn"
            onClick={() => handleSocialLogin("google")}
            disabled={loading}
          >
            {loading ? (
              <span>연결 중...</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                <span>Google로 시작하기</span>
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
