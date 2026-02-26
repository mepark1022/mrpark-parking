// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

  if (!code) {
    return NextResponse.redirect(`${origin}/crew/login?error=no_code`);
  }

  // 1. 서버사이드에서 code → session 교환 (핵심!)
  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[CREW callback] code exchange failed:", exchangeError.message);
    // PKCE 불일치 시 auth 쿠키 초기화
    const response = NextResponse.redirect(`${origin}/crew/login?error=auth_failed`);
    response.cookies.set("sb-xwkatswgojahuaimbuhw-auth-token", "", { maxAge: 0, path: "/" });
    response.cookies.set("sb-xwkatswgojahuaimbuhw-auth-token-code-verifier", "", { maxAge: 0, path: "/" });
    return response;
  }

  // 2. 세션 교환 성공 → 사용자 정보 가져오기
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[CREW callback] getUser failed:", userError?.message);
    return NextResponse.redirect(`${origin}/crew/login?error=user_not_found`);
  }

  // 3. admin client로 프로필 조회 (RLS 무시)
  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, org_id, name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // 프로필 없음 → 미등록 사용자
    return NextResponse.redirect(`${origin}/crew/login?error=no_profile`);
  }

  // 4. 권한 확인
  const allowedRoles = ["crew", "admin", "owner", "super_admin"];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.redirect(`${origin}/crew/login?error=no_access`);
  }

  // 5. 매장 목록 조회
  let storeIds: string[] = [];

  if (["admin", "owner", "super_admin"].includes(profile.role)) {
    const { data: orgStores } = await admin
      .from("stores")
      .select("id")
      .eq("org_id", profile.org_id);
    storeIds = orgStores?.map((s: any) => s.id) || [];
  } else {
    const { data: storeMembers } = await admin
      .from("store_members")
      .select("store_id")
      .eq("user_id", user.id);
    storeIds = storeMembers?.map((s: any) => s.store_id) || [];
  }

  if (storeIds.length === 0) {
    return NextResponse.redirect(`${origin}/crew/login?error=no_stores`);
  }

  // 6. 매장 수에 따라 분기
  if (storeIds.length > 1) {
    return NextResponse.redirect(`${origin}/crew/select-store`);
  }

  // 단일 매장 → 쿠키로 store info 전달 (localStorage는 서버에서 못 씀)
  const stId = storeIds[0];
  const { data: storeInfo } = await admin
    .from("stores")
    .select("name")
    .eq("id", stId)
    .single();

  // crew_store 쿠키에 저장 → 클라이언트에서 localStorage로 이전
  const response = NextResponse.redirect(`${origin}/crew?from_callback=1`);
  response.cookies.set("crew_store_id", stId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  if (storeInfo?.name) {
    response.cookies.set("crew_store_name", encodeURIComponent(storeInfo.name), { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}
