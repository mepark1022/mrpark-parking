/**
 * 미팍 통합앱 v2 — 현장일보 이미지 업로드 API (Part 10C)
 * POST /api/v1/daily-reports/:id/images
 *
 * 본문: multipart/form-data
 *   files: File[]          (복수 업로드)
 *   titles?: string[]      (파일별 제목, 선택)
 *
 * 동작:
 *   1. 일보 존재 + org 일치 확인
 *   2. crew/field_member는 배정 사업장만 업로드 가능 (canAccessStore)
 *   3. Supabase Storage('daily-report-photos') 업로드
 *      경로: {org_id}/{report_id}/{timestamp}_{i}.{ext}
 *   4. daily_report_extra 에 category='photo' 로 insert
 *   5. audit_logs 기록 (insert)
 *
 * 권한: OPERATE (crew/field 이상)
 *
 * ⚠️ 전제: Supabase Storage 에 'daily-report-photos' 버킷 생성 필요
 *    - Public: false (서명 URL 사용 권장)
 *    - 정책: authenticated INSERT 허용 (org_id 경로 프리픽스)
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, canAccessStore } from '@/lib/api/auth-middleware';
import {
  created,
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

const BUCKET = 'daily-report-photos';
const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request, 'OPERATE');
  if (auth.error) return auth.error;
  const { ctx } = auth;

  try {
    const { id } = await params;

    // ── multipart 파싱 ──
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        'multipart/form-data 형식이 아닙니다'
      );
    }

    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    const titlesRaw = formData.getAll('titles');
    const titles: string[] = titlesRaw.map(t => (typeof t === 'string' ? t : ''));

    if (files.length === 0) {
      return badRequest(ErrorCodes.VALIDATION_ERROR, '업로드할 파일이 없습니다 (files)');
    }
    if (files.length > MAX_FILES) {
      return badRequest(
        ErrorCodes.VALIDATION_ERROR,
        `파일은 최대 ${MAX_FILES}개까지 업로드 가능합니다`
      );
    }
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `파일 크기 초과: ${f.name} (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`
        );
      }
      if (f.type && !ALLOWED_MIME.includes(f.type)) {
        return badRequest(
          ErrorCodes.VALIDATION_ERROR,
          `허용되지 않은 파일 형식: ${f.type}`
        );
      }
    }

    const supabase = await createClient();

    // ── 일보 조회 + 권한 ──
    const { data: report, error: fetchErr } = await supabase
      .from('daily_reports')
      .select('id, org_id, store_id, report_date, status')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[v1/daily-reports/:id/images] fetch:', fetchErr.message);
      return serverError('일보 조회 중 오류가 발생했습니다');
    }
    if (!report) {
      return notFound('일보를 찾을 수 없습니다');
    }

    // crew/field → 배정 사업장만
    if (!canAccessStore(ctx, report.store_id)) {
      return forbidden('해당 사업장의 일보에 접근할 수 없습니다');
    }

    // confirmed 상태는 관리자(MANAGE)만 추가 허용
    if (report.status === 'confirmed' && !['super_admin', 'admin'].includes(ctx.role)) {
      return forbidden('확정된 일보에는 사진을 추가할 수 없습니다');
    }

    // ── Storage 업로드 ──
    const uploaded: Array<{
      storage_path: string;
      title: string | null;
      size: number;
      mime: string;
    }> = [];

    const ts = Date.now();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const extGuess = (f.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 8);
      const path = `${ctx.orgId}/${id}/${ts}_${i}.${extGuess}`;

      const arrayBuf = await f.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: f.type || 'image/jpeg',
          upsert: false,
        });

      if (upErr) {
        console.error('[v1/daily-reports/:id/images] storage:', upErr.message);
        // 롤백: 이미 업로드된 파일 삭제
        if (uploaded.length > 0) {
          await supabase.storage
            .from(BUCKET)
            .remove(uploaded.map(u => u.storage_path));
        }
        return serverError(`스토리지 업로드 실패: ${f.name}`);
      }

      uploaded.push({
        storage_path: path,
        title: titles[i] || null,
        size: f.size,
        mime: f.type || 'image/jpeg',
      });
    }

    // ── daily_report_extra insert ──
    const extraRows = uploaded.map(u => ({
      org_id: ctx.orgId,
      report_id: id,
      category: 'photo' as const,
      title: u.title,
      storage_path: u.storage_path,
      url: null,
      metadata: { size: u.size, mime: u.mime },
      created_by: ctx.userId,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('daily_report_extra')
      .insert(extraRows)
      .select();

    if (insErr) {
      console.error('[v1/daily-reports/:id/images] extra insert:', insErr.message);
      // 스토리지 롤백
      await supabase.storage
        .from(BUCKET)
        .remove(uploaded.map(u => u.storage_path));
      return serverError('사진 메타 저장 중 오류가 발생했습니다');
    }

    // audit
    await writeAuditLog({
      orgId: ctx.orgId,
      tableName: 'daily_report_extra',
      recordId: id,
      action: 'insert',
      changedBy: ctx.userId,
      afterData: { report_id: id, photos: inserted },
      reason: `사진 ${inserted?.length ?? 0}장 업로드`,
    });

    return created({
      report_id: id,
      count: inserted?.length ?? 0,
      photos: inserted ?? [],
    });
  } catch (err) {
    console.error('[v1/daily-reports/:id/images] 서버 오류:', err);
    return serverError('사진 업로드 중 오류가 발생했습니다');
  }
}
