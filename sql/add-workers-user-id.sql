-- ============================================
-- workers 테이블에 user_id 컬럼 추가
-- CREW앱에서 auth.users → workers 매핑에 필요
-- 실행: Supabase SQL Editor에서 실행
-- ============================================

-- 1. user_id 컬럼 추가
ALTER TABLE workers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. user_id에 유니크 인덱스 (1명이 1개의 worker 레코드만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id) WHERE user_id IS NOT NULL;

-- 3. 기존 admin 계정(mepark1022@gmail.com)의 workers 레코드가 있다면 연결
-- (수동으로 필요시 실행)
-- UPDATE workers SET user_id = '해당-auth-user-uuid' WHERE name = '이지섭' AND user_id IS NULL;
