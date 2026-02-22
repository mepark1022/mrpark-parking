// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

const ratingLabels = ["", "매우 부족", "부족", "보통", "우수", "매우 우수"];
const ratingColors = ["", "#dc2626", "#ea580c", "#475569", "#1428A0", "#16a34a"];
const ratingBgs    = ["", "#fee2e2", "#fff7ed", "#f1f5f9", "#e0e8ff", "#dcfce7"];

const V3 = {
  card: { background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)", marginBottom: 12, overflow: "hidden" as const },
  sel:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#1a1d2b", background: "#fff", fontFamily: "inherit", appearance: "none" as const },
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" as const },
  inp:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" },
  btnNav:   { padding: "9px 18px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

const ITEMS = [
  { key: "punctuality", label: "출근 성실도" },
  { key: "attitude",    label: "근무 태도" },
  { key: "skill",       label: "업무 능력" },
  { key: "teamwork",    label: "협동심" },
];

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

  // 별점 컴포넌트
  const StarRating = ({ value, onChange }) => (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)}
          style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
            background: n <= value ? "#F5B731" : "#f1f5f9", color: n <= value ? "#fff" : "#94a3b8",
            fontSize: 14, fontWeight: 800 }}>{n}</button>
      ))}
    </div>
  );

  // 전체 평균 계산
  const avgScore = reviews.length > 0
    ? (reviews.reduce((s, r) => s + Number(r.average), 0) / reviews.length).toFixed(1)
    : null;

  // 별점 분포
  const dist = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => Math.round(Number(r.average)) === n).length }));

  return (
    <div>
      {/* 필터 */}
      <div style={{ marginBottom: 16 }}>
        <label style={V3.label}>근무자</label>
        <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={V3.sel}>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* 전체 평점 요약 */}
      {reviews.length > 0 && (
        <div style={{ ...V3.card, padding: "18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* 큰 숫자 */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 48, fontWeight: 900, color: "#1a1d2b", lineHeight: 1 }}>{avgScore}</div>
              <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 6 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ fontSize: 14, color: n <= Math.round(Number(avgScore)) ? "#F5B731" : "#e2e8f0" }}>★</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>총 {reviews.length}건</div>
            </div>
            {/* 분포 바 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              {dist.map(({ n, count }) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", width: 8 }}>{n}</span>
                  <div style={{ flex: 1, height: 7, background: "#f0f2f7", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "#F5B731", width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%" }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#94a3b8", width: 16, textAlign: "right" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2b" }}>⭐ 리뷰 목록 <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>({reviews.length}건)</span></div>
        <button onClick={() => setShowForm(true)} style={V3.btnNav}>+ 작성</button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <div style={{ ...V3.card, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>✏️ 근무 리뷰 작성</div>
          <div style={{ marginBottom: 12 }}>
            <label style={V3.label}>월 선택 *</label>
            <input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} style={{ ...V3.inp, width: "auto" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {ITEMS.map(item => (
              <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2b" }}>{item.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRating value={form[item.key]} onChange={v => setForm({ ...form, [item.key]: v })} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: ratingColors[form[item.key]], minWidth: 52, textAlign: "right" }}>{ratingLabels[form[item.key]]}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={V3.label}>코멘트</label>
            <textarea rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="종합 의견을 작성하세요..."
              style={{ ...V3.inp, resize: "vertical" as const }} />
          </div>
          {msg && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} style={V3.btnNav}>저장</button>
            <button onClick={() => { setShowForm(false); setMsg(""); }} style={V3.btnGhost}>취소</button>
          </div>
        </div>
      )}

      {/* 리뷰 카드 목록 */}
      {reviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>작성된 리뷰가 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map(r => {
            const avg = Number(r.average);
            const avgColor = avg >= 4.5 ? "#16a34a" : avg >= 3.5 ? "#1428A0" : avg >= 2.5 ? "#475569" : "#dc2626";
            return (
              <div key={r.id} style={V3.card}>
                <div style={{ padding: "14px 16px" }}>
                  {/* 카드 헤더 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: "#ecf0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⭐</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2b" }}>{r.month?.slice(0, 7)}</div>
                        <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                          {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 13, color: n <= Math.round(avg) ? "#F5B731" : "#e2e8f0" }}>★</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 22, fontWeight: 900, color: avgColor, lineHeight: 1 }}>{r.average}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>평균점수</div>
                    </div>
                  </div>

                  {/* 항목별 점수 바 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {ITEMS.map(item => {
                      const val = r[item.key];
                      return (
                        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#64748b", width: 60, flexShrink: 0 }}>{item.label}</span>
                          <div style={{ flex: 1, height: 6, background: "#f0f2f7", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(val / 5) * 100}%`, borderRadius: 3, background: "#F5B731" }} />
                          </div>
                          <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: 800, color: ratingColors[val], width: 18, textAlign: "right" }}>{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 코멘트 */}
                  {r.comment && (
                    <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", lineHeight: 1.65, marginBottom: 10 }}>
                      {r.comment}
                    </div>
                  )}

                  {/* 삭제 버튼 */}
                  <button onClick={() => deleteReview(r.id)}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    🗑 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
