// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // profiles 테이블에 프로필 있는지 확인
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, org_id, status, role")
          .eq("id", user.id)
          .single();

        // 초대 확인 (이메일로 pending 초대가 있는지)
        const { data: invitation } = await supabase
          .from("invitations")
          .select("id, role, org_id, store_id")
          .eq("email", user.email)
          .eq("status", "pending")
          .single();

        if (!profile) {
          // 신규 사용자
          const name = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.user_metadata?.preferred_username ||
                       user.email?.split("@")[0] || "사용자";

          if (invitation) {
            // ✅ 초대가 있는 신규 사용자 → 바로 활성화
            await supabase.from("profiles").insert({
              id: user.id,
              email: user.email,
              name,
              role: invitation.role === "crew" ? "crew" : "admin",
              status: "active",
              org_id: invitation.org_id || null,
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
          } else {
            // ❌ 초대 없는 신규 사용자 → 승인대기
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
        }

        // 기존 사용자 + 초대가 있으면 업데이트
        if (invitation && profile) {
          await supabase.from("profiles").update({
            role: invitation.role === "crew" ? "crew" : "admin",
            status: "active",
            org_id: invitation.org_id || profile.org_id || null,
          }).eq("id", user.id);

          await supabase
            .from("invitations")
            .update({ status: "accepted" })
            .eq("id", invitation.id);

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

          if (invitation.role === "crew") {
            return NextResponse.redirect(`${origin}/crew/home`);
          }
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // 기존 사용자 - 상태 확인
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
