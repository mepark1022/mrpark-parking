-- ================================================
-- 연차신청 크루 플로우 지원 컬럼 추가
-- 실행: Supabase SQL Editor
-- ================================================

-- 1. worker_leave_records에 크루신청 관련 컬럼 추가
ALTER TABLE worker_leave_records
  ADD COLUMN IF NOT EXISTS requested_by_crew boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reject_reason text;

-- 2. 인덱스 (pending 건 빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_leave_records_status
  ON worker_leave_records(status);

CREATE INDEX IF NOT EXISTS idx_leave_records_worker_status
  ON worker_leave_records(worker_id, status);
