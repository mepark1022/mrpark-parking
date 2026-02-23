// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─── 상태별 테마 ─── */
const STATUS_THEME = {
  parking:        { bg: "#1428A0", text: "#fff",     label: "🅿️ 주차중",     sub: "차량이 주차되어 있습니다" },
  pre_paid:       { bg: "#16A34A", text: "#fff",     label: "✅ 사전정산 완료", sub: "유예시간 내 출차해 주세요" },
  overdue:        { bg: "#DC2626", text: "#fff",     label: "⚠️ 유예시간 초과", sub: "추가요금 결제 후 출차 가능합니다" },
  exit_requested: { bg: "#F5B731", text: "#1A1D2B",  label: "🚗 출차 요청중",  sub: "크루가 차량을 준비하고 있습니다" },
  car_ready:      { bg: "#16A34A", text: "#fff",     label: "🟢 차량 준비 완료", sub: "출구로 이동해 주세요" },
  completed:      { bg: "#64748B", text: "#fff",     label: "🏁 출차 완료",    sub: "이용해 주셔서 감사합니다" },
};

const fmt = (ts: string) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtMoney = (n: number) => `${(n || 0).toLocaleString()}원`;

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

export default function TicketPage({ params }: { params: { id: string } }) {
  const ticketId = params.id;
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [store, setStore] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [overdueMinutes, setOverdueMinutes] = useState(0);
  const [additionalFee, setAdditionalFee] = useState(0);
  const [payLoading, setPayLoading] = useState(false);
  const [hasKiosk, setHasKiosk] = useState(false);

  /* ─── 티켓 로드 ─── */
  const loadTicket = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("mepark_tickets")
      .select(`
        *,
        stores:store_id(name, address, grace_period_minutes, has_kiosk),
        visit_places:visit_place_id(name, extra_fee, free_minutes, base_minutes, base_fee, daily_max, valet_fee)
      `)
      .eq("id", ticketId)
      .single();

    if (data) {
      setTicket(data);
      setStore(data.stores);
      setHasKiosk(data.stores?.has_kiosk ?? false);
      setAdditionalFee(data.additional_fee ?? 0);
    }
    setLoading(false);
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

  /* ─── 실시간 업데이트 ─── */
  useEffect(() => {
    loadTicket();
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "mepark_tickets",
        filter: `id=eq.${ticketId}`,
      }, (payload) => {
        setTicket((prev) => ({ ...prev, ...payload.new }));
        setAdditionalFee((payload.new as Record<string, unknown>).additional_fee as number ?? 0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId, loadTicket]);

  /* ─── 카운트다운 & overdue 감지 타이머 ─── */
  useEffect(() => {
    if (!ticket) return;
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

  /* ─── 렌더 ─── */
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🅿️</div>
        <div style={{ fontSize: 15, color: "#888" }}>티켓 정보를 불러오는 중...</div>
      </div>
    </div>
  );

  if (!ticket) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>❓</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#333", marginBottom: 6 }}>티켓을 찾을 수 없습니다</div>
        <div style={{ fontSize: 13, color: "#888" }}>QR 코드를 다시 스캔해 주세요</div>
      </div>
    </div>
  );

  const status = ticket.status as string;
  const theme = STATUS_THEME[status] || STATUS_THEME.parking;
  const isOverdue = status === "overdue";
  const isPrePaid = status === "pre_paid";
  const gracePeriod = (store as Record<string, unknown>)?.grace_period_minutes as number ?? 30;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f8", fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* 상단 헤더 */}
      <div style={{ background: theme.bg, padding: "32px 20px 28px", textAlign: "center", transition: "background 0.4s" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900,
          }}>P</div>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>미팍티켓</span>
        </div>

        <div style={{ fontSize: 36, marginBottom: 8 }}>
          {isOverdue ? "⚠️" : isPrePaid ? "✅" : status === "car_ready" ? "🟢" : status === "completed" ? "🏁" : "🅿️"}
        </div>
        <div style={{ color: theme.text, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{theme.label}</div>
        <div style={{ color: `${theme.text}cc`, fontSize: 14 }}>{theme.sub}</div>

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
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>차량번호</div>
            <div style={{
              display: "inline-block", padding: "6px 20px", border: "3px solid #1A1D2B",
              borderRadius: 8, fontSize: 26, fontWeight: 900, color: "#1A1D2B",
              fontFamily: "'Outfit', sans-serif", letterSpacing: 1.5,
            }}>
              {ticket.plate_number as string}
            </div>
          </div>

          {/* 상세 정보 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "주차장", value: (store as Record<string, unknown>)?.name as string ?? "-" },
              { label: "입차 시간", value: fmt(ticket.entry_at as string) },
              { label: "유형", value: ticket.parking_type === "valet" ? "발렛" : "일반" },
              {
                label: "방문지",
                value: (ticket.visit_places as Record<string, unknown>)?.name as string ?? "기본요금",
              },
            ].map(item => (
              <div key={item.label} style={{ background: "#f8f9fb", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d26" }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 결제 정보 */}
          {(ticket.paid_amount as number > 0 || isOverdue) && (
            <div style={{ marginTop: 16, background: "#f8f9fb", borderRadius: 12, padding: "14px 16px" }}>
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
                    <span style={{ fontSize: 13, color: "#DC2626" }}>⚠️ 추가요금</span>
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
            </div>
          )}
        </div>
      </div>

      {/* ─── overdue 결제 버튼 섹션 ─── */}
      {isOverdue && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            background: "#fff3f3", borderRadius: 16, padding: "16px 20px",
            border: "1px solid #fecaca", marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
              ⚠️ 유예시간이 초과되었습니다
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
            {payLoading ? "결제 연결 중..." : `💳 ${fmtMoney(additionalFee)} 웹 결제`}
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
              🖥️ 키오스크 현장 결제
            </button>
          )}

          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
            결제 완료 후 자동으로 출차 처리됩니다
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      <div style={{ padding: "20px 16px 40px" }}>
        <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.8 }}>
          문의: {(store as Record<string, unknown>)?.name as string ?? "주차장 관리자"}에 문의해 주세요
          <br />미팍티켓은 QR 코드로 주차 현황을 실시간으로 확인합니다
        </div>
      </div>
    </div>
  );
}
