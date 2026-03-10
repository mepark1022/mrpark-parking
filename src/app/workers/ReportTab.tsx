// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";

const severityMap = {
  minor:    { label: "경미", bg: "#fff7ed", color: "#ea580c", border: "#EA580C" },
  major:    { label: "중대", bg: "#fee2e2", color: "#dc2626", border: "#DC2626" },
  critical: { label: "심각", bg: "#fce7f3", color: "#be185d", border: "#be185d" },
};

const statusMap = {
  pending:  { label: "확인필요", bg: "#fff7ed", color: "#EA580C" },
  progress: { label: "처리중",  bg: "#fef3c7", color: "#b45309" },
  done:     { label: "완료",    bg: "#dcfce7", color: "#16A34A" },
};

const V3 = {
  card: { background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)", marginBottom: 10, overflow: "hidden" as const },
  sel:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#1a1d2b", background: "#fff", fontFamily: "inherit", appearance: "none" as const },
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" as const },
  inp:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" },
  btnNav:   { padding: "9px 18px", borderRadius: 10, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

export default function ReportTab() {
  const [workers, setWorkers] = useState([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", severity: "minor", title: "", content: "", status: "pending" });
  const [msg, setMsg] = useState("");

  useEffect(() => { getOrgId().then(oid => { if (oid) setOrgId(oid); }); }, []);
  useEffect(() => { if (orgId) loadWorkers(); }, [orgId]);
  useEffect(() => { if (selectedWorker) loadReports(); }, [selectedWorker]);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name").eq("org_id", orgId).eq("status", "active").order("name");
    if (data) { setWorkers(data); if (data.length > 0) setSelectedWorker(data[0].id); }
  };

  const loadReports = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_reports").select("*").eq("worker_id", selectedWorker).order("date", { ascending: false });
    if (data) setReports(data);
  };

  const handleSave = async () => {
    if (!form.date || !form.title) { setMsg("날짜와 제목을 입력하세요"); return; }
    const supabase = createClient();
    await supabase.from("worker_reports").insert({ org_id: orgId,
      worker_id: selectedWorker, date: form.date,
      severity: form.severity, title: form.title,
      content: form.content || null,
    });
    setShowForm(false);
    setForm({ date: "", severity: "minor", title: "", content: "", status: "pending" });
    setMsg("");
    loadReports();
  };

  const deleteReport = async (id) => {
    const supabase = createClient();
    await supabase.from("worker_reports").delete().eq("id", id);
    loadReports();
  };

  // 상태별 카운트
  const total   = reports.length;
  const pending = reports.filter(r => !r.status || r.status === "pending").length;
  const done    = reports.filter(r => r.status === "done").length;

  return (
    <div>
      {/* 필터 */}
      <div style={{ marginBottom: 16 }}>
        <label style={V3.label}>근무자</label>
        <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={V3.sel}>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* 요약 3분할 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { val: total,   lbl: "전체",  color: "#DC2626", bg: "#fef2f2" },
          { val: pending, lbl: "처리중", color: "#EA580C", bg: "#fff7ed" },
          { val: done,    lbl: "완료",  color: "#16A34A", bg: "#dcfce7" },
        ].map(item => (
          <div key={item.lbl} style={{ background: item.bg, borderRadius: 16, padding: "14px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 26, fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 4 }}>{item.val}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: item.color, opacity: 0.8 }}>{item.lbl}</div>
          </div>
        ))}
      </div>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2b" }}>📄 시말서 목록 <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>({total}건)</span></div>
        <button onClick={() => setShowForm(true)} style={V3.btnNav}>+ 작성</button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <div style={{ ...V3.card, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📝 시말서 작성</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={V3.label}>날짜 *</label>
              <MeParkDatePicker value={form.date} onChange={v => setForm({ ...form, date: v })} compact style={{ width: "100%" }} />
            </div>
            <div>
              <label style={V3.label}>심각도</label>
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={V3.sel}>
                {Object.entries(severityMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={V3.label}>제목 *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="시말서 제목" style={V3.inp} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={V3.label}>상세 내용</label>
            <textarea rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="사건 경위 및 재발 방지 대책을 기술하세요..."
              style={{ ...V3.inp, resize: "vertical" as const }} />
          </div>
          {msg && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={V3.btnNav}>제출</button>
            <button onClick={() => { setShowForm(false); setMsg(""); }} style={V3.btnGhost}>취소</button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>작성된 시말서가 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reports.map(r => {
            const sv = severityMap[r.severity] || severityMap.minor;
            const st = statusMap[r.status] || statusMap.pending;
            const isDone = r.status === "done";
            return (
              <div key={r.id} style={{ ...V3.card, borderLeft: `3.5px solid ${sv.border}`, opacity: isDone ? 0.82 : 1 }}>
                <div style={{ padding: "14px 16px" }}>
                  {/* 카드 헤더 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: sv.bg, color: sv.color }}>{sv.label}</span>
                      <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>📅 {r.date}</span>
                  </div>

                  {/* 제목 */}
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b", marginBottom: 8 }}>{r.title}</div>

                  {/* 내용 */}
                  {r.content && (
                    <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", lineHeight: 1.65, marginBottom: 10 }}>
                      {r.content}
                    </div>
                  )}

                  {/* 액션 */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => deleteReport(r.id)}
                      style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      🗑 삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
