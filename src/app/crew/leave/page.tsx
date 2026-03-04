// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import { useCrewToast } from "@/components/crew/CrewToast";
import { calcTotalLeaveDays, getYearsWorkedLabel, calcMonthlyLeaveDays } from "@/lib/utils/leave";

/* ── 상수 ── */
const LEAVE_TYPES = [
  { value: "annual",  label: "연차",   color: "#7C3AED", bg: "#EDE9FE" },
  { value: "half",    label: "반차",   color: "#B45309", bg: "#FEF3C7" },
  { value: "sick",    label: "병가",   color: "#DC2626", bg: "#FEE2E2" },
  { value: "special", label: "특별휴가", color: "#0284C7", bg: "#E0F2FE" },
];

const STATUS_MAP = {
  pending:  { label: "검토 중",  color: "#EA580C", bg: "#FFF7ED" },
  approved: { label: "승인됨",   color: "#16A34A", bg: "#DCFCE7" },
  rejected: { label: "반려됨",   color: "#DC2626", bg: "#FEE2E2" },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

/* ── CSS ── */
const CSS = `
  .leave-page { min-height: 100dvh; background: #F8FAFC; }

  /* 탭 */
  .leave-tabs {
    display: flex;
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    padding: 0 16px;
    gap: 0;
    position: sticky;
    top: 56px;
    z-index: 20;
  }
  .leave-tab-btn {
    flex: 1; padding: 13px 0;
    font-size: 14px; font-weight: 600; color: #94A3B8;
    background: none; border: none; cursor: pointer;
    border-bottom: 2.5px solid transparent;
    transition: all 0.15s;
    font-family: inherit;
  }
  .leave-tab-btn.active {
    color: #1428A0;
    border-bottom-color: #1428A0;
    font-weight: 700;
  }

  /* 현황 배너 */
  .leave-summary {
    margin: 16px;
    background: linear-gradient(135deg, #1428A0 0%, #1e36c0 100%);
    border-radius: 16px;
    padding: 18px 20px;
    color: #fff;
  }
  .leave-summary-title {
    font-size: 13px; font-weight: 600;
    opacity: 0.7; margin-bottom: 14px;
  }
  .leave-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
  }
  .leave-summary-item {
    text-align: center;
    border-right: 1px solid rgba(255,255,255,0.15);
    padding: 0 8px;
  }
  .leave-summary-item:last-child { border-right: none; }
  .leave-summary-val {
    font-family: 'Outfit', sans-serif;
    font-size: 28px; font-weight: 800; line-height: 1;
    margin-bottom: 4px;
  }
  .leave-summary-lbl { font-size: 11px; opacity: 0.65; }

  /* 신청 폼 */
  .leave-form-card {
    margin: 0 16px 16px;
    background: #fff;
    border-radius: 16px;
    border: 1px solid #E2E8F0;
    overflow: hidden;
  }
  .leave-form-header {
    padding: 14px 16px 10px;
    font-size: 13px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #F1F5F9;
  }
  .leave-form-body { padding: 16px; }
  .leave-form-group { margin-bottom: 14px; }
  .leave-form-group:last-child { margin-bottom: 0; }
  .leave-form-label {
    display: block;
    font-size: 12px; font-weight: 700; color: #64748B;
    margin-bottom: 6px;
  }
  .leave-form-input {
    width: 100%; padding: 11px 14px;
    border: 1.5px solid #E2E8F0; border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none;
    transition: border-color 0.15s;
  }
  .leave-form-input:focus { border-color: #1428A0; }
  .leave-type-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .leave-type-btn {
    padding: 10px 8px;
    border: 2px solid #E2E8F0; border-radius: 10px;
    background: #F8FAFC; cursor: pointer;
    font-size: 13px; font-weight: 600; color: #475569;
    text-align: center; font-family: inherit;
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .leave-type-btn.selected {
    border-color: #1428A0;
    background: #EEF2FF;
    color: #1428A0;
  }
  .leave-submit-btn {
    width: 100%; padding: 14px;
    background: #1428A0; color: #fff;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    margin-top: 4px;
    transition: opacity 0.15s;
  }
  .leave-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* 이력 카드 */
  .leave-history-list {
    padding: 0 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .leave-record-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #E2E8F0;
    overflow: hidden;
    display: flex;
  }
  .leave-record-bar { width: 4px; flex-shrink: 0; }
  .leave-record-body { flex: 1; padding: 14px 14px 12px; }
  .leave-record-top {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 6px;
  }
  .leave-record-badges { display: flex; gap: 6px; }
  .leave-badge {
    padding: 3px 9px; border-radius: 6px;
    font-size: 11px; font-weight: 700;
  }
  .leave-record-days {
    font-family: 'Outfit', sans-serif;
    font-size: 20px; font-weight: 800; color: #1A1D2B;
  }
  .leave-record-date { font-size: 13px; color: #64748B; margin-bottom: 4px; }
  .leave-record-reason {
    font-size: 12px; color: #94A3B8;
    background: #F8FAFC; border-radius: 7px;
    padding: 6px 10px; margin-top: 8px;
  }
  .leave-record-reject {
    font-size: 12px; color: #DC2626;
    background: #FEF2F2; border-radius: 7px;
    padding: 6px 10px; margin-top: 8px;
    border: 1px solid #FECACA;
  }
  .leave-empty {
    text-align: center; padding: 48px 20px;
    display: flex; flex-direction: column;
    align-items: center; gap: 12px;
  }
  .leave-empty-title { font-size: 15px; font-weight: 700; color: #1A1D2B; }
  .leave-empty-sub { font-size: 13px; color: #94A3B8; }
`;

/* ── 메인 ── */
export default function CrewLeavePage() {
  const [tab, setTab] = useState<"apply" | "history">("apply");
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [leaveInfo, setLeaveInfo] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hireDate, setHireDate] = useState<string | null>(null);

  const [form, setForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    days: "1",
    reason: "",
  });

  const router = useRouter();
  const { showToast } = useCrewToast();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/crew/login"); return; }

      // worker 정보
      const { data: worker } = await supabase
        .from("workers").select("id, org_id, hire_date")
        .eq("user_id", user.id).limit(1).maybeSingle();

      if (!worker) {
        showToast("근무자 정보가 없습니다. 관리자에게 문의하세요.", "error");
        setLoading(false);
        return;
      }

      setWorkerId(worker.id);
      setOrgId(worker.org_id);
      setHireDate(worker.hire_date || null);

      // 올해 연차 현황
      const year = new Date().getFullYear();
      const { data: leaveData } = await supabase
        .from("worker_leaves").select("*")
        .eq("worker_id", worker.id).eq("year", year).maybeSingle();
      setLeaveInfo(leaveData);

      // 신청 이력 (크루가 신청한 건만)
      const { data: recs } = await supabase
        .from("worker_leave_records").select("*")
        .eq("worker_id", worker.id)
        .eq("requested_by_crew", true)
        .order("created_at", { ascending: false })
        .limit(30);
      setRecords(recs || []);
      setLoading(false);
    };
    init();
  }, []);

  /* 날짜 변경 시 일수 자동 계산 */
  const handleDateChange = (field: "start_date" | "end_date", val: string) => {
    const updated = { ...form, [field]: val };
    if (updated.start_date && updated.end_date) {
      const start = new Date(updated.start_date);
      const end = new Date(updated.end_date);
      if (end >= start) {
        // 주말 제외 영업일 계산
        let days = 0;
        const cur = new Date(start);
        while (cur <= end) {
          const dow = cur.getDay();
          if (dow !== 0 && dow !== 6) days++;
          cur.setDate(cur.getDate() + 1);
        }
        updated.days = String(days || 1);
      }
    }
    setForm(updated);
  };

  /* 2주 전 신청 필수 팝업 상태 */
  const [twoWeekModal, setTwoWeekModal] = useState(false);

  /* 연차 신청 제출 */
  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) {
      showToast("날짜를 입력해주세요", "error"); return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      showToast("종료일이 시작일보다 빠릅니다", "error"); return;
    }
    if (!form.reason.trim()) {
      showToast("신청 사유를 입력해주세요", "error"); return;
    }

    // ── 2주 전 신청 필수 검증 ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(form.start_date);
    const diffDays = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 14) {
      setTwoWeekModal(true);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("worker_leave_records").insert({
      org_id: orgId,
      worker_id: workerId,
      start_date: form.start_date,
      end_date: form.end_date,
      days: Number(form.days) || 1,
      leave_type: form.leave_type,
      reason: form.reason.trim(),
      status: "pending",          // 크루 신청 → 대기 상태
      requested_by_crew: true,    // 크루 신청 플래그
    });

    if (error) {
      showToast("신청 중 오류가 발생했습니다", "error");
    } else {
      showToast("연차 신청이 접수되었습니다 ✅", "success");
      setForm({ leave_type: "annual", start_date: "", end_date: "", days: "1", reason: "" });
      setTab("history");

      // 이력 새로고침
      const { data: recs } = await supabase
        .from("worker_leave_records").select("*")
        .eq("worker_id", workerId)
        .eq("requested_by_crew", true)
        .order("created_at", { ascending: false })
        .limit(30);
      setRecords(recs || []);
    }
    setSubmitting(false);
  };

  /* 신청 취소 (pending 건만) */
  const handleCancel = async (recordId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("worker_leave_records")
      .delete().eq("id", recordId);
    if (!error) {
      showToast("신청이 취소되었습니다", "success");
      setRecords(prev => prev.filter(r => r.id !== recordId));
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const autoDays = hireDate ? calcTotalLeaveDays(hireDate, year) : null;
  const monthlyDays = hireDate ? calcMonthlyLeaveDays(hireDate) : null;
  const yearsLabel = hireDate ? getYearsWorkedLabel(hireDate) : null;
  const totalDays = leaveInfo?.total_days ?? (autoDays && autoDays > 0 ? autoDays : 15);
  const usedDays = leaveInfo?.used_days ?? 0;
  const pendingDays = records
    .filter(r => r.status === "pending")
    .reduce((s, r) => s + (r.days || 0), 0);
  const remainingDays = totalDays - usedDays;

  return (
    <>
      <style>{CSS}</style>
      <div className="leave-page">
        {/* ── 2주 전 신청 필수 팝업 ── */}
        {twoWeekModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}>
            <div style={{
              background: "#fff", borderRadius: 20, width: "100%", maxWidth: 340,
              overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}>
              {/* 헤더 */}
              <div style={{ background: "#1428A0", padding: "20px 24px 16px" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>2주 전 신청 필수</div>
              </div>
              {/* 본문 */}
              <div style={{ padding: "20px 24px 24px" }}>
                <p style={{ fontSize: 14, color: "#1a1d2b", lineHeight: 1.7, margin: "0 0 12px" }}>
                  연차는 <strong>사용일 기준 최소 14일(2주) 전</strong>에 신청해야 합니다.
                </p>
                <div style={{
                  background: "#FEF3C7", borderRadius: 10, padding: "10px 14px",
                  fontSize: 13, color: "#B45309", fontWeight: 600, marginBottom: 20,
                }}>
                  선택하신 시작일이 오늘로부터 14일 이내입니다.<br />
                  날짜를 다시 선택해주세요.
                </div>
                <button
                  onClick={() => setTwoWeekModal(false)}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: "none",
                    background: "#1428A0", color: "#fff", fontSize: 15, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        <CrewHeader title="연차 신청" showBack />

        {/* 탭 */}
        <div className="leave-tabs">
          <button
            className={`leave-tab-btn ${tab === "apply" ? "active" : ""}`}
            onClick={() => setTab("apply")}
          >
            신청하기
          </button>
          <button
            className={`leave-tab-btn ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            신청 이력
            {records.filter(r => r.status === "pending").length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 16, height: 16, background: "#EA580C", color: "#fff",
                borderRadius: "50%", fontSize: 10, fontWeight: 800,
                marginLeft: 6, verticalAlign: "middle",
              }}>
                {records.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>

        {/* 연차 현황 배너 */}
        <div className="leave-summary">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="leave-summary-title" style={{ margin: 0 }}>{year}년 연차 현황</div>
            {yearsLabel && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: "rgba(255,255,255,0.2)", color: "#fff",
                padding: "3px 9px", borderRadius: 6,
              }}>
                근속 {yearsLabel}
              </span>
            )}
          </div>
          <div className="leave-summary-grid">
            <div className="leave-summary-item">
              <div className="leave-summary-val">{totalDays}</div>
              <div className="leave-summary-lbl">총 부여</div>
            </div>
            <div className="leave-summary-item">
              <div className="leave-summary-val" style={{ color: "#F5B731" }}>{usedDays}</div>
              <div className="leave-summary-lbl">사용</div>
            </div>
            <div className="leave-summary-item">
              <div className="leave-summary-val" style={{ color: "#86EFAC" }}>{remainingDays}</div>
              <div className="leave-summary-lbl">잔여</div>
            </div>
          </div>
          {pendingDays > 0 && (
            <div style={{
              marginTop: 12, padding: "8px 12px",
              background: "rgba(245,183,49,0.15)",
              borderRadius: 8, fontSize: 12, color: "#F5B731", fontWeight: 600,
            }}>
              ⏳ 검토 중인 신청: {pendingDays}일
            </div>
          )}
          {/* 1년 미만 월차 안내 */}
          {monthlyDays !== null && monthlyDays > 0 && (
            <div style={{
              marginTop: 8, padding: "8px 12px",
              background: "rgba(134,239,172,0.15)",
              borderRadius: 8, fontSize: 12, color: "#86EFAC", fontWeight: 600,
            }}>
              📌 1년 미만 월차 {monthlyDays}일 별도 발생 (관리자 확인 필요)
            </div>
          )}
          {/* 연차 사용 필수 안내 */}
          <div style={{
            marginTop: 10, padding: "10px 12px",
            background: "rgba(255,255,255,0.12)",
            borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.85)",
            fontWeight: 600, lineHeight: 1.5, borderLeft: "3px solid #F5B731",
          }}>
            ⚠️ 연차는 반드시 사용해야 합니다.<br />
            <span style={{ fontWeight: 400, opacity: 0.8 }}>미사용 연차 관련 문의는 관리자에게 연락해주세요.</span>
          </div>
        </div>

        {/* ── 신청 탭 ── */}
        {tab === "apply" && (
          <>
            {/* 휴가 유형 */}
            <div className="leave-form-card">
              <div className="leave-form-header">휴가 유형</div>
              <div className="leave-form-body">
                <div className="leave-type-grid">
                  {LEAVE_TYPES.map(lt => (
                    <button
                      key={lt.value}
                      className={`leave-type-btn ${form.leave_type === lt.value ? "selected" : ""}`}
                      style={form.leave_type === lt.value ? {
                        borderColor: lt.color,
                        background: lt.bg,
                        color: lt.color,
                      } : {}}
                      onClick={() => setForm(prev => ({ ...prev, leave_type: lt.value }))}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 날짜 & 일수 */}
            <div className="leave-form-card">
              <div className="leave-form-header">날짜 선택</div>
              <div className="leave-form-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div className="leave-form-group" style={{ marginBottom: 0 }}>
                    <label className="leave-form-label">시작일 *</label>
                    <input
                      type="date"
                      className="leave-form-input"
                      value={form.start_date}
                      onChange={e => handleDateChange("start_date", e.target.value)}
                    />
                  </div>
                  <div className="leave-form-group" style={{ marginBottom: 0 }}>
                    <label className="leave-form-label">종료일 *</label>
                    <input
                      type="date"
                      className="leave-form-input"
                      value={form.end_date}
                      onChange={e => handleDateChange("end_date", e.target.value)}
                    />
                  </div>
                </div>
                <div className="leave-form-group">
                  <label className="leave-form-label">사용 일수 (자동계산 · 수정 가능)</label>
                  <input
                    type="number"
                    className="leave-form-input"
                    value={form.days}
                    min="0.5"
                    step="0.5"
                    onChange={e => setForm(prev => ({ ...prev, days: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* 신청 사유 */}
            <div className="leave-form-card">
              <div className="leave-form-header">신청 사유 *</div>
              <div className="leave-form-body">
                <textarea
                  className="leave-form-input"
                  style={{ resize: "none", minHeight: 80, lineHeight: 1.6 }}
                  placeholder="신청 사유를 입력해주세요"
                  value={form.reason}
                  onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>

            {/* 제출 버튼 */}
            <div style={{ padding: "0 16px 16px" }}>
              <button
                className="leave-submit-btn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "신청 중..." : "연차 신청하기"}
              </button>
            </div>
          </>
        )}

        {/* ── 이력 탭 ── */}
        {tab === "history" && (
          <div style={{ paddingTop: 16 }}>
            {records.length === 0 ? (
              <div className="leave-empty">
                <div style={{ width: 56, height: 56, background: "#F1F5F9", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </div>
                <div className="leave-empty-title">신청 이력이 없습니다</div>
                <div className="leave-empty-sub">신청하기 탭에서 연차를 신청해보세요</div>
              </div>
            ) : (
              <div className="leave-history-list">
                {records.map(r => {
                  const lt = LEAVE_TYPES.find(t => t.value === r.leave_type) || LEAVE_TYPES[0];
                  const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <div key={r.id} className="leave-record-card">
                      <div className="leave-record-bar" style={{ background: lt.color }} />
                      <div className="leave-record-body">
                        <div className="leave-record-top">
                          <div className="leave-record-badges">
                            <span className="leave-badge" style={{ background: lt.bg, color: lt.color }}>
                              {lt.label}
                            </span>
                            <span className="leave-badge" style={{ background: st.bg, color: st.color }}>
                              {st.label}
                            </span>
                          </div>
                          <div className="leave-record-days">{r.days}일</div>
                        </div>
                        <div className="leave-record-date">
                          {fmtDate(r.start_date)} ~ {fmtDate(r.end_date)}
                        </div>
                        {r.reason && (
                          <div className="leave-record-reason">💬 {r.reason}</div>
                        )}
                        {r.status === "rejected" && r.reject_reason && (
                          <div className="leave-record-reject">
                            반려 사유: {r.reject_reason}
                          </div>
                        )}
                        {/* pending 건만 취소 가능 */}
                        {r.status === "pending" && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            style={{
                              marginTop: 10, padding: "7px 14px",
                              border: "1.5px solid #FECACA", borderRadius: 9,
                              background: "#fff", color: "#DC2626",
                              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            신청 취소
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <CrewNavSpacer />
        <CrewBottomNav />
      </div>
    </>
  );
}
