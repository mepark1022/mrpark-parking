-- ============================================================
-- 미팍 RLS 동반 튜닝 — org_id 술어 스칼라화 (mepark-saas-policy §2-7, 단계 4)
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2026-07-14
-- ✅ 라이브 적용·검증 완료 2026-07-14 (아래는 실제 실행 확정본)
--    - pg_policies 실측으로 정책명을 정본화(초안의 영문 "Users can ..." 정책명은
--      mepark_tickets 에 존재하지 않았음 → 실제 한글 정책명으로 교체).
--    - 고객 QR 티켓 페이지(anon) 분기가 라이브에 존재 → "티켓 공개 조회" 는
--      anon(미완료 티켓 조회 허용) + authenticated(org 스코프) 두 갈래 유지.
--    - 구 중복 정책(payment_records_*, exit_requests_*, alimtalk 구 정책 등) 정리.
--    - 스모크 테스트 통과: 크루 입차 / 고객 QR 티켓 페이지 / 출차요청 정상.
--
-- 목적:
--   org_id IN (SELECT org_id FROM profiles ...) 세미조인 → 스칼라 등식
--   org_id = (select public.current_org_id()) 으로 전환.
--   (a) 쿼리당 1회 평가(InitPlan)  (b) org_id = <상수> 로 org_id 선두 인덱스 시크 성립.
--   함께 적용한 인덱스: 20260714_org_id_composite_indexes.sql
--   (idx_tickets_org_store_entry / idx_tickets_active / idx_tickets_org_status_entry
--    모두 indisvalid=true 확인)
--
-- ⚠️ 실행 규칙:
--   정책 DROP→CREATE 사이 공백 순간에 RLS default-deny 로 라이브 조회가 막히지
--   않도록 반드시 하나의 트랜잭션(BEGIN/COMMIT)으로 원자 적용.
--   CREATE/DROP POLICY 는 짧은 ACCESS EXCLUSIVE 락 → 입출차 피크 시간대 회피.
-- ============================================================

BEGIN;

-- ── org_id 조회 헬퍼 : STABLE + SECURITY DEFINER ──
--   · STABLE       : 문장 내 상수 취급 → InitPlan 1회
--   · SECURITY DEFINER + search_path 고정 : profiles 자체 RLS 우회로 재귀/오버헤드 제거
--   · profiles.id = auth.users.id (PK) → org_id 는 사용자당 최대 1행(스칼라 안전)
CREATE OR REPLACE FUNCTION public.current_org_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon;

-- ── mepark_tickets (핫 경로 — 실측 정책명: 한글) ──
--   "티켓 공개 조회" = anon(미완료 티켓 조회) OR authenticated(org 스코프)
DROP POLICY IF EXISTS "티켓 공개 조회" ON mepark_tickets;
CREATE POLICY "티켓 공개 조회" ON mepark_tickets FOR SELECT USING (
  ((select auth.role()) = 'anon' AND status <> 'completed')
  OR ((select auth.role()) = 'authenticated' AND org_id = (select public.current_org_id())) );

DROP POLICY IF EXISTS "티켓 생성" ON mepark_tickets;
CREATE POLICY "티켓 생성" ON mepark_tickets FOR INSERT WITH CHECK ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "티켓 수정" ON mepark_tickets;
CREATE POLICY "티켓 수정" ON mepark_tickets FOR UPDATE USING ( org_id = (select public.current_org_id()) );

-- ── payment_records (구 중복 정책 정리 포함) ──
DROP POLICY IF EXISTS "Users can view payments in their org" ON payment_records;
CREATE POLICY "Users can view payments in their org" ON payment_records FOR SELECT USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can insert payments in their org" ON payment_records;
CREATE POLICY "Users can insert payments in their org" ON payment_records FOR INSERT WITH CHECK ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "payment_records_select" ON payment_records;
DROP POLICY IF EXISTS "payment_records_insert" ON payment_records;

-- ── exit_requests (FOR ALL org 정책으로 통합 + 구 정책 정리) ──
DROP POLICY IF EXISTS "Users can manage exit_requests in their org" ON exit_requests;
CREATE POLICY "Users can manage exit_requests in their org" ON exit_requests FOR ALL USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can view exit_requests in their org" ON exit_requests;
DROP POLICY IF EXISTS "exit_requests_select" ON exit_requests;
DROP POLICY IF EXISTS "exit_requests_insert" ON exit_requests;
DROP POLICY IF EXISTS "exit_requests_update" ON exit_requests;

-- ── alimtalk_send_logs (FOR ALL org 정책으로 통합 + 구 정책 정리) ──
DROP POLICY IF EXISTS "alimtalk_logs_org_access" ON alimtalk_send_logs;
CREATE POLICY "alimtalk_logs_org_access" ON alimtalk_send_logs FOR ALL USING ( org_id = (select public.current_org_id()) );

DROP POLICY IF EXISTS "Users can view alimtalk_logs in their org" ON alimtalk_send_logs;
DROP POLICY IF EXISTS "Users can insert alimtalk_logs in their org" ON alimtalk_send_logs;

COMMIT;


-- ============================================================
-- [검증] — 라이브에서 실행·통과 확인 완료 (2026-07-14)
-- ============================================================
-- 1) 정책 스칼라 형태 확인:
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE tablename IN ('mepark_tickets','payment_records','exit_requests','alimtalk_send_logs')
--   ORDER BY tablename, policyname;
-- 2) 헬퍼 함수: SELECT proname, prosecdef, provolatile FROM pg_proc
--    WHERE proname='current_org_id' AND pronamespace='public'::regnamespace;  -- (true, s)
-- 3) 스모크: 크루 입차 / 고객 QR 티켓 페이지 / 출차요청 정상.
