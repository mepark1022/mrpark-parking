/**
 * POST /api/toss/orders
 * 토스 결제 주문 생성 중계 (CORS 회피용)
 *
 * 서버 결제 로직은 전부 mrpark-2.0(hr.mepark.kr)에 있음.
 * 이 라우트는 { ticket_id }를 서버사이드로 전달하고 응답을 그대로 반환할 뿐,
 * 시크릿 키·요금 계산·DB 저장을 절대 수행하지 않는다.
 *
 * Body: { ticket_id }
 * 반환: hr.mepark.kr /api/v1/payments/orders 응답 그대로 → { orderId, amount, ... }
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return NextResponse.json({ error: "ticket_id 누락" }, { status: 400 });
    }

    const upstream = await fetch("https://hr.mepark.kr/api/v1/payments/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id }),
      cache: "no-store",
    });

    // 상태코드·본문을 그대로 중계 (변형 없음)
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[toss/orders] relay error:", e);
    return NextResponse.json(
      { error: "결제 주문 생성 중 오류가 발생했습니다" },
      { status: 502 }
    );
  }
}
