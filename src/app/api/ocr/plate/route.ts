// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 한국 번호판 한글 44자 (실제 번호판에 사용되는 글자만)
// [가-힣] 전체 허용 시 엉뚱한 한글도 통과 → 오답 반환 문제 방지
// ─────────────────────────────────────────────
const KR =
  "가나다라마바사아자카타파하거너더러머버서어저고노도로모보소오조구누두루무부수우주하허호";

// ─────────────────────────────────────────────
// Google Vision 한글 오인식 교정 테이블
// 번호판 전용 폰트를 일반 한글로 오인식하는 케이스 매핑
// ─────────────────────────────────────────────
const KOREAN_CORRECTION: Record<string, string> = {
  // 가 계열
  "기": "가", "개": "가", "각": "가",
  // 나 계열
  "니": "나", "내": "나",
  // 다 계열
  "디": "다", "대": "다",
  // 라 계열
  "리": "라", "래": "라",
  // 마 계열
  "미": "마", "매": "마",
  // 바 계열
  "비": "바", "배": "바",
  // 사 계열
  "시": "사", "새": "사", "세": "서",
  // 아 계열
  "이": "아", "애": "아",
  // 자 계열
  "지": "자", "재": "자",
  // 하 계열
  "히": "하", "해": "하",
  // 숫자 혼동 (Vision이 한글을 숫자로, 숫자를 한글로 오인식)
  "오": "5", // '오'를 숫자 5로 오인식하는 역방향도 있음
};

// 한글 오인식 교정 함수
function correctKorean(text: string): string {
  return text.replace(/[가-힣]/g, (ch) => KOREAN_CORRECTION[ch] ?? ch);
}

// ─────────────────────────────────────────────
// 한국 번호판 정규식 패턴 (44자 한정)
// ─────────────────────────────────────────────
const PLATE_PATTERNS = [
  // 신형 (2019~): 123가4567 — 44자만 허용
  new RegExp(`\\d{3}[${KR}]\\d{4}`),
  // 구형: 서울12가3456
  new RegExp(`[${KR}]{2}\\d{2}[${KR}]\\d{4}`),
  // 영업용/렌터카: 서울12바3456 (바사아자차카타파하)
  /[가-힣]{2}\d{2}[바사아자차카타파하]\d{4}/,
  // 이륜차/소형: 12가3456
  new RegExp(`\\d{2}[${KR}]\\d{4}`),
];

// ─────────────────────────────────────────────
// 한글 미인식 폴백: "뒤 4자리 고정" 원칙
// 한국 번호판은 항상 뒤 4자리가 숫자
//   신형: XXX + 한글 + XXXX (앞3 + 뒤4)
//   구형: XX + 한글 + XXXX  (앞2 + 뒤4)
// ─────────────────────────────────────────────
function buildFallbackCandidates(digits: string): string[] {
  const results: string[] = [];
  if (digits.length < 6) return results; // 최소 6자리 (구형 2+4)

  // 뒤 4자리는 항상 고정 (한국 번호판 불변 규칙)
  const last4 = digits.slice(-4);
  const front = digits.slice(0, -4); // 앞쪽 나머지 (한글→숫자 변환분 포함)

  // 신형 후보: 앞 3자리 (front가 3자리 이상이면)
  if (front.length >= 3) {
    results.push(`${front.slice(0, 3)}? ${last4}`);
  }
  // 구형/이륜 후보: 앞 2자리 (front가 2자리 이상이면)
  if (front.length >= 2) {
    results.push(`${front.slice(0, 2)}? ${last4}`);
  }

  return results;
}

// ─────────────────────────────────────────────
// 번호판 후보 파싱
// ─────────────────────────────────────────────
function parsePlates(texts: string[]): string[] {
  const results = new Set<string>();

  // 전체 텍스트 합치기 (분리된 토큰 합산용)
  // 교정 테이블 먼저 적용 → 오인식 한글 교정 후 패턴 매칭
  const fullText = texts.map(correctKorean).join(" ");

  for (const text of texts) {
    // 교정 테이블 적용 후 정규화
    const corrected = correctKorean(text);
    const cleaned = corrected.replace(/\s+/g, "").replace(/[^\w가-힣]/g, "");

    // 1차: 한글 포함 정규식 매칭 (44자 한정 패턴)
    for (const pattern of PLATE_PATTERNS) {
      const match = cleaned.match(pattern);
      if (match) {
        results.add(formatPlate(match[0]));
      }
    }
  }

  // 2차 폴백: 한글 미인식 시 — "뒤 4자리 고정" 원칙 적용
  if (results.size === 0) {
    // 전체 텍스트에서 숫자만 추출 (공백/특수문자 무시)
    const allDigits = fullText.replace(/[^0-9]/g, "");

    // 6~8자리 연속 숫자 블록 찾기
    const digitBlocks = allDigits.match(/\d{6,9}/g) || [];

    for (const block of digitBlocks) {
      for (const c of buildFallbackCandidates(block)) {
        results.add(c);
      }
    }

    // 연속 블록 없으면 → 공백으로 분리된 숫자 그룹 합산 시도
    if (results.size === 0) {
      // "212 9935" 또는 "2125 9935" 등 공백 분리 패턴
      const spaced = fullText.match(/\d[\d\s]{4,10}\d/g) || [];
      for (const s of spaced) {
        const digits = s.replace(/\s/g, "");
        if (digits.length >= 6 && digits.length <= 9) {
          for (const c of buildFallbackCandidates(digits)) {
            results.add(c);
          }
        }
      }
    }

    // 그래도 없으면 → 3자리+4자리 또는 2자리+4자리 분리 패턴
    if (results.size === 0) {
      const m34 = fullText.match(/\b(\d{3})\s+(\d{4})\b/);
      if (m34) results.add(`${m34[1]}? ${m34[2]}`);

      const m24 = fullText.match(/\b(\d{2})\s+(\d{4})\b/);
      if (m24) results.add(`${m24[1]}? ${m24[2]}`);
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
// 인접 블록 병합: Vision API가 번호판을 쪼개는 경우 대응
// "123" + "가" + "4567" → "123가4567" 로 재조합
// y좌표가 비슷한 블록 = 같은 줄 → x좌표 순서로 합침
// ─────────────────────────────────────────────
interface AnnotationBlock {
  text: string;
  midY: number;     // 중심 Y좌표
  minX: number;     // 좌측 X좌표 (정렬용)
  height: number;   // 블록 높이 (줄 판별 threshold)
  confidence: number; // Vision API confidence (0~1, 없으면 1)
}

function extractAnnotationBlocks(annotations: any[]): AnnotationBlock[] {
  const blocks: AnnotationBlock[] = [];

  // 첫 번째 항목은 전체 텍스트 → 건너뜀
  for (let i = 1; i < annotations.length; i++) {
    const ann = annotations[i];
    if (!ann.description || !ann.boundingPoly?.vertices) continue;

    const verts = ann.boundingPoly.vertices;
    const xs = verts.map((v: any) => v.x ?? 0);
    const ys = verts.map((v: any) => v.y ?? 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const h = maxY - minY;
    const midY = (minY + maxY) / 2;

    // confidence: Vision API가 제공하면 사용, 없으면 1.0
    const confidence = ann.confidence ?? 1.0;

    blocks.push({
      text: ann.description,
      midY,
      minX,
      height: h > 0 ? h : 20, // 높이 0 방어
      confidence,
    });
  }

  return blocks;
}

function mergeAdjacentBlocks(annotations: any[], minConfidence: number = 0.3): string[] {
  const rawBlocks = extractAnnotationBlocks(annotations);
  if (rawBlocks.length === 0) return [];

  // 1) 낮은 confidence 제거
  const blocks = rawBlocks.filter((b) => b.confidence >= minConfidence);
  console.log(
    "[OCR] Confidence 필터:",
    `${rawBlocks.length}개 → ${blocks.length}개 (threshold: ${minConfidence})`,
    rawBlocks
      .filter((b) => b.confidence < minConfidence)
      .map((b) => `"${b.text}"(${b.confidence.toFixed(2)})`)
  );

  if (blocks.length === 0) return [];

  // 2) 같은 줄 그룹핑: midY 차이가 평균 높이의 50% 이내 → 같은 줄
  // y좌표 기준 정렬 후 그룹핑
  const sorted = [...blocks].sort((a, b) => a.midY - b.midY);
  const lines: AnnotationBlock[][] = [];
  let currentLine: AnnotationBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[currentLine.length - 1];
    const curr = sorted[i];
    // 줄 판별: 두 블록의 midY 차이가 평균 높이의 50% 이내
    const avgH = (prev.height + curr.height) / 2;
    const threshold = avgH * 0.5;

    if (Math.abs(curr.midY - prev.midY) <= threshold) {
      currentLine.push(curr);
    } else {
      lines.push(currentLine);
      currentLine = [curr];
    }
  }
  lines.push(currentLine);

  // 3) 각 줄 내에서 x좌표 순서로 정렬 후 텍스트 합침
  const merged: string[] = [];
  for (const line of lines) {
    const lineBlocks = [...line].sort((a, b) => a.minX - b.minX);
    const lineText = lineBlocks.map((b) => b.text).join("");
    if (lineText.trim().length > 0) {
      merged.push(lineText);
    }
  }

  console.log("[OCR] 인접 블록 병합:", `${blocks.length}개 블록 → ${lines.length}줄`, merged);
  return merged;
}

// ─────────────────────────────────────────────
// Bounding Box 기반 번호판 영역 분석
// 한국 번호판: 가로세로 비율 약 2:1 ~ 6:1 (가로로 긴 직사각형)
// ─────────────────────────────────────────────
interface TextBlock {
  text: string;
  score: number; // 번호판 가능성 점수 (높을수록 유력)
}

function scoreTextBlock(text: string, w: number, h: number): number {
  const aspect = w > 0 && h > 0 ? w / h : 0;
  let score = 0;

  // 1) 가로세로 비율: 번호판 비율(2.5~6.0)
  if (aspect >= 2.5 && aspect <= 6.0) {
    score += 30;
    if (aspect >= 3.0 && aspect <= 5.0) score += 15;
  } else if (aspect >= 1.5 && aspect < 2.5) {
    score += 10;
  }

  // 2) 숫자 포함 비율
  const digitRatio = (text.match(/\d/g)?.length ?? 0) / Math.max(text.length, 1);
  score += Math.round(digitRatio * 25);

  // 3) 한글 포함: 번호판에 한글 1~2자
  const koreanCount = (text.match(/[가-힣]/g) || []).length;
  if (koreanCount >= 1 && koreanCount <= 2) score += 15;

  // 4) 텍스트 길이: 7~9자
  const cleanLen = text.replace(/\s/g, "").length;
  if (cleanLen >= 6 && cleanLen <= 10) score += 15;
  else if (cleanLen >= 4 && cleanLen <= 12) score += 5;

  // 5) 번호판 정규식 직접 매칭
  const cleanText = text.replace(/\s+/g, "");
  for (const pattern of PLATE_PATTERNS) {
    if (pattern.test(cleanText)) {
      score += 50;
      break;
    }
  }

  return score;
}

function analyzeTextBlocks(annotations: any[], precomputedMergedLines?: string[]): TextBlock[] {
  if (!annotations || annotations.length === 0) return [];

  const blocks: TextBlock[] = [];

  // ── 개별 블록 점수 ──
  for (let i = 1; i < annotations.length; i++) {
    const ann = annotations[i];
    if (!ann.description || !ann.boundingPoly?.vertices) continue;

    // 낮은 confidence 블록 스킵 (0.3 미만)
    if ((ann.confidence ?? 1.0) < 0.3) continue;

    const verts = ann.boundingPoly.vertices;
    const xs = verts.map((v: any) => v.x ?? 0);
    const ys = verts.map((v: any) => v.y ?? 0);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);

    const score = scoreTextBlock(ann.description, w, h);
    blocks.push({ text: ann.description, score });
  }

  // ── 병합된 줄 텍스트도 점수 매기기 (번호판이 쪼개진 경우 대응) ──
  const mergedLines = precomputedMergedLines ?? mergeAdjacentBlocks(annotations);
  for (const lineText of mergedLines) {
    // 비율은 알 수 없으므로 aspect 점수 없이 텍스트 기반 점수만
    const score = scoreTextBlock(lineText, 0, 0);
    // 병합 보너스: 쪼개진 블록을 합쳤으므로 약간의 가산점
    if (score > 0) {
      blocks.push({ text: lineText, score: score + 5 });
    }
  }

  // 점수 내림차순 정렬 + 중복 제거
  blocks.sort((a, b) => b.score - a.score);

  // 동일 텍스트 중복 제거 (원본 vs 병합 결과가 같을 수 있음)
  const seen = new Set<string>();
  const unique: TextBlock[] = [];
  for (const b of blocks) {
    const key = b.text.replace(/\s+/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(b);
    }
  }

  return unique;
}

// ─────────────────────────────────────────────
// Google Vision API 호출 (bounding box 포함)
// ─────────────────────────────────────────────
async function callGoogleVision(base64Image: string): Promise<{ texts: string[]; prioritized: string[] }> {
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
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 5 },
            ],
            imageContext: {
              languageHints: ["ko", "ko-KR"], // 한국어 우선 인식
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true,
              },
            },
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

  // 기존 방식: fullText + 개별 텍스트 블록 수집
  const texts: string[] = [];

  if (annotations?.fullTextAnnotation?.text) {
    texts.push(annotations.fullTextAnnotation.text);
  }

  if (annotations?.textAnnotations) {
    for (const ann of annotations.textAnnotations) {
      if (ann.description) texts.push(ann.description);
    }
  }

  // 인접 블록 병합 줄도 texts에 추가 (폴백에서 활용)
  const mergedLines = mergeAdjacentBlocks(annotations?.textAnnotations ?? []);
  for (const line of mergedLines) {
    texts.push(line);
  }

  // Bounding box 분석: 번호판 영역 우선순위 텍스트 (병합 줄 재사용)
  const blocks = analyzeTextBlocks(annotations?.textAnnotations ?? [], mergedLines);
  const prioritized = blocks
    .filter((b) => b.score >= 20) // 최소 점수 20 이상만
    .map((b) => b.text);

  console.log("[OCR] BBox 분석:", blocks.slice(0, 5).map((b) => `${b.text}(${b.score}점)`));
  console.log("[OCR] 병합 줄:", mergedLines);

  return { texts, prioritized };
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

    // Google Vision 호출 (bounding box 분석 포함)
    const { texts, prioritized } = await callGoogleVision(base64);

    // 1차: bounding box 기반 우선순위 텍스트에서 파싱
    let plates = parsePlates(prioritized.length > 0 ? prioritized : texts);

    // 2차: 우선순위에서 못 찾았으면 전체 텍스트로 폴백
    if (plates.length === 0 && prioritized.length > 0) {
      console.log("[OCR] BBox 우선순위 파싱 실패 → 전체 텍스트 폴백");
      plates = parsePlates(texts);
    }

    // 디버그 로그 (Vercel Function Logs에서 확인)
    console.log("[OCR] Vision API 인식 텍스트:", JSON.stringify(texts.slice(0, 5)));
    console.log("[OCR] BBox 우선순위 텍스트:", JSON.stringify(prioritized.slice(0, 5)));
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
