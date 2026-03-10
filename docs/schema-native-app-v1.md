# ME.PARK 네이티브 앱 — 스키마 재설계 v1.1

> 작성일: 2026.03.10
> 목적: `workers` + `invitations` 테이블 제거 → `profiles` 단일 진실 소스(SSOT) 전환
> 적용 시점: 네이티브 앱 전환 시 (Phase 2)
> v1.1 변경: 카카오 로그인 제거, 이메일 초대 제거 반영

---

## 1. 운영 정책 변경 (2026.03.10 확정)

### 1.1 인증 방식 변경

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 로그인 | 카카오 OAuth | Supabase email/password |
| 계정 생성 | 이메일 초대 → 크루 수락 | **어드민이 직접 ID/비번 부여** |
| 이름 입력 | 카카오 닉네임 자동 | **어드민이 실명 직접 입력** |
| 초대 방식 | Resend 이메일 발송 | **비밀번호 전달 (구두/메신저)** |

### 1.2 제거 대상

| 항목 | 이유 |
|------|------|
| 카카오 OAuth 전체 | 어드민 ID/비번 부여로 대체 |
| `invitations` 테이블 | 이메일 초대 플로우 제거 |
| Resend 이메일 연동 | 초대 이메일 불필요 |
| `auth/callback/route.ts` (카카오) | OAuth 콜백 불필요 |
| `display_name` 컬럼 | 카카오 닉네임 문제 소멸 → `profiles.name` = 실명 |

### 1.3 이 변경으로 해결되는 문제

- **이름 이중관리 근본 해결:** 카카오 닉네임("jmh0310") 유입 경로 자체가 없음
- **`profiles.name` = 어드민이 입력한 실명** → 모든 화면에서 동일 이름 표시
- **초대 → 수락 → 가입 3단계가 → 어드민 계정생성 1단계로 축소**
- **운영 리스크 감소:** 크루가 초대 메일 미확인, 카카오 계정 문제 등 제거

---

## 2. 현재 구조 진단

### 2.1 이중 관리 문제 (여전히 존재)

카카오 로그인은 제거했지만, `workers`와 `profiles` 테이블 분리는 남아있다.

| 항목 | profiles | workers |
|------|----------|---------|
| 이름 | 어드민 입력 실명 | 어드민 입력 실명 (별도 저장) |
| 연락처 | ❌ 없음 | phone |
| 상태 | status (active/pending/disabled) | status (active/inactive) |
| 조직 | org_id | org_id |
| 연결 키 | id (= auth.users.id) | user_id → profiles.id |

**현재 문제:**
- 같은 실명이 두 테이블에 중복 저장
- `/team`은 `profiles.name`, `/workers`는 `workers.name` — 한쪽 수정 시 다른 쪽 미반영
- MVP 임시 조치로 `display_name` 동기화 코드 추가했으나, 근본적으로 테이블이 분리되어 있는 한 동기화 누락 가능

### 2.2 현재 workers 테이블 컬럼

```
workers
├── id          uuid PK
├── org_id      uuid FK → organizations
├── user_id     uuid FK → auth.users (nullable)
├── name        text
├── phone       text | null
├── status      active | inactive
├── region_id   uuid | null FK → regions
├── district    text | null
├── hire_date   date | null
├── daily_wage  int | null
├── created_at  timestamptz
```

### 2.3 worker_id를 FK로 참조하는 테이블 (7개)

| 테이블 | FK 컬럼 | 용도 |
|--------|---------|------|
| worker_attendance | worker_id | 출퇴근 기록 |
| worker_assignments | worker_id | 일일 근무자 배정 |
| worker_leaves | worker_id | 연차 총계 |
| worker_leave_records | worker_id | 연차 사용 기록 |
| worker_reviews | worker_id | 근무 리뷰 |
| worker_reports | worker_id | 시말서 |
| store_default_workers | worker_id | 매장별 기본 근무자 |

### 2.4 제거 대상 테이블

| 테이블 | 이유 |
|--------|------|
| `workers` | profiles로 흡수 |
| `invitations` | 이메일 초대 제거 |

---

## 3. 목표 구조 (네이티브 앱)

### 3.1 설계 원칙

1. **profiles = 유일한 사용자 테이블** — 모든 사용자 정보의 SSOT
2. **workers, invitations 테이블 완전 제거**
3. **모든 FK를 user_id (= profiles.id) 기준으로 통일**
4. **인증 = Supabase email/password** — 어드민이 계정 생성 + ID/비번 부여
5. **네이티브 앱 = 전원 계정 보유** → "계정 미연결 근무자" 시나리오 제거

### 3.2 확장된 profiles 스키마

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_wage int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

### 3.3 확장된 profiles 전체 스키마

```
profiles (확장 후 — 최종 형태)
├── id              uuid PK (= auth.users.id)
├── org_id          uuid FK → organizations
├── email           text NOT NULL          ← 로그인 ID
├── name            text NOT NULL          ← 어드민이 입력한 실명
├── role            super_admin | admin | crew
├── status          active | pending | disabled
├── phone           text | null            ← workers에서 흡수
├── region_id       uuid | null            ← workers에서 흡수
├── district        text | null            ← workers에서 흡수
├── hire_date       date | null            ← workers에서 흡수
├── daily_wage      int DEFAULT 0          ← workers에서 흡수
├── created_at      timestamptz
├── updated_at      timestamptz
```

**이름 정책:** `profiles.name` = 어드민이 입력한 실명. 끝. display_name 불필요.

### 3.4 계정 생성 플로우 (어드민)

```
어드민 → "크루 추가" 클릭
→ 실명, 이메일(ID), 비밀번호, 역할, 매장 배정 입력
→ Supabase auth.admin.createUser() 호출
→ profiles 레코드 자동 생성 (name = 입력한 실명)
→ store_members 배정
→ 어드민이 크루에게 ID/비번 전달
```

기존 `/team` 페이지의 "이메일 & 비밀번호 계정 생성" 기능을 확장하되, 초대/수락 플로우는 제거.

### 3.5 store_members (변경 없음)

```
store_members
├── user_id   → profiles.id  ← 이미 profiles 기준
├── store_id  → stores.id
├── org_id    → organizations.id
```

---

## 4. FK 전환 맵핑

### 4.1 테이블별 전환

모든 `worker_id` → `user_id` (= profiles.id)

| 테이블 | 현재 FK | 전환 후 FK |
|--------|---------|-----------|
| worker_attendance | worker_id → workers.id | user_id → profiles.id |
| worker_assignments | worker_id → workers.id | user_id → profiles.id |
| worker_leaves | worker_id → workers.id | user_id → profiles.id |
| worker_leave_records | worker_id → workers.id | user_id → profiles.id |
| worker_reviews | worker_id → workers.id | user_id → profiles.id |
| worker_reports | worker_id → workers.id | user_id → profiles.id |
| store_default_workers | worker_id → workers.id | user_id → profiles.id |

---

## 5. 마이그레이션 SQL

### 5.1 Phase A: profiles 확장 + 데이터 이관

```sql
-- Step 1: profiles 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_wage int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: workers → profiles 데이터 이관
UPDATE profiles p SET
  name = COALESCE(w.name, p.name),
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

### 5.2 Phase B: FK 전환

```sql
-- worker_attendance
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);
UPDATE worker_attendance wa SET user_id = w.user_id
FROM workers w WHERE wa.worker_id = w.id AND w.user_id IS NOT NULL;

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

### 5.3 Phase C: 검증 + 정리

```sql
-- 검증: user_id NULL인 레코드 확인
SELECT 'worker_attendance' AS tbl, COUNT(*) FROM worker_attendance WHERE user_id IS NULL
UNION ALL SELECT 'worker_leaves', COUNT(*) FROM worker_leaves WHERE user_id IS NULL
UNION ALL SELECT 'worker_leave_records', COUNT(*) FROM worker_leave_records WHERE user_id IS NULL
UNION ALL SELECT 'worker_assignments', COUNT(*) FROM worker_assignments WHERE user_id IS NULL
UNION ALL SELECT 'worker_reviews', COUNT(*) FROM worker_reviews WHERE user_id IS NULL
UNION ALL SELECT 'worker_reports', COUNT(*) FROM worker_reports WHERE user_id IS NULL
UNION ALL SELECT 'store_default_workers', COUNT(*) FROM store_default_workers WHERE user_id IS NULL;

-- NULL 0건 확인 후 정리
-- ALTER TABLE worker_attendance DROP COLUMN worker_id;
-- (각 테이블 동일)
-- DROP TABLE workers;
-- DROP TABLE invitations;

-- display_name 컬럼 정리 (불필요)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS display_name;
```

---

## 6. 코드 변경 영향 범위

### 6.1 제거할 파일/기능

| 파일/기능 | 이유 |
|-----------|------|
| 카카오 OAuth 관련 코드 | 로그인 방식 변경 |
| `auth/callback/route.ts` (카카오 부분) | OAuth 콜백 불필요 |
| `/api/invite/route.ts` | 이메일 초대 제거 |
| `invite/accept/page.tsx` | 초대 수락 페이지 불필요 |
| Resend 패키지/설정 | 이메일 발송 불필요 |
| `/team` 초대 내역 섹션 | invitations 테이블 제거 |
| CREW 앱 `workers` 자동 생성 로직 | workers 테이블 제거 |
| `display_name` 동기화 코드 | display_name 컬럼 제거 |

### 6.2 수정할 파일

| 파일 | 현재 | 변경 후 |
|------|------|---------|
| `/app/team/page.tsx` | 초대+크루목록+매장배정 | **계정생성+크루목록+매장배정** (초대 섹션 제거) |
| `/app/workers/page.tsx` (명부) | `workers` CRUD | `profiles` 직접 CRUD |
| `/app/workers/page.tsx` (출퇴근) | `worker_id`로 조회 | `user_id` (profiles.id)로 조회 |
| `/app/workers/page.tsx` (근태) | `worker_id` 매트릭스 | `user_id` 매트릭스 |
| `/app/workers/LeaveTab.tsx` | workers + worker_leaves 조인 | profiles + worker_leaves 조인 |
| `/app/workers/ReviewTab.tsx` | `workers.select("id, name")` | `profiles.select("id, name")` |
| `/app/workers/ReportTab.tsx` | `workers.select("id, name")` | `profiles.select("id, name")` |
| `/app/crew/attendance/page.tsx` | workers 자동 생성 | **제거** (profiles.id 직접 사용) |
| `/app/crew/page.tsx` | workers 자동 생성 | **제거** |
| `/app/dashboard/page.tsx` | `workers.select(count)` | `profiles.select(count).eq("role","crew")` |
| `/app/login/page.tsx` | 카카오 로그인 버튼 | **이메일/비밀번호 로그인만** |
| `/lib/types/database.ts` | Worker 타입 | **제거**, Profile 타입 확장 |

### 6.3 `/team` 페이지 재설계

```
변경 전:
├── 관리자 섹션 (super_admin, admin)
├── 매장별 CREW
├── 초대 내역 (invitations)
└── 초대 모달 (이메일 발송)

변경 후:
├── 관리자 섹션
├── 매장별 CREW  
├── 크루 추가 모달 (어드민이 직접 계정 생성)
│   ├── 이름 (실명) 입력
│   ├── 이메일 (로그인 ID) 입력
│   ├── 비밀번호 입력/자동생성
│   ├── 역할 선택 (crew/admin)
│   ├── 매장 배정 (복수 선택)
│   └── 생성 → ID/비번 표시 (복사 버튼)
└── 매장 배정 변경 모달 (기존 유지)
```

### 6.4 로그인 페이지 재설계

```
변경 전:
├── 카카오 로그인 버튼
└── (카카오 OAuth → callback → 프로필 생성 → 리다이렉트)

변경 후:
├── 이메일 입력
├── 비밀번호 입력
├── 로그인 버튼
└── (Supabase signInWithPassword → 리다이렉트)
```

---

## 7. 헬퍼 함수

### 7.1 이름 표시 (단순화)

```typescript
// 변경 전: display_name || name || email
// 변경 후:
function getDisplayName(profile: { name: string; email: string }): string {
  return profile.name || profile.email;
}
```

### 7.2 계정 생성 (어드민용)

```typescript
// /api/team/create/route.ts
import { createClient } from '@supabase/supabase-admin';

export async function POST(req: NextRequest) {
  const { email, password, name, role, storeIds, orgId } = await req.json();
  
  // 1. Supabase Auth 계정 생성
  const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // 이메일 인증 스킵
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // 2. profiles 업데이트 (trigger로 자동 생성된 row에 추가 정보)
  await supabaseAdmin.from("profiles").update({
    name,
    role,
    org_id: orgId,
    status: "active",
  }).eq("id", authData.user.id);
  
  // 3. 매장 배정
  if (storeIds?.length) {
    await supabaseAdmin.from("store_members").insert(
      storeIds.map(sid => ({ user_id: authData.user.id, store_id: sid, org_id: orgId }))
    );
  }
  
  return NextResponse.json({ success: true, userId: authData.user.id });
}
```

---

## 8. 엣지 케이스 처리

### 8.1 계정 미연결 근무자 (기존 데이터)

마이그레이션 시 `workers.user_id IS NULL`인 레코드의 근태/연차 데이터 처리:
- **옵션 A:** 해당 인력에게 계정 생성 후 연결 → 데이터 이관
- **옵션 B:** 이력 데이터만 아카이브 테이블로 이동 → workers DROP

### 8.2 이름 기준 role 매핑 (레거시 코드)

현재 `workers/page.tsx`에 이름 기준으로 role을 매핑하는 코드가 있다:
```typescript
pData.forEach((p) => {
  if (p.name) roleMap[p.name] = p.role;  // 이름 충돌 위험
});
```
통합 후 `profiles.id` 기준으로 직접 접근하므로 이 문제가 근본적으로 해결된다.

### 8.3 퇴사자 처리

`profiles.status = "disabled"` + 앱 접근 차단. 근태/연차 데이터는 `user_id` FK로 보존.

---

## 9. 전환 타임라인

| 단계 | 시점 | 작업 |
|------|------|------|
| **MVP (현재)** | 완료 | display_name 동기화 (임시 조치) |
| **카카오/초대 제거** | 네이티브 설계 시 | 로그인 페이지 → email/pw만, 초대 → 어드민 직접 생성 |
| **스키마 마이그레이션** | 네이티브 베타 전 | Phase A→B→C SQL 실행 |
| **코드 전환** | 마이그레이션 직후 | workers → profiles 참조 변경 (파일 12개) |
| **정리** | 베타 검증 후 | workers, invitations DROP + display_name 제거 |

---

## 10. 정리: 최종 제거 목록

### 테이블
- `workers` → profiles로 흡수
- `invitations` → 어드민 직접 생성으로 대체

### 컬럼
- `profiles.display_name` → name이 곧 실명 (불필요)

### 코드/패키지
- 카카오 OAuth 관련 전체
- Resend 이메일 패키지
- `/api/invite/route.ts`
- `invite/accept/page.tsx`
- CREW 앱 workers 자동 생성 로직

### 환경변수
- 카카오 관련 키 (KAKAO_CLIENT_ID 등)
- Resend API 키

---

## 관련 문서

- 시스템 개발 가이드: `mrpark-system.md`
- 브랜드/회사 정보: `mrpark-core.md`
- 작업 로그: `TODO-20260224.md`
