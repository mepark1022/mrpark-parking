// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── 관리자 투어 스텝 정의 ─────────────────────────────────────
const ADMIN_STEPS = [
  {
    id: "welcome",
    emoji: "👋",
    title: "미팍 어드민에 오신 것을\n환영합니다!",
    desc: "주차장 운영에 필요한 모든 것이\n여기 있어요. 30초만 투자해보세요.",
    highlight: null, // 첫 화면은 하이라이트 없음
    position: "center",
  },
  {
    id: "stores",
    emoji: "🏪",
    title: "먼저 매장을 등록하세요",
    desc: "매장 관리에서 운영할 주차장을\n등록하면 모든 기능이 활성화돼요.",
    highlight: '[data-menu="stores"]',
    position: "right",
    actionLabel: "매장 관리 바로가기",
    actionPath: "/stores",
  },
  {
    id: "team",
    emoji: "👥",
    title: "CREW를 초대하세요",
    desc: "팀원 초대에서 직원 계정을 만들면\nCREW 앱으로 바로 업무를 시작해요.",
    highlight: '[data-menu="team"]',
    position: "right",
    actionLabel: "팀원 초대 바로가기",
    actionPath: "/team",
  },
  {
    id: "dashboard",
    emoji: "📊",
    title: "대시보드로 현황을 확인하세요",
    desc: "오늘의 입차량, 매출, 근무 인원을\n실시간으로 한눈에 볼 수 있어요.",
    highlight: '[data-menu="dashboard"]',
    position: "right",
    actionLabel: "대시보드 바로가기",
    actionPath: "/dashboard",
  },
  {
    id: "ticket",
    emoji: "🎫",
    title: "미팍티켓으로 자동 입차하세요",
    desc: "주차장 입구에 QR 배너를 붙이면\n고객이 직접 입차 등록을 해요.\n직원 수고가 확 줄어들어요!",
    highlight: '[data-menu="parking-status"]',
    position: "right",
    actionLabel: "입차 현황 바로가기",
    actionPath: "/parking-status",
  },
];

// ─── 말풍선 위치 계산 ──────────────────────────────────────────
function getBubbleStyle(highlight: string | null, position: string) {
  if (!highlight || position === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }
  // 사이드바 메뉴 기준 — 사이드바 240px 우측에 말풍선
  return {
    top: "50%",
    left: "260px",
    transform: "translateY(-50%)",
  };
}

// ─── 하이라이트 링 컴포넌트 ───────────────────────────────────
function HighlightRing({ selector }: { selector: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect(r);

    // 해당 메뉴로 스크롤
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selector]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 12,
        boxShadow: "0 0 0 4px #F5B731, 0 0 0 8px rgba(245,183,49,0.3)",
        pointerEvents: "none",
        zIndex: 9999,
        animation: "onboarding-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ─── 메인 온보딩 투어 ─────────────────────────────────────────
interface OnboardingTourProps {
  role: "admin" | "crew";
  onComplete: () => void;
}

export default function OnboardingTour({ role, onComplete }: OnboardingTourProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const steps = ADMIN_STEPS; // crew는 추후 추가
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  function handleNext() {
    if (isLast) {
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handlePrev() {
    if (!isFirst) setStep((s) => s - 1);
  }

  function handleSkip() {
    onComplete();
  }

  function handleAction() {
    if (current.actionPath) {
      router.push(current.actionPath);
    }
    handleNext();
  }

  const bubbleStyle = getBubbleStyle(current.highlight, current.position);

  return (
    <>
      {/* 글로벌 애니메이션 */}
      <style>{`
        @keyframes onboarding-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes onboarding-fadein {
          from { opacity: 0; transform: translateY(-50%) scale(0.95); }
          to   { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        @keyframes onboarding-fadein-center {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* 딤 오버레이 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 9998,
        }}
        onClick={handleSkip}
      />

      {/* 하이라이트 링 */}
      <HighlightRing selector={current.highlight} />

      {/* 말풍선 카드 */}
      <div
        style={{
          position: "fixed",
          zIndex: 10000,
          width: 300,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          padding: "28px 24px 20px",
          animation: current.position === "center"
            ? "onboarding-fadein-center 0.25s ease"
            : "onboarding-fadein 0.25s ease",
          ...bubbleStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 스텝 인디케이터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, justifyContent: "center" }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? "#1428A0" : "#E8E8E8",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* 이모지 */}
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12, lineHeight: 1 }}>
          {current.emoji}
        </div>

        {/* 제목 */}
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#1A1D2B",
            textAlign: "center",
            marginBottom: 10,
            whiteSpace: "pre-line",
            lineHeight: 1.4,
          }}
        >
          {current.title}
        </h3>

        {/* 설명 */}
        <p
          style={{
            fontSize: 13,
            color: "#666",
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: 20,
            whiteSpace: "pre-line",
          }}
        >
          {current.desc}
        </p>

        {/* 버튼 영역 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 액션 버튼 (있을 때만) */}
          {current.actionLabel && (
            <button
              onClick={handleAction}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                background: "#1428A0",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              {current.actionLabel} →
            </button>
          )}

          {/* 다음/완료 버튼 */}
          <button
            onClick={handleNext}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 10,
              background: current.actionLabel ? "#F5B731" : "#1428A0",
              color: current.actionLabel ? "#1A1D2B" : "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            {isLast ? "✅ 시작하기" : (current.actionLabel ? "다음으로 →" : "다음 →")}
          </button>

          {/* 이전 + 건너뛰기 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <button
              onClick={handlePrev}
              disabled={isFirst}
              style={{
                fontSize: 12,
                color: isFirst ? "#ccc" : "#999",
                background: "none",
                border: "none",
                cursor: isFirst ? "default" : "pointer",
                padding: "4px 0",
              }}
            >
              ← 이전
            </button>
            <button
              onClick={handleSkip}
              style={{
                fontSize: 12,
                color: "#999",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              건너뛰기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
