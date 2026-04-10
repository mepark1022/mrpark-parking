/**
 * 미팍 통합앱 v2 — Ticket 상세 API
 * GET   /api/v1/tickets/:id   티켓 상세 (visit_place + store JOIN)
 * PATCH /api/v1/tickets/:id   수동 상태 변경 (관리자 직권 수정)
 *
 * GET 권한: OPERATE (crew도 배정 사업장 한정 허용)
 * PATCH 권한: MANAGE (super_admin/admin) — 관리자 직권 보정용
 *   - status 외 paid_amount, payment_method, parking_location 등 수동 보정 가능
 *   - 모든 변경은 audit_logs에 reason과 함께 기록
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 허용 상태값
const ALLOWED_STATUS = [
  'parking',
  'pre_paid',
  'exit_requested',
  'car_ready',
  'completed',
] as const;
type TicketStatus = (typeof ALLOWED_STATUS)[number];

// PATCH로 수정 가능한 필드 화이트리스트
const UPDATABLE_FIELDS = [
  'status',
  'paid_amount',
  'payment_method',
  'parking_location',
  'parking_lot_id',
  'visit_place_id',
  'parking_type',
  'is_free',
  'is_monthly',
] as const;

// ── GET: 티켓 상세 ──
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  if (ctx.role === 'field_member') {
    return forbidden('현장요원은 티켓 조회 권한이 없습니다');
  }

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: ticket, error } = await supabase
      .from('mepark_tickets')
      .select(
        `id, org_id, store_id, plate_number, plate_last4, parking_type, status,
         entry_at, pre_paid_at, exit_requested_at, completed_at,
         parking_location, parking_lot_id, visit_place_id,
         is_monthly, is_free, paid_amount, payment_method, entry_method,
         monthly_parking_id, entry_crew_id,
         visit_places(id, name, floor, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee, monthly_fee),
         stores:store_id(id, name, site_code, has_valet, valet_fee, grace_period_minutes)`
      )
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (error) {
      console.error('[v1/tickets/:id] 조회 오류:', error.message);
      return serverError('티켓 조회 중 오류가 발생했습니다');
    }

    if (!ticket) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // crew는 배정 사업장 외 접근 차단
    if (!canAccessStore(ctx, ticket.store_id as string)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    return ok(ticket);
  } catch (err) {
    console.error('[v1/tickets/:id] 서버 오류:', err);
    return serverError('티켓 조회 중 오류가 발생했습니다');
  }
}

// ── PATCH: 관리자 수동 상태/필드 변경 ──
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    // 변경 가능 필드만 추출
    const updates: Record<string, unknown> = {};
    for (const key of UPDATABLE_FIELDS) {
      if (key in body && body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 필드가 없습니다');
    }

    // status 유효성
    if ('status' in updates) {
      const s = updates.status as TicketStatus;
      if (!ALLOWED_STATUS.includes(s)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `유효하지 않은 상태값입니다: ${s}`
        );
      }
    }

    // paid_amount 유효성
    if ('paid_amount' in updates) {
      const amt = Number(updates.paid_amount);
      if (Number.isNaN(amt) || amt < 0) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'paid_amount는 0 이상의 숫자여야 합니다');
      }
      updates.paid_amount = amt;
    }

    const supabase = await createClient();

    // 기존 티켓 조회 (org_id 검증 + audit 전 데이터)
    const { data: before, error: fetchError } = await supabase
      .from('mepark_tickets')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchError) {
      console.error('[v1/tickets/:id PATCH] 조회 오류:', fetchError.message);
      return serverError('티켓 조회 중 오류가 발생했습니다');
    }

    if (!before) {
      return notFound('티켓을 찾을 수 없습니다');
    }

    // 상태 전환 보조: status가 변경되면 관련 타임스탬프 자동 셋
    const now = new Date().toISOString();
    if ('status' in updates && updates.status !== before.status) {
      switch (updates.status) {
        case 'pre_paid':
          if (!before.pre_paid_at) updates.pre_paid_at = now;
          break;
        case 'exit_requested':
          if (!before.exit_requested_at) updates.exit_requested_at = now;
          break;
        case 'completed':
          if (!before.completed_at) updates.completed_at = now;
          break;
      }
    }

    // 업데이트 실행
    const { data: updated, error: updateError } = await supabase
      .from('mepark_tickets')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updateError) {
      console.error('[v1/tickets/:id PATCH] 수정 오류:', updateError.message);
      return serverError('티켓 수정 중 오류가 발생했습니다');
    }

    // 감사 로그 (관리자 직권 수정 → reason 권장)
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'mepark_tickets',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: before,
      afterData: updated,
      reason: reason || '관리자 수동 보정',
    });

    return ok(updated);
  } catch (err) {
    console.error('[v1/tickets/:id PATCH] 서버 오류:', err);
    return serverError('티켓 수정 중 오류가 발생했습니다');
  }
}
