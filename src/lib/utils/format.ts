// @ts-nocheck
export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

export function formatCurrency(num: number): string {
  return `${formatNumber(num)}원`;
}

export function formatCurrencyShort(num: number): string {
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억원`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만원`;
  return formatCurrency(num);
}

export function formatPercent(num: number, decimals: number = 1): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

export function formatChange(current: number, previous: number): string {
  if (previous === 0) return "N/A";
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return phone;
}

export function isValidVehicleNumber(num: string): boolean {
  const clean = num.replace(/\s/g, "");
  // 기존 한글 포함: 12가2456, 123가4567
  if (/^\d{2,3}[가-힣]\d{4}$/.test(clean)) return true;
  // 신규 * 마스킹: 12*3456, 123*4567
  if (/^\d{2,3}\*\d{4}$/.test(clean)) return true;
  return false;
}

/** 차량번호 포맷: "12가2456" → "12가 2456", "123*4567" → "123* 4567" */
export function fmtPlate(plate: string | null | undefined): string {
  if (!plate) return "";
  const clean = plate.replace(/\s/g, "");
  // * 마스킹 형식: "123*4567" → "123* 4567"
  if (clean.includes("*")) {
    return clean.replace(/(\*)(\d)/, "$1 $2");
  }
  // 기존 한글 형식
  return clean.replace(/([가-힣])(\d)/, "$1 $2");
}

/** 차량번호를 앞부분/뒷부분으로 분리: "12가2456" → ["12가", "2456"], "123*4567" → ["123*", "4567"] */
export function splitPlate(plate: string | null | undefined): [string, string] {
  if (!plate) return ["", ""];
  const clean = plate.replace(/\s/g, "");
  // * 마스킹 형식
  const maskMatch = clean.match(/^(.*\*)(\d+)$/);
  if (maskMatch) return [maskMatch[1], maskMatch[2]];
  // 기존 한글 형식
  const match = clean.match(/^(.*[가-힣])(\d+)$/);
  if (match) return [match[1], match[2]];
  return [clean, ""];
}

/**
 * 차량번호에서 숫자만 추출 (월주차 매칭용)
 * "120서 6041" → "1206041"
 * "120* 6041" → "1206041"
 * 기존 한글 데이터와 신규 * 데이터 간 비교에 사용
 */
export function extractDigits(plate: string): string {
  return plate.replace(/[^0-9]/g, "");
}