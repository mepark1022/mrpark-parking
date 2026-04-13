// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 작성 페이지 (Part 13B)
 *
 * 경로: /v2/daily-reports/new
 *
 * 섹션 구성:
 *   1. 기본정보   사업장 / 날짜 / 날씨 / 행사 / 총입차 / 메모
 *   2. 근무인원   직원 추가/삭제 + 구분(staff_type) + 출퇴근 + 근무시간
 *   3. 결제매출   방법별 금액 + 자동 합계
 *
 * 액션:
 *   - 임시저장 (status='draft')
 *   - 제출하기 (status='submitted')
 *
 * 성공 시 → /v2/daily-reports 목록으로 이동
 *
 * 사진 업로드는 작성 완료 후 상세 페이지(Part 13C)에서 진행.
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StaffSection from "./StaffSection";
import PaymentSection from "./PaymentSection";

// ── 오늘 날짜 (YYYY-MM-DD) ──
function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEATHER_OPTIONS = ["", "맑음", "흐림", "비", "눈", "안개", "황사"];

export default function NewDailyReportPage() {
  const router = useRouter();

  // ── 기본정보 ──
  const [storeId, setStoreId] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>(getToday());
  const [weather, setWeather] = useState<string>("");
  const [eventFlag, setEventFlag] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");
  const [totalCars, setTotalCars] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  // ── 근무인원 / 결제매출 ──
  const [staffList, setStaffList] = useState<any[]>([]);
  const [paymentList, setPaymentList] = useState<any[]>([]);

  // ── 보조 데이터 ──
  const [stores, setStores] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 사업장 목록 로드 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/stores?limit=200", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const list = json?.data || [];
        setStores(list);
        // 사업장이 1개뿐이면 자동 선택
        if (list.length === 1) setStoreId(list[0].id);
      } catch {
        // noop
      }
    })();
  }, []);

  // ── 사업장 변경 시 직원 목록 재조회 ──
  useEffect(() => {
    if (!storeId) {
      setEmployees([]);
      return;
    }
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("store_id", storeId);
        params.set("limit", "200");
        const res = await fetch(`/api/v1/employees?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json();
        setEmployees(json?.data || []);
      } catch {
        // noop
      }
    })();
  }, [storeId]);

  // ── 매출 합계 (미리보기) ──
  const totalRevenue = paymentList.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
  const valetCount = paymentList.find((p) => p.method === "valet_fee")?.count ?? 0;

  // ── 검증 ──
  function validate(): string | null {
    if (!storeId) return "사업장을 선택해주세요";
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate))
      return "날짜를 확인해주세요 (YYYY-MM-DD)";
    if (eventFlag && !eventName.trim())
      return "행사명을 입력하거나 행사 체크를 해제해주세요";
    for (const s of staffList) {
      if (!s.employee_id) return "근무인원의 직원을 모두 선택해주세요";
      if (!s.staff_type) return "근무인원의 구분을 모두 선택해주세요";
    }
    for (const p of paymentList) {
      if (!p.method) return "결제수단을 모두 선택해주세요";
      if (p.amount === "" || p.amount === null || isNaN(Number(p.amount)))
        return "결제 금액을 모두 입력해주세요";
      if (Number(p.amount) < 0) return "결제 금액은 0 이상이어야 합니다";
    }
    return null;
  }

  // ── 저장 ──
  async function handleSave(status: "draft" | "submitted") {
    const err = validate();
    if (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const body = {
        store_id: storeId,
        report_date: reportDate,
        status,
        weather: weather || null,
        event_flag: eventFlag,
        event_name: eventFlag ? eventName.trim() : null,
        memo: memo.trim() || null,
        total_cars: Number(totalCars || 0),
        staff: staffList.map((s) => ({
          employee_id: s.employee_id,
          staff_type: s.staff_type,
          role: s.role || null,
          check_in: s.check_in || null,
          check_out: s.check_out || null,
          work_hours: s.work_hours === "" || s.work_hours == null ? null : Number(s.work_hours),
          memo: s.memo || null,
        })),
        payment: paymentList.map((p) => ({
          method: p.method,
          amount: Number(p.amount || 0),
          count: Number(p.count || 0),
          memo: p.memo || null,
        })),
      };

      const res = await fetch("/api/v1/daily-reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        // 중복 일보 안내
        if (json?.error?.code === "REPORT_DUPLICATE_DATE") {
          const existingId = json?.error?.details?.existing_id;
          if (existingId && confirm("이미 해당 날짜의 일보가 있습니다. 기존 일보로 이동할까요?")) {
            router.push(`/v2/daily-reports/${existingId}`);
            return;
          }
          setError("해당 날짜에 이미 일보가 존재합니다");
          return;
        }
        setError(json?.error?.message || `저장 실패 (${res.status})`);
        return;
      }
      const data = json?.data || json;
      const newId = data?.report?.id;
      const action = status === "submitted" ? "제출" : "임시저장";
      alert(`✅ ${action} 완료\n근무인원 ${data?.staff_count ?? 0}명 / 결제 ${data?.payment_count ?? 0}건`);

      // 상세로 이동 (Part 13C 미구현 시에도 자동 fallback)
      if (newId) router.push(`/v2/daily-reports/${newId}`);
      else router.push("/v2/daily-reports");
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <Link href="/v2/daily-reports" style={{
            fontSize: 12, color: "#64748b", textDecoration: "none",
          }}>
            ← 목록으로
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "6px 0 0" }}>
            현장일보 작성
          </h1>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            v2 · 일보 작성 (Part 13B)
          </div>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 16,
          background: "#fef2f2", color: "#b91c1c",
          border: "1px solid #fecaca", fontSize: 13, fontWeight: 600,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* 1. 기본정보 */}
      <Section title="📋 기본정보">
        <Grid>
          <Field label="사업장" required>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              style={inputStyle}
            >
              <option value="">사업장 선택</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.site_code ? `[${s.site_code}] ` : ""}{s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="날짜" required>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="날씨">
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              style={inputStyle}
            >
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>{w || "선택 안 함"}</option>
              ))}
            </select>
          </Field>

          <Field label="총 입차 (대)">
            <input
              type="number"
              value={totalCars}
              onChange={(e) => setTotalCars(e.target.value)}
              placeholder="예: 120"
              min={0}
              style={inputStyle}
            />
          </Field>

          <Field label="행사">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#475569", cursor: "pointer",
                padding: "0 10px", height: 38,
                border: "1px solid #cbd5e1", borderRadius: 8,
                background: eventFlag ? "#fef3c7" : "#fff",
              }}>
                <input
                  type="checkbox"
                  checked={eventFlag}
                  onChange={(e) => setEventFlag(e.target.checked)}
                />
                🎉 행사 있음
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="행사명 (예: 결혼식, 콘서트)"
                disabled={!eventFlag}
                style={{
                  ...inputStyle, flex: 1,
                  background: eventFlag ? "#fff" : "#f1f5f9",
                }}
              />
            </div>
          </Field>

          <Field label="메모" full>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항, 인계사항 등"
              rows={2}
              style={{
                ...inputStyle, height: "auto", padding: "10px 12px",
                fontFamily: "inherit", resize: "vertical",
              }}
            />
          </Field>
        </Grid>
      </Section>

      {/* 2. 근무인원 */}
      <Section title={`👥 근무인원 (${staffList.length}명)`}>
        {!storeId ? (
          <EmptyHint>먼저 사업장을 선택해주세요</EmptyHint>
        ) : (
          <StaffSection
            staffList={staffList}
            employees={employees}
            onChange={setStaffList}
          />
        )}
      </Section>

      {/* 3. 결제매출 */}
      <Section
        title={`💰 결제매출 (${paymentList.length}건)`}
        right={
          <div style={{ fontSize: 13, color: "#64748b", display: "flex", gap: 16 }}>
            {valetCount > 0 && (
              <span>발렛 <strong style={{ color: "#0f172a" }}>{valetCount}</strong>대</span>
            )}
            <span>합계 <strong style={{ color: "#1428A0", fontSize: 16 }}>
              {totalRevenue.toLocaleString("ko-KR")}
            </strong>원</span>
          </div>
        }
      >
        <PaymentSection
          paymentList={paymentList}
          onChange={setPaymentList}
        />
      </Section>

      {/* 액션 버튼 */}
      <div style={{
        position: "sticky", bottom: 0,
        background: "#fff",
        padding: "16px 0",
        borderTop: "1px solid #e2e8f0",
        display: "flex", justifyContent: "flex-end", gap: 8,
        marginTop: 20,
      }}>
        <Link
          href="/v2/daily-reports"
          style={{
            height: 42, padding: "0 18px", borderRadius: 8,
            background: "#fff", color: "#475569",
            border: "1px solid #cbd5e1",
            fontWeight: 700, fontSize: 14,
            textDecoration: "none",
            display: "inline-flex", alignItems: "center",
          }}
        >
          취소
        </Link>
        <button
          onClick={() => handleSave("draft")}
          disabled={submitting}
          style={{
            height: 42, padding: "0 18px", borderRadius: 8,
            background: "#fff", color: "#1428A0",
            border: "1.5px solid #1428A0",
            fontWeight: 700, fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          💾 임시저장
        </button>
        <button
          onClick={() => handleSave("submitted")}
          disabled={submitting}
          style={{
            height: 42, padding: "0 22px", borderRadius: 8,
            background: submitting ? "#94a3b8" : "#1428A0",
            color: "#fff",
            border: "none",
            fontWeight: 800, fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "저장 중..." : "✅ 제출하기"}
        </button>
      </div>
    </div>
  );
}

// ── 레이아웃 헬퍼 ──
function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0",
      padding: 20, marginBottom: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, paddingBottom: 12,
        borderBottom: "1px solid #f1f5f9",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 14,
    }}>
      {children}
    </div>
  );
}
function Field({ label, children, required, full }: { label: string; children: React.ReactNode; required?: boolean; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 30, textAlign: "center", color: "#94a3b8",
      background: "#f8fafc", borderRadius: 8, fontSize: 13,
    }}>
      {children}
    </div>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 10px",
  borderRadius: 8, border: "1px solid #cbd5e1",
  background: "#fff", fontSize: 13, color: "#0f172a",
  boxSizing: "border-box",
};
