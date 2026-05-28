/**
 * PATCH /api/v1/tickets/:id/plate
 * 번호판 수정 — CREW가 오인식/오타 번호판을 보정 (Part 19B-5C · GAP-P0-4)
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
 *
 * Body: {
 *   plate_number: string  // 신규 번호판 (4자리 모드는 "4567" 그대로, 풀번호도 허용)
 * }
 * - plate_last4는 서버에서 숫자 뒤 4자리로 재계산
 * - 변경 이력은 audit_logs(table_name='mepark_tickets', action='update')에 기록
 *
 * ⚠️ 인증 전용 API → PUBLIC_PATHS에 추가 금지
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 번호판 수정 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const plateNumber: string = (body.plate_number || '').toString().trim();

    // 입력 검증 — 숫자 4자리 이상 보유 필수
    const digits = plateNumber.replace(/[^0-9]/g, '');
    if (!plateNumber || digits.length < 4) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '번호판은 숫자 4자리 이상이어야 합니다');
    }

    const supabase = await createClient();

    // 기존 티켓 조회 (org_id 필터)
    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, org_id, store_id, plate_number, plate_last4, status')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 사업장 접근 권한
    if (!canAccessStore(ctx, ticket.store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 출차 완료 건은 수정 불가
    if (ticket.status === 'completed') {
      return conflict(ErrorCodes.TICKET_ALREADY_COMPLETED, '출차 완료된 차량은 번호판을 수정할 수 없습니다');
    }

    const plateLast4 = digits.slice(-4);

    // 변경 없음 → 멱등 응답
    if (ticket.plate_number === plateNumber && ticket.plate_last4 === plateLast4) {
      return ok({ ticket_id: id, plate_number: plateNumber, plate_last4: plateLast4, changed: false });
    }

    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update({
        plate_number: plateNumber,
        plate_last4: plateLast4,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('[v1/tickets/plate] 업데이트 오류:', updateError.message);
      return serverError('번호판 수정 중 오류가 발생했습니다');
    }

    // 감사 로그 (실패해도 메인 로직 차단 안 함)
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'mepark_tickets',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { plate_number: ticket.plate_number, plate_last4: ticket.plate_last4 },
      afterData: { plate_number: plateNumber, plate_last4: plateLast4 },
      reason: '번호판 수정 (CREW)',
    });

    return ok({
      ticket_id: id,
      plate_number: plateNumber,
      plate_last4: plateLast4,
      changed: true,
    });
  } catch (err) {
    console.error('[v1/tickets/plate] 서버 오류:', err);
    return serverError('번호판 수정 중 오류가 발생했습니다');
  }
}
