-- ============================================================
-- Storage: vehicle-photos 버킷 생성 + RLS 정책
-- 작성일: 2026.06.03
-- 대상: Supabase SQL Editor (mepark1022's Project)
-- 용도: P1-8 v2 입차 차량사진 6장 연속촬영
--   - 업로드 경로: {org_id}/{ticket_id}/{idx}_{SLOT_KEY}.jpg
--   - 업로더: CREW browser client (anon key + 로그인 세션 = authenticated role)
--   - 표시: getPublicUrl (public = true 필요)
--   - 삭제: cleanup cron (service_role) — 아래 anon/authenticated DELETE와 무관하게 동작
--
-- ⚠️ 실행 시점: 실기기에서 1장 촬영→업로드가 RLS로 막힐 때(403/policy violation).
--   레거시 v1 입차가 같은 버킷에 업로드해 왔으므로 버킷 자체는 이미 존재할 수 있음
--   → 버킷 INSERT는 ON CONFLICT DO NOTHING, 정책은 DROP IF EXISTS 후 재생성(멱등).
--
-- 패턴 출처: sql/storage-accident-photos.sql (동일 구조)
-- ============================================================

-- 1. 버킷 생성 (public = true → getPublicUrl 사용 가능)
--    file_size_limit = NULL → 인위적 용량제한 없음 (P1-8 "퀄리티 우선·흠집 판단용" 스펙).
--    총량은 2개월 cleanup cron(/api/cron/vehicle-photo-cleanup)으로 관리.
--    ※ 단일 거대 업로드가 걱정되면 NULL 대신 20971520(20MB)로 교체 가능.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  NULL,  -- 인위적 용량제한 없음 (대안: 20971520 = 20MB)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- (버킷이 이미 존재하지만 public=false 거나 mime 제한이 막는 경우를 위해 보정 — 안전)
UPDATE storage.buckets
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'vehicle-photos';

-- 2. RLS 정책: 인증된 사용자(CREW 세션 포함)만 업로드 가능  ← P1-8 업로드 막힘의 핵심 해소
DROP POLICY IF EXISTS "Authenticated users can upload vehicle photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload vehicle photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicle-photos');

-- 3. RLS 정책: 인증된 사용자 조회
DROP POLICY IF EXISTS "Authenticated users can view vehicle photos" ON storage.objects;
CREATE POLICY "Authenticated users can view vehicle photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vehicle-photos');

-- 4. RLS 정책: Public 읽기 (getPublicUrl 지원)
DROP POLICY IF EXISTS "Public can view vehicle photos" ON storage.objects;
CREATE POLICY "Public can view vehicle photos"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'vehicle-photos');

-- 5. RLS 정책: 인증된 사용자 삭제 (수동 재촬영 대비 — cleanup cron은 service_role이라 별개)
DROP POLICY IF EXISTS "Authenticated users can delete vehicle photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete vehicle photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-photos');

-- ============================================================
-- 검증 쿼리 (실행 후 확인용)
-- ============================================================
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'vehicle-photos';
-- SELECT policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname ILIKE '%vehicle photos%';
