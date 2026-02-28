# 미팍 시스템 업데이트 (2026.02.28)

> 결제 구조 확정, 매출 대시보드 설계, SaaS 2-레이어 구조 정의

---

## 1. 결제 구조 최종 확정

### 핵심: 모든 매출 → 미스터팍 계좌

```
[고객 결제]
    │
    ├── PG (미팍티켓 모바일) → 토스페이먼츠 → 미스터팍 계좌
    ├── VAN (토스 키오스크) → VAN사 → 미스터팍 계좌
    └── 현금 → 현장 수령 (CREW 기록)
    
미스터팍 → 각 주차장에 정산 배분 (매출 - 수수료)
```

### BM 수익 구조

| 티어 | 월정액 | 고객 수수료 | PG 원가 | 미팍 마진 |
|------|--------|-----------|---------|----------|
| Starter | 19,900원 | 3.5% | 2.0% | 1.5% |
| Basic | 39,900원 | 3.3% | 2.0% | 1.3% |
| Pro | 69,900원 | 3.0% | 2.0% | 1.0% |
| Enterprise | 협의 | 2.8% | 2.0% | 0.8% |

### VAN/PG 통합 가능 이유
- 키오스크 VAN 가맹점 = 미스터팍 사업자 (각 주차장 아님)
- 은행 자금보고 = PG + VAN 통합 확인 가능
- 매통조 = 미스터팍 사업자번호 1개로 전 매장 조회 가능 (고객사별 동의 불필요)
- 매장별 구분 = 미팍 DB의 store_id로 자체 구분

---

## 2. 매출현황 대시보드 설계 — 방안 E (발행방식 기반)

### 핵심 아이디어
"결제 수단"이 아니라 **"티켓 발행 방식"** 기준으로 매출 분류

| 채널 | 데이터 소스 | 수집 방식 |
|------|-----------|----------|
| 📱 미팍티켓 | `mepark_tickets` + `payment_records` | ✅ 100% 자동 |
| 🖥️ 키오스크 | `kiosk_transactions` | MVP: CREW 수동 → Phase 2: Webhook |
| 💵 현금 | `cash_records` | 📝 수동 입력 |

### 미팍티켓 전환율 = SaaS 가치 증명 핵심 지표
```
전체 53건 중 미팍티켓 38건 = 전환율 71.7%
→ "우리 매장 고객 71%가 미팍티켓 사용 중"
→ 건물주에게 도입 효과 수치로 증명
```

### CREW 앱 결제방식 선택 (출차 처리 시)
```
[📱 미팍티켓 결제완료]  ← PG 자동, 금액 입력 불필요
[🖥️ 키오스크 결제완료]  → 금액 입력 (1~2초)
[💵 현금 결제완료]       → 금액 입력
[🆓 무료 출차]           ← 탭 한번
```

---

## 3. 3-레이어 매출 수집 구조

| 레이어 | 데이터 소스 | 타이밍 | 용도 |
|--------|-----------|--------|------|
| ① 매통조 | 10개 카드사 통합 (VAN+PG 전부) | D+1~2 (익일) | 종합 분석, 수수료, 정산 확인 |
| ② PG 실시간 | 토스페이먼츠 `payment_records` | 즉시 | 금일 미팍티켓 결제 현황 |
| ③ 키오스크 VAN | 토스 키오스크 데이터 수신 | 수시간~익일 | 현장 결제 내역 보충 |

### 데이터 흐름
```
[실시간] 미팍티켓 PG 결제 → payment_records 직접 INSERT
[수시간] 토스 키오스크 결제 → (Webhook/CREW입력) → kiosk_transactions
[익일 새벽 Cron] 매통조 API 호출 → crefia_daily_summary → 크로스체크
```

---

## 4. 추가 DB 테이블 설계

### kiosk_transactions (키오스크 VAN 결제)
```sql
CREATE TABLE kiosk_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  amount int NOT NULL,
  card_company text,
  approval_number text,
  transaction_type text DEFAULT 'unclaimed',  -- unclaimed / additional
  plate_number text,
  ticket_id uuid REFERENCES mepark_tickets(id),
  source text DEFAULT 'crew_manual',  -- crew_manual / webhook
  crefia_matched boolean DEFAULT false,
  transaction_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### cash_records (현금 결제)
```sql
CREATE TABLE cash_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  amount int NOT NULL,
  plate_number text,
  ticket_id uuid REFERENCES mepark_tickets(id),
  note text,
  recorded_by uuid REFERENCES auth.users(id),
  transaction_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### crefia_daily_summary (매통조 일일 정산)
```sql
CREATE TABLE crefia_daily_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  summary_date date NOT NULL,
  card_details jsonb NOT NULL,
  total_approval_amount int,
  total_fee_amount int,
  total_deposit_amount int,
  mepark_pg_amount int,
  kiosk_amount int,
  cash_amount int,
  internal_total int,
  difference int,
  unmatched_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, summary_date)
);
```

### v_daily_revenue (매출 통합 뷰)
```sql
CREATE OR REPLACE VIEW v_daily_revenue AS
-- ① 미팍티켓 PG 결제
SELECT mt.org_id, mt.store_id, DATE(mt.entry_at) as revenue_date,
  'mepark_ticket' as channel, mt.parking_type as sub_channel,
  pr.amount, pr.method as payment_method, pr.provider,
  mt.id as reference_id, 'auto' as data_source, mt.entry_at as transaction_at
FROM mepark_tickets mt
JOIN payment_records pr ON pr.ticket_id = mt.id
WHERE pr.status = 'paid'
UNION ALL
-- ② 키오스크 VAN 결제
SELECT kt.org_id, kt.store_id, DATE(kt.transaction_at),
  'kiosk' as channel, kt.transaction_type as sub_channel,
  kt.amount, 'CARD', kt.card_company,
  kt.id, kt.source, kt.transaction_at
FROM kiosk_transactions kt
UNION ALL
-- ③ 현금 결제
SELECT cr.org_id, cr.store_id, DATE(cr.transaction_at),
  'cash', 'cash', cr.amount, 'CASH', NULL,
  cr.id, 'manual', cr.transaction_at
FROM cash_records cr;
```

---

## 5. 여신금융협회 매통조 API 연동 계획

### 등록 절차 (약 5~8주)
1. 포탈 회원가입 (openapi.crefia.or.kr) — 1일
2. API 테스트 — 2~3일
3. 서비스 이용신청 (사업계획서 제출) — 3~5일
4. 이용기관 심사 (규모·재무건전성) — 2~4주
5. 이용계약 체결 — 1~2주
6. OAuth Token 발급 — 즉시

### 미스터팍 장점
- 미스터팍 사업자번호 1개로 전체 매장 VAN+PG 통합 조회
- 고객사별 별도 동의 절차 불필요 (미스터팍 = 가맹점)

### MVP에서는 매통조 없이 운영 가능
- 은행 자금보고로 카드매출 총액 매일 확인 (무료, 즉시)
- 매통조는 규모 커지면 자동화 목적으로 진행

---

## 6. 2-레이어 시스템 구조 확정

### 현재: 고객사 어드민 (1사업자용)
```
mrpark-parking.vercel.app
├── 어드민 (주차장 관리자)
│   └── 대시보드, 입력, 입차현황, 월주차, 매출, 근무자, 매장, 팀원, 사고, 설정
├── CREW앱 (/crew)
│   └── 홈, 입출차, 출퇴근, 사고보고, 월주차, 설정
└── 미팍티켓 (/ticket)
    └── 고객 전자주차권 + QR + 결제
```

### Phase 2: 미스터팍 통합 SaaS 어드민 (신규 필요)
```
admin.mepark.kr (예정)
├── 전체 고객사(주차장) 관리
├── 매장별 매출 통합 조회
├── 정산 관리 (매출 - PG수수료 - VAN수수료 - SaaS마진 = 정산액)
├── SaaS 요금제/구독 관리 (Starter ~ Enterprise)
├── 고객사 계정 발급/온보딩
├── 매통조 연동 (미스터팍 사업자번호 1개)
└── CS 관리
```

---

## 7. 어드민 매출분석 페이지 구조 (설계)

```
📊 매출 분석
├── [실시간] 탭 ← PG + 키오스크 + 현금
│   ├── 금일 미팍티켓: payment_records (PG)
│   ├── 금일 키오스크: kiosk_transactions (VAN)
│   ├── 금일 현금: cash_records
│   └── 합계 + 채널별 비율 + 미팍전환율
│
├── [일일정산] 탭 ← 매통조 (Phase 2)
│   ├── 전일 카드사별 승인 내역
│   ├── PG vs VAN 비교
│   └── 미팍 자체 vs 매통조 크로스체크
│
├── [수수료분석] 탭 ← 매통조 (Phase 2)
│   ├── 카드사별 수수료율
│   └── 실수령액 = 매출 - 수수료
│
└── [정산현황] 탭 ← 매통조 (Phase 2)
    ├── 카드사별 입금예정일
    └── 주차장별 정산액 계산
```

---

## 8. 단계별 진화 로드맵

### Phase 1 (MVP) — 현재 개발 중
```
데이터:  ✅ 미팍티켓 PG 자동  |  📝 키오스크 CREW 수동  |  📝 현금 수동
대시보드: ✅ 3채널 통합 매출 KPI + 채널별 비율 + 미팍전환율
검증:    은행 자금보고 수동 대조
```

### Phase 2 (키오스크 자동화 + 매통조)
```
데이터:  ✅ 미팍티켓 PG 자동  |  ✅ 키오스크 Webhook 자동  |  📝 현금 수동
대시보드: ✅ CREW 키오스크 입력 부담 제거
검증:    매통조 자동 크로스체크 + 수수료 분석 + 정산 현황
```

### Phase 3 (통합 SaaS 어드민)
```
admin.mepark.kr 구축
멀티 고객사 관리 + 통합 정산 + 구독 관리
```
