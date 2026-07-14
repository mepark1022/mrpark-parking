-- ============================================================
-- 미팍 RLS 동반 튜닝 — org_id 술어 스칼라화 (mepark-saas-policy §2-7, 단계 4)
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2026-07-14
--
-- 목적:
--   현재 part13.5 정책들은  org_id IN (SELECT org_id FROM profiles WHERE id=auth.uid())
--   형태(세미조인)라, 크루 클라이언트처럼 org_id 를 명시 필터하지 않고 store_id 만
--   거는 쿼리에서 org_id 선두 복합 인덱스(20260714_org_id_composite_indexes.sql)의
--   Index Scan 이 안정적으로 잡히지 않을 수 있음.
--   → 스칼라 등식  org_id = (select public.current_org_id())  으로 바꾸면
--      (a) 쿼리당 1회 평가(InitPlan)  (b) org_id = <상수> 로 인덱스 시크 성립.
--
--   ※ daily_reports/v2 정책은 이미 org_id = (SELECT org_id FROM profiles ...) 스칼라
--     형태라 성능상 문제 없음 → 이번 대상 아님.
--
-- ⚠️ 실행 규칙 (인덱스 파일과 반대):
--   정책 DROP→CREATE 사이에 정책이 "없는" 순간이 생기면 RLS default-deny 로
--   라이브 조회가 잠깐 막힐 수 있음. 그래서 이 파일은 반드시 하나의 트랜잭션
--   (BEGIN/COMMIT)으로 원자 적용. (CONCURRENTLY 없음 → 트랜잭션 안전/권장)
--   CREATE/DROP POLICY 는 테이블에 짧은 ACCESS EXCLUSIVE 락을 잡으므로
--   입출차 피크 시간대는 피해 실행.
-- ============================================================

BEGIN;

-- ── 0) org_id 조회 헬퍼 : STABLE + SECURITY DEFINER ──
--   · STABLE       : 문장 내 상수 취급 → InitPlan 1회
--   · SECURITY DEFINER + search_path 고정 : profiles 자체 RLS 우회로 재귀/오버헤드 제거
--   · profiles.id = auth.users.id (PK) → org_id 는 사용자당 최대 1행(스칼라 안전)
CREATE OR REPLACE FUNCTION public.current_org_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon;


-- ============================================================
-- mepark_tickets  (핫 경로 — SELECT/INSERT/UPDATE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view tickets in their org"   ON mepark_tickets;
CREATE POLICY "Users can view tickets in their org" ON mepark_tickets
  FOR SELECT USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can insert tickets in their org" ON mepark_tickets;
CREATE POLICY "Users can insert tickets in their org" ON mepark_tickets
  FOR INSERT WITH CHECK ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can update tickets in their org" ON mepark_tickets;
CREATE POLICY "Users can update tickets in their org" ON mepark_tickets
  FOR UPDATE USING ( org_id = (select public.current_org_id()) );


-- ============================================================
-- payment_records  (입차 정산 경로 INSERT WITH CHECK 도 스칼라 평가)
-- ============================================================
DROP POLICY IF EXISTS "Users can view payments in their org"   ON payment_records;
CREATE POLICY "Users can view payments in their org" ON payment_records
  FOR SELECT USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can insert payments in their org" ON payment_records;
CREATE POLICY "Users can insert payments in their org" ON payment_records
  FOR INSERT WITH CHECK ( org_id = (select public.current_org_id()) );


-- ============================================================
-- exit_requests  (발렛 출차요청)
-- ============================================================
DROP POLICY IF EXISTS "Users can view exit_requests in their org"   ON exit_requests;
CREATE POLICY "Users can view exit_requests in their org" ON exit_requests
  FOR SELECT USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can manage exit_requests in their org" ON exit_requests;
CREATE POLICY "Users can manage exit_requests in their org" ON exit_requests
  FOR ALL USING ( org_id = (select public.current_org_id()) );


-- ============================================================
-- alimtalk_send_logs  (입차/준비 알림톡 로그 — 입차마다 INSERT)
-- ============================================================
DROP POLICY IF EXISTS "Users can view alimtalk_logs in their org"   ON alimtalk_send_logs;
CREATE POLICY "Users can view alimtalk_logs in their org" ON alimtalk_send_logs
  FOR SELECT USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can insert alimtalk_logs in their org" ON alimtalk_send_logs;
CREATE POLICY "Users can insert alimtalk_logs in their org" ON alimtalk_send_logs
  FOR INSERT WITH CHECK ( org_id = (select public.current_org_id()) );

COMMIT;


-- ============================================================
-- [검증] (트랜잭션 밖에서 실행)
-- ============================================================
-- 1) 정책이 스칼라 형태로 바뀌었는지:
--   SELECT tablename, policyname, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('mepark_tickets','payment_records','exit_requests','alimtalk_send_logs')
--   ORDER BY tablename, policyname;
--
-- 2) 실제 앱 role(authenticated)로 크루 store-only 조회가 org_id 선두 인덱스를
--    타는지 확인 — 서비스롤 SQL Editor 는 RLS 우회이므로 아래처럼 role 위장 필요:
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<크루-auth-uid>"}';
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT * FROM mepark_tickets WHERE store_id = '<store-uuid>' AND status <> 'completed'
--     ORDER BY entry_at DESC;
--   RESET role;
--   → 계획에 idx_tickets_active (또는 idx_tickets_org_store_entry) Index Scan 확인.
--
-- 3) 회귀 점검: 다른 org 사용자로 조회 시 0행(테넌트 격리 유지)인지 확인.
