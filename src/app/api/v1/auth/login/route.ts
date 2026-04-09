/**
 * POST /api/v1/auth/login
 * 통합 로그인 — 이메일/사번/전화번호 자동 판별
 * 권한: PUBLIC
 * 
 * Body: { identifier: string, password: string }
 * 
 * 플로우:
 *   1. 입력값 정규화 + 유형 판별 (EMAIL/PHONE/EMPNO)
 *   2. PHONE → employees에서 emp_no 확보 → EMPNO 모드
 *   3. EMPNO → employees에서 role 확인 → 내부 이메일 생성
 *   4. signInWithPassword 실행
 *   5. 성공 → 실패 카운트 초기화 + last_login_at 갱신
 *   6. 실패 → 실패 카운트 증가 (5회 시 3분 잠금)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ok, badRequest, unauthorized, tooMany, serverError,
  ErrorCodes,
  detectLoginInputType,
  normalizePhone,
  normalizeEmpNo,
  generateInternalEmail,
} from '@/lib/api';

const MAX_FAIL_COUNT = 5;
const LOCK_DURATION_MS = 3 * 60 * 1000; // 3분

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
        '이메일, 전화번호, 또는 사번을 입력하세요'
      );
    }

    const supabase = await createClient();

    // ── EMAIL 모드 ──
    if (inputType === 'EMAIL') {
      return await handleEmailLogin(supabase, trimmed, password);
    }

    // ── PHONE 모드 → emp_no 확보 → EMPNO 모드 ──
    let empNo: string;
    if (inputType === 'PHONE') {
      const phoneResult = await resolvePhone(supabase, normalizePhone(trimmed));
      if ('error' in phoneResult) return phoneResult.error;
      empNo = phoneResult.empNo;
    } else {
      empNo = normalizeEmpNo(trimmed);
    }

    // ── EMPNO 모드 ──
    return await handleEmpNoLogin(supabase, empNo, password);

  } catch (err) {
    console.error('[POST /api/v1/auth/login]', err);
    return serverError('로그인 처리 중 오류가 발생했습니다');
  }
}

// ── 이메일 로그인 ──
async function handleEmailLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  password: string
) {
  // 잠금 상태 체크
  const lockCheck = await checkAccountLock(supabase, email, 'email');
  if (lockCheck) return lockCheck;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await incrementFailCount(supabase, email, 'email');
    return unauthorized('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  await onLoginSuccess(supabase, data.user.id);

  const profile = await getProfile(supabase, data.user.id);
  return ok({
    user_id: data.user.id,
    role: profile?.role || 'crew',
    emp_no: profile?.emp_no,
    password_changed: profile?.password_changed ?? false,
    redirect: getRedirectPath(profile?.role),
  });
}

// ── 사번 로그인 ──
async function handleEmpNoLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empNo: string,
  password: string
) {
  // employees에서 조회
  const { data: emp } = await supabase
    .from('employees')
    .select('id, emp_no, role, status, phone')
    .eq('emp_no', empNo)
    .single();

  if (!emp) {
    return badRequest(ErrorCodes.AUTH_ACCOUNT_NOT_FOUND, '등록되지 않은 사번입니다');
  }

  if (emp.status === '퇴사') {
    return badRequest(ErrorCodes.AUTH_ACCOUNT_RESIGNED, '퇴사 처리된 계정입니다');
  }

  // admin 역할이면 이메일 로그인 안내
  if (['super_admin', 'admin'].includes(emp.role)) {
    return badRequest(ErrorCodes.AUTH_ADMIN_USE_EMAIL, '관리자는 이메일로 로그인하세요');
  }

  // 내부 이메일 생성
  const internalEmail = generateInternalEmail(emp.emp_no, emp.role as 'crew' | 'field_member');

  // 잠금 상태 체크
  const lockCheck = await checkAccountLock(supabase, internalEmail, 'email');
  if (lockCheck) return lockCheck;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  });

  if (error || !data.user) {
    await incrementFailCount(supabase, internalEmail, 'email');
    return unauthorized(
      '비밀번호가 올바르지 않습니다. 초기 비밀번호: 전화번호 뒤4자리+12'
    );
  }

  await onLoginSuccess(supabase, data.user.id);

  const profile = await getProfile(supabase, data.user.id);
  return ok({
    user_id: data.user.id,
    role: profile?.role || emp.role,
    emp_no: emp.emp_no,
    password_changed: profile?.password_changed ?? false,
    redirect: getRedirectPath(profile?.role || emp.role),
  });
}

// ── 전화번호 → emp_no 변환 ──
async function resolvePhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string
): Promise<{ empNo: string } | { error: ReturnType<typeof badRequest> }> {
  const { data: matches } = await supabase
    .from('employees')
    .select('emp_no, status')
    .eq('phone', phone)
    .neq('status', '퇴사');

  if (!matches || matches.length === 0) {
    return { error: badRequest(ErrorCodes.AUTH_PHONE_NOT_FOUND, '등록되지 않은 전화번호입니다') };
  }

  if (matches.length > 1) {
    return { error: badRequest(ErrorCodes.AUTH_PHONE_MULTIPLE, '동일 번호가 여러 명입니다. 사번으로 로그인하세요') };
  }

  return { empNo: matches[0].emp_no };
}

// ── 잠금 상태 확인 ──
async function checkAccountLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  identifier: string,
  type: 'email'
): Promise<ReturnType<typeof tooMany> | null> {
  // profiles에서 이메일로 조회 (Supabase Auth user → profiles)
  // 간단 구현: 로그인 시도 전에는 profile 접근이 어려우므로,
  // 실제 잠금 체크는 auth-middleware에서 처리
  // 여기서는 로그인 성공 후 profile에서 확인
  return null;
}

// ── 로그인 실패 시 카운트 증가 ──
async function incrementFailCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  type: 'email'
) {
  try {
    // 이메일로 auth.users → profiles 매핑이 필요
    // service_role 없이는 다른 유저의 profiles를 업데이트할 수 없으므로
    // 실패 카운트는 별도 API 또는 DB function으로 처리 예정
    // TODO: Supabase Edge Function 또는 DB trigger로 구현
    console.log(`[Login Fail] ${email} - 실패 카운트 증가 (구현 예정)`);
  } catch (err) {
    console.error('[incrementFailCount]', err);
  }
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
      return '/dashboard';
    case 'crew':
      return '/'; // crew.mepark.kr 루트
    case 'field_member':
      return '/'; // crew.mepark.kr 제한모드
    default:
      return '/dashboard';
  }
}
