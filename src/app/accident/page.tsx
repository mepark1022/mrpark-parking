// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";

/* ── 반응형 스타일 ── */
const styles = `
  .accident-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .accident-form-card {
    background: #fff;
    border-radius: 16px;
    padding: 32px;
    border: 1px solid var(--border-light, #eef0f3);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.04));
    max-width: 640px;
  }
  .accident-empty-state { padding: 64px 24px; }
  .accident-list-table { display: block; }
  .accident-list-mobile { display: none; }

  @media (max-width: 767px) {
    .accident-kpi-grid {
      grid-template-columns: 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .accident-kpi-card {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px !important;
    }
    .accident-kpi-card .kpi-value { font-size: 22px !important; }
    .accident-kpi-card .kpi-title { font-size: 14px !important; margin-bottom: 0 !important; }
    .accident-form-card { padding: 20px 16px; border-radius: 14px; }
    .accident-empty-state { padding: 40px 20px; }
    .accident-empty-state .empty-icon { font-size: 40px !important; margin-bottom: 12px !important; }
    .accident-empty-state .empty-title { font-size: 15px !important; }
    .accident-list-table { display: none; }
    .accident-list-mobile { display: flex; flex-direction: column; gap: 12px; }
    .accident-mode-toggle { width: 100% !important; display: flex !important; }
    .accident-mode-toggle button { flex: 1; text-align: center; }
  }
`;

const STATUS_STYLE = {
  "접수":   { bg: "#eff6ff", color: "#3b82f6" },
  "처리중": { bg: "#fffbeb", color: "#f59e0b" },
  "완료":   { bg: "#ecfdf5", color: "#10b981" },
};

const ACCIDENT_TYPES = ["접촉사고", "차량손상", "분실사고", "인명사고", "기물파손", "기타"];

export default function AccidentPage() {
  const [mode, setMode] = useState<"list" | "report" | "detail">("list");
  const [accidents, setAccidents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    store_id: "", reporter: "", accident_at: "", vehicle: "", phone: "",
    accident_type: "접촉사고", detail: "", status: "접수",
  });
  const [ctx, setCtx] = useState<any>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const c = await getUserContext();
    setCtx(c);
    await Promise.all([loadStores(c), loadAccidents(c)]);
    setLoading(false);
  };

  const loadStores = async (c: any) => {
    const supabase = createClient();
    if (!c?.orgId) return;
    let q = supabase.from("stores").select("id, name").eq("org_id", c.orgId).eq("is_active", true).order("name");
    if (!c.allStores && c.storeIds?.length > 0) q = q.in("id", c.storeIds);
    else if (!c.allStores) { setStores([]); return; }
    const { data } = await q;
    if (data) setStores(data);
  };

  const loadAccidents = async (c: any) => {
    const supabase = createClient();
    if (!c?.orgId) return;
    let q = supabase
      .from("accident_reports")
      .select("*, stores(name)")
      .eq("org_id", c.orgId)
      .order("accident_at", { ascending: false });
    if (!c.allStores && c.storeIds?.length > 0) q = q.in("store_id", c.storeIds);
    const { data, error } = await q;
    if (data) setAccidents(data);
  };

  const handleSubmit = async () => {
    if (!form.store_id || !form.reporter || !form.vehicle) {
      setMessage("매장, 보고자, 차량번호는 필수입니다");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports").insert({
      org_id: ctx.orgId,
      store_id: form.store_id,
      reporter: form.reporter.trim(),
      accident_at: form.accident_at || new Date().toISOString(),
      vehicle: form.vehicle.trim(),
      phone: form.phone.trim() || null,
      accident_type: form.accident_type,
      detail: form.detail.trim() || null,
      status: "접수",
      reported_by: ctx.userId,
    });
    setSaving(false);
    if (error) { setMessage("저장 실패: " + error.message); return; }
    setMessage("사고보고가 등록되었습니다!");
    setForm({ store_id: "", reporter: "", accident_at: "", vehicle: "", phone: "", accident_type: "접촉사고", detail: "", status: "접수" });
    await loadAccidents(ctx);
    setTimeout(() => { setMessage(""); setMode("list"); }, 1500);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("accident_reports")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId);
    if (!error) {
      setAccidents(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      if (selected?.id === id) setSelected(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 사고보고를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports").delete().eq("id", id).eq("org_id", ctx.orgId);
    if (!error) {
      setAccidents(prev => prev.filter(a => a.id !== id));
      if (selected?.id === id) { setSelected(null); setMode("list"); }
    }
  };

  const openDetail = (a: any) => { setSelected(a); setMode("detail"); };

  /* KPI 계산 */
  const now = new Date();
  const thisMonth = accidents.filter(a => {
    const d = new Date(a.accident_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const kpi = [
    { title: "이번 달 사고", value: `${thisMonth.length}건`, color: "#dc2626", bg: "#fef2f2", icon: "🚨" },
    { title: "처리중", value: `${accidents.filter(a => a.status === "처리중").length}건`, color: "#f59e0b", bg: "#fffbeb", icon: "⏳" },
    { title: "완료", value: `${accidents.filter(a => a.status === "완료").length}건`, color: "#10b981", bg: "#ecfdf5", icon: "✅" },
  ];

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
    background: "#fff", outline: "none", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: 14, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 6 } as const;

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return <AppLayout><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, fontSize: 15, color: "#94a3b8" }}>데이터 불러오는 중...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <style>{styles}</style>
      <div className="max-w-6xl mx-auto">

        {/* ── 모드 토글 ── */}
        <div className="accident-mode-toggle mb-6"
          style={{ display: "inline-flex", gap: 4, padding: 4, background: "#f4f5f7", borderRadius: 12 }}>
          {([["list", "📋 보고 목록"], ["report", "🚨 새 보고"]] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v as any); setMessage(""); setSelected(null); }}
              className="cursor-pointer"
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600,
                background: mode === v ? "#fff" : "transparent",
                color: mode === v ? "#1a1d26" : "#5c6370",
                boxShadow: mode === v ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                transition: "all .2s",
              }}>{l}</button>
          ))}
        </div>

        {/* ── 목록 뷰 ── */}
        {mode === "list" && (
          <>
            {/* KPI */}
            <div className="accident-kpi-grid">
              {kpi.map((k, i) => (
                <div key={i} className="accident-kpi-card"
                  style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                  <div>
                    <div className="kpi-title" style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>{k.icon} {k.title}</div>
                    <div className="kpi-value" style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 목록 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26" }}>사고 보고 목록</div>
              <button onClick={() => setMode("report")} className="cursor-pointer"
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                + 새 보고
              </button>
            </div>

            {accidents.length === 0 ? (
              <div className="accident-empty-state" style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", textAlign: "center" }}>
                <div className="empty-icon" style={{ fontSize: 56, marginBottom: 16 }}>🚨</div>
                <div className="empty-title" style={{ fontSize: 18, fontWeight: 700, color: "#1a1d26", marginBottom: 8 }}>사고보고 내역이 없습니다</div>
                <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>새 보고를 작성하면 여기에 표시됩니다</div>
                <button onClick={() => setMode("report")} className="cursor-pointer"
                  style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 15, fontWeight: 700 }}>
                  새 사고보고 작성
                </button>
              </div>
            ) : (
              <>
                {/* PC: 테이블 */}
                <div className="accident-list-table">
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eef0f3", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8f9fb" }}>
                          {["보고일시", "매장", "유형", "차량번호", "보고자", "상태", "관리"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#5c6370", borderBottom: "1px solid #eef0f3" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {accidents.map(a => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #eef0f3" }}>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "#5c6370" }}>{formatDate(a.accident_at)}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>{a.stores?.name || "-"}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14 }}>{a.accident_type}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700 }}>{a.vehicle}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14 }}>{a.reporter}</td>
                            <td style={{ padding: "14px 16px" }}>
                              <select
                                value={a.status}
                                onChange={e => handleStatusChange(a.id, e.target.value)}
                                className="cursor-pointer"
                                style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "1px solid #e2e8f0",
                                  background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color }}>
                                {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => openDetail(a)} className="cursor-pointer"
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                                  상세
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="cursor-pointer"
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fef2f2", fontSize: 12, fontWeight: 600, color: "#dc2626" }}>
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 모바일: 카드형 */}
                <div className="accident-list-mobile">
                  {accidents.map(a => (
                    <div key={a.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #eef0f3", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1d26", marginBottom: 4 }}>{a.vehicle}</div>
                          <div style={{ fontSize: 13, color: "#5c6370" }}>{a.stores?.name || "-"} · {a.accident_type}</div>
                        </div>
                        <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)} className="cursor-pointer"
                          style={{ padding: "5px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #e2e8f0",
                            background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color }}>
                          {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {a.detail && <div style={{ fontSize: 13, color: "#5c6370", marginBottom: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>{a.detail.slice(0, 60)}{a.detail.length > 60 ? "..." : ""}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #eef0f3" }}>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          <span style={{ fontWeight: 600, color: "#5c6370" }}>보고자</span> {a.reporter}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openDetail(a)} className="cursor-pointer"
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600 }}>상세</button>
                          <button onClick={() => handleDelete(a.id)} className="cursor-pointer"
                            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600 }}>삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── 새 보고 폼 ── */}
        {mode === "report" && (
          <div className="accident-form-card">
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1d26", marginBottom: 24 }}>🚨 새 사고보고 작성</div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>매장 *</label>
              <select value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })} style={inputStyle}>
                <option value="">매장 선택</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>사고 유형</label>
              <select value={form.accident_type} onChange={e => setForm({ ...form, accident_type: e.target.value })} style={inputStyle}>
                {ACCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {[
              { key: "reporter", label: "보고자 *", placeholder: "보고자 이름" },
              { key: "accident_at", label: "사고 일시", type: "datetime-local" },
              { key: "vehicle", label: "사고 차량번호 *", placeholder: "예: 12가 3456" },
              { key: "phone", label: "차주 연락처", placeholder: "010-0000-0000", type: "tel" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type={f.type || "text"} value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>사고 상세내용</label>
              <textarea rows={4} value={form.detail}
                onChange={e => setForm({ ...form, detail: e.target.value })}
                placeholder="사고 상황을 상세히 입력해주세요..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <button onClick={handleSubmit} disabled={saving} className="cursor-pointer"
              style={{ padding: "14px", borderRadius: 12, border: "none", background: saving ? "#94a3b8" : "#dc2626", color: "#fff", fontSize: 16, fontWeight: 800, width: "100%", boxShadow: saving ? "none" : "0 4px 12px rgba(220,38,38,.3)" }}>
              {saving ? "저장 중..." : "🚨 사고보고 등록"}
            </button>

            {message && (
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 14, fontWeight: 700, color: message.includes("등록") ? "#16a34a" : "#dc2626" }}>
                {message}
              </p>
            )}
          </div>
        )}

        {/* ── 상세 뷰 ── */}
        {mode === "detail" && selected && (
          <div className="accident-form-card" style={{ maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1d26" }}>📋 사고보고 상세</div>
              <button onClick={() => setMode("list")} className="cursor-pointer"
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600 }}>← 목록</button>
            </div>

            {[
              { label: "매장", value: selected.stores?.name || "-" },
              { label: "사고 유형", value: selected.accident_type },
              { label: "차량번호", value: selected.vehicle },
              { label: "차주 연락처", value: selected.phone || "-" },
              { label: "보고자", value: selected.reporter },
              { label: "사고 일시", value: formatDate(selected.accident_at) },
              { label: "등록 일시", value: formatDate(selected.created_at) },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 110, fontSize: 13, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>{row.label}</div>
                <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{row.value}</div>
              </div>
            ))}

            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>상태</div>
              <select value={selected.status} onChange={e => handleStatusChange(selected.id, e.target.value)} className="cursor-pointer"
                style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "1px solid #e2e8f0",
                  background: STATUS_STYLE[selected.status]?.bg, color: STATUS_STYLE[selected.status]?.color }}>
                {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {selected.detail && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>사고 상세내용</div>
                <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.7, padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>{selected.detail}</div>
              </div>
            )}

            <button onClick={() => handleDelete(selected.id)} className="cursor-pointer"
              style={{ padding: "12px", borderRadius: 10, border: "none", background: "#fef2f2", color: "#dc2626", fontSize: 14, fontWeight: 700, width: "100%" }}>
              🗑 이 보고서 삭제
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
