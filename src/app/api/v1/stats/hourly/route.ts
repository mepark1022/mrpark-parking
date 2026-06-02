// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 시간대별 통계 (P1-2 Part 1)
 *
 * GET /api/v1/stats/hourly?date_from&date_to&store_id?   (또는 year+month)
 *
 * 응답: 0~23시 시간대별 입차 집계 (24개 zero-fill)
 *   {
 *     range:  { date_from, date_to, days },
 *     hours:  [{ hour:0..23, total_cars, valet_count, parking_count, revenue }],  // 항상 24개
 *     peak:   { hour, total_cars } | null,
 *     totals: { total_cars, valet_count, parking_count, revenue },
 *     truncated: boolean   // 상한 페이지 초과로 일부 미집계 시 true (정상 운영에선 false)
 *   }
 *
 * 비고:
 *   - 시간대 버킷 = mepark_tickets.entry_at 의 KST 시각(0~23). 레거시 analytics 동일 기준.
 *   - status='completed' 건만 집계(매출/대수). 레거시와 동일.
 *   - v2 기존 stats(overview/by-store/...)는 daily_reports(일 합계)라 시간대 집계 불가 →
 *     본 라우트만 mepark_tickets(티켓 단위)를 서버에서 직접 조회. (클라 직접쿼리 금지 규칙은 유지)
 *   - Supabase 기본 1000행 제한 회피용 페이지네이션(필요한 4개 컬럼만 select).
 *
 * 권한: MANAGE (admin/super_admin). crew/field는 배정매장으로 스코핑.
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

const PAGE_SIZE = 1000;
const MAX_PAGES = 200; // 안전상한: 최대 20만 건까지 집계(초과 시 truncated)

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

    // KST 경계로 timestamptz 범위 지정 (레거시 동일)
    const startUTC = `${date_from}T00:00:00+09:00`;
    const endUTC = `${date_to}T23:59:59+09:00`;

    const storeId = params.get('store_id')?.trim() || null;

    const supabase = await createClient();

    // 기본 쿼리 빌더 (필요 컬럼만)
    const buildQuery = () => {
      let q = supabase
        .from('mepark_tickets')
        .select('entry_at, parking_type, paid_amount')
        .eq('org_id', ctx.orgId)
        .eq('status', 'completed')
        .gte('entry_at', startUTC)
        .lte('entry_at', endUTC)
        .order('entry_at', { ascending: true });

      if (storeId) q = q.eq('store_id', storeId);

      // crew/field 스코프
      if (['crew', 'field_member'].includes(ctx.role)) {
        const ids = ctx.storeIds ?? [];
        if (ids.length === 0) return null; // 배정 매장 없음 → 빈 결과 신호
        q = q.in('store_id', ids);
      }
      return q;
    };

    // 24시간 버킷 초기화 (zero-fill)
    const buckets: { total_cars: number; valet_count: number; parking_count: number; revenue: number }[] =
      Array.from({ length: 24 }, () => ({ total_cars: 0, valet_count: 0, parking_count: 0, revenue: 0 }));

    let truncated = false;
    let page = 0;

    // 페이지네이션 루프
    for (; page < MAX_PAGES; page++) {
      const q = buildQuery();
      if (!q) break; // crew 배정매장 없음

      const fromIdx = page * PAGE_SIZE;
      const toIdx = fromIdx + PAGE_SIZE - 1;
      const { data, error } = await q.range(fromIdx, toIdx);

      if (error) {
        console.error('[stats/hourly]:', error.message);
        return serverError('시간대별 통계 조회 중 오류가 발생했습니다');
      }

      const rows = data || [];
      for (const r of rows) {
        const h = toKSTHour(r.entry_at);
        if (h < 0 || h > 23) continue;
        const amt = Number(r.paid_amount || 0);
        const b = buckets[h];
        b.total_cars += 1;
        b.revenue += amt;
        if (r.parking_type === 'valet') b.valet_count += 1;
        else b.parking_count += 1;
      }

      if (rows.length < PAGE_SIZE) break; // 마지막 페이지
      if (page === MAX_PAGES - 1) truncated = true; // 상한 도달
    }

    // 응답 조립
    const hours = buckets.map((b, hour) => ({ hour, ...b }));

    let peak: { hour: number; total_cars: number } | null = null;
    for (const h of hours) {
      if (h.total_cars > 0 && (!peak || h.total_cars > peak.total_cars)) {
        peak = { hour: h.hour, total_cars: h.total_cars };
      }
    }

    const totals = hours.reduce(
      (acc, h) => {
        acc.total_cars += h.total_cars;
        acc.valet_count += h.valet_count;
        acc.parking_count += h.parking_count;
        acc.revenue += h.revenue;
        return acc;
      },
      { total_cars: 0, valet_count: 0, parking_count: 0, revenue: 0 }
    );

    return ok({
      range: { date_from, date_to, days },
      hours,
      peak,
      totals,
      truncated,
    });
  } catch (err) {
    console.error('[v1/stats/hourly] 예외:', err);
    return serverError('시간대별 통계 조회 중 오류가 발생했습니다');
  }
}

// entry_at(ISO) → KST 시각(0~23)
function toKSTHour(iso: string): number {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  return Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
