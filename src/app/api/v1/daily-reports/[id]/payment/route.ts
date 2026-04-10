/**
 * 미팍 통합앱 v2 — 현장일보 결제매출 수정 API
 * PUT /api/v1/daily-reports/:id/payment   결제매출 전체 교체 (MANAGE)
 *
 * 본문: { payment: PaymentInput[], reason?: string }
 *   - 전체 교체: 기존 daily_report_payment 삭제 → 새 배열 insert
 *   - daily_reports.total_revenue / valet_count 자동 재계산
 *   - audit_logs에 전체 before/after 기록
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
import type { DailyReportPaymentMethod } from '@/lib/api/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PaymentInput {
  method: DailyReportPaymentMethod;
  amount: number;
  count?: number;
  memo?: string;
}

const ALLOWED_PAYMENT_METHODS: DailyReportPaymentMethod[] = [
  'card', 'cash', 'valet_fee', 'monthly', 'free', 'transfer', 'other',
];

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;
    const paymentList: PaymentInput[] = Array.isArray(body?.payment) ? body.payment : [];

    // 검증
    for (const p of paymentList) {
      if (!p.method || !ALLOWED_PAYMENT_METHODS.includes(p.method)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `유효하지 않은 payment.method: ${p.method}`
        );
      }
      if (typeof p.amount !== 'number' || p.amount < 0) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'payment.amount는 0 이상의 숫자여야 합니다'
        );
      }
    }

    const supabase = await createClient();

    // 일보 존재 확인
    const { data: report, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('id, org_id, total_revenue, valet_count')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id/payment] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    if (!report) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // 기존 payment 조회
    const { data: beforePayment, error: beforeErr } = await supabase
      .from('daily_report_payment')
      .select('*')
      .eq('report_id', id)
      .eq('org_id', ctx.orgId);

    if (beforeErr) {
      console.error('[v1/daily-reports/:id/payment] before:', beforeErr.message);
      return serverError('결제매출 조회 중 오류가 발생했습니다');
    }

    // 기존 삭제
    const { error: delErr } = await supabase
      .from('daily_report_payment')
      .delete()
      .eq('report_id', id)
      .eq('org_id', ctx.orgId);

    if (delErr) {
      console.error('[v1/daily-reports/:id/payment] delete:', delErr.message);
      return serverError('기존 결제매출 삭제 중 오류가 발생했습니다');
    }

    // 새 배열 insert
    let afterPayment: unknown[] = [];
    if (paymentList.length > 0) {
      const rows = paymentList.map(p => ({
        org_id: ctx.orgId,
        report_id: id,
        method: p.method,
        amount: p.amount,
        count: p.count ?? 0,
        memo: p.memo ?? null,
      }));
      const { data: inserted, error: insErr } = await supabase
        .from('daily_report_payment')
        .insert(rows)
        .select();

      if (insErr) {
        console.error('[v1/daily-reports/:id/payment] insert:', insErr.message);
        return serverError('결제매출 저장 중 오류가 발생했습니다');
      }
      afterPayment = inserted ?? [];
    }

    // 마스터 집계 재계산 (total_revenue, valet_count)
    const totalRevenue = paymentList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const valetCount = paymentList.find(p => p.method === 'valet_fee')?.count ?? 0;

    const { data: updatedReport, error: updErr } = await supabase
      .from('daily_reports')
      .update({ total_revenue: totalRevenue, valet_count: valetCount })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updErr) {
      console.error('[v1/daily-reports/:id/payment] master update:', updErr.message);
      return serverError('매출 집계 갱신 중 오류가 발생했습니다');
    }

    // audit
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'daily_report_payment',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: {
        report_id: id,
        payment: beforePayment ?? [],
        total_revenue: report.total_revenue,
        valet_count: report.valet_count,
      },
      afterData: {
        report_id: id,
        payment: afterPayment,
        total_revenue: totalRevenue,
        valet_count: valetCount,
      },
      reason: reason || '관리자 결제매출 수정',
    });

    return ok({
      report_id: id,
      payment_count: afterPayment.length,
      payment: afterPayment,
      total_revenue: totalRevenue,
      valet_count: valetCount,
      report: updatedReport,
    });
  } catch (err) {
    console.error('[v1/daily-reports/:id/payment] 서버 오류:', err);
    return serverError('결제매출 수정 중 오류가 발생했습니다');
  }
}
