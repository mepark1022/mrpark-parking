/**
 * 미팍 통합앱 v2 — 현장일보 상세/수정 API
 * GET /api/v1/daily-reports/:id   일보 상세 (staff + payment + extra JOIN)
 * PUT /api/v1/daily-reports/:id   일보 수정
 *
 * GET 권한: OPERATE (crew/field는 배정 사업장 + 본인 사업장만)
 * PUT 권한:
 *   - OPERATE: 본인 작성분 + 아직 confirmed 아님 + 당일(field_member는 당일만)
 *   - MANAGE: 제한 없음 (confirmed도 수정 가능, 이 경우 audit_logs 기록)
 *
 * PUT 본문:
 *   - 마스터 필드: weather/event_flag/event_name/memo/total_cars
 *   - staff/payment/extra는 여기서 수정하지 않음 (Part 10B 전용 엔드포인트)
 *   - status 변경 불가 (confirm은 별도 엔드포인트)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT에서 수정 가능한 마스터 필드 화이트리스트
const UPDATABLE_FIELDS = [
  'weather',
  'event_flag',
  'event_name',
  'memo',
  'total_cars',
] as const;

// ──────────────────────────────────────────────
// GET /api/v1/daily-reports/:id
// ──────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: report, error } = await supabase
      .from('daily_reports')
      .select(
        `id, org_id, store_id, report_date, status, weather, event_flag, event_name,
         memo, total_cars, valet_count, total_revenue,
         created_by, submitted_at, confirmed_at, confirmed_by,
         created_at, updated_at,
         stores:store_id(id, name, site_code)`
      )
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (error) {
      console.error('[v1/daily-reports/:id GET]', error.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    if (!report) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // 스코프 검증
    if (!canAccessStore(ctx, report.store_id as string)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    // 자식 레코드 조회 (병렬)
    const [staffRes, payRes, extraRes] = await Promise.all([
      supabase
        .from('daily_report_staff')
        .select(
          `id, employee_id, staff_type, role, check_in, check_out, work_hours, memo, created_at,
           employees:employee_id(id, emp_no, name, position)`
        )
        .eq('report_id', id)
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('daily_report_payment')
        .select('id, method, amount, count, memo, created_at')
        .eq('report_id', id)
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('daily_report_extra')
        .select('id, category, title, storage_path, url, metadata, created_by, created_at')
        .eq('report_id', id)
        .eq('org_id', ctx.orgId)
        .order('created_at', { ascending: true }),
    ]);

    if (staffRes.error || payRes.error || extraRes.error) {
      console.error(
        '[v1/daily-reports/:id GET] 자식 조회:',
        staffRes.error?.message,
        payRes.error?.message,
        extraRes.error?.message
      );
      return serverError('일보 상세 조회 중 오류가 발생했습니다');
    }

    return ok({
      ...report,
      staff: staffRes.data ?? [],
      payment: payRes.data ?? [],
      extra: extraRes.data ?? [],
    });
  } catch (err) {
    console.error('[v1/daily-reports/:id GET] 서버 오류:', err);
    return serverError('일보 조회 중 오류가 발생했습니다');
  }
}

// ──────────────────────────────────────────────
// PUT /api/v1/daily-reports/:id
// ──────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    // 변경 필드 추출
    const updates: Record<string, unknown> = {};
    for (const key of UPDATABLE_FIELDS) {
      if (key in body && body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '수정할 필드가 없습니다');
    }

    // total_cars 검증
    if ('total_cars' in updates) {
      const n = Number(updates.total_cars);
      if (Number.isNaN(n) || n < 0) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          'total_cars는 0 이상의 숫자여야 합니다'
        );
      }
      updates.total_cars = n;
    }

    const supabase = await createClient();

    // 기존 조회 (권한/상태/스코프 검증 + audit before)
    const { data: before, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id PUT] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }

    if (!before) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // 스코프 검증
    if (!canAccessStore(ctx, before.store_id as string)) {
      return forbidden('해당 사업장에 대한 접근 권한이 없습니다');
    }

    const isManage = ['super_admin', 'admin'].includes(ctx.role);

    // OPERATE(crew/field)는 본인 작성분만 + confirmed 상태 수정 불가
    if (!isManage) {
      if (before.created_by !== ctx.userId) {
        return forbidden('본인이 작성한 일보만 수정할 수 있습니다');
      }
      if (before.status === 'confirmed') {
        return badRequest(
          ErrorCodes.REPORT_ALREADY_CONFIRMED,
          '확정된 일보는 관리자만 수정할 수 있습니다'
        );
      }
      // field_member는 당일(report_date)만 수정 허용
      if (ctx.role === 'field_member') {
        const today = new Date().toISOString().slice(0, 10);
        if (before.report_date !== today) {
          return forbidden('현장요원은 당일 작성분만 수정할 수 있습니다');
        }
      }
    }

    // 업데이트
    const { data: updated, error: updateErr } = await supabase
      .from('daily_reports')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error('[v1/daily-reports/:id PUT] update:', updateErr?.message);
      return serverError('일보 수정 중 오류가 발생했습니다');
    }

    // MANAGE가 confirmed 일보를 수정했거나 이유가 제공된 경우 audit
    if (isManage || reason) {
      await writeAuditLog({
        orgId: ctx.orgId,
        tableName: 'daily_reports',
        recordId: id,
        action: 'update',
        changedBy: ctx.userId,
        beforeData: before,
        afterData: updated,
        reason: reason || (isManage ? '관리자 수정' : '작성자 수정'),
      });
    }

    return ok(updated);
  } catch (err) {
    console.error('[v1/daily-reports/:id PUT] 서버 오류:', err);
    return serverError('일보 수정 중 오류가 발생했습니다');
  }
}
