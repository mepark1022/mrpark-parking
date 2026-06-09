// @ts-nocheck
"use client";

/**
 * VehiclePhotoCapture — v2 입차 차량사진 연속촬영 (GAP-P1-8b)
 * ───────────────────────────────────────────────────────────
 * 대표 확정 스펙:
 *  1. getUserMedia 스트림을 "1회만" 오픈하고 유지 (레거시처럼 슬롯마다 재오픈 안 함 → 끊김 제거)
 *  2. 셔터 탭 → canvas 풀해상도 캡처 → 다음 슬롯 자동 진행 (스트림 끊지 않음)
 *  3. 순서·라벨 없이 자유 촬영 (최대 6장) — 전면/후면 등 방향 가이드 제거
 *  4. 패스버튼: (a)사진 단계 전체 스킵  (b)현재까지 촬영분으로 제출 — 0장 제출 허용
 *  - 흠집 판단용 고화질: width/height ideal 1920↑, jpeg quality 0.92, 인위적 용량제한 없음
 *
 * 설계: 이 컴포넌트는 "촬영"만 책임진다. 업로드/티켓생성(POST→Storage→PATCH)은 부모(entry/page.tsx)가 담당.
 *  - onComplete(photos): 촬영 완료 또는 현재까지 촬영분 제출 시 호출. 0장(전체 스킵)도 빈 배열로 전달.
 *  - onCancel(): 사진 단계 자체를 취소하고 입력 폼으로 복귀 (제출 안 함).
 */

import { useState, useEffect, useRef, useCallback } from "react";

// 순서·라벨 없이 자유 촬영, 최대 6장
const MAX_PHOTOS = 6;

interface CapturedPhoto {
  blob: Blob;
  label: string;     // 슬롯 라벨 (PATCH 경로 idx_label 구성용)
  preview: string;   // objectURL (미리보기/정리 대상)
}

interface VehiclePhotoCaptureProps {
  /** 촬영 완료(또는 남은 슬롯 스킵 후 제출) 시 호출. 0장 전체스킵 시 빈 배열. */
  onComplete: (photos: { blob: Blob; label: string }[]) => void;
  /** 사진 단계 취소 → 입력 폼 복귀 (제출하지 않음) */
  onCancel: () => void;
}

export default function VehiclePhotoCapture({ onComplete, onCancel }: VehiclePhotoCaptureProps) {
  const [captured, setCaptured] = useState<CapturedPhoto[]>([]);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // 캡처 처리 중 중복 탭 방지

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef<CapturedPhoto[]>([]); // 언마운트 정리용 최신 스냅샷

  // 자유 촬영: 현재 장수만 추적 (방향 슬롯 없음)
  const currentIndex = captured.length;
  const isFull = currentIndex >= MAX_PHOTOS;

  // ── 카메라 1회 오픈 (마운트 시 한 번) ─────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setErrorMsg("카메라 권한이 없습니다. 설정에서 카메라를 허용한 뒤 다시 시도하세요.");
      }
    })();
    return () => {
      cancelled = true;
      // 스트림 정리
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      // 미리보기 objectURL 정리 (최신 스냅샷 기준)
      capturedRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  // capturedRef 동기화 (cleanup에서 최신값 참조)
  useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  // ── 현재 프레임 풀해상도 캡처 → Blob ────────────────
  const captureCurrent = useCallback(async () => {
    if (busy || isFull) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    setBusy(true);
    try {
      // 크롭 없이 원본 해상도 그대로 (흠집 판단용)
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) {
        setErrorMsg("사진 캡처에 실패했습니다. 다시 시도하세요.");
        return;
      }
      const label = `사진 ${capturedRef.current.length + 1}`;
      const preview = URL.createObjectURL(blob);
      setCaptured((prev) => [...prev, { blob, label, preview }]);
      // 스트림은 유지 → 다음 슬롯으로 자동 진행 (currentIndex 증가)
    } finally {
      setBusy(false);
    }
  }, [busy, isFull]);

  // ── 마지막 1장 재촬영 (삭제 후 슬롯 되돌림) ──────────
  const retakeLast = useCallback(() => {
    setCaptured((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      URL.revokeObjectURL(last.preview);
      return prev.slice(0, -1);
    });
  }, []);

  // ── 특정 슬롯 삭제 (썸네일 X) ────────────────────────
  const removeAt = useCallback((idx: number) => {
    setCaptured((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      // 삭제 후 번호 재정렬 (방향 라벨 없음)
      const next = prev.filter((_, i) => i !== idx);
      return next.map((p, i) => ({ ...p, label: `사진 ${i + 1}` }));
    });
  }, []);

  // ── 제출 (현재까지 촬영분 전달, 0장 허용) ────────────
  const submit = useCallback(() => {
    onComplete(captured.map((p) => ({ blob: p.blob, label: p.label })));
  }, [captured, onComplete]);

  // ── 사진 없이 입차 (전체 스킵 = 0장 제출) ────────────
  const skipAll = useCallback(() => {
    onComplete([]);
  }, [onComplete]);

  // ── 에러 화면 ────────────────────────────────────────
  if (errorMsg) {
    return (
      <>
        <style>{CSS}</style>
        <div className="vphoto-overlay">
          <div className="vphoto-error">
            <div className="vphoto-error-icon">📷</div>
            <div className="vphoto-error-msg">{errorMsg}</div>
            <div className="vphoto-error-actions">
              <button className="vphoto-btn ghost" onClick={onCancel}>뒤로</button>
              <button className="vphoto-btn primary" onClick={skipAll}>사진 없이 입차</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="vphoto-overlay">
        {/* 헤더 */}
        <div className="vphoto-header">
          <button className="vphoto-back" onClick={onCancel} aria-label="뒤로">←</button>
          <div className="vphoto-title">차량 사진 촬영</div>
          <div className="vphoto-count">{captured.length} / {MAX_PHOTOS}</div>
        </div>

        {/* 프리뷰 */}
        <div className="vphoto-preview">
          <video ref={videoRef} className="vphoto-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {!ready && <div className="vphoto-loading">카메라 준비 중…</div>}

          {ready && !isFull && (
            <div className="vphoto-slot-label">
              자유롭게 촬영 · {captured.length}/{MAX_PHOTOS}장 (권장 4장 이상)
            </div>
          )}
          {ready && isFull && (
            <div className="vphoto-slot-label done">✓ {MAX_PHOTOS}장 촬영 완료</div>
          )}
        </div>

        {/* 촬영 썸네일 스트립 */}
        {captured.length > 0 && (
          <div className="vphoto-strip">
            {captured.map((p, i) => (
              <div className="vphoto-thumb" key={p.preview}>
                <img src={p.preview} alt={p.label} />
                <button className="vphoto-thumb-x" onClick={() => removeAt(i)} aria-label="삭제">×</button>
              </div>
            ))}
          </div>
        )}

        {/* 컨트롤 */}
        <div className="vphoto-controls">
          {/* 셔터 영역 */}
          {!isFull && (
            <button
              className="vphoto-shutter"
              onClick={captureCurrent}
              disabled={!ready || busy}
              aria-label="촬영"
            >
              <span className="vphoto-shutter-ring" />
            </button>
          )}

          {/* 보조 액션 */}
          <div className="vphoto-actions">
            {captured.length > 0 && (
              <button className="vphoto-btn ghost" onClick={retakeLast} disabled={busy}>
                직전 사진 재촬영
              </button>
            )}

            {captured.length === 0 ? (
              <button className="vphoto-btn ghost" onClick={skipAll}>
                사진 없이 입차
              </button>
            ) : (
              <button className="vphoto-btn primary" onClick={submit} disabled={busy}>
                {isFull ? "이대로 입차 등록" : `${captured.length}장으로 입차 등록`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// 스코프 CSS (vphoto-* 네임스페이스 — cv2-* 와 격리)
// 토큰: Navy #1428A0 / BG #F8FAFC / border #E2E8F0 / green #16A34A
// ─────────────────────────────────────────────
const CSS = `
  .vphoto-overlay {
    /* z-index 400: CREW 하단탭(BottomNav z200)·출차요청 배너(z300) 위로 올려 풀스크린 점유
       (사진 단계는 /v2/crew/entry의 하위 상태라 layout HIDE_NAV_PATHS 경로숨김이 안 먹음 → 오버레이가 직접 덮음) */
    position: fixed; inset: 0; z-index: 400;
    background: #0a1352; display: flex; flex-direction: column;
    color: #fff;
  }
  .vphoto-header {
    flex: 0 0 auto; height: 52px; display: flex; align-items: center;
    padding: 0 12px; gap: 8px;
    background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
  }
  .vphoto-back {
    width: 36px; height: 36px; border-radius: 10px; border: none;
    background: rgba(255,255,255,0.15); color: #fff; font-size: 20px; cursor: pointer;
  }
  .vphoto-back:active { background: rgba(255,255,255,0.25); }
  .vphoto-title { flex: 1; font-size: 15px; font-weight: 700; text-align: center; }
  .vphoto-count {
    min-width: 48px; text-align: right; font-size: 13px; font-weight: 700;
    color: #F5B731;
  }

  .vphoto-preview {
    flex: 1 1 auto; position: relative; background: #000;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .vphoto-video { width: 100%; height: 100%; object-fit: cover; }
  .vphoto-loading {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #94A3B8;
  }
  .vphoto-slot-label {
    position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
    padding: 8px 18px; border-radius: 999px;
    background: rgba(20,40,160,0.85); color: #fff;
    font-size: 15px; font-weight: 700; white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }
  .vphoto-slot-label.done { background: rgba(22,163,74,0.9); }

  .vphoto-strip {
    flex: 0 0 auto; display: flex; gap: 8px; padding: 10px 12px;
    overflow-x: auto; background: #0a1352; -webkit-overflow-scrolling: touch;
  }
  .vphoto-thumb {
    position: relative; flex: 0 0 auto; width: 64px; height: 64px;
    border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);
  }
  .vphoto-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .vphoto-thumb-label {
    position: absolute; bottom: 0; left: 0; right: 0;
    font-size: 9px; font-weight: 700; text-align: center;
    background: rgba(0,0,0,0.6); color: #fff; padding: 2px 0; line-height: 1.2;
  }
  .vphoto-thumb-x {
    position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
    border-radius: 50%; border: none; background: rgba(220,38,38,0.9); color: #fff;
    font-size: 13px; line-height: 1; cursor: pointer; padding: 0;
  }

  .vphoto-controls {
    flex: 0 0 auto; padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    background: #0a1352; display: flex; flex-direction: column; align-items: center; gap: 14px;
  }
  .vphoto-shutter {
    width: 72px; height: 72px; border-radius: 50%; border: 4px solid #fff;
    background: rgba(255,255,255,0.12); cursor: pointer; padding: 0;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.08s;
  }
  .vphoto-shutter:active { transform: scale(0.92); }
  .vphoto-shutter:disabled { opacity: 0.4; cursor: not-allowed; }
  .vphoto-shutter-ring { width: 56px; height: 56px; border-radius: 50%; background: #fff; }

  .vphoto-actions { display: flex; gap: 10px; width: 100%; }
  .vphoto-btn {
    flex: 1; height: 50px; border-radius: 13px; font-size: 15px; font-weight: 700;
    cursor: pointer; border: none;
  }
  .vphoto-btn.primary { background: #16A34A; color: #fff; }
  .vphoto-btn.primary:disabled { background: #475569; cursor: not-allowed; }
  .vphoto-btn.ghost {
    background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);
  }
  .vphoto-btn.ghost:active { background: rgba(255,255,255,0.18); }

  .vphoto-error {
    margin: auto; padding: 32px 24px; text-align: center; max-width: 320px;
  }
  .vphoto-error-icon { font-size: 44px; margin-bottom: 12px; }
  .vphoto-error-msg { font-size: 15px; line-height: 1.6; color: #CBD5E1; margin-bottom: 24px; }
  .vphoto-error-actions { display: flex; gap: 10px; }
`;
