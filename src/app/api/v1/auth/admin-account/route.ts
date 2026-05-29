/**
 * POST /api/v1/auth/admin-account
 * 관리자(admin/super_admin) 실이메일 계정 생성
 * 권한: MANAGE
 *
 * Body: { employee_id: string, email: string, password: string }
 *
 * crew/field_member 계정은 /api/v1/auth/create-account(내부이메일 자동) 사용.
 * 본 라우트는 관리자 역할 직원에게 실제 이메일 + 수동 비밀번호로 로그인 계정을 부여한다.
 *
 * 플로우:
 *   1. employees 조회(org 스코프) → role이 admin/super_admin인지 확인
 *   2. super_admin 계정 생성은 super_admin만 가능(권한 상승 방지)
 *   3. 이미 계정 있으면 conflict
 *   4. service-role로 Supabase Auth user 생성(email_confirm) + profiles upsert(employee_id 연결)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  requireAuth, ok, badRequest, conflict, forbidden, serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog, validateRequired } from '@/lib/api/helpers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();
    const { employee_id, email, password } = body;

    // 1. 입력 검증
    const errors = validateRequired(body, ['employee_id', 'email', 'password']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력하세요', errors);
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return badRequest(ErrorCodes.AUTH_INVALID_INPUT, '이메일 형식이 올바르지 않습니다');
    }
    if (String(password).length < 6) {
      return badRequest(ErrorCodes.AUTH_PASSWORD_TOO_SHORT, '비밀번호는 6자 이상이어야 합니다');
    }

    const supabase = await createClient();

    // 2. 직원 조회 (org 스코프)
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('id, emp_no, name, phone, role, status, org_id')
      .eq('id', employee_id)
      .eq('org_id', ctx.orgId)
      .single();

    if (empError || !emp) {
      return badRequest(ErrorCodes.EMP_NOT_FOUND, '직원 정보를 찾을 수 없습니다');
    }
    if (emp.status === '퇴사') {
      return badRequest(ErrorCodes.EMP_ALREADY_RESIGNED, '퇴사한 직원의 계정은 생성할 수 없습니다');
    }

    // 3. 역할 검증 — 본 라우트는 관리자 전용
    if (!['admin', 'super_admin'].includes(emp.role)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'crew/field 계정은 직원 계정 생성(내부 이메일)으로 발급하세요'
      );
    }
    // super_admin 생성은 super_admin만 (권한 상승 방지)
    if (emp.role === 'super_admin' && ctx.role !== 'super_admin') {
      return forbidden('최고관리자 계정 생성은 최고관리자만 가능합니다');
    }

    // 4. 이미 계정 존재 여부
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (existingProfile) {
      return conflict(ErrorCodes.AUTH_DUPLICATE_EMAIL, '이미 계정이 존재합니다');
    }

    // 5. Supabase Auth 계정 생성 (service_role)
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: emp.name },
    });

    if (authError || !authData?.user) {
      console.error('[Admin Account Auth Error]', authError);
      if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
        return conflict(ErrorCodes.AUTH_DUPLICATE_EMAIL, '이미 등록된 이메일입니다');
      }
      return serverError('계정 생성에 실패했습니다: ' + (authError?.message || ''));
    }

    // 6. profiles upsert (employee_id 연결) — service_role
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        org_id: ctx.orgId,
        role: emp.role,
        name: emp.name,
        emp_no: emp.emp_no,
        employee_id: emp.id,
        status: 'active',
        password_changed: false,
      });

    if (profileError) {
      console.error('[Admin Account Profile Error]', profileError);
      // Auth는 생성됨 → 로그만 남기고 계속(다음 로그인 시 프로필 보강 필요)
    }

    // 7. 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'profiles',
      recordId: authData.user.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: { employee_id: emp.id, email: normalizedEmail, role: emp.role, emp_no: emp.emp_no },
    });

    return ok({
      user_id: authData.user.id,
      email: normalizedEmail,
      emp_no: emp.emp_no,
      name: emp.name,
      role: emp.role,
      message: `${emp.name} 관리자 계정(${normalizedEmail})이 생성되었습니다`,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/admin-account]', err);
    return serverError();
  }
}
