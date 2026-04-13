-- ============================================
-- 미팍 통합앱 v2 — Part 10: mepark_tickets 타임스탬프 컬럼 추가
-- ============================================
-- ⚠️ 기존 데이터 영향 없음 (NULL 허용)
-- 역할:
--   - exit_requested_at: 고객이 출차 요청 버튼을 누른 시각
--   - completed_at: 정산 완료 + 차량 인계 완료 시각
-- 기존 exit_at(차량이 실제 주차장을 벗어난 시각)과는 다른 의미로 분리 보관
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE mepark_tickets
  ADD COLUMN IF NOT EXISTS exit_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 정산 리포트(Part 13)에서 일자별 completed_at 집계용
CREATE INDEX IF NOT EXISTS idx_mepark_tickets_completed_at
  ON mepark_tickets (org_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- 출차요청 SLA 모니터링용
CREATE INDEX IF NOT EXISTS idx_mepark_tickets_exit_requested_at
  ON mepark_tickets (org_id, exit_requested_at DESC)
  WHERE exit_requested_at IS NOT NULL;

-- 검증
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'mepark_tickets'
  AND column_name IN ('exit_requested_at', 'completed_at')
ORDER BY column_name;
