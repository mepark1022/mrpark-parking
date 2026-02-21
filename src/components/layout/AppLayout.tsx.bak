// @ts-nocheck
"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileTabBar from "./MobileTabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* PC 사이드바 (768px 이상에서만 표시 - Sidebar.tsx 내부 className으로 처리) */}
<div className="hidden md:block">
        <Sidebar />
      </div>
      {/* 메인 영역 */}
      <div
        className="flex-1 md:ml-[248px]"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* 헤더 (PC: 흰색 헤더 / 모바일: 네이비 그라디언트 헤더) */}
        <Header />

        {/* 컨텐츠 영역 */}
        {/* pb-20: 모바일에서 하단 탭바 높이만큼 여백 추가 */}
        {/* md:pb-0: PC에서는 여백 제거 */}
        <main
          className="pb-20 md:pb-0"
          style={{
            flex: 1,
            padding: "20px",
            overflow: "auto",
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            {children}
          </div>
        </main>
      </div>

      {/* 모바일 하단 탭바 (768px 미만에서만 표시 - MobileTabBar 내부 className으로 처리) */}
      <MobileTabBar />
    </div>
  );
}
