// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import CameraOcr from "@/components/crew/CameraOcr";
import { extractDigits } from "@/lib/plate";

/**
 * CREW v2 입차 등록 페이지
 * - GET  /api/v1/stores/:id/operation — 사업장 + 방문지 + 주차장 통합 조회
 * - GET  /api/v1/monthly/check?store_id&plate — 월주차 자동 감지 (debounced)
 * - POST /api/v1/tickets — 입차 등록 + 알림톡 자동 훅
 * - CameraOcr 컴포넌트 재사용 (한글/* 마스킹 호환)
 * - Supabase 직접 호출 0건
 */

const CSS = `
  .cv2-entry-page {
    min-height: 100dvh;
    background: #F8FAFC;
    padding-bottom: 100px;
  }
  .cv2-entry-header {
    background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding: 14px 16px;
    padding-top: calc(14px + env(safe-area-inset-top, 0));
    color: #fff;
    display: flex; align-items: center; gap: 12px;
  }
  .cv2-back-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .cv2-back-btn:active { background: rgba(255,255,255,0.25); }

  .cv2-entry-section {
    margin: 14px 16px 0;
    background: #fff;
    border-radius: 16px;
    border: 1px solid #E2E8F0;
    overflow: hidden;
  }
  .cv2-entry-section-title {
    padding: 14px 16px 10px;
    font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase;
    border-bottom: 1px solid #F1F5F9;
  }
  .cv2-entry-section-body { padding: 16px; }

  /* ── 번호판 입력 (3칸 분할) ── */
  .cv2-plate-split-wrap {
    display: grid;
    grid-template-columns: 1fr 50px 1.5fr;
    gap: 8px;
    padding: 8px;
    border: 2.5px solid #E2E8F0; border-radius: 12px;
    background: #fff; transition: border-color 0.2s;
  }
  .cv2-plate-split-wrap.focused { border-color: #1428A0; }
  .cv2-plate-split-wrap.monthly { border-color: #16A34A; background: #F0FDF4; }
  .cv2-plate-split-num {
    width: 100%; height: 52px;
    border: 1.5px solid #F1F5F9; border-radius: 8px;
    background: #F8FAFC; outline: none;
    font-size: 24px; font-weight: 800; color: #1A1D2B;
    text-align: center; letter-spacing: 1px;
    font-family: 'Outfit', sans-serif;
    box-sizing: border-box;
    padding: 0 4px;
  }
  .cv2-plate-split-num:focus { border-color: #1428A0; background: #fff; }
  .cv2-plate-split-num::placeholder { color: #CBD5E1; font-weight: 600; }
  .cv2-plate-split-kor {
    width: 100%; height: 52px;
    border: 1.5px solid #F1F5F9; border-radius: 8px;
    background: #F8FAFC; outline: none;
    font-size: 22px; font-weight: 800; color: #1A1D2B;
    text-align: center;
    box-sizing: border-box;
    padding: 0;
  }
  .cv2-plate-split-kor:focus { border-color: #1428A0; background: #fff; }
  .cv2-plate-split-kor::placeholder { color: #CBD5E1; font-weight: 600; }
  .cv2-plate-hint {
    margin-top: 8px;
    font-size: 11px; color: #94A3B8;
    text-align: center;
  }

  /* ── OCR 버튼 ── */
  .cv2-ocr-btn {
    width: 100%; height: 56px;
    margin-top: 12px;
    background: #1428A0; color: #fff;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    cursor: pointer; transition: opacity 0.15s;
  }
  .cv2-ocr-btn:active { opacity: 0.85; }

  /* ── 월주차 뱃지 ── */
  .cv2-monthly-badge {
    margin-top: 12px; padding: 12px 14px;
    border-radius: 10px;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 600;
  }
  .cv2-monthly-badge.yes { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .cv2-monthly-badge.no { background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }
  .cv2-monthly-badge.warn { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }

  /* ── 타입 선택 ── */
  .cv2-type-toggle {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .cv2-type-btn {
    padding: 16px 10px; border-radius: 12px;
    border: 2px solid #E2E8F0; background: #F8FAFC;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; transition: all 0.2s;
  }
  .cv2-type-btn.selected { border-color: #1428A0; background: #EEF2FF; }
  .cv2-type-btn.disabled { opacity: 0.4; cursor: not-allowed; }
  .cv2-type-btn-icon { font-size: 28px; }
  .cv2-type-btn-label { font-size: 14px; font-weight: 700; color: #1A1D2B; }
  .cv2-type-btn-desc { font-size: 11px; color: #64748B; }

  /* ── 폼 ── */
  .cv2-form-group { margin-bottom: 14px; }
  .cv2-form-group:last-child { margin-bottom: 0; }
  .cv2-form-label {
    font-size: 13px; font-weight: 600; color: #374151;
    margin-bottom: 6px; display: flex; justify-content: space-between;
  }
  .cv2-form-input, .cv2-form-select {
    width: 100%; height: 48px;
    border: 1.5px solid #E2E8F0; border-radius: 10px;
    padding: 0 14px; font-size: 15px; color: #1A1D2B;
    background: #fff; outline: none; transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .cv2-form-input:focus, .cv2-form-select:focus { border-color: #1428A0; }

  .cv2-checkbox-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px;
    background: #F8FAFC; border-radius: 10px;
    cursor: pointer;
  }

  /* ── 알림톡 안내 ── */
  .cv2-phone-notice {
    margin-top: 8px; padding: 8px 12px;
    background: #FFF7ED; border-radius: 8px;
    font-size: 11px; color: #92400E; line-height: 1.5;
  }

  /* ── 제출 버튼 ── */
  .cv2-entry-footer {
    position: fixed; bottom: 80px; left: 0; right: 0;
    padding: 16px;
    background: #fff; border-top: 1px solid #E2E8F0;
    z-index: 50;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }
  .cv2-submit-btn {
    width: 100%; height: 56px;
    border: none; border-radius: 14px;
    font-size: 16px; font-weight: 800; cursor: pointer;
    transition: opacity 0.15s;
    background: #16A34A; color: #fff;
  }
  .cv2-submit-btn:active { opacity: 0.85; }
  .cv2-submit-btn:disabled { background: #CBD5E1; cursor: not-allowed; }

  /* ── 토스트 (성공) ── */
  .cv2-toast-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 999;
  }
  .cv2-toast {
    background: #fff; border-radius: 20px;
    padding: 24px 28px;
    text-align: center; min-width: 280px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
`;

interface OperationData {
  store: any;
  visit_places: any[];
  parking_lots: any[];
}

interface MonthlyInfo {
  is_monthly: boolean;
  customer_name?: string;
  end_date?: string;
  days_remaining?: number | null;
}

export default function CrewV2EntryPage() {
  const router = useRouter();

  // 사업장 컨텍스트
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [opData, setOpData] = useState<OperationData | null>(null);
  const [opLoading, setOpLoading] = useState(true);

  // 번호판 입력
  const [platePart1, setPlatePart1] = useState("");
  const [plateKor, setPlateKor] = useState("");
  const [platePart2, setPlatePart2] = useState("");
  const [splitFocused, setSplitFocused] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [entryMethod, setEntryMethod] = useState<"manual" | "ocr">("manual");

  // 월주차 정보
  const [monthlyInfo, setMonthlyInfo] = useState<MonthlyInfo | null>(null);
  const [monthlyChecking, setMonthlyChecking] = useState(false);
  const monthlyTimer = useRef<any>(null);

  // 폼 필드
  const [parkingType, setParkingType] = useState<"valet" | "self">("valet");
  const [visitPlaceId, setVisitPlaceId] = useState("");
  const [parkingLotId, setParkingLotId] = useState("");
  const [parkingLocation, setParkingLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [isFree, setIsFree] = useState(false);

  // 제출
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  // refs
  const part1Ref = useRef<HTMLInputElement>(null);
  const korRef = useRef<HTMLInputElement>(null);
  const part2Ref = useRef<HTMLInputElement>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(sname || "매장");
    loadOperation(sid);
  }, [router]);

  const loadOperation = async (sid: string) => {
    setOpLoading(true);
    try {
      const res = await fetch(`/api/v1/stores/${sid}/operation`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) router.replace("/v2/crew/login?error=session_expired");
        return;
      }
      const { data } = await res.json();
      setOpData(data);

      // 방문지 — 마지막 선택 복원 (매장별)
      const savedVisit = localStorage.getItem(`crew_v2_last_visit_${sid}`);
      if (savedVisit && data?.visit_places?.some((vp: any) => vp.id === savedVisit)) {
        setVisitPlaceId(savedVisit);
      }

      // 주차장 — 마지막 선택 복원 또는 1개면 자동
      const savedLot = localStorage.getItem(`crew_v2_last_lot_${sid}`);
      if (savedLot && data?.parking_lots?.some((lot: any) => lot.id === savedLot)) {
        setParkingLotId(savedLot);
      } else if (data?.parking_lots?.length === 1) {
        setParkingLotId(data.parking_lots[0].id);
      }
    } catch (err) {
      console.error("loadOperation error:", err);
    } finally {
      setOpLoading(false);
    }
  };

  // 방문지 변경 시 저장
  const handleVisitPlaceChange = (id: string) => {
    setVisitPlaceId(id);
    if (storeId) {
      if (id) {
        localStorage.setItem(`crew_v2_last_visit_${storeId}`, id);
      } else {
        // "사업장 기본 요금" 선택 시 저장 제거
        localStorage.removeItem(`crew_v2_last_visit_${storeId}`);
      }
    }
  };

  // 주차장 변경 시 저장
  const handleParkingLotChange = (id: string) => {
    setParkingLotId(id);
    if (storeId && id) {
      localStorage.setItem(`crew_v2_last_lot_${storeId}`, id);
    }
  };

  // ── 번호판 조합 ──
  const plateNumber = `${platePart1}${plateKor}${platePart2}`;

  // ── 월주차 체크 (debounce 500ms) ──
  useEffect(() => {
    if (monthlyTimer.current) clearTimeout(monthlyTimer.current);

    const digits = extractDigits(plateNumber);
    if (digits.length < 4 || !storeId) {
      setMonthlyInfo(null);
      return;
    }

    monthlyTimer.current = setTimeout(async () => {
      setMonthlyChecking(true);
      try {
        const params = new URLSearchParams({ store_id: storeId, plate: plateNumber });
        const res = await fetch(`/api/v1/monthly/check?${params}`, {
          credentials: "include",
        });
        if (res.ok) {
          const { data } = await res.json();
          setMonthlyInfo(data);
          // 월주차면 자동으로 발렛 + 무료 처리
          if (data?.is_monthly) {
            setParkingType("valet");
            setIsFree(true);
          }
        }
      } catch { /* silent */ }
      setMonthlyChecking(false);
    }, 500);

    return () => {
      if (monthlyTimer.current) clearTimeout(monthlyTimer.current);
    };
  }, [plateNumber, storeId]);

  // ── 입력 핸들러 ──
  const handlePart1Change = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 3);
    setPlatePart1(digits);
    if (digits.length >= 3 && !plateKor) {
      setTimeout(() => korRef.current?.focus(), 50);
    }
  };

  const handleKorChange = (v: string) => {
    // 한글 1자 또는 * 1자 허용
    const filtered = v.replace(/[^가-힣*]/g, "").slice(0, 1);
    setPlateKor(filtered);
    if (filtered) {
      setTimeout(() => part2Ref.current?.focus(), 50);
    }
  };

  const handlePart2Change = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPlatePart2(digits);
  };

  // ── OCR 결과 적용 ──
  const handleOcrConfirm = (plate: string) => {
    const n = plate.replace(/\s/g, "");
    const markMatch = n.match(/[가-힣*]/);
    if (markMatch) {
      const idx = n.indexOf(markMatch[0]);
      setPlatePart1(n.slice(0, idx));
      setPlateKor(markMatch[0]);
      setPlatePart2(n.slice(idx + 1));
    } else {
      setPlatePart1(n.slice(0, 3));
      setPlateKor("");
      setPlatePart2(n.slice(3));
    }
    setEntryMethod("ocr");
    setShowCamera(false);
  };

  // ── 사업장 변경 시 visit_place_id 초기화 ──
  // (사업장은 고정이라 신경 안 써도 됨)

  // ── 검증 ──
  const isValidPlate = () => {
    const digits = extractDigits(plateNumber);
    return digits.length >= 6 && plateKor.length === 1;
  };
  const canSubmit = !!storeId && isValidPlate() && !!parkingType && !submitting;

  // ── 제출 ──
  const handleSubmit = async () => {
    if (!canSubmit || !storeId) return;
    setSubmitting(true);

    try {
      const last4 = extractDigits(plateNumber).slice(-4);
      const cleanedPhone = phone.replace(/[^0-9]/g, "");

      const body: any = {
        store_id: storeId,
        plate_number: plateNumber,
        plate_last4: last4,
        parking_type: parkingType,
        entry_method: entryMethod,
        is_free: isFree,
      };
      if (visitPlaceId) body.visit_place_id = visitPlaceId;
      if (parkingLotId) body.parking_lot_id = parkingLotId;
      if (parkingLocation.trim()) body.parking_location = parkingLocation.trim();
      if (cleanedPhone.length >= 10) body.phone = cleanedPhone;

      const res = await fetch("/api/v1/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok) {
        // 중복 차량
        if (result?.error?.code === "TICKET_OVERDUE") {
          const existingId = result?.error?.details?.existing_ticket_id;
          if (existingId && confirm("이미 입차 중인 차량입니다. 해당 티켓으로 이동할까요?")) {
            router.push(`/v2/crew/parking/${existingId}`);
            return;
          }
          alert("이미 입차 중인 차량입니다");
        } else {
          alert(result?.error?.message || "입차 등록에 실패했습니다");
        }
        setSubmitting(false);
        return;
      }

      // 성공 → 토스트 표시 후 목록으로
      setSuccessInfo(result.data);
      setTimeout(() => {
        router.replace("/v2/crew/parking");
      }, 1500);
    } catch (err) {
      console.error("submit error:", err);
      alert("네트워크 오류가 발생했습니다");
      setSubmitting(false);
    }
  };

  if (opLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2-entry-page">
          <div className="cv2-entry-header">
            <div className="cv2-back-btn" onClick={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>입차 등록</div>
          </div>
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>로딩 중...</div>
        </div>
      </>
    );
  }

  const monthlyMsg = monthlyInfo?.is_monthly
    ? `📅 월주차 차량 — ${monthlyInfo.customer_name || ""}${
        monthlyInfo.days_remaining != null
          ? ` · D-${monthlyInfo.days_remaining < 0 ? "만료" : monthlyInfo.days_remaining}`
          : ""
      }`
    : null;

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2-entry-page">
        {/* 헤더 */}
        <div className="cv2-entry-header">
          <div className="cv2-back-btn" onClick={() => router.back()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>입차 등록</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              📍 {storeName}
            </div>
          </div>
        </div>

        {/* 1) 번호판 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">1. 차량 번호판</div>
          <div className="cv2-entry-section-body">
            <div className={`cv2-plate-split-wrap ${splitFocused ? "focused" : ""} ${monthlyInfo?.is_monthly ? "monthly" : ""}`}>
              <input
                ref={part1Ref}
                className="cv2-plate-split-num"
                value={platePart1}
                onChange={(e) => handlePart1Change(e.target.value)}
                onFocus={() => setSplitFocused(true)}
                onBlur={() => setSplitFocused(false)}
                placeholder="123"
                inputMode="numeric"
                maxLength={3}
              />
              <input
                ref={korRef}
                className="cv2-plate-split-kor"
                value={plateKor}
                onChange={(e) => handleKorChange(e.target.value)}
                onCompositionEnd={(e: any) => handleKorChange(e.target.value)}
                onFocus={() => setSplitFocused(true)}
                onBlur={() => setSplitFocused(false)}
                placeholder="*"
                maxLength={1}
              />
              <input
                ref={part2Ref}
                className="cv2-plate-split-num"
                value={platePart2}
                onChange={(e) => handlePart2Change(e.target.value)}
                onFocus={() => setSplitFocused(true)}
                onBlur={() => setSplitFocused(false)}
                placeholder="4567"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
            <div className="cv2-plate-hint">
              앞 숫자 · 한글(또는 *) · 뒤 4자리
            </div>

            {/* OCR 버튼 */}
            <button className="cv2-ocr-btn" onClick={() => setShowCamera(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              📷 카메라로 번호판 인식
            </button>

            {/* 월주차 뱃지 */}
            {monthlyChecking && (
              <div className="cv2-monthly-badge no">⏳ 월주차 확인 중...</div>
            )}
            {!monthlyChecking && monthlyInfo?.is_monthly && (
              <div className={`cv2-monthly-badge ${(monthlyInfo.days_remaining ?? 0) < 7 ? "warn" : "yes"}`}>
                <span>{monthlyMsg}</span>
              </div>
            )}
            {!monthlyChecking && monthlyInfo && !monthlyInfo.is_monthly && extractDigits(plateNumber).length >= 6 && (
              <div className="cv2-monthly-badge no">일반 차량 — 월주차 등록 없음</div>
            )}
          </div>
        </div>

        {/* 2) 주차 유형 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">2. 주차 유형</div>
          <div className="cv2-entry-section-body">
            <div className="cv2-type-toggle">
              <div
                className={`cv2-type-btn ${parkingType === "valet" ? "selected" : ""} ${monthlyInfo?.is_monthly ? "" : ""}`}
                onClick={() => setParkingType("valet")}
              >
                <div className="cv2-type-btn-icon">🔑</div>
                <div className="cv2-type-btn-label">발렛</div>
                <div className="cv2-type-btn-desc">CREW가 주차</div>
              </div>
              <div
                className={`cv2-type-btn ${parkingType === "self" ? "selected" : ""} ${monthlyInfo?.is_monthly ? "disabled" : ""}`}
                onClick={() => !monthlyInfo?.is_monthly && setParkingType("self")}
              >
                <div className="cv2-type-btn-icon">🏢</div>
                <div className="cv2-type-btn-label">자주식</div>
                <div className="cv2-type-btn-desc">고객 직접 주차</div>
              </div>
            </div>
            {monthlyInfo?.is_monthly && (
              <div style={{ fontSize: 11, color: "#16A34A", marginTop: 8 }}>
                ※ 월주차는 발렛으로 자동 설정됩니다
              </div>
            )}
          </div>
        </div>

        {/* 3) 상세 정보 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">3. 상세 정보</div>
          <div className="cv2-entry-section-body">
            {/* 방문지 */}
            {opData?.visit_places && opData.visit_places.length > 0 && (
              <div className="cv2-form-group">
                <label className="cv2-form-label">방문지 (요금체계)</label>
                <select
                  className="cv2-form-select"
                  value={visitPlaceId}
                  onChange={(e) => handleVisitPlaceChange(e.target.value)}
                >
                  <option value="">-- 사업장 기본 요금 --</option>
                  {opData.visit_places.map((vp: any) => (
                    <option key={vp.id} value={vp.id}>
                      {vp.floor ? `${vp.floor}F · ` : ""}{vp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 주차장 */}
            {opData?.parking_lots && opData.parking_lots.length > 1 && (
              <div className="cv2-form-group">
                <label className="cv2-form-label">주차장</label>
                <select
                  className="cv2-form-select"
                  value={parkingLotId}
                  onChange={(e) => handleParkingLotChange(e.target.value)}
                >
                  <option value="">-- 선택 --</option>
                  {opData.parking_lots.map((lot: any) => (
                    <option key={lot.id} value={lot.id}>{lot.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 주차 위치 */}
            <div className="cv2-form-group">
              <label className="cv2-form-label">
                <span>주차 위치</span>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>선택</span>
              </label>
              <input
                className="cv2-form-input"
                value={parkingLocation}
                onChange={(e) => setParkingLocation(e.target.value)}
                placeholder="예: B1-12, 외부 5번"
              />
            </div>

            {/* 전화번호 */}
            <div className="cv2-form-group">
              <label className="cv2-form-label">
                <span>고객 전화번호</span>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>알림톡 발송용</span>
              </label>
              <input
                className="cv2-form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                inputMode="numeric"
                type="tel"
              />
              <div className="cv2-phone-notice">
                ⚠️ 입차확인 알림톡 발송 즉시 삭제됩니다 (DB 미저장 정책)
              </div>
            </div>

            {/* 무료 */}
            {!monthlyInfo?.is_monthly && (
              <div className="cv2-form-group">
                <label className="cv2-checkbox-row">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#1428A0" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1D2B" }}>
                    🎟 무료 처리
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="cv2-entry-footer">
          <button
            className="cv2-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? "등록 중..." :
             !isValidPlate() ? "차량번호를 입력하세요" :
             monthlyInfo?.is_monthly ? "월주차 입차 등록" :
             "입차 등록"}
          </button>
        </div>

        {/* OCR 카메라 모달 (fixed overlay로 페이지 늘어남 방지) */}
        {showCamera && (
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "#0d0d0d",
          }}>
            <CameraOcr
              onConfirm={handleOcrConfirm}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        )}

        {/* 성공 토스트 */}
        {successInfo && (
          <div className="cv2-toast-overlay">
            <div className="cv2-toast">
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", marginBottom: 6 }}>
                입차 완료
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1428A0", letterSpacing: 1, fontFamily: "'Outfit', sans-serif" }}>
                {successInfo.plate_number}
              </div>
              {successInfo.is_monthly && (
                <div style={{ fontSize: 13, color: "#16A34A", marginTop: 8, fontWeight: 700 }}>
                  📅 월주차 차량
                </div>
              )}
              {successInfo.alimtalk_requested && (
                <div style={{ fontSize: 12, color: "#92400E", marginTop: 6 }}>
                  알림톡 발송 요청됨
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
