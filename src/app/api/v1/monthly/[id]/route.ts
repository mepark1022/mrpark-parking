/**
 * 미팍 통합앱 v2 — Monthly Parking Detail API (Part 14C)
 * GET    /api/v1/monthly/:id    상세 조회 (store + tenant 조인)
 * PATCH  /api/v1/monthly/:id    부분 수정 (화이트리스트)
 * DELETE /api/v1/monthly/:id    soft delete (contract_status='cancelled') / ?hard=true → super_admin만
 *
 * 권한:
 *   GET   : MANAGE (crew/field는 배정 store만)
 *   PATCH : MANAGE
 *   DELETE: MANAGE (soft) / super_admin (hard)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  conflict,
  notFound,
  forbidden,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog, getQueryParam } from '@/lib/api/helpers';

type RouteParams = { params: Promise<{ id: string }> };

// ── 유틸: row + org 검증 ──
async function fetchOwnedRow(supabase: any, id: string, orgId: string) {
  const { data, error } = await supabase
    .from('monthly_parking')
    .select('*, stores!inner(id, name, org_id), tenants(id, name, contact_name, status, usage_count)')
    .eq('id', id)
    .eq('stores.org_id', orgId)
    .maybeSingle();
  if (error) {
    console.error('[monthly fetch]:', error.message);
    return null;
  }
  return data;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

// ────────────────────────────────────────────────────────
// GET: 상세
// ────────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const data = await fetchOwnedRow(supabase, id, ctx.orgId);
    if (!data) return notFound('월주차를 찾을 수 없습니다');

    // crew/field 스코프 검증
    if (['crew', 'field_member'].includes(ctx.role)) {
      if (!ctx.storeIds || !ctx.storeIds.includes(data.store_id)) {
        return forbidden('해당 사업장 조회 권한이 없습니다');
      }
    }

    // 갱신 이력 (renewed_from_id로 연결된 이전 row가 있으면 함께)
    let renewedFrom: any = null;
    if (data.renewed_from_id) {
      const { data: prev } = await supabase
        .from('monthly_parking')
        .select('id, vehicle_number, start_date, end_date, monthly_fee, contract_status')
        .eq('id', data.renewed_from_id)
        .maybeSingle();
      renewedFrom = prev;
    }

    return ok({ ...data, renewed_from: renewedFrom });
  } catch (err) {
    console.error('[v1/monthly/:id GET] 예외:', err);
    return serverError('월주차 조회 중 오류가 발생했습니다');
  }
}

// ────────────────────────────────────────────────────────
// PATCH: 부분 수정
// ────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const supabase = await createClient();

    const existing = await fetchOwnedRow(supabase, id, ctx.orgId);
    if (!existing) return notFound('월주차를 찾을 수 없습니다');

    // crew/field 스코프 검증
    if (['crew', 'field_member'].includes(ctx.role)) {
      if (!ctx.storeIds || !ctx.storeIds.includes(existing.store_id)) {
        return forbidden('해당 사업장 수정 권한이 없습니다');
      }
    }

    // 화이트리스트
    const update: Record<string, unknown> = {};

    if (body.vehicle_number !== undefined) {
      const vn = String(body.vehicle_number).replace(/[\s-]/g, '');
      if (vn.length < 4) return badRequest(ErrorCodes.VALIDATION_ERROR, '차량번호 형식이 올바르지 않습니다');
      // active 상태에서 차량번호 변경 시 중복 검사
      if (vn !== existing.vehicle_number && (body.contract_status || existing.contract_status) === 'active') {
        const { data: dup } = await supabase
          .from('monthly_parking')
          .select('id')
          .eq('store_id', existing.store_id)
          .eq('vehicle_number', vn)
          .eq('contract_status', 'active')
          .neq('id', id)
          .maybeSingle();
        if (dup) {
          return conflict(ErrorCodes.VALIDATION_ERROR, `이미 등록된 활성 월주차 차량입니다: ${vn}`);
        }
      }
      update.vehicle_number = vn;
    }

    if (body.vehicle_type !== undefined) update.vehicle_type = body.vehicle_type?.trim() || null;
    if (body.customer_name !== undefined) {
      const n = String(body.customer_name).trim();
      if (!n) return badRequest(ErrorCodes.VALIDATION_ERROR, '고객명은 비워둘 수 없습니다');
      update.customer_name = n;
    }
    if (body.customer_phone !== undefined) {
      const p = String(body.customer_phone).trim();
      if (!p) return badRequest(ErrorCodes.VALIDATION_ERROR, '연락처는 비워둘 수 없습니다');
      update.customer_phone = p;
    }
    if (body.note !== undefined) update.note = body.note?.trim() || null;

    if (body.start_date !== undefined) {
      if (!isValidDate(String(body.start_date))) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'start_date는 YYYY-MM-DD 형식이어야 합니다');
      }
      update.start_date = body.start_date;
    }
    if (body.end_date !== undefined) {
      if (!isValidDate(String(body.end_date))) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'end_date는 YYYY-MM-DD 형식이어야 합니다');
      }
      update.end_date = body.end_date;
    }

    // 날짜 일관성 (둘 중 하나만 바뀌어도 검증)
    const finalStart = (update.start_date as string) || existing.start_date;
    const finalEnd = (update.end_date as string) || existing.end_date;
    if (finalEnd < finalStart) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '종료일은 시작일 이후여야 합니다');
    }

    if (body.monthly_fee !== undefined) {
      const n = Number(body.monthly_fee);
      if (!Number.isFinite(n) || n < 0) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'monthly_fee는 0 이상 숫자여야 합니다');
      }
      update.monthly_fee = Math.round(n);
    }

    if (body.payment_status !== undefined) {
      if (!['paid', 'unpaid', 'overdue'].includes(body.payment_status)) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, "payment_status는 paid|unpaid|overdue 중 하나여야 합니다");
      }
      update.payment_status = body.payment_status;
    }

    if (body.contract_status !== undefined) {
      if (!['active', 'expired', 'cancelled'].includes(body.contract_status)) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, "contract_status는 active|expired|cancelled 중 하나여야 합니다");
      }
      update.contract_status = body.contract_status;
    }

    // tenant_id 변경 (선택)
    if (body.tenant_id !== undefined) {
      if (body.tenant_id === null || body.tenant_id === '') {
        update.tenant_id = null;
      } else {
        // 새 tenant org 검증
        const { data: t } = await supabase
          .from('tenants')
          .select('id, status')
          .eq('id', body.tenant_id)
          .eq('org_id', ctx.orgId)
          .maybeSingle();
        if (!t) return badRequest(ErrorCodes.TENANT_NOT_FOUND, '입주사를 찾을 수 없거나 권한이 없습니다');
        if (t.status !== 'active') {
          return badRequest(ErrorCodes.VALIDATION_ERROR, '비활성 입주사로 변경할 수 없습니다');
        }
        update.tenant_id = body.tenant_id;
      }
    }

    if (Object.keys(update).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 필드가 없습니다');
    }

    const { data: updated, error: upErr } = await supabase
      .from('monthly_parking')
      .update(update)
      .eq('id', id)
      .select('*, stores(id, name), tenants(id, name)')
      .single();

    if (upErr || !updated) {
      console.error('[v1/monthly/:id PATCH] update:', upErr?.message);
      return serverError('월주차 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'monthly_parking',
      recordId: updated.id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[v1/monthly/:id PATCH] 예외:', err);
    return serverError('월주차 수정 중 오류가 발생했습니다');
  }
}

// ────────────────────────────────────────────────────────
// DELETE: soft (contract_status='cancelled') / ?hard=true (super_admin)
// ────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const hard = getQueryParam(request, 'hard') === 'true';
    const supabase = await createClient();

    const existing = await fetchOwnedRow(supabase, id, ctx.orgId);
    if (!existing) return notFound('월주차를 찾을 수 없습니다');

    // crew/field 스코프 검증
    if (['crew', 'field_member'].includes(ctx.role)) {
      if (!ctx.storeIds || !ctx.storeIds.includes(existing.store_id)) {
        return forbidden('해당 사업장 삭제 권한이 없습니다');
      }
    }

    if (hard) {
      if (ctx.role !== 'super_admin') {
        return forbidden('hard delete는 super_admin만 가능합니다');
      }

      const { error: delErr } = await supabase
        .from('monthly_parking')
        .delete()
        .eq('id', id);

      if (delErr) {
        console.error('[v1/monthly/:id DELETE hard]:', delErr.message);
        return serverError('월주차 삭제 중 오류가 발생했습니다');
      }

      await writeAuditLog({
        orgId: ctx.orgId,
        tableName: 'monthly_parking',
        recordId: id,
        action: 'delete',
        changedBy: ctx.userId,
        beforeData: existing,
      });

      return ok({ deleted: true, mode: 'hard', id });
    }

    // soft delete: contract_status='cancelled'
    if (existing.contract_status === 'cancelled') {
      return ok({ deleted: true, mode: 'soft', id, message: '이미 취소된 계약입니다' });
    }

    const { data: updated, error: upErr } = await supabase
      .from('monthly_parking')
      .update({ contract_status: 'cancelled' })
      .eq('id', id)
      .select('*')
      .single();

    if (upErr || !updated) {
      console.error('[v1/monthly/:id DELETE soft]:', upErr?.message);
      return serverError('월주차 취소 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'monthly_parking',
      recordId: id,
      action: 'soft_delete',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: updated,
    });

    return ok({ deleted: true, mode: 'soft', id, data: updated });
  } catch (err) {
    console.error('[v1/monthly/:id DELETE] 예외:', err);
    return serverError('월주차 삭제 중 오류가 발생했습니다');
  }
}
