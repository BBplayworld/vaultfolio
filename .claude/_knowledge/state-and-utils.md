# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-07-31 (원인분해 자산군별 분해 · OTP 포커스 훅)

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

## CashTxViewStore (`src/stores/cash-tx-view-store.ts`)

현금 입출금 내역 뷰(`cash-transactions` 탭) 진입 대상 전달. `target: { cashId, name } | null` · `setTarget`/`clear`. 주식 `trade-view-store` 대칭(S-4.22).

## 유틸 함수

### cash-tx-utils.ts (S-4.22)

```typescript
pruneCashTransactions(txns, years=3)      // 3년 롤링 정리 (trade-utils.pruneTransactions 대칭)
findDuplicateCashTx(txns, {cashId,date,amount,type})
reflectedBalanceDelta(txns, cashId)        // Σ반영입금 − Σ반영출금 (잔액 재계산)
isCashWithdrawalValid(balance, amount): boolean  // 출금 반영 초과 가드
```
현금 잔액은 선형 가감이라 가중평균(trade-utils.computeNewPosition) 계열 불필요. `cash[].balance`가 진실원본.

### tax-utils.ts (S-4.23)

```typescript
resolveTaxTags(assetData): Map<TaxTag, string>   // 보유 자산 → 세금 태그 + 근거 문구("상가·사무실 1건 보유")
computeForeignRealizedGain(assetData, year, rates)  // 해외주식 당해 실현손익 KRW 통산 → { gainKrw, sellCount, estimated, overDeduction } | null
getEventsForMonth(month): readonly TaxEvent[]
getMyEvents(events, tags): TaxEvent[]            // 교집합(common 포함) — 캘린더 "내 세금" 필터
getAssetDrivenHighlights(assetData, today?, limit=3): TaxEventMatch[]  // 홈 배너 전용 — common 전용 항목 제외
isTaxNoticeDismissed() / markTaxNoticeDismissed() / shouldShowTaxNotice(assetData)
todayKst() / currentMonthKst()                   // KST YYYY-MM-DD / YYYY-MM
```
데이터는 `src/config/tax-calendar.ts`(`TAX_EVENTS`·`TAX_EVENTS_BY_MONTH`·`TAX_TAG_LABEL`·`FOREIGN_CAPITAL_GAIN_DEDUCTION`)가 단일 출처. **외부 API·네트워크 없음.**
실현차익은 `trade-utils.computeNewPosition`으로 이동평균 원가를 replay해 산출하며, 매수 로그·체결 환율 누락 시 현재 평단·환율로 폴백하고 `estimated: true`를 세운다.
닫기 상태는 `STORAGE_KEYS.taxNotice` 단일 키(`{ dismissedMonth: "YYYY-MM" }`) — `backup-status.ts`와 동일한 기기 로컬 메타 패턴이라 `asset-storage.ts` keepKeys에 보존되고 sync payload에는 넣지 않는다(R14 핑퐁 방지).

### report/asset-report.ts — 원인분해 집계 헬퍼

```typescript
// 모듈 내부
krwMul(currency, rates)                              // KRW 환산 배수 (JPY는 100엔당) — 원인분해 공용
cashInflow(data, from, to, rates)                    // → { reflected, unreflected } 현금 순유입
reflectedTradeFlow(data, from, to, rates)            // → { buy, sell } 반영된 주식 체결액 (체결 환율 우선)
costFxRevaluation(data, prevFx, currFx)              // → { stock, cash } 외화 원가의 환율만으로 인한 재평가분 — saving에서 제외해 fx와 이중귀속 방지
fxBaseByClass(data, rates)                           // → { stock, cash } 통화별 외화노출 기준액(KRW) — computeFxExposure·stockFxShare 공용 단일 수식
stockFxShare(data, rates)                            // → { USD, JPY } 0~1. 환율효과 중 주식 몫 안분 비율(현재 보유 기준 근사)
isClosedForBothMarkets(dateStr)                      // 국내·해외 모두 휴장인 날짜인지 — 실시간 끝점(_isLive)의 **주식** 시세 원인 억제 판정용
makeCause(key, amount): AttributionCause             // label=causeShortLabel·sentence=causeSentence 파생

// export
causeShortLabel(key, amount): string                 // 모든 라벨의 단일 출처(부호 방향 반영). label·sentence가 여기서 파생
causeSentence(key, amount): string                   // 서술형 문장 (성적표용)
getOrderedCauses(attr): AttributionCause[]           // topCauses+restCauses를 CAUSE_ORDER 고정 순서로 정렬
getAttributionItems(attr): AttributionDisplayItem[]  // **표시 항목의 단일 출처.** 잔차("그 외") 병합까지 끝낸 최종 목록 — 홈(label+text)·성적표(sentence+원단위)가 모두 이것만 쓴다
formatAttributionSentence(attr): string | null       // 위 항목을 한 줄로 결합(스크린샷·폴백용)
formatAttributionDate(d): string                     // YYYY-MM-DD→M/D, YYYY-MM→M월 (홈·성적표 공용)
```

`resolveAttribution`이 Δ순자산을 분해한다. **원인 키는 자산군까지 명시한다**:
`price:stock|price:crypto|price:realEstate`(정밀) · `price`(예측 모드 통합) · `fx` · `buy:stock|sell:stock|buy:crypto|sell:crypto|buy:realEstate|sell:realEstate` · `income` · `debt` · `rest`.

- **`priceEffect`는 잔차**다. 자산군별 시세는 스냅샷의 `breakdown`(평가액)−`cost`(원가) 델타로 산출하고, `priceEffect` **총액은 건드리지 않은 채** 그 안을 나눈다. 분해되지 않는 조각은 전부 `rest`가 흡수 → **표시 합계 = deltaNet 항등식** 유지(F-ACTIVITY 회귀 지점).
- 신규 투입도 자산군별 `Δcost`로 쪼개 "매수/매도" 용어로 통일한다. 거래내역 없는 주식 원가 변동(직접 수정·스크린샷 등록)은 **방향별로** `buy:stock`/`sell:stock`에 합산(같은 라벨 두 줄 방지). 투자 3종으로 설명되지 않는 원가 증감(=현금 잔액 직접 수정)은 `income`에 합산한다.
- 휴장일 억제(`isClosedForBothMarkets`)는 **`price:stock`에만** 적용한다 — 코인은 24시간 거래, 부동산은 직접 입력이라 증시 휴장과 무관.
- 뷰는 잔차를 직접 계산하지 말 것. `getAttributionItems` 하나만 거쳐야 두 화면의 임계값·합계가 갈리지 않는다.

### hooks/use-otp-focus.ts — PIN(OTP) 입력 포커스 (iOS 키보드 대응)

```typescript
focusOtpFromGesture(el: HTMLInputElement | null): void   // 사용자 제스처 안에서 호출. 이미 포커스면 blur→focus로 전환 강제
useOtpAutoFocus(ref, active: boolean): void              // 마우스 환경((pointer: fine))에서만 자동 포커스
```
iOS는 **제스처 밖 `focus()`로 키보드를 열지 않으면서 `activeElement`만** 잡는다 → 이후 탭해도 focus 전환이 없어 숫자패드가 영영 안 뜬다. 그래서 ① 터치 환경에선 자동 포커스를 하지 않고 ② OTP 래퍼의 `onPointerDown`에서 `focusOtpFromGesture`로 전환을 강제한다. **검증 중에도 input을 `disabled`로 만들지 말 것**(iOS가 blur시켜 키보드가 닫히고 돌아오지 않음 — ref 가드를 쓴다). 적용: `pwa-lock-screen.tsx`, `asset-data-context.tsx`(공유 복원 PIN).

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

### real-estate-address.ts (`src/lib/real-estate-address.ts`)

부동산 주소 표기 정본. 구 입력 필드 `dongName`·`hoName`은 `addressDetail`로 통합됐으므로 **읽기 시점에 합쳐** 준다(저장분 유실 없음). 폼 기본값·상세 카드·공유 인코딩이 모두 이 함수를 쓴다 — 병합식을 인라인으로 다시 쓰지 말 것.

```typescript
getAddressDetail(item): string    // addressDetail ?? "동 호"
formatFullAddress(item): string   // "주소 상세주소" (한쪽만 있으면 있는 쪽만)
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

// 사용자 명시 편집: AssetDataContext의 saveData(자산 CRUD 전용) 성공 시 → cloud-sync에서 수신
window.dispatchEvent(new CustomEvent(ASSET_USER_EDIT_EVENT))  // "secretasset-asset-user-edit"
// 수신 측은 파생값 비교·pull 직후 skip을 우회해 반드시 push한다 (api-reference.md "자동 push 변경 감지").
// 시세·스냅샷 자동 갱신은 saveAssetData를 직접 호출하므로 이 이벤트가 발생하지 않는다 → 핑퐁 없음.
```

### 닉네임 (`src/hooks/use-nickname.ts`)

- `persistNickname(next)`: `sanitizeNickname`(한글·영문·숫자, 최대 8자) → `assetData.nickname` 저장 + `NICKNAME_EVENT` 발행. 공유/가져오기/pull 복원(`applyImportedPayload`)도 이 함수 사용.
- `useNickname()`: `[nickname, setNickname]`. `NICKNAME_EVENT`·`storage` 수신해 상태 동기화.
- **커밋 시점 = 더보기 탭 이탈(언마운트) 1회** ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): 입력란은 로컬 `draft` state로 분리해 키 입력 중엔 저장·push 안 함. `useEffect([nickname])`로 외부 pull 변경을 draft에 반영, 언마운트 `commitRef`에서 `draft!==nickname`일 때만 `setNickname` 커밋(no-op 가드 → stale 닉네임 재push 차단). 키 입력마다 즉시 저장하던 ping-pong 동기화 버그 해결.
