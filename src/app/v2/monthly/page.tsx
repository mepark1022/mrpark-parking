// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 목록 페이지 (Part 15A)
 *
 * 경로: /v2/monthly
 *
 * 기능:
 *   - 필터: 사업장 / 입주사 / 계약상태 / 결제상태 / 만료임박(D-N) / 검색(차량번호·고객명)
 *   - 카드 리스트 + 페이지네이션
 *   - 신규 등록 → /v2/monthly/new (Part 15B)
 *   - 카드 클릭 → /v2/monthly/[id] (Part 15C)
 *
 * 정렬: end_date 가까운 순 (API 기본)
 *
 * 쿠키 기반 세션 인증: fetch credentials: 'include' 필수
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MonthlyList from "./MonthlyList";

const CONTRACT_STATUS_OPTIONS = [
  { value: "active", label: "활성 (기본)" },
  { value: "expired", label: "만료" },
  { value: "cancelled", label: "취소" },
  { value: "all", label: "전체" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "paid", label: "결제완료" },
  { value: "unpaid", label: "미결제" },
  { value: "overdue", label: "연체" },
];

const EXPIRING_OPTIONS = [
  { value: "", label: "전체" },
  { value: "7", label: "D-7 (1주일)" },
  { value: "14", label: "D-14 (2주일)" },
  { value: "30", label: "D-30 (1개월)" },
];

export default function MonthlyPage() {
  const [storeId, setStoreId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [contractStatus, setContractStatus] = useState<string>("active");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [expiringDays, setExpiringDays] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  const [stores, setStores] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, total_pages: 1 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 사업장 목록 로드 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        setStores(json?.data || []);
      } catch {}
    })();
  }, []);

  // ── 입주사 목록 로드 (active 전체) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/tenants?status=active&sort=name&limit=200", {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json();
        setTenants(json?.data || []);
      } catch {}
    })();
  }, []);

  // ── 월주차 목록 로드 ──
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (storeId) params.set("store_id", storeId);
      if (tenantId) params.set("tenant_id", tenantId);
      if (contractStatus) params.set("contract_status", contractStatus);
      if (paymentStatus) params.set("payment_status", paymentStatus);
      if (expiringDays) params.set("expiring_within_days", expiringDays);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/monthly?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setItems([]);
        setMeta({ total: 0, page: 1, total_pages: 1 });
        return;
      }
      setItems(json?.data || []);
      setMeta(json?.meta || { total: 0, page: 1, total_pages: 1 });
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, tenantId, contractStatus, paymentStatus, expiringDays, search, page]);

  // 필터 변경 시 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [storeId, tenantId, contractStatus, paymentStatus, expiringDays]);

  // 페이지 변경 시 자동 재조회
  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 첫 로드
  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadItems();
  };

  return (
    <div style={{ padding: "20px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1428A0", margin: 0 }}>
            월주차 관리
          </h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            총 <strong style={{ color: "#1428A0" }}>{meta.total ?? 0}</strong>건
            {expiringDays && (
              <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 700 }}>
                · ⚠ 만료 D-{expiringDays} 이내
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/v2/monthly/new"
            style={{
              padding: "10px 18px",
              background: "#1428A0",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ➕ 신규 등록
          </Link>
        </div>
      </div>

      {/* 필터 바 */}
      <form
        onSubmit={onSearchSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="사업장">
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            style={selectStyle}
          >
            <option value="">전체</option>
            {stores.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.site_code ? `[${s.site_code}] ` : ""}
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="입주사">
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={selectStyle}
          >
            <option value="">전체</option>
            {tenants.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="계약상태">
          <select
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            style={selectStyle}
          >
            {CONTRACT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="결제상태">
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={selectStyle}
          >
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="만료임박">
          <select
            value={expiringDays}
            onChange={(e) => setExpiringDays(e.target.value)}
            style={selectStyle}
          >
            {EXPIRING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="검색 (차량번호·고객명)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="예: 12가 3456"
              style={{ ...selectStyle, flex: 1 }}
            />
            <button
              type="submit"
              style={{
                padding: "0 14px",
                background: "#F5B731",
                color: "#1428A0",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              검색
            </button>
          </div>
        </Field>
      </form>

      {/* 본문 */}
      {error && (
        <div
          style={{
            padding: 16,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            marginBottom: 12,
            fontSize: 14,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {loading && !items.length ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>로딩 중...</div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "#94a3b8",
            background: "#fff",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
          }}
        >
          조건에 해당하는 월주차가 없습니다
        </div>
      ) : (
        <MonthlyList items={items} />
      )}

      {/* 페이지네이션 */}
      {meta.total_pages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            style={pageBtnStyle(page <= 1 || loading)}
          >
            ◀ 이전
          </button>
          <span style={{ fontSize: 14, color: "#475569" }}>
            <strong style={{ color: "#1428A0" }}>{meta.page}</strong> / {meta.total_pages}
            <span style={{ color: "#94a3b8", marginLeft: 6 }}>(총 {meta.total}건)</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
            disabled={page >= meta.total_pages || loading}
            style={pageBtnStyle(page >= meta.total_pages || loading)}
          >
            다음 ▶
          </button>
        </div>
      )}
    </div>
  );
}

// ── 공통 스타일 ──
const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  background: "#fff",
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: disabled ? "#f1f5f9" : "#1428A0",
    color: disabled ? "#94a3b8" : "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
