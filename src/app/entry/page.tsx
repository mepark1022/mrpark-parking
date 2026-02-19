// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Store = { id: string; name: string; has_valet: boolean; valet_fee: number };
type Worker = { id: string; name: string };
type DefaultWorker = { id: string; worker_id: string; day_type: string; display_order: number; workers: Worker };
type AssignedWorker = { worker_id: string; worker_type: "default" | "substitute" | "hq"; name: string };

export default function EntryPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [inputMode, setInputMode] = useState<"total" | "hourly">("total");
  const [hourlyData, setHourlyData] = useState<Record<number, number>>({});
  const [totalCarsOnly, setTotalCarsOnly] = useState(0);
  const [valetCount, setValetCount] = useState(0);
  const [valetRevenue, setValetRevenue] = useState(0);
  const [assignedWorkers, setAssignedWorkers] = useState<AssignedWorker[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [storeHours, setStoreHours] = useState<{ open: number; close: number }>({ open: 7, close: 22 });
  const [oid, setOid] = useState<string | null>(null);

  const dayType = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  }, [selectedDate]);

  const totalCars = useMemo(() => {
    if (inputMode === "total") return totalCarsOnly;
    return Object.values(hourlyData).reduce((s, v) => s + (v || 0), 0);
  }, [inputMode, hourlyData, totalCarsOnly]);

  useEffect(() => { loadStoresAndWorkers(); }, []);
  useEffect(() => { if (selectedStore && selectedDate) { loadDefaultWorkers(); loadExistingRecord(); loadStoreHours(); } }, [selectedStore, selectedDate]);

  async function loadStoreHours() {
    const d = new Date(selectedDate);
    const dow = d.getDay(); // 0=일, 1=월...6=토
    const { data } = await supabase.from("store_operating_hours").select("open_time, close_time, is_closed").eq("store_id", selectedStore).eq("day_of_week", dow).single();
    if (data && !data.is_closed) {
      const open = parseInt(data.open_time?.split(":")[0] || "7");
      const close = parseInt(data.close_time?.split(":")[0] || "22");
      setStoreHours({ open, close });
    } else {
      setStoreHours({ open: 7, close: 22 }); // 기본값
    }
  }

  async function loadStoresAndWorkers() {
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    setOid(ctx.orgId);
    let storesQuery = supabase.from("stores").select("id, name, has_valet, valet_fee").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) storesQuery = storesQuery.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const [storesRes, workersRes] = await Promise.all([
      storesQuery,
      supabase.from("workers").select("id, name").eq("org_id", ctx.orgId).eq("status", "active").order("name"),
    ]);
    if (storesRes.data) {
      setStores(storesRes.data);
      if (storesRes.data.length > 0) setSelectedStore(storesRes.data[0].id);
    }
    if (workersRes.data) setWorkers(workersRes.data);
  }

  async function loadDefaultWorkers() {
    const { data } = await supabase
      .from("default_workers")
      .select("id, worker_id, day_type, display_order, workers(id, name)")
      .eq("store_id", selectedStore)
      .eq("day_type", dayType)
      .order("display_order");
    if (data) {
      setAssignedWorkers(data.map((d: any) => ({ worker_id: d.worker_id, worker_type: "default" as const, name: d.workers?.name || "" })));
    }
  }

  async function loadExistingRecord() {
    const { data } = await supabase
      .from("daily_records")
      .select("id, total_cars, valet_count, valet_revenue, memo")
      .eq("store_id", selectedStore)
      .eq("date", selectedDate)
      .single();
    if (data) {
      setExistingRecordId(data.id);
      setValetCount(data.valet_count || 0);
      setValetRevenue(data.valet_revenue || 0);
      setMemo(data.memo || "");
      const { data: hData } = await supabase.from("hourly_data").select("hour, car_count").eq("record_id", data.id);
      if (hData && hData.length > 0) {
        const hMap: Record<number, number> = {};
        hData.forEach((h: any) => { hMap[h.hour] = h.car_count; });
        setHourlyData(hMap);
        setInputMode("hourly");
        setTotalCarsOnly(0);
      } else {
        setHourlyData({});
        setInputMode("total");
        setTotalCarsOnly(data.total_cars || 0);
      }
    } else {
      setExistingRecordId(null);
      setHourlyData({});
      setTotalCarsOnly(0);
      setValetCount(0);
      setValetRevenue(0);
      setMemo("");
    }
  }

  function addWorker(type: "substitute" | "hq") {
    setAssignedWorkers([...assignedWorkers, { worker_id: "", worker_type: type, name: "" }]);
  }

  function removeWorker(idx: number) {
    setAssignedWorkers(assignedWorkers.filter((_, i) => i !== idx));
  }

  function updateWorker(idx: number, workerId: string) {
    const w = workers.find((w) => w.id === workerId);
    const updated = [...assignedWorkers];
    updated[idx] = { ...updated[idx], worker_id: workerId, name: w?.name || "" };
    setAssignedWorkers(updated);
  }

  async function handleSave() {
    if (!selectedStore) return;
    setSaving(true);
    setMessage("");

    try {
      let recordId = existingRecordId;
      const recordData = {
        store_id: selectedStore,
        date: selectedDate,
        total_cars: totalCars,
        valet_count: valetCount,
        valet_revenue: valetRevenue,
        memo: memo || null,
      };

      if (recordId) {
        const { error: updErr } = await supabase.from("daily_records").update(recordData).eq("id", recordId);
        if (updErr) { setMessage(`수정 실패: ${updErr.message}`); setSaving(false); return; }
        await supabase.from("hourly_data").delete().eq("record_id", recordId);
        await supabase.from("worker_assignments").delete().eq("record_id", recordId);
      } else {
        const { data, error: insErr } = await supabase.from("daily_records").insert({ ...recordData, org_id: oid || await getOrgId() }).select("id").single();
        if (insErr) { setMessage(`저장 실패: ${insErr.message}`); setSaving(false); return; }
        recordId = data?.id;
      }

      if (recordId && inputMode === "hourly") {
        const hourlyInserts = Object.entries(hourlyData)
          .filter(([_, v]) => v > 0)
          .map(([h, v]) => ({ record_id: recordId, hour: Number(h), car_count: v }));
        if (hourlyInserts.length > 0) {
          await supabase.from("hourly_data").insert(hourlyInserts);
        }
      }

      if (recordId) {
        const workerInserts = assignedWorkers
          .filter((w) => w.worker_id)
          .map((w, i) => ({ record_id: recordId, worker_id: w.worker_id, worker_type: w.worker_type, display_order: i + 1 }));
        if (workerInserts.length > 0) {
          await supabase.from("worker_assignments").insert(workerInserts);
        }
      }

      setExistingRecordId(recordId);
      setMessage("저장 완료!");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setMessage(`저장 실패: ${e?.message || JSON.stringify(e)}`);
    }
    setSaving(false);
  }

  const currentStore = stores.find((s) => s.id === selectedStore);

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex flex-wrap items-center gap-5 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">매장 선택</label>
            <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium min-w-[180px]">
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">날짜</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium" />
          </div>
          <div className="pt-6">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${dayType === "weekday" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}>
              {dayType === "weekday" ? "평일" : "주말"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">입차량</h3>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setInputMode("total")}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${inputMode === "total" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                  총 대수만
                </button>
                <button
                  onClick={() => setInputMode("hourly")}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${inputMode === "hourly" ? "bg-primary text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                  시간대별
                </button>
              </div>
            </div>

            {inputMode === "total" ? (
              <div className="flex items-center gap-4 py-8">
                <label className="text-base font-bold text-gray-700">총 입차량</label>
                <input
                  type="number"
                  min="0"
                  value={totalCarsOnly || ""}
                  onChange={(e) => setTotalCarsOnly(Number(e.target.value))}
                  className="w-40 px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="0"
                />
                <span className="text-base font-semibold text-gray-600">대</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {Array.from({ length: storeHours.close - storeHours.open + 1 }, (_, i) => i + storeHours.open).map((hour) => (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-bold text-gray-700 text-right">{String(hour).padStart(2, "0")}시</span>
                    <input
                      type="number"
                      min="0"
                      value={hourlyData[hour] || ""}
                      onChange={(e) => setHourlyData({ ...hourlyData, [hour]: Number(e.target.value) })}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-500">대</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-200">
              <span className="text-base font-bold text-gray-900">총 입차량</span>
              <span className="text-xl font-extrabold text-primary">{totalCars.toLocaleString()}대</span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {currentStore?.has_valet && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">발렛 정보</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="w-20 text-sm font-bold text-gray-700">발렛 건수</label>
                    <input type="number" min="0" value={valetCount || ""} onChange={(e) => { setValetCount(Number(e.target.value)); setValetRevenue(Number(e.target.value) * (currentStore?.valet_fee || 5000)); }} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-semibold text-gray-900" placeholder="0" />
                    <span className="text-sm text-gray-500">건</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-20 text-sm font-bold text-gray-700">발렛 매출</label>
                    <input type="number" min="0" value={valetRevenue || ""} onChange={(e) => setValetRevenue(Number(e.target.value))} className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm font-semibold text-gray-900" placeholder="0" />
                    <span className="text-sm text-gray-500">원 (단가: {(currentStore?.valet_fee || 5000).toLocaleString()}원)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">근무자 ({dayType === "weekday" ? "평일" : "주말"} 기본)</h3>
                <div className="flex gap-2">
                  <button onClick={() => addWorker("substitute")} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-200">+ 대체</button>
                  <button onClick={() => addWorker("hq")} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200">+ 본사</button>
                </div>
              </div>
              <div className="space-y-2">
                {assignedWorkers.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${w.worker_type === "default" ? "bg-green-100 text-green-700" : w.worker_type === "substitute" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>
                      {w.worker_type === "default" ? "기본" : w.worker_type === "substitute" ? "대체" : "본사"}
                    </span>
                    <select value={w.worker_id} onChange={(e) => updateWorker(idx, e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900">
                      <option value="">선택</option>
                      {workers.map((wk) => (<option key={wk.id} value={wk.id}>{wk.name}</option>))}
                    </select>
                    {w.worker_type !== "default" && (
                      <button onClick={() => removeWorker(idx)} className="text-red-500 text-lg font-bold hover:text-red-700">✕</button>
                    )}
                  </div>
                ))}
                {assignedWorkers.length === 0 && <p className="text-sm text-gray-400 text-center py-3">배정된 근무자가 없습니다</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">메모</h3>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="특이사항 입력..."
              />
            </div>

            {/* PC 저장 버튼 */}
            <div className="hidden md:block">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 bg-primary text-white rounded-xl text-base font-bold hover:bg-primary-dark disabled:opacity-50 shadow-md transition-all"
              >
                {saving ? "저장 중..." : existingRecordId ? "수정 저장" : "저장"}
              </button>
            </div>
            {/* 모바일 하단 여백 확보 */}
            <div className="md:hidden" style={{ height: 80 }} />
          </div>
        </div>
      </div>

      {/* 모바일 하단 고정 저장 버튼 */}
      <div className="md:hidden" style={{
        position: "fixed", bottom: 60, left: 0, right: 0, zIndex: 150,
        padding: "10px 16px", background: "#fff",
        borderTop: "1px solid #e2e8f0",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12,
            background: saving ? "#94a3b8" : "#1428A0", color: "#fff",
            fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
          }}
        >
          {saving ? "저장 중..." : existingRecordId ? "수정 저장" : "저장"}
        </button>
      </div>

      {/* 토스트 알림 */}
      {message && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "14px 28px", borderRadius: 12,
          background: message.includes("완료") ? "#15803d" : "#dc2626",
          color: "#fff", fontSize: 15, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          animation: "fadeIn 0.3s ease",
        }}>
          {message.includes("완료") ? "✅ " : "❌ "}{message}
        </div>
      )}
    </AppLayout>
  );
}