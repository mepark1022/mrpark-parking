// @ts-nocheck
"use client";

import { useRouter } from "next/navigation";

interface CrewHeaderProps {
  title: string;
  showBack?: boolean;
  showStoreSelector?: boolean;
  storeName?: string;
  onStoreChange?: () => void;
  rightAction?: React.ReactNode;
}

export default function CrewHeader({
  title,
  showBack = false,
  showStoreSelector = false,
  storeName,
  onStoreChange,
  rightAction,
}: CrewHeaderProps) {
  const router = useRouter();

  return (
    <>
      <style>{`
        .crew-header {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: #fff;
          border-bottom: 1px solid #E2E8F0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          padding-top: env(safe-area-inset-top, 0);
          z-index: 50;
        }
        
        .crew-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 60px;
        }
        
        .crew-header-back {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 20px;
          color: #1A1D2B;
          border-radius: 8px;
          margin-left: -8px;
        }
        
        .crew-header-back:active {
          background: #F1F5F9;
        }
        
        .crew-header-title {
          font-size: 18px;
          font-weight: 700;
          color: #1A1D2B;
        }
        
        .crew-header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }
        
        .crew-header-right {
          min-width: 60px;
          display: flex;
          justify-content: flex-end;
        }
        
        .crew-store-selector {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #F1F5F9;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #1A1D2B;
        }
        
        .crew-store-selector:active {
          background: #E2E8F0;
        }
        
        .crew-store-arrow {
          font-size: 12px;
          color: #64748B;
        }
      `}</style>

      <header className="crew-header">
        <div className="crew-header-left">
          {showBack && (
            <button
              className="crew-header-back"
              onClick={() => router.back()}
            >
              ←
            </button>
          )}
          {!showBack && !showStoreSelector && (
            <span className="crew-header-title">{title}</span>
          )}
        </div>

        <div className="crew-header-center">
          {showStoreSelector && storeName ? (
            <button className="crew-store-selector" onClick={onStoreChange}>
              <span>{storeName}</span>
              <span className="crew-store-arrow">▼</span>
            </button>
          ) : showBack ? (
            <span className="crew-header-title">{title}</span>
          ) : null}
        </div>

        <div className="crew-header-right">
          {rightAction}
        </div>
      </header>
    </>
  );
}
