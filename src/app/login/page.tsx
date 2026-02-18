// @ts-nocheck
"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import { LogoLogin } from "@/components/Logo";

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

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoLogin />
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