/**
 * GET /api/v1/stores/assigned
 * CREW/field_member → 배정된 사업장 목록
 * admin/super_admin → 전체 사업장 목록
 * 
 * 응답: { stores: [{ id, name, address, site_code, is_primary }] }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, serverError, badRequest } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';

interface AssignedStore {
  id: string;
  name: string;
  address?: string;
  site_code?: string;
  is_primary: boolean;
}

export async function GET(request: NextRequest) {
  // OPERATE 권한 이상 (crew, admin, super_admin)
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const supabase = await createClient();

    // admin/super_admin → 전체 사업장
    if (['super_admin', 'admin'].includes(ctx.role)) {
      const { data: stores, error } = await supabase
        .from('stores')
        .select('id, name, address, site_code')
        .eq('org_id', ctx.orgId)
        .order('name');

      if (error) {
        console.error('[stores/assigned] 조회 오류:', error.message);
        return serverError('사업장 조회 중 오류가 발생했습니다');
      }

      const result: AssignedStore[] = (stores || []).map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address ?? undefined,
        site_code: s.site_code ?? undefined,
        is_primary: false, // admin은 모두 접근 가능
      }));

      return ok({ stores: result });
    }

    // crew/field_member → store_members 기반 배정 사업장
    if (!ctx.employeeId) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        '직원 정보가 연결되지 않았습니다. 관리자에게 문의하세요'
      );
    }

    const { data: members, error: memberError } = await supabase
      .from('store_members')
      .select('store_id, is_primary, stores(id, name, address, site_code)')
      .eq('employee_id', ctx.employeeId)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true);

    if (memberError) {
      console.error('[stores/assigned] store_members 조회 오류:', memberError.message);
      return serverError('배정 사업장 조회 중 오류가 발생했습니다');
    }

    const result: AssignedStore[] = (members || [])
      .filter((m: any) => m.stores)
      .map((m: any) => ({
        id: m.stores.id,
        name: m.stores.name,
        address: m.stores.address ?? undefined,
        site_code: m.stores.site_code ?? undefined,
        is_primary: m.is_primary ?? false,
      }));

    return ok({ stores: result });
  } catch (err) {
    console.error('[stores/assigned] 서버 오류:', err);
    return serverError('사업장 조회 중 오류가 발생했습니다');
  }
}
