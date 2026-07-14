-- ============================================================
-- 미팍 org_id 선두 복합 인덱스 — mepark_tickets (라이브 무중단)
-- (mepark-saas-policy §2-7 1번)
-- 실행 위치: Supabase SQL Editor
-- 작성일: 2026-07-14
-- ✅ 라이브 적용·검증 완료 2026-07-14:
--    idx_tickets_org_store_entry / idx_tickets_active / idx_tickets_org_status_entry
--    3개 신규 생성(문장별 실행), STEP 3-1 로 indisvalid=true 확인, ANALYZE 완료.
--    (idx_tickets_collision 은 기존 존재 → IF NOT EXISTS 스킵)
--
-- ⚠️⚠️ 실행 규칙 (반드시 준수) ⚠️⚠️
--  1) CREATE INDEX CONCURRENTLY 는 트랜잭션 블록 밖에서만 동작.
--     → BEGIN/COMMIT 로 감싸지 말 것. ⚠️ Supabase SQL Editor 는 한 번에 여러
--       문장을 실행하면 암묵적으로 "하나의 트랜잭션"으로 감싼다 → CONCURRENTLY 가
--       "cannot run inside a transaction block" 로 전부 실패(= d9b78b8 미적용 원인).
--       반드시 CREATE INDEX 문을 "에디터에 하나만 남기고 한 문장씩" 개별 Run.
--     → supabase db push(CLI)는 파일을 1개 트랜잭션으로 감싸므로 이 파일에는
--       부적합. 이 저장소의 관행(대시보드 SQL Editor 수동 실행)을 따를 것.
--  2) 실행 전, 진단 [A-3] 로 INVALID 인덱스가 없는지 확인.
--     (CONCURRENTLY 가 중간 실패하면 INVALID 인덱스가 남고, IF NOT EXISTS 는
--      이를 "존재"로 보고 재생성을 건너뜀 → 먼저 DROP INDEX CONCURRENTLY 필요)
--  3) CONCURRENTLY 는 락을 거의 안 잡지만, 진행 중 VACUUM/스키마변경과 충돌
--     가능. 입출차 피크 시간대를 피해 실행 권장.
--
-- 설계 근거(코드 실측, subagent 쿼리패턴 분석):
--  · mepark_tickets = 유일한 핫 테이블. 대표 패턴:
--      (org_id, store_id, status, entry_at) 조합 + entry_at DESC 정렬.
--  · payment_records / exit_requests = 읽기 쿼리 없음(INSERT·DELETE만)
--      → 복합 인덱스 불필요(쓰기 부담만 늘어 남발 위반). 이번 범위 제외.
--  · daily_reports = 이미 (org_id,report_date),(org_id,store_id,report_date),
--      (org_id,status,report_date) 존재 → 대표 패턴 이미 커버. 신규 없음.
--  · worker_attendance = base DDL 부재로 컬럼/유니크 미확인. 진단 [A-4] 확인 후 별도.
--
-- 파티셔닝 정합성: 아래 인덱스는 모두 org_id 선두 + entry_at 을 후미 정렬키로 사용 →
--  향후 entry_at 월별 RANGE 파티셔닝 시 각 파티션의 로컬 인덱스로 자연 이식 가능.
-- ============================================================


-- ── 사전 정리(필요 시에만) : INVALID 잔재가 있으면 주석 해제해 먼저 제거 ──
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_org_store_entry;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_active;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_collision;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_org_status_entry;


-- ── [1] 관리자/매장 목록 · 기간조회 · parking-status 워크호스 ──
--   패턴: org_id + store_id(eq/in) + entry_at 기간/정렬(DESC), status 는 인덱스내 필터
--   대체: 구 idx_tickets_store_id, idx_tickets_entry_at 를 org 스코프에서 포섭
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_store_entry
  ON mepark_tickets (org_id, store_id, entry_at DESC);


-- ── [2] 라이브 주차보드(핫 subset) : 현재 주차중(=미완료)만 ──
--   패턴: org_id + store_id + status<>'completed' → entry_at DESC
--   부분 인덱스라 "현재 장내 차량"만 담아 매우 작고, 크루 화면 새로고침마다 사용.
--   무중단 운영의 최우선 인덱스.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_active
  ON mepark_tickets (org_id, store_id, entry_at DESC)
  WHERE status <> 'completed';


-- ── [3] 입차 충돌/중복 검사 (매 입차마다) ──
--   패턴: org_id + store_id + plate_last4 + status IN(active set)
--   미완료 부분 인덱스 + plate_last4 로 상수시간 근접 조회.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_collision
  ON mepark_tickets (org_id, store_id, plate_last4)
  WHERE status <> 'completed';


-- ── [4] 전 매장 통계/연체 : status 등식 + entry_at (store_id 무필터) ──
--   패턴: org_id + status='completed'(or 'overdue'/'pre_paid') + entry_at 기간/정렬
--   store_id 를 안 거는 통계(hourly/overview)용. [1]은 store 선두라 이 경우 미활용.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_status_entry
  ON mepark_tickets (org_id, status, entry_at DESC);


-- ============================================================
-- [검증] 적용 직후 확인
-- ============================================================
-- 1) 4개 인덱스가 VALID 로 생성됐는지:
--   SELECT indexrelid::regclass AS idx, indisvalid
--   FROM pg_index WHERE indrelid='public.mepark_tickets'::regclass
--     AND indexrelid::regclass::text LIKE 'idx_tickets_%';
-- 2) 진단 [C-1..C-5] EXPLAIN 재실행 → Seq Scan → Index/Bitmap Scan 전환 확인.
-- 3) 통계 갱신: ANALYZE mepark_tickets;
ANALYZE mepark_tickets;


-- ============================================================
-- [정리] 구 단일컬럼 인덱스 제거 — ⚠️ 반드시 조건부 실행
--   아래는 위 복합 인덱스가 포섭하는 구 인덱스들. 그러나 즉시 삭제 금지.
--   절차:
--     (a) 위 인덱스 적용 후 최소 1~2일 실트래픽 경과.
--     (b) 진단 [D] pg_stat_user_indexes 로 각 구 인덱스의 idx_scan 이
--         0(또는 무시 가능 수준)인지 확인.
--     (c) 확인된 것만 아래 주석을 해제해 CONCURRENTLY 로 제거.
--   (idx_tickets_plate 은 목록 ilike 검색에 쓰일 수 있어 기본 보존 — [D]로 판단)
-- ============================================================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_store_id;    -- ← idx_tickets_org_store_entry 로 포섭
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_status;      -- ← idx_tickets_org_status_entry 로 포섭
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_entry_at;    -- ← org 스코프 정렬은 복합이 포섭
-- DROP INDEX CONCURRENTLY IF EXISTS idx_tickets_org_id;      -- ← 모든 org 선두 복합이 포섭
