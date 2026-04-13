/**
 * 미팍 통합앱 v2 — Tenant Detail API (Part 14B)
 * GET    /api/v1/tenants/:id    상세 조회
 * PATCH  /api/v1/tenants/:id    부분 수정
 * DELETE /api/v1/tenants/:id    삭제 (super_admin만, soft delete = status='inactive')
 *                                ?hard=true 옵션으로 진짜 삭제 (활성 월주차 없을 때만)
 *
 * 권한:
 *   GET   : MANAGE
 *   PATCH : MANAGE
 *   DELETE: super_admin (RLS 강제) + 활성 월주차 존재 시 차단
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  conflict,
  notFound,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog, getQueryParam } from '@/lib/api/helpers';

type RouteParams = { params: Promise<{ id: string }> };

// ── GET: 상세 ──
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[v1/tenants/:id GET]:', error.message);
      return serverError('입주사 조회 중 오류가 발생했습니다');
    }
    if (!data) return notFound('입주사를 찾을 수 없습니다');

    // 활성 월주차 카운트 (요약 정보로 함께 제공)
    const { count: activeContractCount } = await supabase
      .from('monthly_parking')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)
      .eq('contract_status', 'active');

    return ok({ ...data, active_contract_count: activeContractCount ?? 0 });
  } catch (err) {
    console.error('[v1/tenants/:id GET] 예외:', err);
    return serverError('입주사 조회 중 오류가 발생했습니다');
  }
}

// ── PATCH: 부분 수정 ──
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const supabase = await createClient();

    // 존재 확인
    const { data: existing } = await supabase
      .from('tenants')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();
    if (!existing) return notFound('입주사를 찾을 수 없습니다');

    // 수정 필드 화이트리스트
    const update: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) return badRequest(ErrorCodes.VALIDATION_ERROR, '입주사명은 비워둘 수 없습니다');
      // 이름 변경 시 중복 검사 (자기 자신 제외, active만)
      if (n !== existing.name) {
        const { data: dup } = await supabase
          .from('tenants')
          .select('id')
          .eq('org_id', ctx.orgId)
          .eq('name', n)
          .eq('status', 'active')
          .neq('id', id)
          .maybeSingle();
        if (dup) {
          return conflict(ErrorCodes.TENANT_DUPLICATE_NAME, `이미 등록된 입주사명입니다: ${n}`);
        }
      }
      update.name = n;
    }

    if (body.business_no !== undefined) update.business_no = body.business_no?.trim() || null;
    if (body.contact_name !== undefined) update.contact_name = body.contact_name?.trim() || null;
    if (body.contact_phone !== undefined) update.contact_phone = body.contact_phone?.trim() || null;
    if (body.default_store_id !== undefined) update.default_store_id = body.default_store_id || null;
    if (body.memo !== undefined) update.memo = body.memo?.trim() || null;

    if (body.monthly_fee_default !== undefined) {
      if (body.monthly_fee_default === null || body.monthly_fee_default === '') {
        update.monthly_fee_default = null;
      } else {
        const n = Number(body.monthly_fee_default);
        if (!Number.isFinite(n) || n < 0) {
          return badRequest(ErrorCodes.VALIDATION_ERROR, 'monthly_fee_default는 0 이상 숫자여야 합니다');
        }
        update.monthly_fee_default = Math.round(n);
      }
    }

    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'inactive') {
        return badRequest(ErrorCodes.VALIDATION_ERROR, "status는 'active' 또는 'inactive'만 허용됩니다");
      }
      update.status = body.status;
    }

    if (Object.keys(update).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 필드가 없습니다');
    }

    update.updated_by = ctx.userId;

    const { data: updated, error: upErr } = await supabase
      .from('tenants')
      .update(update)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select('*')
      .single();

    if (upErr || !updated) {
      console.error('[v1/tenants/:id PATCH] update:', upErr?.message);
      return serverError('입주사 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'tenants',
      recordId: updated.id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[v1/tenants/:id PATCH] 예외:', err);
    return serverError('입주사 수정 중 오류가 발생했습니다');
  }
}

// ── DELETE: 기본 soft delete (status='inactive'), ?hard=true 시 진짜 삭제 ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const hard = getQueryParam(request, 'hard') === 'true';
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('tenants')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();
    if (!existing) return notFound('입주사를 찾을 수 없습니다');

    // 활성 월주차 존재 시 hard delete 차단
    if (hard) {
      const { count: activeCount } = await supabase
        .from('monthly_parking')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('contract_status', 'active');

      if ((activeCount ?? 0) > 0) {
        return conflict(
          ErrorCodes.TENANT_HAS_ACTIVE_CONTRACTS,
          `활성 월주차 ${activeCount}건이 연결되어 있어 삭제할 수 없습니다. 비활성화(soft delete)를 사용하세요.`
        );
      }

      // hard delete (RLS상 super_admin만 가능)
      const { error: delErr } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id)
        .eq('org_id', ctx.orgId);

      if (delErr) {
        console.error('[v1/tenants/:id DELETE hard]:', delErr.message);
        return serverError('입주사 삭제 중 오류가 발생했습니다 (권한 부족 또는 참조 무결성)');
      }

      await writeAuditLog({
        orgId: ctx.orgId,
        tableName: 'tenants',
        recordId: id,
        action: 'delete',
        changedBy: ctx.userId,
        beforeData: existing,
      });

      return ok({ deleted: true, mode: 'hard', id });
    }

    // soft delete: status='inactive'
    if (existing.status === 'inactive') {
      return ok({ deleted: true, mode: 'soft', id, message: '이미 비활성 상태입니다' });
    }

    const { data: updated, error: upErr } = await supabase
      .from('tenants')
      .update({ status: 'inactive', updated_by: ctx.userId })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select('*')
      .single();

    if (upErr || !updated) {
      console.error('[v1/tenants/:id DELETE soft]:', upErr?.message);
      return serverError('입주사 비활성화 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'tenants',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: updated,
      reason: 'soft delete (status → inactive)',
    });

    return ok({ deleted: true, mode: 'soft', id });
  } catch (err) {
    console.error('[v1/tenants/:id DELETE] 예외:', err);
    return serverError('입주사 삭제 중 오류가 발생했습니다');
  }
}
