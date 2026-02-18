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
  // 방문지 관리
  const [visitPlaces, setVisitPlaces] = useState([]);
  const [showVPForm, setShowVPForm] = useState(false);
  const [editVP, setEditVP] = useState(null);
  const [vpForm, setVPForm] = useState({ name: "", floor: "", free_minutes: 0, base_fee: 0, base_minutes: 30, extra_fee: 0, daily_max: 0, valet_fee: 0, monthly_fee: 0 });
  // 주차장 관리
  const [parkingLots, setParkingLots] = useState([]);
  const [showPLForm, setShowPLForm] = useState(false);
  const [editPL, setEditPL] = useState(null);
  const [plForm, setPLForm] = useState({ name: "", lot_type: "internal", parking_type: ["self"], road_address: "", total_spaces: 0, self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0, operating_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }, open_time: "09:00", close_time: "22:00" });
  // 특별추가근무
  const [overtimeShifts, setOvertimeShifts] = useState([]);
  const [showOTForm, setShowOTForm] = useState(false);
  const [editOT, setEditOT] = useState(null);
  const [otForm, setOTForm] = useState({ date: "", start_time: "", end_time: "", worker_id: "", note: "" });
  const [workers, setWorkers] = useState([]);
  // 인라인 운영시간 (매장 수정 폼 내)
  const [inlineHours, setInlineHours] = useState(Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, open_time: "09:00", close_time: "22:00", is_closed: false, id: null })));
  const [inlineHoursMsg, setInlineHoursMsg] = useState("");

  useEffect(() => { loadStores(); loadRegions(); }, []);
  useEffect(() => {
    if (selectedStore && tab === "hours") { loadHours(); loadOvertimeShifts(); loadWorkers(); }
    if (selectedStore && tab === "shifts") loadShifts();
  }, [selectedStore, tab]);
  // 방문지: editItem 변경 시 로드
  useEffect(() => { if (editItem) loadVisitPlaces(editItem.id); else setVisitPlaces([]); }, [editItem]);
  useEffect(() => { if (editItem) loadParkingLots(editItem.id); else setParkingLots([]); }, [editItem]);
  useEffect(() => { if (editItem) loadInlineHours(editItem.id); }, [editItem]);
  const loadVisitPlaces = async (storeId) => {
    const supabase = createClient();
    const { data } = await supabase.from("visit_places").select("*").eq("store_id", storeId).order("floor,name");
    if (data) setVisitPlaces(data);
  };
  const handleVPSave = async () => {
    if (!vpForm.name || !editItem) return;
    const supabase = createClient();
    const payload = { store_id: editItem.id, name: vpForm.name, floor: vpForm.floor || null, free_minutes: Number(vpForm.free_minutes) || 0, base_fee: Number(vpForm.base_fee) || 0, base_minutes: Number(vpForm.base_minutes) || 30, extra_fee: Number(vpForm.extra_fee) || 0, daily_max: Number(vpForm.daily_max) || 0, valet_fee: Number(vpForm.valet_fee) || 0, monthly_fee: Number(vpForm.monthly_fee) || 0 };
    if (editVP) await supabase.from("visit_places").update(payload).eq("id", editVP.id);
    else await supabase.from("visit_places").insert(payload);
    setShowVPForm(false); setEditVP(null); setVPForm({ name: "", floor: "", free_minutes: 0, base_fee: 0, base_minutes: 30, extra_fee: 0, daily_max: 0, valet_fee: 0, monthly_fee: 0 });
    loadVisitPlaces(editItem.id);
  };
  const deleteVP = async (id) => { const supabase = createClient(); await supabase.from("visit_places").delete().eq("id", id); loadVisitPlaces(editItem.id); };
  // 주차장 CRUD
  const loadParkingLots = async (storeId) => {
    const supabase = createClient();
    const { data } = await supabase.from("parking_lots").select("*").eq("store_id", storeId).order("lot_type,name");
    if (data) setParkingLots(data);
  };
  const [plMessage, setPLMessage] = useState("");
  const handlePLSave = async () => {
    if (!plForm.name) { setPLMessage("주차장 이름을 입력하세요"); setTimeout(() => setPLMessage(""), 2000); return; }
    if (!editItem) return;
    setPLMessage("");
    const supabase = createClient();
    const calcTotal = (Number(plForm.self_spaces) || 0) + (Number(plForm.mechanical_normal) || 0) + (Number(plForm.mechanical_suv) || 0);
    const payload = { store_id: editItem.id, name: plForm.name, lot_type: plForm.lot_type, lot_tag: (plForm as any).lot_tag || "본관", parking_type: plForm.parking_type, road_address: plForm.road_address || null, total_spaces: calcTotal, self_spaces: Number(plForm.self_spaces) || 0, mechanical_normal: Number(plForm.mechanical_normal) || 0, mechanical_suv: Number(plForm.mechanical_suv) || 0, operating_days: plForm.operating_days, open_time: plForm.open_time, close_time: plForm.close_time };
    if (editPL) await supabase.from("parking_lots").update(payload).eq("id", editPL.id);
    else await supabase.from("parking_lots").insert(payload);
    setShowPLForm(false); setEditPL(null); setPLForm({ name: "", lot_type: "internal", lot_tag: "본관", parking_type: ["self"], road_address: "", total_spaces: 0, self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0, operating_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }, open_time: "09:00", close_time: "22:00" });
    loadParkingLots(editItem.id);
  };
  const deletePL = async (id) => { const supabase = createClient(); await supabase.from("parking_lots").delete().eq("id", id); loadParkingLots(editItem.id); };
  const toggleParkingType = (type) => {
    const cur = plForm.parking_type || [];
    if (cur.includes(type)) { if (cur.length > 1) setPLForm({ ...plForm, parking_type: cur.filter(t => t !== type) }); }
    else setPLForm({ ...plForm, parking_type: [...cur, type] });
  };
  const toggleDay = (day) => { setPLForm({ ...plForm, operating_days: { ...plForm.operating_days, [day]: !plForm.operating_days[day] } }); };
  // 특별추가근무 CRUD
  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
    if (data) setWorkers(data);
  };
  const loadOvertimeShifts = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("overtime_shifts").select("*, workers(name)").eq("store_id", selectedStore).order("date", { ascending: false });
    if (data) setOvertimeShifts(data);
  };
  const handleOTSave = async () => {
    if (!otForm.date || !otForm.start_time || !otForm.end_time || !otForm.worker_id) return;
    const supabase = createClient();
    const payload = { store_id: selectedStore, worker_id: otForm.worker_id, date: otForm.date, start_time: otForm.start_time, end_time: otForm.end_time, note: otForm.note || null };
    if (editOT) await supabase.from("overtime_shifts").update(payload).eq("id", editOT.id);
    else await supabase.from("overtime_shifts").insert(payload);
    setShowOTForm(false); setEditOT(null); setOTForm({ date: "", start_time: "", end_time: "", worker_id: "", note: "" });
    loadOvertimeShifts();
  };
  const deleteOT = async (id) => { const supabase = createClient(); await supabase.from("overtime_shifts").delete().eq("id", id); loadOvertimeShifts(); };
  // 인라인 운영시간 로드/저장
  const loadInlineHours = async (storeId) => {
    const supabase = createClient();
    const { data } = await supabase.from("store_operating_hours").select("*").eq("store_id", storeId).order("day_of_week");
    if (data && data.length > 0) setInlineHours(data);
    else setInlineHours(Array.from({ length: 7 }, (_, i) => ({ id: null, store_id: storeId, day_of_week: i, open_time: "09:00", close_time: "22:00", is_closed: false })));
  };
  const saveInlineHours = async () => {
    if (!editItem) return;
    const supabase = createClient();
    for (const h of inlineHours) {
      const p = { store_id: editItem.id, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_closed: h.is_closed };
      if (h.id) await supabase.from("store_operating_hours").update(p).eq("id", h.id);
      else await supabase.from("store_operating_hours").upsert(p, { onConflict: "store_id,day_of_week" });
    }
    setInlineHoursMsg("운영시간 저장 완료!"); setTimeout(() => setInlineHoursMsg(""), 2000);
    loadInlineHours(editItem.id);
  };

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
  // 도로명 주소에서 지역 자동 매칭
  const autoMatchRegion = (sido: string) => {
    if (!sido || regions.length === 0) return;
    const sidoMap: Record<string, string> = { "서울특별시": "서울", "서울": "서울", "경기도": "경기", "경기": "경기", "인천광역시": "인천", "인천": "인천", "부산광역시": "부산", "부산": "부산", "대구광역시": "대구", "대구": "대구", "광주광역시": "광주", "광주": "광주", "대전광역시": "대전", "대전": "대전", "울산광역시": "울산", "울산": "울산", "세종특별자치시": "세종", "세종": "세종", "강원특별자치도": "강원", "강원도": "강원", "강원": "강원", "충청북도": "충북", "충북": "충북", "충청남도": "충남", "충남": "충남", "전라북도": "전북", "전북특별자치도": "전북", "전북": "전북", "전라남도": "전남", "전남": "전남", "경상북도": "경북", "경북": "경북", "경상남도": "경남", "경남": "경남", "제주특별자치도": "제주", "제주": "제주" };
    const shortName = sidoMap[sido] || sido;
    const matched = regions.find(r => r.name === shortName || r.name === sido || sido.includes(r.name));
    if (matched) setFormData(prev => ({ ...prev, region_id: matched.id }));
  };
  const handlePostcodeComplete = (data: any) => {
    setFormData(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress }));
    autoMatchRegion(data.sido);
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
    if (editItem) {
      await supabase.from("stores").update(payload).eq("id", editItem.id);
      setMessage(""); loadStores();
    } else {
      const { data } = await supabase.from("stores").insert({ ...payload, is_active: true }).select().single();
      if (data) {
        await loadStores();
        setEditItem(data);
        setFormData({ name: data.name, region_id: data.region_id || "", has_valet: data.has_valet, valet_fee: data.valet_fee || 0, address: data.address || "", detail_address: data.detail_address || "", manager_name: data.manager_name || "", manager_phone: data.manager_phone || "" });
        setMessage("매장이 추가되었습니다! 아래에서 방문지와 주차장을 등록하세요.");
        setTimeout(() => setMessage(""), 3000);
      }
    }
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
                  <div><label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역 <span style={{ fontSize: 11, color: "#94a3b8" }}>(주소 검색 시 자동)</span></label><select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value })} className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: formData.region_id ? "#dcfce7" : "#fff" }}><option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                </div>
                {/* 도로명 주소 검색 */}
                <div className="mb-4">
                  <label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>도로명 주소 *</label>
                  <div className="flex gap-2">
                    <input value={formData.address} readOnly placeholder="주소 검색을 클릭하세요" className="flex-1" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#fff", cursor: "pointer" }}
                      onClick={() => {
                        if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
                          new (window as any).daum.Postcode({
                            oncomplete: handlePostcodeComplete
                          }).open();
                        } else {
                          const script = document.createElement("script");
                          script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
                          script.onload = () => {
                            new (window as any).daum.Postcode({
                              oncomplete: handlePostcodeComplete
                            }).open();
                          };
                          document.head.appendChild(script);
                        }
                      }}
                    />
                    <button type="button" className="cursor-pointer" onClick={() => {
                      if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
                        new (window as any).daum.Postcode({
                          oncomplete: handlePostcodeComplete
                        }).open();
                      } else {
                        const script = document.createElement("script");
                        script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
                        script.onload = () => {
                          new (window as any).daum.Postcode({
                            oncomplete: handlePostcodeComplete
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
                {message && <p style={{ color: message.includes("추가되었습니다") ? "#15803d" : "#dc2626", fontSize: 13, marginBottom: 8, fontWeight: message.includes("추가되었습니다") ? 600 : 400, background: message.includes("추가되었습니다") ? "#dcfce7" : "transparent", padding: message.includes("추가되었습니다") ? "8px 12px" : 0, borderRadius: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>취소</button>
                </div>
              </div>
            )}
            {/* ─── 방문지 관리 (매장 수정 시에만) ─── */}
            {editItem && showForm && (
              <div style={{ borderTop: "2px dashed #e2e8f0", paddingTop: 16, marginBottom: 20 }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: "#1428A0" }} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>방문지 관리</span>
                    <span style={{ padding: "2px 10px", borderRadius: 10, background: "#1428A010", fontSize: 12, fontWeight: 700, color: "#1428A0" }}>{visitPlaces.length}</span>
                  </div>
                  <button onClick={() => { setEditVP(null); setVPForm({ name: "", floor: "", free_minutes: 0, base_fee: 0, base_minutes: 30, extra_fee: 0, daily_max: 0, valet_fee: 0, monthly_fee: 0 }); setShowVPForm(true); }} className="cursor-pointer" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>+ 방문지 추가</button>
                </div>
                {showVPForm && (
                  <div style={{ background: "#f8fafc", borderRadius: 14, padding: 20, marginBottom: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>{editVP ? "방문지 수정" : "새 방문지 추가"}</div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>방문지명 *</label><input value={vpForm.name} onChange={e => setVPForm({ ...vpForm, name: e.target.value })} placeholder="예: 1층 내과" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15 }} /></div>
                      <div><label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>층</label><input value={vpForm.floor} onChange={e => setVPForm({ ...vpForm, floor: e.target.value })} placeholder="예: 1층, B1" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15 }} /></div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1428A0", marginBottom: 10 }}>💰 요금 체계</div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      {[
                        { key: "free_minutes", label: "무료시간", unit: "분" },
                        { key: "base_fee", label: "기본요금", unit: "원" },
                        { key: "base_minutes", label: "기본시간", unit: "분" },
                        { key: "extra_fee", label: "추가요금", unit: "원/10분" },
                        { key: "daily_max", label: "일 최대", unit: "원" },
                        { key: "valet_fee", label: "발렛비", unit: "원" },
                        { key: "monthly_fee", label: "월주차비", unit: "원/월" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{f.label}</label>
                          <div style={{ position: "relative" }}>
                            <input type="number" value={vpForm[f.key]} onChange={e => setVPForm({ ...vpForm, [f.key]: e.target.value })} className="w-full" style={{ padding: "10px 12px", paddingRight: 44, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15 }} />
                            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94a3b8" }}>{f.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleVPSave} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>{editVP ? "수정" : "추가"}</button>
                      <button onClick={() => { setShowVPForm(false); setEditVP(null); }} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600 }}>취소</button>
                    </div>
                  </div>
                )}
                {visitPlaces.length === 0 ? (
                  <div className="text-center py-6" style={{ color: "#94a3b8", fontSize: 13 }}>등록된 방문지가 없습니다</div>
                ) : (
                  <div className="space-y-2">
                    {visitPlaces.map(vp => (
                      <div key={vp.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            {vp.floor && <span style={{ padding: "2px 8px", borderRadius: 6, background: "#1428A010", color: "#1428A0", fontSize: 11, fontWeight: 700 }}>{vp.floor}</span>}
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{vp.name}</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => { setEditVP(vp); setVPForm({ name: vp.name, floor: vp.floor || "", free_minutes: vp.free_minutes || 0, base_fee: vp.base_fee || 0, base_minutes: vp.base_minutes || 30, extra_fee: vp.extra_fee || 0, daily_max: vp.daily_max || 0, valet_fee: vp.valet_fee || 0, monthly_fee: vp.monthly_fee || 0 }); setShowVPForm(true); }} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#475569" }}>수정</button>
                            <button onClick={() => deleteVP(vp.id)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", fontSize: 11, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            `무료 ${vp.free_minutes || 0}분`, `기본 ₩${(vp.base_fee || 0).toLocaleString()}/${vp.base_minutes || 30}분`,
                            `추가 ₩${(vp.extra_fee || 0).toLocaleString()}/10분`, `일최대 ₩${(vp.daily_max || 0).toLocaleString()}`,
                            `발렛 ₩${(vp.valet_fee || 0).toLocaleString()}`, `월주차 ₩${(vp.monthly_fee || 0).toLocaleString()}`,
                          ].map((tag, i) => (
                            <span key={i} style={{ padding: "4px 10px", borderRadius: 6, background: "#f8fafc", fontSize: 13, color: "#475569", fontWeight: 500 }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* ─── 주차장 관리 (매장 수정 시에만) ─── */}
            {editItem && showForm && (
              <div style={{ borderTop: "2px dashed #e2e8f0", paddingTop: 16, marginBottom: 20 }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: "#F5B731" }} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>주차장 관리</span>
                    <span style={{ padding: "2px 10px", borderRadius: 10, background: "#F5B73120", fontSize: 12, fontWeight: 700, color: "#b45309" }}>{parkingLots.length}</span>
                  </div>
                  <button onClick={() => { setEditPL(null); setPLForm({ name: "", lot_type: "internal", lot_tag: "본관", parking_type: ["self"], road_address: "", total_spaces: 0, self_spaces: 0, mechanical_normal: 0, mechanical_suv: 0, operating_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }, open_time: "09:00", close_time: "22:00" }); setShowPLForm(true); }} className="cursor-pointer" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#F5B731", color: "#fff", fontSize: 13, fontWeight: 700 }}>+ 주차장 추가</button>
                </div>
                {showPLForm && (
                  <div style={{ background: "#FFFBEB", borderRadius: 14, padding: 20, marginBottom: 12, border: "1px solid #FED7AA" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>{editPL ? "주차장 수정" : "새 주차장 추가"}</div>
                    {/* (구분) 주차장이름 + 도로명주소 */}
                    <div className="mb-3">
                      <div className="flex gap-2 mb-2">
                        {[
                          { val: "본관", type: "internal", color: "#1428A0", bg: "#1428A010" },
                          { val: "외부1", type: "external", color: "#EA580C", bg: "#FFF7ED" },
                          { val: "외부2", type: "external", color: "#7C3AED", bg: "#F3E8FF" },
                          { val: "외부3", type: "external", color: "#0D9488", bg: "#F0FDFA" },
                        ].map(preset => (
                          <button key={preset.val} type="button" onClick={() => setPLForm({ ...plForm, lot_type: preset.type, name: plForm.name || "", ...(plForm.lot_tag !== preset.val ? { lot_tag: preset.val } : {}) })} className="cursor-pointer" style={{
                            padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                            border: (plForm as any).lot_tag === preset.val ? `2px solid ${preset.color}` : "1px solid #e2e8f0",
                            background: (plForm as any).lot_tag === preset.val ? preset.bg : "#fff",
                            color: (plForm as any).lot_tag === preset.val ? preset.color : "#94a3b8"
                          }}>({preset.val})</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>주차장 이름 *</label>
                          <input value={plForm.name} onChange={e => setPLForm({ ...plForm, name: e.target.value })} placeholder="예: 지하1층 주차장" className="w-full" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15, background: "#fff" }} />
                        </div>
                        <div>
                          <label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>주차장 주소지</label>
                          <div className="flex gap-2">
                            <input value={plForm.road_address} readOnly placeholder="주소 검색 클릭" className="flex-1" style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#fff", cursor: "pointer" }}
                              onClick={() => {
                                const openPostcode = () => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setPLForm(prev => ({ ...prev, road_address: data.roadAddress || data.jibunAddress })); } }).open(); };
                                if (typeof window !== "undefined" && (window as any).daum?.Postcode) openPostcode();
                                else { const s = document.createElement("script"); s.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"; s.onload = openPostcode; document.head.appendChild(s); }
                              }}
                            />
                            <button type="button" className="cursor-pointer" onClick={() => {
                              const openPostcode = () => { new (window as any).daum.Postcode({ oncomplete: (data: any) => { setPLForm(prev => ({ ...prev, road_address: data.roadAddress || data.jibunAddress })); } }).open(); };
                              if (typeof window !== "undefined" && (window as any).daum?.Postcode) openPostcode();
                              else { const s = document.createElement("script"); s.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"; s.onload = openPostcode; document.head.appendChild(s); }
                            }} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>🔍</button>
                          </div>
                          {plForm.road_address && <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, background: "#dcfce7", display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 11 }}>✅</span><span style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>{plForm.road_address}</span></div>}
                        </div>
                      </div>
                    </div>
                    {/* 주차면 수 세분화 */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <label style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>🚗 주차면 수</label>
                        <span style={{ padding: "3px 12px", borderRadius: 8, background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}>합계 {(Number(plForm.self_spaces) || 0) + (Number(plForm.mechanical_normal) || 0) + (Number(plForm.mechanical_suv) || 0)}면</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1428A0", marginBottom: 6 }}>🅿️ 자주식</div>
                          <div className="flex items-center gap-2">
                            <input type="number" value={plForm.self_spaces} onChange={e => setPLForm({ ...plForm, self_spaces: e.target.value })} min="0" className="w-full" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, fontWeight: 700, textAlign: "center" }} />
                            <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>면</span>
                          </div>
                        </div>
                        <div style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#EA580C", marginBottom: 6 }}>⚙️ 기계식 일반</div>
                          <div className="flex items-center gap-2">
                            <input type="number" value={plForm.mechanical_normal} onChange={e => setPLForm({ ...plForm, mechanical_normal: e.target.value })} min="0" className="w-full" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, fontWeight: 700, textAlign: "center" }} />
                            <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>면</span>
                          </div>
                        </div>
                        <div style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>🚙 기계식 SUV</div>
                          <div className="flex items-center gap-2">
                            <input type="number" value={plForm.mechanical_suv} onChange={e => setPLForm({ ...plForm, mechanical_suv: e.target.value })} min="0" className="w-full" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, fontWeight: 700, textAlign: "center" }} />
                            <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>면</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* 주차 방식 */}
                    <div className="mb-3">
                      <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>주차 방식 (복수 선택)</label>
                      <div className="flex gap-3">
                        {[
                          { val: "self", label: "자주식", desc: "운전자 직접 주차" },
                          { val: "mechanical", label: "기계식", desc: "기계장치 자동 주차" },
                        ].map(t => (
                          <button key={t.val} type="button" onClick={() => toggleParkingType(t.val)} className="cursor-pointer flex-1" style={{
                            padding: "10px 16px", borderRadius: 10, border: (plForm.parking_type || []).includes(t.val) ? "2px solid #16a34a" : "1px solid #e2e8f0",
                            background: (plForm.parking_type || []).includes(t.val) ? "#dcfce7" : "#fff", textAlign: "center"
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: (plForm.parking_type || []).includes(t.val) ? "#15803d" : "#0f172a" }}>{(plForm.parking_type || []).includes(t.val) ? "✅ " : ""}{t.label}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 운영 요일 */}
                    <div className="mb-3">
                      <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>운영 요일</label>
                      <div className="flex gap-2">
                        {[
                          { key: "mon", label: "월" }, { key: "tue", label: "화" }, { key: "wed", label: "수" },
                          { key: "thu", label: "목" }, { key: "fri", label: "금" }, { key: "sat", label: "토" }, { key: "sun", label: "일" },
                        ].map(d => (
                          <button key={d.key} type="button" onClick={() => toggleDay(d.key)} className="cursor-pointer" style={{
                            width: 40, height: 40, borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700,
                            background: plForm.operating_days?.[d.key] ? "#1428A0" : "#f1f5f9",
                            color: plForm.operating_days?.[d.key] ? "#fff" : "#94a3b8",
                          }}>{d.label}</button>
                        ))}
                      </div>
                    </div>
                    {/* 운영 시간 */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>오픈 시간</label><input type="time" value={plForm.open_time} onChange={e => setPLForm({ ...plForm, open_time: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                      <div><label className="block mb-1" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>마감 시간</label><input type="time" value={plForm.close_time} onChange={e => setPLForm({ ...plForm, close_time: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                    </div>
                    {plMessage && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fee2e2", color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{plMessage}</div>}
                    <div className="flex gap-2">
                      <button onClick={handlePLSave} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#F5B731", color: "#fff", fontSize: 13, fontWeight: 700 }}>{editPL ? "수정" : "추가"}</button>
                      <button onClick={() => { setShowPLForm(false); setEditPL(null); }} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600 }}>취소</button>
                    </div>
                  </div>
                )}
                {parkingLots.length === 0 ? (
                  <div className="text-center py-6" style={{ color: "#94a3b8", fontSize: 13 }}>등록된 주차장이 없습니다</div>
                ) : (
                  <div className="space-y-2">
                    {parkingLots.map(pl => {
                      const days = pl.operating_days || {};
                      const dayLabels = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
                      const activeDays = Object.entries(dayLabels).filter(([k]) => days[k]).map(([, v]) => v).join(" ");
                      return (
                        <div key={pl.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: 16 }}>{pl.lot_type === "internal" ? "🏢" : "🅿️"}</span>
                              <span style={{ padding: "2px 10px", borderRadius: 12, background: pl.lot_type === "internal" ? "#1428A010" : "#FFF7ED", fontSize: 12, fontWeight: 700, color: pl.lot_type === "internal" ? "#1428A0" : "#EA580C" }}>({pl.lot_tag || (pl.lot_type === "internal" ? "본관" : "외부")})</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{pl.name}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => { setEditPL(pl); setPLForm({ name: pl.name, lot_type: pl.lot_type, lot_tag: pl.lot_tag || (pl.lot_type === "internal" ? "본관" : "외부1"), parking_type: pl.parking_type || ["self"], road_address: pl.road_address || "", total_spaces: pl.total_spaces || 0, self_spaces: pl.self_spaces || 0, mechanical_normal: pl.mechanical_normal || 0, mechanical_suv: pl.mechanical_suv || 0, operating_days: pl.operating_days || { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }, open_time: pl.open_time?.slice(0, 5) || "09:00", close_time: pl.close_time?.slice(0, 5) || "22:00" }); setShowPLForm(true); }} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#475569" }}>수정</button>
                              <button onClick={() => deletePL(pl.id)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", fontSize: 11, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {pl.road_address && <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 11, color: "#475569" }}>📍 {pl.road_address}</span>}
                            {(pl.parking_type || []).map((pt, i) => <span key={i} style={{ padding: "3px 8px", borderRadius: 6, background: "#dcfce7", fontSize: 11, color: "#15803d", fontWeight: 600 }}>{pt === "self" ? "자주식" : "기계식"}</span>)}
                            <span style={{ padding: "3px 8px", borderRadius: 6, background: "#1428A010", fontSize: 12, color: "#1428A0", fontWeight: 700 }}>총 {pl.total_spaces || 0}면</span>
                            {(pl.self_spaces > 0) && <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 11, color: "#1428A0", fontWeight: 600 }}>🅿️자주식 {pl.self_spaces}</span>}
                            {(pl.mechanical_normal > 0) && <span style={{ padding: "3px 8px", borderRadius: 6, background: "#FFF7ED", fontSize: 11, color: "#EA580C", fontWeight: 600 }}>⚙️일반 {pl.mechanical_normal}</span>}
                            {(pl.mechanical_suv > 0) && <span style={{ padding: "3px 8px", borderRadius: 6, background: "#F3E8FF", fontSize: 11, color: "#7C3AED", fontWeight: 600 }}>🚙SUV {pl.mechanical_suv}</span>}
                            <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 11, color: "#475569" }}>⏰ {pl.open_time?.slice(0, 5)}~{pl.close_time?.slice(0, 5)}</span>
                            <span style={{ padding: "3px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 11, color: "#475569" }}>📅 {activeDays}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* ─── 운영시간 (매장 수정 시에만) ─── */}
            {editItem && showForm && (
              <div style={{ borderTop: "2px dashed #e2e8f0", paddingTop: 16, marginBottom: 20 }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: 4, height: 24, borderRadius: 2, background: "#0D9488" }} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>운영시간</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>요일별 설정</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const first = inlineHours.find(h => !h.is_closed);
                      if (first) setInlineHours(inlineHours.map(h => ({ ...h, open_time: first.open_time, close_time: first.close_time, is_closed: false })));
                    }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>첫째 행 전체 적용</button>
                    <button onClick={saveInlineHours} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#0D9488", color: "#fff", fontSize: 12, fontWeight: 700 }}>저장</button>
                  </div>
                </div>
                {inlineHoursMsg && <div style={{ padding: "8px 12px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{inlineHoursMsg}</div>}
                <div className="space-y-1.5">
                  {inlineHours.map((h, i) => {
                    const dayNames2 = ["일", "월", "화", "수", "목", "금", "토"];
                    const isWeekend = h.day_of_week === 0 || h.day_of_week === 6;
                    return (
                      <div key={i} className="flex items-center gap-3" style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff", padding: "8px 12px", borderRadius: 8 }}>
                        <span style={{ width: 40, fontSize: 14, fontWeight: 700, color: h.day_of_week === 0 ? "#dc2626" : h.day_of_week === 6 ? "#1428A0" : "#1e293b" }}>{dayNames2[h.day_of_week]}요일</span>
                        <input type="time" value={h.open_time} onChange={e => { const u = [...inlineHours]; u[i] = { ...u[i], open_time: e.target.value }; setInlineHours(u); }} disabled={h.is_closed} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: h.is_closed ? "#94a3b8" : "#1e293b", background: h.is_closed ? "#f1f5f9" : "#fff" }} />
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>~</span>
                        <input type="time" value={h.close_time} onChange={e => { const u = [...inlineHours]; u[i] = { ...u[i], close_time: e.target.value }; setInlineHours(u); }} disabled={h.is_closed} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: h.is_closed ? "#94a3b8" : "#1e293b", background: h.is_closed ? "#f1f5f9" : "#fff" }} />
                        <button onClick={() => { const u = [...inlineHours]; u[i] = { ...u[i], is_closed: !u[i].is_closed }; setInlineHours(u); }} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, background: h.is_closed ? "#fee2e2" : "#f1f5f9", color: h.is_closed ? "#dc2626" : "#94a3b8" }}>{h.is_closed ? "휴무" : "영업"}</button>
                      </div>
                    );
                  })}
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
            {/* ─── 특별추가근무 ─── */}
            <div style={{ borderTop: "2px dashed #e2e8f0", marginTop: 24, paddingTop: 20 }}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: 4, height: 24, borderRadius: 2, background: "#EA580C" }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>특별추가근무</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>운영시간 외 근무</span>
                </div>
                <button onClick={() => { setEditOT(null); setOTForm({ date: "", start_time: "", end_time: "", worker_id: "", note: "" }); setShowOTForm(true); }} className="cursor-pointer" style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EA580C", color: "#fff", fontSize: 13, fontWeight: 700 }}>+ 추가근무 등록</button>
              </div>
              {showOTForm && (
                <div style={{ background: "#FFF7ED", borderRadius: 14, padding: 20, marginBottom: 12, border: "1px solid #FED7AA" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>{editOT ? "추가근무 수정" : "새 추가근무 등록"}</div>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div><label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>날짜 *</label><input type="date" value={otForm.date} onChange={e => setOTForm({ ...otForm, date: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                    <div><label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>시작 시간 *</label><input type="time" value={otForm.start_time} onChange={e => setOTForm({ ...otForm, start_time: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                    <div><label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>종료 시간 *</label><input type="time" value={otForm.end_time} onChange={e => setOTForm({ ...otForm, end_time: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                    <div><label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>근무자 *</label><select value={otForm.worker_id} onChange={e => setOTForm({ ...otForm, worker_id: e.target.value })} className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }}><option value="">선택</option>{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                  </div>
                  <div className="mb-3"><label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>사유</label><input value={otForm.note} onChange={e => setOTForm({ ...otForm, note: e.target.value })} placeholder="예: 야간 행사, 조기 오픈" className="w-full" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" }} /></div>
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FEF3C7", marginBottom: 12, fontSize: 12, color: "#92400e" }}>⚠️ 등록된 특별추가근무는 <b>근무자 관리의 근태, 근무리뷰에 자동 반영</b>됩니다.</div>
                  <div className="flex gap-2">
                    <button onClick={handleOTSave} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#EA580C", color: "#fff", fontSize: 13, fontWeight: 700 }}>{editOT ? "수정" : "등록"}</button>
                    <button onClick={() => { setShowOTForm(false); setEditOT(null); }} className="cursor-pointer" style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600 }}>취소</button>
                  </div>
                </div>
              )}
              {overtimeShifts.length === 0 ? (
                <div className="text-center py-6" style={{ color: "#94a3b8", fontSize: 13 }}>등록된 특별추가근무가 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {overtimeShifts.map(ot => (
                    <div key={ot.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{ot.date}</span>
                          <span style={{ padding: "3px 10px", borderRadius: 6, background: "#FFF7ED", fontSize: 11, fontWeight: 700, color: "#EA580C" }}>{ot.start_time?.slice(0, 5)} ~ {ot.end_time?.slice(0, 5)}</span>
                          <span style={{ padding: "3px 8px", borderRadius: 6, background: "#1428A010", fontSize: 11, fontWeight: 600, color: "#1428A0" }}>{ot.workers?.name || "미지정"}</span>
                          {ot.note && <span style={{ fontSize: 12, color: "#94a3b8" }}>{ot.note}</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEditOT(ot); setOTForm({ date: ot.date, start_time: ot.start_time?.slice(0, 5) || "", end_time: ot.end_time?.slice(0, 5) || "", worker_id: ot.worker_id || "", note: ot.note || "" }); setShowOTForm(true); }} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#475569" }}>수정</button>
                          <button onClick={() => deleteOT(ot.id)} className="cursor-pointer" style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", fontSize: 11, fontWeight: 600, color: "#dc2626" }}>삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      </div>
    </AppLayout>
  );
}