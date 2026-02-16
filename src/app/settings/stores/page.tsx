// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import type { Store, Region } from "@/lib/types/database";

export default function StoresPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<(Store & { regions: Region | null })[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [storesRes, regionsRes] = await Promise.all([
      supabase.from("stores").select("*, regions(*)").order("name"),
      supabase.from("regions").select("*").order("name"),
    ]);
    if (storesRes.data) setStores(storesRes.data as (Store & { regions: Region | null })[]);
    if (regionsRes.data) setRegions(regionsRes.data);
    setLoading(false);
  }

  function openCreate() {
    setEditStore(null);
    setForm({ name: "", region_id: "", has_valet: true, valet_fee: 5000, address: "" });
    setShowForm(true);
  }

  function openEdit(store: Store) {
    setEditStore(store);
    setForm({
      name: store.name,
      region_id: store.region_id || "",
      has_valet: store.has_valet,
      valet_fee: store.valet_fee,
      address: store.address || "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    const data = {
      name: form.name,
      region_id: form.region_id || null,
      has_valet: form.has_valet,
      valet_fee: form.valet_fee,
      address: form.address || null,
    };

    if (editStore) {
      await supabase.from("stores").update(data).eq("id", editStore.id);
    } else {
      await supabase.from("stores").insert(data);
    }
    setShowForm(false);
    loadData();
  }

  async function toggleActive(store: Store) {
    await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id);
    loadData();
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">매장 목록</h3>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
          >
            + 매장 추가
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-light-gray">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">매장명</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">지역</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">발렛</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">발렛비</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">상태</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">관리</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-light-gray last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-dark font-medium">{store.name}</td>
                    <td className="px-4 py-3 text-sm text-mr-gray">{store.regions?.name || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {store.has_valet ? (
                        <span className="text-success">O</span>
                      ) : (
                        <span className="text-mr-gray">X</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-dark">
                      {store.has_valet ? `${store.valet_fee.toLocaleString()}원` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        store.is_active ? "bg-green-100 text-success" : "bg-gray-100 text-mr-gray"
                      }`}>
                        {store.is_active ? "운영중" : "중지"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => openEdit(store)} className="text-primary hover:underline">수정</button>
                      <button onClick={() => toggleActive(store)} className="text-mr-gray hover:underline">
                        {store.is_active ? "중지" : "활성"}
                      </button>
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
              <h3 className="text-lg font-semibold text-dark mb-4">
                {editStore ? "매장 수정" : "매장 추가"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">매장명 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="강남점"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">지역</label>
                  <select
                    value={form.region_id}
                    onChange={(e) => setForm({ ...form, region_id: e.target.value })}
                    className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">선택 안 함</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">주소</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="서울시 강남구..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.has_valet}
                      onChange={(e) => setForm({ ...form, has_valet: e.target.checked })}
                      className="rounded"
                    />
                    발렛 서비스
                  </label>
                  {form.has_valet && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-mr-gray">발렛비:</label>
                      <input
                        type="number"
                        value={form.valet_fee}
                        onChange={(e) => setForm({ ...form, valet_fee: Number(e.target.value) })}
                        className="w-24 px-2 py-1 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="text-sm text-mr-gray">원</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-mr-gray hover:bg-gray-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
                >
                  {editStore ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}