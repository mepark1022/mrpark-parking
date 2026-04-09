/**
 * POST /api/v1/auth/reset-password/[id]
 * 비밀번호 초기화 — 관리자가 특정 직원의 비밀번호를 초기값으로 리셋
 * 권한: MANAGE
 * 
 * [id] = employee_id
 * 
 * 결과: 비밀번호 → 전화번호 뒤4자리 + "12"로 초기화
 *       password_changed → false
 *       login_fail_count → 0, locked_until → null
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth, ok, badRequest, notFound, serverError,
  ErrorCodes,
  generateInitialPassword,
  maskInitialPassword,
} from '@/lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id: employeeId } = await params;

    const supabase = await createClient();

    // 1. 직원 조회
    const { data: emp } = await supabase
      .from('employees')
      .select('id, emp_no, phone, name, org_id')
      .eq('id', employeeId)
      .eq('org_id', ctx.orgId)
      .single();

    if (!emp) {
      return notFound('직원 정보를 찾을 수 없습니다');
    }

    // 2. profiles에서 auth user_id 찾기
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('org_id', ctx.orgId)
      .single();

    if (!profile) {
      return badRequest(ErrorCodes.AUTH_ACCOUNT_NOT_FOUND, '해당 직원의 계정이 아직 생성되지 않았습니다');
    }

    // 3. 초기 비밀번호 재생성
    const newPassword = generateInitialPassword(emp.phone, emp.emp_no);
    const maskedPassword = maskInitialPassword(newPassword);

    // 4. Supabase Auth 비밀번호 변경
    const { error: authError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (authError) {
      console.error('[Reset Password Auth Error]', authError);
      return serverError('비밀번호 초기화에 실패했습니다');
    }

    // 5. profiles 갱신
    await supabase
      .from('profiles')
      .update({
        password_changed: false,
        login_fail_count: 0,
        locked_until: null,
      })
      .eq('id', profile.id);

    return ok({
      emp_no: emp.emp_no,
      name: emp.name,
      masked_password: maskedPassword,
      message: `${emp.name}의 비밀번호가 [${maskedPassword}]로 초기화되었습니다`,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/reset-password]', err);
    return serverError();
  }
}
