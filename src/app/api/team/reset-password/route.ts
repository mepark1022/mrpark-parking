// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/team/reset-password
 * 관리자가 팀원 비밀번호를 재설정
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const admin = getAdminClient();

    // 유저 존재 확인
    const { data: userData, error: getUserErr } = await admin.auth.admin.getUserById(userId);
    if (getUserErr || !userData?.user) {
      return NextResponse.json({ error: `사용자를 찾을 수 없습니다: ${getUserErr?.message || "user not found"}` }, { status: 404 });
    }

    const { error } = await admin.auth.admin.updateUser(userId, {
      password: newPassword,
    });

    if (error) {
      console.error("[reset-password] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[reset-password] unexpected error:", e);
    return NextResponse.json({ error: e?.message || "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
