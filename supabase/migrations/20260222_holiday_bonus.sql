-- ============================================================
-- ME.PARK 2.0 — 공휴일 보너스 마이그레이션
-- 실행 위치: Supabase SQL Editor
-- ============================================================

-- 1. workers 테이블에 일당 컬럼 추가
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS daily_wage integer DEFAULT 0;

COMMENT ON COLUMN workers.daily_wage IS '일당(원) — 공휴일/주말 보너스 계산 기준';

-- 2. organizations 테이블에 보너스 정책 컬럼 추가
--    (조직별로 공휴일 배율을 다르게 설정 가능)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS bonus_policy jsonb DEFAULT '{"holiday_rate": 1.5, "weekend_rate": 1.0}'::jsonb;

COMMENT ON COLUMN organizations.bonus_policy IS '보너스 정책: {holiday_rate: 공휴일배율, weekend_rate: 주말배율}';

-- 3. 확인 쿼리 (실행 후 결과 확인)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'workers'
  AND column_name = 'daily_wage';

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name = 'bonus_policy';
