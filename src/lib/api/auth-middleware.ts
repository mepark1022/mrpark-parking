/**
 * 미팍 통합앱 v2 — 인증/권한 미들웨어
 * 
 * 모든 /api/v1/* 라우트에서 사용:
 *   const auth = await requireAuth(request, 'MANAGE');
 *   if (auth.error) return auth.error;
 *   const { ctx } = auth; // AuthContext
 * 
 * 권한 흐름:
 *   1. Supabase 세션 → userId
 *   2. profiles → role, org_id
 *   3. role vs required permission → 허용/거부
 *   4. crew/field → store_members에서 접근 가능 store_id 목록
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext, PermissionLevel, UserRole } from './types';
import { ROLE_HIERARCHY } from './types';
import { unauthorized, forbidden, serverError, tooMany } from './response';
import { ErrorCodes } from './errors';

// ── 결과 타입 ──
type AuthResult =
  | { ctx: AuthContext; error?: never }
  | { ctx?: never; error: NextResponse };

/**
 * 인증 + 권한 확인
 * @param request - Next.js 요청
 * @param required - 필요 권한 레벨 (기본: 'PUBLIC')
 * @returns AuthContext 또는 에러 응답
 */
export async function requireAuth(
  request: NextRequest,
  required: PermissionLevel = 'PUBLIC'
): Promise<AuthResult> {
  // PUBLIC은 인증 불필요
  if (required === 'PUBLIC') {
    return { ctx: createPublicContext() };
  }

  // CRON은 시크릿 검증
  if (required === 'CRON') {
    return validateCronSecret(request);
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: unauthorized('로그인이 필요합니다') };
    }

    // profiles 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { error: unauthorized('프로필 정보를 찾을 수 없습니다') };
    }

    const role = profile.role as UserRole;

    // 잠금 상태 확인
    if (profile.locked_until) {
      const lockedUntil = new Date(profile.locked_until);
      if (lockedUntil > new Date()) {
        const remainSec = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        return {
          error: tooMany(`계정이 잠겨 있습니다. ${remainSec}초 후 다시 시도하세요`),
        };
      }
    }

    // 권한 확인
    if (!checkPermission(role, required)) {
      return { error: forbidden('이 작업에 대한 권한이 없습니다') };
    }

    // 사업장 범위 조회 (crew/field만)
    let storeIds: string[] | undefined;
    if (['crew', 'field_member'].includes(role)) {
      storeIds = await getAssignedStoreIds(supabase, user.id, profile.org_id);
    }

    const ctx: AuthContext = {
      userId: user.id,
      orgId: profile.org_id,
      role,
      empNo: profile.emp_no || undefined,
      employeeId: profile.employee_id || undefined,
      siteCode: profile.site_code || undefined,
      storeIds,
    };

    return { ctx };
  } catch (err) {
    console.error('[Auth Middleware]', err);
    return { error: serverError('인증 처리 중 오류가 발생했습니다') };
  }
}

/**
 * 역할이 요구 권한을 만족하는지 확인
 */
export function checkPermission(userRole: UserRole, required: PermissionLevel): boolean {
  if (required === 'PUBLIC') return true;
  if (required === 'CRON') return false; // CRON은 별도 검증
  return ROLE_HIERARCHY[userRole]?.includes(required) ?? false;
}

/**
 * crew/field_member → 배정된 사업장 ID 목록 조회
 */
async function getAssignedStoreIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string
): Promise<string[]> {
  // profiles.employee_id로 store_members 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_id')
    .eq('id', userId)
    .single();

  if (!profile?.employee_id) return [];

  const { data: members } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('employee_id', profile.employee_id)
    .eq('org_id', orgId)
    .eq('is_active', true);

  return members?.map((m: { store_id: string }) => m.store_id) ?? [];
}

/**
 * 사업장 범위 필터 (쿼리에 적용)
 * super_admin/admin → 전체 / crew/field → 배정 사업장만
 */
export function getScopeFilter(ctx: AuthContext): { store_id?: string[] } {
  if (['super_admin', 'admin'].includes(ctx.role)) {
    return {}; // 전체 접근
  }
  return { store_id: ctx.storeIds ?? [] };
}

/**
 * 특정 store_id 접근 가능 여부
 */
export function canAccessStore(ctx: AuthContext, storeId: string): boolean {
  if (['super_admin', 'admin'].includes(ctx.role)) return true;
  return ctx.storeIds?.includes(storeId) ?? false;
}

/**
 * PUBLIC 컨텍스트 (비인증 요청용)
 */
function createPublicContext(): AuthContext {
  return {
    userId: '',
    orgId: '',
    role: 'field_member', // 최소 권한
  };
}

/**
 * CRON 시크릿 검증
 */
function validateCronSecret(request: NextRequest): AuthResult {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return { error: unauthorized('Cron 인증 실패') };
  }

  return {
    ctx: {
      userId: 'cron',
      orgId: 'cron',
      role: 'super_admin',
    },
  };
}
