-- 온보딩 투어 완료 여부 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 기존 사용자는 이미 사용 중이므로 완료 처리
UPDATE profiles
SET onboarding_completed = true
WHERE onboarding_completed IS NULL OR onboarding_completed = false;
