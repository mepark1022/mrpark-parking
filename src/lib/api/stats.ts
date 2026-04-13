/**
 * 미팍 통합앱 v2 — 통계 공용 유틸 (Part 17A)
 *
 * 기간 파싱/검증, 비교 기간 자동 계산, 결제수단 라벨 매핑.
 */

export interface DateRange {
  date_from: string; // YYYY-MM-DD
  date_to: string;
}

export interface DateRangeWithCompare extends DateRange {
  compare_from: string;
  compare_to: string;
  days: number; // 기간 길이
}

/** YYYY-MM-DD 형식 검증 */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

/**
 * 쿼리에서 date_from/date_to 추출.
 * 둘 다 없으면 이번달 1일 ~ 오늘로 기본값 적용.
 * year+month 조합이면 해당 월 1일 ~ 말일.
 */
export function parseDateRange(params: URLSearchParams): DateRange | { error: string } {
  let dateFrom = params.get('date_from')?.trim();
  let dateTo = params.get('date_to')?.trim();
  const year = params.get('year')?.trim();
  const month = params.get('month')?.trim();

  // year + month 우선 처리
  if (year && month) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || y < 2020 || y > 2100) {
      return { error: 'year는 2020~2100 사이 정수여야 합니다' };
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { error: 'month는 1~12 사이 정수여야 합니다' };
    }
    const last = new Date(y, m, 0).getDate(); // 다음달 0일 = 이번달 말일
    dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    dateTo = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  // 기본값: 이번달 1일 ~ 오늘
  if (!dateFrom || !dateTo) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    dateFrom = dateFrom || `${y}-${m}-01`;
    dateTo = dateTo || `${y}-${m}-${d}`;
  }

  if (!isValidDate(dateFrom)) return { error: 'date_from 형식이 잘못되었습니다 (YYYY-MM-DD)' };
  if (!isValidDate(dateTo)) return { error: 'date_to 형식이 잘못되었습니다 (YYYY-MM-DD)' };
  if (dateFrom > dateTo) return { error: 'date_from은 date_to보다 이전이어야 합니다' };

  return { date_from: dateFrom, date_to: dateTo };
}

/**
 * 비교 기간 계산: 동일 길이의 직전 기간.
 * 예) 2026-04-01 ~ 2026-04-13 (13일) → 2026-03-19 ~ 2026-03-31
 */
export function calcCompareRange(range: DateRange): DateRangeWithCompare {
  const from = new Date(range.date_from + 'T00:00:00Z');
  const to = new Date(range.date_to + 'T00:00:00Z');
  const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const compareTo = new Date(from.getTime());
  compareTo.setUTCDate(compareTo.getUTCDate() - 1);
  const compareFrom = new Date(compareTo.getTime());
  compareFrom.setUTCDate(compareFrom.getUTCDate() - (days - 1));

  return {
    ...range,
    compare_from: toIsoDate(compareFrom),
    compare_to: toIsoDate(compareTo),
    days,
  };
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 증감률 계산 — 기준이 0이면 null 반환 (DIV/0 방지) */
export function calcChangeRate(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10; // 소수 1자리
}

/** 결제수단 한글 라벨 */
export const PAYMENT_METHOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  card:      { label: '카드',     emoji: '💳', color: '#1428A0' },
  cash:      { label: '현금',     emoji: '💵', color: '#16a34a' },
  valet_fee: { label: '발렛료',   emoji: '🚗', color: '#F5B731' },
  monthly:   { label: '월주차',   emoji: '📅', color: '#7c3aed' },
  transfer:  { label: '계좌이체', emoji: '🏦', color: '#0891b2' },
  free:      { label: '무료',     emoji: '🎟', color: '#94a3b8' },
  other:     { label: '기타',     emoji: '📝', color: '#64748b' },
};

export const PAYMENT_METHOD_ORDER = ['card', 'cash', 'valet_fee', 'monthly', 'transfer', 'free', 'other'];
