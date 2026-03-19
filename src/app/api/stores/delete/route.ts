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

  // FK 참조 테이블 순서대로 삭제 (store_id 기반)
  const storeIdTables = [
    "accident_reports",
    "worker_assignments",
    "worker_attendance",
    "checkout_requests",
    "daily_records",
    "hourly_data",
    "monthly_parking",
    "parking_entries",
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

  // mepark_tickets를 참조하는 테이블은 ticket_id 기반 삭제 필요
  // 먼저 해당 매장의 티켓 ID 목록 조회
  const { data: tickets } = await supabase
    .from("mepark_tickets").select("id").eq("store_id", storeId);
  const ticketIds = (tickets || []).map(t => t.id);

  if (ticketIds.length > 0) {
    for (const table of ["alimtalk_send_logs", "payment_records"]) {
      const { error } = await supabase.from(table).delete().in("ticket_id", ticketIds);
      if (error && error.code !== "42703") {
        console.error(`[deleteStore] ${table} 삭제 실패:`, error.message);
      }
    }
  }

  // mepark_tickets 삭제
  {
    const { error } = await supabase.from("mepark_tickets").delete().eq("store_id", storeId);
    if (error) console.error(`[deleteStore] mepark_tickets 삭제 실패:`, error.message);
  }

  // 나머지 store_id 기반 테이블 삭제
  for (const table of storeIdTables) {
    const { error } = await supabase.from(table).delete().eq("store_id", storeId);
    if (error) {
      if (error.code !== "42703") {
        console.error(`[deleteStore] ${table} 삭제 실패:`, error.message);
      }
    }
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
