# 개발 규칙 & 패턴

> 마지막 업데이트: 2026-04-06

## 언어 규칙

- 모든 응답, 코드 주석, 커밋 메시지는 **한국어**로 작성

## 코드 패턴

### 새 자산 타입 추가 시 체크리스트

```
1. src/types/asset.ts        → Zod 스키마 + TS 타입 추가
2. src/lib/asset-storage.ts  → 저장/로드 로직 추가
3. src/contexts/asset-data-context.tsx → CRUD 함수 추가
4. src/app/(main)/asset/_components/xxx-input.tsx → 입력 폼 컴포넌트 생성
5. src/app/(main)/asset/page.tsx → 컴포넌트 등록
6. src/config/asset-options.ts → 카테고리 옵션 추가 (필요 시)
```

### CRUD 함수 반환 패턴

```typescript
// 모든 add/update/delete 함수는 boolean 반환
// 성공: true, 실패: false
const success = addStock(data);
if (success) toast.success("...")
else toast.error("...")
```

### 통화 표시 패턴

```typescript
// 컴포넌트 내 헬퍼
const formatCurrencyDisplay = (value: number, currency: string = "KRW") => {
  if (currency === "USD") return `$${value.toLocaleString(...)}`;
  if (currency === "JPY") return `¥${value.toLocaleString(...)}`;
  return formatCurrency(value);  // number-utils의 원화 포맷
}

// 해외주식 원화 환산
const krwValue = foreignValue * getMultiplier(currency);
const getMultiplier = (currency?: string) => {
  if (currency === "USD") return exchangeRates.USD;
  if (currency === "JPY") return exchangeRates.JPY / 100;  // 100엔 기준이므로
  return 1;
}
```

### 환차손익 계산 패턴 (해외주식)

```typescript
// 매입 환율 기준 원화 환산 (purchaseExchangeRate 없으면 현재 환율 폴백)
const getPurchaseRatePerUnit = (stock: Stock): number => {
  if (!stock.purchaseExchangeRate || stock.purchaseExchangeRate <= 0) {
    return getMultiplier(stock.currency);
  }
  return stock.currency === "JPY"
    ? stock.purchaseExchangeRate / 100
    : stock.purchaseExchangeRate;
};

const totalCostInKRW = isForeign
  ? totalCostInCurrency * purchaseRatePerUnit  // 매입 환율 기준
  : totalCostInCurrency * krwMultiplier;

const currencyGain = isForeign
  ? (krwMultiplier - purchaseRatePerUnit) * quantity * averagePrice
  : 0;
```

### 카드 레이아웃 패턴 (자산 목록 아이템)

```tsx
<div className="rounded-lg border bg-card overflow-hidden">
  {/* 헤더: 카테고리 + 이름 + 액션 버튼 */}
  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-b">

  {/* 핵심 지표: 좌우 분할 */}
  <div className="flex flex-row items-start justify-between sm:justify-start gap-4 p-4">
    <div className="flex flex-col gap-0.5">  {/* 좌: 평가금액 */}
    <span className="hidden sm:inline text-border self-center">|</span>
    <div className="flex flex-col items-end gap-0.5">  {/* 우: 평가손익 (항상 우측 정렬) */}

  {/* 보조 섹션: bg-muted/10 border-t */}
  <div className="px-4 py-3 bg-muted/10 border-t">

  {/* 하단 메타: flex-wrap, 소형 텍스트 */}
  <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t bg-muted/5">
</div>
```

### 수익률 표시 패턴

```tsx
{/* 금액과 수익률을 별도 줄로 분리 — 줄바꿈 시 정렬 유지 */}
<div className="flex flex-col items-end gap-0.5">
  <span className="text-xs text-muted-foreground">평가손익</span>
  <span className={`text-medium font-bold ${getProfitLossColor(profit)}`}>
    {formatCurrencyDisplay(profit)}
  </span>
  <span className={`text-xs font-semibold ${getProfitLossColor(profit)}`}>
    ({rate >= 0 ? "+" : ""}{rate.toFixed(2)}%)
  </span>
</div>
```

## 스타일 규칙

### Tailwind 버전

- **Tailwind CSS v4** 사용
- `tailwind.config` 없음 — CSS 파일에서 `@theme` 블록으로 설정
- 커스텀 breakpoint 추가: `globals.css`의 별도 `@theme {}` 블록 (inline과 분리)

```css
/* globals.css */
@theme {
  --breakpoint-3xl: 1680px;
}

@theme inline {
  /* 색상 변수들 */
}
```

### 반응형 패턴

- 모바일 우선 설계
- `sm:` prefix: 640px 이상 (태블릿/PC)
- 모바일에서 우측 정렬 → `items-end`
- 데스크탑에서 좌측 정렬 → `sm:items-start`
- 구분자 `|`: `hidden sm:inline`으로 모바일 숨김

### 색상 시스템

- `ASSET_THEME.*` 상수 사용 (직접 Tailwind 클래스 하드코딩 지양)
- `getProfitLossColor(value)` 로 수익/손실 색상 결정

## 주의사항

### localStorage

- 모든 자산 데이터는 localStorage에만 존재 → 예외 처리 철저
- 저장 실패 시 `false` 반환, 사용자에게 toast 알림

### 해외주식 수량/가격

- `allowDecimals={true}`, `maxDecimals={1}` — 소수점 1자리 허용
- JPY 환율은 100엔 기준이므로 계산 시 `/100` 적용

### 주식 티커 검증

- domestic: `/^\d{6}$/` — 정확히 6자리 숫자
- foreign: `/^[A-Z0-9]{1,10}$/` — 대문자 영문+숫자, 1~10자

### API 에러 처리

```typescript
// 500 에러 연속 3회 → API 호출 비활성화 패턴
const errorCount = parseInt(localStorage.getItem("finance_api_error_count") || "0");
if (errorCount >= 3) { /* 조회 비활성화 */ }
// 성공 시: localStorage.removeItem("finance_api_error_count")
```
