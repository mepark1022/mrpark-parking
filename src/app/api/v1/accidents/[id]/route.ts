/**
 * 미팍 통합앱 v2 — 사고보고 상세/수정/삭제 API (GAP-P1-3)
 * GET    /api/v1/accidents/:id  — 상세 + 사진 목록(Storage)
 * PATCH  /api/v1/accidents/:id  — 상태 변경 / 관리자 메모
 * DELETE /api/v1/accidents/:id  — 삭제
 *
 * 권한:
 *   GET    = OPERATE (crew는 배정 매장 건만)
 *   PATCH  = MANAGE  (admin 이상)
 *   DELETE = MANAGE  (admin 이상)
 *
 * 사진: Storage 버킷 `accident-photos`의 `{id}/` 경로를 list → signedUrl 발급.
 *       조회 실패해도 본체는 반환(사진만 빈 배열).
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api/auth-middleware';
import { ok, badRequest, forbidden, notFound, serverError } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/errors';
import { writeAuditLog } from '@/lib/api/helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const STATUS_VALUES = ['접수', '처리중', '완료'] as const;
const PHOTO_BUCKET = 'accident-photos';

// ── 상세 + 사진 ───────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: rec, error } = await supabase
      .from('accident_reports')
      .select('id, store_id, vehicle, accident_type, reporter, detail, status, accident_at, admin_memo, reported_by, created_at, updated_at, stores ( id, name )')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[v1/accidents/:id] get:', error.message);
      return serverError('사고 조회 중 오류가 발생했습니다');
    }
    if (!rec) return notFound('사고 내역을 찾을 수 없습니다');

    // crew/field는 배정 매장 건만 열람
    if (!['super_admin', 'admin'].includes(ctx.role)) {
      const assigned = ctx.storeIds || [];
      if (!assigned.includes(rec.store_id)) return forbidden('해당 사고 접근 권한이 없습니다');
    }

    // ── 사진 목록 (격리: 실패해도 본체 반환) ──
    let photos: Array<{ name: string; url: string }> = [];
    try {
      const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(id);
      const names = (files ?? [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => `${id}/${f.name}`);
      if (names.length > 0) {
        const { data: signed } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrls(names, 60 * 60); // 1시간 유효
        photos = (signed ?? [])
          .filter(s => s.signedUrl)
          .map((s, i) => ({ name: names[i], url: s.signedUrl as string }));
      }
    } catch (e) {
      console.error('[v1/accidents/:id] photos:', e);
    }

    return ok({ ...rec, photos });
  } catch (err) {
    console.error('[v1/accidents/:id] GET exception:', err);
    return serverError();
  }
}

// ── 상태 변경 / 관리자 메모 ───────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '요청 본문이 올바르지 않습니다');
    }

    const patch: { status?: string; admin_memo?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      const s = String(body.status);
      if (!STATUS_VALUES.includes(s as (typeof STATUS_VALUES)[number])) {
        return badRequest(ErrorCodes.VALIDATION_ERROR, '유효하지 않은 상태값입니다');
      }
      patch.status = s;
    }
    if (body.admin_memo !== undefined) {
      patch.admin_memo = body.admin_memo != null ? String(body.admin_memo) : null;
    }
    if (patch.status === undefined && patch.admin_memo === undefined) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '변경할 항목(status 또는 admin_memo)이 없습니다');
    }

    const supabase = await createClient();

    // 존재 + org 소유 확인
    const { data: before } = await supabase
      .from('accident_reports')
      .select('id, status, admin_memo')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();
    if (!before) return notFound('사고 내역을 찾을 수 없습니다');

    const { data: rec, error: updErr } = await supabase
      .from('accident_reports')
      .update(patch)
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .select('id, store_id, vehicle, accident_type, reporter, detail, status, accident_at, admin_memo, updated_at')
      .single();

    if (updErr || !rec) {
      console.error('[v1/accidents/:id] update:', updErr?.message);
      return serverError('사고 수정 중 오류가 발생했습니다');
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'accident_reports',
      recordId: id,
      action: 'update',
      changedBy: ctx.userId,
      beforeData: before,
      afterData: rec,
    });

    return ok(rec);
  } catch (err) {
    console.error('[v1/accidents/:id] PATCH exception:', err);
    return serverError();
  }
}

// ── 삭제 ──────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'MANAGE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: before } = await supabase
      .from('accident_reports')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle();
    if (!before) return notFound('사고 내역을 찾을 수 없습니다');

    const { error: delErr } = await supabase
      .from('accident_reports')
      .delete()
      .eq('org_id', ctx.orgId)
      .eq('id', id);

    if (delErr) {
      console.error('[v1/accidents/:id] delete:', delErr.message);
      return serverError('사고 삭제 중 오류가 발생했습니다');
    }

    // 연결 사진 정리(격리: 실패 무시)
    try {
      const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(id);
      const names = (files ?? []).filter(f => f.name).map(f => `${id}/${f.name}`);
      if (names.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(names);
    } catch (e) {
      console.error('[v1/accidents/:id] photo cleanup:', e);
    }

    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'accident_reports',
      recordId: id,
      action: 'delete',
      changedBy: ctx.userId,
      beforeData: before,
    });

    return ok({ id, deleted: true });
  } catch (err) {
    console.error('[v1/accidents/:id] DELETE exception:', err);
    return serverError();
  }
}
