// @ts-nocheck
"use client";
import LeaveTab from "./LeaveTab";
import ReviewTab from "./ReviewTab";
import ReportTab from "./ReportTab";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

const tabs = [
  { id: "attendance", label: "출퇴근" },
  { id: "roster", label: "명부" },
  { id: "schedule", label: "근태" },
  { id: "leave", label: "연차" },
  { id: "review", label: "근무리뷰" },
  { id: "report", label: "시말서" },
];

const statusMap = {
  present: { label: "출근", bg: "#dcfce7", color: "#15803d" },
  late: { label: "지각", bg: "#fff7ed", color: "#ea580c" },
  absent: { label: "결근", bg: "#fee2e2", color: "#dc2626" },
  dayoff: { label: "휴무", bg: "#f1f5f9", color: "#475569" },
  vacation: { label: "연차", bg: "#ede9fe", color: "#7c3aed" },
};

function ScheduleTab() {
  const [workers, setWorkers] = useState([]);
  const [stores, setStores] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedWorker, setSelectedWorker] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedWorker && selectedMonth) loadRecords(); }, [selectedWorker, selectedMonth]);

  const loadBase = async () => {
    const supabase = createClient();
    const { data: w } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
    const { data: s } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
    if (w) { setWorkers(w); if (w.length > 0) setSelectedWorker(w[0].id); }
    if (s) setStores(s);
  };

  const loadRecords = async () => {
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const endDate = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
    const supabase = createClient();
    const { data } = await supabase.from("worker_attendance").select("*, stores(name)").eq("worker_id", selectedWorker).gte("date", startDate).lte("date", endDate).order("date");
    if (data) setRecords(data);
  };

  const addRecord = async (date) => {
    const supabase = createClient();
    const existing = records.find(r => r.date === date);
    if (existing) return;
    await supabase.from("worker_attendance").insert({ worker_id: selectedWorker, date, status: "present", check_in: "09:00", store_id: stores[0]?.id || null });
    loadRecords();
  };

  const updateRecord = async (id, field, value) => {
    const supabase = createClient();
    await supabase.from("worker_attendance").update({ [field]: value }).eq("id", id);
    loadRecords();
  };

  const deleteRecord = async (id) => {
    const supabase = createClient();
    await supabase.from("worker_attendance").delete().eq("id", id);
    loadRecords();
  };

  const [y, m] = selectedMonth.split("-");
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const stats = {
    present: records.filter(r => r.status === "present").length,
    late: records.filter(r => r.status === "late").length,
    absent: records.filter(r => r.status === "absent").length,
    dayoff: records.filter(r => r.status === "dayoff").length,
    vacation: records.filter(r => r.status === "vacation").length,
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>월별 근태 현황</div>

      <div className="flex flex-col md:flex-row gap-4 mb-5">
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>근무자</label>
          <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 160, width: "100%" }}>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>월 선택</label>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, width: "100%" }} />
        </div>
      </div>

      {/* 통계 - 모바일에서 줄바꿈 */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-5">
        {Object.entries(statusMap).map(([key, val]) => (
          <div key={key} style={{ padding: "6px 12px", borderRadius: 10, background: val.bg, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: val.color }}>{val.label}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: val.color }}>{stats[key] || 0}</span>
          </div>
        ))}
        <div style={{ padding: "6px 12px", borderRadius: 10, background: "#1428A010" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1428A0" }}>총 {records.length}일</span>
        </div>
      </div>

      {/* PC: 테이블 */}
      <div className="hidden md:block">
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px" }}>
          <thead>
            <tr>
              {["날짜", "요일", "상태", "출근", "퇴근", "매장", "비고", "관리"].map(h => (
                <th key={h} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = `${y}-${m}-${String(i + 1).padStart(2, "0")}`;
              const dayOfWeek = new Date(date).getDay();
              const record = records.find(r => r.date === date);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <tr key={date} style={{ background: isWeekend ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{i + 1}일</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: dayOfWeek === 0 ? "#dc2626" : dayOfWeek === 6 ? "#1428A0" : "#475569" }}>{dayNames[dayOfWeek]}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {record ? (
                      <select value={record.status} onChange={e => updateRecord(record.id, "status", e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600, background: statusMap[record.status]?.bg, color: statusMap[record.status]?.color }}>
                        {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>-</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {record && !["absent", "dayoff", "vacation"].includes(record.status) ? (
                      <input type="time" value={record.check_in || ""} onChange={e => updateRecord(record.id, "check_in", e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 90 }} />
                    ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>-</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {record && !["absent", "dayoff", "vacation"].includes(record.status) ? (
                      <input type="time" value={record.check_out || ""} onChange={e => updateRecord(record.id, "check_out", e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 90 }} />
                    ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>-</span>}
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#475569" }}>{record?.stores?.name || "-"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {record ? <input value={record.note || ""} onChange={e => updateRecord(record.id, "note", e.target.value)} placeholder="메모" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 100 }} /> : <span style={{ fontSize: 12, color: "#d1d5db" }}>-</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {record ? (
                      <button onClick={() => deleteRecord(record.id)} className="cursor-pointer" style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600 }}>삭제</button>
                    ) : (
                      <button onClick={() => addRecord(date)} className="cursor-pointer" style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#1428A015", color: "#1428A0", fontSize: 11, fontWeight: 600 }}>추가</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드형 리스트 */}
      <div className="md:hidden space-y-2">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${y}-${m}-${String(i + 1).padStart(2, "0")}`;
          const dayOfWeek = new Date(date).getDay();
          const record = records.find(r => r.date === date);
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const st = record ? statusMap[record.status] : null;
          return (
            <div key={date} style={{ background: isWeekend ? "#f8fafc" : "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: record ? 8 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{i + 1}일</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: dayOfWeek === 0 ? "#dc2626" : dayOfWeek === 6 ? "#1428A0" : "#94a3b8" }}>({dayNames[dayOfWeek]})</span>
                  {st && <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>}
                </div>
                {record ? (
                  <button onClick={() => deleteRecord(record.id)} className="cursor-pointer" style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600 }}>삭제</button>
                ) : (
                  <button onClick={() => addRecord(date)} className="cursor-pointer" style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#1428A015", color: "#1428A0", fontSize: 11, fontWeight: 600 }}>추가</button>
                )}
              </div>
              {record && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {!["absent", "dayoff", "vacation"].includes(record.status) && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>출근</span>
                        <input type="time" value={record.check_in || ""} onChange={e => updateRecord(record.id, "check_in", e.target.value)} style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 80 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>퇴근</span>
                        <input type="time" value={record.check_out || ""} onChange={e => updateRecord(record.id, "check_out", e.target.value)} style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 80 }} />
                      </div>
                    </>
                  )}
                  <select value={record.status} onChange={e => updateRecord(record.id, "status", e.target.value)} style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 600, background: st?.bg, color: st?.color }}>
                    {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const [tab, setTab] = useState("roster");
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", region_id: "" });
  const [regions, setRegions] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => { loadWorkers(); loadRegions(); }, []);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("*, regions(name)").order("name");
    if (data) setWorkers(data);
  };
  const loadRegions = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("regions").select("*").order("name");
    if (data) setRegions(data);
  };
  const handleSave = async () => {
    if (!formData.name) { setMessage("이름을 입력하세요"); return; }
    const supabase = createClient();
    if (editItem) { await supabase.from("workers").update({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null }).eq("id", editItem.id); }
    else { await supabase.from("workers").insert({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, status: "active" }); }
    setShowForm(false); setEditItem(null); setFormData({ name: "", phone: "", region_id: "" }); setMessage(""); loadWorkers();
  };
  const toggleStatus = async (worker) => {
    const supabase = createClient();
    await supabase.from("workers").update({ status: worker.status === "active" ? "inactive" : "active" }).eq("id", worker.id);
    loadWorkers();
  };

  const activeWorkers = workers.filter(w => w.status === "active");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 탭 - 모바일에서 스크롤 */}
        <div className="flex gap-1 mb-6 overflow-x-auto" style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="cursor-pointer whitespace-nowrap" style={{
              padding: "10px 16px", borderRadius: 10, border: "none", fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#1428A0" : "#475569", boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s", flexShrink: 0,
            }}>{t.label}</button>
          ))}
        </div>

        {/* 출퇴근 */}
        {tab === "attendance" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>오늘의 출퇴근 현황</div>
              <div className="flex gap-2">
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 700 }}>출근 {activeWorkers.length}명</span>
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>미출근 0명</span>
              </div>
            </div>

            {/* PC: 테이블 */}
            <div className="hidden md:block">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["이름", "지역", "연락처", "상태"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{activeWorkers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.regions?.name || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 600 }}>활성</span></td>
                  </tr>))}</tbody>
              </table>
            </div>

            {/* 모바일: 카드형 */}
            <div className="md:hidden space-y-2">
              {activeWorkers.map(w => (
                <div key={w.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{w.regions?.name || "-"} · {w.phone || "-"}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 600 }}>활성</span>
                </div>
              ))}
            </div>

            {activeWorkers.length === 0 && <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 근무자가 없습니다</div>}
          </div>
        )}

        {/* 명부 */}
        {tab === "roster" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무자 명부 ({workers.length}명)</div>
              <button onClick={() => { setEditItem(null); setFormData({ name: "", phone: "", region_id: "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 근무자 추가</button>
            </div>
            {showForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "근무자 수정" : "근무자 추가"}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>이름 *</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="이름" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>연락처</label><input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역</label><select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}><option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}

            {/* PC: 테이블 */}
            <div className="hidden md:block">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["이름", "지역", "연락처", "상태", "관리"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{workers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.regions?.name || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: w.status === "active" ? "#dcfce7" : "#fee2e2", color: w.status === "active" ? "#15803d" : "#b91c1c" }}>{w.status === "active" ? "활성" : "비활성"}</span></td>
                    <td style={{ padding: "12px 16px" }}><div className="flex gap-2">
                      <button onClick={() => { setEditItem(w); setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                      <button onClick={() => toggleStatus(w)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, background: w.status === "active" ? "#fee2e2" : "#dcfce7", color: w.status === "active" ? "#b91c1c" : "#15803d" }}>{w.status === "active" ? "비활성" : "활성화"}</button>
                    </div></td>
                  </tr>))}</tbody>
              </table>
            </div>

            {/* 모바일: 카드형 */}
            <div className="md:hidden space-y-2">
              {workers.map(w => (
                <div key={w.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{w.name}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: w.status === "active" ? "#dcfce7" : "#fee2e2", color: w.status === "active" ? "#15803d" : "#b91c1c" }}>{w.status === "active" ? "활성" : "비활성"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
                    {w.regions?.name || "지역 없음"} · {w.phone || "연락처 없음"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setEditItem(w); setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "" }); setShowForm(true); }} className="cursor-pointer" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", textAlign: "center" }}>수정</button>
                    <button onClick={() => toggleStatus(w)} className="cursor-pointer" style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, textAlign: "center", background: w.status === "active" ? "#fee2e2" : "#dcfce7", color: w.status === "active" ? "#b91c1c" : "#15803d" }}>{w.status === "active" ? "비활성" : "활성화"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "schedule" && <ScheduleTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "review" && <ReviewTab />}
        {tab === "report" && <ReportTab />}
        {!["attendance", "roster", "schedule", "leave", "review", "report"].includes(tab) && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{tabs.find(t => t.id === tab)?.label} 관리</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>개발 예정입니다</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
