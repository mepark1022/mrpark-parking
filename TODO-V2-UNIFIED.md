# 📋 미팍 통합앱 v2 개발 추적 문서

> **작성일:** 2026.04.09
> **마지막 업데이트:** 2026.04.14
> **마지막 작업:** Part 18A — 월주차 알림톡 v2 훅 (renew → renewal_complete + monthly-expire 크론 + SQL 12 플래그)
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
| **Part 11C** | site/:storeId override 병합 (11 시리즈 마감) | ✅ 완료 | (이번 push) |
| **Part 12A** | 근태 UI (매트릭스 조회 + 필터 + Excel Export) | ✅ 완료 | (이번 push) |
| **Part 12B** | 근태 UI (직접수정 모달 + 수정이력 Drawer) | ✅ 완료 | (이번 push) |
| **Part 14A** | tenants 신규 + monthly_parking 확장 (tenant_id, renewed_from_id) | ✅ 완료 | SQL 실행 완료 ✅ 2026.04.13 |
| **Part 14B** | 입주사 API CRUD 5엔드포인트 (목록/등록/상세/수정/삭제) | ✅ 완료 | (이번 push) |
| **Part 13A** | 현장일보 v2 UI — 목록 페이지 (필터+일괄확정+Excel) | ✅ 완료 | b4b2e7f |
| **Part 13B** | 현장일보 v2 UI — 작성 페이지 (기본정보+근무인원+결제매출) | ✅ 완료 | fa05b01 |
| **Part 13C** | 현장일보 v2 UI — 상세+수정+확정/해제+사진+이력 (13 시리즈 마감) | ✅ 완료 | (이번 push) |
| **Part 15A** | 월주차 v2 UI — 목록 페이지 (필터+만료임박 D-N+카드리스트+페이지네이션) | ✅ 완료 | 659e29e |
| **Part 15B** | 월주차 v2 UI — 등록 페이지 (사업장+입주사+11필드+자동계산) | ✅ 완료 | 742e155 |
| **Part 15C** | 월주차 v2 UI — 상세+수정+갱신+취소 (15 시리즈 마감) | ✅ 완료 | 3876b35 |
| **Part 16A** | 입주사 v2 UI — 목록 + 신규 등록 모달 (TenantFormModal 공용) | ✅ 완료 | 618faa8 |
| **Part 16B** | 입주사 v2 UI — 상세+수정+활성화토글+영구삭제+활성계약목록 (16 시리즈 마감) | ✅ 완료 | 0d0f8da |
| **Part 17A** | 통계 API 5개 (overview/by-store/by-tenant/by-payment-method/daily-trend) + stats.ts 유틸 | ✅ 완료 | 813abac |
| **Part 17B** | 대시보드 UI `/v2/dashboard` — KPI 4카드 + 추이차트(ComposedChart) + 결제수단 도넛 + 사업장/입주사 테이블 (17 시리즈 마감) | ✅ 완료 | (이번 push) |
| **Part 18A** | 월주차 알림톡 v2 훅 — renew API에 renewal_complete 발송 + monthly-expire 크론 신설 + SQL 12 (플래그 컬럼) | ✅ 완료 | (이번 push) / SQL 12 실행 필요 🔸 |

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
| 2026.04.13 | Part 11C | site/:storeId override 병합으로 11 시리즈 전체 완료. 집계 구조 재작성: 기존은 일보 루프 내에서 empAgg 직접 누적이었으나 applyOverrides 사용을 위해 ① 일보 → matrix[empId][date] 빌드 → ② 이 사업장으로 배정된 override의 employee_id도 수집(empIdsFromOverrides) → ③ 리포트+override 직원 union에 대해 "이 기간 모든 override" 일괄 조회 → ④ override-only 직원 employees/store 메타 보충 조회 → ⑤ applyOverrides 병합 → ⑥ 병합된 matrix 전체 순회 후 row.store_id === storeId 필터로만 집계(days/total_hours/late/support/by_status/dailyHeadcount). 타사업장으로 옮겨진 날 자동 제외, 이 사업장으로 들어온 날 자동 포함. submission.submitted_days/missing_dates는 daily_reports 원본 기준 유지(override 무관). anomaly는 원본 입력 이상 탐지 용도로 override 미적용 유지(설계). 응답에 override_applied 카운트 추가. 빌드 성공 7라우트 유지 | ✅ 완료 | (이번 push) |
| 2026.04.13 | Part 12A | 근태 UI 첫 v2 페이지 4파일 신규. src/app/v2/layout.tsx (기존 AppLayout 재사용 래퍼, Sidebar 240px + MobileTabBar 그대로 사용) / src/app/v2/attendance/page.tsx (년/월/사업장 필터 + 조회 버튼 + 상태 범례 8종 + Excel 버튼, 쿠키세션 credentials:'include' fetch, /api/v1/stores?limit=200 드롭다운, /api/v1/attendance?year&month&store_id GET, 에러/로딩 상태, 셀클릭 핸들러는 12B용 콘솔만) / src/app/v2/attendance/AttendanceMatrix.tsx (직원×일자 매트릭스 테이블, 좌측 직원/주사업장 컬럼 sticky left, 상단 일자 sticky top, 8종 STATUS_STYLE 컬러 뱃지 출/지/피/지원/추/연차/휴/결, 주말 배경 분리, is_override 시 border+골드 닷 표시, 우측 집계 6컬럼 출근/지각/연차/휴무/결근/시간, 스크롤 컨테이너 maxHeight calc(100vh-280px), title hover에 시간·사업장·수정여부 표시) / src/app/v2/attendance/ExportButton.tsx (GET /api/v1/attendance/export credentials:'include' blob 받아 a.download, 파일명 근태_YYYY-MM[_사업장].xlsx). middleware.ts는 /v2/* 기존 분기 그대로 동작, admin.mepark.kr catch-all로도 접근 가능. 빌드 성공 /v2/attendance 라우트 등록 확인(○ static prerender) | ✅ 완료 | e468adc |
| 2026.04.13 | Part 12B | 근태 UI 직접수정 + 수정이력 2파일 신규 + page.tsx 연결. src/app/v2/attendance/OverrideModal.tsx (셀클릭 오픈 모달, 8종 상태 버튼 그리드 4x2 active 시 해당 컬러 테두리, 사업장 드롭다운, 출/퇴근 time 2컬럼, 근무시간 number step 0.5, 수정사유 필수 input, 메모 textarea, PUT /api/v1/attendance/:empId/:date upsert 단일라우트 사용 — 신규/수정 구분 없이 PUT idempotent, is_override=true일 때만 "🔄 원본 복구" 버튼 DELETE 호출, 저장 성공 시 onSaved() → loadAttendance() 재조회, toHHMM 유틸 HH:MM:SS→HH:MM 변환) / src/app/v2/attendance/HistoryDrawer.tsx (우측 슬라이드 640px, GET /api/v1/attendance/edit-history?date_from&date_to&action&page&limit=20, ACTION_STYLE insert=신규 초록/update=수정 파랑/delete=삭제 빨강 뱃지, diffSummary 유틸 before_data→after_data 5필드 status/store_id/check_in/check_out/work_hours 비교해 "상태: 출근 → 지각" 형태 한글 라벨 요약, 사유 배지, 수정자 이름+ISO 로컬시간 포맷, 페이지네이션 이전/다음 버튼 meta.total_pages 기반). page.tsx 업데이트: OverrideModal/HistoryDrawer import, modalOpen/modalEmpId/modalEmpName/modalDate/modalRow/historyOpen 6 state 추가, handleCellClick이 employees에서 name 찾아 모달 오픈, 헤더 오른쪽 "📝 수정이력" 버튼 추가(골드 테두리+네이비 글씨), onSaved에 loadAttendance 연결. 빌드 성공 /v2/attendance 라우트 유지 | ✅ 완료 | (이번 push) |
| 2026.04.13 | Part 12 패치 | Part 12 코드리뷰 후 의심 3건 중 2건 선제 수정. **#1 z-index 충돌**: AttendanceMatrix 좌상단 교차 sticky 셀에서 좌측 fixed body cell(z=2)이 상단 일반 header(z=2)와 동률이라 가로 스크롤 시 헤더가 가려질 수 있던 문제 → 일반 header z=3, 좌상단 고정 header z=5로 재정렬(주석으로 계층 명시). **#2 PUT idempotent**: [empId]/[date] route.ts 직접 확인 결과 진짜 upsert(existing 있으면 update, 없으면 insert)로 구현되어 있어 실제 버그 아님 → 패치 없음. **#3 HistoryDrawer 더블페치**: open false→true 시 load() useEffect와 setPage(1) useEffect가 동시 트리거되어 이전 page 값으로 1차 fetch + page=1 reset으로 2차 fetch 발생 가능 → page.tsx에서 `{historyOpen && <HistoryDrawer .../>}` conditional render로 변경(unmount 시 state 완전 초기화) + HistoryDrawer 내부 `useEffect setPage(1)` 제거(useState 초기값 1로 자연 시작). 빌드 성공 76s/79 페이지, /v2/attendance 라우트 유지 | ✅ 완료 | 1058866 |
| 2026.04.13 | Part 14A | 입주사+월주차 v2 SQL 신규. sql/v2/08-tenants-monthly-v2.sql: ① **tenants 테이블 신규** — id/org_id/name/business_no/contact_name/**contact_phone(평문 — 월주차 정책 예외)**/default_store_id/monthly_fee_default/status(active|inactive)/memo/usage_count/last_contracted_at/created_at·by/updated_at·by, 인덱스 3개(org+status, org+name, org+usage_count DESC+last_contracted_at DESC 자동완성 정렬용), 전용 set_tenants_updated_at 트리거. ② **monthly_parking ALTER ADD** — tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL(nullable로 기존 row 호환), renewed_from_id uuid REFERENCES monthly_parking(id) ON DELETE SET NULL(갱신 추적용 self-ref), 인덱스 2개. ③ **RLS 4개** — SELECT: 같은 org_id 모든 역할 / INSERT·UPDATE: MANAGE(super_admin·admin) / DELETE: super_admin만(soft delete = status='inactive' 권장). 모든 정책 TO anon, authenticated 명시. 정책 결정 사유: 월주차는 D-7 만료 알림톡/갱신 안내/비상 연락 모두 원본 번호 필수 → 마스킹만으로 운영 불가. 운영 보완책 4건은 별도 추후 작업(이용약관 갱신·만료 자동삭제 cron·role 기반 마스킹 분기 API·내부자 감사로그). 코드 변경 없음, 빌드 성공 68s | ✅ 완료 (SQL 5조각 분할 실행 완료 2026.04.13) | b32ac38 |
| 2026.04.13 | Part 14B | 입주사 API CRUD 5엔드포인트. errors.ts에 TENANT_NOT_FOUND/TENANT_DUPLICATE_NAME/TENANT_HAS_ACTIVE_CONTRACTS 3개 코드 추가. **/api/v1/tenants/route.ts** (목록/등록): GET ?search(name/contact_name ilike)+status(active 기본/inactive/all)+sort(usage 기본=usage_count DESC+last_contracted_at DESC 자동완성용/name/recent)+page+limit, paginationMeta. POST 필수 name 검증+같은 org active 내 이름 중복 체크(409 TENANT_DUPLICATE_NAME)+monthly_fee_default 0 이상 숫자 검증, business_no/contact_name/contact_phone/default_store_id/memo trim 후 null 변환, usage_count=0/last_contracted_at=null 초기화, audit_logs insert 기록, 201 created. **/api/v1/tenants/[id]/route.ts** (상세/수정/삭제): GET 존재확인+활성 월주차 카운트 join({...data, active_contract_count}). PATCH 화이트리스트 필드만(name/business_no/contact_name/contact_phone/default_store_id/monthly_fee_default/memo/status), name 변경 시 자기제외 중복체크, status는 active|inactive만 허용, 빈 update 차단, audit_logs update 기록. DELETE 기본 soft(status='inactive', 이미 inactive면 멱등 응답) / ?hard=true 시 활성 월주차 카운트 확인 후 0건일 때만 진짜 delete(409 TENANT_HAS_ACTIVE_CONTRACTS)·super_admin RLS 강제. 빌드 성공 109s, /api/v1/tenants + /api/v1/tenants/[id] 2라우트 등록 확인 | ✅ 완료 | (이번 push) |
| 2026.04.13 | 타입정리 | **TS strict 정상화 — @ts-nocheck 8건 제거 + unused import 6건 정리.** ① `src/lib/types/database.ts`를 `src/lib/database.types.ts`(Supabase CLI 자동생성) re-export 단일라인으로 교체(Database/Json/Tables/TablesInsert/TablesUpdate/Enums/CompositeTypes). ② @ts-nocheck 제거: src/lib/supabase/{client,server,middleware}.ts (middleware는 `createServerClient<Database>` 제네릭 적용) + src/app/api/v1/tenants/{route,[id]/route}.ts + src/app/api/v1/monthly/{route,[id]/route,[id]/renew/route}.ts. ③ unused import 제거: tickets/[id]/complete(badRequest), tickets/active(badRequest+ErrorCodes), lib/api/auth-middleware(ErrorCodes), lib/api/helpers(ErrorCodes), monthly/[id]/renew(ok), monthly/route(notFound). 빌드 성공 73s/81 페이지, 라우트 변경 없음 | ✅ 완료 | 6be7dee |
| 2026.04.13 | 타입정리2 | **TS strict 점진 정리(2차) — 자동생성 타입이 폭로한 진짜 스키마 불일치 발견 + 안전 수정 + DB 컬럼 추가 결정.** ① **버그 발견**: stores 테이블에 `site_code` 컬럼 없음(stores/[id], stores/assigned에서 사용 중 — 런타임 500) / mepark_tickets에 `exit_requested_at`+`completed_at` 없음(tickets/[id] PATCH 상태전환 자동 타임스탬프 셋 미동작) / audit_logs에 `created_at` 없음 — `changed_at`만 존재(attendance/edit-history에서 사용 — 런타임 500) / daily_reports·tenants 등 v2 테이블 자체가 자동생성 타입에 누락(SQL 실행됐으나 타입 재생성 미실행 — ~110건 cascading SelectQueryError 원인). ② **결정**: stores.site_code → SQL ALTER 추가(원래 설계 의도) / tickets 두 타임스탬프 → SQL ALTER 추가(워크플로우 5단계 분리·정산리포트 데이터 풍부함). ③ **신규 SQL 2개**: sql/v2/09-stores-add-site-code.sql(컬럼 + org_id+site_code UNIQUE 부분인덱스) / sql/v2/10-tickets-add-timestamps.sql(2컬럼 + completed_at·exit_requested_at 각 부분인덱스). ④ **database.types.ts 선반영 패치**(SQL 실행 전 TS 에러 즉시 해소): stores Row/Insert/Update에 site_code 추가, mepark_tickets Row/Insert/Update에 completed_at + exit_requested_at 추가. ⑤ **안전 수정**: helpers.ts applyScopeFilter 제네릭 제약 정리(extends 패턴) + audit_logs insert에 TablesInsert<'audit_logs'> 명시 / auth-middleware.ts profile.org_id null 체크 추가(unauthorized 반환) + store_members.store_id null 필터(filter is string 가드). 에러 감소: 151 → 138(13건). 빌드 성공 71s/81 페이지 | ✅ 코드 완료 / ✅ SQL 09·10 실행 완료 (2026.04.13) | da08c41 |
| 2026.04.13 | 타입정리3 | **TS strict 점진 정리(3차) — daily_reports 4테이블 수동 추가 + 잔여 패턴 일괄 처리.** ① **database.types.ts 4테이블 추가**(SQL 06-daily-reports.sql 기준 수기 작성): daily_reports(18컬럼)·daily_report_staff(11컬럼)·daily_report_payment(8컬럼)·daily_report_extra(10컬럼) 각 Row/Insert/Update + Relationships(report_id→daily_reports, employee_id→employees, store_id→stores). 알파벳 순서로 employees: 앞 라인에 삽입. **이 한 번의 추가로 ~123건 cascading SelectQueryError 즉시 해소(138→15)**. ② **AuditLogRow.action enum 확대**: types.ts에서 'insert'|'update'|'delete' 유니온 → string으로 변경. 'soft_delete', 'renew_expire_prev', 'renew_insert_new' 등 의미있는 액션 사용 가능(monthly/[id]·renew 3건 해소). ③ **edit-history/route.ts**: audit_logs에 `created_at` 없음 → `changed_at`으로 일괄 치환(select·order·매핑 라인 + 인터페이스 필드 4곳 수정). ④ **null 가드 추가**: attendance/route.ts·attendance/export/route.ts 동일 패턴 — `m.is_primary && m.store_id` 추가(store_id가 string|null이라 Map<string,string>에 못 넣음, 2건 해소). 누적 에러 감소: 151→11(**-140건**). 빌드 성공 74s/81 페이지, 라우트 변경 없음 | ✅ 완료 (잔여 11건 다음 세션) | (이번 push) |
| 2026.04.13 | 타입정리4 | **TS strict 정상화 마무리 — 잔여 11건 → 0건.** ① **null 가드 4건**: attendance/route.ts·attendance/export/route.ts L107 `m.employee_id` 추가 가드(string\|null) / auth/login/route.ts L100 `getRedirectPath(profile?.role ?? undefined)` (string\|null\|undefined → string\|undefined) / employees/route.ts L83·L98 `empIds`·`accountEmpIds` `.filter((x): x is string => !!x)` 적용 (string\|null[] → string[]). ② **null index 가드 1건(3건 동시 해소)**: attendance/site/[storeId]/route.ts L278 `if (!row.status) continue` 추가로 workingStatuses.has·by_status 인덱스 3건 일괄 해소. ③ **insert 타입 cast 3건**: daily-reports/route.ts L321 `TablesInsert<'daily_report_extra'>[]` 명시 + `metadata as Json \| null` cast / employees/bulk-import/route.ts L71 `toInsert: TablesInsert<'employees'>[]`로 변경 (Record<string,unknown>[] → 정확한 타입) / L176 `.map((sa): TablesInsert<'store_members'> \| null => ...).filter((x): x is TablesInsert<'store_members'> => x !== null)` 패턴으로 null 좁히기 (변수 타입 명시 대신 map 콜백 반환 타입 명시 — 변수 명시는 map 입력 타입까지 강제해 fail). 모든 import: TablesInsert·Json from `@/lib/database.types`. 누적 에러: 151→0(**-151건 100% 해소**). 빌드 성공 83s/81 페이지, 라우트 변경 없음 | ✅ 완료 | d0f27a2 |
| 2026.04.13 | Part 13A | **현장일보 v2 UI 첫 페이지 — 3파일 신규.** src/app/v2/daily-reports/page.tsx (필터바 사업장+상태+date_from·to(기본 이번달1일~오늘) + 신규작성 버튼(/v2/daily-reports/new Link, 13B에서 활성화) + Excel 버튼, /api/v1/stores?limit=200 사업장 드롭다운 site_code 표시(`[CODE] 이름`), /api/v1/daily-reports?store_id&status&date_from&date_to&page&limit=20 GET, page state 기반 페이지네이션(meta.total/page/total_pages), selectedIds Set state로 다중선택, 일괄선택 토글(미확정만), 일괄확정 confirm() 후 POST /api/v1/daily-reports/bulk-confirm {ids}, 성공 시 alert로 confirmed_count/skipped_count 표시 후 재조회) / src/app/v2/daily-reports/ReportsList.tsx (카드형 리스트: 좌측 컬러바 4px(상태별), 체크박스 컬럼(확정은 disabled), 본문 Link → /v2/daily-reports/[id], 날짜 MM/DD(요일) + ISO 표시, 상태뱃지 draft/submitted/confirmed 한글라벨+컬러, event_flag 시 🎉 이벤트 뱃지, weather 이모지(맑음☀/흐림☁/비🌧/눈❄/안개🌫/황사😷), memo 한 줄 ellipsis, 우측 통계 Stat 컴포넌트 총입차/발렛/매출(매출 highlight 네이비 800), 선택 시 background #eff6ff) / src/app/v2/daily-reports/ExportButton.tsx (GET /api/v1/daily-reports/export?date_from&date_to&store_id blob 다운로드, 파일명 `현장일보_YYYY-MM-DD_YYYY-MM-DD[_사업장].xlsx`, 에러 시 JSON 파싱 시도 후 fallback). 일괄 액션 바: 선택 1건 이상일 때 네이비 헤더바 표시(선택 N건 + 선택해제/일괄확정 골드 버튼). 페이지네이션 이전/다음+`N / M (총 K건)` 표시. 빌드 성공 78s/82 페이지(+1), /v2/daily-reports 라우트 등록 확인 ○ static prerender | ✅ 완료 | b4b2e7f |
| 2026.04.13 | Part 13B | **현장일보 v2 UI 작성 페이지 — 3파일 신규.** src/app/v2/daily-reports/new/page.tsx (3섹션 폼: ①기본정보 사업장+날짜(기본 오늘)+날씨7종+행사flag&name+총입차+메모, ②근무인원 StaffSection, ③결제매출 PaymentSection. 사업장 변경 시 GET /api/v1/employees?store_id&limit=200로 직원 목록 재조회, 사업장 1개뿐이면 자동 선택. 결제 합계 클라이언트 미리보기(totalRevenue+valetCount sticky 헤더). 검증: 사업장·날짜·event_name+flag·staff/payment 필드 누락 체크. 액션 sticky bottom 바(취소 Link / 임시저장 status='draft' / 제출하기 status='submitted'). POST /api/v1/daily-reports 응답 처리: REPORT_DUPLICATE_DATE 감지 시 confirm으로 기존 일보 이동 옵션, 성공 시 alert + router.push(/v2/daily-reports/[newId]) Part 13C로 이동) / src/app/v2/daily-reports/new/StaffSection.tsx (행 단위 직원 추가/삭제, staff_type 6종 select 컬러뱃지 스타일(정규/피크/지원/파트/휴무/추가), check_in·out time input 시 calcHours 자동 계산(분 단위, 야간 24h+ 보정, 0.5 step 수동 수정 가능), 직원 미배정 사업장 경고 표시, ➕ 직원 추가 dashed 버튼) / src/app/v2/daily-reports/new/PaymentSection.tsx (행 단위 결제수단 7종(card/cash/valet_fee/monthly/transfer/free/other) 이모지+컬러 select, amount/count number input(우측정렬·step 100), 빠른추가 버튼 7개 dashed 그리드(이미사용 시 solid+opacity 0.7), 같은 결제수단 중복 등록 허용 — 서버 미차단). 빌드 성공 83s/83 페이지(+1), /v2/daily-reports/new 라우트 등록 ○ static prerender | ✅ 완료 | fa05b01 |
| 2026.04.13 | Part 13C | **현장일보 v2 UI 상세+수정+사진+이력 — 4파일 신규(13 시리즈 마감).** src/app/v2/daily-reports/[id]/page.tsx (메인 상세: GET /api/v1/daily-reports/:id + GET /api/v1/auth/me + GET /api/v1/employees?store_id 병렬 로드. 권한 판정: isManage(super/admin)=children수정+확정/해제, canEditMaster=manage또는 본인+미확정. 헤더에 날짜+상태뱃지+사업장+이력/확정/해제 액션. ①기본정보 ReadField/EditField 토글: 읽기는 8필드(weather/total_cars/valet_count/total_revenue+highlight/event/memo+pre/작성자ID/제출일시/확정일시), 편집은 weather select+totalCars+event flag&name+memo textarea, PUT /api/v1/daily-reports/:id 화이트리스트 5필드. ②③ SectionsEdit 위임. ④ PhotoUpload 위임. confirm/unconfirm prompt로 reason 받아서 PATCH. 이력 Drawer conditional render) / [id]/SectionsEdit.tsx (staff/payment view ↔ edit 토글, 편집 시 new/StaffSection·PaymentSection 컴포넌트 재사용. startStaffEdit/startPayEdit이 응답 데이터 → draft 변환(work_hours·amount·count는 string 변환 form 호환). saveStaff·savePay는 prompt('수정 사유') 후 PUT /:id/staff·/:id/payment, 검증 통과 시 onChanged() 재로드. 읽기 뷰 StaffReadView/PaymentReadView 컴팩트 테이블, staff_type 6종 컬러뱃지+직원 emp_no 표시, payment 합계 우측 표시) / [id]/PhotoUpload.tsx (extra 중 category='photo'만 필터, createBrowserClient로 Supabase Storage signed URL 일괄 생성(1시간 expiry, daily-report-photos 버킷, paths 배열 → createSignedUrls). 업로드 input file accept=image/* multiple, MAX_FILES=20·MAX_SIZE=10MB 클라 검증 후 FormData files[] POST /:id/images. 갤러리 grid auto-fill 160px aspect-ratio 1/1, 미리보기 + title 하단 그라데이션 오버레이, 클릭 시 원본 새창. canUpload=isManage또는 본인+미확정) / [id]/HistoryDrawer.tsx (우측 슬라이드 640px, GET /:id/history?page&limit=20, audit_logs 직접 표시: TABLE_LABEL 매핑(daily_reports=기본정보/staff=근무인원/payment=결제매출), ACTION_STYLE insert=신규/update=수정/delete=삭제 컬러뱃지, reason 골드 박스 표시, 변경자 ID, before/after 데이터는 details/summary로 접힘 — 펼치면 monospace JSON. 페이지네이션 이전/다음 + open conditional render(unmount로 state 초기화)). 빌드 성공 81s/83 페이지(라우트 ƒ dynamic), 13 시리즈 전체 완료 — API 12개 엔드포인트 모두 UI 연결 | ✅ 완료 | (이번 push) |
| 2026.04.14 | CREW OCR 핫픽스 | **CREW앱 카메라 OCR 실사용 버그 전수 정리(4커밋) + 한글↔* 호환 DB 전환.** ① **CameraOcr.tsx 버그 4건(1edc22a)**: IDLE 안내문 '자동 인식' → '버튼을 눌러주세요'(실제는 수동 스캔), startScan/reset에 candidates·confirmed 초기화 누락 추가(재스캔 시 이전 차량 후보 잔존), 직접입력 input 필터 숫자·공백·* 만 허용 + inputMode='numeric'(Plate Recognizer 정책 일관), 카메라 준비 1.5초 하드코딩 → readyState 폴링 최대 5초(저사양 기기 안정화). ② **entry/page.tsx * 마스킹 수용(2a33874)**: applyOcrPlate의 `/[가-힣]/` → `/[가-힣*]/` 로 3칸 분리 마커에 * 포함, validatePlate의 hasKorean → hasKorOrMask 완화, plateKor input의 onCompositionEnd·onBlur 필터에 * 허용. OCR "123* 4567" → 3칸 분리 → 검증 통과 → 입차 등록까지 전체 플로우 정상화(이전엔 맞습니다 눌러도 validation 실패해 등록 안 됨). ③ **한글↔* 호환 3건(a42fcc6)**: CameraOcr 모달 ✕ 시 detected·candidates 정리(재오픈 시 엉뚱한 안내 방지), src/lib/plate.ts 유틸 신규(extractDigits/matchPlate/formatMaskedPlate/isValidPlate), sql/v2/11-plate-digits.sql — mepark_tickets.plate_digits + monthly_parking.vehicle_digits generated column(regexp_replace 숫자만) + 인덱스 2개, checkMonthly.vehicle_number·입차중복체크.plate_number → digits 컬럼 기반 매칭(기존 한글 "57주1331"과 신규 * 마스킹 "57*1331"이 동일 숫자로 매칭), parking-status 검색 숫자만 입력 시 매칭 병행. single() → maybeSingle() 전환. ④ **checkMonthly 히든 버그(755e4c4)**: monthly_parking 실제 상태 컬럼명은 status가 아닌 contract_status(DB 조사로 발견) → .eq('status', 'active') → .eq('contract_status', 'active') 수정. SQL의 monthly 인덱스도 contract_status로 수정. **SQL 실행 완료(2026.04.14)**: plate_digits·vehicle_digits 컬럼 2개 + 인덱스 2개 모두 Supabase에서 생성·검증 완료(기존 한글 차량 "57주1331" → 숫자 "571331" 정상 변환, * 마스킹 차량 "131*6735" → "1316735" 정상 변환). 빌드 성공 | ✅ 완료 (SQL 실행 완료 ✅) | 1edc22a, 2a33874, a42fcc6, 755e4c4 |

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

---

## 📌 작업 로그 (2026.04.13 · Part 14C)

### Part 14C — 월주차 v2 API (3엔드포인트)
- `src/app/api/v1/monthly/route.ts` — GET 목록(필터: tenant/store/contract_status/payment_status/expiring_within_days/search) + POST 등록
- `src/app/api/v1/monthly/[id]/route.ts` — GET 상세(renewed_from 동봉) / PATCH 부분수정 / DELETE soft(cancelled)+hard(super_admin)
- `src/app/api/v1/monthly/[id]/renew/route.ts` — POST 갱신 (기존 expired + 신규 row + renewed_from_id 연결 + tenant usage_count++)

### 핵심 설계
- monthly_parking은 org_id 컬럼 없음 → `stores!inner(org_id)` 조인으로 멀티테넌시 강제
- crew/field_member는 ctx.storeIds 내 사업장만 접근 가능 (모든 메서드)
- 활성 차량번호 중복 검사 (같은 store + active)
- 갱신 시 기본값: start_date = 기존 end_date + 1일, end_date = start_date + 1개월(말일 보정)
- 갱신 실패 시 best-effort 롤백 (기존 row 상태 복원)
- 알림톡(월주차갱신완료)은 별도 cron에서 처리, 이 API는 호출하지 않음

### 빌드
- `npm run build` ✅ 통과
- 라우트 등록 확인: `/api/v1/monthly`, `/api/v1/monthly/[id]`, `/api/v1/monthly/[id]/renew`

### 호환성
- 기존 monthly_parking 테이블/v1 페이지(/monthly, /crew/monthly)/cron(monthly-remind, monthly-leave) 모두 무영향
- tenant_id, renewed_from_id는 nullable이라 기존 row와 자연 호환

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| GET /api/v1/monthly | ✅ | (14A 완료) | ⏳ 실배포 검증 필요 |
| POST /api/v1/monthly | ✅ | (14A 완료) | ⏳ |
| GET/PATCH/DELETE /api/v1/monthly/:id | ✅ | (14A 완료) | ⏳ |
| POST /api/v1/monthly/:id/renew | ✅ | (14A 완료) | ⏳ |

---

## 📌 작업 로그 (2026.04.13 · Part 15A)

### Part 15A — 월주차 v2 UI 목록 페이지

**신규 파일 2개:**
- `src/app/v2/monthly/page.tsx` — 메인 페이지
- `src/app/v2/monthly/MonthlyList.tsx` — 카드 리스트 컴포넌트

**기능:**
- 필터 6종: 사업장 / 입주사 / 계약상태(active 기본) / 결제상태(all 기본) / 만료임박(D-7/14/30) / 검색(차량번호·고객명)
- `/api/v1/stores?limit=200` + `/api/v1/tenants?status=active&sort=name&limit=200` 로 드롭다운 채움
- `/api/v1/monthly?store_id&tenant_id&contract_status&payment_status&expiring_within_days&search&page&limit=20` GET
- 카드 클릭 → `/v2/monthly/[id]` (Part 15C에서 활성화)
- 신규 등록 버튼 → `/v2/monthly/new` (Part 15B에서 활성화)
- 페이지네이션 이전/다음 + `N / M (총 K건)`

**카드 디자인:**
- 좌측 컬러바 5px: 만료 D-7 이내 빨강 / D-30 이내 골드 / 그 외 회색 / 만료됨 회색
- 4컬럼 그리드: ①차량번호(Outfit 800 20px 네이비)+차종+D-N뱃지 / ②고객명+입주사(🏢)+전화마스킹(010-****-5678) / ③사업장(📍)+기간(YYYY.MM.DD ~) / ④월요금(Outfit 800 18px ₩)+계약상태뱃지+결제상태뱃지
- hover 시 box-shadow + translateY(-1px)
- CONTRACT_BADGE: active 초록/expired 회색/cancelled 빨강
- PAYMENT_BADGE: paid ✓ 파랑/unpaid 💰 황색/overdue ⚠ 빨강

**정책:**
- 목록에서 전화번호는 가운데 4자리 마스킹 (`010-****-5678`)으로 표시
- 원본은 상세 페이지(15C)에서만 노출 (월주차 알림톡 정책 예외)
- 차량번호는 monospace 폰트(Outfit)로 가독성 강조

**빌드:** `npm run build` ✅ 성공, `/v2/monthly` 라우트 등록 확인 (○ static prerender)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| /v2/monthly 목록 페이지 | ✅ | (14A 완료) | ⏳ 실배포 검증 필요 |
| /v2/monthly/new 등록 페이지 | ⏳ Part 15B | - | - |
| /v2/monthly/[id] 상세+수정+갱신 | ⏳ Part 15C | - | - |

---

## 📌 작업 로그 (2026.04.13 · Part 15B)

### Part 15B — 월주차 v2 UI 등록 페이지

**신규 파일 1개:**
- `src/app/v2/monthly/new/page.tsx` — 등록 폼 (싱글 파일)

**폼 구조 (2컬럼 그리드):**
1. 사업장 (필수, 드롭다운, 1개뿐이면 자동선택) / 입주사 (선택, 드롭다운)
2. 차량번호 (필수, 공백·하이픈 자동제거 미리보기) / 차종 (선택)
3. 고객명 (필수) / 연락처 (필수, 평문)
4. 시작일 (필수, 기본 오늘) / 종료일 (필수, 자동 +1개월 -1일)
5. 월요금 (필수, 우측정렬 monospace + 천단위 미리보기) / 결제상태 (paid/unpaid 기본/overdue)
6. 메모 (전체폭 textarea)

**자동 동작:**
- 시작일 변경 → 종료일 자동 재계산 (`addOneMonth` 사용자가 종료일을 직접 수정한 경우 비활성)
- 입주사 선택 → `monthly_fee_default` 자동 입력 (월요금 미입력 시만) + `default_store_id` 자동 사업장 선택
- 차량번호 입력 → 정규화 미리보기 표시 (저장값 ≠ 입력값일 때만)
- 사업장 1개 → 페이지 진입 시 자동 선택

**날짜 계산 (`addOneMonth`):**
- 다음달 같은 날, 말일 보정 (1.31 → 2.28/29) 후 -1일
- 예: 2026.04.13 시작 → 2026.05.12 종료
- API의 `addMonths(start, 1)`은 +1개월(다음달 같은 날)이라 정확히 같지 않음. 폼 단계에서 -1일 보정으로 "1개월 = 시작일 ~ 같은 일자 -1일" 한국 관행 반영

**검증 (클라):**
- 사업장/차량번호(4자+)/고객명/연락처/시작일/종료일/월요금(0+)
- 종료일 < 시작일 차단

**제출:**
- POST `/api/v1/monthly` body: `{store_id, vehicle_number(정규화), vehicle_type, customer_name, customer_phone, start_date, end_date, monthly_fee, payment_status, contract_status='active', note, tenant_id?}`
- 409 Conflict → "이미 등록된 활성 월주차 차량번호" 친절 안내
- 성공 → `alert` + `router.push('/v2/monthly/[id]')` (Part 15C 활성화 시 상세로, 아직은 fallback `/v2/monthly`)

**액션 바:**
- sticky bottom, 취소(회색)/등록하기(네이비 골드 사용 안 함, 24px padding)
- 등록 중에는 disabled + "등록 중..." 표시

**디자인:**
- maxWidth 900px (목록 1400px보다 좁게, 폼 가독성)
- paddingBottom 100px (sticky 액션바 가림 방지)
- Field 컴포넌트: 라벨 + required 빨간별 + hint 우측 회색 작은글씨 + children
- Row 컴포넌트: 1fr 1fr 그리드 + gap 16px

**빌드:** `npm run build` ✅ 성공, `/v2/monthly/new` 라우트 등록 (○ static prerender)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| /v2/monthly/new 등록 페이지 | ✅ | (14A 완료) | ⏳ 실배포 검증 필요 |
| /v2/monthly/[id] 상세+수정+갱신+취소 | ⏳ Part 15C | - | - |

---

## 📌 작업 로그 (2026.04.13 · Part 15C — Part 15 시리즈 마감)

### Part 15C — 월주차 v2 UI 상세+수정+갱신+취소

**신규 파일 2개:**
- `src/app/v2/monthly/[id]/page.tsx` — 메인 상세 (읽기/편집 토글)
- `src/app/v2/monthly/[id]/RenewModal.tsx` — 갱신 모달

**메인 페이지 구성:**
- 헤더: 차량번호(Outfit 800 32px 네이비) + 계약상태/결제상태 뱃지 + D-N 만료표시
- 액션 버튼 (편집모드 아닐 때): 수정(회색) / 갱신(골드) / 계약취소(빨강 outline) — cancelled는 갱신/취소 숨김
- 본문: "📋 계약 정보" 섹션 (사업장/입주사/차종/고객명/연락처/계약기간/월요금/등록일자/메모)
- 갱신 이력: `data.renewed_from` 있으면 별도 카드로 "🔄 이전 계약" 표시 + 이전 계약 ID로 이동 버튼

**읽기/편집 토글:**
- ReadField: 라벨 11px 회색 + 값 14px (highlight=16px), 월요금만 22px Outfit 800 네이비 강조
- EditField: 라벨 12px + required 빨간별 + hint 우측 회색 + input
- 사업장은 변경 불가 (필요 시 취소 후 신규 등록 안내 — 노란 박스)
- 11필드 PATCH: vehicle_number(공백/하이픈 자동제거)/vehicle_type/customer_name/customer_phone/start_date/end_date/monthly_fee/payment_status/contract_status/note/tenant_id
- 검증: 차량번호 4자+/고객명/연락처/날짜순서/월요금 0+

**계약취소 (DELETE soft):**
- confirm() 모달: "차량/사업장" 표시 후 사용자 확인
- 이미 cancelled면 alert 후 무동작
- 성공 시 alert + load() 재조회 → contract_status='cancelled' 반영, 액션 버튼 자동 숨김

**갱신 모달 (RenewModal.tsx):**
- 헤더: 네이비 배경, "🔄 월주차 갱신" + "기존 계약은 'expired' 처리됩니다" 안내
- 기존 계약 요약 카드: 차량번호/고객명/기간/월요금
- 신규 입력 4필드: 시작일(기본 기존 end+1일) / 종료일(자동 +1개월 -1일, 수동 변경 시 추적) / 월요금(기본 기존, 변경 시 골드 테두리+"변경됨" 표시) / 결제상태(기본 unpaid) / 메모(기본 기존)
- POST `/api/v1/monthly/:id/renew` body: `{start_date, end_date, monthly_fee, payment_status, note}`
- 성공 응답: `{renewed:true, previous, current}` → `current.id`로 부모가 router.push 이동

**날짜 계산 일관성:**
- 등록 폼(15B)과 갱신 모달(15C) 모두 `endFromStart`: 시작일 + 1개월 → 같은 일자 -1일 (한국 관행: 4.13~5.12)
- API의 `addMonths(start, 1)`은 같은 일자(4.13→5.13)지만 사용자가 수동 입력으로 덮어쓰므로 충돌 없음. 기본값만 다름

**디자인 일관성:**
- 모달: 위에 네이비 헤더 / 본문 흰색 / 하단 회색 액션바
- 클릭 외부 영역 → onClose (e.stopPropagation으로 모달 본문은 보존)
- 갱신 버튼은 골드 (브랜드 강조), 일반 액션은 네이비

**빌드:** `npm run build` ✅ 성공, `/v2/monthly/[id]` ƒ dynamic 라우트 등록

### Part 15 시리즈 전체 완료
| 항목 | Code | DB | Test |
|------|------|-----|------|
| /v2/monthly 목록 (Part 15A) | ✅ | (14A 완료) | ⏳ 실배포 |
| /v2/monthly/new 등록 (Part 15B) | ✅ | (14A 완료) | ⏳ 실배포 |
| /v2/monthly/[id] 상세+수정+갱신+취소 (Part 15C) | ✅ | (14A 완료) | ⏳ 실배포 |

**API 연결 완료:** `/api/v1/monthly` 4엔드포인트(목록·등록·상세·수정·삭제·갱신) 모두 v2 UI에서 호출 가능

---

## 📌 작업 로그 (2026.04.13 · Part 16A)

### Part 16A — 입주사 v2 UI 목록 + 신규 등록 모달

**신규 파일 2개:**
- `src/app/v2/tenants/page.tsx` — 목록 페이지 (테이블 형식)
- `src/app/v2/tenants/TenantFormModal.tsx` — 등록/수정 공용 모달 (16B에서도 재사용)

**목록 페이지:**
- 필터 3종: 검색(입주사명·담당자) / 상태(active 기본/inactive/all) / 정렬(usage 기본/name/recent)
- 테이블 8컬럼: 입주사명(🏢 + 사업자번호) / 담당자 / 연락처 / 기본사업장(📍) / 기본 월요금(우측, Outfit 700) / 이용횟수(파란/회색 pill) / 최근 계약일 / 상태(활성·비활성 뱃지)
- 행 클릭 → `/v2/tenants/[id]` (Part 16B 활성화)
- 입주사명 셀의 Link는 `e.stopPropagation`으로 행 클릭과 분리 (둘 다 같은 곳으로 이동)
- 페이지네이션 + "총 N개" 카운트
- 이용횟수 0건이면 회색 pill, 1건+이면 파란 pill로 시각 차별화
- minWidth 900px 설정 + overflow-x:auto로 모바일 가로 스크롤 대응

**모달 (TenantFormModal):**
- 신규/수정 공용: `tenant` prop 있으면 수정 모드, 없으면 신규
- 신규: POST `/api/v1/tenants` / 수정: PATCH `/api/v1/tenants/:id`
- 8필드: 입주사명(필수, autoFocus) / 사업자번호 / 기본 월요금(우측 Outfit 700) / 담당자명 / 담당자 연락처 / 기본 사업장(드롭다운) / 상태(수정 시만) / 메모
- 검증: 입주사명 필수, 월요금 0+
- 409 Conflict → "이미 같은 이름의 활성 입주사가 있습니다"
- 디자인: 모달 헤더 네이비 + 본문 흰색 + 하단 회색 액션바, 외부 클릭 닫힘 (e.stopPropagation으로 본문 보존)

**디자인 일관성:**
- 월주차 RenewModal과 동일한 모달 패턴 (헤더/본문/액션바)
- Field/Row 컴포넌트 동일 스타일
- 검색 버튼만 골드(F5B731), 등록/저장 버튼은 네이비

**빌드:** `npm run build` ✅ 성공, `/v2/tenants` 라우트 등록 (○ static prerender)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| /v2/tenants 목록 + 등록 모달 | ✅ | (14A 완료) | ⏳ 실배포 |
| /v2/tenants/[id] 상세+수정+비활성화 | ⏳ Part 16B | - | - |

---

## 📌 작업 로그 (2026.04.13 · Part 16B — Part 16 시리즈 마감)

### Part 16B — 입주사 상세+수정+활성화토글+영구삭제+활성계약목록

**신규 파일 1개:**
- `src/app/v2/tenants/[id]/page.tsx` — 메인 상세 페이지 (싱글 파일, ~640줄)

**페이지 구성:**
- **상단**: 목록으로 돌아가기 링크
- **헤더 카드**: 🏢 입주사명(26px Outfit 800 네이비) + 상태뱃지(active/inactive) + 사업자번호(monospace) + 액션 버튼 3종(수정/비활성화·활성화/영구삭제)
- **통계 카드 3개** (3컬럼 그리드): 활성 월주차(파란색 강조 1건+) / 누적 이용횟수 / 최근 계약일
- **본문 좌측 (1fr)**: 📋 기본 정보 (담당자/연락처/기본사업장/기본월요금[18px 네이비 강조]/등록일자/최종수정/메모)
- **본문 우측 (1.2fr)**: 🚗 활성 월주차 계약 (별도 API 호출, GET `/api/v1/monthly?tenant_id=xxx&contract_status=active&limit=100`)
  - 각 카드: 차량번호(Outfit 800 16px) + 상태뱃지 + 고객명·차종 + 기간 + 월요금(우측) + D-N(D-7 빨강/D-30 골드)
  - 카드 클릭 → `/v2/monthly/[id]` 이동
  - hover 시 borderColor 네이비 + background 회색 전환
  - 빈 상태: dashed 박스 "활성 월주차 계약이 없습니다"
  - 헤더 우측 "+ 신규 등록" 버튼 → `/v2/monthly/new?tenant_id=xxx` (쿼리 prefill은 추후 15B 개선 필요)

**액션 버튼 동작:**
- **수정**: TenantFormModal 재사용(Part 16A 공용 모달, `tenant` prop 전달 → 수정 모드 자동 활성화), onSaved → load() 재조회
- **비활성화/활성화 토글**: PATCH `/api/v1/tenants/:id` body `{status: 'inactive'|'active'}`
  - 활성 → 비활성 시 활성 계약 N건 있으면 경고 confirm("기존 계약은 유지됩니다")
  - 활성 계약 0건 시 단순 confirm
- **영구 삭제**: super_admin + status='inactive' + 활성계약 0건일 때만 노출
  - prompt로 입주사명 정확히 입력해야 진행 (안전장치)
  - DELETE `/api/v1/tenants/:id?hard=true`
  - 성공 시 router.push('/v2/tenants')

**병렬 데이터 로드 (Promise.all 4개):**
1. GET `/api/v1/tenants/:id` — 상세 + active_contract_count
2. GET `/api/v1/monthly?tenant_id=:id&contract_status=active&limit=100` — 활성 계약 목록
3. GET `/api/v1/stores?limit=200` — 사업장 (모달 + 표시명용)
4. GET `/api/v1/auth/me` — role 확인 (super_admin 영구삭제 버튼 노출)

**디자인 일관성:**
- 헤더/카드/모달 패턴 monthly/[id] 페이지와 동일 (border-radius 12, padding 20-24px, border #e2e8f0)
- 색상: 네이비 #1428A0 강조 / 골드 #F5B731 신규등록 버튼 / 활성계약 0건 회색 처리
- 버튼 4종 스타일 정의: btnPrimary(네이비), btnSuccess(초록), btnWarn(회색+골드테두리), btnDanger(흰배경+빨강테두리)
- ReadField/StatCard 컴포넌트로 반복 UI 정리

**모바일 대응:**
- 액션 버튼 영역: flex-wrap (헤더 좁아질 때 줄바꿈)
- 본문 그리드: 현재 1fr/1.2fr 고정 (좁은 화면 미디어쿼리 미적용 — 추후 보완 후보)
- 활성 계약 리스트: maxHeight 520px overflowY auto

**연락처 정책 반영:**
- 담당자 연락처 평문 표시(월주차 알림톡 정책 예외) + hint "월주차 알림톡 정책에 따라 평문 저장" 명시

**빌드:** `npm run build` ✅ 성공, `/v2/tenants/[id]` ƒ dynamic 라우트 등록

### Part 16 시리즈 전체 완료
| 항목 | Code | DB | Test |
|------|------|-----|------|
| /v2/tenants 목록 + 등록 모달 (Part 16A) | ✅ | (14A 완료) | ⏳ 실배포 |
| /v2/tenants/[id] 상세+수정+활성화토글+영구삭제+활성계약 (Part 16B) | ✅ | (14A 완료) | ⏳ 실배포 |

**API 연결 완료:** `/api/v1/tenants` 5엔드포인트(목록·등록·상세·수정·삭제) 모두 v2 UI에서 호출 가능

**개선 후보 (다음 세션):**
- `/v2/monthly/new?tenant_id=xxx` 쿼리 prefill 처리 (15B 개선)
- 입주사 상세에서 만료된/취소된 계약도 토글로 함께 보기
- 모바일 좁은 화면용 본문 그리드 1컬럼 전환

---

## 📌 작업 로그 (2026.04.13 · Part 17A)

### Part 17A — 통계 API 5엔드포인트 + 공용 유틸

**신규 파일 6개:**
- `src/lib/api/stats.ts` — 공용 유틸
- `src/app/api/v1/stats/overview/route.ts`
- `src/app/api/v1/stats/by-store/route.ts`
- `src/app/api/v1/stats/by-tenant/route.ts`
- `src/app/api/v1/stats/by-payment-method/route.ts`
- `src/app/api/v1/stats/daily-trend/route.ts`

### 1. stats.ts 유틸

- `parseDateRange()`: ?date_from/date_to 또는 ?year/month 처리. 둘 다 없으면 이번달 1일 ~ 오늘 기본값. ISO 검증, from > to 차단.
- `calcCompareRange()`: 동일 길이 직전 기간 자동 계산 (예: 4.1~4.13 → 3.19~3.31)
- `calcChangeRate()`: 증감률 (소수 1자리, previous=0이면 null로 DIV/0 방지)
- `PAYMENT_METHOD_LABELS`: 7종 한글 라벨+이모지+컬러 매핑 (card 💳 #1428A0, cash 💵 #16a34a, valet_fee 🚗 #F5B731, monthly 📅 #7c3aed, transfer 🏦 #0891b2, free 🎟 #94a3b8, other 📝 #64748b)
- `PAYMENT_METHOD_ORDER`: UI 정렬 기준 배열

### 2. GET /api/v1/stats/overview — KPI 4종 + 증감률

**쿼리:** `?date_from&date_to&store_id?` 또는 `?year&month`
**응답:**
```json
{
  "range": {date_from, date_to, days},
  "compare": {date_from, date_to},
  "current": {revenue, total_cars, valet_count, report_count, active_monthly},
  "previous": {revenue, total_cars, valet_count, report_count},
  "change": {revenue: %, total_cars: %, valet_count: %, report_count: %}
}
```
- 현재/비교 기간 일보 합산은 `daily_reports` 캐시 컬럼(total_revenue/cars/valet_count) 사용 → 빠름
- active_monthly는 현재 시점 스냅샷 (기간 무관)
- crew/field_member 스코프 필터 적용 (storeIds 강제)

### 3. GET /api/v1/stats/by-store — 주차장별 매출

**쿼리:** `?date_from&date_to&sort=revenue|cars|valet`
**응답:** items[{store_id, store_name, site_code, revenue, total_cars, valet_count, report_count, daily_avg_revenue}] + totals
- `stores!inner` JOIN으로 한 번에 사업장 메타 포함
- 메모리 그룹핑 후 sort

### 4. GET /api/v1/stats/by-tenant — 입주사별 활성 월주차

**쿼리:** `?status=active|all&sort=revenue|count|name`
**응답:** items[{tenant_id, tenant_name, status, contact_*, monthly_fee_default, usage_count, last_contracted_at, active_count, expired_count, cancelled_count, total_monthly_revenue}] + totals
- 기간 무관 — 현재 시점 스냅샷 (활성 계약 합 = 월 잠재 매출)
- 입주사 목록 1회 + 월주차 IN 조회 1회 (총 2쿼리)

### 5. GET /api/v1/stats/by-payment-method — 결제수단별 분포

**쿼리:** `?date_from&date_to&store_id?`
**응답:** items[{method, label, emoji, color, amount, count, ratio}] + totals
- 7종 method 모두 row 보장 (0건이어도 표시 — 차트 안정성)
- ratio는 amount 비율 (소수 1자리, 0~100)
- 일보 ID 추출 → daily_report_payment IN 조회 (2쿼리)

### 6. GET /api/v1/stats/daily-trend — 일별 추이 (차트용)

**쿼리:** `?date_from&date_to&store_id?` (최대 92일 = 3개월)
**응답:** series[{date, weekday, is_weekend, revenue, total_cars, valet_count, report_count}]
- 모든 날짜에 대해 row 보장 (빈 날짜 = 0) → 차트 X축 누락 방지
- 같은 날짜 여러 사업장이면 합산
- weekday 한글 ('일'~'토'), is_weekend boolean
- 92일 초과 시 VALIDATION_ERROR (서버 부담 + 차트 가독성)

### 권한
- 모두 MANAGE (super_admin/admin)
- crew/field_member도 호출 가능 — 단 ctx.storeIds 강제 필터, 빈 배열이면 빈 결과
- store_id 명시 시 canAccessStore 체크

### 멀티테넌시 강제
- daily_reports/tenants는 org_id 직접 컬럼 보유 → `.eq('org_id', ctx.orgId)`
- monthly_parking은 org_id 컬럼 없음 → `stores!inner(org_id)` JOIN으로 강제

### 빌드
- `npm run build` ✅ 성공 76s
- 라우트 등록 확인: `/api/v1/stats/{overview, by-store, by-tenant, by-payment-method, daily-trend}` 5개 ƒ dynamic

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| stats.ts 공용 유틸 | ✅ | - | ⏳ |
| GET /api/v1/stats/overview | ✅ | - | ⏳ 실배포 |
| GET /api/v1/stats/by-store | ✅ | - | ⏳ |
| GET /api/v1/stats/by-tenant | ✅ | - | ⏳ |
| GET /api/v1/stats/by-payment-method | ✅ | - | ⏳ |
| GET /api/v1/stats/daily-trend | ✅ | - | ⏳ |
| 대시보드 UI (Part 17B) | ⏳ 다음 | - | - |

### 다음 단계
- Part 17B: `/v2/dashboard` 페이지 신규 — KPI 4카드 + 일별 추이 차트(SVG 또는 recharts) + 사업장별 테이블 + 결제수단 도넛 + 입주사별 테이블

---

## 📌 작업 로그 (2026.04.14 · Part 17B)

### Part 17B — 대시보드 UI `/v2/dashboard` (17 시리즈 마감)

**신규 파일 1개:**
- `src/app/v2/dashboard/page.tsx` (약 600줄)

### 구성

**① 필터 바**
- 프리셋 4개: 이번달(기본) / 지난달 / 최근 7일 / 최근 30일
- 직접 입력: date_from ~ date_to (변경 시 프리셋 `custom` 전환)
- 사업장 드롭다운 (전체 또는 개별)
- 🔄 새로고침 버튼 (로딩 중 disabled)

**② KPI 4카드** — 매출 💰 / 차량 🚗 / 발렛 🅿️ / 일보수 📋
- 직전 동일기간 대비 증감률 (▲초록 / ▼빨강 / • 신규·0%)
- 일보수 카드 하단에 "활성 월주차 N건" 골드색 서브정보

**③ 일별 추이 차트** (recharts `ComposedChart`)
- Area(매출, NAVY gradient) + Line(차량, GOLD) 이중축
- Tooltip: `YYYY-MM-DD (요일) · 주말` 표시
- Y축 자동 포맷 (1M/1K)

**④ 결제수단 도넛** (PieChart)
- 0건 제외하고 차트 렌더, 범례는 7종 모두 (0건은 opacity 45%)
- amount/ratio 모노스페이스 정렬

**⑤ 사업장별 테이블**
- 정렬 토글 3종 (매출순/차량순/발렛순) — 토글 시 해당 API만 재조회
- 합계 row 포함 (NAVY 강조)

**⑥ 입주사별 테이블**
- 활성(초록) / 만료(회색) / 취소(연회색) 카운트
- 월 잠재매출 합, `status: active` 기본 (sort=revenue)

### 기술 포인트
- 5개 API `Promise.all` 병렬 호출 (overview/by-store/by-tenant/by-payment/daily-trend)
- `credentials: "include"` 일괄 적용
- `@ts-nocheck` + `export const dynamic = "force-dynamic"` v2 표준 준수
- 반응형: 2컬럼 섹션(결제수단+사업장) → 900px 이하 1컬럼 (`<style jsx>` 글로벌 쿼리)
- recharts 3.7.0 (기존 설치됨, v2에서 최초 사용)
- `useMemo`로 파이/추이 데이터 가공 캐시

### 빌드
- `npm run build` ✅ 80s 성공
- `/v2/dashboard` 정적 페이지(○)로 등록 확인

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| 필터 바 (프리셋+날짜+사업장) | ✅ | - | ⏳ 실배포 |
| KPI 4카드 + 증감률 | ✅ | - | ⏳ |
| 일별 추이 ComposedChart | ✅ | - | ⏳ |
| 결제수단 도넛 PieChart | ✅ | - | ⏳ |
| 사업장별 테이블 (정렬 토글) | ✅ | - | ⏳ |
| 입주사별 테이블 | ✅ | - | ⏳ |

### 다음 단계
- Part 17 시리즈 마감. 다음 Part는 신규 기획 필요 (모바일 CREW 앱 / 알림톡 연동 / 월주차 만기 자동 알림 등)

## Part 18A — 월주차 알림톡 v2 훅 (2026.04.14)

### 작업 내용
- **SQL `sql/v2/12-monthly-alimtalk-flags.sql`** 신규
  - `monthly_parking` 테이블에 4개 컬럼 추가:
    - `renewal_alimtalk_sent` BOOLEAN (갱신 완료 알림톡 발송 여부)
    - `renewal_alimtalk_sent_at` TIMESTAMPTZ
    - `expire_alimtalk_sent` BOOLEAN (만료 안내 알림톡 발송 여부)
    - `expire_alimtalk_sent_at` TIMESTAMPTZ
  - `idx_monthly_parking_expire_scan` 부분 인덱스 (active + 미발송 + end_date)
- **`src/app/api/v1/monthly/[id]/renew/route.ts`** 수정
  - audit 2건 기록 후, `inserted.customer_phone` 유효 시 `/api/alimtalk/monthly` (templateType=`renewal_complete`) fire-and-forget 호출
  - 발송 성공 응답 수신 시 `renewal_alimtalk_sent=true`, `renewal_alimtalk_sent_at` 업데이트 (best-effort)
  - 응답에 `alimtalk_requested` 필드 추가
- **`src/app/api/cron/monthly-expire/route.ts`** 신규 크론
  - 매일 09:00 KST (UTC 00:00), `CRON_SECRET` Bearer 인증
  - `end_date=오늘 + contract_status='active' + expire_alimtalk_sent=false` 조회
  - 템플릿 `monthly_expire` 발송 → `alimtalk_send_logs` 기록 → 성공 시 플래그 업데이트
  - contract_status 는 그대로 `active` 유지 (상태 전이는 별도 정책)
- **`vercel.json`** 업데이트
  - `monthly-expire` 크론 등록 (schedule: `0 0 * * *`)

### Solapi 환경변수 (Vercel 설정 필요 — 사용자 확인)
```
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_PF_ID                      = KA01PF2602181223374948VgQEw1w3yH
SOLAPI_SENDER_NUMBER              = 18991871 (또는 발신번호)
SOLAPI_TEMPLATE_ENTRY             = KA01TP260222021359686qE3A8KaLqAW
SOLAPI_TEMPLATE_READY             = KA01TP260222021621089q9OGashc4Qb
SOLAPI_TEMPLATE_MONTHLY_REMIND    = KA01TP260222022308481aARRiLNr2QY
SOLAPI_TEMPLATE_MONTHLY_EXPIRE    = KA01TP260222022720623dV0RznZeffT
SOLAPI_TEMPLATE_MONTHLY_RENEW     = KA01TP260222022756100gTRmdzWTSI5
CRON_SECRET                       = (임의 문자열)
```
환경변수 미설정 시 `sendAlimtalk`는 자동으로 시뮬레이션 모드(`simulated:true`)로 동작 → 운영 전까지 안전.

### 기술 포인트
- fire-and-forget 패턴으로 renew 응답 지연 방지 (기존 tickets/entry 패턴 동일)
- 플래그 업데이트는 발송 성공 응답 받은 후에만 수행 → 중복 발송 차단
- 크론은 상태 전이를 하지 않음 (관리자/갱신 API의 영역)
- `toKSTDateStr()` 재사용으로 timezone 일관성
- `@ts-nocheck` + `export const dynamic = "force-dynamic"` 표준 준수

### 빌드
- `npm run build` ✅ 성공
- `/api/cron/monthly-expire` 동적 라우트(ƒ) 등록 확인

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| SQL 12 (monthly_parking 플래그 4컬럼 + 인덱스) | ✅ | 🔸 실행 필요 | - |
| renew API → renewal_complete 발송 훅 | ✅ | - | ⏳ 실운영 |
| monthly-expire 크론 신설 | ✅ | - | ⏳ 실운영 |
| vercel.json 크론 등록 | ✅ | - | ⏳ |

### 다음 단계
- **SQL 12 실행** (Supabase SQL Editor) → 실행 후 ✅ 공유 부탁
- **Vercel 환경변수 설정** (Solapi 키 + CRON_SECRET) → 설정 완료 시 시뮬레이션 → 실발송 전환
- **Part 18B** — 관리자 알림톡 페이지 `/v2/alimtalk` (발송 로그 조회 + 필터 + CSV)
- **Part 18C** — 월주차 상세에서 수동 발송 버튼 (D-7/만료/갱신 재발송)
