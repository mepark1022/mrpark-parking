// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
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

type HourlyRow = { hour: number; car_count: number; record_id: string };
type AssignmentRow = { worker_id: string; worker_type: string; workers: { name: string } | null; record_id: string };
type MonthlyContract = { id: string; store_id: string; contract_status: string; monthly_fee: number; end_date: string; stores: { name: string } | null };

const CHART_COLORS = ["#1428A0", "#F5B731", "#43A047", "#E53935", "#0F9ED5", "#E97132", "#7B1FA2", "#156082", "#666666", "#00BCD4"];

function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [monthlyContracts, setMonthlyContracts] = useState<MonthlyContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [selectedStore, period, customStart, customEnd]);

  async function loadStores() {
    const { data } = await supabase.from("stores").select("*").eq("is_active", true).order("name");
    if (data) setStores(data);
  }

  function getDateRange(): { start: string; end: string } {
    const today = new Date().toISOString().split("T")[0];
    switch (period) {
      case "today": return { start: today, end: today };
      case "week": return getThisWeekRange();
      case "month": return getThisMonthRange();
      case "custom": return { start: customStart || today, end: customEnd || today };
    }
  }

  async function loadData() {
    setLoading(true);
    const { start, end } = getDateRange();

    let recordQuery = supabase
      .from("daily_records")
      .select("*, stores(name)")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    if (selectedStore) recordQuery = recordQuery.eq("store_id", selectedStore);

    const { data: recordsData } = await recordQuery;
    const recs = (recordsData || []) as DailyRecord[];
    setRecords(recs);

    if (recs.length > 0) {
      const recordIds = recs.map((r) => r.id);
      const { data: hData } = await supabase
        .from("hourly_data")
        .select("hour, car_count, record_id")
        .in("record_id", recordIds);
      setHourlyData((hData || []) as HourlyRow[]);

      const { data: aData } = await supabase
        .from("worker_assignments")
        .select("worker_id, worker_type, workers:worker_id(name), record_id")
        .in("record_id", recordIds);
      setAssignments((aData || []) as AssignmentRow[]);
    } else {
      setHourlyData([]);
      setAssignments([]);
    }

    let mpQuery = supabase.from("monthly_parking").select("*, stores(name)");
    if (selectedStore) mpQuery = mpQuery.eq("store_id", selectedStore);
    const { data: mpData } = await mpQuery;
    setMonthlyContracts((mpData || []) as MonthlyContract[]);

    setLoading(false);
  }

  const kpi = useMemo(() => {
    const totalCars = records.reduce((s, r) => s + r.total_cars, 0);
    const totalValet = records.reduce((s, r) => s + r.valet_revenue, 0);
    const workerIds = new Set(assignments.map((a) => a.worker_id));
    const activeContracts = monthlyContracts.filter((c) => c.contract_status === "active").length;
    return { totalCars, totalValet, workerCount: workerIds.size, activeContracts };
  }, [records, assignments, monthlyContracts]);

  const hourlyChartData = useMemo(() => {
    const hourMap: Record<number, number> = {};
    for (let h = 7; h <= 22; h++) hourMap[h] = 0;
    hourlyData.forEach((d) => { if (hourMap[d.hour] !== undefined) hourMap[d.hour] += d.car_count; });
    return Object.entries(hourMap).map(([h, count]) => ({ hour: `${h}시`, count }));
  }, [hourlyData]);

  const dailyTrendData = useMemo(() => {
    const dayMap: Record<string, { cars: number; valet: number }> = {};
    records.forEach((r) => {
      if (!dayMap[r.date]) dayMap[r.date] = { cars: 0, valet: 0 };
      dayMap[r.date].cars += r.total_cars;
      dayMap[r.date].valet += r.valet_revenue;
    });
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), cars: v.cars, valet: v.valet }));
  }, [records]);

  const storeRankData = useMemo(() => {
    if (selectedStore) return [];
    const storeMap: Record<string, { name: string; cars: number; valet: number }> = {};
    records.forEach((r) => {
      const name = r.stores?.name || "알 수 없음";
      if (!storeMap[r.store_id]) storeMap[r.store_id] = { name, cars: 0, valet: 0 };
      storeMap[r.store_id].cars += r.total_cars;
      storeMap[r.store_id].valet += r.valet_revenue;
    });
    return Object.values(storeMap).sort((a, b) => b.cars - a.cars).slice(0, 10);
  }, [records, selectedStore]);

  const monthlyPieData = useMemo(() => {
    const active = monthlyContracts.filter((c) => c.contract_status === "active").length;
    const expired = monthlyContracts.filter((c) => c.contract_status === "expired").length;
    const cancelled = monthlyContracts.filter((c) => c.contract_status === "cancelled").length;
    return [
      { name: "계약중", value: active },
      { name: "만료", value: expired },
      { name: "해지", value: cancelled },
    ].filter((d) => d.value > 0);
  }, [monthlyContracts]);

  const expiringSoon = useMemo(() => {
    const now = new Date();
    return monthlyContracts.filter((c) => {
      if (c.contract_status !== "active") return false;
      const diff = (new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });
  }, [monthlyContracts]);

  const workerSummary = useMemo(() => {
    if (!selectedStore) return [];
    const map: Record<string, { name: string; type: string }> = {};
    assignments.forEach((a) => {
      map[a.worker_id] = { name: a.workers?.name || "알 수 없음", type: a.worker_type };
    });
    return Object.values(map);
  }, [assignments, selectedStore]);

  function getTypeBadge(type: string) {
    switch (type) {
      case "default": return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">기본</span>;
      case "substitute": return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">대체</span>;
      case "hq_support": return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs">본사</span>;
      default: return null;
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-48 px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">전사 현황</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-1">
            {(["today", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-lg text-sm ${period === p ? "bg-primary text-white" : "bg-white text-dark border border-light-gray hover:bg-gray-50"}`}
              >
                {p === "today" ? "오늘" : p === "week" ? "이번 주" : "이번 달"}
              </button>
            ))}
            <button
              onClick={() => setPeriod("custom")}
              className={`px-3 py-2 rounded-lg text-sm ${period === "custom" ? "bg-primary text-white" : "bg-white text-dark border border-light-gray hover:bg-gray-50"}`}
            >
              직접 설정
            </button>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1 border border-light-gray rounded-lg text-sm" />
              <span className="text-sm text-gray-600 font-medium">~</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1 border border-light-gray rounded-lg text-sm" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 font-medium">총 입차량</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.totalCars.toLocaleString()}<span className="text-sm font-normal text-mr-gray ml-1">대</span></p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 font-medium">발렛 매출</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.totalValet.toLocaleString()}<span className="text-sm font-normal text-mr-gray ml-1">원</span></p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 font-medium">근무 인원</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.workerCount}<span className="text-sm font-normal text-mr-gray ml-1">명</span></p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 font-medium">{selectedStore ? "월주차 계약" : "운영 매장"}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {selectedStore ? kpi.activeContracts : stores.length}
                  <span className="text-sm font-normal text-mr-gray ml-1">{selectedStore ? "건" : "개"}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-dark mb-4">시간대별 입차량</h3>
                {hourlyChartData.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={hourlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1428A0" radius={[4, 4, 0, 0]} name="입차량" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-mr-gray text-sm">데이터가 없습니다</div>
                )}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-dark mb-4">일별 추이</h3>
                {dailyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="cars" stroke="#1428A0" name="입차량" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="valet" stroke="#F5B731" name="발렛매출" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-mr-gray text-sm">데이터가 없습니다</div>
                )}
              </div>
            </div>

            {!selectedStore && storeRankData.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-dark mb-4">매장 랭킹 (입차량 TOP 10)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={storeRankData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="cars" fill="#1428A0" radius={[0, 4, 4, 0]} name="입차량" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-dark mb-4">월주차 현황</h3>
                {monthlyPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={monthlyPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}건`}>
                        {monthlyPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-mr-gray text-sm">월주차 데이터가 없습니다</div>
                )}
                {expiringSoon.length > 0 && (
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm font-medium text-orange-800">만료 예정 {expiringSoon.length}건</p>
                  </div>
                )}
              </div>

              {selectedStore ? (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-dark mb-4">근무자 현황</h3>
                  {workerSummary.length > 0 ? (
                    <div className="space-y-2">
                      {workerSummary.map((w, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          {getTypeBadge(w.type)}
                          <span className="text-sm text-dark">{w.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-mr-gray text-sm">근무자 데이터가 없습니다</div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-dark mb-4">미입력 매장</h3>
                  {records.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-mr-gray text-sm">선택된 기간에 입력된 데이터가 없습니다</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {stores
                        .filter((s) => !records.some((r) => r.store_id === s.id))
                        .map((s) => (
                          <div key={s.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                            <span className="text-xs text-error">미입력</span>
                            <span className="text-sm text-dark">{s.name}</span>
                          </div>
                        ))}
                      {stores.filter((s) => !records.some((r) => r.store_id === s.id)).length === 0 && (
                        <div className="h-48 flex items-center justify-center text-success text-sm">모든 매장 입력 완료!</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}