-- ============================================
-- 미팍 통합앱 v2 — Part 2-01: employees 테이블
-- ============================================
-- ⚠️ 기존 workers 테이블은 그대로 유지 (v1 호환)
-- ⚠️ 이 테이블은 별도 신규 생성, 기존 데이터에 영향 없음
-- 실행: Supabase SQL Editor에서 실행

-- 1. employees 테이블 생성
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  
  -- 기본 정보
  emp_no TEXT NOT NULL,                       -- 사번 (MP17001, MPA1 등)
  name TEXT NOT NULL,                         -- 이름
  phone TEXT,                                 -- 전화번호 (암호화 또는 마스킹 권장)
  position TEXT,                              -- 직위 (팀장, 크루, 알바 등)
  role TEXT NOT NULL DEFAULT 'crew',          -- super_admin/admin/crew/field_member
  
  -- 상태
  status TEXT NOT NULL DEFAULT '재직',         -- 재직/퇴사/수습/휴직
  hire_date DATE NOT NULL,                    -- 입사일 (필수)
  resign_date DATE,                           -- 퇴사일
  probation_end DATE,                         -- 수습 종료일
  status_changed_at TIMESTAMPTZ,              -- 상태 변경 시각
  status_changed_by UUID,                     -- 상태 변경한 관리자
  
  -- 근무 조건
  work_type TEXT,                             -- 근무형태 코드 (A~G, W, AE 등)
  employment_type TEXT DEFAULT '정규직',       -- 정규직/계약직/일용직
  base_salary INTEGER DEFAULT 0,              -- 기본급 (월)
  weekend_daily INTEGER DEFAULT 0,            -- 주말일당
  probation_months INTEGER DEFAULT 0,         -- 수습 기간 (월)
  
  -- 4대보험/세금
  insurance_national BOOLEAN DEFAULT TRUE,    -- 국민연금
  insurance_health BOOLEAN DEFAULT TRUE,      -- 건강보험
  insurance_employ BOOLEAN DEFAULT TRUE,      -- 고용보험
  insurance_injury BOOLEAN DEFAULT TRUE,      -- 산재보험
  tax_type TEXT DEFAULT '간이세액',             -- 간이세액/일용직
  
  -- 은행 계좌
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  
  -- 기타
  region TEXT,                                -- 거주 지역
  memo TEXT,                                  -- 비고
  
  -- 시스템
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 제약조건
  CONSTRAINT employees_org_empno_unique UNIQUE (org_id, emp_no)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(org_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_emp_no ON employees(emp_no);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(org_id, role);
CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(org_id, status, role);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_updated_at();

-- 4. RLS 활성화
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 (기본: org_id 기반)
CREATE POLICY "employees_org_read" ON employees
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "employees_org_insert" ON employees
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "employees_org_update" ON employees
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 삭제는 논리삭제만 (status = '퇴사'), 물리삭제 정책 없음

COMMENT ON TABLE employees IS '미팍 통합앱 v2 - 직원 마스터 (단일 인력 테이블)';
COMMENT ON COLUMN employees.emp_no IS '사번: MP+연도2+순번(운영), MPA+순번(알바)';
COMMENT ON COLUMN employees.phone IS '전화번호: API에서만 접근, 발송 후 즉시 삭제';
