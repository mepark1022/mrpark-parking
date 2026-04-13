// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 입주사별 통계 (Part 17A)
 *
 * GET /api/v1/stats/by-tenant?status=active|all&sort=revenue|count|name
 *
 * 응답: 각 입주사별 월주차 집계
 *   {
 *     items: [{
 *       tenant_id, tenant_name, status,
 *       active_count, expired_count, cancelled_count,
 *       total_monthly_revenue, // 활성 계약의 월요금 합 (월 매출 잠재값)
 *       contact_name, contact_phone
 *     }],
 *     totals: {tenant_count, active_total, monthly_revenue_total}
 *   }
 *
 * 권한: MANAGE
 *
 * 메모: 기간 무관 — 현재 시점 스냅샷.
 *       기간별 갱신 매출은 by-store에서 monthly 결제수단으로 확인 가능.
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

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const params = request.nextUrl.searchParams;
    const status = (params.get('status') || 'active').toLowerCase();
    if (!['active', 'all'].includes(status)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'status는 active|all 중 하나여야 합니다');
    }
    const sort = (params.get('sort') || 'revenue').toLowerCase();
    if (!['revenue', 'count', 'name'].includes(sort)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'sort는 revenue|count|name 중 하나여야 합니다');
    }

    const supabase = await createClient();

    // ── 1. 입주사 목록 ──
    let tenantQuery = supabase
      .from('tenants')
      .select('id, name, status, contact_name, contact_phone, monthly_fee_default, usage_count, last_contracted_at')
      .eq('org_id', ctx.orgId);

    if (status === 'active') tenantQuery = tenantQuery.eq('status', 'active');

    const { data: tenants, error: tErr } = await tenantQuery;
    if (tErr) {
      console.error('[stats/by-tenant tenants]:', tErr.message);
      return serverError('입주사 조회 중 오류가 발생했습니다');
    }

    if (!tenants || tenants.length === 0) {
      return ok({
        items: [],
        totals: { tenant_count: 0, active_total: 0, monthly_revenue_total: 0 },
      });
    }

    const tenantIds = tenants.map((t: any) => t.id);

    // ── 2. 월주차 일괄 조회 (tenant_id IN ...) ──
    let mpQuery = supabase
      .from('monthly_parking')
      .select('tenant_id, contract_status, monthly_fee, store_id, stores!inner(org_id)')
      .eq('stores.org_id', ctx.orgId)
      .in('tenant_id', tenantIds);

    // crew/field 스코프
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        // 빈 결과 처리
        const empty = tenants.map((t: any) => buildItem(t, []));
        return ok({
          items: sortItems(empty, sort),
          totals: calcTotals(empty),
        });
      }
      mpQuery = mpQuery.in('store_id', ids);
    }

    const { data: contracts, error: mErr } = await mpQuery;
    if (mErr) {
      console.error('[stats/by-tenant monthly]:', mErr.message);
      return serverError('월주차 집계 중 오류가 발생했습니다');
    }

    // 입주사별 그룹핑
    const byTenant = new Map<string, any[]>();
    for (const c of contracts || []) {
      if (!c.tenant_id) continue;
      const arr = byTenant.get(c.tenant_id) || [];
      arr.push(c);
      byTenant.set(c.tenant_id, arr);
    }

    const items = tenants.map((t: any) => buildItem(t, byTenant.get(t.id) || []));
    const sorted = sortItems(items, sort);
    const totals = calcTotals(items);

    return ok({ items: sorted, totals });
  } catch (err) {
    console.error('[v1/stats/by-tenant] 예외:', err);
    return serverError('입주사별 통계 조회 중 오류가 발생했습니다');
  }
}

function buildItem(tenant: any, contracts: any[]) {
  const counts = { active_count: 0, expired_count: 0, cancelled_count: 0 };
  let monthlyRevenue = 0;
  for (const c of contracts) {
    const s = c.contract_status;
    if (s === 'active') {
      counts.active_count += 1;
      monthlyRevenue += Number(c.monthly_fee || 0);
    } else if (s === 'expired') {
      counts.expired_count += 1;
    } else if (s === 'cancelled') {
      counts.cancelled_count += 1;
    }
  }
  return {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    status: tenant.status,
    contact_name: tenant.contact_name,
    contact_phone: tenant.contact_phone,
    monthly_fee_default: tenant.monthly_fee_default,
    usage_count: tenant.usage_count ?? 0,
    last_contracted_at: tenant.last_contracted_at,
    ...counts,
    total_monthly_revenue: monthlyRevenue,
  };
}

function sortItems(items: any[], sort: string): any[] {
  const arr = [...items];
  if (sort === 'count') {
    arr.sort((a, b) => b.active_count - a.active_count);
  } else if (sort === 'name') {
    arr.sort((a, b) => a.tenant_name.localeCompare(b.tenant_name, 'ko'));
  } else {
    // revenue 기본
    arr.sort((a, b) => b.total_monthly_revenue - a.total_monthly_revenue);
  }
  return arr;
}

function calcTotals(items: any[]) {
  return items.reduce(
    (acc, x) => {
      acc.tenant_count += 1;
      acc.active_total += x.active_count;
      acc.monthly_revenue_total += x.total_monthly_revenue;
      return acc;
    },
    { tenant_count: 0, active_total: 0, monthly_revenue_total: 0 }
  );
}
