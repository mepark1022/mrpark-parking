/**
 * 미팍 통합앱 v2 — 사고보고 API (GAP-P1-3 / P1-6)
 * GET  /api/v1/accidents   — 사고 목록 (필터: store_id, status, from, to)
 * POST /api/v1/accidents   — 사고 등록 (CREW 현장 등록)
 *
 * 권한:
 *   GET  = OPERATE (crew 이상). crew/field 차등 → 배정 사업장만, admin/super → 전체
 *   POST = OPERATE (crew 이상, field_member 제외)
 *
 * 정책 메모:
 *   - 테이블: accident_reports / 사진: Supabase Storage 버킷 `accident-photos`
 *   - ⚠️ v2 전화번호 DB 저장 금지 → phone 컬럼은 등록 시 저장하지 않음(null 고정)
 *   - 사진은 본 API가 받지 않음. 클라가 Storage에 `{report_id}/...`로 직접 업로드,
 *     조회는 GET /api/v1/accidents/:id 에서 Storage 경로 목록을 반환.
 *   - 신규 SQL 없음(accident_reports 기존 테이블).
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, created, badRequest, forbidden, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { getQueryParam, writeAuditLog } from '@/lib/api/helpers';

// 허용 상태값(레거시와 동일): 접수 → 처리중 → 완료
const STATUS_VALUES = ['접수', '처리중', '완료'] as const;

// ── 목록 ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();

    // 필터 파라미터
    const storeId = getQueryParam(request, 'store_id');
    const status = getQueryParam(request, 'status');
    const from = getQueryParam(request, 'from'); // accident_at >= (ISO/날짜)
    const to = getQueryParam(request, 'to');     // accident_at <= (ISO/날짜)

    let q = supabase
      .from('accident_reports')
      .select('id, store_id, vehicle, accident_type, reporter, detail, status, accident_at, admin_memo, created_at, updated_at, stores ( id, name )')
      .eq('org_id', ctx.orgId)
      .order('accident_at', { ascending: false });

    // ── 사업장 스코핑 (crew/field는 배정 매장만) ──
    if (['super_admin', 'admin'].includes(ctx.role)) {
      if (storeId) q = q.eq('store_id', storeId);
    } else {
      const assigned = ctx.storeIds || [];
      if (assigned.length === 0) return ok([]); // 배정 매장 없으면 빈 목록
      if (storeId) {
        if (!assigned.includes(storeId)) return forbidden('해당 사업장 접근 권한이 없습니다');
        q = q.eq('store_id', storeId);
      } else {
        q = q.in('store_id', assigned);
      }
    }

    if (status) {
      if (!STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, '유효하지 않은 상태값입니다');
      }
      q = q.eq('status', status);
    }
    if (from) q = q.gte('accident_at', from);
    if (to) q = q.lte('accident_at', to);

    const { data, error } = await q;
    if (error) {
      console.error('[v1/accidents] list:', error.message);
      return serverError('사고 목록 조회 중 오류가 발생했습니다');
    }

    return ok(data ?? []);
  } catch (err) {
    console.error('[v1/accidents] GET exception:', err);
    return serverError();
  }
}

// ── 등록 ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 올바르지 않습니다');
    }

    const storeId = String(body.store_id ?? '').trim();
    const vehicle = String(body.vehicle ?? '').trim().toUpperCase();
    const accidentType = String(body.accident_type ?? '').trim();
    const reporter = String(body.reporter ?? '').trim();
    const detail = body.detail != null ? String(body.detail).trim() : null;
    // accident_at: 미지정 시 현재시각
    const accidentAt = body.accident_at ? String(body.accident_at) : new Date().toISOString();

    // 필수값 검증
    if (!storeId) return badRequest(ErrorCodes.VALIDATION_ERROR, '사업장(store_id)은 필수입니다');
    if (!vehicle) return badRequest(ErrorCodes.VALIDATION_ERROR, '차량번호(vehicle)는 필수입니다');
    if (!accidentType) return badRequest(ErrorCodes.VALIDATION_ERROR, '사고유형(accident_type)은 필수입니다');
    if (!reporter) return badRequest(ErrorCodes.VALIDATION_ERROR, '신고자(reporter)는 필수입니다');

    const supabase = await createClient();

    // ── 사업장 검증 (같은 org 소유 + crew는 배정매장만) ──
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('id', storeId)
      .maybeSingle();
    if (storeErr) {
      console.error('[v1/accidents] store check:', storeErr.message);
      return serverError('사업장 확인 중 오류가 발생했습니다');
    }
    if (!store) return badRequest(ErrorCodes.STORE_NOT_FOUND, '사업장을 찾을 수 없습니다');

    if (!['super_admin', 'admin'].includes(ctx.role)) {
      const assigned = ctx.storeIds || [];
      if (!assigned.includes(storeId)) {
        return forbidden('배정된 사업장에만 사고를 등록할 수 있습니다');
      }
    }

    // ⚠️ phone은 v2 정책상 저장하지 않음(null 고정). reported_by에 등록자 기록.
    const { data: rec, error: insErr } = await supabase
      .from('accident_reports')
      .insert({
        org_id: ctx.orgId,
        store_id: storeId,
        vehicle,
        accident_type: accidentType,
        reporter,
        reported_by: ctx.userId,
        phone: null,
        detail,
        status: '접수',
        accident_at: accidentAt,
      })
      .select('id, store_id, vehicle, accident_type, reporter, detail, status, accident_at, created_at')
      .single();

    if (insErr || !rec) {
      console.error('[v1/accidents] insert:', insErr?.message);
      return serverError('사고 등록 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'accident_reports',
      recordId: rec.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: rec,
    });

    // 응답에 사진 업로드용 경로 prefix 동봉(클라가 Storage에 직접 업로드)
    return created({ ...rec, photo_path_prefix: `${rec.id}/`, photo_bucket: 'accident-photos' });
  } catch (err) {
    console.error('[v1/accidents] POST exception:', err);
    return serverError();
  }
}
