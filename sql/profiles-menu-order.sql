-- profiles 테이블에 menu_order 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS menu_order jsonb DEFAULT NULL;

-- 확인
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'menu_order';
