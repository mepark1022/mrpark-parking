/**
 * GET  /api/v1/auth/me — 내 정보 (role, emp_no, stores)
 * PUT  /api/v1/auth/me — 내 비밀번호 변경
 * 권한: ALL (인증된 사용자 본인)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth, ok, badRequest, serverError,
  ErrorCodes, validatePassword,
} from '@/lib/api';

// ── GET: 내 정보 ──
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'SELF');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();

    // 프로필 정보
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, emp_no, employee_id, site_code, password_changed, last_login_at')
      .eq('id', ctx.userId)
      .single();

    // 배정 사업장 목록
    let stores: { store_id: string; store_name: string; is_primary: boolean }[] = [];
    if (profile?.employee_id) {
      const { data: members } = await supabase
        .from('store_members')
        .select('store_id, is_primary, stores(name)')
        .eq('employee_id', profile.employee_id)
        .eq('is_active', true);

      stores = (members ?? []).map((m: Record<string, unknown>) => ({
        store_id: m.store_id as string,
        store_name: (m.stores as Record<string, unknown>)?.name as string || '',
        is_primary: m.is_primary as boolean,
      }));
    }

    // 직원 정보 (있으면)
    let employee = null;
    if (profile?.employee_id) {
      const { data: emp } = await supabase
        .from('employees')
        .select('id, emp_no, name, position, role, status, hire_date')
        .eq('id', profile.employee_id)
        .single();
      employee = emp;
    }

    return ok({
      user_id: ctx.userId,
      org_id: ctx.orgId,
      role: profile?.role || ctx.role,
      emp_no: profile?.emp_no,
      password_changed: profile?.password_changed ?? false,
      last_login_at: profile?.last_login_at,
      employee,
      stores,
    });
  } catch (err) {
    console.error('[GET /api/v1/auth/me]', err);
    return serverError();
  }
}

// ── PUT: 비밀번호 변경 ──
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, 'SELF');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '현재 비밀번호와 새 비밀번호를 입력하세요');
    }

    // 새 비밀번호 검증
    const validation = validatePassword(new_password);
    if (!validation.valid) {
      return badRequest(ErrorCodes.AUTH_PASSWORD_TOO_SHORT, validation.message!);
    }

    const supabase = await createClient();

    // 현재 비밀번호 확인 (재인증)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return serverError('사용자 정보를 확인할 수 없습니다');
    }

    // 현재 PW로 재로그인하여 검증
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });

    if (verifyError) {
      return badRequest(ErrorCodes.AUTH_WRONG_PASSWORD, '현재 비밀번호가 올바르지 않습니다');
    }

    // 비밀번호 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (updateError) {
      console.error('[Password Update Error]', updateError);
      return serverError('비밀번호 변경에 실패했습니다');
    }

    // password_changed 플래그 갱신
    await supabase
      .from('profiles')
      .update({ password_changed: true })
      .eq('id', ctx.userId);

    return ok({ message: '비밀번호가 변경되었습니다' });
  } catch (err) {
    console.error('[PUT /api/v1/auth/me]', err);
    return serverError();
  }
}
