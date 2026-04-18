# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-04-18

## AssetDataContext

**파일:** `src/contexts/asset-data-context.tsx`
**사용:** `const { ... } = useAssetData()`

### 상태

```typescript
assetData: AssetData          // 모든 자산 데이터 (실시간)
isDataLoaded: boolean         // 초기 localStorage 로드 완료 여부
isSharePending: boolean       // 공유 토큰 PIN 인증 대기 중
snapshotVersion: number       // saveSnapshots 호출/공유 로드 시 증가 → 차트 훅 재읽기 트리거
exchangeRates: {
  USD: number                 // 기본값: 1430
  JPY: number                 // 기본값: 930 (100엔 기준)
}
exchangeRateDate: string      // 환율 기준일 (YYYY-MM-DD)
```

### 함수

```typescript
// 환율
updateExchangeRate(currency: "USD" | "JPY", rate: number, date?: string): void

// 전체 데이터
refreshData(): void           // localStorage에서 재로드
initAndSync(data: AssetData, opts?: { skipSnapshots?: boolean }): Promise<void>
// opts.skipSnapshots: true 시 saveSnapshots 생략 (공유 로드 후 기존 스냅샷 보존용)
saveData(data: AssetData): boolean

// 자산 CRUD (모두 boolean 반환)
addRealEstate(data: RealEstate): boolean
updateRealEstate(id: string, partial: Partial<RealEstate>): boolean
deleteRealEstate(id: string): boolean

addStock(data: Stock): boolean
addStockRaw(data: Stock): boolean  // 스크린샷 가져오기 전용: ticker 빈 값 허용 (superRefine 우회)
updateStock(id: string, partial: Partial<Stock>): boolean
deleteStock(id: string): boolean

addCrypto(data: Crypto): boolean
updateCrypto(id: string, partial: Partial<Crypto>): boolean
deleteCrypto(id: string): boolean

addCash(data: Cash): boolean
updateCash(id: string, partial: Partial<Cash>): boolean
deleteCash(id: string): boolean

addLoan(data: Loan): boolean
updateLoan(id: string, partial: Partial<Loan>): boolean
deleteLoan(id: string): boolean

addYearlyNetAsset(data: YearlyNetAsset): boolean
updateYearlyNetAsset(year: number, partial: Partial<YearlyNetAsset>): boolean
deleteYearlyNetAsset(year: number): boolean

// 계산
getAssetSummary(): AssetSummary
```

### 초기화·동기화 흐름

```
컴포넌트 마운트
→ localStorage 로드 (asset-storage.ts)
→ isDataLoaded = true
→ 1초 대기 (UI 안정화)
→ 오늘자 환율 동기화 (/api/finance?type=exchange)
→ 미갱신 주식 일괄 조회 (3개씩 배치, 배치 간 1초 지연)
```

---

## PreferencesStore (Zustand)

**파일:** `src/stores/preferences/preferences-store.ts`

```typescript
// Provider: src/stores/preferences/preferences-provider.tsx
<PreferencesStoreProvider themeMode={cookieTheme}>

// 사용
const themeMode = usePreferencesStore(s => s.themeMode);
const setThemeMode = usePreferencesStore(s => s.setThemeMode);

type ThemeMode = "light" | "dark"
```

**쿠키 저장:** `src/server/server-actions.ts` — 서버 액션으로 쿠키 저장해 hydration mismatch 방지

---

## 유틸 함수

### number-utils.ts (`src/lib/number-utils.ts`)

```typescript
formatNumberWithCommas(value: number): string   // "1,234,567"
parseNumberFromCommas(value: string): number    // "1,234,567" → 1234567
formatCurrency(value: number): string           // "₩1,234,567"
formatShortCurrency(value: number): string      // "12억 3,456만" (억/만 단위)
calculateHoldingDays(purchaseDate: string): number  // 오늘까지 보유일
```

### utils.ts (`src/lib/utils.ts`)

```typescript
cn(...inputs: ClassValue[]): string             // clsx + tailwind-merge
getInitials(str: string): string                // "홍길동" → "홍"
formatCurrency(amount: number, opts?): string   // Intl.NumberFormat 기반
```

### asset-storage.ts (`src/lib/asset-storage.ts`)

```typescript
getAssetData(): AssetData
saveAssetData(data: AssetData): boolean
exportAssetData(): void                         // JSON 파일 다운로드
importAssetData(file: File): Promise<AssetData>
clearAssetData(): boolean

generateShareToken(
  data: AssetData,
  rates?: { USD: number; JPY: number },
  pin?: string,
  localKey?: string,
  snapshots?: AssetSnapshots
): string

parseShareToken(
  token: string,
  pin?: string,
  localKey?: string
): ParseResult
// ParseResult = { data, rates?, snapshots? } | { pinRequired: true } | null

saveAssetDataRaw(data: AssetData): boolean  // superRefine 우회 저장 (스크린샷 경로)
```

### finance-service.ts (`src/lib/finance-service.ts`)

```typescript
normalizeTicker(stock: { ticker: string, category: string }): string
classifyTickers(tickers: string[]): { usTickers: string[], krTickers: string[] }
resolveStockName(category: string, apiName: string, fallback: string): string
```

---

## config/theme.ts

```typescript
// 색상 테마 상수
ASSET_THEME = {
  important: string     // 중요 텍스트 클래스 (강조색)
  primary: { text, bg } // 프라이머리 색상
  categoryBox: string   // 카테고리 Badge 스타일
  todayBox: string      // 오늘 기준일 Badge 스타일
  liability: string     // 부채 텍스트 색상
}

// 수익/손실 색상 결정
getProfitLossColor(value: number): string
// value > 0 → 수익 클래스
// value < 0 → 손실 클래스
// value = 0 → 기본 클래스
```

---

## config/asset-options.ts

```typescript
stockCategories: { value: Stock["category"], label: string }[]
realEstateTypes: { value: RealEstate["type"], label: string }[]
cashTypes: { value: Cash["type"], label: string }[]
loanTypes: { value: Loan["type"], label: string }[]
cryptoExchanges: string[]            // 거래소 이름 목록
popularCryptos: { symbol, name }[]   // BTC/ETH/XRP 등 20개
financialInstitutions: OptionGroup[] // 은행/저축은행/보험사 그룹
securitiesFirms: OptionGroup[]       // 증권사 그룹
quickButtonPresets: {
  stock: QuickButton[]               // 주식 빠른 입력 프리셋
  realEstate: QuickButton[]
  loan: QuickButton[]
}
```

---

## 커스텀 이벤트 (컴포넌트 간 통신)

```typescript
// 사이드바/다른 컴포넌트에서 폼 다이얼로그 열기
window.dispatchEvent(new Event("trigger-add-stock"))
window.dispatchEvent(new Event("trigger-add-real-estate"))
window.dispatchEvent(new Event("trigger-add-crypto"))
window.dispatchEvent(new Event("trigger-add-cash"))
window.dispatchEvent(new Event("trigger-add-loan"))
```

각 `*Input` 컴포넌트의 `useEffect`에서 이벤트 리스닝.
