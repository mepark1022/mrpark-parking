// @ts-nocheck
/**
 * POST /api/demo/ready
 * 가상체험 차량준비완료 알림톡 발송
 *
 * Body: { phone, plateNumber, ticketId? }
 * Returns: { success, simulated, error }
 *
 * ⚠️ 전화번호는 알림톡 발송 후 소멸. DB 저장 절대 금지.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || "00000000-0000-0000-0000-000000000000";

export async function POST(req: NextRequest) {
  try {
    const { phone, plateNumber, ticketId } = await req.json();

    if (!phone || !plateNumber) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/-/g, "");

    const readyTime = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit", minute: "2-digit",
    });

    const result = await sendAlimtalk({
      to: cleanPhone,
      templateKey: "ready",
      variables: {
        "#{차량번호}": plateNumber,
        "#{출구위치}": "주차부스 앞",
        "#{준비시간}": readyTime,
        "#{티켓ID}":   ticketId || "demo",
      },
    });

    // 로그 저장
    await logAlimtalk({
      orgId: DEMO_ORG_ID,
      templateType: "demo_ready",
      phoneMasked: maskPhone(cleanPhone),
      result,
      ticketId: ticketId || undefined,
    });

    console.log(`[Demo/ready] plate=${plateNumber} success=${result.success} simulated=${result.simulated}`);

    return NextResponse.json({
      success: result.success || result.simulated,
      simulated: result.simulated,
      error: result.error,
    });
  } catch (err: any) {
    console.error("[Demo/ready] 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}
