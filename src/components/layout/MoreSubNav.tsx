// @ts-nocheck
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect } from "react";

const subPages = [
  // v2 통합앱 라우팅 (v1→v2 일괄교체, 2026.05.30)
  { path: "/v2/parking-status", label: "입차현황", icon: "🚗" },
  { path: "/v2/monthly", label: "월주차", icon: "📅" },
  { path: "/v2/analytics", label: "매출분석", icon: "📊" }, // v2 구현 완료 (/v2/analytics, API-first)
  { path: "/v2/stores", label: "매장관리", icon: "🏠" },
  { path: "/v2/team", label: "직원관리", icon: "👥" },
  { path: "/settings", label: "설정", icon: "⚙️" }, // v2 미구현(GAP-P2-1) → 레거시 유지
  { path: "/guide", label: "기능안내", icon: "💡" },
];

// 더보기 하위 페이지 경로 (more 자체 제외)
const subPagePaths = subPages.map((p) => p.path);

export default function MoreSubNav() {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // 더보기 하위 페이지에서만 표시 (/more 자체는 제외)
  const isSubPage = subPagePaths.some((p) => pathname.startsWith(p));

  // 활성 탭 자동 스크롤
  // ⚠️ hook은 항상 호출되어야 함 — early return(아래) 위로 올림. (React #310: hook 개수 불일치 방지)
  //    sub페이지가 아니면 ref가 미부착이라 내부 if가 false → no-op.
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [pathname]);

  if (!isSubPage) return null;

  return (
    <>
      <style>{`
        .more-subnav { display: flex !important; }
        .more-subnav::-webkit-scrollbar { display: none; }
        @media (min-width: 768px) { .more-subnav { display: none !important; } }
      `}</style>
      <div
        className="more-subnav"
        ref={scrollRef}
        style={{
          position: "sticky",
          top: 56,
          zIndex: 99,
          background: "linear-gradient(135deg, #0e1866 0%, #1630b8 100%)",
          overflowX: "auto",
          overflowY: "hidden",
          whiteSpace: "nowrap",
          padding: "8px 12px",
          gap: 6,
          alignItems: "center",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* 더보기 홈 버튼 */}
        <div
          onClick={() => router.push("/more")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(255,255,255,0.1)",
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>

        {subPages.map((page) => {
          const active = pathname.startsWith(page.path);
          return (
            <div
              key={page.path}
              ref={active ? activeRef : null}
              onClick={() => router.push(page.path)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 20,
                background: active ? "#F5B731" : "rgba(255,255,255,0.08)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 13 }}>{page.icon}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0a1352" : "rgba(255,255,255,0.8)",
                  letterSpacing: -0.3,
                }}
              >
                {page.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
