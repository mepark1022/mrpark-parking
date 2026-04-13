// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 Excel 다운로드 (Part 13A)
 *
 * GET /api/v1/daily-reports/export?date_from=&date_to=&store_id=
 * 응답: blob (xlsx) → a.download
 *
 * 권한: MANAGE (admin/super_admin) — crew/field는 403 받으면 알림
 */
"use client";

import { useState } from "react";

interface Props {
  dateFrom: string;
  dateTo: string;
  storeId?: string;
}

export default function ExportButton({ dateFrom, dateTo, storeId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!dateFrom || !dateTo) {
      alert("시작/종료 날짜를 모두 선택해주세요");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo);
      if (storeId) params.set("store_id", storeId);

      const res = await fetch(`/api/v1/daily-reports/export?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        // 에러는 JSON일 가능성이 높음
        let msg = `다운로드 실패 (${res.status})`;
        try {
          const json = await res.json();
          msg = json?.error?.message || msg;
        } catch {
          // blob 응답이지만 실패 → 그대로 표시
        }
        alert(msg);
        return;
      }

      // blob → a.download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const storeSuffix = storeId ? "_사업장" : "";
      a.download = `현장일보_${dateFrom}_${dateTo}${storeSuffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        height: 38, padding: "0 14px", borderRadius: 8,
        background: "#fff", color: "#15803d",
        border: "1.5px solid #15803d",
        fontWeight: 700, fontSize: 13,
        cursor: loading ? "wait" : "pointer",
      }}
      title="기간 내 일보를 Excel로 다운로드"
    >
      {loading ? "다운로드 중..." : "📥 Excel"}
    </button>
  );
}
