/**
 * GET /api/v1/monthly/check?store_id=xxx&plate=xxx
 * 월주차 차량 검증 — CREW 입차 등록 시 실시간 확인
 *
 * 권한: OPERATE (crew/admin/super_admin, field_member 제외)
 * 스코프: crew는 배정 사업장만 (canAccessStore)
 *
 * 매칭 방식: 숫자만 추출 후 비교 (한글 ↔ * 마스킹 호환)
 *   "120서 6041" → "1206041"
 *   "120* 6041"  → "1206041"
 *
 * 응답:
 * {
 *   is_monthly: boolean,
 *   monthly_parking_id?: string,
 *   customer_name?: string,
 *   end_date?: string,
 *   days_remaining?: number,
 *   contract_status?: string
 * }
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 월주차 조회 권한이 없습니다');
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const plate = searchParams.get('plate');

    if (!storeId || !plate) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '사업장 ID와 차량번호는 필수입니다');
    }

    if (!canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 숫자만 추출
    const digits = plate.replace(/[^0-9]/g, '');
    if (digits.length < 4) {
      return ok({ is_monthly: false });
    }

    const supabase = await createClient();

    // 활성 월주차 목록 (vehicle_digits 활용 — SQL 11에서 generated column 추가됨)
    const { data: monthlyList, error } = await supabase
      .from('monthly_parking')
      .select('id, vehicle_number, vehicle_digits, customer_name, end_date, contract_status')
      .eq('store_id', storeId)
      .eq('contract_status', 'active');

    if (error) {
      console.error('[v1/monthly/check] 조회 오류:', error.message);
      return serverError('월주차 조회 중 오류가 발생했습니다');
    }

    if (!monthlyList || monthlyList.length === 0) {
      return ok({ is_monthly: false });
    }

    // 숫자 매칭 — vehicle_digits 우선, fallback으로 vehicle_number 인라인 추출
    const match = monthlyList.find((m: any) => {
      const mDigits = m.vehicle_digits || (m.vehicle_number || '').replace(/[^0-9]/g, '');
      return mDigits === digits;
    });

    if (!match) {
      return ok({ is_monthly: false });
    }

    // 만료까지 남은 일수
    let daysRemaining: number | null = null;
    if (match.end_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(match.end_date);
      end.setHours(0, 0, 0, 0);
      daysRemaining = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return ok({
      is_monthly: true,
      monthly_parking_id: match.id,
      customer_name: match.customer_name,
      end_date: match.end_date,
      days_remaining: daysRemaining,
      contract_status: match.contract_status,
    });
  } catch (err) {
    console.error('[v1/monthly/check] 서버 오류:', err);
    return serverError('월주차 조회 중 오류가 발생했습니다');
  }
}
