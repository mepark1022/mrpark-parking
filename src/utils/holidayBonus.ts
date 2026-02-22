/**
 * ME.PARK 2.0 — 공휴일/주말 보너스 계산 유틸
 * 근로기준법 기준: 공휴일 근무 시 통상임금의 50% 추가 지급
 */

import { getDayType, getHolidayName } from "@/utils/holidays";

// ─── 타입 ────────────────────────────────────────────────

export type AttendanceStatus =
  | "present"   // 출근
  | "late"      // 지각
  | "absent"    // 결근
  | "dayoff"    // 휴무
  | "vacation"; // 연차

export type DayCategory = "weekday" | "weekend" | "holiday";

/** 조직 단위 보너스 정책 */
export interface BonusPolicy {
  /** 공휴일 배율 (예: 1.5 = 기본급의 150%) */
  holiday_rate: number;
  /** 주말 배율 (예: 1.0 = 추가 없음 / 1.5 = 50% 추가) */
  weekend_rate: number;
}

/** 하루 보너스 계산 결과 */
export interface DayBonusResult {
  day_category: DayCategory;
  is_holiday: boolean;
  holiday_name: string | null;
  /** 추가 수당(원) — 기본급 제외 순 추가분 */
  bonus_amount: number;
}

/** 근무자별 월간 집계 */
export interface WorkerMonthlySummary {
  worker_id: string;
  worker_name: string;
  daily_wage: number;              // 적용된 일당(원)
  total_work_days: number;         // 전체 실근무일
  holiday_work_days: number;       // 공휴일 실근무일
  weekend_work_days: number;       // 주말 실근무일
  holiday_bonus: number;           // 공휴일 수당 합계(원)
  weekend_bonus: number;           // 주말 수당 합계(원)
  total_bonus: number;             // 전체 추가 수당(원)
}

// ─── 기본 정책 ────────────────────────────────────────────

/** 근로기준법 기준 기본값 */
export const DEFAULT_BONUS_POLICY: BonusPolicy = {
  holiday_rate: 1.5,   // 공휴일 50% 추가 (8시간 이내)
  weekend_rate: 1.0,   // 주말 추가 없음 (기본 정책)
};

// ─── 핵심 함수 ────────────────────────────────────────────

/**
 * 특정 날짜 + 출근 여부 → 추가 수당 계산
 * @param dateStr "YYYY-MM-DD"
 * @param status 근태 상태
 * @param dailyWage 근무자 일당(원)
 * @param policy 보너스 정책
 */
export function calcDayBonus(
  dateStr: string,
  status: AttendanceStatus,
  dailyWage: number,
  policy: BonusPolicy = DEFAULT_BONUS_POLICY
): DayBonusResult {
  const dayType = getDayType(dateStr);
  const isHoliday = dayType === "holiday";
  const holidayName = getHolidayName(dateStr);
  const isActualWork = status === "present" || status === "late";

  let bonusAmount = 0;

  if (isActualWork && dailyWage > 0) {
    if (dayType === "holiday") {
      // 공휴일: 기본급 × (배율 - 1) = 순 추가분
      bonusAmount = Math.round(dailyWage * (policy.holiday_rate - 1));
    } else if (dayType === "weekend") {
      bonusAmount = Math.round(dailyWage * (policy.weekend_rate - 1));
    }
  }

  return {
    day_category: dayType,
    is_holiday: isHoliday,
    holiday_name: holidayName,
    bonus_amount: bonusAmount,
  };
}

/**
 * 근무자별 월간 보너스 집계
 * @param workerId 근무자 ID
 * @param workerName 근무자 이름
 * @param dailyWage 일당(원) — 0이면 일수만 카운트
 * @param attendances 해당 월 근태 기록 [{date, status}]
 * @param policy 보너스 정책
 */
export function calcWorkerMonthlyBonus(
  workerId: string,
  workerName: string,
  dailyWage: number,
  attendances: Array<{ date: string; status: AttendanceStatus }>,
  policy: BonusPolicy = DEFAULT_BONUS_POLICY
): WorkerMonthlySummary {
  let totalWorkDays = 0;
  let holidayWorkDays = 0;
  let weekendWorkDays = 0;
  let holidayBonus = 0;
  let weekendBonus = 0;

  for (const att of attendances) {
    const isWork = att.status === "present" || att.status === "late";
    if (!isWork) continue;

    totalWorkDays++;
    const result = calcDayBonus(att.date, att.status, dailyWage, policy);

    if (result.day_category === "holiday") {
      holidayWorkDays++;
      holidayBonus += result.bonus_amount;
    } else if (result.day_category === "weekend") {
      weekendWorkDays++;
      weekendBonus += result.bonus_amount;
    }
  }

  return {
    worker_id: workerId,
    worker_name: workerName,
    daily_wage: dailyWage,
    total_work_days: totalWorkDays,
    holiday_work_days: holidayWorkDays,
    weekend_work_days: weekendWorkDays,
    holiday_bonus: holidayBonus,
    weekend_bonus: weekendBonus,
    total_bonus: holidayBonus + weekendBonus,
  };
}

/**
 * 여러 근무자의 월간 보너스 일괄 계산
 */
export function calcAllWorkersBonus(
  workers: Array<{ id: string; name: string; daily_wage?: number | null }>,
  recordsByWorker: Record<string, Array<{ date: string; status: AttendanceStatus }>>,
  policy: BonusPolicy = DEFAULT_BONUS_POLICY
): WorkerMonthlySummary[] {
  return workers.map((w) =>
    calcWorkerMonthlyBonus(
      w.id,
      w.name,
      w.daily_wage ?? 0,
      recordsByWorker[w.id] ?? [],
      policy
    )
  );
}

// ─── 포맷 헬퍼 ───────────────────────────────────────────

/** 원화 포맷 (예: 120000 → "120,000원") */
export function formatWon(amount: number): string {
  if (amount === 0) return "-";
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 일당 미설정 여부 */
export function hasNoWage(dailyWage: number | null | undefined): boolean {
  return !dailyWage || dailyWage <= 0;
}
