# 미팍티켓 홍보영상 제작 가이드

> 최종 업데이트: 2026.03.02
> 용도: mepark.kr 랜딩페이지 히어로 섹션 + SNS 릴스 겸용
> AI 영상 도구: Sora 2 (OpenAI, Pro $200/월)

---

## 1. 영상 스펙

| 항목 | 랜딩페이지 (메인) | SNS (서브) |
|------|------------------|------------|
| 화면비 | 16:9 가로 | 9:16 세로 |
| 해상도 | 1920x1080 | 1080x1920 |
| 길이 | 30초 (자동 루프) | 30초 (단발) |
| 소리 | 무음 자동재생 | BGM + 효과음 |
| 자막 | HTML 오버레이 | 영상 내 삽입 |
| 배포 | mepark.kr 히어로 | 인스타 릴스, 유튜브 숏츠 |

---

## 2. 크리에이티브 콘셉트

### 핵심 메시지
**"알림톡 하나로 결제부터 출차요청까지"**

### 구조
Before(페인포인트) → 전환(알림톡) → After(해결) 스토리텔링

### 톤 변화
- S1~S2: 차갑고 약간 탁한 톤 (Before)
- S3: 전환점 (카카오 노란색 등장)
- S4~S5: 밝고 따뜻한 톤 (After)
- S6: 네이비 브랜드 각인

### 장소
동네 중형 병원(전문의원) 앞 주차장 — 5~8층 규모, 깔끔한 외관

---

## 3. VALETMAN 유니폼

### 실제 유니폼
로얄 블루 바시티 자켓 (야구잠바 스타일)
- 바디: 로얄 블루 울
- 소매: 화이트 가죽
- 칼라/커프스: 블루+화이트 스트라이프
- 버튼: 실버 스냅
- 좌측 가슴: 골드 "V" 엠블럼
- 하의: 블랙 슬랙스 + 블랙 구두

### Sora 프롬프트용 묘사
```
royal blue wool varsity jacket with white leather sleeves, blue-and-white striped collar and cuffs, silver snap buttons, and a gold "V" emblem on the left chest, black slacks and black shoes
```

---

## 4. 6씬 스토리보드

### S1 (0-3초) Hook — 분주한 주차장

**의도:** "이거 내 현장이다" 공감

**카메라:** 약간 하이앵글, 느린 틸트다운 (건물 → 주차장)
**조명:** 맑은 날 오전, 약간 차가운 톤 (Before 구간)
**동작:**
- 크루 2명(유니폼): 1명 차량 주차, 1명 차키 정리하며 이동
- 고객 2~3명 병원 입구 쪽
- 차량: 현대/기아, 한국 번호판

**프롬프트 (16:9):**
```
Slight high angle shot, slow tilt down from building to parking lot. A modern Korean mid-sized medical clinic building, 6 floors, clean white exterior with Korean signage. A small outdoor parking lot in front with about 15 parked Hyundai and Kia sedans and SUVs with Korean license plates. Two young Korean male valet crew members wearing royal blue wool varsity jackets with white leather sleeves, blue-and-white striped collar and cuffs, silver snap buttons, and a gold "V" emblem on the left chest, black slacks and black shoes. One is driving a white Hyundai Tucson into a space, the other walks across the lot organizing car keys. Two customers visible near the clinic entrance. Bright morning light, slightly cool desaturated tone. Busy but orderly atmosphere. Trees and landscaping visible. Cinematic 4K, 16:9 landscape.
```

---

### S2 (3-8초) Problem — 고객 대기

**의도:** 핵심 페인포인트 "크루는 바쁘고, 고객은 기다리고"

**카메라:** 아이레벨, 고정 → 느린 줌인 (고객 얼굴로)
**조명:** S1과 동일 차가운 톤
**동작:**
- 고객(40대 한국 남성, 다크그레이 정장): 팔짱, 시계 확인, 한숨
- 고객 옆 검은색 제네시스 G80
- 배경에 크루(유니폼)가 다른 차 이동 중

**프롬프트 (16:9):**
```
Eye-level medium shot, slow subtle zoom in toward the subject. A frustrated middle-aged Korean businessman in a dark grey suit standing next to his black Genesis G80 sedan in a Korean medical clinic parking lot. He crosses his arms and checks his watch with an annoyed expression. In the blurred background, a young Korean valet crew member wearing a royal blue wool varsity jacket with white leather sleeves and a gold "V" emblem is busy driving another white car, unable to attend to the waiting customer. Korean clinic signage partially visible. A modern mid-sized clinic building (6 floors) in the background. Bright morning light but slightly cool desaturated tone, tense mood. Cinematic 4K, 16:9 landscape.
```

---

### S3 (8-12초) Transition — 알림톡 도착

**의도:** 분위기 전환점. 어둡고 답답 → 밝고 깔끔.

**카메라:** 클로즈업 (스마트폰 화면), 고정
**조명:** 초반 어둡 → 알림 도착 시 밝아짐
**동작:**
- 삼성 갤럭시 들고 있는 손
- 카카오톡 노란색(#FEE500) 알림 슬라이드 다운
- 탭 → 미팍티켓 UI(네이비+화이트)로 전환

**프롬프트 (16:9):**
```
Extreme close-up of a Samsung Galaxy smartphone screen held by a Korean man's hand. The screen is initially showing a dark lock screen. A KakaoTalk push notification with a bright yellow bubble slides down from the top, showing a Korean text message about parking. The man's thumb taps the notification. The screen transitions with a smooth animation from dark to a bright, clean white and navy blue branded parking service interface with Korean text and a car icon. Lighting shifts from dim to bright as the screen changes. Sharp focus on phone screen, shallow depth of field on hand. Cinematic 4K, 16:9 landscape.
```

**백업:** 실제 폰 화면녹화 + CapCut 모션그래픽

---

### S4 (12-18초) Solution — 결제 + 출차요청

**⚠️ Sora 생성 아님 — UI 프로토타입 화면녹화**

**화면 플로우 (5단계):**
1. 카카오톡 알림톡 도착 (노란 푸시)
2. 미팍티켓 메인 (주차중 상태 + 요금 + 경과시간 타이머)
3. 결제 화면 (카카오페이/삼성페이/카드 선택)
4. 결제완료 ✅ + 출차요청 버튼 (30분 유예 타이머)
5. 출차요청 완료 (크루 준비중 프로그레스)

**UI 프로토타입:** `docs/marketing/mepark-ticket-ui-prototype.jsx`
- ME.PARK 브랜드 컬러 적용 (네이비 #1428A0, 골드 #F5B731)
- 티켓 상태별 색상: parking=네이비, pre_paid=그린, exit_requested=골드
- 탭하면 다음 단계로 자동 전환
- 갤럭시 폰 프레임 목업 포함

**촬영 방법:**
1. UI 프로토타입을 브라우저에서 열기
2. 화면녹화 시작
3. 알림톡 탭 → 티켓확인 → 결제 → 출차요청 순서로 탭
4. CapCut에서 폰 목업 + 배경(네이비 그라데이션) 합성

---

### S5 (18-24초) After — 만족스러운 결과

**의도:** Before 대비 확실한 밝은 톤. 문제 해결됨.

**카메라:** 약간 로우앵글, 느린 트래킹 (고객 따라감)
**조명:** 밝은 골든아워 톤, 채도 높게
**동작:**
- 고객(S2와 같은 남성): 웃으며 병원 로비에서 나옴, 폰 보며 만족
- 크루(유니폼): 차 앞에서 목례 + 차키 두 손 전달
- 배경: 깔끔한 주차장, 햇살, 나무

**프롬프트 (16:9):**
```
Low angle tracking shot. A satisfied Korean businessman in his 40s wearing a dark grey suit walks out of a modern Korean medical clinic glass lobby doors with a warm smile, looking at his Samsung Galaxy phone. Bright golden warm sunlight streams through the doors. In the mid-ground, a young Korean valet crew member wearing a royal blue wool varsity jacket with white leather sleeves, blue-and-white striped collar and cuffs, silver snap buttons, and a gold "V" emblem on the left chest, black slacks and black shoes, stands next to the customer's black Genesis G80 sedan, bowing politely and handing over car keys with both hands. Clean parking lot with Hyundai and Kia cars, trees and landscaping. Modern mid-sized clinic building visible. Warm golden color grading, optimistic uplifting mood. Cinematic 4K, 16:9 landscape.
```

---

### S6 (24-30초) CTA — 엔딩

**의도:** 브랜드 각인

**디자인:**
- 배경: 다크 네이비 (#1428A0)
- 중앙: "미팍티켓" 로고 (화이트) + 골드 글로우
- 하단: "mepark.kr" (화이트 페이드인)
- 우측 하단: 골드 QR코드
- 최하단: "지금 시작하세요" (화이트 페이드인)

**프롬프트 (16:9):**
```
A clean dark navy blue solid background. A modern white Korean text logo "미팍티켓" appears in the center with a subtle golden glow pulse animation. After a beat, white text "mepark.kr" fades in below the logo. A small golden QR code fades in at the bottom right corner. Korean text "지금 시작하세요" gently fades in at the bottom center. Minimal, elegant, professional motion graphics style with smooth easing. 16:9 landscape.
```

**백업:** CapCut/Canva에서 직접 모션그래픽 제작 (더 정확함)

---

## 5. 편집 워크플로우

### 타임라인 (CapCut)
```
0:00─0:03  S1 (분주한 주차장 전경)
0:03─0:08  S2 (고객 대기 + 크루 바쁨)     ← 컷 전환
0:08─0:12  S3 (알림톡 도착 + 탭)           ← 컷 전환
0:12─0:18  S4 (UI 결제+출차요청 화면녹화)   ← 크로스디졸브
0:18─0:24  S5 (밝은 톤 + 목례 + 차키 전달)  ← 크로스디졸브
0:24─0:30  S6 (CTA 엔딩)                   ← 페이드 전환
→ 루프: S6 끝 → S1 처음으로 자동 반복
```

### 자막
| 시간 | 자막 | 스타일 |
|------|------|--------|
| 0:00-0:03 | 주차장, 지금 이런 상황 아닌가요? | 맑은 고딕 Bold, 흰색, 반투명 검정바 |
| 0:03-0:08 | 크루는 바쁘고, 고객은 기다리고... | 맑은 고딕 Bold, 흰색, 반투명 검정바 |
| 0:08-0:12 | 알림톡 하나면 끝 | 맑은 고딕 Bold, 골드(#F5B731), 네이비바 |
| 0:12-0:18 | 정산도, 출차요청도, 알림톡 하나로 | 맑은 고딕 Bold, 흰색, 네이비바 |
| 0:18-0:24 | 고객 만족, 크루 집중, 매출은 자동으로 | 맑은 고딕 Bold, 흰색, 반투명 검정바 |
| 0:24-0:30 | 미팍티켓, 지금 시작하세요 | 맑은 고딕 Bold, 골드, 네이비 배경 |

### 사운드 (SNS 버전만)
- BGM: Suno 생성 (아래 프롬프트)
- 0:08 카카오톡 알림음
- 0:12 밝은 "딩!" 효과음
- 랜딩페이지 버전은 무음

### Suno BGM 프롬프트
```
30-second corporate advertisement background music. Starts with tense, minimal dark piano notes and low muted percussion for the first 8 seconds. At the 8-second mark, a bright notification chime triggers a mood shift. Transitions into uplifting modern electronic with clean piano melody, warm synth pads, and gentle driving beat. Builds optimism through the middle. Ends with a confident resolving chord at 30 seconds. Professional commercial quality, Korean corporate style, no vocals.
```

---

## 6. AI 제작 도구 & 비용

| 도구 | 용도 | 월 비용 |
|------|------|---------|
| Sora 2 (Pro) | 실사 영상 생성 (S1,S2,S3,S5) | $200 |
| Midjourney v7 | 레퍼런스 이미지 | $10 |
| CapCut Pro | 편집, 자막, 전환 | $8 |
| Suno | BGM 생성 | $10 |
| ElevenLabs | AI 나레이션 (옵션) | $5 |
| **합계** | | **~$233/월** |

외주 대비 90%+ 비용 절감 (외주 300~500만원)

---

## 7. 랜딩페이지 적용

### HTML
```html
<section class="hero">
  <video autoplay muted loop playsinline poster="/images/hero-poster.jpg">
    <source src="/videos/mepark-hero.mp4" type="video/mp4">
  </video>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <p class="sub">현장 17년이 만든 전자주차권</p>
    <h1>주차 운영,<br>아직 손으로 하고 계십니까</h1>
    <a href="#contact" class="cta">6개월 무료 도입 신청</a>
  </div>
</section>
```

### 레이아웃
- 좌측: 네이비 그라데이션 오버레이 + 흰색 카피 + 골드 CTA
- 우측: 영상이 비침 (크루 유니폼, 차량, 병원)
- 모바일: 균일한 오버레이 + 중앙 정렬

---

## 8. 출력 파일

| 파일 | 용도 | 스펙 |
|------|------|------|
| mepark-hero.mp4 | 랜딩페이지 | 16:9, 무음, 루프, ≤5MB |
| hero-poster.jpg | 영상 로딩 전 대체 | S1 베스트 프레임 |
| mepark-reels.mp4 | 인스타 릴스 | 9:16, BGM+효과음 |
| mepark-shorts.mp4 | 유튜브 숏츠 | 9:16, BGM+효과음 |
| mepark-sales.mp4 | 영업자료 | 16:9, BGM+효과음 |

---

## 9. 역할 분담

| 작업 | 담당 |
|------|------|
| Sora 영상 생성 | 대표 (sora.com, VPN 미국) |
| UI 프로토타입 제작 | Claude (완료) |
| S6 CTA 모션그래픽 | Claude (코드 생성) 또는 CapCut |
| 영상 이어붙이기 + 자막 | Claude (FFmpeg) 또는 CapCut |
| 최종 색보정 + 정교한 편집 | CapCut (대표) |

---

## 10. 제작 체크리스트

### Sora 생성
- [ ] VPN 미국 → sora.com Pro 로그인
- [ ] 설정: 16:9 / 1080p / 5초
- [ ] S1 생성 (5회) → 베스트 선택
- [ ] S2 생성 (5회) → 베스트 선택
- [ ] S3 생성 (5회) → 또는 화면녹화 대체
- [ ] S5 생성 (5회) → 베스트 선택
- [ ] S6 생성 (3회) → 또는 CapCut 제작

### 화면녹화 & 편집
- [ ] S4 UI 프로토타입 화면녹화
- [ ] CapCut 편집 (6씬 + 자막 + 전환)
- [ ] 색보정 (S1~S2 쿨톤 / S5 웜톤)
- [ ] Suno BGM 생성 (SNS 버전용)

### 출력 & 적용
- [ ] 랜딩페이지용 MP4 (무음, 루프, ≤5MB)
- [ ] SNS용 MP4 (9:16, BGM)
- [ ] poster 이미지 캡처
- [ ] mepark.kr 히어로 섹션 적용
- [ ] 모바일 테스트

---

## 11. 향후 확장 콘텐츠

| 우선순위 | 콘텐츠 | 용도 |
|----------|--------|------|
| 높음 | 60초 풀버전 (기능 상세) | 영업 미팅 |
| 높음 | 고객 인터뷰 + AI 믹스 | 신뢰 구축 |
| 중간 | 15초 기능별 시리즈 (QR, 결제, 월주차) | SNS 지속 |
| 중간 | 네이티브 앱 출시 티저 (3종 앱) | 앱 전환 예고 |
| 낮음 | B2C 고객 관점 ("이 병원 주차 편하다?") | 간접 B2B |

---

## 12. 참고 링크

### Sora 접속
- https://sora.com (VPN 미국 필수, ChatGPT Pro 로그인)

### Sora 활용 레퍼런스
- 6씬 워크플로우: https://aiadopters.club/p/sora-2-ad-creation-workflow
- 프롬프트 프레임워크: https://ecommerce-ai.beehiiv.com/p/guide-creating-product-ads-hooks-with-sora-2
- B2B SaaS 프롬프트: https://sora2.ink/guide/
- 한국 기업 AI 영상 사례: https://sshong.com/blog/17089
