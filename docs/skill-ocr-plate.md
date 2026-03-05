# OCR 번호판 인식 스킬

> 최초 작성: 2026.03.05 | 최종 업데이트: 2026.03.05 (실기기 테스트 반영)
> 관련 파일: `src/app/api/ocr/plate/route.ts`, `src/components/crew/CameraOcr.tsx`

---

## 1. 개요

CREW앱 입차 등록 시 카메라로 번호판을 자동 인식하는 기능.
Google Cloud Vision API를 서버에서 호출해 한국 번호판 패턴을 파싱한다.

**플로우:**
```
IDLE → SCANNING(카메라 ON) → DETECTING(Vision API 호출)
     → CONFIRMING(결과 확인)
          ├─ 한글 인식 성공 → ✅ 맞습니다 → 입차 완료
          └─ 한글 인식 실패(?) → 한글 수정 팝업 자동 오픈 → 수정 후 → 입차 완료
```

---

## 2. 파일 구조

```
src/
├── app/
│   └── api/
│       └── ocr/
│           └── plate/
│               └── route.ts         ← POST /api/ocr/plate
└── components/
    └── crew/
        └── CameraOcr.tsx            ← 카메라 UI 컴포넌트
```

---

## 3. API 라우트 (`/api/ocr/plate`)

### 요청
```typescript
POST /api/ocr/plate
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/..."  // data URL 또는 순수 base64
}
```

### 응답 (성공 - 한글 인식)
```typescript
{ "success": true, "plate": "123가 4567", "candidates": [] }
```

### 응답 (성공 - 한글 미인식 폴백)
```typescript
{ "success": true, "plate": "123? 4567", "candidates": [] }
// → CameraOcr에서 ? 감지 시 한글 수정 팝업 자동 표시
```

### 응답 (실패)
```typescript
{ "success": false, "error": "번호판을 인식하지 못했습니다", "raw": [...] }
```

---

## 4. 번호판 파싱 로직 (route.ts)

### 1차: 한글 포함 정규식
```typescript
const PLATE_PATTERNS = [
  /\d{3}[가-힣]\d{4}/,           // 신형: 123가4567
  /[가-힣]{2}\d{2}[가-힣]\d{4}/, // 구형: 서울12가3456
  /[가-힣]{2}\d{2}[바사아자차카타파하]\d{4}/, // 영업용
  /\d{2}[가-힣]\d{4}/,           // 이륜차: 12가3456
];
```

### 2차: 한글 미인식 폴백 (우선순위 순)

| 케이스 | Vision API 출력 | 원인 | 결과 |
|--------|----------------|------|------|
| A | `1584 2953` | 한글(`나`)을 숫자(`4`)로 오인식 | `158? 2953` |
| B | `1582953` | 한글 완전 누락 (7자리 연속) | `158? 2953` |
| C | `158 2953` | 한글 공백 처리 (3+4 분리) | `158? 2953` |

```typescript
// 케이스 A: 4자리+4자리 (한글→숫자 오인식) ← 가장 흔한 케이스
const m44 = fullText.match(/\b(\d{4})\s+(\d{4})\b/);
if (m44) results.add(`${m44[1].slice(0, 3)}? ${m44[2]}`);

// 케이스 B: 7자리 연속
const m7 = fullText.replace(/\s+/g, "").match(/\d{7}/);
if (m7) results.add(`${m7[0].slice(0,3)}? ${m7[0].slice(3)}`);

// 케이스 C: 3자리+4자리 분리
const m34 = fullText.match(/\b(\d{3})\s+(\d{4})\b/);
if (m34) results.add(`${m34[1]}? ${m34[2]}`);
```

### Vision API 설정
```typescript
features: [
  { type: "TEXT_DETECTION", maxResults: 10 },
  { type: "DOCUMENT_TEXT_DETECTION", maxResults: 5 },
],
imageContext: {
  languageHints: ["ko", "ko-KR"],  // 한국어 우선 인식 (필수)
  textDetectionParams: { enableTextDetectionConfidenceScore: true },
},
```

> ⚠️ **이미지 크롭 금지**
> 크롭 시 번호판 주변 텍스트(로고, 차체 문구 등)가 혼입되어 숫자 오인식 발생.
> 전체 이미지를 그대로 전송하고 Vision API가 번호판 패턴을 직접 찾게 한다.

---

## 5. 컴포넌트 (`CameraOcr.tsx`)

### Props
```typescript
interface CameraOcrProps {
  onConfirm: (plateNumber: string) => void;
  onCancel: () => void;
}
```

### 사용법 (입차 등록 페이지)
```tsx
import CameraOcr from "@/components/crew/CameraOcr";

const [showCamera, setShowCamera] = useState(false);

{showCamera && (
  <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
    <CameraOcr
      onConfirm={(plate) => {
        setPlateNumber(plate);
        setShowCamera(false);
      }}
      onCancel={() => setShowCamera(false)}
    />
  </div>
)}

<button onClick={() => setShowCamera(true)}>📷 번호판 자동 스캔</button>
```

### 핵심 구현 포인트

**1. 카메라 설정 (PC/모바일 호환)**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: "environment" }, // 후면 우선, 없으면 PC 웹캠 폴백
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
});
```

**2. 전체 이미지 캡처 (크롭 없음)**
```typescript
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0, vw, vh);
const base64 = canvas.toDataURL("image/jpeg", 0.95);
```

**3. 카메라 준비 확인 후 캡처**
```typescript
if (!video || video.videoWidth === 0 || video.readyState < 2) {
  setErrorMsg("카메라가 준비되지 않았습니다. 다시 시도해주세요.");
  return;
}
```

**4. ? 감지 시 한글 수정 팝업 자동 표시**
```typescript
if (result.plate.includes("?")) {
  setKoreanVal("");
  setKoreanEdit(true); // 팝업 자동 오픈
}
```

**5. 한글 수정 팝업 — 빠른 선택 16자**
```
가 나 다 라 마 바 사 아 자 차 카 타 파 하 허 호
```
- 버튼 탭으로 즉시 선택
- 직접 입력 1자 지원
- 선택 즉시 번호판 미리보기 반영 (`158? 2953` → `158나 2953`)
- `?` 상태에서 "맞습니다" 버튼 비활성화 (잘못 등록 방지)

### 스캔 타이밍
- 카메라 안정화 대기: **2.5초** (포커스 잡힐 시간 확보)
- JPEG 품질: **0.95**

---

## 6. 환경변수

```env
GOOGLE_VISION_API_KEY=AIza...
```

**GCP 설정:**
1. GCP Console → APIs & Services → Library → **Cloud Vision API** 활성화
2. Credentials → **+ CREATE CREDENTIALS → API key**
3. API 제한사항: **Cloud Vision API만** 선택 (보안)
4. 애플리케이션 제한사항: **없음** (서버사이드 호출이므로 불필요)

---

## 7. 비용

| 규모 | 월 호출 | 월 비용 |
|------|---------|---------|
| 베타 20곳 | ~23,000건 | ~₩45,000 |
| 확장 50곳 | ~78,000건 | ~₩156,000 |
| 100곳 | ~156,000건 | ~₩314,000 |

*월 1,000건 무료, 이후 1,000건당 $1.50*

---

## 8. 알려진 이슈 & 해결 이력

| 날짜 | 증상 | 원인 | 해결 |
|------|------|------|------|
| 2026.03.05 | PC에서 "이미지 너무 작음" 400 에러 | `facingMode: "environment"` 강제로 PC 웹캠 미작동 | `ideal: "environment"` 로 변경 |
| 2026.03.05 | `1584 2953` → `584? 2953` 숫자 오인식 | 크롭 영역에 로고 등 주변 텍스트 혼입 | **크롭 완전 제거**, 전체 이미지 전송 |
| 2026.03.05 | `158나 2953` → `584? 2953` | `나`→`4` 오인식 후 폴백이 뒤에서 4자리 추출 | 4+4 패턴 감지 → 앞 4자리의 첫 3자리 사용 |
| 2026.03.05 | 한글 미인식 시 완전 실패 | 정규식 매칭 없음 | 3단계 폴백 추가 (4+4, 7자리, 3+4) |

---

## 9. 폴백 전략 전체

```
1순위: 한글 정상 인식 → 즉시 확인 화면
2순위: 한글 미인식(? 표시) → 한글 수정 팝업 자동 오픈 → 수정 후 입차
3순위: 완전 인식 실패 → 재스캔 or 직접 입력 모달
```

---

## 10. 향후 네이티브 전환 계획

현재: Web PWA + Google Vision API (~2.5s, ~₩3/건)
→ Phase 2: React Native + Google ML Kit (on-device, ~0.5s, 무료, 오프라인)

```
react-native-vision-camera + Frame Processor
ML Kit 한국어 모델 (~10MB, 최초 1회 다운로드)
5fps 샘플링으로 배터리 최적화
```

---

## 11. 연동된 파일

- `src/app/crew/entry/page.tsx` — Step 1 OCR 버튼 + CameraOcr 오버레이
- `src/app/api/ocr/plate/route.ts` — Vision API 호출 + 번호판 파싱
- `src/components/crew/CameraOcr.tsx` — 카메라 UI + 한글 수정 팝업
- `docs/skill-ocr-plate.md` — 이 문서
