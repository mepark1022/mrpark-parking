/**
 * 미팍 통합앱 v2 — Monthly Parking API (Part 14C)
 * GET  /api/v1/monthly    월주차 목록 (입주사/사업장/상태/만료일/검색 필터 + 페이지네이션)
 * POST /api/v1/monthly    월주차 신규 등록 (+ tenants usage_count++ / last_contracted_at 갱신)
 *
 * 권한:
 *   GET  : MANAGE (super_admin/admin) — crew/field는 배정된 store만
 *   POST : MANAGE
 *
 * 호환성:
 *   - monthly_parking에는 org_id 컬럼이 없음 → store_id로만 org 분리
 *   - 모든 쿼리에서 stores!inner(org_id) 조인 사용
 *   - 기존 v1 monthly_parking 페이지/cron(monthly-remind) 영향 없음
 *   - tenant_id, renewed_from_id는 nullable (Part 14A에서 추가)
 *
 * 정책:
 *   - customer_phone 평문 저장 (월주차 알림톡 정기 발송 필수 → 정책 예외)
 *   - 알림톡 발송은 별도 cron에서 처리 (이 API에서는 호출 안 함)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  created,
  badRequest,
  conflict,
  forbidden,
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

// ── 유틸: store_id의 org_id 검증 (멀티테넌시 핵심) ──
async function verifyStoreOrg(supabase: any, storeId: string, orgId: string) {
  const { data, error } = await supabase
    .from('stores')
    .select('id, org_id')
    .eq('id', storeId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// ── 유틸: tenant_id의 org_id 검증 ──
async function verifyTenantOrg(supabase: any, tenantId: string, orgId: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, status, usage_count')
    .eq('id', tenantId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// ── 유틸: YYYY-MM-DD 형식 검증 ──
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

// ────────────────────────────────────────────────────────
// GET: 월주차 목록
// ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    const tenantId = getQueryParam(request, 'tenant_id');
    const storeId = getQueryParam(request, 'store_id');
    const contractStatus = getQueryParam(request, 'contract_status'); // active|expired|cancelled|all
    const paymentStatus = getQueryParam(request, 'payment_status');   // paid|unpaid|overdue|all
    const search = getQueryParam(request, 'search');                   // 차량번호/고객명
    const expiringWithinDays = getQueryParam(request, 'expiring_within_days'); // 만료 임박 D-N

    // stores!inner 조인으로 org_id 멀티테넌시 보장
    let query = supabase
      .from('monthly_parking')
      .select('*, stores!inner(id, name, org_id), tenants(id, name, contact_name)', { count: 'exact' })
      .eq('stores.org_id', ctx.orgId);

    // crew/field_member는 배정된 store만
    if (['crew', 'field_member'].includes(ctx.role) && ctx.storeIds && ctx.storeIds.length > 0) {
      query = query.in('store_id', ctx.storeIds);
    } else if (['crew', 'field_member'].includes(ctx.role)) {
      // 배정된 store가 없으면 빈 결과
      return ok([], paginationMeta(0, { page, limit, offset }, 0));
    }

    // 필터
    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (storeId) query = query.eq('store_id', storeId);

    if (contractStatus && contractStatus !== 'all') {
      if (!['active', 'expired', 'cancelled'].includes(contractStatus)) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, "contract_status는 active|expired|cancelled|all 중 하나여야 합니다");
      }
      query = query.eq('contract_status', contractStatus);
    } else if (!contractStatus) {
      // 기본: active만
      query = query.eq('contract_status', 'active');
    }

    if (paymentStatus && paymentStatus !== 'all') {
      if (!['paid', 'unpaid', 'overdue'].includes(paymentStatus)) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, "payment_status는 paid|unpaid|overdue|all 중 하나여야 합니다");
      }
      query = query.eq('payment_status', paymentStatus);
    }

    // 만료 임박 (오늘 ~ 오늘+N일)
    if (expiringWithinDays) {
      const n = Number(expiringWithinDays);
      if (!Number.isFinite(n) || n < 0 || n > 365) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'expiring_within_days는 0~365 사이 숫자여야 합니다');
      }
      const today = new Date();
      const target = new Date();
      target.setDate(today.getDate() + Math.floor(n));
      const todayStr = today.toISOString().slice(0, 10);
      const targetStr = target.toISOString().slice(0, 10);
      query = query.gte('end_date', todayStr).lte('end_date', targetStr);
    }

    // 검색 (차량번호 + 고객명)
    if (search) {
      const safe = search.replace(/[%,]/g, '');
      query = query.or(`vehicle_number.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
    }

    // 정렬: 만료일 가까운 순 (active 우선 보기), 이후 생성순
    query = query.order('end_date', { ascending: true }).order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[v1/monthly GET] 목록 조회:', error.message);
      return serverError('월주차 조회 중 오류가 발생했습니다');
    }

    return ok(data || [], paginationMeta(count ?? 0, { page, limit, offset }, (data ?? []).length));
  } catch (err) {
    console.error('[v1/monthly GET] 예외:', err);
    return serverError('월주차 조회 중 오류가 발생했습니다');
  }
}

// ────────────────────────────────────────────────────────
// POST: 월주차 신규 등록
// ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const errors = validateRequired(body, [
      'store_id', 'vehicle_number', 'customer_name', 'customer_phone',
      'start_date', 'end_date', 'monthly_fee',
    ]);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력해주세요', errors);
    }

    const supabase = await createClient();

    // 1. store_id의 org 검증
    const store = await verifyStoreOrg(supabase, body.store_id, ctx.orgId);
    if (!store) {
      return badRequest(ErrorCodes.STORE_NOT_FOUND, '사업장을 찾을 수 없거나 권한이 없습니다');
    }

    // crew/field_member는 배정된 store만 가능
    if (['crew', 'field_member'].includes(ctx.role)) {
      if (!ctx.storeIds || !ctx.storeIds.includes(body.store_id)) {
        return forbidden('해당 사업장에 등록 권한이 없습니다');
      }
    }

    // 2. tenant_id 검증 (선택)
    let tenant: any = null;
    if (body.tenant_id) {
      tenant = await verifyTenantOrg(supabase, body.tenant_id, ctx.orgId);
      if (!tenant) {
        return badRequest(ErrorCodes.TENANT_NOT_FOUND, '입주사를 찾을 수 없거나 권한이 없습니다');
      }
      if (tenant.status !== 'active') {
        return badRequest(ErrorCodes.VALIDATION_ERROR, '비활성 입주사에는 신규 계약을 등록할 수 없습니다');
      }
    }

    // 3. 날짜 검증
    const startDate = String(body.start_date);
    const endDate = String(body.end_date);
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '날짜는 YYYY-MM-DD 형식이어야 합니다');
    }
    if (endDate < startDate) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '종료일은 시작일 이후여야 합니다');
    }

    // 4. 월요금 검증
    const monthlyFee = Number(body.monthly_fee);
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'monthly_fee는 0 이상 숫자여야 합니다');
    }

    // 5. payment/contract status
    const paymentStatus = body.payment_status || 'unpaid';
    if (!['paid', 'unpaid', 'overdue'].includes(paymentStatus)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, "payment_status는 paid|unpaid|overdue 중 하나여야 합니다");
    }
    const contractStatus = body.contract_status || 'active';
    if (!['active', 'expired', 'cancelled'].includes(contractStatus)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, "contract_status는 active|expired|cancelled 중 하나여야 합니다");
    }

    // 6. 차량번호 정규화 (공백/하이픈 제거)
    const vehicleNumber = String(body.vehicle_number).replace(/[\s-]/g, '');
    if (vehicleNumber.length < 4) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '차량번호 형식이 올바르지 않습니다');
    }

    // 7. 같은 store 내 active 차량번호 중복 검사
    if (contractStatus === 'active') {
      const { data: dup } = await supabase
        .from('monthly_parking')
        .select('id')
        .eq('store_id', body.store_id)
        .eq('vehicle_number', vehicleNumber)
        .eq('contract_status', 'active')
        .maybeSingle();
      if (dup) {
        return conflict(
          ErrorCodes.VALIDATION_ERROR,
          `이미 등록된 활성 월주차 차량입니다: ${vehicleNumber}`
        );
      }
    }

    // 8. INSERT
    const insertData = {
      store_id: body.store_id,
      vehicle_number: vehicleNumber,
      vehicle_type: body.vehicle_type?.trim() || null,
      customer_name: String(body.customer_name).trim(),
      customer_phone: String(body.customer_phone).trim(),
      start_date: startDate,
      end_date: endDate,
      monthly_fee: Math.round(monthlyFee),
      payment_status: paymentStatus,
      contract_status: contractStatus,
      note: body.note?.trim() || null,
      tenant_id: body.tenant_id || null,
      renewed_from_id: null, // 신규는 항상 null (renew API에서만 설정)
    };

    const { data: inserted, error: insErr } = await supabase
      .from('monthly_parking')
      .insert(insertData)
      .select('*, stores(id, name), tenants(id, name)')
      .single();

    if (insErr || !inserted) {
      console.error('[v1/monthly POST] insert:', insErr?.message);
      return serverError('월주차 등록 중 오류가 발생했습니다');
    }

    // 9. tenant usage_count++ + last_contracted_at 갱신 (best-effort, 실패해도 등록은 성공)
    if (tenant) {
      const { error: tenantUpdErr } = await supabase
        .from('tenants')
        .update({
          usage_count: (tenant.usage_count || 0) + 1,
          last_contracted_at: new Date().toISOString(),
          updated_by: ctx.userId,
        })
        .eq('id', tenant.id)
        .eq('org_id', ctx.orgId);
      if (tenantUpdErr) {
        console.warn('[v1/monthly POST] tenant 갱신 실패(무시):', tenantUpdErr.message);
      }
    }

    // 10. audit
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'monthly_parking',
      recordId: inserted.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: inserted,
    });

    return created(inserted);
  } catch (err) {
    console.error('[v1/monthly POST] 예외:', err);
    return serverError('월주차 등록 중 오류가 발생했습니다');
  }
}
