-- ═══════════════════════════════════════════════
-- 11. 번호판 숫자 추출 컬럼 + 인덱스 추가
-- 목적: 기존 한글 포함 번호판("123가 4567")과 OCR 마스킹 번호판("123* 4567") 호환 매칭
-- 작성일: 2026.04.14
-- 실행: Supabase SQL Editor에서 수동 실행
-- ═══════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1) mepark_tickets.plate_digits (숫자만 추출된 generated column)
-- ─────────────────────────────────────────────

ALTER TABLE mepark_tickets
  ADD COLUMN IF NOT EXISTS plate_digits TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(plate_number, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_mepark_tickets_plate_digits
  ON mepark_tickets (store_id, plate_digits, status);

-- ─────────────────────────────────────────────
-- 2) monthly_parking.vehicle_digits
-- ─────────────────────────────────────────────

ALTER TABLE monthly_parking
  ADD COLUMN IF NOT EXISTS vehicle_digits TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(vehicle_number, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_monthly_parking_vehicle_digits
  ON monthly_parking (store_id, vehicle_digits, contract_status);

-- ─────────────────────────────────────────────
-- 3) 확인 쿼리 (실행 후 검증용)
-- ─────────────────────────────────────────────

-- 티켓 컬럼 추가 확인
-- SELECT column_name, data_type, is_generated
-- FROM information_schema.columns
-- WHERE table_name = 'mepark_tickets' AND column_name = 'plate_digits';

-- 월주차 컬럼 추가 확인
-- SELECT column_name, data_type, is_generated
-- FROM information_schema.columns
-- WHERE table_name = 'monthly_parking' AND column_name = 'vehicle_digits';

-- 기존 데이터 변환 확인 샘플
-- SELECT plate_number, plate_digits FROM mepark_tickets LIMIT 5;
-- SELECT vehicle_number, vehicle_digits FROM monthly_parking LIMIT 5;
