// @ts-nocheck
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** 도메인별 라우팅 + 기존 인증 미들웨어 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.replace(/:\d+$/, "") || "";
  const { pathname } = request.nextUrl;

  // ── 공개(비로그인) API: 방문객 위치 취급대장 — 세션 체크 없이 통과 ──
  if (pathname === "/api/v1/location/log") {
    return NextResponse.next();
  }

  // ── /ticket/* 페이지 → 정본 도메인(ticket.mepark.kr) 영구 이관(308) ──
  //   카카오 승인 템플릿 버튼이 구주소(vercel.app/ticket/{id})로 고정돼 있어,
  //   이 앱으로 들어오는 /ticket/* 트래픽을 호스트 무관 전면 리다이렉트한다.
  //   · /api/* 는 제외(페이지 경로만) — 위 startsWith 로 자연 배제됨.
  //   · ticket.mepark.kr 은 더 이상 이 앱이 아니므로(mrpark-2.0) 재진입 루프 없음.
  if (pathname.startsWith("/ticket/")) {
    return NextResponse.redirect(
      `https://ticket.mepark.kr${pathname}${request.nextUrl.search}`,
      308,
    );
  }

  // ── mepark.kr → 홈페이지 ──
  if (hostname === "mepark.kr" || hostname === "www.mepark.kr") {
    // 루트 → 정적 홈페이지 HTML 서빙
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/homepage.html", request.url));
    }
    // 매장 사장님 트랙 마케팅 페이지 (클린 URL → 정적 HTML, mepark.kr 호스트 전용)
    if (pathname === "/stores" || pathname === "/stores.html") {
      return NextResponse.rewrite(new URL("/stores.html", request.url));
    }
    if (pathname === "/stores-lp" || pathname === "/stores-lp.html") {
      return NextResponse.rewrite(new URL("/stores-lp.html", request.url));
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
    // 루트 → 방문객 안내 랜딩 (토스 PG 심사 대비 · URL은 "/" 유지)
    if (pathname === "/" || pathname === "/ticket-home") {
      return NextResponse.rewrite(new URL("/ticket-home", request.url));
    }
    if (
      pathname.startsWith("/ticket/") ||
      pathname.startsWith("/scan/") ||
      pathname.startsWith("/api/")
    ) {
      return await updateSession(request);
    }
    // 그 외 → 어드민으로 리다이렉트
    return NextResponse.redirect(`https://admin.mepark.kr${pathname}`);
  }

  // ── crew.mepark.kr → CREW앱 전용 ──
  if (hostname === "crew.mepark.kr") {
    // API 요청 → 세션 체크 후 통과
    if (pathname.startsWith("/api/")) {
      return await updateSession(request);
    }
    // CREW앱 페이지 → 세션 체크 후 통과
    if (pathname.startsWith("/crew")) {
      return await updateSession(request);
    }
    // v2 UI 페이지 (추후)
    if (pathname.startsWith("/v2/")) {
      return await updateSession(request);
    }
    // CREW 로그인 페이지
    if (pathname === "/login" || pathname.startsWith("/auth/")) {
      return await updateSession(request);
    }
    // 그 외 → CREW 메인으로 리다이렉트
    return NextResponse.redirect(new URL("/crew", request.url));
  }

  // ── admin.mepark.kr (또는 기존 vercel.app) → 관리자 시스템 ──
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};