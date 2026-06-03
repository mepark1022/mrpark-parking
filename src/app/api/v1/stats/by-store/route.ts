// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 주차장별 통계 (Part 17A)
 *
 * GET /api/v1/stats/by-store?date_from&date_to (또는 year+month)
 *   sort=revenue|cars|valet (default: revenue)
 *
 * 응답: 각 사업장별 집계 + 합계
 *   {
 *     range: {date_from, date_to, days},
 *     items: [{store_id, store_name, site_code, revenue, total_cars, valet_count, report_count, daily_avg_revenue}],
 *     totals: {revenue, total_cars, valet_count, report_count}
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
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { parseDateRange } from '@/lib/api/stats';

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
    const { date_from, date_to } = parsed;
    const sort = (params.get('sort') || 'revenue').toLowerCase();
    if (!['revenue', 'cars', 'valet'].includes(sort)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'sort는 revenue|cars|valet 중 하나여야 합니다');
    }

    const supabase = await createClient();

    // 일보 + 사업장 정보
    let q = supabase
      .from('daily_reports')
      .select('store_id, total_revenue, total_cars, valet_count, stores!inner(id, name, site_code)')
      .eq('org_id', ctx.orgId)
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    // crew/field 스코프
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        return ok({ range: { date_from, date_to, days: daysBetween(date_from, date_to) }, items: [], totals: zeroTotals() });
      }
      q = q.in('store_id', ids);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[stats/by-store]:', error.message);
      return serverError('주차장별 통계 조회 중 오류가 발생했습니다');
    }

    // store_id별로 집계
    const map = new Map<string, any>();
    for (const r of data || []) {
      const sid = r.store_id;
      if (!sid) continue;
      const cur = map.get(sid) || {
        store_id: sid,
        store_name: r.stores?.name || '-',
        site_code: r.stores?.site_code || null,
        revenue: 0,
        total_cars: 0,
        valet_count: 0,
        report_count: 0,
      };
      cur.revenue += Number(r.total_revenue || 0);
      cur.total_cars += Number(r.total_cars || 0);
      cur.valet_count += Number(r.valet_count || 0);
      cur.report_count += 1;
      map.set(sid, cur);
    }

    const days = daysBetween(date_from, date_to);
    const items = Array.from(map.values()).map((x) => ({
      ...x,
      daily_avg_revenue: x.report_count > 0 ? Math.round(x.revenue / x.report_count) : 0,
    }));

    // 정렬
    items.sort((a, b) => {
      if (sort === 'cars') return b.total_cars - a.total_cars;
      if (sort === 'valet') return b.valet_count - a.valet_count;
      return b.revenue - a.revenue;
    });

    const totals = items.reduce(
      (acc, x) => {
        acc.revenue += x.revenue;
        acc.total_cars += x.total_cars;
        acc.valet_count += x.valet_count;
        acc.report_count += x.report_count;
        return acc;
      },
      zeroTotals()
    );

    return ok({
      range: { date_from, date_to, days },
      items,
      totals,
    });
  } catch (err) {
    console.error('[v1/stats/by-store] 예외:', err);
    return serverError('주차장별 통계 조회 중 오류가 발생했습니다');
  }
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  return Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function zeroTotals() {
  return { revenue: 0, total_cars: 0, valet_count: 0, report_count: 0 };
}
