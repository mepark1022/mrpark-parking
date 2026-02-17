// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const severityMap = {
  minor: { label: "경미", bg: "#fff7ed", color: "#ea580c" },
  major: { label: "중대", bg: "#fee2e2", color: "#dc2626" },
  critical: { label: "심각", bg: "#fce7f3", color: "#be185d" },
};

export default function ReportTab() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", severity: "minor", title: "", content: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { loadWorkers(); }, []);
  useEffect(() => { if (selectedWorker) loadReports(); }, [selectedWorker]);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
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
    await supabase.from("worker_reports").insert({
      worker_id: selectedWorker, date: form.date,
      severity: form.severity, title: form.title,
      content: form.content || null,
    });
    setShowForm(false);
    setForm({ date: "", severity: "minor", title: "", content: "" });
    setMsg("");
    loadReports();
  };

  const deleteReport = async (id) => {
    const supabase = createClient();
    await supabase.from("worker_reports").delete().eq("id", id);
    loadReports();
  };

  return (
    <div>
      <div className="flex gap-4 mb-5">
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>근무자</label>
          <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 160 }}>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
        <div className="flex justify-between items-center mb-5">
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>시말서 ({reports.length}건)</div>
          <button onClick={() => setShowForm(true)} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 시말서 작성</button>
        </div>

        {showForm && (
          <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>시말서 작성</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>날짜 *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>심각도</label>
                <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                  {Object.entries(severityMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>제목 *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="시말서 제목" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>상세 내용</label>
              <textarea rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="사건 경위 및 재발 방지 대책을 기술하세요..." className="w-full"
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical" }} />
            </div>
            {msg && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{msg}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700 }}>제출</button>
              <button onClick={() => { setShowForm(false); setMsg(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
            </div>
          </div>
        )}

        {reports.length === 0 ? (
          <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>작성된 시말서가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} style={{ padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{r.title}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: severityMap[r.severity]?.bg, color: severityMap[r.severity]?.color }}>{severityMap[r.severity]?.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.date}</span>
                    <button onClick={() => deleteReport(r.id)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600 }}>삭제</button>
                  </div>
                </div>
                {r.content && <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{r.content}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}