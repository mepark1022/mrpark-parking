/**
 * 미팍 통합앱 v2 — 현장일보 근무인원 수정 API
 * PUT /api/v1/daily-reports/:id/staff   근무인원 전체 교체 (MANAGE)
 *
 * 본문: { staff: StaffInput[], reason?: string }
 *   - 전체 교체 방식: 기존 daily_report_staff 삭제 → 새 배열 insert
 *   - before/after를 audit_logs에 기록 (근태 재계산 트리거 용도)
 *
 * 권한: MANAGE만 (관리자 직권 수정, confirmed 상태여도 허용)
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
import type { DailyReportStaffType } from '@/lib/api/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface StaffInput {
  employee_id: string;
  staff_type: DailyReportStaffType;
  role?: string;
  check_in?: string;
  check_out?: string;
  work_hours?: number;
  memo?: string;
}

const ALLOWED_STAFF_TYPES: DailyReportStaffType[] = [
  'regular', 'peak', 'support', 'part_time', 'off_duty', 'additional',
];

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;
    const staffList: StaffInput[] = Array.isArray(body?.staff) ? body.staff : [];

    // 검증
    for (const s of staffList) {
      if (!s.employee_id || !s.staff_type) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'staff 각 항목은 employee_id, staff_type 필수'
        );
      }
      if (!ALLOWED_STAFF_TYPES.includes(s.staff_type)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `유효하지 않은 staff_type: ${s.staff_type}`
        );
      }
    }

    const supabase = await createClient();

    // 일보 존재 확인
    const { data: report, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('id, org_id, store_id, report_date, status')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id/staff] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    if (!report) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // 기존 staff 조회 (audit before)
    const { data: beforeStaff, error: beforeErr } = await supabase
      .from('daily_report_staff')
      .select('*')
      .eq('report_id', id)
      .eq('org_id', ctx.orgId);

    if (beforeErr) {
      console.error('[v1/daily-reports/:id/staff] before:', beforeErr.message);
      return serverError('근무인원 조회 중 오류가 발생했습니다');
    }

    // 기존 삭제
    const { error: delErr } = await supabase
      .from('daily_report_staff')
      .delete()
      .eq('report_id', id)
      .eq('org_id', ctx.orgId);

    if (delErr) {
      console.error('[v1/daily-reports/:id/staff] delete:', delErr.message);
      return serverError('기존 근무인원 삭제 중 오류가 발생했습니다');
    }

    // 새 배열 insert
    let afterStaff: unknown[] = [];
    if (staffList.length > 0) {
      const rows = staffList.map(s => ({
        org_id: ctx.orgId,
        report_id: id,
        employee_id: s.employee_id,
        staff_type: s.staff_type,
        role: s.role ?? null,
        check_in: s.check_in ?? null,
        check_out: s.check_out ?? null,
        work_hours: s.work_hours ?? null,
        memo: s.memo ?? null,
      }));
      const { data: inserted, error: insErr } = await supabase
        .from('daily_report_staff')
        .insert(rows)
        .select();

      if (insErr) {
        console.error('[v1/daily-reports/:id/staff] insert:', insErr.message);
        return serverError('근무인원 저장 중 오류가 발생했습니다');
      }
      afterStaff = inserted ?? [];
    }

    // audit_logs에 전체 before/after 기록 (근태 재계산 트리거 훅)
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'daily_report_staff',
      recordId: id, // 일보 id 기준으로 집계
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { report_id: id, staff: beforeStaff ?? [] },
      afterData: { report_id: id, staff: afterStaff },
      reason: reason || '관리자 근무인원 수정',
    });

    return ok({
      report_id: id,
      staff_count: afterStaff.length,
      staff: afterStaff,
    });
  } catch (err) {
    console.error('[v1/daily-reports/:id/staff] 서버 오류:', err);
    return serverError('근무인원 수정 중 오류가 발생했습니다');
  }
}
