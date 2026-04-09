/**
 * 미팍 통합앱 v2 — API 라이브러리 통합 export
 * 
 * 사용법:
 *   import { requireAuth, ok, forbidden, ErrorCodes } from '@/lib/api';
 */

// 타입
export type {
  UserRole,
  PermissionLevel,
  EmployeeStatus,
  AttendanceStatus,
  LoginInputType,
  ApiSuccess,
  ApiError,
  ApiResponse,
  AuthContext,
  ProfileRow,
  EmployeeRow,
  StoreMemberRow,
  AuditLogRow,
} from './types';

export { ROLE_HIERARCHY } from './types';

// 응답 헬퍼
export {
  ok,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooMany,
  serverError,
} from './response';

// 에러 코드
export { ErrorCodes } from './errors';
export type { ErrorCode } from './errors';

// 인증 미들웨어
export {
  requireAuth,
  checkPermission,
  getScopeFilter,
  canAccessStore,
} from './auth-middleware';

// 보조 유틸 (Part 4)
export {
  canAccessSelfOrManage,
  checkSelfOrManage,
  writeAuditLog,
  parsePagination,
  paginationMeta,
  applyScopeFilter,
  validateRequired,
  isValidEmpNo,
  getQueryParam,
  getQueryParams,
} from './helpers';

export type {
  PaginationParams,
  ValidationError,
} from './helpers';

// 비밀번호 유틸
export {
  generateInitialPassword,
  maskInitialPassword,
  normalizePhone,
  maskPhone,
  detectLoginInputType,
  normalizeEmpNo,
  generateInternalEmail,
  validatePassword,
} from './password';
