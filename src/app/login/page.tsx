// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { LogoHero } from "@/components/Logo";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const [isSignup, setIsSignup] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "pending") setError("관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.");
    else if (msg === "disabled") setError("비활성화된 계정입니다. 관리자에게 문의하세요.");
    else if (msg === "error") setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);
    try {
      const result = isSignup ? await signup(formData) : await login(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSignupSuccess(true);
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: "kakao" | "google" | "naver") {
    setSocialLoading(provider);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError("로그인 중 오류가 발생했습니다.");
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setSocialLoading("");
    }
  }

  const socialButtons = [
    {
      provider: "kakao",
      label: "카카오로 시작하기",
      bg: "#FEE500",
      color: "#191919",
      hoverBg: "#F5DC00",
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.38C1.5 9.42 2.88 11.22 4.95 12.24L4.14 15.18C4.08 15.39 4.32 15.57 4.5 15.45L7.95 13.14C8.28 13.2 8.64 13.23 9 13.23C13.14 13.23 16.5 10.59 16.5 7.35C16.5 4.14 13.14 1.5 9 1.5Z" fill="#191919"/>
        </svg>
      ),
    },
    {
      provider: "google",
      label: "Google로 시작하기",
      bg: "#ffffff",
      color: "#344054",
      hoverBg: "#f8fafc",
      border: "1px solid #d0d5dd",
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
      ),
    },
    {
      provider: "naver",
      label: "네이버로 시작하기",
      bg: "#03C75A",
      color: "#ffffff",
      hoverBg: "#02b351",
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <rect width="20" height="20" rx="2" fill="#03C75A"/>
          <path d="M11.35 10.25L8.4 6H6.5V14H8.65V9.75L11.6 14H13.5V6H11.35V10.25Z" fill="white"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <LogoHero theme="light" />
          <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", letterSpacing: "0.08em" }}>주차운영 시스템</div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-dark mb-6">
            {isSignup ? "회원가입" : "로그인"}
          </h2>

          {signupSuccess ? (
            <div className="text-center py-4">
              <div className="text-success text-lg font-medium mb-2">회원가입이 완료되었습니다!</div>
              <p className="text-mr-gray text-sm">관리자 승인 후 이용 가능합니다.</p>
              <button onClick={() => { setIsSignup(false); setSignupSuccess(false); setShowEmailForm(false); }} className="mt-4 text-primary hover:underline text-sm">로그인으로 돌아가기</button>
            </div>
          ) : (
            <>
              {/* 소셜 로그인 버튼 (로그인 모드) */}
              {!isSignup && !showEmailForm && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {socialButtons.map((btn) => (
                    <button
                      key={btn.provider}
                      onClick={() => handleSocialLogin(btn.provider)}
                      disabled={!!socialLoading}
                      className="cursor-pointer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        width: "100%", padding: "13px 16px", borderRadius: 12,
                        background: btn.bg, color: btn.color, border: btn.border || "none",
                        fontSize: 15, fontWeight: 600,
                        opacity: socialLoading && socialLoading !== btn.provider ? 0.5 : 1,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = btn.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = btn.bg; }}
                    >
                      {socialLoading === btn.provider ? (
                        <span>연결 중...</span>
                      ) : (
                        <>{btn.icon}<span>{btn.label}</span></>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* 구분선 */}
              {!isSignup && !showEmailForm && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>또는</span>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                </div>
              )}

              {/* 이메일 로그인 토글 버튼 */}
              {!isSignup && !showEmailForm && (
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="cursor-pointer"
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 12,
                    background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0",
                    fontSize: 14, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/>
                  </svg>
                  이메일로 로그인
                </button>
              )}

              {/* 이메일/비밀번호 폼 */}
              {(showEmailForm || isSignup) && (
                <form action={handleSubmit} className="space-y-4">
                  {isSignup && (
                    <div>
                      <label className="block text-sm font-medium text-dark mb-1">이름</label>
                      <input type="text" name="name" required className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="홍길동" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-dark mb-1">이메일</label>
                    <input type="email" name="email" required className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="example@mrpark.co.kr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark mb-1">비밀번호</label>
                    <input type="password" name="password" required minLength={6} className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="6자 이상" />
                  </div>

                  {error && (
                    <div className="text-error text-sm bg-red-50 p-3 rounded-lg">{error}</div>
                  )}

                  <button type="submit" disabled={loading} className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50">
                    {loading ? "처리 중..." : isSignup ? "회원가입" : "로그인"}
                  </button>

                  {showEmailForm && !isSignup && (
                    <button type="button" onClick={() => { setShowEmailForm(false); setError(""); }}
                      className="cursor-pointer"
                      style={{ width: "100%", padding: "8px", background: "none", border: "none", color: "#94a3b8", fontSize: 13 }}>
                      ← 소셜 로그인으로 돌아가기
                    </button>
                  )}
                </form>
              )}

              {/* 소셜 로그인 에러 */}
              {error && !showEmailForm && !isSignup && (
                <div className="text-error text-sm bg-red-50 p-3 rounded-lg mt-3">{error}</div>
              )}
            </>
          )}

          {!signupSuccess && (
            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsSignup(!isSignup); setError(""); setShowEmailForm(false); }}
                className="text-sm text-mr-gray hover:text-primary"
              >
                {isSignup ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page-bg flex items-center justify-center"><div style={{ color: "#94a3b8" }}>로딩...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}