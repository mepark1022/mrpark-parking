// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";
import { fmtPlate, splitPlate } from "@/lib/utils/format";

const CSS = `
  .detail-page { min-height: 100dvh; background: #F8FAFC; }

  /* ── 상태 헤더 ── */
  .detail-status-header {
    padding: 20px 20px 16px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .detail-plate {
    font-size: 32px; font-weight: 800;
    letter-spacing: 4px; color: #1A1D2B;
  }
  .detail-status-badge {
    padding: 6px 16px; border-radius: 20px;
    font-size: 14px; font-weight: 700;
  }
  .detail-elapsed {
    font-size: 28px; font-weight: 800; color: #1A1D2B;
  }
  .detail-elapsed-label { font-size: 13px; color: #94A3B8; }

  /* ── 카드 섹션 ── */
  .detail-card {
    margin: 0 16px 14px;
    background: #fff; border-radius: 16px;
    border: 1px solid #E2E8F0; overflow: hidden;
  }
  .detail-card-title {
    padding: 12px 16px 8px;
    font-size: 12px; font-weight: 700; color: #1428A0;
    letter-spacing: 0.5px; text-transform: uppercase;
    border-bottom: 1px solid #F1F5F9;
  }
  .detail-card-body { padding: 14px 16px; }
  .info-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px;
  }
  .info-row:last-child { border-bottom: none; }
  .info-key { color: #64748B; }
  .info-val { font-weight: 600; color: #1A1D2B; }

  /* ── 요금 카드 ── */
  .fee-card {
    margin: 0 16px 14px;
    border-radius: 16px; overflow: hidden;
  }
  .fee-header {
    padding: 16px;
    background: #1428A0; color: #fff;
    display: flex; justify-content: space-between; align-items: center;
  }
  .fee-header-label { font-size: 14px; font-weight: 600; opacity: 0.8; }
  .fee-amount { font-size: 36px; font-weight: 800; }
  .fee-body {
    background: #EEF2FF;
    padding: 12px 16px;
  }
  .fee-row {
    display: flex; justify-content: space-between;
    font-size: 13px; color: #4338CA; padding: 3px 0;
  }
  .fee-paid-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px;
    font-size: 13px; font-weight: 700;
    background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0;
    margin-top: 8px;
  }
  .fee-overdue {
    margin: 0 16px 14px;
    padding: 14px;
    background: #FEF2F2; border: 1.5px solid #FECACA;
    border-radius: 14px;
  }
  .fee-overdue-title { font-size: 14px; font-weight: 700; color: #DC2626; margin-bottom: 6px; }
  .fee-overdue-desc  { font-size: 13px; color: #7F1D1D; }

  /* ── 출차 버튼 ── */
  .detail-footer {
    position: sticky; bottom: 0;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
    background: #fff; border-top: 1px solid #E2E8F0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .btn-checkout {
    height: 56px; width: 100%;
    background: #16A34A; color: #fff;
    border: none; border-radius: 14px;
    font-size: 17px; font-weight: 800; cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-checkout:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-checkout.danger { background: #DC2626; }
  .btn-checkout.gold   { background: #F5B731; color: #1A1D2B; }
  .btn-secondary-sm {
    height: 44px; width: 100%;
    background: #F1F5F9; color: #475569;
    border: none; border-radius: 12px;
    font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── 모달 ── */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: flex-end;
    z-index: 100;
  }
  .modal-sheet {
    background: #fff; width: 100%;
    border-radius: 24px 24px 0 0;
    padding: 24px 20px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
  }
  .modal-handle {
    width: 40px; height: 4px;
    background: #E2E8F0; border-radius: 2px;
    margin: 0 auto 20px;
  }
  .modal-title { font-size: 18px; font-weight: 800; color: #1A1D2B; margin-bottom: 6px; }
  .modal-desc  { font-size: 14px; color: #64748B; margin-bottom: 20px; }
  .modal-fee-big {
    text-align: center;
    font-size: 40px; font-weight: 800; color: #1428A0;
    padding: 20px; background: #EEF2FF; border-radius: 14px;
    margin-bottom: 20px;
  }
  .modal-fee-big small { font-size: 16px; font-weight: 500; color: #6366F1; }
  .modal-btn {
    height: 52px; width: 100%;
    border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 10px;
  }
  .modal-btn.confirm { background: #16A34A; color: #fff; }
  .modal-btn.monthly { background: #1428A0; color: #fff; }
  .modal-btn.cancel  { background: #F1F5F9; color: #475569; }

  /* ── 번호판 수정 ── */
  .plate-edit-wrap {
    display: flex; align-items: center; gap: 8px;
  }
  .btn-plate-edit {
    width: 32px; height: 32px; border-radius: 50%;
    background: #F1F5F9; border: 1.5px solid #E2E8F0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; flex-shrink: 0;
  }
  .btn-plate-edit:active { background: #E2E8F0; transform: scale(0.92); }
  .plate-edit-input {
    width: 100%; height: 56px; border: 2px solid #1428A0;
    border-radius: 14px; background: #EEF2FF;
    font-size: 24px; font-weight: 800; letter-spacing: 3px;
    text-align: center; color: #1A1D2B; outline: none;
    text-transform: uppercase;
  }
  .plate-edit-input:focus { border-color: #F5B731; box-shadow: 0 0 0 3px rgba(245,183,49,0.2); }
  .plate-edit-hint {
    font-size: 12px; color: #94A3B8; text-align: center;
    margin-top: 6px; margin-bottom: 16px;
  }
  .plate-edit-old {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px; background: #FEF2F2; border-radius: 10px;
    font-size: 13px; color: #DC2626; font-weight: 600; margin-bottom: 16px;
  }
  .plate-edit-arrow {
    display: flex; align-items: center; justify-content: center;
    padding: 12px; margin-bottom: 16px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 22px; height: 22px;
    border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #fff;
    border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
  }
`;

function calcFee(entryAt, feeStructure, parkingType) {
  if (!feeStructure) return 0;
  const mins = Math.floor((Date.now() - new Date(entryAt).getTime()) / 60000);
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
  if (parkingType === "valet") amount += valet_fee;
  return amount;
}

function elapsedMin(entryAt) {
  return Math.floor((Date.now() - new Date(entryAt).getTime()) / 60000);
}
function elapsedStr(mins) {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

const STATUS_CONFIG = {
  parking:        { label: "주차 중",  bg: "#EEF2FF", color: "#1428A0" },
  pre_paid:       { label: "사전정산", bg: "#F0FDF4", color: "#16A34A" },
  exit_requested: { label: "출차요청", bg: "#FFF7ED", color: "#EA580C" },
  car_ready:      { label: "차량준비", bg: "#DCFCE7", color: "#16A34A" },
};

export default function CrewTicketDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const supabase = createClient();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPlateEditModal, setShowPlateEditModal] = useState(false);
  const [editPlate, setEditPlate] = useState("");
  const [plateEditLoading, setPlateEditLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [userId, setUserId] = useState(null);
  const [orgId, setOrgId] = useState(null);

  // 차량준비 알림톡 모달
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [readyPhone, setReadyPhone] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
        if (profile) setOrgId(profile.org_id);
      }
    };
    init();
    fetchTicket();
  }, [id]);

  // 경과 시간 1분마다 갱신
  useEffect(() => {
    if (!ticket) return;
    setElapsed(elapsedMin(ticket.entry_at));
    const interval = setInterval(() => setElapsed(elapsedMin(ticket.entry_at)), 60000);
    return () => clearInterval(interval);
  }, [ticket]);

  const fetchTicket = async () => {
    const { data } = await supabase
      .from("mepark_tickets")
      .select(`
        id, plate_number, plate_last4, parking_type, status,
        entry_at, pre_paid_at, exit_at, parking_location, is_monthly,
        paid_amount, calculated_fee, additional_fee, payment_method,
        monthly_parking_id,
        visit_places(id, name, floor, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee),
        parking_lots(id, name)
      `)
      .eq("id", id)
      .single();
    setTicket(data);
    setLoading(false);
  };

  /* ── 발렛: 차량준비 완료 ── */
  const handleCarReady = () => {
    // 입차 시 저장된 전화번호 자동 로드
    const savedPhone = (() => { try { return localStorage.getItem(`mepark_phone_${id}`) ?? ""; } catch { return ""; } })();
    setReadyPhone(savedPhone);
    setShowReadyModal(true);
  };

  const handleCarReadyConfirm = async () => {
    setActionLoading(true);
    setShowReadyModal(false);
    await supabase.from("mepark_tickets")
      .update({ status: "car_ready", updated_at: new Date().toISOString() })
      .eq("id", id);

    // 전화번호 입력한 경우 → 알림톡 발송 (발송 즉시 소멸)
    if (readyPhone && readyPhone.replace(/-/g, "").length >= 10) {
      fetch("/api/alimtalk/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: readyPhone,
          ticketId: id,
          plateNumber: ticket?.plate_number ?? "",
          orgId,
          parkingLocation: ticket?.parking_location ?? "",
        }),
      }).catch(() => {});
      // 발송 완료 → localStorage에서 전화번호 삭제
      try { localStorage.removeItem(`mepark_phone_${id}`); } catch {}
    }

    await fetchTicket();
    setActionLoading(false);
  };

  /* ── 출차 완료 ── */
  const handleCheckout = async () => {
    setActionLoading(true);
    const fee = ticket.is_monthly ? 0 : calcFee(ticket.entry_at, ticket.visit_places, ticket.parking_type);
    const isOverdue = !ticket.is_monthly && ticket.status === "pre_paid" &&
      new Date(ticket.pre_paid_at) < new Date(Date.now() - 30 * 60 * 1000);

    const updates = {
      status: "completed",
      exit_at: new Date().toISOString(),
      exit_crew_id: userId,
      calculated_fee: fee,
      additional_fee: isOverdue ? Math.max(0, fee - (ticket.paid_amount || 0)) : 0,
    };

    await supabase.from("mepark_tickets").update(updates).eq("id", id);
    // 출차 완료 → 저장된 전화번호 삭제
    try { localStorage.removeItem(`mepark_phone_${id}`); } catch {}
    setShowCheckoutModal(false);
    router.replace("/crew/parking-list");
  };

  /* ── 차량번호 수정 ── */
  const openPlateEdit = () => {
    setEditPlate(ticket.plate_number);
    setShowPlateEditModal(true);
  };

  const handlePlateEdit = async () => {
    const cleaned = editPlate.trim().toUpperCase().replace(/\s/g, "");
    if (!cleaned || cleaned.length < 4) return;
    if (cleaned === ticket.plate_number) {
      setShowPlateEditModal(false);
      return;
    }
    setPlateEditLoading(true);
    const last4 = cleaned.replace(/[^0-9]/g, "").slice(-4);
    const { error } = await supabase.from("mepark_tickets").update({
      plate_number: cleaned,
      plate_last4: last4,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      await fetchTicket();
      setShowPlateEditModal(false);
    }
    setPlateEditLoading(false);
  };

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="detail-page">
          <CrewHeader title="차량 상세" showBack />
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>로딩 중...</div>
        </div>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <style>{CSS}</style>
        <div className="detail-page">
          <CrewHeader title="차량 상세" showBack />
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
            티켓을 찾을 수 없습니다
          </div>
        </div>
      </>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.parking;
  const fee = ticket.is_monthly ? 0 : calcFee(ticket.entry_at, ticket.visit_places, ticket.parking_type);
  const isOverdue = !ticket.is_monthly && ticket.status === "pre_paid" &&
    new Date(ticket.pre_paid_at) < new Date(Date.now() - 30 * 60 * 1000);
  const overdueMin = isOverdue
    ? Math.floor((Date.now() - new Date(ticket.pre_paid_at).getTime()) / 60000) - 30
    : 0;

  const vp = ticket.visit_places;

  return (
    <>
      <style>{CSS}</style>
      <div className="detail-page">
        <CrewHeader title="차량 상세" showBack />

        {/* 번호판 & 상태 */}
        <div className="detail-status-header">
          <div className="plate-edit-wrap">
            <div className="detail-plate">{(()=>{const [p,n]=splitPlate(ticket.plate_number);return p?<>{p}<span style={{marginLeft:6}}>{n}</span></>:ticket.plate_number;})()}</div>
            {ticket.status !== "completed" && (
              <button className="btn-plate-edit" onClick={openPlateEdit} title="차량번호 수정">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
          </div>
          <div className="detail-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
            {statusCfg.label}
          </div>
          <div className="detail-elapsed">{elapsedStr(elapsed)}</div>
          <div className="detail-elapsed-label">경과 시간</div>
        </div>

        {/* 차량 정보 */}
        <div className="detail-card">
          <div className="detail-card-title">🚗 차량 정보</div>
          <div className="detail-card-body">
            <div className="info-row">
              <span className="info-key">주차 유형</span>
              <span className="info-val">{ticket.parking_type === "valet" ? "🔑 발렛" : "🏢 자주식"}</span>
            </div>
            {ticket.is_monthly && (
              <div className="info-row">
                <span className="info-key">월주차</span>
                <span className="info-val" style={{ color: "#16A34A" }}>✅ 월주차 차량</span>
              </div>
            )}
            {vp && (
              <div className="info-row">
                <span className="info-key">방문지</span>
                <span className="info-val">{vp.floor ? `[${vp.floor}] ` : ""}{vp.name}</span>
              </div>
            )}
            {ticket.parking_lots && (
              <div className="info-row">
                <span className="info-key">주차장</span>
                <span className="info-val">{ticket.parking_lots.name}</span>
              </div>
            )}
            {ticket.parking_location && (
              <div className="info-row">
                <span className="info-key">차량 위치</span>
                <span className="info-val">{ticket.parking_location}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-key">입차 시각</span>
              <span className="info-val">
                {new Date(ticket.entry_at).toLocaleString("ko-KR", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 30분 초과 경고 */}
        {isOverdue && (
          <div className="fee-overdue">
            <div className="fee-overdue-title">⚠️ 사전정산 30분 초과</div>
            <div className="fee-overdue-desc">
              {overdueMin}분 초과 · 추가요금이 발생할 수 있습니다.
              출차 완료 시 추가 결제가 필요합니다.
            </div>
          </div>
        )}

        {/* 요금 */}
        {!ticket.is_monthly && (
          <div className="fee-card">
            <div className="fee-header">
              <div className="fee-header-label">
                {ticket.status === "pre_paid" ? "결제 완료" : "예상 요금"}
              </div>
              <div>
                <div className="fee-amount">
                  {ticket.paid_amount ? ticket.paid_amount.toLocaleString() : fee.toLocaleString()}원
                </div>
              </div>
            </div>
            {vp && (
              <div className="fee-body">
                <div className="fee-row">
                  <span>무료 주차</span><span>{vp.free_minutes}분</span>
                </div>
                <div className="fee-row">
                  <span>기본 요금</span><span>{vp.base_fee.toLocaleString()}원 / {vp.base_minutes}분</span>
                </div>
                <div className="fee-row">
                  <span>추가 요금</span><span>{vp.extra_fee.toLocaleString()}원 / 10분</span>
                </div>
                {ticket.parking_type === "valet" && vp.valet_fee > 0 && (
                  <div className="fee-row">
                    <span>발렛 수수료</span><span>{vp.valet_fee.toLocaleString()}원</span>
                  </div>
                )}
                {ticket.status === "pre_paid" && (
                  <div className="fee-paid-badge">✅ 결제 완료 · {ticket.payment_method || "카드"}</div>
                )}
              </div>
            )}
          </div>
        )}
        {ticket.is_monthly && (
          <div className="fee-card">
            <div className="fee-header">
              <div className="fee-header-label">월주차 차량</div>
              <div className="fee-amount">무료</div>
            </div>
          </div>
        )}

        {/* 하단 액션 버튼 */}
        {ticket.status !== "completed" && (
          <div className="detail-footer">
            {/* 발렛: 차량준비 완료 버튼 */}
            {ticket.parking_type === "valet" && ticket.status === "exit_requested" && (
              <button className="btn-checkout gold" onClick={handleCarReady} disabled={actionLoading}>
                {actionLoading ? <span className="spinner" /> : "🔑 차량 준비 완료"}
              </button>
            )}

            {/* 출차 완료 */}
            {(ticket.status === "parking" || ticket.status === "pre_paid" ||
              ticket.status === "car_ready" || ticket.is_monthly) && (
              <button
                className={`btn-checkout${isOverdue ? " danger" : ""}`}
                onClick={() => setShowCheckoutModal(true)}
                disabled={actionLoading}
              >
                {isOverdue ? "⚠️ 출차 완료 (추가요금 발생)" : "✅ 출차 완료"}
              </button>
            )}

            <div className="btn-row">
              <button className="btn-secondary-sm"
                onClick={() => router.push(`/crew/entry/qr?ticketId=${ticket.id}&plate=${encodeURIComponent(ticket.plate_number)}&type=${ticket.parking_type}`)}>
                🔗 QR 보기
              </button>
              <button className="btn-secondary-sm" onClick={() => router.back()}>
                ← 목록으로
              </button>
            </div>
          </div>
        )}

        {/* 차량준비 완료 모달 (알림톡 전화번호 입력) */}
        {showReadyModal && (
          <div className="modal-overlay" onClick={() => setShowReadyModal(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ padding: "20px 20px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🚗</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", marginBottom: 6 }}>차량준비 완료</div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
                  고객에게 알림톡을 보내려면<br/>전화번호를 입력하세요.<br/>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>번호는 발송 즉시 삭제됩니다.</span>
                </div>
                {readyPhone ? (
                  <div style={{ background: "#F0FDF4", border: "2px solid #16A34A", borderRadius: 12, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#15803D", fontWeight: 700, textAlign: "center" }}>
                    📱 입차 시 등록된 번호 자동 입력됨
                  </div>
                ) : null}
                <input
                  type="tel"
                  placeholder="010-0000-0000 (선택)"
                  value={readyPhone}
                  onChange={(e) => setReadyPhone(e.target.value)}
                  style={{
                    width: "100%", height: 48, border: "2px solid #E2E8F0",
                    borderRadius: 12, fontSize: 16, textAlign: "center",
                    outline: "none", marginBottom: 16, boxSizing: "border-box",
                    fontWeight: 600, letterSpacing: 1,
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#1428A0"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setShowReadyModal(false)}
                    style={{ flex: 1, height: 48, borderRadius: 12, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 15, fontWeight: 700, color: "#64748B", cursor: "pointer" }}
                  >취소</button>
                  <button
                    onClick={handleCarReadyConfirm}
                    style={{ flex: 2, height: 48, borderRadius: 12, border: "none", background: "#16A34A", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                  >{readyPhone ? "완료 + 알림톡 발송" : "알림톡 없이 완료"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 출차 확인 모달 */}
        {showCheckoutModal && (
          <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">출차 완료 확인</div>
              <div className="modal-desc">
                {fmtPlate(ticket.plate_number)} 차량을 출차 처리합니다.
                {isOverdue && " ⚠️ 30분 초과 추가요금이 발생합니다."}
              </div>

              <div className="modal-fee-big">
                {ticket.is_monthly ? (
                  "월주차 · 무료"
                ) : ticket.status === "pre_paid" && !isOverdue ? (
                  <>
                    결제 완료<br />
                    <small>{(ticket.paid_amount || 0).toLocaleString()}원</small>
                  </>
                ) : (
                  <>
                    {fee.toLocaleString()}원<br />
                    <small>{ticket.status === "pre_paid" ? "+추가요금" : "현장 결제"}</small>
                  </>
                )}
              </div>

              <button
                className={`modal-btn ${ticket.is_monthly ? "monthly" : "confirm"}`}
                onClick={handleCheckout}
                disabled={actionLoading}
              >
                {actionLoading ? <span className="spinner" style={{ borderTopColor: "#fff", width: 20, height: 20 }} /> : "출차 완료"}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowCheckoutModal(false)}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* 차량번호 수정 모달 */}
        {showPlateEditModal && (
          <div className="modal-overlay" onClick={() => setShowPlateEditModal(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">차량번호 수정</div>
              <div className="modal-desc">OCR 오인식이나 수기 입력 오류 시 차량번호를 수정합니다.</div>

              {/* 기존 번호 표시 */}
              <div className="plate-edit-old">
                <span>기존:</span>
                <span style={{ letterSpacing: 2, fontWeight: 800 }}>{fmtPlate(ticket.plate_number)}</span>
              </div>

              {/* 화살표 */}
              <div className="plate-edit-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
              </div>

              {/* 새 번호 입력 */}
              <input
                className="plate-edit-input"
                value={editPlate}
                onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                placeholder="12가3456"
                maxLength={12}
                autoFocus
              />
              <div className="plate-edit-hint">차량번호를 정확히 입력해주세요</div>

              <button
                className="modal-btn confirm"
                onClick={handlePlateEdit}
                disabled={plateEditLoading || !editPlate.trim() || editPlate.trim().length < 4 || editPlate.trim().toUpperCase() === ticket.plate_number}
                style={{
                  opacity: (!editPlate.trim() || editPlate.trim().length < 4 || editPlate.trim().toUpperCase() === ticket.plate_number) ? 0.4 : 1,
                }}
              >
                {plateEditLoading ? <span className="spinner" style={{ borderTopColor: "#fff", width: 20, height: 20 }} /> : "✏️ 수정 완료"}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowPlateEditModal(false)}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
