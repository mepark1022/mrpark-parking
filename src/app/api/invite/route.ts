// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, role, invitedBy } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
    }

    // 1. 이미 초대된 이메일인지 확인
    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("id, status")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existing) {
      return NextResponse.json({ error: "이미 대기 중인 초대가 있습니다" }, { status: 400 });
    }

    // 2. 초대 레코드 생성
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .insert({ email, role: role || "member", invited_by: invitedBy })
      .select("id, token")
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    // 3. Resend로 이메일 발송
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mrpark-parking.vercel.app";
    const inviteLink = `${appUrl}/login?invite=${invitation.token}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mr. Park <onboarding@resend.dev>",
        to: [email],
        subject: "[Mr. Park] 주차 관리 시스템에 초대되었습니다",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1428A0; font-size: 24px; margin: 0;">Mr. Park</h1>
              <p style="color: #666; font-size: 14px; margin-top: 4px;">주차 관리 시스템</p>
            </div>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center;">
              <h2 style="color: #111; font-size: 18px; margin-bottom: 12px;">팀원 초대</h2>
              <p style="color: #444; font-size: 15px; line-height: 1.6;">
                Mr. Park 주차 관리 시스템의 팀원으로 초대되었습니다.<br>
                아래 버튼을 클릭하여 가입해주세요.
              </p>
              <p style="color: #888; font-size: 13px;">권한: ${role === "admin" ? "관리자" : "팀원"}</p>
              <a href="${inviteLink}" style="display: inline-block; margin-top: 20px; padding: 14px 32px; background: #1428A0; color: white; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                초대 수락하기
              </a>
              <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
                버튼이 작동하지 않으면 아래 링크를 복사해주세요:<br>
                <span style="color: #1428A0; word-break: break-all;">${inviteLink}</span>
              </p>
            </div>
            <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 30px;">
              © Mr. Park 주차 관리 시스템
            </p>
          </div>
        `,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // 이메일 발송 실패해도 초대는 생성됨
      return NextResponse.json({ 
        success: true, 
        invitation: invitation, 
        emailSent: false, 
        emailError: resendData.message 
      });
    }

    return NextResponse.json({ 
      success: true, 
      invitation: invitation, 
      emailSent: true 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}