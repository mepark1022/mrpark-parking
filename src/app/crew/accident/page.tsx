// @ts-nocheck
"use client";

import CrewHeader from "@/components/crew/CrewHeader";

export default function CrewAccidentPage() {
  return (
    <>
      <style>{`
        .placeholder-page {
          min-height: 100dvh;
          background: #F8FAFC;
        }
        .placeholder-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        .placeholder-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        .placeholder-title {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
          margin-bottom: 8px;
        }
        .placeholder-desc {
          font-size: 14px;
          color: #64748B;
        }
        .placeholder-badge {
          margin-top: 16px;
          padding: 6px 14px;
          background: #FEF3C7;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: #92400E;
        }
      `}</style>

      <div className="placeholder-page">
        <CrewHeader title="사고보고" showBack />
        <div className="placeholder-content">
          <div className="placeholder-icon">⚠️</div>
          <div className="placeholder-title">사고보고</div>
          <div className="placeholder-desc">
            사고 유형 선택 → 사진 촬영 → 제출<br/>
            Phase 4에서 구현 예정
          </div>
          <div className="placeholder-badge">Coming Soon</div>
        </div>
      </div>
    </>
  );
}
