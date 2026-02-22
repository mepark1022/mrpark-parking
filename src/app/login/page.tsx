// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";

/* ────────────────────────────────────────────
   인라인 로고 (LogoHero dark 버전)
   Logo.tsx 의존 없이 직접 렌더 → 네이비 배경 위에 white 사용
──────────────────────────────────────────── */
function InlineLogo({ dark = false }: { dark?: boolean }) {
  const textColor = dark ? "#fff" : "#1A1D2B";
  const circleBg  = dark ? "rgba(255,255,255,0.15)" : "#fff";
  const iconBg    = dark ? "rgba(255,255,255,0.18)" : "#1428A0";
  const pColor    = "#fff";

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
   소셜 버튼 정의
──────────────────────────────────────────── */
const SOCIAL_BUTTONS = [
  {
    provider: "kakao" as const,
    label: "카카오로 시작하기",
    bg: "#FEE500", color: "#191919", hoverBg: "#F5DC00",
    icon: (
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
        <path d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.38C1.5 9.42 2.88 11.22 4.95 12.24L4.14 15.18C4.08 15.39 4.32 15.57 4.5 15.45L7.95 13.14C8.28 13.2 8.64 13.23 9 13.23C13.14 13.23 16.5 10.59 16.5 7.35C16.5 4.14 13.14 1.5 9 1.5Z" fill="#191919"/>
      </svg>
    ),
  },
  {
    provider: "google" as const,
    label: "Google로 시작하기",
    bg: "#ffffff", color: "#344054", hoverBg: "#f8fafc", border: "1px solid #d0d5dd",
    icon: (
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
    ),
  },

];

/* ────────────────────────────────────────────
   메인 컴포넌트
──────────────────────────────────────────── */
function LoginContent() {
  const [isSignup, setIsSignup] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "pending")       setError("관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.");
    else if (msg === "disabled") setError("비활성화된 계정입니다. 관리자에게 문의하세요.");
    else if (msg === "error")    setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    // URL에서 message 파라미터 제거 (새로고침 시 에러 재표시 방지)
    if (msg) router.replace("/login");
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setError(""); setLoading(true);
    try {
      const result = isSignup ? await signup(formData) : await login(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSignupSuccess(true);
    } catch { setError("오류가 발생했습니다. 다시 시도해주세요."); }
    finally  { setLoading(false); }
  }

  async function handleSocialLogin(provider: "kakao" | "google" | "naver") {
    setSocialLoading(provider); setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError("로그인 중 오류가 발생했습니다.");
    } catch { setError("로그인 중 오류가 발생했습니다."); }
    finally  { setSocialLoading(""); }
  }

  function resetToMain() {
    setIsSignup(false); setSignupSuccess(false); setShowEmailForm(false); setError("");
  }

  /* ── 공통 입력 스타일 ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 14px",
    border: "1.5px solid #e2e8f0", borderRadius: 10,
    fontSize: 15, color: "#1A1D2B", background: "#fff",
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };

  /* ── 소셜 버튼 렌더 ── */
  const renderSocialButtons = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SOCIAL_BUTTONS.map((btn) => (
        <button
          key={btn.provider}
          onClick={() => handleSocialLogin(btn.provider)}
          disabled={!!socialLoading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "14px 16px", borderRadius: 12,
            background: btn.bg, color: btn.color, border: btn.border || "none",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
            opacity: socialLoading && socialLoading !== btn.provider ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {socialLoading === btn.provider
            ? <span style={{ fontSize: 14 }}>연결 중...</span>
            : <>{btn.icon}<span>{btn.label}</span></>
          }
        </button>
      ))}
    </div>
  );

  /* ── 이메일 폼 렌더 ── */
  const renderEmailForm = () => (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isSignup && (
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>이름</label>
          <input type="text" name="name" required style={inputStyle} placeholder="홍길동" />
        </div>
      )}
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>이메일</label>
        <input type="email" name="email" required style={inputStyle} placeholder="example@mrpark.co.kr" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>비밀번호</label>
        <input type="password" name="password" required minLength={6} style={inputStyle} placeholder="6자 이상" />
      </div>
      {error && (
        <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          background: "#1428A0", color: "#fff", fontSize: 15, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          marginTop: 2,
        }}
      >
        {loading ? "처리 중..." : isSignup ? "회원가입" : "로그인"}
      </button>
      {showEmailForm && !isSignup && (
        <button
          type="button"
          onClick={() => { setShowEmailForm(false); setError(""); }}
          style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: "4px 0" }}
        >
          ← 소셜 로그인으로 돌아가기
        </button>
      )}
    </form>
  );

  /* ── 본문 카드 내용 ── */
  const renderCardContent = () => {
    if (signupSuccess) return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#16A34A", marginBottom: 6 }}>회원가입 완료!</div>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>관리자 승인 후 이용 가능합니다.</p>
        <button
          onClick={resetToMain}
          style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, background: "#f1f5f9", border: "none", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          로그인으로 돌아가기
        </button>
      </div>
    );

    return (
      <>
        {/* 모드 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D2B", margin: 0 }}>
            {isSignup ? "회원가입" : showEmailForm ? "이메일 로그인" : "로그인"}
          </h2>
          {!isSignup && !showEmailForm && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>소셜 계정으로 간편 로그인</span>
          )}
        </div>

        {/* 소셜 또는 이메일 폼 */}
        {!isSignup && !showEmailForm && (
          <>
            {renderSocialButtons()}
            {/* 구분선 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 14px" }}>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>또는</span>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            </div>
            {/* 이메일 버튼 */}
            <button
              onClick={() => setShowEmailForm(true)}
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 12,
                background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/>
              </svg>
              이메일로 로그인
            </button>
            {/* 소셜 에러 */}
            {error && (
              <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginTop: 12 }}>
                {error}
              </div>
            )}
          </>
        )}
        {(showEmailForm || isSignup) && renderEmailForm()}

        {/* 회원가입 전환 */}
        {!signupSuccess && (
          <div style={{ marginTop: 20, textAlign: "center", paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              {isSignup ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
            </span>
            <button
              onClick={() => { setIsSignup(!isSignup); setError(""); setShowEmailForm(isSignup ? false : true); }}
              style={{ background: "none", border: "none", color: "#1428A0", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {isSignup ? "로그인" : "회원가입"}
            </button>
          </div>
        )}
      </>
    );
  };

  /* ──────────────────────────────────────────
     렌더: 모바일 상/하 분할 | PC 중앙 카드
  ────────────────────────────────────────── */
  return (
    <>
      <style>{`
        /* ── 공통 ── */
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Noto+Sans+KR:wght@800&display=swap');

        .login-root {
          min-height: 100dvh;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #1428A0;
        }

        /* ── 상단 네이비 영역 ── */
        .login-top {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 52px 24px 36px;
          gap: 10px;
        }
        .login-top-sub {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* ── 하단 흰 카드 ── */
        .login-card {
          flex: 1;
          background: #fff;
          border-radius: 28px 28px 0 0;
          padding: 28px 24px 32px;
          box-shadow: 0 -4px 32px rgba(20,40,160,0.10);
        }

        /* ── 하단 면책 ── */
        .login-disclaimer {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          padding: 14px 24px 20px;
          flex-shrink: 0;
        }

        /* ── PC: 중앙 정렬 카드 ── */
        @media (min-width: 640px) {
          .login-root {
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
            background: linear-gradient(145deg, #0f1f8a 0%, #1428A0 50%, #1e36c0 100%);
          }
          .login-top {
            padding: 0 0 28px;
            flex: none;
          }
          .login-card {
            width: 100%;
            max-width: 440px;
            border-radius: 20px;
            padding: 32px 36px 28px;
            flex: none;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18);
          }
          .login-disclaimer {
            padding: 14px 0 0;
            color: rgba(255,255,255,0.35);
          }
          .login-root-inner {
            width: 100%;
            max-width: 440px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }
        }

        /* ── focus 링 ── */
        input:focus {
          border-color: #1428A0 !important;
          box-shadow: 0 0 0 3px rgba(20,40,160,0.08);
        }
      `}</style>

      <div className="login-root">
        <div className="login-root-inner">
          {/* 상단: 로고 영역 */}
          <div className="login-top">
            <InlineLogo dark={true} />
            <div className="login-top-sub">AI 스마트주차운영솔루션</div>
          </div>

          {/* 하단: 카드 */}
          <div className="login-card">
            {renderCardContent()}
          </div>

          {/* 면책 */}
          <div className="login-disclaimer">
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다.
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#1428A0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>로딩 중...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}