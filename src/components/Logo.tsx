// @ts-nocheck
"use client";

// 미팍Ticket 로고 시스템
// P 아이콘 + 미팍Ticket 텍스트
// 4색 체계: #1428A0, #F5B731, #1A1D2B, #FFF

// ─── GNB 로고: P아이콘 + 미팍Ticket ───
export function LogoGNB({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* P 아이콘 */}
      <div style={{
        width: 48, height: 48,
        background: "#1428A0",
        borderRadius: 12,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* 좌우 원형 장식 */}
        <div style={{ position: "absolute", left: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, background: theme === "dark" ? "linear-gradient(180deg, #1a237e 0%, #0d1442 100%)" : "#f8f9fb", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, background: theme === "dark" ? "linear-gradient(180deg, #1a237e 0%, #0d1442 100%)" : "#f8f9fb", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", marginTop: -4 }}>P</span>
        {/* 골드 바 */}
        <span style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 20, height: 4, background: "#F5B731", borderRadius: 2 }} />
      </div>
      {/* 미팍Ticket 텍스트 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 20, fontWeight: 800, color: textColor }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

// ─── 기본 로고 (로그인, 문서 등) ───
export function LogoDefault({ theme = "light" }: { theme?: "dark" | "light" }) {
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 56, height: 56,
        background: "#1428A0",
        borderRadius: 14,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: theme === "dark" ? "#0d1442" : "#fff", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, background: theme === "dark" ? "#0d1442" : "#fff", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 800, color: "#fff", marginTop: -4 }}>P</span>
        <span style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", width: 24, height: 5, background: "#F5B731", borderRadius: 2.5 }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 26, fontWeight: 800, color: textColor }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

// ─── 히어로 로고 (대형) ───
export function LogoHero({ theme = "light" }: { theme?: "dark" | "light" }) {
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{
        width: 72, height: 72,
        background: "#1428A0",
        borderRadius: 18,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, background: theme === "dark" ? "#0d1442" : "#fff", borderRadius: "50%" }} />
        <div style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, background: theme === "dark" ? "#0d1442" : "#fff", borderRadius: "50%" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 40, fontWeight: 800, color: "#fff", marginTop: -6 }}>P</span>
        <span style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: 30, height: 6, background: "#F5B731", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 34, fontWeight: 800, color: textColor }}>미팍</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 34, fontWeight: 700, color: "#F5B731" }}>Ticket</span>
      </div>
    </div>
  );
}

// ─── 앱 아이콘: P + Gold Band ───
export function LogoAppIcon({ size = 40 }: { size?: number }) {
  const band = Math.round(size * 0.25);
  const fontSize = Math.round(size * 0.375);
  const radius = Math.round(size * 0.25);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: "#1428A0",
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: band, background: "#F5B731" }} />
      <span style={{
        fontFamily: "'Outfit', sans-serif", fontSize, fontWeight: 900, color: "#fff",
        position: "relative", zIndex: 1, marginTop: Math.round(-size * 0.08),
      }}>P</span>
    </div>
  );
}
