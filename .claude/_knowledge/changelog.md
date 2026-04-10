# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록.

---

## 2026-04-10

### 주식 폼 티커 입력 placeholder·설명 카테고리별 개선

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  - `getTickerPlaceholder()` / `getTickerDescription()` 헬퍼 추가 → 카테고리(domestic/foreign/irp/isa/pension/unlisted)별 분기
  - `unlisted`일 때 조회 버튼(`!editData && !isUnlisted`) 숨김 처리
  - `isUnlisted`는 `maxLength=20`으로 완화, ETF 카테고리는 6자리 유지
- **이유:** IRP·ISA·연금은 국내 상장 ETF 코드 6자리이고, 비상장은 API 조회 불가 — 카테고리마다 맥락에 맞는 안내가 필요

---

## 2026-04-06

### max-width 1680px 커스텀 breakpoint 추가

- **파일:** `src/app/globals.css`, `src/app/(main)/asset/layout.tsx`
- **변경:** `@theme { --breakpoint-3xl: 1680px }` 추가 → layout에서 `max-w-screen-3xl` 적용
- **이유:** 기존 `2xl`(1536px)은 넓은 모니터에서 여백이 과도하고, `3xl`(기본 1920px)은 너무 넓어 중간값 필요

### 주식 수익률 표시 개선

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  - 수익률 `(+41.99%)`을 평가손익 금액 `<span>` 내부 인라인에서 분리 → 독립 줄
  - 평가손익 컬럼 정렬: `items-end sm:items-start` → `items-end` (항상 우측 정렬)
- **이유:** 금액 자리수가 클 때 수익률이 자동 줄바꿈되면서 모바일 레이아웃 깨짐
