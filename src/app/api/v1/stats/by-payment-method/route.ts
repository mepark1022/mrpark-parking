// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 결제수단별 통계 (Part 17A)
 *
 * GET /api/v1/stats/by-payment-method?date_from&date_to&store_id?
 *
 * 응답:
 *   {
 *     range: {date_from, date_to, days},
 *     items: [{method, label, emoji, color, amount, count, ratio}],
 *     totals: {amount, count}
 *   }
 *   ratio = amount / totals.amount (소수 1자리, 0~100)
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
import { parseDateRange, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ORDER } from '@/lib/api/stats';

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
    const storeId = params.get('store_id')?.trim() || null;
    if (storeId && !canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    // 1. 기간 내 일보 ID 추출
    let rq = supabase
      .from('daily_reports')
      .select('id, store_id')
      .eq('org_id', ctx.orgId)
      .gte('report_date', date_from)
      .lte('report_date', date_to);

    if (storeId) rq = rq.eq('store_id', storeId);
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        return ok({ range: { date_from, date_to, days: daysBetween(date_from, date_to) }, items: emptyItems(), totals: { amount: 0, count: 0 } });
      }
      rq = rq.in('store_id', ids);
    }

    const { data: reports, error: rErr } = await rq;
    if (rErr) {
      console.error('[stats/by-payment-method reports]:', rErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    const reportIds = (reports || []).map((r: any) => r.id);
    if (reportIds.length === 0) {
      return ok({
        range: { date_from, date_to, days: daysBetween(date_from, date_to) },
        items: emptyItems(),
        totals: { amount: 0, count: 0 },
      });
    }

    // 2. payment 일괄 조회
    const { data: payments, error: pErr } = await supabase
      .from('daily_report_payment')
      .select('method, amount, count')
      .in('report_id', reportIds);

    if (pErr) {
      console.error('[stats/by-payment-method payments]:', pErr.message);
      return serverError('결제수단별 통계 조회 중 오류가 발생했습니다');
    }

    // 3. method별 합산
    const map = new Map<string, { amount: number; count: number }>();
    for (const m of PAYMENT_METHOD_ORDER) {
      map.set(m, { amount: 0, count: 0 });
    }
    for (const p of payments || []) {
      const cur = map.get(p.method) || { amount: 0, count: 0 };
      cur.amount += Number(p.amount || 0);
      cur.count += Number(p.count || 0);
      map.set(p.method, cur);
    }

    const totalAmount = Array.from(map.values()).reduce((s, x) => s + x.amount, 0);
    const totalCount = Array.from(map.values()).reduce((s, x) => s + x.count, 0);

    const items = PAYMENT_METHOD_ORDER.map((method) => {
      const v = map.get(method)!;
      const meta = PAYMENT_METHOD_LABELS[method];
      return {
        method,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        amount: v.amount,
        count: v.count,
        ratio: totalAmount > 0 ? Math.round((v.amount / totalAmount) * 1000) / 10 : 0,
      };
    });

    return ok({
      range: { date_from, date_to, days: daysBetween(date_from, date_to) },
      items,
      totals: { amount: totalAmount, count: totalCount },
    });
  } catch (err) {
    console.error('[v1/stats/by-payment-method] 예외:', err);
    return serverError('결제수단별 통계 조회 중 오류가 발생했습니다');
  }
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00Z');
  const t = new Date(to + 'T00:00:00Z');
  return Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function emptyItems() {
  return PAYMENT_METHOD_ORDER.map((method) => {
    const meta = PAYMENT_METHOD_LABELS[method];
    return {
      method,
      label: meta.label,
      emoji: meta.emoji,
      color: meta.color,
      amount: 0,
      count: 0,
      ratio: 0,
    };
  });
}
