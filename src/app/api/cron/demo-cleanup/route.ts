// @ts-nocheck
/**
 * GET /api/cron/demo-cleanup
 * Vercel Cron: 매일 새벽 3시 KST (UTC 18:00 전일)
 * 24시간 이상 경과한 데모 티켓 + 관련 로그 자동 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 24시간 전 시각
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // ── 1) 삭제 대상 데모 티켓 ID 조회 ──
    const { data: demoTickets, error: fetchError } = await supabase
      .from("mepark_tickets")
      .select("id")
      .eq("is_demo", true)
      .lt("created_at", cutoff);

    if (fetchError) {
      console.error("[Cron/demo-cleanup] 티켓 조회 오류:", fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const ticketIds = (demoTickets || []).map((t) => t.id);

    if (ticketIds.length === 0) {
      console.log("[Cron/demo-cleanup] 삭제할 데모 티켓 없음");
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // ── 2) 관련 알림톡 로그 삭제 ──
    const { error: logError, count: logCount } = await supabase
      .from("alimtalk_send_logs")
      .delete({ count: "exact" })
      .in("ticket_id", ticketIds);

    if (logError) {
      console.warn("[Cron/demo-cleanup] 로그 삭제 경고:", logError.message);
    }

    // ── 3) 데모 티켓 삭제 ──
    const { error: deleteError, count: ticketCount } = await supabase
      .from("mepark_tickets")
      .delete({ count: "exact" })
      .eq("is_demo", true)
      .lt("created_at", cutoff);

    if (deleteError) {
      console.error("[Cron/demo-cleanup] 티켓 삭제 오류:", deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`[Cron/demo-cleanup] 완료: 티켓 ${ticketCount}건, 로그 ${logCount ?? 0}건 삭제`);

    return NextResponse.json({
      success: true,
      deleted: ticketCount,
      logsDeleted: logCount ?? 0,
    });
  } catch (err: any) {
    console.error("[Cron/demo-cleanup] 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
