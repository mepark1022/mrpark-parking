// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 수정 이력 Drawer (Part 13C)
 *
 * 우측 슬라이드 패널 (640px)
 *   - GET /api/v1/daily-reports/:id/history?page=&limit=20
 *   - audit_logs 기반: daily_reports / daily_report_staff / daily_report_payment
 *   - 표시: 작업 / 테이블 / 변경자 / 시각 / 사유
 *   - 페이지네이션 (이전/다음)
 */
"use client";

import { useState, useEffect, useCallback } from "react";

const TABLE_LABEL: Record<string, string> = {
  daily_reports:        "기본정보",
  daily_report_staff:   "근무인원",
  daily_report_payment: "결제매출",
};

const ACTION_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  insert: { bg: "#dcfce7", color: "#15803d", label: "신규" },
  update: { bg: "#dbeafe", color: "#1d4ed8", label: "수정" },
  delete: { bg: "#fee2e2", color: "#dc2626", label: "삭제" },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  reportId: string;
  open: boolean;
  onClose: () => void;
}

export default function HistoryDrawer({ reportId, open, onClose }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await fetch(`/api/v1/daily-reports/${reportId}/history?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setLogs([]);
        return;
      }
      const data = json?.data || json;
      setLogs(data.history || []);
      setMeta(json?.meta || { total: 0, page: 1, total_pages: 1 });
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [reportId, page, open]);

  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          zIndex: 90,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(640px, 100vw)",
        background: "#fff", zIndex: 100,
        boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column",
      }}>
        {/* 헤더 */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#f8fafc",
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              📝 수정 이력
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              총 {meta.total}건
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8,
            background: "#fff", color: "#475569",
            border: "1px solid #cbd5e1",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {error && (
            <div style={{
              padding: 14, borderRadius: 10, marginBottom: 12,
              background: "#fef2f2", color: "#b91c1c",
              border: "1px solid #fecaca", fontSize: 13, fontWeight: 600,
            }}>⚠ {error}</div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              불러오는 중...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              📭 수정 이력이 없습니다
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map((log) => {
                const sty = ACTION_STYLE[log.action] || ACTION_STYLE.update;
                return (
                  <div key={log.id} style={{
                    padding: 12, borderRadius: 10,
                    border: "1px solid #e2e8f0", background: "#fff",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4,
                        background: sty.bg, color: sty.color,
                        fontSize: 11, fontWeight: 700,
                      }}>{sty.label}</span>
                      <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                        {TABLE_LABEL[log.table_name] || log.table_name}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                        {fmtDateTime(log.changed_at)}
                      </span>
                    </div>
                    {log.reason && (
                      <div style={{
                        fontSize: 12, color: "#475569",
                        padding: "6px 10px", marginTop: 4,
                        background: "#fef3c7", borderRadius: 6,
                      }}>
                        💬 {log.reason}
                      </div>
                    )}
                    {log.changed_by && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        변경자: {log.changed_by}
                      </div>
                    )}
                    {/* before/after 요약 */}
                    {(log.before_data || log.after_data) && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{
                          fontSize: 11, color: "#64748b", cursor: "pointer",
                          fontWeight: 600,
                        }}>
                          상세 데이터 보기
                        </summary>
                        <div style={{
                          marginTop: 6, padding: 8,
                          background: "#f8fafc", borderRadius: 6,
                          fontSize: 11, fontFamily: "monospace",
                          color: "#475569",
                          maxHeight: 240, overflowY: "auto",
                          whiteSpace: "pre-wrap", wordBreak: "break-all",
                        }}>
                          {log.before_data && (
                            <>
                              <div style={{ color: "#dc2626", fontWeight: 700, marginBottom: 4 }}>− Before</div>
                              <div style={{ marginBottom: 8 }}>
                                {JSON.stringify(log.before_data, null, 2)}
                              </div>
                            </>
                          )}
                          {log.after_data && (
                            <>
                              <div style={{ color: "#15803d", fontWeight: 700, marginBottom: 4 }}>+ After</div>
                              <div>{JSON.stringify(log.after_data, null, 2)}</div>
                            </>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {meta.total_pages > 1 && (
          <div style={{
            padding: "12px 20px", borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
          }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              style={pageBtn(page <= 1)}
            >← 이전</button>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, padding: "0 12px" }}>
              {meta.page} / {meta.total_pages}
            </span>
            <button
              onClick={() => setPage(Math.min(meta.total_pages, page + 1))}
              disabled={page >= meta.total_pages}
              style={pageBtn(page >= meta.total_pages)}
            >다음 →</button>
          </div>
        )}
      </div>
    </>
  );
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 32, padding: "0 12px", borderRadius: 6,
    background: disabled ? "#f1f5f9" : "#fff",
    color: disabled ? "#cbd5e1" : "#1428A0",
    border: `1px solid ${disabled ? "#e2e8f0" : "#cbd5e1"}`,
    fontWeight: 700, fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
