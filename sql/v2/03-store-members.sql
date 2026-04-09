-- ============================================
-- 미팍 통합앱 v2 — Part 2-03: store_members 테이블
-- ============================================
-- ⚠️ 신규 테이블 — 기존 데이터 영향 없음
-- 역할: 직원 ↔ 사업장 배정 (다대다 관계)
-- 실행: Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS store_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  
  is_primary BOOLEAN DEFAULT FALSE,    -- 주 사업장 여부
  is_active BOOLEAN DEFAULT TRUE,      -- 활성 여부 (퇴사 시 false)
  
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,                    -- 배정한 관리자
  deactivated_at TIMESTAMPTZ,          -- 비활성화 시각
  
  -- 동일 직원+사업장 중복 방지
  CONSTRAINT store_members_unique UNIQUE (org_id, employee_id, store_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_store_members_org ON store_members(org_id);
CREATE INDEX IF NOT EXISTS idx_store_members_employee ON store_members(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_store_members_store ON store_members(store_id, is_active);

-- RLS
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_members_org_read" ON store_members
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "store_members_org_write" ON store_members
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE store_members IS 'v2: 직원-사업장 배정 (다대다)';
