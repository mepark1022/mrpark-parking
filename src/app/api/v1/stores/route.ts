/**
 * 미팍 통합앱 v2 — Store API
 * GET  /api/v1/stores    사업장 목록 (필터 + 페이지네이션)
 * POST /api/v1/stores    사업장 신규 등록
 * 
 * 권한: MANAGE (super_admin, admin)
 */
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

// ── GET: 사업장 목록 ──
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    // 필터
    const search = getQueryParam(request, 'search');       // 이름/코드 검색
    const status = getQueryParam(request, 'status');       // active / deleted
    const hasValet = getQueryParam(request, 'has_valet');   // true/false
    const region = getQueryParam(request, 'region_city');   // 지역 필터

    let query = supabase
      .from('stores')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('name');

    // 상태 필터 (기본: 삭제된 것 제외)
    if (status === 'deleted') {
      query = query.eq('is_active', false);
    } else if (status === 'all') {
      // 전체 (필터 안 걸음)
    } else {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,site_code.ilike.%${search}%`);
    }

    if (hasValet === 'true') {
      query = query.eq('has_valet', true);
    } else if (hasValet === 'false') {
      query = query.eq('has_valet', false);
    }

    if (region) {
      query = query.eq('region_city', region);
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[stores] 목록 조회 오류:', error.message);
      return serverError('사업장 조회 중 오류가 발생했습니다');
    }

    return ok(data || [], paginationMeta(count ?? 0, { page, limit, offset }));
  } catch (err) {
    console.error('[stores] 서버 오류:', err);
    return serverError('사업장 조회 중 오류가 발생했습니다');
  }
}

// ── POST: 사업장 신규 등록 ──
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();

    // 필수값 검증
    const errors = validateRequired(body, ['name']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력해주세요', errors);
    }

    const supabase = await createClient();

    // site_code 중복 검사 (입력된 경우)
    if (body.site_code) {
      const { data: existing } = await supabase
        .from('stores')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('site_code', body.site_code)
        .maybeSingle();

      if (existing) {
        return conflict(
          ErrorCodes.STORE_DUPLICATE_CODE,
          `이미 사용 중인 사업장 코드입니다: ${body.site_code}`
        );
      }
    }

    // 삽입 데이터 구성
    const insertData = {
      org_id: ctx.orgId,
      name: body.name,
      site_code: body.site_code || null,
      region_city: body.region_city || null,
      region_district: body.region_district || null,
      road_address: body.road_address || null,
      address: body.address || null,
      manager_name: body.manager_name || null,
      contact_name: body.contact_name || null,
      contact_phone: body.contact_phone || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      is_active: true,
      is_free_parking: body.is_free_parking ?? false,
      has_valet: body.has_valet ?? false,
      valet_fee: body.valet_fee ?? 0,
      has_kiosk: body.has_kiosk ?? false,
      has_toss_kiosk: body.has_toss_kiosk ?? false,
      grace_period_minutes: body.grace_period_minutes ?? 10,
      gps_radius_meters: body.gps_radius_meters ?? 200,
      require_entry_photo: body.require_entry_photo ?? false,
      enable_plate_search: body.enable_plate_search ?? true,
      enable_valet: body.enable_valet ?? false,
      enable_monthly: body.enable_monthly ?? true,
      require_visit_place: body.require_visit_place ?? false,
    };

    const { data, error } = await supabase
      .from('stores')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[stores] 등록 오류:', error.message);
      return serverError('사업장 등록 중 오류가 발생했습니다');
    }

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'stores',
      recordId: data.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: data,
    });

    return created(data);
  } catch (err) {
    console.error('[stores] 서버 오류:', err);
    return serverError('사업장 등록 중 오류가 발생했습니다');
  }
}
