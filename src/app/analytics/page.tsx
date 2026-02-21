"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ComposedChart,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

// ─── 타입 ───────────────────────────────────────────────────────────────────

type PeriodKey = "today" | "week" | "month" | "custom" | "all";

interface Store {
  id: string;
  name: string;
}

interface DailyRecord {
  id: string;
  store_id: string;
  date: string;
  total_vehicles?: number;
  valet_revenue?: number;
  parking_revenue?: number;
  worker_count?: number;
  day_type?: string;
}

interface KPI {
  totalRevenue: number;
  valetRevenue: number;
  parkingRevenue: number;
  totalVehicles: number;
  prevTotalRevenue: number;
  prevTotalVehicles: number;
}

interface StoreStats {
  storeId: string;
  storeName: string;
  totalRevenue: number;
  valetRevenue: number;
  parkingRevenue: number;
  totalVehicles: number;
  days: number;
}

interface ChartPoint {
  date: string;
  label: string;
  발렛: number;
  주차: number;
  입차: number;
}

// ─── 유틸 ───────────────────────────────────────────────────────────────────

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return `₩${n.toLocaleString()}`;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getPeriodDates(period: PeriodKey, custom: { from: string; to: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (period) {
    case "today":
      return { from: formatDate(today), to: formatDate(today) };
    case "week": {
      const dow = today.getDay();
      const mon = addDays(today, -(dow === 0 ? 6 : dow - 1));
      return { from: formatDate(mon), to: formatDate(today) };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(first), to: formatDate(today) };
    }
    case "custom":
      return custom;
    case "all":
      return { from: "2020-01-01", to: formatDate(today) };
  }
}

function getPrevPeriodDates(period: PeriodKey, current: { from: string; to: string }) {
  if (period === "all") return null;
  const from = new Date(current.from);
  const to = new Date(current.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return {
    from: formatDate(addDays(from, -days)),
    to: formatDate(addDays(to, -days)),
  };
}

function calcChange(curr: number, prev: number) {
  if (!prev) return null;
  const val = Math.round(((curr - prev) / prev) * 100);
  return { val, up: val >= 0 };
}

// Recharts 커스텀 툴팁
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const valet = payload.find((p: any) => p.dataKey === "발렛")?.value ?? 0;
  const parking = payload.find((p: any) => p.dataKey === "주차")?.value ?? 0;
  const vehicles = payload.find((p: any) => p.dataKey === "입차")?.value ?? 0;
  return (
    <div className="bg-[#1a1d26] text-white text-xs rounded-xl px-3 py-2.5 shadow-xl">
      <div className="font-bold mb-1.5 text-[#F5B731]">{label}</div>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between gap-6">
          <span className="text-white/70">발렛</span>
          <span className="font-semibold">{(valet as number).toLocaleString()}원</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-white/70">주차</span>
          <span className="font-semibold">{(parking as number).toLocaleString()}원</span>
        </div>
        <div className="border-t border-white/20 mt-1 pt-1 flex justify-between gap-6">
          <span className="text-white/70">입차</span>
          <span className="font-semibold">{vehicles}대</span>
        </div>
      </div>
    </div>
  );
}

// Recharts Y축 포매터
function yFormatter(v: number) {
  if (v >= 1_000_000) return `${(v / 10000).toFixed(0)}만`;
  if (v >= 10_000) return `${(v / 10000).toFixed(1)}만`;
  return `${v}`;
}

// ─── PERIODS ────────────────────────────────────────────────────────────────

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "custom", label: "직접 설정" },
  { key: "all", label: "전체" },
];

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState<PeriodKey>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [prevRecords, setPrevRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  // 매장 목록
  useEffect(() => {
    (async () => {
      const oid = await getOrgId();
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("org_id", oid)
        .order("name");
      if (data) setStores(data);
    })();
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const oid = await getOrgId();
      const dates = getPeriodDates(period, custom);
      if (period === "custom" && (!custom.from || !custom.to)) {
        setLoading(false);
        return;
      }

      let q = supabase
        .from("daily_records")
        .select("id, store_id, date, total_vehicles, valet_revenue, parking_revenue, worker_count, day_type")
        .eq("org_id", oid)
        .gte("date", dates.from)
        .lte("date", dates.to)
        .order("date");

      if (selectedStore !== "all") q = q.eq("store_id", selectedStore);

      const { data } = await q;
      setRecords(data ?? []);

      const prevDates = getPrevPeriodDates(period, dates);
      if (prevDates) {
        let pq = supabase
          .from("daily_records")
          .select("id, store_id, date, total_vehicles, valet_revenue, parking_revenue")
          .eq("org_id", oid)
          .gte("date", prevDates.from)
          .lte("date", prevDates.to);
        if (selectedStore !== "all") pq = pq.eq("store_id", selectedStore);
        const { data: pd } = await pq;
        setPrevRecords(pd ?? []);
      } else {
        setPrevRecords([]);
      }
    } finally {
      setLoading(false);
    }
  }, [period, custom, selectedStore]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── 집계 ─────────────────────────────────────────────────────────────────

  const kpi: KPI = {
    totalRevenue: records.reduce((s, r) => s + (r.valet_revenue ?? 0) + (r.parking_revenue ?? 0), 0),
    valetRevenue: records.reduce((s, r) => s + (r.valet_revenue ?? 0), 0),
    parkingRevenue: records.reduce((s, r) => s + (r.parking_revenue ?? 0), 0),
    totalVehicles: records.reduce((s, r) => s + (r.total_vehicles ?? 0), 0),
    prevTotalRevenue: prevRecords.reduce((s, r) => s + (r.valet_revenue ?? 0) + (r.parking_revenue ?? 0), 0),
    prevTotalVehicles: prevRecords.reduce((s, r) => s + (r.total_vehicles ?? 0), 0),
  };

  // 차트 데이터 (일별 집계)
  const chartData: ChartPoint[] = (() => {
    const map = new Map<string, ChartPoint>();
    for (const r of records) {
      const pt = map.get(r.date) ?? {
        date: r.date,
        label: r.date.slice(5).replace("-", "/"),
        발렛: 0, 주차: 0, 입차: 0,
      };
      pt.발렛 += r.valet_revenue ?? 0;
      pt.주차 += r.parking_revenue ?? 0;
      pt.입차 += r.total_vehicles ?? 0;
      map.set(r.date, pt);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  // 매장별 통계
  const storeStats: StoreStats[] = (() => {
    const map = new Map<string, StoreStats>();
    for (const r of records) {
      const store = stores.find(s => s.id === r.store_id);
      if (!store) continue;
      const st = map.get(r.store_id) ?? {
        storeId: r.store_id,
        storeName: store.name,
        totalRevenue: 0, valetRevenue: 0,
        parkingRevenue: 0, totalVehicles: 0, days: 0,
      };
      st.valetRevenue += r.valet_revenue ?? 0;
      st.parkingRevenue += r.parking_revenue ?? 0;
      st.totalRevenue += (r.valet_revenue ?? 0) + (r.parking_revenue ?? 0);
      st.totalVehicles += r.total_vehicles ?? 0;
      st.days += 1;
      map.set(r.store_id, st);
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  })();

  // 요일별 통계 (평균)
  const dayOfWeekData = (() => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const agg = Array.from({ length: 7 }, (_, i) => ({ day: days[i], 총매출: 0, count: 0 }));
    for (const r of records) {
      const dow = new Date(r.date).getDay();
      agg[dow].총매출 += (r.valet_revenue ?? 0) + (r.parking_revenue ?? 0);
      agg[dow].count += 1;
    }
    return agg.map(d => ({
      day: d.day,
      평균매출: d.count ? Math.round(d.총매출 / d.count) : 0,
    }));
  })();

  const revenueChange = calcChange(kpi.totalRevenue, kpi.prevTotalRevenue);
  const vehicleChange = calcChange(kpi.totalVehicles, kpi.prevTotalVehicles);

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">

      {/* ── 헤더 필터 영역 ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
        {/* 기간 탭 */}
        <div className="flex gap-1 bg-[#f4f5f7] p-1 rounded-xl overflow-x-auto shrink-0">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                period === p.key
                  ? "bg-white text-[#1a1d26] shadow-sm font-semibold"
                  : "text-[#5c6370] hover:text-[#1a1d26]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 매장 선택 */}
        <select
          value={selectedStore}
          onChange={e => setSelectedStore(e.target.value)}
          className="w-full md:w-44 px-3 py-2 border border-[#e2e4e9] rounded-xl text-sm bg-white
                     text-[#1a1d26] focus:outline-none focus:border-[#1428A0]"
        >
          <option value="all">🏢 전체 매장</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* ── 직접 설정 ── */}
      {period === "custom" && (
        <div className="flex flex-col md:flex-row gap-3 mb-5 p-4 bg-white border
                        border-[#e2e4e9] rounded-xl shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-[#5c6370] whitespace-nowrap">시작일</span>
            <input
              type="date"
              value={custom.from}
              onChange={e => setCustom(p => ({ ...p, from: e.target.value }))}
              className="flex-1 px-3 py-2 border border-[#e2e4e9] rounded-lg text-sm
                         focus:outline-none focus:border-[#1428A0]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-[#5c6370] whitespace-nowrap">종료일</span>
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={e => setCustom(p => ({ ...p, to: e.target.value }))}
              className="flex-1 px-3 py-2 border border-[#e2e4e9] rounded-lg text-sm
                         focus:outline-none focus:border-[#1428A0]"
            />
          </div>
          <button
            onClick={loadData}
            className="px-5 py-2 bg-[#1428A0] text-white text-sm font-semibold
                       rounded-lg hover:bg-[#2d3a8c] transition"
          >
            조회
          </button>
        </div>
      )}

      {/* ── KPI 카드 4개 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
        <KPICard
          icon="💰" iconBg="#f0f2ff"
          value={loading ? "—" : formatKRW(kpi.totalRevenue)}
          label="총 매출"
          change={revenueChange}
        />
        <KPICard
          icon="🅿️" iconBg="#fef9e7"
          value={loading ? "—" : formatKRW(kpi.parkingRevenue)}
          label="주차 매출"
        />
        <KPICard
          icon="🚗" iconBg="#f0fdf4"
          value={loading ? "—" : formatKRW(kpi.valetRevenue)}
          label="발렛 매출"
        />
        <KPICard
          icon="📊" iconBg="#faf5ff"
          value={loading ? "—" : kpi.totalVehicles.toLocaleString()}
          label="총 입차"
          change={vehicleChange}
          unit="대"
        />
      </div>

      {/* ── 메인 차트 (매출 추이) ── */}
      <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-base font-bold text-[#1a1d26]">
            <span>📈</span> 매출 추이
          </div>
          {/* 바/라인 토글 */}
          <div className="flex gap-1 bg-[#f4f5f7] p-1 rounded-lg">
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                chartType === "bar"
                  ? "bg-white text-[#1428A0] shadow-sm"
                  : "text-[#5c6370]"
              }`}
            >
              막대
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                chartType === "line"
                  ? "bg-white text-[#1428A0] shadow-sm"
                  : "text-[#5c6370]"
              }`}
            >
              라인
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-[#8b919d] text-sm">
            데이터 로딩 중...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-[#8b919d]">
            <span className="text-3xl mb-2">📊</span>
            <span className="text-sm">해당 기간 데이터가 없습니다</span>
          </div>
        ) : chartType === "bar" ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#8b919d" }}
                tickLine={false}
                axisLine={{ stroke: "#eef0f3" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={yFormatter}
                tick={{ fontSize: 11, fill: "#8b919d" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f5f7" }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="발렛" stackId="a" fill="#1428A0" radius={[0, 0, 0, 0]} />
              <Bar dataKey="주차" stackId="a" fill="#F5B731" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#8b919d" }}
                tickLine={false}
                axisLine={{ stroke: "#eef0f3" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="revenue"
                tickFormatter={yFormatter}
                tick={{ fontSize: 11, fill: "#8b919d" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <YAxis
                yAxisId="vehicles"
                orientation="right"
                tick={{ fontSize: 11, fill: "#8b919d" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f5f7" }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar yAxisId="revenue" dataKey="발렛" stackId="a" fill="#1428A0" radius={[0,0,0,0]} />
              <Bar yAxisId="revenue" dataKey="주차" stackId="a" fill="#F5B731" radius={[4,4,0,0]} />
              <Line
                yAxisId="vehicles"
                dataKey="입차"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 하단 2열 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* 요일별 평균 매출 */}
        <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-[#1a1d26] mb-4">
            <span>📅</span> 요일별 평균 매출
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-[#8b919d] text-sm">로딩 중...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayOfWeekData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 13, fill: "#8b919d" }}
                  tickLine={false}
                  axisLine={{ stroke: "#eef0f3" }}
                />
                <YAxis
                  tickFormatter={yFormatter}
                  tick={{ fontSize: 11, fill: "#8b919d" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()}원`, "평균 매출"]}
                  contentStyle={{
                    background: "#1a1d26", border: "none", borderRadius: 10,
                    color: "#fff", fontSize: 12,
                  }}
                  labelStyle={{ color: "#F5B731", fontWeight: "bold" }}
                  cursor={{ fill: "#f4f5f7" }}
                />
                <Bar
                  dataKey="평균매출"
                  radius={[6, 6, 0, 0]}
                  fill="#1428A0"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 발렛 vs 주차 비율 */}
        <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-base font-bold text-[#1a1d26] mb-4">
            <span>🥧</span> 발렛 vs 주차 비율
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-[#8b919d] text-sm">로딩 중...</div>
          ) : kpi.totalRevenue === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-[#8b919d]">
              <span className="text-2xl mb-2">📊</span>
              <span className="text-sm">데이터 없음</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-2">
              {/* 발렛 */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-semibold text-[#1428A0]">🚗 발렛 매출</span>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#1428A0]">
                      {formatKRW(kpi.valetRevenue)}
                    </span>
                    <span className="text-xs text-[#8b919d] ml-1">
                      ({kpi.totalRevenue ? Math.round((kpi.valetRevenue / kpi.totalRevenue) * 100) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-[#f4f5f7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1428A0] rounded-full transition-all duration-700"
                    style={{ width: `${kpi.totalRevenue ? (kpi.valetRevenue / kpi.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {/* 주차 */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-semibold text-[#c8960a]">🅿️ 주차 매출</span>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#c8960a]">
                      {formatKRW(kpi.parkingRevenue)}
                    </span>
                    <span className="text-xs text-[#8b919d] ml-1">
                      ({kpi.totalRevenue ? Math.round((kpi.parkingRevenue / kpi.totalRevenue) * 100) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-[#f4f5f7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F5B731] rounded-full transition-all duration-700"
                    style={{ width: `${kpi.totalRevenue ? (kpi.parkingRevenue / kpi.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {/* 총합 요약 */}
              <div className="mt-2 p-3 bg-[#f4f5f7] rounded-xl flex justify-between items-center">
                <span className="text-sm text-[#5c6370] font-medium">총 매출</span>
                <span className="text-lg font-extrabold text-[#1a1d26]">
                  {formatKRW(kpi.totalRevenue)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 매장별 비교 ── */}
      <StoreCompare stats={storeStats} loading={loading} />

    </div>
  );
}

// ─── KPI 카드 ────────────────────────────────────────────────────────────────

function KPICard({
  icon, iconBg, value, label, change, unit,
}: {
  icon: string;
  iconBg: string;
  value: string;
  label: string;
  change?: { val: number; up: boolean } | null;
  unit?: string;
}) {
  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-4 md:p-5 shadow-sm">
      <div
        className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="text-xl md:text-2xl font-extrabold text-[#1a1d26] leading-none mb-1">
        {value}
        {unit && value !== "—" && (
          <span className="text-base font-normal text-[#8b919d] ml-0.5">{unit}</span>
        )}
      </div>
      <div className="text-xs md:text-sm text-[#8b919d]">{label}</div>
      {change != null && (
        <div className={`text-xs font-semibold mt-1.5 ${change.up ? "text-[#10b981]" : "text-[#ef4444]"}`}>
          {change.up ? "▲" : "▼"} {Math.abs(change.val)}% 전기 대비
        </div>
      )}
    </div>
  );
}

// ─── 매장별 비교 ─────────────────────────────────────────────────────────────

function StoreCompare({ stats, loading }: { stats: StoreStats[]; loading: boolean }) {
  const maxRev = Math.max(...stats.map(s => s.totalRevenue), 1);

  return (
    <div className="bg-white border border-[#eef0f3] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-base font-bold text-[#1a1d26] mb-5">
        <span>🏆</span> 매장별 비교
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-[#8b919d] text-sm">로딩 중...</div>
      ) : stats.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-[#8b919d]">
          <span className="text-3xl mb-2">🏢</span>
          <span className="text-sm">데이터가 없습니다</span>
        </div>
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#5c6370] border-b border-[#eef0f3]">
                  <th className="text-center py-3 px-3 font-semibold w-10">순위</th>
                  <th className="text-left py-3 px-3 font-semibold">매장</th>
                  <th className="text-right py-3 px-3 font-semibold">총 매출</th>
                  <th className="text-right py-3 px-3 font-semibold">발렛</th>
                  <th className="text-right py-3 px-3 font-semibold">주차</th>
                  <th className="text-right py-3 px-3 font-semibold">입차</th>
                  <th className="text-left py-3 px-3 font-semibold w-36">비중</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.storeId} className="border-b border-[#eef0f3] hover:bg-[#f8f9fb] transition">
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold text-white ${
                        i === 0 ? "bg-[#fbbf24]" : i === 1 ? "bg-[#9ca3af]" : i === 2 ? "bg-[#d97706]" : "bg-[#c5c9d3]"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#1a1d26]">{s.storeName}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#1428A0]">
                      {s.totalRevenue.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right text-[#5c6370]">
                      {s.valetRevenue.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right text-[#5c6370]">
                      {s.parkingRevenue.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right text-[#5c6370]">{s.totalVehicles}대</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#f4f5f7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1428A0]"
                            style={{ width: `${(s.totalRevenue / maxRev) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#8b919d] w-7 text-right">
                          {Math.round((s.totalRevenue / maxRev) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="md:hidden flex flex-col gap-3">
            {stats.map((s, i) => (
              <div key={s.storeId} className="bg-[#f8f9fb] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? "bg-[#fbbf24]" : i === 1 ? "bg-[#9ca3af]" : i === 2 ? "bg-[#d97706]" : "bg-[#c5c9d3]"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="font-bold text-[#1a1d26]">{s.storeName}</span>
                  </div>
                  <span className="text-base font-extrabold text-[#1428A0]">
                    {formatKRW(s.totalRevenue)}
                  </span>
                </div>
                <div className="h-1.5 bg-[#e2e4e9] rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-[#1428A0] rounded-full"
                    style={{ width: `${(s.totalRevenue / maxRev) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs text-[#8b919d]">발렛</div>
                    <div className="text-sm font-semibold text-[#1a1d26]">{formatKRW(s.valetRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8b919d]">주차</div>
                    <div className="text-sm font-semibold text-[#1a1d26]">{formatKRW(s.parkingRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8b919d]">입차</div>
                    <div className="text-sm font-semibold text-[#1a1d26]">{s.totalVehicles}대</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
