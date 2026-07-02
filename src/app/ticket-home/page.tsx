// @ts-nocheck
"use client";

// ─────────────────────────────────────────────
// ticket.mepark.kr 루트 방문객 랜딩 (토스 PG 심사 대비)
// - middleware에서 host=ticket.mepark.kr + "/" → rewrite("/ticket-home")
// - 방문객 안내 전용: QR 스캔 → 전자주차권 흐름 설명 + mepark.kr 링크
// - 로그인/앱 설치 불필요 (방문객 영구 웹 정책)
// CSS namespace: tkh-*
// ─────────────────────────────────────────────

import { LogoGNB } from "@/components/Logo";

const STEPS = [
  { no: "1", title: "QR 스캔", desc: "주차장에 비치된 QR 코드를 휴대폰 카메라로 스캔하세요" },
  { no: "2", title: "전자주차권 확인", desc: "앱 설치·회원가입 없이 내 차량의 전자주차권이 바로 열립니다" },
  { no: "3", title: "출차 · 결제", desc: "출차 요청과 주차요금 확인·결제까지 한 화면에서 해결됩니다" },
];

export default function TicketHome() {
  return (
    <div className="tkh-wrap">
      {/* 상단 네이비 히어로 */}
      <div className="tkh-hero">
        <div className="tkh-logo">
          <LogoGNB theme="dark" />
        </div>
        <h1 className="tkh-title">
          주차장에서 QR을 스캔하면
          <br />
          <span className="tkh-gold">전자주차권</span>이 열립니다
        </h1>
        <p className="tkh-sub">
          미팍Ticket은 앱 설치와 회원가입이 필요 없는
          <br />
          QR 기반 전자주차권 서비스입니다
        </p>
      </div>

      {/* 이용 안내 3단계 */}
      <div className="tkh-body">
        <div className="tkh-steps">
          {STEPS.map((s) => (
            <div key={s.no} className="tkh-step">
              <div className="tkh-step-no">{s.no}</div>
              <div>
                <div className="tkh-step-title">{s.title}</div>
                <div className="tkh-step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 안내 박스 */}
        <div className="tkh-note">
          이 페이지는 방문객 안내 페이지입니다.
          <br />
          전자주차권은 주차장 현장의 <b>QR 코드를 스캔</b>하면 자동으로 열립니다.
        </div>

        {/* 서비스 소개 링크 */}
        <a href="https://mepark.kr" className="tkh-cta">
          미팍Ticket 서비스 자세히 보기 →
        </a>

        <div className="tkh-footer">
          주식회사 미스터팍 · 미팍Ticket 전자주차권
        </div>
      </div>

      <style jsx>{`
        .tkh-wrap {
          min-height: 100vh;
          background: #f4f5f8;
          font-family: "Pretendard", "Noto Sans KR", -apple-system, sans-serif;
        }
        .tkh-hero {
          background: linear-gradient(160deg, #1428a0 0%, #0d1442 100%);
          padding: 48px 24px 56px;
          text-align: center;
        }
        .tkh-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 28px;
        }
        .tkh-title {
          color: #fff;
          font-size: 24px;
          font-weight: 800;
          line-height: 1.45;
          margin: 0 0 14px;
          letter-spacing: -0.3px;
        }
        .tkh-gold {
          color: #f5b731;
        }
        .tkh-sub {
          color: rgba(255, 255, 255, 0.75);
          font-size: 14px;
          line-height: 1.7;
          margin: 0;
        }
        .tkh-body {
          max-width: 480px;
          margin: 0 auto;
          padding: 0 16px 40px;
        }
        .tkh-steps {
          background: #fff;
          border-radius: 20px;
          padding: 8px 20px;
          margin-top: -24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .tkh-step {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 18px 0;
        }
        .tkh-step + .tkh-step {
          border-top: 1px solid #f0f0f0;
        }
        .tkh-step-no {
          flex: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #1428a0;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Outfit", sans-serif;
        }
        .tkh-step-title {
          font-size: 15px;
          font-weight: 800;
          color: #1a1d2b;
          margin-bottom: 4px;
        }
        .tkh-step-desc {
          font-size: 13px;
          color: #777;
          line-height: 1.6;
        }
        .tkh-note {
          margin-top: 16px;
          background: #fffbeb;
          border: 1px solid #fde9b8;
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 12.5px;
          color: #8a6d1f;
          line-height: 1.7;
          text-align: center;
        }
        .tkh-cta {
          display: block;
          margin-top: 20px;
          background: #1428a0;
          color: #fff;
          text-align: center;
          border-radius: 14px;
          padding: 15px 16px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
        }
        .tkh-footer {
          margin-top: 28px;
          text-align: center;
          font-size: 11px;
          color: #b7bac4;
        }
      `}</style>
    </div>
  );
}
