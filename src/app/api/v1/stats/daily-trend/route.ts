// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 일별 매출 추이 (Part 17A)
 *
 * GET /api/v1/stats/daily-trend?date_from&date_to&store_id?
 *
 * 응답: 기간 내 모든 날짜에 대해 row 보장 (데이터 없으면 0)
 *   {
 *     range: {date_from, date_to, days},
 *     series: [{date, weekday, revenue, total_cars, valet_count, report_count, is_weekend}]
 *   }
 *
 * 권한: MANAGE
 *
 * 제약: 최대 92일 (3개월) — 더 긴 기간은 서버 부담 + 차트 가독성 문제
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
import { parseDateRange } from '@/lib/api/stats';

const MAX_DAYS = 92;

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

    const days = daysBetween(date_from, date_to);
    if (days > MAX_DAYS) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        `기간이 너무 깁니다 (최대 ${MAX_DAYS}일, 요청 ${days}일)`
      );
    }

    const storeId = params.get('store_id')?.trim() || null;
    if (storeId && !canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    let q = supabase
      .from('daily_reports')
      .select('report_date, total_revenue, total_cars, valet_count')
      .eq('org_id', ctx.orgId)
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    if (storeId) q = q.eq('store_id', storeId);
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        return ok({ range: { date_from, date_to, days }, series: buildEmptySeries(date_from, days) });
      }
      q = q.in('store_id', ids);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[stats/daily-trend]:', error.message);
      return serverError('일별 추이 조회 중 오류가 발생했습니다');
    }

    // date별 합산 (같은 날짜 여러 사업장이면 합쳐서 표시)
    const byDate = new Map<string, any>();
    for (const r of data || []) {
      const cur = byDate.get(r.report_date) || { revenue: 0, total_cars: 0, valet_count: 0, report_count: 0 };
      cur.revenue += Number(r.total_revenue || 0);
      cur.total_cars += Number(r.total_cars || 0);
      cur.valet_count += Number(r.valet_count || 0);
      cur.report_count += 1;
      byDate.set(r.report_date, cur);
    }

    // 모든 날짜에 대해 row 생성 (빈 날짜 = 0)
    const series = [];
    const start = new Date(date_from + 'T00:00:00Z');
    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      const ds = isoDate(d);
      const wd = d.getUTCDay();
      const cur = byDate.get(ds) || { revenue: 0, total_cars: 0, valet_count: 0, report_count: 0 };
      series.push({
        date: ds,
        weekday: WEEKDAYS[wd],
        is_weekend: wd === 0 || wd === 6,
        ...cur,
      });
    }

    return ok({
      range: { date_from, date_to, days },
      series,
    });
  } catch (err) {
    console.error('[v1/stats/daily-trend] 예외:', err);
    return serverError('일별 추이 조회 중 오류가 발생했습니다');
  }
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  return Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildEmptySeries(dateFrom: string, days: number) {
  const series = [];
  const start = new Date(dateFrom + 'T00:00:00Z');
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const wd = d.getUTCDay();
    series.push({
      date: isoDate(d),
      weekday: WEEKDAYS[wd],
      is_weekend: wd === 0 || wd === 6,
      revenue: 0,
      total_cars: 0,
      valet_count: 0,
      report_count: 0,
    });
  }
  return series;
}
