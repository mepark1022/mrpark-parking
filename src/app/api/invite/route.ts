// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, role, storeId, invitedBy, orgId } = await req.json();

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

    // 2. 초대 레코드 생성 (token은 DB default gen_random_uuid())
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        role: role || "admin",
        store_id: role === "crew" ? storeId : null,
        invited_by: invitedBy,
        org_id: orgId || null,
      })
      .select("id, token, role")
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    // 3. Resend로 이메일 발송
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://mrpark-parking.vercel.app";
    const acceptUrl = `${siteUrl}/invite/accept?token=${invitation.token}`;
    const roleLabel = role === "crew" ? "CREW (현장 크루)" : "관리자 (Admin)";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "VALETMAN <onboarding@resend.dev>",
        to: [email],
        subject: "[VALETMAN] 팀원 초대가 도착했습니다",
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:'Apple SD Gothic Neo',-apple-system,sans-serif;padding:40px 20px;background:#f8fafc;">
            <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#1428A0;color:#fff;padding:10px 24px;border-radius:10px;font-weight:800;font-size:18px;letter-spacing:1px;">
                  VALETMAN
                </div>
                <p style="color:#999;font-size:12px;margin-top:6px;">주차운영 시스템</p>
              </div>
              <h2 style="color:#1A1D2B;font-size:18px;margin-bottom:8px;text-align:center;">팀원 초대</h2>
              <p style="color:#666;font-size:14px;line-height:1.7;text-align:center;">
                VALETMAN 주차운영 시스템에<br/>
                <strong style="color:#1428A0;">${roleLabel}</strong>으로 초대되었습니다.
              </p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${acceptUrl}" 
                   style="display:inline-block;background:#1428A0;color:#ffffff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
                  초대 수락하기
                </a>
              </div>
              <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-top:20px;">
                <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
                  • 이 초대는 7일 후 만료됩니다<br/>
                  • 버튼이 안 되면 아래 링크를 복사하세요<br/>
                  <span style="color:#1428A0;word-break:break-all;font-size:11px;">${acceptUrl}</span>
                </p>
              </div>
            </div>
            <p style="color:#bbb;font-size:11px;text-align:center;margin-top:20px;">
              © 주식회사 미스터팍 (Mr. Park) · VALETMAN
            </p>
          </div>
        `,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return NextResponse.json({
        success: true,
        invitation,
        emailSent: false,
        emailError: resendData.message,
      });
    }

    return NextResponse.json({
      success: true,
      invitation,
      emailSent: true,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
