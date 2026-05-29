/**
 * PATCH /api/v1/tickets/:id/photos
 * 차량사진 경로 사후 기록 — 입차 시 6장 연속촬영 후 Storage 업로드 경로를 저장 (GAP-P1-8 · P1-8a)
 *
 * 권한: OPERATE (crew 이상, field_member 제외)
 *
 * 흐름:
 *   1) POST /api/v1/tickets 로 티켓 생성 → 응답의 photo_bucket / photo_path_prefix 수신
 *   2) CREW가 Storage(vehicle-photos) 의 photo_path_prefix 하위로 사진 직접 업로드
 *   3) 업로드된 객체 경로 배열을 본 라우트로 PATCH → vehicle_photos 컬럼 기록
 *
 * Body: {
 *   vehicle_photos: string[]   // Storage 객체 경로 배열 (최대 6장)
 *                              // 각 경로는 반드시 `{org_id}/{ticket_id}/` 로 시작해야 함
 * }
 * - 0장(빈 배열) 허용 — 패스버튼으로 사진 단계를 건너뛴 경우 (변경 없음 응답)
 * - 완료(completed) 티켓은 기록 불가
 * - cross-org / 타 티켓 경로 주입 방지: prefix 검증
 *
 * ⚠️ 인증 전용 API → PUBLIC_PATHS 추가 금지
 * ⚠️ Storage 업로드 자체는 CREW(browser supabase client)가 직접 수행 (accidents 설계 ⓐ 동일)
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

const MAX_PHOTOS = 6; // 슬롯 ①전면 ②후면 ③운전석 ④보조석 ⑤추가1 ⑥추가2

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 차량사진 기록 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 입력 검증: vehicle_photos 배열
    if (!Object.prototype.hasOwnProperty.call(body, 'vehicle_photos')) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'vehicle_photos 배열이 필요합니다');
    }
    const raw = body.vehicle_photos;
    if (!Array.isArray(raw)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'vehicle_photos는 배열이어야 합니다');
    }
    if (raw.length > MAX_PHOTOS) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, `차량사진은 최대 ${MAX_PHOTOS}장까지 기록할 수 있습니다`);
    }

    // 문자열만, 공백 제거, 중복 제거
    const photos: string[] = [...new Set(
      raw
        .filter((p: any) => typeof p === 'string')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
    )];

    // cross-org / 타 티켓 경로 주입 차단 — 반드시 `{org_id}/{ticket_id}/` 로 시작
    const expectedPrefix = `${ctx.orgId}/${id}/`;
    const invalid = photos.find((p) => !p.startsWith(expectedPrefix));
    if (invalid) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '사진 경로는 해당 티켓 폴더 하위만 허용됩니다'
      );
    }

    const supabase = await createClient();

    // 티켓 존재 + org 검증 + 현재 사진 (audit 전 데이터)
    const { data: ticket, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('id, org_id, store_id, status, vehicle_photos')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchError || !ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // crew는 배정 사업장만
    if (!canAccessStore(ctx, ticket.store_id)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 완료 티켓은 기록 불가
    if (ticket.status === 'completed') {
      return conflict(ErrorCodes.TICKET_ALREADY_COMPLETED, '출차 완료된 차량은 사진을 기록할 수 없습니다');
    }

    // 빈 배열 = 패스(사진 없음). 기존 값이 없으면 변경 없음 처리.
    const before: string[] = Array.isArray(ticket.vehicle_photos) ? ticket.vehicle_photos : [];
    if (photos.length === 0 && before.length === 0) {
      return ok({ ticket_id: id, vehicle_photos: [], changed: false });
    }

    const { error: updateError } = await supabase
      .from('mepark_tickets')
      .update({ vehicle_photos: photos, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('[v1/tickets/photos] 업데이트 오류:', updateError.message);
      return serverError('차량사진 기록 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'mepark_tickets',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { vehicle_photos: before },
      afterData: { vehicle_photos: photos },
      reason: '차량사진 기록 (입차 · CREW)',
    });

    return ok({
      ticket_id: id,
      vehicle_photos: photos,
      count: photos.length,
      changed: true,
    });
  } catch (err) {
    console.error('[v1/tickets/photos] 서버 오류:', err);
    return serverError('차량사진 기록 중 오류가 발생했습니다');
  }
}
