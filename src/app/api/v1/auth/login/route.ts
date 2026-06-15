/**
 * POST /api/v1/auth/login
 * 통합 로그인 — 전화번호 기반 단일화 (P0 파트2, 2026.06.15 대표 확정)
 * 권한: PUBLIC
 *
 * Body: { identifier: string, password: string }
 *
 * 플로우:
 *   1. 입력값 정규화 + 유형 판별 (EMAIL/PHONE/EMPNO)
 *   2. EMAIL  → super_admin(대표) 이메일 예비 경로
 *   3. PHONE  → employees 조회(퇴사·중복 차단) → {전화}@mepark.internal 직접 인증
 *   4. EMPNO  → 폐기. "전화번호로 로그인하세요" 안내
 *   5. 성공 → 실패 카운트 초기화 + last_login_at 갱신
 *
 * 변경점(파트2):
 *   - 내부이메일 규칙 {사번}@ → {전화}@mepark.internal (generateInternalEmail)
 *   - 전화→사번 우회 제거, 전화로 곧장 인증
 *   - 관리자도 전화 로그인 허용(이메일은 예비 경로로 유지)
 *   - 전제: employees.phone 은 정규화(숫자만) 저장 — .eq 매칭용
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ok, badRequest, unauthorized, serverError,
  ErrorCodes,
  detectLoginInputType,
  normalizePhone,
  generateInternalEmail,
} from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '아이디와 비밀번호를 입력하세요');
    }

    const trimmed = identifier.trim();
    const inputType = detectLoginInputType(trimmed);

    if (!inputType) {
      return badRequest(
        ErrorCodes.AUTH_INVALID_INPUT,
        '전화번호로 로그인하세요'
      );
    }

    const supabase = await createClient();

    // ── EMAIL 모드 — super_admin(대표) 예비 경로 ──
    if (inputType === 'EMAIL') {
      return await handleEmailLogin(supabase, trimmed, password);
    }

    // ── EMPNO 모드 — 폐기. 전화 로그인으로 안내 ──
    if (inputType === 'EMPNO') {
      return badRequest(
        ErrorCodes.AUTH_INVALID_INPUT,
        '사번 로그인은 더 이상 지원하지 않습니다. 전화번호로 로그인하세요'
      );
    }

    // ── PHONE 모드 — 전화 직접 인증 ──
    return await handlePhoneLogin(supabase, normalizePhone(trimmed), password);

  } catch (err) {
    console.error('[POST /api/v1/auth/login]', err);
    return serverError('로그인 처리 중 오류가 발생했습니다');
  }
}

// ── 이메일 로그인 (관리자 예비 경로) ──
async function handleEmailLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  await onLoginSuccess(supabase, data.user.id);

  const profile = await getProfile(supabase, data.user.id);
  return ok({
    user_id: data.user.id,
    role: profile?.role || 'crew',
    emp_no: profile?.emp_no,
    password_changed: profile?.password_changed ?? false,
    redirect: getRedirectPath(profile?.role ?? undefined),
  });
}

// ── 전화번호 로그인 (crew·관리자 공통) ──
async function handlePhoneLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string,
  password: string
) {
  // employees에서 전화로 조회 — 퇴사 차단 + 중복 차단 (role 무관: 관리자도 허용)
  const { data: matches } = await supabase
    .from('employees')
    .select('id, emp_no, role, status')
    .eq('phone', phone)
    .neq('status', '퇴사');

  if (!matches || matches.length === 0) {
    return badRequest(ErrorCodes.AUTH_PHONE_NOT_FOUND, '등록되지 않은 전화번호입니다');
  }

  if (matches.length > 1) {
    // 전화번호 = 로그인 ID 이므로 유일성 위반. 정본(2.0)에서 정리 필요
    return badRequest(ErrorCodes.AUTH_PHONE_MULTIPLE, '동일 번호가 여러 명입니다. 관리자에게 문의하세요');
  }

  const emp = matches[0];

  // 내부 인증 이메일 = {전화}@mepark.internal
  const internalEmail = generateInternalEmail(phone);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error || !data.user) {
    return unauthorized(
      '비밀번호가 올바르지 않습니다. 초기 비밀번호: 전화번호 뒤4자리+12'
    );
  }

  await onLoginSuccess(supabase, data.user.id);

  const profile = await getProfile(supabase, data.user.id);
  return ok({
    user_id: data.user.id,
    role: profile?.role || emp.role,
    emp_no: profile?.emp_no || emp.emp_no,
    password_changed: profile?.password_changed ?? false,
    redirect: getRedirectPath(profile?.role || emp.role),
  });
}

// ── 로그인 성공 처리 ──
async function onLoginSuccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  try {
    await supabase
      .from('profiles')
      .update({
        last_login_at: new Date().toISOString(),
        login_fail_count: 0,
        locked_until: null,
      })
      .eq('id', userId);
  } catch (err) {
    console.error('[onLoginSuccess]', err);
  }
}

// ── 프로필 조회 ──
async function getProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from('profiles')
    .select('role, emp_no, password_changed, site_code')
    .eq('id', userId)
    .single();
  return data;
}

// ── 역할별 리다이렉트 경로 ──
function getRedirectPath(role?: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/v2/dashboard';
    case 'crew':
      return '/'; // crew.mepark.kr 루트
    case 'field_member':
      return '/'; // crew.mepark.kr 제한모드
    default:
      return '/v2/dashboard';
  }
}
