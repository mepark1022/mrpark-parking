/**
 * 미팍 통합앱 v2 — 현장일보 확정 API
 * PATCH /api/v1/daily-reports/:id/confirm   일보 확정 처리 (MANAGE)
 *
 * 규칙:
 *   - 이미 confirmed면 409
 *   - draft 상태도 확정 가능 (관리자 직권, submitted_at 없으면 confirmed_at과 동시에 세팅)
 *   - confirmed_at, confirmed_by 세팅 + status='confirmed'
 *   - audit_logs 기록
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  conflict,
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

    // 기존 조회
    const { data: before, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/confirm] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    if (!before) {
      return notFound('일보를 찾을 수 없습니다');
    }

    if (before.status === 'confirmed') {
      return conflict(
        ErrorCodes.REPORT_ALREADY_CONFIRMED,
        '이미 확정된 일보입니다'
      );
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: 'confirmed',
      confirmed_at: nowIso,
      confirmed_by: ctx.userId,
    };
    // draft에서 바로 확정 시 submitted_at도 세팅
    if (!before.submitted_at) {
      updates.submitted_at = nowIso;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('daily_reports')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error('[v1/daily-reports/confirm] update:', updateErr?.message);
      return serverError('일보 확정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'daily_reports',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: before,
      afterData: updated,
      reason: reason || '일보 확정',
    });

    return ok(updated);
  } catch (err) {
    console.error('[v1/daily-reports/confirm] 서버 오류:', err);
    return serverError('일보 확정 중 오류가 발생했습니다');
  }
}
