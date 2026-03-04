/**
 * 근로기준법 제60조 기반 연차일수 계산 유틸
 *
 * 규정:
 * - 1년 이상 + 출근율 80%↑ → 15일 기본
 * - 3년 이상 → 최초 1년 초과분 2년마다 +1일 (최대 25일)
 * - 1년 미만 → 월차 (별도 함수)
 *
 * 계산 예시:
 *   1년차  → 15일
 *   3년차  → 16일  (최초 1년 초과 = 2년 → +1일)
 *   5년차  → 17일
 *   7년차  → 18일
 *   ...
 *   21년차 → 25일 (상한)
 */

/**
 * 입사일 기준 해당 연도 연차일수 계산
 * @param hireDate  입사일 (YYYY-MM-DD or Date)
 * @param targetYear 계산 기준 연도 (기본: 올해)
 * @returns 법정 연차일수
 */
export function calcAnnualLeaveDays(
  hireDate: string | Date | null | undefined,
  targetYear: number = new Date().getFullYear()
): number {
  if (!hireDate) return 15; // 입사일 없으면 기본값

  const hire = new Date(hireDate);
  const yearStart = new Date(targetYear, 0, 1); // 해당 연도 1월 1일

  // 해당 연도 시작 기준 근속 연수 (년)
  const yearsWorked = targetYear - hire.getFullYear() -
    (hire > new Date(hire.getFullYear(), yearStart.getMonth(), yearStart.getDate()) ? 1 : 0);

  if (yearsWorked < 1) return 0; // 1년 미만은 월차 대상 (별도 처리)

  // 기본 15일 + 가산 (3년 이상부터 2년마다 +1일)
  // 공식: floor((근속연수 - 1) / 2) 단, 3년 이상부터 적용
  const bonus = yearsWorked >= 3
    ? Math.floor((yearsWorked - 1) / 2)
    : 0;

  return Math.min(15 + bonus, 25); // 최대 25일
}

/**
 * 근속연수 텍스트 반환
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
 * 1년 미만 월차 발생일수 계산 (근로기준법 제60조 2항)
 * 입사 후 개근한 달 수만큼 발생 (최대 11일)
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

  // 1년 이상이면 월차 아닌 연차 대상
  if (totalMonths >= 12) return 0;

  return Math.min(totalMonths, 11); // 최대 11일
}

/**
 * 근속연수별 연차 테이블 (UI 표시용)
 */
export const ANNUAL_LEAVE_TABLE = [
  { years: "1년",   days: 15 },
  { years: "2년",   days: 15 },
  { years: "3~4년", days: 16 },
  { years: "5~6년", days: 17 },
  { years: "7~8년", days: 18 },
  { years: "9~10년",days: 19 },
  { years: "11~12년",days: 20 },
  { years: "13~14년",days: 21 },
  { years: "15~16년",days: 22 },
  { years: "17~18년",days: 23 },
  { years: "19~20년",days: 24 },
  { years: "21년↑",  days: 25 },
];
