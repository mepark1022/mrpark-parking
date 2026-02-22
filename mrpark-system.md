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
