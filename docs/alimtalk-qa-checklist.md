# 알림톡 실배포 QA 체크리스트

> **작성일:** 2026.04.14 (Part 19D)
> **대상:** 18 시리즈 알림톡 기능 (입차/차량준비/월주차 3종) 실발송 전환
> **관련 도구:** `/v2/alimtalk`(로그), `/v2/alimtalk/health`(환경상태), `/v2/alimtalk/test`(테스트발송)

---

## 0. 사전 준비

### 승인된 템플릿 5종 (KakaoTalk Business)

| 키 | 용도 | 템플릿 코드 (메모리) |
|----|------|---------------------|
| `entry` | 입차확인 | `KA01TP260222021359686qE3A8KaLqAW` |
| `ready` | 차량준비완료 | `KA01TP260222021621089q9OGashc4Qb` |
| `monthly_remind` | 월주차 D-7 | `KA01TP260222022308481aARRiLNr2QY` |
| `monthly_expire` | 월주차 만료 | `KA01TP260222022720623dV0RznZeffT` |
| `monthly_renew` | 월주차 갱신완료 | `KA01TP260222022756100gTRmdzWTSI5` |

### 발신 프로필
- `SOLAPI_PF_ID`: `KA01PF2602181223374948VgQEw1w3yH`
- `SOLAPI_SENDER_NUMBER`: `18991871` (대표번호)

---

## 1. Vercel 환경변수 세팅 (9개)

**위치:** Vercel Dashboard → `mrpark-parking` → Settings → Environment Variables

| # | 키 | 예시/메모 | 민감도 |
|---|----|-----------|--------|
| 1 | `SOLAPI_API_KEY` | Solapi 콘솔에서 발급 | 🔴 High |
| 2 | `SOLAPI_API_SECRET` | Solapi 콘솔에서 발급 | 🔴 High |
| 3 | `SOLAPI_PF_ID` | `KA01PF2602181223374948VgQEw1w3yH` | 🟡 Mid |
| 4 | `SOLAPI_SENDER_NUMBER` | `18991871` | 🟢 Low |
| 5 | `SOLAPI_TEMPLATE_ENTRY` | `KA01TP260222021359686qE3A8KaLqAW` | 🟢 Low |
| 6 | `SOLAPI_TEMPLATE_READY` | `KA01TP260222021621089q9OGashc4Qb` | 🟢 Low |
| 7 | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | `KA01TP260222022308481aARRiLNr2QY` | 🟢 Low |
| 8 | `SOLAPI_TEMPLATE_MONTHLY_EXPIRE` | `KA01TP260222022720623dV0RznZeffT` | 🟢 Low |
| 9 | `SOLAPI_TEMPLATE_MONTHLY_RENEW` | `KA01TP260222022756100gTRmdzWTSI5` | 🟢 Low |

**주의사항:**
- Environment는 반드시 **Production + Preview + Development** 3개 모두 체크
- 값 입력 후 **Redeploy** 필수 (env는 빌드 타임에 주입)
- API_KEY/SECRET은 절대 GitHub 저장소에 커밋하지 말 것

**체크:**
- [ ] 9개 env 모두 Vercel에 등록됨
- [ ] Production/Preview/Dev 3개 환경 모두 적용됨
- [ ] Redeploy 완료

---

## 2. 헬스체크 확인 — `/v2/alimtalk/health`

env 세팅 후 Redeploy 완료됐으면 헬스체크 페이지에서 시각적으로 검증.

**체크:**
- [ ] 9개 env 카드가 모두 ✅로 표시됨
- [ ] 우상단 "환경변수 9/9" 표시
- [ ] 상단 모드 뱃지가 **"✅ 실발송 모드"** (녹색)
- [ ] Solapi 잔액 카드에 실제 잔액(₩) 표시됨
  - ❌ "잔액 조회 실패"면 API_KEY/SECRET 오타 의심
- [ ] 템플릿 5종 모두 "발송 가능 ✅"

**실패 시 대응:**
- env 한 개라도 ❌면 Vercel env 재확인 → Redeploy
- 잔액 조회 실패: API_KEY/SECRET 값 Solapi 콘솔에서 재확인
- 모드가 "시뮬레이션"이면 핵심 3종(API_KEY/SECRET/PF_ID) 확인

---

## 3. 테스트 발송 — `/v2/alimtalk/test`

### 3-1. DryRun 검증 (비용 0)

모든 템플릿 5종에 대해 DryRun 모드로 payload 검증.

**수행:**
1. 템플릿 선택 → 수신번호(대표님 번호) 입력 → **DryRun ON** 유지
2. 변수는 기본값 그대로 → `🧪 DryRun 실행` 클릭
3. 응답 JSON에서 확인:
   - `dryRun: true`
   - `simulated: false` (env 설정됐으므로)
   - `templateCode: "KA01TP..."` — null이면 env 매핑 오류
   - `missing_vars: []` — 누락 변수 없는지 확인

**체크 (5회):**
- [ ] entry (입차확인) — templateCode 정상
- [ ] ready (차량준비완료) — templateCode 정상
- [ ] monthly_remind (D-7) — templateCode 정상
- [ ] monthly_expire (만료) — templateCode 정상
- [ ] monthly_renew (갱신완료) — templateCode 정상

### 3-2. 실발송 검증 (비용 발생)

DryRun 통과 후, 대표님 카카오톡으로 실제 수신 확인.

**수행:**
1. 템플릿 선택 → 수신번호(대표님 번호, 카카오톡 가입된 번호) 입력
2. **DryRun OFF** → 변수 기본값 그대로
3. `🚀 실제 발송` 클릭 → 확인 모달에서 "발송"
4. 응답에서 `result.success: true` + `messageId: "M..."` 확인
5. **대표님 카카오톡 수신 확인** (1~10초 내 도착)

**체크 (5회):**
- [ ] entry — 카카오톡 수신 + 변수 치환 정상 + 버튼 링크 동작
- [ ] ready — 카카오톡 수신 + 변수 치환 정상
- [ ] monthly_remind — 카카오톡 수신 + 변수 치환 정상
- [ ] monthly_expire — 카카오톡 수신 + 변수 치환 정상
- [ ] monthly_renew — 카카오톡 수신 + 변수 치환 정상

**실패 패턴 대응:**
| 증상 | 원인 추정 |
|------|----------|
| `error: "template not found"` | `SOLAPI_TEMPLATE_*` 코드 오타 |
| `error: "variable count mismatch"` | 변수 중 하나 누락 또는 이름 오타 |
| 응답 성공인데 카톡 미수신 | 수신번호가 카카오톡 미가입 / 수신차단 설정 |
| `error: "insufficient balance"` | Solapi 잔액 부족 → 충전 필요 |

### 3-3. 로그 확인

테스트 발송 후 `/v2/alimtalk` 로그 페이지에서 이력 확인.

**체크:**
- [ ] 테스트 발송 5건이 로그에 기록됨
- [ ] `template_type`이 `test_entry`, `test_ready` 등 **test_ 접두** 붙음 (운영 로그와 구분)
- [ ] `phone_masked`가 `010****1234` 형식으로 마스킹됨
- [ ] `send_status: success`

---

## 4. 실제 플로우 검증

테스트 발송 통과 후, 실제 운영 엔드포인트로 플로우 검증.

### 4-1. 입차확인 (entry)

**방법:** CREW 앱에서 실제 입차 처리 → 고객 전화번호 입력 시

- [ ] 입차 처리 완료 시 고객 카카오톡에 입차확인 도착
- [ ] 로그에 `template_type: "entry"` (test_ 접두 없음) 기록
- [ ] 버튼 링크 `ticket.mepark.kr/ticket/{ticketId}` 정상 동작

### 4-2. 차량준비완료 (ready)

**방법:** CREW 앱에서 출차 요청 → 차량 준비 완료 처리

- [ ] 준비완료 처리 시 고객 카카오톡 도착
- [ ] 출구위치/준비시간 정상 표시

### 4-3. 월주차 D-7 자동 (d7_auto_remind)

**방법:** Vercel Cron `/api/cron/monthly-expire` 일일 실행

- [ ] 크론 실행 시 `expiring_in_7_days` 상태 계약 대상 발송
- [ ] `alimtalk_reminder_sent_at` 플래그로 중복발송 방지 확인
- [ ] 로그에 `template_type: "d7_auto_remind"` 기록

### 4-4. 월주차 만료 자동 (monthly_expire_auto)

- [ ] 만료일 도달 시 크론이 자동 발송
- [ ] `alimtalk_expire_sent_at` 플래그로 중복방지

### 4-5. 월주차 수동발송 (3종)

**방법:** `/v2/monthly/{id}` 상세 페이지 → `📨 알림톡` 버튼

- [ ] D-7 재안내, 만료, 갱신완료 3종 수동발송 정상
- [ ] 로그에 `renewal_remind` / `monthly_expire` / `renewal_complete` 기록

---

## 5. 운영 전환 최종 체크

실배포 완료 후 최소 24시간 모니터링.

- [ ] 로그 페이지에서 성공률 **≥ 95%** 확인
- [ ] 실패 로그의 error_message 패턴 분석 (주로 미가입 번호/차단)
- [ ] Solapi 잔액 일일 소진량 예측 (평균 건당 9원)
- [ ] CREW/관리자에 "실발송 모드 가동 중" 공지

---

## 6. 롤백 절차 (긴급시)

잘못된 템플릿이 대량 발송되는 상황이 발생하면:

1. **즉시 차단:** Vercel env에서 `SOLAPI_API_KEY` 삭제 또는 값 변경
2. Redeploy — 다음 발송부터 자동 시뮬레이션 모드로 전환 (로그만 기록)
3. 원인 분석 후 재설정 → Redeploy → 헬스체크 → 재시작

---

## 부록 A: 주요 파일 맵

```
src/lib/utils/solapi.ts                          # 발송 공통 유틸 (HMAC, simulate, log)
src/app/api/alimtalk/entry/route.ts              # 입차 발송
src/app/api/alimtalk/ready/route.ts              # 준비완료 발송
src/app/api/alimtalk/monthly/route.ts            # 월주차 수동발송 (3종)
src/app/api/cron/monthly-expire/route.ts         # D-7/만료 크론
src/app/api/v1/alimtalk/logs/route.ts            # 로그 조회 (Part 18B)
src/app/api/v1/alimtalk/health/route.ts          # 헬스체크 (Part 19D)
src/app/api/v1/alimtalk/test-send/route.ts       # 테스트 발송 (Part 19D)
src/app/v2/alimtalk/page.tsx                     # 로그 UI
src/app/v2/alimtalk/health/page.tsx              # 헬스체크 UI (Part 19D)
src/app/v2/alimtalk/test/page.tsx                # 테스트 발송 UI (Part 19D)
sql/v2/12-monthly-alimtalk-flags.sql             # 중복발송 방지 플래그
```

## 부록 B: 알림톡 운영 정책 (메모리 기준)

- **차량당 2건 원칙:** 입차 + 정산완료만 (출차 알림톡 없음)
- **월주차 자동발송:** D-7만 (D-3/D-1 제거)
- **월주차 수동발송:** 관리자가 상세 페이지에서 3종 중 선택
- **전화번호 저장 금지:** DB에는 마스킹(`010****1234`)만, 실제 번호는 발송 직후 휘발
- **정산완료 템플릿:** 아직 Solapi 미승인 — Part 19A 검토 필요
