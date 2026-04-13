// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 입주사 목록 페이지 (Part 16A)
 *
 * 경로: /v2/tenants
 *
 * 기능:
 *   - 필터: 검색(이름/담당자) + 상태(active 기본/inactive/all) + 정렬(usage 기본/name/recent)
 *   - 테이블 리스트 + 페이지네이션
 *   - 신규 등록 모달
 *   - 행 클릭 → /v2/tenants/[id] (Part 16B에서 활성화)
 *
 * API:
 *   GET  /api/v1/tenants?search&status&sort&page&limit
 *   POST /api/v1/tenants  (모달에서)
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TenantFormModal from "./TenantFormModal";

const STATUS_OPTIONS = [
  { value: "active", label: "활성 (기본)" },
  { value: "inactive", label: "비활성" },
  { value: "all", label: "전체" },
];

const SORT_OPTIONS = [
  { value: "usage", label: "이용횟수순 (기본)" },
  { value: "name", label: "이름순" },
  { value: "recent", label: "최근 등록순" },
];

function fmtDateShort(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("usage");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [stores, setStores] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, total_pages: 1 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 사업장 (모달 default_store_id 드롭다운용)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (res.ok) setStores((await res.json())?.data || []);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/tenants?${params.toString()}`, {
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
    } finally {
      setLoading(false);
    }
  }, [search, status, sort, page]);

  useEffect(() => {
    setPage(1);
  }, [status, sort]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, sort]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const onCreated = () => {
    setModalOpen(false);
    setPage(1);
    load();
  };

  const storeNameById = (id: string | null) => {
    if (!id) return null;
    const s = stores.find((x: any) => x.id === id);
    return s?.name || null;
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
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
            입주사 관리
          </h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            총 <strong style={{ color: "#1428A0" }}>{meta.total ?? 0}</strong>개 입주사
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: "10px 18px",
            background: "#1428A0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ➕ 신규 등록
        </button>
      </div>

      {/* 필터 바 */}
      <form
        onSubmit={onSearchSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: 12,
        }}
      >
        <Field label="검색 (입주사명·담당자)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="예: 메디플렉스 / 홍길동"
              style={{ ...selectStyle, flex: 1 }}
            />
            <button
              type="submit"
              style={{
                padding: "0 16px",
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
        <Field label="상태">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="정렬">
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </form>

      {/* 에러 */}
      {error && (
        <div
          style={{
            padding: 14,
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

      {/* 본문 테이블 */}
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
          조건에 해당하는 입주사가 없습니다
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <Th>입주사명</Th>
                  <Th>담당자</Th>
                  <Th>연락처</Th>
                  <Th>기본 사업장</Th>
                  <Th align="right">기본 월요금</Th>
                  <Th align="center">이용횟수</Th>
                  <Th>최근 계약</Th>
                  <Th align="center">상태</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((t: any) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    onClick={() => {
                      window.location.href = `/v2/tenants/${t.id}`;
                    }}
                  >
                    <Td>
                      <Link
                        href={`/v2/tenants/${t.id}`}
                        style={{
                          color: "#1428A0",
                          fontWeight: 700,
                          textDecoration: "none",
                          fontSize: 14,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        🏢 {t.name}
                      </Link>
                      {t.business_no && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            marginTop: 2,
                            fontFamily: "Outfit, monospace",
                          }}
                        >
                          {t.business_no}
                        </div>
                      )}
                    </Td>
                    <Td>{t.contact_name || <span style={{ color: "#cbd5e1" }}>-</span>}</Td>
                    <Td>
                      {t.contact_phone ? (
                        <span
                          style={{
                            fontFamily: "Outfit, monospace",
                            fontSize: 13,
                          }}
                        >
                          {t.contact_phone}
                        </span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>-</span>
                      )}
                    </Td>
                    <Td>
                      {t.default_store_id ? (
                        <span style={{ fontSize: 13 }}>
                          📍 {storeNameById(t.default_store_id) || "—"}
                        </span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>-</span>
                      )}
                    </Td>
                    <Td align="right">
                      {t.monthly_fee_default ? (
                        <span
                          style={{
                            fontFamily: "Outfit, monospace",
                            fontWeight: 700,
                            color: "#1428A0",
                          }}
                        >
                          ₩{Number(t.monthly_fee_default).toLocaleString("ko-KR")}
                        </span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>-</span>
                      )}
                    </Td>
                    <Td align="center">
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: 32,
                          padding: "3px 8px",
                          background: t.usage_count > 0 ? "#dbeafe" : "#f1f5f9",
                          color: t.usage_count > 0 ? "#1e40af" : "#94a3b8",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "Outfit, monospace",
                        }}
                      >
                        {t.usage_count || 0}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {fmtDateShort(t.last_contracted_at)}
                      </span>
                    </Td>
                    <Td align="center">
                      <span
                        style={{
                          padding: "2px 10px",
                          background: t.status === "active" ? "#dcfce7" : "#fee2e2",
                          color: t.status === "active" ? "#166534" : "#991b1b",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {t.status === "active" ? "활성" : "비활성"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

      {/* 신규 등록 모달 */}
      {modalOpen && (
        <TenantFormModal
          stores={stores}
          onClose={() => setModalOpen(false)}
          onSaved={onCreated}
        />
      )}
    </div>
  );
}

// ── 공통 ──
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

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align,
        fontSize: 12,
        fontWeight: 700,
        color: "#475569",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        textAlign: align,
        fontSize: 13,
        color: "#0f172a",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
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
