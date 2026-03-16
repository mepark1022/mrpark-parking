// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";

// ─── 미팍Ticket 로고 (인라인) ───
function MipakLogo({ size = "sm" }: { size?: "sm" | "md" }) {
  const s = size === "sm" ? { icon: 28, font: 13, gap: 6, pSize: 16, bar: { w: 12, h: 2.5, b: 5 }, dot: 6 } :
    { icon: 36, font: 16, gap: 8, pSize: 20, bar: { w: 16, h: 3, b: 6 }, dot: 8 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <div style={{
        width: s.icon, height: s.icon, background: "#1428A0", borderRadius: 8,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ position: "absolute", left: -3, top: "50%", transform: "translateY(-50%)", width: s.dot, height: s.dot, background: "#f1f5f9", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -3, top: "50%", transform: "translateY(-50%)", width: s.dot, height: s.dot, background: "#f1f5f9", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: s.pSize, fontWeight: 900, color: "#fff", marginTop: -2 }}>P</span>
        <span style={{ position: "absolute", bottom: s.bar.b, left: "50%", transform: "translateX(-50%)", width: s.bar.w, height: s.bar.h, background: "#F5B731", borderRadius: 1 }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: s.font, fontWeight: 800, color: "#1A1D2B" }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: s.font, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

// ─── 카테고리 칩 ───
const CATEGORIES = [
  { key: "ui", label: "UI 깨짐", emoji: "🎨" },
  { key: "function", label: "기능 오류", emoji: "⚙️" },
  { key: "data", label: "데이터 이상", emoji: "📊" },
  { key: "performance", label: "느림/멈춤", emoji: "🐌" },
  { key: "other", label: "기타", emoji: "📝" },
];

const SEVERITY = [
  { key: "low", label: "낮음", color: "#16A34A" },
  { key: "medium", label: "보통", color: "#F5B731" },
  { key: "high", label: "높음", color: "#EA580C" },
  { key: "critical", label: "긴급", color: "#DC2626" },
];

export default function BugReportFAB() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    severity: "medium",
    page_url: "",
    steps_to_reproduce: "",
  });

  // 현재 페이지 URL 자동 설정
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setForm(f => ({ ...f, page_url: window.location.pathname }));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setToast("제목을 입력해주세요");
      setTimeout(() => setToast(""), 2500);
      return;
    }
    if (!form.category) {
      setToast("카테고리를 선택해주세요");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const ctx = await getUserContext();
      if (!ctx?.orgId) throw new Error("org_id 없음");

      const { data: { user } } = await supabase.auth.getUser();

      // 1. DB에 제보 저장
      const { data: inserted, error } = await supabase.from("bug_reports").insert({
        org_id: ctx.orgId,
        reporter_id: user?.id,
        reporter_email: user?.email || "unknown",
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        severity: form.severity,
        page_url: form.page_url,
        steps_to_reproduce: form.steps_to_reproduce.trim(),
        status: "open",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        screen_size: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
      }).select("id").single();

      if (error) throw error;

      // 2. Claude API로 자동 분류 (비동기, 실패해도 무시)
      if (inserted?.id) {
        fetch("/api/bugs/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bugId: inserted.id,
            title: form.title,
            description: form.description,
            category: form.category,
            page_url: form.page_url,
            steps: form.steps_to_reproduce,
          }),
        }).catch(() => {}); // 실패해도 무시
      }

      setToast("제보가 접수되었습니다!");
      setTimeout(() => {
        setToast("");
        setOpen(false);
        setForm({ title: "", description: "", category: "", severity: "medium", page_url: "", steps_to_reproduce: "" });
      }, 1500);
    } catch (err) {
      console.error("Bug report error:", err);
      setToast("제보 실패 — 다시 시도해주세요");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ─── FAB 버튼 ─── */}
      <button
        onClick={() => setOpen(true)}
        className="bug-fab"
        style={{
          position: "fixed",
          bottom: 100, right: 20,
          width: 52, height: 52,
          borderRadius: 16,
          background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 20px rgba(220,38,38,0.4)",
          cursor: "pointer",
          zIndex: 9998,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24,
          transition: "all 0.2s",
        }}
        title="오류 제보"
      >
        🐛
      </button>

      {/* ─── 모달 ─── */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
              maxHeight: "85vh", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* 헤더 */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <MipakLogo size="sm" />
                <div style={{
                  background: "#FEE2E2", color: "#DC2626",
                  padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>
                  🐛 오류 제보
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "none",
                  background: "#f1f5f9", cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {/* 폼 */}
            <div style={{ padding: "20px 24px 24px" }}>
              {/* 제목 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 6, display: "block" }}>
                  제목 <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="어떤 문제가 발생했나요?"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 카테고리 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 8, display: "block" }}>
                  카테고리 <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setForm({ ...form, category: c.key })}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        border: form.category === c.key ? "2px solid #1428A0" : "1px solid #e2e8f0",
                        background: form.category === c.key ? "#EEF2FF" : "#fff",
                        color: form.category === c.key ? "#1428A0" : "#64748B",
                        fontWeight: form.category === c.key ? 700 : 500,
                        fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 심각도 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 8, display: "block" }}>
                  심각도
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {SEVERITY.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setForm({ ...form, severity: s.key })}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 8,
                        border: form.severity === s.key ? `2px solid ${s.color}` : "1px solid #e2e8f0",
                        background: form.severity === s.key ? `${s.color}15` : "#fff",
                        color: form.severity === s.key ? s.color : "#94A3B8",
                        fontWeight: form.severity === s.key ? 700 : 500,
                        fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 발생 페이지 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 6, display: "block" }}>
                  발생 페이지
                </label>
                <input
                  value={form.page_url}
                  onChange={(e) => setForm({ ...form, page_url: e.target.value })}
                  placeholder="/dashboard, /workers 등"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
                    background: "#f8fafc", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 상세 설명 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 6, display: "block" }}>
                  상세 설명
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="어떤 상황에서 발생했는지 자세히 적어주세요..."
                  rows={3}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 재현 방법 */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 6, display: "block" }}>
                  재현 방법 (선택)
                </label>
                <textarea
                  value={form.steps_to_reproduce}
                  onChange={(e) => setForm({ ...form, steps_to_reproduce: e.target.value })}
                  placeholder="1. 대시보드 접속&#10;2. 매장 선택 클릭&#10;3. 에러 발생"
                  rows={2}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 제출 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12,
                  border: "none", cursor: submitting ? "not-allowed" : "pointer",
                  background: submitting ? "#94A3B8" : "#DC2626",
                  color: "#fff", fontSize: 15, fontWeight: 800,
                  boxShadow: submitting ? "none" : "0 4px 16px rgba(220,38,38,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {submitting ? "전송 중..." : "🐛 오류 제보 전송"}
              </button>

              {/* 토스트 */}
              {toast && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 10,
                  background: toast.includes("접수") ? "#DCFCE7" : "#FEE2E2",
                  color: toast.includes("접수") ? "#16A34A" : "#DC2626",
                  fontSize: 13, fontWeight: 700, textAlign: "center",
                }}>
                  {toast}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bug-fab:hover { transform: scale(1.08); }
        .bug-fab:active { transform: scale(0.95); }
        @media (min-width: 768px) {
          .bug-fab { bottom: 32px !important; right: 32px !important; }
        }
      `}</style>
    </>
  );
}
