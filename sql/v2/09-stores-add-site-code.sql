-- ============================================
-- 미팍 통합앱 v2 — Part 09: stores.site_code 컬럼 추가
-- ============================================
-- ⚠️ 기존 데이터 영향 없음 (NULL 허용으로 추가)
-- 역할: 사업장 식별 코드 (Part 8 Store API 및 자동완성에서 사용)
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS site_code TEXT;

-- 같은 org 내 site_code 중복 방지 (NULL은 허용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_org_site_code
  ON stores (org_id, site_code)
  WHERE site_code IS NOT NULL;

-- 검증
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stores'
  AND column_name = 'site_code';
