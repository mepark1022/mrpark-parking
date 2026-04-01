// @ts-nocheck
/**
 * POST /api/demo/create
 * 가상체험 데모 티켓 생성 + 입차 알림톡 발송
 *
 * Body: { plateNumber, phone }
 * Returns: { success, ticketId, simulated, error }
 *
 * ⚠️ 전화번호는 알림톡 발송 후 DB에 저장하지 않음
 * ⚠️ 동일 번호 1일 3회 제한
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

// 데모 전용 org_id / store_id (환경변수 또는 하드코딩)
const DEMO_ORG_ID   = process.env.DEMO_ORG_ID   || null;
const DEMO_STORE_ID = process.env.DEMO_STORE_ID  || null;
const DEMO_STORE_NAME = process.env.DEMO_STORE_NAME || "미팍티켓 체험 매장";
const DAILY_LIMIT = 3;

export async function POST(req: NextRequest) {
  try {
    const { plateNumber, phone } = await req.json();

    if (!plateNumber || !phone) {
      return NextResponse.json({ error: "차량번호와 연락처를 입력해주세요." }, { status: 400 });
    }

    const cleanPhone = phone.replace(/-/g, "");
    const cleanPlate = plateNumber.replace(/\s/g, "");

    // 전화번호 형식 검증
    if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "올바른 연락처 형식이 아닙니다." }, { status: 400 });
    }
    // 차량번호 형식 검증
    if (!/^[0-9]{2,3}[가-힣][0-9]{4}$/.test(cleanPlate)) {
      return NextResponse.json({ error: "올바른 차량번호 형식이 아닙니다." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 1일 3회 제한 체크 (마스킹 번호 기준) ──
    const masked = maskPhone(cleanPhone);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("alimtalk_send_logs")
      .select("id", { count: "exact", head: true })
      .eq("template_type", "demo_entry")
      .eq("phone_masked", masked)
      .gte("sent_at", todayStart.toISOString());

    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `동일 번호로 1일 ${DAILY_LIMIT}회까지 체험 가능합니다.` },
        { status: 429 }
      );
    }

    // ── 데모 티켓 생성 (org_id, store_id 있을 때만) ──
    let ticketId: string | null = null;

    if (DEMO_ORG_ID && DEMO_STORE_ID) {
      const { data: ticket, error: ticketError } = await supabase
        .from("mepark_tickets")
        .insert({
          org_id: DEMO_ORG_ID,
          store_id: DEMO_STORE_ID,
          plate_number: cleanPlate,
          plate_last4: cleanPlate.slice(-4),
          parking_type: "valet",
          status: "parking",
          is_demo: true,
          entry_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ticket) ticketId = ticket.id;
      if (ticketError) console.warn("[Demo] 티켓 생성 실패 (무시):", ticketError.message);
    }

    // ── 입차 알림톡 발송 ──
    const entryAt = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

    const result = await sendAlimtalk({
      to: cleanPhone,
      templateKey: "entry",
      variables: {
        "#{매장명}":   DEMO_STORE_NAME,
        "#{차량번호}": cleanPlate,
        "#{입차시간}": entryAt,
        "#{요금안내}": "가상체험 (무료)",
        "#{티켓ID}":   ticketId || "demo",
      },
    });

    // ── 로그 저장 ──
    await logAlimtalk({
      orgId: DEMO_ORG_ID || "00000000-0000-0000-0000-000000000000",
      templateType: "demo_entry",
      phoneMasked: masked,
      result,
      ticketId: ticketId || undefined,
    });

    console.log(`[Demo/entry] plate=${cleanPlate} success=${result.success} simulated=${result.simulated}`);

    return NextResponse.json({
      success: result.success || result.simulated,
      ticketId,
      simulated: result.simulated,
      error: result.error,
    });
  } catch (err: any) {
    console.error("[Demo/create] 오류:", err);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
