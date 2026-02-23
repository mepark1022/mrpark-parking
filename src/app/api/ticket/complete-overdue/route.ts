// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ticket/complete-overdue
 * 관리자가 overdue 티켓을 출차 처리
 * - waive: true이면 추가요금 면제, false이면 현장 결제 완료로 처리
 */
export async function POST(req: NextRequest) {
  try {
    const { ticketId, waive = false } = await req.json();
    if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

    const supabase = await createClient();
    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      exit_at: now,
      updated_at: now,
    };

    if (waive) {
      updatePayload.additional_fee = 0;
    } else {
      // 현장 결제 완료 처리
      updatePayload.additional_paid_at = now;
    }

    const { error } = await supabase
      .from("mepark_tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .eq("status", "overdue");

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
