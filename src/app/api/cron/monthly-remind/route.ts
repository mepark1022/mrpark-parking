// @ts-nocheck
/**
 * GET /api/cron/monthly-remind
 * Vercel Cron: 매일 오전 10시 KST (UTC 01:00)
 * D-7 만료 예정 월주차 → 알림톡 자동 발송
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlimtalk, logAlimtalk, maskPhone } from "@/lib/utils/solapi";
import { toKSTDateStr } from "@/lib/utils/date";

export async function GET(req) {
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

  const d7Date = new Date();
  d7Date.setDate(d7Date.getDate() + 7);
  const d7Str = toKSTDateStr(d7Date);

  const { data: contracts, error } = await supabase
    .from("monthly_parking")
    .select("*, stores(name)")
    .eq("contract_status", "active")
    .eq("end_date", d7Str)
    .eq("d7_alimtalk_sent", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contracts?.length) {
    return NextResponse.json({ success: true, message: "D-7 만료 예정 계약 없음", date: d7Str, count: 0 });
  }

  const results = [];

  for (const c of contracts) {
    const { id, org_id, customer_name, customer_phone, vehicle_number, end_date, monthly_fee, stores } = c;

    const result = await sendAlimtalk({
      to: customer_phone,
      templateKey: "monthly_remind",
      variables: {
        "#{고객명}":   customer_name,
        "#{차량번호}": vehicle_number,
        "#{매장명}":   stores?.name ?? "",
        "#{만료일}":   end_date,
        "#{월요금}":   `${Number(monthly_fee).toLocaleString()}원`,
      },
    });

    await logAlimtalk({
      orgId: org_id, templateType: "d7_auto_remind",
      phoneMasked: maskPhone(customer_phone),
      result, monthlyParkingId: id,
    });

    if (result.success) {
      await supabase.from("monthly_parking").update({
        d7_alimtalk_sent: true,
        d7_alimtalk_sent_at: new Date().toISOString(),
      }).eq("id", id);
    }

    results.push({ id, vehicleNumber: vehicle_number, success: result.success, error: result.error });
  }

  return NextResponse.json({
    success: true, date: d7Str, total: contracts.length,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}
