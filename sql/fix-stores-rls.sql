-- ============================================
-- stores 테이블 RLS 확인 및 수정
-- CREW앱 클라이언트에서 매장 조회 가능하도록
-- ============================================

-- 1. 현재 RLS 상태 확인 (먼저 실행해서 결과 확인)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('stores', 'profiles', 'store_members')
ORDER BY tablename, policyname;

-- 2. stores 테이블 RLS 활성화 (이미 활성화되어 있으면 무시됨)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 3. 기존 stores SELECT 정책 삭제 (충돌 방지)
DROP POLICY IF EXISTS "Users can view stores in their org" ON stores;
DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stores;

-- 4. 새 SELECT 정책: 같은 org의 인증된 사용자만 조회 가능
CREATE POLICY "Users can view stores in their org" ON stores
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5. INSERT 정책 (매장 생성)
DROP POLICY IF EXISTS "Users can insert stores in their org" ON stores;
CREATE POLICY "Users can insert stores in their org" ON stores
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 6. UPDATE 정책 (매장 수정)
DROP POLICY IF EXISTS "Users can update stores in their org" ON stores;
CREATE POLICY "Users can update stores in their org" ON stores
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 7. DELETE 정책 (매장 삭제)
DROP POLICY IF EXISTS "Users can delete stores in their org" ON stores;
CREATE POLICY "Users can delete stores in their org" ON stores
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 8. profiles 테이블도 확인 (SELECT 정책 필요)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- 9. store_members 테이블 (crew 매장 배정 조회)
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own store_members" ON store_members;
CREATE POLICY "Users can view own store_members" ON store_members
  FOR SELECT USING (user_id = auth.uid());

-- 10. 확인: 정책 재조회
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('stores', 'profiles', 'store_members')
ORDER BY tablename, policyname;
