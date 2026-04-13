// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 근태 매트릭스 테이블 (Part 12A)
 *
 * 행: 직원 / 열: 1~말일 + 집계
 * 셀: 8종 상태 컬러 뱃지 (출/지/피/지원/추/연차/휴/결)
 *
 * props:
 *   - year, month, matrix, summary, employees: /api/v1/attendance 응답
 *   - onCellClick?: (empId, date, row) => void  (Part 12B에서 OverrideModal 호출)
 */
"use client";

import { useMemo } from "react";

// ── 8종 상태 스타일 ──
const STATUS_STYLE: Record<string, { code: string; bg: string; color: string; label: string }> = {
  present:    { code: "출",   bg: "#dcfce7", color: "#15803d", label: "출근" },
  late:       { code: "지",   bg: "#fff7ed", color: "#ea580c", label: "지각" },
  peak:       { code: "피",   bg: "#fef3c7", color: "#b45309", label: "피크" },
  support:    { code: "지원", bg: "#dbeafe", color: "#1d4ed8", label: "지원" },
  additional: { code: "추",   bg: "#e0e7ff", color: "#4338ca", label: "추가" },
  leave:      { code: "연차", bg: "#ede9fe", color: "#7c3aed", label: "연차" },
  off:        { code: "휴",   bg: "#f1f5f9", color: "#475569", label: "휴무" },
  absent:     { code: "결",   bg: "#fee2e2", color: "#dc2626", label: "결근" },
};

// ── 날짜 문자열 빌드 (YYYY-MM-DD) ──
function pad2(n: number) { return n < 10 ? "0" + n : String(n); }
function buildDates(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) out.push(`${year}-${pad2(month)}-${pad2(d)}`);
  return out;
}

// ── 요일 (일=일 / 월=월 / 토=토) ──
function dayLabel(dateStr: string): { text: string; isWeekend: boolean } {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const texts = ["일", "월", "화", "수", "목", "금", "토"];
  return { text: texts[day], isWeekend: day === 0 || day === 6 };
}

export default function AttendanceMatrix({
  year,
  month,
  employees,
  matrix,
  summary,
  stores = [],
  onCellClick,
}: {
  year: number;
  month: number;
  employees: any[];
  matrix: Record<string, Record<string, any>>;
  summary: Record<string, any>;
  stores?: { id: string; name: string }[];
  onCellClick?: (empId: string, date: string, row: any) => void;
}) {
  const dates = useMemo(() => buildDates(year, month), [year, month]);
  const storeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of stores) m[s.id] = s.name;
    return m;
  }, [stores]);

  if (!employees || employees.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center", color: "#64748b",
        background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
      }}>
        조회된 직원이 없습니다.
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
      overflow: "auto", maxHeight: "calc(100vh - 280px)",
    }}>
      <table style={{
        width: "100%", borderCollapse: "separate", borderSpacing: 0,
        fontSize: 12, tableLayout: "fixed",
      }}>
        <thead>
          <tr>
            {/* 고정 좌측 — 직원 */}
            <th style={stHeaderFixed(0, 150, "#f8fafc", 3)}>직원</th>
            <th style={stHeaderFixed(150, 80, "#f8fafc", 3)}>주사업장</th>
            {/* 일자 */}
            {dates.map((d) => {
              const { text, isWeekend } = dayLabel(d);
              const dayNum = Number(d.split("-")[2]);
              return (
                <th key={d} style={{
                  ...stHeader,
                  background: isWeekend ? "#fef2f2" : "#f8fafc",
                  color: isWeekend ? "#dc2626" : "#0f172a",
                  minWidth: 34, width: 34,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{dayNum}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.8 }}>{text}</div>
                </th>
              );
            })}
            {/* 집계 */}
            {["출근", "지각", "연차", "휴무", "결근", "시간"].map((k) => (
              <th key={k} style={{ ...stHeader, background: "#1428A0", color: "#fff", minWidth: 46, width: 46 }}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const empMatrix = matrix[emp.employee_id] || {};
            const sum = summary[emp.employee_id] || {};
            return (
              <tr key={emp.employee_id}>
                <td style={stBodyFixed(0, 150, "#fff", 2)}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{emp.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{emp.emp_no}</div>
                </td>
                <td style={stBodyFixed(150, 80, "#fff", 2)}>
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    {storeMap[emp.primary_store_id] || "—"}
                  </span>
                </td>
                {dates.map((d) => {
                  const row = empMatrix[d];
                  const status = row?.status;
                  const st = status ? STATUS_STYLE[status] : null;
                  const isOverride = !!row?.is_override;
                  const { isWeekend } = dayLabel(d);
                  return (
                    <td
                      key={d}
                      onClick={() => onCellClick && onCellClick(emp.employee_id, d, row || null)}
                      title={st
                        ? `${st.label}${row.check_in ? " · " + row.check_in.slice(0, 5) : ""}${row.store_name ? " · " + row.store_name : ""}${isOverride ? " · 수정됨" : ""}`
                        : "미기록"
                      }
                      style={{
                        ...stBody,
                        background: isWeekend ? "#fef9f9" : "#fff",
                        cursor: onCellClick ? "pointer" : "default",
                        padding: 2,
                      }}
                    >
                      {st ? (
                        <div style={{
                          background: st.bg, color: st.color,
                          fontWeight: 700, fontSize: 10,
                          padding: "3px 0", borderRadius: 4,
                          border: isOverride ? `1.5px solid ${st.color}` : "none",
                          position: "relative",
                        }}>
                          {st.code}
                          {isOverride && (
                            <span style={{
                              position: "absolute", top: -3, right: -3,
                              width: 6, height: 6, borderRadius: "50%",
                              background: "#F5B731", border: "1px solid #fff",
                            }} />
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 11 }}>·</span>
                      )}
                    </td>
                  );
                })}
                {/* 집계 */}
                <td style={stSum}>{sum.total || 0}</td>
                <td style={stSum}>{sum.late || 0}</td>
                <td style={stSum}>{sum.leave || 0}</td>
                <td style={stSum}>{sum.off || 0}</td>
                <td style={stSum}>{sum.absent || 0}</td>
                <td style={stSum}>{sum.total_hours ? Number(sum.total_hours).toFixed(1) : "0.0"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 스타일 ──
// z-index 계층 (좌상단 교차 셀이 모두 가려지지 않도록):
//   일반 body cell        : z=0 (default)
//   좌측 고정 body cell    : z=2 (좌측 sticky만)
//   상단 일반 header       : z=3 (top sticky만, 좌측 body보다 위)
//   좌상단 고정 header     : z=5 (top+left sticky, 가장 위)
const stHeader: React.CSSProperties = {
  padding: "8px 4px", textAlign: "center",
  borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
  position: "sticky", top: 0, zIndex: 3,
  fontWeight: 700,
};
function stHeaderFixed(left: number, width: number, bg: string, z: number): React.CSSProperties {
  return {
    ...stHeader,
    position: "sticky", top: 0, left, zIndex: 5,
    background: bg, minWidth: width, width, textAlign: "left", paddingLeft: 10,
  };
}
const stBody: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9",
  textAlign: "center", verticalAlign: "middle", height: 34,
};
function stBodyFixed(left: number, width: number, bg: string, z: number): React.CSSProperties {
  return {
    ...stBody,
    position: "sticky", left, zIndex: z,
    background: bg, minWidth: width, width, textAlign: "left", paddingLeft: 10,
  };
}
const stSum: React.CSSProperties = {
  ...stBody,
  background: "#f8fafc", fontWeight: 700, color: "#1428A0", fontSize: 12,
};
