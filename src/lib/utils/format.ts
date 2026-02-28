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
  return /^\d{2,3}[가-힣]\d{4}$/.test(num.replace(/\s/g, ""));
}

/** 차량번호 포맷: "12가2456" → "12가 2456" (한글 뒤 공백) */
export function fmtPlate(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/\s/g, "").replace(/([가-힣])(\d)/, "$1 $2");
}