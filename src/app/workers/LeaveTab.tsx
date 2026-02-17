// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const leaveTypeMap = {
  annual: { label: "연차", bg: "#ede9fe", color: "#7c3aed" },
  half: { label: "반차", bg: "#fef3c7", color: "#b45309" },
  sick: { label: "병가", bg: "#fee2e2", color: "#dc2626" },
  special: { label: "특별", bg: "#e0f2fe", color: "#0284c7" },
};

const statusColors = {
  pending: { label: "대기", bg: "#fff7ed", color: "#ea580c" },
  approved: { label: "승인", bg: "#dcfce7", color: "#15803d" },
  rejected: { label: "반려", bg: "#fee2e2", color: "#dc2626" },
};

export default function LeaveTab() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [leaveInfo, setLeaveInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", days: 1, leave_type: "annual", reason: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { loadWorkers(); }, []);
  useEffect(() => { if (selectedWorker) { loadLeaveInfo(); loadRecords(); } }, [selectedWorker, year]);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
    if (data) { setWorkers(data); if (data.length > 0) setSelectedWorker(data[0].id); }
  };

  const loadLeaveInfo = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_leaves").select("*").eq("worker_id", selectedWorker).eq("year", year).single();
    if (data) setLeaveInfo(data);
    else {
      // 자동 생성
      const { data: created } = await supabase.from("worker_leaves").insert({ worker_id: selectedWorker, year, total_days: 15, used_days: 0 }).select().single();
      setLeaveInfo(created);
    }
  };

  const loadRecords = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_leave_records").select("*").eq("worker_id", selectedWorker).gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).order("start_date", { ascending: false });
    if (data) setRecords(data);
  };

  const updateTotalDays = async (val) => {
    if (!leaveInfo) return;
    const supabase = createClient();
    await supabase.from("worker_leaves").update({ total_days: Number(val), updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    loadLeaveInfo();
  };

  const addRecord = async () => {
    if (!form.start_date || !form.end_date) { setMsg("날짜를 입력하세요"); return; }
    const supabase = createClient();
    await supabase.from("worker_leave_records").insert({
      worker_id: selectedWorker, start_date: form.start_date, end_date: form.end_date,
      days: Number(form.days) || 1, leave_type: form.leave_type, reason: form.reason || null, status: "approved",
    });
    // used_days 업데이트
    const newUsed = (leaveInfo?.used_days || 0) + (Number(form.days) || 1);
    await supabase.from("worker_leaves").update({ used_days: newUsed, updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    setShowForm(false);
    setForm({ start_date: "", end_date: "", days: 1, leave_type: "annual", reason: "" });
    setMsg("");
    loadLeaveInfo();
    loadRecords();
  };

  const deleteRecord = async (record) => {
    const supabase = createClient();
    await supabase.from("worker_leave_records").delete().eq("id", record.id);
    const newUsed = Math.max(0, (leaveInfo?.used_days || 0) - (record.days || 0));
    await supabase.from("worker_leaves").update({ used_days: newUsed, updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    loadLeaveInfo();
    loadRecords();
  };

  const total = leaveInfo?.total_days || 15;
  const used = leaveInfo?.used_days || 0;
  const remaining = total - used;
  const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div>
      {/* 필터 */}
      <div className="flex gap-4 mb-5">
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>근무자</label>
          <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 160 }}>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>연도</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </div>

      {/* 연차 현황 카드 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 20 }}>
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>연차 현황</div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, color: "#475569" }}>총 연차:</span>
            <input type="number" value={total} onChange={e => updateTotalDays(e.target.value)} min="0" step="0.5"
              style={{ width: 70, padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, textAlign: "center" }} />
            <span style={{ fontSize: 13, color: "#475569" }}>일</span>
          </div>
        </div>

        {/* 프로그레스 바 */}
        <div style={{ background: "#f1f5f9", borderRadius: 10, height: 32, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${usedPercent}%`, height: "100%", background: remaining > 3 ? "linear-gradient(90deg, #7c3aed, #a78bfa)" : remaining > 0 ? "linear-gradient(90deg, #ea580c, #fb923c)" : "linear-gradient(90deg, #dc2626, #f87171)", borderRadius: 10, transition: "width 0.3s", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {usedPercent > 15 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{used}일 사용</span>}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#7c3aed" }} />
            <span style={{ fontSize: 13, color: "#475569" }}>사용: <strong style={{ color: "#7c3aed" }}>{used}일</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#16a34a" }} />
            <span style={{ fontSize: 13, color: "#475569" }}>잔여: <strong style={{ color: "#16a34a" }}>{remaining}일</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#94a3b8" }} />
            <span style={{ fontSize: 13, color: "#475569" }}>총: <strong>{total}일</strong></span>
          </div>
        </div>
      </div>

      {/* 연차 사용 기록 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>사용 기록 ({records.length}건)</div>
          <button onClick={() => setShowForm(true)} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 연차 등록</button>
        </div>

        {showForm && (
          <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>연차 등록</div>
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>시작일 *</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
              <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>종료일 *</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
              <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>일수</label>
                <input type="number" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} min="0.5" step="0.5" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
              <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>유형</label>
                <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                  {Object.entries(leaveTypeMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>사유</label>
                <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="사유" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
            </div>
            {msg && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{msg}</p>}
            <div className="flex gap-2">
              <button onClick={addRecord} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 700 }}>등록</button>
              <button onClick={() => { setShowForm(false); setMsg(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
            </div>
          </div>
        )}

        {records.length === 0 ? (
          <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>연차 사용 기록이 없습니다</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
            <thead><tr>{["기간", "일수", "유형", "상태", "사유", "관리"].map(h => (
              <th key={h} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
            <tbody>{records.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{r.start_date} ~ {r.end_date}</td>
                <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{r.days}일</td>
                <td style={{ padding: "10px 12px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: leaveTypeMap[r.leave_type]?.bg, color: leaveTypeMap[r.leave_type]?.color }}>{leaveTypeMap[r.leave_type]?.label}</span></td>
                <td style={{ padding: "10px 12px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: statusColors[r.status]?.bg, color: statusColors[r.status]?.color }}>{statusColors[r.status]?.label}</span></td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: "#475569" }}>{r.reason || "-"}</td>
                <td style={{ padding: "10px 12px" }}><button onClick={() => deleteRecord(r)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600 }}>삭제</button></td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

---

### 수정: `src/app/workers/page.tsx`

파일 상단에 import 추가. **Ctrl+H**:

**찾기:**
```
import { createClient } from "@/lib/supabase/client";
```

**바꾸기:**
```
import { createClient } from "@/lib/supabase/client";
import LeaveTab from "./LeaveTab";
```

그리고 연차 탭 연결. **Ctrl+H**:

**찾기:**
```
        {!["attendance", "roster", "schedule"].includes(tab) && (
```

**바꾸기:**
```
        {tab === "leave" && <LeaveTab />}

        {!["attendance", "roster", "schedule", "leave"].includes(tab) && (
```
