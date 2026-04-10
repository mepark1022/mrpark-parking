-- ============================================================
-- 미팍 통합앱 v2 — 현장일보 스키마 (Part 10A)
-- 2026.04.10
--
-- 4테이블 구조:
--   daily_reports          일보 마스터 (날짜/사업장 단위)
--   daily_report_staff     근무인원 상세 (직원별 출퇴근/유형)
--   daily_report_payment   결제 수단별 매출
--   daily_report_extra     추가항목 (사진첨부 등)
--
-- 연동:
--   stores, employees, store_members, audit_logs (모두 기존)
--
-- 실행: Supabase SQL Editor에서 통째로 실행
-- ============================================================

-- ── 1. daily_reports (마스터) ──
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,

  -- 상태: draft(작성중) / submitted(제출) / confirmed(확정)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','confirmed')),

  -- 본문
  weather TEXT,
  event_flag BOOLEAN DEFAULT false,      -- 행사 자동감지
  event_name TEXT,
  memo TEXT,

  -- 요약 집계 (빠른 조회용, payment/staff 합계 캐시)
  total_cars INTEGER DEFAULT 0,          -- 총 입차대수
  valet_count INTEGER DEFAULT 0,         -- 발렛 건수
  total_revenue NUMERIC(12,0) DEFAULT 0, -- payment 합계 캐시

  -- 작성/제출/확정 메타
  created_by UUID NOT NULL,              -- auth.users.id
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 동일 날짜·사업장 중복 방지
  UNIQUE (org_id, store_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_org_date
  ON daily_reports (org_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_store_date
  ON daily_reports (org_id, store_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_status_date
  ON daily_reports (org_id, status, report_date DESC);

-- ── 2. daily_report_staff (근무인원) ──
CREATE TABLE IF NOT EXISTS daily_report_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,

  -- 근무유형: regular(해당매장) / peak(피크) / support(본사지원)
  -- / part_time(알바지원) / off_duty(비번투입) / additional(추가)
  staff_type TEXT NOT NULL CHECK (staff_type IN
    ('regular','peak','support','part_time','off_duty','additional')
  ),
  role TEXT,                             -- key / valet / etc

  check_in TIME,
  check_out TIME,
  work_hours NUMERIC(5,2),               -- 선택: 수동 입력 또는 계산값
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_staff_report
  ON daily_report_staff (report_id);

CREATE INDEX IF NOT EXISTS idx_daily_report_staff_emp
  ON daily_report_staff (org_id, employee_id);

-- ── 3. daily_report_payment (결제 수단별 매출) ──
CREATE TABLE IF NOT EXISTS daily_report_payment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,

  -- 결제수단: card / cash / valet_fee / monthly / free / transfer / other
  method TEXT NOT NULL CHECK (method IN
    ('card','cash','valet_fee','monthly','free','transfer','other')
  ),
  amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  count INTEGER DEFAULT 0,
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_payment_report
  ON daily_report_payment (report_id);

-- ── 4. daily_report_extra (사진/문서 등 추가 항목) ──
CREATE TABLE IF NOT EXISTS daily_report_extra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN ('photo','document','note')),
  title TEXT,
  storage_path TEXT,                     -- Supabase Storage 경로
  url TEXT,                              -- public URL (옵션)
  metadata JSONB,

  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_extra_report
  ON daily_report_extra (report_id);

-- ── 5. updated_at 자동 갱신 트리거 (daily_reports) ──
CREATE OR REPLACE FUNCTION set_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION set_daily_reports_updated_at();

-- ============================================================
-- RLS 정책
-- ============================================================
ALTER TABLE daily_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_staff    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_payment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_extra    ENABLE ROW LEVEL SECURITY;

-- daily_reports: 동일 org만 읽기/쓰기, crew/field는 배정 사업장만 읽기·작성
DROP POLICY IF EXISTS dr_select ON daily_reports;
CREATE POLICY dr_select ON daily_reports
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
      OR store_id IN (
        SELECT sm.store_id
        FROM store_members sm
        JOIN profiles p ON p.employee_id = sm.employee_id
        WHERE p.id = auth.uid() AND sm.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS dr_insert ON daily_reports;
CREATE POLICY dr_insert ON daily_reports
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS dr_update ON daily_reports;
CREATE POLICY dr_update ON daily_reports
  FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS dr_delete ON daily_reports;
CREATE POLICY dr_delete ON daily_reports
  FOR DELETE
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- daily_report_staff: report_id를 통해 동일 org 권한 상속
DROP POLICY IF EXISTS drs_all ON daily_report_staff;
CREATE POLICY drs_all ON daily_report_staff
  FOR ALL
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- daily_report_payment
DROP POLICY IF EXISTS drp_all ON daily_report_payment;
CREATE POLICY drp_all ON daily_report_payment
  FOR ALL
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- daily_report_extra
DROP POLICY IF EXISTS dre_all ON daily_report_extra;
CREATE POLICY dre_all ON daily_report_extra
  FOR ALL
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- 확인 쿼리
-- ============================================================
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'daily_report%';
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'daily_report%';
