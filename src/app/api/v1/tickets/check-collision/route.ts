/**
 * GET /api/v1/tickets/check-collision
 * 동일 4자리 충돌 검색 — 같은 사업장 내 활성 차량 중 plate_last4가 동일한 건 조회
 *
 * 용도(Part 19B-5): 4자리 OCR 입차 시, 같은 4자리 활성 차량이 이미 있으면
 *                   차종/컬러 입력 모달을 띄워 구분. 출차 시에도 N건 매칭에 활용.
 *
 * Query: ?store_id=xxx (필수) & plate_last4=1234 (필수, 숫자 4자리)
 * 응답: { has_collision: boolean, count: number, matches: [...] }
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
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

    // 동일 매장 + 동일 4자리 + 활성 상태 (월주차 제외)
    const { data: matches, error } = await supabase
      .from('mepark_tickets')
      .select(`
        id, plate_number, plate_last4, car_type, car_color,
        parking_type, status, entry_at, parking_location, is_monthly
      `)
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .eq('plate_last4', plateLast4)
      .eq('is_monthly', false)          // 월주차는 충돌 대상 제외 (4자리 모드는 일반차만)
      .in('status', ACTIVE_STATUSES)
      .order('entry_at', { ascending: false });

    if (error) {
      console.error('[v1/tickets/check-collision] 조회 오류:', error.message);
      return serverError('충돌 검색 중 오류가 발생했습니다');
    }

    const list = matches || [];
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
