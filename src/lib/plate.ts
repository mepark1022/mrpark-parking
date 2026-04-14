// ─────────────────────────────────────────────
// 차량 번호판 유틸리티
// 정책: Plate Recognizer 한글 마스킹(*) 적용 후 신규 데이터는 "123* 4567" 형식.
//       기존 DB에 "123가 4567" 형식이 공존하므로 숫자만 추출해 매칭한다.
// ─────────────────────────────────────────────

/**
 * 번호판에서 숫자만 추출 (한글, *, 공백, 알파벳 모두 제거)
 * "123* 4567" → "1234567"
 * "123가 4567" → "1234567"
 * "서울 12가 3456" → "123456"
 */
export function extractDigits(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/[^0-9]/g, "");
}

/**
 * 두 번호판의 숫자 부분이 일치하는지 비교 (6자리 이상일 때만 true)
 * 한글/* 마스킹 차이를 무시하고 동일 차량인지 판정
 */
export function matchPlate(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = extractDigits(a);
  const db = extractDigits(b);
  return da.length >= 6 && da === db;
}

/**
 * 표시용 포맷 — 숫자만 있는 문자열을 "123* 4567" 형식으로 변환
 * 주로 OCR 결과나 직접 입력값 정규화에 사용
 * "1234567" (7자리) → "123* 4567"
 * "123456" (6자리) → "12* 3456"
 */
export function formatMaskedPlate(digits: string): string {
  const d = extractDigits(digits);
  if (d.length === 7) return `${d.slice(0, 3)}* ${d.slice(3)}`;
  if (d.length === 6) return `${d.slice(0, 2)}* ${d.slice(2)}`;
  if (d.length >= 6) return `${d.slice(0, -4)}* ${d.slice(-4)}`;
  return d;
}

/**
 * 번호판이 유효한지 검증 (숫자 6자 이상, 한글 또는 * 마커 포함)
 */
export function isValidPlate(plate: string | null | undefined): boolean {
  if (!plate) return false;
  const n = plate.replace(/\s/g, "");
  const hasKorOrMask = /[가-힣*]/.test(n);
  const digitCount = extractDigits(n).length;
  return n.length >= 6 && hasKorOrMask && digitCount >= 4;
}
