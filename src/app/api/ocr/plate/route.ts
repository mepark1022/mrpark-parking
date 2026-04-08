import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// Plate Recognizer ALPR API
// 기존 Google Cloud Vision OCR → Plate Recognizer 전환
// 한국 번호판 전용 최적화 (region: kr)
// ─────────────────────────────────────────────

// 번호판 포맷 정규화 (뒤 4자리 앞에 공백)
function formatPlate(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, "");

  // 신형 123가4567
  const newType = cleaned.match(/^(\d{3}[가-힣])(\d{4})$/);
  if (newType) return `${newType[1]} ${newType[2]}`;

  // 구형 서울12가3456
  const oldType = cleaned.match(/^([가-힣]{2}\d{2}[가-힣])(\d{4})$/);
  if (oldType) return `${oldType[1]} ${oldType[2]}`;

  // 이륜/전기차 12가3456
  const motoType = cleaned.match(/^(\d{2}[가-힣])(\d{4})$/);
  if (motoType) return `${motoType[1]} ${motoType[2]}`;

  return cleaned;
}

// ─────────────────────────────────────────────
// Plate Recognizer API 호출
// ─────────────────────────────────────────────
interface PlateResult {
  plate: string;
  score: number;
  candidates: string[];
}

async function callPlateRecognizer(base64Image: string): Promise<PlateResult | null> {
  const apiKey = process.env.PLATE_RECOGNIZER_API_KEY;

  if (!apiKey) {
    throw new Error("PLATE_RECOGNIZER_API_KEY 환경변수가 없습니다");
  }

  // base64 → Blob 변환
  const imageBuffer = Buffer.from(base64Image, "base64");
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });

  // multipart/form-data 전송
  const formData = new FormData();
  formData.append("upload", blob, "plate.jpg");
  formData.append("regions", "kr");

  const response = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as any)?.detail || (err as any)?.error || `HTTP ${response.status}`;
    throw new Error(`Plate Recognizer API 오류: ${msg}`);
  }

  const data = await response.json();

  console.log("[ALPR] Plate Recognizer 응답:", JSON.stringify(data));

  if (!data.results || data.results.length === 0) {
    return null;
  }

  const best = data.results[0];
  const plate = formatPlate(best.plate.toUpperCase());
  const score = best.score ?? 0;

  // 대안 후보 수집
  const candidates: string[] = [];
  if (best.candidates && Array.isArray(best.candidates)) {
    for (const cand of best.candidates.slice(1, 5)) {
      const formatted = formatPlate(cand.plate.toUpperCase());
      if (formatted !== plate) {
        candidates.push(formatted);
      }
    }
  }

  for (let i = 1; i < Math.min(data.results.length, 3); i++) {
    const formatted = formatPlate(data.results[i].plate.toUpperCase());
    if (formatted !== plate && !candidates.includes(formatted)) {
      candidates.push(formatted);
    }
  }

  return { plate, score, candidates };
}

// ─────────────────────────────────────────────
// POST /api/ocr/plate
// Body: { image: string }  ← base64 (data URL 또는 순수 base64)
// 응답 형식은 기존과 동일 (CameraOcr.tsx 호환)
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

    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    if (base64.length < 1000) {
      return NextResponse.json(
        { success: false, error: "이미지가 너무 작습니다. 다시 촬영해주세요" },
        { status: 400 }
      );
    }

    // Plate Recognizer ALPR 호출
    const result = await callPlateRecognizer(base64);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "번호판을 인식하지 못했습니다",
      });
    }

    console.log(
      `[ALPR] 인식 결과: ${result.plate} (신뢰도: ${(result.score * 100).toFixed(1)}%) 후보: ${result.candidates.join(", ") || "없음"}`
    );

    return NextResponse.json({
      success: true,
      plate: result.plate,
      candidates: result.candidates,
      score: result.score,
    });
  } catch (err: any) {
    console.error("[ALPR] 오류:", err.message);

    return NextResponse.json(
      {
        success: false,
        error: err.message ?? "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
