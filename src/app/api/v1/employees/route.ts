/**
 * 미팍 통합앱 v2 — Employee API
 * GET  /api/v1/employees       목록 조회 (필터 6종 + 페이지네이션)
 * POST /api/v1/employees       신규 직원 등록
 * 
 * 권한: MANAGE (super_admin, admin)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  created,
  badRequest,
  conflict,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import {
  parsePagination,
  paginationMeta,
  validateRequired,
  getQueryParam,
  getQueryParams,
  writeAuditLog,
} from '@/lib/api/helpers';

// ── GET: 직원 목록 ──
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();
    const { page, limit, offset } = parsePagination(request);

    // 필터 6종
    const storeId = getQueryParam(request, 'store_id');
    const workType = getQueryParam(request, 'work_type');
    const status = getQueryParam(request, 'status');         // 재직/퇴사/수습/휴직
    const role = getQueryParam(request, 'role');              // crew/field_member/admin
    const search = getQueryParam(request, 'search');          // 이름/사번 검색
    const hasAccount = getQueryParam(request, 'has_account'); // true/false

    // 기본 쿼리
    let query = supabase
      .from('employees')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    } else {
      // 기본: 퇴사자 제외
      query = query.neq('status', '퇴사');
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (workType) {
      query = query.eq('work_type', workType);
    }

    if (search) {
      // 이름 또는 사번 검색 (ilike)
      query = query.or(`name.ilike.%${search}%,emp_no.ilike.%${search}%`);
    }

    // 사업장 필터: store_members JOIN 필요 → 별도 처리
    if (storeId) {
      const { data: members } = await supabase
        .from('store_members')
        .select('employee_id')
        .eq('org_id', ctx.orgId)
        .eq('store_id', storeId)
        .eq('is_active', true);

      const empIds = (members ?? []).map(m => m.employee_id).filter((x): x is string => !!x);
      if (empIds.length === 0) {
        return ok([], paginationMeta(0, { page, limit, offset }));
      }
      query = query.in('id', empIds);
    }

    // 계정 존재 여부 필터
    if (hasAccount === 'true' || hasAccount === 'false') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('employee_id')
        .eq('org_id', ctx.orgId)
        .not('employee_id', 'is', null);

      const accountEmpIds = new Set((profiles ?? []).map(p => p.employee_id).filter((x): x is string => !!x));

      // has_account 필터는 결과에서 클라이언트 필터로 처리하기엔 비효율 →
      // employee_id 목록으로 in/not-in 필터
      if (hasAccount === 'true' && accountEmpIds.size > 0) {
        query = query.in('id', [...accountEmpIds]);
      } else if (hasAccount === 'false') {
        // 계정 없는 직원 = 전체 - 계정 있는 직원
        // Supabase에는 not.in이 없으므로 결과에서 필터링
        // → 성능 이슈 시 RPC로 전환 가능
      }
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[Employee List]', error);
      return serverError('직원 목록 조회 실패');
    }

    // has_account=false 클라이언트 필터 (위에서 not.in 미지원)
    let result = data ?? [];
    if (hasAccount === 'false') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('employee_id')
        .eq('org_id', ctx.orgId)
        .not('employee_id', 'is', null);

      const accountSet = new Set(profiles?.map(p => p.employee_id) ?? []);
      result = result.filter(e => !accountSet.has(e.id));
    }

    return ok(result, paginationMeta(count ?? result.length, { page, limit, offset }));
  } catch (err) {
    console.error('[Employee List]', err);
    return serverError('직원 목록 조회 중 오류');
  }
}

// ── POST: 직원 신규 등록 ──
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();

    // 필수 필드 검사
    const errors = validateRequired(body, ['emp_no', 'name', 'hire_date']);
    if (errors.length > 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '필수 항목을 입력하세요', errors);
    }

    const supabase = await createClient();

    // 사번 중복 확인
    const { data: existing } = await supabase
      .from('employees')
      .select('id, emp_no')
      .eq('org_id', ctx.orgId)
      .eq('emp_no', body.emp_no.toUpperCase())
      .maybeSingle();

    if (existing) {
      // 자동 순번 제안
      const baseNo = body.emp_no.toUpperCase();
      const { data: similar } = await supabase
        .from('employees')
        .select('emp_no')
        .eq('org_id', ctx.orgId)
        .ilike('emp_no', `${baseNo}%`);

      return conflict(ErrorCodes.EMP_DUPLICATE_NO, '사번이 중복됩니다', {
        existing_emp_no: existing.emp_no,
        suggestion: `${baseNo}-${(similar?.length ?? 0) + 1}`,
      });
    }

    // INSERT
    const insertData = {
      org_id: ctx.orgId,
      emp_no: body.emp_no.toUpperCase(),
      name: body.name,
      phone: body.phone || null,
      position: body.position || null,
      role: body.role || 'crew',
      status: body.status || '재직',
      hire_date: body.hire_date,
      work_type: body.work_type || null,
      employment_type: body.employment_type || '정규직',
      base_salary: body.base_salary ?? 0,
      weekend_daily: body.weekend_daily ?? 0,
      probation_months: body.probation_months ?? 0,
      probation_end: body.probation_end || null,
      insurance_national: body.insurance_national ?? true,
      insurance_health: body.insurance_health ?? true,
      insurance_employ: body.insurance_employ ?? true,
      insurance_injury: body.insurance_injury ?? true,
      tax_type: body.tax_type || '간이세액',
      bank_name: body.bank_name || null,
      bank_account: body.bank_account || null,
      bank_holder: body.bank_holder || null,
      region: body.region || null,
      memo: body.memo || null,
    };

    const { data: employee, error } = await supabase
      .from('employees')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Employee Create]', error);
      return serverError('직원 등록 실패');
    }

    // 사업장 배정 (store_id가 제공된 경우)
    if (body.store_id) {
      await supabase.from('store_members').insert({
        org_id: ctx.orgId,
        employee_id: employee.id,
        store_id: body.store_id,
        is_primary: true,
        is_active: true,
        assigned_by: ctx.userId,
      });
    }

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: employee.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: employee,
    });

    return created(employee);
  } catch (err) {
    console.error('[Employee Create]', err);
    return serverError('직원 등록 중 오류');
  }
}
