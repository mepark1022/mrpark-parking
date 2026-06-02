// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";

/**
 * CREW v2 미팍티켓 QR 발급/공유 페이지 (GAP-P1-4)
 * - 레거시 src/app/crew/entry/qr/page.tsx 이식.
 * - 입차 등록 직후 진입 → 고객용 미팍티켓 URL(/ticket/{id})을 QR로 표시·공유.
 *   고객 뷰(/ticket/[id])는 이미 운영 중(실시간 상태/출차요청/추가결제) → 본 화면은 "전달" 핸드오프.
 * - 진입: /v2/crew/entry/qr?ticketId=...&plate=...  (entry 성공 시 router.replace)
 * - ⚠️ QR 생성: 레거시는 외부 api.qrserver.com 호출(약전파/오프라인 취약·제3자 URL 전송)이었으나
 *   → 클라이언트 qrcode 라이브러리로 교정(오프라인 동작·네이티브 전환 구조 정합).
 * - 풀스크린 네이비 핸드오프 → v2/crew/layout의 HIDE_NAV_PATHS에 등록되어 하단탭 숨김.
 * - 네임스페이스 cv2qr-*, NAVY/GOLD/Outfit.
 */

const CSS = `
  .cv2qr-page {
    min-height:100dvh; background:#1428A0;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:24px; padding-top:env(safe-area-inset-top, 24px);
    padding-bottom:env(safe-area-inset-bottom, 24px);
    font-family:'Noto Sans KR', sans-serif;
  }
  .cv2qr-success-icon {
    width:72px; height:72px; background:#16A34A; border-radius:50%;
    display:flex; align-items:center; justify-content:center; font-size:36px; color:#fff;
    margin-bottom:16px; animation:cv2qr-pop .4s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes cv2qr-pop { from{transform:scale(0);opacity:0;} to{transform:scale(1);opacity:1;} }
  .cv2qr-title { font-size:22px; font-weight:800; color:#fff; text-align:center; margin-bottom:4px; }
  .cv2qr-subtitle { font-size:14px; color:rgba(255,255,255,.7); text-align:center; margin-bottom:28px; }

  .cv2qr-card {
    background:#fff; border-radius:24px; padding:28px 24px 24px;
    width:100%; max-width:320px;
    display:flex; flex-direction:column; align-items:center;
    box-shadow:0 20px 60px rgba(0,0,0,.3);
    animation:cv2qr-up .4s .1s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes cv2qr-up { from{transform:translateY(40px);opacity:0;} to{transform:translateY(0);opacity:1;} }
  .cv2qr-plate {
    font-size:28px; font-weight:800; letter-spacing:4px; color:#1428A0;
    padding:10px 20px; background:#EEF2FF; border-radius:10px; margin-bottom:20px;
    font-family:'Outfit', 'Noto Sans KR', sans-serif;
  }
  .cv2qr-image-wrap { padding:12px; border:2px solid #E2E8F0; border-radius:16px; margin-bottom:16px; }
  .cv2qr-image-wrap img { display:block; width:200px; height:200px; }
  .cv2qr-placeholder {
    width:224px; height:224px; background:#F8FAFC; border-radius:16px;
    display:flex; align-items:center; justify-content:center;
    margin-bottom:16px; color:#94A3B8; font-size:13px;
  }
  .cv2qr-hint-label { font-size:12px; color:#94A3B8; margin-bottom:14px; font-weight:600; }
  .cv2qr-url-hint { font-size:10px; color:#CBD5E1; word-break:break-all; text-align:center; }

  .cv2qr-actions { width:100%; max-width:320px; margin-top:24px; display:flex; flex-direction:column; gap:10px; }
  .cv2qr-btn-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; }
  .cv2qr-btn {
    height:52px; border-radius:12px; font-size:15px; font-weight:700;
    cursor:pointer; width:100%; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:6px;
    -webkit-tap-highlight-color:transparent; transition:transform .12s, opacity .2s;
  }
  .cv2qr-btn:active { transform:scale(.97); }
  .cv2qr-btn-white { background:rgba(255,255,255,.15); color:#fff; border:2px solid rgba(255,255,255,.3); }
  .cv2qr-btn-gold { background:#F5B731; color:#1A1D2B; border:none; }

  /* 복사 토스트 */
  .cv2qr-copied {
    position:fixed; left:50%; bottom:calc(28px + env(safe-area-inset-bottom, 0));
    transform:translateX(-50%); z-index:50;
    background:#16A34A; color:#fff; font-size:13px; font-weight:700;
    padding:10px 18px; border-radius:24px; box-shadow:0 8px 24px rgba(0,0,0,.25);
    animation:cv2qr-fade .25s ease both;
  }
  @keyframes cv2qr-fade { from{opacity:0;transform:translate(-50%,8px);} to{opacity:1;transform:translate(-50%,0);} }
`;

function QRContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const ticketId = searchParams.get("ticketId") || "";
  const plate = searchParams.get("plate") || "";

  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const ticketUrl = origin && ticketId ? `${origin}/ticket/${ticketId}` : "";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  // origin 확보 (SSR 안전)
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // 클라이언트 QR 생성 (외부 API 미사용)
  useEffect(() => {
    if (!ticketUrl) return;
    QRCode.toDataURL(ticketUrl, {
      width: 400,
      margin: 1,
      color: { dark: "#1428A0", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e) => console.error("QR 생성 실패:", e));
  }, [ticketUrl]);

  const handleShare = async () => {
    if (!ticketUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "미팍Ticket 주차권", text: `차량번호: ${plate}`, url: ticketUrl });
      } catch {
        /* 사용자 취소 무시 */
      }
    } else {
      try {
        await navigator.clipboard.writeText(ticketUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch {
        console.error("클립보드 복사 실패");
      }
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2qr-page">
        <div className="cv2qr-success-icon">✓</div>
        <div className="cv2qr-title">입차 등록 완료!</div>
        <div className="cv2qr-subtitle">{dateStr} · {timeStr} 입차</div>

        <div className="cv2qr-card">
          {plate && <div className="cv2qr-plate">{plate}</div>}

          {ticketId && qrDataUrl ? (
            <div className="cv2qr-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="미팍티켓 QR" width={200} height={200} />
            </div>
          ) : (
            <div className="cv2qr-placeholder">QR 생성 중...</div>
          )}

          <div className="cv2qr-hint-label">고객에게 QR을 보여주세요</div>
          {ticketUrl && <div className="cv2qr-url-hint">{ticketUrl}</div>}
        </div>

        <div className="cv2qr-actions">
          <div className="cv2qr-btn-row">
            <button className="cv2qr-btn cv2qr-btn-white" onClick={handleShare}>🔗 링크 공유</button>
            <button className="cv2qr-btn cv2qr-btn-white" onClick={() => router.replace("/v2/crew/parking")}>
              📋 현황 보기
            </button>
          </div>
          <button className="cv2qr-btn cv2qr-btn-white" onClick={() => router.replace("/v2/crew/entry")}>
            + 다음 차량 입차
          </button>
          <button className="cv2qr-btn cv2qr-btn-gold" onClick={() => router.replace("/v2/crew")}>
            홈으로
          </button>
        </div>
      </div>

      {copied && <div className="cv2qr-copied">링크가 복사되었습니다!</div>}
    </>
  );
}

export default function CrewV2EntryQRPage() {
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
