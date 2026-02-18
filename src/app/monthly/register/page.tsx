// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import type { Store } from "@/lib/types/database";

function RegisterForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    store_id: "",
    vehicle_number: "",
    vehicle_type: "",
    customer_name: "",
    customer_phone: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    monthly_fee: 100000,
    payment_status: "unpaid" as "paid" | "unpaid" | "overdue",
    contract_status: "active" as "active" | "expired" | "cancelled",
    note: "",
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (editId) loadExisting();
  }, [editId]);

  async function loadStores() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    const { data } = await supabase.from("stores").select("*").eq("org_id", oid).eq("is_active", true).order("name");
    if (data) {
      setStores(data);
      if (!editId && data.length > 0) setForm((f) => ({ ...f, store_id: data[0].id }));
    }
    setLoading(false);
  }

  async function loadExisting() {
    const { data } = await supabase
      .from("monthly_parking")
      .select("*")
      .eq("id", editId)
      .single();

    if (data) {
      setForm({
        store_id: data.store_id,
        vehicle_number: data.vehicle_number,
        vehicle_type: data.vehicle_type || "",
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        start_date: data.start_date,
        end_date: data.end_date,
        monthly_fee: data.monthly_fee,
        payment_status: data.payment_status,
        contract_status: data.contract_status,
        note: data.note || "",
      });
    }
  }

  function setEndDateFromMonths(months: number) {
    if (!form.start_date) return;
    const start = new Date(form.start_date);
    start.setMonth(start.getMonth() + months);
    start.setDate(start.getDate() - 1);
    setForm({ ...form, end_date: start.toISOString().split("T")[0] });
  }

  async function handleSave() {
    if (!form.store_id || !form.vehicle_number || !form.customer_name || !form.customer_phone || !form.start_date || !form.end_date) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }
    setSaving(true);

    const data = {
      store_id: form.store_id,
      vehicle_number: form.vehicle_number.toUpperCase(),
      vehicle_type: form.vehicle_type || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      start_date: form.start_date,
      end_date: form.end_date,
      monthly_fee: form.monthly_fee,
      payment_status: form.payment_status,
      contract_status: form.contract_status,
      note: form.note || null,
    };

    try {
      if (editId) {
        await supabase.from("monthly_parking").update(data).eq("id", editId);
      } else {
        await supabase.from("monthly_parking").insert({ ...data, org_id: oid });
      }
      router.push("/monthly");
    } catch (err) {
      console.error(err);
      alert("저장 실패. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLayout><div className="text-center py-10 text-mr-gray">로딩 중...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">
            {editId ? "월주차 수정" : "월주차 등록"}
          </h3>
          <button onClick={() => router.push("/monthly")} className="text-sm text-mr-gray hover:underline">
            목록으로
          </button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark mb-1">매장 *</label>
            <select
              value={form.store_id}
              onChange={(e) => setForm({ ...form, store_id: e.target.value })}
              className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">차량번호 *</label>
              <input
                value={form.vehicle_number}
                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="12가 3456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">차종</label>
              <input
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="소나타, SUV 등"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">고객명 *</label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">연락처 *</label>
              <input
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="010-1234-5678"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">시작일 *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">종료일 *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setEndDateFromMonths(1)} className="px-2 py-1 bg-gray-100 rounded text-xs text-mr-gray hover:bg-gray-200">1개월</button>
                <button onClick={() => setEndDateFromMonths(3)} className="px-2 py-1 bg-gray-100 rounded text-xs text-mr-gray hover:bg-gray-200">3개월</button>
                <button onClick={() => setEndDateFromMonths(6)} className="px-2 py-1 bg-gray-100 rounded text-xs text-mr-gray hover:bg-gray-200">6개월</button>
                <button onClick={() => setEndDateFromMonths(12)} className="px-2 py-1 bg-gray-100 rounded text-xs text-mr-gray hover:bg-gray-200">1년</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1">월 요금 *</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={form.monthly_fee}
                  onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-sm text-mr-gray">원</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">납부 상태</label>
              <select
                value={form.payment_status}
                onChange={(e) => setForm({ ...form, payment_status: e.target.value as "paid" | "unpaid" | "overdue" })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="unpaid">미납</option>
                <option value="paid">납부</option>
                <option value="overdue">연체</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1">계약 상태</label>
              <select
                value={form.contract_status}
                onChange={(e) => setForm({ ...form, contract_status: e.target.value as "active" | "expired" | "cancelled" })}
                className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">계약중</option>
                <option value="expired">만료</option>
                <option value="cancelled">해지</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1">메모</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="특이사항..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-gray">
            <button onClick={() => router.push("/monthly")} className="px-4 py-2 text-sm text-mr-gray hover:bg-gray-100 rounded-lg">취소</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "저장 중..." : editId ? "수정" : "등록"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AppLayout><div className="text-center py-10 text-mr-gray">로딩 중...</div></AppLayout>}>
      <RegisterForm />
    </Suspense>
  );
}