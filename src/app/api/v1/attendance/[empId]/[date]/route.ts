/**
 * 미팍 통합앱 v2 — 근태 직접수정 API (Part 11B)
 *
 * POST   /api/v1/attendance/:empId/:date   오버라이드 생성 (중복 시 409)
 * PUT    /api/v1/attendance/:empId/:date   오버라이드 upsert (있으면 update, 없으면 insert)
 * DELETE /api/v1/attendance/:empId/:date   오버라이드 삭제
 *
 * 권한: MANAGE (super_admin/admin)
 *
 * Body:
 *   {
 *     status: 'present' | 'late' | 'peak' | 'support' | 'additional' | 'leave' | 'off' | 'absent',
 *     store_id?: string | null,
 *     check_in?: 'HH:MM' | 'HH:MM:SS' | null,
 *     check_out?: 'HH:MM' | 'HH:MM:SS' | null,
 *     work_hours?: number | null,
 *     reason?: string | null,
 *     memo?: string | null
 *   }
 */
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import {
  ok,
  created,
  badRequest,
  conflict,
  notFound,
  serverError,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';
import {
  isValidAttendanceStatus,
  isValidDate,
  normalizeTime,
  type AttendanceOverrideRow,
} from '@/lib/api/attendance';

interface RouteParams {
  params: Promise<{ empId: string; date: string }>;
}

// ── Body 파싱 + 검증 ──
interface OverrideInput {
  status: string;
  store_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  work_hours?: number | null;
  reason?: string | null;
  memo?: string | null;
}

interface NormalizedInput {
  status: string;
  store_id: string | null;
  check_in: string | null;
  check_out: string | null;
  work_hours: number | null;
  reason: string | null;
  memo: string | null;
}

function normalizeInput(
  body: OverrideInput
): { valid: true; data: NormalizedInput } | { valid: false; message: string } {
  if (!isValidAttendanceStatus(body.status)) {
    return { valid: false, message: 'status 값이 올바르지 않습니다 (present/late/peak/support/additional/leave/off/absent)' };
  }

  const check_in = body.check_in !== undefined && body.check_in !== null
    ? normalizeTime(body.check_in)
    : null;
  if (body.check_in && !check_in) {
    return { valid: false, message: 'check_in 시간 형식이 올바르지 않습니다 (HH:MM 또는 HH:MM:SS)' };
  }

  const check_out = body.check_out !== undefined && body.check_out !== null
    ? normalizeTime(body.check_out)
    : null;
  if (body.check_out && !check_out) {
    return { valid: false, message: 'check_out 시간 형식이 올바르지 않습니다 (HH:MM 또는 HH:MM:SS)' };
  }

  let work_hours: number | null = null;
  if (body.work_hours !== undefined && body.work_hours !== null) {
    const n = Number(body.work_hours);
    if (!Number.isFinite(n) || n < 0 || n > 24) {
      return { valid: false, message: 'work_hours는 0~24 사이의 숫자여야 합니다' };
    }
    work_hours = Math.round(n * 100) / 100;
  }

  return {
    valid: true,
    data: {
      status: body.status,
      store_id: body.store_id ?? null,
      check_in,
      check_out,
      work_hours,
      reason: body.reason ?? null,
      memo: body.memo ?? null,
    },
  };
}

// ── 직원 존재 확인 (org_id 스코프) ──
async function verifyEmployee(
  supabase: SupabaseClient,
  orgId: string,
  empId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', empId)
    .maybeSingle();
  return !!data;
}

// ── POST: insert (중복 시 409) ──
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { empId, date } = await params;
    if (!isValidDate(date)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'date 형식이 올바르지 않습니다 (YYYY-MM-DD)');
    }

    const body = (await request.json().catch(() => null)) as OverrideInput | null;
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const check = normalizeInput(body);
    if (!check.valid) return badRequest(ErrorCodes.VALIDATION_ERROR, check.message);

    const supabase = await createClient();

    if (!(await verifyEmployee(supabase, ctx.orgId, empId))) {
      return notFound('직원을 찾을 수 없습니다');
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from('attendance_overrides')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('employee_id', empId)
      .eq('work_date', date)
      .maybeSingle();

    if (existing) {
      return conflict(
        ErrorCodes.ATT_DUPLICATE_OVERRIDE,
        '해당 날짜에 이미 오버라이드가 존재합니다. PUT으로 수정하세요'
      );
    }

    const { data: inserted, error: insErr } = await supabase
      .from('attendance_overrides')
      .insert({
        org_id: ctx.orgId,
        employee_id: empId,
        work_date: date,
        status: check.data.status,
        store_id: check.data.store_id,
        check_in: check.data.check_in,
        check_out: check.data.check_out,
        work_hours: check.data.work_hours,
        reason: check.data.reason,
        memo: check.data.memo,
        created_by: ctx.userId,
      })
      .select('*')
      .single();

    if (insErr || !inserted) {
      console.error('[v1/attendance/:empId/:date POST] insert:', insErr?.message);
      return serverError('근태 오버라이드 생성 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'attendance_overrides',
      recordId: inserted.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: inserted,
      reason: check.data.reason ?? undefined,
    });

    return created(inserted);
  } catch (err) {
    console.error('[v1/attendance/:empId/:date POST] exception:', err);
    return serverError();
  }
}

// ── PUT: upsert ──
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { empId, date } = await params;
    if (!isValidDate(date)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'date 형식이 올바르지 않습니다 (YYYY-MM-DD)');
    }

    const body = (await request.json().catch(() => null)) as OverrideInput | null;
    if (!body) return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 필요합니다');

    const check = normalizeInput(body);
    if (!check.valid) return badRequest(ErrorCodes.VALIDATION_ERROR, check.message);

    const supabase = await createClient();

    if (!(await verifyEmployee(supabase, ctx.orgId, empId))) {
      return notFound('직원을 찾을 수 없습니다');
    }

    const { data: existing } = await supabase
      .from('attendance_overrides')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('employee_id', empId)
      .eq('work_date', date)
      .maybeSingle();

    if (existing) {
      // UPDATE
      const { data: updated, error: upErr } = await supabase
        .from('attendance_overrides')
        .update({
          status: check.data.status,
          store_id: check.data.store_id,
          check_in: check.data.check_in,
          check_out: check.data.check_out,
          work_hours: check.data.work_hours,
          reason: check.data.reason,
          memo: check.data.memo,
          updated_by: ctx.userId,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (upErr || !updated) {
        console.error('[v1/attendance/:empId/:date PUT] update:', upErr?.message);
        return serverError('근태 오버라이드 수정 중 오류가 발생했습니다');
      }

      await writeAuditLog({
        orgId: ctx.orgId,
        tableName: 'attendance_overrides',
        recordId: updated.id,
        action: 'update',
        changedBy: ctx.userId,
        beforeData: existing,
        afterData: updated,
        reason: check.data.reason ?? undefined,
      });

      return ok(updated);
    }

    // INSERT
    const { data: inserted, error: insErr } = await supabase
      .from('attendance_overrides')
      .insert({
        org_id: ctx.orgId,
        employee_id: empId,
        work_date: date,
        status: check.data.status,
        store_id: check.data.store_id,
        check_in: check.data.check_in,
        check_out: check.data.check_out,
        work_hours: check.data.work_hours,
        reason: check.data.reason,
        memo: check.data.memo,
        created_by: ctx.userId,
      })
      .select('*')
      .single();

    if (insErr || !inserted) {
      console.error('[v1/attendance/:empId/:date PUT] insert:', insErr?.message);
      return serverError('근태 오버라이드 생성 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'attendance_overrides',
      recordId: inserted.id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: inserted,
      reason: check.data.reason ?? undefined,
    });

    return created(inserted);
  } catch (err) {
    console.error('[v1/attendance/:empId/:date PUT] exception:', err);
    return serverError();
  }
}

// ── DELETE ──
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { empId, date } = await params;
    if (!isValidDate(date)) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, 'date 형식이 올바르지 않습니다 (YYYY-MM-DD)');
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('attendance_overrides')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('employee_id', empId)
      .eq('work_date', date)
      .maybeSingle();

    if (!existing) {
      return notFound('해당 날짜의 오버라이드를 찾을 수 없습니다');
    }

    const { error: delErr } = await supabase
      .from('attendance_overrides')
      .delete()
      .eq('id', existing.id);

    if (delErr) {
      console.error('[v1/attendance/:empId/:date DELETE]:', delErr.message);
      return serverError('근태 오버라이드 삭제 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'attendance_overrides',
      recordId: existing.id,
      action: 'delete',
      changedBy: ctx.userId,
      beforeData: existing,
    });

    return ok({ id: existing.id, deleted: true });
  } catch (err) {
    console.error('[v1/attendance/:empId/:date DELETE] exception:', err);
    return serverError();
  }
}

// unused-variable 방지용 (타입만 사용)
export type _AttendanceOverrideRow = AttendanceOverrideRow;
