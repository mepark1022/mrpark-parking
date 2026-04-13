/**
 * 미팍 통합앱 v2 — 현장일보 API (목록/작성)
 * GET  /api/v1/daily-reports   일보 목록 (날짜/사업장 필터, 페이지네이션)
 * POST /api/v1/daily-reports   일보 작성 (OPERATE: crew/field, MANAGE: 관리자)
 *
 * 스코프:
 *   super_admin/admin → 전체
 *   crew/field_member → 배정 사업장만
 *
 * POST 규칙:
 *   - 동일 org_id + store_id + report_date 중복 시 409
 *   - body.staff / body.payment / body.extra 배열을 함께 insert (트랜잭션 유사 처리)
 *   - 초기 status = 'submitted' (CREW 일보 제출 시) 또는 'draft' (임시저장)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import {
  ok,
  created,
  badRequest,
  forbidden,
  conflict,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import {
  parsePagination,
  paginationMeta,
  getQueryParam,
  validateRequired,
} from '@/lib/api/helpers';
import type {
  DailyReportStatus,
  DailyReportStaffType,
  DailyReportPaymentMethod,
} from '@/lib/api/types';
import type { TablesInsert, Json } from '@/lib/database.types';

// ──────────────────────────────────────────────
// GET /api/v1/daily-reports
// ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    // 필터 파라미터
    const storeId = getQueryParam(request, 'store_id');
    const status = getQueryParam(request, 'status') as DailyReportStatus | null;
    const dateFrom = getQueryParam(request, 'date_from');
    const dateTo = getQueryParam(request, 'date_to');
    const reportDate = getQueryParam(request, 'report_date'); // 단일 날짜

    let query = supabase
      .from('daily_reports')
      .select(
        `id, org_id, store_id, report_date, status, weather, event_flag, event_name,
         memo, total_cars, valet_count, total_revenue,
         created_by, submitted_at, confirmed_at, confirmed_by,
         created_at, updated_at,
         stores:store_id(id, name, site_code)`,
        { count: 'exact' }
      )
      .eq('org_id', ctx.orgId);

    // 사업장 스코프 (crew/field_member)
    if (['crew', 'field_member'].includes(ctx.role)) {
      const ids = ctx.storeIds ?? [];
      if (ids.length === 0) {
        return ok([], paginationMeta(0, { page, limit, offset }, 0));
      }
      query = query.in('store_id', ids);
    }

    // store_id 필터
    if (storeId) {
      // 권한 범위 밖 store_id 요청 시 차단
      if (!canAccessStore(ctx, storeId)) {
        return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
      }
      query = query.eq('store_id', storeId);
    }

    if (status) query = query.eq('status', status);
    if (reportDate) query = query.eq('report_date', reportDate);
    if (dateFrom) query = query.gte('report_date', dateFrom);
    if (dateTo) query = query.lte('report_date', dateTo);

    const { data, error, count } = await query
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[v1/daily-reports GET]', error.message);
      return serverError('일보 목록 조회 중 오류가 발생했습니다');
    }

    return ok(
      data ?? [],
      paginationMeta(count ?? 0, { page, limit, offset }, data?.length ?? 0)
    );
  } catch (err) {
    console.error('[v1/daily-reports GET] 서버 오류:', err);
    return serverError('일보 목록 조회 중 오류가 발생했습니다');
  }
}

// ──────────────────────────────────────────────
// POST /api/v1/daily-reports
// ──────────────────────────────────────────────

interface StaffInput {
  employee_id: string;
  staff_type: DailyReportStaffType;
  role?: string;
  check_in?: string;
  check_out?: string;
  work_hours?: number;
  memo?: string;
}

interface PaymentInput {
  method: DailyReportPaymentMethod;
  amount: number;
  count?: number;
  memo?: string;
}

interface ExtraInput {
  category: 'photo' | 'document' | 'note';
  title?: string;
  storage_path?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

const ALLOWED_STAFF_TYPES: DailyReportStaffType[] = [
  'regular', 'peak', 'support', 'part_time', 'off_duty', 'additional',
];
const ALLOWED_PAYMENT_METHODS: DailyReportPaymentMethod[] = [
  'card', 'cash', 'valet_fee', 'monthly', 'free', 'transfer', 'other',
];

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => ({}));

    // 필수 필드
    const errors = validateRequired(body, ['store_id', 'report_date']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 필드가 누락되었습니다', errors);
    }

    const storeId = String(body.store_id);
    const reportDate = String(body.report_date);

    // 날짜 형식 YYYY-MM-DD 체크
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'report_date는 YYYY-MM-DD 형식이어야 합니다'
      );
    }

    // 사업장 접근 권한
    if (!canAccessStore(ctx, storeId)) {
      return forbidden('해당 사업장에 일보를 작성할 권한이 없습니다');
    }

    // 초기 상태 (임시저장 vs 제출)
    const status: DailyReportStatus =
      body.status === 'draft' ? 'draft' : 'submitted';

    // 자식 배열 검증
    const staffList: StaffInput[] = Array.isArray(body.staff) ? body.staff : [];
    const paymentList: PaymentInput[] = Array.isArray(body.payment) ? body.payment : [];
    const extraList: ExtraInput[] = Array.isArray(body.extra) ? body.extra : [];

    for (const s of staffList) {
      if (!s.employee_id || !s.staff_type) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'staff 각 항목은 employee_id, staff_type 필수'
        );
      }
      if (!ALLOWED_STAFF_TYPES.includes(s.staff_type)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `유효하지 않은 staff_type: ${s.staff_type}`
        );
      }
    }
    for (const p of paymentList) {
      if (!p.method || !ALLOWED_PAYMENT_METHODS.includes(p.method)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `유효하지 않은 payment.method: ${p.method}`
        );
      }
      if (typeof p.amount !== 'number' || p.amount < 0) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'payment.amount는 0 이상의 숫자여야 합니다'
        );
      }
    }

    const supabase = await createClient();

    // 중복 확인
    const { data: dup } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('store_id', storeId)
      .eq('report_date', reportDate)
      .maybeSingle();

    if (dup) {
      return conflict(
        ErrorCodes.REPORT_DUPLICATE_DATE,
        '해당 날짜에 이미 일보가 존재합니다',
        { existing_id: dup.id }
      );
    }

    // 매출 합계 캐시 계산
    const totalRevenue = paymentList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const valetCount =
      paymentList.find(p => p.method === 'valet_fee')?.count ?? 0;

    // 마스터 insert
    const nowIso = new Date().toISOString();
    const { data: master, error: masterErr } = await supabase
      .from('daily_reports')
      .insert({
        org_id: ctx.orgId,
        store_id: storeId,
        report_date: reportDate,
        status,
        weather: body.weather ?? null,
        event_flag: Boolean(body.event_flag),
        event_name: body.event_name ?? null,
        memo: body.memo ?? null,
        total_cars: Number(body.total_cars ?? 0),
        valet_count: valetCount,
        total_revenue: totalRevenue,
        created_by: ctx.userId,
        submitted_at: status === 'submitted' ? nowIso : null,
      })
      .select()
      .single();

    if (masterErr || !master) {
      console.error('[v1/daily-reports POST] master insert:', masterErr?.message);
      return serverError('일보 생성 중 오류가 발생했습니다');
    }

    // 자식 배열 insert (실패 시 마스터 롤백)
    async function rollback(reportId: string) {
      await supabase.from('daily_reports').delete().eq('id', reportId);
    }

    if (staffList.length > 0) {
      const rows = staffList.map(s => ({
        org_id: ctx.orgId,
        report_id: master.id,
        employee_id: s.employee_id,
        staff_type: s.staff_type,
        role: s.role ?? null,
        check_in: s.check_in ?? null,
        check_out: s.check_out ?? null,
        work_hours: s.work_hours ?? null,
        memo: s.memo ?? null,
      }));
      const { error: staffErr } = await supabase.from('daily_report_staff').insert(rows);
      if (staffErr) {
        console.error('[v1/daily-reports POST] staff insert:', staffErr.message);
        await rollback(master.id);
        return serverError('근무인원 저장 중 오류가 발생했습니다');
      }
    }

    if (paymentList.length > 0) {
      const rows = paymentList.map(p => ({
        org_id: ctx.orgId,
        report_id: master.id,
        method: p.method,
        amount: p.amount,
        count: p.count ?? 0,
        memo: p.memo ?? null,
      }));
      const { error: payErr } = await supabase.from('daily_report_payment').insert(rows);
      if (payErr) {
        console.error('[v1/daily-reports POST] payment insert:', payErr.message);
        await rollback(master.id);
        return serverError('결제매출 저장 중 오류가 발생했습니다');
      }
    }

    if (extraList.length > 0) {
      const rows: TablesInsert<'daily_report_extra'>[] = extraList.map(e => ({
        org_id: ctx.orgId,
        report_id: master.id,
        category: e.category,
        title: e.title ?? null,
        storage_path: e.storage_path ?? null,
        url: e.url ?? null,
        metadata: (e.metadata ?? null) as Json | null,
        created_by: ctx.userId,
      }));
      const { error: extraErr } = await supabase.from('daily_report_extra').insert(rows);
      if (extraErr) {
        console.error('[v1/daily-reports POST] extra insert:', extraErr.message);
        await rollback(master.id);
        return serverError('추가항목 저장 중 오류가 발생했습니다');
      }
    }

    return created({
      report: master,
      staff_count: staffList.length,
      payment_count: paymentList.length,
      extra_count: extraList.length,
    });
  } catch (err) {
    console.error('[v1/daily-reports POST] 서버 오류:', err);
    return serverError('일보 생성 중 오류가 발생했습니다');
  }
}
