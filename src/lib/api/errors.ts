/**
 * 미팍 통합앱 v2 — 에러 코드 체계
 * 
 * 범주별 접두사:
 *   AUTH_   인증
 *   PERM_   권한
 *   EMP_    직원
 *   TICKET_ 주차 티켓
 *   PAY_    결제
 *   REPORT_ 일보
 *   FIN_    재무
 */

export const ErrorCodes = {
  // ── 인증 (AUTH) ──
  AUTH_REQUIRED:        'AUTH_REQUIRED',         // 로그인 필요
  AUTH_INVALID_TOKEN:   'AUTH_INVALID_TOKEN',    // 토큰 무효/만료
  AUTH_INVALID_INPUT:   'AUTH_INVALID_INPUT',    // 이메일/사번/전화번호 형식 불일치
  AUTH_WRONG_PASSWORD:  'AUTH_WRONG_PASSWORD',   // 비밀번호 불일치
  AUTH_ACCOUNT_BANNED:  'AUTH_ACCOUNT_BANNED',   // 계정 정지
  AUTH_ACCOUNT_LOCKED:  'AUTH_ACCOUNT_LOCKED',   // 5회 실패 → 3분 잠금
  AUTH_ACCOUNT_RESIGNED:'AUTH_ACCOUNT_RESIGNED', // 퇴사 처리된 계정
  AUTH_ACCOUNT_NOT_FOUND:'AUTH_ACCOUNT_NOT_FOUND',// 계정 미생성
  AUTH_DUPLICATE_EMAIL: 'AUTH_DUPLICATE_EMAIL',  // 이메일 중복
  AUTH_PHONE_NOT_FOUND: 'AUTH_PHONE_NOT_FOUND',  // 미등록 전화번호
  AUTH_PHONE_MULTIPLE:  'AUTH_PHONE_MULTIPLE',   // 동일 번호 다수
  AUTH_ADMIN_USE_EMAIL: 'AUTH_ADMIN_USE_EMAIL',  // 관리자는 이메일로 로그인
  AUTH_PASSWORD_TOO_SHORT:'AUTH_PASSWORD_TOO_SHORT', // 6자 미만

  // ── 권한 (PERM) ──
  PERM_INSUFFICIENT:    'PERM_INSUFFICIENT',     // 권한 부족
  PERM_SCOPE_DENIED:    'PERM_SCOPE_DENIED',     // 사업장 범위 벗어남
  PERM_SELF_ONLY:       'PERM_SELF_ONLY',        // 본인 정보만 접근 가능

  // ── 직원 (EMP) ──
  EMP_NOT_FOUND:        'EMP_NOT_FOUND',         // 직원 미존재
  EMP_DUPLICATE_NO:     'EMP_DUPLICATE_NO',      // 사번 중복
  EMP_ALREADY_RESIGNED: 'EMP_ALREADY_RESIGNED',  // 이미 퇴사 처리
  EMP_HAS_ACTIVE_CONTRACT:'EMP_HAS_ACTIVE_CONTRACT', // 활성 계약 존재
  EMP_INVALID_HIRE_DATE:'EMP_INVALID_HIRE_DATE', // 입사일 누락/잘못

  // ── 주차 티켓 (TICKET) ──
  TICKET_NOT_FOUND:     'TICKET_NOT_FOUND',
  TICKET_ALREADY_COMPLETED:'TICKET_ALREADY_COMPLETED',
  TICKET_OVERDUE:       'TICKET_OVERDUE',        // 30분 초과

  // ── 결제 (PAY) ──
  PAY_CONFIRM_FAILED:   'PAY_CONFIRM_FAILED',    // 토스 승인 실패
  PAY_DUPLICATE:        'PAY_DUPLICATE',          // 이중 결제

  // ── 일보 (REPORT) ──
  REPORT_DUPLICATE_DATE:'REPORT_DUPLICATE_DATE', // 동일 날짜+사업장 중복
  REPORT_ALREADY_CONFIRMED:'REPORT_ALREADY_CONFIRMED',

  // ── 재무 (FIN) ──
  FIN_BALANCE_MISMATCH: 'FIN_BALANCE_MISMATCH',  // 잔액 불일치

  // ── 사업장 (STORE) ──
  STORE_NOT_FOUND:      'STORE_NOT_FOUND',       // 사업장 미존재
  STORE_DUPLICATE_CODE: 'STORE_DUPLICATE_CODE',  // site_code 중복
  STORE_HAS_ACTIVE_STAFF:'STORE_HAS_ACTIVE_STAFF',// 활성 직원 존재 (삭제 시)
  STORE_ALREADY_DELETED:'STORE_ALREADY_DELETED', // 이미 삭제됨
  STORE_NOT_DELETED:    'STORE_NOT_DELETED',     // 삭제 상태 아님 (복구 시)

  // ── 주차장 (LOT) ──
  LOT_NOT_FOUND:        'LOT_NOT_FOUND',
  LOT_STORE_MISMATCH:   'LOT_STORE_MISMATCH',   // 주차장-사업장 불일치

  // ── 방문지 (PLACE) ──
  PLACE_NOT_FOUND:      'PLACE_NOT_FOUND',
  PLACE_DUPLICATE_NAME: 'PLACE_DUPLICATE_NAME',  // 동일 사업장 내 이름 중복

  // ── 공통 ──
  VALIDATION_ERROR:     'VALIDATION_ERROR',      // 입력값 검증 실패
  NOT_FOUND:            'NOT_FOUND',             // 범용 404
  INTERNAL_ERROR:       'INTERNAL_ERROR',        // 서버 내부 오류
  RATE_LIMITED:         'RATE_LIMITED',           // 요청 과다
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
