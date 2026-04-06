# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록.

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
