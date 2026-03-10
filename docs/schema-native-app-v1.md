# ME.PARK 네이티브 앱 — 스키마 재설계 v1.0

> 작성일: 2026.03.10
> 목적: `workers` 테이블 제거 → `profiles` 단일 진실 소스(SSOT) 전환
> 적용 시점: 네이티브 앱 전환 시 (Phase 2)

---

## 1. 현재 구조 진단

### 1.1 이중 관리 문제

현재 시스템은 같은 사람의 정보를 **두 테이블에 분산 저장**하고 있다.

| 항목 | profiles | workers |
|------|----------|---------|
| 이름 | 카카오 닉네임 (jmh0310) | 관리자 입력 실명 (장민호) |
| 연락처 | ❌ 없음 | phone |
| 상태 | status (active/pending/disabled) | status (active/inactive) |
| 조직 | org_id | org_id |
| 연결 키 | id (= auth.users.id) | user_id → profiles.id |

**문제점:**
- 이름 불일치: `/team`은 `profiles.name`, `/workers`는 `workers.name` 표시
- 한쪽 수정이 다른 쪽에 반영 안 됨
- CREW 앱 첫 로그인 시 `workers` 레코드 자동 생성 → `profiles.name`(카카오 닉네임) 복사 → 관리자가 명부에서 실명 수정 → `profiles.name`은 그대로

### 1.2 현재 workers 테이블 컬럼

```
workers
├── id          uuid PK
├── org_id      uuid FK → organizations
├── user_id     uuid FK → auth.users (nullable — 계정 미연결 근무자)
├── name        text
├── phone       text | null
├── status      active | inactive
├── region_id   uuid | null FK → regions
├── district    text | null
├── hire_date   date | null
├── daily_wage  int | null
├── created_at  timestamptz
```

### 1.3 worker_id를 FK로 참조하는 테이블 (7개)

| 테이블 | FK 컬럼 | 용도 |
|--------|---------|------|
| worker_attendance | worker_id | 출퇴근 기록 (check_in, check_out, status) |
| worker_assignments | worker_id | 일일 근무자 배정 (record_id 연동) |
| worker_leaves | worker_id | 연차 총계 (total_days, used_days) |
| worker_leave_records | worker_id | 연차 사용 기록 |
| worker_reviews | worker_id | 근무 리뷰 |
| worker_reports | worker_id | 시말서 |
| store_default_workers | worker_id | 매장별 기본 근무자 |

### 1.4 현재 profiles 테이블 컬럼

```
profiles
├── id          uuid PK (= auth.users.id)
├── org_id      uuid FK → organizations
├── email       text
├── name        text | null
├── role        super_admin | admin | crew
├── status      active | pending | disabled
├── created_at  timestamptz
```

---

## 2. 목표 구조 (네이티브 앱)

### 2.1 설계 원칙

1. **profiles = 유일한 사용자 테이블** — 모든 사용자 정보의 SSOT
2. **workers 테이블 완전 제거** — 운영 필드는 profiles로 흡수
3. **모든 FK를 user_id (= profiles.id) 기준으로 통일**
4. **네이티브 앱 = 전원 계정 보유** → "계정 미연결 근무자" 시나리오 제거

### 2.2 확장된 profiles 스키마

```sql
-- profiles 테이블 확장 (workers 흡수)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_wage int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;  -- 관리자가 수정하는 표시 이름

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

**이름 관리 정책:**
- `profiles.name`: 카카오 로그인 시 자동 입력 (읽기 전용)
- `profiles.display_name`: 관리자 또는 본인이 수정하는 표시 이름
- **표시 우선순위:** `display_name > name > email`
- 네이티브 앱 온보딩 시 실명 입력 → `display_name`에 저장

### 2.3 확장된 profiles 전체 스키마

```
profiles (확장 후)
├── id              uuid PK (= auth.users.id)
├── org_id          uuid FK → organizations
├── email           text NOT NULL
├── name            text | null          ← 카카오/소셜 로그인 닉네임 (자동)
├── display_name    text | null          ← 표시 이름 (관리자/본인 수정)
├── role            super_admin | admin | crew
├── status          active | pending | disabled
├── phone           text | null          ← workers에서 흡수
├── region_id       uuid | null          ← workers에서 흡수
├── district        text | null          ← workers에서 흡수
├── hire_date       date | null          ← workers에서 흡수
├── daily_wage      int DEFAULT 0        ← workers에서 흡수
├── created_at      timestamptz
├── updated_at      timestamptz          ← 추가
```

---

## 3. FK 전환 맵핑

### 3.1 테이블별 전환 계획

모든 `worker_id` → `user_id` (= profiles.id)로 전환한다.

| 테이블 | 현재 FK | 전환 후 FK | 비고 |
|--------|---------|-----------|------|
| worker_attendance | worker_id → workers.id | user_id → profiles.id | 가장 데이터 많음 |
| worker_assignments | worker_id → workers.id | user_id → profiles.id | daily_records 연동 |
| worker_leaves | worker_id → workers.id | user_id → profiles.id | 연차 총계 |
| worker_leave_records | worker_id → workers.id | user_id → profiles.id | 연차 사용 |
| worker_reviews | worker_id → workers.id | user_id → profiles.id | |
| worker_reports | worker_id → workers.id | user_id → profiles.id | |
| store_default_workers | worker_id → workers.id | user_id → profiles.id | |

### 3.2 store_members 테이블 (변경 없음)

```
store_members
├── user_id   → profiles.id  ← 이미 profiles 기준
├── store_id  → stores.id
├── org_id    → organizations.id
```

현재도 `user_id` 기준이므로 변경 불필요. 오히려 통합 후에는 workers↔store_members 간접 조인이 사라져서 쿼리가 단순해진다.

---

## 4. 마이그레이션 SQL

### 4.1 Phase A: profiles 확장 + 데이터 이관

```sql
-- Step 1: profiles 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_wage int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: workers → profiles 데이터 이관 (user_id가 있는 것만)
UPDATE profiles p SET
  display_name = COALESCE(w.name, p.name),
  phone = w.phone,
  region_id = w.region_id,
  district = w.district,
  hire_date = w.hire_date,
  daily_wage = w.daily_wage,
  updated_at = now()
FROM workers w
WHERE w.user_id = p.id
  AND w.user_id IS NOT NULL;
```

### 4.2 Phase B: FK 전환 (각 테이블)

```sql
-- worker_attendance
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_attendance wa SET user_id = w.user_id
FROM workers w WHERE wa.worker_id = w.id AND w.user_id IS NOT NULL;
-- 검증 후:
-- ALTER TABLE worker_attendance DROP COLUMN worker_id;

-- worker_leaves
ALTER TABLE worker_leaves ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_leaves wl SET user_id = w.user_id
FROM workers w WHERE wl.worker_id = w.id AND w.user_id IS NOT NULL;

-- worker_leave_records
ALTER TABLE worker_leave_records ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_leave_records wlr SET user_id = w.user_id
FROM workers w WHERE wlr.worker_id = w.id AND w.user_id IS NOT NULL;

-- worker_assignments
ALTER TABLE worker_assignments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_assignments wa SET user_id = w.user_id
FROM workers w WHERE wa.worker_id = w.id AND w.user_id IS NOT NULL;

-- worker_reviews
ALTER TABLE worker_reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_reviews wr SET user_id = w.user_id
FROM workers w WHERE wr.worker_id = w.id AND w.user_id IS NOT NULL;

-- worker_reports
ALTER TABLE worker_reports ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_reports wr SET user_id = w.user_id
FROM workers w WHERE wr.worker_id = w.id AND w.user_id IS NOT NULL;

-- store_default_workers
ALTER TABLE store_default_workers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE store_default_workers sdw SET user_id = w.user_id
FROM workers w WHERE sdw.worker_id = w.id AND w.user_id IS NOT NULL;
```

### 4.3 Phase C: 검증 + workers 제거

```sql
-- 검증: user_id NULL인 레코드 확인 (계정 미연결 workers의 데이터)
SELECT 'worker_attendance' AS tbl, COUNT(*) FROM worker_attendance WHERE user_id IS NULL
UNION ALL
SELECT 'worker_leaves', COUNT(*) FROM worker_leaves WHERE user_id IS NULL
UNION ALL
SELECT 'worker_leave_records', COUNT(*) FROM worker_leave_records WHERE user_id IS NULL
UNION ALL
SELECT 'worker_assignments', COUNT(*) FROM worker_assignments WHERE user_id IS NULL
UNION ALL
SELECT 'worker_reviews', COUNT(*) FROM worker_reviews WHERE user_id IS NULL
UNION ALL
SELECT 'worker_reports', COUNT(*) FROM worker_reports WHERE user_id IS NULL
UNION ALL
SELECT 'store_default_workers', COUNT(*) FROM store_default_workers WHERE user_id IS NULL;

-- NULL 레코드가 0이면 → worker_id 컬럼 제거 + workers 테이블 DROP
-- NULL 레코드가 있으면 → 계정 미연결 데이터 수동 처리 후 진행

-- 최종 정리 (검증 완료 후)
-- ALTER TABLE worker_attendance DROP COLUMN worker_id;
-- ALTER TABLE worker_leaves DROP COLUMN worker_id;
-- ... (각 테이블)
-- DROP TABLE workers;
```

---

## 5. 코드 변경 영향 범위

### 5.1 파일별 수정 사항

| 파일 | 현재 | 변경 후 |
|------|------|---------|
| `/app/workers/page.tsx` (명부) | `workers` 테이블 CRUD | `profiles` 직접 CRUD + display_name |
| `/app/workers/page.tsx` (출퇴근) | `worker_id`로 attendance 조회 | `user_id`로 attendance 조회 |
| `/app/workers/page.tsx` (근태) | `worker_id` 기준 매트릭스 | `user_id` 기준 매트릭스 |
| `/app/workers/LeaveTab.tsx` | `workers` + `worker_leaves` 조인 | `profiles` + `worker_leaves` 조인 |
| `/app/workers/ReviewTab.tsx` | `workers.select("id, name")` | `profiles.select("id, display_name, name")` |
| `/app/workers/ReportTab.tsx` | `workers.select("id, name")` | `profiles.select("id, display_name, name")` |
| `/app/team/page.tsx` | `profiles` 별도 조회 | 변경 없음 (이미 profiles 사용) |
| `/app/crew/attendance/page.tsx` | workers 자동 생성 로직 | **제거** (profiles만 사용) |
| `/app/crew/page.tsx` | workers 자동 생성 로직 | **제거** |
| `/app/crew/leave/page.tsx` | `workers.select("id")` | `profiles.id` 직접 사용 |
| `/app/dashboard/page.tsx` | `workers.select(count)` | `profiles.select(count).eq("role","crew")` |
| `/app/settings/workers/page.tsx` | workers CRUD | profiles CRUD |
| `/app/settings/default-workers/page.tsx` | worker_id 참조 | user_id 참조 |
| `/lib/types/database.ts` | Worker 타입 정의 | **제거**, Profile 타입 확장 |

### 5.2 헬퍼 함수 변경

```typescript
// 현재: getDisplayName 로직 (여러 곳에 산재)
const name = workers.name;  // workers 테이블에서

// 변경 후: 통일된 헬퍼
function getDisplayName(profile: Profile): string {
  return profile.display_name || profile.name || profile.email;
}
```

### 5.3 CREW 앱 변경

```
현재 플로우:
  크루 로그인 → workers 레코드 있나? → 없으면 자동 생성 → worker.id로 출퇴근

변경 후:
  크루 로그인 → profiles.id로 직접 출퇴근 (workers 자동생성 로직 제거)
```

---

## 6. 엣지 케이스 처리

### 6.1 계정 미연결 근무자 (user_id IS NULL)

현재 `workers` 테이블에 `user_id`가 NULL인 레코드가 존재할 수 있다. (앱 미사용 인력)

**네이티브 앱 전환 정책:**
- 전원 앱 설치 필수 → 계정 미연결 근무자 시나리오 제거
- 마이그레이션 전, `user_id IS NULL`인 workers의 근태/연차 데이터를 확인
- 옵션 A: 해당 인력에게 계정 생성 후 `user_id` 연결 → 데이터 이관
- 옵션 B: 이력 데이터만 별도 아카이브 → workers 테이블은 DROP

### 6.2 이름 충돌

현재 `workers`는 이름 기준으로 role을 매핑하는 코드가 있다:
```typescript
// workers/page.tsx:962
pData.forEach((p: any) => {
  if (p.name) roleMap[p.name] = p.role;  // 이름 기준!
});
```

통합 후에는 `profiles.id` 기준으로 직접 접근하므로 이름 충돌 문제가 근본적으로 해결된다.

### 6.3 퇴사자 처리

현재 `workers.status = "inactive"`로 처리.
통합 후 `profiles.status = "disabled"` + 앱 접근 차단. 근태/연차 데이터는 `user_id` FK로 보존.

---

## 7. MVP 단계 최소 수정 (지금 적용 가능)

네이티브 전환 전까지, 현재 시스템에서 **방향에 맞는 최소 수정**만 적용한다.

### 7.1 display_name 컬럼 선행 추가

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
```

### 7.2 이름 동기화 로직

```typescript
// workers/page.tsx — 명부에서 이름 수정 시
const handleSave = async () => {
  // 기존: workers만 업데이트
  await supabase.from("workers").update({ name: formData.name, ... }).eq("id", editItem.id);
  
  // 추가: profiles.display_name도 동기화
  if (editItem.user_id) {
    await supabase.from("profiles")
      .update({ display_name: formData.name })
      .eq("id", editItem.user_id);
  }
};
```

### 7.3 팀원 페이지 표시 이름 변경

```typescript
// team/page.tsx — profiles 표시 시
// 현재: p.name || "-"
// 변경: p.display_name || p.name || "-"
```

이 3가지만 적용하면, 네이티브 전환 전에도 이름 불일치 문제가 해결되고, 전환 시 `display_name` 데이터가 이미 준비되어 있다.

---

## 8. 전환 타임라인

| 단계 | 시점 | 작업 |
|------|------|------|
| **MVP (지금)** | 즉시 | profiles에 display_name 추가 + 이름 동기화 코드 |
| **네이티브 설계** | 앱 개발 착수 시 | profiles 확장 스키마 최종 확정 |
| **마이그레이션** | 네이티브 앱 베타 전 | Phase A→B→C SQL 실행 + 코드 전환 |
| **정리** | 베타 검증 후 | workers 테이블 DROP |

---

## 9. 관련 문서

- 시스템 개발 가이드: `mrpark-system.md`
- 브랜드/회사 정보: `mrpark-core.md`
- 작업 로그: `TODO-20260224.md`
