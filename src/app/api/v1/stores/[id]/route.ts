/**
 * 미팍 통합앱 v2 — Store 상세 API
 * GET    /api/v1/stores/:id   상세 조회
 * PUT    /api/v1/stores/:id   수정
 * DELETE /api/v1/stores/:id   삭제 (is_active → false)
 * 
 * 권한: GET/PUT = MANAGE, DELETE = SYSTEM
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  notFound,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET: 사업장 상세 ──
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (error) {
      console.error('[stores/:id] 조회 오류:', error.message);
      return serverError('사업장 조회 중 오류가 발생했습니다');
    }

    if (!data) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    // 주차장 + 방문지 함께 반환
    const [lotsRes, placesRes] = await Promise.all([
      supabase
        .from('parking_lots')
        .select('*')
        .eq('store_id', id)
        .eq('org_id', ctx.orgId)
        .order('name'),
      supabase
        .from('visit_places')
        .select('*')
        .eq('store_id', id)
        .eq('org_id', ctx.orgId)
        .order('name'),
    ]);

    // 운영시간, 근무조, 지각규칙도 포함
    const [hoursRes, shiftsRes, lateRes] = await Promise.all([
      supabase
        .from('store_operating_hours')
        .select('*')
        .eq('store_id', id)
        .order('day_category'),
      supabase
        .from('store_shifts')
        .select('*')
        .eq('store_id', id)
        .order('name'),
      supabase
        .from('store_late_rules')
        .select('*')
        .eq('store_id', id)
        .maybeSingle(),
    ]);

    // 배정 직원 수
    const { count: staffCount } = await supabase
      .from('store_members')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    return ok({
      ...data,
      parking_lots: lotsRes.data || [],
      visit_places: placesRes.data || [],
      operating_hours: hoursRes.data || [],
      shifts: shiftsRes.data || [],
      late_rule: lateRes.data || null,
      staff_count: staffCount ?? 0,
    });
  } catch (err) {
    console.error('[stores/:id] 서버 오류:', err);
    return serverError('사업장 조회 중 오류가 발생했습니다');
  }
}

// ── PUT: 사업장 수정 ──
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    // 존재 확인
    const { data: existing } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    // site_code 중복 검사 (변경 시)
    if (body.site_code && body.site_code !== existing.site_code) {
      const { data: dup } = await supabase
        .from('stores')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('site_code', body.site_code)
        .neq('id', id)
        .maybeSingle();

      if (dup) {
        return conflict(
          ErrorCodes.STORE_DUPLICATE_CODE,
          `이미 사용 중인 사업장 코드입니다: ${body.site_code}`
        );
      }
    }

    // 수정 가능 필드만 추출
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'site_code', 'region_city', 'region_district',
      'road_address', 'address', 'manager_name',
      'contact_name', 'contact_phone', 'latitude', 'longitude',
      'is_free_parking', 'has_valet', 'valet_fee',
      'has_kiosk', 'has_toss_kiosk',
      'grace_period_minutes', 'gps_radius_meters',
      'require_entry_photo', 'enable_plate_search',
      'enable_valet', 'enable_monthly', 'require_visit_place',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 항목이 없습니다');
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      console.error('[stores/:id] 수정 오류:', error.message);
      return serverError('사업장 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'stores',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: data,
    });

    return ok(data);
  } catch (err) {
    console.error('[stores/:id] 서버 오류:', err);
    return serverError('사업장 수정 중 오류가 발생했습니다');
  }
}

// ── DELETE: 사업장 삭제 (논리삭제: is_active → false) ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SYSTEM 권한 (super_admin만)
  const auth = await requireAuth(request, 'SYSTEM');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('stores')
      .select('id, name, is_active')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!existing) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    if (!existing.is_active) {
      return badRequest(ErrorCodes.STORE_ALREADY_DELETED, '이미 삭제된 사업장입니다');
    }

    // 활성 직원 확인 (경고용 — 요청에 force=true면 무시)
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    if (!force) {
      const { count } = await supabase
        .from('store_members')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', id)
        .eq('org_id', ctx.orgId)
        .eq('is_active', true);

      if (count && count > 0) {
        return conflict(
          ErrorCodes.STORE_HAS_ACTIVE_STAFF,
          `활성 직원 ${count}명이 배정되어 있습니다. 삭제하려면 force=true를 추가하세요`,
          { active_staff_count: count }
        );
      }
    }

    // 논리삭제
    const { error } = await supabase
      .from('stores')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (error) {
      console.error('[stores/:id] 삭제 오류:', error.message);
      return serverError('사업장 삭제 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'stores',
      recordId: id,
      action: 'delete',
      changedBy: ctx.userId,
      beforeData: { is_active: true },
      afterData: { is_active: false },
    });

    return ok({ id, deleted: true });
  } catch (err) {
    console.error('[stores/:id] 서버 오류:', err);
    return serverError('사업장 삭제 중 오류가 발생했습니다');
  }
}
