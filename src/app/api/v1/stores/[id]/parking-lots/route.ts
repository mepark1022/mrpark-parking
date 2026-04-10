/**
 * 미팍 통합앱 v2 — Parking Lots API (사업장 하위)
 * GET  /api/v1/stores/:id/parking-lots   주차장 목록
 * POST /api/v1/stores/:id/parking-lots   주차장 등록
 * 
 * 권한: MANAGE
 * ⚠️ 면수 = self_spaces + mechanical_normal + mechanical_suv (total_spaces 사용 금지)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  created,
  badRequest,
  notFound,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { validateRequired, writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET: 주차장 목록 ──
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
      .from('parking_lots')
      .select('*')
      .eq('store_id', storeId)
      .eq('org_id', ctx.orgId)
      .order('name');

    if (error) {
      console.error('[parking-lots] 조회 오류:', error.message);
      return serverError('주차장 조회 중 오류가 발생했습니다');
    }

    // 면수 합계 계산
    const lots = data || [];
    const summary = {
      total_self: lots.reduce((s, l) => s + (l.self_spaces || 0), 0),
      total_mechanical_normal: lots.reduce((s, l) => s + (l.mechanical_normal || 0), 0),
      total_mechanical_suv: lots.reduce((s, l) => s + (l.mechanical_suv || 0), 0),
      total_spaces: lots.reduce(
        (s, l) => s + (l.self_spaces || 0) + (l.mechanical_normal || 0) + (l.mechanical_suv || 0),
        0
      ),
    };

    return ok({ lots, summary });
  } catch (err) {
    console.error('[parking-lots] 서버 오류:', err);
    return serverError('주차장 조회 중 오류가 발생했습니다');
  }
}

// ── POST: 주차장 등록 ──
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
    const errors = validateRequired(body, ['name', 'lot_type']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력해주세요', errors);
    }

    const insertData = {
      org_id: ctx.orgId,
      store_id: storeId,
      name: body.name,
      lot_type: body.lot_type,                      // internal / external
      parking_type: body.parking_type || ['self'],   // ['self', 'mechanical']
      road_address: body.road_address || null,
      self_spaces: body.self_spaces ?? 0,
      mechanical_normal: body.mechanical_normal ?? 0,
      mechanical_suv: body.mechanical_suv ?? 0,
      operating_days: body.operating_days || null,
      open_time: body.open_time || null,
      close_time: body.close_time || null,
    };

    const { data, error } = await supabase
      .from('parking_lots')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[parking-lots] 등록 오류:', error.message);
      return serverError('주차장 등록 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'parking_lots',
      recordId: data.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: data,
    });

    return created(data);
  } catch (err) {
    console.error('[parking-lots] 서버 오류:', err);
    return serverError('주차장 등록 중 오류가 발생했습니다');
  }
}
