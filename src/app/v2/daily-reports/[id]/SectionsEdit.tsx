// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 근무인원/결제매출 섹션 (Part 13C)
 *
 * 상세 페이지에서 staff/payment 두 섹션을 한 번에 처리.
 *   - 읽기 모드: 표 형태로 표시
 *   - 편집 모드: new/StaffSection·PaymentSection 컴포넌트 재사용 (전체 교체)
 *
 * 권한: MANAGE만 (PUT /staff·/payment 모두 MANAGE 전용)
 */
"use client";

import { useState } from "react";
import StaffSection from "../new/StaffSection";
import PaymentSection from "../new/PaymentSection";

const STAFF_TYPE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  regular:    { label: "정규",  bg: "#dcfce7", color: "#15803d" },
  peak:       { label: "피크",  bg: "#fef3c7", color: "#b45309" },
  support:    { label: "지원",  bg: "#dbeafe", color: "#1d4ed8" },
  part_time:  { label: "파트",  bg: "#e0e7ff", color: "#4338ca" },
  off_duty:   { label: "휴무",  bg: "#f1f5f9", color: "#475569" },
  additional: { label: "추가",  bg: "#ede9fe", color: "#7c3aed" },
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  card:      { label: "💳 카드",     color: "#1428A0" },
  cash:      { label: "💵 현금",     color: "#15803d" },
  valet_fee: { label: "🚗 발렛비",   color: "#F5B731" },
  monthly:   { label: "📅 월정액",   color: "#7c3aed" },
  transfer:  { label: "🏦 계좌이체", color: "#0891b2" },
  free:      { label: "🆓 무료",     color: "#94a3b8" },
  other:     { label: "📝 기타",     color: "#64748b" },
};

function fmtMoney(n: any): string {
  return Number(n ?? 0).toLocaleString("ko-KR");
}

interface Props {
  report: any;
  employees: any[];
  canEdit: boolean;
  onChanged: () => void;
}

export default function SectionsEdit({ report, employees, canEdit, onChanged }: Props) {
  // ── Staff edit state ──
  const [staffEditing, setStaffEditing] = useState(false);
  const [staffDraft, setStaffDraft] = useState<any[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);

  // ── Payment edit state ──
  const [payEditing, setPayEditing] = useState(false);
  const [payDraft, setPayDraft] = useState<any[]>([]);
  const [paySaving, setPaySaving] = useState(false);

  function startStaffEdit() {
    // 서버 응답 → draft 변환
    setStaffDraft(
      (report.staff || []).map((s: any) => ({
        employee_id: s.employee_id || "",
        staff_type: s.staff_type || "regular",
        role: s.role || "",
        check_in: s.check_in || "",
        check_out: s.check_out || "",
        work_hours: s.work_hours == null ? "" : String(s.work_hours),
        memo: s.memo || "",
      }))
    );
    setStaffEditing(true);
  }

  async function saveStaff() {
    // 검증
    for (const s of staffDraft) {
      if (!s.employee_id || !s.staff_type) {
        alert("근무인원의 직원과 구분을 모두 선택해주세요");
        return;
      }
    }
    setStaffSaving(true);
    try {
      const reason = prompt("수정 사유를 입력해주세요 (감사 로그 기록용)") || "";
      const res = await fetch(`/api/v1/daily-reports/${report.id}/staff`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff: staffDraft.map((s) => ({
            employee_id: s.employee_id,
            staff_type: s.staff_type,
            role: s.role || null,
            check_in: s.check_in || null,
            check_out: s.check_out || null,
            work_hours: s.work_hours === "" || s.work_hours == null ? null : Number(s.work_hours),
            memo: s.memo || null,
          })),
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || "근무인원 저장 실패");
        return;
      }
      setStaffEditing(false);
      onChanged();
    } finally {
      setStaffSaving(false);
    }
  }

  function startPayEdit() {
    setPayDraft(
      (report.payment || []).map((p: any) => ({
        method: p.method || "",
        amount: p.amount == null ? "" : String(p.amount),
        count: p.count == null ? "" : String(p.count),
        memo: p.memo || "",
      }))
    );
    setPayEditing(true);
  }

  async function savePay() {
    for (const p of payDraft) {
      if (!p.method) { alert("결제수단을 모두 선택해주세요"); return; }
      if (p.amount === "" || isNaN(Number(p.amount))) { alert("금액을 모두 입력해주세요"); return; }
      if (Number(p.amount) < 0) { alert("금액은 0 이상이어야 합니다"); return; }
    }
    setPaySaving(true);
    try {
      const reason = prompt("수정 사유를 입력해주세요 (감사 로그 기록용)") || "";
      const res = await fetch(`/api/v1/daily-reports/${report.id}/payment`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment: payDraft.map((p) => ({
            method: p.method,
            amount: Number(p.amount || 0),
            count: Number(p.count || 0),
            memo: p.memo || null,
          })),
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || "결제매출 저장 실패");
        return;
      }
      setPayEditing(false);
      onChanged();
    } finally {
      setPaySaving(false);
    }
  }

  return (
    <>
      {/* 근무인원 */}
      <Section
        title={`👥 근무인원 (${(report.staff || []).length}명)`}
        right={
          canEdit && !staffEditing ? (
            <button onClick={startStaffEdit} style={btnGhost("#1428A0")}>✏️ 수정</button>
          ) : staffEditing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setStaffEditing(false)} style={btnGhost("#64748b")}>취소</button>
              <button onClick={saveStaff} disabled={staffSaving} style={btnPrimary("#1428A0")}>
                {staffSaving ? "저장중..." : "💾 저장"}
              </button>
            </div>
          ) : null
        }
      >
        {staffEditing ? (
          <StaffSection
            staffList={staffDraft}
            employees={employees}
            onChange={setStaffDraft}
          />
        ) : (
          <StaffReadView staff={report.staff || []} />
        )}
      </Section>

      {/* 결제매출 */}
      <Section
        title={`💰 결제매출 (${(report.payment || []).length}건)`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              합계 <strong style={{ color: "#1428A0", fontSize: 16 }}>
                {fmtMoney(report.total_revenue)}
              </strong>원
            </div>
            {canEdit && !payEditing && (
              <button onClick={startPayEdit} style={btnGhost("#1428A0")}>✏️ 수정</button>
            )}
            {payEditing && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPayEditing(false)} style={btnGhost("#64748b")}>취소</button>
                <button onClick={savePay} disabled={paySaving} style={btnPrimary("#1428A0")}>
                  {paySaving ? "저장중..." : "💾 저장"}
                </button>
              </div>
            )}
          </div>
        }
      >
        {payEditing ? (
          <PaymentSection paymentList={payDraft} onChange={setPayDraft} />
        ) : (
          <PaymentReadView payment={report.payment || []} />
        )}
      </Section>
    </>
  );
}

// ── 읽기 뷰: 근무인원 ──
function StaffReadView({ staff }: { staff: any[] }) {
  if (staff.length === 0) {
    return <Empty>등록된 근무인원이 없습니다</Empty>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <Th>직원</Th><Th>구분</Th><Th>출근</Th><Th>퇴근</Th><Th>근무시간</Th><Th>메모</Th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s, idx) => {
            const sty = STAFF_TYPE_LABEL[s.staff_type] || STAFF_TYPE_LABEL.regular;
            const emp = s.employees || {};
            return (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <Td>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{emp.name || "-"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{emp.emp_no || ""}</div>
                </Td>
                <Td>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4,
                    background: sty.bg, color: sty.color,
                    fontSize: 11, fontWeight: 700,
                  }}>{sty.label}</span>
                </Td>
                <Td>{s.check_in || "-"}</Td>
                <Td>{s.check_out || "-"}</Td>
                <Td><strong>{s.work_hours ?? "-"}</strong>{s.work_hours != null && "h"}</Td>
                <Td style={{ color: "#64748b" }}>{s.memo || "-"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 읽기 뷰: 결제매출 ──
function PaymentReadView({ payment }: { payment: any[] }) {
  if (payment.length === 0) {
    return <Empty>등록된 결제내역이 없습니다</Empty>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <Th>결제수단</Th><Th align="right">금액</Th><Th align="right">건수</Th><Th>메모</Th>
          </tr>
        </thead>
        <tbody>
          {payment.map((p, idx) => {
            const opt = PAYMENT_LABEL[p.method] || { label: p.method, color: "#64748b" };
            return (
              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <Td>
                  <span style={{ fontWeight: 700, color: opt.color }}>{opt.label}</span>
                </Td>
                <Td align="right">
                  <strong style={{ fontSize: 14, color: "#0f172a" }}>
                    {fmtMoney(p.amount)}
                  </strong>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>원</span>
                </Td>
                <Td align="right">{p.count ?? 0}</Td>
                <Td style={{ color: "#64748b" }}>{p.memo || "-"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0",
      padding: 20, marginBottom: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, paddingBottom: 12,
        borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Th({ children, align }: any) {
  return (
    <th style={{
      padding: "10px 8px", textAlign: align || "left",
      fontSize: 12, fontWeight: 700, color: "#475569",
      borderBottom: "1px solid #e2e8f0",
    }}>{children}</th>
  );
}
function Td({ children, align, style }: any) {
  return <td style={{ padding: "10px 8px", textAlign: align || "left", ...style }}>{children}</td>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 30, textAlign: "center", color: "#94a3b8",
      background: "#f8fafc", borderRadius: 8, fontSize: 13,
    }}>{children}</div>
  );
}
function btnPrimary(color: string): React.CSSProperties {
  return { height: 36, padding: "0 14px", borderRadius: 8, background: color, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
}
function btnGhost(color: string): React.CSSProperties {
  return { height: 36, padding: "0 14px", borderRadius: 8, background: "#fff", color, border: `1.5px solid ${color}`, fontWeight: 700, fontSize: 13, cursor: "pointer" };
}
