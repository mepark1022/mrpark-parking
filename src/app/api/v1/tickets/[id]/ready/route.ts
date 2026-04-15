/**
 * POST /api/v1/tickets/:id/ready
 * 차량 준비 완료 — CREW가 발렛 차량을 준비한 후 호출
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
 *
 * Body: {
 *   phone?: string  // 차량준비 알림톡 발송용 (DB 미저장, 발송 즉시 휘발)
 * }
 *
 * 상태 흐름:
 *   parking → car_ready
 *   exit_requested → car_ready
 *   pre_paid → car_ready
 *
 * 알림톡: phone이 있으면 /api/alimtalk/ready 자동 호출 (fire-and-forget)
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, forbidden, notFound, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 차량준비 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { phone } = body;

    const supabase = await createClient();

    // 티켓 조회
    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, org_id, store_id, plate_number, parking_type, status, parking_location')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 사업장 접근 권한
    if (!canAccessStore(ctx, ticket.store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 이미 출차 완료
    if (ticket.status === 'completed') {
      return conflict(
        ErrorCodes.TICKET_ALREADY_COMPLETED,
        '이미 출차 완료된 차량입니다'
      );
    }

    // 이미 car_ready (멱등 응답)
    if (ticket.status === 'car_ready') {
      return ok({
        ticket_id: id,
        status: 'car_ready',
        already_ready: true,
        alimtalk_requested: false,
      });
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update({
        status: 'car_ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[v1/tickets/ready] 업데이트 오류:', updateError.message);
      return serverError('차량준비 처리 중 오류가 발생했습니다');
    }

    // 알림톡 발송 (phone 있는 경우 — 비동기, 실패해도 상태 변경은 성공)
    let alimtalkRequested = false;
    if (phone && phone.replace(/-/g, '').length >= 10) {
      alimtalkRequested = true;
      try {
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
        fetch(`${baseUrl}/api/alimtalk/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            ticketId: id,
            plateNumber: ticket.plate_number,
            orgId: ticket.org_id,
            parkingLocation: ticket.parking_location || '',
          }),
        }).catch(() => {});
      } catch {
        // 알림톡 실패해도 상태 변경은 성공
      }
    }

    return ok({
      ticket_id: id,
      status: 'car_ready',
      already_ready: false,
      alimtalk_requested: alimtalkRequested,
    });
  } catch (err) {
    console.error('[v1/tickets/ready] 서버 오류:', err);
    return serverError('차량준비 처리 중 오류가 발생했습니다');
  }
}
