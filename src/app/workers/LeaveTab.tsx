// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { calcAnnualLeaveDays, getYearsWorkedLabel } from "@/lib/utils/leave";

const leaveTypeMap = {
  annual:  { label: "연차",  bg: "#ede9fe", color: "#7c3aed" },
  half:    { label: "반차",  bg: "#fef3c7", color: "#b45309" },
  sick:    { label: "병가",  bg: "#fee2e2", color: "#dc2626" },
  special: { label: "특별",  bg: "#e0f2fe", color: "#0284c7" },
};

const leaveStatusColors = {
  pending:  { label: "대기", bg: "#fff7ed", color: "#ea580c" },
  approved: { label: "승인", bg: "#dcfce7", color: "#15803d" },
  rejected: { label: "반려", bg: "#fee2e2", color: "#dc2626" },
};

// ─ 공통 인라인 스타일 ─
const V3 = {
  card: { background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)", marginBottom: 12, overflow: "hidden" as const },
  sel:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#1a1d2b", background: "#fff", fontFamily: "inherit", appearance: "none" as const },
  label: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 5, display: "block" as const },
  inp:  { width: "100%", padding: "10px 14px", borderRadius: 11, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" },
  btnNav: { padding: "9px 18px", borderRadius: 10, border: "none", background: "#1428A0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "9px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

export default function LeaveTab() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [leaveInfo, setLeaveInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", days: 1, leave_type: "annual", reason: "" });
  const [msg, setMsg] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; days: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { getOrgId().then(oid => { if (oid) setOrgId(oid); }); }, []);
  useEffect(() => { if (orgId) loadWorkers(); }, [orgId]);
  useEffect(() => { if (selectedWorker) { loadLeaveInfo(); loadRecords(); } }, [selectedWorker, year]);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("id, name, hire_date").eq("org_id", orgId).eq("status", "active").order("name");
    if (data) { setWorkers(data); if (data.length > 0) setSelectedWorker(data[0].id); }
  };

  const loadLeaveInfo = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_leaves").select("*").eq("worker_id", selectedWorker).eq("year", year).single();
    if (data) {
      // is_auto_calculated면 hire_date 기반으로 재계산해서 업데이트
      const worker = workers.find(w => w.id === selectedWorker);
      if (data.is_auto_calculated !== false && worker?.hire_date) {
        const autoDays = calcAnnualLeaveDays(worker.hire_date, year);
        if (autoDays > 0 && autoDays !== data.total_days) {
          await supabase.from("worker_leaves")
            .update({ total_days: autoDays, updated_at: new Date().toISOString() })
            .eq("id", data.id);
          data.total_days = autoDays;
        }
      }
      setLeaveInfo(data);
    } else {
      // 신규 생성: hire_date 기반 자동계산
      const worker = workers.find(w => w.id === selectedWorker);
      const autoDays = worker?.hire_date ? calcAnnualLeaveDays(worker.hire_date, year) : 15;
      const totalDays = autoDays > 0 ? autoDays : 15;
      const { data: created } = await supabase.from("worker_leaves").insert({
        org_id: orgId, worker_id: selectedWorker, year,
        total_days: totalDays, used_days: 0, is_auto_calculated: true,
      }).select().single();
      setLeaveInfo(created);
    }
  };

  const loadRecords = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("worker_leave_records").select("*").eq("worker_id", selectedWorker).gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).order("start_date", { ascending: false });
    if (data) setRecords(data);
  };

  const updateTotalDays = async (val) => {
    if (!leaveInfo) return;
    const supabase = createClient();
    await supabase.from("worker_leaves").update({ total_days: Number(val), updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    loadLeaveInfo();
  };

  const addRecord = async () => {
    if (!form.start_date || !form.end_date) { setMsg("날짜를 입력하세요"); return; }
    const supabase = createClient();
    await supabase.from("worker_leave_records").insert({ org_id: orgId,
      worker_id: selectedWorker, start_date: form.start_date, end_date: form.end_date,
      days: Number(form.days) || 1, leave_type: form.leave_type, reason: form.reason || null, status: "approved",
    });
    const newUsed = (leaveInfo?.used_days || 0) + (Number(form.days) || 1);
    await supabase.from("worker_leaves").update({ used_days: newUsed, updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    setShowForm(false);
    setForm({ start_date: "", end_date: "", days: 1, leave_type: "annual", reason: "" });
    setMsg("");
    loadLeaveInfo();
    loadRecords();
  };

  const deleteRecord = async (record) => {
    const supabase = createClient();
    await supabase.from("worker_leave_records").delete().eq("id", record.id);
    const newUsed = Math.max(0, (leaveInfo?.used_days || 0) - (record.days || 0));
    await supabase.from("worker_leaves").update({ used_days: newUsed, updated_at: new Date().toISOString() }).eq("id", leaveInfo.id);
    loadLeaveInfo();
    loadRecords();
  };

  // 크루 신청 승인
  const approveRecord = async (record) => {
    const supabase = createClient();
    await supabase.from("worker_leave_records")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", record.id);
    // used_days 합산
    const newUsed = (leaveInfo?.used_days || 0) + (record.days || 0);
    await supabase.from("worker_leaves")
      .update({ used_days: newUsed, updated_at: new Date().toISOString() })
      .eq("id", leaveInfo.id);
    loadLeaveInfo();
    loadRecords();
  };

  // 크루 신청 반려
  const rejectRecord = async () => {
    if (!rejectModal) return;
    const supabase = createClient();
    await supabase.from("worker_leave_records")
      .update({ status: "rejected", reject_reason: rejectReason || null, updated_at: new Date().toISOString() })
      .eq("id", rejectModal.id);
    setRejectModal(null);
    setRejectReason("");
    loadRecords();
  };

  const total = leaveInfo?.total_days || 15;
  const used = leaveInfo?.used_days || 0;
  const remaining = total - used;
  const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div>
      {/* ── 필터 (v3) ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 2 }}>
          <label style={V3.label}>근무자</label>
          <select value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)} style={V3.sel}>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={V3.label}>연도</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={V3.sel}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
      </div>

      {/* ── 연차 현황 카드 (v3) ── */}
      <div style={V3.card}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f0f2f7" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2b", marginBottom: 4 }}>연차 현황</div>
              {/* 근속연수 + 자동계산 배지 */}
              {(() => {
                const worker = workers.find(w => w.id === selectedWorker);
                if (!worker?.hire_date) return (
                  <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: 5 }}>
                    입사일 미등록
                  </span>
                );
                const label = getYearsWorkedLabel(worker.hire_date);
                const autoDays = calcAnnualLeaveDays(worker.hire_date, year);
                return (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1428A0", background: "#EEF2FF", padding: "2px 8px", borderRadius: 5 }}>
                      근속 {label}
                    </span>
                    {autoDays > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", background: "#DCFCE7", padding: "2px 8px", borderRadius: 5 }}>
                        법정 {autoDays}일 자동적용
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>총 연차</span>
              <input type="number" value={total} onChange={e => updateTotalDays(e.target.value)} min="0" step="0.5"
                style={{ width: 60, padding: "6px 10px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontWeight: 700, textAlign: "center", fontFamily: "Outfit, sans-serif" }} />
              <span style={{ fontSize: 12, color: "#64748b" }}>일</span>
            </div>
          </div>

          {/* 3분할 요약 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { val: total,     lbl: "총 부여", color: "#1428A0", bg: "#e0e8ff" },
              { val: used,      lbl: "사용",   color: "#EA580C", bg: "#fff7ed" },
              { val: remaining, lbl: "잔여",   color: "#16A34A", bg: "#dcfce7" },
            ].map(item => (
              <div key={item.lbl} style={{ textAlign: "center", background: item.bg, borderRadius: 14, padding: "12px 8px" }}>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 26, fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 4 }}>{item.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: item.color, opacity: 0.8 }}>{item.lbl}</div>
              </div>
            ))}
          </div>

          {/* 프로그레스 바 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              <span>사용률</span>
              <span style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, color: "#1a1d2b" }}>{Math.round(usedPercent)}%</span>
            </div>
            <div style={{ height: 10, background: "#f0f2f7", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${usedPercent}%`, height: "100%", borderRadius: 5, transition: "width 0.3s",
                background: remaining > 5 ? "linear-gradient(90deg,#1428A0,#4f6ef7)" : remaining > 0 ? "linear-gradient(90deg,#EA580C,#fb923c)" : "linear-gradient(90deg,#DC2626,#f87171)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 크루 신청 대기 섹션 ── */}
      {(() => {
        const pendingList = records.filter(r => r.requested_by_crew && r.status === "pending");
        if (pendingList.length === 0) return null;
        return (
          <div style={{ ...V3.card, border: "1.5px solid #FED7AA" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #FEF3C7", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EA580C", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#EA580C" }}>
                크루 연차신청 검토 대기 ({pendingList.length}건)
              </span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingList.map(r => {
                const lt = leaveTypeMap[r.leave_type];
                return (
                  <div key={r.id} style={{ background: "#FFF7ED", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: lt?.bg, color: lt?.color, marginRight: 6 }}>{lt?.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1d2b" }}>{r.start_date} ~ {r.end_date}</span>
                        <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>({r.days}일)</span>
                      </div>
                    </div>
                    {r.reason && (
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>💬 {r.reason}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => approveRecord(r)}
                        style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        ✓ 승인
                      </button>
                      <button
                        onClick={() => { setRejectModal({ id: r.id, days: r.days }); setRejectReason(""); }}
                        style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #FCA5A5", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        반려
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 반려 모달 ── */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 400, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1d2b", marginBottom: 16 }}>반려 사유 입력</div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요 (선택)"
              style={{ ...V3.inp, resize: "none", minHeight: 80, marginBottom: 16 } as any}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={rejectRecord} style={{ ...V3.btnNav, flex: 1, background: "#DC2626" }}>반려 처리</button>
              <button onClick={() => setRejectModal(null)} style={{ ...V3.btnGhost, flex: 1 }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 사용 기록 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2b" }}>📋 사용 이력 <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>({records.length}건)</span></div>
        <button onClick={() => setShowForm(true)} style={V3.btnNav}>+ 연차 등록</button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <div style={{ ...V3.card, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>✏️ 연차 등록</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={V3.label}>시작일 *</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={V3.inp} />
            </div>
            <div>
              <label style={V3.label}>종료일 *</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={V3.inp} />
            </div>
            <div>
              <label style={V3.label}>일수</label>
              <input type="number" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} min="0.5" step="0.5" style={V3.inp} />
            </div>
            <div>
              <label style={V3.label}>유형</label>
              <select value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })} style={V3.sel}>
                {Object.entries(leaveTypeMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={V3.label}>사유</label>
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="사유 입력" style={V3.inp} />
          </div>
          {msg && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addRecord} style={V3.btnNav}>등록</button>
            <button onClick={() => { setShowForm(false); setMsg(""); }} style={V3.btnGhost}>취소</button>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>연차 사용 기록이 없습니다</div>
      ) : (
        <>
          {/* PC: 테이블 */}
          <div className="hidden md:block" style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", padding: "0 4px" }}>
              <thead><tr>{["기간", "일수", "유형", "상태", "사유", "관리"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>))}</tr></thead>
              <tbody>{records.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{r.start_date} ~ {r.end_date}</td>
                  <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700 }}>{r.days}일</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: leaveTypeMap[r.leave_type]?.bg, color: leaveTypeMap[r.leave_type]?.color }}>{leaveTypeMap[r.leave_type]?.label}</span></td>
                  <td style={{ padding: "10px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: leaveStatusColors[r.status]?.bg, color: leaveStatusColors[r.status]?.color }}>{leaveStatusColors[r.status]?.label}</span></td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#475569" }}>{r.reason || "-"}</td>
                  <td style={{ padding: "10px 14px" }}><button onClick={() => deleteRecord(r)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>삭제</button></td>
                </tr>))}</tbody>
            </table>
          </div>

          {/* 모바일: 카드 (v3) */}
          <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {records.map(r => {
              const lt = leaveTypeMap[r.leave_type];
              const sc = leaveStatusColors[r.status];
              return (
                <div key={r.id} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden", display: "flex" }}>
                  {/* 왼쪽 컬러 바 */}
                  <div style={{ width: 4, background: lt?.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: "13px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: lt?.bg, color: lt?.color }}>{lt?.label}</span>
                        <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: sc?.bg, color: sc?.color }}>{sc?.label}</span>
                      </div>
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: 900, color: "#1a1d2b" }}>{r.days}일</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: r.reason ? 8 : 10 }}>
                      📅 {r.start_date} ~ {r.end_date}
                    </div>
                    {r.reason && (
                      <div style={{ fontSize: 11, color: "#94a3b8", background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
                        💬 {r.reason}
                      </div>
                    )}
                    <button onClick={() => deleteRecord(r)}
                      style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      🗑 삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


