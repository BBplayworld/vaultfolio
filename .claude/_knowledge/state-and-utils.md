# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-06-30

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
  // 진행 중 sync/profit fetch만 취소 + localStorage 재로드(dataResetVersion++). 시세 재동기화 안 함
initAndSync(data: AssetData): Promise<void>
  // 순서: initAssetData → 1초 대기 → 환율 → 주식 현재가 → 스냅샷
  // 시세 동기화 진입점: 마운트 / 0→양수 전환 / 기기 동기화 pull·연결(cloud-sync runPull·armWithPull)
  // ※ pull 후엔 refreshData가 아닌 initAndSync 사용 — refreshData만 쓰면 pull 후 오늘자 시세 미갱신(R21)
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
→ 1초 대기 → 환율 동기화 → 주식 일괄 조회 (BATCH_SIZE=3, BATCH_DELAY_MS=1000)
→ profit ref(daily) 조회 → 스냅샷 저장 (일별/월별)
```

### 현재가 갱신 규칙 (syncTodayStockPrices)

```typescript
// halted: currentPrice 유지 (마지막 알려진 가격 보존)
// delisted: API가 준 0으로 덮어쓰기 (평가에서 어차피 제외)
// 활성: result.price로 갱신 + inactiveStatus undefined로 리셋
currentPrice: isHalted ? stock.currentPrice : result.price
inactiveStatus: result.inactiveStatus,
inactiveReason: result.inactiveReason,
inactiveCheckedAt: result.updated_at,
```

### 스냅샷용 tickerList 정렬 필수

`saveSnapshots` 내부의 `tickerList`는 반드시 `.sort()` 후 join (profit-chart·stock-tab과 동일 캐시 키 보장).

---

## PreferencesStore (Zustand) (`src/stores/preferences/`)

```typescript
const themeMode = usePreferencesStore(s => s.themeMode);  // "light"|"dark"
const setThemeMode = usePreferencesStore(s => s.setThemeMode);
// 쿠키 저장: src/server/server-actions.ts (hydration mismatch 방지)
```

**테마 URL 동기화**:
공유 URL 복사 시, 현재 테마가 라이트 모드(`themeMode === "light"`)라면 URL에 `&theme=light` 파라미터가 포함되며, 수신 측(`applySharedData` 시점)에서 `checkAndApplyThemeMode`가 실행되어 수신 기기의 테마 스토어, 쿠키, HTML DOM의 테마 클래스를 모두 `"light"`로 동기화 설정합니다.

---

## ProfitBasisStore (`src/stores/profit-basis-store.ts`)

```typescript
const basis = useProfitBasisStore(s => s.basis);       // ProfitBasis
const setBasis = useProfitBasisStore(s => s.setBasis); // localStorage + store 동시 갱신
const hydrate = useProfitBasisStore(s => s.hydrate);   // 마운트 후 localStorage 동기화 (SSR mismatch 방지)
```

standalone zustand `create` (provider 없음). 성과-수익 탭(profit-chart) 토글 + 상세-주식 전일대비(stock-tab)가 함께 구독. 공유 로드 시 `applySharedData`에서, 내보내기 import 시 `getState().hydrate()`로 갱신.

---

## TutorialStore (`src/stores/tutorial/tutorial-store.ts`)

```typescript
TutorialStep = 0 | 1 | 2 | 3 | 4 | 5
StepStatus   = "pending" | "done" | "skipped"

state: {
  activeStep, step5Sub, statuses, isTutorialFinished, isWaiting,
  isStandaloneStep0  // 메뉴-앱가이드 단독 보기 모드 (확인 버튼, 다음 단계 미진행)
}
actions: {
  initTutorial, completeStep, skipStep, advanceStep5, startWaiting,
  showStep0(standalone?: boolean)   // standalone=true → 단독 보기
  closeStandaloneStep0()
}
```

저장: `secretasset_tutorial_status` 단일 키 (Record<step, status>). 레거시 12 키는 `merge-tutorial-status` 마이그레이션으로 통합.

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
  noticeHideUntil, geminiUsage,
  shareOwnerId, financeApiErrorCount,
  profitBasis,    // "secretasset_profit_basis" — 종가 기준 옵션
  tutorialStatus  // "secretasset_tutorial_status"
}
STORAGE_KEY_PREFIXES = { profit: "secretasset_profit:" }
migrateStorageKeys(): void
  // 레거시 키 마이그레이션 + guideDismissed 키 제거 + cleanExpiredNoticeKeys + runOneTimeMigrations

readTutorialStatus(): Record<TutorialStep, StepStatus>
writeTutorialStatus(map): void
```

### one-time-migrations.ts

`secretasset_migrations_done` (JSON array)에 완료 id 기록 → 매 진입 시 done 체크 → 미실행 항목만 실행. 현재 활성 id:
- `2026-05-16-clear-profit-cache-final` — profit 캐시 일괄 정리
- `merge-tutorial-status` — step별 12 키 → 단일 객체 통합

### asset-storage.ts

```typescript
getAssetData(): AssetData
saveAssetData(data): boolean
exportAssetData(): void
importAssetData(file): Promise<{ assetData, snapshotRestored }>
clearAssetData(): boolean
saveAssetDataRaw(data): boolean         // superRefine 우회 (스크린샷 경로)
generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult
// STORAGE_KEYS, migrateStorageKeys는 local-storage.ts에서 re-export
// 공유 토큰 v7.2 stock 필드: inactiveStatus 직렬화 ("d"=delisted, "h"=halted, ""=활성)
```

### finance-service.ts

```typescript
normalizeTicker({ ticker, category }): string
classifyTickers(tickers[]): { usTickers, krTickers }
resolveStockName(category, apiName, fallback): string
fetchStocksFromKorea(tickers, todayStr, token, key, secret)
fetchStocksFromKisOverseas(tickers, todayStr, token, key, secret)
  // → StockPriceResult에 inactiveStatus 포함 (classifyOverseasInactive)
fetchExchangeRateFromKis(token, key, secret, todayStr)
fetchDividendDomestic(ticker, fdt, tdt, token, key, secret): Promise<DividendPayoutResult[]>
fetchDividendOverseas(ticker, excd, fdt, tdt, token, key, secret): Promise<DividendPayoutResult[]>
fetchDomesticHistoricalPrice(ticker, dateStr, token, key, secret): Promise<{price, date}|null>
fetchOverseasHistoricalPrice(ticker, dateStr, token, key, secret, preferredExcd?): Promise<{price, date}|null>
  // preferredExcd 주어지면 그것만 시도, 없으면 NAS→NYS→AMS

classifyOverseasInactive(output): { status: InactiveStatus|null, reason: string|null }
  // 판정 순서: lstg_abol_dt/lstg_abol_item_yn/lstg_yn → delisted
  //          ovrs_stck_tr_stop_dvsn_cd/ovrs_stck_stop_rson_cd → halted
  //          last_rcvg_dtime > 30일 경과 → halted
```

### stock-cache-slot.ts (`src/lib/stock-cache-slot.ts`)

서버·클라이언트 공용 캐시 슬롯 유틸. 순수 함수 (fs/Redis 의존 없음).

```typescript
getEffectiveDateStr(type: "domestic"|"foreign"|"exchange"): string
  // 마감 시간(KST) 이후면 오늘, 이전이면 어제
  // cutoff: foreign 07:00, domestic 16:00, exchange 09:00

getStockCacheSlot(type: "domestic"|"foreign"): string
  // 장중: "{effectiveDate}-H{HH}" (1시간 슬롯)
  // 장외: effectiveDate
  // domestic 장중: 09:00~20:00 KST
  // foreign 장중: DST 17:00~익일 05:00 / STD 18:00~익일 06:00 (프리마켓 포함)
```

### profit-utils.ts (`src/lib/profit-utils.ts`)

```typescript
type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly"
type ProfitBasis = "sameBusinessDay" | "kstAccessDay"   // 기본 sameBusinessDay

getProfitBasis() / setProfitBasis(b)   // localStorage(STORAGE_KEYS.profitBasis) 읽기/쓰기

getProfitCacheKey(tickers, period, basis = "kstAccessDay"): string
  // "secretasset_profit:{basis}:{period}:{date}:{tickers}"
  // daily date: sameBusinessDay=foreign refDate / kstAccessDay=domestic refDate

fetchProfitRef(tickers, period, options?): Promise<ProfitRefResponse>
  // options: { onProgress?, onComplete?, signal?, basis? }
  // basis 미전달 시 kstAccessDay(legacy) — 스냅샷·기존 호출 동작 보존
  // 1) localStorage 캐시 hit → onProgress + onComplete(fromCache=true) 즉시 호출
  // 2) miss → BATCH_SIZE=3, BATCH_DELAY_MS=1000 배치 fetch
  //    배치마다 onProgress(누적 결과), 완료 후 캐시 저장 + onComplete(false)
  // 3) inFlightFetches Map으로 동일 cacheKey 호출 dedup (네트워크 1회만)
```

---

## config/theme.ts

```typescript
ASSET_THEME = { important, primary: {text, bg, bgLight}, text: {default, muted}, categoryBox, todayBox, liability, ... }
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

// 가이드 이벤트: ToolMenu(앱가이드 보기) → AppGuide에서 수신 (+ tutorialStore.showStep0(true))
window.dispatchEvent(new CustomEvent("trigger-restore-guide"))
window.dispatchEvent(new CustomEvent("trigger-dismiss-guide"))

// 파일 임포트 트리거: → ToolMenu에서 수신
window.dispatchEvent(new CustomEvent("trigger-import"))

// 닉네임 변경: persistNickname() → useNickname·cloud-sync(changeTick)에서 수신
window.dispatchEvent(new CustomEvent(NICKNAME_EVENT))  // "secretasset-nickname-change"
```

### 닉네임 (`src/hooks/use-nickname.ts`)

- `persistNickname(next)`: `sanitizeNickname`(한글·영문·숫자, 최대 8자) → `assetData.nickname` 저장 + `NICKNAME_EVENT` 발행. 공유/가져오기/pull 복원(`applyImportedPayload`)도 이 함수 사용.
- `useNickname()`: `[nickname, setNickname]`. `NICKNAME_EVENT`·`storage` 수신해 상태 동기화.
- **커밋 시점 = 더보기 탭 이탈(언마운트) 1회** ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): 입력란은 로컬 `draft` state로 분리해 키 입력 중엔 저장·push 안 함. `useEffect([nickname])`로 외부 pull 변경을 draft에 반영, 언마운트 `commitRef`에서 `draft!==nickname`일 때만 `setNickname` 커밋(no-op 가드 → stale 닉네임 재push 차단). 키 입력마다 즉시 저장하던 ping-pong 동기화 버그 해결.
