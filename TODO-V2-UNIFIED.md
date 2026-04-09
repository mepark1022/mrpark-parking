# 📋 미팍 통합앱 v2 개발 추적 문서

> **작성일:** 2026.04.09
> **마지막 업데이트:** 2026.04.09
> **마지막 작업:** Part 1~5 완료 (API 기반구조 + DB SQL + Auth API + 권한헬퍼 + Employee API)
> **기획서 위치:** 프로젝트 지식 `미팍통합앱_신규기획서_v2.md`

---

## 🚨 새 대화 시작 시 필독

### 필수 명령어
```bash
git clone https://<PAT>@github.com/mepark1022/mrpark-parking.git
cd mrpark-parking
cat TODO-V2-UNIFIED.md
```

### 핵심 원칙
1. **기존 코드 절대 수정 금지** — 신규 코드는 `/api/v1/*`, `/v2/*`, `src/lib/api/*`에만 작성
2. **기존 URL 보호** — admin.mepark.kr, ticket.mepark.kr, mepark.kr 기존 라우팅 유지
3. **crew.mepark.kr** — 새 도메인, middleware.ts에 마지막에 추가 (Part 6에서)
4. **DB 변경** — SQL만 제공 → 대표님이 Supabase SQL Editor에서 실행 → 확인 후 ✅
5. **빌드 확인** — `npm run build` 성공 확인 후 push

### 현재 진행 상태

| Part | 내용 | 상태 | 비고 |
|------|------|------|------|
| **Part 1** | API v1 기반 구조 (타입, 미들웨어 헬퍼, 응답규격) | ✅ 완료 | af1efd1 |
| **Part 2** | DB 스키마 SQL (employees 확장, profiles 확장, audit_logs 등) | 🔸 SQL 실행 대기 | 코드 push 완료, Supabase 실행 필요 |
| **Part 3** | Auth API — 통합 로그인 + 비밀번호 시스템 | ✅ 코드 완료 | Part 2 SQL 실행 후 동작 |
| **Part 4** | 권한 미들웨어 보완 (helpers.ts: SELF헬퍼, audit, pagination, scope) | ✅ 완료 | (이번 push) |
| **Part 5** | Employee API 5라우트 (목록/상세/수정/삭제/퇴사/복직/일괄) | ✅ 완료 | (이번 push) |
| **Part 6** | middleware.ts 업데이트 (crew.mepark.kr 추가) | ⬜ 대기 | 가장 마지막 |
| **Part 7** | 연동 테스트 + 충돌 검증 | ⬜ 대기 | |

---

## 📁 신규 파일 맵 (Part별)

### Part 1 — API v1 기반 구조
```
src/lib/api/
├── types.ts              # API 응답 규격, 역할 타입, 권한 레벨
├── response.ts           # 성공/실패 응답 헬퍼 함수
├── auth-middleware.ts     # 토큰 검증 + 역할 확인 + 스코프 필터
├── errors.ts             # 에러 코드 체계 (AUTH_*, PERM_*, EMP_* 등)
└── password.ts           # 초기 비밀번호 생성 로직 (뒤4자리+12)
```

### Part 2 — DB 스키마
```
sql/v2/
├── 01-employees-table.sql       # employees 신규 테이블
├── 02-profiles-extension.sql    # profiles 컬럼 추가
├── 03-store-members.sql         # store_members 테이블
├── 04-audit-logs.sql            # audit_logs 테이블
└── 05-rls-policies.sql          # RLS 정책
```

### Part 3 — Auth API
```
src/app/api/v1/auth/
├── login/route.ts               # POST 통합 로그인 (이메일/사번/전화번호)
├── logout/route.ts              # POST 로그아웃
├── me/route.ts                  # GET 내 정보 / PUT 비밀번호 변경
├── create-account/route.ts      # POST 개별 계정 생성
├── bulk-create/route.ts         # POST 일괄 계정 생성
├── reset-password/[id]/route.ts # POST 비밀번호 초기화
├── ban/[id]/route.ts            # POST 계정 정지
└── unban/[id]/route.ts          # POST 정지 해제
```

### Part 4 — 권한 미들웨어 보완
```
src/lib/api/
├── helpers.ts             # SELF 권한 헬퍼, audit log, pagination, scope filter, validation
└── index.ts               # helpers export 추가
```

### Part 5 — Employee API
```
src/app/api/v1/employees/
├── route.ts                     # GET 목록 / POST 신규
├── [id]/route.ts                # GET 상세 / PUT 수정 / DELETE 논리삭제
├── [id]/resign/route.ts         # POST 퇴사 처리
├── [id]/reinstate/route.ts      # POST 복직
├── [id]/onboard/route.ts        # POST 입사 후속처리
└── bulk-import/route.ts         # POST Excel 일괄 등록
```

### Part 6 — Middleware 업데이트
```
src/middleware.ts                 # crew.mepark.kr 분기 추가 (1개 블록만)
```

---

## 🔗 기존 코드 ↔ 신규 코드 격리 확인

### 절대 수정하지 않는 기존 파일
| 파일 | 이유 |
|------|------|
| `src/app/api/team/*` | 기존 팀원관리 API (v1 대체 전까지 유지) |
| `src/app/api/alimtalk/*` | 기존 알림톡 API |
| `src/app/api/ticket/*` | 기존 티켓 API |
| `src/app/api/ocr/*` | 기존 OCR API |
| `src/app/crew/*` | 기존 CREW앱 페이지 전체 |
| `src/app/login/*` | 기존 로그인 페이지 |
| `src/app/dashboard/*` | 기존 대시보드 |
| `src/lib/supabase/*` | 기존 Supabase 클라이언트/미들웨어 |

### 신규 코드 영역 (이 안에서만 작업)
| 경로 | 용도 |
|------|------|
| `src/lib/api/*` | v2 API 유틸 (타입, 미들웨어, 헬퍼) |
| `src/app/api/v1/*` | v2 API 엔드포인트 전체 |
| `src/app/v2/*` | v2 UI 페이지 (추후) |
| `sql/v2/*` | v2 DB 마이그레이션 SQL |

---

## 🔑 비밀번호 시스템 체크리스트

| # | 항목 | 상태 | 검증 방법 |
|---|------|------|----------|
| 1 | 초기PW = 전화번호 뒤4자리 + "12" | ⬜ | 계정 생성 후 로그인 테스트 |
| 2 | 전화번호 없을 때 fallback = 사번 뒤4자리 + "12" | ⬜ | 전화번호 null 직원으로 테스트 |
| 3 | 6자 이상 (Supabase 최소 요건) 충족 | ⬜ | 4+2=6 확인 |
| 4 | 비밀번호 변경 → password_changed = true | ⬜ | 변경 후 profiles 확인 |
| 5 | 초기화 → password_changed = false | ⬜ | 초기화 후 profiles 확인 |
| 6 | 5회 실패 → 3분 잠금 | ⬜ | 연속 실패 테스트 |
| 7 | 퇴사자 로그인 차단 | ⬜ | 퇴사 처리 후 로그인 시도 |
| 8 | 정지 계정 로그인 차단 | ⬜ | ban 후 로그인 시도 |
| 9 | 이메일/사번/전화번호 자동 판별 | ⬜ | 3가지 형식 각각 테스트 |
| 10 | crew vs field_member 내부 이메일 분기 | ⬜ | @mepark.internal vs @field.mepark.internal |

---

## 📡 연동 포인트 검증 리스트

| # | 연동 | 기존 영향 | 상태 |
|---|------|----------|------|
| 1 | 신규 employees → 기존 workers 충돌 없음 | workers 테이블 그대로 유지, employees는 별도 | ⬜ |
| 2 | profiles 컬럼 추가 → 기존 로그인 영향 없음 | 새 컬럼은 NULL 허용, 기존 쿼리 불영향 | ⬜ |
| 3 | /api/v1/* → 기존 /api/* 충돌 없음 | 경로 완전 분리 | ⬜ |
| 4 | crew.mepark.kr → 기존 /crew/* 공존 | middleware에서 도메인별 분기 | ⬜ |
| 5 | 새 RLS 정책 → 기존 RLS 충돌 없음 | 새 테이블에만 적용 | ⬜ |
| 6 | npm build 성공 | 타입 에러 없음 | ⬜ |

---

## 📝 작업 로그

| 날짜 | Part | 작업 내용 | 결과 | 커밋 |
|------|------|----------|------|------|
| 2026.04.09 | Part 1 | API v1 기반 구조 (types, response, errors, password, auth-middleware, index) | ✅ | af1efd1 |
| 2026.04.09 | Part 2 | DB 스키마 SQL 4개 (employees, profiles확장, store_members, audit_logs) | 🔸 SQL 대기 | af1efd1 |
| 2026.04.09 | Part 3 | Auth API 7개 (login, logout, me, create-account, bulk-create, reset-password, ban, unban) | ✅ | (이번 push) |
| 2026.04.09 | Part 4 | 권한 미들웨어 보완 (helpers.ts: SELF헬퍼, audit log, pagination, scope filter, validation) | ✅ | (이번 push) |
| 2026.04.09 | Part 5 | Employee API 5라우트 (목록/상세/수정/삭제+퇴사/복직/일괄등록) | ✅ | (이번 push) |

---

## ⚙️ 환경 정보

| 항목 | 값 |
|------|---|
| GitHub | mepark1022/mrpark-parking |
| PAT | (메모리 참조 — 문서에 기록 금지) |
| Next.js | 16.1.6 |
| React | 19.2.3 |
| Supabase | @supabase/ssr 0.8, @supabase/supabase-js 2.95 |
| 배포 | Vercel (push시 자동 배포) |
| 도메인 | admin.mepark.kr / ticket.mepark.kr / mepark.kr / (신규) crew.mepark.kr |
