// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

const CATEGORY_MAP = {
  ui: { label: "UI 깨짐", emoji: "🎨", color: "#7C3AED" },
  function: { label: "기능 오류", emoji: "⚙️", color: "#1428A0" },
  data: { label: "데이터 이상", emoji: "📊", color: "#EA580C" },
  performance: { label: "느림/멈춤", emoji: "🐌", color: "#DC2626" },
  other: { label: "기타", emoji: "📝", color: "#64748B" },
};

const SEVERITY_MAP = {
  low: { label: "낮음", color: "#16A34A", bg: "#DCFCE7" },
  medium: { label: "보통", color: "#F5B731", bg: "#FEF9C3" },
  high: { label: "높음", color: "#EA580C", bg: "#FFEDD5" },
  critical: { label: "긴급", color: "#DC2626", bg: "#FEE2E2" },
};

const STATUS_MAP = {
  open: { label: "접수", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "확인중", color: "#F5B731", bg: "#FEF9C3" },
  resolved: { label: "해결됨", color: "#16A34A", bg: "#DCFCE7" },
  closed: { label: "종료", color: "#64748B", bg: "#F1F5F9" },
};

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];

export default function BugsPage() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedBug, setSelectedBug] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => { loadBugs(); }, []);

  const loadBugs = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const oid = await getOrgId();
      if (!oid) return;

      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .eq("org_id", oid)
        .order("created_at", { ascending: false });

      if (!error && data) setBugs(data);
    } catch (err) {
      console.error("Load bugs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await fetch("/api/bugs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setBugs(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        if (selectedBug?.id === id) setSelectedBug({ ...selectedBug, status: newStatus });
        setToast("상태가 변경되었습니다");
        setTimeout(() => setToast(""), 2000);
      }
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  const filtered = filter === "all" ? bugs : bugs.filter(b => b.status === filter);

  const counts = {
    all: bugs.length,
    open: bugs.filter(b => b.status === "open").length,
    in_progress: bugs.filter(b => b.status === "in_progress").length,
    resolved: bugs.filter(b => b.status === "resolved").length,
    closed: bugs.filter(b => b.status === "closed").length,
  };

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🐛</span>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>오류보고 대시보드</h1>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>미팍티켓 어드민 · CREW앱 오류 현황</p>
            </div>
          </div>
          <button
            onClick={loadBugs}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              color: "#64748B", display: "flex", alignItems: "center", gap: 4,
            }}
          >🔄 새로고침</button>
        </div>

        {/* KPI 카드 */}
        <div className="bugs-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "전체", count: counts.all, color: "#1428A0", icon: "📋" },
            { label: "접수", count: counts.open, color: "#DC2626", icon: "🔴" },
            { label: "확인중", count: counts.in_progress, color: "#F5B731", icon: "🟡" },
            { label: "해결됨", count: counts.resolved, color: "#16A34A", icon: "🟢" },
          ].map(k => (
            <div key={k.label} style={{
              background: "#fff", borderRadius: 14, padding: "16px 18px",
              border: "1px solid #eef0f3", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.count}</div>
            </div>
          ))}
        </div>

        {/* 필터 탭 */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", padding: "4px 0" }}>
          {[
            { key: "all", label: "전체" },
            { key: "open", label: "접수" },
            { key: "in_progress", label: "확인중" },
            { key: "resolved", label: "해결됨" },
            { key: "closed", label: "종료" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: filter === f.key ? "2px solid #1428A0" : "1px solid #e2e8f0",
                background: filter === f.key ? "#EEF2FF" : "#fff",
                color: filter === f.key ? "#1428A0" : "#64748B",
                fontWeight: filter === f.key ? 700 : 500,
                fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {/* 리스트 + 상세 2컬럼 */}
        <div className="bugs-layout" style={{ display: "grid", gridTemplateColumns: selectedBug ? "1fr 1fr" : "1fr", gap: 16 }}>
          {/* 버그 목록 */}
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>접수된 오류가 없습니다</div>
              </div>
            ) : (
              filtered.map(bug => {
                const cat = CATEGORY_MAP[bug.category] || CATEGORY_MAP.other;
                const sev = SEVERITY_MAP[bug.severity] || SEVERITY_MAP.medium;
                const st = STATUS_MAP[bug.status] || STATUS_MAP.open;
                const isSelected = selectedBug?.id === bug.id;

                return (
                  <div
                    key={bug.id}
                    onClick={() => setSelectedBug(bug)}
                    style={{
                      background: isSelected ? "#EEF2FF" : "#fff",
                      borderRadius: 14, padding: "16px 18px",
                      border: isSelected ? "2px solid #1428A0" : "1px solid #eef0f3",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      cursor: "pointer", marginBottom: 10,
                      transition: "all 0.15s",
                    }}
                  >
                    {/* 상단: 카테고리 + 심각도 + 상태 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: `${cat.color}15`, color: cat.color,
                      }}>{cat.emoji} {cat.label}</span>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: sev.bg, color: sev.color,
                      }}>{sev.label}</span>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: st.bg, color: st.color,
                      }}>{st.label}</span>
                      {bug.ai_priority && bug.ai_priority !== bug.severity && (
                        <span style={{
                          padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: "#F0F0FF", color: "#6366F1",
                        }}>🤖 AI: {SEVERITY_MAP[bug.ai_priority]?.label || bug.ai_priority}</span>
                      )}
                    </div>
                    {/* 제목 */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B", marginBottom: 6 }}>{bug.title}</div>
                    {/* 메타 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#94A3B8" }}>
                      <span>{bug.page_url || "—"}</span>
                      <span>{bug.reporter_email?.split("@")[0] || "—"}</span>
                      <span>{formatDate(bug.created_at)}</span>
                      {bug.screenshot_urls?.length > 0 && (
                        <span style={{ color: "#6366F1" }}>📷 {bug.screenshot_urls.length}</span>
                      )}
                    </div>
                    {/* AI 분석 미리보기 */}
                    {bug.ai_analysis && (
                      <div style={{
                        marginTop: 8, padding: "8px 10px", borderRadius: 8,
                        background: "#F8FAFC", fontSize: 12, color: "#475569",
                        borderLeft: "3px solid #6366F1",
                      }}>
                        🤖 {bug.ai_analysis.slice(0, 80)}{bug.ai_analysis.length > 80 ? "..." : ""}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 상세 패널 */}
          {selectedBug && (
            <div className="bugs-detail-panel" style={{
              background: "#fff", borderRadius: 16, padding: "24px",
              border: "1px solid #eef0f3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              position: "sticky", top: 100, maxHeight: "calc(100vh - 140px)", overflowY: "auto",
            }}>
              {/* 닫기 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B" }}>상세 정보</span>
                <button
                  onClick={() => setSelectedBug(null)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: "none",
                    background: "#f1f5f9", cursor: "pointer", fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>

              {/* 제목 */}
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", marginBottom: 12 }}>{selectedBug.title}</h2>

              {/* 뱃지 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {(() => {
                  const cat = CATEGORY_MAP[selectedBug.category] || CATEGORY_MAP.other;
                  const sev = SEVERITY_MAP[selectedBug.severity] || SEVERITY_MAP.medium;
                  return (
                    <>
                      <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: `${cat.color}15`, color: cat.color }}>{cat.emoji} {cat.label}</span>
                      <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: sev.bg, color: sev.color }}>{sev.label}</span>
                    </>
                  );
                })()}
              </div>

              {/* 상태 변경 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 6, display: "block" }}>상태 변경</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {STATUS_OPTIONS.map(s => {
                    const st = STATUS_MAP[s];
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedBug.id, s)}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 8,
                          border: selectedBug.status === s ? `2px solid ${st.color}` : "1px solid #e2e8f0",
                          background: selectedBug.status === s ? st.bg : "#fff",
                          color: selectedBug.status === s ? st.color : "#94A3B8",
                          fontWeight: selectedBug.status === s ? 700 : 500,
                          fontSize: 12, cursor: "pointer",
                        }}
                      >{st.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* 정보 필드 */}
              {[
                { label: "발생 페이지", value: selectedBug.page_url },
                { label: "제보자", value: selectedBug.reporter_email },
                { label: "제보일시", value: formatDate(selectedBug.created_at) },
                { label: "브라우저", value: selectedBug.user_agent?.split("(")[0]?.trim() },
                { label: "화면 크기", value: selectedBug.screen_size },
              ].map(f => f.value && (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: "#1e293b", wordBreak: "break-all" }}>{f.value}</div>
                </div>
              ))}

              {/* 설명 */}
              {selectedBug.description && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>상세 설명</div>
                  <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#F8FAFC", padding: "12px", borderRadius: 10 }}>
                    {selectedBug.description}
                  </div>
                </div>
              )}

              {/* 재현 방법 */}
              {selectedBug.steps_to_reproduce && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>재현 방법</div>
                  <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#F8FAFC", padding: "12px", borderRadius: 10 }}>
                    {selectedBug.steps_to_reproduce}
                  </div>
                </div>
              )}

              {/* 스크린샷 */}
              {selectedBug.screenshot_urls && selectedBug.screenshot_urls.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>📷 스크린샷</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedBug.screenshot_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{
                        width: 120, height: 90, borderRadius: 10, overflow: "hidden",
                        border: "1px solid #e2e8f0", display: "block", cursor: "zoom-in",
                      }}>
                        <img src={url} alt={`스크린샷 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 분석 */}
              {(selectedBug.ai_analysis || selectedBug.ai_suggestion) && (
                <div style={{
                  marginTop: 16, padding: "16px", borderRadius: 12,
                  background: "linear-gradient(135deg, #EEF2FF 0%, #F0F0FF 100%)",
                  border: "1px solid #C7D2FE",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4338CA", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    🤖 AI 분석 결과
                  </div>
                  {selectedBug.ai_analysis && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 2 }}>추정 원인</div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{selectedBug.ai_analysis}</div>
                    </div>
                  )}
                  {selectedBug.ai_suggestion && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 2 }}>수정 방향</div>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{selectedBug.ai_suggestion}</div>
                    </div>
                  )}
                  {selectedBug.ai_affected_files && selectedBug.ai_affected_files.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 4 }}>관련 파일</div>
                      {selectedBug.ai_affected_files.map((f, i) => (
                        <div key={i} style={{
                          fontSize: 12, color: "#4338CA", fontFamily: "'Outfit', monospace",
                          padding: "4px 8px", background: "rgba(99,102,241,0.1)", borderRadius: 6,
                          marginBottom: 3, wordBreak: "break-all",
                        }}>{f}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 토스트 */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
            padding: "10px 20px", borderRadius: 10,
            background: "#1A1D2B", color: "#fff",
            fontSize: 13, fontWeight: 700, zIndex: 10000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}>
            {toast}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .bugs-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bugs-layout { grid-template-columns: 1fr !important; }
          .bugs-detail-panel { position: static !important; max-height: none !important; }
        }
      `}</style>
    </AppLayout>
  );
}
