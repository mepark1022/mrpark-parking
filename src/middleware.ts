// @ts-nocheck
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** 도메인별 라우팅 + 기존 인증 미들웨어 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.replace(/:\d+$/, "") || "";
  const { pathname } = request.nextUrl;

  // ── mepark.kr → 홈페이지 ──
  if (hostname === "mepark.kr" || hostname === "www.mepark.kr") {
    // 루트 → 정적 홈페이지 HTML 서빙
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/homepage.html", request.url));
    }
    // 데모 페이지 → 인증 없이 바로 통과 (비로그인 방문자용)
    if (pathname.startsWith("/demo")) {
      return NextResponse.next();
    }
    // API, CREW앱 → 세션 체크 후 통과
    if (pathname.startsWith("/api/") || pathname.startsWith("/crew")) {
      return await updateSession(request);
    }
    // 그 외 경로 → admin으로 리다이렉트
    return NextResponse.redirect(`https://admin.mepark.kr${pathname}`);
  }

  // ── ticket.mepark.kr → 티켓/스캔 페이지만 허용 ──
  if (hostname === "ticket.mepark.kr") {
    if (
      pathname.startsWith("/ticket/") ||
      pathname.startsWith("/scan/") ||
      pathname.startsWith("/api/")
    ) {
      return await updateSession(request);
    }
    // 그 외 → 홈페이지로 리다이렉트
    return NextResponse.redirect("https://mepark.kr");
  }

  // ── admin.mepark.kr (또는 기존 vercel.app) → 관리자 시스템 ──
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
