// @ts-nocheck
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("loading");
  const [socialLoading, setSocialLoading] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("유효하지 않은 초대 링크입니다.");
      setStep("error");
      setLoading(false);
      return;
    }
    checkInvitation();
  }, [token]);

  async function checkInvitation() {
    try {
      const { data: inv, error: fetchErr } = await supabase
        .from("invitations")
        .select("*, stores(name)")
        .eq("token", token)
        .single();

      if (fetchErr || !inv) {
        setError("초대를 찾을 수 없습니다.");
        setStep("error");
        setLoading(false);
        return;
      }

      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        setError("초대가 만료되었습니다. 관리자에게 재초대를 요청하세요.");
        setStep("error");
        setLoading(false);
        return;
      }

      if (inv.status === "accepted") {
        setError("이미 수락된 초대입니다. 로그인 페이지로 이동하세요.");
        setStep("error");
        setLoading(false);
        return;
      }

      if (inv.status === "rejected") {
        setError("취소된 초대입니다.");
        setStep("error");
        setLoading(false);
        return;
      }

      setInvitation(inv);
      setEmail(inv.email);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === inv.email) {
          await acceptInvitation(user.id, inv);
          return;
        } else {
          await supabase.auth.signOut();
          setStep("social");
          setLoading(false);
        }
      } else {
        setStep("social");
        setLoading(false);
      }
    } catch (err) {
      setError("초대 정보를 불러오는 중 오류가 발생했습니다.");
      setStep("error");
      setLoading(false);
    }
  }

  // 카카오/구글/네이버 소셜 로그인
  async function handleSocialLogin(provider) {
    setSocialLoading(provider);
    setError("");
    try {
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

  async function handleSignUp() {
    if (!name || !password) return;
    setFormLoading(true);
    setError("");

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (signUpErr) {
        if (signUpErr.message.includes("already registered") || signUpErr.message.includes("already been registered")) {
          setStep("login");
          setError("이미 가입된 이메일입니다. 비밀번호를 입력해 로그인하세요.");
          setFormLoading(false);
          return;
        }
        throw signUpErr;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email,
          name: name,
          role: invitation.role === "crew" ? "crew" : "admin",
          status: "active",
          org_id: invitation.org_id || null,
        });
        await acceptInvitation(data.user.id, invitation);
      }
    } catch (err) {
      setError(err.message || "회원가입에 실패했습니다.");
      setFormLoading(false);
    }
  }

  async function handleLogin() {
    if (!password) return;
    setFormLoading(true);
    setError("");

    try {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) throw loginErr;

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email,
          role: invitation.role === "crew" ? "crew" : "admin",
          status: "active",
          org_id: invitation.org_id || null,
        });
        await acceptInvitation(data.user.id, invitation);
      }
    } catch (err) {
      setError(err.message || "로그인에 실패했습니다.");
      setFormLoading(false);
    }
  }

  async function acceptInvitation(userId, inv) {
    setStep("accepting");
    try {
      await supabase
        .from("invitations")
        .update({ status: "accepted" })
        .eq("id", inv.id);

      if (inv.role === "crew" && inv.store_id) {
        try {
          await supabase.from("store_members").upsert({
            user_id: userId,
            store_id: inv.store_id,
            org_id: inv.org_id || null,
          });
        } catch (e) {
          console.log("store_members upsert skipped:", e);
        }
      }

      setStep("done");
      setTimeout(() => {
        if (inv.role === "crew") {
          router.push("/crew/home");
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err) {
      setError("수락 처리 중 오류가 발생했습니다.");
      setStep("error");
    }
  }

  const roleLabel = invitation?.role === "crew" ? "CREW (현장 크루)" : "관리자 (Admin)";
  const roleColor = invitation?.role === "crew" ? "#16a34a" : "#1428A0";
  const storeName = invitation?.stores?.name;

  const MeParkLogo = () => (
    <div style={{ display: "inline-flex" }}>
      <div style={{
        padding: "12px 20px", border: "2.5px solid #1A1D2B",
        borderRadius: 10, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0, width: 0, height: 0,
          borderTop: "18px solid #F5B731", borderLeft: "18px solid transparent",
        }} />
        <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 20, fontWeight: 800, color: "#1A1D2B", letterSpacing: "-0.5px" }}>
          ME.PARK{" "}
        </span>
        <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 20, fontWeight: 300, color: "#8B90A0" }}>
          2.0
        </span>
      </div>
    </div>
  );

  // 소셜 로그인 버튼 데이터
  const socialButtons = [
    {
      provider: "kakao",
      label: "카카오로 시작하기",
      bg: "#FEE500",
      color: "#191919",
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
  ];

  // --- 상태별 렌더링 ---

  if (step === "loading" || step === "accepting") {
    return (
      <div style={styles.page}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;800;900&display=swap" rel="stylesheet" />
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo />
            <div style={{ fontSize: 36, margin: "20px 0 12px" }}>⏳</div>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>
              {step === "accepting" ? "초대를 수락하고 있습니다..." : "초대 정보를 확인하고 있습니다..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div style={styles.page}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;800;900&display=swap" rel="stylesheet" />
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo />
            <div style={{ fontSize: 40, margin: "20px 0 12px" }}>⚠️</div>
            <h2 style={{ color: "#1A1D2B", fontSize: 17, fontWeight: 700, marginBottom: 12 }}>초대 오류</h2>
            <p style={{ color: "#dc2626", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
            <button onClick={() => router.push("/login")} style={styles.btnSecondary}>
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div style={styles.page}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;800;900&display=swap" rel="stylesheet" />
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo />
            <div style={{ fontSize: 40, margin: "20px 0 12px" }}>✅</div>
            <h2 style={{ color: "#16a34a", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>초대 수락 완료!</h2>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>잠시 후 이동합니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 메인: 소셜 로그인 + 이메일 폼
  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;800;900&display=swap" rel="stylesheet" />

      <div style={styles.card}>
        {/* ME.PARK 2.0 로고 */}
        <div style={styles.center}>
          <MeParkLogo />
          <p style={{ color: "#8B90A0", fontSize: 11, marginTop: 6, letterSpacing: 1 }}>주차운영 시스템</p>
        </div>

        {/* 초대 정보 */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <h2 style={{ color: "#1A1D2B", fontSize: 18, fontWeight: 800, marginBottom: 6 }}>팀원 초대</h2>
          <p style={{ color: "#666", fontSize: 13 }}>
            <strong style={{ color: roleColor }}>{roleLabel}</strong>으로 초대되었습니다
          </p>
          {storeName && (
            <div style={{
              display: "inline-block", marginTop: 8, padding: "4px 12px",
              background: "#FFF7ED", borderRadius: 6, fontSize: 12, color: "#ea580c", fontWeight: 600,
            }}>
              📍 배정 매장: {storeName}
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* 소셜 로그인 (기본 화면) */}
        {step === "social" && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {socialButtons.map((btn) => (
                <button
                  key={btn.provider}
                  onClick={() => handleSocialLogin(btn.provider)}
                  disabled={!!socialLoading}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", padding: "13px 16px", borderRadius: 12,
                    background: btn.bg, color: btn.color, border: btn.border || "none",
                    fontSize: 15, fontWeight: 600, cursor: "pointer",
                    opacity: socialLoading && socialLoading !== btn.provider ? 0.5 : 1,
                  }}
                >
                  {socialLoading === btn.provider ? (
                    <span>연결 중...</span>
                  ) : (
                    <>{btn.icon}<span>{btn.label}</span></>
                  )}
                </button>
              ))}
            </div>

            {/* 구분선 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>또는 이메일로</span>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            </div>

            {/* 이메일 가입/로그인 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep("signup")}
                style={{ ...styles.btnOutline, flex: 1 }}
              >
                이메일 회원가입
              </button>
              <button
                onClick={() => setStep("login")}
                style={{ ...styles.btnOutline, flex: 1 }}
              >
                이메일 로그인
              </button>
            </div>
          </div>
        )}

        {/* 회원가입 폼 */}
        {step === "signup" && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setStep("social")} style={styles.backBtn}>← 돌아가기</button>
            <label style={styles.label}>이름 *</label>
            <input style={styles.input} placeholder="이름을 입력하세요" value={name} onChange={(e) => setName(e.target.value)} />
            <label style={styles.label}>이메일</label>
            <input style={{ ...styles.input, background: "#f8fafc", color: "#8B90A0" }} value={email} readOnly />
            <label style={styles.label}>비밀번호 *</label>
            <input style={styles.input} type="password" placeholder="6자 이상 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignUp()} />
            <button
              style={{ ...styles.btnPrimary, opacity: formLoading || !name || !password || password.length < 6 ? 0.5 : 1 }}
              onClick={handleSignUp}
              disabled={formLoading || !name || !password || password.length < 6}
            >
              {formLoading ? "처리 중..." : "가입하고 초대 수락"}
            </button>
          </div>
        )}

        {/* 로그인 폼 */}
        {step === "login" && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setStep("social")} style={styles.backBtn}>← 돌아가기</button>
            <label style={styles.label}>이메일</label>
            <input style={{ ...styles.input, background: "#f8fafc", color: "#8B90A0" }} value={email} readOnly />
            <label style={styles.label}>비밀번호 *</label>
            <input style={styles.input} type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            <button
              style={{ ...styles.btnPrimary, opacity: formLoading || !password ? 0.5 : 1 }}
              onClick={handleLogin}
              disabled={formLoading || !password}
            >
              {formLoading ? "처리 중..." : "로그인하고 초대 수락"}
            </button>
          </div>
        )}

        {/* 푸터 */}
        <p style={{ color: "#C0C4D0", fontSize: 11, textAlign: "center", marginTop: 28 }}>
          © 주식회사 미스터팍 · ME.PARK 2.0
        </p>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <InviteAcceptContent />
    </Suspense>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#1A1D2B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 20,
    padding: "36px 28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    position: "relative",
  },
  center: { textAlign: "center" },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#1A1D2B",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    color: "#1A1D2B",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%",
    padding: "14px 0",
    background: "#1428A0",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 20,
  },
  btnSecondary: {
    padding: "10px 24px",
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "11px 0",
    background: "#fff",
    color: "#475569",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#8B90A0",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    marginBottom: 8,
  },
  errorBox: {
    background: "#fee2e2",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginTop: 16,
    lineHeight: 1.5,
  },
};
