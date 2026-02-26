-- ============================================
-- 출퇴근 GPS 좌표 저장 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행
-- 날짜: 2026.02.27
-- ============================================

-- 1) worker_attendance에 GPS 좌표 컬럼 추가
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_in_lat decimal(10,7);
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_in_lng decimal(10,7);
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_out_lat decimal(10,7);
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_out_lng decimal(10,7);
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_in_distance_m int;
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_out_distance_m int;

-- 2) 인덱스 (거리 기반 조회 대비)
CREATE INDEX IF NOT EXISTS idx_attendance_checkin_distance ON worker_attendance(check_in_distance_m);
CREATE INDEX IF NOT EXISTS idx_attendance_checkout_distance ON worker_attendance(check_out_distance_m);

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'worker_attendance' 
  AND column_name LIKE 'check_%_l%' OR column_name LIKE 'check_%_distance%'
ORDER BY column_name;
