/**
 * 미팍 통합앱 v2 — 근태 판정 로직 (Part 11A)
 *
 * 핵심 규칙:
 *   1. 근태는 daily_report_staff에서 파생 (별도 테이블 없음)
 *   2. staff_type + 직원 소속 사업장 비교로 8종 상태 결정
 *   3. 동일 날짜 중복 → 우선순위 병합 (출근 > 피크 > 지원 > 추가)
 *   4. hire_date 이전 / resign_date 이후 → null (빈칸)
 *   5. 기본 근무시간 지정 (09:30 이후 체크인 = 지각)
 *
 * staff_type → AttendanceStatus 1차 매핑:
 *   regular      → present (단, 타사업장이면 support)
 *   peak         → peak
 *   support      → support
 *   part_time    → support (알바지원도 지원 카테고리)
 *   off_duty     → additional (비번투입 = 추가근무)
 *   additional   → additional
 *
 * 지각 판정:
 *   check_in > '09:30' → late (단, staff_type = regular인 경우만)
 */
import type { AttendanceStatus } from './types';

// ── 지각 판정 기준 시간 (HH:MM:SS) ──
export const LATE_THRESHOLD = '09:30:00';

// ── 우선순위 (큰 값이 우선) ──
const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  present:    100,
  late:        95,  // 지각도 출근으로 간주하므로 높게
  peak:        80,
  support:     70,
  additional:  60,
  leave:       50,
  off:         40,
  absent:      10,
};

// ── 근무유형 → 근태상태 1차 매핑 ──
export type StaffType =
  | 'regular'
  | 'peak'
  | 'support'
  | 'part_time'
  | 'off_duty'
  | 'additional';

/**
 * staff_type + 사업장 비교로 근태 상태 판정
 *
 * @param staffType - 일보의 근무유형
 * @param reportStoreId - 일보 사업장 ID
 * @param empPrimaryStoreId - 직원의 주 사업장 ID (store_members.is_primary=true)
 * @param checkIn - 출근시간 (HH:MM:SS)
 * @returns AttendanceStatus
 */
export function judgeAttendanceStatus(
  staffType: StaffType,
  reportStoreId: string,
  empPrimaryStoreId: string | null,
  checkIn: string | null
): AttendanceStatus {
  // 1차: staff_type 기반
  let status: AttendanceStatus;
  switch (staffType) {
    case 'regular':
      // 주 사업장과 다르면 지원으로 재분류
      if (empPrimaryStoreId && reportStoreId !== empPrimaryStoreId) {
        status = 'support';
      } else {
        status = 'present';
      }
      break;
    case 'peak':
      status = 'peak';
      break;
    case 'support':
    case 'part_time':
      status = 'support';
      break;
    case 'off_duty':
    case 'additional':
      status = 'additional';
      break;
    default:
      status = 'present';
  }

  // 2차: 지각 판정 (present/regular에만 적용)
  if (status === 'present' && checkIn && checkIn > LATE_THRESHOLD) {
    status = 'late';
  }

  return status;
}

/**
 * 동일 직원 + 동일 날짜 중복 근태 → 우선순위로 병합
 * @returns 우선순위 높은 1개 상태
 */
export function mergeByPriority(statuses: AttendanceStatus[]): AttendanceStatus {
  if (statuses.length === 0) return 'absent';
  let best = statuses[0];
  let bestPri = STATUS_PRIORITY[best] ?? 0;
  for (const s of statuses.slice(1)) {
    const p = STATUS_PRIORITY[s] ?? 0;
    if (p > bestPri) {
      best = s;
      bestPri = p;
    }
  }
  return best;
}

/**
 * 직원의 hire_date/resign_date 범위 내인지 확인
 * 범위 밖이면 null (빈칸 표시, "결근" 아님)
 */
export function isInEmploymentPeriod(
  date: string,
  hireDate: string | null,
  resignDate: string | null
): boolean {
  if (!hireDate) return false;
  if (date < hireDate) return false;
  if (resignDate && date > resignDate) return false;
  return true;
}

// ── 근태 행 타입 (조회 결과) ──
export interface AttendanceRow {
  employee_id: string;
  emp_no: string;
  name: string;
  date: string;                 // YYYY-MM-DD
  status: AttendanceStatus | null; // null = 범위 밖 (빈칸)
  check_in: string | null;
  check_out: string | null;
  report_id: string | null;
  store_id: string | null;
  store_name: string | null;
  work_hours: number | null;
  staff_type: StaffType | null;
}

// ── 월별 집계 타입 ──
export interface AttendanceSummary {
  weekday: number;     // 평일 출근 수
  weekend: number;     // 주말 출근 수
  additional: number;  // 추가
  peak: number;        // 피크
  support: number;     // 지원
  key: number;         // 키(🔑) 담당 — role='key' 집계
  holiday: number;     // 공휴일 출근
  late: number;        // 지각
  absent: number;      // 결근
  leave: number;       // 연차
  off: number;         // 휴무
  total: number;       // 총 출근일 (present+late+peak+support+additional)
  total_hours: number; // 총 근무시간
}

/**
 * 빈 요약 객체 생성
 */
export function emptySummary(): AttendanceSummary {
  return {
    weekday: 0, weekend: 0, additional: 0, peak: 0, support: 0,
    key: 0, holiday: 0, late: 0, absent: 0, leave: 0, off: 0,
    total: 0, total_hours: 0,
  };
}

/**
 * 주말 여부 (토=6, 일=0)
 */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * 근태 행 배열 → 월 집계 계산
 * @param rows - 근태 행 (동일 직원의 월 데이터)
 * @param holidays - 공휴일 YYYY-MM-DD 배열 (선택)
 */
export function buildSummary(
  rows: AttendanceRow[],
  holidays: string[] = []
): AttendanceSummary {
  const sum = emptySummary();
  const holidaySet = new Set(holidays);

  for (const r of rows) {
    if (!r.status) continue;
    const weekend = isWeekend(r.date);
    const holiday = holidaySet.has(r.date);

    switch (r.status) {
      case 'present':
        if (holiday) sum.holiday++;
        else if (weekend) sum.weekend++;
        else sum.weekday++;
        sum.total++;
        break;
      case 'late':
        sum.late++;
        if (holiday) sum.holiday++;
        else if (weekend) sum.weekend++;
        else sum.weekday++;
        sum.total++;
        break;
      case 'peak':
        sum.peak++;
        sum.total++;
        break;
      case 'support':
        sum.support++;
        sum.total++;
        break;
      case 'additional':
        sum.additional++;
        sum.total++;
        break;
      case 'absent':
        sum.absent++;
        break;
      case 'leave':
        sum.leave++;
        break;
      case 'off':
        sum.off++;
        break;
    }

    // 키 담당 집계
    if (r.status !== 'absent' && r.status !== 'off' && r.status !== 'leave') {
      // role 정보는 별도로 집계 (호출부에서 처리)
    }

    // 근무시간 합계
    if (r.work_hours) sum.total_hours += Number(r.work_hours);
  }

  // 소수점 2자리 반올림
  sum.total_hours = Math.round(sum.total_hours * 100) / 100;

  return sum;
}

/**
 * YYYY-MM 파라미터 → date_from, date_to (월 시작/끝)
 */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0');
  const from = `${year}-${mm}-01`;
  // 월 마지막 날 계산
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/**
 * year/month 쿼리 파라미터 검증
 */
export function validateYearMonth(
  yearStr: string | null,
  monthStr: string | null
): { valid: true; year: number; month: number } | { valid: false; message: string } {
  if (!yearStr || !monthStr) {
    return { valid: false, message: 'year, month 파라미터가 필요합니다' };
  }
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { valid: false, message: 'year 값이 올바르지 않습니다 (2020~2100)' };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { valid: false, message: 'month 값이 올바르지 않습니다 (1~12)' };
  }
  return { valid: true, year, month };
}

// ============================================================
// Part 11B — Override 병합 유틸
// ============================================================

/**
 * 근태 오버라이드 행 (attendance_overrides 테이블)
 */
export interface AttendanceOverrideRow {
  id: string;
  org_id: string;
  employee_id: string;
  work_date: string;          // YYYY-MM-DD
  status: AttendanceStatus;
  store_id: string | null;
  check_in: string | null;    // HH:MM:SS
  check_out: string | null;
  work_hours: number | null;
  reason: string | null;
  memo: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 매트릭스에 override를 덮어쓴다
 *
 * @param matrix - 직원별 날짜별 근태 행 (daily_reports 기반)
 * @param overrides - attendance_overrides 행 배열
 * @param empMeta - 직원 메타 (emp_no, name) — override만 있고 일보 없을 때 채우기용
 * @param storeNameMap - store_id → store_name (override의 store_id 라벨링용)
 * @returns 덮어쓴 매트릭스 (원본 미변형, 얕은 복제)
 */
export function applyOverrides(
  matrix: Record<string, Record<string, AttendanceRow>>,
  overrides: AttendanceOverrideRow[],
  empMeta: Map<string, { emp_no: string; name: string }>,
  storeNameMap: Map<string, string>
): Record<string, Record<string, AttendanceRow>> {
  // 얕은 복제
  const result: Record<string, Record<string, AttendanceRow>> = {};
  for (const [empId, byDate] of Object.entries(matrix)) {
    result[empId] = { ...byDate };
  }

  for (const ov of overrides) {
    const meta = empMeta.get(ov.employee_id);
    if (!result[ov.employee_id]) result[ov.employee_id] = {};

    const existing = result[ov.employee_id][ov.work_date];
    const storeName = ov.store_id ? (storeNameMap.get(ov.store_id) ?? null) : null;

    result[ov.employee_id][ov.work_date] = {
      employee_id: ov.employee_id,
      emp_no: meta?.emp_no ?? existing?.emp_no ?? '',
      name: meta?.name ?? existing?.name ?? '',
      date: ov.work_date,
      status: ov.status,
      check_in: ov.check_in ?? existing?.check_in ?? null,
      check_out: ov.check_out ?? existing?.check_out ?? null,
      report_id: existing?.report_id ?? null,
      store_id: ov.store_id ?? existing?.store_id ?? null,
      store_name: storeName ?? existing?.store_name ?? null,
      work_hours: ov.work_hours ?? existing?.work_hours ?? null,
      staff_type: existing?.staff_type ?? null,
    };
  }

  return result;
}

/**
 * 근태 상태 코드 유효성 검사
 */
export function isValidAttendanceStatus(s: unknown): s is AttendanceStatus {
  return (
    typeof s === 'string' &&
    ['present','late','peak','support','additional','leave','off','absent'].includes(s)
  );
}

/**
 * 시간 정규화 HH:MM → HH:MM:SS (이미 HH:MM:SS면 그대로)
 * 유효하지 않으면 null
 */
export function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

/**
 * YYYY-MM-DD 형식 검증
 */
export function isValidDate(d: unknown): d is string {
  if (typeof d !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(d + 'T00:00:00');
  return !isNaN(dt.getTime());
}
