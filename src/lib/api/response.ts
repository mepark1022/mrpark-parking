/**
 * API v1 응답 헬퍼
 * 모든 /api/v1/* 라우트에서 사용
 */
import { NextResponse } from 'next/server';
import type { ApiSuccess, ApiError } from './types';

/** 성공 응답 (200) */
export function ok<T>(data: T, meta?: ApiSuccess<T>['meta']): NextResponse {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status: 200 });
}

/** 생성 성공 (201) */
export function created<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data } as ApiSuccess<T>, { status: 201 });
}

/** 에러 응답 */
export function error(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  const body: ApiError = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  };
  return NextResponse.json(body, { status });
}

// ── 자주 쓰는 에러 단축 ──

/** 400 Bad Request */
export function badRequest(code: string, message: string, details?: unknown) {
  return error(400, code, message, details);
}

/** 401 Unauthorized */
export function unauthorized(message = '인증이 필요합니다') {
  return error(401, 'AUTH_REQUIRED', message);
}

/** 403 Forbidden */
export function forbidden(message = '권한이 없습니다') {
  return error(403, 'PERM_INSUFFICIENT', message);
}

/** 404 Not Found */
export function notFound(message = '리소스를 찾을 수 없습니다') {
  return error(404, 'NOT_FOUND', message);
}

/** 409 Conflict */
export function conflict(code: string, message: string, details?: unknown) {
  return error(409, code, message, details);
}

/** 429 Too Many Requests */
export function tooMany(message = '요청이 너무 많습니다. 잠시 후 다시 시도하세요') {
  return error(429, 'RATE_LIMITED', message);
}

/** 500 Internal Server Error */
export function serverError(message = '서버 오류가 발생했습니다') {
  return error(500, 'INTERNAL_ERROR', message);
}
