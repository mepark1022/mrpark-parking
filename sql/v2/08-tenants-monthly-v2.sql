-- ============================================================
-- 미팍 통합앱 v2 — 입주사(tenants) + 월주차 v2 확장 (Part 14A)
-- 2026.04.13
--
-- 목적:
--   1) tenants (신규): 입주사 마스터 — 같은 입주사 차량 반복 등록 시 자동완성
--   2) monthly_parking (확장): tenant_id, renewed_from_id 컬럼 추가
--
-- 정책:
--   - 월주차는 정기 연락(만료/갱신 알림톡) 필수 → 전화번호 평문 저장 허용 (예외)
--   - 일반 일회성 주차권은 기존 정책(마스킹 only) 유지
--   - org_id 멀티테넌시 + RLS 격리 + role 기반 평문/마스킹 분기는 API 단에서 처리
--
-- 호환성:
--   - 기존 monthly_parking row는 tenant_id=null, renewed_from_id=null 그대로 동작
--   - v1 페이지(/monthly/*) 및 cron(monthly-remind)에 영향 없음
--   - ALTER ADD COLUMN만 사용 (기존 컬럼 변경/삭제 없음)
--
-- 실행: Supabase SQL Editor에서 통째로 실행
-- ============================================================

-- ── 1. tenants (입주사 마스터) ──
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,

  -- 기본 정보
  name TEXT NOT NULL,                     -- 입주사명 (예: "삼성전자 서초사옥")
  business_no TEXT,                       -- 사업자등록번호 (세금계산서용, 선택)

  -- 담당자 연락처 (평문 — 월주차 정책 예외)
  contact_name TEXT,                      -- 담당자 이름 (예: "김과장")
  contact_phone TEXT,                     -- 담당자 전화번호 (010-1234-5678)

  -- 자동완성 기본값 (등록 시 신규 계약에 자동 채움)
  default_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  monthly_fee_default INT,                -- 기본 월요금

  -- 상태/메모
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  memo TEXT,

  -- 사용 통계 (자동완성 정렬용)
  usage_count INT NOT NULL DEFAULT 0,     -- 누적 계약 횟수
  last_contracted_at TIMESTAMPTZ,         -- 마지막 계약일

  -- 감사 추적
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenants_org_status ON tenants(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tenants_org_name ON tenants(org_id, name);
CREATE INDEX IF NOT EXISTS idx_tenants_org_usage ON tenants(org_id, usage_count DESC, last_contracted_at DESC);

-- updated_at 트리거 (테이블 전용 함수 — 기존 v2 SQL 패턴 일치)
CREATE OR REPLACE FUNCTION set_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_tenants_updated_at();


-- ── 2. monthly_parking 확장 (ALTER ADD only) ──
ALTER TABLE monthly_parking
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renewed_from_id UUID REFERENCES monthly_parking(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_tenant ON monthly_parking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monthly_renewed_from ON monthly_parking(renewed_from_id);


-- ── 3. RLS — tenants ──
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 org_id 모든 역할
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- INSERT: MANAGE (super_admin / admin)
DROP POLICY IF EXISTS tenants_insert ON tenants;
CREATE POLICY tenants_insert ON tenants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- UPDATE: MANAGE
DROP POLICY IF EXISTS tenants_update ON tenants;
CREATE POLICY tenants_update ON tenants
  FOR UPDATE
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- DELETE: super_admin만 (admin도 차단 — soft delete 정책: status='inactive' 사용 권장)
DROP POLICY IF EXISTS tenants_delete ON tenants;
CREATE POLICY tenants_delete ON tenants
  FOR DELETE
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );


-- ============================================================
-- 검증
-- ============================================================
-- SELECT COUNT(*) FROM tenants;
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'tenants';
-- SELECT polname FROM pg_policy WHERE polrelid = 'tenants'::regclass;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'monthly_parking'
--     AND column_name IN ('tenant_id','renewed_from_id');
