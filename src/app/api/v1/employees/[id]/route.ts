/**
 * 미팍 통합앱 v2 — Employee 상세 API
 * GET    /api/v1/employees/:id   상세 조회
 * PUT    /api/v1/employees/:id   수정
 * DELETE /api/v1/employees/:id   논리삭제 (status → 퇴사)
 * 
 * 권한: MANAGE (GET은 SELF도 본인 데이터 허용)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  notFound,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import {
  canAccessSelfOrManage,
  writeAuditLog,
} from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET: 직원 상세 ──
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SELF도 본인 조회 가능하도록 OPERATE 레벨로 체크 후 SELF 검증
  const auth = await requireAuth(request, 'SELF');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    // SELF 권한: 본인이 아니면 MANAGE 필요
    if (!canAccessSelfOrManage(ctx, employee.id)) {
      // MANAGE 재검증
      const authManage = await requireAuth(request, 'MANAGE');
      if (authManage.error) return authManage.error;
    }

    // 사업장 배정 정보 함께 조회
    const { data: storeMembers } = await supabase
      .from('store_members')
      .select('store_id, is_primary, is_active, assigned_at')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    // 계정 정보 (있으면)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, password_changed, last_login_at, login_fail_count, locked_until')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    return ok({
      ...employee,
      store_members: storeMembers ?? [],
      account: profile
        ? {
            user_id: profile.id,
            role: profile.role,
            password_changed: profile.password_changed,
            last_login_at: profile.last_login_at,
            is_locked: profile.locked_until
              ? new Date(profile.locked_until) > new Date()
              : false,
          }
        : null,
    });
  } catch (err) {
    console.error('[Employee Detail]', err);
    return serverError('직원 상세 조회 중 오류');
  }
}

// ── PUT: 직원 수정 ──
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    // 기존 데이터 조회
    const { data: before, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !before) {
      return notFound('직원을 찾을 수 없습니다');
    }

    // 사번 변경 시 중복 확인
    if (body.emp_no && body.emp_no.toUpperCase() !== before.emp_no) {
      const { data: dup } = await supabase
        .from('employees')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('emp_no', body.emp_no.toUpperCase())
        .neq('id', id)
        .maybeSingle();

      if (dup) {
        return conflict(ErrorCodes.EMP_DUPLICATE_NO, '사번이 중복됩니다');
      }
    }

    // 수정 가능 필드만 추출
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'emp_no', 'name', 'phone', 'position', 'role', 'work_type',
      'employment_type', 'base_salary', 'weekend_daily',
      'probation_months', 'probation_end',
      'insurance_national', 'insurance_health', 'insurance_employ', 'insurance_injury',
      'tax_type', 'bank_name', 'bank_account', 'bank_holder',
      'region', 'memo',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'emp_no' ? body[field].toUpperCase() : body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 항목이 없습니다');
    }

    const { data: updated, error: updateError } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updateError) {
      console.error('[Employee Update]', updateError);
      return serverError('직원 수정 실패');
    }

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: before,
      afterData: updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[Employee Update]', err);
    return serverError('직원 수정 중 오류');
  }
}

// ── DELETE: 논리삭제 (status → 퇴사) ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    if (employee.status === '퇴사') {
      return conflict(ErrorCodes.EMP_ALREADY_RESIGNED, '이미 퇴사 처리된 직원입니다');
    }

    // 간단한 논리삭제 (퇴사 워크플로우는 /resign 라우트에서)
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('employees')
      .update({
        status: '퇴사',
        resign_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        status_changed_at: now,
        status_changed_by: ctx.userId,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      console.error('[Employee Delete]', error);
      return serverError('퇴사 처리 실패');
    }

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: employee,
      afterData: updated,
      reason: '논리삭제 (DELETE → 퇴사)',
    });

    return ok({ message: '퇴사 처리 완료', employee: updated });
  } catch (err) {
    console.error('[Employee Delete]', err);
    return serverError('퇴사 처리 중 오류');
  }
}
