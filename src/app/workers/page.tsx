// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';
import LeaveTab from "./LeaveTab";
import ReviewTab from "./ReviewTab";
import ReportTab from "./ReportTab";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { getDayType, getHolidayName, getDayTypeLabel } from "@/utils/holidays";
import * as XLSX from "xlsx";

const tabs = [
  { id: "attendance", label: "출퇴근" },
  { id: "roster", label: "명부" },
  { id: "schedule", label: "근태" },
  { id: "leave", label: "연차" },
  { id: "review", label: "근무리뷰" },
  { id: "report", label: "시말서" },
];

const statusMap = {
  present: { label: "출근", bg: "#dcfce7", color: "#15803d" },
  late: { label: "지각", bg: "#fff7ed", color: "#ea580c" },
  absent: { label: "결근", bg: "#fee2e2", color: "#dc2626" },
  dayoff: { label: "휴무", bg: "#f1f5f9", color: "#475569" },
  vacation: { label: "연차", bg: "#ede9fe", color: "#7c3aed" },
};

// ─────────────────────────────────────────────
// 오늘의 근무자 요약 섹션
// ─────────────────────────────────────────────
function TodaySummarySection({ stores, workers, attendanceRecords }) {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  const storeStats = stores.map(s => {
    const storeWorkers = workers.filter(w => w.store_id === s.id && w.status === "active");
    const storeRecs = attendanceRecords.filter(r => r.store_id === s.id);
    const checkedIn = storeRecs.filter(r => r.status === "present" || r.status === "late").length;
    const lateCount = storeRecs.filter(r => r.status === "late").length;
    return {
      id: s.id, name: s.name,
      total: storeWorkers.length,
      checkedIn, lateCount,
    };
  }).filter(s => s.total > 0);

  if (storeStats.length === 0) return null;

  return (
    <div style={{
      background: "var(--white)", borderRadius: 14,
      border: "1px solid var(--border-light)", borderLeft: "3px solid var(--navy)",
      boxShadow: "var(--shadow-sm)", marginBottom: 24, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: "1px solid var(--border-light)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
          <span>👥</span> 오늘의 근무자
        </div>
        <span style={{
          fontSize: 12, color: "var(--text-muted)",
          background: "var(--bg-card)", padding: "4px 10px", borderRadius: 6,
        }}>{today}</span>
      </div>
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {storeStats.map(s => {
            const pct = s.total > 0 ? Math.round((s.checkedIn / s.total) * 100) : 0;
            const badge = s.lateCount > 0
              ? { label: "지각", bg: "var(--warning-bg)", color: "var(--warning)" }
              : s.checkedIn > 0
              ? { label: "정상", bg: "var(--success-bg)", color: "var(--success)" }
              : { label: "예정", bg: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" };
            const barColor = s.lateCount > 0 ? "var(--warning)" : s.checkedIn === 0 ? "var(--text-muted)" : "var(--success)";
            return (
              <div key={s.id} style={{
                background: "var(--white)", border: "1px solid var(--border-light)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color, border: badge.border || "none" }}>
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 8px", borderRadius: 4, display: "inline-block", marginBottom: 8 }}>
                  출근 {s.checkedIn} / {s.lateCount > 0 ? `지각 ${s.lateCount}` : `배정 ${s.total}`}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{s.checkedIn}</span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/ {s.total}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                  <span>출근</span><span>배정</span>
                </div>
                <div style={{ height: 4, background: "var(--bg-card)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: barColor, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 근태 탭 (ScheduleTab) — 기존 기능 완전 보존
// ─────────────────────────────────────────────
function ScheduleTab() {
  const [workers, setWorkers] = useState([]);
  const [stores, setStores] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedStore, setSelectedStore] = useState("");
  const [storeWorkers, setStoreWorkers] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [editCell, setEditCell] = useState(null);
  const [showDownMenu, setShowDownMenu] = useState(false);

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedStore && selectedMonth) loadAllRecords(); }, [selectedStore, selectedMonth, storeWorkers]);
  useEffect(() => { if (selectedStore && workers.length > 0) loadStoreWorkers(); }, [selectedStore, workers]);

  const loadBase = async () => {
    const oid = await getOrgId();
    setOrgId(oid);
    const supabase = createClient();
    const { data: w } = await supabase.from("workers").select("id, name").eq("org_id", oid).eq("status", "active").order("name");
    const { data: s } = await supabase.from("stores").select("id, name").eq("org_id", oid).eq("is_active", true).order("name");
    if (w) setWorkers(w);
    if (s) { setStores(s); if (s.length > 0) setSelectedStore(s[0].id); }
  };

  const loadStoreWorkers = async () => {
    const supabase = createClient();
    const { data: members } = await supabase.from("store_members").select("user_id").eq("store_id", selectedStore);
    if (members && members.length > 0) {
      const workerIds = members.map(m => m.user_id);
      const filtered = workers.filter(w => workerIds.includes(w.id));
      setStoreWorkers(filtered.length > 0 ? filtered : workers);
    } else {
      setStoreWorkers(workers);
    }
  };

  const loadAllRecords = async () => {
    if (storeWorkers.length === 0) return;
    const [y, m] = selectedMonth.split("-");
    const startDate = `${y}-${m}-01`;
    const endDate = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
    const supabase = createClient();
    const workerIds = storeWorkers.map(w => w.id);
    const { data } = await supabase.from("worker_attendance").select("*").in("worker_id", workerIds).gte("date", startDate).lte("date", endDate).order("date");
    if (data) setRecords(data);
  };

  const setStatus = async (workerId, date, status) => {
    const existing = records.find(r => r.worker_id === workerId && r.date === date);
    const supabase = createClient();
    if (status === "delete") {
      if (existing) await supabase.from("worker_attendance").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("worker_attendance").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("worker_attendance").insert({
        org_id: orgId, worker_id: workerId, date, status,
        check_in: status === "present" ? "09:00" : null, store_id: selectedStore,
      });
    }
    setEditCell(null);
    loadAllRecords();
  };

  const [y, m] = selectedMonth.split("-");
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date().toISOString().split("T")[0];

  const getWorkerStats = (workerId) => {
    const wr = records.filter(r => r.worker_id === workerId);
    const workedDates = wr.filter(r => r.status === "present" || r.status === "late");
    const holidayWork = workedDates.filter(r => {
      const d = dates.find(d => d.date === r.date);
      return d?.holidayName;
    }).length;
    const weekendWork = workedDates.filter(r => {
      const d = dates.find(d => d.date === r.date);
      return d && !d.holidayName && (d.dayOfWeek === 0 || d.dayOfWeek === 6);
    }).length;
    return {
      present: wr.filter(r => r.status === "present").length,
      late: wr.filter(r => r.status === "late").length,
      absent: wr.filter(r => r.status === "absent").length,
      dayoff: wr.filter(r => r.status === "dayoff").length,
      vacation: wr.filter(r => r.status === "vacation").length,
      total: wr.length,
      holidayWork,
      weekendWork,
    };
  };

  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${y}-${m}-${String(i + 1).padStart(2, "0")}`;
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const holidayName = getHolidayName(date);
    const dtype = getDayType(date);
    return { date, day: i + 1, dayOfWeek, dayName: dayNames[dayOfWeek], holidayName, isSpecial: dtype !== "weekday", isToday: date === today };
  });

  const downloadExcel = async (mode) => {
    setShowDownMenu(false);
    const wb = XLSX.utils.book_new();
    const holidayDates = dates.filter(d => d.holidayName);
    const header = ["근무자", ...dates.map(d => {
      let label = `${d.day}일(${d.dayName})`;
      if (d.holidayName) label = `${d.day}일(${d.holidayName.slice(0,3)})🎌`;
      else if (d.dayOfWeek === 0 || d.dayOfWeek === 6) label = `${d.day}일(${d.dayName})☆`;
      return label;
    }), "출근", "지각", "결근", "휴무", "연차", "공휴일근무", "주말근무", "합계"];
    const colWidths = [{ wch: 10 }, ...dates.map(() => ({ wch: 8 })), { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 8 }, { wch: 8 }, { wch: 5 }];

    if (mode === "current") {
      const storeName = stores.find(s => s.id === selectedStore)?.name || "매장";
      const rows = storeWorkers.map(w => {
        const stats = getWorkerStats(w.id);
        return [w.name, ...dates.map(d => { const rec = records.find(r => r.worker_id === w.id && r.date === d.date); return rec ? statusMap[rec.status]?.label || "" : ""; }), stats.present, stats.late, stats.absent, stats.dayoff, stats.vacation, stats.holidayWork, stats.weekendWork, stats.total];
      });
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws["!cols"] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, storeName.slice(0, 31));
      XLSX.writeFile(wb, `근태현황_${storeName}_${selectedMonth}.xlsx`);
    } else {
      const supabase = createClient();
      const [ys, ms] = selectedMonth.split("-");
      const startDate = `${ys}-${ms}-01`;
      const endDate = `${ys}-${ms}-${new Date(Number(ys), Number(ms), 0).getDate()}`;
      for (const store of stores) {
        const { data: members } = await supabase.from("store_members").select("user_id").eq("store_id", store.id);
        let sw = workers;
        if (members && members.length > 0) {
          const ids = members.map(m => m.user_id);
          const filtered = workers.filter(w => ids.includes(w.id));
          if (filtered.length > 0) sw = filtered;
        }
        const { data: recs } = await supabase.from("worker_attendance").select("*").in("worker_id", sw.map(w => w.id)).eq("store_id", store.id).gte("date", startDate).lte("date", endDate);
        const storeRecs = recs || [];
        const rows = sw.map(w => {
          const wr = storeRecs.filter(r => r.worker_id === w.id);
          const workedDates = wr.filter(r => r.status === "present" || r.status === "late");
          const st = {
            present: wr.filter(r => r.status === "present").length,
            late: wr.filter(r => r.status === "late").length,
            absent: wr.filter(r => r.status === "absent").length,
            dayoff: wr.filter(r => r.status === "dayoff").length,
            vacation: wr.filter(r => r.status === "vacation").length,
            holidayWork: workedDates.filter(r => { const d = dates.find(d => d.date === r.date); return d?.holidayName; }).length,
            weekendWork: workedDates.filter(r => { const d = dates.find(d => d.date === r.date); return d && !d.holidayName && (d.dayOfWeek === 0 || d.dayOfWeek === 6); }).length,
          };
          return [w.name, ...dates.map(d => { const rec = storeRecs.find(r => r.worker_id === w.id && r.date === d.date); return rec ? statusMap[rec.status]?.label || "" : ""; }), st.present, st.late, st.absent, st.dayoff, st.vacation, st.holidayWork, st.weekendWork, st.present + st.late + st.absent + st.dayoff + st.vacation];
        });
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws["!cols"] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, store.name.slice(0, 31));
      }
      XLSX.writeFile(wb, `근태현황_전체매장_${selectedMonth}.xlsx`);
    }
  };

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
      {/* 카드 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-light)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
          <span>📅</span> 월별 근태 현황
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDownMenu(!showDownMenu)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--gold)", color: "var(--navy-dark)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            📥 엑셀 다운 ▾
          </button>
          {showDownMenu && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowDownMenu(false)} />
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--white)", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid var(--border)", zIndex: 100, overflow: "hidden", minWidth: 160 }}>
                <button onClick={() => downloadExcel("current")} style={{ display: "block", width: "100%", padding: "11px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--border-light)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  📄 현재 매장만
                </button>
                <button onClick={() => downloadExcel("all")} style={{ display: "block", width: "100%", padding: "11px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "left", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  📚 전체 매장 (시트별)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* 매장 + 월 선택 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>매장 선택</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {stores.map(s => (
                <button key={s.id} onClick={() => setSelectedStore(s.id)} style={{
                  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  border: s.id === selectedStore ? "2px solid var(--navy)" : "1px solid var(--border)",
                  background: s.id === selectedStore ? "var(--navy)" : "var(--white)",
                  color: s.id === selectedStore ? "#fff" : "var(--text-secondary)",
                }}>{s.name}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>월 선택</div>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, fontWeight: 600, outline: "none" }} />
          </div>
        </div>

        {/* 공휴일 보너스 요약 카드 */}
        {(() => {
          const holidayDatesThisMonth = dates.filter(d => d.holidayName);
          if (holidayDatesThisMonth.length === 0 || storeWorkers.length === 0) return null;
          const bonusSummary = storeWorkers.map(w => {
            const stats = getWorkerStats(w.id);
            return { name: w.name, holidayWork: stats.holidayWork, weekendWork: stats.weekendWork };
          }).filter(w => w.holidayWork > 0 || w.weekendWork > 0);
          return (
            <div style={{ background: "linear-gradient(135deg, #fff9e6 0%, #fffdf5 100%)", border: "1px solid rgba(245,183,49,0.4)", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🎌</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#92400e" }}>공휴일 · 주말 근무 현황</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", background: "rgba(245,183,49,0.2)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                  이번 달 공휴일 {holidayDatesThisMonth.length}일
                </span>
              </div>
              {bonusSummary.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>공휴일/주말 근무 기록 없음</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                  {bonusSummary.map(w => (
                    <div key={w.name} style={{ background: "var(--white)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(245,183,49,0.3)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{w.name}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {w.holidayWork > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626", lineHeight: 1 }}>{w.holidayWork}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>공휴일근무</div>
                          </div>
                        )}
                        {w.weekendWork > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)", lineHeight: 1 }}>{w.weekendWork}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>주말근무</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: "#92400e", background: "rgba(245,183,49,0.15)", padding: "6px 12px", borderRadius: 6 }}>
                💡 근로기준법 기준: 공휴일 근무 시 통상임금의 150% 지급 (8시간 초과 시 200%)
              </div>
            </div>
          );
        })()}

        {/* 범례 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
          {Object.entries(statusMap).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: v.bg, border: `1px solid ${v.color}40` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: v.color }}>{v.label}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>💡 셀 클릭으로 상태 선택</span>
        </div>

        {storeWorkers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>배정된 근무자가 없습니다</div>
        ) : (
          <>
            {/* PC: 매트릭스 테이블 */}
            <div className="hidden md:block" style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
              <table style={{ borderCollapse: "collapse", minWidth: daysInMonth * 38 + 180 }}>
                <thead>
                  <tr style={{ background: "var(--bg-card)" }}>
                    <th style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "left", position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 3, borderRight: "2px solid var(--border)", minWidth: 100, borderBottom: "1px solid var(--border)" }}>근무자</th>
                    {dates.map(d => (
                      <th key={d.date} style={{
                        padding: "5px 2px", textAlign: "center", minWidth: 36,
                        borderLeft: "1px solid var(--border-light)",
                        borderBottom: "1px solid var(--border)",
                        background: d.isToday ? "var(--navy)" : d.holidayName ? "#fef9e7" : d.isSpecial ? "#f9fafb" : "var(--bg-card)",
                        color: d.isToday ? "#fff" : d.holidayName ? "var(--error)" : "var(--text-secondary)",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{d.day}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: d.isToday ? "rgba(255,255,255,0.7)" : d.dayOfWeek === 0 ? "var(--error)" : d.dayOfWeek === 6 ? "var(--navy)" : "var(--text-muted)" }}>{d.dayName}</div>
                        {d.holidayName && <div style={{ fontSize: 7, fontWeight: 700, color: "var(--error)", lineHeight: 1.1 }}>{d.holidayName.slice(0, 3)}</div>}
                      </th>
                    ))}
                    <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center", borderLeft: "2px solid var(--border)", borderBottom: "1px solid var(--border)", minWidth: 60, background: "var(--bg-card)", position: "sticky", right: 0, zIndex: 3 }}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {storeWorkers.map((w, wi) => {
                    const stats = getWorkerStats(w.id);
                    const rowBg = wi % 2 === 0 ? "var(--white)" : "#fafbfc";
                    return (
                      <tr key={w.id} style={{ borderTop: "1px solid var(--border-light)", background: rowBg }}>
                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, position: "sticky", left: 0, background: rowBg, zIndex: 2, borderRight: "2px solid var(--border)", whiteSpace: "nowrap" }}>{w.name}</td>
                        {dates.map(d => {
                          const rec = records.find(r => r.worker_id === w.id && r.date === d.date);
                          const st = rec ? statusMap[rec.status] : null;
                          const isEditing = editCell?.workerId === w.id && editCell?.date === d.date;
                          return (
                            <td key={d.date} style={{ padding: "3px 1px", textAlign: "center", borderLeft: "1px solid var(--border-light)", background: d.isToday ? "rgba(20,40,160,0.04)" : d.isSpecial ? "rgba(254,249,231,0.3)" : "", position: "relative" }}>
                              {isEditing && (
                                <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "var(--white)", borderRadius: 10, padding: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2, minWidth: 70 }}>
                                  {Object.entries(statusMap).map(([k, v]) => (
                                    <button key={k} onClick={() => setStatus(w.id, d.date, k)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
                                  ))}
                                  {rec && <button onClick={() => setStatus(w.id, d.date, "delete")} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>삭제</button>}
                                  <button onClick={() => setEditCell(null)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>취소</button>
                                </div>
                              )}
                              <div onClick={() => setEditCell(isEditing ? null : { workerId: w.id, date: d.date })} style={{ cursor: "pointer", padding: "3px 2px", borderRadius: 4, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(20,40,160,0.06)"}
                                onMouseLeave={e => e.currentTarget.style.background = ""}>
                                {st ? (
                                  <span style={{ display: "inline-block", width: 28, height: 20, lineHeight: "20px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                ) : (
                                  <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: "5px 8px", textAlign: "center", borderLeft: "2px solid var(--border)", position: "sticky", right: 0, background: rowBg, zIndex: 2 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)" }}>{stats.present}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>출</span></div>
                          {stats.late > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--warning)" }}>{stats.late}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>지</span></div>}
                          {stats.absent > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--error)" }}>{stats.absent}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>결</span></div>}
                          {stats.holidayWork > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", marginTop: 2 }}>{stats.holidayWork}<span style={{ fontSize: 8, fontWeight: 400, color: "var(--text-muted)" }}>공휴</span></div>}
                          {stats.weekendWork > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--navy)", marginTop: 1 }}>{stats.weekendWork}<span style={{ fontSize: 8, fontWeight: 400, color: "var(--text-muted)" }}>주말</span></div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일: 근무자별 카드 v3 */}
            <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {storeWorkers.map(w => {
                const stats = getWorkerStats(w.id);
                return (
                  <div key={w.id} style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)", overflow: "hidden" }}>
                    {/* 카드 헤더 */}
                    <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f2f7" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ecf0ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>👤</div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d2b" }}>{w.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#16A34A" }}>{stats.present}출</span>
                        {stats.late > 0 && <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#fff7ed", color: "#EA580C" }}>{stats.late}지</span>}
                        {stats.absent > 0 && <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#DC2626" }}>{stats.absent}결</span>}
                        {stats.vacation > 0 && <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: "#ede9fe", color: "#7c3aed" }}>{stats.vacation}연</span>}
                      </div>
                    </div>
                    {/* 달력 가로스크롤 */}
                    <div style={{ overflowX: "auto", padding: "10px 12px 4px" }}>
                      <div style={{ display: "flex", gap: 4, minWidth: daysInMonth * 34 }}>
                        {dates.map(d => {
                          const rec = records.find(r => r.worker_id === w.id && r.date === d.date);
                          const st = rec ? statusMap[rec.status] : null;
                          const isEditing = editCell?.workerId === w.id && editCell?.date === d.date;
                          const numColor = d.dayOfWeek === 0 || d.holidayName ? "#DC2626" : d.dayOfWeek === 6 ? "#1428A0" : "#94a3b8";
                          return (
                            <div key={d.date} style={{ position: "relative", textAlign: "center", minWidth: 30 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: numColor, marginBottom: 3 }}>{d.day}{d.dayName}</div>
                              <div onClick={() => setEditCell(isEditing ? null : { workerId: w.id, date: d.date })}
                                style={{ cursor: "pointer", borderRadius: 5, minHeight: 22, display: "flex", alignItems: "center", justifyContent: "center",
                                  background: d.isToday ? "#1428A0" : st ? st.bg : d.holidayName ? "#fff1f2" : d.isSpecial ? "#f0f5ff" : "#f8fafc" }}>
                                {st
                                  ? <span style={{ fontSize: 8, fontWeight: 700, color: d.isToday ? "#fff" : st.color }}>{st.label}</span>
                                  : d.holidayName
                                    ? <span style={{ fontSize: 7, fontWeight: 700, color: "#DC2626" }}>공</span>
                                    : <span style={{ fontSize: 8, color: "#e2e8f0" }}>·</span>}
                              </div>
                              {isEditing && (
                                <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "#fff", borderRadius: 10, padding: 6, boxShadow: "0 6px 24px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 3, minWidth: 62 }}>
                                  {Object.entries(statusMap).map(([k, v]) => (
                                    <button key={k} onClick={() => setStatus(w.id, d.date, k)} style={{ padding: "4px 6px", borderRadius: 6, border: "none", background: v.bg, color: v.color, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
                                  ))}
                                  {rec && <button onClick={() => setStatus(w.id, d.date, "delete")} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#94a3b8", fontSize: 10, cursor: "pointer" }}>삭제</button>}
                                  <button onClick={() => setEditCell(null)} style={{ padding: "3px 6px", borderRadius: 6, border: "none", background: "#f1f5f9", color: "#94a3b8", fontSize: 9, cursor: "pointer" }}>취소</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* 하단 통계 바 */}
                    <div style={{ display: "flex", padding: "10px 12px 14px", gap: 6 }}>
                      {[
                        { val: stats.present, lbl: "출근", color: "#16A34A", bg: "#dcfce7" },
                        { val: stats.late,    lbl: "지각", color: "#EA580C", bg: "#fff7ed" },
                        { val: stats.absent,  lbl: "결근", color: "#DC2626", bg: "#fee2e2" },
                        { val: stats.vacation,lbl: "연차", color: "#7c3aed", bg: "#ede9fe" },
                        { val: stats.weekendWork, lbl: "주말", color: "#1428A0", bg: "#e0e8ff" },
                      ].map(item => (
                        <div key={item.lbl} style={{ flex: 1, textAlign: "center", background: item.bg, borderRadius: 8, padding: "5px 2px" }}>
                          <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.val}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: item.color, opacity: 0.7, marginTop: 2 }}>{item.lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function WorkersPage() {
  const [tab, setTab] = useState("roster");
  const [workers, setWorkers] = useState([]);
  const [stores, setStores] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStore, setAttendanceStore] = useState("");
  const [attendanceWorkers, setAttendanceWorkers] = useState([]);
  const [manualModal, setManualModal] = useState({ show: false, record: null });
  const [manualForm, setManualForm] = useState({ workerId: "", status: "present", checkIn: "", checkOut: "" });
  const [manualMsg, setManualMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", region_id: "", district: "" });
  const [regions, setRegions] = useState([]);
  // 명부 팝업 state
  const [rosterPopup, setRosterPopup] = useState<{ type: "edit"|"deact"|"del"|null; worker: any }>({ type: null, worker: null });
  // 근무자별 배정 매장 map
  const [workerStoreMap, setWorkerStoreMap] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");

  const districtMap: Record<string, string[]> = {
    "서울": ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
    "경기": ["가평군","고양시","과천시","광명시","광주시","구리시","군포시","김포시","남양주시","동두천시","부천시","성남시","수원시","시흥시","안산시","안성시","안양시","양주시","양평군","여주시","연천군","오산시","용인시","의왕시","의정부시","이천시","파주시","평택시","포천시","하남시","화성시"],
    "부산": ["강서구","금정구","기장군","남구","동구","동래구","부산진구","북구","사상구","사하구","서구","수영구","연제구","영도구","중구","해운대구"],
    "인천": ["강화군","계양구","남동구","동구","미추홀구","부평구","서구","연수구","옹진군","중구"],
    "대구": ["남구","달서구","달성군","동구","북구","서구","수성구","중구"],
    "대전": ["대덕구","동구","서구","유성구","중구"],
    "광주": ["광산구","남구","동구","북구","서구"],
    "울산": ["남구","동구","북구","울주군","중구"],
    "세종": ["세종시"],
    "강원": ["강릉시","고성군","동해시","삼척시","속초시","양구군","양양군","영월군","원주시","인제군","정선군","철원군","춘천시","태백시","평창군","홍천군","화천군","횡성군"],
    "충북": ["괴산군","단양군","보은군","영동군","옥천군","음성군","제천시","증평군","진천군","청주시","충주시"],
    "충남": ["계룡시","공주시","금산군","논산시","당진시","보령시","부여군","서산시","서천군","아산시","예산군","천안시","청양군","태안군","홍성군"],
    "전북": ["고창군","군산시","김제시","남원시","무주군","부안군","순창군","완주군","익산시","임실군","장수군","전주시","정읍시","진안군"],
    "전남": ["강진군","고흥군","곡성군","광양시","구례군","나주시","담양군","목포시","무안군","보성군","순천시","신안군","여수시","영광군","영암군","완도군","장성군","장흥군","진도군","함평군","해남군","화순군"],
    "경북": ["경산시","경주시","고령군","구미시","군위군","김천시","문경시","봉화군","상주시","성주군","안동시","영덕군","영양군","영주시","영천시","예천군","울릉군","울진군","의성군","청도군","청송군","칠곡군","포항시"],
    "경남": ["거제시","거창군","고성군","김해시","남해군","밀양시","사천시","산청군","양산시","의령군","진주시","창녕군","창원시","통영시","하동군","함안군","함양군","합천군"],
    "제주": ["서귀포시","제주시"],
  };

  const selectedRegionName = regions.find(r => r.id === formData.region_id)?.name || "";
  const districts = districtMap[selectedRegionName] || [];

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const supabase = createClient();
    const oid = await getOrgId();
    if (!oid) return;

    const [{ data: wData }, { data: sData }, { data: aData }, { data: rData }] = await Promise.all([
      supabase.from("workers").select("*, regions(name)").eq("org_id", oid).order("name"),
      supabase.from("stores").select("id, name").eq("org_id", oid).order("name"),
      supabase.from("worker_attendance").select("*").eq("org_id", oid).eq("date", new Date().toISOString().slice(0, 10)),
      supabase.from("regions").select("*").order("name"),
    ]);
    if (wData) setWorkers(wData);
    if (sData) setStores(sData);
    if (aData) setAttendanceRecords(aData);
    if (rData) setRegions(rData);
    // store_members → workerStoreMap 생성 (별도 처리, 실패해도 영향 없음)
    if (sData) {
      const storeNameMap: Record<string, string> = {};
      sData.forEach((s: any) => { storeNameMap[s.id] = s.name; });
      // org_id 없이 store_id 기반으로 조회 (store는 이미 org 필터됨)
      const storeIds = sData.map((s: any) => s.id);
      if (storeIds.length > 0) {
        const { data: mData } = await supabase
          .from("store_members")
          .select("user_id, store_id")
          .in("store_id", storeIds);
        if (mData) {
          const map: Record<string, string[]> = {};
          mData.forEach((m: any) => {
            const storeName = storeNameMap[m.store_id];
            if (!storeName) return;
            if (!map[m.user_id]) map[m.user_id] = [];
            if (!map[m.user_id].includes(storeName)) map[m.user_id].push(storeName);
          });
          setWorkerStoreMap(map);
        }
      }
    }
  };

  // ── 출퇴근 탭: 매장별 근무자 로드 ──
  const loadAttendanceWorkers = async (storeId: string) => {
    if (!storeId) { setAttendanceWorkers(workers.filter(w => w.status === "active")); return; }
    const supabase = createClient();
    const { data: members } = await supabase.from("store_members").select("user_id").eq("store_id", storeId);
    const allActive = workers.filter(w => w.status === "active");
    if (members && members.length > 0) {
      const ids = members.map(m => m.user_id);
      const filtered = allActive.filter(w => ids.includes(w.id));
      setAttendanceWorkers(filtered.length > 0 ? filtered : allActive);
    } else {
      setAttendanceWorkers(allActive);
    }
  };

  useEffect(() => { loadAttendanceWorkers(attendanceStore); }, [attendanceStore, workers]);

  // ── 출퇴근 탭: 수동 등록/수정 저장 ──
  const saveManualAttendance = async () => {
    if (!manualForm.workerId) { setManualMsg("근무자를 선택하세요"); return; }
    const supabase = createClient();
    const oid = await getOrgId();
    const today = new Date().toISOString().slice(0, 10);
    const existing = attendanceRecords.find(r => r.worker_id === manualForm.workerId);
    const payload = {
      org_id: oid,
      worker_id: manualForm.workerId,
      store_id: attendanceStore || null,
      date: today,
      status: manualForm.status,
      check_in: manualForm.checkIn || (manualForm.status === "present" || manualForm.status === "late" ? "09:00" : null),
      check_out: manualForm.checkOut || null,
    };
    let error;
    if (existing) {
      ({ error } = await supabase.from("worker_attendance").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("worker_attendance").insert(payload));
    }
    if (error) { setManualMsg(`저장 실패: ${error.message}`); return; }
    setManualModal({ show: false, record: null });
    setManualForm({ workerId: "", status: "present", checkIn: "", checkOut: "" });
    setManualMsg("");
    loadAll();
  };

  // ── 출퇴근 탭: 특정 근무자 출퇴근 삭제 ──
  const deleteAttendance = async (recordId: string) => {
    if (!confirm("출퇴근 기록을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("worker_attendance").delete().eq("id", recordId);
    loadAll();
  };

  // ── 출퇴근 탭: 근무시간 계산 ──
  const calcWorkHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return "-";
    const [h1, m1] = checkIn.split(":").map(Number);
    const [h2, m2] = checkOut.split(":").map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) return "-";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const handleSave = async () => {
    if (!formData.name) { setMessage("이름을 입력하세요"); return; }
    const supabase = createClient();
    const oid = await getOrgId();
    if (editItem) {
      const { error } = await supabase.from("workers").update({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null }).eq("id", editItem.id);
      if (error) { setMessage(`수정 실패: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from("workers").insert({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null, status: "active", org_id: oid });
      if (error) { setMessage(`추가 실패: ${error.message}`); return; }
    }
    setShowForm(false); setEditItem(null); setFormData({ name: "", phone: "", region_id: "", district: "" }); setMessage(""); loadAll();
  };

  const toggleStatus = async (worker) => {
    const supabase = createClient();
    await supabase.from("workers").update({ status: worker.status === "active" ? "inactive" : "active" }).eq("id", worker.id);
    loadAll();
  };

  const activeWorkers = workers.filter(w => w.status === "active");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">

        {/* ── 오늘의 근무자 요약 ── */}
        <TodaySummarySection stores={stores} workers={workers} attendanceRecords={attendanceRecords} />

        {/* ── 6탭 ── */}
        <div className="v3-period-tabs overflow-x-auto mb-6" style={{ display: "flex", gap: 4, padding: 4, flexWrap: "nowrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`v3-period-tab cursor-pointer whitespace-nowrap${tab === t.id ? " active" : ""}`}
              style={{ flexShrink: 0 }}>{t.label}</button>
          ))}
        </div>

        {/* ── 출퇴근 탭 ── */}
        {tab === "attendance" && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const displayWorkers = attendanceWorkers.length > 0 ? attendanceWorkers : workers.filter(w => w.status === "active");
          const checkedIn = displayWorkers.filter(w => attendanceRecords.find(r => r.worker_id === w.id && (r.status === "present" || r.status === "late")));
          const late = displayWorkers.filter(w => attendanceRecords.find(r => r.worker_id === w.id && r.status === "late"));
          const absent = displayWorkers.filter(w => attendanceRecords.find(r => r.worker_id === w.id && r.status === "absent"));
          const notYet = displayWorkers.filter(w => !attendanceRecords.find(r => r.worker_id === w.id));
          return (
          <div>
            {/* 수동 등록 모달 */}
            {manualModal.show && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🕐</span> 출퇴근 수동 등록
                    <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)", fontWeight: 500, background: "var(--bg-card)", padding: "4px 10px", borderRadius: 8 }}>{today}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>근무자 *</div>
                      <select value={manualForm.workerId} onChange={e => setManualForm({ ...manualForm, workerId: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}>
                        <option value="">선택하세요</option>
                        {displayWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>상태</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {Object.entries(statusMap).map(([key, val]) => (
                          <button key={key} onClick={() => setManualForm({ ...manualForm, status: key })}
                            style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${manualForm.status === key ? val.color : "var(--border)"}`, background: manualForm.status === key ? val.bg : "#fff", color: val.color, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {val.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>출근 시간</div>
                        <input type="time" value={manualForm.checkIn} onChange={e => setManualForm({ ...manualForm, checkIn: e.target.value })}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>퇴근 시간</div>
                        <input type="time" value={manualForm.checkOut} onChange={e => setManualForm({ ...manualForm, checkOut: e.target.value })}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, boxSizing: "border-box" }} />
                      </div>
                    </div>
                    {manualMsg && <p style={{ color: "var(--error)", fontSize: 13 }}>{manualMsg}</p>}
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button onClick={() => { setManualModal({ show: false, record: null }); setManualForm({ workerId: "", status: "present", checkIn: "", checkOut: "" }); setManualMsg(""); }}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
                      <button onClick={saveManualAttendance}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>💾 저장</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 카드 헤더 */}
            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-light)", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🕐</span> 오늘의 출퇴근 현황
                  </div>
                  {/* 매장 필터 */}
                  <select value={attendanceStore} onChange={e => setAttendanceStore(e.target.value)}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, background: "#fff" }}>
                    <option value="">전체 매장</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "5px 12px", borderRadius: 8, background: "var(--success-bg)", color: "var(--success)", fontSize: 13, fontWeight: 700 }}>출근 {checkedIn.length}명</span>
                  <span style={{ padding: "5px 12px", borderRadius: 8, background: "#fff7ed", color: "#ea580c", fontSize: 13, fontWeight: 700 }}>지각 {late.length}명</span>
                  <span style={{ padding: "5px 12px", borderRadius: 8, background: "var(--error-bg)", color: "var(--error)", fontSize: 13, fontWeight: 700 }}>미출근 {notYet.length}명</span>
                  <button onClick={() => { setManualForm({ workerId: "", status: "present", checkIn: "", checkOut: "" }); setManualMsg(""); setManualModal({ show: true, record: null }); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    + 수동 등록
                  </button>
                </div>
              </div>

              <div style={{ padding: "16px 24px" }}>
                {/* PC 테이블 */}
                <div className="hidden md:block">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["이름", "연락처", "출근시간", "퇴근시간", "근무시간", "상태", "액션"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "left", background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayWorkers.map(w => {
                        const rec = attendanceRecords.find(r => r.worker_id === w.id);
                        const sm = rec ? statusMap[rec.status] : null;
                        return (
                          <tr key={w.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                            <td style={{ padding: "13px 14px", fontSize: 14, fontWeight: 700 }}>{w.name}</td>
                            <td style={{ padding: "13px 14px", fontSize: 13, color: "var(--text-secondary)" }}>{w.phone || "-"}</td>
                            <td style={{ padding: "13px 14px", fontSize: 14, fontWeight: 600, color: rec?.check_in ? "var(--text-primary)" : "var(--text-muted)" }}>{rec?.check_in || "-"}</td>
                            <td style={{ padding: "13px 14px", fontSize: 14, color: rec?.check_out ? "var(--text-primary)" : "var(--text-muted)" }}>{rec?.check_out || "-"}</td>
                            <td style={{ padding: "13px 14px", fontSize: 13, color: "var(--text-secondary)" }}>{rec ? calcWorkHours(rec.check_in, rec.check_out) : "-"}</td>
                            <td style={{ padding: "13px 14px" }}>
                              {sm ? (
                                <span style={{ padding: "4px 12px", borderRadius: 6, background: sm.bg, color: sm.color, fontSize: 12, fontWeight: 700 }}>{sm.label}</span>
                              ) : (
                                <span style={{ padding: "4px 12px", borderRadius: 6, background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>미기록</span>
                              )}
                            </td>
                            <td style={{ padding: "13px 14px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => { setManualForm({ workerId: w.id, status: rec?.status || "present", checkIn: rec?.check_in || "", checkOut: rec?.check_out || "" }); setManualMsg(""); setManualModal({ show: true, record: rec }); }}
                                  style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--navy)" }}>수정</button>
                                {rec && (
                                  <button onClick={() => deleteAttendance(rec.id)}
                                    style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--error)" }}>삭제</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {displayWorkers.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>등록된 근무자가 없습니다</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 카드 */}
                <div className="md:hidden space-y-2">
                  {displayWorkers.map(w => {
                    const rec = attendanceRecords.find(r => r.worker_id === w.id);
                    const sm = rec ? statusMap[rec.status] : null;
                    return (
                      <div key={w.id} style={{
                        background: "#fff", borderRadius: 16, padding: "14px 16px",
                        marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                        borderLeft: `3.5px solid ${sm ? sm.color : "#cbd5e1"}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{w.name}</div>
                          {sm ? (
                            <span style={{ padding: "4px 12px", borderRadius: 8, background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700 }}>{sm.label}</span>
                          ) : (
                            <span style={{ padding: "4px 12px", borderRadius: 8, background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 700 }}>미기록</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                          <span>출근 <strong style={{ color: "#1a1d2b" }}>{rec?.check_in || "-"}</strong></span>
                          <span>퇴근 <strong style={{ color: "#1a1d2b" }}>{rec?.check_out || "-"}</strong></span>
                          {rec && <span>근무 <strong style={{ color: "#1a1d2b" }}>{calcWorkHours(rec.check_in, rec.check_out)}</strong></span>}
                        </div>
                        {w.phone && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>📱 {w.phone}</div>}
                        {/* 수정만 — 삭제 없음 */}
                        <button onClick={() => { setManualForm({ workerId: w.id, status: rec?.status || "present", checkIn: rec?.check_in || "", checkOut: rec?.check_out || "" }); setManualMsg(""); setManualModal({ show: true, record: rec }); }}
                          style={{ width: "100%", padding: 10, borderRadius: 11, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          {rec ? "✏️ 수정" : "+ 등록"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── 명부 탭 ── */}
        {tab === "roster" && (
          <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
                <span>📋</span> 근무자 명부 <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>({workers.length}명)</span>
              </div>
              <button onClick={() => { setEditItem(null); setFormData({ name: "", phone: "", region_id: "", district: "" }); setShowForm(true); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                + 근무자 추가
              </button>
            </div>

            {showForm && (
              <div id="worker-edit-form" style={{ margin: "0 24px 0 24px", marginTop: 20, background: "var(--bg-card)", borderRadius: 14, padding: 24, border: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editItem ? "근무자 수정" : "근무자 추가"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>이름 *</div>
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="홍길동" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>연락처</div>
                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>시/도</div>
                    <select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value, district: "" })} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                      <option value="">선택</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>구/시</div>
                    <select value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} disabled={districts.length === 0} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", background: districts.length === 0 ? "var(--bg-card)" : "var(--white)", boxSizing: "border-box" }}>
                      <option value="">선택</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {message && <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 10 }}>{message}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleSave} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
                </div>
              </div>
            )}

            <div style={{ padding: "16px 24px" }}>
              {/* PC 테이블 */}
              <div className="hidden md:block">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["이름", "배정매장", "지역", "연락처", "상태", "관리"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "left", background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map(w => (
                      <tr key={w.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 600 }}>{w.name}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {(workerStoreMap[w.id] || []).length > 0
                              ? (workerStoreMap[w.id] || []).map((sn, si) => (
                                  <span key={si} style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#e0e8ff", color: "#1428A0" }}>{sn}</span>
                                ))
                              : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>-</span>
                            }
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)" }}>{[w.regions?.name, w.district].filter(Boolean).join(" ") || "-"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)" }}>{w.phone || "-"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: w.status === "active" ? "var(--success-bg)" : "var(--error-bg)", color: w.status === "active" ? "var(--success)" : "var(--error)" }}>
                            {w.status === "active" ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setEditItem(w); setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "", district: w.district || "" }); setShowForm(true); }}
                              style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>수정</button>
                            <button onClick={() => toggleStatus(w)}
                              style={{ padding: "5px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: w.status === "active" ? "var(--error-bg)" : "var(--success-bg)", color: w.status === "active" ? "var(--error)" : "var(--success)" }}>
                              {w.status === "active" ? "비활성" : "활성화"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {workers.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 14 }}>등록된 근무자가 없습니다</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* 모바일 카드 */}
              <div className="md:hidden space-y-2">
                {workers.map(w => (
                  <div key={w.id} style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: w.status === "active" ? "#ecf0ff" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, opacity: w.status === "active" ? 1 : 0.6 }}>👤</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1d2b" }}>{w.name}</span>
                            {/* 배정 매장 태그 */}
                            {(workerStoreMap[w.id] || []).map((sn, si) => (
                              <span key={si} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#e0e8ff", color: "#1428A0", whiteSpace: "nowrap" as const }}>
                                🏢 {sn}
                              </span>
                            ))}
                            {(workerStoreMap[w.id] || []).length === 0 && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "#f1f5f9", color: "#94a3b8" }}>미배정</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{[w.regions?.name, w.district].filter(Boolean).join(" ") || "지역 없음"}</div>
                        </div>
                      </div>
                      <span style={{ padding: "4px 11px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: w.status === "active" ? "#dcfce7" : "#f1f5f9", color: w.status === "active" ? "#16A34A" : "#94a3b8", flexShrink: 0 }}>
                        {w.status === "active" ? "활성" : "비활성"}
                      </span>
                    </div>
                    {w.phone && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>📱 {w.phone}</div>}
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => setRosterPopup({ type: "edit", worker: w })}
                        style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #c7d2fe", background: "#fff", color: "#1428A0" }}>✏️ 수정</button>
                      <button onClick={() => setRosterPopup({ type: "deact", worker: w })}
                        style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #fed7aa", background: "#fff", color: "#EA580C" }}>
                        {w.status === "active" ? "비활성" : "활성화"}
                      </button>
                      <button onClick={() => setRosterPopup({ type: "del", worker: w })}
                        style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #fecaca", background: "#fff", color: "#DC2626" }}>🗑 삭제</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 명부 팝업 ── */}
              {rosterPopup.type && rosterPopup.worker && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,60,0.55)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
                  onClick={e => { if (e.target === e.currentTarget) setRosterPopup({ type: null, worker: null }); }}>
                  <div style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: "24px 24px 0 0", paddingBottom: 28, boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "12px auto 18px" }}></div>

                    {/* 수정 팝업 */}
                    {rosterPopup.type === "edit" && (
                      <>
                        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>✏️</div>
                        <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>근무자 정보 수정</div>
                        <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.65, padding: "0 24px", marginBottom: 18 }}>
                          {rosterPopup.worker.name} 근무자의 정보를 수정합니다.
                        </div>
                        <div style={{ margin: "0 18px 18px", background: "#f0f7ff", border: "1.5px solid #c7d9f9", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#1428A0", marginBottom: 5 }}>📝 수정 가능 항목</div>
                          <div style={{ fontSize: 12, color: "#1e3a8a", lineHeight: 1.6 }}>이름 · 연락처 · 담당 지역(시/도, 구/시)<br/>변경 사항은 즉시 저장됩니다.</div>
                        </div>
                        <div style={{ display: "flex", gap: 10, padding: "0 18px" }}>
                          <button onClick={() => setRosterPopup({ type: null, worker: null })}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#f1f5f9", color: "#64748b", border: "none", fontFamily: "inherit" }}>취소</button>
                          <button onClick={() => {
                              setRosterPopup({ type: null, worker: null });
                              setEditItem(rosterPopup.worker);
                              setFormData({ name: rosterPopup.worker.name, phone: rosterPopup.worker.phone || "", region_id: rosterPopup.worker.region_id || "", district: rosterPopup.worker.district || "" });
                              setShowForm(true);
                              setTimeout(() => {
                                document.getElementById("worker-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 100);
                            }}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#1428A0", color: "#fff", border: "none", fontFamily: "inherit" }}>수정 화면으로</button>
                        </div>
                      </>
                    )}

                    {/* 인라인 수정 폼 팝업 */}
                    {rosterPopup.type === "edit_form" && (() => {
                      const w = rosterPopup.worker;
                      const selectedRegionName = regions.find(r => r.id === formData.region_id)?.name || "";
                      const distMap: Record<string, string[]> = {
                        "서울": ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
                        "경기": ["가평군","고양시","과천시","광명시","광주시","구리시","군포시","김포시","남양주시","동두천시","부천시","성남시","수원시","시흥시","안산시","안성시","안양시","양주시","양평군","여주시","연천군","오산시","용인시","의왕시","의정부시","이천시","파주시","평택시","포천시","하남시","화성시"],
                        "부산": ["강서구","금정구","기장군","남구","동구","동래구","부산진구","북구","사상구","사하구","서구","수영구","연제구","영도구","중구","해운대구"],
                        "인천": ["강화군","계양구","남동구","동구","미추홀구","부평구","서구","연수구","옹진군","중구"],
                        "대구": ["남구","달서구","달성군","동구","북구","서구","수성구","중구"],
                        "대전": ["대덕구","동구","서구","유성구","중구"],
                        "광주": ["광산구","남구","동구","북구","서구"],
                        "울산": ["남구","동구","북구","울주군","중구"],
                        "세종": ["세종시"],
                        "강원": ["강릉시","고성군","동해시","삼척시","속초시","양구군","양양군","영월군","원주시","인제군","정선군","철원군","춘천시","태백시","평창군","홍천군","화천군","횡성군"],
                        "충북": ["괴산군","단양군","보은군","영동군","옥천군","음성군","제천시","증평군","진천군","청주시","충주시"],
                        "충남": ["계룡시","공주시","금산군","논산시","당진시","보령시","부여군","서산시","서천군","아산시","예산군","천안시","청양군","태안군","홍성군"],
                        "전북": ["고창군","군산시","김제시","남원시","무주군","부안군","순창군","완주군","익산시","임실군","장수군","전주시","정읍시","진안군"],
                        "전남": ["강진군","고흥군","곡성군","광양시","구례군","나주시","담양군","목포시","무안군","보성군","순천시","신안군","여수시","영광군","영암군","완도군","장성군","장흥군","진도군","함평군","해남군","화순군"],
                        "경북": ["경산시","경주시","고령군","구미시","군위군","김천시","문경시","봉화군","상주시","성주군","안동시","영덕군","영양군","영주시","영천시","예천군","울릉군","울진군","의성군","청도군","청송군","칠곡군","포항시"],
                        "경남": ["거제시","거창군","고성군","김해시","남해군","밀양시","사천시","산청군","양산시","의령군","진주시","창녕군","창원시","통영시","하동군","함안군","함양군","합천군"],
                        "제주": ["서귀포시","제주시"],
                      };
                      const dists = distMap[selectedRegionName] || [];
                      return (
                        <>
                          <div style={{ padding: "0 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1d2b" }}>✏️ {w.name} 수정</div>
                          </div>
                          <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5 }}>이름 *</div>
                              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="홍길동"
                                style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 15, fontWeight: 600, outline: "none", boxSizing: "border-box" as const }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5 }}>연락처</div>
                              <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="010-0000-0000"
                                style={{ width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" as const }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5 }}>시/도</div>
                                <select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value, district: "" })}
                                  style={{ width: "100%", padding: "11px 10px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}>
                                  <option value="">선택</option>
                                  {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5 }}>구/시</div>
                                <select value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })}
                                  disabled={dists.length === 0}
                                  style={{ width: "100%", padding: "11px 10px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: dists.length === 0 ? "#f8f9fb" : "#fff", boxSizing: "border-box" as const }}>
                                  <option value="">선택</option>
                                  {dists.map((d: string) => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </div>
                            </div>
                            {message && <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{message}</p>}
                          </div>
                          <div style={{ display: "flex", gap: 10, padding: "14px 20px 0" }}>
                            <button onClick={() => { setRosterPopup({ type: null, worker: null }); setMessage(""); }}
                              style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#f1f5f9", color: "#64748b", border: "none", fontFamily: "inherit" }}>취소</button>
                            <button onClick={async () => {
                                if (!formData.name) { setMessage("이름을 입력하세요"); return; }
                                const supabase = createClient();
                                const { error } = await supabase.from("workers").update({
                                  name: formData.name, phone: formData.phone || null,
                                  region_id: formData.region_id || null, district: formData.district || null
                                }).eq("id", w.id);
                                if (error) { setMessage(`수정 실패: ${error.message}`); return; }
                                setRosterPopup({ type: null, worker: null });
                                setMessage("");
                                loadAll();
                              }}
                              style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#1428A0", color: "#fff", border: "none", fontFamily: "inherit" }}>저장</button>
                          </div>
                        </>
                      );
                    })()}

                    {/* 비활성 팝업 */}
                    {rosterPopup.type === "deact" && (
                      <>
                        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>{rosterPopup.worker.status === "active" ? "😴" : "✅"}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>
                          {rosterPopup.worker.status === "active" ? "근무자 비활성 처리" : "근무자 재활성화"}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.65, padding: "0 24px", marginBottom: 18 }}>
                          {rosterPopup.worker.name} 근무자를<br/>
                          {rosterPopup.worker.status === "active" ? "비활성 상태로 변경합니다." : "다시 활성화합니다."}
                        </div>
                        {rosterPopup.worker.status === "active" && (
                          <div style={{ margin: "0 18px 18px", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#EA580C", marginBottom: 5 }}>⚠️ 비활성 처리 시 변경사항</div>
                            <div style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.6 }}>
                              · 출퇴근 배정에서 제외됩니다<br/>
                              · 근태 매트릭스에 표시되지 않습니다<br/>
                              · 데이터는 <strong>보존</strong>되며 언제든 재활성화 가능합니다
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, padding: "0 18px" }}>
                          <button onClick={() => setRosterPopup({ type: null, worker: null })}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#f1f5f9", color: "#64748b", border: "none", fontFamily: "inherit" }}>취소</button>
                          <button onClick={() => { setRosterPopup({ type: null, worker: null }); toggleStatus(rosterPopup.worker); }}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: rosterPopup.worker.status === "active" ? "#EA580C" : "#16A34A", color: "#fff", border: "none", fontFamily: "inherit" }}>
                            {rosterPopup.worker.status === "active" ? "비활성 처리" : "활성화"}
                          </button>
                        </div>
                      </>
                    )}

                    {/* 삭제 팝업 */}
                    {rosterPopup.type === "del" && (
                      <>
                        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>🗑️</div>
                        <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", color: "#DC2626", marginBottom: 6 }}>근무자 영구 삭제</div>
                        <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.65, padding: "0 24px", marginBottom: 14 }}>
                          {rosterPopup.worker.name} 근무자의 모든 데이터를<br/>영구적으로 삭제합니다.
                        </div>
                        <div style={{ margin: "0 18px 12px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#DC2626", marginBottom: 7 }}>🚨 삭제되는 데이터 (복구 불가)</div>
                          <ul style={{ paddingLeft: 16 }}>
                            {["근무자 기본 정보 (이름·연락처·지역)", "전체 출퇴근 기록", "근태 이력 (출근·지각·결근·연차)", "근무 리뷰 및 평가 내역", "시말서 전체 기록"].map((t, i) => (
                              <li key={i} style={{ fontSize: 12, color: "#991b1b", marginBottom: 3, lineHeight: 1.5 }}>{t}</li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ margin: "0 18px 18px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "11px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                          💡 데이터 보존이 필요하면 <strong style={{ color: "#EA580C" }}>삭제 대신 비활성</strong> 처리를 권장합니다.
                        </div>
                        <div style={{ display: "flex", gap: 10, padding: "0 18px" }}>
                          <button onClick={() => setRosterPopup({ type: null, worker: null })}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#f1f5f9", color: "#64748b", border: "none", fontFamily: "inherit" }}>취소</button>
                          <button onClick={async () => { setRosterPopup({ type: null, worker: null }); const supabase = createClient(); await supabase.from("workers").delete().eq("id", rosterPopup.worker.id); setWorkers(prev => prev.filter(x => x.id !== rosterPopup.worker.id)); }}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#DC2626", color: "#fff", border: "none", fontFamily: "inherit" }}>영구 삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 나머지 탭 ── */}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "review" && <ReviewTab />}
        {tab === "report" && <ReportTab />}
      </div>
    </AppLayout>
  );
}
