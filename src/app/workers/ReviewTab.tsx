// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

const ratingLabels = ["", "매우 부족", "부족", "보통", "우수", "매우 우수"];
const ratingColors = ["", "#dc2626", "#ea580c", "#475569", "#1428A0", "#16a34a"];

export default function ReviewTab() {
  const [workers, setWorkers] = useState([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [reviews, setReviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ month: "", punctuality: 3, attitude: 3, skill: 3, teamwork: 3, comment: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { getOrgId().then(oid => { if (oid) setOrgId(oid); }); }, []);
  useEffect(() => { if (orgId) loadWorkers(); }, [orgId]);
  useEffect(() => { if (selectedWorker) loadReviews(); }, [selectedWorker]);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name").eq("org_id", orgId).eq("status", "active").order("name");
    if (data) { setWorkers(data); if (data.length > 0) setSelectedWorker(data[0].id); }
  };

  const loadReviews = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_reviews").select("*").eq("worker_id", selectedWorker).order("month", { ascending: false });
    if (data) setReviews(data);
  };

  const handleSave = async () => {
    if (!form.month) { setMsg("월을 선택하세요"); return; }
    const supabase = createClient();
    const avg = ((Number(form.punctuality) + Number(form.attitude) + Number(form.skill) + Number(form.teamwork)) / 4).toFixed(1);
    await supabase.from("worker_reviews").insert({ org_id: orgId,
      worker_id: selectedWorker, month: form.month + "-01",
      punctuality: form.punctuality, attitude: form.attitude,
      skill: form.skill, teamwork: form.teamwork,
      average: avg, comment: form.comment || null,
    });
    setShowForm(false);
    setForm({ month: "", punctuality: 3, attitude: 3, skill: 3, teamwork: 3, comment: "" });
    setMsg("");
    loadReviews();
  };

  const deleteReview = async (id) => {
    const supabase = createClient();
    await supabase.from("worker_reviews").delete().eq("id", id);
    loadReviews();
  };

  const StarRating = ({ value, onChange }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} className="cursor-pointer" style={{
          width: 28, height: 28, borderRadius: 6, border: "none",
          background: n <= value ? "#F5B731" : "#f1f5f9",
          color: n <= value ? "#fff" : "#94a3b8",
          fontSize: 14, fontWeight: 700,
        }}>{n}</button>
      ))}
    </div>
  );

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
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무 리뷰 ({reviews.length}건)</div>
          <button onClick={() => setShowForm(true)} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 리뷰 작성</button>
        </div>

        {showForm && (
          <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>근무 리뷰 작성</div>
            <div className="mb-4">
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>월 선택 *</label>
              <input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: "punctuality", label: "출근 성실도" },
                { key: "attitude", label: "근무 태도" },
                { key: "skill", label: "업무 능력" },
                { key: "teamwork", label: "협동심" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between" style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{item.label}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={form[item.key]} onChange={v => setForm({ ...form, [item.key]: v })} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: ratingColors[form[item.key]], minWidth: 60, textAlign: "right" }}>{ratingLabels[form[item.key]]}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>코멘트</label>
              <textarea rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="종합 의견을 작성하세요..." className="w-full"
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical" }} />
            </div>
            {msg && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{msg}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>저장</button>
              <button onClick={() => { setShowForm(false); setMsg(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>작성된 리뷰가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} style={{ padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{r.month?.slice(0, 7)}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 8, background: "#F5B73120", color: "#b45309", fontSize: 13, fontWeight: 800 }}>평균 {r.average}점</span>
                  </div>
                  <button onClick={() => deleteReview(r.id)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600 }}>삭제</button>
                </div>
                <div className="flex gap-4 mb-2">
                  {[
                    { label: "출근", val: r.punctuality },
                    { label: "태도", val: r.attitude },
                    { label: "능력", val: r.skill },
                    { label: "협동", val: r.teamwork },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ratingColors[item.val] }}>{item.val}</span>
                    </div>
                  ))}
                </div>
                {r.comment && <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}