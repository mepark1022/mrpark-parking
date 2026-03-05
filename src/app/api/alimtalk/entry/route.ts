// @ts-nocheck
/**
 * POST /api/alimtalk/entry
 * 입차확인 알림톡 발송
 *
 * Body: { phone, ticketId, plateNumber, orgId }
 *
 * ⚠️ 전화번호는 이 API에서만 사용. DB 저장 절대 금지.
 *
 * #{요금안내} 우선순위:
 *   1) visit_place 요금체계 (방문지 있는 경우)
 *   2) store 기본 요금체계 (방문지 없는 경우)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";

// 요금 안내 문자열 생성
function buildFeeGuide(fee: {
  free_minutes?: number;
  base_fee?: number;
  base_minutes?: number;
  extra_fee?: number;
  daily_max?: number;
  valet_fee?: number;
}, parkingType?: string): string {
  const free   = fee?.free_minutes ?? 0;
  const base   = fee?.base_fee ?? 0;
  const baseMins = fee?.base_minutes ?? 30;
  const extra  = fee?.extra_fee ?? 0;
  const max    = fee?.daily_max ?? 0;
  const valet  = fee?.valet_fee ?? 0;

  const parts: string[] = [];

  if (free > 0)  parts.push(`무료 ${free}분`);
  if (base > 0)  parts.push(`기본 ${base.toLocaleString()}원/${baseMins}분`);
  if (extra > 0) parts.push(`추가 ${extra.toLocaleString()}원/10분`);
  if (max > 0)   parts.push(`최대 ${max.toLocaleString()}원`);
  if (parkingType === "valet" && valet > 0)
                 parts.push(`발렛 ${valet.toLocaleString()}원`);

  return parts.length > 0 ? parts.join(" · ") : "요금 정보 없음";
}

export async function POST(req: NextRequest) {
  try {
    const { phone, ticketId, plateNumber, orgId } = await req.json();

    if (!phone || !ticketId || !plateNumber || !orgId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 티켓 + 매장명 + 방문지 ID + 주차 유형 조회
    const { data: ticket } = await supabase
      .from("mepark_tickets")
      .select("store_id, entry_at, parking_type, visit_place_id, stores(name)")
      .eq("id", ticketId)
      .single();

    const storeName  = ticket?.stores?.name ?? "";
    const entryAt    = ticket?.entry_at
      ? new Date(ticket.entry_at).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        })
      : new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const parkingType = ticket?.parking_type ?? "self";

    // ─────────────────────────────────────────
    // 요금체계 조회: 방문지 1순위 → 매장 기본 2순위
    // ─────────────────────────────────────────
    let feeData: any = null;

    if (ticket?.visit_place_id) {
      const { data: vp } = await supabase
        .from("visit_places")
        .select("free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee")
        .eq("id", ticket.visit_place_id)
        .single();
      if (vp) feeData = vp;
    }

    if (!feeData && ticket?.store_id) {
      // 매장 기본 요금: visit_places 중 store 기본(floor가 null 또는 '기본') 조회
      const { data: defaultPlace } = await supabase
        .from("visit_places")
        .select("free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee")
        .eq("store_id", ticket.store_id)
        .is("floor", null)
        .limit(1)
        .single();

      if (defaultPlace) {
        feeData = defaultPlace;
      } else {
        // visit_places 첫 번째 항목으로 fallback
        const { data: firstPlace } = await supabase
          .from("visit_places")
          .select("free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee")
          .eq("store_id", ticket.store_id)
          .order("created_at")
          .limit(1)
          .single();
        if (firstPlace) feeData = firstPlace;
      }
    }

    const feeGuide = buildFeeGuide(feeData, parkingType);

    // 알림톡 발송
    const result = await sendAlimtalk({
      to: phone,
      templateKey: "entry",
      variables: {
        "#{매장명}":   storeName,
        "#{차량번호}": plateNumber,
        "#{입차시간}": entryAt,
        "#{요금안내}": feeGuide,
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
