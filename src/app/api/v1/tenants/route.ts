/**
 * 미팍 통합앱 v2 — Tenant API (Part 14B)
 * GET  /api/v1/tenants    입주사 목록 (검색 + 상태 필터 + 페이지네이션, 자동완성 지원)
 * POST /api/v1/tenants    입주사 신규 등록
 *
 * 권한: MANAGE (super_admin, admin)
 * 정렬: ?sort=usage (기본, 자주 쓰는 입주사 상단) | name | recent
 */
// @ts-nocheck
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  created,
  badRequest,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import {
  parsePagination,
  paginationMeta,
  validateRequired,
  getQueryParam,
  writeAuditLog,
} from '@/lib/api/helpers';

// ── GET: 입주사 목록 ──
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    const search = getQueryParam(request, 'search');     // 이름/담당자 검색
    const status = getQueryParam(request, 'status');     // active | inactive | all (기본 active)
    const sort = getQueryParam(request, 'sort') || 'usage'; // usage | name | recent

    let query = supabase
      .from('tenants')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId);

    // 상태 필터
    if (status === 'inactive') {
      query = query.eq('status', 'inactive');
    } else if (status === 'all') {
      // 전체
    } else {
      query = query.eq('status', 'active');
    }

    // 검색 (이름 + 담당자명)
    if (search) {
      const safe = search.replace(/[%,]/g, '');
      query = query.or(`name.ilike.%${safe}%,contact_name.ilike.%${safe}%`);
    }

    // 정렬
    if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else if (sort === 'recent') {
      query = query.order('last_contracted_at', { ascending: false, nullsFirst: false });
    } else {
      // usage (기본): 자주 쓰는 입주사 → 최근 계약 순
      query = query
        .order('usage_count', { ascending: false })
        .order('last_contracted_at', { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[v1/tenants GET] 목록 조회:', error.message);
      return serverError('입주사 조회 중 오류가 발생했습니다');
    }

    return ok(data || [], paginationMeta(count ?? 0, { page, limit, offset }, (data ?? []).length));
  } catch (err) {
    console.error('[v1/tenants GET] 예외:', err);
    return serverError('입주사 조회 중 오류가 발생했습니다');
  }
}

// ── POST: 입주사 신규 등록 ──
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const errors = validateRequired(body, ['name']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력해주세요', errors);
    }

    const name = String(body.name).trim();
    if (!name) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '입주사명은 비워둘 수 없습니다');
    }

    const supabase = await createClient();

    // 같은 org 내 이름 중복 검사 (active만)
    const { data: dup } = await supabase
      .from('tenants')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('name', name)
      .eq('status', 'active')
      .maybeSingle();

    if (dup) {
      return conflict(
        ErrorCodes.TENANT_DUPLICATE_NAME,
        `이미 등록된 입주사명입니다: ${name}`
      );
    }

    // 월요금 검증
    let monthlyFee: number | null = null;
    if (body.monthly_fee_default !== undefined && body.monthly_fee_default !== null && body.monthly_fee_default !== '') {
      const n = Number(body.monthly_fee_default);
      if (!Number.isFinite(n) || n < 0) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'monthly_fee_default는 0 이상 숫자여야 합니다');
      }
      monthlyFee = Math.round(n);
    }

    const insertData = {
      org_id: ctx.orgId,
      name,
      business_no: body.business_no?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      contact_phone: body.contact_phone?.trim() || null,
      default_store_id: body.default_store_id || null,
      monthly_fee_default: monthlyFee,
      status: 'active',
      memo: body.memo?.trim() || null,
      usage_count: 0,
      last_contracted_at: null,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    };

    const { data, error } = await supabase
      .from('tenants')
      .insert(insertData)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[v1/tenants POST] insert:', error?.message);
      return serverError('입주사 등록 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'tenants',
      recordId: data.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: data,
    });

    return created(data);
  } catch (err) {
    console.error('[v1/tenants POST] 예외:', err);
    return serverError('입주사 등록 중 오류가 발생했습니다');
  }
}
