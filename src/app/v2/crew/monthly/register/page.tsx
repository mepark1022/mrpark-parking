// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";
import { getToday, toKSTDateStr } from "@/lib/utils/date";

/**
 * CREW v2 월주차 등록/수정 페이지 (GAP-P1-7 Part 3)
 * - 레거시 src/app/crew/monthly/register/page.tsx 이식. 단, Supabase 직접호출 전면 제거.
 * - 데이터는 전부 v1 API 경유 (credentials:include):
 *   · 신규  : POST  /api/v1/monthly
 *   · 수정 로드 : GET   /api/v1/monthly/[id]
 *   · 수정 저장 : PATCH /api/v1/monthly/[id]
 *   → P1-7 Part 1에서 게이트 OPERATE 완화로 CREW 호출 가능. crew는 API 내부에서 배정 store로 스코핑.
 * - store_id = localStorage.crew_store_id (없으면 /v2/crew/login 회귀), 401 → 로그인 회귀
 * - 연락처(customer_phone)는 월주차 정책 예외로 평문 수집 (만기 알림 필요 / accidents와 반대)
 * - 기본 월요금 자동조회(레거시 visit_places)는 visit-places API가 MANAGE 게이트라 보류 → 기본값 150,000(편집 가능)
 * - 삭제버튼 미노출 (API도 DELETE=MANAGE, CREW 불가)
 * - BottomNav/NavSpacer는 v2/crew/layout 상속 → 여기서 수동 추가 금지.
 * - 네임스페이스 cv2mreg-*, NAVY/GOLD/Outfit.
 */

/* ─────────────────────────────────────────────
   CSS (네임스페이스 cv2mreg-*)
───────────────────────────────────────────── */
const CSS = `
  .cv2mreg-page { min-height:100dvh; background:#F8FAFC; font-family:'Noto Sans KR', sans-serif; }

  /* 헤더 (NAVY 그라데이션) — 조회 페이지와 동일 톤 */
  .cv2mreg-header {
    background:linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding:14px 16px; padding-top:calc(14px + env(safe-area-inset-top, 0));
    color:#fff; display:flex; align-items:center; gap:12px;
  }
  .cv2mreg-back-btn {
    width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.15);
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    -webkit-tap-highlight-color:transparent; flex-shrink:0;
  }
  .cv2mreg-back-btn:active { background:rgba(255,255,255,0.25); }
  .cv2mreg-header-title { font-size:16px; font-weight:700; flex:1; }

  /* 에러 배너 */
  .cv2mreg-error {
    margin:12px 16px 0; padding:12px 14px; border-radius:12px;
    background:#FEE2E2; border:1px solid #FCA5A5; color:#B91C1C;
    font-size:13px; font-weight:700; line-height:1.5;
    display:flex; align-items:flex-start; gap:8px;
  }

  .cv2mreg-form { padding:16px; }

  /* 미리보기 카드 */
  .cv2mreg-preview {
    background:linear-gradient(135deg, #1428A0 0%, #1e3a8a 100%);
    border-radius:16px; padding:18px; margin-bottom:14px; color:#fff;
  }
  .cv2mreg-preview-plate {
    font-size:22px; font-weight:900; letter-spacing:2px; margin-bottom:4px;
    font-family:'Outfit', 'Noto Sans KR', sans-serif;
  }
  .cv2mreg-preview-name { font-size:13px; color:rgba(255,255,255,.7); }
  .cv2mreg-preview-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:8px 0; border-top:1px solid rgba(255,255,255,.15);
  }
  .cv2mreg-preview-label { font-size:12px; color:rgba(255,255,255,.6); }
  .cv2mreg-preview-value { font-size:14px; font-weight:700; }
  .cv2mreg-preview-fee {
    font-size:24px; font-weight:900; color:#F5B731;
    text-align:right; margin-top:8px; font-family:'Outfit', sans-serif;
  }

  /* 섹션 */
  .cv2mreg-section {
    background:#fff; border-radius:16px; border:1px solid #E2E8F0;
    margin-bottom:14px; overflow:visible; box-shadow:0 1px 4px rgba(20,40,160,.04);
  }
  .cv2mreg-section-title {
    display:flex; align-items:center; gap:8px;
    padding:14px 16px; font-size:14px; font-weight:800; color:#1A1D2B;
    border-bottom:1px solid #F1F5F9;
  }
  .cv2mreg-section-bar { width:4px; height:16px; border-radius:2px; flex-shrink:0; }
  .cv2mreg-section-body { padding:16px; }

  .cv2mreg-field { margin-bottom:16px; }
  .cv2mreg-field:last-child { margin-bottom:0; }
  .cv2mreg-label {
    display:flex; align-items:center; gap:4px;
    font-size:13px; font-weight:700; color:#64748B; margin-bottom:7px;
  }
  .cv2mreg-required { color:#DC2626; font-size:13px; }

  .cv2mreg-input {
    width:100%; padding:12px 14px; border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:16px; color:#1A1D2B; background:#fff; outline:none; font-family:inherit;
    transition:border-color .2s; -webkit-appearance:none;
  }
  .cv2mreg-input:focus { border-color:#1428A0; }
  .cv2mreg-input::placeholder { color:#CBD5E1; }
  .cv2mreg-input.plate {
    font-weight:900; letter-spacing:2px; text-transform:uppercase; font-size:18px;
    font-family:'Outfit', 'Noto Sans KR', sans-serif;
  }

  .cv2mreg-select {
    width:100%; padding:12px 14px; border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:15px; color:#1A1D2B; background:#fff; outline:none; font-family:inherit;
    -webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 14px center;
  }
  .cv2mreg-select:focus { border-color:#1428A0; }

  .cv2mreg-textarea {
    width:100%; padding:12px 14px; border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:15px; color:#1A1D2B; background:#fff; outline:none; font-family:inherit;
    resize:none; line-height:1.6;
  }
  .cv2mreg-textarea:focus { border-color:#1428A0; }

  .cv2mreg-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

  /* 기간 퀵선택 */
  .cv2mreg-period-btns { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
  .cv2mreg-period-btn {
    flex:1; min-width:60px; padding:10px 0; border-radius:10px;
    border:1.5px solid #E2E8F0; background:#fff;
    font-size:14px; font-weight:700; color:#64748B;
    cursor:pointer; text-align:center; font-family:inherit;
    transition:all .15s; -webkit-tap-highlight-color:transparent;
  }
  .cv2mreg-period-btn:active { transform:scale(.96); }
  .cv2mreg-period-btn.active { border-color:#1428A0; background:#EEF2FF; color:#1428A0; }

  /* 요금 입력 */
  .cv2mreg-fee-wrap { position:relative; }
  .cv2mreg-fee-prefix {
    position:absolute; left:14px; top:50%; transform:translateY(-50%);
    font-size:14px; font-weight:700; color:#94A3B8;
  }
  .cv2mreg-fee-input {
    width:100%; padding:12px 14px 12px 28px; border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:18px; font-weight:800; color:#1428A0; background:#fff; outline:none;
    font-family:'Outfit', inherit; -webkit-appearance:none;
  }
  .cv2mreg-fee-input:focus { border-color:#1428A0; }

  /* 매장 정보 */
  .cv2mreg-store-box {
    background:#EEF2FF; border-radius:12px; padding:12px 16px;
    display:flex; align-items:center; gap:8px;
    font-size:13px; font-weight:700; color:#1428A0; margin-bottom:14px;
  }

  /* 저장 버튼 (인라인 — layout NavSpacer가 BottomNav 여백 처리) */
  .cv2mreg-save-area { padding:4px 16px 16px; }
  .cv2mreg-save-btn {
    width:100%; height:52px; border-radius:14px; border:none;
    font-size:16px; font-weight:800; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:all .15s; -webkit-tap-highlight-color:transparent;
  }
  .cv2mreg-save-btn:active { transform:scale(.98); }
  .cv2mreg-save-btn.ready { background:#1428A0; color:#fff; }
  .cv2mreg-save-btn.disabled { background:#E2E8F0; color:#94A3B8; cursor:not-allowed; }
  .cv2mreg-save-btn.saving { background:#94A3B8; color:#fff; cursor:not-allowed; }

  /* 완료 모달 */
  .cv2mreg-done-overlay {
    position:fixed; inset:0; z-index:200; background:rgba(0,0,0,.5);
    display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .cv2mreg-done-card {
    background:#fff; border-radius:24px; padding:32px 24px; text-align:center;
    max-width:320px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.2);
  }
  .cv2mreg-done-icon { font-size:56px; margin-bottom:16px; }
  .cv2mreg-done-title { font-size:20px; font-weight:800; color:#1A1D2B; margin-bottom:6px; }
  .cv2mreg-done-sub { font-size:14px; color:#64748B; margin-bottom:24px; line-height:1.6; }
  .cv2mreg-done-btn {
    width:100%; height:48px; border-radius:12px; border:none;
    font-size:15px; font-weight:700; cursor:pointer; font-family:inherit;
    margin-bottom:8px; -webkit-tap-highlight-color:transparent;
  }

  @keyframes cv2mreg-spin { to { transform:rotate(360deg); } }
`;

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */
function CrewV2MonthlyRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const today = getToday();
  const todayObj = new Date();
  const initialEndDate = toKSTDateStr(new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0));

  const [form, setForm] = useState({
    vehicle_number: "",
    vehicle_type: "",
    customer_name: "",
    customer_phone: "",
    start_date: today,
    end_date: initialEndDate,
    monthly_fee: 150000,
    payment_status: "unpaid",   // paid | unpaid (overdue는 관리자 전용 흐름)
    contract_status: "active",  // active | expired | cancelled (수정 모드에서만 노출)
    note: "",
  });

  const [periodMonths, setPeriodMonths] = useState(0);

  // 한글만 허용 필터 (고객명)
  function filterKorean(val: string) {
    return val.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, "");
  }

  // ── 초기화: store 가드 + (수정 모드면) 기존 데이터 API 로드 ──
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(localStorage.getItem("crew_store_name") || "매장");

    if (editId) {
      (async () => {
        try {
          const res = await fetch(`/api/v1/monthly/${editId}`, { credentials: "include" });
          if (res.status === 401) {
            router.replace("/v2/crew/login?error=session_expired");
            return;
          }
          if (!res.ok) {
            setErrorMsg("계약 정보를 불러오지 못했습니다.");
            setLoadingEdit(false);
            return;
          }
          const json = await res.json();
          const d = json?.data;
          if (d) {
            setForm({
              vehicle_number: d.vehicle_number || "",
              vehicle_type: d.vehicle_type || "",
              customer_name: d.customer_name || "",
              customer_phone: d.customer_phone || "",
              start_date: d.start_date || today,
              end_date: d.end_date || initialEndDate,
              monthly_fee: d.monthly_fee ?? 150000,
              payment_status: d.payment_status === "paid" ? "paid" : "unpaid",
              contract_status: d.contract_status || "active",
              note: d.note || "",
            });
            if (d.store_id) setStoreId(d.store_id);
            if (d.stores?.name) setStoreName(d.stores.name);
            setPeriodMonths(0); // 수동 모드
          }
        } catch (e) {
          console.error("monthly[id] load error:", e);
          setErrorMsg("계약 정보를 불러오지 못했습니다.");
        } finally {
          setLoadingEdit(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // 기간 퀵선택 (1/3/6/12개월)
  useEffect(() => {
    if (!form.start_date || !periodMonths) return;
    const start = new Date(form.start_date + "T00:00:00");
    start.setMonth(start.getMonth() + periodMonths);
    start.setDate(start.getDate() - 1);
    setForm(f => ({ ...f, end_date: toKSTDateStr(start) }));
  }, [form.start_date, periodMonths]);

  // 시작일 변경 → 해당월 말일 자동 세팅
  function handleStartDateChange(v: string) {
    const d = new Date(v + "T00:00:00");
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setForm(f => ({ ...f, start_date: v, end_date: toKSTDateStr(lastDay) }));
    setPeriodMonths(0);
  }

  function handlePeriod(months: number) {
    setPeriodMonths(months);
  }

  const canSave =
    form.vehicle_number && form.customer_name && form.customer_phone &&
    form.start_date && form.end_date && storeId;

  // ── 저장: 신규=POST / 수정=PATCH (API-first) ──
  async function handleSave() {
    if (!canSave || saving) return;
    setErrorMsg("");
    setSaving(true);

    try {
      const base = {
        vehicle_number: form.vehicle_number.toUpperCase().trim(),
        vehicle_type: form.vehicle_type?.trim() || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_fee: form.monthly_fee,
        payment_status: form.payment_status,
        contract_status: form.contract_status,
        note: form.note?.trim() || null,
      };

      let res;
      if (editId) {
        // 수정: store_id는 변경 불가(crew 스코프) → PATCH body 제외
        res = await fetch(`/api/v1/monthly/${editId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base),
        });
      } else {
        // 신규: store_id 포함 (org_id는 API가 세션에서 도출)
        res = await fetch(`/api/v1/monthly`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, store_id: storeId }),
        });
      }

      if (res.status === 401) {
        router.replace("/v2/crew/login?error=session_expired");
        return;
      }

      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        // 중복 차량 친절 안내
        setErrorMsg(
          json?.error?.message ||
          `이미 등록된 활성 월주차 차량입니다: ${base.vehicle_number}`
        );
        return;
      }
      if (res.status === 403) {
        setErrorMsg("해당 사업장 권한이 없습니다. 매장을 다시 확인해주세요.");
        return;
      }
      if (!res.ok || !json?.success) {
        setErrorMsg(json?.error?.message || (editId ? "수정에 실패했습니다." : "등록에 실패했습니다."));
        return;
      }

      setDone(true);
    } catch (e) {
      console.error("monthly save error:", e);
      setErrorMsg((editId ? "수정" : "등록") + " 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function fmtDate(d) {
    if (!d) return "-";
    const [y, m, day] = d.split("-");
    return `${y}.${m}.${day}`;
  }

  const contractDays = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  // ── 로딩(수정 데이터) ──
  if (loadingEdit) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2mreg-page">
          <div className="cv2mreg-header">
            <div className="cv2mreg-back-btn" onClick={() => router.push("/v2/crew/monthly")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </div>
            <div className="cv2mreg-header-title">월주차 수정</div>
          </div>
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>데이터 로딩 중...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2mreg-page">
        {/* ── 헤더 ── */}
        <div className="cv2mreg-header">
          <div className="cv2mreg-back-btn" onClick={() => router.push("/v2/crew/monthly")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <div className="cv2mreg-header-title">{editId ? "월주차 수정" : "월주차 등록"}</div>
        </div>

        {/* ── 에러 배너 ── */}
        {errorMsg && (
          <div className="cv2mreg-error">
            <span style={{ fontSize: 15 }}>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="cv2mreg-form">
          {/* 미리보기 카드 */}
          <div className="cv2mreg-preview">
            <div className="cv2mreg-preview-plate">{form.vehicle_number || "차량번호 입력"}</div>
            <div className="cv2mreg-preview-name">
              {form.customer_name || "고객명"} · {storeName || "매장"}
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="cv2mreg-preview-row">
                <span className="cv2mreg-preview-label">계약 기간</span>
                <span className="cv2mreg-preview-value">
                  {fmtDate(form.start_date)} ~ {fmtDate(form.end_date)}
                  {contractDays > 0 && <span style={{ color: "#F5B731", marginLeft: 6, fontSize: 12 }}>({contractDays}일)</span>}
                </span>
              </div>
              <div className="cv2mreg-preview-row">
                <span className="cv2mreg-preview-label">납부 상태</span>
                <span className="cv2mreg-preview-value" style={{ color: form.payment_status === "paid" ? "#4ade80" : "#F5B731" }}>
                  {form.payment_status === "paid" ? "납부완료" : "미납"}
                </span>
              </div>
            </div>
            <div className="cv2mreg-preview-fee">₩{(form.monthly_fee ?? 0).toLocaleString()}</div>
          </div>

          {/* 차량 정보 */}
          <div className="cv2mreg-section">
            <div className="cv2mreg-section-title">
              <div className="cv2mreg-section-bar" style={{ background: "#1428A0" }} />
              🚗 차량 정보
            </div>
            <div className="cv2mreg-section-body">
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">차량번호 <span className="cv2mreg-required">*</span></div>
                <input
                  className="cv2mreg-input plate"
                  value={form.vehicle_number}
                  onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                  placeholder="12가3456"
                  inputMode="text"
                  autoComplete="off"
                />
              </div>
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">차종</div>
                <input
                  className="cv2mreg-input"
                  value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
                  placeholder="예) 벤츠 E300, 쏘나타"
                />
              </div>
            </div>
          </div>

          {/* 고객 정보 */}
          <div className="cv2mreg-section">
            <div className="cv2mreg-section-title">
              <div className="cv2mreg-section-bar" style={{ background: "#F5B731" }} />
              👤 고객 정보
            </div>
            <div className="cv2mreg-section-body">
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">고객명 <span className="cv2mreg-required">*</span></div>
                <input
                  className="cv2mreg-input"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: filterKorean(e.target.value) }))}
                  placeholder="홍길동"
                />
              </div>
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">연락처 <span className="cv2mreg-required">*</span></div>
                <input
                  className="cv2mreg-input"
                  type="tel"
                  value={form.customer_phone}
                  onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  inputMode="tel"
                />
              </div>
            </div>
          </div>

          {/* 계약 기간 */}
          <div className="cv2mreg-section">
            <div className="cv2mreg-section-title">
              <div className="cv2mreg-section-bar" style={{ background: "#10b981" }} />
              📅 계약 기간
            </div>
            <div className="cv2mreg-section-body">
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">기간 선택</div>
                <div className="cv2mreg-period-btns">
                  {[
                    { m: 1, label: "1개월" },
                    { m: 3, label: "3개월" },
                    { m: 6, label: "6개월" },
                    { m: 12, label: "1년" },
                  ].map(opt => (
                    <button
                      key={opt.m}
                      className={`cv2mreg-period-btn${periodMonths === opt.m ? " active" : ""}`}
                      onClick={() => handlePeriod(opt.m)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cv2mreg-row">
                <div className="cv2mreg-field">
                  <div className="cv2mreg-label">시작일 <span className="cv2mreg-required">*</span></div>
                  <MeParkDatePicker
                    value={form.start_date}
                    onChange={handleStartDateChange}
                    compact
                    style={{ width: "100%" }}
                    align="left"
                  />
                </div>
                <div className="cv2mreg-field">
                  <div className="cv2mreg-label">종료일 <span className="cv2mreg-required">*</span></div>
                  <MeParkDatePicker
                    value={form.end_date || today}
                    onChange={v => {
                      setForm(f => ({ ...f, end_date: v }));
                      setPeriodMonths(0);
                    }}
                    compact
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 요금 및 상태 */}
          <div className="cv2mreg-section">
            <div className="cv2mreg-section-title">
              <div className="cv2mreg-section-bar" style={{ background: "#F5B731" }} />
              💰 요금 및 상태
            </div>
            <div className="cv2mreg-section-body">
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">월 요금 <span className="cv2mreg-required">*</span></div>
                <div className="cv2mreg-fee-wrap">
                  <span className="cv2mreg-fee-prefix">₩</span>
                  <input
                    className="cv2mreg-fee-input"
                    type="number"
                    min={0}
                    value={form.monthly_fee}
                    onChange={e => setForm(f => ({ ...f, monthly_fee: Number(e.target.value) || 0 }))}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">납부 상태</div>
                <select
                  className="cv2mreg-select"
                  value={form.payment_status}
                  onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                >
                  <option value="unpaid">미납</option>
                  <option value="paid">납부완료</option>
                </select>
              </div>
              {editId && (
                <div className="cv2mreg-field">
                  <div className="cv2mreg-label">계약 상태</div>
                  <select
                    className="cv2mreg-select"
                    value={form.contract_status}
                    onChange={e => setForm(f => ({ ...f, contract_status: e.target.value }))}
                  >
                    <option value="active">계약중</option>
                    <option value="expired">만료</option>
                    <option value="cancelled">해지</option>
                  </select>
                </div>
              )}
              <div className="cv2mreg-field">
                <div className="cv2mreg-label">메모</div>
                <textarea
                  className="cv2mreg-textarea"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={3}
                  placeholder="특이사항, 할인 조건 등..."
                />
              </div>
            </div>
          </div>

          {/* 매장 정보 */}
          <div className="cv2mreg-store-box">
            🏢 {storeName || "매장 미선택"}
            {!storeId && (
              <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 600 }}>
                (매장을 먼저 선택해주세요)
              </span>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="cv2mreg-save-area">
          <button
            className={`cv2mreg-save-btn ${saving ? "saving" : canSave ? "ready" : "disabled"}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <>
                <span style={{
                  display: "inline-block", width: 18, height: 18,
                  border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff",
                  borderRadius: "50%", animation: "cv2mreg-spin .7s linear infinite",
                }} />
                {editId ? "수정 중..." : "등록 중..."}
              </>
            ) : (
              <>{editId ? "✅ 수정 완료" : "💾 월주차 등록"}</>
            )}
          </button>
        </div>
      </div>

      {/* 완료 모달 */}
      {done && (
        <div className="cv2mreg-done-overlay">
          <div className="cv2mreg-done-card">
            <div className="cv2mreg-done-icon">{editId ? "✅" : "🎉"}</div>
            <div className="cv2mreg-done-title">{editId ? "수정 완료!" : "등록 완료!"}</div>
            <div className="cv2mreg-done-sub">
              <strong>{form.vehicle_number}</strong> 차량의<br />
              월주차 계약이 {editId ? "수정" : "등록"}되었습니다.
            </div>
            <button
              className="cv2mreg-done-btn"
              style={{ background: "#1428A0", color: "#fff" }}
              onClick={() => router.push("/v2/crew/monthly")}
            >
              월주차 목록으로
            </button>
            {!editId && (
              <button
                className="cv2mreg-done-btn"
                style={{ background: "#F1F5F9", color: "#64748B" }}
                onClick={() => {
                  setDone(false);
                  setErrorMsg("");
                  setForm({
                    vehicle_number: "", vehicle_type: "",
                    customer_name: "", customer_phone: "",
                    start_date: today, end_date: initialEndDate,
                    monthly_fee: form.monthly_fee, payment_status: "unpaid",
                    contract_status: "active", note: "",
                  });
                  setPeriodMonths(0);
                }}
              >
                추가 등록하기
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function CrewV2MonthlyRegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, color: "#64748B" }}>로딩 중...</div>
        </div>
      </div>
    }>
      <CrewV2MonthlyRegisterForm />
    </Suspense>
  );
}
