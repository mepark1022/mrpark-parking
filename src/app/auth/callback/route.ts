// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// RLS 무시하는 admin client
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const admin = getAdminClient(); // RLS 무시
        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.user_metadata?.preferred_username ||
                     user.email?.split("@")[0] || "사용자";

        // ============================
        // 1단계: 초대 확인
        // ============================
        let invitation = null;

        if (inviteToken) {
          const { data: inv } = await admin
            .from("invitations")
            .select("*")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        if (!invitation && user.email) {
          const { data: inv } = await admin
            .from("invitations")
            .select("*")
            .eq("email", user.email)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        // ============================
        // 2단계: 초대가 있으면 → 수락
        // ============================
        if (invitation) {
          // org_id 결정 (3단계 fallback)
          let orgId = invitation.org_id;

          if (!orgId && invitation.invited_by) {
            const { data: inviter } = await admin
              .from("profiles")
              .select("org_id")
              .eq("id", invitation.invited_by)
              .single();
            if (inviter?.org_id) orgId = inviter.org_id;
          }

          if (!orgId) {
            const { data: admins } = await admin
              .from("profiles")
              .select("org_id")
              .eq("role", "admin")
              .eq("status", "active")
              .not("org_id", "is", null)
              .limit(1);
            if (admins?.[0]?.org_id) orgId = admins[0].org_id;
          }

          // 기존 프로필 확인
          const { data: existingProfile } = await admin
            .from("profiles")
            .select("id, name")
            .eq("id", user.id)
            .single();

          // 프로필 upsert (admin으로 RLS 무시)
          await admin.from("profiles").upsert({
            id: user.id,
            email: user.email,
            name: existingProfile?.name && existingProfile.name !== "EMPTY" ? existingProfile.name : name,
            role: invitation.role === "crew" ? "crew" : "admin",
            status: "active",
            org_id: orgId,
          });

          // 초대 수락
          await admin.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

          // CREW → store_members
          if (invitation.role === "crew" && invitation.store_id) {
            try {
              await admin.from("store_members").upsert({
                user_id: user.id,
                store_id: invitation.store_id,
                org_id: orgId,
              });
            } catch (e) {}
          }

          const response = NextResponse.redirect(
            `${origin}${invitation.role === "crew" ? "/crew/home" : "/dashboard"}`
          );
          response.cookies.set("invite_token", "", { maxAge: 0, path: "/" });
          return response;
        }

        // ============================
        // 3단계: 초대 없음 → 일반 로그인
        // ============================
        const { data: profile } = await admin
          .from("profiles")
          .select("id, org_id, status, role")
          .eq("id", user.id)
          .single();

        if (!profile) {
          await admin.from("profiles").insert({
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
