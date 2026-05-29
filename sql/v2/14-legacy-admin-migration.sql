-- ============================================================
-- 14-legacy-admin-migration.sql
-- 레거시 관리자(admin/super_admin) profiles → employees 행 생성 + 연결
-- ------------------------------------------------------------
-- 배경:
--   레거시 /api/team/create-account 는 employees 행 없이
--   profiles + workers + store_members(user_id 키)에만 기록했다.
--   → v2 직원목록(employees 기반)에 잡히지 않음.
--   본 SQL이 누락된 employees 행을 만들고 profiles.employee_id 를 연결한다.
--
-- 안전성:
--   - 대상 = role in (admin, super_admin) AND employee_id IS NULL.
--   - employee_id 가 NULL 인 관리자만 처리하므로 재실행해도 중복 생성 없음(멱등).
--   - 로그인/권한에는 영향 없음(requireAuth 는 employee_id 없이도 동작).
--
-- 실행: Supabase SQL Editor 에서 1회 실행. 아래 ① 미리보기로 대상 먼저 확인 권장.
-- ============================================================

-- ── ① (선택) 사전 미리보기: 마이그레이션 대상 ──
-- SELECT p.id AS user_id, p.email, p.name, p.role, p.org_id
-- FROM profiles p
-- WHERE p.role IN ('admin','super_admin')
--   AND p.employee_id IS NULL
--   AND p.org_id IS NOT NULL;

-- ── ② 마이그레이션 본문 ──
DO $$
DECLARE
  r        RECORD;
  v_emp_no TEXT;
  v_seq    INT;
  v_name   TEXT;
  v_phone  TEXT;
  v_hire   DATE;
  v_new_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, p.email, p.name, p.role, p.org_id
    FROM profiles p
    WHERE p.role IN ('admin','super_admin')
      AND p.employee_id IS NULL
      AND p.org_id IS NOT NULL
  LOOP
    -- 이름: profiles.name → workers.name → 이메일 앞부분 → '관리자'
    v_name := COALESCE(
      NULLIF(r.name, ''),
      (SELECT w.name FROM workers w
         WHERE w.user_id = r.user_id AND w.name IS NOT NULL LIMIT 1),
      NULLIF(split_part(COALESCE(r.email, ''), '@', 1), ''),
      '관리자'
    );

    -- 전화번호: workers 에서 (있으면)
    v_phone := (SELECT w.phone FROM workers w
                  WHERE w.user_id = r.user_id AND w.phone IS NOT NULL LIMIT 1);

    -- 입사일: auth.users.created_at → 없으면 오늘
    v_hire := COALESCE(
      (SELECT u.created_at::date FROM auth.users u WHERE u.id = r.user_id),
      CURRENT_DATE
    );

    -- 사번: ADM### (org 내 미사용 번호 탐색)
    v_seq := 1;
    LOOP
      v_emp_no := 'ADM' || lpad(v_seq::text, 3, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM employees e
          WHERE e.org_id = r.org_id AND e.emp_no = v_emp_no
      );
      v_seq := v_seq + 1;
    END LOOP;

    -- employees 행 생성
    INSERT INTO employees
      (org_id, emp_no, name, phone, role, status, hire_date, position, employment_type)
    VALUES
      (r.org_id, v_emp_no, v_name, v_phone, r.role, '재직', v_hire, '관리자', '정규직')
    RETURNING id INTO v_new_id;

    -- profiles 연결
    UPDATE profiles
       SET employee_id = v_new_id,
           emp_no = v_emp_no
     WHERE id = r.user_id;

    RAISE NOTICE '[migrate] % (%) → employees=% emp_no=% role=%',
      v_name, r.email, v_new_id, v_emp_no, r.role;
  END LOOP;
END $$;

-- ── ③ 사후 검증 ──
-- SELECT e.emp_no, e.name, e.role, e.hire_date, p.email, p.employee_id
-- FROM employees e
-- JOIN profiles p ON p.employee_id = e.id
-- WHERE e.position = '관리자'
-- ORDER BY e.emp_no;
