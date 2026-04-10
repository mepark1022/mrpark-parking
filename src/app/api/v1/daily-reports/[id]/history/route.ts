/**
 * 미팍 통합앱 v2 — 현장일보 수정 이력 API
 * GET /api/v1/daily-reports/:id/history   audit_logs 기반 수정 이력 조회 (MANAGE)
 *
 * 대상 테이블: daily_reports, daily_report_staff, daily_report_payment
 *   record_id = 일보 id 기준으로 집계 (staff/payment는 일보 id로 저장)
 *
 * 응답 정렬: 최신순 (changed_at DESC)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  notFound,
  serverError,
} from '@/lib/api/response';
import { parsePagination, paginationMeta } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TRACKED_TABLES = [
  'daily_reports',
  'daily_report_staff',
  'daily_report_payment',
];

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    // 일보 존재 + org 검증
    const { data: report, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('id, store_id, report_date, status')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id/history] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    if (!report) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // audit_logs 조회: record_id = 일보 id, table_name IN (...)
    const { data: logs, count, error: logErr } = await supabase
      .from('audit_logs')
      .select(
        'id, table_name, record_id, action, changed_by, changed_at, before_data, after_data, reason',
        { count: 'exact' }
      )
      .eq('org_id', ctx.orgId)
      .eq('record_id', id)
      .in('table_name', TRACKED_TABLES)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (logErr) {
      console.error('[v1/daily-reports/:id/history] logs:', logErr.message);
      return serverError('수정 이력 조회 중 오류가 발생했습니다');
    }

    return ok(
      {
        report_id: id,
        report_date: report.report_date,
        store_id: report.store_id,
        status: report.status,
        history: logs ?? [],
      },
      paginationMeta(count ?? 0, { page, limit, offset }, logs?.length ?? 0)
    );
  } catch (err) {
    console.error('[v1/daily-reports/:id/history] 서버 오류:', err);
    return serverError('수정 이력 조회 중 오류가 발생했습니다');
  }
}
