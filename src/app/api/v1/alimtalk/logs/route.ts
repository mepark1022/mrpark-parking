// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 알림톡 발송 로그 조회 API (Part 18B)
 *
 * GET /api/v1/alimtalk/logs
 *
 * Query:
 *   date_from?   YYYY-MM-DD  (기본: 7일 전)
 *   date_to?     YYYY-MM-DD  (기본: 오늘)
 *   template?    entry | ready | renewal_remind | d7_auto_remind |
 *                monthly_expire | monthly_expire_auto | renewal_complete | all
 *   status?      success | failed | all  (기본: all)
 *   search?      phone_masked / message_id 부분일치
 *   page?        기본 1
 *   limit?       기본 50, 최대 200
 *
 * 응답:
 *   {
 *     data: [
 *       {
 *         id, sent_at, template_type, send_status,
 *         phone_masked, message_id, error_message,
 *         ticket_id, monthly_parking_id
 *       }
 *     ],
 *     meta: { total, page, limit, total_pages },
 *     summary: {
 *       total, success, failed,
 *       by_template: { [template_type]: { total, success, failed } }
 *     }
 *   }
 *
 * 권한: MANAGE (org 스코프 — org_id 필터)
 *
 * 주의:
 *   - phone_masked는 이미 마스킹 상태로 저장되어 있음 (010****1234)
 *   - 실제 전화번호는 어디에도 저장되지 않음
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  serverError,
  ErrorCodes,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const ALLOWED_TEMPLATES = new Set([
  'entry',
  'ready',
  'renewal_remind',
  'd7_auto_remind',
  'monthly_expire',
  'monthly_expire_auto',
  'renewal_complete',
]);

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const p = request.nextUrl.searchParams;

    // ── 기간 (기본: 7일 전 ~ 오늘, KST 기준 YYYY-MM-DD) ──
    const today = new Date();
    const toDefault = today.toISOString().slice(0, 10);
    const fromDefaultD = new Date(today);
    fromDefaultD.setDate(fromDefaultD.getDate() - 6);
    const fromDefault = fromDefaultD.toISOString().slice(0, 10);

    const dateFrom = (p.get('date_from') || fromDefault).trim();
    const dateTo = (p.get('date_to') || toDefault).trim();

    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'date_from, date_to는 YYYY-MM-DD 형식이어야 합니다'
      );
    }
    if (dateFrom > dateTo) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '기간 범위가 올바르지 않습니다');
    }

    // ── 템플릿 필터 ──
    const template = (p.get('template') || 'all').trim();
    if (template !== 'all' && !ALLOWED_TEMPLATES.has(template)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, `알 수 없는 template: ${template}`);
    }

    // ── 상태 필터 ──
    const status = (p.get('status') || 'all').trim();
    if (!['all', 'success', 'failed'].includes(status)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'status는 success|failed|all 중 하나여야 합니다');
    }

    const search = (p.get('search') || '').trim();

    const page = Math.max(1, parseInt(p.get('page') || '1', 10));
    const limit = Math.max(
      1,
      Math.min(200, parseInt(p.get('limit') || '50', 10))
    );
    const offset = (page - 1) * limit;

    // ── ISO 범위: [dateFrom 00:00 KST, dateTo+1 00:00 KST) ──
    // KST 00:00 = UTC 전날 15:00
    const isoFrom = `${dateFrom}T00:00:00+09:00`;
    const toNext = new Date(`${dateTo}T00:00:00+09:00`);
    toNext.setDate(toNext.getDate() + 1);
    const isoToExclusive = toNext.toISOString();

    const supabase = await createClient();

    // ── 데이터 쿼리 ──
    let q = supabase
      .from('alimtalk_send_logs')
      .select(
        'id, sent_at, template_type, send_status, phone_masked, message_id, error_message, ticket_id, monthly_parking_id',
        { count: 'exact' }
      )
      .eq('org_id', ctx.orgId)
      .gte('sent_at', isoFrom)
      .lt('sent_at', isoToExclusive)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (template !== 'all') q = q.eq('template_type', template);
    if (status !== 'all') q = q.eq('send_status', status);
    if (search) {
      // phone_masked 또는 message_id 부분일치
      q = q.or(`phone_masked.ilike.%${search}%,message_id.ilike.%${search}%`);
    }

    const { data, count, error } = await q;

    if (error) {
      console.error('[v1/alimtalk/logs] 조회 오류:', error.message);
      return serverError('알림톡 로그 조회 중 오류가 발생했습니다');
    }

    // ── 요약 통계 (동일 기간 전체, 페이지네이션 무관) ──
    let sumQ = supabase
      .from('alimtalk_send_logs')
      .select('template_type, send_status')
      .eq('org_id', ctx.orgId)
      .gte('sent_at', isoFrom)
      .lt('sent_at', isoToExclusive);

    if (template !== 'all') sumQ = sumQ.eq('template_type', template);
    if (status !== 'all') sumQ = sumQ.eq('send_status', status);
    if (search) {
      sumQ = sumQ.or(
        `phone_masked.ilike.%${search}%,message_id.ilike.%${search}%`
      );
    }

    const { data: sumRows } = await sumQ;

    const byTemplate: Record<string, { total: number; success: number; failed: number }> = {};
    let totalCnt = 0;
    let successCnt = 0;
    let failedCnt = 0;

    (sumRows || []).forEach((r) => {
      totalCnt++;
      const t = r.template_type || 'unknown';
      if (!byTemplate[t]) byTemplate[t] = { total: 0, success: 0, failed: 0 };
      byTemplate[t].total++;
      if (r.send_status === 'success') {
        successCnt++;
        byTemplate[t].success++;
      } else {
        failedCnt++;
        byTemplate[t].failed++;
      }
    });

    const totalPages = Math.max(1, Math.ceil((count || 0) / limit));

    return ok({
      data: data || [],
      meta: {
        total: count || 0,
        page,
        limit,
        total_pages: totalPages,
        date_from: dateFrom,
        date_to: dateTo,
      },
      summary: {
        total: totalCnt,
        success: successCnt,
        failed: failedCnt,
        by_template: byTemplate,
      },
    });
  } catch (err) {
    console.error('[v1/alimtalk/logs] 예외:', err);
    return serverError('알림톡 로그 조회 중 오류가 발생했습니다');
  }
}
