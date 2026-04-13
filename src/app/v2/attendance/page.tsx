// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 근태 관리 페이지 (Part 12A)
 *
 * 경로: /v2/attendance
 *
 * 기능:
 *   - 년/월/사업장 필터
 *   - /api/v1/attendance 호출 → 매트릭스 렌더링
 *   - Excel 다운로드 버튼
 *   - 셀 클릭 → onCellClick (Part 12B에서 OverrideModal 연결)
 *
 * 쿠키 기반 세션 인증: fetch credentials: 'include' 필수
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import AttendanceMatrix from "./AttendanceMatrix";
import ExportButton from "./ExportButton";

// ── 년/월 기본값 = 오늘 기준 ──
function getDefaultYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function AttendancePage() {
  const def = getDefaultYM();
  const [year, setYear] = useState<number>(def.year);
  const [month, setMonth] = useState<number>(def.month);
  const [storeId, setStoreId] = useState<string>("");

  const [stores, setStores] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<Record<string, any>>({});
  const [summary, setSummary] = useState<Record<string, any>>({});

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
      } catch (e) {
        // 사업장 조회 실패는 치명적이지 않음 (드롭다운만 비어있음)
      }
    })();
  }, []);

  // ── 근태 매트릭스 로드 ──
  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(month).padStart(2, "0"));
      if (storeId) params.set("store_id", storeId);

      const res = await fetch(`/api/v1/attendance?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || `조회 실패 (${res.status})`);
        setEmployees([]); setMatrix({}); setSummary({});
        return;
      }
      const data = json?.data || json;
      setEmployees(data.employees || []);
      setMatrix(data.matrix || {});
      setSummary(data.summary || {});
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [year, month, storeId]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ── 년/월 옵션 ──
  const years: number[] = [];
  for (let y = def.year - 2; y <= def.year + 1; y++) years.push(y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // ── 셀 클릭 핸들러 (Part 12B에서 모달 연결) ──
  function handleCellClick(empId: string, date: string, row: any) {
    console.log("[v2/attendance] cell click", { empId, date, row });
    // Part 12B에서 OverrideModal open 처리
  }

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: "100%" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            근태 관리
          </h1>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            v2 · 월매트릭스 + 직접수정 (Part 12)
          </div>
        </div>
        <ExportButton year={year} month={month} storeId={storeId} />
      </div>

      {/* 필터 바 */}
      <div style={{
        background: "#fff", padding: 14, borderRadius: 12,
        border: "1px solid #e2e8f0", marginBottom: 16,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <Label>년</Label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <Label>월</Label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
          {months.map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>

        <Label>사업장</Label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ ...selectStyle, minWidth: 180 }}>
          <option value="">전체</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button onClick={loadAttendance} disabled={loading} style={{
          height: 38, padding: "0 16px", borderRadius: 8,
          background: loading ? "#94a3b8" : "#0f172a", color: "#fff",
          border: "none", fontWeight: 700, fontSize: 13,
          cursor: loading ? "wait" : "pointer",
        }}>
          {loading ? "조회중..." : "조회"}
        </button>

        {/* 상태 범례 */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Legend bg="#dcfce7" color="#15803d" label="출" />
          <Legend bg="#fff7ed" color="#ea580c" label="지" />
          <Legend bg="#fef3c7" color="#b45309" label="피" />
          <Legend bg="#dbeafe" color="#1d4ed8" label="지원" />
          <Legend bg="#e0e7ff" color="#4338ca" label="추" />
          <Legend bg="#ede9fe" color="#7c3aed" label="연차" />
          <Legend bg="#f1f5f9" color="#475569" label="휴" />
          <Legend bg="#fee2e2" color="#dc2626" label="결" />
        </div>
      </div>

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

      {/* 매트릭스 */}
      {loading ? (
        <div style={{
          padding: 60, textAlign: "center", color: "#64748b",
          background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
        }}>
          불러오는 중...
        </div>
      ) : (
        <AttendanceMatrix
          year={year}
          month={month}
          employees={employees}
          matrix={matrix}
          summary={summary}
          stores={stores}
          onCellClick={handleCellClick}
        />
      )}

      {/* 직원 수 */}
      {!loading && employees.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", textAlign: "right" }}>
          총 {employees.length}명
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
  minWidth: 86,
};
function Legend({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: bg, color, fontWeight: 700, fontSize: 11,
      padding: "3px 8px", borderRadius: 4,
    }}>{label}</span>
  );
}
