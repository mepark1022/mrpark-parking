// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ticket/check-overdue
 * 유예시간 초과 티켓 감지 및 overdue 상태 전환
 *
 * 호출 시점:
 * 1. 고객 티켓 페이지 접속 시 (해당 티켓만)
 * 2. 어드민 입차현황 페이지 접속 시 (전체 스캔)
 * 3. Supabase Cron - 매 5분마다 (추후 설정)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticketId, orgId } = body; // 특정 티켓만 처리 시 사용

    const supabase = await createClient();
    const now = new Date().toISOString();

    // 1. overdue로 전환할 티켓 조회
    let query = supabase
      .from("mepark_tickets")
      .select(`
        id, org_id, store_id, status, pre_paid_deadline, entry_at,
        visit_place_id, parking_type,
        visit_places:visit_place_id(extra_fee, base_minutes, base_fee, free_minutes)
      `)
      .eq("status", "pre_paid")
      .lt("pre_paid_deadline", now);

    if (ticketId) query = query.eq("id", ticketId);
    if (orgId) query = query.eq("org_id", orgId);

    const { data: overdueTickets, error } = await query;
    if (error) throw error;
    if (!overdueTickets || overdueTickets.length === 0) {
      return NextResponse.json({ updated: 0, tickets: [] });
    }

    // 2. 각 티켓 추가요금 계산 후 업데이트
    const updates = await Promise.all(
      overdueTickets.map(async (ticket) => {
        const additionalFee = calcAdditionalFee(ticket);
        const { error: updateError } = await supabase
          .from("mepark_tickets")
          .update({
            status: "overdue",
            additional_fee: additionalFee,
            updated_at: now,
          })
          .eq("id", ticket.id);

        return {
          id: ticket.id,
          additional_fee: additionalFee,
          error: updateError?.message,
        };
      })
    );

    return NextResponse.json({
      updated: updates.filter((u) => !u.error).length,
      tickets: updates,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[check-overdue]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/ticket/check-overdue?ticketId=xxx
 * 단일 티켓의 overdue 상태 확인 (고객 페이지용)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get("ticketId");
  if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("mepark_tickets")
    .select(`
      id, status, pre_paid_deadline, additional_fee, additional_paid_at,
      visit_place_id, entry_at, paid_amount, parking_type,
      visit_places:visit_place_id(extra_fee, base_minutes)
    `)
    .eq("id", ticketId)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const now = new Date();
  const isOverdue =
    ticket.status === "pre_paid" &&
    ticket.pre_paid_deadline &&
    new Date(ticket.pre_paid_deadline) < now;

  if (isOverdue) {
    const additionalFee = calcAdditionalFee(ticket);
    await supabase
      .from("mepark_tickets")
      .update({ status: "overdue", additional_fee: additionalFee })
      .eq("id", ticketId);
    return NextResponse.json({
      status: "overdue",
      additional_fee: additionalFee,
      overdue_minutes: Math.floor(
        (now.getTime() - new Date(ticket.pre_paid_deadline).getTime()) / 60000
      ),
    });
  }

  return NextResponse.json({
    status: ticket.status,
    additional_fee: ticket.additional_fee || 0,
    pre_paid_deadline: ticket.pre_paid_deadline,
  });
}

/**
 * 추가요금 계산: (초과시간 ÷ 10분) × extra_fee
 */
function calcAdditionalFee(ticket: {
  pre_paid_deadline?: string;
  visit_places?: { extra_fee?: number; base_minutes?: number } | null;
}): number {
  if (!ticket.pre_paid_deadline) return 0;
  const now = new Date();
  const deadline = new Date(ticket.pre_paid_deadline);
  const overdueMs = now.getTime() - deadline.getTime();
  if (overdueMs <= 0) return 0;

  const overdueMinutes = Math.ceil(overdueMs / 60000);
  const extraFee = ticket.visit_places?.extra_fee ?? 1000; // 기본 1,000원/10분
  const units = Math.ceil(overdueMinutes / 10);
  return units * extraFee;
}
