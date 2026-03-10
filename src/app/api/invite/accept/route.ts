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
    const { userId, invitationId, email, name, role, orgId, storeId, storeIds } = await req.json();

    if (!userId || !invitationId) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    // 기존 profile 확인
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("name, id")
      .eq("id", userId)
      .single();

    // profile 업데이트 (새로 입력한 이름 우선, 없으면 기존 값)
    const finalName = name || existingProfile?.name || email.split("@")[0];

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: email,
      name: finalName,
      role: role === "crew" ? "crew" : role === "super_admin" ? "super_admin" : "admin",
      status: "active",
      org_id: orgId || null,
    });

    // 초대 상태 수락으로 변경
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitationId);

    // 매장 배정 (복수 매장 지원)
    const finalStoreIds: string[] = storeIds?.length > 0 ? storeIds : storeId ? [storeId] : [];
    for (const sid of finalStoreIds) {
      await supabaseAdmin.from("store_members").upsert({
        user_id: userId,
        store_id: sid,
        org_id: orgId || null,
      });
    }

    return NextResponse.json({ success: true, name: finalName });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "서버 오류" }, { status: 500 });
  }
}
