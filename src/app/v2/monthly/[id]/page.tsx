// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 상세 페이지 (Part 15C)
 *
 * 경로: /v2/monthly/[id]
 *
 * 기능:
 *   - 상세 조회 (GET /api/v1/monthly/:id) — store + tenant + renewed_from 동봉
 *   - 인라인 수정 (PATCH) — 화이트리스트 11필드
 *   - 갱신 (POST /:id/renew) — 모달 → 새 row 생성 후 신규로 이동
 *   - 취소 (DELETE soft) — confirm + 사유 prompt
 *   - 갱신 이력 표시 (renewed_from 카드)
 *
 * 권한:
 *   - MANAGE: 모든 액션 가능
 *   - crew/field: 배정 store만 (서버에서 강제, UI는 동일 표시)
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RenewModal from "./RenewModal";

const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "미결제" },
  { value: "paid", label: "결제완료" },
  { value: "overdue", label: "연체" },
];

const CONTRACT_STATUS_OPTIONS = [
  { value: "active", label: "활성" },
  { value: "expired", label: "만료" },
  { value: "cancelled", label: "취소" },
];

const CONTRACT_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#dcfce7", fg: "#166534", label: "활성" },
  expired: { bg: "#f1f5f9", fg: "#475569", label: "만료" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "취소" },
};

const PAYMENT_BADGE: Record<string, { bg: string; fg: string; label: string; emoji: string }> = {
  paid: { bg: "#dbeafe", fg: "#1e40af", label: "결제완료", emoji: "✓" },
  unpaid: { bg: "#fef3c7", fg: "#92400e", label: "미결제", emoji: "💰" },
  overdue: { bg: "#fee2e2", fg: "#991b1b", label: "연체", emoji: "⚠" },
};

function fmtDate(s: string): string {
  if (!s) return "-";
  return s.replace(/-/g, ".");
}

function daysUntil(endDate: string): number {
  if (!endDate) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + "T00:00:00");
  return Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryLabel(days: number): { text: string; color: string } {
  if (days < 0) return { text: `D+${-days} (만료됨)`, color: "#94a3b8" };
  if (days === 0) return { text: "오늘 만료", color: "#dc2626" };
  if (days <= 7) return { text: `D-${days}`, color: "#dc2626" };
  if (days <= 30) return { text: `D-${days}`, color: "#92400e" };
  return { text: `D-${days}`, color: "#64748b" };
}

function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString("ko-KR");
}

export default function MonthlyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  // 편집 폼 상태
  const [form, setForm] = useState<any>({});

  // ── 데이터 로드 ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/monthly/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setData(null);
        return;
      }
      setData(json.data);
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 사업장 + 입주사 (드롭다운용, 최초 1회)
  useEffect(() => {
    (async () => {
      try {
        const [sr, tr] = await Promise.all([
          fetch("/api/v1/stores?limit=200", { credentials: "include" }),
          fetch("/api/v1/tenants?status=active&sort=name&limit=200", {
            credentials: "include",
          }),
        ]);
        if (sr.ok) setStores((await sr.json())?.data || []);
        if (tr.ok) setTenants((await tr.json())?.data || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 편집 시작 시 데이터 → form 복사
  const startEdit = () => {
    if (!data) return;
    setForm({
      vehicle_number: data.vehicle_number || "",
      vehicle_type: data.vehicle_type || "",
      customer_name: data.customer_name || "",
      customer_phone: data.customer_phone || "",
      start_date: data.start_date || "",
      end_date: data.end_date || "",
      monthly_fee: String(data.monthly_fee || ""),
      payment_status: data.payment_status || "unpaid",
      contract_status: data.contract_status || "active",
      tenant_id: data.tenant_id || "",
      note: data.note || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

  const saveEdit = async () => {
    if (!data) return;
    // 검증
    const vn = String(form.vehicle_number || "").replace(/[\s-]/g, "");
    if (vn.length < 4) return setError("차량번호를 4자 이상 입력해주세요");
    if (!form.customer_name?.trim()) return setError("고객명을 입력해주세요");
    if (!form.customer_phone?.trim()) return setError("연락처를 입력해주세요");
    if (form.end_date < form.start_date) return setError("종료일은 시작일 이후여야 합니다");
    const fee = Number(form.monthly_fee);
    if (!Number.isFinite(fee) || fee < 0) return setError("월요금은 0 이상 숫자여야 합니다");

    setError(null);
    setSaving(true);
    try {
      const body: any = {
        vehicle_number: vn,
        vehicle_type: form.vehicle_type?.trim() || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_fee: fee,
        payment_status: form.payment_status,
        contract_status: form.contract_status,
        note: form.note?.trim() || null,
        tenant_id: form.tenant_id || null,
      };
      const res = await fetch(`/api/v1/monthly/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `수정 실패 (${res.status})`);
        return;
      }
      setEditing(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async () => {
    if (!data) return;
    if (data.contract_status === "cancelled") {
      alert("이미 취소된 계약입니다");
      return;
    }
    if (
      !confirm(
        `[월주차 취소]\n\n차량: ${data.vehicle_number} / ${data.customer_name}\n사업장: ${data.stores?.name}\n\n정말 취소하시겠습니까? (계약상태가 'cancelled'로 변경됩니다)`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/monthly/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `취소 실패 (${res.status})`);
        return;
      }
      alert("월주차 계약이 취소되었습니다");
      await load();
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const onRenewed = (newId: string) => {
    setRenewOpen(false);
    alert("갱신이 완료되었습니다. 신규 계약으로 이동합니다.");
    router.push(`/v2/monthly/${newId}`);
  };

  // ── 렌더 ──
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            padding: 24,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ⚠ {error}
        </div>
        <Link
          href="/v2/monthly"
          style={{
            display: "inline-block",
            marginTop: 16,
            color: "#1428A0",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← 목록으로
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const days = daysUntil(data.end_date);
  const exp = expiryLabel(days);
  const cb = CONTRACT_BADGE[data.contract_status] || CONTRACT_BADGE.active;
  const pb = PAYMENT_BADGE[data.payment_status] || PAYMENT_BADGE.unpaid;
  const isCancelled = data.contract_status === "cancelled";

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto", paddingBottom: 80 }}>
      {/* 브레드크럼 */}
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        <Link href="/v2/monthly" style={{ color: "#1428A0", textDecoration: "none" }}>
          월주차 관리
        </Link>{" "}
        / 상세
      </div>

      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#1428A0",
              fontFamily: "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
              letterSpacing: "0.02em",
              lineHeight: 1.1,
            }}
          >
            {data.vehicle_number}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={badgeStyle(cb.bg, cb.fg)}>{cb.label}</span>
            <span style={badgeStyle(pb.bg, pb.fg)}>
              {pb.emoji} {pb.label}
            </span>
            <span style={{ color: exp.color, fontWeight: 700, fontSize: 13 }}>{exp.text}</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        {!editing && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={startEdit} disabled={saving} style={btnSecondary}>
              ✎ 수정
            </button>
            {!isCancelled && (
              <>
                <button
                  onClick={() => setRenewOpen(true)}
                  disabled={saving}
                  style={btnGold}
                >
                  🔄 갱신
                </button>
                <button onClick={onCancel} disabled={saving} style={btnDanger}>
                  ✕ 계약취소
                </button>
              </>
            )}
          </div>
        )}
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

      {/* 본문 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 24,
        }}
      >
        {/* 섹션 헤더 */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#1428A0",
            marginBottom: 16,
            paddingBottom: 10,
            borderBottom: "2px solid #1428A0",
          }}
        >
          📋 계약 정보
        </div>

        {!editing ? (
          // ── 읽기 모드 ──
          <div style={{ display: "grid", gap: 14 }}>
            <Row>
              <ReadField label="사업장">{data.stores?.name || "-"}</ReadField>
              <ReadField label="입주사">
                {data.tenants?.name ? (
                  <span>
                    🏢 <strong style={{ color: "#1428A0" }}>{data.tenants.name}</strong>
                    {data.tenants.contact_name && (
                      <span style={{ color: "#94a3b8", marginLeft: 6 }}>
                        ({data.tenants.contact_name})
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>없음 (개별 고객)</span>
                )}
              </ReadField>
            </Row>
            <Row>
              <ReadField label="차종">{data.vehicle_type || "-"}</ReadField>
              <ReadField label="고객명">
                <strong>{data.customer_name}</strong>
              </ReadField>
            </Row>
            <Row>
              <ReadField label="연락처" hint="원본 (월주차 알림톡용)">
                <span
                  style={{
                    fontFamily:
                      "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {data.customer_phone || "-"}
                </span>
              </ReadField>
              <ReadField label="계약기간">
                {fmtDate(data.start_date)} ~ {fmtDate(data.end_date)}
              </ReadField>
            </Row>
            <Row>
              <ReadField label="월요금" highlight>
                <span
                  style={{
                    fontFamily:
                      "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#1428A0",
                  }}
                >
                  ₩{fmtMoney(data.monthly_fee)}
                </span>
              </ReadField>
              <ReadField label="등록일자">
                {data.created_at
                  ? new Date(data.created_at).toLocaleString("ko-KR")
                  : "-"}
              </ReadField>
            </Row>
            {data.note && (
              <ReadField label="메모">
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "#475569",
                    background: "#f8fafc",
                    padding: 10,
                    borderRadius: 6,
                  }}
                >
                  {data.note}
                </pre>
              </ReadField>
            )}
          </div>
        ) : (
          // ── 편집 모드 ──
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                padding: 10,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 6,
                fontSize: 12,
                color: "#92400e",
              }}
            >
              💡 사업장은 변경할 수 없습니다 (필요 시 계약 취소 후 신규 등록)
            </div>
            <Row>
              <EditField label="사업장 (변경불가)">
                <input
                  type="text"
                  value={data.stores?.name || ""}
                  disabled
                  style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b" }}
                />
              </EditField>
              <EditField label="입주사">
                <select
                  value={form.tenant_id}
                  onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                >
                  <option value="">없음 (개별 고객)</option>
                  {tenants.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </EditField>
            </Row>
            <Row>
              <EditField label="차량번호" required>
                <input
                  type="text"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                  style={{
                    ...inputStyle,
                    fontFamily:
                      "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    fontWeight: 700,
                  }}
                  disabled={saving}
                />
              </EditField>
              <EditField label="차종">
                <input
                  type="text"
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                />
              </EditField>
            </Row>
            <Row>
              <EditField label="고객명" required>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                />
              </EditField>
              <EditField label="연락처" required>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  style={{
                    ...inputStyle,
                    fontFamily:
                      "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                  }}
                  disabled={saving}
                />
              </EditField>
            </Row>
            <Row>
              <EditField label="시작일" required>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                />
              </EditField>
              <EditField label="종료일" required>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                />
              </EditField>
            </Row>
            <Row>
              <EditField label="월요금 (원)" required>
                <input
                  type="number"
                  value={form.monthly_fee}
                  onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
                  step={1000}
                  min={0}
                  style={{
                    ...inputStyle,
                    textAlign: "right",
                    fontFamily:
                      "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    fontWeight: 700,
                  }}
                  disabled={saving}
                />
              </EditField>
              <EditField label="결제상태">
                <select
                  value={form.payment_status}
                  onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                  style={inputStyle}
                  disabled={saving}
                >
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </EditField>
            </Row>
            <EditField label="계약상태" hint="계약취소 버튼 사용 권장">
              <select
                value={form.contract_status}
                onChange={(e) => setForm({ ...form, contract_status: e.target.value })}
                style={inputStyle}
                disabled={saving}
              >
                {CONTRACT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </EditField>
            <EditField label="메모">
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                disabled={saving}
              />
            </EditField>

            {/* 편집 액션 */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={cancelEdit} disabled={saving} style={btnSecondary}>
                취소
              </button>
              <button onClick={saveEdit} disabled={saving} style={btnPrimary}>
                {saving ? "저장 중..." : "✓ 저장"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 갱신 이력 (renewed_from) */}
      {data.renewed_from && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 18,
            marginTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#475569",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🔄 이전 계약 (이 계약은 갱신으로 생성됨)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
              gap: 12,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>차량번호</div>
              <div style={{ fontWeight: 700, color: "#1428A0" }}>
                {data.renewed_from.vehicle_number}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>이전 기간</div>
              <div>
                {fmtDate(data.renewed_from.start_date)} ~ {fmtDate(data.renewed_from.end_date)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>이전 월요금</div>
              <div style={{ fontWeight: 700 }}>
                ₩{fmtMoney(data.renewed_from.monthly_fee)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>이전 상태</div>
              <span style={badgeStyle(
                CONTRACT_BADGE[data.renewed_from.contract_status]?.bg || "#f1f5f9",
                CONTRACT_BADGE[data.renewed_from.contract_status]?.fg || "#475569"
              )}>
                {CONTRACT_BADGE[data.renewed_from.contract_status]?.label || data.renewed_from.contract_status}
              </span>
            </div>
            <Link
              href={`/v2/monthly/${data.renewed_from.id}`}
              style={{
                padding: "6px 12px",
                background: "#1428A0",
                color: "#fff",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              이전 계약 →
            </Link>
          </div>
        </div>
      )}

      {/* 갱신 모달 */}
      {renewOpen && (
        <RenewModal
          monthly={data}
          onClose={() => setRenewOpen(false)}
          onRenewed={onRenewed}
        />
      )}
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {children}
    </div>
  );
}

function ReadField({
  label,
  hint,
  highlight,
  children,
}: {
  label: string;
  hint?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          marginBottom: 4,
          display: "flex",
          gap: 6,
          alignItems: "baseline",
        }}
      >
        <span>{label}</span>
        {hint && <span style={{ color: "#cbd5e1", fontWeight: 500 }}>· {hint}</span>}
      </div>
      <div
        style={{
          fontSize: highlight ? 16 : 14,
          color: "#0f172a",
          padding: "6px 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EditField({
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

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    padding: "3px 10px",
    background: bg,
    color: fg,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  };
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  background: "#1428A0",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 18px",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGold: React.CSSProperties = {
  padding: "10px 18px",
  background: "#F5B731",
  color: "#1428A0",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  padding: "10px 18px",
  background: "#fff",
  color: "#dc2626",
  border: "1px solid #fca5a5",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
