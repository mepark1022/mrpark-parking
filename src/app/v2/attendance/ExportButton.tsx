// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 근태 Excel 다운로드 버튼 (Part 12A)
 * GET /api/v1/attendance/export?year=&month=&store_id=
 *
 * 쿠키 기반 세션 인증이므로 credentials: 'include' 필요.
 * 응답이 xlsx 바이너리이므로 blob으로 받아 <a download>로 저장.
 */
"use client";

import { useState } from "react";

export default function ExportButton({
  year,
  month,
  storeId,
}: {
  year: number;
  month: number;
  storeId?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(month).padStart(2, "0"));
      if (storeId) params.set("store_id", storeId);

      const res = await fetch(`/api/v1/attendance/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(`Excel 다운로드 실패 (${res.status})\n${text.slice(0, 200)}`);
        return;
      }
      const blob = await res.blob();
      const filename = `근태_${year}-${String(month).padStart(2, "0")}${storeId ? "_사업장" : ""}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Excel 다운로드 오류: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        height: 38, padding: "0 16px", borderRadius: 8,
        background: loading ? "#94a3b8" : "#1428A0", color: "#fff",
        border: "none", fontWeight: 700, fontSize: 13,
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}
    >
      {loading ? "다운로드 중..." : "📥 Excel 다운로드"}
    </button>
  );
}
