// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

const periods = [
  { id: "today", label: "오늘" },
  { id: "month", label: "월별" },
  { id: "quarter", label: "분기" },
  { id: "year", label: "연간" },
  { id: "custom", label: "지정날짜" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("today");
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedQuarter, setSelectedQuarter] = useState(() => { const d = new Date(); return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`; });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_revenue: 0, total_cars: 0, total_valet: 0, avg_revenue: 0 });

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [period, selectedStore, selectedMonth, selectedQuarter, selectedYear, customStart, customEnd]);

  const loadStores = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
    if (data) setStores(data);
  };

  const getDateRange = () => {
    const today = new Date();
    if (period === "today") {
      const d = today.toISOString().split("T")[0];
      return { start: d, end: d };
    } else if (period === "month") {
      const [y, m] = selectedMonth.split("-");
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      return { start: `${y}-${m}-01`, end: `${y}-${m}-${lastDay}` };
    } else if (period === "quarter") {
      const [y, q] = selectedQuarter.split("-Q");
      const qNum = Number(q);
      const startMonth = (qNum - 1) * 3 + 1;
      const endMonth = qNum * 3;
      const lastDay = new Date(Number(y), endMonth, 0).getDate();
      return { start: `${y}-${String(startMonth).padStart(2, "0")}-01`, end: `${y}-${String(endMonth).padStart(2, "0")}-${lastDay}` };
    } else if (period === "year") {
      return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
    } else {
      if (!customStart || !customEnd) return { start: "", end: "" };
      return { start: customStart, end: customEnd };
    }
  };

  const loadData = async () => {
    const supabase = createClient();
    const { start, end } = getDateRange();
    if (!start || !end) { setData([]); setSummary({ total_revenue: 0, total_cars: 0, total_valet: 0, avg_revenue: 0 }); return; }
    let query = supabase.from("parking_records").select("*, stores(name)").gte("date", start).lte("date", end).order("date", { ascending: false });
    if (selectedStore !== "all") query = query.eq("store_id", selectedStore);
    const { data: records } = await query;

    if (records) {
      setData(records);
      const totalRevenue = records.reduce((s, r) => s + (r.daily_revenue || 0), 0);
      const totalCars = records.reduce((s, r) => s + (r.total_cars || 0), 0);
      const totalValet = records.reduce((s, r) => s + (r.valet_cars || 0), 0);
      const days = records.length || 1;
      setSummary({ total_revenue: totalRevenue, total_cars: totalCars, total_valet: totalValet, avg_revenue: Math.round(totalRevenue / days) });
    } else {
      setData([]);
      setSummary({ total_revenue: 0, total_cars: 0, total_valet: 0, avg_revenue: 0 });
    }
  };

  // 매장별 집계
  const storeBreakdown = () => {
    const map = {};
    data.forEach(r => {
      const name = r.stores?.name || "미지정";
      if (!map[name]) map[name] = { revenue: 0, cars: 0, valet: 0, days: 0 };
      map[name].revenue += r.daily_revenue || 0;
      map[name].cars += r.total_cars || 0;
      map[name].valet += r.valet_cars || 0;
      map[name].days += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  };

  // 일별 추이 (월별/분기일 때)
  const dailyTrend = () => {
    const map = {};
    data.forEach(r => {
      if (!map[r.date]) map[r.date] = { revenue: 0, cars: 0 };
      map[r.date].revenue += r.daily_revenue || 0;
      map[r.date].cars += r.total_cars || 0;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const maxRevenue = Math.max(...dailyTrend().map(([, v]) => v.revenue), 1);
  const breakdown = storeBreakdown();
  const trend = dailyTrend();

  const currentYear = new Date().getFullYear();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 기간 선택 */}
        <div className="flex gap-4 mb-6 flex-wrap items-end">
          <div className="flex gap-1" style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
            {periods.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className="cursor-pointer" style={{
                padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14,
                fontWeight: period === p.id ? 700 : 500, background: period === p.id ? "#fff" : "transparent",
                color: period === p.id ? "#1428A0" : "#475569", boxShadow: period === p.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{p.label}</button>
            ))}
          </div>

          <div>
            <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>매장</label>
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}>
              <option value="all">전체 매장</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {period === "month" && (
            <div>
              <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>월 선택</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }} />
            </div>
          )}

          {period === "quarter" && (
            <div>
              <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>분기 선택</label>
              <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}>
                {[currentYear - 1, currentYear].map(y => [1,2,3,4].map(q => (
                  <option key={`${y}-Q${q}`} value={`${y}-Q${q}`}>{y}년 {q}분기</option>
                )))}
              </select>
            </div>
          )}

          {period === "year" && (
            <div>
              <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>연도 선택</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
          )}

          {period === "custom" && (
            <div className="flex gap-2 items-end">
              <div>
                <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>시작일</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }} />
              </div>
              <span style={{ fontSize: 14, color: "#94a3b8", paddingBottom: 8 }}>~</span>
              <div>
                <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>종료일</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 600 }} />
              </div>
            </div>
          )}
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "총 매출", value: `₩${summary.total_revenue.toLocaleString()}`, icon: "💰", color: "#1428A0", bg: "#1428A010" },
            { label: "총 입차", value: `${summary.total_cars.toLocaleString()}대`, icon: "🚗", color: "#16a34a", bg: "#dcfce7" },
            { label: "발렛 건수", value: `${summary.total_valet.toLocaleString()}대`, icon: "🅿️", color: "#b45309", bg: "#F5B73115" },
            { label: period === "today" ? "오늘 매출" : "일평균 매출", value: `₩${summary.avg_revenue.toLocaleString()}`, icon: "📊", color: "#7c3aed", bg: "#ede9fe" },
          ].map(card => (
            <div key={card.label} style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 20 }}>{card.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* 매장별 매출 비교 */}
        {selectedStore === "all" && breakdown.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>매장별 매출 비교</div>
            <div className="space-y-3">
              {breakdown.map(([name, val], i) => {
                const pct = summary.total_revenue > 0 ? (val.revenue / summary.total_revenue * 100) : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{i + 1}. {name}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{val.days}일 / {val.cars}대</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#1428A0" }}>₩{val.revenue.toLocaleString()}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: `hsl(${220 - i * 30}, 70%, 55%)`, borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 일별 매출 추이 (차트) */}
        {period !== "today" && trend.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>일별 매출 추이</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 200 }}>
              {trend.map(([date, val]) => {
                const height = Math.max((val.revenue / maxRevenue) * 180, 4);
                const day = date.slice(8, 10);
                const dayOfWeek = new Date(date).getDay();
                return (
                  <div key={date} className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
                    <div title={`${date}: ₩${val.revenue.toLocaleString()}`} style={{
                      width: "100%", maxWidth: 24, height, borderRadius: "4px 4px 0 0",
                      background: dayOfWeek === 0 ? "#fee2e2" : dayOfWeek === 6 ? "#dbeafe" : "#1428A0",
                      cursor: "pointer",
                    }} />
                    {trend.length <= 31 && (
                      <span style={{ fontSize: 9, color: dayOfWeek === 0 ? "#dc2626" : dayOfWeek === 6 ? "#1428A0" : "#94a3b8", marginTop: 4 }}>{day}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, borderRadius: 2, background: "#1428A0" }} /><span style={{ fontSize: 11, color: "#94a3b8" }}>평일</span></div>
              <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, borderRadius: 2, background: "#dbeafe" }} /><span style={{ fontSize: 11, color: "#94a3b8" }}>토요일</span></div>
              <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, borderRadius: 2, background: "#fee2e2" }} /><span style={{ fontSize: 11, color: "#94a3b8" }}>일요일</span></div>
            </div>
          </div>
        )}

        {/* 상세 데이터 테이블 */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
          <div className="flex justify-between items-center mb-4">
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>상세 데이터 ({data.length}건)</div>
          </div>

          {data.length === 0 ? (
            <div className="text-center py-12">
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#475569", marginBottom: 4 }}>데이터가 없습니다</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>선택한 기간에 입력된 데이터가 없습니다</div>
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px" }}>
                <thead>
                  <tr>
                    {["날짜", "매장", "총입차", "발렛", "일반", "매출", "발렛매출"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, background: "#fff" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const dayOfWeek = new Date(r.date).getDay();
                    return (
                      <tr key={r.id} style={{ background: dayOfWeek === 0 || dayOfWeek === 6 ? "#f8fafc" : i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: dayOfWeek === 0 ? "#dc2626" : dayOfWeek === 6 ? "#1428A0" : "#1e293b" }}>{r.date}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: "#475569" }}>{r.stores?.name || "-"}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{r.total_cars || 0}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#b45309" }}>{r.valet_cars || 0}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: "#475569" }}>{(r.total_cars || 0) - (r.valet_cars || 0)}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#1428A0" }}>₩{(r.daily_revenue || 0).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#b45309" }}>₩{(r.valet_revenue || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}