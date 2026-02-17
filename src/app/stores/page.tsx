// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

const storeTabs = [
  { id: "list", label: "매장 목록" },
  { id: "hours", label: "운영시간" },
  { id: "shifts", label: "근무조" },
  { id: "late", label: "지각판별" },
];

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
const dayTypeLabels = { weekday: "평일", weekend: "주말", all: "전체" };

export default function StoresPage() {
  const [tab, setTab] = useState("list");
  const [stores, setStores] = useState([]);
  const [regions, setRegions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" });
  const [message, setMessage] = useState("");
  const [selectedStore, setSelectedStore] = useState("");

  // 운영시간
  const [hours, setHours] = useState([]);
  const [hoursMessage, setHoursMessage] = useState("");

  // 근무조
  const [shifts, setShifts] = useState([]);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({ shift_name: "", start_time: "09:00", end_time: "18:00", day_type: "all", min_workers: 1 });
  const [shiftMessage, setShiftMessage] = useState("");

  useEffect(() => { loadStores(); loadRegions(); }, []);

  useEffect(() => {
    if (selectedStore && tab === "hours") loadHours();
    if (selectedStore && tab === "shifts") loadShifts();
  }, [selectedStore, tab]);

  const loadStores = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("stores").select("*, regions(name)").order("name");
    if (data) { setStores(data); if (data.length > 0 && !selectedStore) setSelectedStore(data[0].id); }
  };

  const loadRegions = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("regions").select("*").order("name");
    if (data) setRegions(data);
  };

  // ===== 운영시간 =====
  const loadHours = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_operating_hours").select("*").eq("store_id", selectedStore).order("day_of_week");
    if (data && data.length > 0) { setHours(data); }
    else { setHours(Array.from({ length: 7 }, (_, i) => ({ id: null, store_id: selectedStore, day_of_week: i, open_time: "09:00", close_time: "22:00", is_closed: false }))); }
  };

  const updateHour = (index, field, value) => { const u = [...hours]; u[index] = { ...u[index], [field]: value }; setHours(u); };

  const saveHours = async () => {
    const supabase = createClient();
    for (const h of hours) {
      const p = { store_id: selectedStore, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_closed: h.is_closed };
      if (h.id) { await supabase.from("store_operating_hours").update(p).eq("id", h.id); }
      else { await supabase.from("store_operating_hours").upsert(p, { onConflict: "store_id,day_of_week" }); }
    }
    setHoursMessage("운영시간이 저장되었습니다!");
    setTimeout(() => setHoursMessage(""), 2000);
    loadHours();
  };

  const applyToAll = () => {
    const first = hours.find(h => !h.is_closed);
    if (!first) return;
    setHours(hours.map(h => ({ ...h, open_time: first.open_time, close_time: first.close_time, is_closed: false })));
  };

  // ===== 근무조 =====
  const loadShifts = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_shifts").select("*").eq("store_id", selectedStore).order("start_time");
    if (data) setShifts(data);
  };

  const handleShiftSave = async () => {
    if (!shiftForm.shift_name) { setShiftMessage("근무조 이름을 입력하세요"); return; }
    const supabase = createClient();
    const payload = { store_id: selectedStore, shift_name: shiftForm.shift_name, start_time: shiftForm.start_time, end_time: shiftForm.end_time, day_type: shiftForm.day_type, min_workers: Number(shiftForm.min_workers) || 1 };
    if (editShift) { await supabase.from("store_shifts").update(payload).eq("id", editShift.id); }
    else { await supabase.from("store_shifts").insert(payload); }
    setShowShiftForm(false);
    setEditShift(null);
    setShiftForm({ shift_name: "", start_time: "09:00", end_time: "18:00", day_type: "all", min_workers: 1 });
    setShiftMessage("");
    loadShifts();
  };

  const deleteShift = async (id) => {
    const supabase = createClient();
    await supabase.from("store_shifts").delete().eq("id", id);
    loadShifts();
  };

  // ===== 매장 CRUD =====
  const handleSave = async () => {
    if (!formData.name) { setMessage("매장명을 입력하세요"); return; }
    const supabase = createClient();
    const payload = { name: formData.name, region_id: formData.region_id || null, has_valet: formData.has_valet, valet_fee: formData.has_valet ? Number(formData.valet_fee) || 0 : 0, address: formData.address || null };
    if (editItem) { await supabase.from("stores").update(payload).eq("id", editItem.id); }
    else { await supabase.from("stores").insert({ ...payload, is_active: true }); }
    setShowForm(false); setEditItem(null);
    setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" });
    setMessage(""); loadStores();
  };

  const toggleStatus = async (store) => {
    const supabase = createClient();
    await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id);
    loadStores();
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
          {storeTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="cursor-pointer" style={{
              padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14,
              fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#1428A0" : "#475569", boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ===== 매장 목록 ===== */}
        {tab === "list" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>전체 매장 ({stores.length})</div>
              <button onClick={() => { setEditItem(null); setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" }); setShowForm(true); }}
                className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 매장 추가</button>
            </div>
            {showForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "매장 수정" : "매장 추가"}</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장명 *</label>
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="매장명" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역</label>
                    <select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                      <option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>주소</label>
                    <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="주소" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>발렛비</label>
                    <input type="number" value={formData.valet_fee} onChange={e => setFormData({ ...formData, valet_fee: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead><tr>{["매장명", "지역", "발렛", "발렛비", "상태", "관리"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
              <tbody>{stores.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{s.regions?.name || "-"}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.has_valet ? "#1428A015" : "#f1f5f9", color: s.has_valet ? "#1428A0" : "#94a3b8" }}>{s.has_valet ? "O" : "X"}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>₩{(s.valet_fee || 0).toLocaleString()}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.is_active ? "#dcfce7" : "#fff7ed", color: s.is_active ? "#15803d" : "#c2410c" }}>{s.is_active ? "운영중" : "일시중지"}</span></td>
                  <td style={{ padding: "12px 16px" }}><div className="flex gap-2">
                    <button onClick={() => { setEditItem(s); setFormData({ name: s.name, region_id: s.region_id || "", has_valet: s.has_valet, valet_fee: s.valet_fee || 0, address: s.address || "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                    <button onClick={() => toggleStatus(s)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, background: s.is_active ? "#fff7ed" : "#dcfce7", color: s.is_active ? "#c2410c" : "#15803d" }}>{s.is_active ? "중지" : "운영"}</button>
                  </div></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        {/* ===== 운영시간 ===== */}
        {tab === "hours" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>운영시간 설정</div>
              <div className="flex gap-2">
                <button onClick={applyToAll} className="cursor-pointer" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569" }}>첫째 행 전체 적용</button>
                <button onClick={saveHours} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>저장</button>
              </div>
            </div>
            <div className="mb-5">
              <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
                {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
            {hoursMessage && <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 }}>{hoursMessage}</div>}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead><tr>{["요일", "오픈 시간", "마감 시간", "휴무"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
              <tbody>{hours.map((h, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: h.day_of_week === 0 ? "#dc2626" : h.day_of_week === 6 ? "#1428A0" : "#1e293b" }}>{dayNames[h.day_of_week]}요일</td>
                  <td style={{ padding: "12px 16px" }}><input type="time" value={h.open_time} onChange={e => updateHour(i, "open_time", e.target.value)} disabled={h.is_closed} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, color: h.is_closed ? "#94a3b8" : "#1e293b", background: h.is_closed ? "#f1f5f9" : "#fff" }} /></td>
                  <td style={{ padding: "12px 16px" }}><input type="time" value={h.close_time} onChange={e => updateHour(i, "close_time", e.target.value)} disabled={h.is_closed} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, color: h.is_closed ? "#94a3b8" : "#1e293b", background: h.is_closed ? "#f1f5f9" : "#fff" }} /></td>
                  <td style={{ padding: "12px 16px" }}><button onClick={() => updateHour(i, "is_closed", !h.is_closed)} className="cursor-pointer" style={{ padding: "6px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, background: h.is_closed ? "#fee2e2" : "#f1f5f9", color: h.is_closed ? "#dc2626" : "#94a3b8" }}>{h.is_closed ? "휴무" : "영업"}</button></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        {/* ===== 근무조 ===== */}
        {tab === "shifts" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무조 설정</div>
              <button onClick={() => { setEditShift(null); setShiftForm({ shift_name: "", start_time: "09:00", end_time: "18:00", day_type: "all", min_workers: 1 }); setShowShiftForm(true); }}
                className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 근무조 추가</button>
            </div>

            <div className="mb-5">
              <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
                {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>

            {/* 근무조 추가/수정 폼 */}
            {showShiftForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editShift ? "근무조 수정" : "근무조 추가"}</div>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>근무조 이름 *</label>
                    <input value={shiftForm.shift_name} onChange={e => setShiftForm({ ...shiftForm, shift_name: e.target.value })} placeholder="예: 오전조"
                      className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>시작 시간</label>
                    <input type="time" value={shiftForm.start_time} onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                      className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>종료 시간</label>
                    <input type="time" value={shiftForm.end_time} onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                      className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>적용 요일</label>
                    <select value={shiftForm.day_type} onChange={e => setShiftForm({ ...shiftForm, day_type: e.target.value })}
                      className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                      <option value="all">전체</option>
                      <option value="weekday">평일</option>
                      <option value="weekend">주말</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>최소 인원</label>
                    <input type="number" value={shiftForm.min_workers} onChange={e => setShiftForm({ ...shiftForm, min_workers: e.target.value })} min="1"
                      className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                </div>
                {shiftMessage && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{shiftMessage}</p>}
                <div className="flex gap-2">
                  <button onClick={handleShiftSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editShift ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowShiftForm(false); setShiftMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}

            {/* 근무조 목록 */}
            {shifts.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 근무조가 없습니다. 위 버튼을 눌러 추가하세요.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["근무조", "시작", "종료", "적용", "최소인원", "관리"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{shifts.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{s.shift_name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>{s.start_time?.slice(0, 5)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>{s.end_time?.slice(0, 5)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: s.day_type === "weekday" ? "#1428A015" : s.day_type === "weekend" ? "#F5B73120" : "#f1f5f9",
                        color: s.day_type === "weekday" ? "#1428A0" : s.day_type === "weekend" ? "#b45309" : "#475569",
                      }}>{dayTypeLabels[s.day_type]}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.min_workers}명</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditShift(s); setShiftForm({ shift_name: s.shift_name, start_time: s.start_time?.slice(0, 5), end_time: s.end_time?.slice(0, 5), day_type: s.day_type, min_workers: s.min_workers }); setShowShiftForm(true); }}
                          className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                        <button onClick={() => deleteShift(s.id)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#fee2e2", fontSize: 12, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                      </div>
                    </td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== 지각판별 (개발 예정) ===== */}
        {tab === "late" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>지각판별 설정</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>개발 예정입니다</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}