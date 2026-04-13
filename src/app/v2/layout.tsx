// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 공통 레이아웃 (Part 12A)
 *
 * 기존 AppLayout(Sidebar + MobileTabBar + Header)을 재사용한다.
 * admin.mepark.kr / crew.mepark.kr 양쪽에서 동일하게 동작.
 */
"use client";

import AppLayout from "@/components/layout/AppLayout";

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
