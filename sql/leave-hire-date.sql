-- ================================================
-- 근속연수 기반 연차 자동계산 지원
-- 실행: Supabase SQL Editor
-- ================================================

-- 1. workers 테이블에 입사일 컬럼 추가
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS hire_date date;

-- 2. worker_leaves에 자동계산 여부 플래그 추가
--    (관리자가 수동으로 override한 경우를 구분)
ALTER TABLE worker_leaves
  ADD COLUMN IF NOT EXISTS is_auto_calculated boolean DEFAULT true;

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_workers_hire_date ON workers(hire_date);
