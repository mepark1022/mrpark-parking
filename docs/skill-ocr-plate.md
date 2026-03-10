# OCR 번호판 인식 스킬

> 최초 작성: 2026.03.05 | 최종 업데이트: 2026.03.10 (BBox 우선파싱 + 멀티프레임 + 뒤4자리 고정 + 한글 38자)
> 관련 파일: `src/app/api/ocr/plate/route.ts`, `src/components/crew/CameraOcr.tsx`

---

## 1. 개요

CREW앱 입차 등록 시 카메라로 번호판을 자동 인식하는 기능.
Google Cloud Vision API를 서버에서 호출해 한국 번호판 패턴을 파싱한다.
**멀티프레임 캡처**: 3장 연속 촬영 → 병렬 API 호출 → 다수결 최적 결과 선택

**플로우:**
```
IDLE → SCANNING(카메라 ON, 1.5초 안정화)
     → DETECTING(3장 캡처 300ms 간격 → 3장 병렬 Vision API 호출)
     → selectBestResult(한글 완전 인식 우선 → 다수결 → 첫 성공)
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

### 2차: 한글 미인식 폴백 — "뒤 4자리 고정" 원칙 (2026.03.10 개선)

> **핵심:** 한국 번호판은 항상 뒤 4자리가 숫자. 앞에서 자르지 말고, 뒤에서 4자리를 먼저 확정.

| 케이스 | Vision API 출력 | 숫자만 추출 | 뒤4 고정 | 신형 후보 | 구형 후보 |
|--------|----------------|------------|---------|----------|----------|
| 한글 탈락 (신형) | `212 9935` | `2129935` (7) | `9935` | `212? 9935` | `21? 9935` |
| 한글→숫자 (신형) | `2125 9935` | `21259935` (8) | `9935` | `212? 9935` | `21? 9935` |
| 한글 탈락 (구형) | `21 9935` | `219935` (6) | `9935` | ❌ | `21? 9935` |
| 한글→숫자 (구형) | `215 9935` | `2159935` (7) | `9935` | `215? 9935` | `21? 9935` |

```typescript
function buildFallbackCandidates(digits: string): string[] {
  const last4 = digits.slice(-4);  // 뒤 4자리 고정
  const front = digits.slice(0, -4);
  // front.length >= 3 → 신형 후보 (앞 3자리)
  // front.length >= 2 → 구형 후보 (앞 2자리)
}
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

### Bounding Box 기반 우선순위 파싱 (2026.03.10 추가)

Vision API `textAnnotations`의 각 블록에는 `boundingPoly.vertices`(4꼭짓점)가 포함됨.
이를 활용해 번호판 가능성이 높은 텍스트 블록을 먼저 파싱하고, 실패 시 전체 텍스트 폴백.

**점수 산정 (`analyzeTextBlocks`):**

| 기준 | 점수 | 설명 |
|------|------|------|
| 가로세로 비율 2.5~6.0 | +30 | 번호판 형태 (가로 직사각형) |
| 가로세로 비율 3.0~5.0 | +15 추가 | 최적 구간 보너스 |
| 가로세로 비율 1.5~2.5 | +10 | 부분 인식 가능 |
| 숫자 포함 비율 | 최대 +25 | `digitRatio * 25` |
| 한글 1~2자 포함 | +15 | 번호판 특성 |
| 텍스트 6~10자 | +15 | 번호판 길이 |
| 정규식 직접 매칭 | +50 | 확정 |

**파싱 흐름:**
```
callGoogleVision → { texts, prioritized }
                        ↓
1차: prioritized에서 parsePlates (score ≥ 20인 블록만)
                        ↓ 실패 시
2차: texts 전체에서 parsePlates (기존 동작)
```

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

**5. 한글 수정 팝업 — 빠른 선택 38자**
```
가~자(9자) 거~저(9자) 고~조(9자) 구~주(9자) 하 허 호 배
```
- 버튼 탭으로 즉시 선택
- 직접 입력 1자 지원
- 선택 즉시 번호판 미리보기 반영 (`158? 2953` → `158나 2953`)
- `?` 상태에서 "맞습니다" 버튼 비활성화 (잘못 등록 방지)

### 스캔 타이밍 (멀티프레임)
- 카메라 안정화 대기: **1.5초** (기존 2.5초 → 단축)
- 연속 캡처: **3장** (300ms 간격)
- API 호출: **3장 병렬** (Promise.all)
- JPEG 품질: **0.95**

### 멀티프레임 최적 결과 선택 (`selectBestResult`)
```
3장 OCR 결과 수신
  → ① 한글 완전 인식(? 미포함) 결과만 필터
  → ② 다수결: 동일 plate가 2장 이상 → 해당 번호 채택
  → ③ 동률이면 첫 번째 성공 결과
  → 모든 결과에서 후보(candidates) 병합 (최대 4개)
```

### UI 진행률 (`multiProgress` state)
| 값 | 의미 | 프로그레스 바 | 하단 텍스트 |
|----|------|------------|------------|
| 0 | 대기/완료 | - | - |
| 1~3 | 프레임 캡처 중 | 25~75% | 📸 프레임 캡처 중 (n/3) |
| 4 | 분석 중 | 95% | 🔍 3장 비교 분석 중... |

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
| 2026.03.10 | 구형 후보 숫자 늘어남 (`21? 29935`) | 앞에서 자르기(slice 0→N)로 뒤 5자리 발생 | **"뒤 4자리 고정" 원칙으로 전면 재작성** |
| 2026.03.10 | 한글 "서" 등 선택 불가 | 빠른선택 16자만 존재 | **38자로 확장** (가~주 36자 + 하허호배) |
| 2026.03.10 | 8자리(한글→숫자), 6자리(한글 탈락) 미처리 | 7자리만 감지 | **6~9자리 전체 처리** |

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
