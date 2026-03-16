// @ts-nocheck
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — 버그 목록 조회
export async function GET(req: NextRequest) {
  const sb = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const status = searchParams.get("status"); // open, in_progress, resolved, closed

  if (!orgId) {
    return NextResponse.json({ error: "org_id 필수" }, { status: 400 });
  }

  let query = sb.from("bug_reports")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// POST — 새 버그 제보 (클라이언트에서 직접 Supabase insert 사용, 이 라우트는 백업용)
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();
  try {
    const body = await req.json();
    const { data, error } = await sb.from("bug_reports").insert(body).select("id").single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — 상태 변경 + AI 분석 결과 업데이트
export async function PATCH(req: NextRequest) {
  const sb = supabaseAdmin();
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

    const { error } = await sb.from("bug_reports")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
