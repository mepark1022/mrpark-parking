// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import type { Store } from "@/lib/types/database";

type DailyRecord = {
  id: string;
  store_id: string;
  date: string;
  total_cars: number;
  valet_count: number;
  valet_revenue: number;
  stores: { name: string } | null;
};

function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [startDate, setStartDate] = useState(getThisMonthRange().start);
  const [endDate, setEndDate] = useState(getThisMonthRange().end);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [selectedStore, startDate, endDate]);

  async function loadStores() {
    const { data } = await supabase.from("stores").select("*").eq("is_active", true).order("name");
    if (data) setStores(data);
  }

  async function loadData() {
    setLoading(true);
    let query = supabase
      .from("daily_records")
      .select("*, stores(name)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    if (selectedStore) query = query.eq("store_id", selectedStore);
    const { data } = await query;
    setRecords((data || []) as DailyRecord[]);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const totalCars = records.reduce((s, r) => s + r.total_cars, 0);
    const totalValet = records.reduce((s, r) => s + r.valet_count, 0);
    const totalRevenue = records.reduce((s, r) => s + r.valet_revenue, 0);
    const days = new Set(records.map((r) => r.date)).size;
    const avgCars = days > 0 ? Math.round(totalCars / days) : 0;
    const avgRevenue = days > 0 ? Math.round(totalRevenue / days) : 0;
    return { totalCars, totalValet, totalRevenue, days, avgCars, avgRevenue };
  }, [records]);

  const dailyChartData = useMemo(() => {
    const dayMap: Record<string, { date: string; cars: number; valet: number; revenue: number }> = {};
    records.forEach((r) => {
      if (!dayMap[r.date]) dayMap[r.date] = { date: r.date.slice(5), cars: 0, valet: 0, revenue: 0 };
      dayMap[r.date].cars += r.total_cars;
      dayMap[r.date].valet += r.valet_count;
      dayMap[r.date].revenue += r.valet_revenue;
    });
    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  const storeCompareData = useMemo(() => {
    if (selectedStore) return [];
    const storeMap: Record<string, { name: string; cars: number; valet: number; revenue: number }> = {};
    records.forEach((r) => {
      const name = r.stores?.name || "알 수 없음";
      if (!storeMap[r.store_id]) storeMap[r.store_id] = { name, cars: 0, valet: 0, revenue: 0 };
      storeMap[r.store_id].cars += r.total_cars;
      storeMap[r.store_id].valet += r.valet_count;
      storeMap[r.store_id].revenue += r.valet_revenue;
    });
    return Object.values(storeMap).sort((a, b) => b.revenue - a.revenue);
  }, [records, selectedStore]);

  function downloadExcel() {
    if (records.length === 0) { alert("다운로드할 데이터가 없습니다."); return; }

    const header = ["날짜", "매장", "총입차량", "발렛건수", "발렛매출"];
    const rows = records.map((r) => [
      r.date,
      r.stores?.name || "",
      r.total_cars,
      r.valet_count,
      r.valet_revenue,
    ]);

    const csvContent = "\uFEFF" + [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `매출분석_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setQuickRange(type: "thisMonth" | "lastMonth" | "last3Months") {
    const now = new Date();
    switch (type) {
      case "thisMonth":
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
        break;
      case "lastMonth":
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]);
        setEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]);
        break;
      case "last3Months":
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0]);
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
        break;
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">매출 분석</h3>
          <button
            onClick={downloadExcel}
            className="px-4 py-2 bg-success text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
          >
            엑셀 다운로드
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-48 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">전체 매장</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-2 border border-light-gray rounded-lg text-sm" />
            <span className="text-sm text-mr-gray">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-2 border border-light-gray rounded-lg text-sm" />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setQuickRange("thisMonth")} className="px-3 py-2 bg-white border border-light-gray rounded-lg text-xs hover:bg-gray-50">이번 달</button>
            <button onClick={() => setQuickRange("lastMonth")} className="px-3 py-2 bg-white border border-light-gray rounded-lg text-xs hover:bg-gray-50">지난 달</button>
            <button onClick={() => setQuickRange("last3Months")} className="px-3 py-2 bg-white border border-light-gray rounded-lg text-xs hover:bg-gray-50">최근 3개월</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-mr-gray">총 입차량</p>
                <p className="text-2xl font-bold text-dark mt-1">{summary.totalCars.toLocaleString()}<span className="text-sm font-normal text-mr-gray ml-1">대</span></p>
                <p className="text-xs text-mr-gray mt-1">일평균 {summary.avgCars.toLocaleString()}대 ({summary.days}일)</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-mr-gray">발렛 건수</p>
                <p className="text-2xl font-bold text-dark mt-1">{summary.totalValet.toLocaleString()}<span className="text-sm font-normal text-mr-gray ml-1">건</span></p>
                <p className="text-xs text-mr-gray mt-1">
                  전환율 {summary.totalCars > 0 ? ((summary.totalValet / summary.totalCars) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-mr-gray">발렛 매출</p>
                <p className="text-2xl font-bold text-dark mt-1">{summary.totalRevenue.toLocaleString()}<span className="text-sm font-normal text-mr-gray ml-1">원</span></p>
                <p className="text-xs text-mr-gray mt-1">일평균 {summary.avgRevenue.toLocaleString()}원</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-dark mb-4">일별 발렛 매출 추이</h3>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#1428A0" radius={[4, 4, 0, 0]} name="발렛매출(원)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-mr-gray text-sm">데이터가 없습니다</div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-dark mb-4">일별 입차량 & 발렛 건수</h3>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cars" stroke="#1428A0" name="입차량" strokeWidth={2} />
                    <Line type="monotone" dataKey="valet" stroke="#F5B731" name="발렛건수" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-mr-gray text-sm">데이터가 없습니다</div>
              )}
            </div>

            {!selectedStore && storeCompareData.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-dark mb-4">매장별 발렛 매출 비교</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={storeCompareData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#F5B731" radius={[0, 4, 4, 0]} name="발렛매출" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {!selectedStore && storeCompareData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-light-gray">
                  <h4 className="text-sm font-medium text-dark">매장별 상세</h4>
                </div>
                <table className="w-full">
                  <thead className="border-b border-light-gray">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">매장</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-mr-gray">입차량</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-mr-gray">발렛건수</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-mr-gray">발렛매출</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-mr-gray">전환율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeCompareData.map((s, i) => (
                      <tr key={i} className="border-b border-light-gray last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-dark font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-sm text-dark text-right">{s.cars.toLocaleString()}대</td>
                        <td className="px-4 py-3 text-sm text-dark text-right">{s.valet.toLocaleString()}건</td>
                        <td className="px-4 py-3 text-sm text-dark text-right font-medium">{s.revenue.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-sm text-dark text-right">
                          {s.cars > 0 ? ((s.valet / s.cars) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}