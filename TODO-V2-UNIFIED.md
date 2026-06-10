# 📋 미팍 통합앱 v2 개발 추적 문서

> **작성일:** 2026.04.09
> **마지막 업데이트:** 2026.05.30 (GAP-P1-4 **미팍티켓 QR 발급/공유 `/v2/crew/entry/qr` 완료** — 입차→고객 티켓 핸드오프, 클라이언트 QR 생성)
> **마지막 작업:** ✅ **GAP-P1-8 P1-8b (v2 입차 연속촬영 UI) 완료** — ①신규 컴포넌트 `src/components/crew/VehiclePhotoCapture.tsx`(`@ts-nocheck`, `vphoto-*` 네임스페이스): `getUserMedia` 스트림 **1회 오픈 유지**(마운트 useEffect, 언마운트 시 getTracks().stop()+objectURL revoke), 셔터 탭→풀해상도 `drawImage`(크롭X)→`toBlob(jpeg,0.92)`→다음 슬롯 자동진행, 슬롯 라벨 고정(전면/후면/운전석(좌)/보조석(우)/추가1/추가2, width/height ideal 1920/1080), 썸네일 스트립+슬롯삭제+직전재촬영, 패스 2종(`사진 없이 입차`=0장 / `N장으로 입차 등록`=남은슬롯 스킵), 권한거부 에러화면. 부모엔 `{blob,label}[]`만 반환(업로드 미수행). ②`entry/page.tsx` 통합: 흐름을 `입차확인(+충돌 차종모달) → 사진단계 → POST → Storage 업로드 → PATCH photos`로 개편. `handleMainSubmit`/모달 onConfirm이 바로 POST 안 하고 `photoStep` 진입, `handlePhotosComplete`가 `doSubmit(pendingCarInfo, photos)` 호출. `doSubmit`에 photos 인자 추가 + `uploadVehiclePhotos`(슬롯당 3회 재시도+백오프, 진행률 `uploadInfo` state, 경로 `{prefix}{idx}_{SLOT_KEY}.jpg` — **한글 라벨 대신 ASCII 슬롯키** front/rear/left/right/extra1/extra2로 Storage 키 이슈 회피) → 성공경로만 `PATCH /api/v1/tickets/[id]/photos`. 업로드 진행률 오버레이 추가. 부분실패/PATCH실패는 비치명(입차는 정상). ③POST 응답 필드 `result.data.ticket_id`(주의: `id` 아님)/`photo_path_prefix` 사용. 빌드 OK (`✓ Compiled successfully in 100s`, `/v2/crew/entry` ○). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
> **마지막 작업:** ✅ **GAP-P1-8 P1-8c (vehicle-photo cleanup cron) 완료** — 신규 `src/app/api/cron/vehicle-photo-cleanup/route.ts`(`@ts-nocheck`, demo-cleanup 패턴). **Storage 버킷 직접 순회 방식 채택**(DB 미조회 = `vehicle_photos` 컬럼 유지 자연충족 + 삭제객체는 다음 list에 안 잡혀 **멱등**). 흐름: org_id폴더→ticket_id폴더→파일 3단 페이지네이션 list(폴더 판별 `id===null`) → 파일 `created_at < now-60일` 만 stalePaths 수집 → `storage.remove` 배치(100개씩). 안전장치: 1회 실행 상한 `MAX_REMOVE_PER_RUN=1000`(초과 시 `truncated:true`, 다음 실행 계속), `created_at` 없으면 보수적 보존(삭제X). `vercel.json` crons에 `"0 19 * * *"`(KST 04:00, 기존 cron과 비충돌) 등록. CRON_SECRET Bearer 검증. **ticket row·vehicle_photos 컬럼은 절대 미변경**(요구사항). 신규 SQL 불필요. 빌드 OK(`✓ Compiled in 83s`, `/api/cron/vehicle-photo-cleanup` ƒ, 113p).
> **⚠️ P1-8c 운영 확인(미검증):** ①`CRON_SECRET` env가 Vercel에 설정돼 있어야 인증 동작(미설정 시 누구나 호출 가능 — demo-cleanup도 동일 전제). ②Vercel 플랜 cron 개수 한도(현재 5개) — 배포 시 한도 초과 에러 나면 플랜 확인. ③`SUPABASE_SERVICE_ROLE_KEY` env 필요(service role로 list/remove). ④실제 60일 경과 객체 생기기 전까진 항상 `removed:0` 정상. 수동 테스트는 `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/vehicle-photo-cleanup`.
> **마지막 작업:** ✅ **GAP-P1-4 (미팍티켓 QR 발급/공유) 완료** — 신규 `src/app/v2/crew/entry/qr/page.tsx`(`@ts-nocheck`, `cv2qr-*`, Suspense, 풀스크린 네이비 핸드오프). 레거시 `crew/entry/qr` 이식. **선결점검 발견**: 레거시는 "QR 스캔 입차"가 아니라 `/ticket/{id}` URL을 **QR로 표시·공유**하는 화면(고객 뷰 `/ticket/[id]` 25KB는 이미 운영 중=실시간상태/출차요청/Toss추가결제)이었고, 현재 v2 입차 성공은 토스트 1.5초→`/v2/crew/parking` 자동이동이라 **고객에게 QR 넘기는 단계가 공백**이었음. ①진입=`?ticketId=&plate=`, `${origin}/ticket/{id}` URL을 QR로. ②⚠️**QR 생성 교정**: 레거시 외부 `api.qrserver.com` 호출(약전파/오프라인 취약·제3자 URL 전송) → **클라이언트 `qrcode` 라이브러리**(npm `qrcode@1.5.4` 신규설치)로 교체, 오프라인 동작·네이티브 전환 구조 정합(설계결함 지금 수정 원칙). errorCorrectionLevel M, NAVY/화이트. ③액션: 링크공유(navigator.share→없으면 clipboard+복사토스트)·현황보기·다음차량입차·홈. ④**entry 배선**: `entry/page.tsx` 성공 흐름의 `setSuccessInfo+setTimeout(parking,1500)` → `router.replace('/v2/crew/entry/qr?ticketId=&plate=')`로 교체. 죽은 successInfo state·토스트블록 제거(최소외과). ⑤풀스크린 핸드오프라 `v2/crew/layout` `HIDE_NAV_PATHS`에 `/v2/crew/entry/qr` 추가(하단탭 숨김). 빌드 OK(`✓ Compiled successfully in 78s`, `/v2/crew/entry/qr` ○). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치 무관.
> **마지막 작업:** ✅ **GAP-P1-2 Part 1 (시간대별 통계 API) 완료** (commit `bd0763b`) — 신규 `src/app/api/v1/stats/hourly/route.ts`(`@ts-nocheck`). **선결점검 결과**: ⓐ`recharts@3.7.0` 기존설치 + v2 dashboard가 이미 `ComposedChart/PieChart` 사용 → 차트 라이브러리 추가 불필요. ⓑ `overview` API가 **전기간대비(compare/change %) 이미 서버 제공**, `by-store`(매장별 비교)·`daily-trend`(추이)·`by-payment-method` 기존 존재 → Part2 UI가 그대로 재사용. ⓒ **유일 공백 = 시간대별(hourly)**: 기존 stats 5종은 전부 `daily_reports`(일 합계)라 시간대 집계 불가. 레거시는 `mepark_tickets.entry_at` KST시각으로 클라 직접계산(v2 직접쿼리 금지 위반) → **신규 hourly API 필요**로 확정. **구현**: `GET /api/v1/stats/hourly?date_from&date_to&store_id?`(year+month도 지원). `mepark_tickets`(status=completed) KST시각 0~23 버킷 24개 zero-fill, 시간대별 `total_cars/valet_count/parking_count/revenue` + `peak` + `totals`. **본 라우트가 v2 첫 티켓단위 stats** → Supabase 1000행 제한 회피 페이지네이션(PAGE_SIZE 1000, MAX_PAGES 200=20만건 상한, 초과 시 `truncated:true`). 권한 MANAGE, crew/field는 `ctx.storeIds` 스코핑(빈배열→zeros), org_id 필터. 미들웨어 `/api/` 일괄통과(PUBLIC_PATHS 불필요, 인증은 `requireAuth` 처리). 신규 SQL 불필요. 빌드 OK(`✓ Compiled in 80s`, `/api/v1/stats/hourly` ƒ, 117p). 경고 2건은 기존 Toss SDK 무관.
> **마지막 작업:** ✅ **GAP-P1-2 Part 2 (`/v2/analytics` UI) 완료 — P1 시리즈 전부 종료**. 신규 `src/app/v2/analytics/page.tsx`(`@ts-nocheck`, `v2an-*`, `<style jsx>`). 레거시 `src/app/analytics/page.tsx`(849줄)를 **API-first 재구축**(Supabase 직접쿼리 0). 데이터=stats 5종 조합(`overview`·`daily-trend`·`hourly`(Part1신규)·`by-store`·`by-payment-method`) 전부 `credentials:include`+envelope `{success,data}` 파싱. 구성: ①KPI 4카드(매출/입차/발렛/일보, `overview.change` 전기간대비 %) ②매출 추이 AreaChart(`daily-trend`) ③**시간대별 입차 BarChart(`hourly`, peak 시각 GOLD Cell 강조 + `truncated` 경고배너)** ④매장별 매출 비교 BarChart(`by-store`) ⑤결제수단 도넛(`by-payment-method`, 범례+비율+금액) ⑥매장별 상세 실적 테이블(items+합계행). 프리셋=이번달/지난달/최근30일/올해+직접입력+매장필터, 필터변경 시 자동로드. **daily-trend 92일 서버제약 처리**: 기간>92일이면 호출 생략하고 안내문 표시(다른 차트는 전기간 정상). NAVY/GOLD/Outfit, 모바일 KPI 2열·grid2 1열 반응형. ⚠️**Sidebar 메뉴 교체 보류**(`Sidebar.tsx`의 `/analytics`→`/v2/analytics`는 accidents와 동일하게 v1→v2 일괄교체 단계에서. 현재 직접 URL `/v2/analytics`로 접근). 빌드 OK(`✓ Compiled successfully in 73s`, `/v2/analytics` ○, 118p). 경고 2건은 기존 Toss SDK 무관.
> **다음 작업(2026.06.10 갱신):** ✅ **1순위(06.09 UI 변경분 폰 검증) 완료** — 자유촬영·사진갤러리·중복배지·차종(→'메모' 라벨변경)입력칸 6건 정상 확인. ▶ **이제 1순위: 남은 P1 실기기 검증** — STEP2 crew 월주차 타매장 403(crew계정 필요, 없으면 /v2/team에서 생성) / STEP3 QR 나머지(하단탭숨김·링크공유·스캔→/ticket/[id]) / STEP4 #310 흰화면(/v2/parking-status) / STEP5 매출분석(/v2/analytics 헤더 '매출 분석'). 체크리스트 `docs/P1-실기기검증-체크리스트.md`(STEP1 사진=✅완료). **2순위(택1)**: 앱선택화면 정리(1257a7b 되돌림 여부) / Solapi 알림톡 Vercel 환경변수 연동 / crew v2 컷오버 / 미팍티켓·미톡·홈페이지v4. **미해결 설계이슈**: 번호판 4자리만 저장 시 12가2580 vs 34나2580 데이터 충돌(현재 메모수기+사진으로 운영보강).
> **⚠️ P1-8b 실기기 검증 미완(P1-8c 전/병행 필요):** `vehicle-photos` 버킷의 crew(browser anon client) **INSERT(upload) 정책**이 막히면 업로드 실패 → 버킷 RLS에 authenticated INSERT 허용 정책 추가 SQL 필요(accidents `accident-photos`와 동일 패턴). 실기기 1대로 1장 촬영→업로드 성공 여부 먼저 확인 권장.
> **P1 추천순서(갱신):** ①P1-1✅ → ②~~P1-5~~**(❌폐기 2026.06.03)** → ③**P1-3+P1-6(accidents) ✅** → ④**P1-8 ✅(8a·8b·8c)** → ⑤**P1-7(월주차) ✅(Part1·2·3)** → ⑥**P1-4(QR) ✅** → ⑦**P1-2(분석차트) ✅(Part1·2)** → **🎉 P1 시리즈 완전 종료**
> **기획서 위치:** 프로젝트 지식 `미팍통합앱_신규기획서_v2.md`

---

## 🚨 새 대화 시작 시 필독

### 🟢 GAP-P1-7 (CREW 모바일 월주차) — 진행 중 (2026.05.30, 풀스코프 확정)
**배경**: 레거시 `crew/monthly`(조회·검색) + `crew/monthly/register`(등록·수정)가 v2에 없음. 대표 결정 = **풀스코프**(CREW가 모바일에서 월주차 등록·검색·수정 가능, 단 삭제는 관리자 전용).
**선결점검 핵심 발견**: v2 monthly API(`/api/v1/monthly`, `[id]`)가 전부 **MANAGE 게이트**라 CREW(OPERATE) 호출 불가였음. 단, **GET·POST·[id]GET·[id]PATCH 4개 메서드 내부에 crew 스코핑 코드(`ctx.storeIds` 기반)가 이미 내장**되어 있었음 → 게이트만 풀면 됨. 권한체계: crew=`[OPERATE,SELF]`(OPERATE 보유), field_member=`[SELF]`(OPERATE 미보유=자동제외).

**✅ Part 1 완료(2026.05.30) — API 권한 완화 (최소 외과적 변경)**:
- `/api/v1/monthly/route.ts`: GET·POST `MANAGE`→**`OPERATE`** (crew 스코핑 95~100·189~193줄 기존)
- `/api/v1/monthly/[id]/route.ts`: GET·PATCH `MANAGE`→**`OPERATE`** (crew 스코프 검증 기존). **DELETE는 `MANAGE` 유지**(해지/삭제는 관리자 전용).
- 헤더 주석 권한 표기 동기화. **로직·필드·SQL 변경 없음**(게이트 상수만). admin/super_admin 동작 불변(OPERATE 보유).
- 빌드 OK (`✓ Compiled successfully in 83s`, 113p, monthly 4라우트 정상). 경고 2건은 기존 Toss SDK 무관.

**✅ Part 2 완료(2026.05.30) — CREW 조회 UI**: `src/app/v2/crew/monthly/page.tsx` 신규(`@ts-nocheck`, `cv2mly-*`). 레거시 `crew/monthly/page.tsx`(18KB) 이식 + **Supabase 직접조회 전면 제거 → `GET /api/v1/monthly?store_id&search&contract_status=all&limit=50`**(`credentials:include`). store_id=localStorage `crew_store_id`(없으면 `/v2/crew/login`, 401→로그인 회귀). 검색(차량번호/고객명, Enter+조회버튼+클리어) + 상태배지 4종(정상/D-N만료임박/만료/해지, `getStatusInfo` 이식) + 카드(번호판·고객명·기간·요금·매장·결제배지·진행바·D-N) + 신규등록→`/v2/crew/monthly/register` + 카드 수정→`register?id=`. **BottomNav/NavSpacer는 layout 상속**(수동추가 안 함). 삭제버튼 미노출. NAVY 그라데이션 헤더+골드 등록버튼. 빌드 OK(81s, 114p, `/v2/crew/monthly` ○). ⚠️ register 페이지(Part 3) 미구현 상태라 등록/수정 버튼은 Part 3 완료 전까진 빈 라우트로 이동.

**✅ Part 3 완료(2026.05.30) — CREW 등록/수정 UI**: `src/app/v2/crew/monthly/register/page.tsx` 신규(`@ts-nocheck`, `cv2mreg-*`, Suspense). 레거시 `register/page.tsx`(25KB) 이식 + **Supabase 직접호출 전면 제거**. 신규=`POST /api/v1/monthly`(`{...base, store_id}`) / `?id=`면 `GET /api/v1/monthly/[id]` 프리필 + `PATCH /api/v1/monthly/[id]`(store_id 제외). 전부 `credentials:include`, 401→로그인. 필드: 차량번호·차종·고객명(한글필터)·연락처(평문수집 정책예외)·시작/종료일(MeParkDatePicker+1/3/6/12개월 퀵+시작일→월말자동)·월요금·납부상태·계약상태(수정모드만)·메모. 미리보기 카드 + **409 중복 친절배너**(error.message) + 403/일반오류 배너 + 완료모달(목록으로/추가등록). 삭제버튼 미노출. BottomNav/NavSpacer layout 상속(저장버튼 인라인). ⚠️**기본 월요금 자동조회 보류**: visit-places GET이 MANAGE라 CREW 호출 불가 → 게이트 추가완화 대신 기본값 150,000(편집가능). 빌드 OK(76s, **115p**, `/v2/crew/monthly/register` ○).

**🟢 GAP-P1-7 시리즈 종료**: Part 1(API 게이트 완화) + Part 2(조회 UI) + Part 3(등록/수정 UI) 전부 완료. CREW 모바일 월주차 조회·등록·수정이 v2 API-first로 동작.
**⚠️ 실기기 검증(미검증)**: crew 세션으로 `GET/POST/PATCH /api/v1/monthly` 200 응답 + 타 매장 차단(403) 확인. 삭제버튼은 CREW UI에 노출 안 함(API도 MANAGE).


### ❌ GAP-P1-5 폐기 확정 (2026.06.03 대표 결정)
**결정: 폐기.** v2 일보 파생 근태 모델에서 레거시 `checkout_requests`(퇴근수정 요청→관리자 승인) 워크플로는 **구조적으로 불필요**. 근거:
- **퇴근시각 = 일보의 `staff.check_out`** — CREW가 일보 작성 시 직접 입력(레거시는 `worker_attendance` 별도 체크라 본인이 못 고쳐서 승인 흐름 필요했음).
- **미확정 일보는 CREW 본인이 직접 수정** 가능(`PATCH /api/v1/daily-reports/[id]`, OPERATE·본인작성·미확정) → 퇴근시각 오타/누락 자가정정.
- **확정 후 정정 = MANAGE 직접수정 + audit_logs** → 별도 요청 테이블 불요.
- **누락 감지 = anomaly API `no_checkout`** 으로 관리자 이미 모니터링.
- **출퇴근 이력 조회 = P0-5 `/v2/crew/attendance`** 에 이미 구현(월별 일자행 + check_in~check_out).
- v2 디렉토리 `checkout_requests` 사용처 **0건** 확인(`parking/[id]`·`anomaly`의 "checkout"은 출차/누락감지로 무관).
**잔여 미세갭(작업 불요)**: 확정 일보 퇴근시각 정정을 CREW가 관리자에 알리는 경량 채널 — 현재 관리자 직접수정으로 커버. 필요 시 사고보고류 경량 메모로 충분(전용 워크플로 신설 안 함).
**→ P1 시리즈 전부 종료**(P1-1·2·3·4·6·7·8 ✅ + P1-5 폐기). 레거시 `crew/attendance/history`·`checkout_requests` 4단 흐름은 v1→v2 일괄교체 시 함께 정리.

<details><summary>(폐기 전 보강계획 — 참고용 보존)</summary>

### 🟡 GAP-P1-5 보류 + 보강계획 (2026.05.30 선결점검)
**결론: 계획대로 진행 불가 → 후순위 보류.** 선결점검에서 헤더 전제와 실제 코드 불일치 발견.
- **레거시 `src/app/crew/attendance/history/page.tsx`의 실체** = "출퇴근 이력"이 **아님**. **퇴근요청(`checkout_requests`) 신청 이력** 페이지. 최근 30일 본인 퇴근요청 목록 + 삭제(pending) + 재요청(insert). `checkout_requests` 테이블 Supabase 직접조회.
- **막힌 이유 3가지**:
  1. v1 API에 `checkout_requests` 라우트 **없음** → 포팅하려면 신규 API 필요. "신규 API 없이 UI-only"라던 추천사유 무효.
  2. personal API(`/api/v1/attendance/personal/:empId`) 기반 **출퇴근 이력은 P0-5 `/v2/crew/attendance`에 이미 구현됨**(월별 일자행+KPI+시간통계+사업장분포). "출퇴근 이력" 해석이면 **중복**.
  3. v2 근태 = 일보(daily-report) 파생 모델. checkout_requests는 레거시 worker_attendance 흐름 소속 → v2에 "퇴근요청→승인" 워크플로를 둘지 자체가 **정책 미정**.
- **보강계획(보류해제 조건 + 작업범위)**:
  - 선행 결정: ⓐ v2에 퇴근요청/승인 워크플로를 유지할 것인가? (CREW가 일보 제출 후 퇴근시각 정정 요청 → 관리자 승인 플로우) 유지 안 하면 P1-5는 **폐기**.
  - 유지 시 작업: (A1) 신규 API `GET·POST·DELETE /api/v1/checkout-requests`(SELF: 본인 30일 목록/재요청/삭제, MANAGE: 승인/반려) (A2) `/v2/crew/attendance/history` UI — P0-5 톤 재사용, BottomNav/근태페이지에서 진입 (A3) (선택) 관리자측 승인 화면.
  - 즉, **순수 UI-only가 아니라 신규 API 동반 작업으로 재분류**. 진행 시 accidents와 동급 난이도.

</details>

### ✅ GAP-P1-3 + P1-6 선결점검 결과 (2026.05.30) — accidents, 다음 진행 대상
**확정: v1 accidents API 신규 필요(예상대로). 테이블·Storage 기존 활용.**
- **테이블명 = `accident_reports`** (※ "accidents" 아님). **사진 = Supabase Storage 버킷 `accident-photos`** (경로 `{report_id}/{ts}_{i}.{ext}`, 최대 5장).
- **레거시 위치**: admin `src/app/accident/page.tsx`(708줄), crew `src/app/crew/accident/page.tsx`. v2엔 둘 다 없음.
- **`accident_reports` 컬럼**(레거시 insert 기준): `org_id`·`store_id`·`vehicle`(대문자)·`accident_type`(라벨)·`reporter`·`phone`·`detail`·`status`·`accident_at`·`admin_memo`·`created_at`·`updated_at`.
- **상태값(한글)**: `접수` → `처리중` → `완료`.
- **⚠️ v2 정책 충돌**: 레거시는 `phone` 원본을 DB 저장. **v2 규칙=전화번호 DB 저장 금지** → accidents API에서 `phone` 필드 **제외 or 마스킹 저장**으로 변경 필요(설계 결정).
- **⚠️ 사진 업로드 설계 결정**: 레거시는 클라가 Storage 직접 upload. v2 "Supabase 직접호출 금지" 규칙과 충돌 → ⓐ CREW가 Storage 직접 upload 후 경로만 POST(현실적, Storage는 DB쿼리와 별개로 허용) vs ⓑ API가 signed-url 발급/프록시. **착수 시 ⓐ로 가는 것 추천**(네이티브 전환 시 어차피 재설계).
- **활용 가능 기존 인프라**: 권한 미들웨어(`requireAuth`), 응답 envelope(`ok/badRequest/...`), `accident-photos` 버킷, xlsx(엑셀은 클라측 유지).
- **작업 분할(권장)**:
  - **Part 1 (API)**: `src/app/api/v1/accidents/route.ts`(GET 목록+필터 store/status/기간, POST 등록) + `[id]/route.ts`(GET 상세, PATCH status·admin_memo, DELETE). 권한: 등록=OPERATE(crew 가능)/조회·수정·삭제=MANAGE. org_id 필터 필수. phone 정책 반영. **신규 SQL 불필요(테이블 기존)** — 단 RLS/버킷 정책만 확인.
  - **Part 2 (admin UI)**: `/v2/accident` — 목록(매장/상태/기간 필터)+상태변경+admin_memo+사진뷰어+엑셀+삭제. 네임스페이스 `v2ac-*`.
  - **Part 3 (crew UI)**: `/v2/crew/accident` — 사고유형 선택→차량/신고자/상세 입력→사진 최대5장 업로드→POST. P0-5/CREW 톤.

### 🔴 GAP-P1-8 (반드시) — v2 입차 차량사진 촬영 (2026.05.30 대표 확정 스펙)
**배경**: v2 입차(Part 19B-5C, 4자리 OCR 모드)에서 레거시의 차량사진 6장 촬영 단계가 누락됨. **사고 클레임의 입차 전 상태 증거**라 운영가치 큼 → "반드시 있어야 함"으로 확정. DB `tickets.vehicle_photos`(string[]) **기존 컬럼**, Storage 버킷 `vehicle-photos` 기존(레거시 경로 `{ticket_id}/...`).
**확정 요구사항 4**:
1. **퀄리티 우선(흠집 판단용)** — 클라 압축 최소화·고해상도 캡처(`getUserMedia` width/height ideal 1920↑, jpeg quality ≥0.92 또는 무압축). **인위적 용량제한 없음.** 대신 **촬영 2개월 경과 사진만 자동삭제**(ticket row는 유지, Storage 객체만 remove)로 총량 최적화 → **신규 cron `/api/cron/vehicle-photo-cleanup`**(기존 `cron/*` 패턴 + `vercel.json` crons 등록, demo-cleanup 참고).
2. **한번 활성화로 1~6장 연속촬영** — `getUserMedia` 스트림 **1회 오픈 유지**, 셔터 탭→canvas 캡처→다음 슬롯 자동진행(스트림 안 끊음). ⚠️기존 레거시는 슬롯마다 카메라 재오픈이라 끊김 → 이걸 개선.
3. **슬롯 순서·라벨 고정** — ①전면 ②후면 ③운전석(좌) ④보조석(우) ⑤추가1 ⑥추가2. 라벨 오버레이 안내, 매끄러운 시퀀스 전환.
4. **패스버튼** — (a)사진 단계 전체 스킵 (b)남은 슬롯 스킵 후 제출. **0장 제출 허용**.
**기술 메모**:
- 흐름: 4자리 입차확인 → (사진 단계: 패스 가능) → 연속촬영 → 제출. 업로드는 `POST /api/v1/tickets`로 ticket 생성 후 `ticket.id`로 `vehicle-photos/{ticket_id}/...` 업로드 → `vehicle_photos` 경로 저장(POST body 포함 가능 여부 / 아니면 PATCH 필요 — **tickets API의 vehicle_photos 수용 여부 선결 확인**).
- ⚠️ 모바일 고해상 6장=수십MB 업로드 → **진행률·실패 재시도 UX** 필요. 네이티브 전환 시 백그라운드 업로드로 대체(웹은 MVP 동작 우선).
- ⚠️ "용량제한 없음"은 입력 정책이고 Storage 총량은 플랜 한도 내 → **2개월 cleanup cron이 총량관리 핵심**.
**작업 분할(예정)**: P1-8a (tickets API의 vehicle_photos 수용 확인/보강) → P1-8b (연속촬영 UI: 스트림 1회+슬롯 시퀀스+패스) → P1-8c (cleanup cron + vercel.json). ※ 사진단계 토글은 레거시 `crew_photo_enabled` 참고하되 v2는 "패스버튼" 방식 우선.
**선결 점검 결과(2026.05.30)**: cron 인프라 존재(`src/app/api/cron/*`+vercel.json), `vehicle-photos` 버킷 기존(레거시만 사용, v2 미사용), v2 submit=`POST /api/v1/tickets`(line302). 확인 끝 — 착수 시 P1-8a부터.

**✅ P1-8a 완료(2026.05.30)** — tickets API vehicle_photos 수용 보강:
- **선결 확인 결과**: ⓐ`vehicle_photos string[]|null` 컬럼 **기존**(database.types Row/Insert/Update) → 신규 SQL 불필요. ⓑ 레거시 경로 = `{org_id}/{ticket_id}/{idx}_{label}.jpg`(org 스코프) — TODO 표기 `{ticket_id}/`보다 org 격리 우수 → **`{org_id}/{ticket_id}/` 채택**. ⓒ 레거시 흐름 = insert→upload→`vehicle_photos` update(사후 기록 확정). ⓓ 메인 PATCH `[id]`는 **MANAGE 전용** + 화이트리스트에 vehicle_photos 없음 → CREW 사용 불가 → **전용 라우트 신규 필요** 확정.
- **변경 1**: `POST /api/v1/tickets` 응답에 `photo_bucket`('vehicle-photos')·`photo_path_prefix`(`${ctx.orgId}/${ticket.id}/`) **추가**(additive, accidents API 패턴 일치). insert·body는 불변(사진은 ticket.id 확정 후 업로드되므로 POST body 수용 불가).
- **변경 2 (신규)**: `PATCH /api/v1/tickets/[id]/photos/route.ts`(OPERATE, crew可, `@ts-nocheck`, car-info 미러링). body `{vehicle_photos:string[]}`. 검증: 배열형·문자열만·trim·중복제거·**최대 6장**·각 경로 **`{org_id}/{id}/` prefix 강제**(cross-org/타티켓 주입 차단). completed 차단. **빈배열(패스) 허용**(기존값 없으면 changed:false). `vehicle_photos`+`updated_at` update, audit_logs 기록.
- 빌드 OK(`✓ Compiled in 63s`, `/api/v1/tickets/[id]/photos` ƒ). 커밋 `feat(tickets): P1-8a - vehicle_photos 수용 보강`.
- **⚠️ P1-8b/8c 인계 메모**: ①UI는 POST 응답의 `photo_path_prefix` 하위로 Storage 직접 업로드 후 그 경로배열을 `PATCH .../photos`로 전송. ②경로 포맷 `{org_id}/{ticket_id}/{idx}_{label}.jpg` 권장(cleanup cron이 prefix로 2개월 경과 객체 remove 시 활용). ③`vehicle-photos` 버킷의 crew(browser client) 업로드 정책은 accidents와 동일하게 실기기 검증 필요(막히면 버킷 정책 INSERT 허용 추가). ④패스(0장) 시 PATCH 생략 가능(또는 빈배열 PATCH→changed:false).

**▶ 다음 = P1-8b (연속촬영 UI)**: `/v2/crew/entry` 흐름에 사진 단계 삽입. `getUserMedia` 스트림 **1회 오픈 유지** + canvas 캡처로 슬롯 자동진행(①~⑥) + 라벨 오버레이 + 패스버튼(전체스킵/남은슬롯스킵). 고해상(ideal 1920↑, jpeg q≥0.92). 업로드 진행률·재시도 UX. accidents Part 3의 Storage 직접업로드 패턴 그대로 응용.

### ✅ GAP-P1-3/6 Part 3 완료 (2026.05.30) — crew `/v2/crew/accident` UI 신규 (accidents 3파트 전체 완료)
**UI만 — 신규 API·SQL 없음.** Part 1 accidents API(`POST /api/v1/accidents`) + `auth/me` + Storage(`accident-photos`)만 사용.
**구현** `src/app/v2/crew/accident/page.tsx`(신규 1파일, 네임스페이스 `cv2ac-*`):
- **3-step 흐름**(레거시 톤 유지): ①유형선택(5종, 라벨 동일) → ②차량정보 → ③보고내용(상세+사진+제출요약) → 완료(step99). 헤더=v2 NAVY gradient(`cv2-entry-header` 패턴), 뒤로가기=step0이면 `/v2/crew`로/그 외 이전 step.
- **v2 정책 반영(레거시 대비 변경점)**:
  - ⚠️ **차주 연락처 입력 칸 제거** — v2 phone DB 미저장 정책(API도 무시). 레거시엔 STEP1에 phone 입력이 있었음.
  - **reporter 자동** — `GET /api/v1/auth/me` → `employee.name`(없으면 emp_no→"크루"). 입력 안 받음.
  - **store_id** = localStorage `crew_store_id`(없으면 `/v2/crew/login` 리다이렉트). storeName도 localStorage.
  - **등록 = `POST /api/v1/accidents`**(`credentials:include`) body `{store_id, vehicle(대문자), accident_type=라벨, reporter, detail}`. Supabase 직접 insert 제거.
  - **사진 업로드** = POST 응답의 `photo_bucket`(=`accident-photos`)·`photo_path_prefix`(=`{id}/`)로 **browser supabase client storage 직접 upload**(Part 1 설계 ⓐ). 경로 `{id}/{ts}_{i}.{ext}`, contentType 지정. **업로드 진행률 바**(done/total) 표시. 사진 업로드 실패해도 `console.error`만 하고 **보고 접수는 성공 처리**(격리).
- **crew 홈 진입점 추가**(`src/app/v2/crew/page.tsx`, additive): '빠른 액션' 아래에 사고보고 카드(경고 삼각 아이콘+"스크래치·주차사고·분실 등 현장 보고") → `/v2/crew/accident`. ※BottomNav는 5칸 고정(settings 미구현)이라 건드리지 않고 홈 카드로 진입.
- 디자인 NAVY `#1428A0`/GOLD/숫자 Outfit, `cv2ac-*` 네임스페이스. v2 crew layout(BottomNav 자동) 상속.
- 빌드 OK (`✓ Compiled in 74s`, `/v2/crew/accident` 정적 `○`, 112p). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 실기기 검증 시 확인(미검증)**:
1. **Storage `accident-photos` 버킷의 crew 업로드 정책** — browser client(anon+세션)로 `{id}/` 경로 upload가 RLS/버킷 정책상 허용되는지. 레거시가 동일 방식으로 클라 직접 업로드했으니 열려있을 가능성 높음(Part 1·2 메모 동일). 막히면 버킷 정책에 인증세션 INSERT 허용 추가 or API signed-url 프록시(설계 ⓑ)로 전환.
2. admin `/v2/accident`에서 crew가 올린 사진이 signedUrl로 정상 표시되는지(end-to-end).
3. crew가 자기 배정 매장에만 등록되는지(API가 `ctx.storeIds` 검증 — store_id 불일치 시 403).
**▶ 다음 = 🔴 P1-8 (반드시)**: v2 입차 차량사진 6장 연속촬영. P1-8a(tickets API `vehicle_photos` 수용 확인)부터. 본 Part 3에서 검증한 Storage 직접업로드 패턴이 P1-8 사진 업로드에 그대로 응용됨.


**UI만 — 신규 API·SQL 없음.** Part 1 accidents API + 기존 `/api/v1/stores`만 호출.
**구현** `src/app/v2/accident/page.tsx`(신규 1파일, 네임스페이스 `v2ac-*`):
- **KPI 4카드**: 이번 달 사고 / 접수 / 처리중 / 완료. **로드된 매장-스코프 전체 기준**으로 계산(상태·기간 클라필터와 무관하게 정확).
- **필터**: 매장(API `store_id`로 서버 스코핑 + 재조회) · 상태(클라) · 기간(클라: 이번달/3개월/올해/전체). 상태·기간을 클라로 둔 이유 = KPI 카운트 정확도 유지(레거시 동일 전략).
- **목록**: 카드 그리드(auto-fill minmax 300px → 모바일 1열). 카드=차량번호·상태뱃지·사고유형·매장·일시·보고자.
- **상세 모달**(`GET /api/v1/accidents/:id`): 기본정보 + 크루 보고내용 + **상태변경 3버튼→PATCH** + **관리자 메모 textarea→PATCH** + **사진뷰어**(GET이 내려준 `photos[].url` signedUrl, 썸네일 그리드 + 클릭 라이트박스) + **삭제**(DELETE, confirm). 변경 시 목록 state도 동기 갱신.
- **엑셀**(클라 xlsx 유지): 현재 필터 결과 다운로드. ⚠️ **`차주 연락처` 컬럼 제거**(v2 phone 미저장 정책 — 레거시엔 있었음). 컬럼=사고일시/매장/유형/차량/보고자/상태/보고내용/메모/접수일시.
- 디자인 NAVY/GOLD/Outfit, `v2ac-*`. 레이아웃은 `/v2/layout.tsx` 자동(AppLayout import 안 함).
- 빌드 OK (`✓ Compiled in 79s`, `/v2/accident` 정적 `○`, 111p). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 실기기 검증 시 확인**: Storage `accident-photos` 버킷의 인증세션 list/signedUrl 정책(Part 1 메모 참조). 레거시가 클라 직접조회를 했으니 열려있을 가능성 높음 — Part 3(crew 업로드) 검증 시 함께.
**▶ 다음 = Part 3 (crew UI)**: `src/app/v2/crew/accident/page.tsx` 신규. 사고유형 선택 → 차량/신고자/상세 입력 → `POST /api/v1/accidents`(응답 `photo_path_prefix`·`photo_bucket` 수령) → 사진 최대5장 Storage `accident-photos/{id}/`에 **직접 업로드**(Part 1 설계 ⓐ). 레거시 `src/app/crew/accident/page.tsx` 참고, P0-5/CREW 톤. CREW BottomNav에서 진입.
**Sidebar 메뉴 교체 보류**: `/accident`→`/v2/accident` 라우팅 정합은 v1→v2 일괄교체 단계에서(현재 레거시 유지 중).

### ✅ GAP-P1-3/6 Part 1 완료 (2026.05.30) — accidents API 신규
**신규 SQL 없음**(accident_reports 기존). 신규 파일 2개:
- `src/app/api/v1/accidents/route.ts`
  - **GET** 목록. 필터: `store_id`·`status`(접수/처리중/완료)·`from`·`to`(accident_at 범위). admin/super=전체(또는 store_id), crew/field=배정매장만(`ctx.storeIds` `.in`, 빈배열이면 `[]`). `stores(id,name)` 조인. 정렬 accident_at desc.
  - **POST** 등록(OPERATE). 필수 `store_id`·`vehicle`(자동대문자)·`accident_type`·`reporter`, 선택 `detail`·`accident_at`(미지정=now). 사업장 org소유+crew 배정 검증. **`phone`은 받아도 무시하고 null 저장(v2 정책)**, `reported_by=ctx.userId`, `status='접수'`. 응답에 `photo_path_prefix:"{id}/"`·`photo_bucket:"accident-photos"` 동봉(클라가 이 경로로 Storage 직접 업로드).
- `src/app/api/v1/accidents/[id]/route.ts`
  - **GET** 상세(OPERATE, crew는 배정매장 건만). Storage `accident-photos`의 `{id}/` list→`createSignedUrls`(1h) → `photos:[{name,url}]` 동봉. 사진조회 실패해도 본체 반환(격리).
  - **PATCH** status / admin_memo (MANAGE). 상태값 검증. 둘 다 없으면 400.
  - **DELETE** (MANAGE). 삭제 후 `{id}/` 사진 일괄 remove(격리).
- 모두 `requireAuth`·envelope·org_id 필터·audit log(insert/update/delete) 적용. action은 등록='insert'(기존 정합).
- 빌드 OK (`✓ Compiled in 71s`, 110p). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 실동작 선결 확인(Part 2 전 or 중)**: Storage 버킷 `accident-photos`의 **RLS/정책**이 (a)인증 세션의 list/signedUrl 허용 (b)crew의 `{id}/` 업로드 허용 인지 — 레거시가 클라 직접 업로드/조회를 했으니 정책은 이미 열려있을 가능성 높음. Part 3(crew 업로드) 실기기 검증 시 함께 확인.
**▶ 다음 = Part 2 (admin UI)**: `src/app/v2/accident/page.tsx` 신규(네임스페이스 `v2ac-*`). 레거시 `src/app/accident/page.tsx`(708줄) 기능 이식 — KPI(접수/처리중/완료) + 매장·상태·기간 필터 + 카드/행 리스트 + 상세모달(상태 select→PATCH, admin_memo 저장→PATCH, 사진뷰어=GET 상세의 photos) + 엑셀(xlsx 클라측 유지) + 삭제. **API-first**(Supabase 직접호출 금지), `credentials:"include"`, NAVY/GOLD/Outfit. Sidebar 메뉴 `/accident`→`/v2/accident` 교체는 라우팅 정합 단계에서(현재 레거시 유지 중).

 — `/v2/dashboard` 금일 출근 KPI 카드 (UI-only)
**신규 API·SQL 없음.** `src/app/v2/dashboard/page.tsx`만 additive 편집.
- **추가 카드(5번째)**: title "금일 출근", value `출근/재직`(예 `12 / 25`), sub `출근율 N%·재직 M명`. 기존 KPI 4카드 grid(auto-fit minmax 220px)에 자연 합류.
- **데이터 경로**: ①총직원 = `GET /api/v1/employees?limit=1` → 응답 `meta.total`(기본필터 `퇴사` 제외 = `/v2/team` 목록 기준과 일치). ②출근 = `GET /api/v1/attendance?year&month`(오늘 기준 year/month) → `matrix[empId][오늘].status`가 {`present`,`late`,`peak`,`support`,`additional`} ∈ 이면 카운트. **v2 근태는 일보(daily-report) 파생이라 이 API가 정합**(레거시는 worker_attendance 직접조회였음 — v2에선 사용 안 함).
- **격리**: hr fetch는 메인 Promise.all 밖 별도 `try`로 감쌈 → 실패해도 카드만 "—", 대시보드 본체(매출/차량/추이 등) 무영향. `fetchMetaTotal()` 헬퍼 신설(기존 `fetchJson`은 data만 반환해 meta 못 읽음).
- **`KpiCard` 변경**: `hideChange?: boolean` prop 추가 + '직전 대비' 행을 `{!hideChange && …}`로 래핑. 출근 카드는 비교대상 없어 `hideChange`. **기존 4카드는 prop 미전달 → 동작 불변.**
- 신규 state `hr: {present,total}|null`. todayStr()는 브라우저 로컬(=KST)이라 그대로 사용.
- 빌드 OK (`✓ Compiled in 67s`, `/v2/dashboard` 정적 `○` 유지, 109p). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 알아둘 점**: 그날 일보가 한 건도 제출 안 됐으면 출근=0으로 표시됨(정상 — v2는 일보 기반). 실시간 체크인 개념이 필요하면 별도 근태 엔드포인트 논의 필요.
**▶ 다음(추천 ⑤ → P1-5)**: `/v2/crew/attendance/history` — CREW 본인 출퇴근 이력. `GET /api/v1/attendance/personal/[empId]` 기존 존재 → **신규 API 없이 UI-only**. 레거시 `src/app/crew/attendance/history/page.tsx` 참고, `/v2/crew/attendance`(P0-5) 톤 재사용. CREW BottomNav/근태 페이지에서 진입.

### ✅ GAP-P0-2b 파트2 완료 (2026.05.30) — `/v2/team` 직원 등록 모달 + 관리자 계정 생성 폼 (P0 마무리)
**UI만 — 신규 API·SQL 없음.** 파트1에서 만든 `POST /api/v1/auth/admin-account` + 기존 `POST /api/v1/employees`만 호출.
**구현** `src/app/v2/team/page.tsx`:
- ① **[직원 등록] 모달 신설** — 헤더 우측 + 빈상태에 [+ 직원 등록] 버튼. 모달 필드: `emp_no`·`name`·`hire_date`(필수, hire_date 기본=오늘) + `role`(크루/필드/관리자, 기본 crew)·`position`·`phone`(선택). `POST /api/v1/employees` → 사번 자동 대문자. **사번중복 409 시 서버 `error.details.suggestion`을 메시지에 노출**(예: "추천 사번: C001-2"). 성공 시 모달 닫고 `load()`.
- ② **관리자 placeholder → 실제 계정 생성 폼 교체** — 상세모달 계정섹션의 `isAdminRole` 분기(기존 ⚠️안내박스)를 email+password(6자↑) 입력 + [관리자 계정 생성] 버튼으로 교체. 클라 검증(이메일정규식·6자) 후 `POST /api/v1/auth/admin-account {employee_id,email,password}`. ⚠️ **응답에 비번 없음(수동입력)** → 기존 crew처럼 `pwReveal` 안 띄우고 `actionMsg`(성공메시지)만 + `refreshDetail()`. super_admin이면 "최고관리자만 생성 가능" 안내문 추가(서버도 차단).
- ③ **"추후 지원" 문구 제거 2곳** — 헤더 부제 `(관리자 계정 생성은 추후 지원)` 삭제(→ "직원 등록 · 계정 · 매장 배정 · 역할 관리"), 빈상태 `직원 등록은 기존 직원관리에서` → `상단 [+ 직원 등록]으로…`.
- 신규 상태: `showCreate`·`createForm`·`createBusy`·`createErr`(등록모달), `adminEmail`·`adminPw`(관리자폼, openDetail/close 시 초기화). 디자인 NAVY/GOLD/Outfit, `v2tm-*` 네임스페이스 재사용.
- 로컬 빌드 OK (`✓ Compiled successfully in 74s`, `/v2/team` 정적 `○` 유지, 109 pages). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 실기기 검증 전 선행(파트1 대기항목)**: ① Supabase에서 `sql/v2/14` 실행 ② Vercel env `SUPABASE_SERVICE_ROLE_KEY` 등록 확인 ③ 관리자 계정 생성/crew 계정생성·리셋·차단 실동작 확인.
**④ 미반영(후속 후보, P1)**: 직원 정보 **수정 모달**(PUT, hire_date·position 등 인라인 편집) — 파트2 핵심 3건에서 제외. 필요 시 별도 모달로.
**▶ 다음**: v1→v2 **라우팅 일괄교체**(Sidebar·MobileTabBar 메뉴 `/stores`·`/team`·`/parking-status` → `/v2/*`). P0 5건이 v2에 모두 갖춰져 진입점만 전환하면 됨. (또는 P1 7건 중 선택)


**🔴 핵심 발견(검토 중)**: `@/lib/supabase/server`의 `createClient()`는 **anon키+세션** 기반인데, v1 auth 라우트 5개가 이걸로 `supabase.auth.admin.*`(관리자 전용 API)를 호출 → service_role 키가 없어 **실패(403)**. 즉 P0-2a `/v2/team`의 [계정 생성]·[비번 리셋]·[차단/해제] 버튼이 실기기에서 에러날 가능성 높았음(아직 v2로 계정 만든 적 없어 미발현). 레거시 `/api/team/create-account`만 별도 service-role 써서 정상.
**구현(파트1)**:
- **신규** `src/lib/supabase/admin.ts` — `createAdminClient()` (service_role, RLS 우회, auth.admin.* 전용). env: `SUPABASE_SERVICE_ROLE_KEY` 필요(Vercel 등록 확인).
- **수정(additive)** v1 auth 5라우트 — `auth.admin.*`(createUser/updateUserById) + 타 사용자 profiles 쓰기만 `admin` 클라이언트로 교체. 권한체크·조회는 기존 anon 세션 유지. → `create-account`·`bulk-create`·`reset-password/[id]`·`ban/[id]`·`unban/[id]`.
- **신규** `POST /api/v1/auth/admin-account` `{ employee_id, email, password }` (MANAGE) — 관리자(admin/super_admin) 실이메일 계정. role이 admin/super_admin 아니면 거부(crew/field는 create-account). **super_admin 생성은 super_admin만**(권한상승 방지). 이메일형식·6자 검증·중복(profiles by employee_id, 이메일) 처리. profiles에 `employee_id`·`emp_no`·`role`·`name`·`password_changed:false` upsert. 비번은 수동입력이라 응답에 노출 안 함.
- **수정(additive)** `employees/[id]` PUT `allowedFields`에 **`hire_date`·`status` 추가**. 단 `status='퇴사'`는 거부(전용 resign/DELETE 워크플로 보호).
- **신규 SQL** `sql/v2/14-legacy-admin-migration.sql` (멱등) — 레거시 관리자(profiles에 employee_id NULL인 admin/super_admin)에 employees 행 생성(emp_no=`ADM###`, hire_date=auth.users.created_at) + profiles.employee_id 연결. **대표님 mepark1022 계정 포함**. 로그인/권한엔 영향 없고 v2 목록 가시화 목적.
- 로컬 빌드 OK (`✓ Compiled in 73s`, `/api/v1/auth/admin-account` 동적 `ƒ` 등록). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⏳ 검증/실행 대기 (대표님)**:
1. **`sql/v2/14` 실행** — Supabase SQL Editor. 실행 전 파일 ① 미리보기 SELECT로 대상 확인 권장.
2. **Vercel env `SUPABASE_SERVICE_ROLE_KEY` 등록 여부 확인** (없으면 admin API 전부 실패).
3. **실기기 검증** — `/v2/team`에서 crew 계정 생성/비번리셋/차단·해제가 실제 동작하는지(파트1 버그수정 효과 확인).
**▶ 파트2(UI, 다음 세션)**: `/v2/team` 페이지(`src/app/v2/team/page.tsx`, 네임스페이스 `v2tm-*`)에 ① [직원 등록] 버튼+모달(POST `/api/v1/employees`, 필수 emp_no·name·hire_date + role·phone·position) ② 상세모달의 관리자 placeholder(line~518)를 실제 [관리자 계정 생성] 폼(email+password → POST `/api/v1/auth/admin-account`)으로 교체 ③ (선택) 직원 정보 수정 모달(PUT, hire_date 포함). 헤더 안내문구 "관리자 계정 생성은 추후 지원" 제거.

### ✅ GAP-P0-2a 완료 (2026.05.29) — `/v2/team` 직원 관리 (목록 + 상세모달 액션)
**선결 확인 결과**: A안(단계분리) 그대로. 활용 API 전부 기존, **신규 API 1개만 추가**(코드만, SQL無 — store_members 기존 테이블).
**신규 API** `src/app/api/v1/employees/[id]/stores/route.ts`:
- `POST` — 매장배정 **replace-set**(멱등). body `{ store_ids: string[], primary_store_id? }`. 동작: ①store_ids 각 매장 `upsert`(onConflict `org_id,employee_id,store_id` → is_active=true·is_primary=primary만·assigned_by/at 갱신·deactivated_at=null) ②store_ids에 없는 기존 활성배정 `is_active=false`+`deactivated_at` ③감사로그. 입력검증: store_ids 배열·중복제거·primary는 store_ids 포함必·각 store가 같은 org 소유인지 검증(아니면 STORE_NOT_FOUND). 권한 MANAGE, org_id 필터.
- `GET` — 현재 활성 배정 반환(편의용, 상세 API가 이미 동봉하므로 필수 아님).
**페이지** `src/app/v2/team/page.tsx`(신규, 네임스페이스 `v2tm-*`):
- **목록**: 검색(이름/사번)·역할필터·계정유무필터(`has_account`)·재직상태필터. 카드 = 이름·사번·직책·역할배지·상태배지·**계정 있음/없음 배지**. ⚠️성능상 카드엔 매장칩 미표기 — 목록 API가 employees.*만 반환(account·store_members 미동봉)하므로 계정배지는 `has_account=true` 동일필터 1콜로 id집합 산출(총 2콜). 매장칩·잠금·최근로그인은 상세모달에서.
- **상세 모달**(카드 클릭 → `GET /api/v1/employees/:id`): 계정섹션(있음→비번리셋/차단·해제 · 없음+crew/field→계정생성 · 없음+admin→**P0-2b 안내문구로 비활성**) + 역할섹션(crew↔field_member select, admin은 read-only) + 매장배정섹션(체크박스 멀티선택 + '주' 라디오 → 신규 POST) + 제거섹션(soft DELETE).
- **비번 1회노출 모달**: 계정생성/리셋 후 `initial_password`/`masked_password` 1회 표시(Outfit, 네이비).
- API-first(Supabase 직접호출 없음), `credentials:"include"`, envelope `{success,data,error}`. 디자인 NAVY `#1428A0`/GOLD `#F5B731`, 숫자 Outfit, maxWidth 1400.
- 로컬 빌드 OK (`✓ Compiled successfully in 66s`, `/v2/team` 정적 `○`, `/api/v1/employees/[id]/stores` 동적 `ƒ` 등록). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 미반영(후속 후보)**:
- **P0-2b**: 관리자(admin/super_admin) 실이메일 계정 생성. 모달에 안내문구만 있고 버튼 없음. + 레거시 `team/create-account`로 만든 관리자(employees 행 無)의 마이그레이션.
- 직원 **신규 등록/수정**(emp_no·name·hire_date 등)은 본 페이지 미포함 — 레거시 `/team` 또는 후속 모달로. 본 P0-2a는 "계정·배정·역할·제거" 운영 액션 중심.
- Sidebar 메뉴 `/team`→`/v2/team` 교체는 v1→v2 라우팅 일괄단계에서.

### ⏭️ GAP-P0-2 착수 결정 블록 (2026.05.29 확정 — 다음 세션용)
**선결 점검 완료 → A안(단계분리) 확정.**

**⚠️ 모델 분기(중요)**: v2 전 스택(`auth/me`·`employees` API·`store_members`)은 `profiles.employee_id` 키로 동작. 그러나 레거시 `/api/team/create-account`가 만든 **관리자 계정은 `employees` 행 없이 `profiles`+`workers`에만** 존재 → v2 직원목록에 안 잡히고 store_members가 레거시 `user_id` 키일 수 있음. (레거시 관리자 마이그레이션은 P0-2b 이후 별도 과제)

**기존 활용 API(전부 존재)**:
- `GET /api/v1/employees?has_account=&store_id=&role=&status=&search=` — 직원 목록(퇴사 기본제외). `has_account=false`는 서버 클라필터.
- `GET /api/v1/employees/:id` — 상세(`store_members`[employee_id·is_active]·`account`{user_id,role,password_changed,last_login_at,...} 동봉).
- `POST /api/v1/auth/create-account` `{ employee_id }` — **crew/field_member 전용**(내부이메일 자동생성, 관리자는 막힘). 초기PW=뒤4자리+12, 마스킹 반환.
- `POST /api/v1/auth/reset-password/:id` — 비번 리셋.
- `POST /api/v1/auth/ban/:id` · `POST /api/v1/auth/unban/:id` — 계정 차단/해제.
- `PUT /api/v1/employees/:id` — 직원 수정(allowedFields에 **role 포함** → 역할변경 가능). `DELETE /api/v1/employees/:id` — 제거(soft). `resign`/`reinstate` 별도.

**🆕 P0-2a에서 만들 신규 API 1개 (코드만, SQL無 — store_members 테이블 기존)**:
- `POST /api/v1/employees/[id]/stores` — 매장배정 **replace-set**.
  - body `{ store_ids: string[], primary_store_id?: string }`.
  - 동작: 지정된 store들 upsert(`employee_id`,`store_id`,`org_id`,`is_active=true`,`assigned_by=ctx.userId`,`assigned_at=now`), `is_primary`는 primary_store_id만 true. 목록에 없는 기존 배정은 `is_active=false`,`deactivated_at=now`.
  - 권한 MANAGE. org_id 필터 필수. 멱등.
  - (선택) 같은 라우트에 `GET`으로 현재 배정 반환해도 됨. 단 상세 API가 이미 동봉하므로 불필요할 수 있음.

**P0-2a 페이지** `src/app/v2/team/page.tsx`(신규, 네임스페이스 예: `v2tm-*`):
- 직원 목록(검색·역할/계정유무/상태 필터·카드그리드) — 각 카드: 이름·사번·역할배지·계정상태(있음/없음·잠금)·배정매장칩.
- 액션: [계정 생성](crew/field만, 생성 후 **초기PW 1회 노출** 모달) · [비번 리셋](리셋PW 1회 노출) · [차단/해제] · [역할 변경](crew↔field_member 등 권한규칙 내) · [매장 배정](멀티선택+primary 지정 → 신규 API) · [제거].
- ⚠️ **관리자(admin/super_admin) 계정 생성 버튼은 P0-2a에서 비활성/숨김** → P0-2b.
- API-first(Supabase 직접호출 금지), `credentials:"include"`, 응답 envelope `{success,data,error}`. 디자인 NAVY `#1428A0`/GOLD `#F5B731`, 숫자 Outfit.

**P0-2b (후속, 정책 재확정 후)**: 관리자 실이메일 계정 생성. 후보 = 신규 `POST /api/v1/auth/admin-account`(employees role=admin + profile + store_members 일괄, 수동 email/pw). 레거시 관리자 계정의 employees 연결 마이그레이션 포함 검토.

### ✅ GAP-P0-3 완료 (2026.05.29) — `/v2/parking-status` 실시간 입차현황 + 강제출차
**선결 점검 결과**: 필요한 API가 **전부 기존 존재** → SQL·라우트 신설 없이 **UI만**. `tickets/active` select에 `pre_paid_deadline`·`additional_fee` **가산만**(Part 13D-B와 동일한 additive 편집, 기존 폴링 동작 불변).
**사용 API(전부 기존)**:
- `GET /api/v1/tickets/active` — 미완료 티켓(admin=전체매장 / crew=배정매장). visit_places·stores·parking_lots 조인 동봉(요금계산용).
- `PATCH /api/v1/tickets/:id/plate` `{ plate_number }` — 번호판 수정(OPERATE, 숫자4자리↑ 검증, completed 불가).
- `POST /api/v1/fee/calculate` `{ entry_time, store_id, visit_place_id?, is_valet?, ticket_id }` — 요금계산(월주차/무료는 0 반환, 방문지>매장 요금체계). 응답 `{ total_fee, breakdown{parking_fee,valet_fee,daily_max_applied}, elapsed_minutes, is_monthly, is_free }`.
- `PATCH /api/v1/tickets/:id/complete` `{ calculated_fee, payment_method? }` — 출차 처리. **무료출차=calculated_fee:0**. ⚠️ field_member는 출차권한 없음(서버 차단).
**구현** `src/app/v2/parking-status/page.tsx`(신규, 네임스페이스 `v2ps-*`):
- KPI 4칸(주차중/사전정산/출차요청/⚠️유예초과) + 탭(입차현황 / ⚠️유예초과) + 매장필터(활성티켓 기준 자동) + 차량번호 검색.
- 카드리스트(반응형 grid, 표 대신 카드 — 1B/1C 톤): 번호·매장·상태배지(parking/pre_paid/exit_requested/overdue)·월주차/무료 배지·입차/경과·위치(parking_lots>parking_location)·차종/색. **초과 카드**엔 마감시각·N분초과·추가요금.
- 번호판 수정 모달(PATCH plate). 강제출차 모달: 열 때 fee/calculate 선조회 → 정산금액·breakdown 표기 → [🆓 무료출차] / [💳 N원 출차](결제수단 칩: 현금/카드/계좌이체/기타). 월주차·무료차량은 무료출차만 노출.
- 상태값 집합: `parking`(입차 초기)·`pre_paid`·`overdue`·`exit_requested`·`completed`. **15초 자동 갱신**(silent) + 수동 새로고침.
- 로컬 빌드 OK (`✓ Compiled successfully in 62s`, `/v2/parking-status` 정적 `○` 등록). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 미반영(후속 후보)**: 출차완료(`completed`) 목록/오늘출차 KPI는 active 엔드포인트가 미완료만 반환 → 필요 시 `GET /api/v1/tickets`(날짜필터)로 별도 탭. 강제출차 시 정산완료 알림톡/전화번호 입력은 미연동(complete가 `phone` optional 수신은 함). Sidebar 메뉴 `/parking-status`→`/v2/parking-status` 교체는 v1→v2 라우팅 일괄단계에서.

### ✅ GAP-P0-1 / 1C 완료 (2026.05.29) — 방문지(visit_places) 요금표 관리
**선결 확인 결과**: 1B와 동일하게 visit-places 개별 **PUT/DELETE 라우트 이미 존재** (`src/app/api/v1/visit-places/[id]/route.ts`) → **SQL·라우트 신설 없이 UI만 작성**.
**사용 API(전부 기존)**: `GET·POST /api/v1/stores/:id/visit-places`(목록/등록) / `PUT·DELETE /api/v1/visit-places/:vpId`(수정/삭제). 권한 MANAGE.
**visit_places 요금 모델(9필드, 레거시 stores 폼과 동일)**: `name`(필수)·`floor`(선택)·`free_minutes`(무료분)·`base_fee`/`base_minutes`(기본요금/시간)·`extra_fee`(추가 원/분)·`daily_max`(0=무제한)·`valet_fee`·`monthly_fee`.
**구현 (1C, 기존 1B 페이지에 섹션 추가)** `src/app/v2/stores/[id]/page.tsx`:
- 주차장 섹션 **아래**에 「방문지 요금표」 섹션 신설 — 헤더(개수+추가버튼) + `require_visit_place` 켜진 사업장엔 골드 경고배너(최소 1곳 등록 안내) + 카드리스트(방문지명·층배지·기본요금 강조 + 무료/기본시간/추가/일최대/발렛/월정기 2열 요약 + 수정/삭제) + 빈상태.
- 방문지 모달: 방문지명/층 + 요금 6필드(2열) + 월정기 + **요금 요약 프리뷰**("무료 N분 후 → 기본 ₩X, 이후 1분마다 ₩Y · 일 최대 …"). 음수 입력 차단.
- API-first(Supabase 직접호출 없음), `loadVisitPlaces()` 별도 로더로 CRUD 후 갱신. 디자인은 1B의 `v2d-*` 네임스페이스/NAVY·GOLD/Outfit 숫자 그대로 재사용.
- 로컬 빌드 OK (`✓ Compiled successfully in 71s`, `/v2/stores/[id]` 동적 `ƒ`, 106 pages). 경고 2건은 기존 `ticket/[id]` Toss SDK 미설치로 무관.
**⚠️ 작업 중 함정(기록)**: 신규 모달을 파일 끝에 str_replace로 삽입할 때 직전 주차장 모달의 닫는 `)}`를 같이 소비 → 파싱에러. 모달 블록 끝 `)}` 보존 확인할 것.
**다음(1D, 후순위)**: 동일 페이지에 운영시간(store_hours)·근무조(shifts)·지각규칙 섹션. 근무조·지각규칙은 B안 근태와 연계 → 근태 B안 방향 확정 후 진행 권장. 레거시 모달은 `src/app/stores/page.tsx`의 `modalType==="hours"|"shifts"` 참고.

### ✅ GAP-P0-1 / 1B 완료 (2026.05.29) — 사업장 상세 + 주차장(면수) CRUD
**핵심 발견**: 분할안 메모엔 "parking-lots PUT/DELETE 라우트 신설 필요"라고 적혀 있었으나, **이미 Part 8에서 생성됨** → `src/app/api/v1/parking-lots/[id]/route.ts`(PUT·DELETE 보유). **API 전부 기존, SQL·라우트 신설 없이 UI만 작성**.
**사용 API(전부 기존)**: `GET /api/v1/stores/:id`(parking_lots·visit_places·staff_count 동봉) / `GET·POST /api/v1/stores/:id/parking-lots`(목록+면수 summary / 등록) / `PUT·DELETE /api/v1/parking-lots/:lotId`(수정/삭제).
**구현**:
- **신규** `src/app/v2/stores/[id]/page.tsx` — (a) 뒤로가기 + 사업장 헤더(명·코드·삭제배지) (b) 사업장 정보 요약카드(운영토글 배지·담당/연락·유예·발렛요금·배정직원) (c) **면수 합계 4칸**(총면수 네이비 강조 + 자주식/기계식일반/기계식SUV) (d) 주차장 카드리스트(구분·방식 배지·면수내역·주소) (e) 주차장 추가/수정/삭제 모달. API-first, Supabase 직접호출 없음.
- 주차장 모달 필드: `name`(필수)·`lot_type`(내부/외부 칩)·`parking_type`(자주식·기계식 복수 칩, 최소1개)·면수 3종(미선택 방식은 disabled+0 처리)·`road_address`(선택). 저장 시 합계 실시간 표기.
- **수정** `src/app/v2/stores/page.tsx`(1A, v2 신규코드) — `Link` import + active 카드 액션에 **[관리]** 버튼 추가(상세 `/v2/stores/${id}` 진입점). 기존 [수정][삭제] 유지.
- ⚠️ **면수 = self_spaces + mechanical_normal + mechanical_suv** 일관 적용(stores.total_spaces 미사용).
- 디자인: `v2d-*` CSS 네임스페이스(1A의 `v2s-*`와 분리), NAVY `#1428A0`/GOLD `#F5B731`, 숫자 Outfit, maxWidth 1100.
- 로컬 빌드 OK (`✓ Compiled successfully`, `/v2/stores/[id]` 동적 `ƒ` 등록). 경고 2건은 기존 `/ticket/[id]` Toss SDK 미설치 이슈로 무관.
**다음(1C)**: `/v2/stores/[id]` 동일 페이지에 **방문지(visit_places) 요금표 섹션** 추가. visit-places API는 `GET·POST /api/v1/stores/:id/visit-places` 존재 — 개별 PUT/DELETE 라우트 유무 **착수 전 확인 필요**(1B처럼 이미 있을 수 있음). require_visit_place 토글과 연계.

### ✅ GAP-P0-1 / 1A 완료 (2026.05.29) — 사업장(stores) 관리 페이지
**분할안**: 1A 사업장 CRUD → 1B 사업장 상세+주차장(면수) → 1C 방문지 요금표 / 1D(후순위) 운영시간·근무조·지각규칙(근무조·지각규칙은 B안 근태와 연계). 관련 테이블 모두 기존 존재 → **SQL 실행 불필요**.
**구현 (1A)**:
- **신규** `src/app/v2/stores/page.tsx` — 목록(검색·운영중/삭제됨 필터·카드그리드) + 등록/수정 모달 + soft-delete + 복원. API-first.
- 사용 API(전부 기존): `GET/POST /api/v1/stores`, `PUT/DELETE /api/v1/stores/:id`, `POST /api/v1/stores/:id/restore`, `GET /api/geocode/forward`(주소→좌표).
- 폼 필드: 기본정보(명·코드·시도·구군·도로명주소+좌표검색·담당/연락처) + 수치(gps_radius_meters·grace_period_minutes·valet_fee) + 운영토글 8종(has_valet·is_free_parking·has_kiosk·has_toss_kiosk·enable_monthly·enable_plate_search·require_visit_place·require_entry_photo).
- 레이아웃: `/v2/layout.tsx`가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용. 루트 `padding:20,maxWidth:1400`.
- 로컬 빌드 OK (`✓ Compiled`, `/v2/stores` 정적 등록, 106 pages).
**다음(1B)**: `/v2/stores/[id]` 상세 페이지 + 주차장 목록/추가/수정/삭제. ⚠️ parking-lots는 현재 **GET/POST만** → `/api/v1/stores/[id]/parking-lots/[lotId]` **PUT/DELETE 라우트 신설 필요**(코드만, SQL無). 면수 = self_spaces+mechanical_normal+mechanical_suv.
> ※ Sidebar 메뉴는 아직 레거시 `/stores`를 가리킬 수 있음 — v1→v2 라우팅 일괄교체는 별도 단계(P0 마무리 후).

### ✅ GAP-P0-5 완료 (2026.05.29) — CREW 개인 근태 조회 페이지 신설 (404 해소)
**배경**: CREW BottomNav에 `출퇴근` 탭(`/v2/crew/attendance`)이 배포돼 있는데 페이지가 없어 **라이브 404** 상태였음. (`설정` 탭 `/v2/crew/settings`도 동일 404 — GAP-P2-4로 잔존)
**모델 충돌 확인(중요)**: 레거시 `/crew/attendance`는 GPS 지오펜스 자가 체크인 → `worker_attendance`(`workers.id`) 기록. 반면 **v2 근태 어드민은 `daily_reports.daily_report_staff` + `attendance_overrides`(`employees.id`)에서 집계** → 자가체크인 테이블 없음. 레거시 그대로 포팅 시 데이터가 어드민에 안 잡힘.
**결정**: **A안(읽기 전용 개인 근태 조회 뷰) 먼저 → GPS 자가 체크인(B안)은 후속 파트로 분리.**
**구현**:
- **신규** `src/app/v2/crew/attendance/page.tsx` — `/api/v1/auth/me`로 본인 `employee.id` 획득 → `GET /api/v1/attendance/personal/:empId?year=&month=`(Part 11A) 호출. Supabase 직접호출 없음(API-first).
- 구성: 네이비 헤더 + 월 네비게이션(미래 차단) / KPI 4칸(출근일·근무시간·지각·결근) / 근무시간 통계(평균·최대·최소) / 사업장별 근무(2곳+일 때) / 일자별 기록 카드리스트(최신순, 상태배지·출퇴근시각·근무시간·매장) / 직원 미연결·빈상태·에러 처리.
- 디자인 토큰: CREW 네이비 `#1428A0`/`#0a1352`, 골드 `#F5B731`, bg `#F8FAFC`, 숫자 Outfit. layout이 NavSpacer+BottomNav 처리.
- 로컬 빌드 OK (`✓ Compiled successfully`, `/v2/crew/attendance` 정적 등록).
**후속 후보**: B안 — 신규 `employee_attendance` 테이블 + `/api/v1/attendance/check-in|check-out|cancel` write API + 어드민 매트릭스 병합(override > 자가체크인 > 일보). GPS 지오펜스/부정방지 필요 시 진행.
> ⚠️ **B안 착수 전 필수 — 부정 출퇴근 방지대책 재확인 + 적용논의 (대표님 요청 2026.05.29)**
> - 레거시 기보유 방지책: ① GPS Haversine 거리계산 + 매장 `gps_radius_meters` 반경제한(현 20% 여유) ② 관리자/오너 반경우회 ③ `check_in/out_distance_m` 기록(사후감사) ④ 역지오코딩 주소 스냅샷
> - 검토/강화 후보: 셀카·사진 인증, 디바이스 핑거프린트, 모의위치(Mock GPS) 탐지, 동일좌표 반복 패턴 플래그, 체크인 시각·위치 이상 알림. → B안 SQL/스키마 설계 전에 적용범위 확정.

### ✅ Part 13D-B 완료 (2026.05.29) — 출차요청 앱 내 토스트 신설
**배경**: Part 13D-A 완료 후, 시안 v4.2에서 출차요청 시인성 강화를 위해 앱 내 상단 토스트 신설 결정.
**구현**:
- **수정** `src/app/api/v1/tickets/active/route.ts` — select에 `car_type, car_color, parking_lot_id` 추가 + `parking_lots:parking_lot_id(name)` 조인 (토스트 위치/차종 표기용, public 라우트와 동일 패턴).
- **수정** `src/app/v2/crew/layout.tsx` — 기존 5초 폴링(진동·OS푸시·펄스뱃지) 유지하고 **앱 내 토스트 채널만 추가**. `toasts` state + `addToast`(최대 3개 누적, 5초 자동 제거). 상단 고정 네이비 카드(골드 좌측 바), ✕ 닫기, 카드 탭 시 `/v2/crew/parking` 이동, `crewV2ToastIn` 슬라이드인.
- **v4.2 표기 규칙 적용**:
  - 충돌 없음 + 위치 있음 → `1234 · 🅿️ B동 · B2-15` (한 줄)
  - 충돌 있음(동일 4자리 활성 2건+) → `1234 · 흰색 SUV` + 둘째 줄 `🅿️ B동 · B2-15`
  - 충돌 없음 + 위치 없음 → `1234`
  - 다중 누적(diff>1) → `1234 · 외 N건` (위치 라인 생략)
- 로컬 빌드 OK (`✓ Compiled successfully`, 경고 2건은 기존 Toss SDK 모듈 미설치 이슈로 무관).
- ⏳ **검증 대기**: Vercel 배포 후 실기기에서 출차요청 발생 → 토스트 표출/누적/탭 이동/자동사라짐 확인.

##### 🔧 13D-B 후속 보강 (2026.05.29) — 신규 감지 방식 개선
- **결함**: 기존 `count > prevCount` 방식은 5초 폴 사이 "1건 처리 + 1건 신규" 동시 발생 시 count 동일 → 신규 출차요청 누락. (진동/OS푸시/뱃지/토스트 공통)
- **수정** `src/app/v2/crew/layout.tsx` — `prevCount` → `seenIds: Set<ticketId>` 비교로 교체. 이전 폴에 없던 id만 신규로 감지(count 동일해도 잡힘). 매장 전환 시 현재 건은 베이스라인으로만 등록(오탐 방지). 매 폴 `seenIds` 갱신.
- 네이티브 전환(FCM) 후에도 "어떤 ticket이 신규인지" 판단 로직은 동일하게 이어짐 → 웹 워크어라운드 아님.

#### ✅ Part 13D-A 완료 (2026.05.29) — BottomNav 마감 탭 + CREW 작성화면 신설
- **신규**: `src/app/v2/crew/daily-report/new/page.tsx` — 어드민 `StaffSection`/`PaymentSection` 절대경로 import 재사용, 매장 `localStorage.crew_store_id` 고정, 모바일 풀폭 + CREW 네이비 헤더 + sticky 액션바, submit 후 CREW 홈 redirect (중복 시 머무름).
- **수정**: `src/app/v2/crew/layout.tsx` — `IconReport` SVG 추가, `NAV_ITEMS` 4탭 → 5탭(`{ id:"daily-report", label:"마감", path:"/v2/crew/daily-report/new" }`을 출퇴근↔설정 사이에).
- 로컬 빌드 OK. `/v2/crew/daily-report/new` 정적 경로 등록 확인.
- 시안 v4.2: `docs/crew-daily-report-mockup.html`

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

### ⚠️ 다음 세션 선결 점검 (2026.04.15 추가)
**Part 19B-5B 착수 전 반드시 수행**: 기존 UI(레거시 admin/v1 페이지) ↔ v2 통합앱 UI 갭 분석
- 기존 `/dashboard`, `/stores`, `/team`, `/workers` 등 레거시 페이지의 기능/필드/액션 목록화
- v2 대응 페이지(`/v2/dashboard`, `/v2/crew/*`, `/v2/monthly`, `/v2/tenants`, `/v2/daily-reports`)와 비교
- 누락된 기능/필드/버튼/엣지케이스 리스트업 → TODO에 별도 섹션 추가
- 우선순위 판정(P0=즉시 / P1=Part 19 끝나면 / P2=Phase 2): 신규 기능 작업 전에 보강 결정

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
| **Part 18A** | 월주차 알림톡 v2 훅 — renew API에 renewal_complete 발송 + monthly-expire 크론 신설 + SQL 12 (플래그 컬럼) | ✅ 완료 | 13552f3 / SQL 12 실행 완료 ✅ 2026.04.14 |
| **Part 18B** | 관리자 알림톡 로그 페이지 `/v2/alimtalk` — 필터+KPI+템플릿별 요약+상세 테이블+CSV | ✅ 완료 | 5079bba |
| **Part 18C** | 월주차 상세 수동발송 모달(3종 템플릿) + Sidebar 알림톡 로그 메뉴 추가 (18 시리즈 마감) | ✅ 완료 | b2be497 |
| **Part 19D** | 알림톡 실배포 QA 도구 — 헬스체크 API/페이지 + 테스트발송 API/페이지 + QA 체크리스트 문서 | ✅ 완료 | (이번 push) |
| **Part 19B-1** | CREW v2 기반 구조 — layout(BottomNav v2 경로) + login(통합 identifier) + select-store + 홈 대시보드 | ✅ 완료 | e6b20c1 |
| **Part 19B-2** | CREW v2 주차 목록 + 상세 — tickets/active + tickets/[id] + /complete 출차처리 | ✅ 완료 | 7708d7a |
| **Part 19B-3** | CREW v2 입차 등록 — POST tickets + OCR + 월주차 자동감지 + contract_status 버그 수정 + 신규 API 2개 | ✅ 완료 | (이번 push) |
| **Part 19B-4** | 차량준비 액션(POST /api/v1/tickets/:id/ready) + 고객 페이지 RLS 우회(public/exit-request service role) + 출차완료 화면 4초 폴링 + 알림톡 자동 훅 | ✅ 완료 | 4249d42 / SQL: mepark_tickets·visit_places 컬럼 보강 + exit_requests 테이블 생성 (✅ 실행 완료) |
| **Part 19B-5** | **4자리 OCR 전용 모드** — CREW 입차/출차 워크플로 단순화 + 동일 4자리 충돌 시 차종/컬러 모달 | ✅ 완료 (A·B·C·D) | 5A: SQL+OCR mode=last4 / 5B: 충돌검색 API (960dd60) / 5C: 입차4자리+충돌모달+GAP-P0-4 / 5D: 출차검색(월주차 포함) |

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
| 2026.06.10 | 솔라피 알림톡 입차 발송 테스트 | Vercel 환경변수(SOLAPI 4개) **전부 등록 완료**. 미팍티켓 카톡 알림톡 **입차(1종) 실발송 테스트 통과**(아침 확인). 연동 코드는 기존 보유(`api/alimtalk/entry·ready·monthly`, `tickets`/`monthly` 라우트 호출, test-send/logs/health). **⚠️ 미검증 잔여 2종**: 정산완료(ready/complete) · 월주차 D-7(cron monthly-remind). 알림톡 정책=2회발송(입차+정산완료)+월주차 D-7 자동1회. | ✅ 환경변수 4개 등록 · ✅ 입차 알림톡 실발송 통과 · ⏸️ **정산완료 알림톡 = 토스 결제 연동 후로 보류**(결제완료 트리거에 묶임, 현재 미연동) · ⚠️ 월주차 D-7 미검증 | (코드 기존) | 06.09 추가된 동일차량 구분용 자유입력칸 라벨을 대표 결정으로 **'차종'→'메모'**로 변경. ①`CarInfoModal.tsx` 라벨 + placeholder에 흠집 예시 추가('예: 흰색 아반떼/검정 카니발/앞범퍼 스크래치') ②`entry/page.tsx` 충돌 안내 스코어라인·메인 버튼문구('메모 입력 후 입차')·모달 description 3곳 통일. **내부 변수명 carType·API body 키 car_type·DB 컬럼은 불변**(화면 라벨만 변경, 메모 내용은 기존처럼 car_type에 저장). 전부 문자열 변경이라 빌드 리스크 없음. | ✅ **실기기 검증 통과**(폰 확인 완료) · 빌드 미실행(라벨/문자열만, Vercel 배포 OK) | 5ec7e73 |
| 2026.06.09 | CREW UI 개선 세션 (입차·사진·상세) | P1-8 검증 통과 후 현장 피드백 반영 6건. **(1) CREW 홈 공간정리**: min-height 100dvh에 짧은 콘텐츠가 위로 몰려 휑하던 것 → 빠른액션 버튼 확대(padding 18→26)+섹션여백·총대수(48→54) 키워 세로 균형. **(2) 차량 색상 시각화→폐기**: 색상 칩(스와치) 상세·리스트에 추가했다가(1f0c77c) **대표 결정으로 색상 입력 자체 제거**(46babda) — 차종 6버튼+컬러 7칩 → **'차종' 자유 텍스트 입력칸 1개**(CarInfoModal, placeholder '예: 흰색 아반떼/검정 카니발'). carColor props는 @deprecated 옵션화(호환유지). 충돌모달 안내문·충돌카드에서 컬러 제거. 상세/리스트는 차종 텍스트만 표시. **(3) 중복차량 배지**: 입차현황에서 현재주차중 전체(tickets) 기준 plate_last4 카운트(useMemo)→2대↑면 번호판 옆 빨강 '중복 N대' 배지(탭무관, 출차완료 제외, 정렬은 시간순 유지). **(4) 차량사진 자유촬영**: 전면/후면 등 방향 슬롯 가이드 전부 제거 → 순서없이 최대 6장 자유촬영(안내 '자유롭게 촬영·N/6장, 권장 4장↑'), 업로드 경로 {idx}_photo.jpg로 단순화. ※최소4장 강제는 미적용. **(5) 차량사진 뷰어 신설(P1-8 갭 해소)**: 상세 GET에 vehicle_photos 추가 + `/v2/crew/parking/[id]`에 사진 카드(signedUrl 1h, 3열 썸네일, 탭→원본 새창). 업로드만 되고 볼수없던 문제 해결. | ✅ **실기기 검증 통과(2026.06.10 폰 확인)** — 자유촬영·사진갤러리·중복배지·차종입력칸 6건 정상. 빌드 미실행(전부 @ts-nocheck 페이지/CSS·인라인, Vercel 배포 빌드로 검증) | cdef423·1f0c77c·46babda·9571e9d·02a0365·0dbeefa | **STEP 1(차량사진 업로드) 실기기 검증 통과.** 검증 중 버그 2건 발견·수정: **(1) 제출버튼 가림** — 사진 6장 촬영 후 "이대로 입차 등록" 버튼이 CREW 하단탭(BottomNav)에 가려져 다음 단계 진행 불가. 원인=`VehiclePhotoCapture .vphoto-overlay` z-index(200)가 BottomNav(z200, children보다 나중 렌더라 동일값에서 위에 깔림)에 짐. 사진단계는 `/v2/crew/entry` 하위 상태라 layout `HIDE_NAV_PATHS` 경로숨김 불가 → **오버레이 z-index 200→400**으로 nav 위 점유 해결. **(2) 업로드 에러 원인 불명** — `supabase.storage.upload`의 `{error}`를 받고도 로깅 안 해 원인이 안 보였음 → `console.error`+`lastUploadErrRef`+부분실패 alert에 "원인: {msg}" 노출 추가. **(3) 🔴 진짜 원인 = 버킷 부재** — 에러 노출 후 "bucket not found" 확인 → Storage 목록에 **`vehicle-photos` 버킷 자체가 없었음**(daily-report-photos·bug-screenshots·accident-photos 3개뿐). `sql/storage-vehicle-photos.sql`의 `storage.buckets` INSERT가 **SQL Editor에서 반영 안 됨**(알려진 현상) → **Storage UI에서 New bucket으로 `vehicle-photos`(Public) 수동 생성** + 정책 4개 SQL Run으로 해결. 업로드 성공 확인. | ✅ 빌드 미실행(CSS+로깅 변경, Vercel 배포 OK) · ✅ 실기기 업로드 성공 · **⚠️교훈: storage.buckets INSERT는 SQL Editor에서 안 먹을 수 있음 → 버킷은 Storage UI로 생성, 정책만 SQL** | 80df0e4·52d4016 |
| 2026.06.03 | 대시보드/매출분석 500 해결 + #310 흰화면 수정 | **(1) stats 500**: overview/daily-trend/by-store가 "Could not find table daily_reports" 500 → **진짜 원인 = `daily_reports` 테이블이 라이브 DB 미생성**(sql/v2/06 미실행). 에러 마스킹돼 있어 임시 DEBUG 노출로 실메시지 확보 후 확정. **대표님이 Supabase SQL Editor에서 sql/v2/06 실행해 daily_reports+자식3+RLS 생성 완료**. stats는 daily_reports로 환원(중간에 daily_records로 바꾼 31d805a는 빈 레거시테이블 읽는 오류였음), DEBUG 제거. **(2) #310 흰화면**: `/v2/parking-status` 등 client-side exception → React #310(hook 개수 불일치). 원인 = `MoreSubNav`·`AttendanceMapView`가 useEffect를 early return 뒤에 호출. useEffect를 hook 영역으로 이동해 해결. **(3) 대책**: `rules-of-hooks` lint 전수검사로 #310 3건 전부 검출(next build는 lint 미실행이 구멍). 컴포넌트 수정 시 `npx eslint "src/**/*.tsx" \| grep rules-of-hooks` 선검사. | 빌드 OK, rules-of-hooks 위반 0건. ⚠️**검증 대기(실기기)**: parking-status·crew 근태지도 정상 렌더 / 로그인 랜딩 admin→/v2/dashboard·crew→/crew / `/v2/daily-reports` 작성·저장(테이블 신규 생성분) | fc36e7f·892fd6a·b4087ef·5db2aa8·106e866 |
| 2026.06.03 | auth 랜딩+온보딩 v2 리포인트 (admin 컷오버) | nav swap이 cosmetic이던 문제 해소 — admin 로그인 랜딩을 v1→v2로 일괄 전환. **변경 8파일**: `app/page.tsx`(루트 `/`→`/v2/dashboard`), `login/actions.ts`(2곳), `api/v1/auth/login`(getRedirectPath admin/default→`/v2/dashboard`, crew/field는 `/` 유지), `lib/supabase/middleware.ts`(`?return=/v2/dashboard`), `auth/callback`(next 기본값+초대 admin 랜딩+**crew sentinel** `=== "/v2/dashboard"` 동기화), `store-select`(returnTo 기본값+crew sentinel 2곳), `invite/accept`(admin 랜딩), `OnboardingTour`(actionPath 4종 stores/team/dashboard/parking-status→v2). **핵심**: crew 분기 sentinel(`returnTo === "/dashboard"`)도 전부 `/v2/dashboard`로 동기화 → crew가 admin 페이지로 새지 않음. crew는 여전히 `/crew`(v1) — crew 컷오버는 별도(middleware 기본진입+실기기 검증 대기). **→ v1 `/dashboard`·`/parking-status`·`/stores`·`/team`이 이제 진짜 orphan**(검증 후 삭제 가능) | 빌드 OK (`✓ Compiled successfully in 80s`, 113p, sentinel 비교문 0건 잔여). 경고 2건 기존 Toss SDK 무관 · ⚠️실기기 검증: admin 로그인→`/v2/dashboard` 랜딩 / crew 로그인→`/crew` 유지 확인 | (이번 push) |
| 2026.06.03 | 레거시 정리 (안전분만) | orphan v1 admin 페이지 삭제: `src/app/monthly`(+register), `src/app/entry`(Sidebar 주석처리·dead), `team/page.tsx.bak`. **⚠️중요 발견**: nav 메뉴는 v2로 바뀌었으나 **로그인 랜딩+온보딩이 여전히 v1을 물고 있음** → `/dashboard`(root `/`·auth callback·`getRedirectPath` admin 랜딩), `/parking-status`·`/stores`·`/team`(OnboardingTour actionPath), `/store-select`(middleware role분기)은 **라이브라 삭제 제외**. 즉 nav swap은 cosmetic이었고 실제 v1→v2 admin 컷오버는 미완. `checkout_requests`도 `/workers`(승인UI)+Sidebar(뱃지) load-bearing이라 제거 불가. v1 crew 트리도 middleware상 `crew.mepark.kr` 기본진입(v2="추후")이라 라이브 | 빌드 OK (`✓ Compiled successfully in 80s`, 116→113p). 경고 2건 기존 Toss SDK 무관 | (이번 push) |
| 2026.06.03 | v1→v2 라우팅 일괄교체 (2순위) | P1 종료 후 잔여 v1 메뉴 정리. **Sidebar** analytics `/analytics`→`/v2/analytics`, accident `/accident`→`/v2/accident`. **MobileTabBar** accident 탭 v2화 + moreRoutes `/v2/analytics`. **`/more`**·**MoreSubNav** analytics v2화(MoreSubNav 낡은 "v2 미구현" 주석 갱신). **Header 타이틀맵** v2 admin 키 11종 추가(`startsWith` 매칭 — v2 admin 페이지가 전부 "대시보드"로 잘못 뜨던 기존 버그 해소, v2/layout 주석에 명시됐던 건). BugReportFAB 옵션 2건 v2 반영. **orphan v1 페이지 삭제**: `src/app/analytics`, `src/app/accident`(어디서도 import 안 됨·나브 분리 확인). workers·settings는 v2 미구현이라 레거시 유지. ⚠️v1 crew 트리 + `checkout_requests`(레거시 stores/delete cascade 참조)는 별도 단계로 분리 | 빌드 OK (`✓ Compiled successfully in 63s`, 116p, v1 analytics/accident 산출물 제거 확인). 경고 2건 기존 Toss SDK 무관 | (이번 push) |
| 2026.05.30 | GAP-P1-4 | 미팍티켓 **QR 발급/공유** `src/app/v2/crew/entry/qr/page.tsx` 신규(`cv2qr-*`, Suspense, 풀스크린 네이비). 입차성공→`?ticketId=&plate=` 진입, `${origin}/ticket/{id}`를 QR로 표시·공유(링크공유/현황/다음차량/홈). **QR생성=외부 api.qrserver.com→클라이언트 `qrcode@1.5.4`로 교정**(오프라인·네이티브 정합). `entry/page.tsx` 성공흐름을 토스트→QR화면 `router.replace`로 배선(죽은 successInfo 제거). layout HIDE_NAV_PATHS에 qr경로 추가(하단탭 숨김). 고객뷰 `/ticket/[id]`는 기존 운영중 | 빌드 OK (`✓ Compiled in 78s`, `/v2/crew/entry/qr` ○) · ⚠️실기기 검증(입차→QR 핸드오프) 미완 | (이번 push) |
| 2026.05.30 | GAP-P1-7 Part 3 | CREW 월주차 **등록/수정 UI** `src/app/v2/crew/monthly/register/page.tsx` 신규(`cv2mreg-*`, Suspense, @ts-nocheck). Supabase 직접호출 0 → 신규=`POST /api/v1/monthly`(+store_id) / `?id=`=`GET`프리필+`PATCH [id]`(store_id 제외). credentials:include·401회귀. 필드 9종(차량번호·차종·고객명한글필터·연락처평문·기간 MeParkDatePicker+퀵버튼·월요금·납부/계약상태·메모)+미리보기카드+409중복배너+완료모달. 기본요금 자동조회 보류(visit-places=MANAGE). 삭제 미노출. **P1-7 시리즈 100% 종료** | 빌드 OK (`✓ Compiled in 76s`, 115p, `/v2/crew/monthly/register` ○) · ⚠️실기기 검증(crew 200/타매장403) 미완 | (이번 push) |
| 2026.05.30 | GAP-P1-1 | `/v2/dashboard`에 **금일 출근 KPI 카드** 추가(5번째). 값 `출근/재직` + sub `출근율 %·재직 N명`. 데이터: 총직원=`/api/v1/employees?limit=1`(meta.total, 퇴사제외=team목록 기준 일치), 출근=`/api/v1/attendance?year&month`의 오늘 컬럼에서 status∈{present,late,peak,support,additional} 카운트(v2 근태=일보 파생이라 정합). hr fetch는 별도 try로 격리(실패 시 카드만 "—", 대시보드 본체 무영향). `KpiCard`에 `hideChange` prop 추가(출근 카드는 '직전 대비' 비교 없음 → 기존 4카드 영향 0). 신규 API·SQL 없음, UI-only | 빌드 OK (`✓ Compiled in 67s`, `/v2/dashboard` ○ 유지, 109p) | (이번 push) |
| 2026.05.30 | GAP-P0-2b 파트2 | `/v2/team` UI. [직원 등록] 모달 신설(emp_no·name·hire_date 필수+role·phone·position, POST `/api/v1/employees`, 사번중복 suggestion 노출) + 상세모달 관리자 placeholder를 실제 [관리자 계정 생성] 폼(email+pw6자↑→`admin-account`, 수동입력이라 pwReveal 없이 성공메시지)으로 교체 + "추후 지원" 문구 2곳 제거. 신규 API·SQL 없음 → **P0 5건 100% 완료, `/team` 레거시 대체** | 빌드 OK (`✓ Compiled in 74s`, `/v2/team` ○ 유지) · ⏳실기기 검증(SQL14+ServiceRoleKey 선행) | (이번 push) |
| 2026.05.30 | GAP-P0-2b 파트1 | 계정 백엔드. `src/lib/supabase/admin.ts`(service-role 헬퍼) 신설 + v1 auth 5라우트의 `auth.admin.*`/타사용자 profiles 쓰기를 service-role로 교체(create-account·bulk-create·reset-password·ban·unban — anon키로 admin API 호출하던 잠재버그 수정). 신규 `POST /api/v1/auth/admin-account`(관리자 실이메일, MANAGE, super_admin은 super_admin만). employees PUT allowedFields에 hire_date·status(퇴사 제외) 추가. 레거시 관리자 마이그레이션 SQL `sql/v2/14`(멱등) | 빌드 OK (`✓ Compiled in 73s`, admin-account ƒ 등록) · ⏳SQL14 실행+실기기 검증 대기 | (이번 push) |
| 2026.05.30 | v1→v2 라우팅 교체 | Sidebar·MobileTabBar·`/more`·MoreSubNav의 메뉴 경로를 v2로 일괄교체 완결. dashboard·parking-status·monthly·stores·team → `/v2/*`. (Sidebar·MobileTabBar·more는 이전 세션 미push분 포함, MoreSubNav는 이번 누락분 보강). analytics·workers·accident·settings는 v2 미구현(P1/P2)이라 레거시 유지. 라벨 '팀원 초대'→'직원 관리' 정합 | 빌드 OK (`✓ Compiled in 78s`, 108p) | 75eead8 |
| 2026.05.29 | GAP-P0-1 / 1C | `/v2/stores/[id]`에 방문지(visit_places) 요금표 섹션 추가 — 카드리스트(9필드 요금)+추가/수정/삭제 모달+요금 프리뷰, require_visit_place 연계 경고배너. API·SQL 신설 없이 UI만(visit-places PUT/DELETE 라우트 기존 존재). API-first | 빌드 OK (`✓ Compiled`, /v2/stores/[id] ƒ, 106p) | (이번 push) |
| 2026.05.29 | 13D-A | CREW 마감보고 진입점(BottomNav 5탭) + 작성화면 신설 (`/v2/crew/daily-report/new`). 어드민 StaffSection/PaymentSection 절대경로 import 재사용 | 빌드 OK, 정적 경로 등록 | (이번 push) |
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
| SQL 12 (monthly_parking 플래그 4컬럼 + 인덱스) | ✅ | ✅ 실행 완료 2026.04.14 | - |
| renew API → renewal_complete 발송 훅 | ✅ | - | ⏳ 실운영 |
| monthly-expire 크론 신설 | ✅ | - | ⏳ 실운영 |
| vercel.json 크론 등록 | ✅ | - | ⏳ |

### 다음 단계
- **SQL 12 실행** (Supabase SQL Editor) → 실행 후 ✅ 공유 부탁
- **Vercel 환경변수 설정** (Solapi 키 + CRON_SECRET) → 설정 완료 시 시뮬레이션 → 실발송 전환
- **Part 18B** — 관리자 알림톡 페이지 `/v2/alimtalk` (발송 로그 조회 + 필터 + CSV)
- **Part 18C** — 월주차 상세에서 수동 발송 버튼 (D-7/만료/갱신 재발송)

## Part 18B — 관리자 알림톡 로그 페이지 (2026.04.14)

### 작업 내용
- **`src/app/api/v1/alimtalk/logs/route.ts`** 신규 (GET)
  - 파라미터: `date_from` / `date_to` (기본 7일), `template` (7종+all), `status` (success/failed/all), `search` (phone_masked/message_id 부분일치), `page`, `limit`
  - 기간은 KST 기준 (`+09:00`) → UTC ISO 변환
  - 데이터: `alimtalk_send_logs` org_id 스코프, sent_at DESC
  - 응답에 `summary.by_template` 포함 (전체 기간 집계, 페이지네이션 무관)
  - 권한: MANAGE
- **`src/app/v2/alimtalk/page.tsx`** 신규
  - 기간 프리셋 4종 (오늘/7일/30일/이번달) + 커스텀 date range
  - 템플릿/상태/검색 필터
  - KPI 4카드: 총발송 / 성공 / 실패 / 성공률
  - 템플릿별 현황 테이블 (이름+총+성공+실패+성공률, total DESC)
  - 상세 로그 테이블 (발송일시/템플릿/상태 뱃지/수신번호/메시지ID/에러/연결 리소스)
  - 페이지네이션 (처음/이전/다음/끝)
  - **CSV 내보내기** (UTF-8 BOM, 현재 필터 기준, 페이지 순회 최대 5000건)

### 템플릿 라벨 매핑 (7종)
- `entry` → 입차확인
- `ready` → 차량준비완료
- `renewal_remind` → 월주차 D-7 (수동)
- `d7_auto_remind` → 월주차 D-7 (자동)
- `monthly_expire` → 월주차 만료 (수동)
- `monthly_expire_auto` → 월주차 만료 (자동)
- `renewal_complete` → 월주차 갱신완료

### 기술 포인트
- phone_masked는 이미 `010****1234` 형태로 저장되어 있어 그대로 표시
- KST 경계 변환 시 `+09:00` offset 문자열 사용 → 이중변환 없이 정확
- 요약 통계는 필터 적용 후 전체 범위(최대 5000 row scan 방지)로 계산
- CSV 다운로드는 클라이언트 Blob + BOM으로 엑셀 한글 호환
- `@ts-nocheck` + `export const dynamic = "force-dynamic"` v2 표준

### 빌드
- `npm run build` ✅ 성공
- `/api/v1/alimtalk/logs` 동적(ƒ), `/v2/alimtalk` 정적(○) 등록 확인

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| 로그 조회 API (필터 5종 + summary) | ✅ | - | ⏳ 실배포 |
| 관리자 페이지 (필터/KPI/템플릿별/상세) | ✅ | - | ⏳ |
| CSV 내보내기 | ✅ | - | ⏳ |

### 다음 단계
- **접근 경로** — 현재 Sidebar 메뉴에 추가되지 않음. `/v2/alimtalk` 직접 URL 접근 또는 대시보드/월주차 상세에서 링크 필요 (Part 18C 또는 후속 작업에서)
- **Part 18C** — 월주차 상세에서 수동 발송 버튼 (D-7/만료/갱신 재발송) + 확인 모달
- **Part 18D 후보** — 정산완료 알림톡 (ticket complete 훅) — 신규 템플릿 승인 여부 확인 필요

## Part 18C — 월주차 상세 알림톡 수동발송 + Sidebar 메뉴 (2026.04.14)

### 작업 내용
- **`src/app/v2/monthly/[id]/AlimtalkSendModal.tsx`** 신규
  - 3종 템플릿 라디오 선택: `renewal_remind` / `monthly_expire` / `renewal_complete`
  - 수신자 정보 카드 (고객명, 차량, 마스킹 번호)
  - 템플릿별 **미리보기** (고객명/매장/차량/날짜/금액 합성 문구) — 실제 발송은 카카오 승인 원문
  - confirm 다이얼로그 → `POST /api/alimtalk/monthly`
  - 시뮬레이션 모드 구분 표시 (Solapi 키 미설정 시)
- **`src/app/v2/monthly/[id]/page.tsx`** 수정
  - `alimtalkOpen` state 추가
  - 액션 버튼 영역에 📨 **알림톡** 버튼 (수정/갱신/계약취소 사이)
  - phone 정규식 검증 (`^\d{10,}$`)으로 비활성화 처리 + tooltip
  - `btnAlimtalk` 스타일 신규 (흰 배경 + NAVY 테두리/글자)
  - 모달에 `orgId={data?.stores?.org_id}` 전달 (GET 응답에 동봉)
- **`src/components/layout/Sidebar.tsx`** 수정
  - 관리 섹션 `accident` 다음, `settings` 이전에 **알림톡 로그** 메뉴 추가
  - `/v2/alimtalk` 링크, 메시지 아이콘 (MessageSquare 스타일 SVG)

### UX 정책
- 전화번호 무효 시: 버튼 비활성 + tooltip 안내 ("고객 전화번호가 없거나 유효하지 않습니다")
- 발송 전 confirm 1회 → 실수 방지
- 발송 성공 후: 모달 내부 피드백 + 취소 버튼 → "닫기"로 변경
- 발송 실패 시: 모달 유지 + 에러 메시지 → 재시도 가능
- 미리보기 문구는 실제 템플릿이 아닌 "대략적 안내"임을 명시

### 기술 포인트
- 기존 `/api/alimtalk/monthly` 라우트 그대로 재사용 — 신규 API 0개
- orgId는 detail API 응답의 `stores.org_id` 활용 → 별도 조회 불필요
- `@ts-nocheck` 표준, 모달은 오버레이 클릭 시 닫힘, 내부 클릭은 propagation 차단

### 빌드
- `npm run build` ✅ 성공
- 기존 경고 2건(tosspayments SDK 미설치)은 본 작업과 무관

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| AlimtalkSendModal (3종 템플릿 + 미리보기 + 발송) | ✅ | - | ⏳ 실배포 |
| 월주차 상세 📨 알림톡 버튼 (phone 검증) | ✅ | - | ⏳ |
| Sidebar 알림톡 로그 메뉴 | ✅ | - | ⏳ |

### 18 시리즈 마감 요약
- **Part 18A**: renew API 훅 + monthly-expire 크론 + SQL 12 플래그
- **Part 18B**: 관리자 로그 페이지 + API + CSV
- **Part 18C**: 월주차 상세 수동발송 UI + Sidebar 메뉴

### 다음 단계 후보
- **Part 19 A**: 정산완료 알림톡 (ticket complete 훅) — 신규 Solapi 템플릿 승인 필요
- **Part 19 B**: CREW 앱 v2 개선 (입차/출차/알림 플로우)
- **Part 19 C**: 미팍티켓 고객 플로우 (ticket.mepark.kr 재정비)
- **Part 19 D**: 실배포 QA — 알림톡 전체 플로우 시뮬레이션 → 실발송 전환 ✅ **완료 (2026.04.14)**

## Part 19D — 알림톡 실배포 QA 도구 (2026.04.14)

### 작업 내용
- **`src/app/api/v1/alimtalk/health/route.ts`** 신규 (GET, MANAGE)
  - 9개 Solapi env 설정 여부 검증 (API_KEY/SECRET/PF_ID/SENDER + 5 템플릿)
  - 민감 키(API_KEY/SECRET)는 `{set, length}`만 노출, 비민감 키는 `{set, preview:8자}`
  - 핵심 3종(API_KEY/SECRET/PF_ID) 세팅 여부로 `mode: "live" | "simulation"` 판정
  - core 세팅 시 `GET https://api.solapi.com/cash/v1/balance` 실시간 호출 → 잔액/포인트 반환
  - 템플릿별 `ready` 여부 (core + 해당 템플릿 env 모두 설정됐는지)
- **`src/app/api/v1/alimtalk/test-send/route.ts`** 신규 (POST, MANAGE)
  - Body: `{templateKey, to, variables, dryRun}`
  - 템플릿 5종 각각 필수 변수 목록 정의 → `missing_vars` 배열로 응답
  - `dryRun: true` → Solapi 호출 안 함, `messageId: DRYRUN_{timestamp}` 반환, 로그 미기록
  - `dryRun: false` → `sendAlimtalk` 실발송 + `logAlimtalk`로 기록
  - 로그 저장 시 `template_type = "test_${templateKey}"` — **운영 로그와 구분**
  - 전화번호 검증 (숫자 10~11자), DB 저장 금지 원칙 준수 (phone_masked만 기록)
- **`src/app/v2/alimtalk/health/page.tsx`** 신규
  - 모드 뱃지 (녹색 실발송 / 황색 시뮬레이션)
  - 9개 env 상태 카드 (인증 4개 + 템플릿 5개 그룹)
  - Solapi 잔액/포인트 카드 (Outfit monospace)
  - 템플릿 5종 ready 카드
  - 🔄 새로고침 버튼 + 조회 시각 표시
- **`src/app/v2/alimtalk/test/page.tsx`** 신규
  - 템플릿 5종 라디오 (설명문 포함)
  - 수신번호 입력 (하이픈 자동 필터)
  - 템플릿별 변수 입력 폼 자동 생성 + 합리적 기본값 프리필
  - **DryRun 기본 ON** (안전) — 토글로 실발송 모드 전환
  - 실발송 시 확인 모달 (수신번호 + 템플릿명 + 비용 경고)
  - 결과 JSON 전체 표시 (messageId, simulated, missing_vars, error 등)
- **`src/app/v2/alimtalk/page.tsx`** 수정
  - 헤더 아래 탭 네비 3개 추가: `[로그 | 환경 상태 | 테스트 발송]`
- **`docs/alimtalk-qa-checklist.md`** 신규
  - 6단계 체크리스트: env 세팅 → 헬스체크 → dryRun 5회 → 실발송 5회 → 로그 검증 → 운영전환
  - 부록: 주요 파일 맵 + 알림톡 운영 정책 (차량당 2건, 번호 저장금지 등)
  - 롤백 절차 (긴급시 API_KEY 제거 → Redeploy → 자동 시뮬레이션 전환)

### 기술 포인트
- `SOLAPI_TEMPLATES` export (solapi.ts) 재사용 — 템플릿 코드 매핑 중앙화
- `crypto.createHmac("sha256", ...)` HMAC 인증 — Solapi balance API 호출용 (기존 send 로직 복제)
- 민감 키 preview 정책: API_KEY/SECRET은 길이만, PF_ID/템플릿 코드는 앞 8자 + "..."
- `test_` 접두 로그 → 운영 로그 집계(/v2/alimtalk)에서 필터로 걸러낼 수 있음
- UI: PC 기준 레이아웃 (maxWidth 900~1100), 반응형 grid (`repeat(auto-fit, minmax(...))`)

### 빌드
- `npm run build` ✅ 성공
- 신규 라우트 3개 등록 확인:
  - `ƒ /api/v1/alimtalk/health` (dynamic)
  - `ƒ /api/v1/alimtalk/test-send` (dynamic)
  - `○ /v2/alimtalk/health` (static)
  - `○ /v2/alimtalk/test` (static)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| 헬스체크 API (env + balance + mode) | ✅ | - | ⏳ 실배포 env 세팅 후 |
| 테스트 발송 API (dryRun + test_ 접두) | ✅ | - | ⏳ |
| 헬스체크 UI (`/v2/alimtalk/health`) | ✅ | - | ⏳ |
| 테스트 발송 UI (`/v2/alimtalk/test`) | ✅ | - | ⏳ |
| 탭 네비 (로그/환경/테스트) | ✅ | - | ⏳ |
| QA 체크리스트 문서 | ✅ | - | - |

### 다음 단계 (실제 QA 실행 — 대표님 작업)
1. Vercel env 9개 세팅 + Redeploy
2. `/v2/alimtalk/health` 접속 → 모드 "실발송" + 잔액 확인
3. `/v2/alimtalk/test` → 5종 DryRun 5회 → 5종 실발송 5회 (대표님 번호)
4. 로그 페이지에서 `test_` 접두 이력 확인
5. 체크리스트 완료 후 → Part 19 A/B/C 중 다음 선택

### 19 시리즈 진행 상황
- **Part 19D** ✅ 완료 (실배포 QA 도구)
- Part 19A/B/C는 19D QA 완료 후 이어서 진행

## Part 19B-1 — CREW v2 기반 구조 (2026.04.15)

### 전략
기존 CREW 앱(`/crew/*`)은 Supabase 클라이언트 직접 호출 방식 → API-first 원칙 위반 + 네이티브 전환 시 전부 재작성 필요. 신규 CREW v2를 `/v2/crew/*`에 구축하여 **v1 API만 사용** (fetch + credentials: include). 기존 코드 0건 수정, middleware.ts 이미 `/v2/*` 분기 있어서 수정 불필요.

### 신규 파일 4개
- **`src/app/v2/crew/layout.tsx`** — CREW v2 전용 레이아웃
  - BottomNav 인라인 구현 (v2 경로: `/v2/crew`, `/v2/crew/parking`, `/v2/crew/attendance`, `/v2/crew/settings`)
  - 출차요청 폴링 5초마다 `GET /api/v1/tickets/active?store_id=xxx` → exit_requested 카운트 표시, 브라우저 Notification + 진동(200ms 3번)
  - `/v2/crew/login`, `/v2/crew/select-store` 경로에서는 BottomNav 숨김 (HIDE_NAV_PATHS 배열)

- **`src/app/v2/crew/login/page.tsx`** — 통합 로그인
  - `POST /api/v1/auth/login` 사용 → identifier 자동 판별 (EMAIL/PHONE/EMPNO)
  - 입력 중 실시간 타입 감지 라벨 표시 (이메일/전화번호/사번 중 하나)
  - `GET /api/v1/auth/me`로 로그인 상태 선체크 → 이미 로그인 시 매장 유무에 따라 홈/매장선택으로 이동
  - 로그인 후 `stores.length === 1`이면 자동 선택하여 홈으로, 여러 개면 매장선택으로
  - 에러 분기: `no_access`, `session_expired` 파라미터 처리
  - localStorage key: `crew_v2_saved_id`, `crew_store_id`, `crew_store_name`

- **`src/app/v2/crew/select-store/page.tsx`** — 매장 선택
  - `GET /api/v1/auth/me` → data.stores 배열 사용 (v1 stores API는 MANAGE 전용이라 CREW 접근 불가)
  - is_primary=true 매장에 "주" 뱃지 표시
  - 단일 매장 자동 선택 → 홈 이동
  - 접근 가능 매장 0건 시 에러 화면 + 새로고침 버튼

- **`src/app/v2/crew/page.tsx`** — 홈 대시보드
  - `Promise.all([auth/me, tickets/active])` 병렬 호출
  - 헤더: 사용자명 + 역할 뱃지(슈퍼관리자/관리자/크루 등) + 📍 매장명 + 시간/날짜 + 매장변경 버튼
  - 비밀번호 미변경(`password_changed=false`) 시 주의 배너 표시
  - 주차 현황 카드: 총 대수(48px Outfit) + 4칸 그리드(발렛/자주식/출차요청/차량준비)
  - 출차요청/차량준비 건 수가 0 초과 시 해당 카드 배경색 변경(빨강/초록)
  - 빠른 액션 2버튼: 입차 등록(네이비, `/v2/crew/entry`) / 주차 현황(흰배경, `/v2/crew/parking`) — 주차 현황 버튼에 출차요청 카운트 서브텍스트
  - 출차요청 1건+이면 상단 알림 박스(빨간 배경 + 펄스 애니메이션) 추가 노출
  - 새로고침 버튼 🔄 클릭 시 loadData 재호출

### 라우팅
- middleware.ts는 이미 Part 6에서 `crew.mepark.kr`의 `/v2/` 경로 분기 준비됨 → 수정 없이 동작
- 접근 경로:
  - `crew.mepark.kr/v2/crew/login` (프로덕션 배포 후)
  - `admin.mepark.kr/v2/crew` (개발/테스트용, 동일 도메인으로도 접근 가능)
- 기존 `/crew/*` 페이지는 그대로 보존 (admin.mepark.kr/crew, crew.mepark.kr/crew 모두 계속 동작)

### 기술 포인트
- 모든 API 호출에 `credentials: "include"` — 세션 쿠키 자동 전송
- v1 `POST /api/v1/auth/login`은 서버사이드 `signInWithPassword` + Set-Cookie → 클라이언트 Supabase 불필요
- @ts-nocheck + `export const dynamic = "force-dynamic"` v2 표준 준수
- 기존 `CrewBottomNav`(`/crew/*` 경로 하드코딩) 재사용 불가 → layout.tsx에 인라인 구현
- 폴링 기반(5초), 네이티브 전환 시 Push Notification으로 교체 예정

### 빌드
- `npm run build` ✅ 성공
- 신규 라우트 3개 등록 확인:
  - `○ /v2/crew` (static)
  - `○ /v2/crew/login` (static)
  - `○ /v2/crew/select-store` (static)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| layout + BottomNav v2 경로 + 출차요청 폴링 | ✅ | - | ⏳ 실배포 |
| 통합 로그인 (이메일/전화/사번) | ✅ | - | ⏳ |
| 매장 선택 (auth/me 기반) | ✅ | - | ⏳ |
| 홈 대시보드 (주차 현황 + 빠른 액션) | ✅ | - | ⏳ |

### 다음 단계
- **Part 19B-2** — 주차 목록 `/v2/crew/parking` + 상세 `/v2/crew/parking/[id]` (GET tickets/active, 탭 필터, 실시간 갱신)
- **Part 19B-3** — 입차 등록 `/v2/crew/entry` (POST tickets, OCR 재사용, 알림톡 훅 자동)
- **Part 19B-4** — 주차 상세 액션 (차량준비, 출차 완료, PATCH tickets/[id]/complete)

## Part 19B-2 — CREW v2 주차 목록 + 상세 (2026.04.15)

### 전략
v1 `/api/v1/tickets/active`(OPERATE), `/api/v1/tickets`(completed 필터), `/api/v1/tickets/[id]`(OPERATE), `/api/v1/tickets/[id]/complete`(OPERATE) 4개 엔드포인트를 연결해 읽기 + 출차처리까지 완결. 차량준비/번호판 수정/타입 변경은 v1 API 신설 필요하여 Part 19B-4로 분리.

### 신규 파일 2개
- **`src/app/v2/crew/parking/page.tsx`** — 주차 목록 (~420줄)
  - 탭 4종: 🔑 발렛 / 🏢 자주식 / 📅 월주차 / 🚗 출차완료
  - 현재 주차: `GET /api/v1/tickets/active?store_id=xxx` — 5초 폴링 (silent refetch)
  - 출차완료: `GET /api/v1/tickets?store_id&status=completed&date_from=YYYY-MM-DDT00:00:00+09:00&date_to=...` — 날짜 선택 input 연동
  - 검색: 2자리 이상 숫자면 `extractDigits` 비교 (한글/* 마스킹 공존 호환), 그 외는 대문자 변환 후 includes
  - 통계 4칸: 주차중 탭별 `총/발렛/월주차/출차요청(컬러)` 또는 출차탭 `출차완료/발렛/월주차/매출합계`
  - 출차요청 고정 배너 (주차탭에서만, 클릭 시 첫 출차요청 티켓으로 이동)
  - 카드: 번호판(Outfit 800), 상태 뱃지, 타입 뱃지(발렛/자주식/월주차 컬러), 무료 뱃지, 경과시간(2h/4h 기준 ok/caution/warn 컬러), 주차위치, 현재요금(실시간 계산)
  - 경과시간 상태별 카드 강조: exit_requested(오렌지 2.5px border + 펄스 애니메이션), car_ready(그린 2px border)
  - 1분마다 `setTick` → 경과시간 재렌더
  - 요금 계산: `calcFee(entry_at, visit_places || stores, parking_type)` — free_minutes → base_fee → extra_fee(10분 단위) → daily_max 캡 → valet_fee 가산 (기존 로직 동일)

- **`src/app/v2/crew/parking/[id]/page.tsx`** — 주차 상세 (~450줄)
  - 헤더: 뒤로가기 + 제목
  - 상태 헤더: 번호판(32px Outfit 800) + 상태 뱃지 + 경과시간(28px)
  - 출차요청 시 오렌지 알림 박스 (차량 준비 후 출차 처리 안내)
  - 요금 카드(네이비 배경): 예상요금/사전정산 완료금액/추가요금, 30분 초과 시 빨간 경고 (⚠️ 사전정산 후 30분 초과 — 추가요금 발생)
  - 차량 정보 카드: 차량번호, 주차유형, 주차위치, 방문지(층+이름), 입차시각, 사전정산시각, 출차요청시각, 출차시각
  - 출차 처리: 하단 고정 footer 버튼 → 모달 → 결제수단 선택(카드/현금/무료, 사전정산 완료 시 숨김) → `PATCH /api/v1/tickets/:id/complete` body `{calculated_fee, payment_method}` → 성공 시 목록으로 `router.replace`
  - 월주차는 `payment_method='monthly'` 자동 지정, 요금 0원
  - 19B-4 안내 박스: "⚠️ 차량준비 · 번호판 수정 · 타입 변경은 Part 19B-4에서 추가됩니다" (발렛 + 비 car_ready 상태일 때만 노출)

### 기술 포인트
- 모든 fetch `credentials: "include"` — 세션 쿠키 자동 전송
- 401 응답 → `/v2/crew/login?error=session_expired` 자동 리다이렉트
- 404/에러 → 에러 화면 분기
- `useMemo`로 필터링/통계 캐싱 (tickets 배열 변경 시에만 재계산)
- 검색 `extractDigits` 활용 — 한글 차량 "57주1331" ↔ * 마스킹 "57*1331" 모두 "571331" 매칭
- 출차완료 탭 날짜 쿼리는 KST offset `+09:00` 명시 → UTC/KST 경계 이슈 차단
- 결제수단 선택 UI: 사전정산 `paid_amount > 0`일 때 숨김 (이미 결제 완료 → 추가 결제 없음)
- 빌드 시 Next.js 16 `params: Promise<{id}>` 처리 — `useParams` 훅 직접 사용(클라이언트)

### v1 API 호환성 확인
- `GET /api/v1/tickets/active` 응답: `{tickets: [...], total: N}` + visit_places/stores JOIN → 요금 계산 가능 ✅
- `GET /api/v1/tickets` 응답: `{data: [...], meta: {...}}` + visit_places 미포함 → 출차완료는 `paid_amount` 직접 사용 ✅
- `GET /api/v1/tickets/:id` 응답: visit_places(fee 구조), stores(site_code, has_valet, valet_fee) JOIN → 요금 계산 가능 ✅
- `PATCH /api/v1/tickets/:id/complete`: OPERATE(crew), body `{calculated_fee, payment_method, phone?}`, 응답 `{ticket_id, status, exit_at, calculated_fee, additional_fee, payment_method}` ✅

### 빌드
- `npm run build` ✅ 성공
- 신규 라우트 2개 등록 확인:
  - `○ /v2/crew/parking` (static)
  - `ƒ /v2/crew/parking/[id]` (dynamic)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| 목록 페이지 (탭/검색/폴링/통계) | ✅ | - | ⏳ 실배포 |
| 상세 페이지 (정보/요금/출차처리) | ✅ | - | ⏳ |
| 출차 처리 (PATCH complete) | ✅ | - | ⏳ |
| 차량준비 액션 (car_ready) | ⏳ 19B-4 | - | - |
| 번호판 수정 | ⏳ 19B-4 | - | - |
| 타입 변경 (valet↔self) | ⏳ 19B-4 | - | - |

### 다음 단계 (Part 19B-3)
- `/v2/crew/entry` 페이지 — 입차 등록
- `POST /api/v1/tickets` 사용 (OCR + 수동입력 + 월주차 자동감지)
- `CameraOcr` 컴포넌트 재사용 (한글 마스킹 * 전략)
- 입차 완료 시 `/api/alimtalk/entry` 자동 발송 (fire-and-forget, 기존 훅 유지)

### Part 19B-4 (주차 액션 확장) — v1 API 신설 필요
- `POST /api/v1/tickets/:id/ready` (OPERATE) — 차량준비 상태 전환 + 알림톡 훅
- `PATCH /api/v1/tickets/:id/plate` (OPERATE) — 번호판 + plate_last4 수정 (audit 기록)
- `PATCH /api/v1/tickets/:id/type` (OPERATE) — parking_type 변경 (audit 기록)
- 또는 기존 `/api/v1/tickets/:id` PATCH에 OPERATE 전용 필드 화이트리스트 추가

## Part 19B-3 — CREW v2 입차 등록 (2026.04.15)

### 전략
v1 `POST /api/v1/tickets`(OPERATE) 활용 + CREW 입차 폼에 필요한 사업장/방문지/주차장 통합 조회 API와 월주차 사전 감지 API 2개 신설. CameraOcr 컴포넌트는 기존 그대로 재사용. monthly_parking 컬럼명 버그(status → contract_status) 동시 수정.

### 신규 API 2개
- **`GET /api/v1/stores/:id/operation`** (OPERATE)
  - CREW 입차 폼 1회 호출로 모든 정보 획득
  - `Promise.all` 3쿼리 병렬: store(요금 8필드 + has_valet) / visit_places(층/이름/요금구조) / parking_lots(이름/면수)
  - canAccessStore + org_id 강제, field_member 차단
  - 주차장 1개면 자동 선택 가능

- **`GET /api/v1/monthly/check?store_id&plate`** (OPERATE)
  - CREW 입차 폼에서 차량번호 입력 시 실시간 월주차 여부 확인
  - 매칭 방식: 숫자만 추출 후 비교 (한글 ↔ * 마스킹 호환) — `vehicle_digits` generated column 우선, fallback 인라인 추출
  - 응답: `{is_monthly, monthly_parking_id?, customer_name?, end_date?, days_remaining?, contract_status?}`
  - 만료까지 D-N 자동 계산 (음수면 "만료")
  - canAccessStore + field_member 차단, 4자리 미만이면 즉시 false 응답

### 신규 페이지 1개
- **`src/app/v2/crew/entry/page.tsx`** (~570줄)
  - 헤더: 뒤로가기 + 사업장명
  - **1. 차량 번호판 섹션**:
    - 3-칸 분할 input: 앞숫자(3) · 한글|*(1) · 뒷숫자(4) — Outfit 800 28px monospace
    - 자동 포커스 이동 (앞 3자 → 한글, 한글 1자 → 뒷자)
    - 한글 입력 필터링: `/[^가-힣*]/g` (한글 + * 마스킹만 허용)
    - 카메라 OCR 버튼 (CameraOcr 컴포넌트 모달 호출, 기존 그대로 재사용)
    - OCR 결과 적용: 한글/* 분리 후 3칸에 자동 분배
    - 월주차 자동 감지: 500ms debounce → `GET /api/v1/monthly/check`
    - 월주차 뱃지: 일반(회색) / 월주차(녹색) / D-7 이내(주황) / 만료(주황)
  - **2. 주차 유형 섹션**: 발렛/자주식 토글 (월주차면 자주식 disabled)
  - **3. 상세 정보 섹션**:
    - 방문지 드롭다운 (visit_places 1개+ 시 노출, 첫 옵션 "사업장 기본 요금")
    - 주차장 드롭다운 (parking_lots 2개+ 시 노출, 1개는 자동 선택)
    - 주차 위치 텍스트 (선택)
    - 전화번호 input (tel + numeric inputMode) + ⚠️ "발송 즉시 삭제" 안내
    - 무료 처리 체크박스 (월주차 아닐 때만 노출, 월주차는 자동 무료)
  - 검증: 숫자 6자리+ + 한글/마스킹 1자 → `canSubmit`
  - 제출: `POST /api/v1/tickets` body에 검증된 데이터만 포함
    - 빈 값은 body에서 제외 (visit_place_id, parking_lot_id, parking_location, phone)
    - phone 10자리+ 시에만 알림톡 발송 (서버에서 자동)
  - 중복 차량 (`TICKET_OVERDUE`) → 기존 티켓으로 이동 옵션 confirm
  - 성공 토스트: 체크마크 + 번호판 + 월주차/알림톡 표시 → 1.5초 후 `/v2/crew/parking` 이동

### 버그 수정
- **`src/app/api/v1/tickets/route.ts`** L175: `monthly_parking.status` → `contract_status`
  - 메모리 기록(2026.04.14 CREW OCR 핫픽스)에서 발견된 동일 버그가 v1 POST API에도 잔존
  - 이 버그로 v1 API로 입차 시 월주차 차량이 일반 차량으로 잘못 등록됨
  - 1줄 수정으로 해소

### 기술 포인트
- **debounce 활용**: 번호판 입력 중 매 키 입력마다 API 호출하지 않도록 500ms debounce, 4자리 미만이면 즉시 reset
- **API-first 일관성**: 모든 데이터 흐름이 v1 API 호출, Supabase 직접 호출 0건
- **CameraOcr 재사용**: 기존 `src/components/crew/CameraOcr.tsx` (485줄) 컴포넌트 그대로 import — `onConfirm(plate)` / `onCancel()` 콜백 인터페이스
- **POST body 최적화**: 빈 값은 본문에서 제외하여 서버 측 null 처리 일관성 확보
- **알림톡 정책 준수**: 전화번호는 서버에서 알림톡 발송 즉시 휘발 (mepark_tickets 미저장), 마스킹 로그만 alimtalk_send_logs에 기록
- **vehicle_digits generated column 활용**: SQL 11에서 추가된 generated column으로 인덱스 기반 빠른 매칭
- @ts-nocheck + `export const dynamic = "force-dynamic"` v2 표준 준수

### 빌드
- `npm run build` ✅ 성공
- 신규 라우트 3개 등록 확인:
  - `ƒ /api/v1/monthly/check` (dynamic)
  - `ƒ /api/v1/stores/[id]/operation` (dynamic)
  - `○ /v2/crew/entry` (static)

### 완료 여부
| 항목 | Code | DB | Test |
|------|------|-----|------|
| GET /api/v1/stores/:id/operation | ✅ | (기존 테이블) | ⏳ 실배포 |
| GET /api/v1/monthly/check | ✅ | (기존 테이블) | ⏳ |
| 입차 폼 (3칸 plate + OCR + 월주차 자동감지) | ✅ | - | ⏳ |
| POST /api/v1/tickets contract_status 버그 수정 | ✅ | - | ⏳ |
| 알림톡 자동 훅 (phone 입력 시) | ✅ | - | ⏳ 실배포 |

### 다음 단계 (Part 19B-4)
- **차량준비** 액션 — `POST /api/v1/tickets/:id/ready` (OPERATE) 신설 + 알림톡 발송 (`/api/alimtalk/ready` 훅)
- **번호판 수정** — `PATCH /api/v1/tickets/:id/plate` (OPERATE) 신설 + audit 기록
- **타입 변경** — `PATCH /api/v1/tickets/:id/type` (OPERATE) 신설 + audit 기록
- 상세 페이지 액션 버튼 추가 + 19B-2에서 노출한 안내 박스 제거
- 대안: 기존 `PATCH /api/v1/tickets/:id` (MANAGE)에 OPERATE 전용 필드 화이트리스트 분기 추가


---

## Part 19B-5 — 4자리 OCR 전용 모드 (예정 · 2026.04.15 기획)

### 배경
- 풀번호 OCR이 한글 인식 실패 시 `*` 자동 마스킹 미적용 → CREW 수동 보정 빈번
- 한글 IME + 3칸 분할 + * 마스킹 검증 등 복잡도 높음
- Plate Recognizer 한글 인식률 75~85% vs 숫자만 95%+

### 스펙 결정사항
- **적용 범위**: 일반차량만 (월주차는 풀번호 유지)
- **DB 저장**: 4자리 그대로 `plate_number` + `plate_last4` 동일값 저장
- **충돌 처리**: 동일 매장 내 동일 4자리 활성 차량 존재 시에만 차종/컬러 입력 모달
- **영수증/세무**: 고객 셀프결제(PG사 영수증) 사용으로 풀번호 표기 의무 없음
- **OCR 신뢰점수 표시**: score < 70% 시 빨강 경고 + 수동 수정 유도

### 신규 컬럼
```sql
ALTER TABLE mepark_tickets
  ADD COLUMN IF NOT EXISTS car_type   text,  -- 차종 (세단/SUV/경차/승합/외제/기타)
  ADD COLUMN IF NOT EXISTS car_color  text;  -- 컬러 (검정/흰색/회색/은색/파랑/빨강/기타)

CREATE INDEX IF NOT EXISTS idx_tickets_collision
  ON public.mepark_tickets (org_id, store_id, plate_last4, status)
  WHERE status IN ('parking','exit_requested','car_ready','pre_paid','overdue');
```

### 작업 분해
- **Part 19B-5A** ✅ — DB 컬럼 추가 + OCR API 4자리 모드 (`/api/ocr/plate`에 `mode=last4` 옵션 추가)
- **Part 19B-5B** ✅ — 충돌 검색 API (`GET /api/v1/tickets/check-collision?store_id&plate_last4`) — commit 960dd60
- **Part 19B-5C** ✅ — CREW v2 입차 페이지 단일 4자리 입력 + 충돌 모달 + GAP-P0-4 흡수
- **Part 19B-5D** ✅ — CREW v2 출차 검색 — 4자리 → N건 매칭 카드 리스트 (월주차 포함, 차주성함 표시)
- **Part 19B-5E** ⏳ (신설 검토) — 월주차 *입차* 4자리화 + 수기(차종/차주성함) 캡처. 현재 월주차 입차는 풀번호 자동감지 경로 → 4자리 통일 시 입차 경로·매칭 로직 재설계 필요

### Part 19B-5A 완료 기록 (2026.04.15)
- **SQL** (`sql/v2/13-tickets-car-info.sql` · Supabase 실행 완료)
  - `mepark_tickets.car_type` (text, nullable) 추가
  - `mepark_tickets.car_color` (text, nullable) 추가
  - `idx_tickets_collision` 부분 인덱스 (org_id, store_id, plate_last4, status) WHERE 활성 상태 5종
- **코드** (`src/app/api/ocr/plate/route.ts`)
  - `body.mode` 파싱 추가 (`"full"` 기본 / `"last4"`)
  - `mode === "last4"`일 때 응답에 `candidates_last4: string[]` 채움 (best + 후보의 last4를 dedup, 최대 5개)
  - 응답에 `mode` echo back (클라이언트가 모드 확인 가능)
  - 기존 호출부(파라미터 미전달) 100% 호환 — `candidates_last4`는 빈 배열로 응답
- **빌드 검증**: `npm run build` ✅ Compiled successfully (2.1min)

### Part 19B-5B 완료 기록 (2026.05.28)
- **신규 API** (`src/app/api/v1/tickets/check-collision/route.ts`)
  - `GET /api/v1/tickets/check-collision?store_id=&plate_last4=`
  - 같은 사업장 + 동일 4자리 + 활성 상태(parking/exit_requested/car_ready/pre_paid/overdue) + 월주차 제외 매칭 조회
  - 응답: `{ has_collision: boolean, count: number, matches: [...] }` (matches: id·plate_number·car_type·car_color·status·entry_at·parking_location 등)
  - `idx_tickets_collision` 부분인덱스의 status 5종과 **동일 필터**로 인덱스 활용
- **권한/보안**
  - `requireAuth(OPERATE)` + field_member 제외 + `canAccessStore` 검증 + `org_id` 필터
  - 입력 검증: store_id 필수, plate_last4 숫자 4자리(`/^\d{4}$/`)
  - ⚠️ **인증 전용 API → PUBLIC_PATHS 미추가** (2026.04.22 고객API 누락 사고 패턴 의도적 회피)
- **타입 보강**: 5A에서 누락됐던 `mepark_tickets.car_type`/`car_color`를 `database.types.ts` Row/Insert/Update 3블록에 수기 추가 (TS strict 빌드 통과)
- **빌드 검증**: `npm run build` ✅ Compiled successfully (56s) / 라우트 `ƒ /api/v1/tickets/check-collision` 등록 확인

### Part 19B-5C 완료 기록 (2026.05.28)
- **입차 페이지 재작업** (`src/app/v2/crew/entry/page.tsx` · 3칸분할→단일 4자리)
  - 단일 4자리 입력(수동/OCR) · 일반차 전용(월주차 자동감지 제거 — 풀번호 경로로 분리)
  - `last4.length===4` 시 `GET /api/v1/tickets/check-collision` (debounce 500ms)
  - 충돌 없음 → 바로 `POST /api/v1/tickets` / 충돌 → CarInfoModal(차종·컬러) → `confirm_collision:true`로 POST
  - OCR은 기존 CameraOcr 재사용 — 결과 풀번호에서 `extractDigits().slice(-4)`로 last4 추출 (컴포넌트 무수정)
- **신규 공용 컴포넌트** (`src/components/crew/CarInfoModal.tsx`)
  - 차종 칩(세단/SUV/경차/승합/외제/기타)+컬러(검정/흰색/회색/은색/파랑/빨강/기타) 바텀시트
  - controlled · topContent로 충돌카드/번호판입력 주입 → 입차·정보수정 공용
- **POST `/api/v1/tickets` 확장(additive)**: body·insert에 `car_type`/`car_color` + `confirm_collision`(true 시 동일 plate_number 중복체크 skip)
- **GET `/api/v1/tickets/[id]` 확장(additive)**: select에 `car_type`/`car_color`
- **GAP-P0-4 — parking/[id] 보강**
  - 신규 `PATCH /api/v1/tickets/[id]/plate` (번호판+plate_last4, audit)
  - 신규 `PATCH /api/v1/tickets/[id]/car-info` (차종/컬러, audit)
  - 상세: 상태헤더 차종·컬러 표시 + "✏️ 정보 수정" 버튼 + CarInfoModal(번호판4자리+차종+컬러)
  - v2 코멘트 *"번호판수정/타입변경은 19B-4에서 추가"* 미완 해소
- **준수**: 신규 API 모두 `requireAuth(OPERATE)`+field_member 제외+canAccessStore+org_id / PUBLIC_PATHS·middleware 무수정 / DB 변경 0건(5A 컬럼 재사용)
- **빌드 검증**: `npm run build` ✅ (55s) / `/v2/crew/entry`·`parking/[id]`·`/api/v1/tickets/[id]/{plate,car-info}` 등록 확인

### Part 19B-5D 완료 기록 (2026.05.28)
- **대표 결정사항 반영**: 출차 검색에 **월주차 포함** (4자리·수기 구분 동일 적용). 일반차=차종·차색 / 월주차=📅뱃지·차종·👤차주성함
- **check-collision API 확장 (additive)** (`src/app/api/v1/tickets/check-collision/route.ts`)
  - 신규 쿼리 파라미터 `include_monthly=true` (선택) — 미전달 시 기존 동작(월주차 제외) 유지 → **5C 입차 충돌검색 무영향**
  - `include_monthly=true`: `is_monthly=false` 필터 제거 + select에 `monthly_parking_id` 추가
  - 월주차 매칭 건은 `monthly_parking` 별도 조회(임베드 join 미사용 — FK 네이밍 의존 회피)로 `owner_name`(=customer_name)·`car_type`(티켓 우선, 계약 vehicle_type fallback) 보강
  - DB 변경 0건 (5A 컬럼 + 기존 monthly_parking_id FK 재사용)
- **신규 페이지** (`src/app/v2/crew/exit/page.tsx`)
  - 4자리 입력(수동/OCR) → `GET check-collision?include_monthly=true` (debounce 500ms)
  - **0건** → 안내 / **1건** → 카드 없이 즉시 `/v2/crew/parking/[id]` 이동 / **N건** → 카드 리스트 → 선택 → 상세
  - 카드: 번호4자리·상태뱃지·(발렛/자주식|📅월주차)·차종·차색/👤차주성함·경과시간(색상)·위치
  - CameraOcr 재사용 (풀번호 결과 → `extractDigits().slice(-4)`, 컴포넌트 무수정)
- **진입점 3곳**
  - 홈 빠른액션: 기존 2버튼(입차/현황) → **3버튼(입차/출차검색/현황)**, 출차검색=초록 (`src/app/v2/crew/page.tsx`)
  - 현황 목록 툴바: "🔎 4자리로 출차 차량 찾기" 버튼 (`src/app/v2/crew/parking/page.tsx`)
  - BottomNav는 무수정 (4탭 유지)
- **준수**: 신규 페이지 `/v2/crew/exit`만 신설 · check-collision는 5B 신규코드라 additive 확장 · PUBLIC_PATHS·middleware 무수정 · Supabase 직접호출 0건 · DB 변경 0건
- **빌드 검증**: `npm run build` ✅ Compiled successfully (69s) / `/v2/crew/exit`·`ƒ /api/v1/tickets/check-collision` 등록 확인
- **시안**: `docs/part19B-5D-mockup.html` (대표 컨펌 완료 — 1234/7777/5678/9999 시나리오)


- 일반차 2개 템플릿(입차확인/차량준비): 본문 표기 형식 검토 후 변수만 4자리로 발송 (대부분 재심사 불필요 예상)
- **선결 작업**: 솔라피 콘솔에서 입차확인/차량준비 템플릿 본문 확인 → 재심사 필요 여부 판정

### 알림톡 정책 준수
- 전화번호는 변경 없음 (서버 휘발 + alimtalk_send_logs 마스킹 로그)

### 미해결 항목
- 매장 평균 동시 주차 대수 확인 (충돌 빈도 정밀 추정)
- 차량 사진 자동 저장 시 Supabase Storage 비용 추정
- OCR 신뢰점수 임계값(70%) 실측 검증 필요


---

## 🚑 핫픽스 (2026.04.22) — 미팍티켓 알림톡 링크 404 복구

### 증상
- 고객이 카카오톡 알림톡(입차확인)의 "주차현황 확인" 버튼을 누르면 **"티켓을 찾을 수 없습니다"** 화면 표시
- 어드민 로그인 상태(`admin.mepark.kr/ticket/{id}`)로 접속하면 정상 표시 → 원인 은폐됨
- 발생 범위: 도메인 무관(`ticket.mepark.kr`, `mrpark-parking.vercel.app` 모두), **비로그인 고객 전원 영향**

### 원인
- `src/lib/supabase/middleware.ts`의 `PUBLIC_PATHS`에 티켓 고객용 API 4종이 누락
- 티켓 페이지(`/ticket/[id]`)는 public으로 허용됐으나, 페이지 내부에서 호출하는 API들이 비로그인 요청 시 `/login`으로 리다이렉트됨
- 프론트는 리다이렉트 응답을 `!res.ok`로 캐치 → "티켓을 찾을 수 없습니다" 카드 표시

### 누락된 API
| 경로 | 용도 | 권한 설계 |
|------|------|----------|
| `/api/v1/tickets/{id}/public` | 티켓 조회 (메인) | service role로 RLS 우회 (익명 접근 전제) |
| `/api/v1/tickets/{id}/exit-request` | 출차 요청 | service role로 RLS 우회 |
| `/api/v1/tickets/{id}/fee` | 실시간 요금 | PUBLIC 선언 |
| `/api/ticket/check-overdue`, `/api/ticket/{id}/additional-payment` | 레거시 고객용 | PUBLIC |

### 수정 (commit eafc103)
- `/api/ticket` prefix를 `PUBLIC_PATHS`에 추가
- `/api/v1/tickets/{id}/{public|fee|exit-request}` 정규식 매칭 추가
- `TICKET_V1_PUBLIC_RE` 상수 도입 → 10/10 단위 테스트 통과
- ⚠️ `/api/v1/tickets` 루트(CRUD) 및 `/ready`, `/complete`, `/active` 등 크루·관리자 전용은 계속 인증 보호

### 검증
- ✅ 시크릿 창(로그아웃) PC에서 `ticket.mepark.kr/ticket/{id}` 정상 로드
- ✅ 모바일 실기기(카카오톡 인앱 브라우저) 정상 동작 확인
- ✅ 티켓 상태(주차중/발렛/예상요금/출차요청 버튼) 전체 렌더 확인

### 후속 권장
- 월주차 알림톡 3종(monthly_remind/expire/renew)의 링크 행선지 확인 → 같은 티켓 페이지라면 함께 복구됨, 별도 경로라면 추가 점검 필요
- 솔라피 템플릿 버튼 URL 도메인 정리: `mrpark-parking.vercel.app` → `ticket.mepark.kr`로 교체 신청(재심사 2~5 영업일). 현재는 middleware 통과로 실사용 이슈 없음.


---

## 📋 레거시 ↔ v2 갭 분석 결과 (2026.04.27)

> Part 19B-5B 착수 전 선결 점검 완료. P0/P1/P2 분류로 후속 Part 정의.

### 1️⃣ 어드민 페이지 (PC + 모바일)

| 레거시 | v2 대응 | 갭 내용 | 우선순위 |
|---|---|---|---|
| `/dashboard` (757줄) | `/v2/dashboard` (855줄) | v2가 더 풍부(KPI 4 + 추이 + 도넛). **출근인원/총직원수 KPI는 v1만 존재** | **P1** |
| `/parking-status` (1008줄) | `/v2/parking-status` ✅ | 실시간 주차중 + ⚠️초과 탭 + 번호판 수정 + 강제출차(요금/무료) **완료** | ✅ (GAP-P0-3) |
| `/analytics` (849줄) | `/v2/dashboard`에 부분 흡수 | **시간대별 차트, 매장별 비교, 전기간대비 % 누락** | **P1** |
| `/stores` (2735줄) | `/v2/stores` + `/v2/stores/[id]` ✅ (1A·1B·1C) | 사업장 CRUD·주차장(면수)·방문지 요금표 **완료**. 운영시간·근무조·지각규칙은 **1D(후순위)** 잔여 | ✅ (1D 잔여) |
| `/team` (915줄) | **❌ 없음** | 계정생성·비번리셋·제거·매장배정·역할변경(super_admin/admin/crew) | **🔥 P0** |
| `/workers` (1937줄) | `/v2/attendance` ✅ (Part 12A/B) | — | — |
| `/accident` (708줄) | **❌ 없음** | 사고리포트 CRUD + 상태변경 + Excel | **P1** |
| `/monthly` | `/v2/monthly` ✅ | — | — |
| `/settings/{stores,team,workers,default-workers}` | **❌ 없음** | 기본 워커 / 매장 설정 | **P2** |

### 2️⃣ CREW 페이지 (모바일 전용)

v1 디렉토리 13개 vs v2 디렉토리 4개.

| v1 (`/crew/*`) | v2 (`/v2/crew/*`) | 갭 내용 | 우선순위 |
|---|---|---|---|
| `parking-list` | `parking` ✅ | — | — |
| `parking-list/[id]` (707줄) | `parking/[id]` (702줄) | **차량번호 수정 모달 / 차종변경 액션 누락** (v2 코드 코멘트: *"차량준비/번호판수정/타입변경은 19B-4에서 추가"* — 미완) | **🔥 P0** |
| `entry` | `entry` ✅ | 19B-5C에서 4자리 모드로 재작업 예정 | (진행 중) |
| `entry/qr` (QR 입차) | **❌ 없음** | QR 스캔 기반 입차 | **P1** |
| `attendance` | **❌ 없음** | CREW 매일 출퇴근 체크인/아웃 | **🔥 P0** |
| `attendance/history` | **❌ 없음** | 본인 출퇴근 이력 조회 | **P1** |
| `accident` | **❌ 없음** | 현장 사고 등록 (사진 포함) | **P1** |
| `leave` | **❌ 없음** | 휴가 신청 | **P2** |
| `monthly` + `monthly/register` | **❌ 없음** | CREW 모바일에서 월주차 등록/조회 | **P1** |
| `guide` | **❌ 없음** | 사용 안내 | **P2** |
| `settings` | **❌ 없음** | CREW 설정(테마/알림) | **P2** |

### 3️⃣ Sidebar 라우팅 상태

`src/components/layout/Sidebar.tsx`는 현재 거의 전부 v1 경로로 라우팅 중. `/v2/alimtalk`만 v2. v2 페이지 출시 시점에 일괄 교체 필요.

| 메뉴 | 현재 href | 교체 대상 |
|---|---|---|
| 대시보드 | `/dashboard` | `/v2/dashboard` |
| 입차 현황 | `/parking-status` | `/v2/parking-status` (신규 P0) |
| 월주차 관리 | `/monthly` | `/v2/monthly` |
| 매출 분석 | `/analytics` | (제거 — `/v2/dashboard`에 통합 + P1 보강) |
| 근무자 관리 | `/workers` | `/v2/attendance` |
| 매장 관리 | `/stores` | `/v2/stores` (신규 P0) |
| 팀원 초대 | `/team` | `/v2/team` (신규 P0) |
| 사고보고 | `/accident` | `/v2/accident` (신규 P1) |
| 설정 | `/settings` | `/v2/settings` (P2) |

### 🎯 P0 우선순위 작업 (5건)

| # | 작업 | 비고 |
|---|---|---|
| **GAP-P0-1** | `/v2/stores` — 사업장/주차장/방문지 CRUD | ✅ 완료 (1A 사업장 ✅ / 1B 주차장 ✅ / 1C 방문지 ✅). 운영시간·근무조·지각규칙=1D 후순위 |
| **GAP-P0-2** | `/v2/team` — 계정/매장배정/역할 | 🟡 2a 완료(목록·상세·계정·배정·역할). 2b 파트1(백엔드/API: service-role 버그수정+admin-account+마이그레이션SQL) 완료. **2b 파트2(UI: 직원등록·관리자계정생성 폼) 남음** |
| **GAP-P0-3** | `/v2/parking-status` — 실시간 주차중 + 초과차량 | ✅ 완료 (2026.05.29). 주차중+⚠️초과 탭+번호판수정+강제출차(요금/무료). API 전부 기존, UI만 |
| **GAP-P0-4** | `/v2/crew/parking/[id]` 보강 — 차량번호 수정 + 차종변경 | ✅ 완료 (19B-5C와 함께) |
| **GAP-P0-5** | `/v2/crew/attendance` — CREW 출퇴근 | ✅ 완료 (A안: 개인 근태 조회 뷰 / 404 해소). GPS 자가체크인=B안 후속 |

### 📋 P1 우선순위 작업 (7건)

| # | 작업 |
|---|---|
| GAP-P1-1 | `/v2/dashboard` 보강 — 출근/총직원 KPI 카드 추가 |
| GAP-P1-2 | `/v2/dashboard` 보강 — 시간대별 차트 + 매장별 비교 + 전기간대비 % |
| GAP-P1-3 | `/v2/accident` — 사고 CRUD + 상태변경 + Excel |
| GAP-P1-4 | `/v2/crew/entry/qr` — QR 스캔 입차 |
| GAP-P1-5 | `/v2/crew/attendance/history` — CREW 본인 출퇴근 이력 |
| GAP-P1-6 | `/v2/crew/accident` — CREW 현장 사고 등록 (사진) |
| GAP-P1-7 | `/v2/crew/monthly` + `monthly/register` — CREW 모바일 월주차 |

### 📋 P2 작업 (4건)

| # | 작업 |
|---|---|
| GAP-P2-1 | `/v2/settings/*` — 기본 워커 / 매장 설정 |
| GAP-P2-2 | `/v2/crew/leave` — 휴가 신청 |
| GAP-P2-3 | `/v2/crew/guide` — 사용 안내 |
| GAP-P2-4 | `/v2/crew/settings` — CREW 설정 |

### 🚀 실행 순서 권장

1. **Part 19B-5 마무리** (5B → 5C[+ GAP-P0-4 흡수] → 5D) — OCR 4자리 모드 완성
2. **P0 항목 5건** — 관리자/CREW 통합앱 출시 가능 수준
3. **Sidebar 일괄 교체** — v1 → v2 라우팅 전환
4. **P1 항목 7건** — UX 보강
5. **P2 항목 4건** — 부가 기능

