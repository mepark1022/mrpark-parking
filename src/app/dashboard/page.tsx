// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
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

function getThisWeekRange() {
  const now = new Date(); const day = now.getDay(); const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now); monday.setDate(now.getDate() - diff);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] };
}
function getThisMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}
function getOccColor(occ) {
  if (occ > 85) return { text: "#DC2626", bg: "#fee2e2", bar: "#DC2626", label: "만차임박" };
  if (occ > 60) return { text: "#EA580C", bg: "#ffedd5", bar: "#EA580C", label: "혼잡" };
  return { text: "#16A34A", bg: "#dcfce7", bar: "#16A34A", label: "여유" };
}
function fmtMoney(v) {
  if (v >= 100000000) return `₩${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `₩${Math.round(v / 10000)}만`;
  return `₩${v.toLocaleString()}`;
}

function OccRing({ pct, color }) {
  const r = 34; const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f0f2f7" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 44 44)" />
      <text x="44" y="40" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} fontFamily="Outfit, sans-serif">{pct}%</text>
      <text x="44" y="53" textAnchor="middle" fontSize="10" fill="#8b90a0" fontFamily="sans-serif">점유율</text>
    </svg>
  );
}

const DASH_STYLES = `
  .dash-period-tabs{display:flex;gap:4px;background:#f0f2f7;padding:3px;border-radius:10px;margin-bottom:16px}
  .dash-period-tab{flex:1;padding:8px 0;border:none;background:transparent;color:#5c6370;font-size:12px;font-weight:600;border-radius:7px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .dash-period-tab.active{background:#fff;color:#1428A0;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
  .dash-store-sel{width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:600;color:#1a1d2b;background:#fff;margin-bottom:16px}

  .dash-card{background:#fff;border-radius:20px;padding:18px;box-shadow:0 2px 12px rgba(20,40,160,0.07)}
  .dash-sec-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .dash-sec-title{font-size:13px;font-weight:700;color:#444}
  .dash-sec-badge{font-size:11px;font-weight:700;background:#ecf0ff;color:#1428A0;padding:3px 10px;border-radius:6px}
  .dash-occ-grid{display:flex;gap:16px;align-items:center;margin-bottom:14px}
  .dash-occ-stats{flex:1;display:flex;flex-direction:column;gap:10px}
  .dash-occ-row{display:flex;justify-content:space-between;align-items:center}
  .dash-occ-label{font-size:13px;color:#666;font-weight:500}
  .dash-occ-val{font-family:'Outfit',sans-serif;font-size:26px;font-weight:900;line-height:1}
  .dash-bar-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f5f5f7}
  .dash-bar-row:last-child{border-bottom:none}
  .dash-bar-name{font-size:12px;font-weight:700;color:#444;width:56px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dash-bar-wrap{flex:1;height:7px;background:#f0f2f7;border-radius:4px;overflow:hidden}
  .dash-bar-fill{height:100%;border-radius:4px}
  .dash-bar-pct{font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;width:30px;text-align:right;flex-shrink:0}
  .dash-bar-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;width:44px;text-align:center;flex-shrink:0}
  .dash-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .dash-kpi-card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);position:relative;overflow:hidden}
  .dash-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
  .dash-kpi-card.c-navy::before{background:#1428A0}
  .dash-kpi-card.c-gold::before{background:#F5B731}
  .dash-kpi-card.c-green::before{background:#16A34A}
  .dash-kpi-card.c-purple::before{background:#7C3AED}
  .dash-kpi-icon{font-size:18px;margin-bottom:8px;display:block}
  .dash-kpi-val{font-family:'Outfit',sans-serif;font-size:24px;font-weight:900;color:#1a1d2b;line-height:1;display:block;margin-bottom:4px}
  .dash-kpi-label{font-size:11px;font-weight:600;color:#8b90a0}
  .dash-revenue-card{background:linear-gradient(135deg,#1428A0,#0d1f8a);border-radius:20px;padding:18px}
  .dash-revenue-amount{font-family:'Outfit',sans-serif;font-size:32px;font-weight:900;color:#fff;line-height:1;display:block;margin:6px 0 2px}
  .dash-revenue-breakdown{display:flex;background:rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;margin-top:14px}
  .dash-revenue-item{flex:1;padding:11px;text-align:center;border-right:1px solid rgba(255,255,255,0.1)}
  .dash-revenue-item:last-child{border-right:none}
  .dash-revenue-item-val{font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;color:#fff;display:block;margin-bottom:2px}
  .dash-revenue-item-label{font-size:10px;color:rgba(255,255,255,0.6);font-weight:600}
  .dash-rank-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f5f5f7}
  .dash-rank-item:last-child{border-bottom:none}
  .dash-rank-num{font-family:'Outfit',sans-serif;font-size:14px;font-weight:900;width:22px;text-align:center;flex-shrink:0}
  .dash-rank-bar{flex:1;height:6px;background:#f0f2f7;border-radius:3px;overflow:hidden}
  .dash-rank-bar-fill{height:100%;border-radius:3px}
  .dash-rank-val{font-family:'Outfit',sans-serif;font-size:13px;font-weight:800;color:#1428A0;width:34px;text-align:right;flex-shrink:0}
  @media(min-width:768px){
    .dash-pc-2col{display:grid;grid-template-columns:340px 1fr;gap:20px}
    .dash-kpi-grid{grid-template-columns:repeat(4,1fr)}
    .dash-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .dash-bottom-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  @media(max-width:768px){.dash-bottom-row{grid-template-columns:1fr;gap:10px;padding-bottom:100px}}
  @media(max-width:768px){.dash-compact-card{padding:12px 14px !important;border-radius:14px !important}}
  }
`;


// ── v3 커스텀 날짜범위 캘린더 ──────────────────────────────────────────────
function CustomDateRangePicker({ startDate, endDate, onApply, onClose }: {
  startDate: string; endDate: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selStart, setSelStart] = useState(startDate || "");
  const [selEnd, setSelEnd] = useState(endDate || "");
  const [hoverDate, setHoverDate] = useState("");
  const WEEK_DAYS = ["일","월","화","수","목","금","토"];

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  function cmp(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function handleDayClick(ds: string) {
    if (!selStart || (selStart && selEnd)) { setSelStart(ds); setSelEnd(""); }
    else {
      if (cmp(ds, selStart) < 0) { setSelEnd(selStart); setSelStart(ds); }
      else { setSelEnd(ds); }
    }
  }
  function inRange(ds: string) {
    const end = selEnd || hoverDate;
    if (!selStart || !end) return false;
    const lo = cmp(selStart, end) <= 0 ? selStart : end;
    const hi = cmp(selStart, end) <= 0 ? end : selStart;
    return cmp(ds, lo) > 0 && cmp(ds, hi) < 0;
  }
  function isStart(ds: string) { return ds === selStart; }
  function isEnd(ds: string) {
    const end = selEnd || (hoverDate && selStart ? hoverDate : "");
    return ds === end && end !== selStart;
  }
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1);
  };
  const formatDisplay = (ds: string) => {
    if (!ds) return "";
    const d = new Date(ds + "T00:00:00");
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  };
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", overflow:"hidden" }}>
        {/* 선택된 날짜 헤더 */}
        <div style={{ background:"#1428A0", padding:"18px 24px" }}>
          {/* 헤더 상단: 기간 설정 텍스트 + 미팍Ticket 로고 */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:600 }}>기간 설정</div>
            {/* 미팍Ticket 로고 */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {/* P 아이콘 */}
              <div style={{ width:26, height:26, borderRadius:7, background:"#fff", border:"2px solid rgba(255,255,255,0.9)", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:7, background:"#F5B731" }} />
                <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:900, color:"#1A1D2B", position:"relative", zIndex:1, marginBottom:3 }}>P</span>
              </div>
              {/* 미팍Ticket 텍스트 */}
              <div style={{ display:"flex", alignItems:"baseline", gap:2 }}>
                <span style={{ fontFamily:"'Noto Sans KR',sans-serif", fontSize:13, fontWeight:800, color:"#fff", letterSpacing:"-0.3px" }}>미팍</span>
                <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:700, color:"#F5B731", letterSpacing:"-0.2px" }}>Ticket</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:2 }}>시작일</div>
              <div style={{ fontSize:17, fontWeight:800, color: selStart?"#fff":"rgba(255,255,255,0.3)" }}>
                {selStart ? formatDisplay(selStart) : "날짜 선택"}
              </div>
            </div>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:16 }}>→</div>
            <div style={{ flex:1, textAlign:"right" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:2 }}>종료일</div>
              <div style={{ fontSize:17, fontWeight:800, color: selEnd?"#fff":"rgba(255,255,255,0.3)" }}>
                {selEnd ? formatDisplay(selEnd) : (selStart ? "종료일 선택" : "-")}
              </div>
            </div>
          </div>
          {selStart && !selEnd && (
            <div style={{ marginTop:7, fontSize:11, color:"#F5B731", fontWeight:600 }}>✦ 종료 날짜를 선택하세요</div>
          )}
        </div>

        {/* 캘린더 */}
        <div style={{ padding:"16px 18px 8px" }}>
          {/* 월 네비게이션 */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <button onClick={prevMonth} className="cursor-pointer"
              style={{ width:32, height:32, borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center", color:"#5c6370", fontFamily:"inherit" }}>‹</button>
            <span style={{ fontSize:14, fontWeight:700, color:"#1a1d26" }}>{viewYear}년 {viewMonth+1}월</span>
            <button onClick={nextMonth} className="cursor-pointer"
              style={{ width:32, height:32, borderRadius:9, border:"1px solid #e2e8f0", background:"#fff", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center", color:"#5c6370", fontFamily:"inherit" }}>›</button>
          </div>
          {/* 요일 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {WEEK_DAYS.map((w,i) => (
              <div key={w} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"3px 0", color:i===0?"#ef4444":i===6?"#3b82f6":"#8b919d" }}>{w}</div>
            ))}
          </div>
          {/* 날짜 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ height:36 }} />;
              const ds = toStr(viewYear, viewMonth, day);
              const isS = isStart(ds); const isE = isEnd(ds); const isIn = inRange(ds);
              const isToday = ds === todayStr;
              const dow = idx % 7;
              return (
                <div key={idx} style={{ display:"flex", alignItems:"center", justifyContent:"center",
                  background: isIn ? "rgba(20,40,160,0.07)" : "transparent",
                  borderRadius: isIn ? (dow===0?"8px 0 0 8px":dow===6?"0 8px 8px 0":"0") : undefined }}>
                  <div onClick={() => handleDayClick(ds)}
                    onMouseEnter={() => selStart && !selEnd && setHoverDate(ds)}
                    onMouseLeave={() => setHoverDate("")}
                    className="cursor-pointer"
                    style={{
                      width:34, height:34, borderRadius:"50%",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: isS||isE ? "#1428A0" : "transparent",
                      color: isS||isE ? "#fff" : dow===0?"#ef4444":dow===6?"#3b82f6":"#1a1d26",
                      fontSize:13, fontWeight: isToday?800: isS||isE?700:400,
                      outline: isToday&&!isS&&!isE ? "2px solid #1428A0":"none", outlineOffset:-2,
                      position:"relative", zIndex:1, transition:"background 0.1s",
                    }}>{day}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 빠른 선택 */}
        <div style={{ padding:"6px 18px 12px", display:"flex", gap:6, flexWrap:"wrap" }}>
          {[
            { label:"오늘", fn:() => { setSelStart(todayStr); setSelEnd(todayStr); }},
            { label:"이번 주", fn:() => { const r=getThisWeekRange(); setSelStart(r.start); setSelEnd(r.end); }},
            { label:"이번 달", fn:() => { const r=getThisMonthRange(); setSelStart(r.start); setSelEnd(r.end); }},
            { label:"지난 7일", fn:() => {
              const s=new Date(today); s.setDate(today.getDate()-6);
              setSelStart(s.toISOString().split("T")[0]); setSelEnd(todayStr);
            }},
          ].map(q => (
            <button key={q.label} onClick={q.fn} className="cursor-pointer"
              style={{ padding:"4px 10px", borderRadius:7, border:"1px solid #e2e8f0",
                background:"#fff", fontSize:12, fontWeight:600, color:"#5c6370", fontFamily:"inherit" }}>
              {q.label}
            </button>
          ))}
        </div>

        {/* 액션 */}
        <div style={{ padding:"10px 18px 18px", display:"flex", gap:8, borderTop:"1px solid #eef0f3" }}>
          <button onClick={() => { setSelStart(""); setSelEnd(""); }} className="cursor-pointer"
            style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #fecaca", background:"#fef2f2",
              fontSize:13, fontWeight:600, color:"#dc2626", fontFamily:"inherit" }}>초기화</button>
          <button onClick={onClose} className="cursor-pointer"
            style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #e2e8f0",
              background:"#fff", fontSize:13, fontWeight:600, color:"#5c6370", fontFamily:"inherit" }}>취소</button>
          <button onClick={() => { if(selStart&&selEnd) onApply(selStart,selEnd); else if(selStart) onApply(selStart,selStart); }}
            disabled={!selStart} className="cursor-pointer"
            style={{ flex:2, padding:"10px", borderRadius:10, border:"none",
              background:selStart?"#1428A0":"#e2e8f0", color:selStart?"#fff":"#8b919d",
              fontSize:14, fontWeight:700, fontFamily:"inherit" }}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [records, setRecords] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [monthlyContracts, setMonthlyContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState(null);
  const [parkingStatus, setParkingStatus] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [selectedStore, period, customStart, customEnd]);
  useEffect(() => { if (orgId) loadParkingStatus(); }, [orgId]);

  async function loadParkingStatus() {
    if (!orgId) return;
    const { data: lots } = await supabase.from("parking_lots").select("*, stores(name)").eq("org_id", orgId);
    if (!lots || lots.length === 0) { setParkingStatus([]); return; }
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
    if (period === "today") return { start: today, end: today };
    if (period === "week") return getThisWeekRange();
    if (period === "month") return getThisMonthRange();
    return { start: customStart || today, end: customEnd || today };
  }

  async function loadData() {
    setLoading(true);
    const { start, end } = getDateRange();

    // daily_records + monthly_parking 병렬 실행
    let recQ = supabase.from("daily_records").select("id, store_id, date, total_cars, valet_count, valet_revenue, daily_revenue, stores(name)").gte("date", start).lte("date", end).order("date");
    if (selectedStore) recQ = recQ.eq("store_id", selectedStore);
    let mpQ = supabase.from("monthly_parking").select("id, store_id, contract_status, monthly_fee, end_date, stores(name)");
    if (selectedStore) mpQ = mpQ.eq("store_id", selectedStore);

    const [{ data: rData }, { data: mpData }] = await Promise.all([recQ, mpQ]);

    const recs = rData || [];
    setRecords(recs);
    setMonthlyContracts(mpData || []);

    if (recs.length > 0) {
      const ids = recs.map(r => r.id);
      // hourly_data + worker_assignments 병렬 실행
      const [{ data: hData }, { data: aData }] = await Promise.all([
        supabase.from("hourly_data").select("hour, car_count, record_id").in("record_id", ids),
        supabase.from("worker_assignments").select("worker_id, worker_type, workers:worker_id(name), record_id").in("record_id", ids),
      ]);
      setHourlyData(hData || []);
      setAssignments(aData || []);
    } else {
      setHourlyData([]);
      setAssignments([]);
    }
    setLoading(false);
  }

  const kpi = useMemo(() => {
    const totalCars = records.reduce((s, r) => s + r.total_cars, 0);
    const totalValet = records.reduce((s, r) => s + r.valet_revenue, 0);
    const totalRevenue = records.reduce((s, r) => s + (r.daily_revenue || 0), 0);
    const totalParking = Math.max(totalRevenue - totalValet, 0);
    const workerIds = new Set(assignments.map(a => a.worker_id));
    const activeContracts = monthlyContracts.filter(c => c.contract_status === "active").length;
    return { totalCars, totalValet, totalParking, workerCount: workerIds.size, activeContracts, totalRevenue };
  }, [records, assignments, monthlyContracts]);

  const hourlyChartData = useMemo(() => {
    const hourMap = {}; for (let h = 7; h <= 22; h++) hourMap[h] = 0;
    hourlyData.forEach(d => { if (hourMap[d.hour] !== undefined) hourMap[d.hour] += d.car_count; });
    return Object.entries(hourMap).map(([h, count]) => ({ hour: `${h}시`, count }));
  }, [hourlyData]);

  const dailyTrendData = useMemo(() => {
    const dayMap = {};
    records.forEach(r => { if (!dayMap[r.date]) dayMap[r.date] = { cars: 0, valet: 0 }; dayMap[r.date].cars += r.total_cars; dayMap[r.date].valet += r.valet_revenue; });
    return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), cars: v.cars, valet: v.valet }));
  }, [records]);

  const storeRankData = useMemo(() => {
    if (selectedStore) return [];
    const storeMap = {};
    records.forEach(r => { const name = r.stores?.name || "알 수 없음"; if (!storeMap[r.store_id]) storeMap[r.store_id] = { name, cars: 0 }; storeMap[r.store_id].cars += r.total_cars; });
    return Object.values(storeMap).sort((a, b) => b.cars - a.cars).slice(0, 5);
  }, [records, selectedStore]);

  const expiringSoon = useMemo(() => {
    const now = new Date();
    return monthlyContracts.filter(c => {
      if (c.contract_status !== "active") return false;
      const diff = (new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });
  }, [monthlyContracts]);

  const totalAll = useMemo(() =>
    parkingStatus.reduce((acc, p) => ({ total: acc.total + p.totalSpaces, current: acc.current + p.currentCars }), { total: 0, current: 0 }),
    [parkingStatus]);
  const ps = parkingStatus.find(p => p.storeId === selectedStore);
  const curTotal = selectedStore ? (ps?.totalSpaces || 0) : totalAll.total;
  const curCars = selectedStore ? (ps?.currentCars || 0) : totalAll.current;
  const curRemain = curTotal - curCars;
  const curOcc = curTotal > 0 ? Math.round((curCars / curTotal) * 100) : 0;
  const occColor = getOccColor(curOcc);
  const periodLabel = period === "today" ? "오늘" : period === "week" ? "이번 주" : period === "month" ? "이번 달" : "선택 기간";
  const PERIODS = [["today", "오늘"], ["week", "이번 주"], ["month", "이번 달"], ["custom", "직접 설정"]];
  const RANK_COLORS = ["#F5B731", "#9CA3AF", "#CD7F32", "#c0c4d0", "#c0c4d0"];

  return (
    <AppLayout>
      <style>{DASH_STYLES}</style>

      {/* 기간 탭 */}
      <div className="dash-period-tabs">
        {PERIODS.map(([p, label]) => (
          <button key={p} className={`dash-period-tab ${period === p ? "active" : ""}`}
            onClick={() => { setPeriod(p); if (p === "custom") setShowDatePicker(true); }}>{label}</button>
        ))}
      </div>
      {period === "custom" && (customStart || customEnd) && (
        <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
          <button onClick={() => setShowDatePicker(true)} className="cursor-pointer"
            style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:10,
              border:"1.5px solid #1428A0", background:"rgba(20,40,160,0.04)", fontSize:13, fontWeight:600,
              color:"#1428A0", fontFamily:"inherit" }}>
            📅{" "}
            {customStart ? new Date(customStart+"T00:00:00").toLocaleDateString("ko-KR",{month:"short",day:"numeric"}) : "시작"}
            {" ~ "}
            {customEnd ? new Date(customEnd+"T00:00:00").toLocaleDateString("ko-KR",{month:"short",day:"numeric"}) : "종료"}
          </button>
        </div>
      )}
      {showDatePicker && (
        <CustomDateRangePicker
          startDate={customStart} endDate={customEnd}
          onApply={(s, e) => { setCustomStart(s); setCustomEnd(e); setShowDatePicker(false); }}
          onClose={() => { setShowDatePicker(false); if (!customStart) setPeriod("month"); }}
        />
      )}

      {/* 매장 선택 */}
      <select className="dash-store-sel" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
        <option value="">🏢 전사 현황</option>
        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8b90a0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15 }}>데이터를 불러오는 중...</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 1. 주차 현황 + 순위 */}
          <div className="dash-pc-2col">
            <div className="dash-card">
              <div className="dash-sec-label">
                <span className="dash-sec-title">🅿️ 실시간 주차 현황</span>
                <span className="dash-sec-badge">{selectedStore ? `주차장 ${ps?.lots.length || 0}개` : `${stores.length}개 매장`}</span>
              </div>
              <div className="dash-occ-grid">
                <OccRing pct={curOcc} color={occColor.bar} />
                <div className="dash-occ-stats">
                  <div className="dash-occ-row">
                    <span className="dash-occ-label">총 면수</span>
                    <span className="dash-occ-val" style={{ color: "#1428A0" }}>{curTotal}</span>
                  </div>
                  <div className="dash-occ-row">
                    <span className="dash-occ-label">현재 주차</span>
                    <span className="dash-occ-val" style={{ color: "#EA580C" }}>{curCars}</span>
                  </div>
                  <div className="dash-occ-row">
                    <span className="dash-occ-label">잔여 면수</span>
                    <span className="dash-occ-val" style={{ color: "#16A34A" }}>{curRemain}</span>
                  </div>
                </div>
              </div>
              {parkingStatus.length > 0 && (
                <div style={{ paddingTop: 12, borderTop: "1px solid #f0f2f7" }}>
                  {(selectedStore ? (ps ? [ps] : []) : parkingStatus).map(p => {
                    const occ = p.totalSpaces > 0 ? Math.round((p.currentCars / p.totalSpaces) * 100) : 0;
                    const oc = getOccColor(occ);
                    return (
                      <div key={p.storeId} className="dash-bar-row">
                        <span className="dash-bar-name">{p.storeName}</span>
                        <div className="dash-bar-wrap"><div className="dash-bar-fill" style={{ width: `${Math.min(occ, 100)}%`, background: oc.bar }} /></div>
                        <span className="dash-bar-pct" style={{ color: oc.text }}>{occ}%</span>
                        <span className="dash-bar-badge" style={{ background: oc.bg, color: oc.text }}>{oc.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="dash-card">
              <div className="dash-sec-label">
                <span className="dash-sec-title">🏆 매장 순위</span>
                <span className="dash-sec-badge">입차량 기준</span>
              </div>
              {storeRankData.length > 0 ? storeRankData.map((s, i) => {
                const maxCars = storeRankData[0].cars;
                return (
                  <div key={i} className="dash-rank-item">
                    <span className="dash-rank-num" style={{ color: RANK_COLORS[i] }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                    <div className="dash-rank-bar"><div className="dash-rank-bar-fill" style={{ width: `${maxCars > 0 ? (s.cars / maxCars) * 100 : 0}%`, background: RANK_COLORS[i] }} /></div>
                    <span className="dash-rank-val">{s.cars.toLocaleString()}</span>
                  </div>
                );
              }) : (
                <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b90a0", fontSize: 13 }}>
                  {selectedStore ? "전사 현황에서 확인하세요" : "데이터가 없습니다"}
                </div>
              )}
            </div>
          </div>

          {/* 2. KPI */}
          <div className="dash-kpi-grid">
            {[
              { cls: "c-navy", icon: "🚗", val: kpi.totalCars.toLocaleString(), label: "총 입차" },
              { cls: "c-gold", icon: "💰", val: fmtMoney(kpi.totalRevenue), label: "총 매출" },
              { cls: "c-green", icon: "👥", val: `${kpi.workerCount}명`, label: "근무 인원" },
              { cls: "c-purple", icon: "📅", val: `${kpi.activeContracts}건`, label: "월주차 계약" },
            ].map(k => (
              <div key={k.label} className={`dash-kpi-card ${k.cls}`}>
                <span className="dash-kpi-icon">{k.icon}</span>
                <span className="dash-kpi-val">{k.val}</span>
                <span className="dash-kpi-label">{k.label}</span>
              </div>
            ))}
          </div>

          {/* 3. 매출 카드 */}
          <div className="dash-revenue-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>📈 {periodLabel} 매출 현황</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", padding: "3px 10px", borderRadius: 6 }}>{periodLabel}</span>
            </div>
            <span className="dash-revenue-amount">{fmtMoney(kpi.totalRevenue)}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>전사 합산 총 매출</span>
            <div className="dash-revenue-breakdown">
              {[
                { dot: "#F5B731", val: fmtMoney(kpi.totalValet), label: "발렛 매출" },
                { dot: "#10b981", val: fmtMoney(kpi.totalParking), label: "주차 매출" },
                { dot: "#a78bfa", val: "-", label: "미팍티켓" },
              ].map(item => (
                <div key={item.label} className="dash-revenue-item">
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.dot, margin: "0 auto 5px" }} />
                  <span className="dash-revenue-item-val">{item.val}</span>
                  <span className="dash-revenue-item-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. 차트 */}
          <div className="dash-chart-row">
            <div className="dash-card" style={{ padding: 16 }}>
              <div className="dash-sec-label">
                <span className="dash-sec-title">⏰ 시간대별 입차</span>
                <span className="dash-sec-badge">{periodLabel}</span>
              </div>
              {hourlyChartData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={isMobile ? 140 : 200}>
                  <BarChart data={hourlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1428A0" radius={[4, 4, 0, 0]} name="입차량" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b90a0", fontSize: 13 }}>데이터가 없습니다</div>
              )}
            </div>
            <div className="dash-card" style={{ padding: 16 }}>
              <div className="dash-sec-label">
                <span className="dash-sec-title">📈 일별 추이</span>
              </div>
              {dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={isMobile ? 140 : 200}>
                  <LineChart data={dailyTrendData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="cars" stroke="#1428A0" name="입차량" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="valet" stroke="#F5B731" name="발렛매출" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b90a0", fontSize: 13 }}>데이터가 없습니다</div>
              )}
            </div>
          </div>

          {/* 5. 미정산 + 월주차 만료 */}
          <div className="dash-bottom-row">
            <div className="dash-card dash-compact-card">
              <div className="dash-sec-label" style={{ marginBottom: 0 }}>
                <span className="dash-sec-title">⚠️ 마감 미정산</span>
              </div>
              {records.length === 0 ? (
                <div style={{ color: "#8b90a0", fontSize: 13, textAlign: "center", padding: "10px 0" }}>선택 기간 데이터 없음</div>
              ) : stores.filter(s => !records.some(r => r.store_id === s.id)).length === 0 ? (
                <div style={{ color: "#16A34A", fontSize: 13, fontWeight: 700, textAlign: "center", padding: "10px 0" }}>✅ 모든 매장 입력 완료!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {stores.filter(s => !records.some(r => r.store_id === s.id)).map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#fee2e2", borderRadius: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>미정산</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="dash-card dash-compact-card">
              <div className="dash-sec-label" style={{ marginBottom: 0 }}>
                <span className="dash-sec-title">📅 월주차 만료 예정</span>
                <span className="dash-sec-badge">{expiringSoon.length}건</span>
              </div>
              {expiringSoon.length === 0 ? (
                <div style={{ color: "#16A34A", fontSize: 13, fontWeight: 700, textAlign: "center", padding: "10px 0" }}>✅ 7일 내 만료 없음</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  {expiringSoon.map(c => {
                    const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#fff7ed", borderRadius: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", flexShrink: 0 }}>D-{daysLeft}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.stores?.name}</span>
                        <span style={{ fontSize: 11, color: "#8b90a0" }}>{c.end_date}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </AppLayout>
  );
}
