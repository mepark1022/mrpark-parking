/**
 * 미팍 통합앱 v2 — Parking Lot 수정/삭제 API
 * PUT    /api/v1/parking-lots/:id   수정
 * DELETE /api/v1/parking-lots/:id   삭제
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
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── PUT: 주차장 수정 ──
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    // 존재 확인 + org_id 검증
    const { data: existing } = await supabase
      .from('parking_lots')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('주차장을 찾을 수 없습니다');
    }

    // 수정 가능 필드
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'lot_type', 'parking_type', 'road_address',
      'self_spaces', 'mechanical_normal', 'mechanical_suv',
      'operating_days', 'open_time', 'close_time',
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
      .from('parking_lots')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      console.error('[parking-lots/:id] 수정 오류:', error.message);
      return serverError('주차장 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'parking_lots',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: data,
    });

    return ok(data);
  } catch (err) {
    console.error('[parking-lots/:id] 서버 오류:', err);
    return serverError('주차장 수정 중 오류가 발생했습니다');
  }
}

// ── DELETE: 주차장 삭제 ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('parking_lots')
      .select('id, name, store_id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('주차장을 찾을 수 없습니다');
    }

    const { error } = await supabase
      .from('parking_lots')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (error) {
      console.error('[parking-lots/:id] 삭제 오류:', error.message);
      return serverError('주차장 삭제 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'parking_lots',
      recordId: id,
      action: 'delete',
      changedBy: ctx.userId,
      beforeData: existing,
    });

    return ok({ id, deleted: true });
  } catch (err) {
    console.error('[parking-lots/:id] 서버 오류:', err);
    return serverError('주차장 삭제 중 오류가 발생했습니다');
  }
}
