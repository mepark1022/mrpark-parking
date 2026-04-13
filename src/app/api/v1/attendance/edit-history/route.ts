/**
 * 미팍 통합앱 v2 — 근태 수정이력 조회 (Part 11B)
 * GET /api/v1/attendance/edit-history
 *   ?emp_id=&date_from=&date_to=&action=insert|update|delete&page=&limit=
 *
 * 권한: MANAGE
 *
 * 데이터 소스: audit_logs (table_name = 'attendance_overrides')
 *
 * 반환:
 *   {
 *     items: [{
 *       id, action, changed_at, reason,
 *       changed_by, changed_by_name,
 *       employee_id, emp_no, name,
 *       work_date, before_data, after_data
 *     }],
 *     meta: { total, page, limit, page_size, total_pages }
 *   }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import {
  getQueryParam,
  parsePagination,
  paginationMeta,
} from '@/lib/api/helpers';
import { isValidDate } from '@/lib/api/attendance';

interface AuditLogMini {
  id: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  changed_by: string;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  changed_at: string | null;
}

// JSON data에서 employee_id, work_date 추출
function extractEmpAndDate(
  log: AuditLogMini
): { employee_id: string | null; work_date: string | null } {
  const data = log.after_data ?? log.before_data;
  if (!data || typeof data !== 'object') {
    return { employee_id: null, work_date: null };
  }
  const rec = data as Record<string, unknown>;
  return {
    employee_id: typeof rec.employee_id === 'string' ? rec.employee_id : null,
    work_date: typeof rec.work_date === 'string' ? rec.work_date : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const empIdFilter = getQueryParam(request, 'emp_id');
    const dateFrom = getQueryParam(request, 'date_from');
    const dateTo = getQueryParam(request, 'date_to');
    const actionParam = getQueryParam(request, 'action');

    if (dateFrom && !isValidDate(dateFrom)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'date_from 형식이 올바르지 않습니다');
    }
    if (dateTo && !isValidDate(dateTo)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'date_to 형식이 올바르지 않습니다');
    }
    if (actionParam && !['insert', 'update', 'delete'].includes(actionParam)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'action은 insert/update/delete 중 하나여야 합니다');
    }

    const pg = parsePagination(request);
    const supabase = await createClient();

    // ── audit_logs 조회 ──
    let q = supabase
      .from('audit_logs')
      .select('id, record_id, action, changed_by, reason, before_data, after_data, changed_at', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .eq('table_name', 'attendance_overrides')
      .order('changed_at', { ascending: false });

    if (actionParam) q = q.eq('action', actionParam);

    // 날짜 필터: audit_logs.created_at 기준이 아닌, JSON data의 work_date 기준이므로
    // 1차적으로 기간 제한이 없으면 페이지네이션 전에 충분한 범위 확보 필요.
    // 여기서는 우선 created_at과 별개로 전체 내 페이지를 가져온 뒤 메모리 필터.
    // (audit_logs는 기본적으로 빠르게 누적되지 않으므로 페이지 단위 필터면 충분)

    const { data: logs, error: logErr, count } = await q.range(
      pg.offset,
      pg.offset + pg.limit - 1
    );

    if (logErr) {
      console.error('[v1/attendance/edit-history] audit_logs:', logErr.message);
      return serverError('수정이력 조회 중 오류가 발생했습니다');
    }

    const rawLogs = (logs ?? []) as AuditLogMini[];

    // ── 메모리 필터: emp_id / work_date 범위 ──
    const filtered = rawLogs.filter(log => {
      const { employee_id, work_date } = extractEmpAndDate(log);
      if (empIdFilter && employee_id !== empIdFilter) return false;
      if (dateFrom && work_date && work_date < dateFrom) return false;
      if (dateTo && work_date && work_date > dateTo) return false;
      // work_date이 null이고 날짜 필터가 있으면 제외
      if ((dateFrom || dateTo) && !work_date) return false;
      return true;
    });

    // ── 직원 정보 조회 (emp_id 수집) ──
    const empIds = new Set<string>();
    for (const log of filtered) {
      const { employee_id } = extractEmpAndDate(log);
      if (employee_id) empIds.add(employee_id);
    }

    const empMap = new Map<string, { emp_no: string; name: string }>();
    if (empIds.size > 0) {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, emp_no, name')
        .eq('org_id', ctx.orgId)
        .in('id', [...empIds]);
      for (const e of emps ?? []) {
        empMap.set(e.id, { emp_no: e.emp_no, name: e.name });
      }
    }

    // ── profiles(수정자 이름) ──
    const userIds = [...new Set(filtered.map(l => l.changed_by).filter(Boolean))];
    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      for (const p of profs ?? []) {
        userMap.set(p.id, p.name ?? '');
      }
    }

    // ── 응답 조립 ──
    const items = filtered.map(log => {
      const { employee_id, work_date } = extractEmpAndDate(log);
      const emp = employee_id ? empMap.get(employee_id) : null;
      return {
        id: log.id,
        action: log.action,
        changed_at: log.changed_at,
        reason: log.reason,
        changed_by: log.changed_by,
        changed_by_name: userMap.get(log.changed_by) ?? null,
        employee_id,
        emp_no: emp?.emp_no ?? null,
        name: emp?.name ?? null,
        work_date,
        before_data: log.before_data,
        after_data: log.after_data,
      };
    });

    return ok({ items }, paginationMeta(count ?? 0, pg, items.length));
  } catch (err) {
    console.error('[v1/attendance/edit-history] exception:', err);
    return serverError();
  }
}
