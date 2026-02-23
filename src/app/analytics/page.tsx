// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type PeriodType = "today" | "week" | "month" | "quarter" | "custom";

interface Store { id: string; name: string; }

interface DailySummary {
  date: string; label: string;
  valetRevenue: number; parkingRevenue: number;
  totalRevenue: number; totalCars: number; valetCount: number;
}

interface StoreSummary {
  id: string; name: string;
  totalRevenue: number; valetRevenue: number; parkingRevenue: number;
  totalCars: number; valetCount: number; avgPerCar: number;
}

interface KpiData {
  totalRevenue: number; valetRevenue: number; parkingRevenue: number;
  totalCars: number; valetCount: number; avgPerCar: number;
  prevTotalRevenue: number; prevTotalCars: number;
}

// ────────────────────────────────────────────────────────────
// Constants & Helpers
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
    case "today": return { start: toISO(now), end: toISO(now) };
    case "week": {
      const mon = new Date(now);
      mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      return { start: toISO(mon), end: toISO(now) };
    }
    case "month":
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: toISO(now) };
    case "quarter": {
      const q = new Date(now); q.setMonth(q.getMonth() - 2); q.setDate(1);
      return { start: toISO(q), end: toISO(now) };
    }
    case "custom": return { start: customStart || toISO(now), end: customEnd || toISO(now) };
    default: return { start: toISO(now), end: toISO(now) };
  }
}

const fmt = (n: number) =>
  n >= 100_000_000 ? `${(n / 100_000_000).toFixed(1)}억`
  : n >= 10_000 ? `${(n / 10_000).toFixed(0)}만`
  : n.toLocaleString();
const fmtWon = (n: number) => `₩${fmt(n)}`;

function DiffBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
      background: up ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
      color: up ? "#16A34A" : "#DC2626",
    }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e4e9", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 13 }}>
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

// ── 모바일 전용 CSS 바 차트
function MobileBarChart({ data }: { data: DailySummary[] }) {
  if (!data.length) return (
    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>데이터 없음</div>
  );
  const visible = data.slice(-10);
  const maxVal = Math.max(...visible.map(d => d.totalRevenue), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100, padding: "0 4px" }}>
        {visible.map((d) => {
          const valetH = Math.round((d.valetRevenue / maxVal) * 88);
          const parkH = Math.round((d.parkingRevenue / maxVal) * 88);
          return (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                {valetH > 0 && <div style={{ width: "100%", height: valetH, background: "#1428A0", borderRadius: "4px 4px 0 0" }} />}
                {parkH > 0 && <div style={{ width: "100%", height: parkH, background: "#16A34A", borderRadius: valetH > 0 ? "0 0 4px 4px" : "4px" }} />}
                {valetH === 0 && parkH === 0 && <div style={{ width: "100%", height: 2, background: "#e2e8f0", borderRadius: 2 }} />}
              </div>
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#1428A0" }} />발렛
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#16A34A" }} />주차
        </div>
      </div>
    </div>
  );
}

const RANK_COLORS = ["#1428A0", "#9ca3af", "#d97706"];

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

  useEffect(() => {
    (async () => {
      const oid = await getOrgId();
      if (!oid) return;
      const { data } = await supabase.from("stores").select("id, name").eq("org_id", oid).order("name");
      setStores(data || []);
    })();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const oid = await getOrgId();
      const { start, end } = getPeriodDates(period, customStart, customEnd);
      const startD = new Date(start); const endD = new Date(end);
      const duration = endD.getTime() - startD.getTime();
      const prevEnd = new Date(startD.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - duration);
      const prevStartStr = prevStart.toISOString().split("T")[0];
      const prevEndStr = prevEnd.toISOString().split("T")[0];

      let q = supabase.from("daily_records")
        .select("date, store_id, valet_revenue, parking_revenue, total_cars, valet_count")
        .eq("org_id", oid).gte("date", start).lte("date", end).order("date");
      if (selectedStore !== "all") q = q.eq("store_id", selectedStore);
      const { data: records } = await q;

      let prevQ = supabase.from("daily_records")
        .select("date, valet_revenue, parking_revenue, total_cars, valet_count")
        .eq("org_id", oid).gte("date", prevStartStr).lte("date", prevEndStr);
      if (selectedStore !== "all") prevQ = prevQ.eq("store_id", selectedStore);
      const { data: prevRecords } = await prevQ;

      const rows = records || []; const prevRows = prevRecords || [];

      const totalRevenue = rows.reduce((s, r) => s + (r.valet_revenue || 0) + (r.parking_revenue || 0), 0);
      const valetRevenue = rows.reduce((s, r) => s + (r.valet_revenue || 0), 0);
      const parkingRevenue = rows.reduce((s, r) => s + (r.parking_revenue || 0), 0);
      const totalCars = rows.reduce((s, r) => s + (r.total_cars || 0), 0);
      const valetCount = rows.reduce((s, r) => s + (r.valet_count || 0), 0);
      const prevTotalRevenue = prevRows.reduce((s, r) => s + (r.valet_revenue || 0) + (r.parking_revenue || 0), 0);
      const prevTotalCars = prevRows.reduce((s, r) => s + (r.total_cars || 0), 0);

      setKpi({ totalRevenue, valetRevenue, parkingRevenue, totalCars, valetCount, avgPerCar: totalCars > 0 ? Math.round(totalRevenue / totalCars) : 0, prevTotalRevenue, prevTotalCars });

      const dateMap: Record<string, DailySummary> = {};
      rows.forEach((r) => {
        if (!dateMap[r.date]) {
          const d = new Date(r.date);
          dateMap[r.date] = { date: r.date, label: `${d.getMonth() + 1}/${d.getDate()}`, valetRevenue: 0, parkingRevenue: 0, totalRevenue: 0, totalCars: 0, valetCount: 0 };
        }
        dateMap[r.date].valetRevenue += r.valet_revenue || 0;
        dateMap[r.date].parkingRevenue += r.parking_revenue || 0;
        dateMap[r.date].totalRevenue += (r.valet_revenue || 0) + (r.parking_revenue || 0);
        dateMap[r.date].totalCars += r.total_cars || 0;
        dateMap[r.date].valetCount += r.valet_count || 0;
      });
      setDailyData(Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)));

      if (selectedStore === "all") {
        const storeMap: Record<string, StoreSummary> = {};
        rows.forEach((r) => {
          const store = stores.find((s) => s.id === r.store_id);
          const name = store?.name || r.store_id;
          if (!storeMap[r.store_id]) storeMap[r.store_id] = { id: r.store_id, name, totalRevenue: 0, valetRevenue: 0, parkingRevenue: 0, totalCars: 0, valetCount: 0, avgPerCar: 0 };
          storeMap[r.store_id].valetRevenue += r.valet_revenue || 0;
          storeMap[r.store_id].parkingRevenue += r.parking_revenue || 0;
          storeMap[r.store_id].totalRevenue += (r.valet_revenue || 0) + (r.parking_revenue || 0);
          storeMap[r.store_id].totalCars += r.total_cars || 0;
          storeMap[r.store_id].valetCount += r.valet_count || 0;
        });
        setStoreData(Object.values(storeMap).map(s => ({ ...s, avgPerCar: s.totalCars > 0 ? Math.round(s.totalRevenue / s.totalCars) : 0 })).sort((a, b) => b.totalRevenue - a.totalRevenue));
      }
    } finally { setLoading(false); }
  }, [period, customStart, customEnd, selectedStore, stores]);

  useEffect(() => { if (stores.length > 0 || selectedStore === "all") loadData(); }, [loadData, stores]);

  const totalRevenueForPie = (kpi?.valetRevenue || 0) + (kpi?.parkingRevenue || 0);

  // ── 전기간 대비 % 계산 유틸
  const revPct = kpi && kpi.prevTotalRevenue > 0
    ? ((kpi.totalRevenue - kpi.prevTotalRevenue) / kpi.prevTotalRevenue) * 100
    : null;

  // ════════════════════════════════════════════════════════════
  // LAYOUT (CSS @media: mobile + desktop)
  // ════════════════════════════════════════════════════════════
  return (
      <AppLayout>
        <style>{`
          @keyframes an-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
          .an-sk { background:#f1f5f9; border-radius:8px; animation:an-pulse 1.5s infinite; display:inline-block; }
          .an-period-tabs::-webkit-scrollbar { display:none; }
          .an-store-chips::-webkit-scrollbar { display:none; }
          @media(max-width:767px){.an-desktop{display:none!important}.an-mobile{display:block!important}}
          @media(min-width:768px){.an-desktop{display:block!important}.an-mobile{display:none!important}}
        `}</style>
        <div className="an-mobile" style={{display:'none'}}>

        <div style={{ background: "#f8f9fb", minHeight: "100vh", paddingBottom: 80 }}>

          {/* 상단 네이비 헤더 */}
          <div style={{ background: "linear-gradient(135deg, #1428A0 0%, #0f1e80 100%)", padding: "16px 16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>📊 매출 분석</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                  {PERIOD_OPTIONS.find(o => o.key === period)?.label} 기준
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 2 }}>총 매출</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                  {loading ? "···" : fmtWon(kpi?.totalRevenue || 0)}
                </div>
              </div>
            </div>
            <div style={{ height: 3, background: "#F5B731", borderRadius: 2, marginTop: 14 }} />
          </div>

          {/* 기간 탭 */}
          <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
            <div className="an-period-tabs" style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", padding: "0 12px" }}>
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setPeriod(opt.key)} style={{
                  flexShrink: 0, padding: "12px 14px", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  border: "none", borderBottom: period === opt.key ? "3px solid #1428A0" : "3px solid transparent",
                  background: "transparent", color: period === opt.key ? "#1428A0" : "#94a3b8",
                  cursor: "pointer", transition: "color 0.15s",
                }}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* 직접설정 날짜 */}
          {period === "custom" && (
            <div style={{ background: "#fff", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
              <span style={{ color: "#94a3b8", fontWeight: 700 }}>~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            </div>
          )}

          {/* 매장 칩 필터 */}
          <div className="an-store-chips" style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
            {[{ id: "all", name: "🏢 전체" }, ...stores].map(s => (
              <button key={s.id} onClick={() => setSelectedStore(s.id)} style={{
                flexShrink: 0, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                border: "1.5px solid", cursor: "pointer", transition: "all 0.15s",
                background: selectedStore === s.id ? "#1428A0" : "#fff",
                color: selectedStore === s.id ? "#fff" : "#64748b",
                borderColor: selectedStore === s.id ? "#1428A0" : "#e2e8f0",
              }}>{s.name}</button>
            ))}
          </div>

          {/* 총 매출 강조 카드 */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, #1428A0 0%, #0f1e80 100%)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700, marginBottom: 4 }}>
                    {PERIOD_OPTIONS.find(o => o.key === period)?.label} 총 매출
                  </div>
                  {loading
                    ? <span className="an-sk" style={{ width: 100, height: 28 }} />
                    : <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{fmtWon(kpi?.totalRevenue || 0)}</div>
                  }
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 2 }}>전기간 대비</div>
                  {revPct !== null
                    ? <div style={{ fontSize: 18, fontWeight: 800, color: revPct >= 0 ? "#F5B731" : "#ef4444" }}>{revPct >= 0 ? "▲" : "▼"} {Math.abs(revPct).toFixed(1)}%</div>
                    : <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>-</div>
                  }
                </div>
              </div>
              <div style={{ padding: "0 16px" }}>
                {[
                  { dot: "#1428A0", label: "발렛 매출", value: kpi?.valetRevenue || 0 },
                  { dot: "#16A34A", label: "주차 매출", value: kpi?.parkingRevenue || 0 },
                  { dot: "#F5B731", label: "건당 평균", value: kpi?.avgPerCar || 0 },
                ].map((row, i) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: row.dot }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>{row.label}</span>
                    </div>
                    {loading
                      ? <span className="an-sk" style={{ width: 60, height: 16 }} />
                      : <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1d2b" }}>{fmtWon(row.value)}</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI 2열 */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 4, height: 18, background: "#1428A0", borderRadius: 2 }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>주요 지표</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { accent: "#1428A0", bg: "rgba(20,40,160,0.07)", icon: "🚗", label: "총 입차", value: `${(kpi?.totalCars || 0).toLocaleString()}대`, badge: <DiffBadge current={kpi?.totalCars || 0} prev={kpi?.prevTotalCars || 0} /> },
                { accent: "#F5B731", bg: "rgba(245,183,49,0.1)", icon: "🤵", label: "발렛 건수", value: `${(kpi?.valetCount || 0).toLocaleString()}건`, badge: null },
              ].map(card => (
                <div key={card.label} style={{ background: "#fff", borderRadius: 18, padding: 14, boxShadow: "0 2px 10px rgba(20,40,160,0.07)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: card.accent, borderRadius: "14px 14px 0 0" }} />
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{card.icon}</div>
                  {loading ? <span className="an-sk" style={{ width: "70%", height: 22, marginBottom: 4 }} /> : (
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d2b", lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>{card.label}</div>
                  {!loading && card.badge}
                </div>
              ))}
            </div>
          </div>

          {/* 일별 매출 CSS 바 차트 */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>📈 일별 매출</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>최근 10일</div>
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                {loading
                  ? <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>로드 중...</div>
                  : <MobileBarChart data={dailyData} />
                }
              </div>
            </div>
          </div>

          {/* 매출 구성비 */}
          {!loading && kpi && totalRevenueForPie > 0 && (
            <div style={{ padding: "14px 16px 0" }}>
              <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.08)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>🎯 매출 구성비</div>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {[
                    { label: "발렛 매출", value: kpi.valetRevenue, color: "#1428A0" },
                    { label: "주차 매출", value: kpi.parkingRevenue, color: "#16A34A" },
                  ].map(item => {
                    const pct = totalRevenueForPie > 0 ? ((item.value / totalRevenueForPie) * 100).toFixed(1) : "0";
                    return (
                      <div key={item.label} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#64748b" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: "inline-block" }} />{item.label}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1d2b" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: item.color, borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, fontWeight: 600 }}>{fmtWon(item.value)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 매장별 순위 */}
          {selectedStore === "all" && storeData.length > 0 && (
            <div style={{ padding: "14px 16px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 4, height: 18, background: "#F5B731", borderRadius: 2 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>매장별 순위</div>
              </div>
              <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.08)", overflow: "hidden" }}>
                {storeData.map((store, idx) => (
                  <div key={store.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: idx < storeData.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800,
                      background: idx < 3 ? RANK_COLORS[idx] : "#e2e8f0",
                      color: idx < 3 ? "#fff" : "#94a3b8",
                    }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{store.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 1 }}>{store.totalCars}대 · 건당 {fmtWon(store.avgPerCar)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1428A0" }}>{fmtWon(store.totalRevenue)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>발렛 {fmtWon(store.valetRevenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 매출 TOP 일자 */}
          {dailyData.length > 0 && (
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 4, height: 18, background: "#EA580C", borderRadius: 2 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>매출 TOP 일자</div>
              </div>
              <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.08)", overflow: "hidden" }}>
                {[...dailyData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5).map((d, idx) => (
                  <div key={d.date} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: idx < 4 ? "1px solid #f1f5f9" : "none",
                    background: idx === 0 ? "rgba(20,40,160,0.03)" : "transparent",
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: idx < 3 ? RANK_COLORS[idx] : "#e2e8f0", color: idx < 3 ? "#fff" : "#94a3b8" }}>{idx + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#64748b" }}>{d.date}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1428A0" }}>{fmtWon(d.totalRevenue)}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{d.totalCars}대</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        </div> {/* .an-mobile */}

        <div className="an-desktop">
        {/* ════════════════════════════════════════════════════════
            PC LAYOUT
            ════════════════════════════════════════════════════ */}
      <div style={{ padding: "24px 28px" }}>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 4, background: "#f4f5f7", padding: 4, borderRadius: 10, border: "1px solid #e2e4e9" }}>
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setPeriod(opt.key)} style={{
                padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: "none", transition: "all 0.2s", fontFamily: "inherit",
                background: period === opt.key ? "#fff" : "transparent",
                color: period === opt.key ? "#1428A0" : "#5c6370",
                boxShadow: period === opt.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>{opt.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {period === "custom" && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
                <span style={{ color: "#8b919d" }}>~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
              </>
            )}
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "10px 14px", border: "1px solid #e2e4e9", borderRadius: 8, fontSize: 14, fontWeight: 500, background: "#fff", color: "#1a1d26", minWidth: 130, fontFamily: "inherit" }}>
              <option value="all">🏢 전체 매장</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* KPI 4열 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { icon: "💰", label: "총 매출", value: fmtWon(kpi?.totalRevenue || 0), sub: <DiffBadge current={kpi?.totalRevenue || 0} prev={kpi?.prevTotalRevenue || 0} />, accent: "#1428A0", bg: "rgba(20,40,160,0.06)" },
            { icon: "🚗", label: "발렛 매출", value: fmtWon(kpi?.valetRevenue || 0), sub: <span style={{ fontSize: 12, color: "#8b919d" }}>{(kpi?.valetCount || 0).toLocaleString()}건</span>, accent: "#F5B731", bg: "rgba(245,183,49,0.1)" },
            { icon: "🅿️", label: "주차 매출", value: fmtWon(kpi?.parkingRevenue || 0), sub: <span style={{ fontSize: 12, color: "#8b919d" }}>{(kpi?.totalCars || 0).toLocaleString()}대 입차</span>, accent: "#10b981", bg: "rgba(16,185,129,0.08)" },
            { icon: "💳", label: "건당 매출", value: fmtWon(kpi?.avgPerCar || 0), sub: <DiffBadge current={kpi?.totalCars || 0} prev={kpi?.prevTotalCars || 0} />, accent: "#6366f1", bg: "rgba(99,102,241,0.08)" },
          ].map(card => (
            <div key={card.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: card.accent, borderRadius: "16px 16px 0 0" }} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{card.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1d26", lineHeight: 1, marginBottom: 6 }}>
                {loading ? <span className="an-sk" style={{ width: 100, height: 26 }} /> : card.value}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#8b919d" }}>{card.label}</span>
                {!loading && card.sub}
              </div>
            </div>
          ))}
        </div>

        {/* 매출 추이 */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", marginBottom: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #eef0f3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📈</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26" }}>매출 추이</span>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#8b919d" }}>
              {[{ color: "#1428A0", label: "발렛 매출" }, { color: "#10b981", label: "주차 매출" }].map(l => (
                <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: "inline-block" }} />{l.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: "20px 8px 12px" }}>
            {loading || dailyData.length === 0 ? (
              <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b919d", fontSize: 14, background: "#f8f9fb", borderRadius: 12, margin: "0 16px" }}>
                {loading ? "데이터 로드 중..." : "해당 기간에 데이터가 없습니다"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
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
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="valetRevenue" name="발렛 매출" stroke="#1428A0" strokeWidth={2} fill="url(#valetGrad)" dot={false} activeDot={{ r: 5, fill: "#1428A0" }} />
                  <Area type="monotone" dataKey="parkingRevenue" name="주차 매출" stroke="#10b981" strokeWidth={2} fill="url(#parkingGrad)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 매장비교 + 입차량 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {[
            {
              icon: "🏢", title: "매장별 매출 비교",
              content: storeData.length === 0
                ? <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b919d", fontSize: 14, background: "#f8f9fb", borderRadius: 10, margin: "0 16px" }}>{loading ? "로드 중..." : selectedStore !== "all" ? "전체 매장 선택 시 비교 가능" : "데이터 없음"}</div>
                : <ResponsiveContainer width="100%" height={220}><BarChart data={storeData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8b919d" }} axisLine={false} tickLine={false} /><YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={55} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="valetRevenue" name="발렛 매출" stackId="a" fill="#1428A0" /><Bar dataKey="parkingRevenue" name="주차 매출" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            },
            {
              icon: "🚗", title: "일별 입차량 추이",
              content: dailyData.length === 0
                ? <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b919d", fontSize: 14, background: "#f8f9fb", borderRadius: 10, margin: "0 16px" }}>{loading ? "로드 중..." : "데이터 없음"}</div>
                : <ResponsiveContainer width="100%" height={220}><BarChart data={dailyData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8b919d" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#8b919d" }} axisLine={false} tickLine={false} width={40} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="totalCars" name="입차량" fill="#F5B731" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            },
          ].map(panel => (
            <div key={panel.title} style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{panel.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>{panel.title}</span>
              </div>
              <div style={{ padding: "16px 8px 12px" }}>{panel.content}</div>
            </div>
          ))}
        </div>

        {/* 매장별 상세 테이블 */}
        {selectedStore === "all" && storeData.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매장별 상세 실적</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f4f5f7" }}>
                    {["순위", "매장명", "총 매출", "발렛 매출", "주차 매출", "입차량", "발렛 건수", "건당 매출"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: ["순위", "입차량", "발렛 건수"].includes(h) ? "center" : "left", fontSize: 13, fontWeight: 600, color: "#5c6370", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {storeData.map((store, idx) => (
                    <tr key={store.id} style={{ borderBottom: "1px solid #eef0f3" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8f9fb"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: idx < 3 ? RANK_COLORS[idx] : "#e2e4e9", color: idx < 3 ? "#fff" : "#5c6370" }}>{idx + 1}</span>
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

        {/* 파이차트 + TOP 일자 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매출 구성비</span>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 24 }}>
              {kpi && totalRevenueForPie > 0 ? (
                <>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={[{ name: "발렛", value: kpi.valetRevenue }, { name: "주차", value: kpi.parkingRevenue }]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        <Cell fill="#1428A0" /><Cell fill="#10b981" />
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtWon(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {[{ label: "발렛 매출", value: kpi.valetRevenue, color: "#1428A0" }, { label: "주차 매출", value: kpi.parkingRevenue, color: "#10b981" }].map(item => {
                      const pct = totalRevenueForPie > 0 ? ((item.value / totalRevenueForPie) * 100).toFixed(1) : "0";
                      return (
                        <div key={item.label} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#5c6370" }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: "inline-block" }} />{item.label}
                            </span>
                            <span style={{ fontWeight: 700, color: "#1a1d26" }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, background: "#f4f5f7", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: item.color, borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 12, color: "#8b919d", marginTop: 4 }}>{fmtWon(item.value)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b919d", fontSize: 14, width: "100%", background: "#f8f9fb", borderRadius: 10 }}>데이터 없음</div>
              )}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d26" }}>매출 TOP 일자</span>
            </div>
            <div style={{ padding: "16px 24px" }}>
              {[...dailyData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5).map((d, idx) => (
                <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 12px", borderRadius: 10, background: idx === 0 ? "rgba(20,40,160,0.04)" : "#f8f9fb", marginBottom: 8, border: idx === 0 ? "1px solid rgba(20,40,160,0.12)" : "1px solid transparent" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: idx < 3 ? RANK_COLORS[idx] : "#e2e4e9", color: idx < 3 ? "#fff" : "#8b919d", flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ fontSize: 14, color: "#5c6370", flex: 1 }}>{d.date}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1428A0" }}>{fmtWon(d.totalRevenue)}</span>
                  <span style={{ fontSize: 12, color: "#8b919d" }}>{d.totalCars}대</span>
                </div>
              ))}
              {dailyData.length === 0 && <div style={{ color: "#8b919d", fontSize: 14, textAlign: "center", padding: "40px 0" }}>데이터 없음</div>}
            </div>
          </div>
        </div>
      </div>
        </div> {/* .an-desktop */}
      </AppLayout>
  );
}
