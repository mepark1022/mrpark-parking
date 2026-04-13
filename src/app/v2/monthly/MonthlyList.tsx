// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 월주차 카드 리스트 (Part 15A)
 *
 * - 카드형 리스트, 카드 클릭 → /v2/monthly/[id] 이동
 * - 좌측 컬러바: 만료 D-7 이내 = 빨강 / D-30 이내 = 노랑 / 그 외 = 회색
 *                연체(overdue) 시 추가 경고 뱃지
 * - 차량번호: Outfit 굵게 강조, 16~20px
 * - 입주사 / 사업장 / 기간 / 월요금 / 결제·계약 상태
 */
"use client";

import Link from "next/link";

const CONTRACT_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: "활성", bg: "#dcfce7", fg: "#166534" },
  expired: { label: "만료", bg: "#f1f5f9", fg: "#475569" },
  cancelled: { label: "취소", bg: "#fee2e2", fg: "#991b1b" },
};

const PAYMENT_BADGE: Record<string, { label: string; bg: string; fg: string; emoji: string }> = {
  paid: { label: "결제완료", bg: "#dbeafe", fg: "#1e40af", emoji: "✓" },
  unpaid: { label: "미결제", bg: "#fef3c7", fg: "#92400e", emoji: "💰" },
  overdue: { label: "연체", bg: "#fee2e2", fg: "#991b1b", emoji: "⚠" },
};

function daysUntil(endDate: string): number {
  if (!endDate) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + "T00:00:00");
  return Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryColorBar(days: number): string {
  if (days < 0) return "#94a3b8"; // 만료됨
  if (days <= 7) return "#dc2626"; // 빨강
  if (days <= 30) return "#F5B731"; // 골드
  return "#cbd5e1"; // 회색
}

function expiryLabel(days: number): { text: string; color: string } {
  if (days < 0) return { text: `D+${-days} 만료`, color: "#94a3b8" };
  if (days === 0) return { text: "오늘 만료", color: "#dc2626" };
  if (days <= 7) return { text: `D-${days}`, color: "#dc2626" };
  if (days <= 30) return { text: `D-${days}`, color: "#92400e" };
  return { text: `D-${days}`, color: "#64748b" };
}

function fmtDate(s: string): string {
  if (!s) return "-";
  return s.replace(/-/g, ".");
}

function fmtPhone(p: string): string {
  if (!p) return "-";
  // 010-1234-5678 → 010-****-5678 (목록 표시는 마스킹)
  const digits = p.replace(/\D/g, "");
  if (digits.length >= 8) {
    const last4 = digits.slice(-4);
    const head = digits.slice(0, 3);
    return `${head}-****-${last4}`;
  }
  return p;
}

function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString("ko-KR");
}

export default function MonthlyList({ items }: { items: any[] }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => {
        const days = daysUntil(item.end_date);
        const barColor = expiryColorBar(days);
        const exp = expiryLabel(days);
        const cb = CONTRACT_BADGE[item.contract_status] || CONTRACT_BADGE.active;
        const pb = PAYMENT_BADGE[item.payment_status] || PAYMENT_BADGE.unpaid;

        return (
          <Link
            key={item.id}
            href={`/v2/monthly/${item.id}`}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
              transition: "box-shadow 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(20, 40, 160, 0.08)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            <div style={{ display: "flex", minHeight: 100 }}>
              {/* 좌측 컬러바 */}
              <div style={{ width: 5, background: barColor, flexShrink: 0 }} />

              {/* 본문 */}
              <div
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1.4fr) minmax(160px, 1.2fr) minmax(160px, 1fr) auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                {/* 1열: 차량번호 + 차종 + 만료 D-N */}
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#1428A0",
                      letterSpacing: "0.02em",
                      fontFamily:
                        "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    }}
                  >
                    {item.vehicle_number || "-"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {item.vehicle_type && (
                      <span
                        style={{
                          padding: "1px 6px",
                          background: "#f1f5f9",
                          borderRadius: 4,
                        }}
                      >
                        {item.vehicle_type}
                      </span>
                    )}
                    <span style={{ color: exp.color, fontWeight: 700 }}>{exp.text}</span>
                  </div>
                </div>

                {/* 2열: 고객명 + 입주사 + 전화(마스킹) */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {item.customer_name || "-"}
                  </div>
                  {item.tenants?.name && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#1428A0",
                        marginTop: 3,
                        fontWeight: 600,
                      }}
                    >
                      🏢 {item.tenants.name}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      marginTop: 3,
                      fontFamily:
                        "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    }}
                  >
                    {fmtPhone(item.customer_phone)}
                  </div>
                </div>

                {/* 3열: 사업장 + 기간 */}
                <div>
                  <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
                    📍 {item.stores?.name || "-"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {fmtDate(item.start_date)} ~ {fmtDate(item.end_date)}
                  </div>
                </div>

                {/* 4열: 월요금 + 상태뱃지 */}
                <div style={{ textAlign: "right", minWidth: 130 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#1428A0",
                      fontFamily:
                        "Outfit, ui-monospace, 'SF Mono', Menlo, monospace",
                    }}
                  >
                    ₩{fmtMoney(item.monthly_fee)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        background: cb.bg,
                        color: cb.fg,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {cb.label}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: pb.bg,
                        color: pb.fg,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {pb.emoji} {pb.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
