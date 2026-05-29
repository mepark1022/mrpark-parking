/**
 * 미팍 통합앱 v2 — CREW 마감보고 작성 (Part 13D — 2026.05.29)
 *
 * 경로: /v2/crew/daily-report/new
 * 진입점: layout.tsx BottomNav 5번째 "마감" 탭
 *
 * 어드민 작성화면(`/v2/daily-reports/new`)과의 차이:
 * - 매장 = localStorage.crew_store_id 고정 (드롭다운 제거, 헤더에 매장명만)
 * - 모바일 풀폭 레이아웃 + CREW 네이비 그라데이션 헤더
 * - sticky 하단 액션바 (BottomNav 위로 띄움)
 * - 제출 후: 어드민 상세 페이지(`/v2/daily-reports/${id}`)로는 못 감 (layout 충돌)
 *   → 알림 후 CREW 홈으로 redirect
 *
 * 재사용:
 * - StaffSection / PaymentSection (어드민과 100% 동일, import 0건 순수 컴포넌트)
 * - POST /api/v1/daily-reports (OPERATE 허용)
 *
 * Part 13D 진행 단계 — Part A (BottomNav 마감 탭 + 작성화면). Part B(출차 토스트)는 별도.
 */
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StaffSection from "@/app/v2/daily-reports/new/StaffSection";
import PaymentSection from "@/app/v2/daily-reports/new/PaymentSection";

// ── 오늘 날짜 (YYYY-MM-DD) ──
function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateKr(s: string): string {
  if (!s) return "";
  try {
    const [y, m, d] = s.split("-");
    const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(s).getDay()];
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${w})`;
  } catch {
    return s;
  }
}

const WEATHER_OPTIONS = ["", "맑음", "흐림", "비", "눈", "안개", "황사"];

// ── 공통 인풋 스타일 ──
const inpStyle: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 12px",
  borderRadius: 10, border: "1px solid #cbd5e1",
  background: "#fff", fontSize: 14, color: "#0f172a",
  fontFamily: "inherit",
};

export default function CrewDailyReportNewPage() {
  const router = useRouter();

  // ── 매장 (localStorage 고정) ──
  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [storeLoading, setStoreLoading] = useState(true);

  // ── 기본정보 폼 ──
  const [reportDate, setReportDate] = useState<string>(getToday());
  const [weather, setWeather] = useState<string>("");
  const [eventFlag, setEventFlag] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");
  const [totalCars, setTotalCars] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  // ── 근무인원 / 결제 ──
  const [employees, setEmployees] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [paymentList, setPaymentList] = useState<any[]>([]);

  // ── 상태 ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── ① 매장 ID 로드 (localStorage) ──
  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("crew_store_id") : null;
    if (!sid) {
      router.push("/v2/crew/select-store");
      return;
    }
    setStoreId(sid);
  }, [router]);

  // ── ② 매장명 + employees 로드 (storeId 잡힌 후) ──
  useEffect(() => {
    if (!storeId) return;
    let canceled = false;
    (async () => {
      try {
        // 매장명
        const sres = await fetch(`/api/v1/stores/${storeId}`, { credentials: "include" });
        if (sres.ok) {
          const sjson = await sres.json();
          if (!canceled) setStoreName(sjson?.data?.name || sjson?.data?.store?.name || "");
        }
        // employees
        const params = new URLSearchParams();
        params.set("store_id", storeId);
        const eres = await fetch(`/api/v1/employees?${params}`, { credentials: "include" });
        if (eres.ok) {
          const ejson = await eres.json();
          if (!canceled) setEmployees(ejson?.data?.employees || ejson?.data || []);
        }
      } catch {
        /* 무시 — 부분 실패는 폼 사용엔 영향 없음 */
      } finally {
        if (!canceled) setStoreLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [storeId]);

  // ── 검증 (어드민 페이지와 동일 규칙) ──
  function validate(): string | null {
    if (!storeId) return "사업장을 확인해주세요";
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

  // ── 저장 (어드민 body 계약과 100% 동일) ──
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
        if (json?.error?.code === "REPORT_DUPLICATE_DATE") {
          // CREW는 어드민 상세로 못 가니 머물면서 알림만
          setError("해당 날짜에 이미 작성된 일보가 있습니다");
          return;
        }
        setError(json?.error?.message || `저장 실패 (${res.status})`);
        return;
      }
      const data = json?.data || json;
      const action = status === "submitted" ? "제출" : "임시저장";
      alert(`✅ ${action} 완료\n근무인원 ${data?.staff_count ?? 0}명 / 결제 ${data?.payment_count ?? 0}건`);
      router.push("/v2/crew");
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 로딩 / 매장 미선택 ──
  if (!storeId || storeLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
        매장 확인 중...
      </div>
    );
  }

  // ── 렌더 ──
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      paddingBottom: "calc(168px + env(safe-area-inset-bottom, 0px))", // BottomNav(~88) + 액션바(~76) + 여유
    }}>
      {/* ── CREW 네이비 헤더 ── */}
      <div style={{
        background: "linear-gradient(135deg, #0a1352 0%, #1428A0 100%)",
        padding: "42px 20px 20px",
      }}>
        <Link href="/v2/crew" style={{
          fontSize: 13, color: "rgba(255,255,255,0.78)",
          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
        }}>
          ← 홈으로
        </Link>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
          📋 마감 보고
        </div>
        <div style={{ fontSize: 13, color: "#F5B731", fontWeight: 600, marginTop: 4 }}>
          {storeName || "사업장"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 2 }}>
          {formatDateKr(reportDate)}
        </div>
      </div>

      {/* ── 에러 배너 ── */}
      {error && (
        <div style={{
          margin: "12px 16px 0",
          padding: "12px 14px",
          background: "#FEF2F2",
          border: "1px solid #FCA5A5",
          borderRadius: 10,
          color: "#B91C1C",
          fontSize: 13,
          fontWeight: 600,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── 폼 본문 ── */}
      <div style={{ padding: "16px 16px 24px" }}>
        {/* 기본정보 */}
        <Section title="📋 기본정보">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Field label="날짜" required>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={inpStyle} />
            </Field>
            <Field label="날씨">
              <select value={weather} onChange={(e) => setWeather(e.target.value)} style={inpStyle}>
                {WEATHER_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w || "선택 안 함"}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="총 입차 (대)">
            <input
              type="number"
              inputMode="numeric"
              value={totalCars}
              onChange={(e) => setTotalCars(e.target.value)}
              placeholder="예: 120"
              style={inpStyle}
            />
          </Field>
          <Field label="행사">
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0 14px", height: 42, border: "1px solid #cbd5e1",
              borderRadius: 10, fontSize: 13, color: "#475569", cursor: "pointer",
            }}>
              <input type="checkbox" checked={eventFlag} onChange={(e) => setEventFlag(e.target.checked)} />
              🎉 행사 있음
            </label>
            {eventFlag && (
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="행사명 입력 (필수)"
                style={{ ...inpStyle, marginTop: 8 }}
              />
            )}
          </Field>
          <Field label="메모">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="특이사항, 인계사항 등"
              style={{ ...inpStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
            />
          </Field>
        </Section>

        {/* 근무인원 — 어드민 컴포넌트 재사용 */}
        <StaffSection
          staffList={staffList}
          employees={employees}
          onChange={setStaffList}
        />

        {/* 결제매출 — 어드민 컴포넌트 재사용 */}
        <PaymentSection
          paymentList={paymentList}
          onChange={setPaymentList}
        />
      </div>

      {/* ── sticky 하단 액션바 (BottomNav 위로 띄움) ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
        left: 0, right: 0,
        background: "#fff",
        borderTop: "1px solid #e2e8f0",
        padding: "12px 16px",
        display: "flex", gap: 8,
        zIndex: 90,
        boxShadow: "0 -4px 16px rgba(10,19,82,0.06)",
      }}>
        <button
          onClick={() => handleSave("draft")}
          disabled={submitting}
          style={{
            flex: "0 0 110px", height: 48, borderRadius: 12,
            fontSize: 15, fontWeight: 800,
            background: "#fff", color: "#1428A0",
            border: "1.5px solid #1428A0",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.55 : 1,
            fontFamily: "inherit",
          }}
        >
          💾 임시저장
        </button>
        <button
          onClick={() => handleSave("submitted")}
          disabled={submitting}
          style={{
            flex: 1, height: 48, borderRadius: 12,
            fontSize: 15, fontWeight: 800,
            background: "#1428A0", color: "#fff",
            border: "none",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.55 : 1,
            fontFamily: "inherit",
          }}
        >
          ✅ {submitting ? "저장 중..." : "제출하기"}
        </button>
      </div>
    </div>
  );
}

// ── 보조 컴포넌트 ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: "1px solid #E2E8F0",
      padding: 16,
      marginBottom: 14,
    }}>
      <div style={{
        padding: "0 0 12px",
        marginBottom: 14,
        borderBottom: "1px solid #F1F5F9",
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block",
        fontSize: 12, fontWeight: 700, color: "#475569",
        marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
