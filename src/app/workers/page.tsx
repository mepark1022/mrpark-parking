// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';
import LeaveTab from "./LeaveTab";
import ReviewTab from "./ReviewTab";
import ReportTab from "./ReportTab";
import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import nextDynamic from "next/dynamic";
const AdminGpsMap = nextDynamic(() => import("@/components/admin/AdminGpsMap"), { ssr: false });
import { showToast as _showToast } from "@/lib/utils/toast";
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
  const [detailModal, setDetailModal] = useState<{ show: boolean; worker: any } | null>(null);

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedStore && selectedMonth) loadAllRecords(); }, [selectedStore, selectedMonth, storeWorkers]);
  useEffect(() => { if (selectedStore && workers.length > 0) loadStoreWorkers(); }, [selectedStore, workers]);

  const loadBase = async () => {
    const oid = await getOrgId();
    setOrgId(oid);
    const supabase = createClient();
    const { data: w } = await supabase.from("workers").select("id, name, user_id").eq("org_id", oid).eq("status", "active").order("name");
    const { data: s } = await supabase.from("stores").select("id, name").eq("org_id", oid).eq("is_active", true).order("name");
    if (w) setWorkers(w);
    if (s) { setStores(s); if (s.length > 0) setSelectedStore(s[0].id); }
  };

  const loadStoreWorkers = async () => {
    const supabase = createClient();
    const { data: members } = await supabase.from("store_members").select("user_id").eq("store_id", selectedStore);
    if (members && members.length > 0) {
      const memberUserIds = members.map(m => m.user_id);
      const filtered = workers.filter(w => w.user_id && memberUserIds.includes(w.user_id));
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

    const wasVacation = existing?.status === "vacation";
    const isVacation  = status === "vacation";
    // vacation 변화량: +1 (추가), -1 (제거), 0 (무관)
    const vacationDelta = isVacation && !wasVacation ? 1
                        : !isVacation && wasVacation ? -1 : 0;

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

    // vacation 변화가 있으면 worker_leaves.used_days 동기화
    if (vacationDelta !== 0 || (status === "delete" && wasVacation)) {
      const delta = status === "delete" && wasVacation ? -1 : vacationDelta;
      const year = Number(date.slice(0, 4));
      const { data: leaveRow } = await supabase
        .from("worker_leaves")
        .select("id, used_days")
        .eq("worker_id", workerId)
        .eq("year", year)
        .maybeSingle();

      if (leaveRow) {
        const newUsed = Math.max(0, (leaveRow.used_days || 0) + delta);
        await supabase.from("worker_leaves")
          .update({ used_days: newUsed, updated_at: new Date().toISOString() })
          .eq("id", leaveRow.id);
      } else if (delta > 0) {
        // 레코드 없으면 신규 생성
        await supabase.from("worker_leaves").insert({
          org_id: orgId, worker_id: workerId, year,
          total_days: 15, used_days: 1, is_auto_calculated: true,
        });
      }
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
    const checkoutApproved = wr.filter(r => r.check_out_type === "manual_approved").length;
    return {
      present: wr.filter(r => r.status === "present").length,
      late: wr.filter(r => r.status === "late").length,
      absent: wr.filter(r => r.status === "absent").length,
      dayoff: wr.filter(r => r.status === "dayoff").length,
      vacation: wr.filter(r => r.status === "vacation").length,
      total: wr.length,
      holidayWork,
      weekendWork,
      checkoutApproved,
    };
  };

  const getWorkerMissingStats = (workerId) => {
    const wr = records.filter(r => r.worker_id === workerId);
    const todayStr = new Date().toISOString().split("T")[0];
    // 미퇴근: check_in 있고 check_out 없는 과거 날짜 (present/late)
    const noCheckout = wr.filter(r =>
      (r.status === "present" || r.status === "late") &&
      r.check_in && !r.check_out &&
      r.date < todayStr
    );
    // 미출근: 결근 status
    const noCheckin = wr.filter(r => r.status === "absent");
    return { noCheckin, noCheckout };
  };

  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${y}-${m}-${String(i + 1).padStart(2, "0")}`;
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const holidayName = getHolidayName(date);
    const dtype = getDayType(date);
    return { date, day: i + 1, dayOfWeek, dayName: dayNames[dayOfWeek], holidayName, isSpecial: dtype !== "weekday", isToday: date === today };
  });

  // 소정근로일: 해당 월의 평일(공휴일 제외) 수
  const scheduledWorkDays = dates.filter(d =>
    d.dayOfWeek !== 0 && d.dayOfWeek !== 6 && !d.holidayName
  ).length;
  // 오늘까지의 소정근로일 (현재 월일 경우 부분 계산)
  const todayStr0 = new Date().toISOString().split("T")[0];
  const isCurrentMonth = `${y}-${m}` === todayStr0.slice(0, 7);
  const elapsedWorkDays = isCurrentMonth
    ? dates.filter(d => d.dayOfWeek !== 0 && d.dayOfWeek !== 6 && !d.holidayName && d.date <= todayStr0).length
    : scheduledWorkDays;

  const handleExcelDownload = async (mode) => {
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

      // 미출근 상세 시트
      const absentRows = storeWorkers.flatMap(w => {
        const { noCheckin } = getWorkerMissingStats(w.id);
        return noCheckin.map(r => [w.name, r.date, "결근(미출근)"]);
      });
      if (absentRows.length > 0) {
        const absentWs = XLSX.utils.aoa_to_sheet([["근무자", "날짜", "구분"], ...absentRows]);
        absentWs["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, absentWs, "미출근 상세");
      }

      // 미퇴근 상세 시트
      const nocheckoutRows = storeWorkers.flatMap(w => {
        const { noCheckout } = getWorkerMissingStats(w.id);
        return noCheckout.map(r => [w.name, r.date, r.check_in || "-", "미퇴근"]);
      });
      if (nocheckoutRows.length > 0) {
        const nocheckoutWs = XLSX.utils.aoa_to_sheet([["근무자", "날짜", "출근시간", "구분"], ...nocheckoutRows]);
        nocheckoutWs["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, nocheckoutWs, "미퇴근 상세");
      }

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
          const filtered = workers.filter(w => w.user_id && ids.includes(w.user_id));
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

        {/* 미출퇴근 집계 요약 */}
        {storeWorkers.length > 0 && (() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const allStats = storeWorkers.map(w => {
            const { noCheckin, noCheckout } = getWorkerMissingStats(w.id);
            const stats = getWorkerStats(w.id);
            return { w, present: stats.present, late: stats.late, noCheckin: noCheckin.length, noCheckout: noCheckout.length };
          });
          const totalPresent = allStats.reduce((s, a) => s + a.present, 0);
          const totalLate = allStats.reduce((s, a) => s + a.late, 0);
          const totalNoCheckin = allStats.reduce((s, a) => s + a.noCheckin, 0);
          const totalNoCheckout = allStats.reduce((s, a) => s + a.noCheckout, 0);
          const hasIssues = totalNoCheckin > 0 || totalNoCheckout > 0;
          return (
            <div style={{ marginBottom: 16 }}>
              {/* 월간 집계 헤더 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>📊 월간 집계</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 6 }}>
                    소정근로일 <strong style={{ color: "var(--navy)" }}>{scheduledWorkDays}일</strong>
                    {isCurrentMonth && <span style={{ color: "var(--text-muted)" }}> (경과 {elapsedWorkDays}일)</span>}
                  </span>
                </div>
                {/* 팀 전체 출근율 */}
                {elapsedWorkDays > 0 && storeWorkers.length > 0 && (() => {
                  const teamRate = Math.round(((totalPresent + totalLate) / (elapsedWorkDays * storeWorkers.length)) * 100);
                  const rateColor = teamRate >= 90 ? "#16A34A" : teamRate >= 70 ? "#EA580C" : "#DC2626";
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>팀 출근율</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: rateColor, fontFamily: "Outfit, sans-serif" }}>{teamRate}%</span>
                    </div>
                  );
                })()}
              </div>

              {/* 월간 요약 카드 6종 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "정상 출근", value: totalPresent, color: "#16A34A", bg: "#dcfce7", icon: "✓",
                    sub: elapsedWorkDays > 0 ? `${Math.round((totalPresent / (elapsedWorkDays * storeWorkers.length || 1)) * 100)}%` : null },
                  { label: "지각", value: totalLate, color: "#EA580C", bg: "#fff7ed", icon: "🕐", sub: null },
                  { label: "결근(미출근)", value: totalNoCheckin, color: "#DC2626", bg: "#fee2e2", icon: "✗", sub: null },
                  { label: "미퇴근", value: totalNoCheckout, color: "#D97706", bg: "#FEF3C7", icon: "⚠",
                    sub: (() => {
                      const approved = allStats.reduce((s, a) => {
                        const stats = getWorkerStats(a.w.id);
                        return s + (stats.checkoutApproved || 0);
                      }, 0);
                      return approved > 0 ? `CREW승인 ${approved}건` : null;
                    })() },
                  { label: "휴무", value: allStats.reduce((s, a) => s + (getWorkerStats(a.w.id).dayoff || 0), 0), color: "#475569", bg: "#f1f5f9", icon: "🏖", sub: null },
                  { label: "연차", value: allStats.reduce((s, a) => s + (getWorkerStats(a.w.id).vacation || 0), 0), color: "#7c3aed", bg: "#ede9fe", icon: "📅", sub: null },
                ].map(card => (
                  <div key={card.label} style={{ background: card.bg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${card.color}22`, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: card.color, fontFamily: "Outfit, sans-serif", lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: card.color, opacity: 0.85, marginTop: 4 }}>{card.label}</div>
                    {card.sub && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: card.color, opacity: 0.65, marginTop: 2 }}>{card.sub}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* 개인별 미출퇴근 테이블 */}
              {hasIssues && (
                <div style={{ background: "#fffbf0", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 14, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(217,119,6,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>⚠️</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>미출퇴근 현황</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#92400e", background: "rgba(217,119,6,0.15)", padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>
                      미출근 {totalNoCheckin}건 · 미퇴근 {totalNoCheckout}건
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "rgba(217,119,6,0.08)" }}>
                        {["근무자", "미출근", "미퇴근", "상세"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#92400e", textAlign: h === "근무자" ? "left" : "center", borderBottom: "1px solid rgba(217,119,6,0.15)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allStats.filter(a => a.noCheckin > 0 || a.noCheckout > 0).map((a, i) => (
                        <tr key={a.w.id} style={{ borderTop: i > 0 ? "1px solid rgba(217,119,6,0.1)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(217,119,6,0.03)" }}>
                          <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700, color: "#1a1d2b" }}>{a.w.name}</td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>
                            {a.noCheckin > 0
                              ? <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, background: "#fee2e2", color: "#DC2626", fontSize: 12, fontWeight: 700 }}>{a.noCheckin}일</span>
                              : <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>
                            {a.noCheckout > 0
                              ? <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, background: "#FEF3C7", color: "#D97706", fontSize: 12, fontWeight: 700 }}>{a.noCheckout}일</span>
                              : <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>
                            <button onClick={() => setDetailModal({ show: true, worker: a.w })}
                              style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid rgba(217,119,6,0.4)", background: "rgba(217,119,6,0.08)", color: "#92400e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              보기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 상세 모달 */}
              {detailModal?.show && (() => {
                const { noCheckin, noCheckout } = getWorkerMissingStats(detailModal.worker.id);
                return (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "18px 20px", borderBottom: "1px solid #f0f2f7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1d2b" }}>{detailModal.worker.name} 상세</span>
                        <button onClick={() => setDetailModal(null)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>닫기</button>
                      </div>
                      <div style={{ overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                        {noCheckin.length > 0 && (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ background: "#fee2e2", padding: "2px 8px", borderRadius: 5 }}>✗ 미출근 {noCheckin.length}일</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {noCheckin.map(r => {
                                const d = dates.find(dd => dd.date === r.date);
                                return (
                                  <span key={r.date} style={{ padding: "4px 10px", borderRadius: 7, background: "#fee2e2", color: "#DC2626", fontSize: 12, fontWeight: 700 }}>
                                    {d ? `${d.day}일(${d.dayName})` : r.date}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {noCheckout.length > 0 && (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#D97706", marginBottom: 8 }}>
                              <span style={{ background: "#FEF3C7", padding: "2px 8px", borderRadius: 5 }}>⚠ 미퇴근 {noCheckout.length}일</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {noCheckout.map(r => {
                                const d = dates.find(dd => dd.date === r.date);
                                return (
                                  <div key={r.date} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#fffbf0", border: "1px solid rgba(217,119,6,0.2)" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>{d ? `${d.day}일(${d.dayName})` : r.date}</span>
                                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#92400e" }}>출근 {r.check_in || "-"} · 퇴근 미기록</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {noCheckin.length === 0 && noCheckout.length === 0 && (
                          <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 14 }}>미출퇴근 기록이 없습니다 ✓</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

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
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12 }}>🔔</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1428A0" }}>CREW 퇴근수정 승인</span>
          </div>
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
                          const todayStr2 = new Date().toISOString().split("T")[0];
                          const isNoCheckout = rec && (rec.status === "present" || rec.status === "late") && rec.check_in && !rec.check_out && d.date < todayStr2;
                          const isEditing = editCell?.workerId === w.id && editCell?.date === d.date;
                          return (
                            <td key={d.date} style={{ padding: "3px 1px", textAlign: "center", borderLeft: "1px solid var(--border-light)", background: isNoCheckout ? "rgba(254,243,199,0.5)" : d.isToday ? "rgba(20,40,160,0.04)" : d.isSpecial ? "rgba(254,249,231,0.3)" : "", position: "relative" }}>
                              {isEditing && (
                                <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "var(--white)", borderRadius: 10, padding: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2, minWidth: 70 }}>
                                  {Object.entries(statusMap).map(([k, v]) => (
                                    <button key={k} onClick={() => setStatus(w.id, d.date, k)} style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
                                  ))}
                                  {rec && <button onClick={() => setStatus(w.id, d.date, "delete")} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>삭제</button>}
                                  <button onClick={() => setEditCell(null)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>취소</button>
                                </div>
                              )}
                              <div onClick={() => setEditCell(isEditing ? null : { workerId: w.id, date: d.date })} style={{ cursor: "pointer", padding: "3px 2px", borderRadius: 4, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s", flexDirection: "column", gap: 1 }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(20,40,160,0.06)"}
                                onMouseLeave={e => e.currentTarget.style.background = ""}>
                                {isNoCheckout ? (
                                  <span style={{ display: "inline-block", width: 28, height: 20, lineHeight: "20px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>⚠</span>
                                ) : st ? (
                                  <span style={{ display: "inline-block", width: 28, height: 20, lineHeight: "20px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                ) : (
                                  <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
                                )}
                                {rec?.check_out_type === "manual_approved" && (
                                  <span style={{ fontSize: 7, color: "#1428A0", lineHeight: 1, fontWeight: 700 }} title="CREW 퇴근 승인">🔔</span>
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
                          {elapsedWorkDays > 0 && (() => {
                            const rate = Math.round(((stats.present + stats.late) / elapsedWorkDays) * 100);
                            const rateColor = rate >= 90 ? "#16A34A" : rate >= 70 ? "#EA580C" : "#DC2626";
                            return <div style={{ fontSize: 10, fontWeight: 800, color: rateColor, marginTop: 3, borderTop: "1px solid var(--border-light)", paddingTop: 2 }}>{rate}%</div>;
                          })()}
                          {stats.checkoutApproved > 0 && (
                            <div style={{ fontSize: 9, color: "#1428A0", marginTop: 2 }} title={`CREW 승인 퇴근 ${stats.checkoutApproved}건`}>🔔{stats.checkoutApproved}</div>
                          )}
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
                      {elapsedWorkDays > 0 && (() => {
                        const rate = Math.round(((stats.present + stats.late) / elapsedWorkDays) * 100);
                        const rateColor = rate >= 90 ? "#16A34A" : rate >= 70 ? "#EA580C" : "#DC2626";
                        return (
                          <div style={{ flex: 1, textAlign: "center", background: rate >= 90 ? "#dcfce7" : rate >= 70 ? "#fff7ed" : "#fee2e2", borderRadius: 8, padding: "5px 2px", border: `1px solid ${rateColor}33` }}>
                            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 900, color: rateColor, lineHeight: 1 }}>{rate}%</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: rateColor, opacity: 0.7, marginTop: 2 }}>출근율</div>
                          </div>
                        );
                      })()}
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
  const [formData, setFormData] = useState({ name: "", phone: "", region_id: "", district: "", hire_date: "" });
  const [regions, setRegions] = useState([]);
  // 명부 팝업 state
  const [rosterPopup, setRosterPopup] = useState<{ type: "edit"|"edit_form"|"deact"|"del"|null; worker: any }>({ type: null, worker: null });
  const [pwResetTarget, setPwResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwResetLoading, setPwResetLoading] = useState(false);
  // 근무자별 배정 매장 map
  const [workerStoreMap, setWorkerStoreMap] = useState<Record<string, string[]>>({});
  // 근무자별 stores map (store_id 기준)
  const [workerStoreIdMap, setWorkerStoreIdMap] = useState<Record<string, string[]>>({});
  // 이름 기준 profile role map
  const [workerRoleMap, setWorkerRoleMap] = useState<Record<string, string>>({});
  const [workerProfileMap, setWorkerProfileMap] = useState<Record<string, { email: string; role: string }>>({});
  const editFormRef = useRef<HTMLDivElement>(null);
  const [successToast, setSuccessToast] = useState("");
  const showToast = (msg: string) => _showToast(msg);
  const [message, setMessage] = useState("");
  // ── 퇴근 처리 요청 state ──
  const [checkoutRequests, setCheckoutRequests] = useState([]);
  const [checkoutModal, setCheckoutModal] = useState<{ show: boolean; req: any; mode: "approve"|"reject" }>({ show: false, req: null, mode: "approve" });
  const [checkoutApproveTime, setCheckoutApproveTime] = useState("");
  const [checkoutRejectReason, setCheckoutRejectReason] = useState("");
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [gpsPopup, setGpsPopup] = useState<{ show: boolean; workerName: string; rec: any; store: any } | null>(null);

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

  // 출퇴근 탭 진입 시 최신 데이터 새로고침
  useEffect(() => {
    if (tab === "attendance") loadAll();
  }, [tab]);

  const loadAll = async () => {
    const supabase = createClient();
    const oid = await getOrgId();
    if (!oid) return;

    const [{ data: wData }, { data: sData }, { data: aData }, { data: rData }, { data: crData }] = await Promise.all([
      supabase.from("workers").select("*, regions(name)").eq("org_id", oid).order("name"),
      supabase.from("stores").select("id, name, latitude, longitude, road_address").eq("org_id", oid).order("name"),
      supabase.from("worker_attendance").select("*").eq("org_id", oid).eq("date", new Date().toISOString().slice(0, 10)),
      supabase.from("regions").select("*").order("name"),
      supabase.from("checkout_requests").select("*, workers(name, phone)").eq("org_id", oid).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    if (wData) setWorkers(wData);
    if (sData) setStores(sData);
    if (aData) setAttendanceRecords(aData);
    if (rData) setRegions(rData);
    if (crData) setCheckoutRequests(crData);
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
          const idMap: Record<string, string[]> = {};
          mData.forEach((m: any) => {
            const storeName = storeNameMap[m.store_id];
            if (!storeName) return;
            if (!map[m.user_id]) map[m.user_id] = [];
            if (!map[m.user_id].includes(storeName)) map[m.user_id].push(storeName);
            if (!idMap[m.user_id]) idMap[m.user_id] = [];
            if (!idMap[m.user_id].includes(m.store_id)) idMap[m.user_id].push(m.store_id);
          });
          setWorkerStoreMap(map);
          setWorkerStoreIdMap(idMap);
        }
      }
    }
    // profiles → 이름 기준 role 매핑 + id 기준 email/role 매핑
    const { data: pData } = await supabase
      .from("profiles")
      .select("id, name, role, email")
      .eq("org_id", oid);
    if (pData) {
      const roleMap: Record<string, string> = {};
      const profileMap: Record<string, { email: string; role: string }> = {};
      pData.forEach((p: any) => {
        if (p.name) roleMap[p.name] = p.role;
        if (p.id) profileMap[p.id] = { email: p.email || "", role: p.role || "" };
      });
      setWorkerRoleMap(roleMap);
      setWorkerProfileMap(profileMap);
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
      const filtered = allActive.filter(w => w.user_id && ids.includes(w.user_id));
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

  // ── 퇴근 처리 요청 승인 ──
  const handleCheckoutApprove = async () => {
    if (!checkoutApproveTime) { showToast("퇴근 시간을 입력하세요"); return; }
    setCheckoutProcessing(true);
    const supabase = createClient();
    const req = checkoutModal.req;
    const oid = await getOrgId();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. checkout_requests 승인 처리
    await supabase.from("checkout_requests").update({
      status: "approved",
      approved_checkout_time: checkoutApproveTime,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", req.id);

    // 2. worker_attendance 퇴근시간 업데이트 (없으면 삽입)
    const { data: existing } = await supabase
      .from("worker_attendance")
      .select("id")
      .eq("org_id", oid)
      .eq("worker_id", req.worker_id)
      .eq("date", req.request_date)
      .single();

    if (existing) {
      await supabase.from("worker_attendance").update({
        check_out: checkoutApproveTime,
        check_out_type: "manual_approved",
      }).eq("id", existing.id);
    } else {
      await supabase.from("worker_attendance").insert({
        org_id: oid,
        worker_id: req.worker_id,
        store_id: req.store_id,
        date: req.request_date,
        status: "present",
        check_out: checkoutApproveTime,
        check_out_type: "manual_approved",
      });
    }

    setCheckoutProcessing(false);
    setCheckoutModal({ show: false, req: null, mode: "approve" });
    setCheckoutApproveTime("");
    showToast("✅ 퇴근수정이 승인되었습니다");
    loadAll();
  };

  // ── 퇴근 처리 요청 반려 ──
  const handleCheckoutReject = async () => {
    if (!checkoutRejectReason.trim()) { showToast("반려 사유를 입력하세요"); return; }
    setCheckoutProcessing(true);
    const supabase = createClient();
    const req = checkoutModal.req;
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("checkout_requests").update({
      status: "rejected",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      reject_reason: checkoutRejectReason.trim(),
    }).eq("id", req.id);

    setCheckoutProcessing(false);
    setCheckoutModal({ show: false, req: null, mode: "approve" });
    setCheckoutRejectReason("");
    showToast("반려 처리가 완료되었습니다");
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
      const { error } = await supabase.from("workers").update({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null, hire_date: formData.hire_date || null }).eq("id", editItem.id);
      if (error) { setMessage(`수정 실패: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from("workers").insert({ name: formData.name, phone: formData.phone || null, region_id: formData.region_id || null, district: formData.district || null, hire_date: formData.hire_date || null, status: "active", org_id: oid });
      if (error) { setMessage(`추가 실패: ${error.message}`); return; }
    }
    setShowForm(false); setEditItem(null); setFormData({ name: "", phone: "", region_id: "", district: "", hire_date: "" }); setMessage(""); loadAll(); showToast(editItem ? "✅ 근무자 정보가 수정되었습니다" : "✅ 근무자가 추가되었습니다");
  };

  const toggleStatus = async (worker) => {
    const action = worker.status === "active" ? "비활성" : "활성화";
    if (!confirm(`${worker.name}님을 ${action} 처리하시겠습니까?`)) return;
    const supabase = createClient();
    await supabase.from("workers").update({ status: worker.status === "active" ? "inactive" : "active" }).eq("id", worker.id);
    loadAll();
    showToast(worker.status === "active" ? "⏸️ 비활성 처리되었습니다" : "✅ 활성화되었습니다");
  };

  const changeRole = async (worker: any, newRole: string) => {
    if (!worker.user_id) { showToast("로그인 계정이 연결되지 않은 근무자입니다", "error"); return; }
    const label = newRole === "crew" ? "크루" : "어드민";
    if (!confirm(`${worker.name}님의 역할을 ${label}(으)로 변경하시겠습니까?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", worker.user_id);
    if (error) { showToast(`역할 변경 실패: ${error.message}`, "error"); return; }
    loadAll();
    showToast(`✅ ${worker.name}님이 ${label}(으)로 변경되었습니다`);
  };

  const handleResetPassword = async () => {
    if (!pwResetTarget?.user_id || !newPassword) return;
    setPwResetLoading(true);
    try {
      const res = await fetch("/api/team/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pwResetTarget.user_id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "실패");
      setPwResetTarget(null);
      setNewPassword("");
      showToast(`✅ ${pwResetTarget.name}님의 비밀번호가 변경되었습니다`);
    } catch (e: any) { showToast(`비밀번호 변경 실패: ${e?.message}`, "error"); }
    finally { setPwResetLoading(false); }
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
            {/* ── 퇴근 처리 요청 승인/반려 모달 ── */}
            {checkoutModal.show && checkoutModal.req && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 22 }}>{checkoutModal.mode === "approve" ? "✅" : "❌"}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1d2b" }}>
                        {checkoutModal.mode === "approve" ? "퇴근수정 승인" : "퇴근수정 반려"}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                        {checkoutModal.req.workers?.name} · {checkoutModal.req.request_date}
                      </div>
                    </div>
                    <button onClick={() => { setCheckoutModal({ show: false, req: null, mode: "approve" }); setCheckoutApproveTime(""); setCheckoutRejectReason(""); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>✕</button>
                  </div>

                  {/* 요청 정보 */}
                  <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 20, borderLeft: "3px solid #F5B731" }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>CREW 수정 요청 내용</div>
                    <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                      <div><span style={{ color: "#94a3b8" }}>요청 퇴근: </span><strong style={{ color: "#1428A0" }}>{checkoutModal.req.requested_checkout_time || "미기재"}</strong></div>
                    </div>
                    {checkoutModal.req.request_reason && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>💬 {checkoutModal.req.request_reason}</div>
                    )}
                  </div>

                  {checkoutModal.mode === "approve" ? (
                    <>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2b", marginBottom: 8 }}>승인 퇴근 시간 *</div>
                        <input type="time" value={checkoutApproveTime}
                          onChange={e => setCheckoutApproveTime(e.target.value)}
                          defaultValue={checkoutModal.req.requested_checkout_time || ""}
                          style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #1428A0", fontSize: 16, fontWeight: 700, color: "#1428A0", boxSizing: "border-box" }} />
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>CREW 앱에서 요청한 시간을 수정할 수 있습니다</div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => { setCheckoutModal({ ...checkoutModal, mode: "reject" }); setCheckoutApproveTime(""); }}
                          style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #dc2626", background: "#fff", color: "#dc2626", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>반려하기</button>
                        <button onClick={handleCheckoutApprove} disabled={checkoutProcessing}
                          style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: checkoutProcessing ? "#94a3b8" : "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: checkoutProcessing ? "not-allowed" : "pointer" }}>
                          {checkoutProcessing ? "처리 중..." : "✅ 승인"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2b", marginBottom: 8 }}>반려 사유 *</div>
                        <textarea value={checkoutRejectReason} onChange={e => setCheckoutRejectReason(e.target.value)}
                          placeholder="반려 사유를 입력하세요 (CREW에게 전달됩니다)"
                          style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #dc2626", fontSize: 14, height: 90, resize: "none", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setCheckoutModal({ ...checkoutModal, mode: "approve" })}
                          style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>뒤로</button>
                        <button onClick={handleCheckoutReject} disabled={checkoutProcessing}
                          style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: checkoutProcessing ? "#94a3b8" : "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: checkoutProcessing ? "not-allowed" : "pointer" }}>
                          {checkoutProcessing ? "처리 중..." : "❌ 반려"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── 퇴근 처리 요청 섹션 ── */}
            {checkoutRequests.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #FEF3C7", borderLeft: "4px solid #F5B731", boxShadow: "0 2px 12px rgba(245,183,49,0.12)", marginBottom: 20, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #FEF3C7", background: "#FFFBEB" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🔔</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#92400E" }}>퇴근수정 요청</div>
                      <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>CREW 앱에서 퇴근 미처리 수정을 요청했습니다. 확인 후 승인하세요.</div>
                    </div>
                  </div>
                  <span style={{ padding: "5px 12px", borderRadius: 20, background: "#F5B731", color: "#1a1d2b", fontSize: 13, fontWeight: 800 }}>{checkoutRequests.length}건</span>
                </div>
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {checkoutRequests.map((req: any) => {
                    const reqDate = req.request_date;
                    const reqTime = req.requested_checkout_time;
                    const store = stores.find((s: any) => s.id === req.store_id);
                    return (
                      <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚶</div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1d2b" }}>{req.workers?.name || "알 수 없음"}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span>📅 {reqDate}</span>
                              {reqTime && <span>🕐 요청 퇴근 {reqTime}</span>}
                              {store && <span>📍 {store.name}</span>}
                            </div>
                            {req.request_reason && (
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, background: "#fff", borderRadius: 6, padding: "3px 8px", border: "1px solid #e2e8f0" }}>
                                💬 {req.request_reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => { setCheckoutModal({ show: true, req, mode: "reject" }); setCheckoutRejectReason(""); }}
                            style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #dc2626", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            반려
                          </button>
                          <button
                            onClick={() => { setCheckoutModal({ show: true, req, mode: "approve" }); setCheckoutApproveTime(req.requested_checkout_time || ""); }}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            승인
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
                {/* 상단: 타이틀 + 매장필터 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    🕐 출퇴근 현황
                  </div>
                  <select value={attendanceStore} onChange={e => setAttendanceStore(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "#fff" }}>
                    <option value="">전체 매장</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {/* 하단: 뱃지 + 버튼 */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "var(--success-bg)", color: "var(--success)", fontSize: 12, fontWeight: 700 }}>출근 {checkedIn.length}</span>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "#fff7ed", color: "#ea580c", fontSize: 12, fontWeight: 700 }}>지각 {late.length}</span>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "var(--error-bg)", color: "var(--error)", fontSize: 12, fontWeight: 700 }}>미출근 {notYet.length}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => loadAll()}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
                      🔄
                    </button>
                    <button onClick={() => { setManualForm({ workerId: "", status: "present", checkIn: "", checkOut: "" }); setManualMsg(""); setManualModal({ show: true, record: null }); }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--navy)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      + 수동등록
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ padding: "0" }}>
                {/* PC 테이블 */}
                <div className="hidden md:block" style={{ padding: "16px 24px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["이름", "연락처", "출근시간", "퇴근시간", "근무시간", "상태", "위치", "액션"].map(h => (
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
                              {rec && (rec.check_in_lat || rec.check_out_lat) ? (() => {
                                const store = stores.find((s: any) => s.id === rec.store_id);
                                const inDist = rec.check_in_distance_m;
                                const outDist = rec.check_out_distance_m;
                                const maxDist = Math.max(inDist || 0, outDist || 0);
                                const isOver = maxDist > 200;
                                return (
                                  <button onClick={() => setGpsPopup({ show: true, workerName: w.name, rec, store })}
                                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: `1px solid ${isOver ? "#FECACA" : "#E2E8F0"}`, background: isOver ? "#FEF2F2" : "#F8FAFC", cursor: "pointer", fontSize: 11, fontWeight: 600, color: isOver ? "#DC2626" : "#1428A0" }}>
                                    {isOver ? "⚠️" : "📍"} {maxDist > 0 ? `${maxDist}m` : "보기"}
                                  </button>
                                );
                              })() : (
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>-</span>
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
                        <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>등록된 근무자가 없습니다</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 카드 */}
                <div className="md:hidden">
                  {displayWorkers.map((w, idx) => {
                    const rec = attendanceRecords.find(r => r.worker_id === w.id);
                    const sm = rec ? statusMap[rec.status] : null;
                    const store = rec ? stores.find((s: any) => s.id === rec.store_id) : null;
                    const maxDist = Math.max(rec?.check_in_distance_m || 0, rec?.check_out_distance_m || 0);
                    const hasGps = rec && (rec.check_in_distance_m || rec.check_out_distance_m);
                    return (
                      <div key={w.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                        background: idx % 2 === 0 ? "#fff" : "#f8fafc",
                        borderBottom: "1px solid #e8ecf1",
                        borderLeft: `3px solid ${sm ? sm.color : "#cbd5e1"}`,
                      }}>
                        {/* 이름 + 시간 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#1a1d2b" }}>{w.name}</span>
                            {sm ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: sm.bg, color: sm.color }}>{sm.label}</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#94a3b8" }}>미기록</span>
                            )}
                            {hasGps && (
                              <span onClick={() => setGpsPopup({ show: true, workerName: w.name, rec, store })}
                                style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: maxDist > 200 ? "#FEF2F2" : "#F0F9FF", color: maxDist > 200 ? "#DC2626" : "#1428A0", cursor: "pointer" }}>
                                📍{maxDist}m
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                            {rec?.check_in || "-"} ~ {rec?.check_out || "-"}{rec ? ` · ${calcWorkHours(rec.check_in, rec.check_out)}` : ""}
                          </div>
                        </div>
                        {/* 수정 버튼 */}
                        <button onClick={() => { setManualForm({ workerId: w.id, status: rec?.status || "present", checkIn: rec?.check_in || "", checkOut: rec?.check_out || "" }); setManualMsg(""); setManualModal({ show: true, record: rec }); }}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 600, color: "#1428A0", cursor: "pointer", flexShrink: 0 }}>
                          {rec ? "수정" : "등록"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── GPS 위치 팝업 ── */}
            {gpsPopup?.show && gpsPopup.rec && (() => {
              const { rec, workerName, store } = gpsPopup;
              const storeLat = store?.latitude ? parseFloat(store.latitude) : null;
              const storeLng = store?.longitude ? parseFloat(store.longitude) : null;
              return (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  onClick={() => setGpsPopup(null)}>
                  <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1d2b" }}>📍 {workerName} 출퇴근 위치</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{store?.name || ""} {store?.road_address ? `· ${store.road_address}` : ""}</div>
                      </div>
                      <button onClick={() => setGpsPopup(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
                    </div>

                    {/* 카카오맵 */}
                    <AdminGpsMap
                      storeLat={storeLat} storeLng={storeLng}
                      checkInLat={rec.check_in_lat ? parseFloat(rec.check_in_lat) : null}
                      checkInLng={rec.check_in_lng ? parseFloat(rec.check_in_lng) : null}
                      checkOutLat={rec.check_out_lat ? parseFloat(rec.check_out_lat) : null}
                      checkOutLng={rec.check_out_lng ? parseFloat(rec.check_out_lng) : null}
                    />

                    {/* 거리 정보 카드 */}
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      {rec.check_in_lat && (
                        <div style={{ flex: 1, borderRadius: 12, padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 4 }}>☀️ 출근</div>
                          <div style={{ fontSize: 11, color: "#166534" }}>
                            시간: <strong>{rec.check_in || "-"}</strong>
                          </div>
                          {rec.check_in_distance_m != null && (
                            <div style={{ fontSize: 11, color: rec.check_in_distance_m > 200 ? "#DC2626" : "#166534", marginTop: 2 }}>
                              매장 거리: <strong>{rec.check_in_distance_m}m</strong>
                              {rec.check_in_distance_m > 200 && " ⚠️ 반경 초과"}
                            </div>
                          )}
                        </div>
                      )}
                      {rec.check_out_lat && (
                        <div style={{ flex: 1, borderRadius: 12, padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>🌙 퇴근</div>
                          <div style={{ fontSize: 11, color: "#991B1B" }}>
                            시간: <strong>{rec.check_out || "-"}</strong>
                          </div>
                          {rec.check_out_distance_m != null && (
                            <div style={{ fontSize: 11, color: rec.check_out_distance_m > 200 ? "#DC2626" : "#991B1B", marginTop: 2 }}>
                              매장 거리: <strong>{rec.check_out_distance_m}m</strong>
                              {rec.check_out_distance_m > 200 && " ⚠️ 반경 초과"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 매장 좌표 미등록 안내 */}
                    {!storeLat && !storeLng && (
                      <div style={{ marginTop: 14, background: "#FEF3C7", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400E", border: "1px solid #FDE68A" }}>
                        ⚠️ 매장 좌표가 등록되지 않아 지도를 표시할 수 없습니다. <strong>매장관리 → 매장 수정</strong>에서 주소를 입력하면 자동으로 좌표가 설정됩니다.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          );
        })()}

        {/* ── 명부 탭 ── */}
        {tab === "roster" && (() => {
          const ROLE_BADGE = {
            super_admin: { label: "최고관리자", bg: "#fef3c7", color: "#b45309", icon: "👑" },
            admin:       { label: "어드민",    bg: "#EEF2FF", color: "#1428A0", icon: "🔑" },
            crew:        { label: "크루",      bg: "#dcfce7", color: "#15803d", icon: "👤" },
          };
          const hqWorkers = workers.filter((w) => !(workerStoreIdMap[w.user_id] || []).length);
          const storeGroups = stores.map((s) => ({
            store: s,
            workers: workers.filter((w) => (workerStoreIdMap[w.user_id] || []).includes(s.id)),
          })).filter((g) => g.workers.length > 0);
          const STORE_COLORS = ["#1428A0","#EA580C","#7C3AED","#0F9ED5","#15803d","#b45309","#DC2626"];

          const WorkerCard = ({ w }: { w: any }) => {
            const prof = w.user_id ? workerProfileMap[w.user_id] : null;
            const role = prof?.role || workerRoleMap[w.name];
            const rb = ROLE_BADGE[role] || ROLE_BADGE["crew"];
            const email = prof?.email || "";
            const isAdmin = role === "admin";
            return (
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                {/* 1줄: 아이콘 + 이름 + 배지 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: rb.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{rb.icon}</div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1d2b" }}>{w.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: rb.bg, color: rb.color }}>{rb.label}</span>
                  {w.status !== "active" && <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "#f1f5f9", color: "#94a3b8" }}>비활성</span>}
                </div>
                {/* 2줄: 이메일 */}
                {email && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, paddingLeft: 36 }}>{email}</div>}
                {/* 3줄: 버튼들 */}
                <div style={{ display: "flex", gap: 4, marginTop: 5, paddingLeft: 36 }}>
                  <button onClick={() => { setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "", district: w.district || "", hire_date: w.hire_date || "" }); setRosterPopup({ type: "edit_form", worker: w }); }}
                    style={{ padding: "3px 8px", border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", fontSize: 11, fontWeight: 600, color: "#1428A0", cursor: "pointer" }}>수정</button>
                  {email && (
                    <button onClick={() => { setPwResetTarget(w); setNewPassword(""); }}
                      style={{ padding: "3px 8px", border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", fontSize: 11, fontWeight: 600, color: "#7C3AED", cursor: "pointer" }}>🔐</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => changeRole(w, "crew")}
                      style={{ padding: "3px 8px", border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", fontSize: 11, fontWeight: 600, color: "#0F9ED5", cursor: "pointer" }}>크루전환</button>
                  )}
                  <button onClick={() => toggleStatus(w)}
                    style={{ padding: "3px 8px", border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: w.status === "active" ? "#DC2626" : "#16A34A" }}>
                    {w.status === "active" ? "비활성" : "활성화"}</button>
                  <button onClick={async () => { if (!confirm(`${w.name} 근무자를 삭제하시겠습니까?`)) return; const supabase = createClient(); await supabase.from("workers").delete().eq("id", w.id); setWorkers((prev: any[]) => prev.filter((x: any) => x.id !== w.id)); showToast("🗑️ 근무자가 삭제되었습니다"); }}
                    style={{ padding: "3px 8px", border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", fontSize: 11, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>삭제</button>
                </div>
              </div>
            );
          };

          const GroupSection = ({ title, accentColor, workers: gWorkers, isHq }: any) => (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-light)", background: accentColor + "10", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 16, background: accentColor, borderRadius: 2 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>{title}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 12, background: accentColor + "20", color: accentColor }}>{gWorkers.length}명</span>
                {isHq && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>매장 미배정</span>}
              </div>
              <div>
                {gWorkers.length === 0
                  ? <div style={{ textAlign: "center" as const, padding: "12px 0", fontSize: 12, color: "var(--text-muted)" }}>근무자 없음</div>
                  : gWorkers.map((w: any) => <WorkerCard key={w.id} w={w} />)
                }
              </div>
            </div>
          );

          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
                  <span>📋</span> 근무자 명부
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>({workers.length}명)</span>
                </div>
              </div>

              {showForm && (
                <div ref={editFormRef} style={{ background: "var(--bg-card)", borderRadius: 14, padding: 24, border: "1px solid var(--border-light)", marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>근무자 수정</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>이름 *</div><input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="홍길동" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>연락처</div><input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>입사일 <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "#1428A0", background: "#EEF2FF", padding: "1px 6px", borderRadius: 4 }}>연차 자동계산</span></div><MeParkDatePicker value={formData.hire_date} onChange={v => setFormData({ ...formData, hire_date: v })} style={{ width: "100%" }} /></div>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>시/도</div><select value={formData.region_id} onChange={e => setFormData({ ...formData, region_id: e.target.value, district: "" })} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", boxSizing: "border-box" as const }}><option value="">선택</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>구/시</div><select value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} disabled={districts.length === 0} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, outline: "none", background: districts.length === 0 ? "var(--bg-card)" : "var(--white)", boxSizing: "border-box" as const }}><option value="">선택</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  </div>
                  {message && <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 10 }}>{message}</p>}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleSave} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{editItem ? "수정" : "추가"}</button>
                    <button onClick={() => { setShowForm(false); setMessage(""); }} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 12, alignItems: "start" }}>
                {hqWorkers.length > 0 && <GroupSection title="🏢 본사 / 미배정" accentColor="#1428A0" workers={hqWorkers} isHq />}
                {storeGroups.map((g, idx) => <GroupSection key={g.store.id} title={`🏪 ${g.store.name}`} accentColor={STORE_COLORS[idx % STORE_COLORS.length]} workers={g.workers} isHq={false} />)}
              </div>
              {workers.length === 0 && <div style={{ textAlign: "center" as const, padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>등록된 근무자가 없습니다</div>}

              {/* ── 명부 팝업 ── */}
              {/* 비밀번호 재설정 모달 */}
              {pwResetTarget && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
                  onClick={() => setPwResetTarget(null)}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", marginBottom: 4 }}>🔐 비밀번호 재설정</div>
                    <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
                      <strong>{pwResetTarget.name}</strong>님의 새 비밀번호를 입력하세요.
                    </div>
                    {workerProfileMap[pwResetTarget.user_id]?.email && (
                      <div style={{ fontSize: 12, color: "#1D4ED8", background: "#EFF6FF", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                        🔑 계정: {workerProfileMap[pwResetTarget.user_id].email}
                      </div>
                    )}
                    <input type="text" placeholder="새 비밀번호 (6자 이상)"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 15, marginBottom: 16, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => setPwResetTarget(null)}
                        style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#F1F5F9", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
                      <button onClick={handleResetPassword}
                        disabled={pwResetLoading || newPassword.length < 6}
                        style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: newPassword.length >= 6 ? "#1428A0" : "#CBD5E1", color: "#fff", fontSize: 14, fontWeight: 700, cursor: newPassword.length >= 6 ? "pointer" : "not-allowed" }}>
                        {pwResetLoading ? "변경 중..." : "비밀번호 변경"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                              setFormData({ name: rosterPopup.worker.name, phone: rosterPopup.worker.phone || "", region_id: rosterPopup.worker.region_id || "", district: rosterPopup.worker.district || "", hire_date: rosterPopup.worker.hire_date || "" });
                              setRosterPopup({ type: "edit_form", worker: rosterPopup.worker });
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
                                showToast("✅ 근무자 정보가 수정되었습니다");
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
                          <button onClick={async () => { setRosterPopup({ type: null, worker: null }); const supabase = createClient(); await supabase.from("workers").delete().eq("id", rosterPopup.worker.id); setWorkers(prev => prev.filter(x => x.id !== rosterPopup.worker.id)); showToast("🗑️ 근무자가 삭제되었습니다"); }}
                            style={{ flex: 1, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#DC2626", color: "#fff", border: "none", fontFamily: "inherit" }}>영구 삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 나머지 탭 ── */}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "review" && <ReviewTab />}
        {tab === "report" && <ReportTab />}
      </div>
    </AppLayout>
  );
}
