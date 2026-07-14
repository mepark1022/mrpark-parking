# 다이어트 일지 (Diet Tracker)

Vite + React + Tailwind CSS 기반의 다이어트 기록 앱입니다.
체중, 식사, 운동, 메모를 매일 기록하고 목표 체중까지의 추이를 차트로 확인할 수 있습니다.

## 기술 스택

- [Vite](https://vitejs.dev/) 5
- [React](https://react.dev/) 18
- [Tailwind CSS](https://tailwindcss.com/) 3
- [Recharts](https://recharts.org/) — 체중 추이 차트

## 데이터 저장

모든 데이터는 브라우저 `localStorage`의 단일 키 `diet-tracker-data`에
JSON 형태로 저장됩니다. 별도의 백엔드나 서버가 필요 없습니다.

```json
{ "entries": [ ... ], "goalWeight": 60 }
```

## 시작하기

```bash
npm install   # 의존성 설치
npm run dev   # 개발 서버 실행 (http://localhost:5173)
npm run build # 프로덕션 빌드
npm run preview # 빌드 결과 미리보기
```
