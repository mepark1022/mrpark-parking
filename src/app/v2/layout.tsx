// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 공통 레이아웃
 *
 * 라우팅 정책:
 * - /v2/crew/* → admin AppLayout 건너뜀 (CREW 전용 BottomNav가 v2/crew/layout.tsx에서 적용됨)
 * - 그 외 /v2/* → admin AppLayout(Sidebar + Header + MobileTabBar) 적용
 *
 * 이유: CREW v2 페이지는 모바일 전용 UI라서 admin 사이드바/헤더가 부적합.
 *       헤더에 "대시보드" 타이틀이 잘못 표시되는 문제 + admin MobileTabBar가
 *       CREW BottomNav를 가리는 문제 해소.
 */
"use client";

import AppLayout from "@/components/layout/AppLayout";
import { usePathname } from "next/navigation";

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // CREW v2 페이지는 자체 레이아웃 사용 (v2/crew/layout.tsx)
  if (pathname?.startsWith("/v2/crew")) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
