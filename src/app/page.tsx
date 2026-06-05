// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// 루트 진입점 = 앱 선택 화면 (v1 기존앱 / v2 신규앱 분리 테스트용)
// 기존: redirect("/v2/dashboard") 강제진입 → 선택 화면으로 교체
// CSS namespace: sel-*
// ─────────────────────────────────────────────

import Link from "next/link";
import { LogoGNB } from "@/components/Logo";

export default function Home() {
  return (
    <div className="sel-wrap">
      <div className="sel-inner">
        <div className="sel-logo">
          <LogoGNB theme="light" />
        </div>
        <p className="sel-sub">들어갈 앱을 선택하세요</p>

        <div className="sel-grid">
          {/* v2 신규앱 (미팍티켓) */}
          <Link href="/v2/dashboard" className="sel-card sel-card--v2">
            <span className="sel-badge sel-badge--gold">NEW</span>
            <span className="sel-card-title">미팍티켓 (신규 v2)</span>
            <span className="sel-card-desc">전자주차권 통합 어드민 · /v2/dashboard</span>
            <span className="sel-go">관리자 대시보드 →</span>
          </Link>

          {/* v1 기존앱 (VALETMAN) */}
          <Link href="/dashboard" className="sel-card sel-card--v1">
            <span className="sel-badge sel-badge--gray">기존</span>
            <span className="sel-card-title">발렛맨 (기존 v1)</span>
            <span className="sel-card-desc">VALETMAN 주차운영 시스템 · /dashboard</span>
            <span className="sel-go">기존 대시보드 →</span>
          </Link>
        </div>

        {/* CREW앱 별도 진입 */}
        <Link href="/crew" className="sel-crew">현장 CREW앱 →</Link>
      </div>

      <style jsx>{`
        .sel-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7f8fb;
          padding: 24px;
          font-family: "Noto Sans KR", sans-serif;
        }
        .sel-inner { width: 100%; max-width: 560px; text-align: center; }
        .sel-logo { display: flex; justify-content: center; margin-bottom: 14px; }
        .sel-sub { color: #8b90a0; font-size: 14px; margin: 0 0 28px; }
        .sel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 520px) { .sel-grid { grid-template-columns: 1fr; } }
        .sel-card {
          position: relative;
          display: flex; flex-direction: column; gap: 8px;
          padding: 28px 22px;
          border-radius: 16px;
          background: #fff;
          border: 1.5px solid #e8e8e8;
          text-decoration: none;
          transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
        }
        .sel-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(20,40,160,.10); }
        .sel-card--v2 { border-color: #1428A0; }
        .sel-card--v2:hover { border-color: #1428A0; }
        .sel-card--v1:hover { border-color: #8b90a0; }
        .sel-badge {
          align-self: flex-start;
          font-family: "Outfit", sans-serif;
          font-size: 11px; font-weight: 800; letter-spacing: .5px;
          padding: 3px 9px; border-radius: 999px;
        }
        .sel-badge--gold { background: #F5B731; color: #1A1D2B; }
        .sel-badge--gray { background: #eef0f4; color: #666; }
        .sel-card-title { font-size: 17px; font-weight: 800; color: #1A1D2B; margin-top: 4px; }
        .sel-card-desc { font-size: 12.5px; color: #8b90a0; line-height: 1.5; }
        .sel-go { margin-top: 8px; font-size: 13px; font-weight: 700; color: #1428A0; }
        .sel-card--v1 .sel-go { color: #666; }
        .sel-crew {
          display: inline-block; margin-top: 22px;
          font-size: 13px; color: #8b90a0; text-decoration: none;
        }
        .sel-crew:hover { color: #1428A0; }
      `}</style>
    </div>
  );
}
