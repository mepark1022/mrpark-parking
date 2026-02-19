// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // invite_token: URL → 쿠키 순서로 확인
  let inviteToken = searchParams.get("invite_token");
  if (!inviteToken) {
    try {
      const cookieStore = await cookies();
      inviteToken = cookieStore.get("invite_token")?.value || null;
    } catch (e) {}
  }

  console.log("[callback] inviteToken:", inviteToken);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.user_metadata?.preferred_username ||
                     user.email?.split("@")[0] || "사용자";

        console.log("[callback] user:", user.email, "inviteToken:", inviteToken);

        // ============================
        // 1단계: 초대 확인
        // ============================
        let invitation = null;

        // 1-1. invite_token으로
        if (inviteToken) {
          const { data: inv, error: invErr } = await supabase
            .from("invitations")
            .select("*")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .single();
          console.log("[callback] token lookup:", inv?.id, invErr?.message);
          if (inv) invitation = inv;
        }

        // 1-2. 이메일로
        if (!invitation && user.email) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("*")
            .eq("email", user.email)
            .eq("status", "pending")
            .single();
          console.log("[callback] email lookup:", inv?.id);
          if (inv) invitation = inv;
        }

        // ============================
        // 2단계: 초대가 있으면 → 수락
        // ============================
        if (invitation) {
          console.log("[callback] invitation found:", invitation.id, "org_id:", invitation.org_id, "invited_by:", invitation.invited_by);

          // org_id 결정 (3단계 fallback)
          let orgId = invitation.org_id;

          // fallback 1: invited_by로 초대한 사람의 org_id
          if (!orgId && invitation.invited_by) {
            const { data: inviter } = await supabase
              .from("profiles")
              .select("org_id")
              .eq("id", invitation.invited_by)
              .single();
            if (inviter?.org_id) orgId = inviter.org_id;
            console.log("[callback] fallback1 inviter org_id:", orgId);
          }

          // fallback 2: 시스템에서 첫 번째 admin의 org_id (최후의 수단)
          if (!orgId) {
            const { data: admins } = await supabase
              .from("profiles")
              .select("org_id")
              .eq("role", "admin")
              .eq("status", "active")
              .not("org_id", "is", null)
              .limit(1);
            if (admins?.[0]?.org_id) orgId = admins[0].org_id;
            console.log("[callback] fallback2 admin org_id:", orgId);
          }

          console.log("[callback] final orgId:", orgId);

          // 기존 프로필 확인
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, name")
            .eq("id", user.id)
            .single();

          // 프로필 upsert
          const profileData = {
            id: user.id,
            email: user.email,
            name: existingProfile?.name && existingProfile.name !== "EMPTY" ? existingProfile.name : name,
            role: invitation.role === "crew" ? "crew" : "admin",
            status: "active",
            org_id: orgId,
          };
          console.log("[callback] upsert profile:", profileData);

          const { error: upsertErr } = await supabase.from("profiles").upsert(profileData);
          console.log("[callback] upsert result:", upsertErr?.message || "OK");

          // 초대 수락
          await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

          // CREW → store_members
          if (invitation.role === "crew" && invitation.store_id) {
            try {
              await supabase.from("store_members").upsert({
                user_id: user.id,
                store_id: invitation.store_id,
                org_id: orgId,
              });
            } catch (e) {}
          }

          // 쿠키 삭제 + 리다이렉트
          const response = NextResponse.redirect(
            `${origin}${invitation.role === "crew" ? "/crew/home" : "/dashboard"}`
          );
          response.cookies.set("invite_token", "", { maxAge: 0, path: "/" });
          return response;
        }

        // ============================
        // 3단계: 초대 없음
        // ============================
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, org_id, status, role")
          .eq("id", user.id)
          .single();

        if (!profile) {
          await supabase.from("profiles").insert({
            id: user.id, email: user.email, name,
            role: "viewer", status: "pending",
          });
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?message=pending`);
        }

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
