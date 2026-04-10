/**
 * POST /api/v1/ocr/plate
 * 번호판 OCR — Plate Recognizer API
 * 
 * Body: { image: string }  ← base64 (data URL 또는 순수 base64)
 * 응답: { plate, last4, candidates, score }
 * 
 * 권한: OPERATE (crew 이상, field_member 제외)
 * ⚠️ 기존 /api/ocr/plate 는 그대로 유지 (v1과 별도)
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

// ── 번호판 포맷팅 ──

/**
 * 포맷 규칙:
 *   신형 3+*+4 → "123* 4567"
 *   구형 2+*+4 → "12* 3456"
 *   폴백 → 뒤4자리 앞 공백
 */
function formatPlate(masked: string): string {
  if (masked.includes(' ')) return masked;
  const clean = masked.replace(/\s/g, '');

  const m7 = clean.match(/^(\d{3}\*?)(\d{4})$/);
  if (m7) return `${m7[1]} ${m7[2]}`;

  const m6 = clean.match(/^(\d{2}\*?)(\d{4})$/);
  if (m6) return `${m6[1]} ${m6[2]}`;

  if (clean.length >= 6) {
    return `${clean.slice(0, -4)} ${clean.slice(-4)}`;
  }

  return clean;
}

/**
 * Plate Recognizer 응답 → 숫자 추출 + 한글/알파벳 → * 치환
 * "120A6041" → "120*6041" → "120* 6041"
 */
function extractAndMask(raw: string): string {
  const masked = raw.replace(/[A-Za-z가-힣]/g, '*');
  const collapsed = masked.replace(/\*+/g, '*');
  return formatPlate(collapsed);
}

/** 뒤 4자리 숫자 추출 */
function extractLast4(plate: string): string {
  const digits = plate.replace(/[^0-9]/g, '');
  return digits.slice(-4);
}

export async function POST(request: NextRequest) {
  // crew 이상만 OCR 가능 (field_member 제외)
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  // field_member는 입차/출차 접근 불가
  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 OCR 기능을 사용할 수 없습니다');
  }

  try {
    const body = await request.json();

    if (!body?.image) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'image 필드가 없습니다');
    }

    // data URL → 순수 base64
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, '');

    if (base64.length < 1000) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '이미지가 너무 작습니다. 다시 촬영해주세요');
    }

    // Plate Recognizer API 호출
    const apiKey = process.env.PLATE_RECOGNIZER_API_KEY;
    if (!apiKey) {
      console.error('[v1/ocr/plate] PLATE_RECOGNIZER_API_KEY 환경변수 없음');
      return serverError('OCR 설정 오류');
    }

    const imageBuffer = Buffer.from(base64, 'base64');
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('upload', blob, 'plate.jpg');
    formData.append('regions', 'kr');

    const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[v1/ocr/plate] Plate Recognizer 오류:', response.status, errText);
      return serverError('번호판 인식 서비스 오류');
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      return ok({
        plate: null,
        last4: null,
        candidates: [],
        score: 0,
        recognized: false,
      });
    }

    // 최고 점수 결과
    const best = results.reduce((a: any, b: any) =>
      (a.score || 0) > (b.score || 0) ? a : b
    );

    const rawPlate = (best.plate || '').toUpperCase();

    if (!rawPlate || rawPlate.length < 5) {
      return ok({
        plate: null,
        last4: null,
        candidates: [],
        score: best.score || 0,
        recognized: false,
      });
    }

    const plate = extractAndMask(rawPlate);
    const last4 = extractLast4(plate);

    // 후보 결과
    const candidates = results
      .filter((r: any) => r.plate !== best.plate)
      .map((r: any) => extractAndMask((r.plate || '').toUpperCase()))
      .filter((p: string) => p.length >= 5)
      .slice(0, 3);

    return ok({
      plate,
      last4,
      candidates,
      score: best.score,
      recognized: true,
    });
  } catch (err) {
    console.error('[v1/ocr/plate] 서버 오류:', err);
    return serverError('번호판 인식 중 오류가 발생했습니다');
  }
}
