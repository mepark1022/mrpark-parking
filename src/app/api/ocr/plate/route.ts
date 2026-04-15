// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// Plate Recognizer API 기반 차량번호 인식
// 핵심: 숫자만 추출 + 한글(알파벳) → * 치환
//
// mode 옵션 (Part 19B-5A · 2026.04.15):
//   - "full" (기본) : 풀번호 + last4 모두 반환 (기존 동작 유지)
//   - "last4"       : 4자리 식별자 + 후보 4자리 배열 우선 반환
//                     (CREW v2 입차/출차 워크플로 단순화용)
// ─────────────────────────────────────────────

/**
 * 포맷 규칙:
 *   숫자7자리 (신형 3+한글+4) → "123* 4567"
 *   숫자6자리 (구형 2+한글+4) → "12* 3456"
 *   그 외 → 뒤4자리 앞 공백 삽입
 */
function formatPlate(masked: string): string {
  if (masked.includes(" ")) return masked;
  const clean = masked.replace(/\s/g, "");

  // 신형: 123*4567 → "123* 4567"
  const m7 = clean.match(/^(\d{3}\*?)(\d{4})$/);
  if (m7) return `${m7[1]} ${m7[2]}`;

  // 구형/전기차: 12*3456 → "12* 3456"
  const m6 = clean.match(/^(\d{2}\*?)(\d{4})$/);
  if (m6) return `${m6[1]} ${m6[2]}`;

  // 폴백: 뒤 4자리 앞 공백
  if (clean.length >= 6) {
    const last4 = clean.slice(-4);
    const front = clean.slice(0, -4);
    return `${front} ${last4}`;
  }

  return clean;
}

/**
 * Plate Recognizer 응답에서 숫자 추출 + 알파벳/한글 → * 치환
 * 예: "120A6041" → "120*6041" → formatPlate → "120* 6041"
 */
function extractAndMask(raw: string): string {
  // 알파벳, 한글 → *
  const masked = raw.replace(/[A-Za-z가-힣]/g, "*");
  // 연속 * 1개로 통합
  const collapsed = masked.replace(/\*+/g, "*");
  return formatPlate(collapsed);
}

/**
 * plate_last4 추출 (뒤 4자리 숫자)
 */
function extractLast4(plate: string): string {
  const digits = plate.replace(/[^0-9]/g, "");
  return digits.slice(-4);
}

// ─────────────────────────────────────────────
// POST /api/ocr/plate
// Body:
//   { image: string, mode?: "full" | "last4" }
//   - image: base64 (data URL 또는 순수 base64)
//   - mode : 응답 형식 옵션 (기본 "full", 4자리 모드는 "last4")
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.image) {
      return NextResponse.json(
        { success: false, error: "image 필드가 없습니다" },
        { status: 400 }
      );
    }

    // mode 파싱 (기본 full · 알 수 없는 값은 모두 full 처리)
    const mode: "full" | "last4" = body.mode === "last4" ? "last4" : "full";

    // data URL → 순수 base64 추출
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    if (base64.length < 1000) {
      return NextResponse.json(
        { success: false, error: "이미지가 너무 작습니다. 다시 촬영해주세요" },
        { status: 400 }
      );
    }

    // Plate Recognizer API 호출
    const apiKey = process.env.PLATE_RECOGNIZER_API_KEY;
    if (!apiKey) {
      throw new Error("PLATE_RECOGNIZER_API_KEY 환경변수가 없습니다");
    }

    // base64 → Blob → FormData
    const imageBuffer = Buffer.from(base64, "base64");
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("upload", blob, "plate.jpg");
    formData.append("regions", "kr");

    const response = await fetch(
      "https://api.platerecognizer.com/v1/plate-reader/",
      {
        method: "POST",
        headers: { Authorization: `Token ${apiKey}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[OCR] Plate Recognizer 오류:", response.status, errText);
      throw new Error(`Plate Recognizer API 오류: ${response.status}`);
    }

    const data = await response.json();

    console.log("[OCR] Plate Recognizer 응답:", JSON.stringify(data.results?.map((r: any) => ({
      plate: r.plate, score: r.score, region: r.region?.code,
    }))));

    const results = data.results || [];

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: "번호판을 인식하지 못했습니다",
      });
    }

    // 최고 점수 결과 선택
    const best = results.reduce((a: any, b: any) =>
      (a.score || 0) > (b.score || 0) ? a : b
    );

    const rawPlate = (best.plate || "").toUpperCase();
    console.log("[OCR] Raw plate:", rawPlate, "Score:", best.score);

    if (!rawPlate || rawPlate.length < 5) {
      return NextResponse.json({
        success: false,
        error: "번호판을 인식하지 못했습니다",
      });
    }

    // 숫자 추출 + * 마스킹
    const plate = extractAndMask(rawPlate);
    const last4 = extractLast4(plate);

    // 후보 결과 (마스킹된 풀번호)
    const candidates = results
      .filter((r: any) => r.plate !== best.plate)
      .map((r: any) => extractAndMask((r.plate || "").toUpperCase()))
      .filter((p: string) => p.length >= 5);

    // last4 모드 후보 — 모든 결과(최고점 포함)에서 4자리만 추출 + dedup
    let candidates_last4: string[] = [];
    if (mode === "last4") {
      const allLast4 = [last4, ...candidates.map((c: string) => extractLast4(c))]
        .filter((p) => p.length === 4);
      candidates_last4 = Array.from(new Set(allLast4)).slice(0, 5);
    }

    console.log(
      "[OCR] 최종:",
      plate,
      "| last4:",
      last4,
      "| 후보:",
      candidates,
      "| mode:",
      mode,
      mode === "last4" ? `| last4 후보: ${JSON.stringify(candidates_last4)}` : ""
    );

    return NextResponse.json({
      success: true,
      mode,
      plate,
      last4,
      candidates: candidates.slice(0, 3),
      candidates_last4, // mode === "last4"일 때만 채워짐 (full 모드는 빈 배열)
      score: best.score,
    });
  } catch (err: any) {
    console.error("[OCR] 오류:", err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
