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

export default function StoresPage() {
  const [tab, setTab] = useState("list");
  const [stores, setStores] = useState([]);
  const [regions, setRegions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "",
  });
  const [message, setMessage] = useState("");

  // 운영시간
  const [selectedStore, setSelectedStore] = useState("");
  const [hours, setHours] = useState([]);
  const [hoursMessage, setHoursMessage] = useState("");

  useEffect(() => {
    loadStores();
    loadRegions();
  }, []);

  useEffect(() => {
    if (selectedStore && tab === "hours") loadHours();
  }, [selectedStore, tab]);

  const loadStores = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("stores").select("*, regions(name)").order("name");
    if (data) {
      setStores(data);
      if (data.length > 0 && !selectedStore) setSelectedStore(data[0].id);
    }
  };

  const loadRegions = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("regions").select("*").order("name");
    if (data) setRegions(data);
  };

  const loadHours = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("store_operating_hours")
      .select("*")
      .eq("store_id", selectedStore)
      .order("day_of_week");

    if (data && data.length > 0) {
      setHours(data);
    } else {
      // 기본값 생성
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        id: null,
        store_id: selectedStore,
        day_of_week: i,
        open_time: "09:00",
        close_time: "22:00",
        is_closed: false,
      }));
      setHours(defaults);
    }
  };

  const updateHour = (index, field, value) => {
    const updated = [...hours];
    updated[index] = { ...updated[index], [field]: value };
    setHours(updated);
  };

  const saveHours = async () => {
    const supabase = createClient();
    for (const h of hours) {
      const payload = {
        store_id: selectedStore,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      };
      if (h.id) {
        await supabase.from("store_operating_hours").update(payload).eq("id", h.id);
      } else {
        await supabase.from("store_operating_hours").upsert(payload, { onConflict: "store_id,day_of_week" });
      }
    }
    setHoursMessage("운영시간이 저장되었습니다!");
    setTimeout(() => setHoursMessage(""), 2000);
    loadHours();
  };

  const applyToAll = () => {
    if (hours.length === 0) return;
    const first = hours.find(h => !h.is_closed);
    if (!first) return;
    const updated = hours.map(h => ({
      ...h,
      open_time: first.open_time,
      close_time: first.close_time,
      is_closed: false,
    }));
    setHours(updated);
  };

  // 매장 CRUD
  const handleSave = async () => {
    if (!formData.name) { setMessage("매장명을 입력하세요"); return; }
    const supabase = createClient();
    const payload = {
      name: formData.name,
      region_id: formData.region_id || null,
      has_valet: formData.has_valet,
      valet_fee: formData.has_valet ? Number(formData.valet_fee) || 0 : 0,
      address: formData.address || null,
    };
    if (editItem) {
      await supabase.from("stores").update(payload).eq("id", editItem.id);
    } else {
      await supabase.from("stores").insert({ ...payload, is_active: true });
    }
    setShowForm(false);
    setEditItem(null);
    setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" });
    setMessage("");
    loadStores();
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
        <div
          className="flex gap-1 mb-6"
          style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}
        >
          {storeTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="cursor-pointer"
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? "#1428A0" : "#475569",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* ===== 매장 목록 탭 ===== */}
        {tab === "list" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>전체 매장 ({stores.length})</div>
              <button
                onClick={() => { setEditItem(null); setFormData({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" }); setShowForm(true); }}
                className="cursor-pointer"
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}
              >+ 매장 추가</button>
            </div>

            {showForm && (
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>{editItem ? "매장 수정" : "매장 추가"}</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장명 *</label>
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="매장명" className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역</label>
                    <select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value })} className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}>
                      <option value="">선택</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>주소</label>
                    <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="주소" className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>발렛비</label>
                    <input type="number" value={formData.valet_fee} onChange={e => setFormData({ ...formData, valet_fee: e.target.value })} className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }} />
                  </div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    {editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600 }}>
                    취소</button>
                </div>
              </div>
            )}

            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["매장명", "지역", "발렛", "발렛비", "상태", "관리"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{s.regions?.name || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.has_valet ? "#1428A015" : "#f1f5f9", color: s.has_valet ? "#1428A0" : "#94a3b8" }}>
                        {s.has_valet ? "O" : "X"}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>₩{(s.valet_fee || 0).toLocaleString()}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.is_active ? "#dcfce7" : "#fff7ed", color: s.is_active ? "#15803d" : "#c2410c" }}>
                        {s.is_active ? "운영중" : "일시중지"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditItem(s);
                          setFormData({ name: s.name, region_id: s.region_id || "", has_valet: s.has_valet, valet_fee: s.valet_fee || 0, address: s.address || "" });
                          setShowForm(true);
                        }} className="cursor-pointer" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569" }}>수정</button>
                        <button onClick={() => toggleStatus(s)} className="cursor-pointer" style={{
                          padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                          background: s.is_active ? "#fff7ed" : "#dcfce7", color: s.is_active ? "#c2410c" : "#15803d",
                        }}>{s.is_active ? "중지" : "운영"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== 운영시간 탭 ===== */}
        {tab === "hours" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>운영시간 설정</div>
              <div className="flex gap-2">
                <button onClick={applyToAll} className="cursor-pointer" style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
                  background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569",
                }}>첫째 행 전체 적용</button>
                <button onClick={saveHours} className="cursor-pointer" style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700,
                }}>저장</button>
              </div>
            </div>

            {/* 매장 선택 */}
            <div className="mb-5">
              <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매장 선택</label>
              <select
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, minWidth: 250 }}
              >
                {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {hoursMessage && (
              <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 600 }}>{hoursMessage}</div>
            )}

            {/* 요일별 시간 */}
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["요일", "오픈 시간", "마감 시간", "휴무"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((h, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: h.day_of_week === 0 ? "#dc2626" : h.day_of_week === 6 ? "#1428A0" : "#1e293b" }}>
                      {dayNames[h.day_of_week]}요일
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <input
                        type="time"
                        value={h.open_time}
                        onChange={e => updateHour(i, "open_time", e.target.value)}
                        disabled={h.is_closed}
                        style={{
                          padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                          fontSize: 14, color: h.is_closed ? "#94a3b8" : "#1e293b",
                          background: h.is_closed ? "#f1f5f9" : "#fff",
                        }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <input
                        type="time"
                        value={h.close_time}
                        onChange={e => updateHour(i, "close_time", e.target.value)}
                        disabled={h.is_closed}
                        style={{
                          padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                          fontSize: 14, color: h.is_closed ? "#94a3b8" : "#1e293b",
                          background: h.is_closed ? "#f1f5f9" : "#fff",
                        }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => updateHour(i, "is_closed", !h.is_closed)}
                        className="cursor-pointer"
                        style={{
                          padding: "6px 16px", borderRadius: 8, border: "none",
                          fontSize: 12, fontWeight: 700,
                          background: h.is_closed ? "#fee2e2" : "#f1f5f9",
                          color: h.is_closed ? "#dc2626" : "#94a3b8",
                        }}
                      >{h.is_closed ? "휴무" : "영업"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== 나머지 탭 ===== */}
        {!["list", "hours"].includes(tab) && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{storeTabs.find(t => t.id === tab)?.label} 설정</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>개발 예정입니다</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}