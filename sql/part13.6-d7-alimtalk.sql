-- Part 13.6: 월주차 D-7 자동 알림톡 지원
-- 실행일: 2026-02-24

-- 1. monthly_parking 테이블에 D-7 알림톡 발송 여부 컬럼 추가
ALTER TABLE monthly_parking 
ADD COLUMN IF NOT EXISTS d7_alimtalk_sent boolean DEFAULT false;

-- 2. 발송 일시 기록 (선택)
ALTER TABLE monthly_parking 
ADD COLUMN IF NOT EXISTS d7_alimtalk_sent_at timestamptz;

-- 3. 알림톡 발송 로그 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS alimtalk_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ticket_id uuid REFERENCES mepark_tickets(id),
  monthly_parking_id uuid REFERENCES monthly_parking(id),
  template_type text NOT NULL,
  phone_masked text NOT NULL,  -- 010****1234 (원본 절대 저장 금지)
  send_status text DEFAULT 'pending',  -- pending, success, failed
  message_id text,  -- 솔라피 응답 messageId
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_monthly ON alimtalk_send_logs(monthly_parking_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_org ON alimtalk_send_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_monthly_d7_sent ON monthly_parking(d7_alimtalk_sent, end_date);

-- 5. RLS
ALTER TABLE alimtalk_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alimtalk_logs_org_access" ON alimtalk_send_logs
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );
