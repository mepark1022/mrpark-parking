/**
 * 미팍 통합앱 v2 — Visit Place 수정/삭제 API
 * PUT    /api/v1/visit-places/:id   수정
 * DELETE /api/v1/visit-places/:id   삭제
 * 
 * 권한: MANAGE
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  notFound,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── PUT: 방문지 수정 ──
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('visit_places')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('방문지를 찾을 수 없습니다');
    }

    // 이름 변경 시 동일 사업장 내 중복 검사
    if (body.name && body.name !== existing.name) {
      const { data: dup } = await supabase
        .from('visit_places')
        .select('id')
        .eq('store_id', existing.store_id)
        .eq('org_id', ctx.orgId)
        .eq('name', body.name)
        .neq('id', id)
        .maybeSingle();

      if (dup) {
        return conflict(
          ErrorCodes.PLACE_DUPLICATE_NAME,
          `이미 등록된 방문지입니다: ${body.name}`
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'floor', 'free_minutes', 'base_fee',
      'base_minutes', 'extra_fee', 'daily_max',
      'valet_fee', 'monthly_fee',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 항목이 없습니다');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('visit_places')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      console.error('[visit-places/:id] 수정 오류:', error.message);
      return serverError('방문지 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'visit_places',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: data,
    });

    return ok(data);
  } catch (err) {
    console.error('[visit-places/:id] 서버 오류:', err);
    return serverError('방문지 수정 중 오류가 발생했습니다');
  }
}

// ── DELETE: 방문지 삭제 ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('visit_places')
      .select('id, name, store_id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('방문지를 찾을 수 없습니다');
    }

    const { error } = await supabase
      .from('visit_places')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (error) {
      console.error('[visit-places/:id] 삭제 오류:', error.message);
      return serverError('방문지 삭제 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'visit_places',
      recordId: id,
      action: 'delete',
      changedBy: ctx.userId,
      beforeData: existing,
    });

    return ok({ id, deleted: true });
  } catch (err) {
    console.error('[visit-places/:id] 서버 오류:', err);
    return serverError('방문지 삭제 중 오류가 발생했습니다');
  }
}
