/**
 * 미팍 통합앱 v2 — Service Role Supabase 클라이언트
 *
 * ⚠️ 용도: `auth.admin.*`(createUser/updateUserById 등) 및 타 사용자 row 직접 쓰기 전용.
 *   - 일반 조회/세션 기반 RLS 작업은 `@/lib/supabase/server`의 createClient() 사용.
 *   - 본 클라이언트는 RLS를 우회하므로, 호출부에서 반드시 org_id 스코프를
 *     명시적으로 필터링하고, 권한(requireAuth)을 먼저 검증한 뒤에만 사용한다.
 *
 * 배경: `@/lib/supabase/server`는 anon 키 + 세션 쿠키 기반이라
 *   gotrue admin 엔드포인트(`/auth/v1/admin/*`)를 호출할 수 없다(403 User not allowed).
 *   admin API는 service_role JWT가 필요하다.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service-role 환경변수가 없습니다 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    );
  }

  // 서버 런타임에서만 재사용 (세션/토큰 자동갱신 비활성)
  if (!cached) {
    cached = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
