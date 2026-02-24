# mrpark-system.md 업데이트 (2026.02.24)

아래 내용을 mrpark-system.md에 추가/수정하세요.

---

## 1. 월주차 알림톡 정책 섹션 교체 (4.5 섹션)

**기존 내용 삭제 후 아래로 교체:**

```markdown
#### 월주차 알림톡 정책

| 발송 방식 | 시점 | 템플릿 | 비고 |
|----------|------|--------|------|
| 자동 (Vercel Cron) | 만기 D-7 오전 10시 (KST) | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | 1회만 자동 발송 |
| 수동 (관리자) | 언제든지 | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | 배너 📨 버튼으로 발송 |

**핵심 원칙:**
- 자동 발송은 **D-7 1회만** — D-3, D-1 자동 발송 없음
- 수동 발송은 **같은 템플릿 재사용** → 추가 검수 불필요
- 관리자가 만료 임박 배너에서 고객별 `📨 알림톡 발송` 버튼으로 수시 발송 가능
- 중복 방지: `monthly_parking.d7_alimtalk_sent` 컬럼으로 관리

**Cron API:**
- 경로: `GET /api/cron/monthly-remind`
- 스케줄: `0 1 * * *` (UTC) = 매일 오전 10시 KST
- 인증: `Authorization: Bearer {CRON_SECRET}`
- 환경변수: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-remind",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**API 라우트:** 
- `POST /api/alimtalk/monthly` - 수동 발송
- `GET /api/cron/monthly-remind` - 자동 D-7 발송

파라미터: `phone`, `customerName`, `vehicleNumber`, `storeName`, `endDate`, `fee`, `templateType`, `contractId`, `orgId`
```

---

## 2. monthly_parking 테이블 스키마 추가

**Part 6 데이터베이스 스키마 섹션에 추가:**

```markdown
**monthly_parking (추가 컬럼)**
```sql
-- D-7 자동 알림톡 발송 여부
d7_alimtalk_sent boolean DEFAULT false,
d7_alimtalk_sent_at timestamptz
```
```

---

## 3. alimtalk_send_logs 테이블 스키마 추가

**Part 6 테이블 목록에 추가:**

| 테이블 | 용도 |
|--------|------|
| alimtalk_send_logs | 알림톡 발송 로그 |

```markdown
**alimtalk_send_logs (발송 로그)**
```sql
CREATE TABLE alimtalk_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ticket_id uuid,
  monthly_parking_id uuid,
  template_type text NOT NULL,  -- d7_auto_remind, manual_remind
  phone_masked text NOT NULL,   -- 010****1234 (원본 절대 저장 금지)
  send_status text DEFAULT 'pending',  -- pending, success, failed
  message_id text,
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alimtalk_logs_monthly ON alimtalk_send_logs(monthly_parking_id);
CREATE INDEX idx_alimtalk_logs_org ON alimtalk_send_logs(org_id);
```
```

---

## 4. Part 8 파일 구조 추가

```markdown
├── api/
│   ├── alimtalk/
│   │   └── monthly/route.ts      ← 수동 알림톡 발송
│   ├── cron/
│   │   └── monthly-remind/route.ts  ← D-7 자동 Cron
│   ├── invite/route.ts
│   └── ticket/...
```

---

## 5. Part 10 개발 환경 추가

| 항목 | 내용 |
|------|------|
| Cron | Vercel Cron (vercel.json) |

---

## 6. Part 11 TODO 업데이트

```markdown
## Part 11: TODO / 완료 상태

### ✅ 완료
- Part 13 DB 작업 (stores 9컬럼, user roles, notifications, checkout_requests, worker_attendance)
- Part 13.6 월주차 만료 처리 + D-7 자동 알림톡 Cron

### 🔲 진행 예정
- Part 13.5 입차현황 초과 처리
- 모바일 미완료 페이지: 입차현황, 매출분석, 매장관리, 사고보고, 설정, 기능안내, 로그인
- 미팍티켓 MVP
```

---

## 7. 환경변수 목록 추가

```markdown
### 환경변수 (Vercel)

| 변수 | 용도 | 필수 |
|------|------|------|
| CRON_SECRET | Vercel Cron 인증 | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | 서버사이드 DB 접근 | ✅ |
| SOLAPI_API_KEY | 솔라피 API | 알림톡 사용 시 |
| SOLAPI_API_SECRET | 솔라피 Secret | 알림톡 사용 시 |
| SOLAPI_PF_ID | 카카오 채널 ID | 알림톡 사용 시 |
| SOLAPI_TEMPLATE_MONTHLY_REMIND | 월주차 템플릿 코드 | 알림톡 사용 시 |
```
