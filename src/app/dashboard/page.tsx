// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Store } from "@/lib/types/database";

type DailyRecord = {
  id: string; store_id: string; date: string;
  total_cars: number; valet_count: number;
  valet_revenue: number; daily_revenue: number;
  stores: { name: string } | null;
};
type HourlyRow = { hour: number; car_count: number; record_id: string };
type AssignmentRow = { worker_id: string; worker_type: string; workers: { name: string } | null; record_id: string };
type MonthlyContract = { id: string; store_id: string; contract_status: string; monthly_fee: number; end_date: string; stores: { name: string } | null };

const CHART_COLORS = ["#1428A0", "#F5B731", "#43A047", "#E53935", "#0F9ED5", "#E97132", "#7B1FA2", "#156082", "#666666", "#00BCD4"];

function getThisWeekRange() {
  const now = new Date(); const day = now.getDay(); const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now); monday.setDate(now.getDate() - diff);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] };
}
function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}
function getOccColor(occ) {
  if (occ > 85) return { text: "#ef4444", bg: "#fef2f2", bar: "#ef4444", label: "만차임박" };
  if (occ > 60) return { text: "#f59e0b", bg: "#fffbeb", bar: "#f59e0b", label: "혼잡" };
  return { text: "#10b981", bg: "#ecfdf5", bar: "#10b981", label: "여유" };
}

export default function DashboardPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [period, setPeriod] = useState<"today"|"week"|"month"|"custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [monthlyContracts, setMonthlyContracts] = useState<MonthlyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string|null>(null);
  const [showValet, setShowValet] = useState(true);
  const [showParking, setShowParking] = useState(true);
  const [parkingStatus, setParkingStatus] = useState([]);
  const [parkingStoreId, setParkingStoreId] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [selectedStore, period, customStart, customEnd]);
  useEffect(() => { loadParkingStatus(); }, [stores]);

  async function loadParkingStatus() {
    if (!orgId) return;
    const { data: lots } = await supabase.from("parking_lots").select("*, stores(name)").eq("org_id", orgId);
    if (!lots || lots.length === 0) { setParkingStatus([]); return; }
    const today = new Date().toISOString().split("T")[0];
    const { data: todayRecs } = await supabase.from("daily_records").select("store_id, total_cars").eq("org_id", orgId).eq("date", today);
    const carsMap = {};
    (todayRecs || []).forEach(r => { carsMap[r.store_id] = (carsMap[r.store_id] || 0) + r.total_cars; });
    const storeMap = {};
    lots.forEach(lot => {
      const lotTotal = (lot.self_spaces || 0) + (lot.mechanical_normal || 0) + (lot.mechanical_suv || 0);
      if (!storeMap[lot.store_id]) storeMap[lot.store_id] = { storeId: lot.store_id, storeName: lot.stores?.name || "알 수 없음", lots: [], totalSpaces: 0, currentCars: 0 };
      storeMap[lot.store_id].lots.push(lot);
      storeMap[lot.store_id].totalSpaces += lotTotal;
      storeMap[lot.store_id].currentCars += (lot.current_cars || 0);
    });
    setParkingStatus(Object.values(storeMap));
  }

  async function loadStores() {
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    setOrgId(ctx.orgId);
    let query = supabase.from("stores").select("*").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) query = query.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const { data } = await query;
    if (data) setStores(data);
  }

  function getDateRange() {
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
    let recordQuery = supabase.from("daily_records").select("*, stores(name)").gte("date", start).lte("date", end).order("date");
    if (selectedStore) recordQuery = recordQuery.eq("store_id", selectedStore);
    const { data: recordsData } = await recordQuery;
    const recs = (recordsData || []) as DailyRecord[];
    setRecords(recs);
    if (recs.length > 0) {
      const recordIds = recs.map((r) => r.id);
      const { data: hData } = await supabase.from("hourly_data").select("hour, car_count, record_id").in("record_id", recordIds);
      setHourlyData((hData || []) as HourlyRow[]);
      const { data: aData } = await supabase.from("worker_assignments").select("worker_id, worker_type, workers:worker_id(name), record_id").in("record_id", recordIds);
      setAssignments((aData || []) as AssignmentRow[]);
    } else { setHourlyData([]); setAssignments([]); }
    let mpQuery = supabase.from("monthly_parking").select("*, stores(name)");
    if (selectedStore) mpQuery = mpQuery.eq("store_id", selectedStore);
    const { data: mpData } = await mpQuery;
    setMonthlyContracts((mpData || []) as MonthlyContract[]);
    setLoading(false);
  }

  const kpi = useMemo(() => {
    const totalCars = records.reduce((s, r) => s + r.total_cars, 0);
    const totalValet = records.reduce((s, r) => s + r.valet_revenue, 0);
    const totalRevenue = records.reduce((s, r) => s + (r.daily_revenue || 0), 0);
    const totalParking = totalRevenue - totalValet;
    const workerIds = new Set(assignments.map((a) => a.worker_id));
    const activeContracts = monthlyContracts.filter((c) => c.contract_status === "active").length;
    return { totalCars, totalValet, totalParking: totalParking > 0 ? totalParking : 0, workerCount: workerIds.size, activeContracts };
  }, [records, assignments, monthlyContracts]);

  const hourlyChartData = useMemo(() => {
    const hourMap = {}; for (let h = 7; h <= 22; h++) hourMap[h] = 0;
    hourlyData.forEach((d) => { if (hourMap[d.hour] !== undefined) hourMap[d.hour] += d.car_count; });
    return Object.entries(hourMap).map(([h, count]) => ({ hour: `${h}시`, count }));
  }, [hourlyData]);

  const dailyTrendData = useMemo(() => {
    const dayMap = {};
    records.forEach((r) => { if (!dayMap[r.date]) dayMap[r.date] = { cars: 0, valet: 0 }; dayMap[r.date].cars += r.total_cars; dayMap[r.date].valet += r.valet_revenue; });
    return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), cars: v.cars, valet: v.valet }));
  }, [records]);

  const storeRankData = useMemo(() => {
    if (selectedStore) return [];
    const storeMap = {};
    records.forEach((r) => { const name = r.stores?.name || "알 수 없음"; if (!storeMap[r.store_id]) storeMap[r.store_id] = { name, cars: 0, valet: 0 }; storeMap[r.store_id].cars += r.total_cars; storeMap[r.store_id].valet += r.valet_revenue; });
    return Object.values(storeMap).sort((a, b) => b.cars - a.cars).slice(0, 10);
  }, [records, selectedStore]);

  const monthlyPieData = useMemo(() => {
    const active = monthlyContracts.filter((c) => c.contract_status === "active").length;
    const expired = monthlyContracts.filter((c) => c.contract_status === "expired").length;
    const cancelled = monthlyContracts.filter((c) => c.contract_status === "cancelled").length;
    return [{ name: "계약중", value: active }, { name: "만료", value: expired }, { name: "해지", value: cancelled }].filter((d) => d.value > 0);
  }, [monthlyContracts]);

  const expiringSoon = useMemo(() => {
    const now = new Date();
    return monthlyContracts.filter((c) => { if (c.contract_status !== "active") return false; const diff = (new Date(c.end_date).getTime() - now.getTime()) / (1000*60*60*24); return diff >= 0 && diff <= 7; });
  }, [monthlyContracts]);

  const workerSummary = useMemo(() => {
    if (!selectedStore) return [];
    const map = {};
    assignments.forEach((a) => { map[a.worker_id] = { name: a.workers?.name || "알 수 없음", type: a.worker_type }; });
    return Object.values(map);
  }, [assignments, selectedStore]);

  // 주차장 현황 변수
  const firstWithLots = parkingStatus.length > 0 ? parkingStatus[0].storeId : stores[0]?.id;
  const activeStoreId = parkingStoreId || firstWithLots;
  const ps = parkingStatus.find(p => p.storeId === activeStoreId);
  const remaining = ps ? ps.totalSpaces - ps.currentCars : 0;
  const occupancy = ps && ps.totalSpaces > 0 ? Math.round((ps.currentCars / ps.totalSpaces) * 100) : 0;
  const isOver = ps ? remaining < 0 : false;
  const totalAll = useMemo(() => parkingStatus.reduce((acc, p) => ({ total: acc.total + p.totalSpaces, current: acc.current + p.currentCars }), { total: 0, current: 0 }), [parkingStatus]);
  const totalRemain = totalAll.total - totalAll.current;
  const totalOcc = totalAll.total > 0 ? Math.round((totalAll.current / totalAll.total) * 100) : 0;
  const totalSales = (showValet ? kpi.totalValet : 0) + (showParking ? (kpi.totalParking || 0) : 0);

  return (
    <AppLayout>
      {/* 매장 탭 */}
      <div className="v3-store-tabs">
        <button className={`v3-store-tab company ${!selectedStore ? "active" : ""}`} onClick={() => setSelectedStore("")}>🏢 전사</button>
        <span className="v3-tab-divider" />
        {stores.map((s) => {
          const hasLots = parkingStatus.some(p => p.storeId === s.id);
          return <button key={s.id} className={`v3-store-tab ${selectedStore === s.id ? "active" : ""}`} onClick={() => setSelectedStore(s.id)}>{s.name} {hasLots && "🅿️"}</button>;
        })}
      </div>

      {/* 기간 선택 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="v3-period-tabs">
          {(["today","week","month"] as const).map((p) => (
            <button key={p} className={`v3-period-tab ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
              {p === "today" ? "오늘" : p === "week" ? "이번 주" : "이번 달"}
            </button>
          ))}
          <button className={`v3-period-tab ${period === "custom" ? "active" : ""}`} onClick={() => setPeriod("custom")}>직접 설정</button>
        </div>
        {period === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>~</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }} />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15 }}>데이터를 불러오는 중...</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* 주차장 현황 (좌측 요약 + 우측 매장별) */}
          {stores.length > 0 && (
            <div className="dash-parking-grid">
              <div className="v3-summary-card">
                <div className="v3-summary-header">
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)" }}>
                    {selectedStore ? (stores.find(s => s.id === selectedStore)?.name || "매장") : "🏢 전사 현황"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "4px 10px", borderRadius: 6 }}>
                    {selectedStore ? `주차장 ${ps?.lots.length || 0}개` : `${stores.length}개 매장`}
                  </span>
                </div>
                <div className="v3-summary-row"><span className="v3-summary-label">총 면수</span><span className="v3-summary-value" style={{ color: "var(--navy)" }}>{selectedStore ? (ps?.totalSpaces || 0) : totalAll.total}</span></div>
                <div className="v3-summary-row"><span className="v3-summary-label">현재 주차</span><span className="v3-summary-value" style={{ color: "var(--mp-warning)" }}>{selectedStore ? (ps?.currentCars || 0) : totalAll.current}</span></div>
                <div className="v3-summary-row"><span className="v3-summary-label">잔여 면수</span><span className="v3-summary-value" style={{ color: "var(--mp-success)" }}>{selectedStore ? remaining : totalRemain}</span></div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "2px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>전체 점유율</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: getOccColor(selectedStore ? occupancy : totalOcc).text }}>{selectedStore ? occupancy : totalOcc}%</span>
                  </div>
                  <div className="v3-progress-bar"><div className="v3-progress-fill" style={{ width: `${Math.min(selectedStore ? occupancy : totalOcc, 100)}%`, background: getOccColor(selectedStore ? occupancy : totalOcc).bar }} /></div>
                </div>
              </div>

              <div>
                {!selectedStore && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>📍 매장별 현황</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>주차장 보유 {parkingStatus.length}개 매장</span>
                  </div>
                )}
                {!selectedStore ? (
                  <div className="dash-store-lot-grid">
                    {parkingStatus.map((pItem) => {
                      const pOcc = pItem.totalSpaces > 0 ? Math.round((pItem.currentCars / pItem.totalSpaces) * 100) : 0;
                      const oc = getOccColor(pOcc);
                      return (
                        <div key={pItem.storeId} className="v3-lot-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pItem.storeName}</div>
                              <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 6 }}>{pItem.lots.length}개 주차장</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, background: oc.bg, color: oc.text, whiteSpace: "nowrap", flexShrink: 0 }}>{oc.label}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                            <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{pItem.currentCars}</span>
                            <span style={{ fontSize: 18, color: "var(--text-muted)" }}>/</span>
                            <span style={{ fontSize: 18, color: "var(--text-muted)" }}>{pItem.totalSpaces}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}><span>현재</span><span>전체</span></div>
                          <div style={{ height: 6, background: "var(--bg-card)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(pOcc, 100)}%`, height: "100%", borderRadius: 3, background: oc.bar, transition: "width 0.5s" }} />
                          </div>
                        </div>
                      );
                    })}
                    {parkingStatus.length === 0 && (
                      <div style={{ gridColumn: "1 / -1", background: "var(--bg-card)", borderRadius: 14, padding: "40px 24px", textAlign: "center", border: "1px dashed var(--border)" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🅿️</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>등록된 주차장이 없습니다</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>매장 관리에서 주차장을 추가해주세요</div>
                      </div>
                    )}
                  </div>
                ) : ps ? (
                  <div className="dash-lot-grid">
                    {ps.lots.map(lot => {
                      const lotTotal = (lot.self_spaces || 0) + (lot.mechanical_normal || 0) + (lot.mechanical_suv || 0);
                      const lotCurrent = lot.current_cars || 0;
                      const lotRemain = lotTotal - lotCurrent;
                      const lotOcc = lotTotal > 0 ? Math.round((lotCurrent / lotTotal) * 100) : 0;
                      const oc = getOccColor(lotOcc);
                      return (
                        <div key={lot.id} style={{ background: "#fff", borderRadius: 14, padding: 20, border: lotRemain < 0 ? "2px solid #fca5a5" : "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{lot.lot_type === "internal" ? "🏢" : "🅿️"} {lot.name}</div>
                              <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 6 }}>{lot.lot_type === "internal" ? "본관" : "외부"}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, background: oc.bg, color: oc.text }}>{lotOcc}%</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: "8px 0", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>총</div><div style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>{lotTotal}</div></div>
                            <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: "8px 0", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>현재</div><div style={{ fontSize: 18, fontWeight: 800, color: lotCurrent > lotTotal ? "var(--mp-error)" : "var(--text-primary)" }}>{lotCurrent}</div></div>
                            <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: "8px 0", textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>잔여</div><div style={{ fontSize: 18, fontWeight: 800, color: lotRemain < 0 ? "var(--mp-error)" : lotRemain <= 3 ? "var(--mp-warning)" : "var(--mp-success)" }}>{lotRemain}</div></div>
                          </div>
                          <div style={{ height: 6, background: "var(--bg-card)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.min(lotOcc, 100)}%`, height: "100%", borderRadius: 3, background: oc.bar, transition: "width 0.5s" }} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "40px 24px", textAlign: "center", border: "1px dashed var(--border)" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🅿️</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>주차장이 등록되지 않은 매장입니다</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>매장 관리에서 주차장을 추가해주세요</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 오늘의 실적 하이라이트 카드 */}
          <div className="v3-highlight-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <span style={{ fontSize: 24 }}>📈</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {period === "today" ? "오늘의 실적" : period === "week" ? "이번 주 실적" : period === "month" ? "이번 달 실적" : "기간 실적"}
              </span>
            </div>
            <div className="dash-highlight-stats">
              <div style={{ textAlign: "center", flex: 1 }}>
                <span style={{ display: "block", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{totalSales >= 100000000 ? `₩${(totalSales/100000000).toFixed(1)}억` : `₩${totalSales.toLocaleString()}`}</span>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>총 매출</span>
              </div>
              <div className="dash-stat-divider" style={{ width: 1, height: 60, background: "rgba(255,255,255,0.15)" }} />
              <div style={{ textAlign: "center", flex: 1 }}>
                <span style={{ display: "block", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{kpi.totalCars.toLocaleString()}</span>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>총 입차</span>
              </div>
              <div className="dash-stat-divider" style={{ width: 1, height: 60, background: "rgba(255,255,255,0.15)" }} />
              <div style={{ textAlign: "center", flex: 1 }}>
                <span style={{ display: "block", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{kpi.workerCount}</span>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>근무 인원</span>
              </div>
              <div className="dash-stat-divider" style={{ width: 1, height: 60, background: "rgba(255,255,255,0.15)" }} />
              <div style={{ textAlign: "center", flex: 1 }}>
                <span style={{ display: "block", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{selectedStore ? kpi.activeContracts : stores.length}</span>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{selectedStore ? "월주차 계약" : "운영 매장"}</span>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "#F5B731" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>발렛</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: showValet ? "#F5B731" : "rgba(255,255,255,0.3)" }}>₩{kpi.totalValet.toLocaleString()}</span>
                <button onClick={() => setShowValet(!showValet)} style={{ width: 32, height: 18, borderRadius: 9, border: "none", background: showValet ? "#F5B731" : "rgba(255,255,255,0.2)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: showValet ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "#10b981" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>주차</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: showParking ? "#10b981" : "rgba(255,255,255,0.3)" }}>₩{(kpi.totalParking || 0).toLocaleString()}</span>
                <button onClick={() => setShowParking(!showParking)} style={{ width: 32, height: 18, borderRadius: 9, border: "none", background: showParking ? "#10b981" : "rgba(255,255,255,0.2)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: showParking ? 16 : 2, transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            </div>
          </div>

          {/* 3열 인포 그리드 */}
          <div className="dash-info-grid">
            <div className="v3-info-card">
              <div className="v3-info-card-header"><span className="v3-info-card-title">⏰ 시간대별 입차</span><span className="v3-info-card-badge">{period === "today" ? "오늘" : period === "week" ? "이번 주" : "이번 달"}</span></div>
              <div className="v3-info-card-body">
                {hourlyChartData.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}><BarChart data={hourlyChartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="hour" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#1428A0" radius={[4,4,0,0]} name="입차량" /></BarChart></ResponsiveContainer>
                ) : (<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>데이터가 없습니다</div>)}
              </div>
            </div>
            <div className="v3-info-card">
              <div className="v3-info-card-header"><span className="v3-info-card-title">🏆 매장 순위</span><span className="v3-info-card-badge">입차량</span></div>
              <div className="v3-info-card-body">
                {storeRankData.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {storeRankData.slice(0,5).map((s,i) => (
                      <div key={i} className="v3-rank-item">
                        <span className={`v3-rank-num ${i===0?"gold":i===1?"silver":i===2?"bronze":""}`}>{i+1}</span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{s.cars.toLocaleString()}대</span>
                      </div>
                    ))}
                  </div>
                ) : (<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>{selectedStore ? "전사 현황에서 확인하세요" : "데이터가 없습니다"}</div>)}
              </div>
            </div>
            <div className="v3-info-card">
              <div className="v3-info-card-header"><span className="v3-info-card-title">{selectedStore ? "📅 월주차" : "📊 핵심 지표"}</span></div>
              <div className="v3-info-card-body">
                {selectedStore ? (
                  monthlyPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}><PieChart><Pie data={monthlyPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}건`}>{monthlyPieData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                  ) : (<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>월주차 데이터가 없습니다</div>)
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--bg-card)", borderRadius: 10 }}><span style={{ fontSize: 22 }}>🚗</span><div><div style={{ fontSize: 18, fontWeight: 800 }}>{kpi.totalCars.toLocaleString()}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>총 입차</div></div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--bg-card)", borderRadius: 10 }}><span style={{ fontSize: 22 }}>💰</span><div><div style={{ fontSize: 18, fontWeight: 800 }}>₩{(kpi.totalValet/10000).toFixed(0)}만</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>발렛 매출</div></div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--bg-card)", borderRadius: 10 }}><span style={{ fontSize: 22 }}>👥</span><div><div style={{ fontSize: 18, fontWeight: 800 }}>{kpi.workerCount}명</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>근무 인원</div></div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--bg-card)", borderRadius: 10 }}><span style={{ fontSize: 22 }}>📅</span><div><div style={{ fontSize: 18, fontWeight: 800 }}>{kpi.activeContracts}건</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>월주차 계약</div></div></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 차트 2열 */}
          <div className="dash-chart-grid">
            <div className="v3-info-card">
              <div className="v3-info-card-header"><span className="v3-info-card-title">📈 일별 추이</span></div>
              <div className="v3-info-card-body">
                {dailyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}><LineChart data={dailyTrendData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" tick={{ fontSize: 11 }} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line yAxisId="left" type="monotone" dataKey="cars" stroke="#1428A0" name="입차량" strokeWidth={2} /><Line yAxisId="right" type="monotone" dataKey="valet" stroke="#F5B731" name="발렛매출" strokeWidth={2} /></LineChart></ResponsiveContainer>
                ) : (<div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>데이터가 없습니다</div>)}
              </div>
            </div>
            <div className="v3-info-card">
              <div className="v3-info-card-header"><span className="v3-info-card-title">{selectedStore ? "👥 근무자 현황" : "⚠️ 마감미정산"}</span></div>
              <div className="v3-info-card-body">
                {selectedStore ? (
                  workerSummary.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {workerSummary.map((w,i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-card)", borderRadius: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: w.type==="default"?"#dbeafe":w.type==="substitute"?"#fff7ed":"#ede9fe", color: w.type==="default"?"#2563eb":w.type==="substitute"?"#ea580c":"#7c3aed" }}>{w.type==="default"?"기본":w.type==="substitute"?"대체":"본사"}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{w.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (<div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>근무자 데이터가 없습니다</div>)
                ) : records.length === 0 ? (
                  <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>선택된 기간에 입력된 데이터가 없습니다</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                    {stores.filter((s) => !records.some((r) => r.store_id === s.id)).map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--mp-error-bg)", borderRadius: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mp-error)" }}>미정산</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                      </div>
                    ))}
                    {stores.filter((s) => !records.some((r) => r.store_id === s.id)).length === 0 && (
                      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mp-success)", fontSize: 14, fontWeight: 600 }}>✅ 모든 매장 입력 완료!</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 월주차 만료 예정 */}
          {expiringSoon.length > 0 && (
            <div style={{ padding: "14px 20px", background: "var(--mp-warning-bg)", borderRadius: 12, border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⏰</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--mp-warning)" }}>월주차 만료 예정 {expiringSoon.length}건</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: "auto" }}>7일 이내 만료</span>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
