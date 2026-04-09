/**
 * 미팍 통합앱 v2 — 복직 처리 API
 * POST /api/v1/employees/:id/reinstate
 * 
 * 퇴사 취소 + Auth unban + store_members 재활성화
 * 권한: SYSTEM (super_admin만)
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
    const body = await request.json().catch(() => ({}));
    const supabase = await createClient();

    // 직원 조회
    const { data: employee, error: fetchErr } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchErr || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    if (employee.status !== '퇴사') {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '퇴사 상태가 아닌 직원은 복직할 수 없습니다');
    }

    const now = new Date().toISOString();
    const newStatus = body.status || '재직';
    const impacts: Record<string, unknown> = {};

    // 1. employees 상태 변경
    const { error: updateErr } = await supabase
      .from('employees')
      .update({
        status: newStatus,
        resign_date: null,
        status_changed_at: now,
        status_changed_by: ctx.userId,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateErr) {
      console.error('[Reinstate] employees 업데이트 실패:', updateErr);
      return serverError('복직 처리 실패');
    }

    // 2. Auth unban
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (profile) {
      const { error: unbanErr } = await supabase.auth.admin.updateUserById(
        profile.id,
        { ban_duration: 'none' }
      );

      impacts.auth_unban = unbanErr ? 'failed' : 'success';
    } else {
      impacts.auth_unban = 'no_account';
    }

    // 3. store_members 재활성화 (body.store_ids 지정 또는 이전 배정 복구)
    if (body.store_ids && Array.isArray(body.store_ids)) {
      // 지정된 사업장으로 배정
      for (const storeId of body.store_ids) {
        await supabase.from('store_members').upsert({
          org_id: ctx.orgId,
          employee_id: id,
          store_id: storeId,
          is_primary: body.store_ids.indexOf(storeId) === 0,
          is_active: true,
          assigned_by: ctx.userId,
        }, { onConflict: 'org_id,employee_id,store_id' });
      }
      impacts.store_assignments = body.store_ids.length;
    } else {
      // 이전 배정 복구
      const { data: restored } = await supabase
        .from('store_members')
        .update({ is_active: true })
        .eq('employee_id', id)
        .eq('org_id', ctx.orgId)
        .eq('is_active', false)
        .select('store_id');

      impacts.store_restored = restored?.length ?? 0;
    }

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { status: '퇴사', resign_date: employee.resign_date },
      afterData: { status: newStatus, resign_date: null },
      reason: body.reason || '복직 처리',
    });

    return ok({
      message: '복직 처리 완료',
      employee_id: id,
      emp_no: employee.emp_no,
      name: employee.name,
      new_status: newStatus,
      impacts,
    });
  } catch (err) {
    console.error('[Reinstate]', err);
    return serverError('복직 처리 중 오류');
  }
}
