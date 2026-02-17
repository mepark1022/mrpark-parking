// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [stores, setStores] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [weekdayWorkers, setWeekdayWorkers] = useState([]);
  const [weekendWorkers, setWeekendWorkers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedStore) loadDefaultWorkers();
  }, [selectedStore]);

  const loadData = async () => {
    const supabase = createClient();
    const { data: storeData } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
    const { data: workerData } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
    if (storeData) {
      setStores(storeData);
      if (storeData.length > 0) setSelectedStore(storeData[0].id);
    }
    if (workerData) setWorkers(workerData);
  };

  const loadDefaultWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("store_default_workers")
      .select("*, workers(name)")
      .eq("store_id", selectedStore)
      .order("display_order");
    if (data) {
      setWeekdayWorkers(data.filter(d => d.day_type === "weekday"));
      setWeekendWorkers(data.filter(d => d.day_type === "weekend"));
    }
  };

  const addDefaultWorker = async (dayType) => {
    const existing = dayType === "weekday" ? weekdayWorkers : weekendWorkers;
    const existingIds = existing.map(w => w.worker_id);
    const available = workers.filter(w => !existingIds.includes(w.id));
    if (available.length === 0) {
      setMessage("추가할 수 있는 근무자가 없습니다");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    const supabase = createClient();
    await supabase.from("store_default_workers").insert({
      store_id: selectedStore,
      worker_id: available[0].id,
      day_type: dayType,
      display_order: existing.length + 1,
    });
    loadDefaultWorkers();
  };

  const removeDefaultWorker = async (id) => {
    const supabase = createClient();
    await supabase.from("store_default_workers").delete().eq("id", id);
    loadDefaultWorkers();
  };

  const changeWorker = async (id, newWorkerId) => {
    const supabase = createClient();
    await supabase.from("store_default_workers").update({ worker_id: newWorkerId }).eq("id", id);
    loadDefaultWorkers();
  };

  const renderWorkerList = (list, dayType) => (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", flex: 1 }}>
      <div className="flex justify-between items-center mb-4">
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
          {dayType === "weekday" ? "평일 근무자 (월~금)" : "주말 근무자 (토~일)"}
        </div>
        <button
          onClick={() => addDefaultWorker(dayType)}
          className="cursor-pointer"
          style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700 }}
        >+ 추가</button>
      </div>
      {list.length === 0 ? (
        <div className="text-center py-6" style={{ color: "#94a3b8", fontSize: 14 }}>배정된 근무자가 없습니다</div>
      ) : (
        list.map((dw, i) => (
          <div key={dw.id} className="flex items-center gap-3 mb-2" style={{
            padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", width: 24 }}>{i + 1}</span>
            <select
              value={dw.worker_id}
              onChange={e => changeWorker(dw.id, e.target.value)}
              className="flex-1"
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}
            >
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button
              onClick={() => removeDefaultWorker(dw.id)}
              className="cursor-pointer"
              style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: "#fee2e2", color: "#dc2626", fontSize: 16, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>기본 근무자 설정</div>

          <div className="mb-6">
            <label className="block mb-2" style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>매장 선택</label>
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600, color: "#1e293b", minWidth: 280 }}
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {message && (
            <div className="mb-4" style={{ padding: "10px 16px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{message}</div>
          )}

          <div className="flex gap-4">
            {renderWorkerList(weekdayWorkers, "weekday")}
            {renderWorkerList(weekendWorkers, "weekend")}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}