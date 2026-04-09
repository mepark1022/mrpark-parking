/**
 * 미팍 통합앱 v2 — API 보조 유틸
 * 
 * - SELF 권한 헬퍼 (본인 데이터만 접근)
 * - Audit Log 기록
 * - 페이지네이션 파라미터 파싱
 * - Supabase 스코프 필터 적용
 * - 입력값 유효성 검사
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AuthContext, AuditLogRow } from './types';
import { forbidden } from './response';
import { ErrorCodes } from './errors';

// ── SELF 권한 헬퍼 ──

/**
 * SELF 권한 체크: 본인 리소스이거나 MANAGE 이상이면 허용
 * 직원 상세, 급여내역서, 근태 조회 등에서 사용
 * 
 * @param ctx - 인증 컨텍스트
 * @param targetEmployeeId - 대상 직원의 employees.id
 * @returns true면 접근 허용
 */
export function canAccessSelfOrManage(ctx: AuthContext, targetEmployeeId: string): boolean {
  // MANAGE 이상은 무조건 허용
  if (['super_admin', 'admin'].includes(ctx.role)) return true;
  // 본인 리소스인지 확인
  return ctx.employeeId === targetEmployeeId;
}

/**
 * SELF 권한 체크 + 에러 응답 반환
 * 권한 없으면 403 NextResponse 반환, 있으면 null
 */
export function checkSelfOrManage(ctx: AuthContext, targetEmployeeId: string) {
  if (!canAccessSelfOrManage(ctx, targetEmployeeId)) {
    return forbidden('본인 정보만 조회할 수 있습니다');
  }
  return null;
}

// ── Audit Log ──

/**
 * 감사 로그 기록 (비동기, 실패해도 메인 로직 차단 안 함)
 */
export async function writeAuditLog(params: {
  orgId: string;
  tableName: string;
  recordId: string;
  action: AuditLogRow['action'];
  changedBy: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      org_id: params.orgId,
      table_name: params.tableName,
      record_id: params.recordId,
      action: params.action,
      changed_by: params.changedBy,
      before_data: params.beforeData ?? null,
      after_data: params.afterData ?? null,
      reason: params.reason ?? null,
    });
  } catch (err) {
    // 감사 로그 실패가 메인 로직을 차단하면 안 됨
    console.error('[AuditLog] 기록 실패:', err);
  }
}

// ── 페이지네이션 ──

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * URL 쿼리에서 page/limit 파싱
 * 기본값: page=1, limit=20, 최대 limit=100
 */
export function parsePagination(request: NextRequest): PaginationParams {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * 페이지네이션 메타 생성
 */
export function paginationMeta(total: number, params: PaginationParams) {
  return {
    total,
    page: params.page,
    limit: params.limit,
  };
}

// ── Supabase 스코프 필터 적용 ──

/**
 * Supabase 쿼리에 org_id + store_id 스코프 필터 적용
 * crew/field_member면 배정된 store_id만 조회 가능
 * 
 * @param query - Supabase 쿼리 빌더 (이미 select 된 상태)
 * @param ctx - 인증 컨텍스트
 * @param storeIdColumn - store_id 컬럼 이름 (기본: 'store_id')
 * @returns 필터가 적용된 쿼리 (체이닝용)
 */
export function applyScopeFilter<T>(
  query: T & { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T },
  ctx: AuthContext,
  storeIdColumn = 'store_id'
): T {
  // org_id 필터 항상 적용
  let q = query.eq('org_id', ctx.orgId);
  // crew/field → 배정 사업장만
  if (['crew', 'field_member'].includes(ctx.role) && ctx.storeIds) {
    q = q.in(storeIdColumn, ctx.storeIds);
  }
  return q;
}

// ── 유효성 검사 ──

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 필수 필드 검사
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of fields) {
    const val = data[field];
    if (val === undefined || val === null || val === '') {
      errors.push({ field, message: `${field}은(는) 필수입니다` });
    }
  }
  return errors;
}

/**
 * 사번 형식 검사 (MP/MPA 시작)
 */
export function isValidEmpNo(empNo: string): boolean {
  return /^(MP\d{5}|MPA\d{1,3}|MP\d{5}-\d+)$/.test(empNo.toUpperCase());
}

/**
 * URL에서 단일 쿼리 파라미터 가져오기
 */
export function getQueryParam(request: NextRequest, key: string): string | null {
  return new URL(request.url).searchParams.get(key);
}

/**
 * URL에서 복수 쿼리 파라미터 가져오기 (같은 키 여러 개 또는 콤마 구분)
 */
export function getQueryParams(request: NextRequest, key: string): string[] {
  const url = new URL(request.url);
  const values = url.searchParams.getAll(key);
  // 콤마 구분도 지원
  return values.flatMap(v => v.split(',').map(s => s.trim()).filter(Boolean));
}
