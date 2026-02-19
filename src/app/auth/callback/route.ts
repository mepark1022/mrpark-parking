// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // invite_token: URL 파라미터 또는 쿠키에서 가져오기
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
        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.user_metadata?.preferred_username ||
                     user.email?.split("@")[0] || "사용자";

        // ============================
        // 1단계: 초대 확인 (token → email 순서)
        // ============================
        let invitation = null;

        // 1-1. invite_token으로 초대 조회
        if (inviteToken) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("id, role, org_id, store_id, email, invited_by")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        // 1-2. 이메일로 초대 조회
        if (!invitation && user.email) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("id, role, org_id, store_id, email, invited_by")
            .eq("email", user.email)
            .eq("status", "pending")
            .single();
          if (inv) invitation = inv;
        }

        // ============================
        // 2단계: 초대가 있으면 → 수락 처리
        // ============================
        if (invitation) {
          // org_id 결정: 초대에 있으면 사용, 없으면 초대한 사람에서 가져오기
          let orgId = invitation.org_id;
          if (!orgId && invitation.invited_by) {
            const { data: inviterProfile } = await supabase
              .from("profiles")
              .select("org_id")
              .eq("id", invitation.invited_by)
              .single();
            if (inviterProfile?.org_id) orgId = inviterProfile.org_id;
          }

          // 기존 프로필 확인
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, name")
            .eq("id", user.id)
            .single();

          // 프로필 생성/업데이트
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email,
            name: existingProfile?.name && existingProfile.name !== "EMPTY" ? existingProfile.name : name,
            role: invitation.role === "crew" ? "crew" : "admin",
            status: "active",
            org_id: orgId,
          });

          // 초대 수락
          await supabase
            .from("invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);

          // CREW → store_members 추가
          if (invitation.role === "crew" && invitation.store_id) {
            try {
              await supabase.from("store_members").upsert({
                user_id: user.id,
                store_id: invitation.store_id,
                org_id: orgId,
              });
            } catch (e) {}
          }

          // 쿠키 삭제
          const response = NextResponse.redirect(
            `${origin}${invitation.role === "crew" ? "/crew/home" : "/dashboard"}`
          );
          response.cookies.set("invite_token", "", { maxAge: 0, path: "/" });
          return response;
        }

        // ============================
        // 3단계: 초대 없음 → 일반 로그인
        // ============================
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, org_id, status, role")
          .eq("id", user.id)
          .single();

        if (!profile) {
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
