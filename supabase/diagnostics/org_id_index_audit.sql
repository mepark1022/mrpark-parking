-- ============================================================
-- 미팍 org_id 선두 복합 인덱스 최적화 — 진단 스크립트
-- (mepark-saas-policy §2-7 1번 / 라이브 무중단)
-- 실행 위치: Supabase SQL Editor
-- 성격: 읽기 전용 진단. 스키마/데이터 변경 없음. 안심하고 통째 실행 가능.
--
-- 이 스크립트가 커버하는 정책 단계:
--   1) 핫 테이블 컬럼·기존 인덱스 정본 덤프
--   2) pg_stat_statements 상위 쿼리 + Seq Scan 유발 테이블 식별
--   5) pg_stat_user_indexes 로 실사용·미사용 인덱스 점검
--
-- ⚠️ CLI/MCP 로 DB 에 직접 붙을 수단이 저장소에 없어(코드는 RLS 세션으로만 접근),
--    본 진단은 반드시 대시보드 SQL Editor(서비스롤/postgres)에서 사람이 실행해야 함.
-- ============================================================


-- ============================================================
-- [A] 스키마 정본 덤프 — 핫 테이블 컬럼
--   설계 초안의 추정 컬럼명(entered_at / vehicle_number / employee_id /
--   work_date / paid_at)을 정본으로 치환하기 위한 근거.
-- ============================================================
SELECT
  c.table_name,
  c.ordinal_position AS pos,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'mepark_tickets', 'payment_records', 'exit_requests',
    'worker_attendance', 'daily_reports', 'daily_report_staff'
  )
ORDER BY c.table_name, c.ordinal_position;


-- ============================================================
-- [A-2] 기존 인덱스 정본 덤프 (정의 포함)
--   이미 존재하는 인덱스와 중복되는 복합 인덱스를 만들지 않기 위함.
-- ============================================================
SELECT
  t.relname       AS table_name,
  i.relname       AS index_name,
  pg_get_indexdef(ix.indexrelid) AS index_def,
  ix.indisunique  AS is_unique,
  ix.indisvalid   AS is_valid,      -- false = 이전 CONCURRENTLY 실패 잔재 → 먼저 DROP 필요
  pg_size_pretty(pg_relation_size(ix.indexrelid)) AS index_size
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'mepark_tickets', 'payment_records', 'exit_requests',
    'worker_attendance', 'daily_reports', 'daily_report_staff'
  )
ORDER BY t.relname, i.relname;


-- ============================================================
-- [A-3] INVALID 인덱스 점검 (CONCURRENTLY 실패 잔재)
--   결과가 있으면, 마이그레이션 실행 전에 DROP INDEX CONCURRENTLY IF EXISTS 로 제거할 것.
--   (IF NOT EXISTS 는 INVALID 인덱스를 "존재"로 보고 재생성을 건너뛰므로 반드시 선정리)
-- ============================================================
SELECT n.nspname AS schema, c.relname AS invalid_index
FROM pg_index ix
JOIN pg_class c ON c.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE ix.indisvalid = false
  AND n.nspname = 'public'
ORDER BY c.relname;


-- ============================================================
-- [A-4] worker_attendance 정본 확인 (저장소에 base DDL 부재)
--   컬럼명이 worker_id/date 인지 employee_id/work_date 인지, 그리고
--   (worker_id, date) 유니크 제약이 이미 있는지 반드시 확인 후 인덱스 설계.
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'worker_attendance'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.worker_attendance'::regclass
  AND contype IN ('u','p');


-- ============================================================
-- [B] Seq Scan 유발 테이블 식별 (테이블 단위 스캔 통계)
--   seq_scan 이 idx_scan 대비 크고, seq_tup_read 가 크면 풀스캔 병목.
--   n_live_tup 로 테이블 규모도 함께 확인.
-- ============================================================
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup,
  CASE WHEN seq_scan > 0
       THEN round(seq_tup_read::numeric / seq_scan, 0)
       ELSE 0 END AS avg_rows_per_seqscan
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'mepark_tickets', 'payment_records', 'exit_requests',
    'worker_attendance', 'daily_reports', 'daily_report_staff'
  )
ORDER BY seq_tup_read DESC;


-- ============================================================
-- [B-2] pg_stat_statements 상위 쿼리 (총 실행시간 기준)
--   확장 필요: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--   (Supabase 는 대개 기본 활성. 없으면 Dashboard > Database > Extensions 에서 활성화)
--   핫 테이블을 건드리는 쿼리만 필터. mean_exec_time·rows 로 우선순위 판단.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT
  round(total_exec_time::numeric, 1)          AS total_ms,
  calls,
  round(mean_exec_time::numeric, 3)           AS mean_ms,
  rows,
  round((100 * total_exec_time
        / NULLIF(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct_total,
  left(regexp_replace(query, '\s+', ' ', 'g'), 200) AS query_snippet
FROM pg_stat_statements
WHERE query ~* 'mepark_tickets|payment_records|exit_requests|worker_attendance|daily_reports'
  AND query !~* 'pg_stat_statements|information_schema|pg_catalog'
ORDER BY total_exec_time DESC
LIMIT 25;


-- ============================================================
-- [C] EXPLAIN (ANALYZE, BUFFERS) — 코드에서 식별한 핫 쿼리들
--   ⚠️ :ORG / :STORE 자리표시자는 실제 uuid 로 치환 후 실행.
--     (예: SELECT id FROM organizations WHERE name='주식회사 미스터팍';
--          SELECT id, name FROM stores WHERE org_id = '...' LIMIT 5; 로 확보)
--   목표: 아래 쿼리들에서 'Seq Scan on mepark_tickets' 가 뜨는지 확인 →
--         인덱스 적용 후 'Index Scan / Bitmap Index Scan' 으로 전환되는지 재확인.
--
--   ※ RLS 는 SQL Editor(서비스롤)에서 우회되므로, 여기 EXPLAIN 은
--     "앱이 org_id 를 명시 필터로 넣었을 때"의 계획을 본다.
--     크루 클라이언트(store_id 만 필터)의 실제 계획은 RLS 가 주입한
--     org_id 술어에 좌우되므로 [D] 사용통계 + §4 RLS 스칼라화가 핵심.
-- ============================================================

-- C-1) 관리자 티켓 목록: org + store + 기간 + status → entry_at DESC
--       (src/app/api/v1/tickets/route.ts, parking-status/page.tsx)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM mepark_tickets
WHERE org_id = :'ORG'
  AND store_id = :'STORE'
  AND entry_at >= now() - interval '30 days'
ORDER BY entry_at DESC
LIMIT 50;

-- C-2) 라이브 주차보드(크루): 현재 주차중(=미완료) 목록  ← 가장 빈번/무중단 핵심
--       (src/app/crew/parking-list/page.tsx, tickets/active/route.ts)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM mepark_tickets
WHERE org_id = :'ORG'
  AND store_id = :'STORE'
  AND status <> 'completed'
ORDER BY entry_at DESC;

-- C-3) 입차 시 충돌/중복 검사 (매 입차마다 발생)
--       (src/app/api/v1/tickets/check-collision/route.ts)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM mepark_tickets
WHERE org_id = :'ORG'
  AND store_id = :'STORE'
  AND plate_last4 = '1234'
  AND status IN ('parking','exit_requested','car_ready','pre_paid','overdue')
ORDER BY entry_at DESC;

-- C-4) 시간대별 통계(완료 건, 전 매장): status='completed' + 기간 → entry_at
--       (src/app/api/v1/stats/hourly/route.ts)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM mepark_tickets
WHERE org_id = :'ORG'
  AND status = 'completed'
  AND entry_at >= date_trunc('month', now())
ORDER BY entry_at ASC;

-- C-5) 연체(overdue) 목록: status='overdue' → 마감시각
--       (src/app/parking-status/page.tsx)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM mepark_tickets
WHERE org_id = :'ORG'
  AND status = 'overdue'
ORDER BY pre_paid_deadline ASC;

-- C-6) daily_reports 대표 패턴 검증 (이미 복합 인덱스 존재 → Index Scan 기대)
--       (stats/*, attendance/*)
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM daily_reports
WHERE org_id = :'ORG'
  AND report_date >= (now() - interval '31 days')::date
  AND status <> 'draft'
ORDER BY report_date DESC;


-- ============================================================
-- [D] 인덱스 실사용 점검 (정책 단계 5)
--   idx_scan = 0 인 인덱스 = 미사용 후보(쓰기 성능만 갉아먹음).
--   ⚠️ 통계는 마지막 리셋 이후 누적치. 마이그레이션 적용 후 최소 1~2일
--     실트래픽을 받은 뒤 재조회해야 판단 가능.
--   여기서 idx_scan=0 으로 확인된 "구 단일컬럼 인덱스"는
--   마이그레이션의 [정리] 섹션(DROP INDEX CONCURRENTLY)에서 제거.
-- ============================================================
SELECT
  relname   AS table_name,
  indexrelname AS index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN (
    'mepark_tickets', 'payment_records', 'exit_requests',
    'worker_attendance', 'daily_reports', 'daily_report_staff'
  )
ORDER BY relname, idx_scan ASC;

-- 통계 리셋(선택): 특정 기간 사용량만 깨끗이 재측정하고 싶을 때
-- SELECT pg_stat_reset();
