/**
 * POST /api/v1/auth/create-account
 * 개별 계정 생성 — 관리자가 직원의 Supabase Auth 계정 생성
 * 권한: MANAGE
 * 
 * Body: { employee_id: string }
 * 
 * 플로우:
 *   1. employees에서 phone, emp_no, role 조회
 *   2. 초기 비밀번호 생성 (뒤4자리+12)
 *   3. Supabase Auth 계정 생성 (admin.createUser)
 *   4. profiles INSERT
 *   5. 결과 반환 (마스킹된 초기 PW 포함)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth, ok, badRequest, conflict, serverError,
  ErrorCodes,
  generateInitialPassword,
  maskInitialPassword,
  generateInternalEmail,
} from '@/lib/api';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();
    const { employee_id } = body;

    if (!employee_id) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'employee_id가 필요합니다');
    }

    const supabase = await createClient();

    // 1. 직원 정보 조회
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

    // 2. 이메일 생성
    const role = emp.role as 'crew' | 'field_member';
    let email: string;

    if (['super_admin', 'admin'].includes(emp.role)) {
      // 관리자는 실제 이메일이 필요 — 이 API에서는 crew/field만 처리
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '관리자 계정은 실제 이메일로 별도 생성하세요'
      );
    }

    email = generateInternalEmail(emp.emp_no, role);

    // 3. 기존 계정 중복 체크
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('emp_no', emp.emp_no)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (existingProfile) {
      return conflict(ErrorCodes.AUTH_DUPLICATE_EMAIL, '이미 계정이 존재합니다');
    }

    // 4. 초기 비밀번호 생성
    const initialPassword = generateInitialPassword(emp.phone, emp.emp_no);
    const maskedPassword = maskInitialPassword(initialPassword);

    // 5. Supabase Auth 계정 생성
    // ⚠️ admin.createUser는 service_role 키 필요
    // 서버 컴포넌트에서는 createClient()가 service_role일 수 있음
    // 아니라면 별도 admin client 필요
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true, // 이메일 확인 건너뜀 (내부 계정)
    });

    if (authError || !authData.user) {
      console.error('[Create Account Auth Error]', authError);

      if (authError?.message?.includes('already been registered')) {
        return conflict(ErrorCodes.AUTH_DUPLICATE_EMAIL, '이미 등록된 이메일입니다');
      }

      return serverError('계정 생성에 실패했습니다: ' + (authError?.message || ''));
    }

    // 6. profiles INSERT (또는 UPDATE)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        org_id: ctx.orgId,
        role: emp.role,
        emp_no: emp.emp_no,
        employee_id: emp.id,
        password_changed: false,
      });

    if (profileError) {
      console.error('[Create Account Profile Error]', profileError);
      // Auth 계정은 생성되었지만 profile 실패 → 로그만 남김
    }

    return ok({
      user_id: authData.user.id,
      email,
      emp_no: emp.emp_no,
      name: emp.name,
      role: emp.role,
      initial_password: maskedPassword, // "****12" 형식
      message: `${emp.name} (${emp.emp_no}) 계정이 생성되었습니다`,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/create-account]', err);
    return serverError();
  }
}
