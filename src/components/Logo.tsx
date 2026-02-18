// @ts-nocheck
"use client";

// ME.PARK 2.0 확정 로고 - 관리자 (Rounded Frame + Gold Corner)
// 스타일: 플랫/기하학/미니멀

export function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#1428A0"/>
      <path d="M2 12V6a4 4 0 014-4h6" stroke="#F5B731" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M38 28v6a4 4 0 01-4 4h-6" stroke="#F5B731" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="20" y="27" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="22" fill="#FFFFFF">P</text>
    </svg>
  );
}

export function LogoFull({ size = 36, theme = "dark" }: { size?: number; theme?: "dark" | "light" }) {
  const textColor = theme === "light" ? "#FFFFFF" : "#0f172a";
  const subColor = theme === "light" ? "rgba(255,255,255,0.5)" : "#94a3b8";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoIcon size={size} />
      <div>
        <div style={{ fontSize: size * 0.5, fontWeight: 800, color: textColor, letterSpacing: -0.5, lineHeight: 1.2 }}>
          <span style={{ color: "#F5B731" }}>ME</span>
          <span style={{ color: textColor }}>.</span>
          <span>PARK</span>
        </div>
        <div style={{ fontSize: size * 0.28, fontWeight: 500, color: subColor, letterSpacing: "0.05em" }}>VALETMAN 관리자</div>
      </div>
    </div>
  );
}

export function LogoLogin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <LogoIcon size={56} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>
          <span style={{ color: "#F5B731" }}>ME</span>
          <span style={{ color: "#0f172a" }}>.</span>
          <span style={{ color: "#1428A0" }}>PARK</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", marginTop: 4, letterSpacing: "0.08em" }}>VALETMAN 주차운영 시스템</div>
      </div>
    </div>
  );
}
