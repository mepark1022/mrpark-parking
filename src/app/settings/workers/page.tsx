// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import type { Worker, Region } from "@/lib/types/database";

export default function WorkersPage() {
  const supabase = createClient();
  const [workers, setWorkers] = useState<(Worker & { regions: Region | null })[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", phone: "", region_id: "", status: "active" as "active" | "inactive",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [workersRes, regionsRes] = await Promise.all([
      supabase.from("workers").select("*, regions(*)").order("name"),
      supabase.from("regions").select("*").order("name"),
    ]);
    if (workersRes.data) setWorkers(workersRes.data as (Worker & { regions: Region | null })[]);
    if (regionsRes.data) setRegions(regionsRes.data);
    setLoading(false);
  }

  function openCreate() {
    setEditWorker(null);
    setForm({ name: "", phone: "", region_id: "", status: "active" });
    setShowForm(true);
  }

  function openEdit(worker: Worker) {
    setEditWorker(worker);
    setForm({ name: worker.name, phone: worker.phone || "", region_id: worker.region_id || "", status: worker.status });
    setShowForm(true);
  }

  async function handleSave() {
    const data = { name: form.name, phone: form.phone || null, region_id: form.region_id || null, status: form.status };
    if (editWorker) {
      await supabase.from("workers").update(data).eq("id", editWorker.id);
    } else {
      await supabase.from("workers").insert(data);
    }
    setShowForm(false);
    loadData();
  }

  async function toggleStatus(worker: Worker) {
    const newStatus = worker.status === "active" ? "inactive" : "active";
    await supabase.from("workers").update({ status: newStatus }).eq("id", worker.id);
    loadData();
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">근무자 목록</h3>
          <button onClick={openCreate} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark">+ 근무자 추가</button>
        </div>
        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-light-gray">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">이름</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">연락처</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">지역</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">상태</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">관리</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-b border-light-gray last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-dark font-medium">{worker.name}</td>
                    <td className="px-4 py-3 text-sm text-mr-gray">{worker.phone || "-"}</td>
                    <td className="px-4 py-3 text-sm text-mr-gray">{worker.regions?.name || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${worker.status === "active" ? "bg-green-100 text-success" : "bg-gray-100 text-mr-gray"}`}>
                        {worker.status === "active" ? "활동중" : "비활동"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => openEdit(worker)} className="text-primary hover:underline">수정</button>
                      <button onClick={() => toggleStatus(worker)} className="text-mr-gray hover:underline">{worker.status === "active" ? "비활성" : "활성"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold text-dark mb-4">{editWorker ? "근무자 수정" : "근무자 추가"}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">이름 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="홍길동" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">연락처</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="010-1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">지역</label>
                  <select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })} className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">선택 안 함</option>
                    {regions.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">상태</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="active">활동중</option>
                    <option value="inactive">비활동</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-mr-gray hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleSave} disabled={!form.name} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50">{editWorker ? "수정" : "추가"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

