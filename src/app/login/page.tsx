// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { login } from "./actions";
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
   메인 컴포넌트
──────────────────────────────────────────── */
function LoginContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveEmail, setSaveEmail] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "pending")       setError("관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.");
    else if (msg === "disabled") setError("비활성화된 계정입니다. 관리자에게 문의하세요.");
    else if (msg === "error")    setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    if (msg) router.replace("/login");
  }, [searchParams]);

  // 저장된 이메일 불러오기 → input 기본값으로 설정
  useEffect(() => {
    const saved = localStorage.getItem("admin_saved_email");
    if (saved) setSaveEmail(true);
  }, []);

  async function handleSubmit(formData: FormData) {
    setError(""); setLoading(true);
    try {
      const email = formData.get("email") as string;
      if (saveEmail && email) {
        localStorage.setItem("admin_saved_email", email);
      } else {
        localStorage.removeItem("admin_saved_email");
      }
      const result = await login(formData);
      if (result?.error) setError(result.error);
    } catch { setError("오류가 발생했습니다. 다시 시도해주세요."); }
    finally  { setLoading(false); }
  }

  /* ── 공통 입력 스타일 ── */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 14px",
    border: "1.5px solid #e2e8f0", borderRadius: 10,
    fontSize: 15, color: "#1A1D2B", background: "#fff",
    outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };

  /* ── 이메일 폼 렌더 ── */
  const renderEmailForm = () => (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>이메일</label>
        <input type="email" name="email" required style={inputStyle} placeholder="example@mrpark.co.kr" defaultValue={localStorage.getItem("admin_saved_email") || ""} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>비밀번호</label>
        <input type="password" name="password" required minLength={6} style={inputStyle} placeholder="6자 이상" />
      </div>
      {/* 아이디 저장 */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "2px 0" }}>
        <input
          type="checkbox"
          checked={saveEmail}
          onChange={(e) => setSaveEmail(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "#1428A0", cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "#64748b" }}>아이디 저장</span>
      </label>
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
        {loading ? "처리 중..." : "로그인"}
      </button>
    </form>
  );

  /* ── 본문 카드 내용 ── */
  const renderCardContent = () => {
    return (
      <>
        {/* 모드 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1D2B", margin: 0 }}>로그인</h2>
        </div>

        {/* 이메일 폼 */}
        {renderEmailForm()}
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