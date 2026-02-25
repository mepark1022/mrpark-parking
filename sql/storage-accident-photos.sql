-- ============================================================
-- Storage: accident-photos 버킷 생성
-- 실행일: 2026.02.25
-- 대상: Supabase SQL Editor
-- ============================================================

-- 1. 버킷 생성 (public = true → getPublicUrl 사용 가능)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accident-photos',
  'accident-photos',
  true,
  5242880,  -- 5MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS 정책: 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload accident photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'accident-photos');

-- 3. RLS 정책: 인증된 사용자는 조회 가능
CREATE POLICY "Authenticated users can view accident photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'accident-photos');

-- 4. RLS 정책: Public 읽기 (getPublicUrl 지원)
CREATE POLICY "Public can view accident photos"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'accident-photos');

-- 5. RLS 정책: 인증된 사용자는 삭제 가능
CREATE POLICY "Authenticated users can delete accident photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'accident-photos');
