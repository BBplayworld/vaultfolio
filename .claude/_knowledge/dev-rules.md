# 개발 규칙 & 패턴

> 마지막 업데이트: 2026-05-16

## 코드 패턴

### 새 자산 타입 추가 체크리스트
1. `src/types/asset.ts` — Zod 스키마 + TS 타입
2. `src/lib/asset-storage.ts` — 저장/로드 로직
3. `src/contexts/asset-data-context.tsx` — CRUD 함수
4. `src/app/(main)/asset/_components/bottom-nav/asset-update/input/xxx-input.tsx` — 입력 폼
5. `src/app/(main)/asset/_components/layout/asset-page-tabs.tsx` — 탭 등록
6. `src/config/asset-options.ts` — 카테고리 옵션 (필요 시)

### CRUD 반환 패턴
```typescript
// 모든 add/update/delete → boolean 반환
const success = addStock(data);
if (success) toast.success("..."); else toast.error("...");
```

### 통화 표시 패턴
```typescript
const formatCurrencyDisplay = (value: number, currency = "KRW") => {
  if (currency === "USD") return `$${value.toLocaleString(...)}`;
  if (currency === "JPY") return `¥${value.toLocaleString(...)}`;
  return formatCurrency(value);  // 원화
};
const getMultiplier = (currency?: string) =>
  currency === "USD" ? exchangeRates.USD :
  currency === "JPY" ? exchangeRates.JPY / 100 : 1;  // JPY는 100엔 기준
```

### 수익률 표시 패턴 (금액과 분리된 독립 줄)
```tsx
<div className="flex flex-col items-end gap-0.5">
  <span className="text-xs text-muted-foreground">평가손익</span>
  <span className={`text-medium font-bold ${getProfitLossColor(profit)}`}>{formatCurrencyDisplay(profit)}</span>
  <span className={`text-xs font-semibold ${getProfitLossColor(profit)}`}>({rate >= 0 ? "+" : ""}{rate.toFixed(2)}%)</span>
</div>
```

### localStorage 직접 접근 패턴
```typescript
import { STORAGE_KEYS } from "@/lib/local-storage";
localStorage.getItem(STORAGE_KEYS.assetData)
```

### tickerList 캐시 키 일관성 (필수)
`fetchProfitRef` 호출자(profit-chart, stock-tab, asset-data-context의 saveSnapshots)는 **반드시 동일한 tickerList**를 생성해야 한다.

```typescript
// ✅ 올바른 패턴
const tickerList = Array.from(
  new Set(stocks.map(normalizeTicker).filter(Boolean))
).sort().join(",");

// ❌ 정렬 누락 → 캐시 키 분기 → 중복 fetch (3회+ 회귀 발생)
const tickerList = stocks.map(normalizeTicker).filter(Boolean).join(",");
```

### 비활성 종목 필터링 패턴
```typescript
// 자산 평가/원가/환차익/count: delisted 제외
data.stocks.filter(s => s.inactiveStatus !== "delisted")

// 가격 갱신: halted는 currentPrice 유지
const isHalted = result.inactiveStatus === "halted";
currentPrice: isHalted ? stock.currentPrice : result.price
```

---

## 스타일 규칙

### Tailwind CSS v4
- `tailwind.config` 없음 — `globals.css`의 `@theme` 블록으로 설정
- 커스텀 breakpoint: `--breakpoint-3xl: 1680px` (별도 `@theme {}` 블록, inline과 분리)

### 반응형 패턴
- 모바일 우선, `sm:` = 640px 이상
- 구분자 `|`: `hidden sm:inline`으로 모바일 숨김
- 색상: `ASSET_THEME.*` 상수 사용 (직접 클래스 하드코딩 지양)

---

## 1회성 마이그레이션 추가 방법
1. `src/lib/one-time-migrations.ts`의 `MIGRATIONS`에 `{ id, run }` 추가
2. id는 한 번 정해진 후 변경 금지 (변경하면 다시 실행됨)
3. 매 진입 시 done 체크 → 미실행 항목만 실행. 실패 시에도 done 기록 (재시도 방지)
4. 실행 시점: `migrateStorageKeys()` 내부에서 자동 호출

---

## 주의사항

### localStorage
- 모든 자산 데이터는 localStorage에만 존재 → 저장 실패 시 `false` 반환 + toast 알림
- 키는 반드시 `STORAGE_KEYS.*` 상수 사용 (`src/lib/local-storage.ts`)

### 해외주식
- `allowDecimals={true}`, `maxDecimals={2}` — 소수점 2자리
- JPY 환율은 100엔 기준 → 계산 시 `/100`

### 주식 티커 검증
- domestic: `/^\d{6}(:XKRX|:XKOS)?$/`, foreign: `/^[A-Z0-9.]+$/`

### API 에러 처리
```typescript
// 500 에러 연속 3회 → API 조회 비활성화
const errorCount = parseInt(localStorage.getItem(STORAGE_KEYS.financeApiErrorCount) || "0");
if (errorCount >= 3) { /* 조회 비활성화 */ }
// 성공 시: localStorage.removeItem(STORAGE_KEYS.financeApiErrorCount)
```

### 항목 표시 조건
- 목록 렌더링 시 `length > 0` 사용. `> 1` 절대 사용 금지 (단일 항목도 표시해야 함)

### 점진 로드 패턴 (fetchProfitRef)
- 배치 콜백(`onProgress`)으로 부분 결과 즉시 노출
- `onComplete(fromCache)` — `fromCache=true`이면 사용자 인지 액션 없음 → toast 생략
- AbortSignal로 cleanup. 단, 동일 키 재실행 시 abort 안 함 (의존성 흔들림 보존)
