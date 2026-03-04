/**
 * 근로기준법 제60조 기반 연차일수 계산 유틸
 *
 * [입사일 기준]
 *   입사 연도         → 0일 (월차만 발생, 최대 11일)
 *   입사 다음 해~     → 15일 (1주년이 해당 연도 안에 도달)
 *   3년차~            → 2년마다 +1일 (최대 25일)
 *
 * 예) 2026.3.1 입사
 *   2026년 → 0일  (1년 미만)
 *   2027년 → 15일 (2027.3.1 = 1주년 도달)
 *   2028년 → 15일 (2년차)
 *   2029년 → 16일 (3년차, +1)
 *   2031년 → 17일 (5년차, +2)
 */

/**
 * 해당 연도 법정 연차일수
 * @param hireDate   입사일 (YYYY-MM-DD)
 * @param targetYear 계산할 연도 (기본: 올해)
 */
export function calcAnnualLeaveDays(
  hireDate: string | Date | null | undefined,
  targetYear: number = new Date().getFullYear()
): number {
  if (!hireDate) return 15;

  const hire = new Date(hireDate);
  // targetYear 내에 완성되는 근속 연수
  // 예) 2026.3.1 입사 → 2027년: 2027-2026 = 1년 (2027.3.1에 1주년)
  const yearsCompleted = targetYear - hire.getFullYear();

  if (yearsCompleted < 1) return 0;

  // 3년 이상부터 2년마다 +1일
  const bonus = yearsCompleted >= 3
    ? Math.floor((yearsCompleted - 1) / 2)
    : 0;

  return Math.min(15 + bonus, 25);
}

/**
 * 근속 상세 정보 (UI 표시용)
 */
export function getLeaveDetail(
  hireDate: string | Date | null | undefined,
  targetYear: number = new Date().getFullYear()
): { yearsCompleted: number; bonusDays: number; totalDays: number } {
  if (!hireDate) return { yearsCompleted: 0, bonusDays: 0, totalDays: 15 };
  const hire = new Date(hireDate);
  const yearsCompleted = targetYear - hire.getFullYear();
  if (yearsCompleted < 1) return { yearsCompleted: 0, bonusDays: 0, totalDays: 0 };
  const bonusDays = yearsCompleted >= 3 ? Math.floor((yearsCompleted - 1) / 2) : 0;
  return { yearsCompleted, bonusDays, totalDays: Math.min(15 + bonusDays, 25) };
}

/**
 * 근속기간 텍스트  예) "2년 3개월"
 */
export function getYearsWorkedLabel(
  hireDate: string | Date | null | undefined
): string {
  if (!hireDate) return "";
  const hire = new Date(hireDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());
  if (totalMonths < 1) return "1개월 미만";
  if (totalMonths < 12) return `${totalMonths}개월`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
}

/**
 * 1년 미만 월차 발생일수 (근로기준법 제60조 2항)
 * 개근 1개월당 1일, 최대 11일
 */
export function calcMonthlyLeaveDays(
  hireDate: string | Date | null | undefined
): number {
  if (!hireDate) return 0;
  const hire = new Date(hireDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());
  if (totalMonths >= 12) return 0;
  return Math.min(totalMonths, 11);
}

/** 근속연수별 연차일수 안내 테이블 */
export const ANNUAL_LEAVE_TABLE = [
  { years: "1~2년",   days: 15 },
  { years: "3~4년",   days: 16 },
  { years: "5~6년",   days: 17 },
  { years: "7~8년",   days: 18 },
  { years: "9~10년",  days: 19 },
  { years: "11~12년", days: 20 },
  { years: "13~14년", days: 21 },
  { years: "15~16년", days: 22 },
  { years: "17~18년", days: 23 },
  { years: "19~20년", days: 24 },
  { years: "21년↑",   days: 25 },
];
