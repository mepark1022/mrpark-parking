/**
 * 미팍 통합앱 v2 — 사업장 근태 분석 API (Part 11A)
 * GET /api/v1/attendance/site/:storeId?year=2026&month=04
 *
 * 권한: MANAGE
 *
 * 반환:
 *   - 사업장 정보
 *   - 월 일보 제출률 (제출/전체일수)
 *   - 직원별 근무 요약 (본사업장 소속 vs 지원인력 구분)
 *   - 일일 인원 추이 (날짜별 근무인원 수)
 *   - 전체 통계 (평균 인원, 총 근무시간 등)
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
  type StaffType,
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

    // ── 5. 각 직원별 집계 ──
    interface EmpAgg {
      employee_id: string;
      emp_no: string;
      name: string;
      is_primary_here: boolean;
      days: number;
      total_hours: number;
      late_count: number;
      support_count: number; // 이 사업장에 지원 나온 경우
      by_status: Partial<Record<AttendanceStatus, number>>;
    }
    const empAgg = new Map<string, EmpAgg>();

    // 일별 인원 추이
    const dailyHeadcount: Record<string, number> = {};
    // 전체 일보 날짜 set
    const submittedDates = new Set<string>();

    for (const r of reportList) {
      submittedDates.add(r.report_date);
      const staffArr = (r.daily_report_staff ?? []) as Array<{
        employee_id: string;
        staff_type: string;
        role: string | null;
        check_in: string | null;
        check_out: string | null;
        work_hours: number | null;
        employees: { id: string; emp_no: string; name: string } | { id: string; emp_no: string; name: string }[] | null;
      }>;

      dailyHeadcount[r.report_date] =
        (dailyHeadcount[r.report_date] ?? 0) + staffArr.length;

      for (const s of staffArr) {
        const empInfo = Array.isArray(s.employees) ? s.employees[0] : s.employees;
        if (!empInfo) continue;

        const status = judgeAttendanceStatus(
          s.staff_type as StaffType,
          storeId,
          primaryEmpIds.has(s.employee_id) ? storeId : null,
          s.check_in
        );

        if (!empAgg.has(s.employee_id)) {
          empAgg.set(s.employee_id, {
            employee_id: s.employee_id,
            emp_no: empInfo.emp_no,
            name: empInfo.name,
            is_primary_here: primaryEmpIds.has(s.employee_id),
            days: 0,
            total_hours: 0,
            late_count: 0,
            support_count: 0,
            by_status: {},
          });
        }
        const a = empAgg.get(s.employee_id)!;

        // 출근 카운트되는 상태
        const workingStatuses: AttendanceStatus[] = [
          'present', 'late', 'peak', 'support', 'additional',
        ];
        if (workingStatuses.includes(status)) {
          a.days += 1;
          a.total_hours += Number(s.work_hours ?? 0);
        }
        if (status === 'late') a.late_count += 1;
        if (status === 'support' && !a.is_primary_here) a.support_count += 1;

        a.by_status[status] = (a.by_status[status] ?? 0) + 1;
      }
    }

    // 소수점 정리
    const empsOut = [...empAgg.values()]
      .map(a => ({
        ...a,
        total_hours: Math.round(a.total_hours * 100) / 100,
      }))
      .sort((a, b) => {
        // 본사업장 소속 우선, 그 다음 근무일수 많은 순
        if (a.is_primary_here !== b.is_primary_here) {
          return a.is_primary_here ? -1 : 1;
        }
        return b.days - a.days;
      });

    // ── 6. 전체 통계 ──
    const monthDays = new Date(year, month, 0).getDate();
    const submissionRate =
      monthDays > 0 ? Math.round((submittedDates.size / monthDays) * 1000) / 10 : 0;

    const totalHours =
      empsOut.reduce((sum, e) => sum + e.total_hours, 0);
    const totalManDays = empsOut.reduce((sum, e) => sum + e.days, 0);
    const avgHeadcount = submittedDates.size
      ? Math.round((totalManDays / submittedDates.size) * 10) / 10
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
        submission_rate: submissionRate, // %
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
    });
  } catch (err) {
    console.error('[v1/attendance/site] exception:', err);
    return serverError();
  }
}
