// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Region = { id: string; name: string };
type ParkingFee = {
  id?: string; store_id?: string; fee_name: string;
  free_minutes: number; base_minutes: number; base_fee: number;
  extra_unit_minutes: number; extra_unit_fee: number; daily_max_fee: number;
  is_active: boolean;
};
type Store = {
  id: string; name: string; region_id: string | null; has_valet: boolean;
  valet_fee: number; address: string | null; address_road: string | null;
  address_detail: string | null; address_zipcode: string | null;
  is_active: boolean; regions: Region | null;
};

export default function StoresPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeStore, setFeeStore] = useState<Store | null>(null);
  const [form, setForm] = useState({
    name: "", region_id: "", has_valet: false, valet_fee: 5000,
    address_road: "", address_detail: "", address_zipcode: "", is_active: true,
  });
  const [fee, setFee] = useState<ParkingFee>({
    fee_name: "기본 요금제", free_minutes: 0, base_minutes: 60, base_fee: 0,
    extra_unit_minutes: 10, extra_unit_fee: 0, daily_max_fee: 0, is_active: true,
  });
  const [existingFeeId, setExistingFeeId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  async function loadData() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    setLoading(true);
    const [storesRes, regionsRes] = await Promise.all([
      supabase.from("stores").select("*, regions(*)").order("name"),
      supabase.from("regions").select("*").order("name"),
    ]);
    if (storesRes.data) setStores(storesRes.data as Store[]);
    if (regionsRes.data) setRegions(regionsRes.data);
    setLoading(false);
  }

  function openCreate() {
    setEditStore(null);
    setForm({ name: "", region_id: "", has_valet: false, valet_fee: 5000, address_road: "", address_detail: "", address_zipcode: "", is_active: true });
    setShowForm(true);
  }

  function openEdit(store: Store) {
    setEditStore(store);
    setForm({
      name: store.name, region_id: store.region_id || "",
      has_valet: store.has_valet || false, valet_fee: store.valet_fee || 5000,
      address_road: store.address_road || store.address || "",
      address_detail: store.address_detail || "",
      address_zipcode: store.address_zipcode || "",
      is_active: store.is_active,
    });
    setShowForm(true);
  }

  async function openFee(store: Store) {
    setFeeStore(store);
    const { data } = await supabase.from("store_parking_fees").select("*").eq("store_id", store.id).eq("is_active", true).single();
    if (data) {
      setFee({
        fee_name: data.fee_name, free_minutes: data.free_minutes, base_minutes: data.base_minutes,
        base_fee: data.base_fee, extra_unit_minutes: data.extra_unit_minutes,
        extra_unit_fee: data.extra_unit_fee, daily_max_fee: data.daily_max_fee, is_active: true,
      });
      setExistingFeeId(data.id);
    } else {
      setFee({ fee_name: "기본 요금제", free_minutes: 0, base_minutes: 60, base_fee: 0, extra_unit_minutes: 10, extra_unit_fee: 0, daily_max_fee: 0, is_active: true });
      setExistingFeeId(null);
    }
    setShowFeeModal(true);
  }

  function searchAddress() {
    if (!(window as any).daum) return alert("주소 검색 로딩 중입니다. 잠시 후 다시 시도해주세요.");
    new (window as any).daum.Postcode({
      oncomplete: function (data: any) {
        setForm((prev) => ({
          ...prev,
          address_road: data.roadAddress || data.jibunAddress,
          address_zipcode: data.zonecode,
        }));
      },
    }).open();
  }

  async function handleSave() {
    const data = {
      name: form.name, region_id: form.region_id || null,
      has_valet: form.has_valet, valet_fee: form.valet_fee,
      address: form.address_road, address_road: form.address_road,
      address_detail: form.address_detail || null,
      address_zipcode: form.address_zipcode || null,
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

  async function handleFeeSave() {
    if (!feeStore) return;
    const data = {
      store_id: feeStore.id, fee_name: fee.fee_name,
      free_minutes: fee.free_minutes, base_minutes: fee.base_minutes,
      base_fee: fee.base_fee, extra_unit_minutes: fee.extra_unit_minutes,
      extra_unit_fee: fee.extra_unit_fee, daily_max_fee: fee.daily_max_fee,
      is_active: true,
    };
    if (existingFeeId) {
      await supabase.from("store_parking_fees").update(data).eq("id", existingFeeId);
    } else {
      await supabase.from("store_parking_fees").insert(data);
    }
    setShowFeeModal(false);
    loadData();
  }

  function calcFee(minutes: number): number {
    if (minutes <= fee.free_minutes) return 0;
    const chargeMinutes = minutes - fee.free_minutes;
    if (chargeMinutes <= fee.base_minutes) {
      const result = fee.base_fee;
      return fee.daily_max_fee > 0 ? Math.min(result, fee.daily_max_fee) : result;
    }
    const extraMinutes = chargeMinutes - fee.base_minutes;
    const extraUnits = fee.extra_unit_minutes > 0 ? Math.ceil(extraMinutes / fee.extra_unit_minutes) : 0;
    const result = fee.base_fee + extraUnits * fee.extra_unit_fee;
    return fee.daily_max_fee > 0 ? Math.min(result, fee.daily_max_fee) : result;
  }

  async function toggleActive(store: Store) {
    await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id);
    loadData();
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">매장 관리</h3>
          <button onClick={openCreate} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-sm">+ 매장 추가</button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">매장명</th>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">지역</th>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">주소</th>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">발렛</th>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">상태</th>
                  <th className="text-left px-5 py-3.5 text-sm font-bold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4 text-[15px] text-gray-900 font-bold">{store.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{store.regions?.name || "-"}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 max-w-[200px] truncate">{store.address_road || store.address || "-"}</td>
                    <td className="px-5 py-4 text-sm">
                      {store.has_valet
                        ? <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{(store.valet_fee || 0).toLocaleString()}원</span>
                        : <span className="text-gray-400 text-xs">없음</span>}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${store.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                        {store.is_active ? "운영중" : "비활성"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm space-x-2">
                      <button onClick={() => openEdit(store)} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20">수정</button>
                      <button onClick={() => openFee(store)} className="px-3 py-1.5 bg-gold/20 text-yellow-800 rounded-lg text-xs font-bold hover:bg-gold/30">요금</button>
                      <button onClick={() => toggleActive(store)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200">{store.is_active ? "비활성" : "활성"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 매장 추가/수정 모달 */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-5">{editStore ? "매장 수정" : "매장 추가"}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">매장명 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="강서푸른꿈성모병원" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">지역</label>
                  <select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium">
                    <option value="">선택 안 함</option>
                    {regions.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">주소</label>
                  <div className="flex gap-2 mb-2">
                    <input value={form.address_road} readOnly className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50" placeholder="도로명 주소 (검색 버튼 클릭)" />
                    <button onClick={searchAddress} type="button" className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark whitespace-nowrap">주소 검색</button>
                  </div>
                  <div className="flex gap-2">
                    <input value={form.address_zipcode} readOnly className="w-28 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-500 bg-gray-50" placeholder="우편번호" />
                    <input value={form.address_detail} onChange={(e) => setForm({ ...form, address_detail: e.target.value })} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="상세 주소 (층, 호수 등)" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.has_valet} onChange={(e) => setForm({ ...form, has_valet: e.target.checked })} className="w-4 h-4 rounded" />
                    <span className="text-sm font-bold text-gray-700">발렛 서비스</span>
                  </label>
                  {form.has_valet && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={form.valet_fee} onChange={(e) => setForm({ ...form, valet_fee: Number(e.target.value) })} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-center" />
                      <span className="text-sm text-gray-600">원</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleSave} disabled={!form.name} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{editStore ? "수정" : "추가"}</button>
              </div>
            </div>
          </div>
        )}

        {/* 요금 설정 모달 */}
        {showFeeModal && feeStore && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{feeStore.name}</h3>
              <p className="text-sm text-gray-500 mb-6">주차 요금 설정</p>

              <div className="space-y-5">
                <div className="bg-blue-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-blue-800 mb-3">① 무료 시간</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">최초</span>
                    <input type="number" min="0" value={fee.free_minutes} onChange={(e) => setFee({ ...fee, free_minutes: Number(e.target.value) })} className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">분 무료</span>
                    <span className="text-xs text-gray-400">(0이면 무료시간 없음)</span>
                  </div>
                </div>

                <div className="bg-green-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-green-800 mb-3">② 기본 요금</h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="number" min="0" value={fee.base_minutes} onChange={(e) => setFee({ ...fee, base_minutes: Number(e.target.value) })} className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">분 동안</span>
                    <input type="number" min="0" step="100" value={fee.base_fee} onChange={(e) => setFee({ ...fee, base_fee: Number(e.target.value) })} className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">원</span>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-orange-800 mb-3">③ 추가 요금</h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">이후</span>
                    <input type="number" min="1" value={fee.extra_unit_minutes} onChange={(e) => setFee({ ...fee, extra_unit_minutes: Number(e.target.value) })} className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">분마다</span>
                    <input type="number" min="0" step="100" value={fee.extra_unit_fee} onChange={(e) => setFee({ ...fee, extra_unit_fee: Number(e.target.value) })} className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">원</span>
                  </div>
                </div>

                <div className="bg-red-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-red-800 mb-3">④ 일 최대 요금</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">하루 최대</span>
                    <input type="number" min="0" step="1000" value={fee.daily_max_fee} onChange={(e) => setFee({ ...fee, daily_max_fee: Number(e.target.value) })} className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-[15px] font-bold text-gray-900" />
                    <span className="text-sm font-semibold text-gray-700">원</span>
                    <span className="text-xs text-gray-400">(0이면 무제한)</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">💰 요금 미리보기</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[fee.free_minutes > 0 ? fee.free_minutes : null, fee.free_minutes + 30, fee.free_minutes + fee.base_minutes, fee.free_minutes + fee.base_minutes + 30, fee.free_minutes + fee.base_minutes + 60, fee.free_minutes + fee.base_minutes + 120, 1440].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((min) => (
                      <div key={min} className="flex justify-between py-1.5 px-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700 font-medium">{min >= 1440 ? "하루종일" : `${min}분`}</span>
                        <span className="text-sm font-bold text-primary">{calcFee(min).toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => setShowFeeModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleFeeSave} className="px-5 py-2.5 bg-gold text-dark rounded-lg text-sm font-bold hover:bg-yellow-400 shadow-sm">요금 저장</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}