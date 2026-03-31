---
name: mepark-homepage
description: 미팍티켓(ME.PARK 2.0) 공식 홈페이지 생성 및 수정 스킬. 사용자가 "홈페이지", "랜딩페이지", "미팍 웹사이트", "mepark.kr 페이지", "미팍티켓 소개 페이지", "홈페이지 수정", "섹션 추가", "홈페이지 v3", "crew-flow", "서비스 소개 페이지", "가상체험", "데모 페이지" 등을 언급하면 이 스킬을 사용한다. 홈페이지 섹션 추가/수정/삭제, 모바일 반응형 작업, 새로운 홈페이지 버전 제작 시 반드시 이 스킬의 레퍼런스 HTML을 먼저 읽고 기존 구조·스타일·패턴을 따른다.
---

# 미팍티켓 홈페이지 스킬

## 1. 개요

미팍티켓 공식 홈페이지(`mepark.kr`)의 마스터 HTML 파일을 관리하는 스킬.
v3 통합본이 2026.3.18 완성, 2026.3.31 실제 도메인 연동 완료.

**라이브 URL**: https://mepark.kr
**파일 위치**: `public/homepage.html` (Vercel 정적 서빙)
**GitHub**: `docs/homepage/mepark-homepage-v3.html` (레퍼런스 사본)

## 2. 도메인 구조 (2026.3.31 연동 완료)

| 도메인 | 용도 | 비고 |
|--------|------|------|
| `mepark.kr` | 홈페이지 | middleware rewrite → homepage.html |
| `www.mepark.kr` | 홈페이지 | mepark.kr → 307 리다이렉트 |
| `admin.mepark.kr` | 관리자 어드민 | 기존 시스템 |
| `ticket.mepark.kr` | 고객 티켓/결제 | /ticket, /scan 경로만 허용 |
| `mrpark-parking.vercel.app` | 기존 URL 유지 | 크루앱 등 기존 접속 유지 |

**DNS**: 후이즈(whois.co.kr)에서 관리
- A 레코드: mepark.kr → 76.76.21.21 (→ 216.198.79.1 권장)
- CNAME: www/admin/ticket → cname.vercel-dns.com (→ 7fcb622ef8564c07.vercel-dns-017.com 권장)

**middleware 라우팅** (`src/middleware.ts`):
```
mepark.kr / → rewrite /homepage.html
mepark.kr /crew, /demo, /api → 직접 통과 (updateSession)
mepark.kr 그 외 → redirect admin.mepark.kr
ticket.mepark.kr /ticket, /scan, /api → 통과
ticket.mepark.kr 그 외 → redirect mepark.kr
admin.mepark.kr, vercel.app → 기존 시스템 (updateSession)
```

## 3. 사용 절차

### 홈페이지 수정/추가 요청 시
1. **반드시** `public/homepage.html`을 먼저 읽는다
2. 기존 CSS 변수, 클래스명, 섹션 구조를 파악한다
3. 수정 사항을 적용 후 GitHub push (Vercel 자동 배포)

### 새 섹션/페이지 제작 시
1. 기존 HTML의 전체 구조를 기반으로 한다
2. 기존 섹션 순서와 네이밍 컨벤션을 유지한다
3. 브랜드 가이드(아래 참조)를 반드시 준수한다

## 4. 페이지 구조 (v3 최종, 12개 섹션)

```
1. GNB (sticky 네비게이션 바)
   - 미팍티켓 로고 (P아이콘 + 미팍 + Ticket)
   - 서비스소개 / 주요기능 / 요금제 / 도입문의 링크
   - [로그인] → admin.mepark.kr 링크
   - [가상체험] → /demo 링크 (골드 배경)

2. HERO (화이트 배경)
   - 배지: "국내 No.1 스마트 주차권 플랫폼"
   - 메인 카피: "주차 운영 문제를 '미팍티켓'으로 해결합니다"
   - [🚗 가상체험 해보기] 골드 버튼 (펄스+쉬머 이펙트)
   - 우측: 폰 목업 (티켓 화면)

3. TRUST BAND (회색 배경, 신뢰 지표)
4. PLATFORM SHOWCASE (3탭 전환: 고객/CREW/어드민)
5. CREW FLOW (3단계 실제 앱 화면: OCR→입차확인→알림톡)
6. WORKFLOW (역할별 4단계: 고객/CREW/관리자)
7. KEY FEATURES (6개 핵심 기술 카드)
8. COMPARE (ME.PARK 1.0 vs 미팍티켓 2.0)
9. PRICING (4단계 요금제)
10. CTA (네이비 배경)
11. FOOTER (다크 배경)
12. 특허 이미지 (5건, base64 임베드)
```

## 5. 히어로 버튼 이펙트

```css
/* 가상체험 버튼 — 골드 펄스 + 쉬머 */
.btn-hero-gold {
  padding: 18px 48px;
  border-radius: 14px;
  background: var(--gold);
  color: var(--dark);
  font-size: 17px;
  font-weight: 800;
  position: relative;
  overflow: hidden;
  animation: btnPulse 2.5s ease-in-out infinite;
}
.btn-hero-gold::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent);
  animation: btnShimmer 3s ease-in-out infinite;
}
@keyframes btnPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(245,183,49,.4); }
  50% { box-shadow: 0 0 0 12px rgba(245,183,49,0); }
}
@keyframes btnShimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}
```

## 6. CSS 설계 패턴

### CSS 변수 (`:root`)
```css
--navy: #1428A0;    --navy-d: #0e1d7a;  --navy-l: #1e38c0;
--gold: #F5B731;    --gold-l: #fac94a;
--dark: #1A1D2B;    --body: #222222;    --gray: #666;
--light: #E8E8E8;   --border: #D0D2DA;  --white: #fff;
--bg: #F7F8FC;
--success: #16A34A;  --warn: #EA580C;   --err: #DC2626;
--info: #0F9ED5;
--fn: 'Noto Sans KR', sans-serif;  --fe: 'Outfit', sans-serif;
```

### 폰트 로드
```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700;800;900&family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
```

### 주요 컴포넌트 클래스
| 컴포넌트 | 클래스 | 설명 |
|---------|--------|------|
| 폰 목업 | `.phone-frame` `.phone-screen` | border-radius 40px, 다크 외곽 |
| PC 목업 | `.pc-frame` `.pc-screen` | 브라우저 탑바 (도트 3개) |
| 기능 카드 | `.feat-card` | 아이콘 + 제목 + 설명 + 태그 |
| 요금 카드 | `.price-card` `.pop` | 인기 플랜에 `.pop` 추가 |
| 플랫폼 탭 | `.ptab` `.platform-content` | JS `switchTab()` 연동 |
| 버튼 (히어로) | `.btn-hero-gold` | 골드 펄스+쉬머 (가상체험) |
| 버튼 (CTA) | `.btn-cta-g` `.btn-cta-w` | 골드 / 화이트 테두리 |

### 디자인 원칙
- ✅ 플랫 디자인 (그라디언트/shadow/3D 금지)
- ✅ 골드는 강조·CTA에만 (배경으로 사용 금지)
- ✅ 미팍티켓 로고 (P아이콘+미팍+Ticket) 필수
- ✅ `max-width: 1200px` 중앙 정렬
- ✅ 네이비 ↔ 화이트 샌드위치 배경 패턴

## 7. 가상체험 페이지 기획 (mepark.kr/demo)

### 7.1 컨셉

> 홈페이지 방문자가 차량번호 + 전화번호를 입력하면, 실제 카카오 알림톡을 수신하고 미팍티켓 전체 흐름을 체험하는 라이브 데모

### 7.2 페이지 구조

```
1. 헤더
   - VIRTUAL EXPERIENCE 뱃지
   - "미팍티켓 가상체험" 타이틀
   - "주차요원의 운영 프로세스와 고객이 받는 경험을 확인하세요"

2. 프로세스 비교 (좌우 횡배치)
   ┌─────────────────────────┬─────────────────────────┐
   │ CREW 주차요원 프로세스     │ 고객 경험 프로세스         │
   │ (네이비 배경)             │ (화이트 배경)             │
   │                         │                         │
   │ ① 번호판 OCR 스캔         │ ① 카카오 알림톡 수신       │
   │   ML Kit 0.5초 오프라인    │   카카오톡 실시간 알림      │
   │                         │                         │
   │ ② 입차 정보 확인·등록      │ ② 주차권·실시간 요금 확인   │
   │   QR 전자주차권 생성       │   토스페이먼츠 결제         │
   │                         │                         │
   │ ③ 고객 알림톡 자동 발송    │ ③ 차량 준비 완료 안내       │
   │   전화번호 즉시 삭제       │   주차부스 이동            │
   └─────────────────────────┴─────────────────────────┘

3. 알림톡 전송 방식 (2열 카드)
   ┌─────────────────┬─────────────────┐
   │ 방식 A           │ 방식 B           │
   │ 주차요원 발송      │ 고객 QR 스캔      │
   │ (네이비 포인트)    │ (골드 포인트)      │
   │                  │                  │
   │ · 번호판 스캔      │ · 입구 고정 QR    │
   │ · 연락처 입력      │ · 차량번호 입력    │
   │ · 알림톡 자동발송   │ · 전자주차권 발급   │
   │ · 전화번호 즉시삭제  │                  │
   └─────────────────┴─────────────────┘

4. 안내 배너 (골드)
   "가상체험에서는 주차요원 직접입력 시나리오 방식으로 시연합니다"

5. 가상체험 CTA (다크 배경, 2컬럼)
   ┌──────────────┬──────────────────────┐
   │ CREW앱 실제화면 │ 가상체험              │
   │ (OCR 폰 목업)  │ 차량번호 입력          │
   │ 스캔라인 애니   │ 연락처 입력            │
   │ 메이션         │ [체험 시작하기] 골드 버튼 │
   │               │ 전화번호 즉시삭제·1일3회  │
   └──────────────┴──────────────────────┘
```

### 7.3 체험 플로우

```
[체험 시작하기] 클릭
    ↓
① 데모 티켓 생성 (mepark_tickets, is_demo=true)
    ↓
② 입차 알림톡 즉시 발송 (솔라피)
   → 고객 카카오톡으로 주차권 링크 도착
    ↓
③ 10초 후 "차량 준비 완료" 알림톡 자동 발송
    ↓
④ 체험 완료 화면 → 도입 문의 CTA
    ↓
⑤ 24시간 후 데모 데이터 자동 삭제 (Cron)
```

### 7.4 기술 구현

```
URL: mepark.kr/demo (middleware에서 직접 통과 설정 완료)
페이지: src/app/demo/page.tsx

API:
  POST /api/demo/create
  → 데모 티켓 생성 + 입차 알림톡 발송
  → 10초 후 차량준비 알림톡 (setTimeout 또는 예약발송)

DB:
  mepark_tickets에 is_demo = true 플래그
  → 24시간 후 Cron 자동 삭제

의존성:
  솔라피 알림톡 연동 완료 필수
  토스페이먼츠는 체험 티켓에서 비활성
```

### 7.5 안전장치

| 항목 | 방안 |
|------|------|
| 스팸 방지 | 같은 번호 1일 3회 제한 |
| 비용 절감 | 알림톡 2건만 발송 (입차 + 차량준비) |
| 개인정보 | 전화번호 발송 즉시 삭제 (기존 정책 동일) |
| 데모 데이터 | 24시간 후 Cron 자동 정리 |
| 결제 차단 | 체험 티켓 결제 버튼 비활성 ("체험 모드") |

### 7.6 CTA 폰 목업 (OCR 화면)

다크 배경 좌측에 CREW앱 OCR 실제 화면을 폰 목업으로 표시:
- 미팍Ticket 로고 (CREW 뱃지 제거)
- 골드 스캔라인 애니메이션
- 뷰파인더 (골드 코너)
- "번호판 스캔" 골드 버튼 + "직접 입력" 고스트 버튼
- 하단 캡션: "CREW앱 실제 화면" (골드 강조, 밝기 80%)

## 8. 탭 타이틀

```
홈페이지: 미팍티켓 | AI 스마트주차권
어드민:   미팍티켓 | AI 스마트주차권
```

## 9. 회사 고정 정보

```
회사명: 주식회사 미스터팍 (Mr. Park Co., Ltd.)
대표: 이지섭
전화: 1899-1871
이메일: mepark1022@gmail.com
주소: 인천광역시 연수구 갯벌로 12, 인천테크노파크 갯벌타워 1501A,B호
설립일: 2018.09.10
직원: 19명 (4대보험)
매출: 14억 원 (2026.2)
특허: 5건 보유
```

## 10. 완료/대기 항목

### ✅ 완료
- [x] v3 통합본 제작 (crew-flow-v2 + mepark-homepage-v2 합본) ✅ 2026.3.18
- [x] 도메인 연동 (mepark.kr / admin / ticket) ✅ 2026.3.31
- [x] DNS 설정 (후이즈 A+CNAME) ✅ 2026.3.31
- [x] Vercel 도메인 등록 + SSL ✅ 2026.3.31
- [x] middleware 도메인별 라우팅 ✅ 2026.3.31
- [x] GNB 버튼: 로그인(→admin) + 가상체험(→/demo) ✅ 2026.3.31
- [x] 히어로 버튼: 가상체험 단일 (골드 펄스+쉬머) ✅ 2026.3.31
- [x] 탭 타이틀: "미팍티켓 | AI 스마트주차권" ✅ 2026.3.31
- [x] href="#" 제거 (URL /#문제) ✅ 2026.3.31
- [x] 가상체험 페이지 기획 확정 ✅ 2026.3.31

### 🔲 대기
- [ ] 가상체험 페이지 개발 (솔라피 연동 후)
- [ ] 모바일 반응형 (현재 PC 전용)
- [ ] 후이즈 DNS 새 값 업데이트 (76.76.21.21 → 216.198.79.1)

## 11. 레퍼런스 파일

| 파일 | 설명 |
|------|------|
| `public/homepage.html` | 현재 라이브 홈페이지 (mepark.kr 서빙) |
| `docs/homepage/mepark-homepage-v3.html` | GitHub 레퍼런스 사본 |
| `docs/homepage/crew-flow-v2.html` | CREW앱 3단계 플로우 섹션 |

> 새로운 섹션을 추가하거나 기존 섹션을 수정할 때는 반드시 `public/homepage.html`을 먼저 읽고, 동일한 CSS 변수·클래스 네이밍·구조 패턴을 따른다.
