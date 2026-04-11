# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록.

---

## 2026-04-11

### 주식 폼 조회 연동 UX 개선 + 소수점 2자리 정책 변경

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  1. `lookupState` 상태(`"idle" | "success" | "failed"`) 추가 — 신규 추가 시 `"idle"` 초기값, 편집 모드는 `"success"` 초기값
  2. 종목명(`name`)·현재가(`currentPrice`) 필드를 `lookupState !== "idle"` 조건부 렌더링으로 변경 — 최초 입력 시 숨김
  3. 조회 성공 시 `setLookupState("success")`, 실패/에러 시 `setLookupState("failed")` 설정 — 실패 시 필드 노출 + 수동 입력 안내 텍스트 표시
  4. 카테고리 변경 시 `lookupState` 리셋 (비상장은 `"success"`, 나머지는 `"idle"`)
  5. `quantity`, `averagePrice`, `currentPrice`의 `maxDecimals` 1→2 변경, 설명 텍스트 동일 업데이트
- **이유:** 조회 전 빈 종목명·현재가 필드가 노출되어 UX 흐름이 불명확했고, 해외 주식 단가(예: 135.47달러)에서 소수점 1자리로 인한 반올림 오차 발생

### scroll-to-top 모든 환경 노출 + toast 잔류 버그 방어 처리

- **파일:** `src/components/scroll-to-top.tsx`, `src/contexts/asset-data-context.tsx`
- **변경:**
  1. `scroll-to-top.tsx` — `md:hidden` 클래스 제거 → PC/태블릿 포함 전체 환경에서 버튼 노출
  2. `asset-data-context.tsx` — `dismissStaleToasts()` 유틸 추가: 마지막 toast 이후 4초 이상 경과한 경우 `toast.dismiss()` 호출 후 새 toast 표시. `notify.success/error/info` 세 곳 모두 적용
- **이유:** scroll-to-top이 모바일에서만 보였고, 자산 입력 액션 중 이전 toast가 닫히지 않고 남아있는 버그 방어

---

## 2026-04-10

### 자산 입력 컴포넌트 모바일 UX 개선 + 환율 소수점 입력
- **파일:** `cash-input.tsx`, `real-estate-input.tsx`, `loan-input.tsx`, `crypto-input.tsx`, `stock-input.tsx`, `exchange-rate-input.tsx`
- **변경:**
  1. DialogContent에 `overflow-x-hidden overscroll-contain` 추가 → 가로 스크롤 제거, 빈 영역 드래그 고정
  2. 날짜 Input(`type="date"`)에 `max-w-[160px] sm:max-w-full text-sm` 추가 → 모바일에서 박스 이탈 방지 (대출 2-col 그리드는 `min-w-0`)
  3. 환율 NumberInput에 `allowDecimals={true} maxDecimals={1}` 추가 → USD/JPY 소수점 첫째 자리 입력 가능, 모바일 decimal 키패드 표시
- **이유:** 모바일(375px)에서 날짜 입력이 카드 밖으로 넘치고, 다이얼로그 빈 영역 드래그 시 화면이 움직이며, 환율 정수만 입력 가능했던 문제 수정

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
