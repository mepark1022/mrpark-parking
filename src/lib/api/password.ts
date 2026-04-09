/**
 * 미팍 통합앱 v2 — 비밀번호 시스템
 * 
 * 규칙:
 *   초기 비밀번호 = 전화번호 뒤 4자리 + "12"
 *   fallback (전화번호 없음) = 사번 뒤 4자리 + "12"
 *   최소 6자 (Supabase Auth 요건 충족: 4 + 2 = 6)
 * 
 * 예시:
 *   010-1234-5678 → "567812"
 *   MP24110 (전화번호 없음) → "411012"
 *   MPA1 (전화번호 없음) → "000112"
 */

const PASSWORD_SUFFIX = '12';
const MIN_DIGITS = 4;

/**
 * 초기 비밀번호 생성
 * @param phone - 전화번호 (하이픈 포함/미포함 모두 가능)
 * @param empNo - 사번 (fallback용)
 * @returns 6자리 초기 비밀번호
 */
export function generateInitialPassword(phone: string | null | undefined, empNo: string): string {
  // 1순위: 전화번호 뒤 4자리 + 12
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= MIN_DIGITS) {
      return digits.slice(-MIN_DIGITS) + PASSWORD_SUFFIX;
    }
  }

  // 2순위: 사번 뒤 4자리 + 12 (숫자만 추출)
  const empDigits = empNo.replace(/\D/g, '');
  return empDigits.slice(-MIN_DIGITS).padStart(MIN_DIGITS, '0') + PASSWORD_SUFFIX;
}

/**
 * 초기 비밀번호 마스킹 (관리자 확인용)
 * "567812" → "****12"
 */
export function maskInitialPassword(password: string): string {
  if (password.length <= 2) return '****' + PASSWORD_SUFFIX;
  return '****' + password.slice(-2);
}

/**
 * 전화번호 정규화 (하이픈 제거, 공백 제거)
 * "010-1234-5678" → "01012345678"
 */
export function normalizePhone(input: string): string {
  return input.replace(/[\s\-\(\)]/g, '');
}

/**
 * 전화번호 마스킹 (로그용)
 * "01012345678" → "010****5678"
 */
export function maskPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length < 8) return '****';
  return digits.slice(0, 3) + '****' + digits.slice(-4);
}

/**
 * 로그인 입력값 유형 판별
 * @returns 'EMAIL' | 'PHONE' | 'EMPNO' | null (판별 불가)
 */
export function detectLoginInputType(input: string): 'EMAIL' | 'PHONE' | 'EMPNO' | null {
  const trimmed = input.trim();

  // @ 포함 → 이메일
  if (trimmed.includes('@')) return 'EMAIL';

  // 숫자만 추출
  const digits = trimmed.replace(/\D/g, '');

  // 010으로 시작 + 10~11자리 → 전화번호
  if (digits.startsWith('010') && digits.length >= 10 && digits.length <= 11) {
    return 'PHONE';
  }

  // MP 또는 MPA로 시작 → 사번
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('MP') || upper.startsWith('MPA')) {
    return 'EMPNO';
  }

  return null;
}

/**
 * 사번 정규화 (대문자 변환)
 * "mp24110" → "MP24110"
 * "mpa1" → "MPA1"
 */
export function normalizeEmpNo(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * 내부 이메일 생성 (Supabase Auth용)
 * crew → {emp_no}@mepark.internal
 * field_member → {emp_no}@field.mepark.internal
 */
export function generateInternalEmail(empNo: string, role: 'crew' | 'field_member'): string {
  const normalized = normalizeEmpNo(empNo).toLowerCase();
  if (role === 'field_member') {
    return `${normalized}@field.mepark.internal`;
  }
  return `${normalized}@mepark.internal`;
}

/**
 * 비밀번호 강도 검사 (최소 요건)
 * - 6자 이상
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: '비밀번호는 6자 이상이어야 합니다' };
  }
  return { valid: true };
}
