// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 근태 직접수정 모달 (Part 12B)
 *
 * 셀 클릭 시 열림.
 *   - 기존 row 없음 → POST (신규 오버라이드)
 *   - 기존 row 있음 (일보 or 오버라이드) → PUT (upsert)
 *   - is_override=true 인 경우만 "복구(삭제)" 버튼 활성
 *
 * API:
 *   POST   /api/v1/attendance/:empId/:date
 *   PUT    /api/v1/attendance/:empId/:date
 *   DELETE /api/v1/attendance/:empId/:date
 */
"use client";

import { useState, useEffect } from "react";

const STATUS_OPTIONS: Array<{ value: string; label: string; bg: string; color: string }> = [
  { value: "present",    label: "출근",   bg: "#dcfce7", color: "#15803d" },
  { value: "late",       label: "지각",   bg: "#fff7ed", color: "#ea580c" },
  { value: "peak",       label: "피크",   bg: "#fef3c7", color: "#b45309" },
  { value: "support",    label: "지원",   bg: "#dbeafe", color: "#1d4ed8" },
  { value: "additional", label: "추가",   bg: "#e0e7ff", color: "#4338ca" },
  { value: "leave",      label: "연차",   bg: "#ede9fe", color: "#7c3aed" },
  { value: "off",        label: "휴무",   bg: "#f1f5f9", color: "#475569" },
  { value: "absent",     label: "결근",   bg: "#fee2e2", color: "#dc2626" },
];

// HH:MM:SS → HH:MM (input[type=time] 표시용)
function toHHMM(t: string | null | undefined): string {
  if (!t) return "";
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? `${m[1]}:${m[2]}` : "";
}

export default function OverrideModal({
  open,
  empId,
  empName,
  date,
  currentRow,      // null | AttendanceRow (일보 또는 오버라이드 병합 결과)
  stores = [],
  onClose,
  onSaved,         // 저장/삭제 성공 후 매트릭스 재조회 트리거
}: {
  open: boolean;
  empId: string | null;
  empName?: string;
  date: string | null;
  currentRow: any | null;
  stores?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<string>("present");
  const [storeId, setStoreId] = useState<string>("");
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [workHours, setWorkHours] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverride = !!currentRow?.is_override;
  const hasBase = !!currentRow;  // 기존 row 존재 (일보 or override)

  // ── 모달 열릴 때 초기값 세팅 ──
  useEffect(() => {
    if (!open) return;
    if (currentRow) {
      setStatus(currentRow.status || "present");
      setStoreId(currentRow.store_id || "");
      setCheckIn(toHHMM(currentRow.check_in));
      setCheckOut(toHHMM(currentRow.check_out));
      setWorkHours(
        currentRow.work_hours !== null && currentRow.work_hours !== undefined
          ? String(currentRow.work_hours) : ""
      );
      setReason(currentRow.reason || "");
      setMemo(currentRow.memo || "");
    } else {
      setStatus("present");
      setStoreId("");
      setCheckIn("");
      setCheckOut("");
      setWorkHours("");
      setReason("");
      setMemo("");
    }
    setError(null);
  }, [open, currentRow]);

  if (!open || !empId || !date) return null;

  // ── 저장 (POST or PUT) ──
  async function handleSave() {
    if (!reason.trim()) {
      setError("수정 사유는 필수입니다");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        status,
        store_id: storeId || null,
        check_in: checkIn || null,
        check_out: checkOut || null,
        work_hours: workHours !== "" ? Number(workHours) : null,
        reason: reason.trim(),
        memo: memo.trim() || null,
      };
      // PUT (upsert) — 기존 있음이든 없음이든 PUT이면 idempotent
      const res = await fetch(`/api/v1/attendance/${empId}/${date}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `저장 실패 (${res.status})`);
        return;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  // ── 오버라이드 삭제 (원본 복구) ──
  async function handleDelete() {
    if (!isOverride) return;
    if (!confirm(`${date} ${empName || ""} 의 수정값을 삭제하고 원본(일보)로 되돌립니다.`)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/attendance/${empId}/${date}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `삭제 실패 (${res.status})`);
        return;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, background: "#fff", borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
          maxHeight: "92vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
          background: "#1428A0", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>근태 수정</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {empName || empId} · {date}
              {isOverride && (
                <span style={{
                  marginLeft: 8, background: "#F5B731", color: "#1428A0",
                  fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                }}>
                  수정됨
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "#fff",
            fontSize: 20, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* 본문 */}
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {/* 상태 선택 */}
          <Label>상태 *</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
            {STATUS_OPTIONS.map((s) => {
              const active = status === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  style={{
                    padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: active ? s.bg : "#fff",
                    color: active ? s.color : "#475569",
                    border: active ? `2px solid ${s.color}` : "1px solid #e2e8f0",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* 사업장 */}
          <Label>사업장</Label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14 }}
          >
            <option value="">— 미지정 —</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* 출퇴근 시간 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <Label>출근 시간</Label>
              <input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <Label>퇴근 시간</Label>
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* 근무시간 */}
          <Label>근무시간 (시간)</Label>
          <input
            type="number"
            min={0} max={24} step={0.5}
            value={workHours}
            onChange={(e) => setWorkHours(e.target.value)}
            placeholder="예: 8.5"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {/* 사유 */}
          <Label>수정 사유 * (필수)</Label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 신고 누락, 현장 확인 후 수정"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {/* 메모 */}
          <Label>메모</Label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="내부 메모 (선택)"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 4 }}
          />

          {/* 에러 */}
          {error && (
            <div style={{
              marginTop: 10, padding: 10, borderRadius: 8,
              background: "#fef2f2", color: "#b91c1c",
              border: "1px solid #fecaca", fontSize: 12, fontWeight: 600,
            }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "12px 18px", borderTop: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex", gap: 8, justifyContent: "space-between",
        }}>
          <div>
            {isOverride && (
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  ...btnStyle, background: "#fff",
                  color: "#dc2626", border: "1px solid #fecaca",
                }}
              >
                🔄 원본 복구
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ ...btnStyle, background: "#fff", color: "#475569", border: "1px solid #cbd5e1" }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...btnStyle,
                background: saving ? "#94a3b8" : "#1428A0", color: "#fff", border: "none",
              }}
            >
              {saving ? "저장 중..." : (hasBase ? "수정 저장" : "신규 저장")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 스타일 ──
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
      {children}
    </div>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 10px",
  borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, color: "#0f172a",
  background: "#fff", boxSizing: "border-box",
};
const btnStyle: React.CSSProperties = {
  height: 38, padding: "0 16px", borderRadius: 8,
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};
