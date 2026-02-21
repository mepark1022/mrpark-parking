// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type PeriodType = "today" | "week" | "month" | "quarter" | "custom";

interface Store {
  id: string;
  name: string;
}

interface DailySummary {
  date: string;
  label: string;
  valetRevenue: number;
  parkingRevenue: number;
  totalRevenue: number;
  totalCars: number;
  valetCount: number;
}

interface StoreSummary {
  id: string;
  name: string;
  totalRevenue: number;
  valetRevenue: number;
  parkingRevenue: number;
  totalCars: number;
  valetCount: number;
  avgPerCar: number;
}

interface KpiData {
  totalRevenue: number;
  valetRevenue: number;
  parkingRevenue: number;
  totalCars: number;
  valetCount: number;
  avgPerCar: number;
  prevTotalRevenue: number;
  prevTotalCars: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const PERIOD_OPTIONS: { key: PeriodType; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "week", label: "이번주" },
  { key: "month", label: "이번달" },
  { key: "quarter", label: "3개월" },
  { key: "custom", label: "직접설정" },
];

function getPeriodDates(period: PeriodType, customStart?: string, customEnd?: string) {
  const now = new Date();
  const toISO = (d: Date) => d.toISOString().split("T")[0];

  switch (period) {
    case "today":
      return { start: toISO(now), end: toISO(now) };
    case "week": {
      const mon = new Date(now);
      mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      return { start: toISO(mon), end: toISO(now) };
    }
    case "month":
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: toISO(now) };
    case "quarter": {
      const q = new Date(now);
      q.setMonth(q.getMonth() - 2);
      q.setDate(1);
      return { start: toISO(q), end: toISO(now) };
    }
    case "custom":
      return { start: customStart || toISO(now), end: customEnd || toISO(now) };
    default:
      return { start: toISO(now), end: toISO(now) };
  }
}

const fmt = (n: number) =>
  n >= 100_000_000
    ? `${(n / 100_000_000).toFixed(1)}억`
    : n >= 10_000
    ? `${(n / 10_000).toFixed(0)}만`
    : n.toLocaleString();

const fmtWon = (n: number) => `₩${fmt(n)}`;

function diffBadge(current: number, prev: number) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 6,
        background: up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: up ? "#10b981" : "#ef4444",
      }}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Custom Tooltip
// ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e4e9",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a1d26" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", gap: 8, alignItems: "center", color: "#5c6370" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block" }} />
          {p.name}: <strong style={{ color: "#1a1d26" }}>{typeof p.value === "number" ? (p.name.includes("매출") ? fmtWon(p.value) : p.value.toLocaleString()) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState<PeriodType>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [stores, setStores] = useState<Store[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [dailyData, setDailyData] = useState<DailySummary[]>([]);
  const [storeData, setStoreData] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load stores
  useEffect(() => {
    (async () => {
      const oid = await getOrgId();
      if (!oid) return;
      const { data } = await supabase.from("stores").select("id, name").eq("org_id", oid).order("name");
      setStores(data || []);
    })();
  }, []);

  // Load analytics data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const oid = await getOrgId();
      const { start, end } = getPeriodDates(period, customStart, customEnd);

      // Previous period (same duration)
      const startD = new Date(start);
      const endD = new Date(end);
      const duration = endD.getTime() - startD.getTime();
      const prevEnd = new Date(startD.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - duration);
      const prevStartStr = prevStart.toISOString().split("T")[0];
      const prevEndStr = prevEnd.toISOString().split("T")[0];

      // Query daily_records
      let q = supabase
        .from("daily_records")
        .select("date, store_id, valet_revenue, parking_revenue, total_cars, valet_count")
        .eq("org_id", oid)
        .gte("date", start)
        .lte("date", end)
        .order("date");

      if (selectedStore !== "all") q = q.eq("store_id", selectedStore);

      const { data: records } = await q;

      // Previous period
      let prevQ = supabase
        .from("daily_records")
        .select("date, valet_revenue, parking_revenue, total_cars, valet_count")
        .eq("org_id", oid)
        .gte("date", prevStartStr)
        .lte("date", prevEndStr);
      if (selectedStore !== "all") prevQ = prevQ.eq("store_id", selectedStore);
      const { data: prevRecords } = await prevQ;

      const rows = records || [];
      const prevRows = prevRecords || [];

      // Compute KPI
      const totalRevenue = rows.reduce((s, r) => s + (r.valet_revenue || 0) + (r.parking_revenue || 0), 0);
      const valetRevenue = rows.reduce((s, r) => s + (r.valet_revenue || 0), 0);
      const parkingRevenue = rows.reduce((s, r) => s + (r.parking_revenue || 0), 0);
      const totalCars = rows.reduce((s, r) => s + (r.total_cars || 0), 0);
      const valetCount = rows.reduce((s, r) => s + (r.valet_count || 0), 0);
      const prevTotalRevenue = prevRows.reduce((s, r) => s + (r.valet_revenue || 0) + (r.parking_revenue || 0), 0);
      const prevTotalCars = prevRows.reduce((s, r) => s + (r.total_cars || 0), 0);

      setKpi({
        totalRevenue, valetRevenue, parkingRevenue, totalCars, valetCount,
        avgPerCar: totalCars > 0 ? Math.round(totalRevenue / totalCars) : 0,
        prevTotalRevenue, prevTotalCars,
      });

      // Daily aggregation
      const dateMap: Record<string, DailySummary> = {};
      rows.forEach((r) => {
        if (!dateMap[r.date]) {
          const d = new Date(r.date);
          const mm = d.getMonth() + 1;
          const dd = d.getDate();
          dateMap[r.date] = {
            date: r.date,
            label: `${mm}/${dd}`,
            valetRevenue: 0,
            parkingRevenue: 0,
            totalRevenue: 0,
            totalCars: 0,
            valetCount: 0,
          };
        }
        const entry = dateMap[r.date];
        entry.valetRevenue += r.valet_revenue || 0;
        entry.parkingRevenue += r.parking_revenue || 0;
        entry.totalRevenue += (r.valet_revenue || 0) + (r.parking_revenue || 0);
        entry.totalCars += r.total_cars || 0;
        entry.valetCount += r.valet_count || 0;
      });
      setDailyData(Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)));

      // Store breakdown (all stores view only)
      if (selectedStore === "all") {
        const storeMap: Record<string, StoreSummary> = {};
        rows.forEach((r) => {
          const store = stores.find((s) => s.id === r.store_id);
          const name = store?.name || r.store_id;
          if (!storeMap[r.store_id]) {
            storeMap[r.store_id] = { id: r.store_id, name, totalRevenue: 0, valetRevenue: 0, parkingRevenue: 0, totalCars: 0, valetCount: 0, avgPerCar: 0 };
          }
          const e = storeMap[r.store_id];
          e.valetRevenue += r.valet_revenue || 0;
          e.parkingRevenue += r.parking_revenue || 0;
          e.totalRevenue += (r.valet_revenue || 0) + (r.parking_revenue || 0);
          e.totalCars += r.total_cars || 0;
          e.valetCount += r.valet_count || 0;
        });
        const arr = Object.values(storeMap).map((s) => ({
          ...s,
          avgPerCar: s.totalCars > 0 ? Math.round(s.totalRevenue / s.totalCars) : 0,
        }));
        setStoreData(arr.sort((a, b) => b.totalRevenue - a.totalRevenue));
      }
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, selectedStore, stores]);

  useEffect(() => {
    if (stores.length > 0 || selectedStore === "all") loadData();
  }, [loadData, stores]);

  // ── Pie chart colors
  const PIE_COLORS = ["#1428A0", "#F5B731", "#10b981", "#6366f1", "#ef4444", "#0ea5e9"];

  // ── Render ──────────────────────────────────────────────────
  return (
    <AppLayout>
    <div className="analytics-page">
      <style>{`
        @media (max-width: 767px) {
          .analytics-page { padding: 12px 14px !important; }
          .analytics-controls { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; margin-bottom: 14px !important; }
          .analytics-period-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px !important; }
          .analytics-period-tabs > div { white-space: nowrap; }
          .analytics-filter-wrap { gap: 8px !important; }
          .analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; margin-bottom: 14px !important; }
          .analytics-kpi-grid > div { padding: 14px 14px !important; border-radius: 12px !important; }
          .analytics-kpi-grid .kpi-icon { width: 34px !important; height: 34px !important; font-size: 18px !important; margin-bottom: 8px !important; border-radius: 10px !important; }
          .analytics-kpi-grid .kpi-value { font-size: 18px !important; }
          .analytics-chart-wrap { border-radius: 12px !important; padding: 12px 10px !important; margin-bottom: 14px !important; }
          .analytics-bottom-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
          .analytics-store-table { font-size: 12px !important; }
          .analytics-store-table th, .analytics-store-table td { padding: 10px 10px !important; }
        }
      `}</style>
      {/* ── Top Controls ────────────────────────────────────── */}
      <div
        className="analytics-controls"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Period tabs */}
        <div
          className="analytics-period-tabs"
          style={{
            display: "flex",
            gap: 4,
            background: "#f4f5f7",
            padding: 4,
            borderRadius: 10,
            border: "1px solid #e2e4e9",
          }}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                transition: "all 0.2s",
                background: period === opt.key ? "#fff" : "transparent",
                color: period === opt.key ? "#1428A0" : "#5c6370",
                boxShadow: period === opt.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Store filter + custom dates */}
        <div className="analytics-filter-wrap" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {period === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: "10px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 14 }}
              />
              <span style={{ color: "#8b919d" }}>~</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: "10px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 14 }}
              />
            </>
          )}
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            style={{
              padding: "10px 14px",
              border: "1px solid #e2e4e9",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              background: "#fff",
              color: "#1a1d26",
              minWidth: 130,
            }}
          >
            <option value="all">🏢 전체 매장</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div
        className="analytics-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            icon: "💰",
            label: "총 매출",
            value: fmtWon(kpi?.totalRevenue || 0),
            sub: diffBadge(kpi?.totalRevenue || 0, kpi?.prevTotalRevenue || 0),
            accent: "#1428A0",
            bg: "rgba(20,40,160,0.06)",
          },
          {
            icon: "🚗",
            label: "발렛 매출",
            value: fmtWon(kpi?.valetRevenue || 0),
            sub: kpi ? (
              <span style={{ fontSize: 12, color: "#8b919d" }}>
                {kpi.valetCount.toLocaleString()}건
              </span>
            ) : null,
            accent: "#F5B731",
            bg: "rgba(245,183,49,0.1)",
          },
          {
            icon: "🅿️",
            label: "주차 매출",
            value: fmtWon(kpi?.parkingRevenue || 0),
            sub: kpi ? (
              <span style={{ fontSize: 12, color: "#8b919d" }}>
                {kpi.totalCars.toLocaleString()}대 입차
              </span>
            ) : null,
            accent: "#10b981",
            bg: "rgba(16,185,129,0.08)",
          },
          {
            icon: "💳",
            label: "건당 매출",
            value: fmtWon(kpi?.avgPerCar || 0),
            sub: diffBadge(kpi?.totalCars || 0, kpi?.prevTotalCars || 0),
            accent: "#6366f1",
            bg: "rgba(99,102,241,0.08)",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "20px 24px",
              border: "1px solid #eef0f3",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: card.accent,
                borderRadius: "16px 16px 0 0",
              }}
            />
            <div
              className="kpi-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: card.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                marginBottom: 14,
              }}
            >
              {card.icon}
            </div>
            <div
              className="kpi-value"
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#1a1d26",
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {loading ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 100,
                    height: 26,
                    borderRadius: 6,
                    background: "#f4f5f7",
                    animation: "pulse 1.5s infinite",
                  }}
                />
              ) : (
                card.value
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#8b919d" }}>{card.label}</span>
              {!loading && card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue Trend Chart ─────────────────────────────── */}
      <div
        className="analytics-chart-wrap"
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eef0f3",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #eef0f3",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26" }}>매출 추이</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#8b919d" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#1428A0", display: "inline-block" }} />
              발렛 매출
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }} />
              주차 매출
            </span>
          </div>
        </div>
          <div style={{ padding: "20px 8px 12px" }}>
          {loading || dailyData.length === 0 ? (
            <div
              style={{
                height: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8b919d",
                fontSize: 14,
                background: "#f8f9fb",
                borderRadius: 12,
                margin: "0 16px",
              }}
            >
              {loading ? "데이터 로드 중..." : "해당 기간에 데이터가 없습니다"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 180 : 260} className="analytics-chart-area">
              <AreaChart data={dailyData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="valetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1428A0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1428A0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="parkingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8b919d" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="valetRevenue" name="발렛 매출" stroke="#1428A0" strokeWidth={2} fill="url(#valetGrad)" dot={false} activeDot={{ r: 5, fill: "#1428A0" }} />
                <Area type="monotone" dataKey="parkingRevenue" name="주차 매출" stroke="#10b981" strokeWidth={2} fill="url(#parkingGrad)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Grid: Store Comparison + Entry Chart ─────── */}
      <div className="analytics-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Store bar chart */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #eef0f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>🏢</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매장별 매출 비교</span>
          </div>
          <div style={{ padding: "16px 8px 12px" }}>
            {loading || storeData.length === 0 ? (
              <div
                style={{
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8b919d",
                  fontSize: 14,
                  background: "#f8f9fb",
                  borderRadius: 10,
                  margin: "0 16px",
                }}
              >
                {loading ? "로드 중..." : selectedStore !== "all" ? "전체 매장 선택 시 비교 가능" : "데이터 없음"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 160 : 220}>
                <BarChart data={storeData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8b919d" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="valetRevenue" name="발렛 매출" stackId="a" fill="#1428A0" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="parkingRevenue" name="주차 매출" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily cars bar */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #eef0f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>🚗</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>일별 입차량 추이</span>
          </div>
          <div style={{ padding: "16px 8px 12px" }}>
            {loading || dailyData.length === 0 ? (
              <div
                style={{
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8b919d",
                  fontSize: 14,
                  background: "#f8f9fb",
                  borderRadius: 10,
                  margin: "0 16px",
                }}
              >
                {loading ? "로드 중..." : "데이터 없음"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 160 : 220}>
                <BarChart data={dailyData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8b919d" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalCars" name="입차량" fill="#F5B731" radius={[6, 6, 0, 0]}>
                    {dailyData.map((_, index) => (
                      <Cell key={index} fill={index === dailyData.length - 1 ? "#1428A0" : "#F5B731"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Store Detail Table ───────────────────────────────── */}
      {selectedStore === "all" && storeData.length > 0 && (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #eef0f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>🏆</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매장별 상세 실적</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f4f5f7" }}>
                  {["순위", "매장명", "총 매출", "발렛 매출", "주차 매출", "입차량", "발렛 건수", "건당 매출"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: h === "순위" || h === "입차량" || h === "발렛 건수" ? "center" : "left",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#5c6370",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeData.map((store, idx) => (
                  <tr
                    key={store.id}
                    style={{ borderBottom: "1px solid #eef0f3", transition: "background 0.15s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f8f9fb")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                  >
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          background: idx === 0 ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : idx === 1 ? "linear-gradient(135deg, #9ca3af, #6b7280)" : idx === 2 ? "linear-gradient(135deg, #d97706, #b45309)" : "#e2e4e9",
                          color: idx < 3 ? "#fff" : "#5c6370",
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: 14 }}>{store.name}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#1428A0", fontSize: 14 }}>{fmtWon(store.totalRevenue)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#5c6370" }}>{fmtWon(store.valetRevenue)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#5c6370" }}>{fmtWon(store.parkingRevenue)}</td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14 }}>{store.totalCars.toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14 }}>{store.valetCount.toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#10b981", fontWeight: 600 }}>{fmtWon(store.avgPerCar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Revenue Composition (Pie) ───────────────────────── */}
      <div className="analytics-charts-grid analytics-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Pie chart */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #eef0f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매출 구성비</span>
          </div>
          <div
            style={{
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {kpi && (kpi.valetRevenue > 0 || kpi.parkingRevenue > 0) ? (
              <>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "발렛", value: kpi.valetRevenue },
                        { name: "주차", value: kpi.parkingRevenue },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill="#1428A0" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtWon(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {[
                    { label: "발렛 매출", value: kpi.valetRevenue, color: "#1428A0" },
                    { label: "주차 매출", value: kpi.parkingRevenue, color: "#10b981" },
                  ].map((item) => {
                    const total = kpi.valetRevenue + kpi.parkingRevenue;
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                    return (
                      <div key={item.label} style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                            fontSize: 13,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#5c6370" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: "inline-block" }} />
                            {item.label}
                          </span>
                          <span style={{ fontWeight: 700, color: "#1a1d26" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: "#f4f5f7", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: item.color,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 12, color: "#8b919d", marginTop: 4 }}>{fmtWon(item.value)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div
                style={{
                  height: 180,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8b919d",
                  fontSize: 14,
                  width: "100%",
                  background: "#f8f9fb",
                  borderRadius: 10,
                }}
              >
                데이터 없음
              </div>
            )}
          </div>
        </div>

        {/* Top days ranking */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid #eef0f3",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매출 TOP 일자</span>
          </div>
          <div style={{ padding: "16px 24px" }}>
            {[...dailyData]
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .slice(0, 5)
              .map((d, idx) => (
                <div
                  key={d.date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: idx === 0 ? "rgba(20,40,160,0.04)" : "#f8f9fb",
                    marginBottom: 8,
                    border: idx === 0 ? "1px solid rgba(20,40,160,0.12)" : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      background: idx === 0 ? "#1428A0" : idx === 1 ? "#6b7280" : idx === 2 ? "#d97706" : "#e2e4e9",
                      color: idx < 3 ? "#fff" : "#8b919d",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 14, color: "#5c6370", flex: 1 }}>{d.date}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1428A0" }}>{fmtWon(d.totalRevenue)}</span>
                  <span style={{ fontSize: 12, color: "#8b919d" }}>{d.totalCars}대</span>
                </div>
              ))}
            {dailyData.length === 0 && (
              <div style={{ color: "#8b919d", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
                데이터 없음
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 768px) {
          .analytics-page {
            padding: 16px !important;
          }
          .analytics-controls {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .analytics-period-tabs {
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            flex-shrink: 0;
            white-space: nowrap;
            scrollbar-width: none;
          }
          .analytics-period-tabs::-webkit-scrollbar {
            display: none;
          }
          .analytics-period-tabs button {
            flex-shrink: 0 !important;
            padding: 8px 16px !important;
            font-size: 13px !important;
          }
          .analytics-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          .analytics-charts-grid {
            grid-template-columns: 1fr !important;
          }
          .analytics-chart-area {
            height: 180px !important;
          }
          .analytics-filter-wrap {
            width: 100%;
          }
          .analytics-filter-wrap select,
          .analytics-filter-wrap input[type="date"] {
            width: 100% !important;
            min-width: unset !important;
          }
        }
      `}</style>
    </div>
    </AppLayout>
  );
}
