// @ts-nocheck
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

const CSS = `
  .qr-page {
    min-height: 100dvh;
    background: #1428A0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    padding-top: env(safe-area-inset-top, 24px);
    padding-bottom: env(safe-area-inset-bottom, 24px);
  }
  .qr-success-icon {
    width: 72px; height: 72px;
    background: #16A34A;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
    margin-bottom: 16px;
    animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  @keyframes popIn {
    from { transform: scale(0); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  .qr-title {
    font-size: 22px; font-weight: 800;
    color: #fff; text-align: center;
    margin-bottom: 4px;
  }
  .qr-subtitle {
    font-size: 14px; color: rgba(255,255,255,0.7);
    text-align: center; margin-bottom: 28px;
  }
  .qr-card {
    background: #fff;
    border-radius: 24px;
    padding: 28px 24px 24px;
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    animation: slideUp 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  @keyframes slideUp {
    from { transform: translateY(40px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  .qr-plate {
    font-size: 28px; font-weight: 800;
    letter-spacing: 4px; color: #1428A0;
    padding: 10px 20px;
    background: #EEF2FF;
    border-radius: 10px;
    margin-bottom: 20px;
  }
  .qr-image-wrap {
    padding: 12px;
    border: 2px solid #E2E8F0;
    border-radius: 16px;
    margin-bottom: 16px;
  }
  .qr-image-wrap img {
    display: block;
    width: 200px; height: 200px;
  }
  .qr-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .qr-type-badge.valet { background: #FFF7ED; color: #EA580C; }
  .qr-type-badge.self  { background: #EEF2FF; color: #1428A0; }
  .qr-time {
    font-size: 12px; color: #94A3B8;
    margin-bottom: 20px;
  }
  .qr-url-hint {
    font-size: 10px; color: #CBD5E1;
    word-break: break-all; text-align: center;
    margin-bottom: 0;
  }
  .qr-actions {
    width: 100%; margin-top: 24px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .btn-white {
    height: 52px;
    background: rgba(255,255,255,0.15);
    color: #fff; border: 2px solid rgba(255,255,255,0.3);
    border-radius: 12px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; width: 100%;
  }
  .btn-gold {
    height: 52px;
    background: #F5B731; color: #1A1D2B;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; width: 100%;
  }
  .btn-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    width: 100%;
  }
`;

function QRContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const ticketId = searchParams.get("ticketId") || "";
  const plate = searchParams.get("plate") || "";
  const type = searchParams.get("type") || "self";

  const ticketUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/ticket/${ticketId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketUrl)}&color=1428A0&bgcolor=FFFFFF`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  const handleNewEntry = () => {
    router.replace("/crew/entry");
  };

  const handleGoHome = () => {
    router.replace("/crew");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ME.PARK 주차권",
          text: `차량번호: ${plate}`,
          url: ticketUrl,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(ticketUrl);
      alert("링크가 복사되었습니다!");
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="qr-page">
        <div className="qr-success-icon">✓</div>
        <div className="qr-title">입차 등록 완료!</div>
        <div className="qr-subtitle">{dateStr} · {timeStr} 입차</div>

        <div className="qr-card">
          <div className="qr-plate">{plate}</div>

          <div className={`qr-type-badge ${type}`}>
            {type === "valet" ? "🔑 발렛 주차" : "🏢 자주식 주차"}
          </div>

          {ticketId ? (
            <div className="qr-image-wrap">
              <img
                src={qrUrl}
                alt="주차권 QR"
                width={200}
                height={200}
              />
            </div>
          ) : (
            <div style={{
              width: 224, height: 224,
              background: "#F8FAFC", borderRadius: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 16, color: "#94A3B8", fontSize: 13,
            }}>
              QR 생성 중...
            </div>
          )}

          <div className="qr-time">고객에게 QR을 보여주세요</div>

          <div className="qr-url-hint">
            {ticketUrl}
          </div>
        </div>

        <div className="qr-actions">
          <div className="btn-row">
            <button className="btn-white" onClick={handleShare}>🔗 링크 공유</button>
            <button className="btn-white" onClick={() => router.push(`/crew/parking-list`)}>
              📋 현황 보기
            </button>
          </div>
          <button className="btn-white" onClick={handleNewEntry}>+ 다음 차량 입차</button>
          <button className="btn-gold" onClick={handleGoHome}>홈으로</button>
        </div>
      </div>
    </>
  );
}

export default function CrewEntryQRPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", background: "#1428A0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: 16 }}>로딩 중...</div>
      </div>
    }>
      <QRContent />
    </Suspense>
  );
}
