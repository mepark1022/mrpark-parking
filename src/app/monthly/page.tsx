// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import type { Store } from "@/lib/types/database";

type MonthlyRow = {
  id: string;
  store_id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  payment_status: string;
  contract_status: string;
  note: string | null;
  stores: { name: string } | null;
};

export default function MonthlyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [contracts, setContracts] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [searchText, setSearchText] = useState("");

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadContracts(); }, [filterStore, filterStatus]);

  async function loadStores() {
    const { data } = await supabase.from("stores").select("*").eq("is_active", true).order("name");
    if (data) setStores(data);
  }

  async function loadContracts() {
    setLoading(true);
    let query = supabase
      .from("monthly_parking")
      .select("*, stores(name)")
      .order("end_date", { ascending: true });

    if (filterStore) query = query.eq("store_id", filterStore);
    if (filterStatus) query = query.eq("contract_status", filterStatus);

    const { data } = await query;
    if (data) setContracts(data as MonthlyRow[]);
    setLoading(false);
  }

  function getFiltered(): MonthlyRow[] {
    if (!searchText) return contracts;
    const s = searchText.toLowerCase();
    return contracts.filter(
      (c) =>
        c.vehicle_number.toLowerCase().includes(s) ||
        c.customer_name.toLowerCase().includes(s) ||
        c.customer_phone.includes(s)
    );
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active": return <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">계약중</span>;
      case "expired": return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">만료</span>;
      case "cancelled": return <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">해지</span>;
      default: return null;
    }
  }

  function getPaymentBadge(status: string) {
    switch (status) {
      case "paid": return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">납부</span>;
      case "unpaid": return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">미납</span>;
      case "overdue": return <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">연체</span>;
      default: return null;
    }
  }

  function isExpiringSoon(endDate: string): boolean {
    const diff = (new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }

  async function cancelContract(id: string) {
    if (!confirm("계약을 해지하시겠습니까?")) return;
    await supabase.from("monthly_parking").update({ contract_status: "cancelled" }).eq("id", id);
    loadContracts();
  }

  const filtered = getFiltered();
  const expiringSoon = contracts.filter((c) => c.contract_status === "active" && isExpiringSoon(c.end_date));

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">월주차 현황</h3>
          <button
            onClick={() => router.push("/monthly/register")}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
          >
            + 월주차 등록
          </button>
        </div>

        {expiringSoon.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-orange-800">
              만료 예정 계약 {expiringSoon.length}건 (7일 이내)
            </p>
            <div className="mt-2 space-y-1">
              {expiringSoon.map((c) => (
                <p key={c.id} className="text-xs text-orange-700">
                  {c.stores?.name} - {c.vehicle_number} ({c.customer_name}) / 만료: {c.end_date}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="w-40 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">전체 매장</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-32 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">전체 상태</option>
            <option value="active">계약중</option>
            <option value="expired">만료</option>
            <option value="cancelled">해지</option>
          </select>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="차량번호, 고객명, 연락처 검색"
            className="flex-1 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-mr-gray bg-white rounded-xl shadow-sm">
            등록된 월주차 계약이 없습니다
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-light-gray">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">매장</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">차량번호</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">고객명</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">연락처</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">기간</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">월요금</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">납부</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">상태</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={`border-b border-light-gray last:border-0 hover:bg-gray-50 ${isExpiringSoon(c.end_date) && c.contract_status === "active" ? "bg-orange-50" : ""}`}>
                    <td className="px-4 py-3 text-sm text-dark">{c.stores?.name}</td>
                    <td className="px-4 py-3 text-sm text-dark font-medium">{c.vehicle_number}</td>
                    <td className="px-4 py-3 text-sm text-dark">{c.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-mr-gray">{c.customer_phone}</td>
                    <td className="px-4 py-3 text-sm text-mr-gray">{c.start_date} ~ {c.end_date}</td>
                    <td className="px-4 py-3 text-sm text-dark">{c.monthly_fee.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-sm">{getPaymentBadge(c.payment_status)}</td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(c.contract_status)}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => router.push(`/monthly/register?id=${c.id}`)} className="text-primary hover:underline">수정</button>
                      {c.contract_status === "active" && (
                        <button onClick={() => cancelContract(c.id)} className="text-error hover:underline">해지</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-mr-gray">
          총 {filtered.length}건
        </div>
      </div>
    </AppLayout>
  );
}