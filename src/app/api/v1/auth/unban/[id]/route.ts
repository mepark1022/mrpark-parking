/**
 * POST /api/v1/auth/unban/[id]
 * 정지 해제 — 관리자가 정지된 계정 복구
 * 권한: MANAGE
 * [id] = employee_id
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, ok, notFound, serverError } from '@/lib/api';

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, emp_no')
      .eq('employee_id', employeeId)
      .eq('org_id', ctx.orgId)
      .single();

    if (!profile) {
      return notFound('해당 직원의 계정을 찾을 수 없습니다');
    }

    // Supabase Auth unban
    const { error: unbanError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { ban_duration: 'none' }
    );

    if (unbanError) {
      console.error('[Unban Error]', unbanError);
      return serverError('정지 해제에 실패했습니다');
    }

    return ok({
      emp_no: profile.emp_no,
      message: '계정 정지가 해제되었습니다',
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/unban]', err);
    return serverError();
  }
}
