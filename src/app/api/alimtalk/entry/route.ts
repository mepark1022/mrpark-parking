// @ts-nocheck
/**
 * POST /api/alimtalk/entry
 * 입차확인 알림톡 발송
 *
 * Body: { phone, ticketId, plateNumber, orgId }
 *
 * ⚠️ 전화번호는 이 API에서만 사용. DB 저장 절대 금지.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

export async function POST(req: NextRequest) {
  try {
    const { phone, ticketId, plateNumber, orgId } = await req.json();

    if (!phone || !ticketId || !plateNumber || !orgId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 매장명 조회 (티켓 → 매장)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: ticket } = await supabase
      .from("mepark_tickets")
      .select("store_id, entry_at, stores(name)")
      .eq("id", ticketId)
      .single();

    const storeName = ticket?.stores?.name ?? "";
    const entryAt   = ticket?.entry_at
      ? new Date(ticket.entry_at).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        })
      : new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    // 알림톡 발송
    const result = await sendAlimtalk({
      to: phone,
      templateKey: "entry",
      variables: {
        "#{매장명}":   storeName,
        "#{차량번호}": plateNumber,
        "#{입차시간}": entryAt,       // 템플릿 변수명: 입차시각 X → 입차시간 O
        "#{요금안내}": "주차현황 확인 버튼을 눌러주세요",  // 템플릿 필수 변수
      },
    });

    // 로그 저장 (마스킹된 번호만)
    await logAlimtalk({
      orgId,
      templateType: "entry",
      phoneMasked:  maskPhone(phone),
      result,
      ticketId,
    });

    // 티켓에 발송 완료 표시
    if (result.success) {
      await supabase
        .from("mepark_tickets")
        .update({ entry_alimtalk_sent: true })
        .eq("id", ticketId);
    }

    // ⚠️ 전화번호는 여기서 소멸. DB에 저장하지 않음.

    return NextResponse.json({
      success: result.success,
      simulated: result.simulated,
      error: result.error,
    });
  } catch (err) {
    console.error("[Alimtalk/entry] 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}
