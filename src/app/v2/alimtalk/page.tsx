// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 발송 로그 페이지 (Part 18B)
 *
 * 경로: /v2/alimtalk
 *
 * 기능:
 *   - 기간 프리셋 (오늘/7일/30일/이번달) + 커스텀 날짜 range
 *   - 템플릿 / 성공여부 / 검색 필터
 *   - KPI 4카드 (총발송/성공/실패/성공률)
 *   - 템플릿별 요약 테이블
 *   - 상세 로그 테이블 (페이지네이션)
 *   - CSV 다운로드 (현재 필터 조건)
 *
 * API:
 *   GET /api/v1/alimtalk/logs?date_from&date_to&template&status&search&page&limit
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

const TEMPLATE_LABELS: Record<string, string> = {
  entry: "입차확인",
  ready: "차량준비완료",
  renewal_remind: "월주차 D-7 (수동)",
  d7_auto_remind: "월주차 D-7 (자동)",
  monthly_expire: "월주차 만료 (수동)",
  monthly_expire_auto: "월주차 만료 (자동)",
  renewal_complete: "월주차 갱신완료",
};

const TEMPLATE_OPTIONS = [
  { value: "all", label: "전체 템플릿" },
  { value: "entry", label: "입차확인" },
  { value: "ready", label: "차량준비완료" },
  { value: "d7_auto_remind", label: "월주차 D-7 (자동)" },
  { value: "renewal_remind", label: "월주차 D-7 (수동)" },
  { value: "monthly_expire_auto", label: "월주차 만료 (자동)" },
  { value: "monthly_expire", label: "월주차 만료 (수동)" },
  { value: "renewal_complete", label: "월주차 갱신완료" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "success", label: "성공" },
  { value: "failed", label: "실패" },
];

function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = String(d.getFullYear()).slice(2);
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${M}.${D} ${h}:${m}`;
}

function templateLabel(t: string): string {
  return TEMPLATE_LABELS[t] || t;
}

// CSV escape
function csvCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AlimtalkLogsPage() {
  // 기간
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return fmtYmd(d);
  }, []);
  const defaultTo = useMemo(() => fmtYmd(today), [today]);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [template, setTemplate] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [page, setPage] = useState(1);
  const limit = 50;

  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, total_pages: 1 });
  const [summary, setSummary] = useState<any>({
    total: 0,
    success: 0,
    failed: 0,
    by_template: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo);
      if (template !== "all") params.set("template", template);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/v1/alimtalk/logs?${params.toString()}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok || !body?.data) {
        throw new Error(body?.error?.message || "조회 실패");
      }
      setData(body.data.data || []);
      setMeta(body.data.meta || { total: 0, page: 1, total_pages: 1 });
      setSummary(
        body.data.summary || { total: 0, success: 0, failed: 0, by_template: {} }
      );
    } catch (e: any) {
      setError(e?.message || "조회 실패");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, template, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // 프리셋
  const applyPreset = (key: "today" | "7d" | "30d" | "this_month") => {
    const t = new Date();
    const to = fmtYmd(t);
    let from = to;
    if (key === "today") from = to;
    else if (key === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      from = fmtYmd(d);
    } else if (key === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      from = fmtYmd(d);
    } else if (key === "this_month") {
      from = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
    }
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };

  const handleSearchSubmit = (e: any) => {
    e?.preventDefault?.();
    setSearch(searchInput);
    setPage(1);
  };

  // CSV 다운로드 (최대 5000건 제한)
  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo);
      if (template !== "all") params.set("template", template);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", "1");
      params.set("limit", "200");

      const all: any[] = [];
      let curPage = 1;
      let totalPages = 1;
      const MAX = 5000;

      while (curPage <= totalPages && all.length < MAX) {
        params.set("page", String(curPage));
        const res = await fetch(
          `/api/v1/alimtalk/logs?${params.toString()}`,
          { credentials: "include" }
        );
        const body = await res.json();
        if (!res.ok || !body?.data) break;
        const rows = body.data.data || [];
        all.push(...rows);
        totalPages = body.data.meta?.total_pages || 1;
        if (rows.length === 0) break;
        curPage++;
      }

      const header = [
        "발송일시",
        "템플릿",
        "상태",
        "수신번호(마스킹)",
        "메시지ID",
        "에러메시지",
        "티켓ID",
        "월주차ID",
      ];
      const lines = [header.map(csvCell).join(",")];

      all.forEach((r) => {
        lines.push(
          [
            fmtDateTime(r.sent_at),
            templateLabel(r.template_type),
            r.send_status === "success" ? "성공" : "실패",
            r.phone_masked || "",
            r.message_id || "",
            r.error_message || "",
            r.ticket_id || "",
            r.monthly_parking_id || "",
          ]
            .map(csvCell)
            .join(",")
        );
      });

      // UTF-8 BOM (한글 엑셀 호환)
      const csv = "\ufeff" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alimtalk_logs_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`CSV 다운로드 실패: ${e?.message || e}`);
    } finally {
      setDownloading(false);
    }
  };

  const successRate =
    summary.total > 0
      ? ((summary.success / summary.total) * 100).toFixed(1)
      : "0.0";

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.02em",
            }}
          >
            알림톡 발송 로그
          </h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
            Solapi 알림톡 발송 이력 조회 · 전화번호는 마스킹되어 저장됩니다
          </div>
        </div>
        <button
          onClick={downloadCsv}
          disabled={downloading || summary.total === 0}
          style={{
            padding: "10px 18px",
            background: downloading ? "#ccc" : NAVY,
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: downloading ? "wait" : "pointer",
          }}
        >
          {downloading ? "다운로드 중…" : "CSV 내보내기"}
        </button>
      </div>

      {/* 탭 네비게이션 (Part 19D) */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E5E7EB", marginBottom: 20 }}>
        <a href="/v2/alimtalk" style={{
          padding: "10px 18px", fontSize: 13, fontWeight: 600,
          color: NAVY, borderBottom: `2px solid ${NAVY}`,
          textDecoration: "none", marginBottom: -1,
        }}>로그</a>
        <a href="/v2/alimtalk/health" style={{
          padding: "10px 18px", fontSize: 13, fontWeight: 600,
          color: "#6B7280", borderBottom: "2px solid transparent",
          textDecoration: "none", marginBottom: -1,
        }}>환경 상태</a>
        <a href="/v2/alimtalk/test" style={{
          padding: "10px 18px", fontSize: 13, fontWeight: 600,
          color: "#6B7280", borderBottom: "2px solid transparent",
          textDecoration: "none", marginBottom: -1,
        }}>테스트 발송</a>
      </div>

      {/* 필터 */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {[
            { k: "today", label: "오늘" },
            { k: "7d", label: "최근 7일" },
            { k: "30d", label: "최근 30일" },
            { k: "this_month", label: "이번 달" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k as any)}
              style={{
                padding: "6px 12px",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            style={inputStyle}
          />
          <span style={{ color: "#999" }}>~</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={defaultTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            style={inputStyle}
          />
          <select
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setPage(1);
            }}
            style={inputStyle}
          >
            {TEMPLATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: "flex", gap: 6, flex: 1, minWidth: 220 }}
          >
            <input
              type="text"
              placeholder="전화번호 마스킹 / 메시지ID 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="submit" style={searchBtnStyle}>
              검색
            </button>
          </form>
        </div>
      </div>

      {/* KPI 4카드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard label="총 발송" value={summary.total.toLocaleString()} />
        <KpiCard
          label="성공"
          value={summary.success.toLocaleString()}
          color="#059669"
        />
        <KpiCard
          label="실패"
          value={summary.failed.toLocaleString()}
          color="#dc2626"
        />
        <KpiCard label="성공률" value={`${successRate}%`} color={NAVY} />
      </div>

      {/* 템플릿별 요약 */}
      {Object.keys(summary.by_template || {}).length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: NAVY,
              marginBottom: 10,
            }}
          >
            템플릿별 현황
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>템플릿</th>
                <th style={{ ...thStyle, textAlign: "right" }}>총</th>
                <th style={{ ...thStyle, textAlign: "right" }}>성공</th>
                <th style={{ ...thStyle, textAlign: "right" }}>실패</th>
                <th style={{ ...thStyle, textAlign: "right" }}>성공률</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.by_template)
                .sort(([, a]: any, [, b]: any) => b.total - a.total)
                .map(([t, v]: any) => (
                  <tr key={t} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={tdStyle}>{templateLabel(t)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {v.total.toLocaleString()}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        color: "#059669",
                      }}
                    >
                      {v.success.toLocaleString()}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        color: v.failed > 0 ? "#dc2626" : "#999",
                      }}
                    >
                      {v.failed.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {v.total > 0
                        ? `${((v.success / v.total) * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 로그 테이블 */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#999" }}>
            불러오는 중…
          </div>
        ) : error ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: "#dc2626",
            }}
          >
            오류: {error}
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#999" }}>
            조회된 로그가 없습니다
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>발송일시</th>
                  <th style={thStyle}>템플릿</th>
                  <th style={thStyle}>상태</th>
                  <th style={thStyle}>수신번호</th>
                  <th style={thStyle}>메시지ID</th>
                  <th style={thStyle}>에러</th>
                  <th style={thStyle}>연결</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid #f3f4f6" }}
                  >
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "monospace",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDateTime(r.sent_at)}
                    </td>
                    <td style={tdStyle}>{templateLabel(r.template_type)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            r.send_status === "success"
                              ? "#d1fae5"
                              : "#fee2e2",
                          color:
                            r.send_status === "success"
                              ? "#065f46"
                              : "#991b1b",
                        }}
                      >
                        {r.send_status === "success" ? "성공" : "실패"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                      {r.phone_masked || "-"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "#666",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.message_id || ""}
                    >
                      {r.message_id || "-"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#dc2626",
                        fontSize: 12,
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.error_message || ""}
                    >
                      {r.error_message || "-"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      {r.ticket_id ? (
                        <span style={{ color: "#666" }}>
                          티켓 {r.ticket_id.slice(0, 6)}…
                        </span>
                      ) : r.monthly_parking_id ? (
                        <span style={{ color: "#666" }}>
                          월주차 {r.monthly_parking_id.slice(0, 6)}…
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 페이지네이션 */}
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #e5e7eb",
                fontSize: 13,
              }}
            >
              <div style={{ color: "#666" }}>
                총 {meta.total.toLocaleString()}건 · {meta.page} / {meta.total_pages} 페이지
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  style={pgBtnStyle(page <= 1)}
                >
                  처음
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={pgBtnStyle(page <= 1)}
                >
                  이전
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(meta.total_pages, p + 1))
                  }
                  disabled={page >= meta.total_pages}
                  style={pgBtnStyle(page >= meta.total_pages)}
                >
                  다음
                </button>
                <button
                  onClick={() => setPage(meta.total_pages)}
                  disabled={page >= meta.total_pages}
                  style={pgBtnStyle(page >= meta.total_pages)}
                >
                  끝
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────── 내부 컴포넌트 ───────────
function KpiCard({
  label,
  value,
  color = "#111",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          fontFamily: "'Outfit', monospace",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─────────── 스타일 ───────────
const inputStyle: any = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "white",
  outline: "none",
};

const searchBtnStyle: any = {
  padding: "8px 14px",
  background: NAVY,
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const thStyle: any = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: any = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#111",
};

const pgBtnStyle = (disabled: boolean) => ({
  padding: "6px 12px",
  background: disabled ? "#f3f4f6" : "white",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer",
  color: disabled ? "#9ca3af" : "#111",
});
