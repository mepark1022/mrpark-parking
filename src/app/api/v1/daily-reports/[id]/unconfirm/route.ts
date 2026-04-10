/**
 * 미팍 통합앱 v2 — 현장일보 확정 해제 API
 * PATCH /api/v1/daily-reports/:id/unconfirm   확정 해제 (MANAGE)
 *
 * 규칙:
 *   - status != 'confirmed'면 400
 *   - status='submitted'로 되돌리고 confirmed_at/confirmed_by null
 *   - submitted_at은 유지 (제출 자체는 있었으므로)
 *   - audit_logs 기록 (reason 권장)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  badRequest,
  notFound,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const supabase = await createClient();

    const { data: before, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id/unconfirm] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    if (!before) {
      return notFound('일보를 찾을 수 없습니다');
    }

    if (before.status !== 'confirmed') {
      return badRequest(
        ErrorCodes.REPORT_INVALID_STATUS,
        '확정 상태의 일보만 해제할 수 있습니다'
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from('daily_reports')
      .update({
        status: 'submitted',
        confirmed_at: null,
        confirmed_by: null,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updErr || !updated) {
      console.error('[v1/daily-reports/:id/unconfirm] update:', updErr?.message);
      return serverError('확정 해제 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'daily_reports',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: before,
      afterData: updated,
      reason: reason || '확정 해제',
    });

    return ok(updated);
  } catch (err) {
    console.error('[v1/daily-reports/:id/unconfirm] 서버 오류:', err);
    return serverError('확정 해제 중 오류가 발생했습니다');
  }
}
