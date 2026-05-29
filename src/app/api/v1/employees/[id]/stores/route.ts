/**
 * 미팍 통합앱 v2 — 직원 매장 배정 API (replace-set)
 * POST /api/v1/employees/:id/stores
 * GET  /api/v1/employees/:id/stores   (현재 활성 배정 조회)
 *
 * 동작(replace-set, 멱등):
 *   body { store_ids: string[], primary_store_id?: string }
 *   1) store_ids 의 각 매장을 upsert → is_active=true, assigned_by/at 갱신
 *      - is_primary 는 primary_store_id 와 일치하는 매장만 true
 *   2) 기존 활성 배정 중 store_ids 에 없는 매장은 is_active=false + deactivated_at
 *   3) 감사 로그 기록
 *
 * 권한: MANAGE / org_id 필터 필수 / SQL 변경 없음(store_members 기존 테이블)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  notFound,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 현재 활성 배정 목록 반환 (store_id·is_primary·assigned_at) */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const supabase = await createClient();

    // 직원 존재 확인 (org 격리)
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (empErr || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    const { data: members, error: smErr } = await supabase
      .from('store_members')
      .select('store_id, is_primary, is_active, assigned_at')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    if (smErr) {
      console.error('[Stores GET] store_members 조회 실패:', smErr);
      return serverError('매장 배정 조회 실패');
    }

    return ok({
      employee_id: id,
      store_members: members ?? [],
    });
  } catch (err) {
    console.error('[Stores GET]', err);
    return serverError('매장 배정 조회 중 오류');
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    // ── 입력 검증 ──
    if (!Array.isArray(body.store_ids)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'store_ids 는 배열이어야 합니다');
    }
    // 중복 제거 + 빈 값 제거
    const storeIds: string[] = Array.from(
      new Set((body.store_ids as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0))
    );
    const primaryStoreId: string | undefined =
      typeof body.primary_store_id === 'string' && body.primary_store_id.length > 0
        ? body.primary_store_id
        : undefined;

    // primary 는 반드시 store_ids 안에 포함되어야 함
    if (primaryStoreId && !storeIds.includes(primaryStoreId)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'primary_store_id 는 store_ids 에 포함된 매장이어야 합니다'
      );
    }

    const supabase = await createClient();

    // ── 1. 직원 존재 확인 (org 격리) ──
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, emp_no, name')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (empErr || !employee) {
      return notFound('직원을 찾을 수 없습니다');
    }

    // ── 2. store_ids 가 모두 같은 org 의 사업장인지 검증 ──
    if (storeIds.length > 0) {
      const { data: validStores, error: vsErr } = await supabase
        .from('stores')
        .select('id')
        .eq('org_id', ctx.orgId)
        .in('id', storeIds);

      if (vsErr) {
        console.error('[Stores POST] 사업장 검증 실패:', vsErr);
        return serverError('사업장 검증 실패');
      }
      const validIds = new Set((validStores ?? []).map((s) => s.id));
      const invalid = storeIds.filter((sid) => !validIds.has(sid));
      if (invalid.length > 0) {
        return badRequest(
          ErrorCodes.STORE_NOT_FOUND,
          '존재하지 않거나 권한 없는 사업장이 포함되어 있습니다',
          { invalid }
        );
      }
    }

    const now = new Date().toISOString();

    // ── 3. 현재 활성 배정 조회 (변경 전 스냅샷 + 비활성화 대상 산출) ──
    const { data: currentRows, error: curErr } = await supabase
      .from('store_members')
      .select('store_id, is_primary')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    if (curErr) {
      console.error('[Stores POST] 현재 배정 조회 실패:', curErr);
      return serverError('현재 배정 조회 실패');
    }
    const currentStoreIds = (currentRows ?? []).map((r) => r.store_id);

    // ── 4. upsert (store_ids 의 각 매장 활성화 + primary 지정) ──
    if (storeIds.length > 0) {
      const upsertRows = storeIds.map((storeId) => ({
        org_id: ctx.orgId,
        employee_id: id,
        store_id: storeId,
        is_primary: storeId === primaryStoreId,
        is_active: true,
        assigned_at: now,
        assigned_by: ctx.userId,
        deactivated_at: null,
      }));

      const { error: upErr } = await supabase
        .from('store_members')
        .upsert(upsertRows, { onConflict: 'org_id,employee_id,store_id' });

      if (upErr) {
        console.error('[Stores POST] upsert 실패:', upErr);
        return serverError('매장 배정 저장 실패');
      }
    }

    // ── 5. store_ids 에 없는 기존 활성 배정 비활성화 ──
    const toDeactivate = currentStoreIds.filter((sid) => !storeIds.includes(sid));
    if (toDeactivate.length > 0) {
      const { error: deErr } = await supabase
        .from('store_members')
        .update({ is_active: false, is_primary: false, deactivated_at: now })
        .eq('employee_id', id)
        .eq('org_id', ctx.orgId)
        .eq('is_active', true)
        .in('store_id', toDeactivate);

      if (deErr) {
        console.error('[Stores POST] 비활성화 실패:', deErr);
        return serverError('기존 배정 정리 실패');
      }
    }

    // ── 6. 최신 활성 배정 재조회 (응답용) ──
    const { data: finalMembers } = await supabase
      .from('store_members')
      .select('store_id, is_primary, is_active, assigned_at')
      .eq('employee_id', id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    // ── 7. 감사 로그 ──
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'store_members',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: { store_ids: currentStoreIds },
      afterData: { store_ids: storeIds, primary_store_id: primaryStoreId ?? null },
      reason: '매장 배정 변경 (replace-set)',
    });

    return ok({
      message: '매장 배정 완료',
      employee_id: id,
      emp_no: employee.emp_no,
      name: employee.name,
      assigned: storeIds.length,
      deactivated: toDeactivate.length,
      store_members: finalMembers ?? [],
    });
  } catch (err) {
    console.error('[Stores POST]', err);
    return serverError('매장 배정 중 오류');
  }
}
