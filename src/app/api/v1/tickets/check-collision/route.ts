/**
 * GET /api/v1/tickets/check-collision
 * 동일 4자리 충돌 검색 — 같은 사업장 내 활성 차량 중 plate_last4가 동일한 건 조회
 *
 * 용도(Part 19B-5): 4자리 OCR 입차 시, 같은 4자리 활성 차량이 이미 있으면
 *                   차종/컬러 입력 모달을 띄워 구분. 출차 시에도 N건 매칭에 활용.
 *
 * Query: ?store_id=xxx (필수) & plate_last4=1234 (필수, 숫자 4자리)
 *        & include_monthly=true (선택, Part 19B-5D 출차 검색용 — 월주차 포함 + 차주성함 조인)
 * 응답: { has_collision: boolean, count: number, matches: [...] }
 *        match(월주차): owner_name(차주성함) + car_type 보강(계약 vehicle_type fallback)
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
 *
 * ⚠️ include_monthly 기본값 false → 5C 입차 충돌검색은 파라미터 미전달로 기존 동작(월주차 제외) 유지.
 *
 * ⚠️ 이 API는 로그인된 CREW/관리자 전용입니다. PUBLIC_PATHS에 추가하지 마세요.
 *    (고객용 public 티켓 API와 혼동 금지 — 2026.04.22 PUBLIC_PATHS 사고 참고)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, serverError } from '@/lib/api/response';

// idx_tickets_collision 부분 인덱스의 WHERE 절과 반드시 동일하게 유지 (인덱스 활용)
const ACTIVE_STATUSES = ['parking', 'exit_requested', 'car_ready', 'pre_paid', 'overdue'];

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 충돌 검색 권한이 없습니다');
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const plateLast4 = searchParams.get('plate_last4');
    const includeMonthly = searchParams.get('include_monthly') === 'true'; // Part 19B-5D 출차 검색

    // 입력 검증
    if (!storeId) {
      return badRequest('MISSING_STORE_ID', 'store_id는 필수입니다');
    }
    if (!plateLast4 || !/^\d{4}$/.test(plateLast4)) {
      return badRequest('INVALID_PLATE_LAST4', 'plate_last4는 숫자 4자리여야 합니다');
    }

    // 사업장 접근 권한
    if (!canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const supabase = await createClient();

    // 동일 매장 + 동일 4자리 + 활성 상태
    // - 기본: 월주차 제외 (5C 입차 충돌검색)
    // - include_monthly=true: 월주차 포함 (5D 출차 검색)
    let query = supabase
      .from('mepark_tickets')
      .select(`
        id, plate_number, plate_last4, car_type, car_color,
        parking_type, status, entry_at, parking_location, is_monthly,
        monthly_parking_id
      `)
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .eq('plate_last4', plateLast4)
      .in('status', ACTIVE_STATUSES);

    if (!includeMonthly) {
      query = query.eq('is_monthly', false); // 4자리 입차 모드는 일반차만 (기존 동작)
    }

    const { data: rawMatches, error } = await query.order('entry_at', { ascending: false });

    if (error) {
      console.error('[v1/tickets/check-collision] 조회 오류:', error.message);
      return serverError('충돌 검색 중 오류가 발생했습니다');
    }

    let list: any[] = rawMatches || [];

    // 월주차 포함 시: 계약(monthly_parking)에서 차주성함/차종 조인 보강
    if (includeMonthly && list.length > 0) {
      const monthlyIds = Array.from(
        new Set(list.filter((m) => m.is_monthly && m.monthly_parking_id).map((m) => m.monthly_parking_id))
      );
      if (monthlyIds.length > 0) {
        const { data: contracts } = await supabase
          .from('monthly_parking')
          .select('id, customer_name, vehicle_type')
          .eq('org_id', ctx.orgId)
          .in('id', monthlyIds);
        const cmap = new Map((contracts || []).map((c: any) => [c.id, c]));
        list = list.map((m) => {
          if (m.is_monthly && m.monthly_parking_id) {
            const c = cmap.get(m.monthly_parking_id);
            return {
              ...m,
              owner_name: c?.customer_name || null,           // 차주성함 (월주차 카드 구분용)
              car_type: m.car_type || c?.vehicle_type || null, // 차종: 티켓 우선, 없으면 계약 fallback
            };
          }
          return m;
        });
      }
    }

    return ok({
      has_collision: list.length > 0,
      count: list.length,
      matches: list,
    });
  } catch (err) {
    console.error('[v1/tickets/check-collision] 서버 오류:', err);
    return serverError('충돌 검색 중 오류가 발생했습니다');
  }
}
