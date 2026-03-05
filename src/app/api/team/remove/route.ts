// @ts-nocheck
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { userId, userEmail, orgId, requesterId } = await req.json();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 요청자 권한 확인
    const { data: requester } = await supabaseAdmin
      .from("profiles")
      .select("role, org_id")
      .eq("id", requesterId)
      .single();

    if (!requester || requester.org_id !== orgId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    if (requester.role !== "super_admin" && requester.role !== "admin") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 대상자 확인 (super_admin은 제거 불가)
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (target?.role === "super_admin") {
      return NextResponse.json({ error: "최고관리자는 제거할 수 없습니다" }, { status: 403 });
    }

    // 1. 모든 매장 배정 제거
    await supabaseAdmin
      .from("store_members")
      .delete()
      .eq("user_id", userId);

    // 2. profile에서 org_id 제거 + disabled
    await supabaseAdmin
      .from("profiles")
      .update({ org_id: null, status: "disabled" })
      .eq("id", userId);

    // 3. 해당 이메일 초대 기록 삭제
    if (userEmail) {
      await supabaseAdmin
        .from("invitations")
        .delete()
        .eq("email", userEmail)
        .eq("org_id", orgId);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
