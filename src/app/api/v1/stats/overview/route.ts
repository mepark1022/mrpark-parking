// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 통계 KPI 개요 (Part 17A)
 *
 * GET /api/v1/stats/overview?date_from&date_to&store_id?
 *   또는 ?year&month&store_id?
 *
 * 응답:
 *   {
 *     range: { date_from, date_to, days },
 *     compare: { date_from, date_to },
 *     current:  { revenue, total_cars, valet_count, report_count, active_monthly },
 *     previous: { revenue, total_cars, valet_count, report_count },
 *     change:   { revenue: %, total_cars: %, valet_count: %, report_count: % }  -- null if previous=0
 *   }
 *
 * 권한: MANAGE
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  forbidden,
  serverError,
  ErrorCodes,
  canAccessStore,
} from '@/lib/api';
import { parseDateRange, calcCompareRange, calcChangeRate } from '@/lib/api/stats';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const params = request.nextUrl.searchParams;
    const parsed = parseDateRange(params);
    if ('error' in parsed) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, parsed.error);
    }
    const range = calcCompareRange(parsed);

    const storeId = params.get('store_id')?.trim() || null;
    if (storeId && !canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    // ── 현재 기간 집계 (daily_reports) ──
    const currentReports = await fetchReportSummary(
      supabase,
      ctx.orgId,
      range.date_from,
      range.date_to,
      storeId
    );
    if (currentReports.error) return serverError(currentReports.error);

    // ── 비교 기간 집계 ──
    const previousReports = await fetchReportSummary(
      supabase,
      ctx.orgId,
      range.compare_from,
      range.compare_to,
      storeId
    );
    if (previousReports.error) return serverError(previousReports.error);

    // ── 활성 월주차 개수 (현재 시점 기준, 기간 무관) ──
    let monthlyQuery = supabase
      .from('monthly_parking')
      .select('id, stores!inner(org_id)', { count: 'exact', head: true })
      .eq('contract_status', 'active')
      .eq('stores.org_id', ctx.orgId);

    if (storeId) monthlyQuery = monthlyQuery.eq('store_id', storeId);
    // crew/field 스코프
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        monthlyQuery = monthlyQuery.eq('store_id', '00000000-0000-0000-0000-000000000000');
      } else {
        monthlyQuery = monthlyQuery.in('store_id', ids);
      }
    }
    const { count: activeMonthly, error: mErr } = await monthlyQuery;
    if (mErr) {
      console.error('[stats/overview monthly]:', mErr.message);
    }

    return ok({
      range: {
        date_from: range.date_from,
        date_to: range.date_to,
        days: range.days,
      },
      compare: {
        date_from: range.compare_from,
        date_to: range.compare_to,
      },
      current: {
        ...currentReports.data,
        active_monthly: activeMonthly ?? 0,
      },
      previous: previousReports.data,
      change: {
        revenue: calcChangeRate(currentReports.data.revenue, previousReports.data.revenue),
        total_cars: calcChangeRate(currentReports.data.total_cars, previousReports.data.total_cars),
        valet_count: calcChangeRate(currentReports.data.valet_count, previousReports.data.valet_count),
        report_count: calcChangeRate(currentReports.data.report_count, previousReports.data.report_count),
      },
    });
  } catch (err) {
    console.error('[v1/stats/overview] 예외:', err);
    return serverError('통계 조회 중 오류가 발생했습니다');
  }
}

async function fetchReportSummary(
  supabase: any,
  orgId: string,
  dateFrom: string,
  dateTo: string,
  storeId: string | null
): Promise<{ data?: any; error?: string }> {
  let q = supabase
    .from('daily_reports')
    .select('total_revenue, total_cars, valet_count')
    .eq('org_id', orgId)
    .gte('report_date', dateFrom)
    .lte('report_date', dateTo);

  if (storeId) q = q.eq('store_id', storeId);

  const { data, error } = await q;
  if (error) {
    console.error('[stats/overview reports]:', error.message);
    return { error: '일보 집계 중 오류가 발생했습니다' };
  }

  const summary = (data || []).reduce(
    (acc: any, r: any) => {
      acc.revenue += Number(r.total_revenue || 0);
      acc.total_cars += Number(r.total_cars || 0);
      acc.valet_count += Number(r.valet_count || 0);
      acc.report_count += 1;
      return acc;
    },
    { revenue: 0, total_cars: 0, valet_count: 0, report_count: 0 }
  );

  return { data: summary };
}
