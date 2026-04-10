/**
 * POST /api/v1/stores/:id/restore
 * 삭제된 사업장 복구 (is_active → true)
 * 
 * 권한: SYSTEM (super_admin)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  notFound,
  badRequest,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'SYSTEM');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('stores')
      .select('id, name, is_active')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    if (existing.is_active) {
      return badRequest(ErrorCodes.STORE_NOT_DELETED, '삭제된 사업장이 아닙니다');
    }

    const { data, error } = await supabase
      .from('stores')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      console.error('[stores/:id/restore] 복구 오류:', error.message);
      return serverError('사업장 복구 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'stores',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { is_active: false },
      afterData: { is_active: true },
      reason: '사업장 복구',
    });

    return ok(data);
  } catch (err) {
    console.error('[stores/:id/restore] 서버 오류:', err);
    return serverError('사업장 복구 중 오류가 발생했습니다');
  }
}
