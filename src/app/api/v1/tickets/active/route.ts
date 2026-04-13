/**
 * GET /api/v1/tickets/active
 * 현재 주차 목록 — 배정 사업장의 미완료 티켓
 * 
 * Query: ?store_id=xxx (선택, crew는 배정 사업장만)
 * 응답: { tickets: [...], total }
 * 
 * 권한: OPERATE (crew 이상, field_member 제외)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, forbidden, serverError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 주차 목록 조회 권한이 없습니다');
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');

    const supabase = await createClient();

    // 사업장 필터 결정
    let targetStoreIds: string[];

    if (storeId) {
      // 특정 사업장 지정
      if (!canAccessStore(ctx, storeId)) {
        return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
      }
      targetStoreIds = [storeId];
    } else if (['super_admin', 'admin'].includes(ctx.role)) {
      // admin → 전체 사업장 (org_id 기반)
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('org_id', ctx.orgId);
      targetStoreIds = (stores || []).map((s: any) => s.id);
    } else {
      // crew → 배정 사업장
      targetStoreIds = ctx.storeIds || [];
    }

    if (targetStoreIds.length === 0) {
      return ok({ tickets: [], total: 0 });
    }

    // 미완료 티켓 조회
    const { data: tickets, error } = await supabase
      .from('mepark_tickets')
      .select(`
        id, plate_number, plate_last4, parking_type, status,
        entry_at, pre_paid_at, parking_location, is_monthly, paid_amount,
        entry_method, is_free,
        store_id,
        visit_place_id,
        visit_places(id, name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee),
        stores:store_id(id, name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee)
      `)
      .in('store_id', targetStoreIds)
      .neq('status', 'completed')
      .order('entry_at', { ascending: false });

    if (error) {
      console.error('[v1/tickets/active] 조회 오류:', error.message);
      return serverError('주차 목록 조회 중 오류가 발생했습니다');
    }

    return ok({
      tickets: tickets || [],
      total: (tickets || []).length,
    });
  } catch (err) {
    console.error('[v1/tickets/active] 서버 오류:', err);
    return serverError('주차 목록 조회 중 오류가 발생했습니다');
  }
}
