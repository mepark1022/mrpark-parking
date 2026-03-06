// @ts-nocheck
/**
 * POST /api/alimtalk/ready
 * 차량준비완료 알림톡 발송
 *
 * Body: { phone, ticketId, plateNumber, orgId, parkingLocation? }
 *
 * ⚠️ 전화번호는 이 API에서만 사용. DB 저장 절대 금지.
 *
 * 솔라피 템플릿 변수 (2026.3.6 확인):
 *   #{차량번호}, #{출구위치}, #{준비시간}, #{티켓ID}
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

export async function POST(req: NextRequest) {
  try {
    const { phone, ticketId, plateNumber, orgId, parkingLocation } = await req.json();

    if (!phone || !ticketId || !plateNumber || !orgId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 매장명 조회
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: ticket } = await supabase
      .from("mepark_tickets")
      .select("stores(name), parking_location")
      .eq("id", ticketId)
      .single();

    const storeName = ticket?.stores?.name ?? "";
    const location  = parkingLocation || ticket?.parking_location || "안내 데스크 문의";

    // 준비시간 (KST) — 템플릿 변수명: #{준비시간}
    const readyTime = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

    // 알림톡 발송
    const result = await sendAlimtalk({
      to: phone,
      templateKey: "ready",
      variables: {
        "#{차량번호}": plateNumber,  // 템플릿 변수
        "#{출구위치}": location,      // 대기 위치 (출구위치)
        "#{준비시간}": readyTime,     // 준비완료 시간
        "#{티켓ID}":   ticketId,      // 버튼 URL용
      },
    });

    // 로그 저장
    await logAlimtalk({
      orgId,
      templateType: "ready",
      phoneMasked:  maskPhone(phone),
      result,
      ticketId,
    });

    // 티켓에 발송 완료 표시
    if (result.success) {
      await supabase
        .from("mepark_tickets")
        .update({ ready_alimtalk_sent: true })
        .eq("id", ticketId);
    }

    // ⚠️ 전화번호는 여기서 소멸. DB에 저장하지 않음.

    return NextResponse.json({
      success: result.success,
      simulated: result.simulated,
      error: result.error,
    });
  } catch (err) {
    console.error("[Alimtalk/ready] 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}
