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
    name: "", region_id: "", has_valet: false, valet_fee: 5000, address: "", is_active: true,
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
    setForm({ name: "", region_id: "", has_valet: false, valet_fee: 5000, address: "", is_active: true });
    setShowForm(true);
  }

  function openEdit(store: Store) {
    setEditStore(store);
    setForm({
      name: store.name,
      region_id: store.region_id || "",
      has_valet: store.has_valet || false,
      valet_fee: store.valet_fee || 5000,
      address: store.address || "",
      is_active: store.is_active,
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
      is_active: form.is_active,
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
          <h3 className="text-xl font-bold text-gray-900">매장 관리</h3>
          <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark shadow-sm">+ 매장 추가</button>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-500">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">매장명</th>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">지역</th>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">주소</th>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">발렛</th>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">상태</th>
                  <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm text-gray-900 font-semibold">{store.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{store.regions?.name || "-"}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{store.address || "-"}</td>
                    <td className="px-5 py-4 text-sm">
                      {store.has_valet
                        ? <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">{(store.valet_fee || 0).toLocaleString()}원</span>
                        : <span className="text-gray-400 text-xs">없음</span>
                      }
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${store.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                        {store.is_active ? "운영중" : "비활성"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm space-x-3">
                      <button onClick={() => openEdit(store)} className="text-primary font-medium hover:underline">수정</button>
                      <button onClick={() => toggleActive(store)} className="text-gray-500 hover:underline">{store.is_active ? "비활성" : "활성"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-5">{editStore ? "매장 수정" : "매장 추가"}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">매장명 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="강서푸른꿈성모병원" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">지역</label>
                  <select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">선택 안 함</option>
                    {regions.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">주소</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="서울시 강서구..." />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.has_valet} onChange={(e) => setForm({ ...form, has_valet: e.target.checked })} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">발렛 서비스</span>
                  </label>
                  {form.has_valet && (
                    <input type="number" value={form.valet_fee} onChange={(e) => setForm({ ...form, valet_fee: Number(e.target.value) })} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="발렛비" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">상태</label>
                  <select value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900">
                    <option value="true">운영중</option>
                    <option value="false">비활성</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleSave} disabled={!form.name} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 shadow-sm">{editStore ? "수정" : "추가"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}