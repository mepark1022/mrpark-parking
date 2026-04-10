/**
 * POST /api/v1/tickets/:id/exit-request
 * 고객 출차 요청 — 발렛 차량 준비 요청
 * 
 * 권한: PUBLIC (고객 티켓 페이지에서 호출)
 * 
 * 동작:
 *   1. exit_requests 테이블에 요청 생성
 *   2. mepark_tickets.status → exit_requested
 *   3. 중복 요청 시 기존 상태 반환 (멱등성)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, badRequest, notFound, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 티켓 조회
    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, org_id, store_id, plate_number, parking_type, status, parking_location')
      .eq('id', id)
      .single();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 이미 완료된 티켓
    if (ticket.status === 'completed') {
      return conflict(
        ErrorCodes.TICKET_ALREADY_COMPLETED,
        '이미 출차 완료된 차량입니다'
      );
    }

    // 이미 출차요청 또는 차량준비 중 → 멱등성 (기존 상태 반환)
    if (['exit_requested', 'car_ready'].includes(ticket.status)) {
      return ok({
        ticket_id: id,
        status: ticket.status,
        message: ticket.status === 'exit_requested'
          ? '출차 요청이 접수되었습니다. 크루가 차량을 준비 중입니다.'
          : '차량이 준비되었습니다.',
        already_requested: true,
      });
    }

    // 발렛이 아닌 경우 출차요청 불가
    if (ticket.parking_type !== 'valet') {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '셀프주차는 출차요청이 필요하지 않습니다'
      );
    }

    // exit_requests 생성
    const { error: exitReqError } = await supabase
      .from('exit_requests')
      .insert({
        ticket_id: id,
        org_id: ticket.org_id,
        store_id: ticket.store_id,
        plate_number: ticket.plate_number,
        parking_location: ticket.parking_location || '',
        status: 'requested',
      });

    if (exitReqError) {
      console.error('[v1/tickets/exit-request] exit_requests 생성 오류:', exitReqError.message);
      // exit_requests 실패해도 상태 업데이트는 시도
    }

    // 티켓 상태 업데이트
    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update({
        status: 'exit_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[v1/tickets/exit-request] 상태 업데이트 오류:', updateError.message);
      return serverError('출차 요청 처리 중 오류가 발생했습니다');
    }

    return ok({
      ticket_id: id,
      status: 'exit_requested',
      message: '출차 요청이 접수되었습니다. 크루가 차량을 준비합니다.',
      already_requested: false,
    });
  } catch (err) {
    console.error('[v1/tickets/exit-request] 서버 오류:', err);
    return serverError('출차 요청 중 오류가 발생했습니다');
  }
}
