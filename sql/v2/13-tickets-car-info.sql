-- ============================================================
-- Part 19B-5A: 4자리 OCR 전용 모드 - DB 컬럼 추가
-- 작업일: 2026.04.15
-- 실행 환경: Supabase SQL Editor (수동 실행)
-- ============================================================

-- 1) 차종/컬러 컬럼 추가 (충돌 시 차량 식별용)
ALTER TABLE public.mepark_tickets
  ADD COLUMN IF NOT EXISTS car_type  text,  -- 세단/SUV/경차/승합/외제/기타
  ADD COLUMN IF NOT EXISTS car_color text;  -- 검정/흰색/회색/은색/파랑/빨강/기타

-- 2) 충돌 검색 전용 부분 인덱스
--    동일 매장 내 동일 4자리 활성 차량 빠른 조회
CREATE INDEX IF NOT EXISTS idx_tickets_collision
  ON public.mepark_tickets (org_id, store_id, plate_last4, status)
  WHERE status IN ('parking','exit_requested','car_ready','pre_paid','overdue');

-- 3) 컬럼 코멘트
COMMENT ON COLUMN public.mepark_tickets.car_type
  IS '차종 (세단/SUV/경차/승합/외제/기타) - 동일 4자리 충돌 시 식별용';
COMMENT ON COLUMN public.mepark_tickets.car_color
  IS '차량 컬러 (검정/흰색/회색/은색/파랑/빨강/기타) - 동일 4자리 충돌 시 식별용';
