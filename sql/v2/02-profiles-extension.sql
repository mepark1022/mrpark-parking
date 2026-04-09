-- ============================================
-- 미팍 통합앱 v2 — Part 2-02: profiles 확장
-- ============================================
-- ⚠️ 기존 profiles 테이블에 컬럼만 추가 (기존 데이터/쿼리 영향 없음)
-- ⚠️ 모든 신규 컬럼은 NULL 허용 또는 DEFAULT 있음 → 기존 행 자동 호환
-- 실행: Supabase SQL Editor에서 실행

-- 1. emp_no 컬럼 (사번 연결키)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'emp_no'
  ) THEN
    ALTER TABLE profiles ADD COLUMN emp_no TEXT;
  END IF;
END $$;

-- 2. employee_id 컬럼 (employees FK)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN employee_id UUID;
  END IF;
END $$;

-- 3. site_code 컬럼 (주 사업장 코드)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'site_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN site_code TEXT;
  END IF;
END $$;

-- 4. password_changed 컬럼 (초기PW 변경 여부)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'password_changed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN password_changed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 5. last_login_at 컬럼
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- 6. login_fail_count 컬럼 (로그인 실패 횟수)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'login_fail_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN login_fail_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 7. locked_until 컬럼 (잠금 해제 시각)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE profiles ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;
END $$;

-- 8. 인덱스 (신규 컬럼용)
CREATE INDEX IF NOT EXISTS idx_profiles_emp_no ON profiles(emp_no);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);

-- 확인 쿼리 (실행 후 결과 확인용)
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- ORDER BY ordinal_position;

COMMENT ON COLUMN profiles.emp_no IS 'v2: 사번 (employees.emp_no 연결키)';
COMMENT ON COLUMN profiles.password_changed IS 'v2: 초기 비밀번호 변경 여부';
COMMENT ON COLUMN profiles.login_fail_count IS 'v2: 로그인 실패 횟수 (5회 시 잠금)';
COMMENT ON COLUMN profiles.locked_until IS 'v2: 계정 잠금 해제 시각 (3분)';
