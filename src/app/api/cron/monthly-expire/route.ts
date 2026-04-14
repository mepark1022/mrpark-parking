// @ts-nocheck
/**
 * GET /api/cron/monthly-expire
 * Vercel Cron: 매일 오전 09:00 KST (UTC 00:00)
 *
 * 동작:
 *   - 오늘 날짜 = end_date 인 active 계약 조회
 *   - expire_alimtalk_sent = false 인 건만 발송
 *   - 템플릿: monthly_expire
 *   - 발송 성공 시 expire_alimtalk_sent=true + expire_alimtalk_sent_at 기록
 *
 * 참고:
 *   - contract_status 는 그대로 'active' 로 둠 (만료 처리는 별도 정책으로)
 *   - 실제 만료 상태전이는 관리자 조작 또는 갱신 시 expired 처리되는 것을 따름
 *
 * 권한: Vercel Cron (CRON_SECRET Bearer)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";
import { toKSTDateStr } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

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

  // 오늘 날짜 (KST 기준 YYYY-MM-DD)
  const todayStr = toKSTDateStr(new Date());

  // 대상: end_date = 오늘 + active + 미발송
  const { data: contracts, error } = await supabase
    .from("monthly_parking")
    .select("*, stores(name)")
    .eq("contract_status", "active")
    .eq("end_date", todayStr)
    .eq("expire_alimtalk_sent", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!contracts?.length) {
    return NextResponse.json({
      success: true,
      message: "오늘 만료 대상 계약 없음",
      date: todayStr,
      count: 0,
    });
  }

  const results: Array<{
    id: string;
    vehicleNumber: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const c of contracts) {
    const {
      id,
      org_id,
      customer_name,
      customer_phone,
      vehicle_number,
      end_date,
      stores,
    } = c;

    // phone 유효성 (숫자만 10자 이상)
    const digits = (customer_phone || "").replace(/-/g, "");
    if (digits.length < 10) {
      results.push({
        id,
        vehicleNumber: vehicle_number,
        success: false,
        error: "phone 형식 오류",
      });
      continue;
    }

    const result = await sendAlimtalk({
      to: customer_phone,
      templateKey: "monthly_expire",
      variables: {
        "#{고객명}":   customer_name ?? "",
        "#{차량번호}": vehicle_number,
        "#{매장명}":   stores?.name ?? "",
        "#{만료일}":   end_date,
      },
    });

    await logAlimtalk({
      orgId: org_id,
      templateType: "monthly_expire_auto",
      phoneMasked: maskPhone(customer_phone),
      result,
      monthlyParkingId: id,
    });

    if (result.success) {
      await supabase
        .from("monthly_parking")
        .update({
          expire_alimtalk_sent: true,
          expire_alimtalk_sent_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    results.push({
      id,
      vehicleNumber: vehicle_number,
      success: result.success,
      error: result.error,
    });
  }

  return NextResponse.json({
    success: true,
    date: todayStr,
    total: contracts.length,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
