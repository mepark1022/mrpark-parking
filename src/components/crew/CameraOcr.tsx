// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// 타입 & 상수
// ─────────────────────────────────────────────
const STATES = {
  IDLE: "idle",
  SCANNING: "scanning",       // 카메라 프리뷰 + 스캔라인
  DETECTING: "detecting",     // API 호출 중
  CONFIRMING: "confirming",   // 결과 확인 대기
  CONFIRMED: "confirmed",     // 입차 완료
} as const;

type Phase = (typeof STATES)[keyof typeof STATES];

interface OcrResult {
  success: boolean;
  plate?: string;
  candidates?: string[];
  error?: string;
}

interface CameraOcrProps {
  /** 입차 확정 시 호출 — 상위 컴포넌트에서 mepark_tickets INSERT 처리 */
  onConfirm: (plateNumber: string) => void;
  /** 취소 시 호출 */
  onCancel: () => void;
}

// ─────────────────────────────────────────────
// CameraOcr 컴포넌트
// ─────────────────────────────────────────────
export default function CameraOcr({ onConfirm, onCancel }: CameraOcrProps) {
  const [phase, setPhase] = useState<Phase>(STATES.IDLE);
  const [scanLine, setScanLine] = useState(0);
  const [detected, setDetected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [dotCount, setDotCount] = useState(1);
  const [shakeBox, setShakeBox] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState(false);
  const [manualVal, setManualVal] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 멀티프레임 캡처 진행률 (0=대기, 1~3=캡처중, 4=분석중)
  const [multiProgress, setMultiProgress] = useState(0);
  // 한글 수정 팝업 (? 감지 시)
  const [koreanEdit, setKoreanEdit] = useState(false);
  const [koreanVal, setKoreanVal] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 자동 스캔 인터벌
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoScanningRef = useRef(false); // API 중복 호출 방지

  // 자동/수동 모드 토글
  const [autoMode, setAutoMode] = useState(true);
  // 자동 스캔 시도 횟수
  const [autoAttempt, setAutoAttempt] = useState(0);

  // ── 카메라 시작 ──────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // 후면 우선, 없으면 전면/PC 웹캠 사용
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setErrorMsg("카메라 권한이 없습니다. 설정에서 허용해주세요.");
    }
  }, []);

  // ── 카메라 종료 ──────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── 현재 프레임 캡처 → base64 ────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    // 전체 이미지 전송 (크롭 없음)
    // 크롭 시 번호판 외 영역 포함되어 숫자 오인식 발생 → Vision API가 전체에서 패턴 검출
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, vw, vh);

    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  // ── Google Vision API 호출 ───────────────────
  const callOcrApi = useCallback(async (imageBase64: string): Promise<OcrResult> => {
    const res = await fetch("/api/ocr/plate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
    });
    return res.json();
  }, []);

  // ── 멀티프레임 최적 결과 선택 ─────────────────
  // 3장 OCR 결과 중 가장 신뢰도 높은 결과 선택
  // 우선순위: ① 한글 포함(? 없는) ② 다수결(2/3 동일) ③ 첫 번째 성공
  const selectBestResult = useCallback((results: OcrResult[]): { plate: string; candidates: string[] } | null => {
    const valid = results.filter((r) => r.success && r.plate);
    if (valid.length === 0) return null;

    // 한글 완전 인식된 결과 우선 (? 미포함)
    const complete = valid.filter((r) => !r.plate!.includes("?"));

    // 다수결: 가장 많이 나온 plate 선택
    const countMap = new Map<string, number>();
    const pool = complete.length > 0 ? complete : valid;
    for (const r of pool) {
      const key = r.plate!;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    // 최다 빈도 plate 찾기
    let bestPlate = "";
    let bestCount = 0;
    for (const [plate, count] of countMap) {
      if (count > bestCount) {
        bestPlate = plate;
        bestCount = count;
      }
    }

    // 모든 결과에서 후보 수집 (중복 제거)
    const allCandidates = new Set<string>();
    for (const r of valid) {
      if (r.plate && r.plate !== bestPlate) allCandidates.add(r.plate);
      for (const c of r.candidates ?? []) {
        if (c !== bestPlate) allCandidates.add(c);
      }
    }

    return {
      plate: bestPlate,
      candidates: Array.from(allCandidates).slice(0, 4),
    };
  }, []);

  // ── 자동 스캔 정지 ─────────────────────────────
  const stopAutoScan = useCallback(() => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    autoScanningRef.current = false;
    setAutoAttempt(0);
  }, []);

  // ── 자동 연속 스캔 시작 ──────────────────────────
  // 카메라 ON → 1초 대기 → 1.5초마다 1프레임 자동 분석
  // 감지 시 자동 정지, 최대 10회 시도 후 정지
  const startAutoScan = useCallback(async () => {
    setPhase(STATES.SCANNING);
    setDetected(null);
    setConfirmed(null);
    setErrorMsg(null);
    setManualInput(false);
    setManualVal("");
    setMultiProgress(0);
    setAutoAttempt(0);

    await startCamera();

    // 1초 대기 후 자동 스캔 시작
    timerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.readyState < 2) {
        setErrorMsg("카메라가 준비되지 않았습니다. 다시 시도해주세요.");
        setPhase(STATES.IDLE);
        stopCamera();
        return;
      }

      let attemptCount = 0;

      autoIntervalRef.current = setInterval(async () => {
        // API 호출 중이면 건너뛰기
        if (autoScanningRef.current) return;

        attemptCount++;
        setAutoAttempt(attemptCount);

        // 최대 10회 시도 후 자동 정지
        if (attemptCount > 10) {
          stopAutoScan();
          stopCamera();
          setErrorMsg("자동 인식에 실패했습니다. 수동 스캔 또는 직접 입력해주세요.");
          setPhase(STATES.IDLE);
          return;
        }

        autoScanningRef.current = true;

        try {
          const frame = captureFrame();
          if (!frame) {
            autoScanningRef.current = false;
            return;
          }

          const result = await callOcrApi(frame);
          console.log(`[OCR] 자동스캔 #${attemptCount}:`, result.plate ?? "미감지");

          if (result.success && result.plate) {
            // 감지 성공 → 자동 정지
            stopAutoScan();
            setDetected(result.plate);
            setCandidates(result.candidates ?? []);
            setPhase(STATES.CONFIRMING);
            stopCamera();
            // 성공 진동
            navigator.vibrate?.([100, 50, 100]);
            // ? 포함 시 한글 수정 팝업
            if (result.plate.includes("?")) {
              setKoreanVal("");
              setKoreanEdit(true);
            }
          }
        } catch {
          // API 오류 시 다음 시도로 넘어감
        } finally {
          autoScanningRef.current = false;
        }
      }, 1500);
    }, 1000);
  }, [startCamera, stopCamera, stopAutoScan, captureFrame, callOcrApi]);

  // ── 스캔 시작 (멀티프레임 3장 — 수동 모드) ─────────
  const startScan = useCallback(async () => {
    setPhase(STATES.SCANNING);
    setDetected(null);
    setConfirmed(null);
    setErrorMsg(null);
    setManualInput(false);
    setManualVal("");
    setMultiProgress(0);

    await startCamera();

    // 1.5초 대기 (카메라 안정화) → 3장 연속 캡처
    timerRef.current = setTimeout(async () => {
      // video 실제 재생 확인
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.readyState < 2) {
        setErrorMsg("카메라가 준비되지 않았습니다. 다시 시도해주세요.");
        setPhase(STATES.IDLE);
        stopCamera();
        return;
      }

      setPhase(STATES.DETECTING);
      setShakeBox(true);
      setTimeout(() => setShakeBox(false), 600);

      // 3장 연속 캡처 (300ms 간격)
      const frames: string[] = [];
      for (let i = 0; i < 3; i++) {
        setMultiProgress(i + 1);
        const frame = captureFrame();
        if (frame) frames.push(frame);
        if (i < 2) await new Promise((r) => setTimeout(r, 300));
      }

      if (frames.length === 0) {
        setErrorMsg("카메라 프레임을 가져올 수 없습니다.");
        setPhase(STATES.IDLE);
        stopCamera();
        return;
      }

      // 3장 동시 API 호출 (병렬)
      setMultiProgress(4); // 분석 중 표시
      const results = await Promise.all(
        frames.map((f) => callOcrApi(f).catch(() => ({ success: false } as OcrResult)))
      );

      console.log("[OCR] 멀티프레임 결과:", results.map((r) => r.plate ?? "실패"));

      // 최적 결과 선택
      const best = selectBestResult(results);

      if (best) {
        setDetected(best.plate);
        setCandidates(best.candidates);
        setPhase(STATES.CONFIRMING);
        stopCamera();
        // 성공 진동: 짧은 2회 (톡톡)
        navigator.vibrate?.([100, 50, 100]);
        // ? 포함 시 한글 수정 팝업 자동 표시
        if (best.plate.includes("?")) {
          setKoreanVal("");
          setKoreanEdit(true);
        }
      } else {
        // 실패 진동: 긴 1회 (부르르)
        navigator.vibrate?.([300]);
        setErrorMsg("번호판을 인식하지 못했습니다. 다시 시도해주세요.");
        setPhase(STATES.IDLE);
        stopCamera();
      }

      setMultiProgress(0);
    }, 1500);
  }, [startCamera, stopCamera, captureFrame, callOcrApi, selectBestResult]);

  // ── 확정 ─────────────────────────────────────
  const confirm = useCallback(
    (plate: string) => {
      setConfirmed(plate);
      setPhase(STATES.CONFIRMED);
    },
    []
  );

  // ── 리셋 ─────────────────────────────────────
  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopAutoScan();
    stopCamera();
    setPhase(STATES.IDLE);
    setScanLine(0);
    setDetected(null);
    setErrorMsg(null);
    setKoreanEdit(false);
    setKoreanVal("");
    setMultiProgress(0);
    setAutoAttempt(0);
  }, [stopCamera, stopAutoScan]);

  // ── 입차 완료 → 상위 컴포넌트 전달 ──────────
  const handleComplete = useCallback(() => {
    if (confirmed) onConfirm(confirmed);
  }, [confirmed, onConfirm]);

  // ── 스캔라인 애니메이션 ──────────────────────
  useEffect(() => {
    if (phase !== STATES.SCANNING && phase !== STATES.DETECTING) return;
    const id = setInterval(() => setScanLine((p) => (p >= 100 ? 0 : p + 1.2)), 18);
    return () => clearInterval(id);
  }, [phase]);

  // ── 점 애니메이션 ─────────────────────────────
  useEffect(() => {
    if (phase === STATES.IDLE || phase === STATES.CONFIRMED) return;
    const id = setInterval(() => setDotCount((p) => (p % 3) + 1), 500);
    return () => clearInterval(id);
  }, [phase]);

  // ── 언마운트 시 정리 ─────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopAutoScan();
      stopCamera();
    };
  }, [stopCamera, stopAutoScan]);

  // ─────────────────────────────────────────────
  // 스타일 계산
  // ─────────────────────────────────────────────
  const dots = "·".repeat(dotCount);

  const phaseLabel: Record<Phase, string> = {
    idle: "카메라를 번호판에 맞춰주세요",
    scanning: autoMode ? `자동 스캔 중${dots} ${autoAttempt > 0 ? `(${autoAttempt}/10)` : ""}` : `번호판 스캔 중${dots}`,
    detecting: multiProgress <= 3 ? `📸 ${multiProgress}/3 캡처${dots}` : `3장 비교 분석${dots}`,
    confirming: "인식 완료 — 확인해주세요",
    confirmed: "입차 등록 완료",
  };

  const boxBorder: Record<Phase, string> = {
    idle: "2px solid rgba(255,255,255,0.35)",
    scanning: "2px solid #F5B731",
    detecting: "2.5px solid #F5B731",
    confirming: "2.5px solid #16A34A",
    confirmed: "2.5px solid #16A34A",
  };

  const boxGlow: Record<Phase, string> = {
    idle: "none",
    scanning: "none",
    detecting: "0 0 0 4px rgba(245,183,49,0.25)",
    confirming: "0 0 0 4px rgba(22,163,74,0.25)",
    confirmed: "0 0 0 6px rgba(22,163,74,0.35)",
  };

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100vh", background: "#0d0d0d", fontFamily: "-apple-system,sans-serif", userSelect: "none", overflow: "hidden", position: "relative" }}>

      {/* 숨겨진 캔버스 (캡처용) */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 카메라 프리뷰 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1, opacity: phase === STATES.SCANNING || phase === STATES.DETECTING ? 1 : 0, transition: "opacity 0.3s" }}
      />

      {/* 헤더 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, padding: "18px 20px 14px", background: "linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: "2px solid #1A1D2B", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, background: "#F5B731" }} />
            <span style={{ fontWeight: 900, fontSize: 15, color: "#1A1D2B", position: "relative", zIndex: 1, marginTop: -3 }}>P</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>미팍<span style={{ color: "#F5B731" }}>Ticket</span></span>
          <span style={{ background: "#1428A0", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, marginLeft: 2 }}>CREW</span>
        </div>
        <button onClick={() => { reset(); onCancel(); }} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 20, color: "#fff", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>취소</button>
      </div>

      {/* 배경 그리드 (카메라 꺼진 상태) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(ellipse at 50% 45%,#1a1a2e,#0d0d0d)" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* 뷰파인더 오버레이 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 30%", background: "rgba(0,0,0,0.6)" }} />
        <div style={{ flex: "0 0 24%", display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
          <div style={{ flex: "0 0 80%" }} />
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
        </div>
        <div style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
      </div>

      {/* 스캔 박스 */}
      <div style={{ position: "absolute", zIndex: 10, top: "25%", left: "5%", right: "5%", height: "35%", border: boxBorder[phase], borderRadius: 12, boxShadow: boxGlow[phase], transition: "border 0.3s,box-shadow 0.4s", animation: shakeBox ? "shake 0.4s ease" : "none", overflow: "hidden" }}>
        {/* 모서리 마커 */}
        {([
          { t: 0, l: 0, bTop: "3px solid #F5B731", bLeft: "3px solid #F5B731" },
          { t: 0, r: 0, bTop: "3px solid #F5B731", bRight: "3px solid #F5B731" },
          { b: 0, l: 0, bBottom: "3px solid #F5B731", bLeft: "3px solid #F5B731" },
          { b: 0, r: 0, bBottom: "3px solid #F5B731", bRight: "3px solid #F5B731" },
        ] as any[]).map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 18, height: 18, top: s.t, left: s.l, bottom: s.b, right: s.r, borderTop: s.bTop, borderLeft: s.bLeft, borderBottom: s.bBottom, borderRight: s.bRight }} />
        ))}

        {/* 스캔라인 */}
        {(phase === STATES.SCANNING || phase === STATES.DETECTING) && (
          <div style={{ position: "absolute", left: 0, right: 0, top: `${scanLine}%`, height: 2, background: "linear-gradient(to right,transparent,#F5B731 20%,#F5B731 80%,transparent)", boxShadow: "0 0 12px 3px rgba(245,183,49,0.5)" }} />
        )}

        {/* 인식된 번호판 표시 */}
        {(phase === STATES.CONFIRMING || phase === STATES.CONFIRMED) && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: "8px 28px", border: "3px solid #1A1D2B", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 6, background: "#1428A0", borderRadius: "0 0 4px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 5, fontWeight: 800 }}>대한민국</span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#1A1D2B", letterSpacing: 4, fontFamily: "monospace", marginTop: 4, display: "block" }}>{detected}</span>
            </div>
          </div>
        )}
      </div>

      {/* 상태 레이블 */}
      <div style={{ position: "absolute", zIndex: 15, top: "calc(25% - 44px)", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 20, padding: "6px 18px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase === STATES.CONFIRMED || phase === STATES.CONFIRMING ? "#16A34A" : phase === STATES.SCANNING || phase === STATES.DETECTING ? "#F5B731" : "rgba(255,255,255,0.4)" }} />
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{phaseLabel[phase]}</span>
        </div>
      </div>

      {/* 안내 문구 */}
      <div style={{ position: "absolute", zIndex: 15, top: "calc(25% + 37%)", left: 0, right: 0, display: "flex", justifyContent: "center", padding: "0 16px" }}>
        <div style={{ background: "rgba(245,183,49,0.12)", border: "1px solid rgba(245,183,49,0.35)", borderRadius: 10, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ color: "#F5B731", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
            {autoMode
              ? <>번호판에 카메라를 갖다 대면 자동 인식<br />한글은 수동 입력을 권장합니다</>
              : <>3장 연속 촬영으로 정확도를 높입니다<br />한글은 수동 입력을 권장합니다</>}
          </span>
        </div>
      </div>
      {errorMsg && phase === STATES.IDLE && (
        <div style={{ position: "absolute", zIndex: 15, top: "calc(25% + 38%)", left: "5%", right: "5%", marginTop: 12 }}>
          <div style={{ background: "rgba(220,38,38,0.15)", border: "1.5px solid rgba(220,38,38,0.5)", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
            <span style={{ color: "#fca5a5", fontSize: 13 }}>⚠️ {errorMsg}</span>
          </div>
        </div>
      )}

      {/* ── 하단 컨트롤 ── */}
      <div style={{ position: "absolute", zIndex: 20, bottom: 0, left: 0, right: 0, background: "linear-gradient(to top,rgba(0,0,0,0.92),rgba(0,0,0,0.6) 80%,transparent)", padding: "24px 24px 48px" }}>

        {/* IDLE */}
        {phase === STATES.IDLE && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {/* 자동/수동 모드 토글 */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 3, width: "100%", gap: 3 }}>
              <button onClick={() => setAutoMode(true)} style={{ flex: 1, padding: "9px 0", background: autoMode ? "#F5B731" : "transparent", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: autoMode ? "#1A1D2B" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }}>
                ⚡ 자동 스캔
              </button>
              <button onClick={() => setAutoMode(false)} style={{ flex: 1, padding: "9px 0", background: !autoMode ? "#F5B731" : "transparent", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: !autoMode ? "#1A1D2B" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }}>
                📷 수동 3장
              </button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: 0, textAlign: "center" }}>
              {autoMode
                ? "카메라를 번호판에 대면 자동 인식합니다 (최대 15초)"
                : "번호판을 중앙 박스에 맞추고 스캔하세요 (3장 자동 촬영)"}
            </p>
            <button onClick={autoMode ? startAutoScan : startScan} style={{ width: "100%", padding: "16px 0", background: "#F5B731", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, color: "#1A1D2B", cursor: "pointer" }}>
              {autoMode ? "⚡ 자동 스캔 시작" : "📷 번호판 스캔 (3장 연속)"}
            </button>
            <button onClick={() => setManualInput(true)} style={{ background: "none", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "11px 0", width: "100%", color: "rgba(255,255,255,0.65)", fontSize: 14, cursor: "pointer" }}>
              직접 입력
            </button>
          </div>
        )}

        {/* SCANNING / DETECTING */}
        {(phase === STATES.SCANNING || phase === STATES.DETECTING) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2 }}>
              <div style={{ height: "100%", borderRadius: 2, background: "#F5B731", width: autoMode
                ? `${Math.min(autoAttempt * 10, 100)}%`
                : (phase === STATES.DETECTING ? (multiProgress <= 3 ? `${multiProgress * 25}%` : "95%") : `${Math.min(scanLine * 0.6, 55)}%`),
                transition: "width 0.5s ease" }} />
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>
              {autoMode
                ? `🔍 자동 감지 중... (${autoAttempt}/10)`
                : (phase === STATES.DETECTING
                  ? (multiProgress <= 3 ? `📸 프레임 캡처 중 (${multiProgress}/3)` : "🔍 3장 비교 분석 중...")
                  : "화면을 움직이지 마세요")}
            </p>
            <button onClick={reset} style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "12px 0", width: "100%", color: "rgba(255,255,255,0.55)", fontSize: 14, cursor: "pointer" }}>
              취소
            </button>
          </div>
        )}

        {/* CONFIRMING */}
        {phase === STATES.CONFIRMING && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, margin: "0 0 2px", textAlign: "center" }}>인식된 번호판이 맞나요?</p>
            {/* ? 포함 시 한글 수정 안내 */}
            {detected?.includes("?") && (
              <div style={{ background: "rgba(245,183,49,0.15)", border: "1.5px solid rgba(245,183,49,0.4)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#F5B731", fontSize: 12 }}>⚠️ 한글 인식 실패 — 직접 입력해주세요</span>
                <button onClick={() => { setKoreanVal(""); setKoreanEdit(true); }} style={{ background: "#F5B731", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#1A1D2B", cursor: "pointer" }}>수정</button>
              </div>
            )}
            <button onClick={() => confirm(detected!)} disabled={!!detected?.includes("?")} style={{ width: "100%", padding: "15px 0", background: detected?.includes("?") ? "rgba(255,255,255,0.1)" : "#16A34A", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, color: detected?.includes("?") ? "rgba(255,255,255,0.3)" : "#fff", cursor: detected?.includes("?") ? "default" : "pointer" }}>
              ✅ {detected} — 맞습니다
            </button>
            {candidates.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {candidates.map((c) => (
                  <button key={c} onClick={() => confirm(c)} style={{ flex: 1, padding: "11px 0", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={autoMode ? startAutoScan : startScan} style={{ flex: 1, padding: "11px 0", background: "rgba(245,183,49,0.15)", border: "1.5px solid #F5B731", borderRadius: 10, color: "#F5B731", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                🔄 재스캔
              </button>
              <button onClick={() => { setManualInput(true); setPhase(STATES.IDLE); }} style={{ flex: 1, padding: "11px 0", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, color: "rgba(255,255,255,0.55)", fontSize: 13, cursor: "pointer" }}>
                ✏️ 직접입력
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMED */}
        {phase === STATES.CONFIRMED && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "rgba(22,163,74,0.15)", border: "1.5px solid rgba(22,163,74,0.5)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>✓</div>
              <div>
                <p style={{ color: "#4ade80", fontWeight: 800, fontSize: 15, margin: "0 0 2px" }}>입차 완료</p>
                <p style={{ color: "#fff", fontWeight: 900, fontSize: 22, margin: "0 0 2px", letterSpacing: 3, fontFamily: "monospace" }}>{confirmed}</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: 0 }}>{new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 입차 등록</p>
              </div>
            </div>
            {/* 입차 처리 → 상위 컴포넌트 */}
            <button onClick={handleComplete} style={{ width: "100%", padding: "15px 0", background: "#1428A0", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, color: "#fff", cursor: "pointer" }}>
              입차 등록 완료
            </button>
            <button onClick={reset} style={{ width: "100%", padding: "12px 0", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 14, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>
              + 다음 차량 스캔
            </button>
          </div>
        )}
      </div>

      {/* 한글 수정 팝업 (? 감지 시 자동 표시) */}
      {koreanEdit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: "#1a1a2e", borderRadius: "20px 20px 0 0", padding: "28px 24px 48px", border: "1.5px solid rgba(245,183,49,0.3)", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>한글 문자 입력</span>
              <button onClick={() => setKoreanEdit(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: "0 0 16px" }}>
              번호판 중간 한글을 입력해주세요 (예: 가, 나, 허 등)
            </p>

            {/* 후보 번호판이 있을 때 — 패턴 선택 먼저 */}
            {candidates.filter(c => c.includes("?")).length > 0 && (
              <div style={{ marginBottom: 16, background: "rgba(245,183,49,0.1)", border: "1.5px solid rgba(245,183,49,0.3)", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ color: "#F5B731", fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>
                  ⚠️ 번호판 자릿수를 선택해주세요
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[detected, ...candidates.filter(c => c.includes("?"))].filter(Boolean).map((cand, i) => (
                    <button key={i} onClick={() => { setDetected(cand!); setKoreanVal(""); }}
                      style={{ flex: 1, padding: "12px 6px", background: detected === cand ? "#F5B731" : "rgba(255,255,255,0.07)", border: detected === cand ? "2px solid #F5B731" : "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, color: detected === cand ? "#1A1D2B" : "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2 }}>
                      {cand?.replace("?", "□")}
                      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, fontFamily: "sans-serif", letterSpacing: 0 }}>
                        {cand === detected ? (i === 0 ? "신형(3자리)" : "구형(2자리)") : "구형(2자리)"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 현재 번호판 미리보기 */}
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 0", textAlign: "center", marginBottom: 16, fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 4 }}>
              {detected?.replace("?", koreanVal || "□")}
            </div>
            {/* 자주 쓰는 한글 빠른 선택 (한국 번호판 전체 38자) */}
            <div style={{ marginBottom: 14 }}>
              {/* 자가용 기본 (가~자) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {["가","나","다","라","마","바","사","아","자"].map(ch => (
                  <button key={ch} onClick={() => setKoreanVal(ch)} style={{ padding: "9px 0", background: koreanVal === ch ? "#F5B731" : "rgba(255,255,255,0.1)", border: koreanVal === ch ? "2px solid #F5B731" : "1.5px solid rgba(255,255,255,0.2)", borderRadius: 8, color: koreanVal === ch ? "#1A1D2B" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", minWidth: 38, flex: "1 0 38px", textAlign: "center" }}>
                    {ch}
                  </button>
                ))}
              </div>
              {/* 거~저 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {["거","너","더","러","머","버","서","어","저"].map(ch => (
                  <button key={ch} onClick={() => setKoreanVal(ch)} style={{ padding: "9px 0", background: koreanVal === ch ? "#F5B731" : "rgba(255,255,255,0.08)", border: koreanVal === ch ? "2px solid #F5B731" : "1.5px solid rgba(255,255,255,0.15)", borderRadius: 8, color: koreanVal === ch ? "#1A1D2B" : "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 700, cursor: "pointer", minWidth: 38, flex: "1 0 38px", textAlign: "center" }}>
                    {ch}
                  </button>
                ))}
              </div>
              {/* 고~조 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {["고","노","도","로","모","보","소","오","조"].map(ch => (
                  <button key={ch} onClick={() => setKoreanVal(ch)} style={{ padding: "9px 0", background: koreanVal === ch ? "#F5B731" : "rgba(255,255,255,0.08)", border: koreanVal === ch ? "2px solid #F5B731" : "1.5px solid rgba(255,255,255,0.15)", borderRadius: 8, color: koreanVal === ch ? "#1A1D2B" : "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 700, cursor: "pointer", minWidth: 38, flex: "1 0 38px", textAlign: "center" }}>
                    {ch}
                  </button>
                ))}
              </div>
              {/* 구~주 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {["구","누","두","루","무","부","수","우","주"].map(ch => (
                  <button key={ch} onClick={() => setKoreanVal(ch)} style={{ padding: "9px 0", background: koreanVal === ch ? "#F5B731" : "rgba(255,255,255,0.08)", border: koreanVal === ch ? "2px solid #F5B731" : "1.5px solid rgba(255,255,255,0.15)", borderRadius: 8, color: koreanVal === ch ? "#1A1D2B" : "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 700, cursor: "pointer", minWidth: 38, flex: "1 0 38px", textAlign: "center" }}>
                    {ch}
                  </button>
                ))}
              </div>
              {/* 렌터카/택시: 하 허 호 배 */}
              <div style={{ display: "flex", gap: 6 }}>
                {["하","허","호","배"].map(ch => (
                  <button key={ch} onClick={() => setKoreanVal(ch)} style={{ padding: "9px 0", background: koreanVal === ch ? "#F5B731" : "rgba(245,183,49,0.08)", border: koreanVal === ch ? "2px solid #F5B731" : "1.5px solid rgba(245,183,49,0.25)", borderRadius: 8, color: koreanVal === ch ? "#1A1D2B" : "#F5B731", fontSize: 15, fontWeight: 700, cursor: "pointer", minWidth: 38, width: 52, textAlign: "center" }}>
                    {ch}
                  </button>
                ))}
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, alignSelf: "center", marginLeft: 4 }}>렌터카/택시</span>
              </div>
            </div>
            {/* 직접 입력 */}
            <input
              value={koreanVal}
              onChange={(e) => setKoreanVal(e.target.value.slice(-1))}
              placeholder="한글 1자 직접 입력"
              style={{ width: "100%", padding: "12px 16px", fontSize: 18, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, color: "#fff", outline: "none", boxSizing: "border-box", textAlign: "center", marginBottom: 12 }}
            />
            <button
              onClick={() => {
                if (koreanVal) {
                  const fixed = detected?.replace("?", koreanVal) ?? "";
                  setDetected(fixed);
                  setKoreanEdit(false);
                }
              }}
              style={{ width: "100%", padding: "15px 0", background: koreanVal ? "#16A34A" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, color: koreanVal ? "#fff" : "rgba(255,255,255,0.3)", cursor: koreanVal ? "pointer" : "default" }}
            >
              ✅ 확인 — {detected?.replace("?", koreanVal || "□")}
            </button>
          </div>
        </div>
      )}

      {/* 직접 입력 모달 */}
      {manualInput && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: "#1a1a2e", borderRadius: "20px 20px 0 0", padding: "28px 24px 48px", border: "1.5px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>번호판 직접 입력</span>
              <button onClick={() => setManualInput(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <input
              value={manualVal}
              onChange={(e) => setManualVal(e.target.value)}
              placeholder="예) 123가 4567"
              style={{ width: "100%", padding: "14px 16px", fontSize: 20, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(245,183,49,0.6)", borderRadius: 12, color: "#fff", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }}
            />
            <button
              onClick={() => { if (manualVal.trim()) { confirm(manualVal.trim()); setManualInput(false); } }}
              style={{ width: "100%", marginTop: 14, padding: "15px 0", background: manualVal.trim() ? "#F5B731" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, color: manualVal.trim() ? "#1A1D2B" : "rgba(255,255,255,0.3)", cursor: manualVal.trim() ? "pointer" : "default" }}
            >
              입차 등록
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}`}</style>
    </div>
  );
}
