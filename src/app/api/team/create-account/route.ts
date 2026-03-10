// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Service Role client (RLS 무시)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/team/create-account
 * 관리자가 직접 팀원 계정(이메일+비밀번호)을 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, role, orgId, storeIds } = body;

    // 유효성 검사
    if (!email || !password || !name || !phone || !role || !orgId) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }
    if (!["admin", "crew", "super_admin"].includes(role)) {
      return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Supabase Auth에 사용자 생성
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 확인 없이 바로 활성화
      user_metadata: { full_name: name },
    });

    if (authError) {
      // 이미 존재하는 이메일
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
      }
      console.error("[create-account] auth error:", authError.message);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. profiles 테이블에 upsert
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      name,
      display_name: name,
      role,
      status: "active",
      org_id: orgId,
    });

    if (profileError) {
      console.error("[create-account] profile error:", profileError.message);
      return NextResponse.json({ error: "계정은 생성되었으나 프로필 등록에 실패했습니다." }, { status: 500 });
    }

    // 3. workers 테이블에 레코드 생성 (근무자 명부 동기화)
    try {
      const { data: existingWorker } = await admin.from("workers")
        .select("id").eq("user_id", userId).maybeSingle();
      if (existingWorker) {
        await admin.from("workers").update({ name, phone }).eq("id", existingWorker.id);
      } else {
        await admin.from("workers").insert({
          org_id: orgId,
          user_id: userId,
          name,
          phone,
          status: "active",
        });
      }
    } catch (e) {
      console.error("[create-account] workers sync error:", e);
    }

    // 4. store_members 등록
    const targetStoreIds: string[] = storeIds || [];
    for (const sid of targetStoreIds) {
      try {
        await admin.from("store_members").upsert({
          user_id: userId,
          store_id: sid,
          org_id: orgId,
        });
      } catch (e) {
        console.error("[create-account] store_member error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      message: `${name}(${email}) 계정이 생성되었습니다.`,
    });
  } catch (e) {
    console.error("[create-account] unexpected error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
