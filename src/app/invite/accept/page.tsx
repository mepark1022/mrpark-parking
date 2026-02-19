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
          setStep("signup");
          setLoading(false);
        }
      } else {
        setStep("signup");
        setLoading(false);
      }
    } catch (err) {
      setError("초대 정보를 불러오는 중 오류가 발생했습니다.");
      setStep("error");
      setLoading(false);
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

  // ME.PARK 2.0 로고 컴포넌트 (Rounded Frame + Gold Corner)
  const MeParkLogo = ({ size = "default", theme = "light" }) => {
    const sizes = {
      small: { fontSize: 14, padding: "8px 14px", corner: 12, radius: 8 },
      default: { fontSize: 20, padding: "12px 20px", corner: 18, radius: 10 },
      large: { fontSize: 28, padding: "16px 28px", corner: 24, radius: 14 },
    };
    const s = sizes[size];
    const borderColor = theme === "dark" ? "#fff" : "#1A1D2B";
    const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
    const subColor = theme === "dark" ? "rgba(255,255,255,.35)" : "#8B90A0";

    return (
      <div style={{ display: "inline-flex" }}>
        <div style={{
          padding: s.padding,
          border: `2.5px solid ${borderColor}`,
          borderRadius: s.radius,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: 0, height: 0,
            borderTop: `${s.corner}px solid #F5B731`,
            borderLeft: `${s.corner}px solid transparent`,
          }} />
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: s.fontSize,
            fontWeight: 800,
            color: textColor,
            letterSpacing: "-0.5px",
          }}>
            ME.PARK{" "}
          </span>
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: s.fontSize,
            fontWeight: 300,
            color: subColor,
          }}>
            2.0
          </span>
        </div>
      </div>
    );
  };

  // --- 상태별 렌더링 ---

  if (step === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <div style={{ fontSize: 36, marginBottom: 12, animation: "pulse 1.5s infinite" }}>⏳</div>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>초대 정보를 확인하고 있습니다...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo size="default" theme="light" />
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

  if (step === "accepting") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo size="default" theme="light" />
            <div style={{ fontSize: 36, margin: "20px 0 12px" }}>⏳</div>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>초대를 수락하고 있습니다...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <MeParkLogo size="default" theme="light" />
            <div style={{ fontSize: 40, margin: "20px 0 12px" }}>✅</div>
            <h2 style={{ color: "#16a34a", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>초대 수락 완료!</h2>
            <p style={{ color: "#8B90A0", fontSize: 14 }}>잠시 후 이동합니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 회원가입 / 로그인 폼
  return (
    <div style={styles.page}>
      {/* Google Fonts 로드 */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;800;900&family=Sora:wght@800&display=swap" rel="stylesheet" />

      <div style={styles.card}>
        {/* ME.PARK 2.0 로고 */}
        <div style={styles.center}>
          <MeParkLogo size="default" theme="light" />
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
              display: "inline-block",
              marginTop: 8,
              padding: "4px 12px",
              background: "#FFF7ED",
              borderRadius: 6,
              fontSize: 12,
              color: "#ea580c",
              fontWeight: 600,
            }}>
              📍 배정 매장: {storeName}
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* 탭 전환 */}
        <div style={styles.tabWrap}>
          <button
            onClick={() => { setStep("signup"); setError(""); }}
            style={step === "signup" ? styles.tabActive : styles.tabInactive}
          >
            회원가입
          </button>
          <button
            onClick={() => { setStep("login"); setError(""); }}
            style={step === "login" ? styles.tabActive : styles.tabInactive}
          >
            로그인
          </button>
        </div>

        {/* 회원가입 폼 */}
        {step === "signup" && (
          <div style={{ marginTop: 20 }}>
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
  errorBox: {
    background: "#fee2e2",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginTop: 16,
    lineHeight: 1.5,
  },
  tabWrap: {
    display: "flex",
    background: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginTop: 24,
    gap: 4,
  },
  tabActive: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    background: "#fff",
    color: "#1428A0",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tabInactive: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    background: "transparent",
    color: "#8B90A0",
    cursor: "pointer",
  },
};
