// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 등록 페이지 (Part 15B)
 *
 * 경로: /v2/monthly/new
 *
 * 폼 필드:
 *   ① 사업장 (필수)
 *   ② 입주사 (선택, 선택 시 monthly_fee_default 자동 채움)
 *   ③ 차량번호 (필수, 공백·하이픈 자동 제거)
 *   ④ 차종 (선택)
 *   ⑤ 고객명 (필수)
 *   ⑥ 연락처 (필수, 평문 저장 — 월주차 알림톡 정책 예외)
 *   ⑦ 시작일 (필수, 기본: 오늘)
 *   ⑧ 종료일 (필수, 기본: 시작일 + 1개월)
 *   ⑨ 월요금 (필수)
 *   ⑩ 결제상태 (paid/unpaid/overdue, 기본 unpaid)
 *   ⑪ 메모 (선택)
 *
 * POST /api/v1/monthly
 * 성공 → /v2/monthly/[id] (Part 15C에서 활성화)
 * 중복 차량번호(409) → 친절한 에러 안내
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── 오늘 (YYYY-MM-DD) ──
function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── 시작일 + 1개월 (말일 보정) ──
function addOneMonth(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  // 다음달 같은 날, 말일 보정
  const targetMonth = m + 1;
  const targetYear = y + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(day, lastDay);
  // 1일 빼기 (시작일이 1일이면 종료일은 말일)
  const result = new Date(targetYear, normalizedMonth, finalDay);
  result.setDate(result.getDate() - 1);
  const ry = result.getFullYear();
  const rm = String(result.getMonth() + 1).padStart(2, "0");
  const rd = String(result.getDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "미결제 (기본)" },
  { value: "paid", label: "결제완료" },
  { value: "overdue", label: "연체" },
];

export default function NewMonthlyPage() {
  const router = useRouter();

  // ── 입력 ──
  const [storeId, setStoreId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(getToday());
  const [endDate, setEndDate] = useState<string>(addOneMonth(getToday()));
  const [monthlyFee, setMonthlyFee] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("unpaid");
  const [note, setNote] = useState<string>("");
  const [endDateManuallyChanged, setEndDateManuallyChanged] = useState(false);

  // ── 외부 데이터 ──
  const [stores, setStores] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  // ── 상태 ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사업장 + 입주사 로드
  useEffect(() => {
    (async () => {
      try {
        const [sr, tr] = await Promise.all([
          fetch("/api/v1/stores?limit=200", { credentials: "include" }),
          fetch("/api/v1/tenants?status=active&sort=name&limit=200", {
            credentials: "include",
          }),
        ]);
        if (sr.ok) {
          const sj = await sr.json();
          const list = sj?.data || [];
          setStores(list);
          // 사업장 1개뿐이면 자동 선택
          if (list.length === 1) setStoreId(list[0].id);
        }
        if (tr.ok) {
          const tj = await tr.json();
          setTenants(tj?.data || []);
        }
      } catch {}
    })();
  }, []);

  // 시작일 변경 시 종료일 자동 (수동 변경 안 한 경우만)
  useEffect(() => {
    if (!endDateManuallyChanged && startDate) {
      setEndDate(addOneMonth(startDate));
    }
  }, [startDate, endDateManuallyChanged]);

  // 입주사 선택 시 default fee 자동 채움 (사용자가 아직 입력 안 한 경우만)
  const onTenantChange = (id: string) => {
    setTenantId(id);
    if (!id) return;
    const t = tenants.find((x) => x.id === id);
    if (t && t.monthly_fee_default && !monthlyFee) {
      setMonthlyFee(String(t.monthly_fee_default));
    }
    // 입주사의 default_store_id가 있고 사업장 미선택이면 자동 선택
    if (t?.default_store_id && !storeId) {
      setStoreId(t.default_store_id);
    }
  };

  // 차량번호 자동 정규화 (공백/하이픈 제거 — 표시 단계는 그대로, 제출 시 정규화)
  const normalizedVehicle = vehicleNumber.replace(/[\s-]/g, "");

  // 검증
  const validate = (): string | null => {
    if (!storeId) return "사업장을 선택해주세요";
    if (normalizedVehicle.length < 4) return "차량번호를 4자 이상 입력해주세요";
    if (!customerName.trim()) return "고객명을 입력해주세요";
    if (!customerPhone.trim()) return "연락처를 입력해주세요";
    if (!startDate) return "시작일을 입력해주세요";
    if (!endDate) return "종료일을 입력해주세요";
    if (endDate < startDate) return "종료일은 시작일 이후여야 합니다";
    const fee = Number(monthlyFee);
    if (!Number.isFinite(fee) || fee < 0) return "월요금은 0 이상 숫자여야 합니다";
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body: any = {
        store_id: storeId,
        vehicle_number: normalizedVehicle,
        vehicle_type: vehicleType.trim() || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        start_date: startDate,
        end_date: endDate,
        monthly_fee: Number(monthlyFee),
        payment_status: paymentStatus,
        contract_status: "active",
        note: note.trim() || null,
      };
      if (tenantId) body.tenant_id = tenantId;

      const res = await fetch("/api/v1/monthly", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || json?.success === false) {
        // 중복 차량번호
        if (res.status === 409) {
          setError(
            json?.error?.message ||
              `이미 등록된 활성 월주차 차량번호입니다: ${normalizedVehicle}`
          );
        } else {
          setError(json?.error?.message || `등록 실패 (${res.status})`);
        }
        return;
      }

      const newId = json?.data?.id;
      alert("월주차가 등록되었습니다");
      if (newId) {
        router.push(`/v2/monthly/${newId}`);
      } else {
        router.push("/v2/monthly");
      }
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 900, margin: "0 auto", paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
          <Link href="/v2/monthly" style={{ color: "#1428A0", textDecoration: "none" }}>
            월주차 관리
          </Link>{" "}
          / 신규 등록
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1428A0", margin: 0 }}>
          월주차 신규 등록
        </h1>
      </div>

      {/* 에러 */}
      {error && (
        <div
          style={{
            padding: 14,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* 폼 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 24,
          display: "grid",
          gap: 18,
        }}
      >
        {/* 1행: 사업장 + 입주사 */}
        <Row>
          <Field label="사업장" required>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              <option value="">선택해주세요</option>
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.site_code ? `[${s.site_code}] ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="입주사 (선택)" hint="선택 시 월요금·기본사업장 자동입력">
            <select
              value={tenantId}
              onChange={(e) => onTenantChange(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              <option value="">없음 (개별 고객)</option>
              {tenants.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.monthly_fee_default
                    ? ` (₩${Number(t.monthly_fee_default).toLocaleString()})`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        {/* 2행: 차량번호 + 차종 */}
        <Row>
          <Field label="차량번호" required hint="공백·하이픈 자동제거">
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="예: 12가 3456"
              style={{
                ...inputStyle,
                fontFamily:
                  "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: 16,
                fontWeight: 700,
              }}
              disabled={loading}
            />
            {vehicleNumber && normalizedVehicle !== vehicleNumber && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                저장 시: <code style={{ color: "#1428A0", fontWeight: 700 }}>{normalizedVehicle}</code>
              </div>
            )}
          </Field>
          <Field label="차종 (선택)">
            <input
              type="text"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="예: 그랜저 / SUV"
              style={inputStyle}
              disabled={loading}
            />
          </Field>
        </Row>

        {/* 3행: 고객명 + 연락처 */}
        <Row>
          <Field label="고객명" required>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="예: 홍길동"
              style={inputStyle}
              disabled={loading}
            />
          </Field>
          <Field label="연락처" required hint="원본 저장 (월주차 알림톡용)">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-1234-5678"
              style={{
                ...inputStyle,
                fontFamily:
                  "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
              }}
              disabled={loading}
            />
          </Field>
        </Row>

        {/* 4행: 시작일 + 종료일 */}
        <Row>
          <Field label="시작일" required>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setEndDateManuallyChanged(false);
              }}
              style={inputStyle}
              disabled={loading}
            />
          </Field>
          <Field
            label="종료일"
            required
            hint={endDateManuallyChanged ? "수동 입력" : "자동 계산 (+1개월 -1일)"}
          >
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setEndDateManuallyChanged(true);
              }}
              style={inputStyle}
              disabled={loading}
            />
          </Field>
        </Row>

        {/* 5행: 월요금 + 결제상태 */}
        <Row>
          <Field label="월요금 (원)" required>
            <input
              type="number"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="예: 200000"
              step={1000}
              min={0}
              style={{
                ...inputStyle,
                textAlign: "right",
                fontFamily:
                  "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: 16,
                fontWeight: 700,
              }}
              disabled={loading}
            />
            {monthlyFee && Number(monthlyFee) > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "#1428A0",
                  marginTop: 4,
                  textAlign: "right",
                  fontWeight: 700,
                }}
              >
                ₩{Number(monthlyFee).toLocaleString("ko-KR")}
              </div>
            )}
          </Field>
          <Field label="결제상태">
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        {/* 메모 */}
        <Field label="메모 (선택)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="특이사항 / 동승차량 / 자리 지정 등"
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "inherit",
              minHeight: 70,
            }}
            disabled={loading}
          />
        </Field>
      </div>

      {/* 액션 sticky 바 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
          zIndex: 10,
        }}
      >
        <Link
          href="/v2/monthly"
          style={{
            padding: "12px 24px",
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          취소
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          style={{
            padding: "12px 32px",
            background: loading ? "#94a3b8" : "#1428A0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            minWidth: 160,
          }}
        >
          {loading ? "등록 중..." : "✓ 등록하기"}
        </button>
      </div>
    </div>
  );
}

// ── 공통 컴포넌트 ──
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {children}
    </div>
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
          marginBottom: 6,
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
