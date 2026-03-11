import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toKSTDateStr } from "@/lib/utils/date";

// Vercel Cron: 매월 1일 오전 09:00 KST (UTC 00:00)
// vercel.json → { "path": "/api/cron/monthly-leave", "schedule": "0 0 1 * *" }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date();
  const currentYear = today.getFullYear();

  // ── 1년 미만 근무자 조회 ──────────────────────────────────────────
  // hire_date가 오늘 기준 1년 이내 (1년 미만 월차 대상)
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearAgoStr = toKSTDateStr(oneYearAgo);

  const { data: workers, error: workersErr } = await supabase
    .from("workers")
    .select("id, org_id, hire_date")
    .eq("status", "active")
    .gt("hire_date", oneYearAgoStr);  // hire_date > 1년전 → 1년 미만

  if (workersErr) {
    console.error("[monthly-leave cron] workers 조회 오류:", workersErr);
    return NextResponse.json({ error: workersErr.message }, { status: 500 });
  }

  if (!workers || workers.length === 0) {
    return NextResponse.json({ message: "1년 미만 근무자 없음", updated: 0 });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const worker of workers) {
    const hire = new Date(worker.hire_date);

    // 이번달 1일 기준으로 경과 개월수 계산
    // 예) 입사 2026.3.1, 오늘 2026.5.1 → 2개월 → total_days = 2
    const elapsedMonths =
      (today.getFullYear() - hire.getFullYear()) * 12 +
      (today.getMonth() - hire.getMonth());

    // 최대 11일 (근로기준법 제60조 2항)
    const newTotal = Math.min(elapsedMonths, 11);

    // 기존 worker_leaves 레코드 조회
    const { data: leaveRow, error: fetchErr } = await supabase
      .from("worker_leaves")
      .select("id, total_days, is_auto_calculated")
      .eq("worker_id", worker.id)
      .eq("year", currentYear)
      .maybeSingle();

    if (fetchErr) {
      errors.push(`worker ${worker.id}: ${fetchErr.message}`);
      continue;
    }

    if (!leaveRow) {
      // 레코드 없으면 신규 생성
      const { error: insertErr } = await supabase
        .from("worker_leaves")
        .insert({
          org_id: worker.org_id,
          worker_id: worker.id,
          year: currentYear,
          total_days: newTotal,
          used_days: 0,
          is_auto_calculated: true,
        });

      if (insertErr) {
        errors.push(`worker ${worker.id} insert: ${insertErr.message}`);
      } else {
        updated++;
      }
      continue;
    }

    // 수동 설정된 경우 Cron에서 변경하지 않음
    if (leaveRow.is_auto_calculated === false) {
      skipped++;
      continue;
    }

    // 이미 같은 값이면 스킵
    if (leaveRow.total_days === newTotal) {
      skipped++;
      continue;
    }

    // 업데이트
    const { error: updateErr } = await supabase
      .from("worker_leaves")
      .update({
        total_days: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leaveRow.id);

    if (updateErr) {
      errors.push(`worker ${worker.id} update: ${updateErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`[monthly-leave cron] 완료 — updated: ${updated}, skipped: ${skipped}, errors: ${errors.length}`);

  return NextResponse.json({
    message: "월차 자동증가 완료",
    targetMonth: `${currentYear}-${String(today.getMonth() + 1).padStart(2, "0")}`,
    totalWorkers: workers.length,
    updated,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
