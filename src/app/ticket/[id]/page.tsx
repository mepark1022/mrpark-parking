// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { formatMaskedPlate } from "@/lib/plate";

/* ─── 상태별 테마 ─── */
/* 이모지 전면 금지(카톡 인앱브라우저 깨짐). 상태 구분은 헤더 배경색 + CSS 링·점 아이콘으로 표현 */
const STATUS_THEME = {
  parking:        { bg: "#1428A0", text: "#fff",     label: "주차중",       sub: "차량이 주차되어 있습니다" },
  pre_paid:       { bg: "#16A34A", text: "#fff",     label: "사전정산 완료", sub: "유예시간 내 출차해 주세요" },
  overdue:        { bg: "#DC2626", text: "#fff",     label: "유예시간 초과", sub: "추가요금 결제 후 출차 가능합니다" },
  exit_requested: { bg: "#F5B731", text: "#1A1D2B",  label: "출차 요청중",   sub: "크루가 차량을 준비하고 있습니다" },
  car_ready:      { bg: "#16A34A", text: "#fff",     label: "차량 준비 완료", sub: "출구로 이동해 주세요" },
  completed:      { bg: "#1428A0", text: "#fff",     label: "출차 완료",     sub: "이용해 주셔서 감사합니다" },
};

const fmt = (ts: string) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtMoney = (n: number) => `${(n || 0).toLocaleString()}원`;

/* ─── 요금 계산 (고객 페이지용) ─── */
const calcTicketFee = (entryAt: string, vp: Record<string, unknown> | null, parkingType: string): number => {
  if (!entryAt) return 0;
  const totalMinutes = Math.ceil((Date.now() - new Date(entryAt).getTime()) / 60000);
  const freeMin = (vp?.free_minutes as number) ?? 0;
  const baseMin = (vp?.base_minutes as number) ?? 30;
  const baseFee = (vp?.base_fee as number) ?? 0;
  const extraFee = (vp?.extra_fee as number) ?? 0;
  const dailyMax = (vp?.daily_max as number) ?? 0;
  const valetFee = (vp?.valet_fee as number) ?? 0;

  if (totalMinutes <= freeMin) return parkingType === "valet" ? valetFee : 0;
  const chargeable = totalMinutes - freeMin;
  let fee = 0;
  if (chargeable <= baseMin) {
    fee = baseFee;
  } else {
    const extraUnits = Math.ceil((chargeable - baseMin) / 10);
    fee = baseFee + extraUnits * extraFee;
  }
  fee += parkingType === "valet" ? valetFee : 0;
  return dailyMax > 0 ? Math.min(fee, dailyMax) : fee;
};

const fmtCountdown = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}분 ${String(s).padStart(2, "0")}초`;
};

const fmtOverdue = (deadline: string) => {
  const diff = Date.now() - new Date(deadline).getTime();
  if (diff <= 0) return "0분";
  const m = Math.ceil(diff / 60000);
  return `${m}분`;
};

/* ─── SVG 트윙클 스파클 (me.talk 시그니처와 동일 형태, 이모지 대체) ─── */
function Sparkle({ size = 12, color = "#A7F0F7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}>
      <path d="M12 1C13 8.5 15.5 11 23 12 15.5 13 13 15.5 12 23 11 15.5 8.5 13 1 12 8.5 11 11 8.5 12 1Z" fill={color} />
    </svg>
  );
}

/* ─── me.talk 시그니처 배지 (원본 1안 트윙클 — mrpark-2.0 MeTalkBadge와 동일 효과) ─── */
/* 그라데이션 알약 + 흰 글자 "me.talk" + 시안 트윙클(반짝임 애니메이션).
   알약 자체가 불투명해 어떤 헤더색 위에서도 동일하게 노출(다크변형 불필요) */
function MetalkBadge() {
  const starPx = 14;
  return (
    <span style={{
      position: "relative", display: "inline-flex", alignItems: "center",
      gap: 6, padding: "5px 12px 5px 9px", borderRadius: 10,
      background: "linear-gradient(135deg, #7B7BF0, #4F46E5)",
      boxShadow: "0 1px 6px rgba(79,70,229,0.35)",
    }}>
      <style>{`@keyframes mtkTw{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}`}</style>
      <span style={{ position: "relative", display: "inline-block", width: starPx, height: starPx }}>
        <svg width={starPx} height={starPx} viewBox="0 0 24 24"
          style={{ animation: "mtkTw 1.6s ease-in-out infinite" }} aria-hidden="true">
          <path d="M12 1C13 8.5 15.5 11 23 12 15.5 13 13 15.5 12 23 11 15.5 8.5 13 1 12 8.5 11 11 8.5 12 1Z" fill="#A7F0F7" />
        </svg>
      </span>
      <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>me.talk</span>
    </span>
  );
}

/* ─── CSS 링+점 상태 아이콘 (이모지 대체) ─── */
function RingDot({ color = "#fff", size = 40 }: { color?: string; size?: number }) {
  const ring = Math.max(3, Math.round(size * 0.09));
  const dot = Math.round(size * 0.32);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `${ring}px solid ${color}66`,
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto",
    }}>
      <div style={{ width: dot, height: dot, borderRadius: "50%", background: color }} />
    </div>
  );
}

/* ─── 네이비 P 배지 (로딩용, 이모지 대체) ─── */
function PBadge({ size = 48, bg = "#1428A0" }: { size?: number; bg?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: Math.round(size * 0.52), fontWeight: 900,
      fontFamily: "'Outfit', sans-serif", margin: "0 auto",
    }}>P</div>
  );
}

/* ─── 회색 ! 배지 (오류용, 이모지 대체) ─── */
function ErrorBadge({ size = 48 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#E5E7EB",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#9AA0AD", fontSize: Math.round(size * 0.55), fontWeight: 900,
      fontFamily: "'Outfit', sans-serif", margin: "0 auto",
    }}>!</div>
  );
}

/* ─── 차량번호 표기: formatMaskedPlate "12* 3456" + 뒤 4자리만 크게 강조 ─── */
function PlateDisplay({ raw }: { raw: string }) {
  const formatted = formatMaskedPlate(raw || "");
  const m = formatted.match(/^(.*?)(\d{4})$/); // 앞부분 + 뒤 4자리 분리
  if (!m) {
    return <span style={{ fontSize: 26, fontWeight: 900, color: "#1A1D2B", letterSpacing: 1.5 }}>{formatted || raw}</span>;
  }
  const [, front, last4] = m;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: "#9AA0AD", letterSpacing: 1, fontFamily: "'Outfit', sans-serif" }}>{front.trim()}</span>
      <span style={{ fontSize: 30, fontWeight: 900, color: "#1A1D2B", letterSpacing: 2, fontFamily: "'Outfit', sans-serif" }}>{last4}</span>
    </span>
  );
}

export default function TicketPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [ticketId, setTicketId] = useState<string>("");

  useEffect(() => {
    Promise.resolve(params).then((p) => setTicketId(p.id));
  }, []);
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [store, setStore] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [overdueMinutes, setOverdueMinutes] = useState(0);
  const [additionalFee, setAdditionalFee] = useState(0);
  const [payLoading, setPayLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const [hasKiosk, setHasKiosk] = useState(false);
  const [liveFee, setLiveFee] = useState(0); // 실시간 예상 요금

  /* ─── 티켓 로드 (v1 public API 사용 — RLS 우회) ─── */
  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/public`, {
        cache: "no-store",
      });

      if (!res.ok) {
        // 404 → ticket이 null로 유지되어 "찾을 수 없습니다" 표시
        setLoading(false);
        return;
      }

      const json = await res.json();
      const apiData = json?.data;
      if (!apiData?.ticket) {
        setLoading(false);
        return;
      }

      // API 응답을 기존 페이지가 기대하는 shape으로 재구성
      // (직접 Supabase 쿼리 결과와 호환되도록)
      const t = apiData.ticket;
      const fee = apiData.fee_structure || {};
      const visit = apiData.visit_place || null;
      const reshaped: Record<string, unknown> = {
        ...t,
        stores: apiData.store
          ? { name: apiData.store.name, road_address: apiData.store.address }
          : null,
        parking_lots: apiData.parking_lot
          ? { name: apiData.parking_lot.name }
          : null,
        // visit_places: 방문지 이름 + 요금구조 통합 (페이지가 ticket.visit_places.extra_fee 등 직접 접근)
        visit_places: visit
          ? { ...visit, ...fee }
          : (Object.keys(fee).length > 0 ? fee : null),
      };

      setTicket(reshaped);
      setStore(reshaped.stores);
      setAdditionalFee((t.additional_fee as number) ?? 0);
    } catch (e) {
      console.error("[ticket] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  /* ─── overdue 자동 감지 ─── */
  const checkOverdue = useCallback(async () => {
    if (!ticket) return;
    if (ticket.status === "pre_paid" && ticket.pre_paid_deadline) {
      const now = Date.now();
      const deadline = new Date(ticket.pre_paid_deadline as string).getTime();
      if (now > deadline) {
        const res = await fetch(`/api/ticket/check-overdue?ticketId=${ticketId}`);
        const data = await res.json();
        if (data.status === "overdue") {
          setTicket((prev) => ({ ...prev!, status: "overdue", additional_fee: data.additional_fee }));
          setAdditionalFee(data.additional_fee);
        }
      }
    }
  }, [ticket, ticketId]);

  /* ─── 티켓 폴링 (Realtime 대체 — RLS 우회 위해 v1 API 폴링) ─── */
  useEffect(() => {
    if (!ticketId) return;
    loadTicket();
    // 4초마다 갱신 — 출차완료/차량준비 상태 변경 감지
    const interval = setInterval(loadTicket, 4000);
    return () => clearInterval(interval);
  }, [ticketId, loadTicket]);

  /* ─── 카운트다운 & overdue 감지 타이머 ─── */
  useEffect(() => {
    if (!ticket) return;
    // 무료 처리 차량은 항상 0원
    if (ticket.is_free) { setLiveFee(0); return; }
    // 초기 liveFee 즉시 계산
    if (["parking", "exit_requested", "car_ready"].includes(ticket.status as string)) {
      const fee = calcTicketFee(
        ticket.entry_at as string,
        ticket.visit_places as Record<string, unknown> | null,
        ticket.parking_type as string
      );
      setLiveFee(fee);
    }
    const interval = setInterval(() => {
      if (ticket.status === "pre_paid" && ticket.pre_paid_deadline) {
        const cd = fmtCountdown(ticket.pre_paid_deadline as string);
        setCountdown(cd);
        if (!cd) checkOverdue(); // 카운트다운 0 → overdue 체크
      } else if (ticket.status === "overdue" && ticket.pre_paid_deadline) {
        const diff = Date.now() - new Date(ticket.pre_paid_deadline as string).getTime();
        const m = Math.ceil(diff / 60000);
        setOverdueMinutes(m);
        // 10분마다 추가요금 재계산
        const extraFee = (ticket.visit_places as Record<string, unknown>)?.extra_fee as number ?? 1000;
        const units = Math.ceil(m / 10);
        setAdditionalFee(units * extraFee);
      } else if (["parking", "exit_requested", "car_ready"].includes(ticket.status as string)) {
        // 1분마다 예상 요금 갱신
        const fee = calcTicketFee(
          ticket.entry_at as string,
          ticket.visit_places as Record<string, unknown> | null,
          ticket.parking_type as string
        );
        setLiveFee(fee);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket, checkOverdue]);

  /* ─── 추가결제 (토스페이먼츠) ─── */
  const handleAdditionalPayment = async () => {
    if (payLoading || additionalFee === 0) return;
    setPayLoading(true);
    try {
      // 추가요금 최종 확정 저장
      const res = await fetch(`/api/ticket/${ticketId}/additional-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional_fee: additionalFee }),
      });
      const { orderId, storeName } = await res.json();
      // 토스페이먼츠 SDK 로드
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const payment = tossPayments.payment({ customerKey: `ADDITIONAL-${ticketId}` });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: additionalFee },
        orderId,
        orderName: `${storeName} 주차 추가요금`,
        successUrl: `${window.location.origin}/api/ticket/additional-payment/success`,
        failUrl: `${window.location.origin}/ticket/${ticketId}?fail=true`,
      });
    } catch (e) {
      console.error(e);
      alert("결제 연동 준비 중입니다. 키오스크를 이용해 주세요.");
    } finally {
      setPayLoading(false);
    }
  };

  /* ─── 주차요금 결제 (hr.mepark.kr 중계 → 토스 결제창) ───
     요금 확정·주문 생성은 전부 서버(mrpark-2.0). 여기는 결제창 호출만.
     위젯 아님 — tossPayments.payment() 방식. PII 전달 금지, ANONYMOUS 고정. */
  const handlePayment = async () => {
    if (orderLoading) return;
    setOrderLoading(true);
    try {
      // 1) 중계 라우트로 주문 생성 (orderId·amount는 서버가 확정)
      const res = await fetch("/api/toss/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      if (!res.ok) {
        alert("결제 준비 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const { orderId, amount } = await res.json();
      if (!orderId || !amount) {
        alert("결제할 금액이 없습니다.");
        return;
      }
      // 2) 토스 결제창 호출
      const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const payment = tossPayments.payment({ customerKey: ANONYMOUS });
      const origin = window.location.origin;
      await payment.requestPayment({
        method: "CARD",
        amount: { value: amount, currency: "KRW" }, // V2는 객체 형태 필수
        orderId,
        orderName: "주차요금",
        // 토스가 code/message(실패) · paymentKey 등(성공)을 뒤에 append.
        // ticketId는 결과 페이지의 "티켓으로 돌아가기" 복귀용(PII 아님).
        successUrl: `${origin}/pay/success?ticketId=${ticketId}`,
        failUrl: `${origin}/pay/fail?ticketId=${ticketId}`,
        // customerEmail/Name/Phone 전달 금지
      });
    } catch (e) {
      console.error("[toss/pay] error:", e);
    } finally {
      setOrderLoading(false);
    }
  };

  /* ─── 렌더 ─── */
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 14 }}><PBadge size={48} /></div>
        <div style={{ fontSize: 15, color: "#888" }}>티켓 정보를 불러오는 중...</div>
      </div>
    </div>
  );

  if (!ticket) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 14 }}><ErrorBadge size={52} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#333", marginBottom: 6 }}>티켓을 찾을 수 없습니다</div>
        <div style={{ fontSize: 13, color: "#888" }}>QR 코드를 다시 스캔해 주세요</div>
      </div>
    </div>
  );

  const status = ticket.status as string;
  const theme = STATUS_THEME[status] || STATUS_THEME.parking;
  const isOverdue = status === "overdue";
  const isPrePaid = status === "pre_paid";
  const isCompleted = status === "completed";
  const isFreeTicket = !!(ticket as Record<string, unknown>)?.is_free;
  const gracePeriod = 30; // 기본 30분 (stores.grace_period_minutes 미구현)

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f8", fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* 상단 헤더 */}
      <div style={{ background: theme.bg, padding: "32px 20px 28px", textAlign: "center", transition: "background 0.4s" }}>
        <div style={{ display: "inline-flex", marginBottom: 22 }}>
          {/* me.talk 시그니처 — 게스트 페이지의 'AI 주차비서' 얼굴 */}
          <MetalkBadge />
        </div>

        {/* 매장명 — 어느 주차장 티켓인지 즉시 인지 (㉡ 렌더 누락 수정) */}
        {(store as Record<string, unknown>)?.name ? (
          <div style={{ color: theme.text, fontSize: 15, fontWeight: 800, marginBottom: 12, opacity: 0.95 }}>
            {(store as Record<string, unknown>).name as string}
          </div>
        ) : null}

        {/* 상태 아이콘 — CSS 링+점 */}
        <div style={{ marginBottom: 14 }}>
          <RingDot color={theme.text} size={42} />
        </div>
        <div style={{ color: theme.text, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{theme.label}</div>
        <div style={{ color: `${theme.text}cc`, fontSize: 14 }}>{theme.sub}</div>

        {/* completed: 골드 완료 배너 */}
        {isCompleted && (
          <div style={{
            marginTop: 20, background: "#F5B731", borderRadius: 14,
            padding: "14px 28px", display: "inline-block",
          }}>
            <div style={{ color: "#1A1D2B", fontSize: 15, fontWeight: 900, letterSpacing: 0.3 }}>
              감사합니다! 즐거운 하루 되세요
            </div>
          </div>
        )}

        {/* pre_paid: 카운트다운 */}
        {isPrePaid && ticket.pre_paid_deadline && (
          <div style={{
            marginTop: 20, background: "rgba(255,255,255,0.15)", borderRadius: 12,
            padding: "12px 24px", display: "inline-block",
          }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 4 }}>출차 가능 시간</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', monospace" }}>
              {countdown ?? "계산 중..."}
            </div>
          </div>
        )}

        {/* overdue: 초과 시간 + 추가요금 */}
        {isOverdue && (
          <div style={{
            marginTop: 20, background: "rgba(0,0,0,0.2)", borderRadius: 16,
            padding: "16px 28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 32 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4 }}>초과 시간</div>
                <div style={{ color: "#fca5a5", fontSize: 24, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }}>
                  {fmtOverdue(ticket.pre_paid_deadline as string)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4 }}>추가요금</div>
                <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }}>
                  {fmtMoney(additionalFee)}
                </div>
              </div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 10 }}>
              * 10분마다 자동으로 추가요금이 계산됩니다
            </div>
          </div>
        )}
      </div>

      {/* 차량 정보 카드 */}
      <div style={{ padding: "0 16px", marginTop: -16 }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "20px 20px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          {/* 차량번호 */}
          <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 8 }}>차량번호</div>
            <div style={{
              display: "inline-block", padding: "6px 22px", border: "3px solid #1A1D2B",
              borderRadius: 8,
            }}>
              <PlateDisplay raw={ticket.plate_number as string} />
            </div>
          </div>

          {/* 상세 정보 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "주차 구역", value: (() => {
                  const lotName = (ticket.parking_lots as Record<string, unknown>)?.name as string;
                  const loc = ticket.parking_location as string;
                  if (lotName && loc) return `${lotName} · ${loc}`;
                  return lotName || loc || "-";
                })()
              },
              { label: "입차 시간", value: fmt(ticket.entry_at as string) },
              { label: "유형", value: ticket.parking_type === "valet" ? "발렛" : "일반" },
              ...((ticket.visit_places as Record<string, unknown>)?.name
                ? [{ label: "방문지", value: (ticket.visit_places as Record<string, unknown>)?.name as string }]
                : []),
            ].map(item => (
              <div key={item.label} style={{ background: "#f8f9fb", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d26" }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 결제 정보 */}
          <div style={{ marginTop: 16, background: "#f8f9fb", borderRadius: 12, padding: "14px 16px" }}>
            {/* parking / exit_requested / car_ready → 실시간 예상 요금 */}
            {["parking", "exit_requested", "car_ready"].includes(ticket.status as string) && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (ticket.paid_amount as number > 0) ? 10 : 0 }}>
                <span style={{ fontSize: 13, color: "#666" }}>
                  {ticket.status === "car_ready" ? "결제 예정 요금" : "예상 요금"}
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 800,
                  color: ticket.status === "car_ready" ? "#16A34A" : "#1428A0",
                }}>
                  {liveFee > 0 ? fmtMoney(liveFee) : "무료"}
                </span>
              </div>
            )}
            {/* completed → 실제 납부 요금 */}
            {isCompleted && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#666" }}>납부 금액</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#1428A0" }}>
                  {(ticket.paid_amount as number) > 0 ? fmtMoney(ticket.paid_amount as number) : "무료"}
                </span>
              </div>
            )}
          {(ticket.paid_amount as number > 0 || isOverdue) && (
            <>
              {ticket.paid_amount as number > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: isOverdue ? 8 : 0 }}>
                  <span style={{ fontSize: 13, color: "#666" }}>사전정산 금액</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>
                    {fmtMoney(ticket.paid_amount as number)}
                  </span>
                </div>
              )}
              {isOverdue && additionalFee > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#DC2626" }}>추가요금</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>
                      {fmtMoney(additionalFee)}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1a1d26" }}>총 납부 금액</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#1428A0" }}>
                      {fmtMoney((ticket.paid_amount as number || 0) + additionalFee)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* ─── 주차요금 결제 버튼 (미결제 금액이 있을 때) ─── */}
      {["parking", "exit_requested", "car_ready"].includes(ticket.status as string) && !isFreeTicket && liveFee > 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <button
            onClick={handlePayment}
            disabled={orderLoading}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "none",
              background: orderLoading ? "#ccc" : "#1428A0",
              color: "#fff", fontSize: 17, fontWeight: 800,
              cursor: orderLoading ? "not-allowed" : "pointer",
            }}
          >
            {orderLoading ? "결제 연결 중..." : `${fmtMoney(liveFee)} 결제하기`}
          </button>
          <div style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 8 }}>
            카드 결제 후 자동으로 정산됩니다
          </div>
        </div>
      )}

      {/* ─── 무료 처리 차량 안내 배너 ─── */}
      {isFreeTicket && ["parking", "exit_requested", "car_ready"].includes(ticket.status as string) && (
        <div style={{ margin: "20px 16px 0" }}>
          <div style={{
            background: "#F0FDF4", border: "2px solid #86EFAC",
            borderRadius: 14, padding: "16px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              flexShrink: 0, background: "#F5B731", borderRadius: 8,
              padding: "6px 12px", color: "#1A1D2B", fontSize: 15, fontWeight: 900,
              fontFamily: "'Outfit', sans-serif", letterSpacing: 0.5,
            }}>FREE</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16A34A", marginBottom: 2 }}>
                무료 처리 차량입니다
              </div>
              <div style={{ fontSize: 12, color: "#4ADE80" }}>
                별도 결제 없이 출차 처리됩니다
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 발렛 출차요청 버튼 ─── */}
      {ticket.parking_type === "valet" && ticket.status === "parking" && (
        <div style={{ padding: "20px 16px 0" }}>
          <button
            onClick={async () => {
              setExitLoading(true);
              try {
                // v1 exit-request API (service role로 RLS 우회 + org_id/store_id 서버 측 처리)
                const res = await fetch(`/api/v1/tickets/${ticketId}/exit-request`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                if (!res.ok) {
                  const json = await res.json().catch(() => ({}));
                  alert(json?.error?.message || "출차요청 중 오류가 발생했습니다. 다시 시도해주세요.");
                  setExitLoading(false);
                  return;
                }
                // 즉시 UI 업데이트 (다음 폴링에서 서버 상태와 동기화)
                setTicket((prev) => ({ ...prev!, status: "exit_requested" }));
              } catch {
                alert("출차요청 중 오류가 발생했습니다. 다시 시도해주세요.");
              } finally {
                setExitLoading(false);
              }
            }}
            disabled={exitLoading}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "none",
              background: exitLoading ? "#ccc" : "#1428A0",
              color: "#fff", fontSize: 17, fontWeight: 800, cursor: exitLoading ? "not-allowed" : "pointer",
            }}
          >
            {exitLoading ? "요청 중..." : "출차 요청하기"}
          </button>
          <div style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 8 }}>
            요청 후 크루가 차량을 준비합니다
          </div>
        </div>
      )}

      {/* ─── overdue 결제 버튼 섹션 ─── */}
      {isOverdue && !isFreeTicket && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            background: "#fff3f3", borderRadius: 16, padding: "16px 20px",
            border: "1px solid #fecaca", marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
              유예시간이 초과되었습니다
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              사전정산 후 {gracePeriod}분이 지났습니다.<br />
              추가요금을 결제하시면 정상 출차 처리됩니다.
            </div>
          </div>

          {/* 웹 결제 버튼 */}
          <button
            onClick={handleAdditionalPayment}
            disabled={payLoading || additionalFee === 0}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "none",
              background: additionalFee > 0 ? "#DC2626" : "#d1d5db",
              color: "#fff", fontSize: 17, fontWeight: 800, cursor: additionalFee > 0 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 10, transition: "opacity 0.2s",
              opacity: payLoading ? 0.7 : 1,
            }}
          >
            {payLoading ? "결제 연결 중..." : `${fmtMoney(additionalFee)} 웹 결제`}
          </button>

          {/* 키오스크 결제 옵션 (has_kiosk = true) */}
          {hasKiosk && (
            <button
              style={{
                width: "100%", padding: "16px", borderRadius: 14,
                border: "2px solid #1428A0", background: "#fff",
                color: "#1428A0", fontSize: 15, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              키오스크 현장 결제
            </button>
          )}

          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
            결제 완료 후 자동으로 출차 처리됩니다
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      <div style={{ padding: "20px 16px 36px" }}>
        <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.8 }}>
          문의: {(store as Record<string, unknown>)?.name as string ?? "주차장 관리자"}에 문의해 주세요
          <br />미톡이 주차 현황을 실시간으로 안내해 드립니다
        </div>
        {/* powered by — 게스트엔 미팍티켓을 전면에 노출하지 않고 하단에 작게만 */}
        <div style={{
          marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <Sparkle size={9} color="#cbcfd6" />
          <span style={{ fontSize: 10, color: "#c2c6cf", fontWeight: 600, letterSpacing: 0.3 }}>
            powered by 미팍티켓
          </span>
        </div>
      </div>
    </div>
  );
}
