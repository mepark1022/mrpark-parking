import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 매장 삭제 - service role로 FK 연관 테이블 전체 cascade 삭제
export async function POST(req: NextRequest) {
  const { storeId } = await req.json();
  if (!storeId) return NextResponse.json({ error: "storeId 필수" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // FK 참조 테이블 순서대로 삭제
  const tables = [
    "accident_reports",
    "worker_assignments",
    "worker_attendance",
    "checkout_requests",
    "daily_records",
    "hourly_data",
    "monthly_parking",
    "parking_entries",
    "mepark_tickets",
    "exit_requests",
    "invitations",
    "store_members",
    "visit_places",
    "store_operating_hours",
    "store_shifts",
    "store_late_rules",
    "overtime_shifts",
    "parking_lots",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("store_id", storeId);
    if (error) {
      // 테이블에 store_id 컬럼 없으면 무시 (42703: column does not exist)
      if (error.code !== "42703") {
        console.error(`[deleteStore] ${table} 삭제 실패:`, error.message);
      }
    }
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
