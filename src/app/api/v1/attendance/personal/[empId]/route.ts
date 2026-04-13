/**
 * 미팍 통합앱 v2 — 개인 근태 분석 API (Part 11A)
 * GET /api/v1/attendance/personal/:empId?year=2026&month=04
 *
 * 권한: MANAGE (전체) / SELF (본인 empId만)
 *
 * 반환:
 *   - 직원 정보
 *   - 월별 근태 상세 (날짜순)
 *   - 월 집계 (출근/지각/결근 등)
 *   - 사업장별 근무 분포 (본사업장 vs 타사업장)
 *   - 근무시간 통계 (평균/최대/최소)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam, canAccessSelfOrManage } from '@/lib/api/helpers';
import {
  judgeAttendanceStatus,
  mergeByPriority,
  isInEmploymentPeriod,
  buildSummary,
  monthRange,
  validateYearMonth,
  applyOverrides,
  type AttendanceRow,
  type StaffType,
  type AttendanceOverrideRow,
} from '@/lib/api/attendance';

interface RouteParams {
  params: Promise<{ empId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'SELF');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { empId } = await params;

    // ── 1. SELF 권한 검증 ──
    if (!canAccessSelfOrManage(ctx, empId)) {
      return forbidden('본인 근태만 조회할 수 있습니다');
    }

    // ── 2. 파라미터 검증 ──
    const yearStr = getQueryParam(request, 'year');
    const monthStr = getQueryParam(request, 'month');
    const ym = validateYearMonth(yearStr, monthStr);
    if (!ym.valid) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, ym.message);
    }
    const { year, month } = ym;
    const { from, to } = monthRange(year, month);

    const supabase = await createClient();

    // ── 3. 직원 정보 ──
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('id, emp_no, name, status, hire_date, resign_date, role, position')
      .eq('org_id', ctx.orgId)
      .eq('id', empId)
      .single();

    if (empErr || !emp) {
      return notFound('직원을 찾을 수 없습니다');
    }

    // ── 4. 주 사업장 ──
    const { data: memberships } = await supabase
      .from('store_members')
      .select('store_id, is_primary, stores ( id, name )')
      .eq('org_id', ctx.orgId)
      .eq('employee_id', empId)
      .eq('is_active', true);

    const primaryStore =
      (memberships ?? []).find(m => m.is_primary)?.store_id ?? null;

    // ── 5. 해당 월 일보+근무인원 조회 ──
    const { data: reports, error: repErr } = await supabase
      .from('daily_reports')
      .select(
        `id, store_id, report_date, status,
         stores ( id, name ),
         daily_report_staff!inner (
           id, employee_id, staff_type, role,
           check_in, check_out, work_hours
         )`
      )
      .eq('org_id', ctx.orgId)
      .gte('report_date', from)
      .lte('report_date', to)
      .neq('status', 'draft')
      .eq('daily_report_staff.employee_id', empId);

    if (repErr) {
      console.error('[v1/attendance/personal] reports:', repErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    // ── 6. 근태 행 생성 (날짜별 그룹화 + 우선순위 병합) ──
    const byDate = new Map<
      string,
      Array<{
        report_id: string;
        store_id: string;
        store_name: string | null;
        staff_type: StaffType;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
        role: string | null;
      }>
    >();

    for (const r of reports ?? []) {
      const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        employee_id: string;
        staff_type: string;
        role: string | null;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
      }>;
      for (const s of staffArr) {
        if (s.employee_id !== empId) continue;
        if (!byDate.has(r.report_date)) byDate.set(r.report_date, []);
        byDate.get(r.report_date)!.push({
          report_id: r.id,
          store_id: r.store_id,
          store_name: store?.name ?? null,
          staff_type: s.staff_type as StaffType,
          check_in: s.check_in,
          check_out: s.check_out,
          work_hours: s.work_hours,
          role: s.role,
        });
      }
    }

    const rows: AttendanceRow[] = [];
    const storeDistribution = new Map<
      string,
      { store_id: string; store_name: string | null; count: number; hours: number }
    >();

    for (const [date, entries] of [...byDate.entries()].sort(([a], [b]) =>
      a < b ? -1 : 1
    )) {
      if (!isInEmploymentPeriod(date, emp.hire_date, emp.resign_date)) continue;

      const statuses = entries.map(e =>
        judgeAttendanceStatus(e.staff_type, e.store_id, primaryStore, e.check_in)
      );
      const finalStatus = mergeByPriority(statuses);
      const repIdx = statuses.findIndex(s => s === finalStatus);
      const rep = entries[repIdx >= 0 ? repIdx : 0];

      rows.push({
        employee_id: empId,
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
      });

      // 사업장 분포 집계 (출근 카운트되는 상태만)
      if (
        finalStatus === 'present' || finalStatus === 'late' ||
        finalStatus === 'peak' || finalStatus === 'support' ||
        finalStatus === 'additional'
      ) {
        const key = rep.store_id;
        if (!storeDistribution.has(key)) {
          storeDistribution.set(key, {
            store_id: key,
            store_name: rep.store_name,
            count: 0,
            hours: 0,
          });
        }
        const d = storeDistribution.get(key)!;
        d.count += 1;
        d.hours += Number(rep.work_hours ?? 0);
      }
    }

    // ── 6.5 override 조회 + 병합 ──
    const { data: overrides } = await supabase
      .from('attendance_overrides')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('employee_id', empId)
      .gte('work_date', from)
      .lte('work_date', to);
    const overrideList = (overrides ?? []) as AttendanceOverrideRow[];

    // override-only store_id 이름 보충
    const storeNameMap = new Map<string, string>();
    for (const r of rows) {
      if (r.store_id && r.store_name) storeNameMap.set(r.store_id, r.store_name);
    }
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

    // 현재 rows를 matrix 구조로 변환 후 applyOverrides
    const matrixIn: Record<string, Record<string, AttendanceRow>> = { [empId]: {} };
    for (const r of rows) matrixIn[empId][r.date] = r;
    const empMetaMap = new Map<string, { emp_no: string; name: string }>();
    empMetaMap.set(empId, { emp_no: emp.emp_no, name: emp.name });
    const merged = applyOverrides(matrixIn, overrideList, empMetaMap, storeNameMap);

    // rows/storeDistribution 재구성
    const mergedRows: AttendanceRow[] = Object.values(merged[empId] ?? {})
      .filter(r => isInEmploymentPeriod(r.date, emp.hire_date, emp.resign_date))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    storeDistribution.clear();
    for (const r of mergedRows) {
      if (
        r.status === 'present' || r.status === 'late' ||
        r.status === 'peak' || r.status === 'support' ||
        r.status === 'additional'
      ) {
        if (!r.store_id) continue;
        const key = r.store_id;
        if (!storeDistribution.has(key)) {
          storeDistribution.set(key, {
            store_id: key,
            store_name: r.store_name,
            count: 0,
            hours: 0,
          });
        }
        const d = storeDistribution.get(key)!;
        d.count += 1;
        d.hours += Number(r.work_hours ?? 0);
      }
    }

    // ── 7. 집계 ──
    const sum = buildSummary(mergedRows);

    // 근무시간 통계
    const hoursArr = mergedRows
      .map(r => Number(r.work_hours ?? 0))
      .filter(h => h > 0);
    const avgHours = hoursArr.length
      ? Math.round((hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length) * 100) / 100
      : 0;
    const maxHours = hoursArr.length ? Math.max(...hoursArr) : 0;
    const minHours = hoursArr.length ? Math.min(...hoursArr) : 0;

    return ok({
      year,
      month,
      date_from: from,
      date_to: to,
      employee: {
        id: emp.id,
        emp_no: emp.emp_no,
        name: emp.name,
        status: emp.status,
        position: emp.position,
        hire_date: emp.hire_date,
        resign_date: emp.resign_date,
        primary_store_id: primaryStore,
      },
      rows: mergedRows,
      summary: sum,
      store_distribution: [...storeDistribution.values()].sort(
        (a, b) => b.count - a.count
      ),
      hours_stats: {
        avg: avgHours,
        max: Math.round(maxHours * 100) / 100,
        min: Math.round(minHours * 100) / 100,
        total: sum.total_hours,
        days_worked: hoursArr.length,
      },
    });
  } catch (err) {
    console.error('[v1/attendance/personal] exception:', err);
    return serverError();
  }
}
