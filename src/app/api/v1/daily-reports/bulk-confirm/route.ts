/**
 * 미팍 통합앱 v2 — 현장일보 일괄확정 API
 * POST /api/v1/daily-reports/bulk-confirm   여러 일보 한번에 확정 (MANAGE)
 *
 * 본문: { ids: string[], reason?: string }
 *   또는: { store_id?: string, date_from?: string, date_to?: string, status?: 'draft'|'submitted' }
 *         → 조건에 해당하는 미확정 일보 전체 확정
 *
 * 응답: { confirmed_count, skipped_count, details: [{id, result: 'confirmed'|'already'|'not_found'}] }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  badRequest,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;
    const explicitIds: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

    const supabase = await createClient();

    // 대상 ID 수집
    let targetIds: string[] = [];

    if (explicitIds && explicitIds.length > 0) {
      targetIds = explicitIds;
    } else {
      // 조건 기반 조회
      const storeId: string | undefined = body?.store_id;
      const dateFrom: string | undefined = body?.date_from;
      const dateTo: string | undefined = body?.date_to;
      const status: string = body?.status ?? 'submitted';

      if (!storeId && !dateFrom && !dateTo) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'ids 또는 store_id/date_from/date_to 조건 중 하나는 필수입니다'
        );
      }

      let q = supabase
        .from('daily_reports')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('status', status);

      if (storeId) q = q.eq('store_id', storeId);
      if (dateFrom) q = q.gte('report_date', dateFrom);
      if (dateTo) q = q.lte('report_date', dateTo);

      const { data: candidates, error: listErr } = await q;
      if (listErr) {
        console.error('[v1/daily-reports/bulk-confirm] list:', listErr.message);
        return serverError('대상 일보 조회 중 오류가 발생했습니다');
      }

      targetIds = (candidates ?? []).map(r => r.id as string);
    }

    if (targetIds.length === 0) {
      return ok({
        confirmed_count: 0,
        skipped_count: 0,
        details: [],
      });
    }

    // 기존 레코드 일괄 조회 (audit before)
    const { data: beforeList, error: beforeErr } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('org_id', ctx.orgId)
      .in('id', targetIds);

    if (beforeErr) {
      console.error('[v1/daily-reports/bulk-confirm] before:', beforeErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    const beforeMap = new Map((beforeList ?? []).map(r => [r.id as string, r]));
    const details: Array<{ id: string; result: 'confirmed' | 'already' | 'not_found' }> = [];
    const toUpdateIds: string[] = [];

    for (const id of targetIds) {
      const row = beforeMap.get(id);
      if (!row) {
        details.push({ id, result: 'not_found' });
        continue;
      }
      if (row.status === 'confirmed') {
        details.push({ id, result: 'already' });
        continue;
      }
      toUpdateIds.push(id);
    }

    if (toUpdateIds.length === 0) {
      return ok({
        confirmed_count: 0,
        skipped_count: details.length,
        details,
      });
    }

    const nowIso = new Date().toISOString();

    // 일괄 update: submitted_at 없는 레코드도 이번에 세팅 (COALESCE 대체 — 두 단계)
    // 1) submitted_at IS NULL인 것 먼저 submitted_at 세팅
    await supabase
      .from('daily_reports')
      .update({ submitted_at: nowIso })
      .eq('org_id', ctx.orgId)
      .in('id', toUpdateIds)
      .is('submitted_at', null);

    // 2) status/confirmed_at/confirmed_by 일괄 세팅
    const { data: updatedList, error: updateErr } = await supabase
      .from('daily_reports')
      .update({
        status: 'confirmed',
        confirmed_at: nowIso,
        confirmed_by: ctx.userId,
      })
      .eq('org_id', ctx.orgId)
      .in('id', toUpdateIds)
      .select();

    if (updateErr) {
      console.error('[v1/daily-reports/bulk-confirm] update:', updateErr.message);
      return serverError('일보 일괄확정 중 오류가 발생했습니다');
    }

    // 감사 로그 (순차 기록, 실패해도 메인 응답은 계속)
    const afterMap = new Map((updatedList ?? []).map(r => [r.id as string, r]));
    for (const id of toUpdateIds) {
      details.push({ id, result: 'confirmed' });
      const beforeRow = beforeMap.get(id);
      const afterRow = afterMap.get(id);
      if (beforeRow && afterRow) {
        await writeAuditLog({
          orgId: ctx.orgId,
          tableName: 'daily_reports',
          recordId: id,
          action: 'update',
          changedBy: ctx.userId,
          beforeData: beforeRow,
          afterData: afterRow,
          reason: reason || '일괄 확정',
        });
      }
    }

    return ok({
      confirmed_count: toUpdateIds.length,
      skipped_count: details.length - toUpdateIds.length,
      details,
    });
  } catch (err) {
    console.error('[v1/daily-reports/bulk-confirm] 서버 오류:', err);
    return serverError('일괄확정 중 오류가 발생했습니다');
  }
}
