/**
 * POST /api/v1/auth/bulk-create
 * 일괄 계정 생성 — 계정 미생성 직원 전체에 대해 한번에 계정 생성
 * 권한: SYSTEM (super_admin만)
 * 
 * Body: { employee_ids?: string[] }
 *   - employee_ids 없으면 → 계정 미생성 전체 대상
 *   - employee_ids 있으면 → 지정된 직원만
 * 
 * 응답: { success_count, fallback_count, fail_count, results[] }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth, ok, serverError,
  generateInitialPassword,
  maskInitialPassword,
  generateInternalEmail,
} from '@/lib/api';

interface BulkResult {
  emp_no: string;
  name: string;
  status: 'success' | 'fallback' | 'failed' | 'skipped';
  message: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'SYSTEM');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json().catch(() => ({}));
    const { employee_ids } = body as { employee_ids?: string[] };

    const supabase = await createClient();

    // 대상 직원 조회 (crew/field_member만, 재직/수습만)
    let query = supabase
      .from('employees')
      .select('id, emp_no, name, phone, role')
      .eq('org_id', ctx.orgId)
      .in('role', ['crew', 'field_member'])
      .in('status', ['재직', '수습']);

    if (employee_ids?.length) {
      query = query.in('id', employee_ids);
    }

    const { data: employees } = await query;
    if (!employees?.length) {
      return ok({ success_count: 0, fallback_count: 0, fail_count: 0, results: [] });
    }

    // 이미 계정 있는 직원 확인
    const empNos = employees.map(e => e.emp_no);
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('emp_no')
      .eq('org_id', ctx.orgId)
      .in('emp_no', empNos);

    const existingEmpNos = new Set(existingProfiles?.map(p => p.emp_no) ?? []);

    const results: BulkResult[] = [];
    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;

    for (const emp of employees) {
      // 이미 계정 있으면 건너뜀
      if (existingEmpNos.has(emp.emp_no)) {
        results.push({
          emp_no: emp.emp_no,
          name: emp.name,
          status: 'skipped',
          message: '이미 계정 존재',
        });
        continue;
      }

      try {
        const email = generateInternalEmail(emp.emp_no, emp.role as 'crew' | 'field_member');
        const password = generateInitialPassword(emp.phone, emp.emp_no);
        const isFallback = !emp.phone;

        // Auth 계정 생성
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError || !authData.user) {
          failCount++;
          results.push({
            emp_no: emp.emp_no,
            name: emp.name,
            status: 'failed',
            message: authError?.message || '계정 생성 실패',
          });
          continue;
        }

        // profiles INSERT
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          org_id: ctx.orgId,
          role: emp.role,
          emp_no: emp.emp_no,
          employee_id: emp.id,
          password_changed: false,
        });

        if (isFallback) {
          fallbackCount++;
          results.push({
            emp_no: emp.emp_no,
            name: emp.name,
            status: 'fallback',
            message: '전화번호 없음 → 사번 기반 비밀번호',
          });
        } else {
          successCount++;
          results.push({
            emp_no: emp.emp_no,
            name: emp.name,
            status: 'success',
            message: '계정 생성 완료',
          });
        }
      } catch (err) {
        failCount++;
        results.push({
          emp_no: emp.emp_no,
          name: emp.name,
          status: 'failed',
          message: String(err),
        });
      }
    }

    return ok({
      success_count: successCount,
      fallback_count: fallbackCount,
      fail_count: failCount,
      skip_count: results.filter(r => r.status === 'skipped').length,
      total: employees.length,
      results,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/bulk-create]', err);
    return serverError();
  }
}
