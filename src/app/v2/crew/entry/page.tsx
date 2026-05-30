// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CameraOcr from "@/components/crew/CameraOcr";
import CarInfoModal from "@/components/crew/CarInfoModal";
import VehiclePhotoCapture from "@/components/crew/VehiclePhotoCapture";
import { createClient } from "@/lib/supabase/client";
import { extractDigits } from "@/lib/plate";

/**
 * CREW v2 입차 등록 페이지 — 4자리 OCR 전용 모드 (Part 19B-5C)
 * - 일반차 전용 (월주차는 풀번호 유지 → 별도 경로)
 * - 단일 4자리 입력(수동/OCR) → GET /api/v1/tickets/check-collision (debounce 500ms)
 * - 충돌 시 차종/컬러 입력 모달(CarInfoModal) → POST /api/v1/tickets (confirm_collision=true)
 * - 충돌 없으면 바로 입차 등록
 * - CameraOcr 재사용 (결과 풀번호에서 last4만 추출 · 컴포넌트 무수정)
 * - P1-8b: 입차확인 → 차량사진 연속촬영(VehiclePhotoCapture, 패스 가능) → POST → Storage 업로드 → PATCH photos
 * - DB 쿼리는 전부 v1 API 경유(직접 호출 0건). 단, vehicle-photos Storage 업로드만 예외 허용
 *   (P1-8 스펙·P1-8a 메모 확정 — Storage는 DB쿼리와 별개, 네이티브 전환 시 백그라운드 업로드로 대체)
 */

const CSS = `
  .cv2-entry-page { min-height: 100dvh; background: #F8FAFC; padding-bottom: 100px; }
  .cv2-entry-header {
    background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
    padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top, 0));
    color: #fff; display: flex; align-items: center; gap: 12px;
  }
  .cv2-back-btn {
    width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .cv2-back-btn:active { background: rgba(255,255,255,0.25); }

  .cv2-entry-section {
    margin: 14px 16px 0; background: #fff; border-radius: 16px;
    border: 1px solid #E2E8F0; overflow: hidden;
  }
  .cv2-entry-section-title {
    padding: 14px 16px 10px; font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px solid #F1F5F9;
  }
  .cv2-entry-section-body { padding: 16px; }

  /* ── 4자리 입력 ── */
  .cv2-l4-wrap {
    border: 2.5px solid #E2E8F0; border-radius: 13px; background: #fff;
    padding: 10px; transition: border-color 0.2s;
  }
  .cv2-l4-wrap.focused { border-color: #1428A0; }
  .cv2-l4-wrap.collision { border-color: #F59E0B; background: #FFFBEB; }
  .cv2-l4-input {
    width: 100%; height: 64px; border: none; outline: none; background: transparent;
    text-align: center; font-family: 'Outfit', sans-serif; font-weight: 800;
    font-size: 44px; letter-spacing: 14px; color: #1A1D2B; text-indent: 14px;
    box-sizing: border-box;
  }
  .cv2-l4-input::placeholder { color: #D7DEE8; letter-spacing: 14px; }
  .cv2-l4-hint { margin-top: 9px; font-size: 11px; color: #94A3B8; text-align: center; }
  .cv2-l4-hint b { color: #1428A0; }

  .cv2-ocr-btn {
    width: 100%; height: 56px; margin-top: 12px; background: #1428A0; color: #fff;
    border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  }
  .cv2-ocr-btn:active { opacity: 0.85; }

  .cv2-scoreline {
    margin-top: 10px; padding: 10px 13px; border-radius: 10px;
    font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px;
  }
  .cv2-scoreline.ok { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .cv2-scoreline.warn { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
  .cv2-scoreline.checking { background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }

  /* ── 타입 선택 ── */
  .cv2-type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cv2-type-btn {
    padding: 16px 10px; border-radius: 12px; border: 2px solid #E2E8F0; background: #F8FAFC;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; transition: all 0.2s;
  }
  .cv2-type-btn.selected { border-color: #1428A0; background: #EEF2FF; }
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
    width: 100%; height: 48px; border: 1.5px solid #E2E8F0; border-radius: 10px;
    padding: 0 14px; font-size: 15px; color: #1A1D2B; background: #fff;
    outline: none; transition: border-color 0.2s; box-sizing: border-box;
  }
  .cv2-form-input:focus, .cv2-form-select:focus { border-color: #1428A0; }
  .cv2-checkbox-row {
    display: flex; align-items: center; gap: 10px; padding: 12px;
    background: #F8FAFC; border-radius: 10px; cursor: pointer;
  }
  .cv2-phone-notice {
    margin-top: 8px; padding: 8px 12px; background: #FFF7ED; border-radius: 8px;
    font-size: 11px; color: #92400E; line-height: 1.5;
  }

  /* ── 제출 ── */
  .cv2-entry-footer {
    position: fixed; bottom: 80px; left: 0; right: 0; padding: 16px;
    background: #fff; border-top: 1px solid #E2E8F0; z-index: 50;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }
  .cv2-submit-btn {
    width: 100%; height: 56px; border: none; border-radius: 14px;
    font-size: 16px; font-weight: 800; cursor: pointer; transition: opacity 0.15s;
    background: #16A34A; color: #fff;
  }
  .cv2-submit-btn:active { opacity: 0.85; }
  .cv2-submit-btn:disabled { background: #CBD5E1; cursor: not-allowed; }
  .cv2-submit-btn.collision { background: #F59E0B; }

  /* ── 충돌 카드 (모달 topContent) ── */
  .cv2-coll-card {
    border: 1px solid #E2E8F0; border-radius: 12px; padding: 11px 13px; margin-bottom: 9px;
    background: #FAFBFD; display: flex; align-items: center; gap: 11px;
  }
  .cv2-coll-pn { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 17px; color: #1A1D2B; }
  .cv2-coll-meta { flex: 1; font-size: 11px; color: #64748B; line-height: 1.5; }
  .cv2-coll-tag {
    display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 7px;
    border-radius: 6px; background: #EEF2FF; color: #1428A0;
  }
  .cv2-coll-divider {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 2px;
    color: #94A3B8; font-size: 11px; font-weight: 600;
  }
  .cv2-coll-divider::before, .cv2-coll-divider::after { content: ""; flex: 1; height: 1px; background: #E2E8F0; }

  /* ── 토스트 ── */
  .cv2-toast-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center; z-index: 1100;
  }
  .cv2-toast {
    background: #fff; border-radius: 20px; padding: 24px 28px;
    text-align: center; min-width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
`;

interface OperationData { store: any; visit_places: any[]; parking_lots: any[]; }

export default function CrewV2EntryPage() {
  const router = useRouter();

  // 사업장 컨텍스트
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [opData, setOpData] = useState<OperationData | null>(null);
  const [opLoading, setOpLoading] = useState(true);

  // 4자리 입력
  const [last4, setLast4] = useState("");
  const [focused, setFocused] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [entryMethod, setEntryMethod] = useState<"manual" | "ocr">("manual");

  // 충돌 검색
  const [collision, setCollision] = useState<{ has_collision: boolean; count: number; matches: any[] } | null>(null);
  const [collisionChecking, setCollisionChecking] = useState(false);
  const collisionTimer = useRef<any>(null);

  // 차종/컬러 모달
  const [showCarModal, setShowCarModal] = useState(false);
  const [carType, setCarType] = useState("");
  const [carColor, setCarColor] = useState("");

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

  // P1-8b: 차량사진 단계
  const [photoStep, setPhotoStep] = useState(false);      // 연속촬영 오버레이 표시
  const [pendingCarInfo, setPendingCarInfo] = useState(false); // 충돌차종 확정 여부(사진 후 POST에 반영)
  const [uploadInfo, setUploadInfo] = useState<{ done: number; total: number; failed: number } | null>(null);

  const supabase = createClient(); // vehicle-photos Storage 업로드 전용

  const inputRef = useRef<HTMLInputElement>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) { router.replace("/v2/crew/login"); return; }
    setStoreId(sid);
    setStoreName(sname || "매장");
    loadOperation(sid);
  }, [router]);

  const loadOperation = async (sid: string) => {
    setOpLoading(true);
    try {
      const res = await fetch(`/api/v1/stores/${sid}/operation`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) router.replace("/v2/crew/login?error=session_expired");
        return;
      }
      const { data } = await res.json();
      setOpData(data);

      const savedVisit = localStorage.getItem(`crew_v2_last_visit_${sid}`);
      if (savedVisit && data?.visit_places?.some((vp: any) => vp.id === savedVisit)) setVisitPlaceId(savedVisit);

      const savedLot = localStorage.getItem(`crew_v2_last_lot_${sid}`);
      if (savedLot && data?.parking_lots?.some((lot: any) => lot.id === savedLot)) setParkingLotId(savedLot);
      else if (data?.parking_lots?.length === 1) setParkingLotId(data.parking_lots[0].id);
    } catch (err) {
      console.error("loadOperation error:", err);
    } finally {
      setOpLoading(false);
    }
  };

  const handleVisitPlaceChange = (id: string) => {
    setVisitPlaceId(id);
    if (storeId) {
      if (id) localStorage.setItem(`crew_v2_last_visit_${storeId}`, id);
      else localStorage.removeItem(`crew_v2_last_visit_${storeId}`);
    }
  };
  const handleParkingLotChange = (id: string) => {
    setParkingLotId(id);
    if (storeId && id) localStorage.setItem(`crew_v2_last_lot_${storeId}`, id);
  };

  // ── 4자리 충돌 검색 (debounce 500ms) ──
  useEffect(() => {
    if (collisionTimer.current) clearTimeout(collisionTimer.current);
    if (last4.length !== 4 || !storeId) { setCollision(null); return; }

    collisionTimer.current = setTimeout(async () => {
      setCollisionChecking(true);
      try {
        const params = new URLSearchParams({ store_id: storeId, plate_last4: last4 });
        const res = await fetch(`/api/v1/tickets/check-collision?${params}`, { credentials: "include" });
        if (res.ok) {
          const { data } = await res.json();
          setCollision(data);
        }
      } catch { /* silent */ }
      setCollisionChecking(false);
    }, 500);

    return () => { if (collisionTimer.current) clearTimeout(collisionTimer.current); };
  }, [last4, storeId]);

  // ── 입력 ──
  const handleLast4Change = (v: string) => {
    setLast4(v.replace(/\D/g, "").slice(0, 4));
    setEntryMethod("manual");
  };

  // ── OCR 결과 → 풀번호에서 last4만 추출 ──
  const handleOcrConfirm = (plate: string) => {
    const digits = extractDigits(plate);
    setLast4(digits.slice(-4));
    setEntryMethod("ocr");
    setShowCamera(false);
  };

  // ── 검증 ──
  const canSubmit = !!storeId && last4.length === 4 && !submitting && !collisionChecking;

  // ── 차량사진 Storage 업로드 (진행률 + 슬롯당 최대 3회 재시도) ──
  // 경로: {org_id}/{ticket_id}/{idx}_{slotKey}.jpg  → PATCH prefix 검증과 정합
  // 라벨은 한글이라 Storage 키엔 ASCII 슬롯키 사용 (한글 키 이슈 회피)
  const uploadVehiclePhotos = async (
    photos: { blob: Blob; label: string }[],
    prefix: string
  ): Promise<string[]> => {
    const SLOT_KEYS = ["front", "rear", "left", "right", "extra1", "extra2"];
    const uploaded: string[] = [];
    let failed = 0;
    setUploadInfo({ done: 0, total: photos.length, failed: 0 });
    for (let i = 0; i < photos.length; i++) {
      const path = `${prefix}${i}_${SLOT_KEYS[i] ?? `slot${i}`}.jpg`;
      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          const { error } = await supabase.storage
            .from("vehicle-photos")
            .upload(path, photos[i].blob, { contentType: "image/jpeg", upsert: true });
          if (!error) { success = true; uploaded.push(path); }
          else await new Promise((r) => setTimeout(r, 600)); // 재시도 백오프
        } catch {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      if (!success) failed++;
      setUploadInfo({ done: i + 1, total: photos.length, failed });
    }
    return uploaded;
  };

  // ── 제출 핸들러 (사진 단계 통과 후 호출) ──
  const doSubmit = async (withCarInfo: boolean, photos: { blob: Blob; label: string }[] = []) => {
    if (!storeId || last4.length !== 4) return;
    setSubmitting(true);
    try {
      const cleanedPhone = phone.replace(/[^0-9]/g, "");
      const body: any = {
        store_id: storeId,
        plate_number: last4,       // 4자리 모드: 4자리 그대로 저장
        plate_last4: last4,
        parking_type: parkingType,
        entry_method: entryMethod,
        is_free: isFree,
      };
      if (withCarInfo) {
        body.confirm_collision = true;
        if (carType) body.car_type = carType;
        if (carColor) body.car_color = carColor;
      }
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
        if (result?.error?.code === "TICKET_OVERDUE") {
          const existingId = result?.error?.details?.existing_ticket_id;
          if (existingId && confirm("이미 입차 중인 차량입니다. 해당 티켓으로 이동할까요?")) {
            router.push(`/v2/crew/parking/${existingId}`); return;
          }
          alert("이미 입차 중인 차량입니다");
        } else {
          alert(result?.error?.message || "입차 등록에 실패했습니다");
        }
        setSubmitting(false);
        return;
      }

      // ── POST 성공 → 차량사진 업로드 + 경로 기록 (P1-8b) ──
      const ticketId = result.data?.ticket_id;
      const prefix = result.data?.photo_path_prefix;
      if (photos.length > 0 && ticketId && prefix) {
        const uploadedPaths = await uploadVehiclePhotos(photos, prefix);
        if (uploadedPaths.length > 0) {
          try {
            await fetch(`/api/v1/tickets/${ticketId}/photos`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicle_photos: uploadedPaths }),
            });
          } catch (e) {
            // 사진 경로 기록 실패는 비치명적 — 입차 자체는 이미 성공
            console.error("photos PATCH error:", e);
          }
        }
        if (uploadedPaths.length < photos.length) {
          alert(`사진 ${photos.length}장 중 ${uploadedPaths.length}장만 업로드되었습니다.\n입차는 정상 등록됩니다.`);
        }
        setUploadInfo(null);
      }

      setShowCarModal(false);
      setSuccessInfo({ ...result.data, car_type: carType, car_color: carColor });
      setTimeout(() => router.replace("/v2/crew/parking"), 1500);
    } catch (err) {
      console.error("submit error:", err);
      alert("네트워크 오류가 발생했습니다");
      setUploadInfo(null);
      setSubmitting(false);
    }
  };

  // 메인 버튼: 충돌이면 차종/컬러 모달, 아니면 사진 단계로
  const handleMainSubmit = () => {
    if (collision?.has_collision) setShowCarModal(true);
    else { setPendingCarInfo(false); setPhotoStep(true); }
  };

  // 사진 촬영 완료(또는 패스/0장) → 실제 제출(POST → 업로드 → PATCH)
  const handlePhotosComplete = async (photos: { blob: Blob; label: string }[]) => {
    setPhotoStep(false);
    await doSubmit(pendingCarInfo, photos);
  };

  if (opLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2-entry-page">
          <div className="cv2-entry-header">
            <div className="cv2-back-btn" onClick={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>입차 등록</div>
          </div>
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>로딩 중...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2-entry-page">
        {/* 헤더 */}
        <div className="cv2-entry-header">
          <div className="cv2-back-btn" onClick={() => router.back()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>입차 등록</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>📍 {storeName}</div>
          </div>
        </div>

        {/* 1) 4자리 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">1. 차량 뒤 4자리</div>
          <div className="cv2-entry-section-body">
            <div className={`cv2-l4-wrap ${focused ? "focused" : ""} ${collision?.has_collision ? "collision" : ""}`}>
              <input
                ref={inputRef}
                className="cv2-l4-input"
                value={last4}
                onChange={(e) => handleLast4Change(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="0000"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
            <div className="cv2-l4-hint">번호판 <b>뒤 4자리 숫자</b>만 입력 · 일반차 전용</div>

            <button className="cv2-ocr-btn" onClick={() => setShowCamera(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
              📷 카메라로 4자리 인식
            </button>

            {collisionChecking && <div className="cv2-scoreline checking">⏳ 동일 4자리 차량 확인 중...</div>}
            {!collisionChecking && collision?.has_collision && (
              <div className="cv2-scoreline warn">⚠️ 동일 4자리 활성 차량 {collision.count}대 — 입차 시 차종/컬러로 구분</div>
            )}
            {!collisionChecking && collision && !collision.has_collision && last4.length === 4 && (
              <div className="cv2-scoreline ok">✓ 동일 4자리 차량 없음 — 바로 입차 가능</div>
            )}
          </div>
        </div>

        {/* 2) 주차 유형 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">2. 주차 유형</div>
          <div className="cv2-entry-section-body">
            <div className="cv2-type-toggle">
              <div className={`cv2-type-btn ${parkingType === "valet" ? "selected" : ""}`} onClick={() => setParkingType("valet")}>
                <div className="cv2-type-btn-icon">🔑</div>
                <div className="cv2-type-btn-label">발렛</div>
                <div className="cv2-type-btn-desc">CREW가 주차</div>
              </div>
              <div className={`cv2-type-btn ${parkingType === "self" ? "selected" : ""}`} onClick={() => setParkingType("self")}>
                <div className="cv2-type-btn-icon">🏢</div>
                <div className="cv2-type-btn-label">자주식</div>
                <div className="cv2-type-btn-desc">고객 직접 주차</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3) 상세 정보 */}
        <div className="cv2-entry-section">
          <div className="cv2-entry-section-title">3. 상세 정보</div>
          <div className="cv2-entry-section-body">
            {opData?.visit_places && opData.visit_places.length > 0 && (
              <div className="cv2-form-group">
                <label className="cv2-form-label">방문지 (요금체계)</label>
                <select className="cv2-form-select" value={visitPlaceId} onChange={(e) => handleVisitPlaceChange(e.target.value)}>
                  <option value="">-- 사업장 기본 요금 --</option>
                  {opData.visit_places.map((vp: any) => (
                    <option key={vp.id} value={vp.id}>{vp.floor ? `${vp.floor}F · ` : ""}{vp.name}</option>
                  ))}
                </select>
              </div>
            )}
            {opData?.parking_lots && opData.parking_lots.length > 1 && (
              <div className="cv2-form-group">
                <label className="cv2-form-label">주차장</label>
                <select className="cv2-form-select" value={parkingLotId} onChange={(e) => handleParkingLotChange(e.target.value)}>
                  <option value="">-- 선택 --</option>
                  {opData.parking_lots.map((lot: any) => (<option key={lot.id} value={lot.id}>{lot.name}</option>))}
                </select>
              </div>
            )}
            <div className="cv2-form-group">
              <label className="cv2-form-label"><span>주차 위치</span><span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>선택</span></label>
              <input className="cv2-form-input" value={parkingLocation} onChange={(e) => setParkingLocation(e.target.value)} placeholder="예: B1-12, 외부 5번" />
            </div>
            <div className="cv2-form-group">
              <label className="cv2-form-label"><span>고객 전화번호</span><span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>알림톡 발송용</span></label>
              <input className="cv2-form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-1234-5678" inputMode="numeric" type="tel" />
              <div className="cv2-phone-notice">⚠️ 입차확인 알림톡 발송 즉시 삭제됩니다 (DB 미저장 정책)</div>
            </div>
            <div className="cv2-form-group">
              <label className="cv2-checkbox-row">
                <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#1428A0" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1D2B" }}>🎟 무료 처리</span>
              </label>
            </div>
          </div>
        </div>

        {/* 제출 */}
        <div className="cv2-entry-footer">
          <button
            className={`cv2-submit-btn ${collision?.has_collision ? "collision" : ""}`}
            disabled={!canSubmit}
            onClick={handleMainSubmit}
          >
            {submitting ? "등록 중..." :
             last4.length !== 4 ? "차량 뒤 4자리를 입력하세요" :
             collisionChecking ? "확인 중..." :
             collision?.has_collision ? "차종·컬러 입력 후 입차" :
             "입차 등록"}
          </button>
        </div>

        {/* OCR 카메라 */}
        {showCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0d0d0d" }}>
            <CameraOcr onConfirm={handleOcrConfirm} onCancel={() => setShowCamera(false)} />
          </div>
        )}

        {/* P1-8b: 차량사진 연속촬영 (패스 가능 · 0장 허용) */}
        {photoStep && (
          <VehiclePhotoCapture
            onComplete={handlePhotosComplete}
            onCancel={() => setPhotoStep(false)}
          />
        )}

        {/* P1-8b: 사진 업로드 진행률 */}
        {uploadInfo && (
          <div className="cv2-toast-overlay">
            <div className="cv2-toast">
              <div style={{ fontSize: 40, marginBottom: 10 }}>📤</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1D2B", marginBottom: 10 }}>차량사진 업로드 중…</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1428A0" }}>
                {uploadInfo.done} / {uploadInfo.total}
              </div>
              {uploadInfo.failed > 0 && (
                <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>실패 {uploadInfo.failed}장 (재시도 후)</div>
              )}
            </div>
          </div>
        )}

        {/* 충돌 차종/컬러 모달 */}
        <CarInfoModal
          open={showCarModal}
          title={`동일 4자리 차량 ${collision?.count || 0}대`}
          description={`현재 <b>${last4}</b> 활성 차량이 이미 있습니다. 출차 시 구분되도록 <b>차종·컬러</b>를 입력하세요.`}
          carType={carType}
          carColor={carColor}
          onChangeType={setCarType}
          onChangeColor={setCarColor}
          onConfirm={() => { setShowCarModal(false); setPendingCarInfo(true); setPhotoStep(true); }}
          onCancel={() => setShowCarModal(false)}
          confirmLabel="이대로 입차"
          confirmColor="#16A34A"
          submitting={submitting}
          topContent={
            <>
              {(collision?.matches || []).map((m: any) => (
                <div className="cv2-coll-card" key={m.id}>
                  <div className="cv2-coll-pn">{m.plate_last4 || m.plate_number}</div>
                  <div className="cv2-coll-meta">
                    {[m.car_type || "차종?", m.car_color || "컬러?", m.parking_location || "위치?"].join(" · ")}<br />
                    {m.entry_at ? new Date(m.entry_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""} 입차 · <span className="cv2-coll-tag">{m.parking_type === "self" ? "자주식" : "발렛"}</span>
                  </div>
                </div>
              ))}
              <div className="cv2-coll-divider">신규 입차 차량 정보</div>
            </>
          }
        />

        {/* 성공 토스트 */}
        {successInfo && (
          <div className="cv2-toast-overlay">
            <div className="cv2-toast">
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", marginBottom: 6 }}>입차 완료</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1428A0", letterSpacing: 2, fontFamily: "'Outfit', sans-serif" }}>{successInfo.plate_number}</div>
              {(successInfo.car_type || successInfo.car_color) && (
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 8 }}>
                  {[successInfo.car_type, successInfo.car_color].filter(Boolean).join(" · ")}
                </div>
              )}
              {successInfo.alimtalk_requested && (
                <div style={{ fontSize: 12, color: "#92400E", marginTop: 6 }}>알림톡 발송 요청됨</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
