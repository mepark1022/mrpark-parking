// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite_token");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 1. invite_token으로 초대 확인 (가장 우선)
        let invitation = null;
        if (inviteToken) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("id, role, org_id, store_id, email")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        // 2. invite_token 없으면 이메일로 초대 확인
        if (!invitation) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("id, role, org_id, store_id, email")
            .eq("email", user.email)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        // profiles 확인
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, org_id, status, role")
          .eq("id", user.id)
          .single();

        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.user_metadata?.preferred_username ||
                     user.email?.split("@")[0] || "사용자";

        if (invitation) {
          // ✅ 초대가 있음 → 프로필 생성/업데이트 + 수락
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            name: profile?.id ? undefined : name, // 기존 프로필이면 이름 유지
            role: invitation.role === "crew" ? "crew" : "admin",
            status: "active",
            org_id: invitation.org_id || profile?.org_id || null,
          });

          // 초대 상태 업데이트
          await supabase
            .from("invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);

          // crew + store_id면 store_members에 추가
          if (invitation.role === "crew" && invitation.store_id) {
            try {
              await supabase.from("store_members").upsert({
                user_id: user.id,
                store_id: invitation.store_id,
                org_id: invitation.org_id || null,
              });
            } catch (e) {
              console.log("store_members upsert skipped");
            }
          }

          // 역할에 따라 리다이렉트
          if (invitation.role === "crew") {
            return NextResponse.redirect(`${origin}/crew/home`);
          }
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // ❌ 초대 없음
        if (!profile) {
          // 신규 사용자 (초대 없음) → 승인대기
          await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            name,
            role: "viewer",
            status: "pending",
          });
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?message=pending`);
        }

        // 기존 사용자 상태 확인
        if (profile.status === "pending") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?message=pending`);
        }

        if (profile.status === "disabled") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?message=disabled`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=error`);
}
