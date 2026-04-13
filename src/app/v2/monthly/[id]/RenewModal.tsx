// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 갱신 모달 (Part 15C)
 *
 * - 기존 계약 정보 표시 (읽기)
 * - 신규 시작일 (기본: 기존 end_date + 1일)
 * - 신규 종료일 (기본: start_date + 1개월 -1일)
 * - 신규 월요금 (기본: 기존)
 * - 신규 결제상태 (기본: unpaid)
 * - 메모 (기본: 기존)
 *
 * POST /api/v1/monthly/:id/renew
 * 응답: { renewed: true, previous, current }
 * 성공 → onRenewed(current.id) 호출 → 부모가 신규 페이지로 이동
 */
"use client";

import { useState, useEffect } from "react";

function fmtDate(s: string): string {
  if (!s) return "-";
  return s.replace(/-/g, ".");
}

function addDays(dateStr: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 시작일 + 1개월 -1일 (한국 관행: 4.13 ~ 5.12)
function endFromStart(startStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) return "";
  const d = new Date(startStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const targetMonth = m + 1;
  const targetYear = y + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(day, lastDay);
  const result = new Date(targetYear, normalizedMonth, finalDay);
  result.setDate(result.getDate() - 1);
  const ry = result.getFullYear();
  const rm = String(result.getMonth() + 1).padStart(2, "0");
  const rd = String(result.getDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

export default function RenewModal({
  monthly,
  onClose,
  onRenewed,
}: {
  monthly: any;
  onClose: () => void;
  onRenewed: (newId: string) => void;
}) {
  // 기본값
  const defaultStart = addDays(monthly.end_date, 1);
  const defaultEnd = endFromStart(defaultStart);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [endDateManuallyChanged, setEndDateManuallyChanged] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(String(monthly.monthly_fee || ""));
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [note, setNote] = useState(monthly.note || "");
  const [feeChanged, setFeeChanged] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 시작일 변경 → 종료일 자동 (수동 미변경 시)
  useEffect(() => {
    if (!endDateManuallyChanged && startDate) {
      setEndDate(endFromStart(startDate));
    }
  }, [startDate, endDateManuallyChanged]);

  // 월요금 변경 추적 (변경 알림 표시용)
  useEffect(() => {
    setFeeChanged(Number(monthlyFee) !== Number(monthly.monthly_fee));
  }, [monthlyFee, monthly.monthly_fee]);

  const onSubmit = async () => {
    if (endDate < startDate) {
      setError("종료일은 시작일 이후여야 합니다");
      return;
    }
    const fee = Number(monthlyFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError("월요금은 0 이상 숫자여야 합니다");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/monthly/${monthly.id}/renew`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          monthly_fee: fee,
          payment_status: paymentStatus,
          note: note?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `갱신 실패 (${res.status})`);
        return;
      }
      const newId = json?.data?.current?.id;
      if (newId) {
        onRenewed(newId);
      } else {
        setError("갱신은 성공했으나 신규 ID를 받지 못했습니다");
      }
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #e2e8f0",
            background: "#1428A0",
            color: "#fff",
            borderRadius: "14px 14px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>🔄 월주차 갱신</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 3 }}>
              기존 계약은 'expired' 처리되고 신규 계약이 생성됩니다
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 24,
              cursor: "pointer",
              padding: 4,
              opacity: 0.8,
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: 22 }}>
          {/* 기존 계약 요약 */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 14,
              marginBottom: 18,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700, color: "#475569", marginBottom: 8 }}>
              기존 계약
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <span style={{ color: "#94a3b8" }}>차량 </span>
                <strong
                  style={{
                    color: "#1428A0",
                    fontFamily: "Outfit, monospace",
                    fontWeight: 800,
                  }}
                >
                  {monthly.vehicle_number}
                </strong>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>고객 </span>
                <strong>{monthly.customer_name}</strong>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>기간 </span>
                {fmtDate(monthly.start_date)} ~ {fmtDate(monthly.end_date)}
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>월요금 </span>
                <strong>₩{Number(monthly.monthly_fee).toLocaleString("ko-KR")}</strong>
              </div>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div
              style={{
                padding: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                color: "#dc2626",
                marginBottom: 12,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* 신규 계약 입력 */}
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1428A0" }}>
              📝 신규 계약 정보
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="신규 시작일">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDateManuallyChanged(false);
                  }}
                  style={inputStyle}
                  disabled={saving}
                />
              </Field>
              <Field
                label="신규 종료일"
                hint={endDateManuallyChanged ? "수동" : "자동 +1개월"}
              >
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setEndDateManuallyChanged(true);
                  }}
                  style={inputStyle}
                  disabled={saving}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="월요금 (원)" hint={feeChanged ? "변경됨" : "기존 동일"}>
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  step={1000}
                  min={0}
                  style={{
                    ...inputStyle,
                    textAlign: "right",
                    fontFamily: "Outfit, monospace",
                    fontWeight: 700,
                    borderColor: feeChanged ? "#F5B731" : "#cbd5e1",
                  }}
                  disabled={saving}
                />
              </Field>
              <Field label="결제상태">
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  style={inputStyle}
                  disabled={saving}
                >
                  <option value="unpaid">미결제</option>
                  <option value="paid">결제완료</option>
                  <option value="overdue">연체</option>
                </select>
              </Field>
            </div>

            <Field label="메모 (선택)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        {/* 액션 바 */}
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            background: "#fafbfc",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px",
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            style={{
              padding: "10px 22px",
              background: saving ? "#94a3b8" : "#F5B731",
              color: "#1428A0",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              minWidth: 120,
            }}
          >
            {saving ? "갱신 중..." : "🔄 갱신하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#475569",
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8" }}>{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}
