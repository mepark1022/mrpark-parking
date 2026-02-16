"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import type { Store, Worker } from "@/lib/types/database";

type DefaultWorkerRow = {
  worker_id: string;
  day_type: string;
  workers: { id: string; name: string } | null;
};

type AssignedWorker = {
  worker_id: string;
  name: string;
  worker_type: "default" | "substitute" | "hq_support";
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

export default function EntryPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [hourlyCars, setHourlyCars] = useState<Record<number, number>>({});
  const [valetCount, setValetCount] = useState(0);
  const [valetRevenue, setValetRevenue] = useState(0);
  const [note, setNote] = useState("");
  const [assignedWorkers, setAssignedWorkers] = useState<AssignedWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadDefaultWorkers();
      loadExistingRecord();
    }
  }, [selectedStore, selectedDate]);

  async function loadInitial() {
    setLoading(true);
    const [storesRes, workersRes] = await Promise.all([
      supabase.from("stores").select("*").eq("is_active", true).order("name"),
      supabase.from("workers").select("*").eq("status", "active").order("name"),
    ]);
    if (storesRes.data) {
      setStores(storesRes.data);
      if (storesRes.data.length > 0) setSelectedStore(storesRes.data[0].id);
    }
    if (workersRes.data) setAllWorkers(workersRes.data);
    setLoading(false);
  }

  async function loadDefaultWorkers() {
    const dayOfWeek = new Date(selectedDate).getDay();
    const dayType = dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday";

    const { data } = await supabase
      .from("store_default_workers")
      .select("worker_id, day_type, workers(id, name)")
      .eq("store_id", selectedStore)
      .eq("day_type", dayType)
      .order("sort_order");

    if (data) {
      const defaults: AssignedWorker[] = data
        .filter((d: DefaultWorkerRow) => d.workers)
        .map((d: DefaultWorkerRow) => ({
          worker_id: d.workers!.id,
          name: d.workers!.name,
          worker_type: "default" as const,
        }));
      setAssignedWorkers(defaults);
    }
  }

  async function loadExistingRecord() {
    const { data: record } = await supabase
      .from("daily_records")
      .select("*")
      .eq("store_id", selectedStore)
      .eq("date", selectedDate)
      .single();

    if (record) {
      setExistingRecordId(record.id);
      setValetCount(record.valet_count);
      setValetRevenue(record.valet_revenue);
      setNote(record.note || "");

      const { data: hourlyData } = await supabase
        .from("hourly_data")
        .select("hour, car_count")
        .eq("record_id", record.id);

      if (hourlyData) {
        const hourMap: Record<number, number> = {};
        hourlyData.forEach((h) => { hourMap[h.hour] = h.car_count; });
        setHourlyCars(hourMap);
      }

      const { data: assignments } = await supabase
        .from("worker_assignments")
        .select("worker_id, worker_type, workers:worker_id(id, name)")
        .eq("record_id", record.id);

      if (assignments && assignments.length > 0) {
        const workers: AssignedWorker[] = assignments.map((a: { worker_id: string; worker_type: string; workers: { id: string; name: string } | null }) => ({
          worker_id: a.worker_id,
          name: a.workers?.name || "알 수 없음",
          worker_type: a.worker_type as "default" | "substitute" | "hq_support",
        }));
        setAssignedWorkers(workers);
      }
    } else {
      setExistingRecordId(null);
      setHourlyCars({});
      setValetCount(0);
      setValetRevenue(0);
      setNote("");
    }
  }

  function getTotalCars(): number {
    return Object.values(hourlyCars).reduce((sum, v) => sum + (v || 0), 0);
  }

  function getDayTypeLabel(): string {
    const dayOfWeek = new Date(selectedDate).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? "주말" : "평일";
  }

  function addSubstitute() {
    const usedIds = assignedWorkers.map((w) => w.worker_id);
    const available = allWorkers.filter((w) => !usedIds.includes(w.id));
    if (available.length === 0) { alert("추가할 수 있는 근무자가 없습니다."); return; }
    setAssignedWorkers([...assignedWorkers, {
      worker_id: available[0].id, name: available[0].name, worker_type: "substitute",
    }]);
  }

  function addHqSupport() {
    const usedIds = assignedWorkers.map((w) => w.worker_id);
    const available = allWorkers.filter((w) => !usedIds.includes(w.id));
    if (available.length === 0) { alert("추가할 수 있는 근무자가 없습니다."); return; }
    setAssignedWorkers([...assignedWorkers, {
      worker_id: available[0].id, name: available[0].name, worker_type: "hq_support",
    }]);
  }

  function removeWorker(index: number) {
    setAssignedWorkers(assignedWorkers.filter((_, i) => i !== index));
  }

  function changeWorker(index: number, newWorkerId: string) {
    const worker = allWorkers.find((w) => w.id === newWorkerId);
    if (!worker) return;
    const updated = [...assignedWorkers];
    updated[index] = { ...updated[index], worker_id: newWorkerId, name: worker.name };
    setAssignedWorkers(updated);
  }

  async function handleSave() {
    if (!selectedStore || !selectedDate) return;
    setSaving(true);
    setSaveMessage("");

    try {
      const totalCars = getTotalCars();
      const { data: { user } } = await supabase.auth.getUser();

      let recordId = existingRecordId;

      if (recordId) {
        await supabase.from("daily_records").update({
          total_cars: totalCars,
          valet_count: valetCount,
          valet_revenue: valetRevenue,
          note: note || null,
        }).eq("id", recordId);

        await supabase.from("hourly_data").delete().eq("record_id", recordId);
        await supabase.from("worker_assignments").delete().eq("record_id", recordId);
      } else {
        const { data: newRecord, error } = await supabase.from("daily_records").insert({
          store_id: selectedStore,
          date: selectedDate,
          total_cars: totalCars,
          valet_count: valetCount,
          valet_revenue: valetRevenue,
          note: note || null,
          created_by: user?.id || null,
        }).select().single();

        if (error) throw error;
        recordId = newRecord.id;
        setExistingRecordId(recordId);
      }

      const hourlyRows = HOURS
        .filter((h) => hourlyCars[h] && hourlyCars[h] > 0)
        .map((h) => ({ record_id: recordId!, hour: h, car_count: hourlyCars[h] }));

      if (hourlyRows.length > 0) {
        await supabase.from("hourly_data").insert(hourlyRows);
      }

      const workerRows = assignedWorkers.map((w) => ({
        record_id: recordId!,
        worker_id: w.worker_id,
        worker_type: w.worker_type,
      }));

      if (workerRows.length > 0) {
        await supabase.from("worker_assignments").insert(workerRows);
      }

      setSaveMessage("저장 완료!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage("저장 실패. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "default": return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">기본</span>;
      case "substitute": return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">대체</span>;
      case "hq_support": return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs">본사</span>;
      default: return null;
    }
  }

  const selectedStoreName = stores.find((s) => s.id === selectedStore)?.name || "";
  const selectedStoreValetFee = stores.find((s) => s.id === selectedStore)?.valet_fee || 0;

  if (loading) {
    return <AppLayout><div className="text-center py-10 text-mr-gray">로딩 중...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-dark mb-1">매장 선택</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-48 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark mb-1">날짜</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="pt-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDayTypeLabel() === "주말" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
              {getDayTypeLabel()}
            </span>
            {existingRecordId && <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">수정 모드</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-dark mb-4">시간대별 입차량</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {HOURS.map((hour) => (
                <div key={hour} className="flex items-center gap-3">
                  <span className="text-sm text-mr-gray w-12">{String(hour).padStart(2, "0")}시</span>
                  <input
                    type="number"
                    min={0}
                    value={hourlyCars[hour] || ""}
                    onChange={(e) => setHourlyCars({ ...hourlyCars, [hour]: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 border border-light-gray rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                  <span className="text-xs text-mr-gray">대</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-light-gray">
              <div className="flex justify-between text-sm font-semibold">
                <span>총 입차량</span>
                <span className="text-primary">{getTotalCars().toLocaleString()}대</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-dark mb-4">발렛 정보</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-mr-gray w-20">발렛 건수</label>
                  <input
                    type="number"
                    min={0}
                    value={valetCount || ""}
                    onChange={(e) => {
                      const count = Number(e.target.value) || 0;
                      setValetCount(count);
                      setValetRevenue(count * selectedStoreValetFee);
                    }}
                    className="w-24 px-2 py-1 border border-light-gray rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                  <span className="text-xs text-mr-gray">건</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-mr-gray w-20">발렛 매출</label>
                  <input
                    type="number"
                    min={0}
                    value={valetRevenue || ""}
                    onChange={(e) => setValetRevenue(Number(e.target.value) || 0)}
                    className="w-32 px-2 py-1 border border-light-gray rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                  <span className="text-xs text-mr-gray">원 (단가: {selectedStoreValetFee.toLocaleString()}원)</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dark">근무자 ({getDayTypeLabel()} 기본)</h3>
                <div className="flex gap-2">
                  <button onClick={addSubstitute} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs hover:bg-orange-200">+ 대체</button>
                  <button onClick={addHqSupport} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs hover:bg-purple-200">+ 본사</button>
                </div>
              </div>
              {assignedWorkers.length === 0 ? (
                <p className="text-sm text-mr-gray py-2 text-center">배정된 근무자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {assignedWorkers.map((aw, idx) => {
                    const usedIds = assignedWorkers.filter((_, i) => i !== idx).map((w) => w.worker_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        {getTypeBadge(aw.worker_type)}
                        <select
                          value={aw.worker_id}
                          onChange={(e) => changeWorker(idx, e.target.value)}
                          className="flex-1 px-2 py-1 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {allWorkers
                            .filter((w) => w.id === aw.worker_id || !usedIds.includes(w.id))
                            .map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        {aw.worker_type !== "default" && (
                          <button onClick={() => removeWorker(idx)} className="text-error text-sm hover:bg-red-50 rounded p-1">X</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-dark mb-3">메모</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="특이사항 입력..."
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm">
            {saveMessage && (
              <span className={saveMessage.includes("완료") ? "text-success" : "text-error"}>
                {saveMessage}
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !selectedStore}
            className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : existingRecordId ? "수정 저장" : "저장"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}