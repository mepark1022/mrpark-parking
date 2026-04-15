// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { fmtPlate } from "@/lib/utils/format";

/**
 * CREW v2 주차 상세 페이지
 * - GET /api/v1/tickets/:id — 티켓 상세
 * - PATCH /api/v1/tickets/:id/complete — 출차 처리 (OPERATE)
 * - 차량준비/번호판수정/타입변경은 19B-4에서 추가 (v1 API 신설 필요)
 */

const CSS = `
  .cv2-detail-page { min-height: 100dvh; background: #F8FAFC; padding-bottom: 100px; }

  .cv2-detail-header {
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
    cursor: pointer; flex-shrink: 0;
  }
  .cv2-back-btn:active { background: rgba(255,255,255,0.25); }

  .cv2-status-header {
    padding: 24px 20px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
  }
  .cv2-detail-plate {
    font-size: 32px; font-weight: 800;
    letter-spacing: 2px; color: #1A1D2B;
    font-family: 'Outfit', sans-serif;
  }
  .cv2-status-badge {
    padding: 6px 16px; border-radius: 20px;
    font-size: 14px; font-weight: 700;
  }
  .cv2-elapsed {
    font-size: 28px; font-weight: 800; color: #1A1D2B;
    font-family: 'Outfit', sans-serif;
  }
  .cv2-elapsed-label { font-size: 13px; color: #94A3B8; }

  .cv2-card {
    margin: 14px 16px 0;
    background: #fff; border-radius: 16px;
    border: 1px solid #E2E8F0; overflow: hidden;
  }
  .cv2-card-title {
    padding: 12px 16px 8px;
    font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase;
    border-bottom: 1px solid #F1F5F9;
  }
  .cv2-card-body { padding: 14px 16px; }
  .cv2-info-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px;
  }
  .cv2-info-row:last-child { border-bottom: none; }
  .cv2-info-key { color: #64748B; }
  .cv2-info-val { font-weight: 600; color: #1A1D2B; text-align: right; }

  .cv2-fee-card {
    margin: 14px 16px 0;
    border-radius: 16px; overflow: hidden;
  }
  .cv2-fee-header {
    padding: 16px;
    background: #1428A0; color: #fff;
    display: flex; justify-content: space-between; align-items: center;
  }
  .cv2-fee-label { font-size: 14px; font-weight: 600; opacity: 0.8; }
  .cv2-fee-amount {
    font-size: 36px; font-weight: 800;
    font-family: 'Outfit', sans-serif;
  }
  .cv2-fee-body {
    background: #EEF2FF; padding: 12px 16px;
  }
  .cv2-fee-row {
    display: flex; justify-content: space-between;
    font-size: 13px; color: #4338CA; padding: 3px 0;
  }
  .cv2-fee-paid {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px;
    font-size: 13px; font-weight: 700;
    background: #F0FDF4; color: #16A34A;
    border: 1px solid #BBF7D0; margin-top: 8px;
  }

  .cv2-detail-footer {
    position: fixed; bottom: 80px; left: 0; right: 0;
    padding: 16px;
    background: #fff; border-top: 1px solid #E2E8F0;
    display: flex; gap: 10px; z-index: 50;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }
  .cv2-btn {
    flex: 1; height: 54px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 800; cursor: pointer;
    transition: opacity 0.15s;
  }
  .cv2-btn:active { opacity: 0.85; }
  .cv2-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cv2-btn-primary { background: #16A34A; color: #fff; }
  .cv2-btn-secondary { background: #F1F5F9; color: #475569; }
  .cv2-btn-warning { background: #F5B731; color: #1A1D2B; }

  .cv2-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: flex-end;
    z-index: 300;
  }
  .cv2-modal {
    background: #fff; width: 100%;
    border-radius: 24px 24px 0 0;
    padding: 24px 20px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
  }
  .cv2-modal-handle {
    width: 40px; height: 4px;
    background: #E2E8F0; border-radius: 2px;
    margin: 0 auto 20px;
  }
  .cv2-modal-title { font-size: 18px; font-weight: 800; color: #1A1D2B; margin-bottom: 6px; }
  .cv2-modal-desc { font-size: 14px; color: #64748B; margin-bottom: 20px; }
  .cv2-fee-big {
    text-align: center;
    font-size: 40px; font-weight: 800; color: #1428A0;
    padding: 20px; background: #EEF2FF; border-radius: 14px;
    margin-bottom: 12px;
    font-family: 'Outfit', sans-serif;
  }
  .cv2-fee-subtext {
    text-align: center; font-size: 13px; color: #64748B;
    margin-bottom: 20px;
  }
  .cv2-pay-method {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 8px; margin-bottom: 20px;
  }
  .cv2-pay-btn {
    padding: 12px 8px; border-radius: 10px;
    border: 1.5px solid #E2E8F0; background: #fff;
    font-size: 13px; font-weight: 600; color: #475569;
    cursor: pointer; transition: all 0.15s;
  }
  .cv2-pay-btn.active {
    border-color: #1428A0; background: #EEF2FF; color: #1428A0;
  }
  .cv2-modal-btn {
    width: 100%; height: 52px; border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    margin-bottom: 8px;
  }
  .cv2-modal-btn.confirm { background: #16A34A; color: #fff; }
  .cv2-modal-btn.cancel { background: #F1F5F9; color: #475569; }
`;

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  parking:        { label: "주차 중",   bg: "#EEF2FF", color: "#1428A0" },
  pre_paid:       { label: "사전정산",  bg: "#F0FDF4", color: "#16A34A" },
  exit_requested: { label: "출차요청",  bg: "#FFF7ED", color: "#EA580C" },
  car_ready:      { label: "차량준비",  bg: "#DCFCE7", color: "#16A34A" },
  completed:      { label: "출차완료",  bg: "#F1F5F9", color: "#94A3B8" },
};

const PAY_METHODS = [
  { key: "card", label: "💳 카드" },
  { key: "cash", label: "💵 현금" },
  { key: "free", label: "🎟 무료" },
];

function elapsedMin(entryAt: string): number {
  return Math.floor((Date.now() - new Date(entryAt).getTime()) / 60000);
}
function elapsedStr(mins: number): string {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function calcFee(entryAt: string, feeStructure: any, parkingType: string): number {
  if (!feeStructure) return 0;
  const mins = elapsedMin(entryAt);
  const { free_minutes = 30, base_fee = 0, base_minutes = 30, extra_fee = 0, daily_max = 0, valet_fee = 0 } = feeStructure;
  let amount = 0;
  if (mins > free_minutes) {
    const chargeable = mins - free_minutes;
    if (chargeable <= base_minutes) {
      amount = base_fee;
    } else {
      const extraUnits = Math.ceil((chargeable - base_minutes) / 10);
      amount = base_fee + extraUnits * extra_fee;
    }
    if (daily_max) amount = Math.min(amount, daily_max);
  }
  if (parkingType === "valet") amount += (valet_fee || 0);
  return amount;
}

export default function CrewV2ParkingDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // 출차 모달
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [payMethod, setPayMethod] = useState("card");

  // 초기 로드
  useEffect(() => {
    fetchTicket();
    // 1분마다 경과시간 재렌더
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tickets/${id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/v2/crew/login?error=session_expired");
          return;
        }
        if (res.status === 404) {
          setError("티켓을 찾을 수 없습니다");
          setLoading(false);
          return;
        }
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message || "티켓 조회에 실패했습니다");
        setLoading(false);
        return;
      }
      const { data } = await res.json();
      setTicket(data);
    } catch (err) {
      console.error("fetchTicket error:", err);
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // 현재 요금
  const currentFee = ticket && !ticket.is_monthly
    ? calcFee(ticket.entry_at, ticket.visit_places || ticket.stores, ticket.parking_type)
    : 0;
  const mins = ticket ? elapsedMin(ticket.entry_at) : 0;
  const paidAmount = ticket?.paid_amount || 0;
  const additionalFee = ticket?.status === "pre_paid"
    ? Math.max(0, currentFee - paidAmount)
    : 0;
  const isOverdue = ticket?.status === "pre_paid" && ticket?.pre_paid_at &&
    new Date(ticket.pre_paid_at) < new Date(Date.now() - 30 * 60 * 1000);

  // 출차 처리 실행
  const handleCheckout = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/tickets/${id}/complete`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calculated_fee: currentFee,
          payment_method: ticket.is_monthly ? "monthly" : payMethod,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.error?.message || "출차 처리에 실패했습니다");
        setActionLoading(false);
        return;
      }

      setShowCheckoutModal(false);
      router.replace("/v2/crew/parking");
    } catch (err) {
      console.error("checkout error:", err);
      alert("네트워크 오류가 발생했습니다");
      setActionLoading(false);
    }
  };

  // ── 로딩/에러 ──
  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2-detail-page">
          <div className="cv2-detail-header">
            <div className="cv2-back-btn" onClick={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>차량 상세</div>
          </div>
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>로딩 중...</div>
        </div>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2-detail-page">
          <div className="cv2-detail-header">
            <div className="cv2-back-btn" onClick={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>차량 상세</div>
          </div>
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
            {error || "티켓을 찾을 수 없습니다"}
          </div>
        </div>
      </>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.parking;
  const isCompleted = ticket.status === "completed";

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2-detail-page">
        {/* 헤더 */}
        <div className="cv2-detail-header">
          <div className="cv2-back-btn" onClick={() => router.back()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>차량 상세</div>
        </div>

        {/* 상태 헤더 */}
        <div className="cv2-status-header">
          <div className="cv2-detail-plate">{fmtPlate(ticket.plate_number)}</div>
          <div className="cv2-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
            {statusCfg.label}
          </div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="cv2-elapsed">{elapsedStr(mins)}</span>
            <span className="cv2-elapsed-label">
              {isCompleted ? "주차 시간" : "경과 시간"}
            </span>
          </div>
        </div>

        {/* 출차요청 알림 */}
        {ticket.status === "exit_requested" && (
          <div style={{
            margin: "14px 16px 0",
            padding: "14px 16px",
            background: "#FFF7ED",
            border: "2px solid #EA580C",
            borderRadius: 14,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#EA580C" }}>
                고객이 출차 요청을 했습니다
              </div>
              <div style={{ fontSize: 12, color: "#9A3412", marginTop: 2 }}>
                차량 준비 후 출차 처리하세요
              </div>
            </div>
          </div>
        )}

        {/* 요금 카드 */}
        <div className="cv2-fee-card">
          <div className="cv2-fee-header">
            <div>
              <div className="cv2-fee-label">
                {ticket.is_monthly ? "월주차 차량" : isCompleted ? "최종 결제금액" : "예상 요금"}
              </div>
              <div className="cv2-fee-amount">
                ₩{(isCompleted ? (ticket.paid_amount || ticket.calculated_fee || 0) : currentFee).toLocaleString()}
              </div>
            </div>
            {ticket.is_monthly && (
              <div style={{ fontSize: 40 }}>📅</div>
            )}
          </div>
          {!ticket.is_monthly && !isCompleted && (
            <div className="cv2-fee-body">
              <div className="cv2-fee-row">
                <span>입차 시각</span>
                <span>{new Date(ticket.entry_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="cv2-fee-row">
                <span>경과 시간</span>
                <span>{mins}분</span>
              </div>
              {paidAmount > 0 && (
                <div className="cv2-fee-row">
                  <span>사전정산</span>
                  <span style={{ color: "#16A34A", fontWeight: 700 }}>₩{paidAmount.toLocaleString()} 완료</span>
                </div>
              )}
              {additionalFee > 0 && (
                <div className="cv2-fee-row" style={{ color: "#DC2626", fontWeight: 700 }}>
                  <span>추가 요금</span>
                  <span>+₩{additionalFee.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          {isOverdue && (
            <div style={{ padding: 12, background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              ⚠️ 사전정산 후 30분 초과 — 추가요금 발생
            </div>
          )}
        </div>

        {/* 차량 정보 */}
        <div className="cv2-card">
          <div className="cv2-card-title">🚗 차량 정보</div>
          <div className="cv2-card-body">
            <div className="cv2-info-row">
              <span className="cv2-info-key">차량 번호</span>
              <span className="cv2-info-val">{fmtPlate(ticket.plate_number)}</span>
            </div>
            <div className="cv2-info-row">
              <span className="cv2-info-key">주차 유형</span>
              <span className="cv2-info-val">
                {ticket.is_monthly ? "📅 월주차" :
                 ticket.parking_type === "valet" ? "🔑 발렛" : "🏢 자주식"}
                {ticket.is_free && <span style={{ marginLeft: 6, color: "#92400E" }}> · 🎟 무료</span>}
              </span>
            </div>
            {ticket.parking_location && (
              <div className="cv2-info-row">
                <span className="cv2-info-key">주차 위치</span>
                <span className="cv2-info-val">📍 {ticket.parking_location}</span>
              </div>
            )}
            {ticket.visit_places?.name && (
              <div className="cv2-info-row">
                <span className="cv2-info-key">방문지</span>
                <span className="cv2-info-val">
                  {ticket.visit_places.floor && `${ticket.visit_places.floor}F · `}
                  {ticket.visit_places.name}
                </span>
              </div>
            )}
            <div className="cv2-info-row">
              <span className="cv2-info-key">입차 시각</span>
              <span className="cv2-info-val">
                {new Date(ticket.entry_at).toLocaleString("ko-KR")}
              </span>
            </div>
            {ticket.pre_paid_at && (
              <div className="cv2-info-row">
                <span className="cv2-info-key">사전정산</span>
                <span className="cv2-info-val">
                  {new Date(ticket.pre_paid_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
            {ticket.exit_requested_at && (
              <div className="cv2-info-row">
                <span className="cv2-info-key">출차요청</span>
                <span className="cv2-info-val" style={{ color: "#EA580C" }}>
                  {new Date(ticket.exit_requested_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
            {ticket.completed_at && (
              <div className="cv2-info-row">
                <span className="cv2-info-key">출차 시각</span>
                <span className="cv2-info-val" style={{ color: "#16A34A", fontWeight: 700 }}>
                  {new Date(ticket.completed_at).toLocaleString("ko-KR")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 안내: 19B-4에서 추가될 액션 */}
        {!isCompleted && ticket.parking_type === "valet" && ticket.status !== "car_ready" && (
          <div style={{
            margin: "14px 16px 0",
            padding: "12px 14px",
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: 10,
            fontSize: 12, color: "#92400E", textAlign: "center",
          }}>
            ⚠️ 차량준비 · 번호판 수정 · 타입 변경은 Part 19B-4에서 추가됩니다
          </div>
        )}

        {/* 하단 고정 액션 */}
        {!isCompleted && (
          <div className="cv2-detail-footer">
            <button
              className="cv2-btn cv2-btn-primary"
              onClick={() => setShowCheckoutModal(true)}
              disabled={actionLoading}
            >
              {ticket.is_monthly ? "출차 완료" : `출차 처리 · ₩${currentFee.toLocaleString()}`}
            </button>
          </div>
        )}

        {/* 출차 확인 모달 */}
        {showCheckoutModal && (
          <div className="cv2-modal-overlay" onClick={() => setShowCheckoutModal(false)}>
            <div className="cv2-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cv2-modal-handle" />
              <div className="cv2-modal-title">🚗 출차 처리</div>
              <div className="cv2-modal-desc">
                {ticket.is_monthly ? "월주차 차량을 출차 처리합니다" : "결제 완료 후 출차 처리합니다"}
              </div>

              {!ticket.is_monthly && (
                <>
                  <div className="cv2-fee-big">
                    ₩{currentFee.toLocaleString()}
                  </div>
                  {paidAmount > 0 && (
                    <div className="cv2-fee-subtext">
                      사전정산 ₩{paidAmount.toLocaleString()} 완료
                      {additionalFee > 0 && ` · 추가 ₩${additionalFee.toLocaleString()}`}
                    </div>
                  )}

                  {/* 결제 수단 (사전정산 아닐 때만) */}
                  {paidAmount === 0 && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
                        결제 수단
                      </div>
                      <div className="cv2-pay-method">
                        {PAY_METHODS.map(m => (
                          <button
                            key={m.key}
                            className={`cv2-pay-btn ${payMethod === m.key ? "active" : ""}`}
                            onClick={() => setPayMethod(m.key)}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <button
                className="cv2-modal-btn confirm"
                onClick={handleCheckout}
                disabled={actionLoading}
              >
                {actionLoading ? "처리 중..." : "출차 처리 완료"}
              </button>
              <button
                className="cv2-modal-btn cancel"
                onClick={() => setShowCheckoutModal(false)}
                disabled={actionLoading}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
