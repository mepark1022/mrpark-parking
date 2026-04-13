/**
 * PATCH /api/v1/tickets/:id/complete
 * 출차 처리 — CREW가 차량 출차 완료
 * 
 * Body: {
 *   calculated_fee?: number,   // 계산된 요금
 *   payment_method?: string,   // 결제 수단 (card, cash, free 등)
 *   phone?:         string,    // 차량준비 알림톡 (DB 미저장)
 * }
 * 
 * 상태 흐름:
 *   parking → completed (직접 출차)
 *   pre_paid → completed (사전정산 후 출차)
 *   exit_requested → completed (고객 출차요청 후 출차)
 *   car_ready → completed (차량준비 후 출차)
 * 
 * 권한: OPERATE (crew 이상, field_member 제외)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, forbidden, notFound, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 출차 처리 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { calculated_fee, payment_method, phone } = body;

    const supabase = await createClient();

    // 티켓 조회
    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, store_id, plate_number, status, entry_at, paid_amount, is_monthly, is_free')
      .eq('id', id)
      .single();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 사업장 접근 권한
    if (!canAccessStore(ctx, ticket.store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 이미 완료된 티켓
    if (ticket.status === 'completed') {
      return conflict(
        ErrorCodes.TICKET_ALREADY_COMPLETED,
        '이미 출차 처리된 차량입니다'
      );
    }

    // 요금 계산
    const fee = calculated_fee ?? 0;
    const paidAmount = ticket.paid_amount || 0;
    const additionalFee = ticket.status === 'pre_paid'
      ? Math.max(0, fee - paidAmount)
      : 0;

    // 출차 처리
    const updates: Record<string, any> = {
      status: 'completed',
      exit_at: new Date().toISOString(),
      exit_crew_id: ctx.userId,
      calculated_fee: fee,
      additional_fee: additionalFee,
      updated_at: new Date().toISOString(),
    };

    if (payment_method) {
      updates.payment_method = payment_method;
    }

    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('[v1/tickets/complete] 업데이트 오류:', updateError.message);
      return serverError('출차 처리 중 오류가 발생했습니다');
    }

    return ok({
      ticket_id: id,
      status: 'completed',
      exit_at: updates.exit_at,
      calculated_fee: fee,
      additional_fee: additionalFee,
      payment_method: payment_method || null,
    });
  } catch (err) {
    console.error('[v1/tickets/complete] 서버 오류:', err);
    return serverError('출차 처리 중 오류가 발생했습니다');
  }
}
