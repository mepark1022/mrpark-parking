// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 근태 수정이력 Drawer (Part 12B)
 *
 * 우측 슬라이드 패널. GET /api/v1/attendance/edit-history 조회.
 *
 * 필터: emp_id (선택) / date_from / date_to / action (insert|update|delete)
 * 응답: { items: [{ id, action, changed_at, reason, changed_by_name,
 *                   emp_no, name, work_date, before_data, after_data }],
 *        meta: { total, page, limit, total_pages } }
 */
"use client";

import { useState, useEffect, useCallback } from "react";

const ACTION_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  insert: { label: "신규", bg: "#dcfce7", color: "#15803d" },
  update: { label: "수정", bg: "#dbeafe", color: "#1d4ed8" },
  delete: { label: "삭제", bg: "#fee2e2", color: "#dc2626" },
};

const STATUS_LABEL: Record<string, string> = {
  present: "출근", late: "지각", peak: "피크", support: "지원",
  additional: "추가", leave: "연차", off: "휴무", absent: "결근",
};

// 로컬 시간 포맷 (YYYY-MM-DD HH:MM)
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const pad = (n: number) => (n < 10 ? "0" + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return iso; }
}

// before → after 변경 요약
function diffSummary(before: any, after: any): string {
  const b = before || {};
  const a = after || {};
  const fields: Array<[string, string]> = [
    ["status", "상태"],
    ["store_id", "사업장"],
    ["check_in", "출근"],
    ["check_out", "퇴근"],
    ["work_hours", "시간"],
  ];
  const changes: string[] = [];
  for (const [k, label] of fields) {
    const bv = b[k];
    const av = a[k];
    if (bv === av) continue;
    const render = (v: any, isStatus: boolean) => {
      if (v === null || v === undefined || v === "") return "—";
      if (isStatus && typeof v === "string") return STATUS_LABEL[v] || v;
      return String(v);
    };
    changes.push(`${label}: ${render(bv, k === "status")} → ${render(av, k === "status")}`);
  }
  return changes.length > 0 ? changes.join(", ") : "변경 없음";
}

export default function HistoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (action) params.set("action", action);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/attendance/edit-history?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setItems([]); setMeta({ total: 0, total_pages: 1 });
        return;
      }
      const data = json?.data || json;
      setItems(data?.items || []);
      setMeta(json?.meta || { total: 0, total_pages: 1 });
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [open, dateFrom, dateTo, action, page, limit]);

  // 열릴 때 & 필터 변경 시 자동 조회
  // (page 초기화 useEffect는 제거됨 — 부모에서 conditional render 하므로
  //  마운트 시점에 useState 초기값 1로 자연스럽게 시작 → 더블 페치 방지)
  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  const totalPages = meta?.total_pages || 1;
  const total = meta?.total || 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
        zIndex: 9998, display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640, background: "#fff",
          display: "flex", flexDirection: "column", height: "100vh",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
          background: "#1428A0", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>근태 수정 이력</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              총 {total}건 · {meta?.page || 1}/{totalPages} 페이지
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "#fff",
            fontSize: 20, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* 필터 */}
        <div style={{
          padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            style={inputSm}
          />
          <span style={{ color: "#64748b", fontSize: 12 }}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            style={inputSm}
          />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            style={inputSm}
          >
            <option value="">전체 작업</option>
            <option value="insert">신규</option>
            <option value="update">수정</option>
            <option value="delete">삭제</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            style={{
              height: 32, padding: "0 12px", borderRadius: 6,
              background: "#1428A0", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            {loading ? "..." : "조회"}
          </button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {error && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 10,
              background: "#fef2f2", color: "#b91c1c",
              border: "1px solid #fecaca", fontSize: 12, fontWeight: 600,
            }}>
              ⚠ {error}
            </div>
          )}
          {loading && items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              수정 이력이 없습니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it: any) => {
                const act = ACTION_STYLE[it.action] || { label: it.action, bg: "#f1f5f9", color: "#475569" };
                return (
                  <div key={it.id} style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: 12,
                  }}>
                    {/* 상단 — 뱃지 + 직원 + 날짜 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        background: act.bg, color: act.color,
                        fontSize: 11, fontWeight: 800,
                        padding: "2px 8px", borderRadius: 4,
                      }}>{act.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        {it.name || "—"}
                      </span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        ({it.emp_no || "—"})
                      </span>
                      <span style={{
                        marginLeft: "auto", fontSize: 11, color: "#475569",
                        background: "#f1f5f9", padding: "2px 8px", borderRadius: 4,
                      }}>
                        {it.work_date || "—"}
                      </span>
                    </div>
                    {/* 변경 요약 */}
                    <div style={{ fontSize: 12, color: "#1e293b", marginBottom: 6 }}>
                      {diffSummary(it.before_data, it.after_data)}
                    </div>
                    {/* 사유 */}
                    {it.reason && (
                      <div style={{
                        fontSize: 11, color: "#475569",
                        background: "#f8fafc", padding: "6px 10px", borderRadius: 6,
                        borderLeft: "3px solid #1428A0", marginBottom: 6,
                      }}>
                        📝 {it.reason}
                      </div>
                    )}
                    {/* 메타 */}
                    <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>👤 {it.changed_by_name || it.changed_by || "—"}</span>
                      <span>🕒 {fmtDateTime(it.changed_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 — 페이지네이션 */}
        {items.length > 0 && (
          <div style={{
            padding: 12, borderTop: "1px solid #e2e8f0", background: "#f8fafc",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={pageBtn}
            >
              ← 이전
            </button>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              style={pageBtn}
            >
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputSm: React.CSSProperties = {
  height: 32, padding: "0 10px", borderRadius: 6,
  border: "1px solid #cbd5e1", background: "#fff", fontSize: 12,
};
const pageBtn: React.CSSProperties = {
  height: 32, padding: "0 14px", borderRadius: 6,
  background: "#fff", color: "#0f172a",
  border: "1px solid #cbd5e1", fontSize: 12, fontWeight: 700,
  cursor: "pointer",
};
