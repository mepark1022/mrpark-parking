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
  const [step, setStep] = useState("loading"); // loading | signup | login | accepting | done | error

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
      // 토큰으로 초대 정보 조회
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

      // 만료 체크
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
        setError("초대가 만료되었습니다. 관리자에게 재초대를 요청하세요.");
        setStep("error");
        setLoading(false);
        return;
      }

      // 이미 수락됨
      if (inv.status === "accepted") {
        setError("이미 수락된 초대입니다. 로그인 페이지로 이동하세요.");
        setStep("error");
        setLoading(false);
        return;
      }

      // 취소됨
      if (inv.status === "rejected") {
        setError("취소된 초대입니다.");
        setStep("error");
        setLoading(false);
        return;
      }

      setInvitation(inv);
      setEmail(inv.email);

      // 이미 로그인 되어 있는지 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === inv.email) {
          // 같은 이메일로 로그인됨 → 바로 수락
          await acceptInvitation(user.id, inv);
          return;
        } else {
          // 다른 이메일로 로그인됨 → 로그아웃 후 진행
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

  // 회원가입 후 수락
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
        // 프로필 생성/업데이트
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

  // 기존 계정 로그인 후 수락
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
        // 프로필 업데이트 (role, org_id)
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

  // 초대 수락 처리
  async function acceptInvitation(userId, inv) {
    setStep("accepting");
    try {
      // 1. invitations 상태 업데이트
      await supabase
        .from("invitations")
        .update({ status: "accepted" })
        .eq("id", inv.id);

      // 2. crew인 경우 store_members에 매장 배정 (테이블 존재 시)
      if (inv.role === "crew" && inv.store_id) {
        try {
          await supabase.from("store_members").upsert({
            user_id: userId,
            store_id: inv.store_id,
            org_id: inv.org_id || null,
          });
        } catch (e) {
          // store_members 테이블이 없어도 무시
          console.log("store_members upsert skipped:", e);
        }
      }

      setStep("done");

      // 1.5초 후 리다이렉트
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

  // --- UI ---
  const roleLabel = invitation?.role === "crew" ? "CREW (현장 크루)" : "관리자 (Admin)";
  const storeName = invitation?.stores?.name;

  // 로딩
  if (step === "loading") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <div style={styles.spinner}>⏳</div>
            <p style={styles.subText}>초대 정보를 확인하고 있습니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러
  if (step === "error") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: "#1A1D2B", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>초대 오류</h2>
            <p style={{ color: "#dc2626", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
            <button onClick={() => router.push("/login")} style={styles.btnSecondary}>
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 수락 중
  if (step === "accepting") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <div style={styles.spinner}>⏳</div>
            <p style={styles.subText}>초대를 수락하고 있습니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 완료
  if (step === "done") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#15803d", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>초대 수락 완료!</h2>
            <p style={styles.subText}>잠시 후 이동합니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 회원가입 / 로그인 폼
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 헤더 */}
        <div style={styles.center}>
          <div style={styles.logo}>VALETMAN</div>
          <p style={{ color: "#999", fontSize: 12, marginTop: 4, marginBottom: 20 }}>주차운영 시스템</p>
          <h2 style={{ color: "#1A1D2B", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>팀원 초대</h2>
          <p style={{ color: "#666", fontSize: 13 }}>
            <strong style={{ color: "#1428A0" }}>{roleLabel}</strong>으로 초대되었습니다
          </p>
          {storeName && (
            <p style={{ color: "#ea580c", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
              📍 배정 매장: {storeName}
            </p>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* 탭 전환: 회원가입 / 로그인 */}
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
            <input
              style={styles.input}
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label style={styles.label}>이메일</label>
            <input
              style={{ ...styles.input, background: "#f8fafc", color: "#999" }}
              value={email}
              readOnly
            />
            <label style={styles.label}>비밀번호 *</label>
            <input
              style={styles.input}
              type="password"
              placeholder="6자 이상 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            />
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
            <input
              style={{ ...styles.input, background: "#f8fafc", color: "#999" }}
              value={email}
              readOnly
            />
            <label style={styles.label}>비밀번호 *</label>
            <input
              style={styles.input}
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
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
        <p style={{ color: "#ccc", fontSize: 11, textAlign: "center", marginTop: 24 }}>
          © 주식회사 미스터팍 · VALETMAN
        </p>
      </div>
    </div>
  );
}

// Suspense 래퍼 (useSearchParams 필수)
export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.center}>
            <p style={styles.subText}>로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <InviteAcceptContent />
    </Suspense>
  );
}

// 스타일
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0a1352 0%, #1428A0 50%, #1e3a8a 100%)",
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
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  center: { textAlign: "center" },
  logo: {
    display: "inline-block",
    background: "#1428A0",
    color: "#fff",
    padding: "8px 20px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: 1,
  },
  spinner: { fontSize: 40, marginBottom: 12 },
  subText: { color: "#888", fontSize: 14 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#555",
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
    transition: "border-color 0.2s",
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
    color: "#999",
    cursor: "pointer",
  },
};
