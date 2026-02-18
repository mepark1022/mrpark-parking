-- ============================================
-- VALETMAN 멀티테넌시 전환 SQL
-- 실행 위치: Supabase SQL Editor
-- ============================================

-- 1. organizations 테이블 생성
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text DEFAULT 'starter',
  owner_id uuid REFERENCES auth.users(id),
  max_stores int DEFAULT 5,
  max_workers int DEFAULT 20,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON organizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. 자사 조직 생성 (미스터팍)
INSERT INTO organizations (name, plan, max_stores, max_workers)
VALUES ('주식회사 미스터팍', 'enterprise', 100, 500)
ON CONFLICT DO NOTHING;

-- 3. 모든 기존 테이블에 org_id 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE workers ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE hourly_data ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_assignments ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE monthly_parking ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE parking_lots ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE visit_places ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE store_operating_hours ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE store_shifts ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE store_late_rules ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE overtime_shifts ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_leaves ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_leave_records ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_reviews ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE worker_reports ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE store_default_workers ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- parking_entries (신규 테이블이면 생성)
CREATE TABLE IF NOT EXISTS parking_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id),
  plate_number text NOT NULL,
  parking_type text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'parked',
  entry_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz,
  parking_lot_id uuid REFERENCES parking_lots(id),
  floor text,
  fee_charged int DEFAULT 0,
  note text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE parking_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON parking_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. 기존 데이터를 미스터팍 org_id로 마이그레이션
DO $$
DECLARE
  mrpark_org_id uuid;
BEGIN
  SELECT id INTO mrpark_org_id FROM organizations WHERE name = '주식회사 미스터팍' LIMIT 1;
  IF mrpark_org_id IS NOT NULL THEN
    UPDATE stores SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE workers SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE daily_records SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE hourly_data SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_assignments SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE monthly_parking SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE parking_lots SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE visit_places SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE store_operating_hours SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE store_shifts SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE store_late_rules SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE overtime_shifts SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_attendance SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_leaves SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_leave_records SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_reviews SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE worker_reports SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE invitations SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE profiles SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE store_default_workers SET org_id = mrpark_org_id WHERE org_id IS NULL;
    UPDATE parking_entries SET org_id = mrpark_org_id WHERE org_id IS NULL;
  END IF;
END $$;

-- 5. 관리자 계정 app_metadata에 org_id 설정
-- (수동으로 Supabase Auth > Users에서 mepark1022@gmail.com의 app_metadata에 추가)
-- 또는 아래 SQL:
DO $$
DECLARE
  mrpark_org_id uuid;
  admin_uid uuid;
BEGIN
  SELECT id INTO mrpark_org_id FROM organizations WHERE name = '주식회사 미스터팍' LIMIT 1;
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'mepark1022@gmail.com' LIMIT 1;
  IF mrpark_org_id IS NOT NULL AND admin_uid IS NOT NULL THEN
    UPDATE auth.users 
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', mrpark_org_id::text)
    WHERE id = admin_uid;
  END IF;
END $$;

-- 6. org_id 인덱스 추가 (성능)
CREATE INDEX IF NOT EXISTS idx_stores_org ON stores(org_id);
CREATE INDEX IF NOT EXISTS idx_workers_org ON workers(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_org ON daily_records(org_id);
CREATE INDEX IF NOT EXISTS idx_parking_entries_org ON parking_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_monthly_parking_org ON monthly_parking(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(org_id);

-- 7. (선택) RLS 정책을 org_id 기반으로 강화
-- 베타 이후 적용 권장
-- DROP POLICY IF EXISTS "Allow all for authenticated" ON stores;
-- CREATE POLICY "tenant_isolation" ON stores
--   FOR ALL TO authenticated
--   USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid)
--   WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
