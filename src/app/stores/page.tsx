// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

const storeTabs = [
  { id: "list", label: "매장 목록" },
  { id: "hours", label: "운영시간" },
  { id: "shifts", label: "근무조" },
  { id: "late", label: "정상출근체크" },
  { id: "pricing", label: "요금설정" },
];

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
const dayTypeLabels = { weekday: "평일", weekend: "주말", all: "전체" };
function PricingTab({ selectedStore, stores, onStoreChange }) {
  const [pricing, setPricing] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ parking_type: "general", base_minutes: 30, base_fee: 1000, extra_minutes: 10, extra_fee: 500, daily_max: 50000, monthly_fee: 100000 });
  const [msg, setMsg] = useState("");

  useEffect(() => { if (selectedStore) loadPricing(); }, [selectedStore]);

  const loadPricing = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_pricing").select("*").eq("store_id", selectedStore).order("parking_type");
    if (data) setPricing(data);
  };

  const handleSave = async () => {
    const supabase = createClient();
    const payload = {
      store_id: selectedStore,
      parking_type: form.parking_type,
      base_minutes: Number(form.base_minutes) || 30,
      base_fee: Number(form.base_fee) || 0,
      extra_minutes: Number(form.extra_minutes) || 10,
      extra_fee: Number(form.extra_fee) || 0,
      daily_max: Number(form.daily_max) || 0,
      monthly_fee: Number(form.monthly_fee) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from("store_pricing").update(payload).eq("id", editItem.id);
    } else {
      await supabase.from("store_pricing").upsert(payload, { onConflict: "store_id,parking_type" });
    }
    setShowForm(false); setEditItem(null);
    setForm({ parking_type: "general", base_minutes: 30, base_fee: 1000, extra_minutes: 10, extra_fee: 500, daily_max: 50000, monthly_fee: 100000 });
    setMsg("저장되었습니다!"); setTimeout(() => setMsg(""), 2000);
    loadPricing();
  };

  const deletePricing = async (id) => {
    const supabase = createClient();
    await supabase.from("store_pricing").delete().eq("id", id);
    loadPricing();
  };

  const typeLabels = { general: "일반주차", valet: "발렛주차" };
  const typeColors = { general: { bg: "#1428A015", color: "#1428A0" }, valet: { bg: "#F5B73120", color: "#b45309" } };

  // 요금 시뮬레이션
  const simulate = (p, minutes) => {
    if (minutes <= p.base_minutes) return p.base_fee;
    const extraTime = minutes - p.base_minutes;
    const extraUnits = Math.ceil(extraTime / p.extra_minutes);
    const total = p.base_fee + (extraUnits * p.extra_fee);
    return Math.min(total, p.daily_max || 999999);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
      <div className="flex justify-between items-center mb-5">
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>요금 설정</div>
        <button onClick={() => { setEditItem(null); setForm({ parking_type: "general", base_minutes: 30, base_fee: 1000, extra_minutes: 10, extra_fee: 500, daily_max: 50000, monthly_fee: 100000 }); setShowForm(true); }}
          className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 요금 추가</button>
      </div>

      <div className="mb-5">
        <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
        <select value={selectedStore} onChange={e => onStoreChange(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
          {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {msg && <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 }}>{msg}</div>}

      {showForm && (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "요금 수정" : "요금 추가"}</div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>주차 유형</label>
              <select value={form.parking_type} onChange={e => setForm({ ...form, parking_type: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                <option value="general">일반주차</option>
                <option value="valet">발렛주차</option>
              </select>
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>기본 시간 (분)</label>
              <input type="number" value={form.base_minutes} onChange={e => setForm({ ...form, base_minutes: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>기본 요금 (원)</label>
              <input type="number" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>추가 단위 (분)</label>
              <input type="number" value={form.extra_minutes} onChange={e => setForm({ ...form, extra_minutes: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>추가 요금 (원)</label>
              <input type="number" value={form.extra_fee} onChange={e => setForm({ ...form, extra_fee: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>일 최대 (원)</label>
              <input type="number" value={form.daily_max} onChange={e => setForm({ ...form, daily_max: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>월주차 요금 (원)</label>
              <input type="number" value={form.monthly_fee} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "저장"}</button>
            <button onClick={() => setShowForm(false)} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
          </div>
        </div>
      )}

      {pricing.length === 0 ? (
        <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 요금이 없습니다. 위 버튼을 눌러 추가하세요.</div>
      ) : (
        <div className="space-y-4">
          {pricing.map(p => (
            <div key={p.id} style={{ borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div className="flex justify-between items-center" style={{ padding: "16px 20px", background: "#f8fafc" }}>
                <div className="flex items-center gap-3">
                  <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: typeColors[p.parking_type]?.bg, color: typeColors[p.parking_type]?.color }}>{typeLabels[p.parking_type]}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>기본 {p.base_minutes}분 / ₩{p.base_fee.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditItem(p); setForm({ parking_type: p.parking_type, base_minutes: p.base_minutes, base_fee: p.base_fee, extra_minutes: p.extra_minutes, extra_fee: p.extra_fee, daily_max: p.daily_max || 0, monthly_fee: p.monthly_fee || 0 }); setShowForm(true); }}
                    className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                  <button onClick={() => deletePricing(p.id)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#fee2e2", fontSize: 12, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>기본 시간</div><div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{p.base_minutes}분</div></div>
                  <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>기본 요금</div><div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>₩{p.base_fee.toLocaleString()}</div></div>
                  <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>추가 {p.extra_minutes}분당</div><div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>₩{p.extra_fee.toLocaleString()}</div></div>
                  <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>일 최대</div><div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>₩{(p.daily_max || 0).toLocaleString()}</div></div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>월주차: <strong style={{ color: "#1e293b" }}>₩{(p.monthly_fee || 0).toLocaleString()}/월</strong></div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>요금 시뮬레이션</div>
                  <div className="flex gap-4">
                    {[30, 60, 120, 180, 360].map(min => (
                      <div key={min} className="text-center">
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{min >= 60 ? `${min/60}시간` : `${min}분`}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1428A0" }}>₩{simulate(p, min).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  }
function LateRuleTab({ selectedStore, stores, onStoreChange }) {
  const [rule, setRule] = useState({ grace_minutes: 10, late_threshold_minutes: 30, absence_threshold_minutes: 60 });
  const [ruleId, setRuleId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (selectedStore) loadRule(); }, [selectedStore]);

  const loadRule = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_late_rules").select("*").eq("store_id", selectedStore).single();
    if (data) {
      setRule({ grace_minutes: data.grace_minutes, late_threshold_minutes: data.late_threshold_minutes, absence_threshold_minutes: data.absence_threshold_minutes });
      setRuleId(data.id);
    } else {
      setRule({ grace_minutes: 10, late_threshold_minutes: 30, absence_threshold_minutes: 60 });
      setRuleId(null);
    }
  };

  const saveRule = async () => {
    const supabase = createClient();
    const payload = { store_id: selectedStore, ...rule, updated_at: new Date().toISOString() };
    if (ruleId) { await supabase.from("store_late_rules").update(payload).eq("id", ruleId); }
    else { await supabase.from("store_late_rules").insert(payload); }
    setMsg("저장되었습니다!");
    setTimeout(() => setMsg(""), 2000);
    loadRule();
  };

  const items = [
    { key: "grace_minutes", label: "유예 시간", desc: "출근 시각 이후 이 시간까지는 정상 출근으로 인정", unit: "분", color: "#16a34a" },
    { key: "late_threshold_minutes", label: "지각 기준", desc: "유예 시간 초과 ~ 이 시간 이내는 지각 처리", unit: "분", color: "#ea580c" },
    { key: "absence_threshold_minutes", label: "결근 기준", desc: "이 시간 초과 미출근 시 결근 처리", unit: "분", color: "#dc2626" },
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
      <div className="flex justify-between items-center mb-5">
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>정상출근체크 기준 설정</div>
        <button onClick={saveRule} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>저장</button>
      </div>

      <div className="mb-5">
        <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
        <select value={selectedStore} onChange={e => onStoreChange(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
          {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {msg && <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 }}>{msg}</div>}

      {/* 시각적 타임라인 */}
      <div className="mb-6" style={{ background: "#f8fafc", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>출근 판정 타임라인</div>
        <div className="flex items-center gap-0" style={{ height: 40 }}>
          <div style={{ flex: rule.grace_minutes, background: "#dcfce7", borderRadius: "8px 0 0 8px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#15803d" }}>
            정상 ({rule.grace_minutes}분)
          </div>
          <div style={{ flex: rule.late_threshold_minutes - rule.grace_minutes, background: "#fff7ed", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#ea580c" }}>
            지각 ({rule.late_threshold_minutes}분)
          </div>
          <div style={{ flex: rule.absence_threshold_minutes - rule.late_threshold_minutes, background: "#fee2e2", borderRadius: "0 8px 8px 0", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
            결근 ({rule.absence_threshold_minutes}분+)
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span style={{ fontSize: 11, color: "#94a3b8" }}>출근시각</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>+{rule.grace_minutes}분</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>+{rule.late_threshold_minutes}분</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>+{rule.absence_threshold_minutes}분</span>
        </div>
      </div>

      {/* 설정 입력 */}
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-4" style={{ padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ width: 8, height: 40, borderRadius: 4, background: item.color }} />
            <div className="flex-1">
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rule[item.key]}
                onChange={e => setRule({ ...rule, [item.key]: Number(e.target.value) || 0 })}
                min="0"
                style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, fontWeight: 700, textAlign: "center" }}
              />
              <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StoresPage() {
  const [tab, setTab] = useState("list");
  const [stores, setStores] = useState([]);
  const [regions, setRegions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "", detail_address: "", manager_name: "", manager_phone: "" });
  const [message, setMessage] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [hours, setHours] = useState([]);
  const [hoursMessage, setHoursMessage] = useState("");
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
  const loadHours = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_operating_hours").select("*").eq("store_id", selectedStore).order("day_of_week");
    if (data && data.length > 0) setHours(data);
    else setHours(Array.from({ length: 7 }, (_, i) => ({ id: null, store_id: selectedStore, day_of_week: i, open_time: "09:00", close_time: "22:00", is_closed: false })));
  };
  const updateHour = (index, field, value) => { const u = [...hours]; u[index] = { ...u[index], [field]: value }; setHours(u); };
  const saveHours = async () => {
    const supabase = createClient();
    for (const h of hours) {
      const p = { store_id: selectedStore, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_closed: h.is_closed };
      if (h.id) await supabase.from("store_operating_hours").update(p).eq("id", h.id);
      else await supabase.from("store_operating_hours").upsert(p, { onConflict: "store_id,day_of_week" });
    }
    setHoursMessage("저장되었습니다!"); setTimeout(() => setHoursMessage(""), 2000); loadHours();
  };
  const applyToAll = () => { const f = hours.find(h => !h.is_closed); if (!f) return; setHours(hours.map(h => ({ ...h, open_time: f.open_time, close_time: f.close_time, is_closed: false }))); };
  const loadShifts = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_shifts").select("*").eq("store_id", selectedStore).order("start_time");
    if (data) setShifts(data);
  };
  const handleShiftSave = async () => {
    if (!shiftForm.shift_name) { setShiftMessage("근무조 이름을 입력하세요"); return; }
    const supabase = createClient();
    const payload = { store_id: selectedStore, shift_name: shiftForm.shift_name, start_time: shiftForm.start_time, end_time: shiftForm.end_time, day_type: shiftForm.day_type, min_workers: Number(shiftForm.min_workers) || 1 };
    if (editShift) await supabase.from("store_shifts").update(payload).eq("id", editShift.id);
    else await supabase.from("store_shifts").insert(payload);
    setShowShiftForm(false); setEditShift(null); setShiftForm({ shift_name: "", start_time: "09:00", end_time: "18:00", day_type: "all", min_workers: 1 }); setShiftMessage(""); loadShifts();
  };
  const deleteShift = async (id) => { const supabase = createClient(); await supabase.from("store_shifts").delete().eq("id", id); loadShifts(); };
  const handleSave = async () => {
    if (!formData.name) { setMessage("매장명을 입력하세요"); return; }
    const supabase = createClient();
    const payload = { name: formData.name, region_id: formData.region_id || null, has_valet: formData.has_valet, valet_fee: formData.has_valet ? Number(formData.valet_fee) || 0 : 0, address: formData.address || null, detail_address: formData.detail_address || null, manager_name: formData.manager_name || null, manager_phone: formData.manager_phone || null };
    if (editItem) await supabase.from("stores").update(payload).eq("id", editItem.id);
    else await supabase.from("stores").insert({ ...payload, is_active: true });
    setShowForm(false); setEditItem(null); setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "", detail_address: "", manager_name: "", manager_phone: "" }); setMessage(""); loadStores();
  };
  const toggleStatus = async (store) => { const supabase = createClient(); await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id); loadStores(); };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-1 mb-6" style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
          {storeTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="cursor-pointer" style={{
              padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14,
              fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#1428A0" : "#475569", boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* 매장 목록 */}
        {tab === "list" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>전체 매장 ({stores.length})</div>
              <button onClick={() => { setEditItem(null); setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "", detail_address: "", manager_name: "", manager_phone: "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 매장 추가</button>
            </div>
            {showForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "매장 수정" : "매장 추가"}</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장명 *</label><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="매장명" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역</label><select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}><option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                </div>
                {/* 도로명 주소 검색 */}
                <div className="mb-4">
                  <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>도로명 주소 *</label>
                  <div className="flex gap-2">
                    <input value={formData.address} readOnly placeholder="주소 검색을 클릭하세요" className="flex-1" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#fff", cursor: "pointer" }}
                      onClick={() => {
                        if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
                          new (window as any).daum.Postcode({
                            oncomplete: (data: any) => { setFormData(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress })); }
                          }).open();
                        } else {
                          const script = document.createElement("script");
                          script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
                          script.onload = () => {
                            new (window as any).daum.Postcode({
                              oncomplete: (data: any) => { setFormData(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress })); }
                            }).open();
                          };
                          document.head.appendChild(script);
                        }
                      }}
                    />
                    <button type="button" className="cursor-pointer" onClick={() => {
                      if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
                        new (window as any).daum.Postcode({
                          oncomplete: (data: any) => { setFormData(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress })); }
                        }).open();
                      } else {
                        const script = document.createElement("script");
                        script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
                        script.onload = () => {
                          new (window as any).daum.Postcode({
                            oncomplete: (data: any) => { setFormData(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress })); }
                          }).open();
                        };
                        document.head.appendChild(script);
                      }
                    }} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>🔍 주소 검색</button>
                  </div>
                  {formData.address && (
                    <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "#dcfce7", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>✅</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>{formData.address}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>상세 주소</label><input value={formData.detail_address} onChange={e => setFormData({ ...formData, detail_address: e.target.value })} placeholder="동, 호수, 층 등" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>담당자</label><input value={formData.manager_name} onChange={e => setFormData({ ...formData, manager_name: e.target.value })} placeholder="담당자명" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>연락처</label><input value={formData.manager_phone} onChange={e => setFormData({ ...formData, manager_phone: e.target.value })} placeholder="010-0000-0000" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>발렛비</label><input type="number" value={formData.valet_fee} onChange={e => setFormData({ ...formData, valet_fee: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead><tr>{["매장명", "지역", "발렛", "발렛비", "상태", "관리"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
              <tbody>{stores.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{s.regions?.name || "-"}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.has_valet ? "#1428A015" : "#f1f5f9", color: s.has_valet ? "#1428A0" : "#94a3b8" }}>{s.has_valet ? "O" : "X"}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>₩{(s.valet_fee || 0).toLocaleString()}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.is_active ? "#dcfce7" : "#fff7ed", color: s.is_active ? "#15803d" : "#c2410c" }}>{s.is_active ? "운영중" : "일시중지"}</span></td>
                  <td style={{ padding: "12px 16px" }}><div className="flex gap-2">
                    <button onClick={() => { setEditItem(s); setFormData({ name: s.name, region_id: s.region_id || "", has_valet: s.has_valet, valet_fee: s.valet_fee || 0, address: s.address || "", detail_address: s.detail_address || "", manager_name: s.manager_name || "", manager_phone: s.manager_phone || "" }); setShowForm(true); }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                    <button onClick={() => toggleStatus(s)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, background: s.is_active ? "#fff7ed" : "#dcfce7", color: s.is_active ? "#c2410c" : "#15803d" }}>{s.is_active ? "중지" : "운영"}</button>
                  </div></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        {/* 운영시간 */}
        {tab === "hours" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>운영시간 설정</div>
              <div className="flex gap-2">
                <button onClick={applyToAll} className="cursor-pointer" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569" }}>첫째 행 전체 적용</button>
                <button onClick={saveHours} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>저장</button>
              </div>
            </div>
            <div className="mb-5"><label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
                {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {hoursMessage && <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 }}>{hoursMessage}</div>}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead><tr>{["요일", "오픈 시간", "마감 시간", "휴무"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
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

        {/* 근무조 */}
        {tab === "shifts" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무조 설정</div>
              <button onClick={() => { setEditShift(null); setShiftForm({ shift_name: "", start_time: "09:00", end_time: "18:00", day_type: "all", min_workers: 1 }); setShowShiftForm(true); }} className="cursor-pointer" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>+ 근무조 추가</button>
            </div>
            <div className="mb-5"><label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
              <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}>
                {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {showShiftForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editShift ? "근무조 수정" : "근무조 추가"}</div>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>근무조 이름 *</label><input value={shiftForm.shift_name} onChange={e => setShiftForm({ ...shiftForm, shift_name: e.target.value })} placeholder="예: 오전조" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>시작 시간</label><input type="time" value={shiftForm.start_time} onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>종료 시간</label><input type="time" value={shiftForm.end_time} onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>적용 요일</label><select value={shiftForm.day_type} onChange={e => setShiftForm({ ...shiftForm, day_type: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}><option value="all">전체</option><option value="weekday">평일</option><option value="weekend">주말</option></select></div>
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>최소 인원</label><input type="number" value={shiftForm.min_workers} onChange={e => setShiftForm({ ...shiftForm, min_workers: e.target.value })} min="1" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} /></div>
                </div>
                {shiftMessage && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{shiftMessage}</p>}
                <div className="flex gap-2">
                  <button onClick={handleShiftSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editShift ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowShiftForm(false); setShiftMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}
            {shifts.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 근무조가 없습니다. 위 버튼을 눌러 추가하세요.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                <thead><tr>{["근무조", "시작", "종료", "적용", "최소인원", "관리"].map(h => (<th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
                <tbody>{shifts.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{s.shift_name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>{s.start_time?.slice(0, 5)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>{s.end_time?.slice(0, 5)}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.day_type === "weekday" ? "#1428A015" : s.day_type === "weekend" ? "#F5B73120" : "#f1f5f9", color: s.day_type === "weekday" ? "#1428A0" : s.day_type === "weekend" ? "#b45309" : "#475569" }}>{dayTypeLabels[s.day_type]}</span></td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.min_workers}명</td>
                    <td style={{ padding: "12px 16px" }}><div className="flex gap-2">
                      <button onClick={() => { setEditShift(s); setShiftForm({ shift_name: s.shift_name, start_time: s.start_time?.slice(0, 5), end_time: s.end_time?.slice(0, 5), day_type: s.day_type, min_workers: s.min_workers }); setShowShiftForm(true); }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                      <button onClick={() => deleteShift(s.id)} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#fee2e2", fontSize: 12, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                    </div></td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* 정상출근체크 */}
        {tab === "late" && <LateRuleTab selectedStore={selectedStore} stores={stores} onStoreChange={setSelectedStore} />}

        {tab === "pricing" && <PricingTab selectedStore={selectedStore} stores={stores} onStoreChange={setSelectedStore} />}
      </div>
    </AppLayout>
  );
}