/**
 * GET /api/v1/stores/:id/operation
 * CREW 운영용 사업장 정보 — 입차 등록 등에 필요한 통합 데이터 1회 조회
 *
 * 권한: OPERATE (crew/admin/super_admin, field_member 제외)
 * 스코프: crew는 배정 사업장만 (canAccessStore)
 *
 * 응답:
 * {
 *   store: { id, name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee, has_valet },
 *   visit_places: [{ id, name, floor, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee }],
 *   parking_lots: [{ id, name, self_spaces, mechanical_normal, mechanical_suv }]
 * }
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, forbidden, notFound, serverError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 운영 정보 조회 권한이 없습니다');
  }

  try {
    const { id: storeId } = await params;

    if (!canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    // 병렬 조회 — 사업장 + 방문지 + 주차장
    const [storeResult, visitResult, lotResult] = await Promise.all([
      supabase
        .from('stores')
        .select('id, name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee, has_valet')
        .eq('id', storeId)
        .eq('org_id', ctx.orgId)
        .maybeSingle(),
      supabase
        .from('visit_places')
        .select('id, name, floor, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee')
        .eq('store_id', storeId)
        .eq('org_id', ctx.orgId)
        .order('floor', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true }),
      supabase
        .from('parking_lots')
        .select('id, name, self_spaces, mechanical_normal, mechanical_suv')
        .eq('store_id', storeId)
        .eq('org_id', ctx.orgId)
        .order('name', { ascending: true }),
    ]);

    if (storeResult.error) {
      console.error('[stores/:id/operation] store 조회 오류:', storeResult.error.message);
      return serverError('사업장 조회 중 오류가 발생했습니다');
    }

    if (!storeResult.data) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    return ok({
      store: storeResult.data,
      visit_places: visitResult.data || [],
      parking_lots: lotResult.data || [],
    });
  } catch (err) {
    console.error('[stores/:id/operation] 서버 오류:', err);
    return serverError('운영 정보 조회 중 오류가 발생했습니다');
  }
}
