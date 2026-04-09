-- ============================================
-- 미팍 통합앱 v2 — Part 2-04: audit_logs 테이블
-- ============================================
-- ⚠️ 신규 테이블 — 기존 데이터 영향 없음
-- 역할: 수정 이력 추적 (일보/근태/급여 등 중요 변경)
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  
  table_name TEXT NOT NULL,         -- 'employees', 'daily_reports', 'attendance' 등
  record_id UUID NOT NULL,          -- 수정된 레코드 ID
  action TEXT NOT NULL,             -- 'insert', 'update', 'delete'
  
  changed_by UUID NOT NULL,         -- 수정한 관리자 user_id
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  before_data JSONB,                -- 수정 전 데이터
  after_data JSONB,                 -- 수정 후 데이터
  reason TEXT,                      -- 수정 사유 (선택)
  
  -- 추가 컨텍스트
  ip_address TEXT,                  -- 접속 IP (선택)
  user_agent TEXT                   -- 브라우저 정보 (선택)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(org_id, table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(org_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 읽기: 관리자만
CREATE POLICY "audit_logs_org_read" ON audit_logs
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('super_admin', 'admin')
    )
  );

-- 쓰기: API에서만 (service_role 또는 인증된 사용자)
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE audit_logs IS 'v2: 수정 이력 추적 (감사 로그)';
COMMENT ON COLUMN audit_logs.before_data IS '수정 전 데이터 (JSONB 스냅샷)';
COMMENT ON COLUMN audit_logs.after_data IS '수정 후 데이터 (JSONB 스냅샷)';
