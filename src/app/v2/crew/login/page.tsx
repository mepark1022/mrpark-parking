// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * CREW v2 로그인 페이지
 * - POST /api/v1/auth/login (이메일/전화번호/사번 통합 자동판별)
 * - GET /api/v1/auth/me (로그인 상태 확인)
 * - Supabase 클라이언트 직접 호출 없음 (API-first)
 */

// ── 미팍티켓 로고 ──
function MeparkLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 60, height: 60, background: "rgba(255,255,255,0.18)", borderRadius: 16,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px solid rgba(255,255,255,0.2)",
      }}>
        <div style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: "rgba(255,255,255,0.15)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: "rgba(255,255,255,0.15)", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: "#fff", marginTop: -4 }}>P</span>
        <span style={{ position: "absolute", bottom: 9, left: "50%", transform: "translateX(-50%)", width: 24, height: 5, background: "#F5B731", borderRadius: 2.5 }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 28, fontWeight: 800, color: "#fff" }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

export default function CrewV2LoginPage() {
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

function LoginContent() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [saveId, setSaveId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 저장된 아이디 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("crew_v2_saved_id");
    if (saved) {
      setIdentifier(saved);
      setSaveId(true);
    }
  }, []);

  // URL 에러 파라미터
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      const messages: Record<string, string> = {
        session_expired: "세션이 만료되었습니다. 다시 로그인하세요.",
        no_access: "크루 권한이 없습니다. 관리자에게 문의하세요.",
      };
      setError(messages[err] || "오류가 발생했습니다.");
    }
  }, [searchParams]);

  // 이미 로그인 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) { setCheckingAuth(false); return; }
        const { data } = await res.json();

        const allowedRoles = ["crew", "admin", "owner", "super_admin"];
        if (!allowedRoles.includes(data?.role)) {
          setCheckingAuth(false);
          return;
        }

        // 이미 로그인 → 매장 선택 or 홈
        const savedStore = localStorage.getItem("crew_store_id");
        if (savedStore) {
          router.replace("/v2/crew");
        } else {
          router.replace("/v2/crew/select-store");
        }
      } catch {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  // 로그인 실행
  const handleLogin = async () => {
    if (!identifier.trim() || !password) return;
    setLoading(true);
    setError("");

    // 아이디 저장
    if (saveId) {
      localStorage.setItem("crew_v2_saved_id", identifier.trim());
    } else {
      localStorage.removeItem("crew_v2_saved_id");
    }

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        // v1 API 에러 메시지 활용
        const msg = result.error?.message || result.error?.details || "로그인에 실패했습니다.";
        setError(msg);
        setLoading(false);
        return;
      }

      // 로그인 성공 → 역할 확인
      const meRes = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (meRes.ok) {
        const { data: me } = await meRes.json();
        const allowedRoles = ["crew", "admin", "owner", "super_admin"];
        if (!allowedRoles.includes(me?.role)) {
          setError("크루 권한이 없습니다. 관리자에게 문의하세요.");
          setLoading(false);
          return;
        }

        // admin/owner/super_admin은 select-store에서 전체 매장 조회
        // crew는 auth/me.stores 사용
        const isAdmin = ["admin", "owner", "super_admin"].includes(me?.role);
        const stores = me?.stores || [];

        if (!isAdmin && stores.length === 0) {
          setError("배정된 매장이 없습니다. 관리자에게 문의하세요.");
          setLoading(false);
          return;
        }

        // crew + 매장 1개 → 자동 선택
        if (!isAdmin && stores.length === 1) {
          localStorage.setItem("crew_store_id", stores[0].store_id);
          localStorage.setItem("crew_store_name", stores[0].store_name);
          router.replace("/v2/crew");
        } else {
          // admin이거나 crew + 매장 다수 → 매장 선택
          router.replace("/v2/crew/select-store");
        }
      } else {
        setError("로그인 후 사용자 정보를 확인할 수 없습니다.");
        setLoading(false);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  // 인증 확인 중
  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100dvh", background: "#1428A0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  // 입력 타입 감지 → placeholder/label 동적 변경
  const trimmed = identifier.trim();
  let inputHint = "이메일 / 전화번호 / 사번";
  if (trimmed.includes("@")) inputHint = "이메일";
  else if (/^01[016789]/.test(trimmed)) inputHint = "전화번호";
  else if (/^(MP|MPA)/i.test(trimmed)) inputHint = "사번";

  return (
    <>
      <style>{`
        .cv2-login { min-height: 100dvh; background: linear-gradient(165deg, #0f1f8a 0%, #1428A0 40%, #1e36c0 100%); display: flex; flex-direction: column; }
        .cv2-login-top { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px 40px; gap: 16px; }
        .cv2-login-subtitle { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 8px; }
        .cv2-login-card { background: #fff; border-radius: 24px 24px 0 0; padding: 32px 24px 40px; padding-bottom: calc(40px + env(safe-area-inset-bottom, 0)); }
        .cv2-login-title { font-size: 18px; font-weight: 700; color: #1A1D2B; margin-bottom: 20px; text-align: center; }
        .cv2-login-error { margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: 14px; color: #dc2626; text-align: center; }
        .cv2-login-help { margin-top: 24px; text-align: center; font-size: 13px; color: #94a3b8; line-height: 1.6; }
        @media (min-width: 480px) {
          .cv2-login { align-items: center; justify-content: center; padding: 40px 20px; }
          .cv2-login-top { padding: 0 0 32px; flex: none; }
          .cv2-login-card { width: 100%; max-width: 380px; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.2); }
        }
      `}</style>

      <div className="cv2-login">
        <div className="cv2-login-top">
          <MeparkLogo />
          <div className="cv2-login-subtitle">주차 크루 전용</div>
        </div>

        <div className="cv2-login-card">
          <div className="cv2-login-title">로그인</div>

          {/* 안내 */}
          <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#1428A0", lineHeight: 1.6, textAlign: "center" }}>
            <strong>이메일 · 전화번호 · 사번</strong> 모두 로그인 가능합니다
          </div>

          {/* 폼 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                <span>아이디</span>
                {inputHint !== "이메일 / 전화번호 / 사번" && (
                  <span style={{ fontSize: 11, color: "#1428A0", fontWeight: 700 }}>{inputHint} 감지</span>
                )}
              </label>
              <input
                type="text"
                inputMode="email"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="이메일, 전화번호, 또는 사번"
                style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1A1D2B", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>비밀번호</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1A1D2B", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* 아이디 저장 */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "2px 0" }}>
              <input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#1428A0", cursor: "pointer" }} />
              <span style={{ fontSize: 13, color: "#64748b" }}>아이디 저장</span>
            </label>

            <button
              onClick={handleLogin}
              disabled={loading || !identifier.trim() || !password}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: "#1428A0", color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: loading || !identifier.trim() || !password ? "not-allowed" : "pointer",
                opacity: loading || !identifier.trim() || !password ? 0.5 : 1,
                marginTop: 2,
              }}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </div>

          {error && <div className="cv2-login-error">{error}</div>}

          <div className="cv2-login-help">
            최초 비밀번호: 전화번호 뒤 4자리 + "12"<br />
            문의: 관리자에게 연락하세요.
          </div>
        </div>
      </div>
    </>
  );
}
