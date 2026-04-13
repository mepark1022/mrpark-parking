/**
 * 미팍 통합앱 v2 — Monthly Parking Renew API (Part 14C)
 * POST /api/v1/monthly/:id/renew    월주차 갱신
 *
 * 동작:
 *   1. 기존 row → contract_status='expired' 처리
 *   2. 신규 row 생성 (renewed_from_id = 기존 id)
 *      - 입력값 없으면 기존 row 값 복제
 *      - start_date 기본값: 기존 end_date + 1일
 *      - end_date 기본값: start_date + 1개월
 *   3. tenant 있으면 usage_count++ + last_contracted_at 갱신
 *   4. audit 2건 (기존 expired 처리 + 신규 insert)
 *
 * 권한: MANAGE
 *
 * 주의:
 *   - Supabase는 진짜 트랜잭션 미지원 → 순차 처리 + 실패 시 best-effort 롤백
 *   - 알림톡(월주차갱신완료)은 이 API에서 호출 안 함, 별도 cron/큐에서 처리
 *
 * Body (모두 optional):
 *   {
 *     start_date?: 'YYYY-MM-DD',     // 기본: 기존 end_date + 1일
 *     end_date?: 'YYYY-MM-DD',       // 기본: start_date + 1개월
 *     monthly_fee?: number,           // 기본: 기존 fee
 *     payment_status?: string,        // 기본: 'unpaid'
 *     vehicle_type?: string,          // 기본: 기존 값
 *     customer_name?: string,         // 기본: 기존 값
 *     customer_phone?: string,        // 기본: 기존 값
 *     note?: string,                  // 기본: 기존 값
 *   }
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
  notFound,
  forbidden,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

type RouteParams = { params: Promise<{ id: string }> };

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

// YYYY-MM-DD 날짜에 일수 더하기
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// YYYY-MM-DD 날짜에 1개월 더하기 (말일 보정: 1.31+1M = 2.28/29)
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const targetMonth = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const originalDay = d.getUTCDate();
  // 다음달 1일 - 1일 = 다음달 말일
  const lastDayOfTarget = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const finalDay = Math.min(originalDay, lastDayOfTarget);
  const result = new Date(Date.UTC(targetYear, normalizedMonth, finalDay));
  return result.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) || {};

    const supabase = await createClient();

    // 1. 기존 row 조회 + org 검증
    const { data: existing, error: fetchErr } = await supabase
      .from('monthly_parking')
      .select('*, stores!inner(id, name, org_id), tenants(id, name, status, usage_count)')
      .eq('id', id)
      .eq('stores.org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/monthly/:id/renew GET]:', fetchErr.message);
      return serverError('월주차 조회 중 오류가 발생했습니다');
    }
    if (!existing) return notFound('월주차를 찾을 수 없습니다');

    // crew/field 스코프 검증
    if (['crew', 'field_member'].includes(ctx.role)) {
      if (!ctx.storeIds || !ctx.storeIds.includes(existing.store_id)) {
        return forbidden('해당 사업장 갱신 권한이 없습니다');
      }
    }

    // 2. 갱신 가능 상태 검증
    if (existing.contract_status === 'cancelled') {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '취소된 계약은 갱신할 수 없습니다'
      );
    }
    // active든 expired든 갱신 가능 (현장 운영상 만료 후 재계약도 흔함)

    // 3. 새 row 필드 결정 (입력값 우선, 없으면 기존값/기본값)
    let startDate: string;
    if (body.start_date) {
      if (!isValidDate(String(body.start_date))) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'start_date는 YYYY-MM-DD 형식이어야 합니다');
      }
      startDate = String(body.start_date);
    } else {
      // 기본: 기존 end_date + 1일
      startDate = addDays(existing.end_date, 1);
    }

    let endDate: string;
    if (body.end_date) {
      if (!isValidDate(String(body.end_date))) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'end_date는 YYYY-MM-DD 형식이어야 합니다');
      }
      endDate = String(body.end_date);
    } else {
      // 기본: start_date + 1개월
      endDate = addMonths(startDate, 1);
    }

    if (endDate < startDate) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '종료일은 시작일 이후여야 합니다');
    }

    let monthlyFee: number;
    if (body.monthly_fee !== undefined) {
      const n = Number(body.monthly_fee);
      if (!Number.isFinite(n) || n < 0) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, 'monthly_fee는 0 이상 숫자여야 합니다');
      }
      monthlyFee = Math.round(n);
    } else {
      monthlyFee = existing.monthly_fee;
    }

    const paymentStatus = body.payment_status || 'unpaid';
    if (!['paid', 'unpaid', 'overdue'].includes(paymentStatus)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, "payment_status는 paid|unpaid|overdue 중 하나여야 합니다");
    }

    // 4. 신규 row 데이터 (기존 값 복제 + 입력값 덮어쓰기)
    const newRow = {
      store_id: existing.store_id,
      vehicle_number: existing.vehicle_number,
      vehicle_type: body.vehicle_type !== undefined ? (body.vehicle_type?.trim() || null) : existing.vehicle_type,
      customer_name: body.customer_name !== undefined ? String(body.customer_name).trim() : existing.customer_name,
      customer_phone: body.customer_phone !== undefined ? String(body.customer_phone).trim() : existing.customer_phone,
      start_date: startDate,
      end_date: endDate,
      monthly_fee: monthlyFee,
      payment_status: paymentStatus,
      contract_status: 'active',
      note: body.note !== undefined ? (body.note?.trim() || null) : existing.note,
      tenant_id: existing.tenant_id,           // 기존 입주사 그대로 승계
      renewed_from_id: existing.id,            // 갱신 추적
    };

    // 5. active 차량번호 중복 검사 (자기 자신 제외)
    // 기존 row가 active 상태에서 갱신하면 잠시 active 2개가 될 수 있음 → 곧바로 expired 처리하지만
    // 동일 store + vehicle_number + active인 다른 row가 있으면 차단
    const { data: dup } = await supabase
      .from('monthly_parking')
      .select('id')
      .eq('store_id', existing.store_id)
      .eq('vehicle_number', existing.vehicle_number)
      .eq('contract_status', 'active')
      .neq('id', existing.id)
      .maybeSingle();
    if (dup) {
      return conflict(
        ErrorCodes.VALIDATION_ERROR,
        `이미 등록된 다른 활성 월주차가 존재합니다 (id=${dup.id}). 먼저 정리해주세요.`
      );
    }

    // 6. 기존 row → expired 처리 (이미 expired면 skip)
    let prevUpdated: any = existing;
    if (existing.contract_status !== 'expired') {
      const { data: upd, error: upErr } = await supabase
        .from('monthly_parking')
        .update({ contract_status: 'expired' })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (upErr || !upd) {
        console.error('[v1/monthly/:id/renew expire]:', upErr?.message);
        return serverError('기존 계약 만료 처리 중 오류가 발생했습니다');
      }
      prevUpdated = upd;
    }

    // 7. 신규 row INSERT
    const { data: inserted, error: insErr } = await supabase
      .from('monthly_parking')
      .insert(newRow)
      .select('*, stores(id, name), tenants(id, name)')
      .single();

    if (insErr || !inserted) {
      console.error('[v1/monthly/:id/renew insert]:', insErr?.message);
      // 롤백: 기존 row 상태 되돌리기 (best-effort)
      if (existing.contract_status !== 'expired') {
        await supabase
          .from('monthly_parking')
          .update({ contract_status: existing.contract_status })
          .eq('id', existing.id);
      }
      return serverError('갱신 신규 등록 중 오류가 발생했습니다');
    }

    // 8. tenant usage_count++ + last_contracted_at 갱신 (best-effort)
    if (existing.tenant_id && existing.tenants) {
      const { error: tenantUpdErr } = await supabase
        .from('tenants')
        .update({
          usage_count: (existing.tenants.usage_count || 0) + 1,
          last_contracted_at: new Date().toISOString(),
          updated_by: ctx.userId,
        })
        .eq('id', existing.tenant_id)
        .eq('org_id', ctx.orgId);
      if (tenantUpdErr) {
        console.warn('[v1/monthly/:id/renew] tenant 갱신 실패(무시):', tenantUpdErr.message);
      }
    }

    // 9. audit 2건
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'monthly_parking',
      recordId: existing.id,
      action: 'renew_expire_prev',
      changedBy: ctx.userId,
      beforeData: existing,
      afterData: prevUpdated,
    });
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'monthly_parking',
      recordId: inserted.id,
      action: 'renew_insert_new',
      changedBy: ctx.userId,
      afterData: inserted,
    });

    return created({
      renewed: true,
      previous: prevUpdated,
      current: inserted,
    });
  } catch (err) {
    console.error('[v1/monthly/:id/renew POST] 예외:', err);
    return serverError('월주차 갱신 중 오류가 발생했습니다');
  }
}
