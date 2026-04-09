/**
 * POST /api/v1/auth/logout
 * 로그아웃
 * 권한: ALL (인증된 사용자)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, serverError } from '@/lib/api';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return ok({ message: '로그아웃 되었습니다' });
  } catch (err) {
    console.error('[POST /api/v1/auth/logout]', err);
    return serverError('로그아웃 처리 중 오류가 발생했습니다');
  }
}
