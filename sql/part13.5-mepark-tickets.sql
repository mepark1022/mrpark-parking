-- ============================================================
-- Part 13.5: 미팍티켓 테이블 생성 SQL
-- 실행일: 2026.02.24
-- 대상: Supabase SQL Editor
-- ============================================================

-- 1. mepark_tickets (미팍티켓 메인 테이블)
-- ============================================================
CREATE TABLE IF NOT EXISTS mepark_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 차량 정보
  plate_number text NOT NULL,
  plate_last4 text NOT NULL,  -- 검색/표시용 뒷 4자리
  
  -- 주차 유형
  parking_type text NOT NULL DEFAULT 'self',  -- self / valet
  visit_place_id uuid REFERENCES visit_places(id),
  parking_lot_id uuid REFERENCES parking_lots(id),
  parking_location text,  -- 주차 위치 (B2-A03 등)
  
  -- 시간 정보
  entry_at timestamptz NOT NULL DEFAULT now(),
  pre_paid_at timestamptz,  -- 사전정산 시간
  pre_paid_deadline timestamptz,  -- 사전정산 후 유예시간 마감 (30분)
  exit_at timestamptz,  -- 출차 시간
  
  -- 요금 정보
  calculated_fee int DEFAULT 0,  -- 계산된 주차요금
  paid_amount int DEFAULT 0,  -- 실제 결제 금액
  additional_fee int DEFAULT 0,  -- 유예시간 초과 추가요금
  additional_paid_at timestamptz,  -- 추가요금 결제 시간
  
  -- 상태: parking → pre_paid → (overdue) → completed
  -- parking: 입차 중
  -- pre_paid: 사전정산 완료 (유예시간 진행 중)
  -- overdue: 유예시간 초과 (추가요금 발생)
  -- exit_requested: 출차 요청 (발렛)
  -- car_ready: 차량 준비 완료 (발렛)
  -- completed: 출차 완료
  status text NOT NULL DEFAULT 'parking',
  
  -- 결제 정보
  payment_method text,  -- card, kakao, naver, samsung, apple
  payment_key text,  -- 토스페이먼츠 결제키
  receipt_url text,  -- 영수증 URL
  
  -- 월주차 연동
  is_monthly boolean DEFAULT false,
  monthly_parking_id uuid REFERENCES monthly_parking(id),
  
  -- 알림톡 발송 여부 (전화번호는 저장하지 않음!)
  entry_alimtalk_sent boolean DEFAULT false,
  ready_alimtalk_sent boolean DEFAULT false,
  
  -- 담당 크루
  entry_crew_id uuid REFERENCES auth.users(id),
  exit_crew_id uuid REFERENCES auth.users(id),
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON mepark_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_store_id ON mepark_tickets(store_id);
CREATE INDEX IF NOT EXISTS idx_tickets_plate ON mepark_tickets(plate_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON mepark_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_entry_at ON mepark_tickets(entry_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_pre_paid_deadline ON mepark_tickets(pre_paid_deadline) 
  WHERE status = 'pre_paid';

-- RLS 활성화
ALTER TABLE mepark_tickets ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view tickets in their org" ON mepark_tickets
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert tickets in their org" ON mepark_tickets
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update tickets in their org" ON mepark_tickets
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );


-- 2. payment_records (결제 기록)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES mepark_tickets(id) ON DELETE CASCADE,
  
  -- 토스페이먼츠 정보
  payment_key text UNIQUE NOT NULL,
  order_id text UNIQUE NOT NULL,
  
  -- 결제 정보
  amount int NOT NULL,
  method text NOT NULL,  -- CARD, VIRTUAL_ACCOUNT, etc
  provider text,  -- 간편결제 제공자 (kakaopay, naverpay 등)
  card_company text,  -- 카드사
  
  -- 상태
  status text NOT NULL DEFAULT 'paid',  -- paid / canceled / failed
  
  -- 타임스탬프
  paid_at timestamptz,
  canceled_at timestamptz,
  
  -- 영수증
  receipt_url text,
  
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payment_org_id ON payment_records(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_ticket_id ON payment_records(ticket_id);

-- RLS 활성화
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view payments in their org" ON payment_records
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert payments in their org" ON payment_records
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );


-- 3. exit_requests (출차 요청 - 발렛용)
-- ============================================================
CREATE TABLE IF NOT EXISTS exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES mepark_tickets(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- 차량 정보
  plate_number text NOT NULL,
  parking_location text,  -- 현재 주차 위치
  pickup_location text,  -- 인도 희망 위치
  
  -- 상태: requested → preparing → ready → completed
  status text NOT NULL DEFAULT 'requested',
  
  -- 타임스탬프
  requested_at timestamptz DEFAULT now(),
  preparing_at timestamptz,  -- 차량 회수 시작
  ready_at timestamptz,  -- 차량 준비 완료
  completed_at timestamptz,  -- 인도 완료
  
  -- 담당 크루
  assigned_crew_id uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_exit_requests_org_id ON exit_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_exit_requests_ticket_id ON exit_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_exit_requests_status ON exit_requests(status);

-- RLS 활성화
ALTER TABLE exit_requests ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view exit_requests in their org" ON exit_requests
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage exit_requests in their org" ON exit_requests
  FOR ALL USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );


-- 4. alimtalk_send_logs (알림톡 발송 로그)
-- ============================================================
CREATE TABLE IF NOT EXISTS alimtalk_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- 연관 ID (둘 중 하나만 사용)
  ticket_id uuid REFERENCES mepark_tickets(id) ON DELETE SET NULL,
  monthly_parking_id uuid REFERENCES monthly_parking(id) ON DELETE SET NULL,
  
  -- 템플릿 정보
  template_type text NOT NULL,  -- entry, ready, d7_auto_remind, manual_remind
  
  -- 전화번호 (마스킹 처리! 원본 절대 저장 금지)
  phone_masked text NOT NULL,  -- 010****1234
  
  -- 발송 상태
  send_status text DEFAULT 'pending',  -- pending, success, failed
  message_id text,  -- 솔라피 응답 messageId
  error_message text,  -- 실패 시 에러 메시지
  
  -- 타임스탬프
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_org ON alimtalk_send_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_ticket ON alimtalk_send_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_monthly ON alimtalk_send_logs(monthly_parking_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_type ON alimtalk_send_logs(template_type);

-- RLS 활성화
ALTER TABLE alimtalk_send_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view alimtalk_logs in their org" ON alimtalk_send_logs
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert alimtalk_logs in their org" ON alimtalk_send_logs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );


-- 5. updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- mepark_tickets 트리거
DROP TRIGGER IF EXISTS update_mepark_tickets_updated_at ON mepark_tickets;
CREATE TRIGGER update_mepark_tickets_updated_at
  BEFORE UPDATE ON mepark_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 실행 확인용 쿼리
-- ============================================================
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('mepark_tickets', 'payment_records', 'exit_requests', 'alimtalk_send_logs');
