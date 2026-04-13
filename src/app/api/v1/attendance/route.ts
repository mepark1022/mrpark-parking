/**
 * 미팍 통합앱 v2 — 근태 조회 API (Part 11A)
 * GET /api/v1/attendance?year=2026&month=04&store_id=
 *
 * 권한: MANAGE (전체) / SELF (본인만 — year+month+본인 emp_id 필터)
 *
 * 스코프:
 *   super_admin/admin → 전체 직원
 *   crew/field_member → 본인만 (ctx.employeeId)
 *
 * 반환:
 *   {
 *     year, month,
 *     employees: [{ employee_id, emp_no, name, primary_store_id, ... }],
 *     matrix: { [emp_id]: { [date]: AttendanceRow } },
 *     summary: { [emp_id]: AttendanceSummary }
 *   }
 *
 * 연동:
 *   - daily_reports + daily_report_staff JOIN
 *   - store_members → 주 사업장 판정 (타사업장 지원 감지)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam } from '@/lib/api/helpers';
import {
  judgeAttendanceStatus,
  mergeByPriority,
  isInEmploymentPeriod,
  buildSummary,
  monthRange,
  validateYearMonth,
  applyOverrides,
  type AttendanceRow,
  type AttendanceSummary,
  type StaffType,
  type AttendanceOverrideRow,
} from '@/lib/api/attendance';

export async function GET(request: NextRequest) {
  // OPERATE 이상 모두 허용 (crew/field도 본인 것은 조회 가능)
  const auth = await requireAuth(request, 'SELF');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    // ── 1. 파라미터 검증 ──
    const yearStr = getQueryParam(request, 'year');
    const monthStr = getQueryParam(request, 'month');
    const storeId = getQueryParam(request, 'store_id');

    const ym = validateYearMonth(yearStr, monthStr);
    if (!ym.valid) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, ym.message);
    }
    const { year, month } = ym;
    const { from, to } = monthRange(year, month);

    const supabase = await createClient();
    const isManage = ctx.role === 'super_admin' || ctx.role === 'admin';

    // ── 2. 직원 목록 조회 ──
    let empQuery = supabase
      .from('employees')
      .select('id, emp_no, name, status, hire_date, resign_date, role, position')
      .eq('org_id', ctx.orgId)
      .order('emp_no', { ascending: true });

    // SELF: 본인만
    if (!isManage) {
      if (!ctx.employeeId) {
        return ok({
          year, month,
          employees: [],
          matrix: {},
          summary: {},
        });
      }
      empQuery = empQuery.eq('id', ctx.employeeId);
    }

    const { data: employees, error: empErr } = await empQuery;
    if (empErr) {
      console.error('[v1/attendance] employees:', empErr.message);
      return serverError('직원 조회 중 오류가 발생했습니다');
    }
    const empList = employees ?? [];
    if (empList.length === 0) {
      return ok({ year, month, employees: [], matrix: {}, summary: {} });
    }

    const empIds = empList.map(e => e.id);

    // ── 3. 주 사업장 조회 (store_members) ──
    const { data: memberships } = await supabase
      .from('store_members')
      .select('employee_id, store_id, is_primary, is_active')
      .eq('org_id', ctx.orgId)
      .in('employee_id', empIds)
      .eq('is_active', true);

    const primaryStoreMap = new Map<string, string>();
    for (const m of memberships ?? []) {
      if (m.is_primary && m.store_id && m.employee_id) primaryStoreMap.set(m.employee_id, m.store_id);
    }

    // ── 4. 해당 월 일보+근무인원 조회 ──
    let reportQuery = supabase
      .from('daily_reports')
      .select(
        `id, store_id, report_date, status,
         stores ( id, name ),
         daily_report_staff (
           id, employee_id, staff_type, role,
           check_in, check_out, work_hours
         )`
      )
      .eq('org_id', ctx.orgId)
      .gte('report_date', from)
      .lte('report_date', to)
      .neq('status', 'draft'); // 임시저장은 제외

    if (storeId) reportQuery = reportQuery.eq('store_id', storeId);

    const { data: reports, error: repErr } = await reportQuery;
    if (repErr) {
      console.error('[v1/attendance] reports:', repErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    // ── 5. 근태 행 생성 ──
    interface RawEntry {
      date: string;
      report_id: string;
      store_id: string;
      store_name: string | null;
      staff_type: StaffType;
      check_in: string | null;
      check_out: string | null;
      work_hours: number | null;
      role: string | null;
    }

    // emp_id → date → entries[]
    const rawMap = new Map<string, Map<string, RawEntry[]>>();
    const empIdSet = new Set(empIds);
    const storeNameMap = new Map<string, string>();

    for (const r of reports ?? []) {
      const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
      if (store?.id && store?.name) storeNameMap.set(store.id, store.name);
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        employee_id: string;
        staff_type: string;
        role: string | null;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
      }>;

      for (const s of staffArr) {
        if (!empIdSet.has(s.employee_id)) continue;
        const entry: RawEntry = {
          date: r.report_date,
          report_id: r.id,
          store_id: r.store_id,
          store_name: store?.name ?? null,
          staff_type: s.staff_type as StaffType,
          check_in: s.check_in,
          check_out: s.check_out,
          work_hours: s.work_hours,
          role: s.role,
        };

        if (!rawMap.has(s.employee_id)) rawMap.set(s.employee_id, new Map());
        const byDate = rawMap.get(s.employee_id)!;
        if (!byDate.has(r.report_date)) byDate.set(r.report_date, []);
        byDate.get(r.report_date)!.push(entry);
      }
    }

    // ── 6. 매트릭스 + 집계 생성 ──
    const matrix: Record<string, Record<string, AttendanceRow>> = {};
    const summary: Record<string, AttendanceSummary> = {};
    const empOut: Array<{
      employee_id: string;
      emp_no: string;
      name: string;
      primary_store_id: string | null;
      status: string;
      position: string | null;
    }> = [];

    for (const emp of empList) {
      const primaryStore = primaryStoreMap.get(emp.id) ?? null;
      empOut.push({
        employee_id: emp.id,
        emp_no: emp.emp_no,
        name: emp.name,
        primary_store_id: primaryStore,
        status: emp.status,
        position: emp.position,
      });

      const empMatrix: Record<string, AttendanceRow> = {};
      const byDate = rawMap.get(emp.id);

      if (byDate) {
        for (const [date, entries] of byDate.entries()) {
          // 재직 기간 밖이면 스킵 (빈칸)
          if (!isInEmploymentPeriod(date, emp.hire_date, emp.resign_date)) {
            continue;
          }
          // 각 entry 상태 판정 → 우선순위 병합
          const statuses = entries.map(e =>
            judgeAttendanceStatus(e.staff_type, e.store_id, primaryStore, e.check_in)
          );
          const finalStatus = mergeByPriority(statuses);
          // 대표 entry (우선순위 일치하는 첫 번째)
          const repIdx = statuses.findIndex(s => s === finalStatus);
          const rep = entries[repIdx >= 0 ? repIdx : 0];

          const row: AttendanceRow = {
            employee_id: emp.id,
            emp_no: emp.emp_no,
            name: emp.name,
            date,
            status: finalStatus,
            check_in: rep.check_in,
            check_out: rep.check_out,
            report_id: rep.report_id,
            store_id: rep.store_id,
            store_name: rep.store_name,
            work_hours: rep.work_hours,
            staff_type: rep.staff_type,
          };
          empMatrix[date] = row;
        }
      }

      matrix[emp.id] = empMatrix;
    }

    // ── 6.5 override 조회 + 병합 ──
    let ovQ = supabase
      .from('attendance_overrides')
      .select('*')
      .eq('org_id', ctx.orgId)
      .gte('work_date', from)
      .lte('work_date', to)
      .in('employee_id', empIds);
    if (storeId) ovQ = ovQ.eq('store_id', storeId);
    const { data: overrides } = await ovQ;
    const overrideList = (overrides ?? []) as AttendanceOverrideRow[];

    // override-only store_id 이름 보충
    const missingStoreIds = new Set<string>();
    for (const ov of overrideList) {
      if (ov.store_id && !storeNameMap.has(ov.store_id)) missingStoreIds.add(ov.store_id);
    }
    if (missingStoreIds.size > 0) {
      const { data: extraStores } = await supabase
        .from('stores')
        .select('id, name')
        .eq('org_id', ctx.orgId)
        .in('id', [...missingStoreIds]);
      for (const s of extraStores ?? []) {
        if (s.id && s.name) storeNameMap.set(s.id, s.name);
      }
    }

    const empMeta = new Map<string, { emp_no: string; name: string }>();
    for (const e of empList) empMeta.set(e.id, { emp_no: e.emp_no, name: e.name });

    const mergedMatrix = applyOverrides(matrix, overrideList, empMeta, storeNameMap);

    // ── 7. 병합 후 일괄 summary 재계산 ──
    for (const emp of empList) {
      const byDate = mergedMatrix[emp.id] ?? {};
      const rowsForSummary = Object.values(byDate).filter(r =>
        isInEmploymentPeriod(r.date, emp.hire_date, emp.resign_date)
      );
      summary[emp.id] = buildSummary(rowsForSummary);
    }

    return ok({
      year,
      month,
      date_from: from,
      date_to: to,
      employees: empOut,
      matrix: mergedMatrix,
      summary,
    });
  } catch (err) {
    console.error('[v1/attendance] exception:', err);
    return serverError();
  }
}
