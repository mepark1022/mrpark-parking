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
      // 소셜 로그인 성공 - 프로필 확인/생성
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // profiles 테이블에 프로필 있는지 확인
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, org_id, status")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // 신규 소셜 로그인 사용자 - profiles에 등록 (pending 상태)
          const name = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.user_metadata?.preferred_username ||
                       user.email?.split("@")[0] || "사용자";

          await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            name,
            role: "viewer",
            status: "pending",
          });

          // 승인 대기 안내 후 로그아웃
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?message=pending`);
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

        // org_id가 없으면 app_metadata 확인 후 설정
        if (!user.app_metadata?.org_id && profile.org_id) {
          // admin API로 app_metadata 업데이트 필요 (서버사이드에서만 가능)
          // 여기서는 profiles.org_id를 getOrgId()의 fallback으로 활용
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 에러 발생 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?message=error`);
}
