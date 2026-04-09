/**
 * 미팍 통합앱 v2 — 퇴사 처리 API
 * POST /api/v1/employees/:id/resign
 * 
 * 연쇄 처리:
 *   1. employees.status → '퇴사' + resign_date
 *   2. Auth 계정 ban (즉시 로그인 차단)
 *   3. store_members 비활성화
 *   4. 감사 로그 기록
 * 
 * 권한: MANAGE
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  notFound,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const resignDate = body.resign_date || new Date().toISOString().split('T')[0];
    const reason = body.reason || '퇴사 처리';

    const supabase = await createClient();

    // 1. 직원 조회
    const { data: employee, error: fetchErr } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchErr || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    if (employee.status === '퇴사') {
      return conflict(ErrorCodes.EMP_ALREADY_RESIGNED, '이미 퇴사 처리된 직원입니다');
    }

    const now = new Date().toISOString();
    const impacts: Record<string, unknown> = {};

    // 2. employees 상태 변경
    const { error: updateErr } = await supabase
      .from('employees')
      .update({
        status: '퇴사',
        resign_date: resignDate,
        status_changed_at: now,
        status_changed_by: ctx.userId,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateErr) {
      console.error('[Resign] employees update 실패:', updateErr);
      return serverError('퇴사 처리 실패 (employees)');
    }

    // 3. Auth 계정 ban (profiles에서 user_id 찾기)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (profile) {
      // Supabase Admin API로 사용자 ban
      const { error: banErr } = await supabase.auth.admin.updateUserById(
        profile.id,
        { ban_duration: '876000h' } // ~100년 = 영구 ban
      );

      if (banErr) {
        console.error('[Resign] Auth ban 실패:', banErr);
        // ban 실패해도 퇴사 처리는 계속 (경고만)
        impacts.auth_ban = 'failed';
      } else {
        impacts.auth_ban = 'success';
      }
    } else {
      impacts.auth_ban = 'no_account';
    }

    // 4. store_members 비활성화
    const { data: deactivated, error: smErr } = await supabase
      .from('store_members')
      .update({ is_active: false })
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .select('store_id');

    if (smErr) {
      console.error('[Resign] store_members 비활성화 실패:', smErr);
      impacts.store_members = 'failed';
    } else {
      impacts.store_members = deactivated?.length ?? 0;
    }

    // 5. 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { status: employee.status, resign_date: employee.resign_date },
      afterData: { status: '퇴사', resign_date: resignDate },
      reason: `퇴사 처리: ${reason}`,
    });

    return ok({
      message: '퇴사 처리 완료',
      employee_id: id,
      emp_no: employee.emp_no,
      name: employee.name,
      resign_date: resignDate,
      impacts,
    });
  } catch (err) {
    console.error('[Resign]', err);
    return serverError('퇴사 처리 중 오류');
  }
}
