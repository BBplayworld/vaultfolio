# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-05-02

## AssetDataContext (`src/contexts/asset-data-context.tsx`)

`const { ... } = useAssetData()`

### 상태

```typescript
assetData: AssetData
isDataLoaded: boolean
isSharePending: boolean
snapshotVersion: number       // saveSnapshots/공유 로드 시 증가 → 차트 훅 재읽기 트리거
exchangeRates: { USD: number(기본 1430), JPY: number(기본 930, 100엔 기준) }
exchangeRateDate: string      // YYYY-MM-DD
```

### 함수

```typescript
updateExchangeRate(currency: "USD"|"JPY", rate: number, date?: string): void
syncTodayExchangeRate(): Promise<void>  // 오늘자 환율 동기화 (캐시 우선)
refreshData(): void
initAndSync(data: AssetData): Promise<void>
  // 순서: initAssetData → 1초 대기 → 환율 → 주식 현재가 → 스냅샷
saveData(data: AssetData): boolean

// CRUD (모두 boolean 반환: 성공 true, 실패 false)
add/update/deleteRealEstate, add/update/deleteStock, add/update/deleteCrypto
add/update/deleteCash, add/update/deleteLoan, add/update/deleteYearlyNetAsset

addStockRaw(data: Stock): boolean  // 스크린샷 전용: ticker 빈 값 허용 (superRefine 우회)

getAssetSummary(): AssetSummary
```

### 초기화 흐름

```
마운트 → localStorage 로드 → isDataLoaded=true
→ 1초 대기 → 환율 동기화 → 주식 일괄 조회 (3개씩 배치, 배치 간 1초)
→ 스냅샷 저장 (일별/월별)
```

---

## PreferencesStore (Zustand) (`src/stores/preferences/`)

```typescript
const themeMode = usePreferencesStore(s => s.themeMode);  // "light"|"dark"
const setThemeMode = usePreferencesStore(s => s.setThemeMode);
// 쿠키 저장: src/server/server-actions.ts (hydration mismatch 방지)
```

---

## 유틸 함수

### number-utils.ts

```typescript
formatNumberWithCommas(value): string   // "1,234,567"
parseNumberFromCommas(value): number
formatCurrency(value): string           // "₩1,234,567"
formatShortCurrency(value): string      // "12억 3,456만"
calculateHoldingDays(purchaseDate): number
formatHoldingPeriod(purchaseDate): string  // "1년 3개월" 형식
```

### utils.ts

```typescript
cn(...inputs: ClassValue[]): string     // clsx + tailwind-merge
getInitials(str): string                // "홍길동" → "홍"
```

### local-storage.ts (`src/lib/local-storage.ts`)

```typescript
STORAGE_KEYS = {
  assetData, dailySnapshots, monthlySnapshots,
  exchangeRate, exchangeSyncDate, collapsibleUsed,
  noticeHideUntil, guideDismissed, geminiUsage,
  shareOwnerId, financeApiErrorCount
}
STORAGE_KEY_PREFIXES = { profit: "secretasset_profit:" }
migrateStorageKeys(): void  // 레거시 키 → 신규 키 마이그레이션
```

### asset-storage.ts

```typescript
getAssetData(): AssetData
saveAssetData(data): boolean
exportAssetData(): void
importAssetData(file): Promise<{ assetData: AssetData; snapshotRestored: boolean }>
clearAssetData(): boolean
saveAssetDataRaw(data): boolean         // superRefine 우회 (스크린샷 경로)
generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult
  // = { data, rates?, snapshots? } | { pinRequired: true } | null
// STORAGE_KEYS, migrateStorageKeys는 local-storage.ts에서 re-export
```

### finance-service.ts

```typescript
normalizeTicker({ ticker, category }): string
classifyTickers(tickers[]): { usTickers, krTickers }
resolveStockName(category, apiName, fallback): string
fetchStocksFromKorea(tickers, todayStr, token, key, secret)
fetchStocksFromKisOverseas(tickers, todayStr, token, key, secret)
fetchExchangeRateFromKis(token, key, secret, todayStr)
fetchDividendDomestic(ticker, fdt, tdt, token, key, secret): Promise<DividendPayoutResult[]>
fetchDividendOverseas(ticker, excd, fdt, tdt, token, key, secret): Promise<DividendPayoutResult[]>
fetchDomesticHistoricalPrice(ticker, dateStr, token, key, secret): Promise<number|null>
fetchOverseasHistoricalPrice(ticker, dateStr, token, key, secret): Promise<number|null>

// DividendPayoutResult: { payoutDate, amountPerShare, amountForeign?, currency?, frequency? }
// DividendFrequency: "annual"|"semiannual"|"quarterly"|"monthly"
```

### profit-utils.ts (`src/lib/profit-utils.ts`)

```typescript
type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly"
getProfitCacheKey(tickers, period): string  // localStorage 캐시 키 생성
fetchProfitRef(tickers, period): Promise<ProfitRefResponse>
  // localStorage 캐시 → /api/finance/profit?tickers=...&period=...
```

---

## config/theme.ts

```typescript
ASSET_THEME = { important, primary: {text, bg}, categoryBox, todayBox, liability }
getProfitLossColor(value: number): string   // >0 수익색 / <0 손실색 / =0 기본색
```

---

## config/asset-options.ts

```typescript
stockCategories, realEstateTypes, cashTypes, loanTypes
cryptoExchanges: string[]
popularCryptos: { symbol, name }[]          // BTC/ETH/XRP 등 20개
financialInstitutions: OptionGroup[]        // 은행/저축은행/보험사
securitiesFirms: OptionGroup[]
quickButtonPresets: { stock, realEstate, loan }
```

---

## 커스텀 이벤트 (컴포넌트 간 통신)

```typescript
// 추가 이벤트: FloatingAddButton → *-input.tsx에서 수신
window.dispatchEvent(new CustomEvent("trigger-add-stock", { detail: { mode: "screenshot"|"manual" } }))
// 이벤트 목록: trigger-add-{real-estate|stock|crypto|cash|loan|yearly-net-asset}
// real-estate, yearly-net-asset: mode 없이 단순 Event

// 편집 이벤트: 각 *-tab.tsx Pencil 버튼 → *-input.tsx에서 수신
window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: "stock_xxx" } }))
// 이벤트 목록: trigger-edit-{real-estate|stock|crypto|cash|loan}

// 탭 이동 이벤트: FloatingAddButton 빠른이동 → AssetPageTabs에서 수신
window.dispatchEvent(new CustomEvent("navigate-to-tab", { detail: { tab: "stocks"|"real-estate"|"crypto"|"cash"|"loans" } }))

// 가이드 이벤트: GuideMiniButton → AppGuide에서 수신
window.dispatchEvent(new CustomEvent("trigger-restore-guide"))
window.dispatchEvent(new CustomEvent("trigger-dismiss-guide"))

// 파일 임포트 트리거: → ToolMenu에서 수신
window.dispatchEvent(new CustomEvent("trigger-import"))
```
