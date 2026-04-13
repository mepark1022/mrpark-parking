// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 목록 페이지 (Part 13A)
 *
 * 경로: /v2/daily-reports
 *
 * 기능:
 *   - 필터: 사업장 / 상태 / 기간 (기본: 이번달 1일~오늘)
 *   - 목록 카드 리스트 + 페이지네이션
 *   - 다중선택 → 일괄확정 (MANAGE)
 *   - Excel 다운로드 (MANAGE)
 *   - 신규 작성 버튼 (Part 13B에서 연결)
 *
 * 쿠키 기반 세션 인증: fetch credentials: 'include' 필수
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReportsList from "./ReportsList";
import ExportButton from "./ExportButton";

// ── 이번달 1일 / 오늘 ──
function getDefaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${d}`,
  };
}

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "draft", label: "임시저장" },
  { value: "submitted", label: "제출됨" },
  { value: "confirmed", label: "확정" },
];

export default function DailyReportsPage() {
  const def = getDefaultRange();
  const [storeId, setStoreId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(def.from);
  const [dateTo, setDateTo] = useState<string>(def.to);
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  const [stores, setStores] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, total_pages: 1 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);

  // ── 사업장 목록 로드 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        setStores(json?.data || []);
      } catch {
        // 사업장 조회 실패는 치명적이지 않음
      }
    })();
  }, []);

  // ── 일보 목록 로드 ──
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (storeId) params.set("store_id", storeId);
      if (status) params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/daily-reports?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setReports([]);
        setMeta({ total: 0, page: 1, total_pages: 1 });
        return;
      }
      setReports(json?.data || []);
      setMeta(json?.meta || { total: 0, page: 1, total_pages: 1 });
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [storeId, status, dateFrom, dateTo, page]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── 검색 (필터 적용 시 page 1로) ──
  function handleSearch() {
    if (page !== 1) setPage(1);
    else loadReports();
  }

  // ── 선택 토글 ──
  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }
  function toggleSelectAll() {
    // 미확정만 선택 가능
    const selectable = reports.filter((r) => r.status !== "confirmed").map((r) => r.id);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable));
    }
  }

  // ── 일괄확정 ──
  async function handleBulkConfirm() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건의 일보를 확정하시겠습니까?\n확정 후에는 작성자가 수정할 수 없습니다.`)) return;

    setBulkConfirming(true);
    try {
      const res = await fetch("/api/v1/daily-reports/bulk-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || `일괄확정 실패 (${res.status})`);
        return;
      }
      const data = json?.data || json;
      alert(`✅ 확정 ${data.confirmed_count || 0}건 / 건너뜀 ${data.skipped_count || 0}건`);
      setSelectedIds(new Set());
      loadReports();
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setBulkConfirming(false);
    }
  }

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: "100%" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            현장일보
          </h1>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            v2 · 일보 목록 + 일괄확정 (Part 13A)
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/v2/daily-reports/new"
            style={{
              height: 38, padding: "0 16px", borderRadius: 8,
              background: "#1428A0", color: "#fff",
              border: "none", fontWeight: 700, fontSize: 13,
              cursor: "pointer", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            ➕ 신규 작성
          </Link>
          <ExportButton dateFrom={dateFrom} dateTo={dateTo} storeId={storeId} />
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{
        background: "#fff", padding: 14, borderRadius: 12,
        border: "1px solid #e2e8f0", marginBottom: 12,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <Label>사업장</Label>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          style={{ ...selectStyle, minWidth: 180 }}
        >
          <option value="">전체</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.site_code ? `[${s.site_code}] ` : ""}{s.name}
            </option>
          ))}
        </select>

        <Label>상태</Label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <Label>시작</Label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ ...selectStyle, minWidth: 140 }}
        />

        <Label>종료</Label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ ...selectStyle, minWidth: 140 }}
        />

        <button onClick={handleSearch} disabled={loading} style={{
          height: 38, padding: "0 16px", borderRadius: 8,
          background: loading ? "#94a3b8" : "#0f172a", color: "#fff",
          border: "none", fontWeight: 700, fontSize: 13,
          cursor: loading ? "wait" : "pointer",
        }}>
          {loading ? "조회중..." : "🔍 조회"}
        </button>
      </div>

      {/* 일괄 액션 바 */}
      {selectedIds.size > 0 && (
        <div style={{
          background: "#1428A0", color: "#fff",
          padding: "12px 16px", borderRadius: 10, marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            ✓ {selectedIds.size}건 선택됨
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())} style={{
              height: 34, padding: "0 14px", borderRadius: 6,
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.4)",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}>
              선택 해제
            </button>
            <button onClick={handleBulkConfirm} disabled={bulkConfirming} style={{
              height: 34, padding: "0 14px", borderRadius: 6,
              background: "#F5B731", color: "#0f172a",
              border: "none", fontWeight: 800, fontSize: 12,
              cursor: bulkConfirming ? "wait" : "pointer",
            }}>
              {bulkConfirming ? "확정 중..." : "✅ 일괄확정"}
            </button>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 12,
          background: "#fef2f2", color: "#b91c1c",
          border: "1px solid #fecaca", fontSize: 13, fontWeight: 600,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{
          padding: 60, textAlign: "center", color: "#64748b",
          background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
        }}>
          불러오는 중...
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: "#64748b",
          background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
        }}>
          📭 조건에 맞는 일보가 없습니다.
        </div>
      ) : (
        <ReportsList
          reports={reports}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      {/* 페이지네이션 */}
      {!loading && reports.length > 0 && meta.total_pages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 8, marginTop: 20,
        }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={pageBtnStyle(page <= 1)}
          >
            ← 이전
          </button>
          <span style={{ fontSize: 13, color: "#475569", fontWeight: 600, padding: "0 12px" }}>
            {meta.page} / {meta.total_pages} (총 {meta.total}건)
          </span>
          <button
            onClick={() => setPage(Math.min(meta.total_pages, page + 1))}
            disabled={page >= meta.total_pages}
            style={pageBtnStyle(page >= meta.total_pages)}
          >
            다음 →
          </button>
        </div>
      )}

      {!loading && reports.length > 0 && meta.total_pages <= 1 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", textAlign: "right" }}>
          총 {meta.total}건
        </div>
      )}
    </div>
  );
}

// ── 스타일 헬퍼 ──
function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginLeft: 4 }}>{children}</span>;
}
const selectStyle: React.CSSProperties = {
  height: 38, padding: "0 10px", borderRadius: 8,
  border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, color: "#0f172a",
  minWidth: 100,
};
function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 34, padding: "0 14px", borderRadius: 6,
    background: disabled ? "#f1f5f9" : "#fff",
    color: disabled ? "#cbd5e1" : "#1428A0",
    border: `1px solid ${disabled ? "#e2e8f0" : "#cbd5e1"}`,
    fontWeight: 700, fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
