# 📋 미팍 통합앱 v2 개발 추적 문서

> **작성일:** 2026.04.09
> **마지막 업데이트:** 2026.04.13
> **마지막 작업:** Part 11B 근태 직접수정 CRUD + Export + 수정이력 + override 병합 완료 (SQL 07 실행 ✅)
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
| **Part 2** | DB 스키마 SQL (employees 확장, profiles 확장, audit_logs 등) | ✅ 완료 | Supabase 실행 완료 (2026.04.10) |
| **Part 3** | Auth API — 통합 로그인 + 비밀번호 시스템 | ✅ 코드 완료 | Part 2 SQL 실행 후 동작 |
| **Part 4** | 권한 미들웨어 보완 (helpers.ts: SELF헬퍼, audit, pagination, scope) | ✅ 완료 | (이번 push) |
| **Part 5** | Employee API 5라우트 (목록/상세/수정/삭제/퇴사/복직/일괄) | ✅ 완료 | (이번 push) |
| **Part 6** | middleware.ts 업데이트 (crew.mepark.kr 분기 추가) | ✅ 완료 | (이번 push) |
| **Part 7** | 연동 테스트 + 충돌 검증 (코드레벨) | ✅ 완료 | 6/7 통과, RLS는 SQL 실행 후 |
| **Part 8** | Store API (사업장 CRUD + 주차장 + 방문지) | ✅ 완료 | (이번 push) |
| **Part 9** | Ticket API — GET 목록/상세, PATCH 수동 상태변경(MANAGE) | ✅ 완료 | b5320bf |
| **Part 10A** | 현장일보 DB(4테이블) + 기본 CRUD 6엔드포인트 | ✅ 완료 | 4d9851e / SQL 실행 완료 ✅ |
| **Part 10B** | 현장일보 수정 API 4개 (staff/payment/unconfirm/history) | ✅ 완료 | 8678b40 |
| **Part 10C** | 현장일보 사진 업로드 + Excel 내보내기 | ✅ 완료 | 2d17fb8 / Storage 버킷 ✅ + RLS 4개 ✅ |
| **Part 11A** | 근태 조회 API 4개 (월매트릭스/개인/사업장/이상감지) + 판정 유틸 | ✅ 완료 | 5d1dc76 |
| **Part 11B** | 근태 직접수정 CRUD + Excel Export + 수정이력 + override 병합 | ✅ 완료 | f8a1317 / SQL 07 실행 완료 ✅ |

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
| 1 | 신규 employees → 기존 workers 충돌 없음 | v1 API에서 workers 참조 0건 확인 | ✅ |
| 2 | profiles 컬럼 추가 → 기존 로그인 영향 없음 | 새 컬럼 NULL 허용, 기존 코드에서 profiles 직접 참조 없음 | ✅ |
| 3 | /api/v1/* → 기존 /api/* 충돌 없음 | 경로 완전 분리 (api/ 하위에 v1/ 별도 디렉토리) | ✅ |
| 4 | crew.mepark.kr → 기존 /crew/* 공존 | middleware hostname 분기, mepark.kr의 /crew 경로도 유지 | ✅ |
| 5 | 새 RLS 정책 → 기존 RLS 충돌 없음 | employees, store_members, audit_logs 모두 RLS 적용 완료 | ✅ |
| 6 | npm build 성공 | ✅ Compiled successfully, 타입 에러 없음 | ✅ |
| 7 | UserRole 타입 충돌 없음 | database.ts(v1)과 api/types.ts(v2) 별도 모듈, import 경로 분리 | ✅ |

---

## 📝 작업 로그

| 날짜 | Part | 작업 내용 | 결과 | 커밋 |
|------|------|----------|------|------|
| 2026.04.09 | Part 1 | API v1 기반 구조 (types, response, errors, password, auth-middleware, index) | ✅ | af1efd1 |
| 2026.04.09 | Part 2 | DB 스키마 SQL 4개 (employees, profiles확장, store_members, audit_logs) | 🔸 SQL 대기 | af1efd1 |
| 2026.04.09 | Part 3 | Auth API 7개 (login, logout, me, create-account, bulk-create, reset-password, ban, unban) | ✅ | (이번 push) |
| 2026.04.09 | Part 4 | 권한 미들웨어 보완 (helpers.ts: SELF헬퍼, audit log, pagination, scope filter, validation) | ✅ | (이번 push) |
| 2026.04.09 | Part 5 | Employee API 5라우트 (목록/상세/수정/삭제+퇴사/복직/일괄등록) | ✅ | (이번 push) |
| 2026.04.09 | Part 6 | middleware.ts에 crew.mepark.kr 분기 추가 (API/CREW/v2/login 허용, 그 외 /crew 리다이렉트) | ✅ | (이번 push) |
| 2026.04.09 | Part 7 | 연동 테스트: workers충돌0, profiles호환, 경로분리, UserRole분리, 빌드성공 (RLS는 SQL 실행 후) | ✅ | (이번 push) |
| 2026.04.10 | Part 2 | SQL 4개 Supabase 실행 완료 (store_members는 기존 51건 보존, ALTER로 v2 컬럼 추가) | ✅ | — |
| 2026.04.10 | Part 8 | Store API 7라우트 (목록/등록/상세/수정/삭제/복구 + 주차장CRUD + 방문지CRUD), errors.ts STORE_/LOT_/PLACE_ 코드 추가, types.ts StoreRow/ParkingLotRow/VisitPlaceRow 추가, 빌드 성공 | ✅ | (이번 push) |
| 2026.04.10 | Part 9 | Ticket API — tickets/route.ts에 GET 목록 추가(8필터+페이지네이션, crew는 배정사업장 스코프), tickets/[id]/route.ts 신규(GET 상세 visit_places+stores JOIN / PATCH MANAGE 수동보정 9필드 화이트리스트+상태전환시 타임스탬프 자동셋+audit_logs 기록). types.ts ApiSuccess.meta에 page_size/total_pages 추가, helpers.ts paginationMeta가 계산하도록 시그니처 확장. 빌드 성공 | ✅ | (이번 push) |
| 2026.04.10 | Part 10A | 현장일보 DB 4테이블(daily_reports/staff/payment/extra) + RLS + updated_at 트리거 SQL, API 4파일 6엔드포인트: GET 목록(필터·스코프·페이지네이션) / POST 작성(staff·payment·extra 일괄 insert, 실패 시 master 롤백) / GET 상세(자식 병렬 JOIN) / PUT 수정(OPERATE 본인·당일·미확정 제약, MANAGE 예외) / PATCH confirm(audit 기록) / POST bulk-confirm(ids 또는 조건 기반). types.ts DailyReport* 4종 타입 추가, errors.ts REPORT_* 5코드 추가, index.ts export 추가. 빌드 성공 | 🔸 SQL 대기 | 4d9851e |
| 2026.04.10 | Part 10B | 현장일보 수정 API 4파일: PUT /:id/staff (기존 전체 삭제→재insert, audit 전체 before/after) / PUT /:id/payment (교체 + total_revenue/valet_count 자동 재계산 + audit) / PATCH /:id/unconfirm (status confirmed→submitted, confirmed_at/by null, audit) / GET /:id/history (audit_logs에서 daily_reports/staff/payment 3테이블 record_id=일보id 집계, 페이지네이션). 빌드 성공 8라우트 등록 확인 | ✅ | 8678b40 |
| 2026.04.10 | Part 10C | 현장일보 사진 업로드 + Excel 내보내기 2파일: POST /:id/images (multipart/form-data, OPERATE + canAccessStore, confirmed는 MANAGE만, 파일검증 20개·10MB·jpeg/png/webp/heic, Storage 'daily-report-photos' 버킷 {org_id}/{report_id}/{ts}_{i}.{ext} 업로드, daily_report_extra category='photo' 일괄 insert, insert 실패 시 Storage 롤백, audit 기록) / GET /export (MANAGE, date_from/date_to 필수·store_id 선택, reports+staff(employees JOIN)+payment 조회, XLSX 3시트 '일보요약'/'근무인원'/'결제매출' 한글 헤더+enum 한글변환, 빈 데이터도 헤더행 보장, Content-Disposition attachment). 빌드 성공 10라우트 등록 확인 | ✅ Storage 버킷+10A SQL 완료 (2026.04.13) | 2d17fb8 |
| 2026.04.13 | Part 11A | 근태 조회 API 5파일: src/lib/api/attendance.ts (판정 유틸: staff_type→8종 매핑, regular+타사업장→support 자동감지, 지각 판정 LATE_THRESHOLD='09:30:00', mergeByPriority 우선순위 병합 출근>피크>지원>추가, isInEmploymentPeriod hire_date/resign_date 범위 체크, buildSummary 월집계 평일/주말/추가/피크/지원/공휴/지각/결근/연차/휴무/합계/총근무시간, monthRange/validateYearMonth 헬퍼) / GET /api/v1/attendance (SELF, year+month+store_id?, crew/field는 ctx.employeeId만, employees+store_members(primary)+daily_reports+daily_report_staff JOIN, 매트릭스 {emp_id:{date:row}} + summary) / GET /attendance/personal/:empId (SELF+canAccessSelfOrManage, employee+rows+summary+store_distribution+hours_stats avg/max/min/total) / GET /attendance/site/:storeId (MANAGE, submission{submitted/total/rate/missing_dates}+employees{is_primary_here,days,late_count,support_count,by_status}+daily_headcount+stats) / GET /attendance/anomaly (MANAGE, 7종 감지: MISSING_REPORT/ZERO_STAFF/DUPLICATE_STORE/LATE/NO_CHECKOUT/LONG_HOURS>12h/ABNORMAL_HOURS≤0, 각 타입 최대 100건). 빌드 성공 4라우트 등록 확인 (/api/v1/attendance, /anomaly, /personal/[empId], /site/[storeId]) | ✅ 완료 | 5d1dc76 |
| 2026.04.13 | Part 11B | 근태 직접수정 CRUD + Excel Export + 수정이력 + override 병합. SQL 신규 sql/v2/07-attendance-overrides.sql (attendance_overrides 테이블: org_id+employee_id+work_date UNIQUE, status 8종 CHECK, store_id/check_in/out/work_hours/reason/memo/created_by/updated_by, 인덱스 3개 org+date/emp+date/store+date, updated_at 트리거, RLS 4개 SELECT(MANAGE 전체/SELF 본인만)/INSERT·UPDATE·DELETE(MANAGE만) TO anon,authenticated 명시). attendance.ts 확장: AttendanceOverrideRow 타입 + applyOverrides(matrix,overrides,empMeta,storeNameMap) 매트릭스에 override 덮어쓰기(얕은복제·override-only store_id는 상위에서 stores 별도조회해 storeNameMap 주입) + isValidAttendanceStatus/normalizeTime(HH:MM→HH:MM:SS)/isValidDate 검증유틸. errors.ts ATT_DUPLICATE_OVERRIDE 코드 추가. POST·PUT·DELETE /api/v1/attendance/:empId/:date (MANAGE, normalizeInput 공통검증 status+time+work_hours 0~24, POST 중복체크 후 insert→created() 201, PUT upsert 있으면 update 없으면 insert+created(), DELETE 있으면 삭제 없으면 404, 모두 audit_logs 기록 insert/update/delete). GET /api/v1/attendance/export (MANAGE, year+month+store_id?, XLSX 3시트 월매트릭스(직원×일자 상태코드 출/지/피/지원/추/연차/휴/결 + 집계컬럼)·월집계(직원별 요약)·상세(일자별 덤프 오버라이드여부·수정사유·메모 포함), daily_reports+override 병합, override-only store_id는 stores 별도조회, sendXlsx 헬퍼). GET /api/v1/attendance/edit-history (MANAGE, emp_id+date_from+date_to+action+page+limit, audit_logs에서 table_name='attendance_overrides' 조회 후 after_data/before_data JSON에서 employee_id·work_date 메모리 필터, employees+profiles JOIN으로 emp_no·name·changed_by_name 포함, paginationMeta). 기존 route.ts+personal/:empId 수정: applyOverrides 병합 추가(storeNameMap 수집→override-only store_id stores 조회→empMeta 맵→applyOverrides), summary는 병합 후 일괄 재계산으로 변경(buildSummary를 루프 밖으로). site/:storeId는 집계 구조 다름으로 미반영(Part 11C 이월). 빌드 성공 7라우트 등록 확인 (/api/v1/attendance, /[empId]/[date], /anomaly, /edit-history, /export, /personal/[empId], /site/[storeId]) | ✅ 완료 (SQL 07 실행 완료 2026.04.13) | f8a1317 |

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
