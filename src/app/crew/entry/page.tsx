// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";
import { useCrewToast } from "@/components/crew/CrewToast";
import CameraOcr from "@/components/crew/CameraOcr";
import { getToday } from "@/lib/utils/date";

const CSS = `
  .entry-page {
    min-height: 100dvh;
    background: #F8FAFC;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .step-indicator {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 16px 20px 12px;
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    gap: 0;
  }
  .step-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .step-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    transition: all 0.2s;
  }
  .step-dot.active { background: #1428A0; color: #fff; }
  .step-dot.done   { background: #16A34A; color: #fff; }
  .step-dot.idle   { background: #E2E8F0; color: #94A3B8; }
  .step-line {
    flex: 1; max-width: 48px; height: 2px;
    background: #E2E8F0; margin-top: 14px;
  }
  .step-line.done { background: #16A34A; }
  .step-label { font-size: 10px; color: #94A3B8; }
  .entry-section {
    margin: 16px;
    background: #fff;
    border-radius: 16px;
    border: 1px solid #E2E8F0;
    overflow: hidden;
  }
  .entry-section-title {
    padding: 14px 16px 10px;
    font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase;
    border-bottom: 1px solid #F1F5F9;
  }
  .entry-section-body { padding: 16px; }
  .plate-split-wrap {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px;
    border: 2.5px solid #E2E8F0; border-radius: 12px;
    background: #fff; transition: border-color 0.2s;
  }
  .plate-split-wrap.focused { border-color: #1428A0; }
  .plate-split-wrap.monthly { border-color: #16A34A; background: #F0FDF4; }
  .plate-split-num {
    flex: 1; height: 44px; border: none; outline: none;
    font-size: 26px; font-weight: 800; color: #1A1D2B;
    text-align: center; letter-spacing: 2px; background: transparent;
  }
  .plate-split-kor {
    min-width: 44px; height: 44px;
    border: 1.5px dashed #CBD5E1; border-radius: 8px;
    font-size: 26px; font-weight: 800; color: #1A1D2B;
    text-align: center; display: flex; align-items: center; justify-content: center;
    cursor: pointer; background: #F8FAFC; flex-shrink: 0;
    transition: border-color 0.2s, background 0.2s;
  }
  .plate-split-kor.selected { border-color: #1428A0; background: #EEF2FF; border-style: solid; }
  .plate-split-kor.active { border-color: #1428A0; background: #EEF2FF; border-style: solid; }
  .plate-split-sep { font-size: 20px; color: #CBD5E1; font-weight: 300; flex-shrink: 0; }
  .kor-picker {
    margin-top: 10px; padding: 12px;
    background: #F1F5F9; border-radius: 12px;
    border: 1.5px solid #E2E8F0;
  }
  .kor-picker-label { font-size: 11px; color: #64748B; font-weight: 600; margin-bottom: 8px; }
  .kor-picker-grid {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;
  }
  .kor-btn {
    height: 38px; border-radius: 8px;
    border: 1.5px solid #CBD5E1; background: #fff;
    font-size: 16px; font-weight: 700; color: #1A1D2B;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .kor-btn:active { transform: scale(0.93); }
  .kor-btn.selected { background: #1428A0; color: #fff; border-color: #1428A0; }
  .plate-input {
    width: 100%; height: 60px;
    border: 2.5px solid #E2E8F0; border-radius: 12px;
    padding: 0 16px;
    font-size: 26px; font-weight: 800; color: #1A1D2B;
    text-align: center; letter-spacing: 4px; outline: none;
    text-transform: uppercase; transition: border-color 0.2s;
  }
  .plate-input:focus { border-color: #1428A0; }
  .plate-input.monthly { border-color: #16A34A; background: #F0FDF4; }
  .monthly-badge {
    margin-top: 10px; padding: 10px 14px;
    border-radius: 10px;
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600;
  }
  .monthly-badge.yes { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .monthly-badge.no  { background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }
  .type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .type-btn {
    padding: 16px 10px; border-radius: 12px;
    border: 2px solid #E2E8F0; background: #F8FAFC;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; transition: all 0.2s;
  }
  .type-btn.selected { border-color: #1428A0; background: #EEF2FF; }
  .type-btn-icon { font-size: 28px; }
  .type-btn-label { font-size: 14px; font-weight: 700; color: #1A1D2B; }
  .type-btn-desc { font-size: 11px; color: #64748B; }
  .form-select, .form-input {
    width: 100%; height: 48px;
    border: 1.5px solid #E2E8F0; border-radius: 10px;
    padding: 0 14px; font-size: 15px; color: #1A1D2B;
    background: #fff; outline: none; transition: border-color 0.2s;
  }
  .form-select:focus, .form-input:focus { border-color: #1428A0; }
  .form-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
  .form-group { margin-bottom: 14px; }
  .form-group:last-child { margin-bottom: 0; }
  .phone-notice {
    margin-top: 8px; padding: 8px 12px;
    background: #FFF7ED; border-radius: 8px;
    font-size: 11px; color: #92400E;
    display: flex; align-items: flex-start; gap: 6px;
  }
  .entry-footer {
    position: sticky; bottom: 0;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
    background: #fff; border-top: 1px solid #E2E8F0;
    display: flex; gap: 10px;
  }
  .btn-primary {
    flex: 1; height: 52px;
    background: #1428A0; color: #fff;
    border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary.gold { background: #F5B731; color: #1A1D2B; }
  .btn-secondary {
    height: 52px; padding: 0 20px;
    background: #F1F5F9; color: #475569;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-ocr {
    width: 100%; height: 52px;
    background: #1428A0; color: #fff;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin-bottom: 10px;
  }
  .btn-ocr:active { opacity: 0.85; }
  .divider-or {
    display: flex; align-items: center; gap: 10px;
    margin: 4px 0 10px; color: #94A3B8; font-size: 12px;
  }
  .divider-or::before, .divider-or::after {
    content: ""; flex: 1; height: 1px; background: #E2E8F0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
  .summary-card {
    background: #F8FAFC; border-radius: 12px; padding: 14px; margin-bottom: 12px;
  }
  .summary-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px;
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-key { color: #64748B; }
  .summary-val { font-weight: 600; color: #1A1D2B; }
  .plate-badge {
    font-size: 22px; font-weight: 800; letter-spacing: 3px;
    color: #1428A0; text-align: center;
    padding: 14px; background: #EEF2FF; border-radius: 10px; margin-bottom: 12px;
  }
`;

export default function CrewEntryPage() {
  const router = useRouter();
  const { showToast } = useCrewToast();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [userId, setUserId] = useState(null);

  // OCR 카메라
  const [showCamera, setShowCamera] = useState(false);
  const [entryMethod, setEntryMethod] = useState<"manual"|"camera">("manual");

  // Step 1 — 분할 번호판 입력
  const [plateNumber, setPlateNumber] = useState("");
  const [platePart1, setPlatePart1] = useState(""); // 앞 숫자 (2~3자리)
  const [plateKor, setPlateKor] = useState("");      // 한글 1자리
  const [platePart2, setPlatePart2] = useState(""); // 뒷 숫자 (4자리)
  const [showKorPicker, setShowKorPicker] = useState(false);
  const [splitFocused, setSplitFocused] = useState(false);
  const part1Ref = useRef(null);
  const part2Ref = useRef(null);

  const combinePlate = (p1, kor, p2) => p1 + kor + p2;

  const handlePart1Change = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 3);
    setPlatePart1(digits);
    const combined = combinePlate(digits, plateKor, platePart2);
    setPlateNumber(combined);
    handlePlateChange(combined);
    if (digits.length >= 2) setShowKorPicker(true);
  };

  const handleKorSelect = (kor) => {
    setPlateKor(kor);
    setShowKorPicker(false);
    const combined = combinePlate(platePart1, kor, platePart2);
    setPlateNumber(combined);
    handlePlateChange(combined);
    setTimeout(() => part2Ref.current?.focus(), 50);
  };

  const handlePart2Change = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPlatePart2(digits);
    const combined = combinePlate(platePart1, plateKor, digits);
    setPlateNumber(combined);
    handlePlateChange(combined);
  };

  const applyOcrPlate = (plate) => {
    const n = plate.replace(/\s/g, "");
    const korMatch = n.match(/[가-힣]/);
    if (korMatch) {
      const idx = n.indexOf(korMatch[0]);
      setPlatePart1(n.slice(0, idx));
      setPlateKor(korMatch[0]);
      setPlatePart2(n.slice(idx + 1));
    }
    setPlateNumber(n);
    handlePlateChange(n);
  };

  const [monthlyInfo, setMonthlyInfo] = useState(null);
  const [monthlyChecking, setMonthlyChecking] = useState(false);
  const plateTimer = useRef(null);
  const [plateError, setPlateError] = useState("");

  // 한국 차량번호 유효성 검사
  const validatePlate = (plate) => {
    const n = plate.replace(/\s/g, "");
    const hasKorean = /[가-힣]/.test(n);
    const digitCount = (n.match(/\d/g) || []).length;
    return n.length >= 6 && hasKorean && digitCount >= 4;
  };

  // Step 2
  const [parkingType, setParkingType] = useState("self");
  const [visitPlaces, setVisitPlaces] = useState([]);
  const [visitPlaceId, setVisitPlaceId] = useState("");
  const [parkingLots, setParkingLots] = useState([]);
  const [parkingLotId, setParkingLotId] = useState("");
  const [showRequiredAlert, setShowRequiredAlert] = useState(false);
  const [requiredAlertMsg, setRequiredAlertMsg] = useState("");
  const [parkingLocation, setParkingLocation] = useState("");
  const [isFree, setIsFree] = useState(false);

  // Step 3
  const [phone, setPhone] = useState("");
  const [dupTicket, setDupTicket] = useState(null); // 중복 차량 팝업용

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/crew/login"); return; }
      setUserId(user.id);

      const savedStoreId = localStorage.getItem("crew_store_id");
      if (!savedStoreId) { router.replace("/crew/select-store"); return; }
      setStoreId(savedStoreId);

      const { data: profile } = await supabase
        .from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) setOrgId(profile.org_id);

      const { data: places } = await supabase
        .from("visit_places").select("id, name, floor")
        .eq("store_id", savedStoreId).order("name");
      setVisitPlaces(places || []);

      const { data: lots } = await supabase
        .from("parking_lots").select("id, name")
        .eq("store_id", savedStoreId).order("name");
      setParkingLots(lots || []);
    };
    init();
  }, []);

  const handlePlateChange = (val) => {
    // 공백 제거 + 영문만 대문자 변환 (한글은 그대로 유지)
    const cleaned = val.replace(/\s/g, "").replace(/[a-z]/g, (c) => c.toUpperCase()).slice(0, 10);
    setPlateNumber(cleaned);
    setPlateError("");
    setEntryMethod("manual");
    setMonthlyInfo(null);
    if (plateTimer.current) clearTimeout(plateTimer.current);
    if (cleaned.length >= 4) {
      setMonthlyChecking(true);
      plateTimer.current = setTimeout(() => checkMonthly(cleaned), 600);
    } else {
      setMonthlyChecking(false);
    }
  };

  const checkMonthly = async (plate) => {
    if (!storeId) { setMonthlyChecking(false); return; }
    const today = getToday();
    const { data } = await supabase
      .from("monthly_parking")
      .select("id, customer_name, end_date")
      .eq("store_id", storeId)
      .eq("vehicle_number", plate)
      .gte("end_date", today)
      .eq("status", "active")
      .single();
    setMonthlyChecking(false);
    setIsFree(false); // 번호판 변경 시 무료처리 항상 OFF 초기화
    if (data) {
      const daysLeft = Math.ceil((new Date(data.end_date) - new Date()) / 86400000);
      setMonthlyInfo({ id: data.id, name: data.customer_name, endDate: data.end_date, daysLeft });
    } else {
      setMonthlyInfo(null);
    }
  };

  const handleSubmit = async () => {
    if (!storeId || !orgId || !userId) return;
    setLoading(true);
    try {
      // ── 중복 차량 체크 ──
      const { data: existing } = await supabase
        .from("mepark_tickets")
        .select("id, plate_number, entry_at, status")
        .eq("store_id", storeId)
        .eq("plate_number", plateNumber)
        .not("status", "eq", "completed")
        .maybeSingle();

      if (existing) {
        setDupTicket(existing);
        setLoading(false);
        return;
      }
      const { data: ticket, error } = await supabase
        .from("mepark_tickets")
        .insert({
          org_id: orgId, store_id: storeId,
          plate_number: plateNumber, plate_last4: plateNumber.slice(-4),
          parking_type: parkingType, status: "parking",
          entry_crew_id: userId,
          is_monthly: !!monthlyInfo, monthly_parking_id: monthlyInfo?.id || null,
          visit_place_id: visitPlaceId || null,
          parking_lot_id: parkingLotId || null,
          parking_location: parkingLocation || null,
          entry_method: entryMethod,
          is_free: isFree,
          entry_at: new Date().toISOString(),
        })
        .select("id").single();

      if (error) throw error;

      if (phone && phone.length >= 10) {
        fetch("/api/alimtalk/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, ticketId: ticket.id, plateNumber, orgId }),
        }).catch(() => {});
        // 차량준비 알림톡 재사용을 위해 임시 저장 (출차 완료 후 자동 삭제)
        try { localStorage.setItem(`mepark_phone_${ticket.id}`, phone); } catch {}
      }

      router.push(`/crew/entry/qr?ticketId=${ticket.id}&plate=${encodeURIComponent(plateNumber)}&type=${parkingType}`);
    } catch (err) {
      console.error(err);
      showToast("입차 등록 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["번호판", "정보입력", "확인"];

  return (
    <>
      <style>{CSS}</style>
      <div className="entry-page">
        <CrewHeader title="입차 등록" showBack />

        {/* ── 필수 항목 미선택 경고 팝업 ── */}
        {showRequiredAlert && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
          }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "28px 24px",
              width: "100%", maxWidth: 360, textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>
                {requiredAlertMsg === "방문지" ? "🏥" : "🅿️"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", marginBottom: 8 }}>
                {requiredAlertMsg} 선택이 필요합니다
              </div>
              <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
                {requiredAlertMsg === "방문지"
                  ? "방문지를 선택하면 정확한 요금이
적용됩니다."
                  : "주차장을 선택하면 고객 티켓에
정확한 위치가 표시됩니다."}
              </div>
              <button
                onClick={() => setShowRequiredAlert(false)}
                style={{
                  width: "100%", height: 48, borderRadius: 10,
                  border: "none", background: "#1428A0",
                  fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer",
                }}
              >
                선택하러 가기
              </button>
            </div>
          </div>
        )}

        {/* ── OCR 카메라 오버레이 ── */}
        {showCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
            <CameraOcr
              onConfirm={(plate) => {
                applyOcrPlate(plate);
                setEntryMethod("camera");
                setShowCamera(false);
              }}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        )}

        {/* 진행 단계 */}
        <div className="step-indicator">
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const state = num < step ? "done" : num === step ? "active" : "idle";
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                {i > 0 && <div className={`step-line ${num <= step ? "done" : ""}`} />}
                <div className="step-wrap">
                  <div className={`step-dot ${state}`}>
                    {state === "done" ? "✓" : num}
                  </div>
                  <div className="step-label">{label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">🚗 차량 번호판</div>
              <div className="entry-section-body">
                {/* OCR 스캔 버튼 */}
                <button className="btn-ocr" onClick={() => setShowCamera(true)}>
                  📷 번호판 자동 스캔
                </button>
                <div className="divider-or">또는 직접 입력</div>

                {/* 분할 번호판 입력 */}
                <div
                  className={`plate-split-wrap${splitFocused ? " focused" : ""}${monthlyInfo ? " monthly" : ""}`}
                  onClick={() => { if (!platePart1) part1Ref.current?.focus(); }}
                >
                  <input
                    ref={part1Ref}
                    className="plate-split-num"
                    value={platePart1}
                    onChange={(e) => handlePart1Change(e.target.value)}
                    placeholder="12"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    autoFocus
                    onFocus={() => setSplitFocused(true)}
                    onBlur={() => setSplitFocused(false)}
                    style={{ maxWidth: 70 }}
                  />
                  <div
                    className={`plate-split-kor${plateKor ? " selected" : ""}${showKorPicker ? " active" : ""}`}
                    onClick={() => { setShowKorPicker(v => !v); setSplitFocused(true); }}
                  >
                    {plateKor || <span style={{fontSize:13,color:"#94A3B8"}}>한글</span>}
                  </div>
                  <input
                    ref={part2Ref}
                    className="plate-split-num"
                    value={platePart2}
                    onChange={(e) => handlePart2Change(e.target.value)}
                    placeholder="3456"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    onFocus={() => { setSplitFocused(true); setShowKorPicker(false); }}
                    onBlur={() => setSplitFocused(false)}
                    style={{ maxWidth: 90 }}
                  />
                </div>

                {/* 한글 피커 */}
                {showKorPicker && (
                  <div className="kor-picker">
                    <div className="kor-picker-label">한글 선택</div>
                    <div className="kor-picker-grid">
                      {["가","나","다","라","마","바","사","아","자","차","카","타","파","하",
                        "거","너","더","러","머","버","서","어","저","처","커","터","퍼","허",
                        "고","노","도","로","모","보","소","오","조","초","코","토","포","호",
                        "구","두","루","무","부","수","우","주","추","쿠","투","푸","후","배"].map(k => (
                        <button
                          key={k}
                          className={`kor-btn${plateKor === k ? " selected" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); handleKorSelect(k); }}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {monthlyChecking && (
                  <div className="monthly-badge no">🔍 월주차 확인 중...</div>
                )}
                {!monthlyChecking && monthlyInfo && (
                  <div className="monthly-badge yes">
                    ✅&nbsp; 월주차 · {monthlyInfo.name}
                    {monthlyInfo.daysLeft <= 7 && (
                      <span style={{ fontSize: 11, color: "#D97706", marginLeft: 6 }}>
                        (D-{monthlyInfo.daysLeft} 만료)
                      </span>
                    )}
                  </div>
                )}
                {!monthlyChecking && plateNumber.length >= 4 && !monthlyInfo && (
                  <div className="monthly-badge no">ℹ️&nbsp; 일반 차량</div>
                )}
                {plateError && (
                  <div style={{
                    marginTop: 8, padding: "10px 14px", borderRadius: 10,
                    background: "#fee2e2", color: "#dc2626",
                    fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line",
                    display: "flex", alignItems: "flex-start", gap: 6
                  }}>
                    ⚠️ {plateError}
                  </div>
                )}
              </div>
            </div>
            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => router.back()}>취소</button>
              <button className="btn-primary" onClick={() => {
                if (!validatePlate(plateNumber)) {
                  setPlateError("올바른 차량번호를 입력해주세요\n예: 12가3456 / 123가4567");
                  return;
                }
                setPlateError("");
                setStep(2);
              }} disabled={!plateNumber.trim()}>
                다음 →
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">🅿️ 주차 유형</div>
              <div className="entry-section-body">
                <div className="type-toggle">
                  {[
                    { val: "self", icon: "🏢", label: "자주식", desc: "고객 직접 주차" },
                    { val: "valet", icon: "🔑", label: "발렛", desc: "크루가 주차" },
                  ].map(t => (
                    <div
                      key={t.val}
                      className={`type-btn${parkingType === t.val ? " selected" : ""}`}
                      onClick={() => setParkingType(t.val)}
                    >
                      <div className="type-btn-icon">{t.icon}</div>
                      <div className="type-btn-label">{t.label}</div>
                      <div className="type-btn-desc">{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="entry-section">
              <div className="entry-section-title">🏥 방문지 & 주차 위치</div>
              <div className="entry-section-body">
                {visitPlaces.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">방문지 (필수)</label>
                    <select className="form-select" value={visitPlaceId}
                      onChange={(e) => setVisitPlaceId(e.target.value)}>
                      <option value="">방문지 선택 안 함</option>
                      {visitPlaces.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.floor ? `[${p.floor}] ` : ""}{p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {parkingLots.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">주차장 (필수)</label>
                    <select className="form-select" value={parkingLotId}
                      onChange={(e) => setParkingLotId(e.target.value)}>
                      <option value="">주차장 선택 안 함</option>
                      {parkingLots.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">
                    차량 위치 (선택){parkingType === "valet" ? " · 발렛 필수 입력 권장" : ""}
                  </label>
                  <input className="form-input" value={parkingLocation}
                    onChange={(e) => setParkingLocation(e.target.value)}
                    placeholder={parkingType === "valet" ? "예: B1 가-15, 2층 3번" : "예: 1층 A-12, 지하 2층"} />
                </div>
              </div>
            </div>

            {/* 무료 처리 토글 */}
            <div className="entry-section">
              <div className="entry-section-body" style={{ padding: "14px 16px" }}>
                <div
                  onClick={() => setIsFree(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px", borderRadius: 12,
                    border: `2px solid ${isFree ? "#16A34A" : "#E2E8F0"}`,
                    background: isFree ? "#F0FDF4" : "#F8FAFC",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isFree ? "#16A34A" : "#1A1D2B" }}>
                      🆓 무료 처리
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      요금 없이 출차 처리됩니다
                    </div>
                  </div>
                  <div style={{
                    width: 48, height: 28, borderRadius: 14,
                    background: isFree ? "#16A34A" : "#CBD5E1",
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 3,
                      left: isFree ? 23 : 3,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => setStep(1)}>← 이전</button>
              <button className="btn-primary" onClick={() => {
                if (visitPlaces.length > 0 && !visitPlaceId) {
                  setRequiredAlertMsg("방문지");
                  setShowRequiredAlert(true);
                  return;
                }
                if (parkingLots.length > 0 && !parkingLotId) {
                  setRequiredAlertMsg("주차장");
                  setShowRequiredAlert(true);
                  return;
                }
                setStep(3);
              }}>다음 →</button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <div className="entry-section">
              <div className="entry-section-title">📋 입차 정보 확인</div>
              <div className="entry-section-body">
                <div className="plate-badge">{plateNumber}</div>
                <div className="summary-card">
                  <div className="summary-row">
                    <span className="summary-key">월주차</span>
                    <span className="summary-val" style={{ color: monthlyInfo ? "#16A34A" : "#64748B" }}>
                      {monthlyInfo ? `✅ ${monthlyInfo.name}` : "일반 차량"}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">주차 유형</span>
                    <span className="summary-val">{parkingType === "valet" ? "🔑 발렛" : "🏢 자주식"}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-key">요금</span>
                    <span className="summary-val" style={{ color: isFree ? "#16A34A" : "#1A1D2B", fontWeight: 700 }}>
                      {isFree ? "🆓 무료 처리" : "요금 적용"}
                    </span>
                  </div>
                  {visitPlaceId && (
                    <div className="summary-row">
                      <span className="summary-key">방문지</span>
                      <span className="summary-val">
                        {visitPlaces.find(p => p.id === visitPlaceId)?.name || "-"}
                      </span>
                    </div>
                  )}
                  {parkingLocation && (
                    <div className="summary-row">
                      <span className="summary-key">차량 위치</span>
                      <span className="summary-val">{parkingLocation}</span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="summary-key">입차 시각</span>
                    <span className="summary-val">
                      {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="entry-section">
              <div className="entry-section-title">📱 알림톡 (선택)</div>
              <div className="entry-section-body">
                <div className="form-group">
                  <label className="form-label">고객 휴대폰 번호</label>
                  <input className="form-input" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="010XXXXXXXX" inputMode="numeric" maxLength={11} />
                </div>
                <div className="phone-notice">
                  🔒&nbsp; 전화번호는 알림톡 발송 즉시 삭제되며, 절대 저장되지 않습니다.
                </div>
              </div>
            </div>

            <div className="entry-footer">
              <button className="btn-secondary" onClick={() => setStep(2)}>← 이전</button>
              <button className="btn-primary gold" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="spinner" /> : "입차 등록 완료"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 중복 차량 팝업 ── */}
      {dupTicket && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "flex-end", zIndex: 300,
        }}>
          <div style={{
            background: "#fff", width: "100%",
            borderRadius: "24px 24px 0 0",
            padding: "28px 20px",
            paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0))",
          }}>
            {/* 핸들 */}
            <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 20px" }} />

            {/* 경고 아이콘 */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: ["exit_requested","car_ready"].includes(dupTicket.status) ? "#FFF7ED" : "#FEF2F2",
                margin: "0 auto 12px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32,
              }}>
                {["exit_requested","car_ready"].includes(dupTicket.status) ? "🚗" : "⚠️"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1A1D2B", marginBottom: 6 }}>
                {["exit_requested","car_ready"].includes(dupTicket.status)
                  ? "출차 처리 중인 차량입니다"
                  : "이미 입차된 차량입니다"}
              </div>
              <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>
                {["exit_requested","car_ready"].includes(dupTicket.status)
                  ? <>출차 처리가 진행 중입니다.<br />출차 완료 후 입차 등록해 주세요.</>
                  : <>동일 번호판이 현재 주차 중입니다.<br />중복 입차를 방지하기 위해 등록이 차단되었습니다.</>
                }
              </div>
            </div>

            {/* 기존 입차 정보 */}
            <div style={{
              background: ["exit_requested","car_ready"].includes(dupTicket.status) ? "#FFF7ED" : "#FEF2F2",
              borderRadius: 14, padding: "14px 16px",
              margin: "16px 0",
              border: ["exit_requested","car_ready"].includes(dupTicket.status) ? "1.5px solid #FED7AA" : "1.5px solid #FECACA",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5,
                color: ["exit_requested","car_ready"].includes(dupTicket.status) ? "#EA580C" : "#DC2626"
              }}>
                {["exit_requested","car_ready"].includes(dupTicket.status) ? "출차 진행 중인 티켓 정보" : "현재 주차 중인 티켓 정보"}
              </div>
              {[
                { label: "차량번호", value: dupTicket.plate_number },
                { label: "입차시각", value: (() => {
                  const d = new Date(dupTicket.entry_at);
                  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) +
                    " (" + Math.floor((Date.now() - d.getTime()) / 60000) + "분 경과)";
                })() },
                { label: "상태", value: {
                  parking: "주차 중", pre_paid: "사전정산 완료",
                  exit_requested: "출차 요청됨", car_ready: "차량 준비 완료",
                }[dupTicket.status] || dupTicket.status },
              ].map((row) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 14, padding: "5px 0",
                  borderBottom: ["exit_requested","car_ready"].includes(dupTicket.status) ? "1px solid #FED7AA" : "1px solid #FECACA",
                }}>
                  <span style={{ color: ["exit_requested","car_ready"].includes(dupTicket.status) ? "#92400E" : "#7F1D1D" }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: ["exit_requested","car_ready"].includes(dupTicket.status) ? "#EA580C" : "#DC2626" }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* 버튼 */}
            {["exit_requested","car_ready"].includes(dupTicket.status) ? (
              // 출차 중 → 출차현황 확인 버튼만
              <button
                onClick={() => router.push(`/crew/parking-list/${dupTicket.id}`)}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  background: "#EA580C", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10,
                }}
              >
                출차 현황 확인하기
              </button>
            ) : (
              // 주차 중 → 기존 티켓 출차처리 버튼
              <button
                onClick={() => router.push(`/crew/parking-list/${dupTicket.id}`)}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  background: "#1428A0", color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10,
                }}
              >
                기존 티켓 출차 처리하기
              </button>
            )}
            <button
              onClick={() => setDupTicket(null)}
              style={{
                width: "100%", height: 48, borderRadius: 12,
                border: "none", background: "#F1F5F9", color: "#475569",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
