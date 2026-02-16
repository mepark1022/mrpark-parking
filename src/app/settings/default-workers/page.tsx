"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import type { Store, Worker } from "@/lib/types/database";

type DefaultWorkerRow = {
  id: string;
  worker_id: string;
  day_type: string;
  sort_order: number;
  workers: { id: string; name: string } | null;
};

export default function DefaultWorkersPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [weekdayWorkers, setWeekdayWorkers] = useState<DefaultWorkerRow[]>([]);
  const [weekendWorkers, setWeekendWorkers] = useState<DefaultWorkerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoresAndWorkers();
  }, []);

  useEffect(() => {
    if (selectedStore) loadDefaultWorkers();
  }, [selectedStore]);

  async function loadStoresAndWorkers() {
    const [storesRes, workersRes] = await Promise.all([
      supabase.from("stores").select("*").eq("is_active", true).order("name"),
      supabase.from("workers").select("*").eq("status", "active").order("name"),
    ]);
    if (storesRes.data) {
      setStores(storesRes.data);
      if (storesRes.data.length > 0) setSelectedStore(storesRes.data[0].id);
    }
    if (workersRes.data) setWorkers(workersRes.data);
    setLoading(false);
  }

  async function loadDefaultWorkers() {
    const { data } = await supabase
      .from("store_default_workers")
      .select("*, workers(id, name)")
      .eq("store_id", selectedStore)
      .order("sort_order");

    if (data) {
      setWeekdayWorkers(data.filter((d: DefaultWorkerRow) => d.day_type === "weekday"));
      setWeekendWorkers(data.filter((d: DefaultWorkerRow) => d.day_type === "weekend"));
    }
  }

  async function addWorker(dayType: "weekday" | "weekend") {
    const current = dayType === "weekday" ? weekdayWorkers : weekendWorkers;
    const usedIds = current.map((w) => w.worker_id);
    const available = workers.filter((w) => !usedIds.includes(w.id));

    if (available.length === 0) {
      alert("추가할 수 있는 근무자가 없습니다.");
      return;
    }

    const workerId = available[0].id;
    await supabase.from("store_default_workers").insert({
      store_id: selectedStore,
      worker_id: workerId,
      day_type: dayType,
      sort_order: current.length,
    });
    loadDefaultWorkers();
  }

  async function removeWorker(id: string) {
    await supabase.from("store_default_workers").delete().eq("id", id);
    loadDefaultWorkers();
  }

  async function changeWorker(id: string, newWorkerId: string) {
    await supabase.from("store_default_workers").update({ worker_id: newWorkerId }).eq("id", id);
    loadDefaultWorkers();
  }

  function WorkerList({
    title,
    dayType,
    list,
  }: {
    title: string;
    dayType: "weekday" | "weekend";
    list: DefaultWorkerRow[];
  }) {
    const usedIds = list.map((w) => w.worker_id);

    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-dark">{title}</h4>
          <button
            onClick={() => addWorker(dayType)}
            className="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark"
          >
            + 추가
          </button>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-mr-gray py-4 text-center">
            배정된 근무자가 없습니다
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-mr-gray w-6">{idx + 1}</span>
                <select
                  value={item.worker_id}
                  onChange={(e) => changeWorker(item.id, e.target.value)}
                  className="flex-1 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {workers
                    .filter((w) => w.id === item.worker_id || !usedIds.includes(w.id))
                    .map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <button
                  onClick={() => removeWorker(item.id)}
                  className="text-error hover:bg-red-50 rounded-lg p-2 text-sm"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-10 text-mr-gray">로딩 중...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <label className="block text-sm font-medium text-dark mb-2">매장 선택</label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-64 px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <WorkerList title="평일 근무자 (월~금)" dayType="weekday" list={weekdayWorkers} />
          <WorkerList title="주말 근무자 (토~일)" dayType="weekend" list={weekendWorkers} />
        </div>
      </div>
    </AppLayout>
  );
}