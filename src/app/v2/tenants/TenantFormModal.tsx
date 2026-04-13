// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 입주사 등록/수정 공용 모달 (Part 16A)
 *
 * Props:
 *   - tenant?: 기존 데이터 있으면 수정 모드, 없으면 신규 등록 모드
 *   - stores: 사업장 목록 (default_store_id 드롭다운용)
 *   - onClose: 닫기
 *   - onSaved: 저장 성공 시 (parent에서 reload)
 *
 * 신규: POST /api/v1/tenants
 * 수정: PATCH /api/v1/tenants/:id
 *
 * 필드:
 *   - name (필수)
 *   - business_no (선택, 사업자번호)
 *   - contact_name (선택, 담당자명)
 *   - contact_phone (선택, 담당자 연락처 — 평문 저장 OK)
 *   - default_store_id (선택, 기본 사업장)
 *   - monthly_fee_default (선택, 기본 월요금)
 *   - status (수정 시만, active|inactive)
 *   - memo (선택)
 */
"use client";

import { useState } from "react";

export default function TenantFormModal({
  tenant,
  stores,
  onClose,
  onSaved,
}: {
  tenant?: any;
  stores: any[];
  onClose: () => void;
  onSaved: (saved: any) => void;
}) {
  const isEdit = !!tenant?.id;

  const [name, setName] = useState(tenant?.name || "");
  const [businessNo, setBusinessNo] = useState(tenant?.business_no || "");
  const [contactName, setContactName] = useState(tenant?.contact_name || "");
  const [contactPhone, setContactPhone] = useState(tenant?.contact_phone || "");
  const [defaultStoreId, setDefaultStoreId] = useState(tenant?.default_store_id || "");
  const [monthlyFeeDefault, setMonthlyFeeDefault] = useState(
    tenant?.monthly_fee_default ? String(tenant.monthly_fee_default) : ""
  );
  const [status, setStatus] = useState(tenant?.status || "active");
  const [memo, setMemo] = useState(tenant?.memo || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError("입주사명을 입력해주세요");
      return;
    }
    if (monthlyFeeDefault) {
      const n = Number(monthlyFeeDefault);
      if (!Number.isFinite(n) || n < 0) {
        setError("기본 월요금은 0 이상 숫자여야 합니다");
        return;
      }
    }
    setError(null);
    setSaving(true);

    try {
      const body: any = {
        name: name.trim(),
        business_no: businessNo.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        default_store_id: defaultStoreId || null,
        monthly_fee_default: monthlyFeeDefault ? Number(monthlyFeeDefault) : null,
        memo: memo.trim() || null,
      };
      if (isEdit) body.status = status;

      const url = isEdit ? `/api/v1/tenants/${tenant.id}` : "/api/v1/tenants";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        if (res.status === 409) {
          setError(json?.error?.message || "이미 같은 이름의 활성 입주사가 있습니다");
        } else {
          setError(json?.error?.message || `${isEdit ? "수정" : "등록"} 실패 (${res.status})`);
        }
        return;
      }
      onSaved(json.data);
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
          maxWidth: 620,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "16px 22px",
            background: "#1428A0",
            color: "#fff",
            borderRadius: "14px 14px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800 }}>
            🏢 {isEdit ? "입주사 수정" : "입주사 신규 등록"}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
              padding: 4,
              opacity: 0.8,
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          {/* 에러 */}
          {error && (
            <div
              style={{
                padding: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                color: "#dc2626",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <Field label="입주사명" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 메디플렉스"
              style={inputStyle}
              disabled={saving}
              autoFocus={!isEdit}
            />
          </Field>

          <Row>
            <Field label="사업자등록번호 (선택)">
              <input
                type="text"
                value={businessNo}
                onChange={(e) => setBusinessNo(e.target.value)}
                placeholder="예: 123-45-67890"
                style={{
                  ...inputStyle,
                  fontFamily: "Outfit, monospace",
                }}
                disabled={saving}
              />
            </Field>
            <Field label="기본 월요금 (선택)" hint="월주차 등록 시 자동입력">
              <input
                type="number"
                value={monthlyFeeDefault}
                onChange={(e) => setMonthlyFeeDefault(e.target.value)}
                placeholder="예: 200000"
                step={1000}
                min={0}
                style={{
                  ...inputStyle,
                  textAlign: "right",
                  fontFamily: "Outfit, monospace",
                  fontWeight: 700,
                }}
                disabled={saving}
              />
            </Field>
          </Row>

          <Row>
            <Field label="담당자명 (선택)">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="예: 홍길동"
                style={inputStyle}
                disabled={saving}
              />
            </Field>
            <Field label="담당자 연락처 (선택)">
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="010-1234-5678"
                style={{
                  ...inputStyle,
                  fontFamily: "Outfit, monospace",
                }}
                disabled={saving}
              />
            </Field>
          </Row>

          <Field label="기본 사업장 (선택)" hint="월주차 등록 시 자동선택">
            <select
              value={defaultStoreId}
              onChange={(e) => setDefaultStoreId(e.target.value)}
              style={inputStyle}
              disabled={saving}
            >
              <option value="">없음</option>
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.site_code ? `[${s.site_code}] ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          {isEdit && (
            <Field label="상태">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={inputStyle}
                disabled={saving}
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </Field>
          )}

          <Field label="메모 (선택)">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", minHeight: 70 }}
              placeholder="계약 조건·특이사항 등"
              disabled={saving}
            />
          </Field>
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
              background: saving ? "#94a3b8" : "#1428A0",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              minWidth: 120,
            }}
          >
            {saving ? "저장 중..." : isEdit ? "✓ 수정 저장" : "✓ 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#475569",
          marginBottom: 5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>
          {label}
          {required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
        </span>
        {hint && (
          <span style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8" }}>{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}
