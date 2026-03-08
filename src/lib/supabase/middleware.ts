// @ts-nocheck
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 인증 없이 접근 가능한 경로 목록 */
const PUBLIC_PATHS = [
  "/login",
  "/invite",
  "/auth/callback",
  "/crew",              // CREW앱 전체 (클라이언트 사이드 인증 사용)
  "/ticket",   // 미팍티켓 고객 페이지
  "/scan",     // 고정 QR 스캔
  "/api/payment", // 토스페이먼츠 웹훅
  "/api/alimtalk", // 솔라피 웹훅
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 비로그인 + 비공개 경로 → 로그인 리다이렉트
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    // /crew/* 경로는 CREW 로그인으로
    url.pathname = pathname.startsWith("/crew") ? "/crew/login" : "/login";
    return NextResponse.redirect(url);
  }

  // 로그인 상태 + /login → role에 따라 분기
  if (user && pathname === "/login") {
    // 서버사이드에서 role 확인 없이 /dashboard로 보내면 crew도 어드민 화면 진입
    // → /store-select로 보내서 role별 분기 위임 (store-select 내부에서 admin은 바로 /dashboard로)
    const url = request.nextUrl.clone();
    url.pathname = "/store-select";
    url.search = "?return=/dashboard";
    return NextResponse.redirect(url);
  }

  // 로그인 상태 + /crew/login → /crew로 리다이렉트
  if (user && pathname === "/crew/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/crew";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
