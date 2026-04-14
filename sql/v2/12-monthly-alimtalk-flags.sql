-- ─────────────────────────────────────────────────────────────
-- Part 18A — monthly_parking 알림톡 발송 추적 컬럼 추가
-- 대상: renewal_complete (갱신 완료), monthly_expire (만료 안내)
--
-- 기존: d7_alimtalk_sent / d7_alimtalk_sent_at (Part 14 이전부터 존재)
-- 신규: renewal_alimtalk_sent / renewal_alimtalk_sent_at
--       expire_alimtalk_sent  / expire_alimtalk_sent_at
--
-- 실행 위치: Supabase SQL Editor
-- 실행 순서: 11-plate-digits.sql 다음
-- 적용 대상: public.monthly_parking
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 갱신 완료 알림톡 발송 추적
ALTER TABLE public.monthly_parking
  ADD COLUMN IF NOT EXISTS renewal_alimtalk_sent     BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_alimtalk_sent_at  TIMESTAMPTZ;

-- 만료 안내 알림톡 발송 추적
ALTER TABLE public.monthly_parking
  ADD COLUMN IF NOT EXISTS expire_alimtalk_sent      BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS expire_alimtalk_sent_at   TIMESTAMPTZ;

-- 크론 성능: end_date + expire 플래그 복합 인덱스
-- (monthly-expire 크론이 "오늘 만료 + 미발송 active" 필터하므로)
CREATE INDEX IF NOT EXISTS idx_monthly_parking_expire_scan
  ON public.monthly_parking (end_date, contract_status, expire_alimtalk_sent)
  WHERE contract_status = 'active' AND expire_alimtalk_sent = false;

COMMIT;

-- 확인 쿼리 (실행 후 결과 공유용)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'monthly_parking'
--   AND column_name LIKE '%alimtalk%'
-- ORDER BY column_name;
