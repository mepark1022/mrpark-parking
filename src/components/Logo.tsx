// @ts-nocheck
"use client";

// ME.PARK 2.0 확정 로고 시스템
// 스타일: 플랫 · 기하학 · 미니멀 액센트
// 그라디언트/shadow/3D 금지
// 4색 체계: #1428A0, #F5B731, #1A1D2B, #FFF

// ─── 관리자: Rounded Frame + Gold Corner ───

// GNB (14-16px, padding 8px 14px, 코너 12px, radius 8px)
export function LogoGNB({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const borderColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const subColor = theme === "dark" ? "rgba(255,255,255,.35)" : "#8B90A0";
  return (
    <div style={{ display: "inline-flex" }}>
      <div style={{ padding: "8px 14px", border: `2.5px solid ${borderColor}`, borderRadius: 8, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: "12px solid #F5B731", borderLeft: "12px solid transparent" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: textColor, letterSpacing: "-0.5px" }}>
          ME.PARK <em style={{ fontStyle: "normal", fontWeight: 300, color: subColor }}>2.0</em>
        </span>
      </div>
    </div>
  );
}

// 기본 (20px, padding 12px 20px, 코너 18px, radius 10px)
export function LogoDefault({ theme = "light" }: { theme?: "dark" | "light" }) {
  const borderColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const subColor = theme === "dark" ? "rgba(255,255,255,.35)" : "#8B90A0";
  return (
    <div style={{ display: "inline-flex" }}>
      <div style={{ padding: "12px 20px", border: `2.5px solid ${borderColor}`, borderRadius: 10, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: "18px solid #F5B731", borderLeft: "18px solid transparent" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: textColor, letterSpacing: "-0.5px" }}>
          ME.PARK <em style={{ fontStyle: "normal", fontWeight: 300, color: subColor }}>2.0</em>
        </span>
      </div>
    </div>
  );
}

// 히어로 (28-32px, padding 16px 28px, 코너 24px, radius 14px)
export function LogoHero({ theme = "light" }: { theme?: "dark" | "light" }) {
  const borderColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const textColor = theme === "dark" ? "#fff" : "#1A1D2B";
  const subColor = theme === "dark" ? "rgba(255,255,255,.35)" : "#8B90A0";
  return (
    <div style={{ display: "inline-flex" }}>
      <div style={{ padding: "16px 28px", border: `2.5px solid ${borderColor}`, borderRadius: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: "24px solid #F5B731", borderLeft: "24px solid transparent" }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 800, color: textColor, letterSpacing: "-0.5px" }}>
          ME.PARK <em style={{ fontStyle: "normal", fontWeight: 300, color: subColor }}>2.0</em>
        </span>
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
      background: "#fff", border: `${Math.max(2, Math.round(size * 0.03))}px solid #1A1D2B`,
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: band, background: "#F5B731" }} />
      <span style={{
        fontFamily: "'Outfit', sans-serif", fontSize, fontWeight: 900, color: "#1A1D2B",
        position: "relative", zIndex: 1, marginTop: Math.round(-size * 0.08),
      }}>P</span>
    </div>
  );
}
