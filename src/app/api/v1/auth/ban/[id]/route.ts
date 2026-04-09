/**
 * POST /api/v1/auth/ban/[id]
 * 계정 정지 — 관리자가 특정 직원의 로그인 차단
 * 권한: MANAGE
 * [id] = employee_id
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, ok, notFound, serverError, ErrorCodes, badRequest } from '@/lib/api';

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

    // profiles에서 auth user_id 찾기
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, emp_no')
      .eq('employee_id', employeeId)
      .eq('org_id', ctx.orgId)
      .single();

    if (!profile) {
      return notFound('해당 직원의 계정을 찾을 수 없습니다');
    }

    // 자기 자신 정지 방지
    if (profile.id === ctx.userId) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '본인 계정은 정지할 수 없습니다');
    }

    // Supabase Auth ban
    const { error: banError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { ban_duration: '876000h' } // ~100년 (영구 정지)
    );

    if (banError) {
      console.error('[Ban Error]', banError);
      return serverError('계정 정지에 실패했습니다');
    }

    return ok({
      emp_no: profile.emp_no,
      message: '계정이 정지되었습니다',
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/ban]', err);
    return serverError();
  }
}
