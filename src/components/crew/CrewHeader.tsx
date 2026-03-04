// @ts-nocheck
"use client";

import { useRouter } from "next/navigation";

interface CrewHeaderProps {
  title: string;
  showBack?: boolean;
  showLogo?: boolean;
  showStoreSelector?: boolean;
  storeName?: string;
  onStoreChange?: () => void;
  rightAction?: React.ReactNode;
}

/* 미팍Ticket 로고 (헤더용 소형) */
function HeaderLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* P 아이콘 */}
      <div style={{
        width: 32, height: 32,
        background: "#1428A0",
        borderRadius: 9,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{ position: "absolute", left: -4, top: "50%", transform: "translateY(-50%)", width: 7, height: 7, background: "rgba(255,255,255,0.25)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 7, height: 7, background: "rgba(255,255,255,0.25)", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 900, color: "#fff", marginTop: -2 }}>P</span>
        <span style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", width: 13, height: 3, background: "#F5B731", borderRadius: 1.5 }} />
      </div>
      {/* 미팍Ticket 텍스트 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 17, fontWeight: 800, color: "#1A1D2B" }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

export default function CrewHeader({
  title,
  showBack = false,
  showLogo = false,
  showStoreSelector = false,
  storeName,
  onStoreChange,
  rightAction,
}: CrewHeaderProps) {
  const router = useRouter();

  return (
    <header style={{
      position: "sticky",
      top: 0,
      left: 0,
      right: 0,
      height: 56,
      background: "#fff",
      borderBottom: "1px solid #E2E8F0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      paddingTop: "env(safe-area-inset-top, 0)",
      zIndex: 50,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* 좌측 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 60 }}>
        {showBack && (
          <button
            onClick={() => router.back()}
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", background: "none",
              cursor: "pointer", fontSize: 20, color: "#1A1D2B",
              borderRadius: 8, marginLeft: -8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#1A1D2B" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {!showBack && !showStoreSelector && showLogo && <HeaderLogo />}
        {!showBack && !showStoreSelector && !showLogo && title && (
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1D2B" }}>{title}</span>
        )}
      </div>

      {/* 가운데 */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {showStoreSelector && storeName ? (
          <button
            onClick={onStoreChange}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px",
              background: "#F1F5F9",
              borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, color: "#1A1D2B",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#1428A0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span>{storeName}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#64748B" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : showBack ? (
          <span style={{ fontSize: 17, fontWeight: 700, color: "#1A1D2B" }}>{title}</span>
        ) : null}
      </div>

      {/* 우측 */}
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>
        {rightAction}
      </div>
    </header>
  );
}
