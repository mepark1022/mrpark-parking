// @ts-nocheck
"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);
    try {
      const result = isSignup ? await signup(formData) : await login(formData);
      if (result?.error) {
        setError(result.error);
      }
      if (result?.success) {
        setSignupSuccess(true);
      }
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function handleKakaoLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError("카카오 로그인에 실패했습니다: " + error.message);
        setLoading(false);
      }
    } catch {
      setError("카카오 로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Mr. Park</h1>
          <p className="text-mr-gray mt-2">주차 관리 시스템</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-dark mb-6">
            {isSignup ? "회원가입" : "로그인"}
          </h2>

          {signupSuccess ? (
            <div className="text-center py-4">
              <div className="text-success text-lg font-medium mb-2">
                회원가입이 완료되었습니다!
              </div>
              <p className="text-mr-gray text-sm">
                관리자 승인 후 이용 가능합니다.
              </p>
              <button
                onClick={() => { setIsSignup(false); setSignupSuccess(false); }}
                className="mt-4 text-primary hover:underline text-sm"
              >
                로그인으로 돌아가기
              </button>
            </div>
          ) : (
            <>
              <form action={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div>
                    <label className="block text-sm font-medium text-dark mb-1">
                      이름
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="홍길동"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="example@mrpark.co.kr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="6자 이상"
                  />
                </div>

                {error && (
                  <div className="text-error text-sm bg-red-50 p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "처리 중..." : isSignup ? "회원가입" : "로그인"}
                </button>
              </form>

              {/* 구분선 */}
              <div className="flex items-center my-5">
                <div className="flex-1 border-t border-light-gray"></div>
                <span className="px-3 text-sm text-mr-gray">또는</span>
                <div className="flex-1 border-t border-light-gray"></div>
              </div>

              {/* 카카오 로그인 버튼 */}
              <button
                onClick={handleKakaoLogin}
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#FEE500", color: "#000000" }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9 0.5C4.029 0.5 0 3.588 0 7.393C0 9.814 1.558 11.95 3.931 13.186L2.933 16.779C2.844 17.087 3.213 17.332 3.478 17.147L7.739 14.207C8.153 14.252 8.573 14.285 9 14.285C13.971 14.285 18 11.197 18 7.393C18 3.588 13.971 0.5 9 0.5Z"
                    fill="#000000"
                  />
                </svg>
                카카오 로그인
              </button>
            </>
          )}

          {!signupSuccess && (
            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsSignup(!isSignup); setError(""); }}
                className="text-sm text-mr-gray hover:text-primary"
              >
                {isSignup
                  ? "이미 계정이 있으신가요? 로그인"
                  : "계정이 없으신가요? 회원가입"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}