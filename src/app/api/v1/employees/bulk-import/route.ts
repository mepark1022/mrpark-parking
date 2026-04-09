/**
 * 미팍 통합앱 v2 — 직원 일괄 등록 API
 * POST /api/v1/employees/bulk-import
 * 
 * 클라이언트에서 Excel 파싱 후 JSON 배열로 전송
 * 부분 성공 허용 (성공/실패 분리 응답)
 * 
 * 권한: SYSTEM (super_admin만)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  requireAuth,
  ok,
  badRequest,
  serverError,
  ErrorCodes,
} from '@/lib/api';
import { writeAuditLog } from '@/lib/api/helpers';

interface BulkEmployeeInput {
  emp_no: string;
  name: string;
  phone?: string;
  position?: string;
  role?: string;
  hire_date: string;
  work_type?: string;
  base_salary?: number;
  weekend_daily?: number;
  store_id?: string;
}

interface BulkResult {
  row: number;
  emp_no: string;
  name: string;
  status: 'success' | 'error';
  error?: string;
  employee_id?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'SYSTEM');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const body = await request.json();
    const employees: BulkEmployeeInput[] = body.employees;

    if (!Array.isArray(employees) || employees.length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '등록할 직원 목록이 비어있습니다');
    }

    if (employees.length > 200) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '한 번에 200명까지만 등록 가능합니다');
    }

    const supabase = await createClient();

    // 기존 사번 목록 조회 (중복 체크용)
    const { data: existingEmps } = await supabase
      .from('employees')
      .select('emp_no')
      .eq('org_id', ctx.orgId);

    const existingSet = new Set(existingEmps?.map(e => e.emp_no.toUpperCase()) ?? []);

    const results: BulkResult[] = [];
    const toInsert: Array<Record<string, unknown>> = [];
    const storeAssignments: Array<{ employee_index: number; store_id: string }> = [];

    // 검증 패스
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const row = i + 1;

      // 필수 필드
      if (!emp.emp_no || !emp.name || !emp.hire_date) {
        results.push({
          row,
          emp_no: emp.emp_no || '(없음)',
          name: emp.name || '(없음)',
          status: 'error',
          error: '사번, 이름, 입사일은 필수입니다',
        });
        continue;
      }

      const empNoUpper = emp.emp_no.toUpperCase();

      // 중복 체크 (DB + 이번 배치 내)
      if (existingSet.has(empNoUpper)) {
        results.push({
          row,
          emp_no: empNoUpper,
          name: emp.name,
          status: 'error',
          error: '이미 등록된 사번입니다',
        });
        continue;
      }

      // 이번 배치 내 중복
      const batchDup = toInsert.find(t => t.emp_no === empNoUpper);
      if (batchDup) {
        results.push({
          row,
          emp_no: empNoUpper,
          name: emp.name,
          status: 'error',
          error: '이번 등록 목록 내 사번 중복',
        });
        continue;
      }

      existingSet.add(empNoUpper);

      const insertData = {
        org_id: ctx.orgId,
        emp_no: empNoUpper,
        name: emp.name,
        phone: emp.phone || null,
        position: emp.position || null,
        role: emp.role || 'crew',
        status: '재직' as const,
        hire_date: emp.hire_date,
        work_type: emp.work_type || null,
        base_salary: emp.base_salary ?? 0,
        weekend_daily: emp.weekend_daily ?? 0,
      };

      toInsert.push(insertData);
      results.push({
        row,
        emp_no: empNoUpper,
        name: emp.name,
        status: 'success',
      });

      if (emp.store_id) {
        storeAssignments.push({
          employee_index: toInsert.length - 1,
          store_id: emp.store_id,
        });
      }
    }

    // 유효한 데이터만 INSERT
    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('employees')
        .insert(toInsert)
        .select('id, emp_no');

      if (insertErr) {
        console.error('[Bulk Import] INSERT 실패:', insertErr);
        // 전체 실패
        return serverError('일괄 등록 중 데이터베이스 오류');
      }

      if (inserted) {
        // 결과에 employee_id 매핑
        for (let i = 0; i < inserted.length; i++) {
          const matchResult = results.find(
            r => r.status === 'success' && r.emp_no === inserted[i].emp_no
          );
          if (matchResult) {
            matchResult.employee_id = inserted[i].id;
          }
        }

        // 사업장 배정
        if (storeAssignments.length > 0) {
          const smInserts = storeAssignments
            .map(sa => {
              const emp = inserted[sa.employee_index];
              if (!emp) return null;
              return {
                org_id: ctx.orgId,
                employee_id: emp.id,
                store_id: sa.store_id,
                is_primary: true,
                is_active: true,
                assigned_by: ctx.userId,
              };
            })
            .filter(Boolean);

          if (smInserts.length > 0) {
            await supabase.from('store_members').insert(smInserts);
          }
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    // 감사 로그
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'employees',
      recordId: 'bulk-import',
      action: 'insert',
      changedBy: ctx.userId,
      afterData: { total: employees.length, success: successCount, error: errorCount },
      reason: `일괄 등록: ${successCount}명 성공, ${errorCount}명 실패`,
    });

    return ok({
      total: employees.length,
      success: successCount,
      error: errorCount,
      results,
    });
  } catch (err) {
    console.error('[Bulk Import]', err);
    return serverError('일괄 등록 중 오류');
  }
}
