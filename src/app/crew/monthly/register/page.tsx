// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .mreg-page { min-height:100dvh; background:#F8FAFC; }

  .mreg-form { padding:16px; }

  .mreg-section {
    background:#fff; border-radius:16px; border:1px solid #E2E8F0;
    margin-bottom:14px; overflow:visible;
    box-shadow:0 1px 4px rgba(20,40,160,.04);
  }
  .mreg-section-title {
    display:flex; align-items:center; gap:8px;
    padding:14px 16px; font-size:14px; font-weight:800; color:#1A1D2B;
    border-bottom:1px solid #F1F5F9;
  }
  .mreg-section-bar {
    width:4px; height:16px; border-radius:2px; flex-shrink:0;
  }
  .mreg-section-body { padding:16px; }

  .mreg-field { margin-bottom:16px; }
  .mreg-field:last-child { margin-bottom:0; }
  .mreg-label {
    display:flex; align-items:center; gap:4px;
    font-size:13px; font-weight:700; color:#64748B; margin-bottom:7px;
  }
  .mreg-required { color:#DC2626; font-size:13px; }

  .mreg-input {
    width:100%; padding:12px 14px;
    border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:16px; color:#1A1D2B; background:#fff;
    outline:none; font-family:inherit;
    transition:border-color .2s;
    -webkit-appearance:none;
  }
  .mreg-input:focus { border-color:#1428A0; }
  .mreg-input::placeholder { color:#CBD5E1; }
  .mreg-input.plate {
    font-weight:900; letter-spacing:2px; text-transform:uppercase;
    font-size:18px;
  }

  .mreg-select {
    width:100%; padding:12px 14px;
    border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:15px; color:#1A1D2B; background:#fff;
    outline:none; font-family:inherit;
    -webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat;
    background-position:right 14px center;
  }
  .mreg-select:focus { border-color:#1428A0; }

  .mreg-textarea {
    width:100%; padding:12px 14px;
    border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:15px; color:#1A1D2B; background:#fff;
    outline:none; font-family:inherit; resize:none;
    line-height:1.6;
  }
  .mreg-textarea:focus { border-color:#1428A0; }

  .mreg-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

  /* 기간 퀵선택 */
  .mreg-period-btns {
    display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;
  }
  .mreg-period-btn {
    flex:1; min-width:60px; padding:10px 0; border-radius:10px;
    border:1.5px solid #E2E8F0; background:#fff;
    font-size:14px; font-weight:700; color:#64748B;
    cursor:pointer; text-align:center; font-family:inherit;
    transition:all .15s;
    -webkit-tap-highlight-color:transparent;
  }
  .mreg-period-btn:active { transform:scale(.96); }
  .mreg-period-btn.active {
    border-color:#1428A0; background:#EEF2FF; color:#1428A0;
  }

  /* 요금 입력 */
  .mreg-fee-wrap { position:relative; }
  .mreg-fee-prefix {
    position:absolute; left:14px; top:50%; transform:translateY(-50%);
    font-size:14px; font-weight:700; color:#94A3B8;
  }
  .mreg-fee-input {
    width:100%; padding:12px 14px 12px 28px;
    border:1.5px solid #E2E8F0; border-radius:12px;
    font-size:18px; font-weight:800; color:#1428A0;
    background:#fff; outline:none; font-family:inherit;
    -webkit-appearance:none;
  }
  .mreg-fee-input:focus { border-color:#1428A0; }

  /* 미리보기 카드 */
  .mreg-preview {
    background:linear-gradient(135deg, #1428A0 0%, #1e3a8a 100%);
    border-radius:16px; padding:18px; margin-bottom:14px;
    color:#fff;
  }
  .mreg-preview-plate {
    font-size:22px; font-weight:900; letter-spacing:2px; margin-bottom:4px;
  }
  .mreg-preview-name { font-size:13px; color:rgba(255,255,255,.7); }
  .mreg-preview-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:8px 0; border-top:1px solid rgba(255,255,255,.15);
  }
  .mreg-preview-label { font-size:12px; color:rgba(255,255,255,.6); }
  .mreg-preview-value { font-size:14px; font-weight:700; }
  .mreg-preview-fee {
    font-size:24px; font-weight:900; color:#F5B731;
    text-align:right; margin-top:8px;
  }

  /* 저장 버튼 */
  .mreg-save-area {
    padding:16px; padding-bottom:calc(16px + env(safe-area-inset-bottom, 0));
  }
  .mreg-save-btn {
    width:100%; height:52px; border-radius:14px;
    border:none; font-size:16px; font-weight:800;
    cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:all .15s;
    -webkit-tap-highlight-color:transparent;
  }
  .mreg-save-btn:active { transform:scale(.98); }
  .mreg-save-btn.ready {
    background:#1428A0; color:#fff;
  }
  .mreg-save-btn.disabled {
    background:#E2E8F0; color:#94A3B8; cursor:not-allowed;
  }
  .mreg-save-btn.saving {
    background:#94A3B8; color:#fff; cursor:not-allowed;
  }

  /* 완료 모달 */
  .mreg-done-overlay {
    position:fixed; inset:0; z-index:200;
    background:rgba(0,0,0,.5); display:flex;
    align-items:center; justify-content:center; padding:24px;
  }
  .mreg-done-card {
    background:#fff; border-radius:24px; padding:32px 24px;
    text-align:center; max-width:320px; width:100%;
    box-shadow:0 20px 60px rgba(0,0,0,.2);
  }
  .mreg-done-icon { font-size:56px; margin-bottom:16px; }
  .mreg-done-title { font-size:20px; font-weight:800; color:#1A1D2B; margin-bottom:6px; }
  .mreg-done-sub { font-size:14px; color:#64748B; margin-bottom:24px; line-height:1.6; }
  .mreg-done-btn {
    width:100%; height:48px; border-radius:12px;
    border:none; font-size:15px; font-weight:700;
    cursor:pointer; font-family:inherit; margin-bottom:8px;
    -webkit-tap-highlight-color:transparent;
  }
`;

/* ─────────────────────────────────────────────
   컴포넌트
───────────────────────────────────────────── */
function CrewMonthlyRegisterForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { showToast } = useCrewToast();

  const [orgId, setOrgId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const todayObj = new Date();
  const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0);
  const initialEndDate = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`;

  const [form, setForm] = useState({
    vehicle_number: "",
    vehicle_type: "",
    customer_name: "",
    customer_phone: "",
    start_date: today,
    end_date: initialEndDate,
    monthly_fee: 150000,
    payment_status: "unpaid" as "paid" | "unpaid",
    contract_status: "active" as "active" | "expired" | "cancelled",
    note: "",
  });

  const [periodMonths, setPeriodMonths] = useState(0);

  // 한글만 허용 필터
  function filterKorean(val: string) {
    return val.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, "");
  }

  // 초기화
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) setOrgId(profile.org_id || "");
      const sid = localStorage.getItem("crew_store_id") || "";
      const sname = localStorage.getItem("crew_store_name") || "";
      setStoreId(sid);
      setStoreName(sname);

      // 수정 모드: 기존 데이터 로드
      if (editId) {
        const { data } = await supabase
          .from("monthly_parking")
          .select("*, stores(name)")
          .eq("id", editId)
          .single();
        if (data) {
          setForm({
            vehicle_number: data.vehicle_number || "",
            vehicle_type: data.vehicle_type || "",
            customer_name: data.customer_name || "",
            customer_phone: data.customer_phone || "",
            start_date: data.start_date || today,
            end_date: data.end_date || "",
            monthly_fee: data.monthly_fee ?? 150000,
            payment_status: data.payment_status || "unpaid",
            contract_status: data.contract_status || "active",
            note: data.note || "",
          });
          if (data.store_id) setStoreId(data.store_id);
          if (data.stores?.name) setStoreName(data.stores.name);
          setPeriodMonths(0); // 수동 모드
        }
        setLoadingEdit(false);
      } else {
        // 신규: 매장 기본 요금
        if (sid) {
          const { data: visits } = await supabase
            .from("visit_places").select("monthly_fee").eq("store_id", sid).limit(1);
          if (visits && visits.length > 0 && visits[0].monthly_fee) {
            setForm(f => ({ ...f, monthly_fee: visits[0].monthly_fee }));
          }
        }
      }
    })();
  }, []);

  // 타임존 안전한 날짜 포맷
  function fmtLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // 기간 퀵선택 (1/3/6/12개월 버튼)
  useEffect(() => {
    if (!form.start_date || !periodMonths) return;
    const start = new Date(form.start_date + "T00:00:00");
    start.setMonth(start.getMonth() + periodMonths);
    start.setDate(start.getDate() - 1);
    setForm(f => ({ ...f, end_date: fmtLocal(start) }));
  }, [form.start_date, periodMonths]);

  // 시작일 변경 → 해당월 말일 자동 세팅
  function handleStartDateChange(v: string) {
    const d = new Date(v + "T00:00:00");
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setForm(f => ({ ...f, start_date: v, end_date: fmtLocal(lastDay) }));
    setPeriodMonths(0);
  }

  function handlePeriod(months: number) {
    setPeriodMonths(months);
  }

  const canSave = form.vehicle_number && form.customer_name && form.customer_phone && form.start_date && form.end_date && storeId;

  async function handleSave() {
    if (!canSave || saving) return;
    if (!orgId) {
      showToast("로그인 정보 오류", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        store_id: storeId,
        vehicle_number: form.vehicle_number.toUpperCase().trim(),
        vehicle_type: form.vehicle_type || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_fee: form.monthly_fee,
        payment_status: form.payment_status,
        contract_status: form.contract_status,
        note: form.note || null,
      };

      if (editId) {
        // 수정
        const { error } = await supabase
          .from("monthly_parking").update(payload).eq("id", editId);
        if (error) {
          showToast("수정 실패: " + error.message, "error");
          return;
        }
      } else {
        // 신규 등록
        const { error } = await supabase
          .from("monthly_parking").insert({ ...payload, org_id: orgId });
        if (error) {
          showToast("등록 실패: " + error.message, "error");
          return;
        }
      }

      setDone(true);
    } catch (e: any) {
      showToast((editId ? "수정" : "등록") + " 실패: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function fmtDate(d: string) {
    if (!d) return "-";
    const [y, m, day] = d.split("-");
    return `${y}.${m}.${day}`;
  }

  const contractDays = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  if (loadingEdit) {
    return (
      <>
        <style>{CSS}</style>
        <div className="mreg-page">
          <CrewHeader title="월주차 수정" showBack />
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>데이터 로딩 중...</div>
          </div>
        </div>
        <CrewBottomNav />
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="mreg-page">
        <CrewHeader title={editId ? "월주차 수정" : "월주차 등록"} showBack />

        <div className="mreg-form">

          {/* 미리보기 카드 */}
          <div className="mreg-preview">
            <div className="mreg-preview-plate">
              {form.vehicle_number || "차량번호 입력"}
            </div>
            <div className="mreg-preview-name">
              {form.customer_name || "고객명"} · {storeName || "매장"}
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="mreg-preview-row">
                <span className="mreg-preview-label">계약 기간</span>
                <span className="mreg-preview-value">
                  {fmtDate(form.start_date)} ~ {fmtDate(form.end_date)}
                  {contractDays > 0 && <span style={{ color: "#F5B731", marginLeft: 6, fontSize: 12 }}>({contractDays}일)</span>}
                </span>
              </div>
              <div className="mreg-preview-row">
                <span className="mreg-preview-label">납부 상태</span>
                <span className="mreg-preview-value" style={{ color: form.payment_status === "paid" ? "#4ade80" : "#F5B731" }}>
                  {form.payment_status === "paid" ? "납부완료" : "미납"}
                </span>
              </div>
            </div>
            <div className="mreg-preview-fee">
              ₩{(form.monthly_fee ?? 0).toLocaleString()}
            </div>
          </div>

          {/* 차량 정보 */}
          <div className="mreg-section">
            <div className="mreg-section-title">
              <div className="mreg-section-bar" style={{ background: "#1428A0" }} />
              🚗 차량 정보
            </div>
            <div className="mreg-section-body">
              <div className="mreg-field">
                <div className="mreg-label">차량번호 <span className="mreg-required">*</span></div>
                <input
                  className="mreg-input plate"
                  value={form.vehicle_number}
                  onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                  placeholder="12가3456"
                  inputMode="text"
                  autoComplete="off"
                />
              </div>
              <div className="mreg-field">
                <div className="mreg-label">차종</div>
                <input
                  className="mreg-input"
                  value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
                  placeholder="예) 벤츠 E300, 쏘나타"
                />
              </div>
            </div>
          </div>

          {/* 고객 정보 */}
          <div className="mreg-section">
            <div className="mreg-section-title">
              <div className="mreg-section-bar" style={{ background: "#F5B731" }} />
              👤 고객 정보
            </div>
            <div className="mreg-section-body">
              <div className="mreg-field">
                <div className="mreg-label">고객명 <span className="mreg-required">*</span></div>
                <input
                  className="mreg-input"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: filterKorean(e.target.value) }))}
                  placeholder="홍길동"
                />
                {form.customer_name !== form.customer_name && (
                  <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>한글만 입력 가능합니다</div>
                )}
              </div>
              <div className="mreg-field">
                <div className="mreg-label">연락처 <span className="mreg-required">*</span></div>
                <input
                  className="mreg-input"
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
          <div className="mreg-section">
            <div className="mreg-section-title">
              <div className="mreg-section-bar" style={{ background: "#10b981" }} />
              📅 계약 기간
            </div>
            <div className="mreg-section-body">
              <div className="mreg-field">
                <div className="mreg-label">기간 선택</div>
                <div className="mreg-period-btns">
                  {[
                    { m: 1, label: "1개월" },
                    { m: 3, label: "3개월" },
                    { m: 6, label: "6개월" },
                    { m: 12, label: "1년" },
                  ].map(opt => (
                    <button
                      key={opt.m}
                      className={`mreg-period-btn${periodMonths === opt.m ? " active" : ""}`}
                      onClick={() => handlePeriod(opt.m)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mreg-row">
                <div className="mreg-field">
                  <div className="mreg-label">시작일 <span className="mreg-required">*</span></div>
                  <MeParkDatePicker
                    value={form.start_date}
                    onChange={handleStartDateChange}
                    compact
                    style={{ width: "100%" }}
                    align="left"
                  />
                </div>
                <div className="mreg-field">
                  <div className="mreg-label">종료일 <span className="mreg-required">*</span></div>
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

          {/* 요금 */}
          <div className="mreg-section">
            <div className="mreg-section-title">
              <div className="mreg-section-bar" style={{ background: "#F5B731" }} />
              💰 요금 및 상태
            </div>
            <div className="mreg-section-body">
              <div className="mreg-field">
                <div className="mreg-label">월 요금 <span className="mreg-required">*</span></div>
                <div className="mreg-fee-wrap">
                  <span className="mreg-fee-prefix">₩</span>
                  <input
                    className="mreg-fee-input"
                    type="number"
                    min={0}
                    value={form.monthly_fee}
                    onChange={e => setForm(f => ({ ...f, monthly_fee: Number(e.target.value) || 0 }))}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="mreg-field">
                <div className="mreg-label">납부 상태</div>
                <select
                  className="mreg-select"
                  value={form.payment_status}
                  onChange={e => setForm(f => ({ ...f, payment_status: e.target.value as any }))}
                >
                  <option value="unpaid">미납</option>
                  <option value="paid">납부완료</option>
                </select>
              </div>
              {editId && (
                <div className="mreg-field">
                  <div className="mreg-label">계약 상태</div>
                  <select
                    className="mreg-select"
                    value={form.contract_status}
                    onChange={e => setForm(f => ({ ...f, contract_status: e.target.value as any }))}
                  >
                    <option value="active">계약중</option>
                    <option value="expired">만료</option>
                    <option value="cancelled">해지</option>
                  </select>
                </div>
              )}
              <div className="mreg-field">
                <div className="mreg-label">메모</div>
                <textarea
                  className="mreg-textarea"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={3}
                  placeholder="특이사항, 할인 조건 등..."
                />
              </div>
            </div>
          </div>

          {/* 매장 정보 표시 */}
          <div style={{
            background: "#EEF2FF", borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, fontWeight: 700, color: "#1428A0", marginBottom: 14,
          }}>
            🏢 {storeName || "매장 미선택"}
            {!storeId && (
              <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 600 }}>
                (매장을 먼저 선택해주세요)
              </span>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="mreg-save-area">
          <button
            className={`mreg-save-btn ${saving ? "saving" : canSave ? "ready" : "disabled"}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <>
                <span style={{
                  display: "inline-block", width: 18, height: 18,
                  border: "2.5px solid rgba(255,255,255,.3)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin .7s linear infinite",
                }} />
                {editId ? "수정 중..." : "등록 중..."}
              </>
            ) : (
              <>{editId ? "✅ 수정 완료" : "💾 월주차 등록"}</>
            )}
          </button>
        </div>

        <CrewNavSpacer />
      </div>
      <CrewBottomNav />

      {/* 완료 모달 */}
      {done && (
        <div className="mreg-done-overlay">
          <div className="mreg-done-card">
            <div className="mreg-done-icon">{editId ? "✅" : "🎉"}</div>
            <div className="mreg-done-title">{editId ? "수정 완료!" : "등록 완료!"}</div>
            <div className="mreg-done-sub">
              <strong>{form.vehicle_number}</strong> 차량의<br />
              월주차 계약이 {editId ? "수정" : "등록"}되었습니다.
            </div>
            <button
              className="mreg-done-btn"
              style={{ background: "#1428A0", color: "#fff" }}
              onClick={() => router.push("/crew/monthly")}
            >
              월주차 목록으로
            </button>
            {!editId && (
              <button
                className="mreg-done-btn"
                style={{ background: "#F1F5F9", color: "#64748B" }}
                onClick={() => {
                  setDone(false);
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

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </>
  );
}

export default function CrewMonthlyRegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, color: "#64748B" }}>로딩 중...</div>
        </div>
      </div>
    }>
      <CrewMonthlyRegisterForm />
    </Suspense>
  );
}
