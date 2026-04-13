/**
 * 미팍 통합앱 v2 — 사업장 근태 분석 API (Part 11A → 11C override 병합)
 * GET /api/v1/attendance/site/:storeId?year=2026&month=04
 *
 * 권한: MANAGE
 *
 * 반환:
 *   - 사업장 정보
 *   - 월 일보 제출률 (제출/전체일수)  ※ override 무관
 *   - 직원별 근무 요약 (override 병합 후, 이 사업장 소속 근무만)
 *   - 일일 인원 추이 (override 병합 후)
 *   - 전체 통계
 *
 * Part 11C 변경사항:
 *   - attendance_overrides 병합 로직 추가
 *   - store 이동/추가 override 반영 (타 사업장으로 옮겨진 날 제외, 이 사업장으로 들어온 날 포함)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, notFound, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam } from '@/lib/api/helpers';
import {
  judgeAttendanceStatus,
  monthRange,
  validateYearMonth,
  applyOverrides,
  type StaffType,
  type AttendanceRow,
  type AttendanceOverrideRow,
} from '@/lib/api/attendance';
import type { AttendanceStatus } from '@/lib/api/types';

interface RouteParams {
  params: Promise<{ storeId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { storeId } = await params;

    // ── 1. 파라미터 검증 ──
    const yearStr = getQueryParam(request, 'year');
    const monthStr = getQueryParam(request, 'month');
    const ym = validateYearMonth(yearStr, monthStr);
    if (!ym.valid) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, ym.message);
    }
    const { year, month } = ym;
    const { from, to } = monthRange(year, month);

    const supabase = await createClient();

    // ── 2. 사업장 정보 ──
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id, name')
      .eq('org_id', ctx.orgId)
      .eq('id', storeId)
      .single();

    if (storeErr || !store) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    // ── 3. 해당 사업장 소속 직원 (primary store = 이 사업장) ──
    const { data: primaryMembers } = await supabase
      .from('store_members')
      .select('employee_id, is_primary')
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .eq('is_active', true);

    const primaryEmpIds = new Set(
      (primaryMembers ?? []).filter(m => m.is_primary).map(m => m.employee_id)
    );

    // ── 4. 월 일보 조회 (해당 사업장) ──
    const { data: reports, error: repErr } = await supabase
      .from('daily_reports')
      .select(
        `id, report_date, status,
         daily_report_staff (
           id, employee_id, staff_type, role,
           check_in, check_out, work_hours,
           employees ( id, emp_no, name )
         )`
      )
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .gte('report_date', from)
      .lte('report_date', to)
      .neq('status', 'draft')
      .order('report_date', { ascending: true });

    if (repErr) {
      console.error('[v1/attendance/site] reports:', repErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    const reportList = reports ?? [];

    // ── 5. 매트릭스 빌드 (직원별 날짜별, 이 사업장의 일보 기준) ──
    const matrix: Record<string, Record<string, AttendanceRow>> = {};
    const empMetaMap = new Map<string, { emp_no: string; name: string }>();
    const storeNameMap = new Map<string, string>();
    storeNameMap.set(store.id, store.name);

    const empIdsFromReports = new Set<string>();
    const submittedDates = new Set<string>();

    for (const r of reportList) {
      submittedDates.add(r.report_date);
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        id: string;
        employee_id: string;
        staff_type: string;
        role: string | null;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
        employees:
          | { id: string; emp_no: string; name: string }
          | { id: string; emp_no: string; name: string }[]
          | null;
      }>;

      for (const s of staffArr) {
        const empInfo = Array.isArray(s.employees) ? s.employees[0] : s.employees;
        if (!empInfo) continue;

        empIdsFromReports.add(s.employee_id);
        empMetaMap.set(s.employee_id, { emp_no: empInfo.emp_no, name: empInfo.name });

        const status = judgeAttendanceStatus(
          s.staff_type as StaffType,
          storeId,
          primaryEmpIds.has(s.employee_id) ? storeId : null,
          s.check_in
        );

        if (!matrix[s.employee_id]) matrix[s.employee_id] = {};
        matrix[s.employee_id][r.report_date] = {
          employee_id: s.employee_id,
          emp_no: empInfo.emp_no,
          name: empInfo.name,
          date: r.report_date,
          status,
          check_in: s.check_in,
          check_out: s.check_out,
          report_id: r.id,
          store_id: storeId,
          store_name: store.name,
          work_hours: s.work_hours,
          staff_type: s.staff_type as StaffType,
        };
      }
    }

    // ── 5.5 override 조회 (이 사업장 관련 직원 전부) ──
    // (a) 이 사업장으로 배정된 override → 새로 투입되는 직원까지 포함
    const { data: overridesToThisStore } = await supabase
      .from('attendance_overrides')
      .select('employee_id')
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .gte('work_date', from)
      .lte('work_date', to);

    const empIdsFromOverrides = new Set(
      (overridesToThisStore ?? []).map(o => o.employee_id)
    );
    const allRelevantEmpIds = new Set([
      ...empIdsFromReports,
      ...empIdsFromOverrides,
    ]);

    // (b) 해당 직원들의 "이 기간 모든 override" (타 사업장으로 옮긴 것도 포함)
    let allOverrides: AttendanceOverrideRow[] = [];
    if (allRelevantEmpIds.size > 0) {
      const { data: overridesAll } = await supabase
        .from('attendance_overrides')
        .select('*')
        .eq('org_id', ctx.orgId)
        .in('employee_id', [...allRelevantEmpIds])
        .gte('work_date', from)
        .lte('work_date', to);
      allOverrides = (overridesAll ?? []) as AttendanceOverrideRow[];
    }

    // (c) override-only 직원 메타 보충
    const missingEmpIds = [...allRelevantEmpIds].filter(id => !empMetaMap.has(id));
    if (missingEmpIds.length > 0) {
      const { data: extraEmps } = await supabase
        .from('employees')
        .select('id, emp_no, name')
        .eq('org_id', ctx.orgId)
        .in('id', missingEmpIds);
      for (const e of extraEmps ?? []) {
        empMetaMap.set(e.id, { emp_no: e.emp_no, name: e.name });
      }
    }

    // (d) override의 store_id 이름 보충
    const missingStoreIds = new Set<string>();
    for (const ov of allOverrides) {
      if (ov.store_id && !storeNameMap.has(ov.store_id)) {
        missingStoreIds.add(ov.store_id);
      }
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

    // (e) 병합
    const merged = applyOverrides(matrix, allOverrides, empMetaMap, storeNameMap);

    // ── 6. 집계 (이 사업장 소속 근무만 카운트) ──
    interface EmpAgg {
      employee_id: string;
      emp_no: string;
      name: string;
      is_primary_here: boolean;
      days: number;
      total_hours: number;
      late_count: number;
      support_count: number;
      by_status: Partial<Record<AttendanceStatus, number>>;
    }
    const empAgg = new Map<string, EmpAgg>();
    const dailyHeadcount: Record<string, number> = {};

    const workingStatuses = new Set<AttendanceStatus>([
      'present',
      'late',
      'peak',
      'support',
      'additional',
    ]);

    for (const [empId, byDate] of Object.entries(merged)) {
      const meta = empMetaMap.get(empId);
      if (!meta) continue;

      for (const row of Object.values(byDate)) {
        // 이 사업장(storeId) 근무만 반영
        if (row.store_id !== storeId) continue;

        dailyHeadcount[row.date] = (dailyHeadcount[row.date] ?? 0) + 1;

        if (!empAgg.has(empId)) {
          empAgg.set(empId, {
            employee_id: empId,
            emp_no: meta.emp_no,
            name: meta.name,
            is_primary_here: primaryEmpIds.has(empId),
            days: 0,
            total_hours: 0,
            late_count: 0,
            support_count: 0,
            by_status: {},
          });
        }
        const a = empAgg.get(empId)!;

        if (workingStatuses.has(row.status)) {
          a.days += 1;
          a.total_hours += Number(row.work_hours ?? 0);
        }
        if (row.status === 'late') a.late_count += 1;
        if (row.status === 'support' && !a.is_primary_here) a.support_count += 1;

        a.by_status[row.status] = (a.by_status[row.status] ?? 0) + 1;
      }
    }

    // 소수점 정리 + 정렬
    const empsOut = [...empAgg.values()]
      .map(a => ({
        ...a,
        total_hours: Math.round(a.total_hours * 100) / 100,
      }))
      .sort((a, b) => {
        if (a.is_primary_here !== b.is_primary_here) {
          return a.is_primary_here ? -1 : 1;
        }
        return b.days - a.days;
      });

    // ── 7. 전체 통계 ──
    const monthDays = new Date(year, month, 0).getDate();
    const submissionRate =
      monthDays > 0 ? Math.round((submittedDates.size / monthDays) * 1000) / 10 : 0;

    const totalHours = empsOut.reduce((sum, e) => sum + e.total_hours, 0);
    const totalManDays = empsOut.reduce((sum, e) => sum + e.days, 0);
    const workedDaysCount = Object.keys(dailyHeadcount).length;
    const avgHeadcount = workedDaysCount
      ? Math.round((totalManDays / workedDaysCount) * 10) / 10
      : 0;

    const missingDates: string[] = [];
    for (let d = 1; d <= monthDays; d++) {
      const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!submittedDates.has(ds) && ds >= from && ds <= to) {
        missingDates.push(ds);
      }
    }

    return ok({
      year,
      month,
      date_from: from,
      date_to: to,
      store: { id: store.id, name: store.name },
      submission: {
        submitted_days: submittedDates.size,
        total_days: monthDays,
        submission_rate: submissionRate,
        missing_dates: missingDates,
      },
      employees: empsOut,
      daily_headcount: Object.entries(dailyHeadcount)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      stats: {
        primary_emp_count: primaryEmpIds.size,
        worked_emp_count: empsOut.length,
        total_man_days: totalManDays,
        total_hours: Math.round(totalHours * 100) / 100,
        avg_headcount: avgHeadcount,
      },
      override_applied: allOverrides.length, // Part 11C: 병합된 override 건수
    });
  } catch (err) {
    console.error('[v1/attendance/site] exception:', err);
    return serverError();
  }
}
