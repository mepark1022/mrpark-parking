// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";

/* ── 모바일 반응형 스타일 ── */
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
  .accident-empty-state {
    padding: 64px 24px;
  }
  .accident-list-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid var(--border-light, #eef0f3);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.04));
    overflow: hidden;
    margin-bottom: 12px;
  }
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
    .accident-kpi-card .kpi-value {
      font-size: 22px !important;
    }
    .accident-kpi-card .kpi-title {
      font-size: 14px !important;
      margin-bottom: 0 !important;
    }
    .accident-form-card {
      padding: 20px 16px;
      border-radius: 14px;
    }
    .accident-empty-state {
      padding: 40px 20px;
    }
    .accident-empty-state .empty-icon {
      font-size: 40px !important;
      margin-bottom: 12px !important;
    }
    .accident-empty-state .empty-title {
      font-size: 15px !important;
    }
    .accident-list-table { display: none; }
    .accident-list-mobile { display: flex; flex-direction: column; gap: 12px; }
    .accident-mode-toggle {
      width: 100% !important;
      display: flex !important;
    }
    .accident-mode-toggle button {
      flex: 1;
      text-align: center;
    }
  }
`;

/* ── 더미 목록 데이터 (DB 연동 전 샘플) ── */
const SAMPLE_ACCIDENTS = [
  { id: 1, date: "2026-02-18", store: "강서점", type: "접촉사고", vehicle: "12가 3456", reporter: "김민수", status: "처리중" },
  { id: 2, date: "2026-02-10", store: "인천본점", type: "차량손상", vehicle: "34나 7890", reporter: "박준영", status: "완료" },
];

const STATUS_STYLE = {
  "처리중": { bg: "#fffbeb", color: "#f59e0b" },
  "완료":   { bg: "#ecfdf5", color: "#10b981" },
  "접수":   { bg: "#eff6ff", color: "#3b82f6" },
};

export default function AccidentPage() {
  const [mode, setMode] = useState("list");
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    store: "", reporter: "", datetime: "", vehicle: "", phone: "", detail: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => { loadStores(); }, []);

  const loadStores = async () => {
    const supabase = createClient();
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    let query = supabase.from("stores").select("id, name").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) query = query.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const { data } = await query;
    if (data) setStores(data);
  };

  const handleSubmit = () => {
    if (!form.store || !form.reporter || !form.vehicle) {
      setMessage("매장, 보고자, 차량번호는 필수입니다");
      return;
    }
    setMessage("사고보고가 전송되었습니다! (DB 연동 예정)");
    setTimeout(() => setMessage(""), 3000);
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
    background: "#fff", outline: "none",
  };
  const labelStyle = { fontSize: 14, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 6 };

  return (
    <AppLayout>
      <style>{styles}</style>
      <div className="max-w-6xl mx-auto">

        {/* ── 모드 토글 ── */}
        <div className="accident-mode-toggle mb-6"
          style={{ display: "inline-flex", gap: 4, padding: 4, background: "#f4f5f7", borderRadius: 12 }}>
          {[["list", "📋 보고 목록"], ["report", "🚨 새 보고"]].map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v); setMessage(""); }}
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
              {[
                { title: "이번 달 사고", value: `${SAMPLE_ACCIDENTS.length}건`, color: "#dc2626", bg: "#fef2f2", icon: "🚨" },
                { title: "처리중",       value: `${SAMPLE_ACCIDENTS.filter(a => a.status === "처리중").length}건`, color: "#f59e0b", bg: "#fffbeb", icon: "⏳" },
                { title: "완료",         value: `${SAMPLE_ACCIDENTS.filter(a => a.status === "완료").length}건`, color: "#10b981", bg: "#ecfdf5", icon: "✅" },
              ].map((k, i) => (
                <div key={i} className="accident-kpi-card"
                  style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                  <div>
                    <div className="kpi-title" style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>
                      {k.icon} {k.title}
                    </div>
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

            {SAMPLE_ACCIDENTS.length === 0 ? (
              /* 빈 상태 */
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
                          {["보고일", "매장", "유형", "차량번호", "보고자", "상태"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#5c6370", borderBottom: "1px solid #eef0f3" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_ACCIDENTS.map(a => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #eef0f3" }}>
                            <td style={{ padding: "14px 16px", fontSize: 14 }}>{a.date}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>{a.store}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14 }}>{a.type}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700 }}>{a.vehicle}</td>
                            <td style={{ padding: "14px 16px", fontSize: 14 }}>{a.reporter}</td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color }}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 모바일: 카드형 */}
                <div className="accident-list-mobile">
                  {SAMPLE_ACCIDENTS.map(a => (
                    <div key={a.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #eef0f3", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                      {/* 카드 헤더 */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1d26", marginBottom: 4 }}>{a.vehicle}</div>
                          <div style={{ fontSize: 13, color: "#5c6370" }}>{a.store} · {a.type}</div>
                        </div>
                        <span style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color }}>
                          {a.status}
                        </span>
                      </div>
                      {/* 카드 하단 */}
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #eef0f3" }}>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          <span style={{ fontWeight: 600, color: "#5c6370" }}>보고자</span> {a.reporter}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>{a.date}</div>
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

            {[
              { key: "store", label: "매장명 *", type: "select" },
              { key: "reporter", label: "보고자 *", placeholder: "보고자 이름" },
              { key: "datetime", label: "사고 일시", type: "datetime-local" },
              { key: "vehicle", label: "사고 차량번호 *", placeholder: "예: 12가 3456" },
              { key: "phone", label: "차주 연락처", placeholder: "010-0000-0000", type: "tel" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{f.label}</label>
                {f.type === "select" ? (
                  <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputStyle}>
                    <option value="">매장 선택</option>
                    {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <input type={f.type || "text"} value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} style={inputStyle} />
                )}
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>사고 상세내용</label>
              <textarea rows={4} value={form.detail}
                onChange={e => setForm({ ...form, detail: e.target.value })}
                placeholder="사고 상황을 상세히 입력해주세요..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <button onClick={handleSubmit} className="w-full cursor-pointer"
              style={{ padding: "14px", borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 800, width: "100%", boxShadow: "0 4px 12px rgba(220,38,38,.3)" }}>
              🚨 본사로 사고보고 전송
            </button>

            {message && (
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 14, fontWeight: 700, color: message.includes("전송") ? "#16a34a" : "#dc2626" }}>
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
