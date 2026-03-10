// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/team/reset-password
 * 관리자가 팀원 비밀번호를 재설정
 */
export async function POST(req: NextRequest) {
  let userId = "";
  let newPassword = "";

  try {
    const body = await req.json();
    userId = body.userId;
    newPassword = body.newPassword;
  } catch {
    return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  if (!userId || !newPassword) {
    return NextResponse.json({ error: `필수 항목 누락 (userId: ${!!userId}, pw: ${!!newPassword})` }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: `환경변수 누락 (URL: ${!!supabaseUrl}, KEY: ${!!serviceKey})` }, { status: 500 });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.updateUser(userId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: `Supabase: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: data?.user?.email });
  } catch (e: any) {
    return NextResponse.json({
      error: `예외: ${e?.message || String(e)}`,
    }, { status: 500 });
  }
}
