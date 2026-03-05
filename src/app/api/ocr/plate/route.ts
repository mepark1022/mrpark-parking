// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 한국 번호판 정규식 패턴
// ─────────────────────────────────────────────
const PLATE_PATTERNS = [
  // 신형 (2019~): 123가4567
  /\d{3}[가-힣]\d{4}/,
  // 구형: 서울12가3456
  /[가-힣]{2}\d{2}[가-힣]\d{4}/,
  // 영업용/렌터카: 서울12바3456
  /[가-힣]{2}\d{2}[바사아자차카타파하]\d{4}/,
  // 이륜차/소형: 12가3456
  /\d{2}[가-힣]\d{4}/,
];

// ─────────────────────────────────────────────
// 번호판 후보 파싱
// ─────────────────────────────────────────────
function parsePlates(texts: string[]): string[] {
  const results = new Set<string>();

  for (const text of texts) {
    // 공백/줄바꿈 제거 후 패턴 매칭
    const cleaned = text.replace(/\s+/g, "").replace(/[^\w가-힣]/g, "");

    for (const pattern of PLATE_PATTERNS) {
      const match = cleaned.match(pattern);
      if (match) {
        // 표준 형식으로 포맷: 123가 4567
        results.add(formatPlate(match[0]));
      }
    }
  }

  return Array.from(results);
}

// ─────────────────────────────────────────────
// 번호판 포맷 정규화
// 예: "123가4567" → "123가 4567"
// ─────────────────────────────────────────────
function formatPlate(raw: string): string {
  // 신형 123가4567 → 123가 4567
  const newType = raw.match(/^(\d{3}[가-힣])(\d{4})$/);
  if (newType) return `${newType[1]} ${newType[2]}`;

  // 구형 서울12가3456 → 서울12가 3456
  const oldType = raw.match(/^([가-힣]{2}\d{2}[가-힣])(\d{4})$/);
  if (oldType) return `${oldType[1]} ${oldType[2]}`;

  // 이륜차 12가3456 → 12가 3456
  const motoType = raw.match(/^(\d{2}[가-힣])(\d{4})$/);
  if (motoType) return `${motoType[1]} ${motoType[2]}`;

  return raw;
}

// ─────────────────────────────────────────────
// Google Vision API 호출
// ─────────────────────────────────────────────
async function callGoogleVision(base64Image: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY 환경변수가 없습니다");
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [
              { type: "TEXT_DETECTION", maxResults: 10 },
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 5 }, // 번호판 텍스트 정확도 향상
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Vision API 오류: ${err.error?.message ?? response.status}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0];

  if (annotations?.error) {
    throw new Error(`Vision API 응답 오류: ${annotations.error.message}`);
  }

  // fullTextAnnotation + textAnnotations 둘 다 수집
  const texts: string[] = [];

  // 전체 텍스트 (DOCUMENT_TEXT_DETECTION)
  if (annotations?.fullTextAnnotation?.text) {
    texts.push(annotations.fullTextAnnotation.text);
  }

  // 개별 텍스트 블록 (TEXT_DETECTION)
  if (annotations?.textAnnotations) {
    for (const ann of annotations.textAnnotations) {
      if (ann.description) texts.push(ann.description);
    }
  }

  return texts;
}

// ─────────────────────────────────────────────
// POST /api/ocr/plate
// Body: { image: string }  ← base64 (data URL 또는 순수 base64)
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

    // data URL 형식이면 순수 base64만 추출
    // 예: "data:image/jpeg;base64,/9j/4AAQ..." → "/9j/4AAQ..."
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    // 최소 크기 검증 (너무 작은 이미지 방어)
    if (base64.length < 1000) {
      return NextResponse.json(
        { success: false, error: "이미지가 너무 작습니다. 다시 촬영해주세요" },
        { status: 400 }
      );
    }

    // Google Vision 호출
    const texts = await callGoogleVision(base64);

    // 번호판 후보 파싱
    const plates = parsePlates(texts);

    // 디버그 로그 (Vercel Function Logs에서 확인)
    console.log("[OCR] Vision API 인식 텍스트:", JSON.stringify(texts.slice(0, 5)));
    console.log("[OCR] 파싱된 번호판:", JSON.stringify(plates));

    if (plates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "번호판을 인식하지 못했습니다",
        raw: texts.slice(0, 5), // 디버깅용
      });
    }

    // 첫 번째 = 최우선 결과, 나머지 = 후보
    return NextResponse.json({
      success: true,
      plate: plates[0],          // 메인 결과
      candidates: plates.slice(1), // 대안 후보 (UI에서 선택 가능)
    });
  } catch (err: any) {
    console.error("[OCR] 오류:", err.message);

    return NextResponse.json(
      {
        success: false,
        error: err.message ?? "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
