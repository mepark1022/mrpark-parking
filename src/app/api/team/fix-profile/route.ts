// @ts-nocheck
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 특정 이메일 기준으로 name과 org_id를 강제 수정하는 API
export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { email, name, orgId, role } = await req.json();
    if (!email) return NextResponse.json({ error: "email 필요" }, { status: 400 });

    // auth user 조회
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = users?.users?.find((u: any) => u.email === email);
    if (!authUser) return NextResponse.json({ error: "해당 이메일 유저 없음" }, { status: 404 });

    const updates: any = { status: "active" };
    if (name) updates.name = name;
    if (orgId) updates.org_id = orgId;
    if (role) updates.role = role;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", authUser.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, userId: authUser.id, updates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
