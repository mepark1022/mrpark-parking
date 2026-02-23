# ME.PARK 2.0 System - 시스템 개발 가이드

> 브랜드/회사 정보는 `mrpark-core.md` 참조  
> 문서/PPT 생성은 `mrpark-output.md` 참조

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | VALETMAN (발렛맨) 주차운영 시스템 |
| 배포 URL | https://mrpark-parking.vercel.app |
| 기술 스택 | Next.js 16 + TypeScript + Tailwind CSS + Supabase + Vercel |
| 대상 규모 | 베타 20곳, 크루 100명, SaaS 확장 대비 |
| 관리자 계정 | mepark1022@gmail.com |
| GitHub | https://github.com/mepark1022/mrpark-parking |
| 도메인 | mepark.kr |
| GitHub PAT | ghp_***************************** |

---

## Part 1: 시스템 아키텍처

### 멀티테넌시 (org_id 기반)

```typescript
// ✅ 필수 패턴 - 모든 SELECT에 org_id 필터
const oid = await getOrgId();
const { data } = await supabase.from("stores").select("*").eq("org_id", oid);

// ✅ 필수 패턴 - 모든 INSERT에 org_id 포함
await supabase.from("stores").insert({ ...payload, org_id: oid });

// ❌ 금지 - org_id 없는 쿼리 (버그 발생 이력 있음)
const { data } = await supabase.from("stores").select("*");
```

**핵심 유틸**
- `getOrgId()`: `src/lib/utils/org.ts` — 현재 사용자의 org_id 반환
- `getUserContext()`: orgId + role + userId 반환

### 매장 배정 시스템

- `store_members` 테이블: user_id + store_id (복수 매장 배정)
- **Admin**: 전체 매장 접근
- **CREW**: store_members에 배정된 매장만 접근

### 반응형 레이아웃

**PC (768px 이상)**
- 좌측 Sidebar 240px 고정 (fixed + h-screen)
- 우측 콘텐츠 영역 (ml-248), maxWidth: 1400px

**모바일 (768px 미만)**
- Sidebar 숨김
- 하단 MobileTabBar (홈/입력/근무자/사고/더보기)
- CSS @media로 제어 (인라인 display 금지 → 깜빡임 방지)

---

## Part 2: 메뉴 구조 (12개)

```
사이드바 (ME.PARK 2.0 로고 + 그라데이션 네이비)
├── 대시보드        /dashboard
├── 데이터 입력     /entry
├── 입차 현황       /parking-status
├── 월주차 관리     /monthly
├── 매출 분석       /analytics
├── 근무자 관리     /workers      (6탭)
├── 매장 관리       /stores       (4탭)
├── 팀원 초대       /team
├── 사고보고        /accident
├── 설정            /settings
├── ─────────
└── 기능안내        /guide        (골드 강조)
```

- 사이드바 드래그앤드롭 순서 커스터마이징 (sidebar_order 테이블)

---

## Part 3: 주요 기능 상세

### 3.1 대시보드 (/dashboard)

**KPI 카드 (4개, text-4xl)**
| 카드 | 아이콘 | 색상 |
|------|--------|------|
| 총 입차량 | 🚗 | #1428A0 |
| 발렛 매출 | 💰 | #F5B731 |
| 주차 매출 | 🅿️ | #16A34A |
| 근무 인원 | 👥 | #8B5CF6 |

**주차장 현황 섹션**
- 매장 선택 탭 (주차장 있는 매장 🅿️ 아이콘)
- 매장 요약: 총/현재/잔여 28px + 점유율 바
- 개별 주차장: 3열 그리드 + 점유율 배지
- ⚠️ `totalSpaces = self_spaces + mechanical_normal + mechanical_suv` (lot.total_spaces 사용 금지)

**점유율별 색상**
| 점유율 | 색상 | 뱃지 |
|--------|------|------|
| 0~60% | #16A34A | 여유 |
| 61~85% | #EA580C | 혼잡 |
| 86~100% | #DC2626 | 만차 임박 |

### 3.2 데이터 입력 (/entry)

- 매장/날짜 선택 → **한국 공휴일 자동 판별**
- 평일: 초록 뱃지, 토요일: 파란, 일요일/공휴일: 빨간 + 공휴일명
- `daily_records`에 `day_type`, `is_holiday` 저장

### 3.3 근무자 관리 (/workers) — 6탭

| 탭 | 기능 |
|----|------|
| 출퇴근 | 오늘의 출퇴근 현황 |
| 명부 | 근무자 CRUD, 2단계 지역 선택 |
| 근태 | 매트릭스 뷰 (근무자=행, 날짜=열), 엑셀 다운 |
| 연차 | 연차 부여/사용/잔여 |
| 근무리뷰 | 근무 평가 |
| 시말서 | 시말서 CRUD |

**근태 매트릭스 뷰**
- 셀 클릭 → 드롭다운 (출근/지각/결근/휴무/연차/삭제)
- 공휴일 노란 배경 + 빨간 공휴일명
- 오늘 하이라이트
- 엑셀: 현재 매장 / 전체 매장(시트별)

### 3.4 매장 관리 (/stores) — 4탭

| 탭 | 기능 |
|----|------|
| 매장 목록 | 매장 CRUD, 도로명주소 검색 |
| 운영시간 | 오픈/마감 시간, 특별추가근무 |
| 근무조 | 근무조 설정 |
| 정상출근체크 | 지각 판별 규칙 |

**매장 구조**
```
매장 (강서점 등)
├── 기본정보 (매장명, 지역, 주소, 담당자)
├── 방문지 (1층 내과, 2층 치과...)  → 개별 요금체계
├── 본관 주차장 (자주식/기계식)
└── 외부 주차장 (자주식/기계식)
```

**주차장 필수 등록 강제**
- 매장 신규 생성 시 → 네이비 배너 "주차장을 등록해주세요!"
- 주차장 0개: 빨간 "필수" 배지 + ⚠️ 경고
- 취소/나가기 시: confirm 팝업

### 3.5 팀원 초대 (/team)

- 이메일 초대 (Resend) + 카카오 로그인 수락
- 복수 매장 선택 가능 (store_members)

---

## Part 4: 미팍티켓 (전자주차권) 시스템

> URL: `ticket.mepark.kr` | VALETMAN 연동 모듈

### 4.1 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **앱 설치 불필요** | 모바일 웹(PWA) 기반 |
| **개인정보 최소화** | 전화번호는 알림톡 발송 즉시 삭제 (DB 미저장) |
| **종이 제로** | QR코드 기반 전자주차권 |
| **VALETMAN 통합** | 관리자 웹/CREW 앱과 실시간 동기화 |

### 4.2 서비스 URL 구조

```
ticket.mepark.kr/ticket/{ticket_id}          ← QR코드 URL
ticket.mepark.kr/ticket/{ticket_id}/pay      ← 결제
ticket.mepark.kr/ticket/{ticket_id}/receipt  ← 전자영수증
ticket.mepark.kr/scan/{store_id}             ← 고정 QR (자주식)
```

### 4.3 티켓 상태 흐름

```
parking → pre_paid → exit_requested → car_ready → completed
parking → completed (자주식 무료 출차)
```

| 상태 | 화면 색상 |
|------|-----------|
| parking | 네이비 #1428A0 |
| pre_paid | 그린 #16A34A |
| exit_requested | 골드 #F5B731 |
| car_ready | 그린 #16A34A |
| completed | 그레이 #94a3b8 |
| 30분 초과 | 레드 #dc2626 |

### 4.4 QR코드 종류 (3가지)

| 유형 | 설치 위치 | URL |
|------|-----------|-----|
| **고정 QR** | 주차장 입구 | `/scan/{store_id}` → 고객이 차량번호 입력 → 티켓 생성 |
| **발렛 QR** | CREW가 발렛 시 전달 | `/ticket/{ticket_id}` |
| **번호판 QR** | CREW 앱에서 생성 | `/ticket/{ticket_id}` |

### 4.5 알림톡 정책 (솔라피)

#### 미팍티켓 (입차/출차) 알림톡

| 시점 | 발송 여부 | 전화번호 처리 |
|------|-----------|---------------|
| 입차 완료 | ✅ 발송 | 발송 즉시 삭제 |
| 차량 준비 완료 | ✅ 발송 | 발송 즉시 삭제 |
| 사전정산 완료 | ❌ Realtime으로 대체 | - |
| 출차 완료 | ❌ 웹에서 영수증 표시 | - |

**총 2회 발송** (입차 + 차량준비). 전화번호는 절대 DB 저장하지 않음 (마스킹 로그만 기록).

#### 월주차 알림톡 정책

| 발송 방식 | 시점 | 템플릿 | 비고 |
|----------|------|--------|------|
| 자동 (Supabase Cron) | 만기 D-7 오전 10시 | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | 1회만 자동 발송 |
| 수동 (관리자) | 언제든지 | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | 배너 📨 버튼으로 발송 |

**핵심 원칙:**
- 자동 발송은 **D-7 1회만** — D-3, D-1 자동 발송 없음
- 수동 발송은 **같은 템플릿 재사용** → 추가 검수 불필요
- 관리자가 만료 임박 배너에서 고객별 `📨 알림톡 발송` 버튼으로 수시 발송 가능
- 발송 횟수 제한 없음 (관리자 판단에 위임)

**솔라피 템플릿 현황:**

| 템플릿 | 코드 | 검수 상태 | 용도 |
|--------|------|-----------|------|
| 월주차 만기 안내 | `SOLAPI_TEMPLATE_MONTHLY_REMIND` | 검수 진행 필요 | 자동(D-7) + 수동 공용 |

**API 라우트:** `POST /api/alimtalk/monthly`
- 환경변수 미설정 시 시뮬레이션 모드로 동작 (개발 안전)
- 파라미터: `phone`, `customerName`, `vehicleNumber`, `storeName`, `endDate`, `fee`, `templateType`

### 4.6 요금 계산 엔진

```typescript
function calculateParkingFee(
  entryTime: Date, exitTime: Date, fee: FeeStructure, isValet: boolean
): number {
  const totalMinutes = Math.ceil((exitTime.getTime() - entryTime.getTime()) / 60000);

  if (totalMinutes <= fee.free_minutes) return isValet ? fee.valet_fee : 0;

  const chargeableMinutes = totalMinutes - fee.free_minutes;
  if (chargeableMinutes <= fee.base_minutes) {
    return Math.min(fee.base_fee + (isValet ? fee.valet_fee : 0), fee.daily_max || Infinity);
  }

  const extraMinutes = chargeableMinutes - fee.base_minutes;
  const extraUnits = Math.ceil(extraMinutes / 10);
  const amount = fee.base_fee + (extraUnits * fee.extra_fee) + (isValet ? fee.valet_fee : 0);
  return Math.min(amount, fee.daily_max || Infinity);
}
```

**visit_places 테이블 요금체계 연동** | 방문지 미선택 시 매장 기본요금 적용

**월주차 자동 판별:**
```
차량번호 검색 → monthly_parking 테이블 조회
├── 활성 월주차 → "월주차 차량" 표시 + 요금 0원
├── 만료 7일 이내 → 만료 예정 경고
└── 미등록 → 일반 요금
```

### 4.7 결제 연동 (토스페이먼츠 결제위젯)

**왜 결제위젯인가:** 1회 연동으로 삼성페이/카카오페이/네이버페이/애플페이/카드 전체 포함

```typescript
// 클라이언트: src/app/ticket/[id]/pay/page.tsx
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const handlePayment = async () => {
  const res = await fetch(`/api/ticket/${ticketId}/calculate`);
  const { amount, orderName, storeName } = await res.json();

  const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
  const payment = tossPayments.payment({ customerKey: ticketId });

  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: amount },
    orderId: `TICKET-${ticketId}-${Date.now()}`,
    orderName: `${storeName} 주차요금`,
    successUrl: `${window.location.origin}/api/payment/success`,
    failUrl: `${window.location.origin}/ticket/${ticketId}/pay?fail=true`,
  });
};
```

```typescript
// 서버: src/app/api/payment/success/route.ts
export async function GET(req: NextRequest) {
  const { paymentKey, orderId, amount } = Object.fromEntries(new URL(req.url).searchParams);

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
  });

  const payment = await response.json();

  if (payment.status === "DONE") {
    const ticketId = orderId.split("-")[1];
    const supabase = createServerClient();

    await supabase.from("payment_records").insert({
      ticket_id: ticketId, payment_key: paymentKey, order_id: orderId,
      amount: Number(amount), method: payment.method,
      provider: payment.easyPay?.provider, status: "paid",
      paid_at: new Date().toISOString(), receipt_url: payment.receipt?.url,
    });

    await supabase.from("mepark_tickets").update({
      status: "pre_paid", paid_amount: Number(amount),
      paid_at: new Date().toISOString(),
      pre_paid_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).eq("id", ticketId);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/ticket/${ticketId}?paid=true`);
  }
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/ticket/${ticketId}/pay?fail=true`);
}
```

**결제 수수료:** 신용카드 2.5~3.4%, 체크카드 1.5~2.3%, 간편결제 카드와 동일

### 4.8 실시간 업데이트 (Supabase Realtime)

```typescript
// 고객 미팍티켓 페이지 - 새로고침 없이 상태 자동 갱신
const channel = supabase
  .channel(`ticket-${ticketId}`)
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'mepark_tickets',
    filter: `id=eq.${ticketId}`
  }, (payload) => updateTicketUI(payload.new))
  .subscribe();
```

### 4.9 데이터베이스 스키마 (미팍티켓)

**mepark_tickets (메인)**
```sql
CREATE TABLE mepark_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  plate_number text NOT NULL,
  plate_last4 text NOT NULL,
  parking_type text NOT NULL DEFAULT 'self',  -- self / valet
  visit_place_id uuid REFERENCES visit_places(id),
  parking_lot_id uuid REFERENCES parking_lots(id),
  parking_location text,
  entry_at timestamptz NOT NULL DEFAULT now(),
  pre_paid_at timestamptz,
  pre_paid_deadline timestamptz,  -- 사전정산 후 30분 유예
  exit_at timestamptz,
  calculated_fee int DEFAULT 0,
  paid_amount int DEFAULT 0,
  additional_fee int DEFAULT 0,   -- 30분 초과 추가요금
  status text NOT NULL DEFAULT 'parking',
  payment_method text,
  payment_key text,
  receipt_url text,
  is_monthly boolean DEFAULT false,
  monthly_parking_id uuid REFERENCES monthly_parking(id),
  entry_alimtalk_sent boolean DEFAULT false,  -- 전화번호 미저장
  ready_alimtalk_sent boolean DEFAULT false,
  entry_crew_id uuid REFERENCES auth.users(id),
  exit_crew_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tickets_org_id ON mepark_tickets(org_id);
CREATE INDEX idx_tickets_plate ON mepark_tickets(plate_number);
CREATE INDEX idx_tickets_status ON mepark_tickets(status);
CREATE INDEX idx_tickets_entry_at ON mepark_tickets(entry_at DESC);
ALTER TABLE mepark_tickets ENABLE ROW LEVEL SECURITY;
```

**payment_records (결제 기록)**
```sql
CREATE TABLE payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, ticket_id uuid NOT NULL REFERENCES mepark_tickets(id),
  payment_key text UNIQUE NOT NULL, order_id text UNIQUE NOT NULL,
  amount int NOT NULL, method text NOT NULL,
  provider text, card_company text,
  status text NOT NULL DEFAULT 'paid',  -- paid / canceled
  paid_at timestamptz, canceled_at timestamptz,
  receipt_url text, created_at timestamptz DEFAULT now()
);
```

**exit_requests (출차요청 - 발렛)**
```sql
CREATE TABLE exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, ticket_id uuid NOT NULL REFERENCES mepark_tickets(id),
  store_id uuid NOT NULL, plate_number text NOT NULL,
  parking_location text, pickup_location text,
  status text NOT NULL DEFAULT 'requested',
  -- requested → preparing → ready → completed
  requested_at timestamptz DEFAULT now(),
  preparing_at timestamptz, ready_at timestamptz, completed_at timestamptz,
  assigned_crew_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

**alimtalk_send_logs (알림톡 로그)**
```sql
CREATE TABLE alimtalk_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL, ticket_id uuid REFERENCES mepark_tickets(id),
  template_type text NOT NULL,
  phone_masked text NOT NULL,  -- 010****1234 (원본 절대 저장 금지)
  send_status text DEFAULT 'pending',
  sent_at timestamptz, error_message text,
  created_at timestamptz DEFAULT now()
);
```

### 4.10 VALETMAN 연동

```sql
-- 미팍티켓 → daily_records 자동 집계 (매일 자정)
INSERT INTO daily_records (store_id, org_id, record_date, total_cars, valet_cars, daily_revenue)
SELECT store_id, org_id, DATE(entry_at),
  COUNT(*), COUNT(*) FILTER (WHERE parking_type = 'valet'), SUM(paid_amount)
FROM mepark_tickets
WHERE DATE(entry_at) = CURRENT_DATE - INTERVAL '1 day' AND status = 'completed'
GROUP BY store_id, org_id, DATE(entry_at)
ON CONFLICT (store_id, record_date) DO UPDATE SET
  total_cars = EXCLUDED.total_cars, valet_cars = EXCLUDED.valet_cars,
  daily_revenue = EXCLUDED.daily_revenue;
```

| 대시보드 KPI | 미팍티켓 소스 |
|-------------|--------------|
| 총 입차량 | `mepark_tickets WHERE status != 'completed'` COUNT |
| 발렛 매출 | `mepark_tickets WHERE parking_type = 'valet'` SUM(paid_amount) |
| 잔여면수 | `parking_lots.total_spaces - 현재 parking 티켓 수` |

### 4.11 개발 로드맵

**Phase 1 (MVP, ~9.5일)**
1. DB 테이블 생성 (mepark_tickets, payment_records, exit_requests)
2. 미팍티켓 고객 페이지 (입차/현황/영수증)
3. QR코드 생성/스캔 (매장 고정 QR)
4. 요금 계산 엔진 (visit_places 연동)
5. 토스페이먼츠 결제위젯 연동
6. CREW 앱 입차등록 → 티켓 자동 생성
7. Supabase Realtime 실시간 업데이트
8. 알림톡 연동 (입차 + 전화번호 즉시 삭제)

**Phase 2 (발렛, ~5일)**
- 출차요청 → CREW 푸시 알림 → 워크플로우
- daily_records 자동 집계, 대시보드 실시간 연동

**Phase 3 (안정화)**
- 토스페이먼츠 PG 심사 + 라이브키 전환 (3~5일 대기)
- 사전정산 30분 초과 추가요금, 에러 처리, 모바일 최적화

### 4.12 npm 패키지 (미팍티켓)

```bash
npm install @tosspayments/tosspayments-sdk
npm install qrcode @types/qrcode
npm install html5-qrcode
npm install solapi  # 기존 설치됨
```

### 4.13 환경 변수 (추가)

```env
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxx
TOSS_SECRET_KEY=test_sk_xxxxx
NEXT_PUBLIC_TICKET_BASE_URL=https://ticket.mepark.kr
# 솔라피는 기존 환경변수 사용
```

---

## Part 5: 한국 공휴일 시스템

### 파일: `src/utils/holidays.ts`

2025~2027년 전체 공휴일 데이터 (설날, 추석, 대체공휴일 포함) — 매년 데이터 추가 필요

```typescript
import { getDayType, getHolidayName, getDayTypeLabel } from "@/utils/holidays";

getDayType("2026-02-17")       // "holiday"
getDayType("2026-02-19")       // "weekday"
getDayType("2026-02-21")       // "weekend"

getHolidayName("2026-02-17")   // "설날"
getDayTypeLabel("2026-02-17")  // { label: "설날", color: "#dc2626", bg: "#fee2e2" }
getDayTypeLabel("2026-02-19")  // { label: "평일", color: "#15803d", bg: "#dcfce7" }
```

### DB 컬럼 (daily_records)

```sql
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS day_type text DEFAULT 'weekday';
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS is_holiday boolean DEFAULT false;
```

---

## Part 6: 데이터베이스 스키마

### 테이블 목록 (org_id 필수)

| 테이블 | 용도 |
|--------|------|
| organizations | 조직(테넌트) 관리 |
| stores | 매장 정보 |
| workers | 근무자 마스터 |
| profiles | 사용자 프로필 |
| store_members | 사용자별 매장 배정 |
| daily_records | 일일 주차 기록 (day_type, is_holiday) |
| hourly_data | 시간대별 입차 |
| worker_assignments | 일일 근무자 배정 |
| monthly_parking | 월주차 계약 |
| invitations | 팀원 초대 |
| parking_lots | 주차장 관리 (**org_id 필수**) |
| parking_entries | 입차 기록 |
| worker_attendance | 근태 기록 |
| worker_leaves | 연차 총계 |
| worker_leave_records | 연차 사용 기록 |
| worker_reviews | 근무 리뷰 |
| worker_reports | 시말서 |
| visit_places | 방문지 관리 |
| store_operating_hours | 매장 운영시간 |
| store_shifts | 근무조 설정 |
| store_late_rules | 정상출근체크 규칙 |
| overtime_shifts | 특별추가근무 |
| sidebar_order | 사이드바 순서 |
| **mepark_tickets** | **미팍티켓 메인** |
| **payment_records** | **결제 기록** |
| **exit_requests** | **출차요청 (발렛)** |
| **alimtalk_send_logs** | **알림톡 발송 로그** |

### 주요 스키마

**parking_lots**
```sql
id uuid PK, store_id uuid FK, org_id uuid NOT NULL,
name text, lot_type text (internal/external),
parking_type text[] ({self}/{mechanical}),
self_spaces int, mechanical_normal int, mechanical_suv int,
operating_days jsonb, open_time time, close_time time
```

**visit_places**
```sql
id uuid PK, store_id uuid FK, org_id uuid NOT NULL,
name text, floor text,
free_minutes int DEFAULT 0, base_fee int DEFAULT 0,
base_minutes int DEFAULT 30, extra_fee int DEFAULT 0,
daily_max int DEFAULT 0, valet_fee int DEFAULT 0, monthly_fee int DEFAULT 0
```

---

## Part 7: UI/UX 디자인 가이드

### 컴포넌트 스타일

**카드**
```css
padding: 12px 14px;
border-radius: 12px;
border: 1px solid #e2e8f0;
```

**상태 뱃지**
| 상태 | 배경 | 텍스트 |
|------|------|--------|
| 여유 | #dcfce7 | #16A34A |
| 혼잡 | #ffedd5 | #EA580C |
| 만차 | #fee2e2 | #DC2626 |

**버튼**
- Primary: 배경 #1428A0, 텍스트 white
- Secondary: 배경 #F5B731, 텍스트 #1A1D2B
- Ghost: 배경 투명, 테두리 #D0D2DA

**섹션 헤더 컬러바**
| 섹션 | 컬러바 |
|------|--------|
| 방문지 관리 | #1428A0 |
| 주차장 관리 | #F5B731 |
| 특별추가근무 | #EA580C |

---

## Part 8: 파일 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (→ /dashboard 리다이렉트)
│   ├── login/page.tsx
│   ├── invite/accept/page.tsx
│   ├── dashboard/page.tsx
│   ├── entry/page.tsx
│   ├── parking-status/page.tsx
│   ├── monthly/
│   ├── analytics/page.tsx
│   ├── accident/page.tsx
│   ├── workers/ (6탭)
│   ├── stores/page.tsx (4탭)
│   ├── team/page.tsx
│   ├── guide/page.tsx
│   ├── more/page.tsx
│   ├── settings/
│   ├── ticket/[id]/          ← 미팍티켓 고객 페이지
│   │   ├── page.tsx           ← 티켓 메인
│   │   ├── pay/page.tsx       ← 결제
│   │   └── receipt/page.tsx   ← 영수증
│   ├── scan/[store_id]/       ← 고정QR 스캔 (자주식)
│   └── api/
│       ├── invite/route.ts
│       ├── payment/success/route.ts   ← 토스페이먼츠 승인
│       └── ticket/[id]/calculate/route.ts
├── components/
│   ├── Logo.tsx
│   └── layout/ (AppLayout, Sidebar, Header, MobileTabBar)
├── utils/
│   └── holidays.ts
├── lib/
│   ├── supabase/ (client.ts, server.ts, middleware.ts)
│   ├── types/database.ts
│   └── utils/ (date.ts, format.ts, org.ts)
└── middleware.ts
```

---

## Part 9: 개발 시 주의사항

### ⚠️ 필수 체크리스트

1. **org_id 필수**: 모든 SELECT에 `.eq("org_id", oid)`, 모든 INSERT에 `org_id` 포함
2. **주차장 면수 계산**: `self_spaces + mechanical_normal + mechanical_suv` (lot.total_spaces 사용 금지)
3. **반응형**: PC(Sidebar) + 모바일(MobileTabBar)
4. **공휴일**: `src/utils/holidays.ts` import
5. **근태 = 출퇴근 연동**: worker_attendance 테이블 공유
6. **Git**: push 전 빌드 에러 체크
7. **전화번호 보호**: mepark_tickets에 절대 저장 금지 (마스킹 로그만)

### 버그 이력 (재발 방지)

| 버그 | 원인 | 해결 |
|------|------|------|
| parking_lots 대시보드 미연동 | INSERT 시 org_id 누락 | payload에 org_id 추가 |
| 주차장 면수 오류 | lot.total_spaces 사용 | self+mechanical 합산 |

---

## Part 10: 개발 환경

| 항목 | 내용 |
|------|------|
| Next.js | v16.1.6 (Turbopack, App Router) |
| Supabase | https://xwkatswgojahuaimbuhw.supabase.co |
| 이메일 | Resend (무료, 월 3,000건) |
| 배포 | Vercel (Hobby) |
| 엑셀 | xlsx (SheetJS) |
| 주소 API | 카카오 주소 API |
| 결제 | 토스페이먼츠 결제위젯 v2 |
| 알림톡 | 솔라피 (Solapi) |
| QR | qrcode.js + html5-qrcode |

---

## Part 11: TODO / 미완성 모바일 페이지

v3 디자인 적용 완료: 대시보드/데이터입력/월주차/근무자/팀원초대

**모바일 미완료 (v3 디자인 적용 필요):**
- 입차현황, 매출분석, 매장관리, 사고보고, 설정, 기능안내, 로그인

---

## Part 12: CREW 앱 기획 확정 (2026.02.23)

> CREW앱_기획서_v3.1.docx 기준 확정본

### 권한 계층

| 역할 | CREW 앱 | 미팍티켓 어드민 | 통합 현황 | 권한 관리 | GPS 반경 설정 | 알림 설정 |
|------|---------|----------------|---------|---------|------------|---------|
| CREW | ✅ | ❌ | ❌ | ❌ | ❌ | 진동/소리만 |
| Admin | ✅ | ✅ | ✅ 전체 | ✅ CREW만 | ✅ 배정매장 | 전체 ON/OFF |
| Super Admin | ✅ | ✅ | ✅ 전체 | ✅ 전체 | ✅ 전체매장 | 전체 ON/OFF |

- Admin·Super Admin CREW 앱 사용 시 매장 목록에서 활동 매장 직접 선택
- Super Admin만 Admin ↔ CREW 양방향 권한 조정 가능

### 미팍티켓 발행 방식 2종 + 운영유형

| 구분 | 명칭 | 설명 |
|------|------|------|
| 발행 방식 ① | QR 스캔 | 고객이 직접 고정QR or 토스키오스크에서 발행 |
| 발행 방식 ② | 미수령 | CREW가 입차 등록, 고객 티켓 미수령 |
| 주차 운영 유형 | 발렛 | CREW가 차량번호+방문지 입력 후 출차요청 워크플로우 처리 |

**입차 등록 시 방문지 선택 필수** (전 방식 공통)
- 방문지 선택 → 해당 방문지 요금체계 적용
- 방문지 미선택 → 매장 기본 요금 적용

**미수령 케이스 분기**
- 키오스크 있는 경우: 미팍 1.0 구조 (CREW 등록 → 고객 키오스크 결제+출차요청 → CREW 푸시 → 키오스크 알림음)
- 키오스크 없는 경우: 토스키오스크 정산만, 출차요청 ❌

### CREW 앱 탭 구조 (최종)

```
홈 | 입차 | 현황 | 출차요청 | 내정보
```

- 기존 '발렛' 탭 → **출차요청** 탭으로 명칭 변경

### 결제 흐름 분기

```
입차
├── 무료 운영 매장 (토글 ON) → 결제 없이 출차요청
├── 월주차 정상기간 → 결제 없이 출차요청
├── 월주차 만료 → '주차장 관리자님에게 문의해주세요' 팝업 (차단)
└── 유료 → 사전결제 후 출차요청
          └── 유예시간 초과 → 키오스크 추가요금 버튼 현장 결제
```

### 매장 설정 토글 항목 (어드민 추가 필요)

| 항목 | 타입 | 설명 |
|------|------|------|
| 무료 운영 | 토글 | ON 시 결제 없이 출차요청 |
| 키오스크 보유 | 토글 | ON 시 미팍 1.0 키오스크 플로우 |
| 토스키오스크 보유 | 토글 | ON 시 토스키오스크 결제 |
| 유예시간 | 숫자 | 사전결제 후 출차 유예시간 (분) |
| GPS 출퇴근 반경 | 숫자 | 출퇴근 인정 반경 (미터, 기본값 150m) |

### 티켓 상태 흐름

```
# 유료 (QR스캔/발렛)
parking → pre_paid → exit_requested → car_ready → completed

# 무료 매장 / 월주차 정상기간
parking → exit_requested → car_ready → completed

# 미수령 (키오스크 있음)
parking → exit_requested → car_ready → completed

# 미수령 (키오스크 없음)
parking → completed (CREW 직접)
```

### 알림톡 발송 정책

| 발행 방식 | 템플릿A (입차) | 템플릿B (정산) | 템플릿C (준비완료) |
|---------|-------------|-------------|----------------|
| QR 스캔 | ✅ | ✅ | ✅ |
| 미수령 | ❌ | ❌ | ❌ (키오스크) |
| 발렛 | ✅ CREW 등록 즉시 | ✅ | ✅ |
| 무료 매장 | ✅ | ❌ 스킵 | ✅ |
| 월주차 정상기간 | ✅ | ❌ 스킵 | ✅ |
| 월주차 만료 | ✅ | ❌ 스킵 | ❌ |

**전화번호 처리 정책**
- 일반 입차: 알림톡 발송 즉시 파기 (DB 저장 금지)
- **예외: 월주차 고객 연락처는 monthly_parking 테이블에 한해 저장** (만기 알림톡 필요)
- alimtalk_send_logs에 마스킹(010****1234)만 기록

### 알림 방식 설정

| 역할 | 팝업 푸시 | 진동/알림음 | 전체 ON/OFF |
|------|---------|-----------|-----------|
| CREW | ✅ 필수 | ON/OFF 선택 | ❌ 항상 수신 |
| Admin | ON/OFF 선택 | ON/OFF 선택 | ✅ 개인별 |
| Super Admin | ON/OFF 선택 | ON/OFF 선택 | ✅ 개인별 |

### 출퇴근 GPS 등록

- **위치**: 내정보 탭 내 출퇴근 섹션
- **방식**: GPS 위치 기반, 매장 반경 이내에서만 버튼 활성화
- **반경 설정**: 매장별 직접 설정 (Admin: 배정매장 / Super Admin: 전체), 기본값 150m
- **처리**: 버튼 클릭 → '처리하겠습니까?' 팝업 → 확인 → 등록
- **하루 1회** 제한 (중복 방지)
- **퇴근 미처리 플로우**: 다음날 앱 실행 시 팝업 → [퇴근 처리 요청] → 어드민 승인 → CREW 알림

### 어드민 페이지 수정 예정 항목

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| 매장 설정 토글 | 무료운영·키오스크·토스키오스크·유예시간·GPS반경 추가 | P0 |
| 권한 관리 | Admin ↔ CREW 권한 조정 (Super Admin 전용) | P0 |
| 알림 설정 | 입차·결제·출차 알림 ON/OFF (Admin·Super Admin) | P0 |
| 매장 선택 화면 | Admin·Super Admin CREW 앱 진입 시 매장 선택 | P0 |
| 월주차 만료 처리 | 결제·출차 차단 + 관리자 문의 팝업 | P1 |
| 추가요금 결제 버튼 | 키오스크 추가요금 버튼 UI | P1 |
| 퇴근 처리 요청 승인 | CREW 요청 수신 · 시간 입력 · 승인 | P1 |
| 근태 미출퇴근 집계 | 개인별 월별 미출근·미퇴근 횟수 표시 | P1 |

---

## Part 13: 어드민 수정 기획 상세 (2026.02.23)

> Part 12 기반 상세 기획서

### 13.1 매장 설정 토글 (P0)

**신규 컬럼 (stores 테이블)**

| 컬럼명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| is_free_parking | boolean | false | 무료 운영 (결제 스킵) |
| has_kiosk | boolean | false | 미팍 1.0 키오스크 보유 |
| has_toss_kiosk | boolean | false | 토스키오스크 보유 |
| grace_period_minutes | integer | 30 | 사전결제 후 유예시간 (분) |
| gps_radius_meters | integer | 150 | GPS 출퇴근 반경 (미터) |
| latitude | decimal(10,7) | null | 매장 위도 (GPS용) |
| longitude | decimal(10,7) | null | 매장 경도 (GPS용) |
| contact_phone | text | null | 매장 관리자 연락처 |
| contact_name | text | null | 매장 담당자명 |

**UI 위치**: `/stores` → 매장 편집 모달 내 "운영 설정" 섹션

### 13.2 권한 관리 시스템 (P0)

**역할 3단계**

| 역할 | 코드 | CREW앱 | 어드민 | 권한관리 |
|------|------|--------|--------|----------|
| CREW | crew | ✅ | ❌ | ❌ |
| Admin | admin | ✅ | ✅ (배정매장) | CREW만 |
| Super Admin | super_admin | ✅ | ✅ (전체) | 전체 |

**UI 위치**: `/team` 페이지 확장 (팀원 목록에 역할 컬럼 + 드롭다운)

**권한 변경 규칙**
- Super Admin: 본인 제외 모든 역할 변경 가능
- Admin: CREW만 관리 (승격/강등 불가)
- CREW: 어드민 접근 불가

### 13.3 알림 설정 (P0)

**알림 종류 3가지**
- 입차 알림: 새 차량 입차 시
- 결제 알림: 사전결제 완료 시
- 출차요청 알림: 출차요청 접수 시

**역할별 설정 권한**

| 역할 | 알림 ON/OFF | 진동/알림음 | 전체 OFF |
|------|-------------|-------------|----------|
| CREW | ❌ (필수 수신) | ON/OFF | ❌ |
| Admin | ON/OFF | ON/OFF | ✅ |
| Super Admin | ON/OFF | ON/OFF | ✅ |

**신규 테이블**: `user_notification_settings`

```sql
CREATE TABLE user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  org_id uuid NOT NULL,
  notify_entry boolean DEFAULT true,
  notify_payment boolean DEFAULT true,
  notify_exit_request boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  vibration_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**UI 위치**: `/settings` 페이지 내 "알림 설정" 섹션

### 13.4 매장 선택 화면 (P0)

**대상**: Admin, Super Admin이 CREW 앱 사용 시

**진입 플로우**
```
CREW 앱 로그인
├── crew (배정 1개) → 바로 홈
├── crew (배정 2개+) → 매장 선택 → 홈
├── admin → 매장 선택 (배정매장) → 홈
└── super_admin → 매장 선택 (전체) → 홈
```

**저장**: localStorage + Context State
**변경**: 홈 탭 상단 [변경] 버튼 → 바텀시트

### 13.5 월주차 만료 처리 (P1)

**상태 3단계**

| 상태 | 조건 | 동작 |
|------|------|------|
| active | 만료일 > D+7 | 정상 (결제 스킵) |
| expiring_soon | D ≤ 만료일 ≤ D+7 | 경고 배너 + 정상 출차 |
| expired | 만료일 < D | ❌ 결제 차단 ❌ 출차 차단 |

**만료 시 고객 화면**: "월주차가 만료되었습니다. 주차장 관리자에게 문의해주세요."
**CREW 앱**: 만료 차량은 일반 유료 입차만 가능
**어드민**: `/monthly` 상단에 만료/임박 차량 섹션 + 갱신 모달

### 13.6 추가요금 결제 - 유예시간 초과 (P1)

**유예시간 흐름**
```
사전결제 완료 (pre_paid)
    │
    ├── 유예시간 내 출차 → 추가요금 없음
    └── 유예시간 초과 → overdue 상태 → 추가결제 필요
```

**추가요금 계산**: (초과 시간 ÷ 10분) × extra_fee

**신규 상태**: `overdue` (유예시간 초과, 추가결제 대기)

**신규 컬럼 (mepark_tickets)**
- additional_fee integer DEFAULT 0
- additional_paid_at timestamptz

**어드민**: `/parking-status`에 "⚠️ 초과" 필터 탭

**키오스크 보유 시**: 결제 방법 선택 (키오스크/웹 결제)

### 13.7 퇴근 처리 요청 승인 (P1)

**시나리오**
```
CREW 퇴근 미처리 → 다음날 앱 실행 → 팝업
→ [퇴근 처리 요청] → 어드민 승인 → 근태 반영
```

**신규 테이블**: `checkout_requests`

```sql
CREATE TABLE checkout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  request_date date NOT NULL,
  requested_checkout_time time,
  request_reason text,
  status text DEFAULT 'pending',  -- pending/approved/rejected
  approved_checkout_time time,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz DEFAULT now()
);
```

**어드민 UI**: `/workers` 출퇴근 탭 상단 "퇴근 처리 요청" 섹션
**승인 시**: worker_attendance 업데이트 + CREW 알림
**반려 시**: 반려 사유 필수 + CREW 알림

**근태 타입 구분 (worker_attendance)**
- check_in_type: normal / manual_approved / admin_edit
- check_out_type: normal / manual_approved / admin_edit

### 13.8 근태 미출퇴근 집계 (P1)

**집계 항목**
- 미출근: 배정 근무일인데 출근 기록 없음
- 미퇴근: 출근은 했는데 퇴근 기록 없음
- 정상/지각/결근/연차

**UI 위치**: `/workers` 근태 탭
- 상단: 월간 요약 카드 (정상/미출근/미퇴근/지각)
- 중단: 개인별 테이블 + [보기] 상세 모달
- 하단: 기존 근태 매트릭스

**매트릭스 셀 표시**

| 상태 | 표시 | 배경색 |
|------|------|--------|
| 정상 | ✓ | #DCFCE7 |
| 미출근 | ✗ | #FEE2E2 |
| 미퇴근 | ⚠ | #FEF3C7 |
| 지각 | 🕐 | #E0E7FF |
| 휴무 | - | #F3F4F6 |

**엑셀 다운로드**: 요약 + 미출근 상세 + 미퇴근 상세 (3시트)

### 13.9 전체 SQL 스크립트

```sql
-- ============================================
-- Part 13 DB 변경사항 전체 (Supabase SQL Editor)
-- ============================================

-- 1. stores 테이블 확장
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_free_parking boolean DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS has_kiosk boolean DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS has_toss_kiosk boolean DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS grace_period_minutes integer DEFAULT 30;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS gps_radius_meters integer DEFAULT 150;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude decimal(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude decimal(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_name text;

-- 2. profiles role 마이그레이션
UPDATE profiles SET role = 'super_admin' WHERE email = 'mepark1022@gmail.com';
UPDATE profiles SET role = 'crew' WHERE role IS NULL OR role = 'user';

-- 3. user_notification_settings 테이블
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  org_id uuid NOT NULL,
  notify_entry boolean DEFAULT true,
  notify_payment boolean DEFAULT true,
  notify_exit_request boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  vibration_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON user_notification_settings(user_id);

-- 4. checkout_requests 테이블
CREATE TABLE IF NOT EXISTS checkout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  request_date date NOT NULL,
  requested_checkout_time time,
  request_reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_checkout_time time,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_org ON checkout_requests(org_id, status);

-- 5. mepark_tickets 추가요금 컬럼
ALTER TABLE mepark_tickets ADD COLUMN IF NOT EXISTS additional_fee integer DEFAULT 0;
ALTER TABLE mepark_tickets ADD COLUMN IF NOT EXISTS additional_paid_at timestamptz;

-- 6. worker_attendance 타입 컬럼
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_in_type text DEFAULT 'normal';
ALTER TABLE worker_attendance ADD COLUMN IF NOT EXISTS check_out_type text DEFAULT 'normal';

-- 7. 기존 필수 작업 (Part 12에서 이관)
UPDATE parking_lots pl SET org_id = s.org_id FROM stores s 
WHERE pl.store_id = s.id AND pl.org_id IS NULL;

ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS day_type text DEFAULT 'weekday';
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS is_holiday boolean DEFAULT false;
```
