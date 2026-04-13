-- ============================================================
-- 미팍 통합앱 v2 — 근태 직접수정 오버라이드 (Part 11B)
-- 2026.04.13
--
-- 목적:
--   daily_reports에서 파생된 근태 상태를 관리자가 직접 덮어쓰기
--   (연차/휴무/결근 처리 및 일보와 불일치 수동 교정)
--
-- 동작:
--   조회 API에서 daily_reports 기반 매트릭스 생성 후
--   attendance_overrides가 있으면 해당 날짜를 덮어씀
--
-- 실행: Supabase SQL Editor에서 통째로 실행
-- ============================================================

-- ── 1. attendance_overrides ──
CREATE TABLE IF NOT EXISTS attendance_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,

  -- 근태 상태 (8종)
  status TEXT NOT NULL CHECK (status IN (
    'present','late','peak','support','additional','leave','off','absent'
  )),

  -- 사업장 (선택 — 지원/피크 시 표시용)
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- 출퇴근/근무시간
  check_in  TIME,
  check_out TIME,
  work_hours NUMERIC(4,2),

  -- 사유 및 메모
  reason TEXT,
  memo TEXT,

  -- 메타
  created_by UUID NOT NULL,   -- auth.users.id
  updated_by UUID,            -- auth.users.id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 동일 직원·날짜 중복 방지
  UNIQUE (org_id, employee_id, work_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_att_override_org_date
  ON attendance_overrides (org_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_att_override_emp_date
  ON attendance_overrides (employee_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_att_override_store_date
  ON attendance_overrides (store_id, work_date DESC);

-- ── 2. updated_at 자동 갱신 트리거 ──
CREATE OR REPLACE FUNCTION set_attendance_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_overrides_updated_at ON attendance_overrides;
CREATE TRIGGER trg_attendance_overrides_updated_at
  BEFORE UPDATE ON attendance_overrides
  FOR EACH ROW EXECUTE FUNCTION set_attendance_overrides_updated_at();

-- ============================================================
-- RLS 정책
-- ============================================================
ALTER TABLE attendance_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: MANAGE 전체, SELF 본인만
DROP POLICY IF EXISTS ao_select ON attendance_overrides;
CREATE POLICY ao_select ON attendance_overrides
  FOR SELECT
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
      OR employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    )
  );

-- INSERT: MANAGE만
DROP POLICY IF EXISTS ao_insert ON attendance_overrides;
CREATE POLICY ao_insert ON attendance_overrides
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- UPDATE: MANAGE만
DROP POLICY IF EXISTS ao_update ON attendance_overrides;
CREATE POLICY ao_update ON attendance_overrides
  FOR UPDATE
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- DELETE: MANAGE만
DROP POLICY IF EXISTS ao_delete ON attendance_overrides;
CREATE POLICY ao_delete ON attendance_overrides
  FOR DELETE
  TO anon, authenticated
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin','admin')
  );

-- ============================================================
-- 검증
-- ============================================================
-- SELECT COUNT(*) FROM attendance_overrides;
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'attendance_overrides';
-- SELECT polname FROM pg_policy WHERE polrelid = 'attendance_overrides'::regclass;
