# OCR 번호판 인식 스킬

> 작성일: 2026.03.05 | ME.PARK 2.0 CREW앱
> 관련 파일: `src/app/api/ocr/plate/route.ts`, `src/components/crew/CameraOcr.tsx`

---

## 1. 개요

CREW앱 입차 등록 시 카메라로 번호판을 자동 인식하는 기능.
Google Cloud Vision API를 서버에서 호출해 한국 번호판 패턴을 파싱한다.

**플로우:**
```
IDLE → SCANNING(카메라 ON) → DETECTING(Vision API 호출) → CONFIRMING(결과 확인) → CONFIRMED(입차 등록)
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

### 응답 (성공)
```typescript
{
  "success": true,
  "plate": "123가 4567",       // 메인 결과 (포맷 정규화됨)
  "candidates": ["12나 3456"]  // 대안 후보 (있을 경우)
}
```

### 응답 (실패)
```typescript
{
  "success": false,
  "error": "번호판을 인식하지 못했습니다",
  "raw": ["인식된 텍스트들..."]  // 디버깅용
}
```

### 번호판 정규식 패턴
```typescript
const PLATE_PATTERNS = [
  /\d{3}[가-힣]\d{4}/,           // 신형: 123가4567
  /[가-힣]{2}\d{2}[가-힣]\d{4}/, // 구형: 서울12가3456
  /[가-힣]{2}\d{2}[바사아자차카타파하]\d{4}/, // 영업용
  /\d{2}[가-힣]\d{4}/,           // 이륜차: 12가3456
];
```

### 포맷 정규화
- `123가4567` → `123가 4567` (한글 뒤에 공백 삽입)
- `서울12가3456` → `서울12가 3456`
- `12가3456` → `12가 3456`

---

## 4. 컴포넌트 (`CameraOcr.tsx`)

### Props
```typescript
interface CameraOcrProps {
  onConfirm: (plateNumber: string) => void; // 확정 시 콜백
  onCancel: () => void;                     // 취소 시 콜백
}
```

### 사용법 (입차 등록 페이지)
```tsx
import CameraOcr from "@/components/crew/CameraOcr";

// 상태
const [showCamera, setShowCamera] = useState(false);

// 렌더링
{showCamera && (
  <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
    <CameraOcr
      onConfirm={(plate) => {
        setPlateNumber(plate);   // 번호판 자동 입력
        setShowCamera(false);
      }}
      onCancel={() => setShowCamera(false)}
    />
  </div>
)}

// 버튼
<button onClick={() => setShowCamera(true)}>
  📷 번호판 자동 스캔
</button>
```

### 핵심 구현 포인트

**1. 카메라 후면 강제**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment", width: { ideal: 1280 } }
});
```

**2. 뷰파인더 영역 크롭 (canvas)**
```typescript
// 세로 30~54%, 가로 10~90% 영역만 캡처 → Vision API 비용 절약 + 정확도 향상
const cropX = vw * 0.1;
const cropY = vh * 0.30;
const cropW = vw * 0.8;
const cropH = vh * 0.24;
ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
const base64 = canvas.toDataURL("image/jpeg", 0.92);
```

**3. Vision API — TEXT_DETECTION + DOCUMENT_TEXT_DETECTION 병행**
```typescript
features: [
  { type: "TEXT_DETECTION", maxResults: 10 },
  { type: "DOCUMENT_TEXT_DETECTION", maxResults: 5 }, // 번호판 정확도 향상
]
```

---

## 5. 환경변수

```env
# Vercel + .env.local
GOOGLE_VISION_API_KEY=AIza...
```

**발급 방법:**
1. GCP Console → APIs & Services → Library → Cloud Vision API 활성화
2. Credentials → Create API Key → 키 제한 (HTTP 레퍼러: `*.mepark.kr/*`)

---

## 6. 비용

| 규모 | 월 호출 | 월 비용 | 매장당 |
|------|---------|---------|--------|
| 베타 20곳 | ~23,000건 | ~$33 (~45,000원) | ~2,250원 |
| 확장 50곳 | ~78,000건 | ~$116 (~156,000원) | ~3,120원 |
| 100곳 | ~156,000건 | ~$233 (~314,000원) | ~3,140원 |

*월 1,000건 무료, 이후 1,000건당 $1.50 (2026년 기준)*

---

## 7. 폴백 전략

OCR 실패 시 → 직접 입력 모달로 자동 전환
재스캔 버튼으로 즉시 재시도 가능
후보 번호판 복수 표시 (Vision API 결과에서 패턴 복수 매칭 시)

---

## 8. 향후 네이티브 전환 계획

현재: Web (PWA) + Google Vision API (~2s, ~₩3/건)
→ Phase 2: React Native + Google ML Kit (on-device, ~0.5s, 무료, 오프라인)

네이티브 전환 시:
- `react-native-vision-camera` + Frame Processor
- ML Kit 한국어 모델 최초 1회 다운로드 (~10MB)
- 5fps 샘플링으로 배터리 최적화

---

## 9. 연동된 파일

- `src/app/crew/entry/page.tsx` — Step 1에 OCR 버튼 + CameraOcr 오버레이 추가
- `src/app/api/ocr/plate/route.ts` — 신규 생성
- `src/components/crew/CameraOcr.tsx` — 신규 생성
