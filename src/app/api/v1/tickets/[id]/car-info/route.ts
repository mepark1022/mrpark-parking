/**
 * PATCH /api/v1/tickets/:id/car-info
 * 차종/컬러 수정 — 4자리 충돌 구분용 정보 보정 (Part 19B-5C · GAP-P0-4)
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
 *
 * Body: {
 *   car_type?:  string | null  // 세단/SUV/경차/승합/외제/기타
 *   car_color?: string | null  // 검정/흰색/회색/은색/파랑/빨강/기타
 * }
 * - 둘 다 미전달 시 변경 없음 응답
 * - 빈 문자열은 null(미지정)로 저장
 * - 변경 이력은 audit_logs(action='update')에 기록
 *
 * ⚠️ 인증 전용 API → PUBLIC_PATHS에 추가 금지
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, forbidden, notFound, conflict, serverError } from '@/lib/api/response';
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
    return forbidden('현장요원은 차량정보 수정 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const hasType = Object.prototype.hasOwnProperty.call(body, 'car_type');
    const hasColor = Object.prototype.hasOwnProperty.call(body, 'car_color');

    if (!hasType && !hasColor) {
      return ok({ ticket_id: id, changed: false });
    }

    const normalize = (v: any) => {
      const s = (v ?? '').toString().trim();
      return s.length > 0 ? s : null;
    };
    const nextType = hasType ? normalize(body.car_type) : undefined;
    const nextColor = hasColor ? normalize(body.car_color) : undefined;

    const supabase = await createClient();

    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, org_id, store_id, status, car_type, car_color')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    if (!canAccessStore(ctx, ticket.store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    if (ticket.status === 'completed') {
      return conflict(ErrorCodes.TICKET_ALREADY_COMPLETED, '출차 완료된 차량은 정보를 수정할 수 없습니다');
    }

    // 변경 페이로드 구성 (전달된 키만)
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (hasType) patch.car_type = nextType;
    if (hasColor) patch.car_color = nextColor;

    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update(patch)
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('[v1/tickets/car-info] 업데이트 오류:', updateError.message);
      return serverError('차량정보 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'mepark_tickets',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { car_type: ticket.car_type, car_color: ticket.car_color },
      afterData: {
        car_type: hasType ? nextType : ticket.car_type,
        car_color: hasColor ? nextColor : ticket.car_color,
      },
      reason: '차종/컬러 수정 (CREW)',
    });

    return ok({
      ticket_id: id,
      car_type: hasType ? nextType : ticket.car_type,
      car_color: hasColor ? nextColor : ticket.car_color,
      changed: true,
    });
  } catch (err) {
    console.error('[v1/tickets/car-info] 서버 오류:', err);
    return serverError('차량정보 수정 중 오류가 발생했습니다');
  }
}
