// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 리스트 (Part 13A)
 *
 * 카드형 리스트:
 *   - 상태별 좌측 컬러 바
 *   - 다중선택 체크박스 (확정된 일보는 비활성화)
 *   - 사업장 / 날짜 / 매출 / 입차 / 발렛 / 작성자 표시
 *   - 카드 클릭 → /v2/daily-reports/[id] 이동 (Part 13C에서 활성화)
 */
"use client";

import Link from "next/link";

const STATUS_STYLE: Record<string, { bg: string; color: string; bar: string; label: string }> = {
  draft:     { bg: "#f1f5f9", color: "#475569", bar: "#94a3b8", label: "임시저장" },
  submitted: { bg: "#dbeafe", color: "#1d4ed8", bar: "#1428A0", label: "제출됨" },
  confirmed: { bg: "#dcfce7", color: "#15803d", bar: "#15803d", label: "확정" },
};

function fmtMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("ko-KR");
}
function fmtDateKor(d: string): string {
  // YYYY-MM-DD → MM/DD (요일)
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const wd = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${m}/${day} (${wd})`;
}

interface Props {
  reports: any[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

export default function ReportsList({
  reports, selectedIds, onToggleSelect, onToggleSelectAll,
}: Props) {
  const selectableCount = reports.filter((r) => r.status !== "confirmed").length;
  const allSelected = selectableCount > 0 && selectedIds.size === selectableCount;

  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0", overflow: "hidden",
    }}>
      {/* 전체선택 헤더 */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          disabled={selectableCount === 0}
          style={{ width: 16, height: 16, cursor: selectableCount === 0 ? "not-allowed" : "pointer" }}
        />
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
          전체선택 (미확정 {selectableCount}건)
        </span>
      </div>

      {/* 카드 리스트 */}
      <div>
        {reports.map((r) => {
          const sty = STATUS_STYLE[r.status] || STATUS_STYLE.draft;
          const checked = selectedIds.has(r.id);
          const canSelect = r.status !== "confirmed";
          const store = r.stores || {};
          const siteCode = store.site_code ? `[${store.site_code}] ` : "";

          return (
            <div key={r.id} style={{
              display: "flex", alignItems: "stretch",
              borderBottom: "1px solid #f1f5f9",
              background: checked ? "#eff6ff" : "#fff",
              transition: "background 0.15s",
            }}>
              {/* 좌측 컬러 바 */}
              <div style={{ width: 4, background: sty.bar, flexShrink: 0 }} />

              {/* 체크박스 영역 */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 14px", borderRight: "1px solid #f1f5f9",
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canSelect}
                  onChange={() => canSelect && onToggleSelect(r.id)}
                  style={{
                    width: 16, height: 16,
                    cursor: canSelect ? "pointer" : "not-allowed",
                  }}
                  title={canSelect ? "선택" : "확정된 일보는 선택할 수 없습니다"}
                />
              </div>

              {/* 본문: 클릭 → 상세 (Part 13C) */}
              <Link
                href={`/v2/daily-reports/${r.id}`}
                style={{
                  flex: 1, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 16,
                  color: "inherit", textDecoration: "none",
                  flexWrap: "wrap",
                }}
              >
                {/* 날짜 */}
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                    {fmtDateKor(r.report_date)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {r.report_date}
                  </div>
                </div>

                {/* 사업장 + 상태 */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px", borderRadius: 4,
                      background: sty.bg, color: sty.color,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {sty.label}
                    </span>
                    {r.event_flag && (
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px", borderRadius: 4,
                        background: "#fef3c7", color: "#b45309",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        🎉 {r.event_name || "행사"}
                      </span>
                    )}
                    {r.weather && (
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {weatherEmoji(r.weather)} {r.weather}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {siteCode}{store.name || "(사업장 미상)"}
                  </div>
                  {r.memo && (
                    <div style={{
                      fontSize: 12, color: "#64748b", marginTop: 4,
                      maxWidth: 480, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      💬 {r.memo}
                    </div>
                  )}
                </div>

                {/* 통계 */}
                <div style={{ display: "flex", gap: 18, flexShrink: 0 }}>
                  <Stat label="총입차" value={r.total_cars} unit="대" />
                  <Stat label="발렛" value={r.valet_count} unit="대" />
                  <Stat label="매출" value={fmtMoney(r.total_revenue)} unit="원" highlight />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: any; unit: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "right", minWidth: 70 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: highlight ? 16 : 14,
        fontWeight: highlight ? 800 : 700,
        color: highlight ? "#1428A0" : "#0f172a",
        marginTop: 2,
      }}>
        {value ?? 0}
        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  );
}

function weatherEmoji(w: string): string {
  const m: Record<string, string> = {
    "맑음": "☀️", "흐림": "☁️", "비": "🌧", "눈": "❄️", "안개": "🌫", "황사": "😷",
  };
  return m[w] || "";
}
