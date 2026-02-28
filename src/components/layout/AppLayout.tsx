// @ts-nocheck
"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileTabBar from "./MobileTabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9", maxWidth: "100vw", overflowX: "hidden" }}>
      {/* PC 사이드바 (768px 이상에서만 표시 - Sidebar.tsx 내부 className으로 처리) */}
<div className="hidden md:block">
        <Sidebar />
      </div>
      {/* 메인 영역 */}
      <div
        className="app-main-area"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%",
          minWidth: 0,
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        {/* 헤더 (PC: 흰색 헤더 / 모바일: 네이비 그라디언트 헤더) */}
        <Header />

        {/* 컨텐츠 영역 */}
        {/* pb-[160px]: 모바일 네이비탭바 높이 + 여유 */}
        {/* md:pb-0: PC에서는 여백 제거 */}
        <main
          className="app-main-content"
          style={{
            flex: 1,
            overflowX: "hidden",
            overflowY: "auto",
          }}
        >
          <div className="app-content-inner" style={{ maxWidth: 1600, margin: "0 auto", width: "100%" }}>
            {children}
          </div>
        </main>
      </div>

      {/* 모바일 하단 탭바 (768px 미만에서만 표시 - MobileTabBar 내부 className으로 처리) */}
      <MobileTabBar />
    </div>
  );
}
