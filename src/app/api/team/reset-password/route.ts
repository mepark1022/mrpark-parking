// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/team/reset-password
 * 관리자가 팀원 비밀번호를 재설정 (Supabase Admin REST API 직접 호출)
 */
export async function POST(req: NextRequest) {
  let userId = "";
  let newPassword = "";

  try {
    const body = await req.json();
    userId = body.userId;
    newPassword = body.newPassword;
  } catch {
    return NextResponse.json({ error: "요청 본문 파싱 실패" }, { status: 400 });
  }

  if (!userId || !newPassword) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "환경변수 누락" }, { status: 500 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[reset-password] Supabase error:", res.status, JSON.stringify(data));
      return NextResponse.json({ error: data?.msg || data?.message || data?.error || "Supabase 오류" }, { status: res.status });
    }

    return NextResponse.json({ success: true, email: data?.email });
  } catch (e: any) {
    console.error("[reset-password] Exception:", e?.message || String(e));
    return NextResponse.json({ error: `예외: ${e?.message || String(e)}` }, { status: 500 });
  }
}
