/**
 * 미팍 통합앱 v2 — 근태 이상감지 API (Part 11A)
 * GET /api/v1/attendance/anomaly?year=2026&month=04&store_id=
 *
 * 권한: MANAGE
 *
 * 감지 항목:
 *   1. MISSING_REPORT   — 일보 미제출 날짜 (사업장별)
 *   2. ZERO_STAFF       — 일보 제출됐는데 근무인원 0명
 *   3. DUPLICATE_STORE  — 동일 직원이 같은 날 2개 이상 사업장에서 근무 (정상일 수 있으나 확인 필요)
 *   4. LATE             — 지각 (09:30 이후 체크인)
 *   5. NO_CHECKOUT      — 출근 기록 있으나 퇴근 시간 미입력
 *   6. LONG_HOURS       — 12시간 초과 근무
 *   7. ABNORMAL_HOURS   — 근무시간이 0 또는 음수
 *
 * 각 감지 항목별 건수 + 상세 리스트 반환 (최대 각 100건)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam } from '@/lib/api/helpers';
import {
  monthRange,
  validateYearMonth,
  LATE_THRESHOLD,
} from '@/lib/api/attendance';

const MAX_ITEMS_PER_TYPE = 100;
const LONG_HOURS_THRESHOLD = 12;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    // ── 1. 파라미터 검증 ──
    const yearStr = getQueryParam(request, 'year');
    const monthStr = getQueryParam(request, 'month');
    const storeIdFilter = getQueryParam(request, 'store_id');
    const ym = validateYearMonth(yearStr, monthStr);
    if (!ym.valid) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, ym.message);
    }
    const { year, month } = ym;
    const { from, to } = monthRange(year, month);

    const supabase = await createClient();

    // ── 2. 활성 사업장 목록 ──
    let storeQuery = supabase
      .from('stores')
      .select('id, name')
      .eq('org_id', ctx.orgId);
    if (storeIdFilter) storeQuery = storeQuery.eq('id', storeIdFilter);

    const { data: stores, error: storeErr } = await storeQuery;
    if (storeErr) {
      console.error('[v1/attendance/anomaly] stores:', storeErr.message);
      return serverError('사업장 조회 중 오류가 발생했습니다');
    }
    const storeList = stores ?? [];
    const storeMap = new Map(storeList.map(s => [s.id, s.name]));

    // ── 3. 해당 월 일보 + 근무인원 조회 ──
    let repQuery = supabase
      .from('daily_reports')
      .select(
        `id, store_id, report_date, status,
         daily_report_staff (
           id, employee_id, staff_type, role,
           check_in, check_out, work_hours,
           employees ( id, emp_no, name )
         )`
      )
      .eq('org_id', ctx.orgId)
      .gte('report_date', from)
      .lte('report_date', to)
      .neq('status', 'draft');
    if (storeIdFilter) repQuery = repQuery.eq('store_id', storeIdFilter);

    const { data: reports, error: repErr } = await repQuery;
    if (repErr) {
      console.error('[v1/attendance/anomaly] reports:', repErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    const reportList = reports ?? [];

    // ── 4. 감지 ──

    // 4-1. MISSING_REPORT: 일보 미제출 (사업장 × 날짜)
    const submittedSet = new Set<string>(); // `${store_id}|${date}`
    for (const r of reportList) {
      submittedSet.add(`${r.store_id}|${r.report_date}`);
    }
    const missingReports: Array<{
      store_id: string;
      store_name: string | null;
      date: string;
    }> = [];
    const monthDays = new Date(year, month, 0).getDate();
    outer: for (const s of storeList) {
      for (let d = 1; d <= monthDays; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (ds < from || ds > to) continue;
        // 오늘 이후 날짜는 제외
        const today = new Date().toISOString().slice(0, 10);
        if (ds > today) continue;
        if (!submittedSet.has(`${s.id}|${ds}`)) {
          missingReports.push({ store_id: s.id, store_name: s.name, date: ds });
          if (missingReports.length >= MAX_ITEMS_PER_TYPE) break outer;
        }
      }
    }

    // 4-2. ZERO_STAFF: 일보는 있으나 근무인원 0명
    const zeroStaff: Array<{
      report_id: string;
      store_id: string;
      store_name: string | null;
      date: string;
      status: string;
    }> = [];
    for (const r of reportList) {
      const staffArr = (r.daily_report_staff ?? []) as unknown[];
      if (staffArr.length === 0) {
        zeroStaff.push({
          report_id: r.id,
          store_id: r.store_id,
          store_name: storeMap.get(r.store_id) ?? null,
          date: r.report_date,
          status: r.status,
        });
        if (zeroStaff.length >= MAX_ITEMS_PER_TYPE) break;
      }
    }

    // 4-3. DUPLICATE_STORE: 같은 날 2개 이상 사업장 근무한 직원
    //      (지원근무는 정상일 수 있으나 확인 필요)
    // emp_id|date → set<store_id>
    const empDateStores = new Map<string, Set<string>>();
    interface StaffRow {
      report_id: string;
      employee_id: string;
      emp_no: string;
      name: string;
      staff_type: string;
      check_in: string | null;
      check_out: string | null;
      work_hours: number | null;
      store_id: string;
      store_name: string | null;
      date: string;
    }
    const allStaffRows: StaffRow[] = [];

    for (const r of reportList) {
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        id: string;
        employee_id: string;
        staff_type: string;
        role: string | null;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
        employees: { id: string; emp_no: string; name: string } | { id: string; emp_no: string; name: string }[] | null;
      }>;
      for (const s of staffArr) {
        const empInfo = Array.isArray(s.employees) ? s.employees[0] : s.employees;
        if (!empInfo) continue;
        const key = `${s.employee_id}|${r.report_date}`;
        if (!empDateStores.has(key)) empDateStores.set(key, new Set());
        empDateStores.get(key)!.add(r.store_id);

        allStaffRows.push({
          report_id: r.id,
          employee_id: s.employee_id,
          emp_no: empInfo.emp_no,
          name: empInfo.name,
          staff_type: s.staff_type,
          check_in: s.check_in,
          check_out: s.check_out,
          work_hours: s.work_hours,
          store_id: r.store_id,
          store_name: storeMap.get(r.store_id) ?? null,
          date: r.report_date,
        });
      }
    }

    const duplicateStore: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      date: string;
      store_ids: string[];
      store_names: string[];
    }> = [];
    for (const [key, storeSet] of empDateStores.entries()) {
      if (storeSet.size < 2) continue;
      const [empId, date] = key.split('|');
      const sample = allStaffRows.find(r => r.employee_id === empId && r.date === date);
      if (!sample) continue;
      duplicateStore.push({
        employee_id: empId,
        emp_no: sample.emp_no,
        name: sample.name,
        date,
        store_ids: [...storeSet],
        store_names: [...storeSet].map(id => storeMap.get(id) ?? '알수없음'),
      });
      if (duplicateStore.length >= MAX_ITEMS_PER_TYPE) break;
    }

    // 4-4. LATE: 지각
    const lateList: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      date: string;
      store_id: string;
      store_name: string | null;
      check_in: string;
    }> = [];
    for (const s of allStaffRows) {
      if (s.staff_type !== 'regular') continue;
      if (!s.check_in) continue;
      if (s.check_in > LATE_THRESHOLD) {
        lateList.push({
          employee_id: s.employee_id,
          emp_no: s.emp_no,
          name: s.name,
          date: s.date,
          store_id: s.store_id,
          store_name: s.store_name,
          check_in: s.check_in,
        });
        if (lateList.length >= MAX_ITEMS_PER_TYPE) break;
      }
    }

    // 4-5. NO_CHECKOUT: 출근 있으나 퇴근 없음 (오늘 이전 날짜만)
    const today = new Date().toISOString().slice(0, 10);
    const noCheckout: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      date: string;
      store_id: string;
      store_name: string | null;
      check_in: string;
    }> = [];
    for (const s of allStaffRows) {
      if (!s.check_in) continue;
      if (s.check_out) continue;
      if (s.date >= today) continue; // 오늘은 아직 퇴근 안 했을 수 있음
      noCheckout.push({
        employee_id: s.employee_id,
        emp_no: s.emp_no,
        name: s.name,
        date: s.date,
        store_id: s.store_id,
        store_name: s.store_name,
        check_in: s.check_in,
      });
      if (noCheckout.length >= MAX_ITEMS_PER_TYPE) break;
    }

    // 4-6. LONG_HOURS: 12시간 초과
    const longHours: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      date: string;
      store_id: string;
      store_name: string | null;
      work_hours: number;
    }> = [];
    for (const s of allStaffRows) {
      const h = Number(s.work_hours ?? 0);
      if (h > LONG_HOURS_THRESHOLD) {
        longHours.push({
          employee_id: s.employee_id,
          emp_no: s.emp_no,
          name: s.name,
          date: s.date,
          store_id: s.store_id,
          store_name: s.store_name,
          work_hours: h,
        });
        if (longHours.length >= MAX_ITEMS_PER_TYPE) break;
      }
    }

    // 4-7. ABNORMAL_HOURS: 0 또는 음수 (입력은 됐으나 값 이상)
    const abnormalHours: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      date: string;
      store_id: string;
      store_name: string | null;
      work_hours: number | null;
    }> = [];
    for (const s of allStaffRows) {
      if (s.work_hours === null || s.work_hours === undefined) continue;
      const h = Number(s.work_hours);
      if (h <= 0) {
        abnormalHours.push({
          employee_id: s.employee_id,
          emp_no: s.emp_no,
          name: s.name,
          date: s.date,
          store_id: s.store_id,
          store_name: s.store_name,
          work_hours: s.work_hours,
        });
        if (abnormalHours.length >= MAX_ITEMS_PER_TYPE) break;
      }
    }

    return ok({
      year,
      month,
      date_from: from,
      date_to: to,
      store_id: storeIdFilter ?? null,
      summary: {
        missing_report: missingReports.length,
        zero_staff: zeroStaff.length,
        duplicate_store: duplicateStore.length,
        late: lateList.length,
        no_checkout: noCheckout.length,
        long_hours: longHours.length,
        abnormal_hours: abnormalHours.length,
      },
      anomalies: {
        missing_report: missingReports,
        zero_staff: zeroStaff,
        duplicate_store: duplicateStore,
        late: lateList,
        no_checkout: noCheckout,
        long_hours: longHours,
        abnormal_hours: abnormalHours,
      },
      thresholds: {
        late_threshold: LATE_THRESHOLD,
        long_hours_threshold: LONG_HOURS_THRESHOLD,
        max_items_per_type: MAX_ITEMS_PER_TYPE,
      },
    });
  } catch (err) {
    console.error('[v1/attendance/anomaly] exception:', err);
    return serverError();
  }
}
