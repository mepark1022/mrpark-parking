/**
 * 미팍 통합앱 v2 — Visit Places API (사업장 하위)
 * GET  /api/v1/stores/:id/visit-places   방문지 목록
 * POST /api/v1/stores/:id/visit-places   방문지 등록
 * 
 * 권한: MANAGE
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { validateRequired, writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET: 방문지 목록 ──
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id: storeId } = await params;

  try {
    const supabase = await createClient();

    // 사업장 존재 확인
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!store) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    const { data, error } = await supabase
      .from('visit_places')
      .select('*')
      .eq('store_id', storeId)
      .eq('org_id', ctx.orgId)
      .order('name');

    if (error) {
      console.error('[visit-places] 조회 오류:', error.message);
      return serverError('방문지 조회 중 오류가 발생했습니다');
    }

    return ok(data || []);
  } catch (err) {
    console.error('[visit-places] 서버 오류:', err);
    return serverError('방문지 조회 중 오류가 발생했습니다');
  }
}

// ── POST: 방문지 등록 ──
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id: storeId } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    // 사업장 존재 확인
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (!store) {
      return notFound('사업장을 찾을 수 없습니다');
    }

    // 필수값 검증
    const errors = validateRequired(body, ['name']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력해주세요', errors);
    }

    // 동일 사업장 내 방문지명 중복 검사
    const { data: dup } = await supabase
      .from('visit_places')
      .select('id')
      .eq('store_id', storeId)
      .eq('org_id', ctx.orgId)
      .eq('name', body.name)
      .maybeSingle();

    if (dup) {
      return conflict(
        ErrorCodes.PLACE_DUPLICATE_NAME,
        `이미 등록된 방문지입니다: ${body.name}`
      );
    }

    const insertData = {
      org_id: ctx.orgId,
      store_id: storeId,
      name: body.name,
      floor: body.floor || null,
      free_minutes: body.free_minutes ?? 0,
      base_fee: body.base_fee ?? 0,
      base_minutes: body.base_minutes ?? 0,
      extra_fee: body.extra_fee ?? 0,
      daily_max: body.daily_max ?? 0,
      valet_fee: body.valet_fee ?? 0,
      monthly_fee: body.monthly_fee ?? 0,
    };

    const { data, error } = await supabase
      .from('visit_places')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[visit-places] 등록 오류:', error.message);
      return serverError('방문지 등록 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'visit_places',
      recordId: data.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: data,
    });

    return created(data);
  } catch (err) {
    console.error('[visit-places] 서버 오류:', err);
    return serverError('방문지 등록 중 오류가 발생했습니다');
  }
}
