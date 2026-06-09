"use client";

import React from "react";

/**
 * CarInfoModal — 차종/컬러 입력 공용 바텀시트 (Part 19B-5C)
 * - 입차 4자리 충돌 시: topContent에 충돌 차량 카드 전달
 * - parking/[id] 정보수정 시: topContent에 번호판 입력 전달
 * 신규 컴포넌트 (기존 코드 무수정). 부모가 상태 소유(controlled).
 */

export const CAR_TYPES = ["세단", "SUV", "경차", "승합", "외제", "기타"];
export const CAR_COLORS: { name: string; hex: string }[] = [
  { name: "검정", hex: "#1A1D2B" },
  { name: "흰색", hex: "#FFFFFF" },
  { name: "회색", hex: "#94A3B8" },
  { name: "은색", hex: "#CBD5E1" },
  { name: "파랑", hex: "#2563EB" },
  { name: "빨강", hex: "#DC2626" },
  { name: "기타", hex: "linear-gradient(135deg,#eee,#bbb)" },
];

// 색상 이름 → hex/그라데이션 조회 (없으면 null). 색상 칩 렌더용 공용 헬퍼.
export function carColorHex(name?: string | null): string | null {
  if (!name) return null;
  const found = CAR_COLORS.find((c) => c.name === name.trim());
  return found ? found.hex : null;
}

const CSS = `
  .cim-ov { position: fixed; inset: 0; background: rgba(10,15,40,0.55);
    display: flex; align-items: flex-end; justify-content: center; z-index: 1000; }
  .cim-sheet { width: 100%; max-width: 520px; background: #fff;
    border-radius: 22px 22px 0 0; padding: 18px 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0));
    max-height: 90dvh; overflow-y: auto; animation: cimUp 0.25s ease; }
  @keyframes cimUp { from { transform: translateY(40px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
  .cim-grab { width: 40px; height: 4px; background: #E2E8F0; border-radius: 3px; margin: 0 auto 14px; }
  .cim-h { display: flex; align-items: center; gap: 9px; margin-bottom: 4px; }
  .cim-ic { width: 30px; height: 30px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; font-size: 16px; }
  .cim-tt { font-size: 16px; font-weight: 800; color: #1A1D2B; }
  .cim-desc { font-size: 12px; color: #64748B; line-height: 1.55; margin: 6px 0 14px; }
  .cim-desc b { color: #1428A0; }
  .cim-label { font-size: 12px; font-weight: 600; color: #374151; margin: 16px 0 8px; }
  .cim-label:first-of-type { margin-top: 4px; }
  .cim-input { width: 100%; box-sizing: border-box; height: 50px; border-radius: 12px;
    border: 1.5px solid #E2E8F0; padding: 0 14px; font-size: 15px; color: #1A1D2B; outline: none; }
  .cim-input:focus { border-color: #1428A0; box-shadow: 0 0 0 3px rgba(20,40,160,0.08); }
  .cim-input::placeholder { color: #B6C0CF; }
  .cim-hint { font-size: 11.5px; color: #94A3B8; margin-top: 6px; }
  .cim-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .cim-chip { padding: 8px 14px; border-radius: 20px; border: 1.5px solid #E2E8F0;
    background: #fff; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.15s; }
  .cim-chip.sel { border-color: #1428A0; background: #EEF2FF; color: #1428A0; }
  .cim-clrs { display: flex; flex-wrap: wrap; gap: 9px; }
  .cim-clr { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; width: 46px; }
  .cim-dot { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1.5px #E2E8F0; }
  .cim-clr.sel .cim-dot { box-shadow: 0 0 0 2.5px #1428A0; }
  .cim-clr .cim-nm { font-size: 10px; color: #64748B; }
  .cim-clr.sel .cim-nm { color: #1428A0; font-weight: 700; }
  .cim-btns { display: flex; gap: 9px; margin-top: 18px; }
  .cim-btns button { flex: 1; height: 50px; border-radius: 12px; border: none;
    font-size: 14px; font-weight: 800; cursor: pointer; }
  .cim-btns button:active { opacity: 0.85; }
  .cim-ghost { background: #F1F5F9; color: #475569; }
`;

interface CarInfoModalProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  carType: string;
  onChangeType: (t: string) => void;
  /** @deprecated 색상 입력 제거(차종 수기입력으로 통합) — 호환용으로만 유지, 미사용 */
  carColor?: string;
  onChangeColor?: (c: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
  submitting?: boolean;
  topContent?: React.ReactNode;
}

export default function CarInfoModal({
  open,
  title,
  description,
  icon = "!",
  iconBg = "#FEF3C7",
  iconColor = "#92400E",
  carType,
  onChangeType,
  onConfirm,
  onCancel,
  confirmLabel = "확인",
  confirmColor = "#16A34A",
  submitting = false,
  topContent,
}: CarInfoModalProps) {
  if (!open) return null;
  return (
    <>
      <style>{CSS}</style>
      <div className="cim-ov" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="cim-sheet">
          <div className="cim-grab" />
          <div className="cim-h">
            <div className="cim-ic" style={{ background: iconBg, color: iconColor }}>{icon}</div>
            <div className="cim-tt">{title}</div>
          </div>
          {description && (
            <div className="cim-desc" dangerouslySetInnerHTML={{ __html: description }} />
          )}

          {topContent}

          <div className="cim-label">차종</div>
          <input
            className="cim-input"
            type="text"
            value={carType}
            onChange={(e) => onChangeType(e.target.value)}
            placeholder="예: 흰색 아반떼 / 검정 카니발"
            maxLength={40}
            autoComplete="off"
            enterKeyHint="done"
          />
          <div className="cim-hint">색상·모델·흠집 등 구분에 필요한 내용을 자유롭게 적으세요.</div>

          <div className="cim-btns">
            <button className="cim-ghost" onClick={onCancel} disabled={submitting}>취소</button>
            <button
              style={{ background: confirmColor, color: "#fff" }}
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting ? "처리 중..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
