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
    const { email, role, storeId, storeIds, invitedBy, orgId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("id, status")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existing) {
      return NextResponse.json({ error: "이미 대기 중인 초대가 있습니다" }, { status: 400 });
    }

    // 매장 ID 목록 (storeIds 우선, 없으면 storeId 사용)
    const finalStoreIds: string[] = storeIds?.length > 0 ? storeIds : storeId ? [storeId] : [];
    const firstStoreId = finalStoreIds[0] || null;

    // 매장 이름 조회 (이메일에 표시)
    let storeNames: string[] = [];
    if (finalStoreIds.length > 0) {
      const { data: storesData } = await supabaseAdmin.from("stores").select("name").in("id", finalStoreIds);
      storeNames = storesData?.map(s => s.name) || [];
    }

    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        role: role || "admin",
        store_id: firstStoreId,
        invited_by: invitedBy,
        org_id: orgId || null,
      })
      .select("id, token, role")
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    // 복수 매장 저장 (invitation_stores 또는 메타데이터로)
    // → 수락 시 store_members에 일괄 등록하기 위해 invitation에 store_ids 저장
    if (finalStoreIds.length > 0) {
      await supabaseAdmin.from("invitations").update({ store_ids: finalStoreIds }).eq("id", invitation.id);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://mrpark-parking.vercel.app";
    const acceptUrl = `${siteUrl}/invite/accept?token=${invitation.token}`;
    const roleLabel = role === "crew" ? "CREW (현장 크루)" : "관리자 (Admin)";
    const roleColor = role === "crew" ? "#16a34a" : "#1428A0";
    const storeInfo = storeNames.length > 0 ? storeNames.join(", ") : "전체 매장";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ME.PARK 2.0 <noreply@mepark.kr>",
        to: [email],
        subject: "[ME.PARK 2.0] 팀원 초대가 도착했습니다",
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:'Apple SD Gothic Neo',-apple-system,sans-serif;padding:40px 20px;background:#f1f5f9;">
            <div style="background:#fff;border-radius:16px;padding:36px 28px;border:1px solid #e2e8f0;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;padding:10px 18px;border:2.5px solid #1A1D2B;border-radius:10px;position:relative;overflow:hidden;">
                  <div style="position:absolute;top:0;right:0;width:0;height:0;border-top:16px solid #F5B731;border-left:16px solid transparent;"></div>
                  <span style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:#1A1D2B;letter-spacing:-0.5px;">ME.PARK </span>
                  <span style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:300;color:#8B90A0;">2.0</span>
                </div>
                <p style="color:#8B90A0;font-size:11px;margin-top:6px;letter-spacing:1px;">주차운영 시스템</p>
              </div>
              <h2 style="color:#1A1D2B;font-size:18px;margin-bottom:8px;text-align:center;font-weight:800;">팀원 초대</h2>
              <p style="color:#666;font-size:14px;line-height:1.7;text-align:center;">
                ME.PARK 2.0 주차운영 시스템에<br/>
                <strong style="color:${roleColor};">${roleLabel}</strong>으로 초대되었습니다.
              </p>
              ${storeNames.length > 0 ? `
              <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;margin:12px 0;text-align:center;">
                <p style="color:#4338ca;font-size:13px;font-weight:600;margin:0;">📍 배정 매장: ${storeInfo}</p>
              </div>` : ""}
              <div style="text-align:center;margin:28px 0;">
                <a href="${acceptUrl}" style="display:inline-block;background:#1428A0;color:#ffffff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">초대 수락하기</a>
              </div>
              <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-top:20px;">
                <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
                  • 이 초대는 7일 후 만료됩니다<br/>
                  • 버튼이 안 되면 아래 링크를 복사하세요<br/>
                  <span style="color:#1428A0;word-break:break-all;font-size:11px;">${acceptUrl}</span>
                </p>
              </div>
            </div>
            <p style="color:#bbb;font-size:11px;text-align:center;margin-top:20px;">© 주식회사 미스터팍 (Mr. Park) · ME.PARK 2.0</p>
          </div>
        `,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      return NextResponse.json({ success: true, invitation, emailSent: false, emailError: resendData.message });
    }

    return NextResponse.json({ success: true, invitation, emailSent: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
