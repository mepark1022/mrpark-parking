// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 입주사 상세 페이지 (Part 16B)
 *
 * 경로: /v2/tenants/[id]
 *
 * 기능:
 *   - 상세 조회 (GET /api/v1/tenants/:id) — active_contract_count 동봉
 *   - 수정 (TenantFormModal 재사용 — Part 16A에서 작성한 공용 모달)
 *   - 비활성화/활성화 토글 (PATCH status)
 *   - 영구 삭제 (DELETE ?hard=true) — super_admin + 활성 계약 0건일 때만 노출
 *   - 활성 월주차 계약 목록 (GET /api/v1/monthly?tenant_id=xxx&contract_status=active)
 *
 * 권한:
 *   - MANAGE: 모든 액션 가능
 *   - super_admin: 영구 삭제 추가 가능
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TenantFormModal from "../TenantFormModal";

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#dcfce7", fg: "#166534", label: "활성" },
  inactive: { bg: "#f1f5f9", fg: "#475569", label: "비활성" },
};

const CONTRACT_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#dcfce7", fg: "#166534", label: "활성" },
  expired: { bg: "#f1f5f9", fg: "#475569", label: "만료" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "취소" },
};

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return s.replace(/-/g, ".");
}

function fmtDateTime(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${mo}.${day} ${hh}:${mm}`;
}

function fmtMoney(n: number | null): string {
  if (n == null) return "-";
  return Number(n).toLocaleString("ko-KR");
}

function daysUntil(endDate: string): number {
  if (!endDate) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + "T00:00:00");
  return Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [acting, setActing] = useState(false);

  // ── 데이터 로드 ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 병렬 로드: 상세 + 활성 계약 + 사업장 + 내 정보
      const [tRes, cRes, sRes, meRes] = await Promise.all([
        fetch(`/api/v1/tenants/${id}`, { credentials: "include" }),
        fetch(`/api/v1/monthly?tenant_id=${id}&contract_status=active&limit=100`, {
          credentials: "include",
        }),
        fetch(`/api/v1/stores?limit=200`, { credentials: "include" }),
        fetch(`/api/v1/auth/me`, { credentials: "include" }),
      ]);

      const tJson = await tRes.json();
      if (!tRes.ok || tJson?.success === false) {
        setError(tJson?.error?.message || `조회 실패 (${tRes.status})`);
        setLoading(false);
        return;
      }
      setData(tJson.data);

      const cJson = await cRes.json();
      if (cRes.ok && cJson?.success !== false) {
        setContracts(cJson.data || []);
      }

      const sJson = await sRes.json();
      if (sRes.ok && sJson?.success !== false) {
        setStores(sJson.data || []);
      }

      const meJson = await meRes.json();
      if (meRes.ok && meJson?.success !== false) {
        setMe(meJson.data);
      }
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 비활성화/활성화 토글 ──
  const onToggleStatus = async () => {
    if (!data) return;
    const isActive = data.status === "active";
    const next = isActive ? "inactive" : "active";
    const verb = isActive ? "비활성화" : "활성화";

    if (isActive && (data.active_contract_count ?? 0) > 0) {
      const ok = window.confirm(
        `이 입주사에 활성 월주차 계약이 ${data.active_contract_count}건 있습니다.\n` +
          `비활성화하면 신규 등록만 차단되며 기존 계약은 유지됩니다.\n\n계속하시겠습니까?`
      );
      if (!ok) return;
    } else {
      if (!window.confirm(`'${data.name}' 입주사를 ${verb}하시겠습니까?`)) return;
    }

    setActing(true);
    try {
      const res = await fetch(`/api/v1/tenants/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || `${verb} 실패 (${res.status})`);
        return;
      }
      alert(`${verb} 완료`);
      await load();
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setActing(false);
    }
  };

  // ── 영구 삭제 (super_admin + 활성 계약 0건) ──
  const onHardDelete = async () => {
    if (!data) return;
    if ((data.active_contract_count ?? 0) > 0) {
      alert("활성 월주차 계약이 있어 영구 삭제할 수 없습니다.");
      return;
    }
    const phrase = window.prompt(
      `⚠ 영구 삭제는 복구할 수 없습니다.\n\n` +
        `삭제하려면 입주사명을 정확히 입력해주세요:\n${data.name}`
    );
    if (phrase !== data.name) {
      if (phrase != null) alert("입주사명이 일치하지 않아 취소되었습니다.");
      return;
    }

    setActing(true);
    try {
      const res = await fetch(`/api/v1/tenants/${id}?hard=true`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || `삭제 실패 (${res.status})`);
        return;
      }
      alert("영구 삭제 완료");
      router.push("/v2/tenants");
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setActing(false);
    }
  };

  // ── 모달 저장 후 ──
  const onSaved = (saved: any) => {
    setEditOpen(false);
    load();
  };

  // ── 렌더링 ──
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        불러오는 중...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 30 }}>
        <div
          style={{
            padding: 16,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          ⚠ {error || "입주사를 찾을 수 없습니다"}
        </div>
        <Link
          href="/v2/tenants"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "8px 16px",
            background: "#1428A0",
            color: "#fff",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← 목록으로
        </Link>
      </div>
    );
  }

  const isSuperAdmin = me?.role === "super_admin";
  const statusBadge = STATUS_BADGE[data.status] || STATUS_BADGE.active;
  const activeCount = data.active_contract_count ?? 0;
  const storeName =
    stores.find((s) => s.id === data.default_store_id)?.name || "-";
  const storeCode = stores.find((s) => s.id === data.default_store_id)?.site_code;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px" }}>
      {/* 상단 네비 */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/v2/tenants"
          style={{
            color: "#64748b",
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← 입주사 목록
        </Link>
      </div>

      {/* 헤더 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#1428A0",
                margin: 0,
                letterSpacing: -0.3,
              }}
            >
              🏢 {data.name}
            </h1>
            <span
              style={{
                padding: "4px 10px",
                background: statusBadge.bg,
                color: statusBadge.fg,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {statusBadge.label}
            </span>
          </div>
          {data.business_no && (
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "#64748b",
                fontFamily: "Outfit, monospace",
              }}
            >
              사업자번호: {data.business_no}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setEditOpen(true)}
            disabled={acting}
            style={btnPrimary}
          >
            ✏️ 수정
          </button>
          <button
            onClick={onToggleStatus}
            disabled={acting}
            style={data.status === "active" ? btnWarn : btnSuccess}
          >
            {data.status === "active" ? "🚫 비활성화" : "✓ 활성화"}
          </button>
          {isSuperAdmin && data.status === "inactive" && activeCount === 0 && (
            <button
              onClick={onHardDelete}
              disabled={acting}
              style={btnDanger}
              title="super_admin 전용 — 복구 불가"
            >
              🗑 영구 삭제
            </button>
          )}
        </div>
      </div>

      {/* 통계 카드 3개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="활성 월주차"
          value={`${activeCount}건`}
          color={activeCount > 0 ? "#1428A0" : "#94a3b8"}
        />
        <StatCard
          label="누적 이용횟수"
          value={`${data.usage_count ?? 0}건`}
          color="#475569"
        />
        <StatCard
          label="최근 계약일"
          value={fmtDate(data.last_contracted_at)}
          color="#475569"
          small
        />
      </div>

      {/* 본문 그리드 — 좌: 기본정보 / 우: 활성 계약 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: 16,
        }}
      >
        {/* 좌측: 기본 정보 */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 22,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#1428A0",
              marginBottom: 16,
              paddingBottom: 10,
              borderBottom: "2px solid #f1f5f9",
            }}
          >
            📋 기본 정보
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <ReadField label="담당자" value={data.contact_name || "-"} />
            <ReadField
              label="담당자 연락처"
              value={data.contact_phone || "-"}
              mono
              hint={data.contact_phone ? "월주차 알림톡 정책에 따라 평문 저장" : undefined}
            />
            <ReadField
              label="기본 사업장"
              value={
                data.default_store_id
                  ? `${storeCode ? `[${storeCode}] ` : ""}${storeName}`
                  : "-"
              }
            />
            <ReadField
              label="기본 월요금"
              value={
                data.monthly_fee_default != null
                  ? `₩ ${fmtMoney(data.monthly_fee_default)}`
                  : "-"
              }
              highlight
            />
            <ReadField label="등록일자" value={fmtDateTime(data.created_at)} />
            <ReadField label="최종 수정" value={fmtDateTime(data.updated_at)} />
            {data.memo && (
              <div>
                <div style={readLabelStyle}>메모</div>
                <div
                  style={{
                    padding: 12,
                    background: "#fafbfc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#334155",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {data.memo}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 활성 월주차 계약 목록 */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 10,
              borderBottom: "2px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1428A0" }}>
              🚗 활성 월주차 계약 ({contracts.length}건)
            </div>
            <Link
              href={`/v2/monthly/new?tenant_id=${id}`}
              style={{
                padding: "6px 12px",
                background: "#F5B731",
                color: "#1428A0",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              + 신규 등록
            </Link>
          </div>

          {contracts.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
                background: "#fafbfc",
                borderRadius: 8,
                border: "1px dashed #cbd5e1",
              }}
            >
              활성 월주차 계약이 없습니다
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 520, overflowY: "auto" }}>
              {contracts.map((c) => {
                const days = daysUntil(c.end_date);
                const dColor =
                  days < 0 ? "#94a3b8" : days <= 7 ? "#dc2626" : days <= 30 ? "#92400e" : "#64748b";
                const cBadge = CONTRACT_BADGE[c.contract_status] || CONTRACT_BADGE.active;
                return (
                  <Link
                    key={c.id}
                    href={`/v2/monthly/${c.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: 12,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "inherit",
                      background: "#fff",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#1428A0";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#1428A0",
                            fontFamily: "Outfit, monospace",
                            letterSpacing: 0.3,
                          }}
                        >
                          {c.vehicle_number}
                        </span>
                        <span
                          style={{
                            padding: "2px 7px",
                            background: cBadge.bg,
                            color: cBadge.fg,
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {cBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {c.customer_name || "-"}
                        {c.vehicle_type && ` · ${c.vehicle_type}`}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#1428A0",
                          fontFamily: "Outfit, monospace",
                        }}
                      >
                        ₩{fmtMoney(c.monthly_fee)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: dColor,
                          marginTop: 4,
                        }}
                      >
                        {days < 0
                          ? `D+${-days}`
                          : days === 0
                          ? "오늘 만료"
                          : `D-${days}`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 수정 모달 */}
      {editOpen && (
        <TenantFormModal
          tenant={data}
          stores={stores}
          onClose={() => setEditOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ── 공용 컴포넌트 ──
const readLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

function ReadField({
  label,
  value,
  mono,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div style={readLabelStyle}>{label}</div>
      <div
        style={{
          fontSize: highlight ? 18 : 14,
          fontWeight: highlight ? 800 : 500,
          color: highlight ? "#1428A0" : "#1e293b",
          fontFamily: mono || highlight ? "Outfit, monospace" : "inherit",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: small ? 16 : 22,
          fontWeight: 800,
          color,
          fontFamily: "Outfit, monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── 버튼 스타일 ──
const btnBase: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "#1428A0",
  color: "#fff",
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: "#16a34a",
  color: "#fff",
};

const btnWarn: React.CSSProperties = {
  ...btnBase,
  background: "#fff",
  color: "#92400e",
  borderColor: "#fbbf24",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "#fff",
  color: "#991b1b",
  borderColor: "#fca5a5",
};
