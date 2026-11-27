# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-08-01 (원인분해 income/cash 분리·deposit 신설·기간 하이브리드 합성)

## AssetDataContext (`src/contexts/asset-data-context.tsx`)

- (#4.55) `addPhysicalAsset`/`updatePhysicalAsset`/`deletePhysicalAsset`, `computeNetAsset().physicalValue`, `computeAssetCost().physicalCost`, `AssetSummary.physical*`. 저장은 `saveData`→`saveAssetData` 한 곳.
- (#4.55) `asset-storage.ts`: `readPhysicalAssets`·`clearPhysicalAssets`, 분리 키 `STORAGE_KEYS.physicalAssets`(`secretasset.physical_assets`). `hasAnyAssets`가 실물 포함 — 자산 보유 판정은 인라인 합산 금지(grep 테스트).

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
deleteStocks(ids)/deleteCryptos(ids)  // 묶음 삭제 본체(#4.60 #109) — saveData 1회, 해당 id 거래도 삭제(삭제 시점 평가액 반올림 0원 이하 항목은 거래 보존). 단건 deleteStock/deleteCrypto는 래퍼. 순수 계획 planDeleteStocks/planDeleteCryptos(…, rates, today=todayKst()) (asset-data-context.tsx, computeNetAsset 재사용; 지난달 이전 연결 거래도 보존) — 탭에서 직접 saveData로 삭제 금지
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

`computeSnapshotRow(data, rates, refMap)`(asset-data-context.tsx) — 일별·월별 스냅샷 한 행의 값(netAsset·financialAsset·breakdown·fx·fxBase·cost) 단일 출처. `saveSnapshots`와 `refreshTodayDailyRow`(편집 시 오늘 평일 일별 행 1줄 재계산, #252)가 공유 — 행 수식을 다른 곳에 복제 금지. `tryRefreshTodayRow`(조건 판정)·`createEditDebouncer`(편집 신호 800ms 묶음, `SNAPSHOT_REFRESH_DEBOUNCE_MS` < 동기화 push 2.5초). `lastSnapshotRef`는 saveSnapshots 성공 때만 켜고 initAndSync·refreshData(열기·pull·복원)에서 비운다. `computeAttributionSince(…, liveCurr, startDayGate)` 마지막 인자=true는 Hero 경로(week-attribution)만(`PeriodAttribution.startDayGated`로 기록 목록이 같은 술어 사용).
`saveSnapshots` 내부의 `tickerList`는 반드시 `.sort()` 후 join (profit-chart·stock-tab과 동일 캐시 키 보장).

---

## PreferencesStore (Zustand) (`src/stores/preferences/`)

```typescript
const themeMode = usePreferencesStore(s => s.themeMode);  // "light"|"dark"
const setThemeMode = usePreferencesStore(s => s.setThemeMode);
// 쿠키 저장: persistThemeModeCookie(value) (src/lib/theme-utils.ts, 클라이언트 document.cookie — 공개 Server Action 제거, S-4.28)
// 쿠키 조회: getPreference(key, allowed, fallback) (src/server/preferences.ts, server-only, layout 전용)
```

**테마 URL 동기화**:
공유 URL 복사 시, 현재 테마가 라이트 모드(`themeMode === "light"`)라면 URL에 `&theme=light` 파라미터가 포함되며, 수신 측(`applySharedData` 시점)에서 `checkAndApplyThemeMode`가 실행되어 수신 기기의 테마 스토어, 쿠키, HTML DOM의 테마 클래스를 모두 `"light"`로 동기화 설정합니다.

---

## ProfitBasisStore (`src/stores/profit-basis-store.ts`)

```typescript
const basis = useProfitBasisStore(s => s.basis);       // ProfitBasis
const setBasis = useProfitBasisStore(s => s.setBasis); // localStorage + store 동시 갱신
const hydrate = useProfitBasisStore(s => s.hydrate);   // 마운트 후 localStorage 동기화 (SSR mismatch 방지)
// 화면 문구 단일 출처: `PROFIT_BASIS_COPY`(profit-utils.ts) { name, summary, options, notes } — 더보기·성과 두 곳이 공유(#5.116)
```

standalone zustand `create` (provider 없음). 성과-수익 탭(profit-chart) 토글 + 상세-주식 전일대비(stock-tab)가 함께 구독. 공유 로드 시 `applySharedData`에서, 내보내기 import 시 `getState().hydrate()`로 갱신.

---

## TutorialStore (`src/stores/tutorial/tutorial-store.ts`)

```typescript
TutorialStep = 1 | 2 | 3 | 4 | 5            // 저장 키 형식(1~5)
ActiveTutorialStep = 1 | 3 | 4 | 5          // 진행 단계(#4.85: 2단계 '더보기'는 사실과 달라 삭제 — 저장값 2는 pending으로 남아도 진행에서 건너뜀)
StepStatus   = "pending" | "done" | "skipped"

state: { activeStep: ActiveTutorialStep|null, step5Sub, statuses, isTutorialFinished, isWaiting }
actions: { initTutorial, completeStep, skipStep, advanceStep5, startWaiting }
export: ACTIVE_TUTORIAL_STEPS, nextPendingStep(statuses)
```
`TutorialOverlay`: PWA(`isStandaloneDisplay()`)는 하단 `자산 업데이트` 버튼이 없어 1단계를 `skipStep(1)`로 건너뜀, 설치 안내 카드가 보이는 동안(`first-save-signal.getNudgeVisible`) 말풍선 숨김(#4.85).

저장: `secretasset_tutorial_status` 단일 키 (Record<step, status>). 레거시 12 키는 `merge-tutorial-status` 마이그레이션으로 통합.

---

## CashTxViewStore (`src/stores/cash-tx-view-store.ts`)

현금 입출금 내역 뷰(`cash-transactions` 탭) 진입 대상 전달. `target: { cashId, name } | null` · `setTarget`/`clear`. 주식 `trade-view-store` 대칭(S-4.22).

## LoanTxViewStore (`src/stores/loan-tx-view-store.ts`)

대출 상환/추가 대출 내역 뷰(`loan-transactions` 탭) 진입 대상 전달. `target: { loanId, name } | null` · `setTarget`/`clear`. `CashTxViewStore` 미러링(S-4.24).

## CryptoTxViewStore (`src/stores/crypto-tx-view-store.ts`)

암호화폐 매수/매도 내역 뷰(`crypto-transactions` 탭) 진입 대상 전달. `target: { cryptoId, name } | null` · `setTarget`/`clear`. `CashTxViewStore` 미러링(S-4.25).

## TaxViewStore (`src/stores/tax-view-store.ts`, S-4.32)

세금 관리(`#tax`) 페이지 진입 시 초기 탭(`"schedule"|"simulator"`) 지정. `initialTab: TaxInitialTab | null` · `setInitialTab`/`clear`. `#tax` 내부 탭은 URL이 아닌 로컬 state라 외부(홈 팁 박스 등)에서 직접 지정할 수단이 `loan-tx-view-store` 류의 "진입 대상 미리 지정 후 navigate" 패턴뿐이라 재사용. `tax-calendar-view.tsx`가 `useState` 초기값 함수에서 1회 소비 후 즉시 `clear()`.

## XrayViewStore (`src/stores/xray-view-store.ts`, #4.83)

X-Ray 페이지 초기 축 지정. `initialAxis: XrayAxis | null` · `setInitialAxis`/`clear`. 상세·주식 X-Ray 타일이 타일 값의 축으로 열 때 `TaxViewStore`와 같은 방식(진입 대상 미리 지정 후 navigate, `stock-xray-view.tsx`가 `useState` 초기값에서 1회 소비 후 `clear()`). 저장소·해시 0.

## OnboardingWizardStore (`src/stores/onboarding-wizard-store.ts`)

온보딩 마법사 열림 상태(S-4.29). `isOpen: boolean` · `open`/`close`. `trade-view-store`와 동일한 최소 zustand 패턴(persist 없음). `WelcomeGuide`의 "스크린샷으로 자산 등록" CTA에서만 `open()` 호출(더보기 메뉴의 동일 버튼은 중복이라 제거됨), `page.tsx`가 `isOpen`을 최우선 분기(`isWelcomeGuide`보다 먼저 체크)로 `OnboardingWizardFlow`를 렌더.
자동 노출 effect는 제거됨 — 웰컴가이드가 항상 먼저 보여야 한다는 요구에 따라 자산 0건이어도 첫 진입에서 마법사가 자동으로 뜨지 않고, 사용자가 CTA를 눌러야만 열린다.

## 유틸 함수

### cash-tx-utils.ts (S-4.22)

```typescript
pruneCashTransactions(txns, years=3)      // 3년 롤링 정리 (trade-utils.pruneTransactions 대칭)
findDuplicateCashTx(txns, {cashId,date,amount,type})
reflectedBalanceDelta(txns, cashId)        // Σ반영입금 − Σ반영출금 (잔액 재계산)
isCashWithdrawalValid(balance, amount): boolean  // 출금 반영 초과 가드
```
현금 잔액은 선형 가감이라 가중평균(trade-utils.computeNewPosition) 계열 불필요. `cash[].balance`가 진실원본.

### loan-tx-utils.ts (S-4.24)

```typescript
pruneLoanTransactions(txns, years=3)      // 3년 롤링 정리
findDuplicateLoanTx(txns, {loanId,date,amount,type})
reflectedLoanBalanceDelta(txns, loanId)    // Σ반영추가대출 − Σ반영상환 (잔액 재계산)
isLoanRepaymentValid(balance, amount): boolean  // 상환 반영 초과 가드
```
cash-tx-utils.ts 미러링(대출은 통화 필드 없음, 항상 KRW). `loans[].balance`가 진실원본, 0=완납.

### trade-utils.ts — 수량×평단 가중평균 재계산 (주식·코인 공용, S-4.25 일반화)

```typescript
computeNewPosition<P extends PositionLike>(current: P, tx: TxLike): PositionPreview
recomputeFromLog<P extends PositionLike>(baseSnapshot: P, transactions: TxLike[]): P
reverseTransaction<P extends PositionLike>(current: P, tx: TxLike): PositionPreview
deriveBaseSnapshot<P extends PositionLike>(currentPosition: P, transactions: TxLike[]): P
rollbackTransaction<P extends PositionLike, T extends TxLike & {id: string}>(currentPosition: P, allTransactions: T[], removeTxId: string): P
pruneTransactions<T extends {date: string}>(transactions: T[], years=3)
findDuplicateTransaction<T>(transactions: T[], assetIdKey: keyof T, {assetId,date,quantity,price,type})
```
`PositionLike`/`TxLike`(같은 파일 export)는 필요한 필드만 뽑은 구조적 타입 — 주식(`Transaction`/`PositionSnapshot`, `stockId`)뿐 아니라 코인(`CryptoTransaction`, `cryptoId`, 환율 없음)도 그대로 통과한다. **잔액 선형 가감(현금·대출)이 아니라 수량×평단이 바뀌는 자산이면 여기를 재사용**하고 cash-tx-utils류를 새로 만들지 않는다. `validateReflection`(`src/lib/trade/validate-reflection.ts`)도 동일 원리로 `TxLike`/`PositionLike` 제네릭.

### crypto: cryptoTransactionSchema (S-4.25)

`src/types/transaction.ts`. `transactionSchema`(주식)에서 `currency`/`exchangeRate`/`fee` 제거(코인은 항상 KRW), `stockId`→`cryptoId`. `assetData.cryptoTransactions[]`. 입력 폼 `forms/asset-update/input/crypto-tx-input.tsx`(cash-tx-input.tsx 구조 미러링, "자산업데이트" 플로팅 버튼 플로우 소속) · 뷰 `views/detail/crypto-tx/crypto-tx-view.tsx`(`crypto-transactions` 탭). 원인분해는 `asset-report.ts`의 `reflectedCryptoFlow`(`reflectedTradeFlow` 대칭)가 담당.

### tax-utils.ts (S-4.23)

```typescript
resolveTaxTags(assetData): Map<TaxTag, string>   // 보유 자산 → 세금 태그 + 근거 문구("상가·사무실 1건 보유")
computeForeignRealizedGain(assetData, year, rates)  // 해외주식 당해 실현손익 KRW 통산 → { gainKrw, sellCount, estimated, overDeduction } | null
getEventsForMonth(month): readonly TaxEvent[]
getMyEvents(events, tags): TaxEvent[]            // 교집합(common 포함) — 캘린더 "내 세금" 필터
taxEntryLine(assetData, today?): {dueLabel,title,imminent}|null  // 4.89 상세 허브 세금 행 보조줄(파생 일정 1건, 홈 팁 닫기 무관)
sortPastDueLast(events, month, today?): TaxEvent[]  // 4.92 세금 화면 이번 달 — 마감 지난 항목을 아래로(안정 정렬, dueEndDate 재사용)
getAssetDrivenHighlights(assetData, today?, limit=3): TaxEventMatch[]  // 홈 배너 전용 — common 전용 항목 제외.
  // 정렬 = 이번 달 우선 → 같은 달 내 high 우선(#4.29). 이번 달 항목 중 마감 지난 것 제외 — 내부 dueEndDate(event, year)가
  // dueLabel 마지막 "M/D"를 마감일로 해석("~10/25"→10-25, "12/1~12/15"→12-15), 날짜 없는 라벨("2월 급여")은 null=월말까지 유지
isTaxNoticeDismissed() / markTaxNoticeDismissed() / shouldShowTaxNotice(assetData)
isImminentTaxMatch(match, today?)                 // 이번 달 일정 && 마감일이 오늘~+6일(KST) — 홈 팁 임박 세금(#4.36)
todayKst() / currentMonthKst()                   // KST YYYY-MM-DD / YYYY-MM — 거래 입력(주식·대출·현금) 기본 날짜·max의 단일 출처(#4.35, UTC toISOString 금지)
isForeignStock(stock)                            // category==="foreign" 또는 currency!=="KRW" (export, S-4.31에서 UI도 재사용)

// S-4.31 — 연말 절세 시뮬레이션. 원가는 replay 없이 Stock.averagePrice(현재 평단) 그대로 사용
// 후보·선택 계산 모두 증권사가 아니라 티커 기준으로 종합(dev-rules.md "주식 계산·집계는 항상 종목 기준" 참조) —
// groupForeignStocksByTicker(내부 헬퍼)가 동일 티커의 증권사별 Stock 로우를 수량 합산·평단/매입환율 가중평균으로 병합
getYearEndTaxSimulation(assetData, year, rates)
  // → { baselineGainKrw, baselineEstimated, remainingDeductionKrw, candidates } (null 아님 — 거래 없으면 baseline 0)
  // candidates: { stockId, name, quantity, gainPerShareKrw, unrealizedGainKrw, estimated, rebuyQuantity }[]
  //   티커 종합 기준(동일 종목 여러 증권사 보유 시 후보 1건), 손실 큰 순 → 이익 큰 순 정렬.
  //   candidates[].rebuyQuantity는 "선택 0개(baseline만)" 기준 초기값 — UI는 computeRebuyQuantity를 다른 선택 종목 반영해 매 렌더 재계산(아래)
simulateSelectedForeignSale(assetData, selections: {stockId,quantity}[], year, rates)
  // → { combinedGainKrw, taxKrw, baselineTaxKrw, savingsKrw, estimated } — 체크된 종목(티커 종합 id) 합산(부분 수량은 선형 계산)
computeRebuyQuantity(gainPerShareKrw, quantity, baseGainKrw)
  // → 잔여 공제 한도(250만원 - baseGainKrw, **클램프 없음**)를 채우는 수량, quantity로 clamp, gainPerShareKrw<=0이면 0
  //   baseGainKrw가 음수(손실)면 한도가 250만원보다 커진다 — 손익통산. tax-year-end-simulator.tsx가 종목별로
  //   "이 종목을 제외한 현재 선택 전체 + baseline"을 baseGainKrw로 넘겨 "한도까지" 버튼을 실시간 재계산(2026-08-28,
  //   이전엔 baseline만으로 1회 계산돼 다른 종목 선택/해제에 반응하지 않는 버그가 있었음)
```
데이터는 `src/config/tax-calendar.ts`(`TAX_EVENTS`·`TAX_EVENTS_BY_MONTH`·`TAX_TAG_LABEL`·`FOREIGN_CAPITAL_GAIN_DEDUCTION`)가 단일 출처. **외부 API·네트워크 없음.**
실현차익은 `trade-utils.computeNewPosition`으로 이동평균 원가를 replay해 산출하며, 매수 로그·체결 환율 누락 시 현재 평단·환율로 폴백하고 `estimated: true`를 세운다. 체결 환율 0도 누락으로 읽는다(#5.158, 읽기 보정만).
닫기 상태는 `STORAGE_KEYS.taxNotice` 단일 키(`{ dismissedMonth: "YYYY-MM" }`) — `backup-status.ts`와 동일한 기기 로컬 메타 패턴이라 `asset-storage.ts` keepKeys에 보존되고 sync payload에는 넣지 않는다(R14 핑퐁 방지).

### onboarding-wizard-status.ts (S-4.29)

```typescript
readOnboardingWizardStatus() / writeOnboardingWizardStatus(status)
markCategoryStatus(category, "done"|"skipped"): OnboardingWizardStatus
markWizardDismissed(): OnboardingWizardStatus
getResumeCategory(status): WizardCategory | null   // pending인 첫 카테고리(주식→코인→현금→대출 순) — 재개 지점(AC6)
```
`STORAGE_KEYS.tutorialStatus`(스팟라이트 튜토리얼, 별개 기능)와 **코드 패턴만** 동일(단일 키+step map)하게 재사용하고 값은 절대 공유하지 않는다 — `STORAGE_KEYS.onboardingWizardStatus` 별도 키, 기기 로컬 전용.

### feature-usage.ts (S-4.32) — 기능 방문 기록 + 홈 팁 박스 추천
- **보유 필터(#170, 4.87)**: `pickRecommendedFeature(assetData)` 필수 인자. `HOLDING_CONDITIONS`(featureId → 조건)에 없는 항목은 통과. 절세 시뮬=`isTaxSimCandidate` 재사용, 주식 계열=수량>0, 자산군=건수>0. 걸러진 항목은 dismiss 안 함.

```typescript
viewToKey(view: AssetView): string          // "type" 또는 "type:tab" — navigate 훅·카탈로그 공유 방문 버킷 키
recordVisit(key: string): void              // 문자열 키 직접 기록(action형 항목도 자체 키로 기록 가능)
isTipDismissed(id): boolean / dismissTip(id): void   // 영구 dismiss(재노출 없음)
pickRecommendedFeature(): AppFeature | null
  // dismiss 안 된 항목 중 `tip:false`(새 소식 바로 가기 전용 `monthly-log`·`share-card-stock`, #4.83) 제외, 방문횟수 오름차순(0회 우선, 동률은 카탈로그 순) — isNew 폐지(#4.82, 신규 안내는 whats-new). 전부 dismiss면 null
getLastVisitedAt(key): string | undefined   // 방문 키의 마지막 방문 시각(ISO) — `새` 꺼짐 판정(#4.83)
runFeatureEntry(feature, navigate, source: "home_tip"|"whats_new"): void  // 기능 항목의 기존 이동(action | beforeNavigate → entryCategory GA(source) → target) 단일 출처. dismiss는 호출부 몫
```
방문 기록 헬퍼(#4.83): `navigation-context.tsx`의 `recordViewVisits(view)`(navigate가 호출 — 화면 키 + 자산 변화 전체·주 init이면 `change-week` 추가, `isChangeWeekAll`·`CHANGE_WEEK_VISIT_KEY`), 주 탭 전환은 `AssetChangeView.changePeriod`가 같은 키로 기록, `monthly-log`는 월별 기록 카드가 50% 이상 처음 보일 때(IntersectionObserver) 진입당 1회. `ChangeInit.focus?: "monthly-log"` = 월 탭 렌더 후 카드로 1회 스크롤(해시·저장 없음).
onboarding-wizard-status.ts와 동일한 "단일 키 + JSON 객체" 패턴(`STORAGE_KEYS.featureUsage`). 기기 로컬 전용 — 동의 UI 없음(`lastVisitDate`·`assetRefresh`·`tutorialStatus` 등 기존 로컬 전용 키들과 동일 원칙), sync payload 미포함(R14), `clearAssetData` keepKeys에도 넣지 않음(전체 초기화 시 함께 리셋되어도 무방).
카탈로그는 `src/config/app-features.ts`의 `APP_FEATURES`(`AppFeature[]`) — `id`/`title`/`description`/`icon` + 이동 방식(`target`(navigate) 또는 `action`(이동 없이 그 자리에서 실행, 예: 인증카드 다이얼로그 오픈) 중 하나, `beforeNavigate`로 target 진입 직전 로컬 서브탭 지정). `navigation-context.tsx`의 `navigate()` 본문에 `recordVisit(viewToKey(v))` 훅 1곳으로 모든 이동을 커버하고, action형(`share-card`)은 `top-bar.tsx`의 `trigger-open-share-card` 리스너가 `recordVisit("share-card")`를 직접 호출(asset-dispatch.ts↔feature-usage.ts 순환 참조 방지 목적으로 dispatch 함수 자체엔 기록 로직을 넣지 않음).

### home-tip.ts (S-4.32 후속) — 홈 알림/팁 통합 판정

```typescript
pickHomeTip({ assetData, hasAssets, syncArmed, today?, keepShown?, hasRelink?, whatsNewOk?, notifyOk? }): HomeTip | null   // today 기본값 todayKst()(테스트 고정용)
  // HomeTip = backup | tax | settlement | relink | refresh | { kind: "whats_new", count, title } | feature
  // 순서(#4.82): 백업 > 임박 세금 > 결산(창 안) > 새 소식 > relink > 그 외 세금 > 최신화 > 기능(저방문)
  // whatsNewOk = 체험·앱 잠금 아님(호출부 판정, isDataLoaded는 HomeTipBox effect 가드). hasAssets && whatsNewTip(readSeen(), {today}) 일 때만 반환
```
`backup-status.ts`/`asset-refresh-status.ts`/`tax-utils.ts`/`feature-usage.ts`/`whats-new.ts`의 기존 순수 함수를 조합만 한다. 홈 팁 박스(`home-tip-box.tsx`)는 `isDataLoaded` 이후에만 판정하고, X = 읽음 + 그 세션 박스 숨김, 클릭 = `dispatchOpenWhatsNew("home_tip")` + 박스 숨김. 강제 노출(`NOTICE_SHOWN_SESSION_KEY`)·`notice` 종류·`markCurrentNoticeSeen`·`isNoticeUnseen`은 4.82에서 삭제.

### whats-new.ts (`src/lib/whats-new.ts` + `src/config/whats-new.ts`, #4.82) — 새 소식 판정·기록

```typescript
WHATS_NEW: WhatsNewEntry[]            // config — { id "YYYYMMDD-NN", title(2~32), body?(≤48), featureId? } 날짜 내림차순·같은 날 NN 오름차순
parseEntryId(id) → {date, seq} | null  // 순번 없는 옛 id(YYYYMMDD)는 seq 0
compareIds(a, b): number               // 날짜 → 순번 숫자 비교(문자열 비교 금지)
readSeen(): {id, seenAt} | null        // 키 secretasset_notice_seen(만료·해석 불가·깨짐 = null). local-storage.readNoticeSeen 위 검증 래퍼
unseenEntries(entries, record, today?) // id > 기록 id && 게시 30일 이내(KST 일수 차이)
sheetEntries(entries, today?)          // 60일 이내 위에서 20개
whatsNewTip(record, {now?, today?, entries?}) → {count, title} | null   // 안 본 항목 있고 기록 없음 또는 seenAt+7일 이상
markWhatsNewSeen(entries?)             // compareIds 최대 id(latestEntryId, 같은 날 NN 최대)·seenAt=지금·만료 90일로 기록(목록 비면 무동작) — 팁 X·시트 열기·첫 실행 조용한 기록
shouldSilentFirstRun({isDataLoaded, hasAssets, hasRecord, eligible, hasEntries}) / runSilentFirstRun({isDataLoaded, hasAssets, eligible}) // 호출 = WhatsNewHost(항상 마운트, 웰컴 화면 포함)
newBadgeIds(entries?, record?, today?) // 시트 '새'(안 본 항목 전부(= 팁 N)) — 읽음 기록 전에 호출
visibleWhatsNew(entries?, trial?)      // 체험 중에는 `trialHidden` 항목 제외(C126, 5.164) — 시트 목록·'새' 개수·홈 팁이 같은 목록을 쓴다
```
저장 키는 기존 `STORAGE_KEYS.noticeSeen`(모양 `{id, seenAt, expiresAt}` 그대로, 동기화 payload 제외·가져오기 보존). 체험 모드는 판정·기록 안 함. 목록 등록 규칙·PR 본문 한 줄은 changelog 4.82 참고.

### new-spot.ts (`src/lib/new-spot.ts` + `src/config/new-spots.ts`, #4.83) — `새` 표시 판정

```typescript
NEW_SPOTS: Record<NewSpot, {entryId, visitKey}>   // config — spot(stock-market|hub-week|hub-monthly|hub-market) → 새 소식 항목 id·방문 키 대응표 1곳(저장 키 0). HUB_NEW_SPOT_ORDER = 허브 우선순위
isSpotNew(spot, today, lastVisitedAt?): boolean   // 켜짐 = 게시일(KST)~30일(WHATS_NEW_UNSEEN_DAYS), 꺼짐 = lastVisitedAt(KST)이 게시일 이후. 시트 읽음 기록 무관
pickNewSpot(order, today, lastVisited): NewSpot | null   // 한 화면 1개 — 보이는 자리 우선순위 순 첫 켜짐
```
화면은 `useNewSpot`·`NewChip`(`layout/ui/new-chip.tsx`). 방문은 `recordVisit`/`recordViewVisits` 실제 기록으로만 꺼진다(테스트도 실제 쓰기 함수로 판정, C83).

### xray: `formatBreakdownPct`·`pickXrayTile` (`src/lib/xray/stock-xray.ts`, #4.83)

`formatBreakdownPct(ratio) = Math.round(ratio*1000)/10` — X-Ray 페이지 항목 줄·타일이 공용(C65). `pickXrayTile(mergedStocks, rates) → {axis, itemLabel, pct} | null`: `pickHighlights`(`itemLabel` 필드 추가)로 축을 고르되 pct 100인 축(항목 1개뿐)은 건너뜀, 후보 없으면 null → 타일 폴백. 

### finance/stock-page.ts 추가(#4.83) — 행 미니 차트

`downsample(points, max)`(그리기 직전에만, 첫·마지막 점 포함)·`buildSparkGeometry(points, avg, w, h)`(`computeYDomain` 재사용, 평단 범위 밖이면 `avgY` null)·`buildRowFlow(flow, q, avg)`(none|loading|fallback|ready — 1년 %는 원본 points `computePriceChange`)·`signedRate`(종목 한 장·이름 줄 공용). `hooks/use-price-history.ts`: `priceHistoryQueryOptions(ticker, range, enabled, {retryOnMount?})`·`usePriceHistory` 4번째 인자(행 쿼리 `retryOnMount:false` — 실패 티커 재요청 차단, 시세 서킷 보호 C79).

### finance/stock-page.ts 추가(#4.84) — 가격 눈금·평단 칩·매도 점

- 눈금: `niceTicks(lo, hi, yOf, top, bottom, keep?, inset=6) → {step, ticks:[{v,y}]}`(간격 {1,2,5}×10^k, 값은 정수 곱 `i·m·10^e`·음수 지수는 10의 거듭제곱으로 나눔 C59, 픽셀 간격 12 미만·플롯 위아래 6px 밖 제외, keep 통과 2~3개 → 1개 → 0개)·`formatAxisPrice(value, currency, step)`(KRW `1.5억`·`7.5만`·`5,000` 원 생략, USD `$12.5`·`$0.25`, JPY `¥1,500`)·`axisGutter(tagText)`(46~76px)·`buildPriceAxis({points(원본), avg, price, currency, top, plotH}) → {domain, clamped, yOf, avgY, todayY, step, ticks(label 포함)}`(도메인 = 원본 points + 현재가 + 평단, 눈금은 평단선 10px·태그와 위 12/아래 20px 겹침 제외). 행 밴드·종목 한 장이 같은 함수.
- 행 상태: `buildRowFlow(flow, q)`는 `ready.points`(원본)를 돌려준다(`buildSparkGeometry`·`ROW_SPARK_W/H` 삭제, 선만 `downsample`).
- 칩: `placeAvgChip({pts, dots, avgY, left, plotW, maxY, full, short}) → {mode: plot|short|gutter, text, x, y}`(`CHIP_H`).
- 점: `pickBuyTransactions(tx, ids, type="buy"|"sell")`(이름 유지, 점 표시 전용·평단·성적표 계산 불변)·`buildTradeMarkers(buyDots, sellDots)`(날짜순, 같은 봉 매수→매도, 키 `kind:index`)·`layoutMarkers(markers, xOf, yOf)`(같은 봉·12px 미만 매수 −6/매도 +6)·`markerHitRadius`(벌린 쌍 6, 그 외 10~20).
- 현재가 문자열은 `formatCurrencyDisplay(currentPrice, currency)`(상세·주식 `현재가` 칸과 같은 함수, C65).

### 4.85 추가 유틸

- `lib/finance/dividend-client.ts` — `fetchDividend(ticker,type,excd="NAS")`(배당 공용 fetch: `!res.ok`·`X-KIS-Unavailable` → throw라 react-query가 캐시 안 함, 헤더 없는 200 빈 배열은 `[]`)·`countFailedDividends(queries)`(isError 수)·`isDividendReady(loading,failedCount)`(로딩·실패면 false, 성적표 잠정·기록 생략 판정)·`DIVIDEND_FETCH_FAILED_MESSAGE`·`jpyDividendNotice(n)`(엔화 종목 안내 1줄, #313). 배당 탭 2곳·성과 허브·자산 성적표(`useDividendAnnualTotals().failedCount`)가 사용. queryKey `["dividend","v11",ticker,type]` 공유.
- `lib/finance/dividend-axis.ts` — `niceAxisTicks(max, targetCount=4)`(1·2·5×10^n 등간격, 마지막 눈금 ≥ max)·`formatAxisWon(v)`(만원 이상 소수 1자리 `1.5만원`, 반올림 오차 0)·`pickVisibleLabels(values, labels, slotWidth)`(막대 값 라벨 가로 겹침이면 큰 값 우선). 배당 차트(`dividend-chart.tsx`)가 사용.
- `lib/number-utils.ts` `formatPriceByCurrency(value, currency)` — USD `$`·JPY `¥`·그 외 원. 기존 `formatPrice` 3벌(`stock-trades-view`·`stock-target-picker`·`delete-rollback-dialog`) 삭제·통합.
- `lib/finance/profit-utils.ts` `fetchProfitRef` — 배치가 429·5xx면 불완전(캐시 저장·`onComplete` 생략, 남은 배치 중단), `Retry-After`(1~5초, 10초 초과면 재시도 안 함)로 **실행당 1회**만 재시도(요청 상한 = 배치 수 + 1). `profitRetryDelayMs`. 점검(`X-KIS-Unavailable`)은 기존 경로.
- `lib/pwa/first-save-signal.ts` `setNudgeVisible`·`getNudgeVisible` — 설치 안내 카드 표시 중 신호(튜토리얼 양보용). `install-nudge-policy`는 튜토리얼 조건 없음.
- `lib/analytics/ga.ts` `featureTitleOf`: `onboarding_action` method별 `웰컴·스크린샷 등록|직접 입력|가져오기|동기화 연결|웹에서 시작|체험`(+ #249 `trial_start`에 `asset_type` → `웰컴·체험·<자산군>`, `source` activity|detail → `웰컴·체험·성과|상세`), `first_asset_saved`는 `첫 자산 저장·*`(`asset_save`는 `자산 저장·*`).
- `lib/finance/stock-page.ts` `chipWidth`(한글 10.5·숫자 6.2 폭 추정)·`placeAvgChip({..., grid?})` 격자선 회피(없으면 무시).

### hooks — use-box-size.ts · use-loading-phase.ts (#4.84)

`useBoxSize(fallback:{w,h}) → {ref, size}`(ResizeObserver 실측, 측정 전 fallback — 종목 한 장 320×200·행 밴드 0×0). `useLoadingPhase(active) → "quiet"|"note"|"slow"|null`(0.5초·5초 경계 `NOTE_DELAY_MS`·`SLOW_DELAY_MS`, 순수 `loadingPhaseAt`·`startLoadingPhase(onPhase) → cancel`로 fake timer 테스트). `lib/whats-new.ts`에 `restoreFocusAfterSheetClose(event, gone, doc?)`(이동 외 모두 `main` tabindex -1 포커스).

### seeded-pick.ts (`src/lib/xray/seeded-pick.ts`, #4.26) — 결정적 seed 선택 단일 출처

```typescript
hashString(input: string): number          // djb2 계열 — 같은 입력이면 항상 같은 값
pick<T>(pool: readonly T[], seed: string): T   // pool[hashString(seed) % pool.length]
```
`investor-type.ts`(문구 선택)와 `investor-avatar.tsx`(표정·바깥 원 색)가 공유. 랜덤이 필요해 보여도 `Math.random`은 쓰지 않는다(캡처 PNG·재렌더마다 결과가 달라지면 안 됨) — seed는 카테고리형 값만 조합.

### investor-type.ts (`src/lib/xray/investor-type.ts`, #4.26) — 인증카드 투자 유형 산출

`resolveInvestorType(params)` → `{ title, subtitle, description, tags, highlightTerms, avatar: InvestorAvatarSpec }`. 입력은 섹터(`themeKey`)·집중도(`concentration`)·지역(`regionKey`)·계좌(`accountKey`)·종목유형(`stockTypeKey`)·통화(`topCurrencyLabel`) 필수 + 선택(`topStockName`·`secondStockName`·`subThemeLabel`·`secondAccountLabel`·`topIndexLabel`·`topIndexAccountLabel`·`krUsBalance`·`topHoldings`(상위 3종목 이름·티커)). 모든 문구 선택은 `pick(pool, seed)`(결정적)이고, 설명은 sentence1~6을 연결어(`FLOW_CONNECTOR_MID`/`CLOSING`)로 이어 "나열이 아닌 자연스러운 서술"로 조합하며 종성 판별 조사 처리·민감어(종교·국수주의) 배제·제목/설명 단어 일관성을 유지한다. `highlightTerms`는 설명에서 굵게 강조할 종목·섹터·지수명(긴 것부터 매칭, `share-card.tsx`의 `renderDescriptionWithHighlights`). `avatar`는 `InvestorAvatar` 입력(`concentration`·`stockTypeKey` 포함). 종목명은 `stock.name` 원문(주식 현황·도넛 라벨과 동일 표기).

**어휘 풀·가드 규칙**: 제목 앞말 8/8/8(집중도별)·뒷말 8(섹터별)·배지 지역 6~7·계좌 7·쪽지 성향 7, 설명 첫 문장 10(집중도별) 등 풀을 대폭 확장(시뮬 기준 고유 제목 351→876·배지 270→1284). ① `pickFilled` — 직전 문장과 끝 어절이 같은 후보는 건너뛰어 어미("~는 편") 반복 억제 ② 슬롯(`{stock}` 등) 바로 뒤에 받침 의존 조사(이/가·은/는·을/를·과/와·이면·으로) 금지 ③ 모든 첫 문장 템플릿에 `{theme}` 포함(제목↔설명 일관) ④ 쪽지 태그는 공백 제거 후 9자 이하(`pickTag`, `TAG_MAX_LEN`) ⑤ **섹터·카테고리 수준의 일반 어휘만** 사용 — 지역·섹터 키로만 고르는 풀이라 특정 기술·사업·거래소(라이다·배터리·H주 등)를 단정하는 표현은 오해를 낳으므로 금지.

**미국 배지 컨텍스트 풀(`regionPool`)**: `REGION_MOD.US`는 공통 6개, 조건부로 합류 — 개별 빅테크(상위 3종목 중 1위가 MAG7 또는 2종목 이상, 종목유형≠지수투자)면 "빅테크 동행자"·"나스닥 러버", ETF 중심(종목유형=지수투자 또는 테마=ETF/펀드)이면 1위 지수가 나스닥이면 "기술주 동행자"·"나스닥 러버", S&P면 "S&P 탐험가". ETF 위주 포트폴리오에 "빅테크 동행자"가 붙지 않도록 하는 규칙. 1위 지수는 `topIndexLabel`(비중 최대 1개).

### holdings-conflict.ts (S-4.30) — 보유현황 스크린샷 재등록 시 병합(merge)/전체교체(reset) 공용

```typescript
keyOfStock(s) / keyOfCrypto(c) / keyOfCash(c) / keyOfLoan(l): string   // 카테고리별 중복 판정 키
countConflicts(existing, incoming, keyOf): number
resolveKept(existing, importedKeys, mode: "merge"|"reset", keyOf): T[]  // merge=겹치는 기존 항목만 제외, reset=전부 제외
```
`crypto-screenshot-import.tsx`가 최초 구현한 패턴을 일반화 — stock은 `ticker:category`, cash는 `name:institution`(근사), loan은 `name:institution:type`으로 매칭. cash/loan은 스키마에 고유 식별자가 없어 근사 매칭(오매칭 가능, preview에서 사용자가 개별 체크/해제).

### #4.55 신규 유틸
- `lib/asset/screenshot-fail.ts`: `mapParseErrorTitle(status, error)`·`emptyFailTitle`·`makeScreenshotFail`·`SCREENSHOT_FAIL_NETWORK`.
- `lib/asset/yearly-auto.ts`: `yearlyAutoCaption`·`yearlyAutoCaptionText`·`yearlyEditDefaults`(연 탭 자동 기록 안내·고치기 폼 기본값).
- `lib/asset/asset-refresh-status.ts`: `heldRefreshCategories(assetData)`, `getStaleCategories(last, held?)`·`shouldShowRefreshNudge({held?})` 선택 인자(미지정 = 전체, 홈 팁만 지정).
- `lib/onboarding-wizard-status.ts`: `createStepCompleter(base, onComplete)` 단계 완료 1회 가드.
- `asset-dispatch.ts`: `ADD_TRIGGER_EVENTS`(추가 폼 이벤트 이름 단일 정의).

### resync-return.ts (#110) — 이어서 맞추기 순수 함수

### min-share.ts (#148, 4.77) — 도넛·비중 바 표시 최소 비중
`src/lib/report/min-share.ts`: `displayShareWidths(values, {minPct?, maxItems=5, total?})`(양수 항목 5개 이하면 최소 폭 보장·합 100, 6개 이상 순수 비례, 0 이하는 0, `total` 주면 합/total만 채움), `displayBarWidths`(4.70, composition.ts가 재노출), 상수 `MIN_BAR_PCT=7`·`MIN_DONUT_PCT=5`·`MIN_SHARE_MAX_ITEMS=5`. 폭·각도만 바꾸고 숫자·라벨 표시 기준(`DONUT_LABEL_MIN_PCT`)은 실제 값. 사용처: `AssetDonutChart`(Pie `dataKey="shown"`)·`SectionBar`·상세 5탭 비중 바·`PortfolioSectorBar`·`/ratio` 국내/해외 바·구성 막대. `portfolio-ring-card.tsx`의 `MIN_ARC_DEG` 링은 라벨·상한 로직이 달라 별도 유지.
`sortHoldingsRows`(보유 우선 안정 정렬·과거 순자산 맨 아래), `resyncNoticeText`(상단 줄 문구), `consumeResyncSignal`(대기 자산군과 같은 신호만 복귀·소비), `shouldTrackResyncContinue`(GA 조건), `isRefreshCategory`, `RESYNC_LABELS`. 저장·스키마와 무관.

### asset-refresh-status.ts (S-4.30) — 카테고리별 자산 최신화 상태(홈 넛지용)

```typescript
markCategoryRefreshed(category, {notify?})   // 보유현황 저장 성공 시 호출(반환: 쓴 ISO 시각 = appliedAt, #4.62). 기본으로 window 이벤트 `asset-category-refreshed`(detail.category) 발행(#110). 거래 스크린샷·보유 현황 맞추기 적용은 notify:false
notifyCategoryRefreshed(category)            // 신호만 발행(보유 현황 맞추기는 결과 화면을 닫을 때)
restoreCategoryRefreshed(category, prev, appliedAt)  // 맞추기 되돌리기 시 refresh 메타 원복(#4.62). 현재 값 === appliedAt일 때만(compare-and-restore), prev null이면 그 자산군 키만 삭제, nudgeShownOn·다른 자산군 보존, 신호 없음
shouldNotifyResyncClose(step, undo)                  // resync-return.ts — 결과 화면이고 되돌리지 않았을 때만 복귀 신호(#4.62)
isRefreshedToday(category): boolean          // lastRefreshedAt의 KST 날짜 == 오늘
daysSinceRefresh(category): number | null
getStaleCategories(assetLastUpdated?): RefreshCategory[]   // 30일 이상(또는 이력 없음+유예 경과) 오래된 순
shouldShowRefreshNudge(opts): boolean
markRefreshNudgeShown() / clearAssetRefreshStatus()
```
`backup-status.ts`와 동일 패턴(단일 키 + 오늘 노출 여부). `STORAGE_KEYS.assetRefresh`, `clearAssetData` keepKeys에 포함(기기 로컬 메타). 백업·세금과의 동시 노출 배제는 `home-tip.ts`의 `pickHomeTip` 우선순위가 담당(S-4.32 후속 — 과거의 `suppressed` prop 방식은 제거됨).

### report/asset-report.ts — 원인분해 집계 헬퍼

```typescript
// 모듈 내부
krwMul(currency, rates)                              // KRW 환산 배수 (JPY는 100엔당) — 원인분해 공용
reflectedCashInflow(data, from, to, rates): number   // 반영된 현금 순유입만 합산 (미반영 소급 기록은 순자산 무변동 → 제외)
reflectedTradeFlow(data, from, to, rates)            // → { buy, sell } 반영된 주식 체결액 (체결 환율 우선)
realizedSellGains(data, from, to, prevFx, rates)    // (내부, #4.64 D1) 정밀 분기 반영 매도 실현손익 R {stock, crypto} — priceStock/Crypto +R, manual −R, 합계 불변
tradeKrwRate(t, rates)                               // 주식 체결 KRW 배수(체결 환율 우선, JPY 100엔당, 없으면 현재 환율) — reflectedTradeFlow·getAttributionRecords 공용
costFxRevaluation(data, prevFx, currFx, from, to, rates, includeFromCash)  // (#4.65) → { stock, cash, flowFxStock, flowFxCash } 구간 시작 보유분 기준(주식 deriveBaseSnapshot 역산·현금 입출금 역가감); flowFx = 구간 안 외화 매수·입출금의 (끝−체결 환율) 몫 → fx로 이동·manual에서 차감. 이하 종전: 외화 원가의 환율만으로 인한 재평가분 — saving에서 제외해 fx와 이중귀속 방지
fxBaseByClass(data, rates)                           // → { stock, cash } 통화별 외화노출 기준액(KRW) — computeFxExposure용 단일 수식
byDateThenDaily(a, b)                                // 시계열 포인트 정렬 — 같은 날짜면 daily 우선(monthly보다 뒤) → 시작점이 daily로 잡힌다
makeCause(key, amount, estimated?): AttributionCause // label=causeShortLabel·sentence=causeSentence 파생. estimated 플래그가 있으면 AttributionCause.estimated=true
isFullyEnriched(p): boolean                          // breakdown·fx·fxBase·cost 전부 보유 — bothEnriched 판정과 하이브리드 mid 탐색이 공유하는 단일 술어
yearlyAnchorPoints(assetData)                        // yearlyNetAssets → YYYY-12-31 앵커 포인트(netAsset만, 항상 예측 경로)
reallocatePriceEffects(effects, mid)                 // 예측 구간의 통합 "price"를 mid breakdown의 **주식·코인** 비중으로만 안분해 price:stock/price:crypto로 재배분(estimated:true). 부동산은 제외(2026-08, 아래 참조)
mergeAttributions(older, newer, mid)                 // 두 PeriodAttribution의 effects를 reallocatePriceEffects로 안분 후 key별 합산·pickTopCauses 재실행 — 하이브리드 구간 합성

// export
causeShortLabel(key, amount): string                 // 모든 라벨의 단일 출처(부호 방향 반영). label·sentence가 여기서 파생
causeSentence(key, amount): string                   // 서술형 문장 (성적표용)
getOrderedCauses(attr): AttributionCause[]           // topCauses+restCauses를 CAUSE_ORDER 고정 순서로 정렬
getAttributionItems(attr): AttributionDisplayItem[]  // **표시 항목의 단일 출처.** 임계값 미만 잔차 흡수(부호 일치 확인)까지 끝낸 최종 목록 — 홈(label+text)·성적표(sentence+원단위)가 모두 이것만 쓴다. estimated?: boolean 필드로 항목별 "일부 예측" 배지 판정(2026-08)
groupAttributionItems(items): AttributionItemGroup[] // getAttributionItems 결과를 자산 타입(stock/crypto/realEstate/cash/loan)별로 묶어 그룹 합계 절대값 큰 순서로 정렬(2026-08, 성적표 "순자산 변화, 왜?" 박스 그룹핑). fx·deposit·통합 price는 그룹 없음(key: null)
formatAttributionSentence(attr): string | null       // 위 항목을 한 줄로 결합(스크린샷·폴백용)
formatAttributionDate(d): string                     // YYYY-MM-DD→M/D, YYYY-MM→M월 (홈·성적표 공용)
// S-4.33 — 항목별 날짜·기록 타임라인 (금액 계산 무관, 순수 파생)
getAttributionRecords(attr, assetData, rates): AttributionRecord[]
  // 구간 내 **반영된** 현금·주식·코인·대출 기록 { id,date,createdAt,causeKey,label,title,amount(원인 방향 부호, KRW) }를 날짜→입력순.
  // 경계는 inFlowWindow(매매 (from,to], 현금·대출 [from,to]), 구간은 PeriodAttribution.windowFrom/windowTo(스냅샷 _date — 표시용 fromDate는 monthly면 "YYYY-MM")
attachCauseDates(items, records): AttributionDisplayItem[]  // key별 기록 최초~최신일 → dateLabel("10/21"·"10/20~10/23")·firstDate. 기록 없는 원인은 그대로
sortCausesByDate(items): AttributionDisplayItem[]    // 시세·환율 → 날짜 있는 항목(firstDate순) → 날짜 없는 항목(CAUSE_ORDER). 성과는 groupAttributionItems 전에 적용해 그룹 내부만 정렬
```

`resolveAttribution`이 Δ순자산을 분해한다. **원인 키는 자산군까지 명시한다**:
`price:stock|price:crypto|price:realEstate`(정밀) · `price`(예측 모드 통합) · `fx` · `buy:stock|sell:stock|buy:crypto|sell:crypto|buy:realEstate|sell:realEstate` · `income` · `cash` · `deposit` · `debt`.

- **"그 외"(`rest`) 범주는 없다.** 순자산 변동의 원인은 시세·환율·자산 유입/유출뿐이므로 잔차 범주를 두지 않는다. 새 원인을 추가할 때 "설명 안 되는 조각은 rest로" 식의 폴백을 되살리지 말 것.
- **`income`과 `cash`는 서로 다르다(2026-08 분리, P1 회귀 수정)** — `income` = `cashTransactions`에 **실제로 기록된** 입출금만(`incomeEffect`). `cash` = 기록으로 설명되지 않는 현금 잔액의 실측 변동. 라벨(`causeShortLabel`)은 "현금 잔액 증가/감소"로 사건을 단정하지 않지만, **서술형 문장(`causeSentence`)은 "현금 잔액 직접 수정으로 ~ 추정돼요"** — 실사례 디버깅(`scripts/debug-attribution.js` 매일 타임라인 대조) 결과 대부분 계좌 잔액을 입출금 기록 없이 직접 수정한 경우였음을 확인해 반영. 단정("~때문이에요")이 아니라 "추정돼요"로 남겨 다른 원인(계좌 삭제 등) 가능성을 열어둔다. **종전엔 `income = incomeEffect + dCostCash`로 합쳐 방출해 `incomeEffect`가 대수적으로 완전히 소거됐다**(기록을 넣든 안 넣든 표시 금액이 같았다 — "인출·지출 −480만원"이 거래 기록 0건인데 표시된 실제 회귀). 두 키로 나눠 방출하면 항등식은 그대로 유지되면서 기록 여부가 실제로 반영된다.
- **`deposit`(임차보증금 증감, 2026-08 신설)** — `netAsset = totalValue − loans − tenantDeposit`인데 `SnapshotBreakdown`에 `tenantDeposit`이 없으면 그 변동이 통째로 `priceResidual`(→ 현금 잔차)로 샌다. `breakdown.tenantDeposit`(optional, v4)이 있는 스냅샷끼리만 분리 가능 — 과거 스냅샷(필드 부재)은 여전히 잔차로 흡수된다. debt와 동일 부호 규약(증가=음수, 반환=양수).
- **`priceEffect`는 잔차**다. 자산군별 시세는 스냅샷의 `breakdown`(평가액)−`cost`(원가) 델타로 산출하고, `priceEffect` **총액은 건드리지 않은 채** 그 안을 나눈다.
- 환율효과의 **주식 몫 = `fxEffect − costFx.cash`**(현금 몫을 정확히 계산해 빼는 방식) — 보유 비율 안분 근사를 쓰면 오차가 잔차로 남는다. 이 정의 덕에 자산군별 시세의 합 = `priceEffect`가 성립한다.
- 스냅샷의 `netAsset`과 `breakdown` 합이 어긋날 때만 남는 `priceResidual`은 `depositEffect`를 뺀 뒤 **`dCostCash`(→`cash`, `income`이 아니다)에 합산**한다 — 이 항이 **표시 합계 = deltaNet 항등식**을 무조건 보장한다(F-ACTIVITY 회귀 지점).
- 신규 투입도 자산군별 `Δcost`로 쪼개 "매수/매도" 용어로 통일한다. 거래내역 없는 주식 원가 변동(직접 수정·스크린샷 등록)은 **방향별로** `buy:stock`/`sell:stock`에 합산(같은 라벨 두 줄 방지). 투자 3종+임차보증금으로 설명되지 않는 원가 증감(=현금 잔액 직접 수정)은 `cash`에 합산한다.
- **휴장 여부로 시세 원인을 억제하지 않는다.** 해외 종가는 KST 화~토 새벽에, 국내는 평일에 갱신되므로 월~토는 매일 주식 변동이 실재한다(일요일만 없고, 그날은 금액이 임계값 미만이라 자동으로 안 보인다).
- **잔차 흡수는 부호가 같은 원인에만 붙는다**(`getAttributionItems`, 2026-08 안전장치) — 임계값 미만 잔차 합(residual)을 절대값 최대 원인에 얹되, `residual`과 부호가 다른 원인에는 얹지 않는다. 방향 고정 라벨(`buy:stock` 등)에 반대 부호 잔차가 붙으면 "주식 매수로 −3만원 늘었어요" 같은 모순 문장이 나오기 때문. 부호가 맞는 원인이 하나도 없으면 `cash`로 보낸다(없으면 신설).
- **`estimated` per-item 배지 + 부동산 제외 안분(2026-08)** — `resolveAttribution`의 예측 분기가 만드는 `effects`는 전부 `estimated:true`(단, `income`은 기록된 거래 그대로라 예외), 정밀 분기는 전부 `estimated`가 없음(false 취급). `mergeAttributions`가 하이브리드 병합 시 older(예측)의 통합 `price`를 `reallocatePriceEffects`로 **mid 시점 breakdown의 주식·코인 비중에만** 안분해 newer(실측)의 `price:stock`/`price:crypto`와 합친다 — **부동산은 안분 대상에서 제외**한다(`real-estate-input.tsx`의 `currentValue`는 시장가 자동 갱신이 없고 사용자가 실거래가 조회 후 수동으로만 바꾸는 계단식 값이라, 정체불명 시세 잔차를 부동산 비중만큼 떼어주면 사용자가 값을 건드리지도 않았는데 "부동산 시세 하락"이 뜨는 근거 없는 추정이 된다). 부동산의 실제 시세 변동은 정밀 분해(`bothEnriched`, `price:realEstate`)로만 노출. 주식+코인 구성이 0(mid breakdown 없음·부동산뿐 등)이면 안분하지 않고 통합 `price` 그대로 남아 `causeShortLabel`이 "보유자산 시세"로 라벨링한다(자산군 통합임을 명시). `AttributionDisplayItem.estimated`가 true인 항목에 뷰가 "일부 예측" 배지를 개별로 붙인다(구간 전체가 `attribution.estimated`면 상단 배지로 이미 충분하므로 중복 생략).
- **`groupAttributionItems`(2026-08)** — `getAttributionItems` 출력(이미 `CAUSE_ORDER` 정렬됨)을 자산 타입별로 묶는다: `price:X`/`buy:X`/`sell:X`(X=stock/crypto/realEstate) → 해당 자산군 그룹, `income`/`cash` → `cash` 그룹, `debt` → `loan` 그룹. `fx`/`deposit`/통합 `price`는 그룹 없음(`key: null`, 단독 박스). 그룹 소속 판정은 첫 등장 순서를 보존하되, **최종 나열 순서는 그룹 내 금액 순합(양음 상쇄 반영)의 절대값이 큰 순서로 재정렬**한다 — 변동이 큰 자산 타입이 위로. 성적표 뷰가 이 그룹 단위로 박스 하나에 여러 줄을 묶어 렌더한다(`GROUP_BADGE` 라벨 재사용).

### ai-prompts.ts — AI 질문 프롬프트

- `AI_PROMPT_TEMPLATES`(성적표 종합 현황), `GUARDRAIL`(종목 추천·목표가·타이밍·단정 예측 금지, 모든 프롬프트 맨 앞)
- `buildSettlementPrompt({ name, rangeLabel, kind, longGap, gapDays, prevValue, currValue, delta, pct, causes, estimatedLabel })`(#4.37) — 결산 화면 값만(`formatPriceByMode`·`SETTLEMENT_CAUSE_LABEL`), 이름·기간 라벨은 UI 문자열로 받음(lib→views import 금지). 진행 중·N일 구간·원인 0건·예측 라벨·'기록 안 된 변화' 설명 1줄

### report/settlement.ts (#4.34, 이슈 #32) — 월말 결산 순수 함수

- `pruneMonthlySnapshots(all, currentMonth)` — `month >= 현재월−12`만(최대 13개, 연 경계 무관). `saveSnapshots` 월 업서트가 사용. `shiftMonth(month, delta)`
- `resolveSettlementWindow(monthly, month, today)` → `SettlementWindow {kind: settled|range|in_progress|first_month, start, end(null=진행 중·실시간), startDate, endDate, gapDays, longGap}`. `pickSettlementMonth`(1~10일+전월 기록일 ≥21일 → 전월), `isSettlementCardPeriod`(말일−3~10일), `pickSettlementCard`, `listSettlementMonths`(13개월·활성 여부), 문구 `settlementWindowName(w, today)`→`{name, inProgress}`(팁·허브·결산 공용 1곳, 4.94)/`settlementRangeLabel`/`formatSettlementPoint`, GA `settlementGaResult`(range→settled, A는 first_month). **4.94 처음 맞는 결산**: `pickFirstRecordStart(daily, assetData, today)`(자산 id 13자리 ms `assetIdRegisteredDate` 최댓값 R 이후 첫 enrich 일별 기록, 없으면 null)를 `resolveSettlementWindow`·`pickSettlementCard`의 선택 인자 `firstRecord`로 넘기면 start 없음·≥7일일 때만 채택(`SettlementWindow.firstRecord`). 호출부 3곳(home-tip.ts·performance-hub·settlement-view)이 같은 입력을 넘긴다
- `mapSettlementCauses(effects, {deltaNet, cashTracked})` → 5항목(`price|valuation|fx|income|unrecorded`, 원 단위 정수, 10원 미만 숨김) + `showUnrecordedHint`(≥50%). 기록 안 된 변화 = Δ순자산 − 표시 4항목(항등식). `SETTLEMENT_CAUSE_LABEL`
- `views/activity/week-attribution.ts`(#4.79, 순수·`matchRecordedTransferDetail` 때문에 lib이 아닌 뷰 폴더): `computeAttributionView({assetData, rates, summary, daily, monthly, exchangeHistory, sinceDate})` → `{attr, transfer, causes, records, offsetTotal, sentence, rangeLabel}|null` — 홈 Hero `useHeaderNetChange`와 주 탭이 **같이** 부르는 원인 분해 단일 계산(저장소 읽기는 호출부). `mapWeekCauses(view)` → `SettlementCauses`(Hero 항목을 시세/평가 갱신/환율/순유입/대출/기록 안 된 변화 6줄로 합산만, 기록 안 된 변화 = round(Δ)−나머지 줄 합, |Δ|<1만이면 줄 0개), `weekLineOf(key)`, `resolveWeekHero(view, today)`(D=today−시작일: 7~9 `최근 7일`+구간 / 그 외 ≤14 `M/D 이후` / >14 부족 / null 빈), `weekFallbackSince(daily, today)`(4.92, 휴면 복귀 폴백 시작일 — 일별 기록 ≥2면 가장 이른 날, `useWeekHero`가 insufficient일 때만 재계산), `weekToday()`(홈 Hero와 같은 KST 식)·`weekSinceDate(today)`(−7일). 테스트 픽스처 `__tests__/week-fixtures.ts`, 홈 출력 골든 `header-change.golden.json`(main 훅 본문 verbatim 캡처)
- `buildWeekRows(daily, today)` — 최근 7일 행(최신순)·7일 전 대비. `buildSettlementIcs(now)` — RFC 5545 VEVENT 1개(말일 21:00 KST, `RRULE:FREQ=MONTHLY;BYMONTHDAY=-1`, CRLF·75옥텟 접기, 금액 없음)
- 엔진 쪽 유일한 추가: `asset-report.ts`의 `computeAttributionBetween(prevMonthly, currMonthly|liveCurr, …)` — `resolveAttribution(…, isFirstSegment=true)` 단일 구간, 하이브리드 없음(레거시 시작=전체 예측), 끝점에 fx·fxBase 없으면 null

### report/year-settlement.ts (#5.124, 이슈 #237) — 올해 결산 순수 함수(읽기 전용, 저장·전송 0)

- `resolveYearTarget(yearly, today)` → `{year, closed, start, end} | null`. 1/1~1/10(`CARD_UNTIL_DAY`)이고 직전 해 항목이 있으면 `closed`(직전 해 유지), 그 밖은 올해 항목이 있을 때만 올해. 끝값의 단일 출처 = 년도별 그 해 항목
- `pickYearEndSnapshot(monthly, year)` — 닫힌 결산 끝점(그 해 마지막 enrich 월 기록). `resolveYearChain(…, today = 끝 기록일)`로 그 해 체인을 얻는다(함수 무수정)
- `splitYearChain(points, heroStart, heroDelta, run)` → `measured | mixed{period{amount, month, from, until}} | estimated-only`. 기간 행 = 첫 enrich 월 기록 − **Hero 시작값**, 나머지 = `run(points.slice(1), total − 기간 행)` → 합 = Hero 증감
- `resolveFirstYearChain(monthly, daily|null, assetData, year, endDate)` — 첫 해 시작점: 그 해 가장 이른 enrich 월 기록(끝 달 제외) → `pickFirstRecordStart`(daily가 있을 때만) → 7일 미만이면 null
- `groupYearSettlement(mapped)` → `{income, growth{amount, rows}, loan, unrecorded}`(10원 미만 숨김), `hasYearRows`, `buildYearConclusion(groups)` → `{n, m} | null`(둘 다 양수·기록 안 된 변화가 합보다 작음·1~99%)
- 문구: `YEAR_SETTLE_COPY`, `yearPeriodPhrase`(`올해`·`11월부터`·`11/3부터`·`2026년에`·`2026년 11월부터`), `yearSettlementTitle`, `yearPeriodLabel`(`1~10월`·`1월`·`10월 기록 전`), `yearIncomeHint(phrase, cashTracked, income?)`, `yearIncomeName`·`yearHelpText`·`isYearIncomeOut`(income<0이면 `꺼낸 돈` 문구, `YEAR_SETTLE_COPY.incomeOut`·`helpOut`; 정본 income·help 값은 불변), `mdOf`
- `settlement.ts`: `isEnriched(monthly)` export(5.124)
- 테스트: `report/__tests__/year-settlement.test.ts`(픽스처 `year-settlement-fixture.ts`), `views/activity/__tests__/year-settlement-block.test.tsx`

### asset/stock-labels.ts · asset/grow-rows.ts · hooks/use-stock-labels.ts (#5.125, 이슈 #239) — 주식 이름표·점검 기록

- **저장 키** `STORAGE_KEYS.stockLabels` = `secretasset.stock_labels`(점 구분, `secretasset_` 접두 금지). 전역 `localStorage`만 사용 — 모듈 캐시·IndexedDB 금지(체험 격리). `AssetData`·Context·`assetDataSchema`에 넣지 않는다
- `stock-labels.ts`: `parseStockLabels`(완화, 항목 단위) · `readStockLabelsState()` → `none | ok | corrupt` · `readStockLabels()`(빈 상태 폴백) · `writeStockLabels` · `clearStockLabels`(모든 데이터 삭제·`?demo=empty` 전용) · `mergeStockLabels(a, b)`(티커별·cycle `at` 최신 우선, 교환법칙) · `sameStockLabels` · `countValidLabels` · 편집 `setStockLabel`/`markStockChecked`/`setStockLabelCycle`(순수, 바뀐 게 없으면 같은 객체) · `applyIncomingStockLabels(field, {merge})` → `{repush}` · `readStockLabelsForExport` · `isStockLabelKey`
- **기준값·보존(인사이트 보강)**: 항목 `base?: { qty, price?, priceAt?, weight? }` — `setStockLabel(state, ticker, label, nowIso, base?)`가 `labeledAt`과 함께만 쓴다('정하지 않음' 표식·점검·주기 변경은 쓰지 않음). `qty`가 유한 양수가 아니면 `base` 전체를 없는 것으로 읽는다. 모르는 필드는 4곳(최상위·cycle·항목·base)에서 보존(`STOCK_LABEL_EXTRA_LIMIT`), 값을 새로 정하는 편집(이름표 종류·주기 값)만 그 객체 것을 버린다. **계약: 항목 안의 미래 필드는 그 이름표 결정에 딸린 값, 이름표를 바꿔도 남아야 하면 최상위에 둔다.** 병합 동률 = 직렬화 긴 쪽 → 문자열 큰 쪽, 같음 판정(`sameStockLabels`)은 키 정렬 재귀 직렬화. `isStockLabelRevisit(labels, nowMs)` = '다시 봄' 판정
- `grow-rows.ts` 추가: `growTotals(stocks, rates)` → `{totalValue, hasUnpriced}` · `qtyByLabelKey(stocks)` · `formatQty` · `buildLabelBase(stocks, rates, ticker)`(화면이 만들어 훅 `setLabel(ticker, label, base)`로 넘긴다 — 저장 모듈은 자산을 읽지 않는다) · 행 `qtyFact`(표시 문자열 비교, 당일·base 없음 = null)·`weightValue` · `summarizeGrowRows(rows, labels, nowMs, totals)` → `weights.{keep,check,none}: {count, pct, pctText}`(세 표시값 합 100.0, '정하지 않음' = 100 − 나머지 둘, 시세 없는 종목 있으면 `—`)
- **규칙**: payload 최상위 `stockLabels`. 필드 없음 = 쓰기 호출 없음(로컬 유지). 파일 가져오기·데모·체험 = 교체, 동기화 pull만 병합(`applyImportedPayload(…, { mergeStockLabels: true })` → `stockLabelsRepush` → `pullAsset`이 `mergedAdditions`에 OR). 손상 원문은 읽기·병합·내보내기가 덮지 않고 사용자 저장만 교체한다. '정하지 않음' = `label: null` 표식(항목을 지우지 않는다)
- `grow-rows.ts`: `buildGrowRows(stocks, rates, labels, nowMs)`(전체 탭과 같은 그룹·분모·문자열, 티커 없는 종목 제외, 저장 키 = `normalizeTicker`) · `sortGrowRowKeys`(주기 지난 행 위, 그 밖 비중 순) · `collapsedGrowRowKeys`(4번째 이후이면서 지나지 않은 행) · `summarizeGrowRows` → `{keep, check, none, lastCheckText}` · `elapsedSince`/`formatAgo`/`formatSince`(KST 날짜·지난 달력 월 수). 주기 기준일 = 점검일과 이름표를 붙인 날 중 늦은 쪽
- **재설계 3차(11/18)** `lib/asset/grow-board.ts`(신규, 순수): `buildBoardRows(stocks, rates, labels, nowMs, tx)` → 행(티커 묶음·티커 없는 종목 포함·상장폐지 제외, 오래 가진 순, 보유 건마다 `computeStockMetrics` 합) · `boardTotal`(= `computeStockTotals`) · `buildAxisGroups(axis, rows)`(hold·etf·sector·cap, 고정 순서, Σ손익÷Σ원가) · `rowAxisKey` · `boardScale`/`scalePos`(공통 눈금) · `holdScore`/`annualizedPct`/`HOLD_SCORE_BANDS`/`SCORE_MIN_DAYS`(183일) · `nextChecks`. `asset-detail-tabs.tsx` `computeStockTotals(stocks, rates, displayCurrency)`(상세 › 주식 헤더와 공용). `stock-xray.ts` `classifyStock(axis, stock)`. `demo-inject.ts` `demoClassificationPatches`. `useDividendAnnualTotals().annualAtHeldQty`(지금 수량 기준 1년 배당 가정). `grow-links.ts` 삭제, `GrowRow`의 `qtyFact`·`priceFact`·`tradeCount` 제거
- **인사이트 4종(5.125, 재설계 3차로 대부분 대체)** `grow-rows.ts`: 행 `priceFact`(정한 날 가격 대비 %, 종목 통화·당일·`base.price` 없음 = null, 지금 시세 없음 = `—`) · `tradeCount`(이름표 있는 행만) · `tradeCountsByLabelKey(stocks, transactions, nowMs)`(보유 건 id → 키 맵 1회, `stockId` 매칭, 달력 3개월 전 초과 ~ 오늘) · `threeMonthsBefore(today)`(없는 날 → 말일) · `kstDayText(nowMs)`. `buildGrowRows(…, transactions?)` — 넘기지 않으면 `tradeCount = null`(허브 카드)
- `lib/asset/grow-links.ts`(신규, 순수): `keepLabelKeys(labels)` · `buildDividendLink(input, keepKeys)` → `none|loading|shown{pct,text}`(분모 = `byLabelKey` 합 = 배당 카드) · `isBoughtThisYear(purchaseDate, today)`(1월 2일 이후 ~ 오늘, 1/1 기본값 제외) · `buildSettleLink(stocks, rates, keepKeys, {refs,status}, nowMs)` → `shown{kind: up|down|mixed, pct, excluded}`(보유 건 단위, 비상장·상장폐지 제외, 기준가 null 종목은 빼고 수만 셈, 원 단위 반올림 뒤 판정). `performance-hub.tsx` `useDividendAnnualTotals()` 반환에 `byLabelKey: Map<normalizeTicker, 반올림 전 금액>` 추가(기존 필드 무변경)
- **#245 v5.130(11/19) — 내 종목 화면이 내 결정을 안다(읽기 전용, 새 판정 0)**
  - `lib/asset/grow-decision.ts`(신규, 순수): `decisionRowsOf(rows)` → `Map<labelKey, BoardRow>`(장기 보유·점검 대상 행만 — 미정·티커 없음·상장폐지·수량 0은 없음) · `decisionKindOf(row)`(`keep|check|due`, 차례면 due 하나만)·`DECISION_TEXT` · `dueEntryText(row)`(`점검 차례 · {dueReasonText}`) · `headDecisionOf(row, labels, nowMs)` → `{kind, label, since(set|checked|today|none), plan({prefix, value, both})}`·`headDecisionText` · `dueTipOf(boards)` → `{count, unit, reason}`(차례 수 ≥ 1일 때만, 수·단위 = `growStatus`) · `growTileValueOf(rows)` → `{kind, due, keep, check, count, parts}`(주식 행 기준 `boardStatus`, 행 0이면 null)
  - `grow-board.ts`: `pctText(v)` export(불리기 블록의 지역 함수를 옮김 — 상세·주식·종목 한 장이 같은 글자)
  - `use-stock-labels.ts`: `useStockLabelsRead()` → `{labels, ready}`(읽기 전용 — 상세·주식·종목 한 장·홈 팁. 쓰기·GA 결선 없음, `notifyAssetUserEdit`를 끌어오지 않는다). `useStockLabels`와 같은 내부 상태 훅을 쓴다
  - `views/activity/report-tab.ts`: 1회용 `growOpenKey` — `aimGrowStockView(labelKey?)`(기본 칸 + 주식 보기 + 대상 키, 키 없으면 목록만)·`peekGrowOpenKey()`·`clearGrowOpenKey()`. `resetReportTab()`이 대상도 비운다(허브·홈 팁). 해시·저장소 0
  - `navigation-context.tsx`: 모듈 플래그 `reportEnteredFromDetail`(`isReportEnteredFromDetail()`), 순수 함수 `reportEntryFromDetail(prev, next, current)`·`reportBackAction(fromDetail, historyLength)`(`pop|hub`), `getBackLabel(view, stockPageOrigin, reportFromDetail)` 셋째 인자(성과 › 성적표에서 `뒤로`)
  - `home-tip.ts`: `HomeTip` 종류 `due`(`{count, unit, reason}`), 입력 `due?`(호출부가 `dueTipOf`로 만들어 넘김 — 이 파일은 점검 칸 모듈을 불러오지 않는다). 순위: 백업 > 임박 세금 > 결산 > **점검 차례** > 새 소식 > 끊긴 거래 > 그 외 세금 > 최신화 > 알림 > 기능
  - GA 홈 팁 종류별(5.148 #290, `ga.ts`·`home-tip-box.tsx`): category `tip_view_<kind>` 9종(보임)·`tip_click_<kind>` 7종(누름, 점검 차례·알림은 기존 `home_tip_due`·`홈 팁·알림·누름` 재사용) → title `홈 팁 보임·<종류>`·`홈 팁 누름·<종류>`. 기존 `홈 팁` 전송은 그대로, 새 저장 키·파라미터 0
  - GA(`ga.ts`): `home_tip_due`·`stock_decision`·`stock_check_tile`·`stock_decision_view`(모두 category만, 호출부 `!isPreviewEnv()` 가드)
- `use-stock-labels.ts`: `useStockLabels()` → `{labels, ready, setLabel, markChecked, setCycle}`(마운트·`assetData` 변경 때 다시 읽음). 저장 조립 `stockLabelActions({notify, track, now})`는 훅 밖 순수 함수 — 저장소의 지금 값에 편집을 얹어 쓰고, 저장 직후 `notifyAssetUserEdit()`, GA `grow_label`(유효 이름표 0→1)·`grow_check`
- **6차(11/18)** `grow-board.ts`: `boardStatus(rows)` → `{kind: due|labeled|first|empty, due, keep, check, count}`(허브 둘째 줄·세그먼트 공용) · 행 `since.today`(기준일이 오늘 → `오늘 정함`·`오늘 점검함`) · 묶음 라벨 `장기 보유·점검 대상·정하지 않음`. `hooks/use-latest-asset-grade.ts`(신규, dashboard에서 추출): 일별 스냅샷의 최신 기록 등급(허브·홈). `views/activity/report-tab.ts`: 세그먼트 칸 세션 기억 `getReportTab`·`setReportTab`·`resetReportTab`(허브 진입).
- **재설계 5차 5b(11/18)** `stock-labels.ts`: 최상위 `reviews?: StockLabelReview[]`(`{t, at, from, choice, price, rate}`, `reviewKey` = `t@at`, `normalizeReviews` 정렬·중복·티커당 `STOCK_REVIEW_LIMIT`=12, 빈 목록은 키 생략) · 항목 `plan?: StockLabelPlan`(`parsePlan`·`cleanStockPlan`·`cleanPlanMemo` 제어문자 제거·`STOCK_PLAN_MEMO_MAX`=40, `STOCK_PLAN_RANGE` down 1~90·up 1~500, label check만) · `setStockPlan(state, t, plan, now)` · `recordReview(state, t, choice, now, snap|null, base?)`(쓰기 1회) · `lastSameReview`·`reviewsOf` · `markStockChecked` 오래 둘 허용 · `hasStockLabelRecords`에 reviews 포함 · `applyIncomingStockLabels(merge=false)` 수신에 reviews 키가 없으면 로컬 기록 유지. `grow-board.ts`: 행 `nowPrice`·`since{kind: labeled|checked, pct}`·`due`·`dueReason{down|up|date}`·`nextCheckMs`·`checkedToday`·`dropNote`(90일) · `cycleBaseOf(item, lastSameAt)` · `checkMonthsOf`(오래 둘 `KEEP_RECHECK_MONTHS`=12) · `dueReasonText` · `addMonthsKst`·`monthDayText` · `boardSummary(rows)` → `{first, keep{count, rate, low}, check{count, due}}` · `countDueRows`(허브 카드) · `BOARD_BUCKETS`·`bucketOf` · `boardRowRank(rows)`(점검 차례 → 오래 가진 순, 오래 둘 차례 안 산 날보다 낮은 행 먼저). `nextChecks`·`labelFact` 삭제. 훅 `useStockLabels()` → `{labels, ready, setLabel, record, setPlan, setCycle}`(GA `grow_label` 0→1·`grow_check` 기록 생성·`grow_plan` 조건 0→1). `demo-live-rebase.rebaseDemoLabelPrices`가 시드 `t@at` 기록 가격도 옮긴다.
- `report/asset-grade.ts`: `GRADE_THRESHOLDS` export(축 문장·`TIER_SUMMARY`가 숫자를 여기서 조립)
- **#242(5.127) 주식 외 자산·`내 선택`**
  - `stock-labels.ts`: `labelKeyKind(key)` → `stock | crypto | real | physical | reserved`(소문자 접두로 판정, 종류 판정은 이 함수 1곳) · `cryptoLabelKey(symbol)`(`c:`+대문자, 정규식 미통과 = null) · `realLabelKey(id)` · `physicalLabelKey(id)` · 기록 `hit?: StockReviewHit`(`STOCK_REVIEW_HITS`, 5종 밖이면 필드만 버림) · `recordReview(..., base?, hit?)` · `countValidLabels`·`isStockLabelRevisit`·`countStockPlans` = **주식 키만** · `countValidOtherLabels`(코인·부동산·실물, 예약 접두 제외). 저장 키·`v:1` 그대로, 마이그레이션 없음
  - `grow-board.ts`: 행 `kind: stock|crypto|real|physical`·`rep: Stock | null`·`own?`(부동산·실물 값 구획용) · `labelFactsOf(labels, key, rate, nowPrice, nowMs, pctPlan?)`(묶음·차례·정한 날 대비 — 전 종류 공용 판정) · `hitOf(dueReason)` · `holdingOf`·`holdTextOf` export. `boardStatus`는 주식 행만의 상태(화면은 `growStatus` 사용)
  - `lib/asset/grow-kinds.ts`(신규, 순수): `GROW_VIEWS`(주식 → 코인 → 부동산·실물) · `buildCryptoRows(crypto, labels, nowMs, cryptoTx)`(심볼 묶음, 평가액 0 제외) · `cryptoTotal(crypto, rows)`(= summary.cryptoProfit·cryptoCost와 같은 식) · `buildCryptoLabelBase` · `buildOwnRows(realEstate, physicalAssets, labels, nowMs)`(부동산 위·실물 아래, 매입가 0 = rate null) · `ownSnap(row)` · `buildGrowBoards(assetData, rates, labels, nowMs)` → `{stock, crypto, own}`(허브·세그먼트·블록 공용) · `heldViews`·`viewHasDue`·`firstGrowView` · `growStatus(boards)` → `{kind, due, keep, check, count, unit: 종목|개}`
  - `lib/asset/grow-pick.ts`(신규, 순수): `computePick(labels, "stock"|"crypto", input, nowMs)` → `{state: count|buy|wait, n, up, rows: {set, same, move}, hit, buys, late, records, waitReason, events}` — 결론 줄·패널·이력 줄 값의 단일 계산. `stockPickInput(stocks, tx)`·`cryptoPickInput(crypto, cryptoTx)` · `pickHeadline(r)`·`pickUpText(tally, unit, always)`(굵게 그릴 조각 `b` 표시) · `pickAfterOf(r, key, at)`(이력 줄 `now|next` %) · `PICK_ROWS`(고정 순서, `move`의 표시 낱말만 `바꾸기`) · `PICK_MIN_DAYS` 30 · `PICK_MIN_COUNT` 3. 화면 밖 전송 0
  - `use-stock-labels.ts`: `record(key, choice, snap, base?, hit?)`. GA 분리 — `grow_label`·`grow_check`·`grow_plan`은 주식 키만, `grow_other_label`은 이 기기 저장으로 주식 외 유효 이름표 0→1
  - `views/activity/report-tab.ts`: `getGrowView`·`setGrowView`(종류 줄 선택 세션 메모리, `resetReportTab`이 함께 비움)
  - `preview/demo-live-rebase.ts`: `priceByAnyLabelKey(stocks, crypto)`(주식 + `c:` 키 시세 — 코인 정한 날 가격 재기준) · `rebaseDemoAveragePrices`는 코인에도 쓴다(id·평단·시세·수량만 본다) · `withCryptoAveragePrices(data, avg)` · `rebaseDemoRows(rows, ref, ks, kc, costShift?, cryptoCostShift?)`(코인 원가 칸). 코인 거래 단가는 옮기지 않는다(결산에 번짐)
  - 테스트: `__tests__/stock-labels-5125-compat.test.ts`(5.125 원문 사본 `fixtures/stock-labels-5125.ts` + 복원 7행) · `grow-pick.test.ts` · `views/activity/__tests__/grow-expand-block.test.tsx`
- 테스트: `__tests__/stock-labels-merge.test.ts` · `stock-labels-storage.test.ts` · `stock-labels-sync.test.ts` · `trial-boot.test.ts` · `hooks/__tests__/use-stock-labels.test.ts` · `report/__tests__/asset-grade-copy.test.ts`

### asset/cash-tx-tags.ts · hooks/use-cash-tx-tags.ts · finance/received-dividend.ts (#5.166, 이슈 #329) — 현금 거래 분류 표시(받은 배당 기록)

- **저장 키** `STORAGE_KEYS.cashTxTags` = `secretasset.cash_tx_tags`(점 구분 — `clearAssetData`에 안 걸림, 롤백해도 남음). 값 `{ v:1, [현금 거래 id]: { kind:"dividend", ticker?, stockName? } }`. **금액·날짜·수량 금지**(정본은 현금 거래 레코드). 전역 `localStorage`만, 모듈 캐시 0(체험 격리). 마이그레이션 없음(키 없음 = 빈 맵)
- `cash-tx-tags.ts`: `parseCashTxTags`(관대 — 항목 단위 건너뛰기, id는 `ctx_` 접두만, 모르는 필드·모르는 kind 보존) · `readCashTxTagsState()` → `none | ok | corrupt`(모르는 `v` = corrupt) · `joinCashTxTags(tags, live)` · `readDividendTags(live)`(화면용, 조인 뒤 배당 표시만) · `readCashTxTagsForExport(live)`(조인 뒤 값, 없으면 undefined) · `mergeCashTxTags`(id 합집합, 같은 id가 다르면 직렬화가 무거운 쪽) · `putDividendTag(txId, stock?)`(실패 시 throw, 금액·날짜 인자 없음) · `removeCashTxTags(ids)`(손상 원문은 쓰기 0) · `clearCashTxTags()` · `applyIncomingCashTxTags(field, {merge, live})` → `{repush}`
- **규칙**: payload 최상위 `cashTxTags`(`buildExportPayload`, push·백업 공용). 수신은 `applyImportedPayload`가 `saveAssetData` **뒤에** 호출. 필드 없음 = 로컬 유지(pull이고 살아 있는 로컬 표시가 있으면 `cashTxTagsRepush` → `pullAsset`의 `mergedAdditions`에 OR). 못 읽는 수신(`v:2`)·손상 로컬은 덮지 않는다. 재-push 비교는 조인 뒤 값(고아 차이로 반복 0)
- **지우는 곳 전수**: 항목 제거 = `deleteCashTransaction`·`deleteCashTransactionWithBalance`·`deleteCash`(저장 성공 뒤) / 키 clear = `settings-page`(모든 데이터 삭제)·`preview-gate`(`?demo=empty`)·`applySharedData`(공유 링크 반영)·`demo-inject`(주입 전). pull·백업 복원·3년 정리·원격 삭제에서는 **지우지 않고 조인으로 무시**(덮임 되돌리기 #84 뒤 표시 복귀)
- **저장 순서**(`asset-data-context.saveTaggedCashTx`): 표시 먼저 → `saveData`. 표시 쓰기 실패 = 저장 중단(false), 거래 저장 실패 = 표시 회수. `addCashTransaction(tx, tag?)`·`addCashTransactionWithBalance(tx, cashId, patch, tag?)`의 `tag: CashTxDividendInput = { stock?: { ticker?, name? } }`
- `use-cash-tx-tags.ts`: `useDividendTags()` → `Record<거래 id, DividendTag>`(읽기 전용, 마운트·`assetData` 변경 때 다시 읽음). 쓰기는 컨텍스트 저장 함수만
- `received-dividend.ts`: `sumReceivedDividend(cashTransactions, tagged, year, mul)` → `{ months[12], annual, count }`. 입금만·반영+기록만 모두·입금일의 연·월·외화는 지금 환율(`getMultiplier`). **달별 원 단위 반올림 후 합 = 연 합계**(C150). 세전 계산값(`dividend-calc`)과 섞지 않는다
- `asset-dispatch.dispatchAddCashTx(cashId?, { dividend? })`: `dividend: true`면 입금 폼이 입금·배당 체크로 열린다(UI 상태, 저장 0)
- GA `feature_use` category `cash_dividend`(title `현금·배당 입금 기록`) — 배당 입금 저장 1회, 금액·종목·계좌 미전송
- 테스트: `__tests__/data-safety-5166.test.ts`(T1~T11 + 합계) · 구버전 재현 `__tests__/fixtures/frozen-schema-5160/`(main 9c13292 스키마 사본 + `frozenDevice`, 살아 있는 스키마 import 0)

### report/composition.ts (#4.43 #72 · #4.51 #83) — 월 탭 자산 구성 변화·외화 노출 순수 함수

- `COMPOSITION_KEYS/LABELS`, `COMPOSITION_FORBIDDEN_WORDS`(문구 금지어 테스트, 4.45 재사용). 연 탭 `CompositionCard`·보정 스케일은 #4.44에서 제거됨.
- `computeMonthComposition(w, liveBreakdown?)`(#4.51) → `{startLabel, endLabel("지금"=이번 달), sentence, items[{key,label,startRatio,endRatio,startPct,endPct,delta,startText,endText,deltaText}]}` 또는 null(첫 달·breakdown 없음·합 0·두 시점 모두 자산군 1개). 비교 구간은 `resolveSettlementWindow`의 w 그대로(시작 `w.start.breakdown`, 끝 `w.end.breakdown`, 이번 달은 `buildLiveAttributionCurr().breakdown`을 호출부가 전달 — 블록 전용 합산 금지). 키 4개(부동산·주식·암호화폐·현금성, 부채 제외), 증감 = round(끝)−round(시작), `formatDeltaPp`(U+2212). 실물 키는 4.49.
- `buildFxExposureLines(fxExposures, totalValue)` → `{ratioLine, impactLine|null, caption}` 또는 null. `computeFxExposure` 결과를 재사용(재계산 없음), X = Σ`exposureKrw`×0.01.

### report/monthly-log.ts (#4.67 #127) — 월별 기록 줄 조립 순수 함수

- `buildMonthlyLog(monthly, today, { breakdown?, netAsset })` → `{ rows(최신순), columns, recordedCount, firstMonth, currentMonth, hasNetOnly, atLimit }`. 월 범위는 `listSettlementMonths`(현재월 포함 13개월, 저장된 달·이번 달만 기록) 그대로 — 첫 기록 달 앞은 줄 없음, 사이 빈 달은 `{kind:"gap"}`. 지난 달 = 스냅샷 `breakdown`·`netAsset`(= `settlementDelta`의 `w.end.netAsset`, 같은 달 중복 시 첫 항목), 이번 달 = 호출부가 넘긴 `buildLiveAttributionCurr().breakdown`·`summary.netAsset`(저장된 이번 달 스냅샷 무시). 줄 단위 합 검증 `|부동산+실물+주식+코인+현금−대출−임차보증금−순자산| > 1원` 또는 breakdown 없음 → `{kind:"net-only"}`(순자산만). `columns` = full 줄 중 반올림 값이 0이 아닌 키만(`MONTHLY_LOG_KEYS` 순서: 자산 5종 → 대출·임차보증금). `recordLabel` = `오늘` / `formatSettlementPoint(date)` / 레거시 `YYYY-MM 기록`. 새 금액 계산·환산·보간·저장 0.
- `buildMonthlyLogChanges(rows)` (R3) → `Map<월, { vsMonth, skipped, net, groups }>` — 바로 앞 기록 달(gap 건너뜀, `skipped` = 월 차 >1) 대비 순자산 변화. `groups` = 두 줄 모두 full일 때만 자산군 **순자산 기여** 변화(부채 −|v|, 대출 증가 = 음수); 아니면 null. 순자산·자산군 모두 **표시값(원 반올림)끼리의 차**(R3 보정 — 화면 숫자로 빼 본 값 = 표시 변화). 소수 원화값 달은 자산군 변화 합 ≠ `net`(반올림 잔차 수 원). `net` = 결산 Hero 증감(`settlementDelta`도 `round(끝) − round(시작)`, COO R3 F1). 첫 기록 달·gap 줄은 키 없음.
- `formatMonthlyLogDelta(v)` (R3) — 원 단위 반올림, 0 → `0원`, `+1,234원` / `−1,234원`(U+2212).
- `formatMonthlyLogAmount(v, "short"|"full", debt?)` — short = 1억 미만 `formatShortCurrency`·1억 이상 억 단위 소수 둘째 자리 버림·끝 0 제거(`6.44억`, COO U1 — 정수 연산 `floor(|v|/100만)/100`, 공용 `formatShortCurrencyDecimal`은 부동소수 오차로 2.3억→2.29억이라 미사용, COO U2)에서 `만원`/`억원` 끝 `원` 생략(1만원 미만·0은 `원` 유지), full = `formatCurrency`. 부채는 −절댓값, 음수 부호 U+2212, |v|<0.5는 `0원`.
- `useDayHero(enabled)`·`resolveDayHero(view, yesterday, endNet)`·`dayYesterday`·`prevDailyRecord`·`DAY_EMPTY_MESSAGE` (`activity/use-day-hero.ts`, 4.95) — 자산 변화 일 탭 Hero·원인(=홈 Hero 계산, sinceDate 어제)과 달력 직전 기록 탐색. 저장 호출 0.
- 자동: `report/__tests__/monthly-log.test.ts`(S9 실사용 픽스처·Hero 끝값 일치·13개월·연 경계), `views/activity/__tests__/monthly-log.test.tsx`(인라인 카드 조건·줄·패널·더 보기). `formatMonthlyLogAmount` short 경로는 R3 이후 화면 미사용(테스트만).

### computePeriodAttribution — 하이브리드 실측/예측 합성 (2026-08, 1주·1개월·3개월·올해 공통 알고리즘)

기간별 특수 처리를 두지 않는다. **네 기간 모두 같은 코드 경로**를 타고, 기간마다 다른 것은 시작일(`targetStr`) 계산뿐이다. 규칙: **실측 스냅샷이 있는 구간은 실측으로 분해하고, 그 이전의 부족한 구간만 예측으로 채운다.**

```
1. targetStr 계산                     ← 기간별로 다른 유일한 부분
2. prevOld = targetStr 이하 최신 포인트, 없으면 가장 오래된 포인트로 폴백
   (computeAttributionSince의 `?? candidates[0]` 패턴과 동일 원칙 — "기록 없음" 대신 가진 만큼 보여준다)
3. prevOld가 이미 isFullyEnriched()면 mid를 찾지 않는다(전체 실측, 쪼갤 이유 없음) — **필수 가드**
4. prevOld가 예측(레거시)일 때만 mid = (prevOld, curr) 구간에서 isFullyEnriched()를 만족하는 가장 오래된 daily
5. mid 없음 → 단일 구간(resolveAttribution 1회, 종전과 완전히 동일)
6. mid 있음 → (prevOld,mid] 예측 + (mid,curr] 실측을 각각 계산해 mergeAttributions로 합성
```
- `isFullyEnriched(p)` = `!!(p.breakdown && p.fx && p.fxBase && p.cost)` — `resolveAttribution`의 `bothEnriched` 판정과 **같은 술어**를 공유해야 실측/예측 경계가 어긋나지 않는다.
- **3번 가드 누락 시 회귀(2026-08 확인)**: `prevOld`가 이미 실측인데도(예: 1주는 daily 30일 창 안이라 거의 항상 실측) `mid`를 무조건 찾으면, 사이에 있는 아무 enriched daily나 붙잡아 불필요하게 두 구간으로 쪼갠다. 이때 `mergeAttributions`가 `older.estimated`를 확인하지 않고 무조건 `estimatedUntil`을 채우면(과거엔 그랬음), 전부 실측인데 "그 날짜 이전은 추정치" 배지가 근거 없이 붙는다. `mergeAttributions`는 방어적으로 **`older.estimated`가 실제 `true`일 때만** `estimatedUntil`을 채우도록 되어 있지만, 3번 가드가 없으면 애초에 실측끼리도 쪼개져 불필요한 연산과 혼란을 만든다 — 두 방어 모두 유지해야 한다.
- `mid`는 **daily만** 허용(monthly 제외) — monthly의 `_date`는 월말로 강제되는데 값 시점은 그 달 마지막 접속일이라 최대 30일 어긋나고, 그 사이 거래·입출금이 flow 윈도우에서 누락된다.
- `yearlyAnchorPoints(assetData)` — `assetData.yearlyNetAssets`(연도별 종가 순자산, netAsset만)를 `YYYY-12-31` 앵커로 승격해 후보 풀에 추가. enrich가 없어 항상 예측 경로로만 쓰이지만, daily(30일 롤링)·monthly(최근 13개월, #4.34 전엔 올해분만)가 못 미치는 먼 과거에서도 "기록 없음" 대신 예측 시작점을 잡을 수 있게 한다.
- `mergeAttributions(older, newer, mid)` — `older.effects`를 `reallocatePriceEffects(effects, mid)`로 먼저 안분(통합 `price`→`price:stock`/`price:crypto`, 부동산 제외)한 뒤 `newer.effects`와 key별로 합산, `pickTopCauses`를 **1회만** 다시 돌려 표시용 top/rest를 재선정한다. `deltaNet`·집계 필드는 단순 합(텔레스코핑) — 합계=deltaNet 항등식은 자동 유지.
- `estimated: boolean` → 전체 구간이 예측일 때만 `true`(하위호환). 부분예측은 **`estimatedUntil?: string`**(이 날짜 **이전**만 예측)으로 표현 — `estimated===false`이면서 `estimatedUntil`이 있으면 "일부 예측" 배지.
- `PeriodAttribution.effects`는 `pickTopCauses`가 버리지 않고 반환하는 key별 raw 벡터 — 하이브리드 합성의 전제(합산 후 재선정 가능하게 하는 유일한 이유).
- `computeAttributionSince`(홈 헤더, "지난 접속 이후")는 **하이브리드 대상이 아니다** — 기존 `?? candidates[0]` 폴백만 유지, 단일 `resolveAttribution` 호출 그대로.
- 뷰는 잔차를 직접 계산하지 말 것. `getAttributionItems` 하나만 거쳐야 두 화면의 임계값·합계가 갈리지 않는다.
- **`cashRoundTrip`(2026-08 신설)** — `resolveAttribution`은 두 끝점만 비교하므로, 기간 중 현금이 크게 올랐다가 순변화 없이 되돌아오면(왕복) `cash` 원인 자체가 사라진다("1주엔 보이는데 1개월엔 왜 안 보이냐" 혼란의 원인). `detectCashRoundTrip`이 실측 daily 구간에서 baseline 대비 최대 이탈폭을 찾아 `{peakAmount, peakDate}`로 `PeriodAttribution.cashRoundTrip`에 붙인다(순변화가 최고 이탈폭의 절반 이상이면 "왕복"으로 보기 어려워 생략). `cash`만 대상 — 시세는 상시 변동이 정상이라 일반화하면 노이즈. `computePeriodAttribution`(성적표 기간 선택기)에만 적용, `computeAttributionSince`(홈)는 범위 밖.


### pwa/app-lock.ts — 앱 잠금(PIN) 상태 **단일 소스**

```typescript
PWA_UNLOCKED_EVENT                       // "secretasset:pwa-unlocked"
isPwaAuthEnabled(): boolean
isPwaLocked(): boolean                   // 인증 활성 + 세션 미인증. standalone 무관 — 잠금화면 판정과 동일해야 한다
markPwaAuthenticated(): void             // 세션 인증 기록 (이 시점부터 백그라운드 가드 해제)
emitPwaUnlocked(): void                  // 해제 알림 → CloudSyncProvider가 pull
setPwaAuthPin(pin) / disablePwaAuth() / verifyPwaAuthPin(pin)
```
UI(`pwa-lock-screen.tsx`)가 아니라 순수 모듈에 두는 이유: 잠금화면이 `useAssetData`를 쓰므로 `asset-data-context`·`cloud-sync-provider`가 import하면 **순환 참조**가 된다.
**해제 순서 = `markPwaAuthenticated()` → `try { await unlockAndLoad() } finally { emitPwaUnlocked() }`.** 기록을 먼저 하지 않으면 `unlockAndLoad`가 자기 가드에 막히고, 뒤 둘을 병렬로 두면 원격 pull과 로컬 시세·스냅샷 저장이 서로를 덮어쓴다. `finally`가 없으면 `unlockAndLoad`가 throw할 때 해제 알림이 유실된다.
**`setPwaAuthPin`은 반드시 `markPwaAuthenticated()`를 함께 호출한다** — 방금 잠금을 설정한 세션은 정의상 인증된 세션이다. 빠뜨리면 설정 직후 `isPwaLocked()`가 true로 굳는데 잠금화면은 마운트 시에만 판정해 뜨지 않고, 그 세션의 push·pull·시세·스냅샷이 전부 무증상 정지한다(과거 회귀).

### pwa/in-app-browser-gate.tsx 순수 함수 (#4.38) — 인앱 게이트 판정
```typescript
resolveInAppGate(env) → "none" | "cover" | "welcome" | "gate"
  // !mounted ‖ standalone ‖ !isInApp → none / !isDataLoaded → (hasAssetsAttr ‖ syncAssetId ‖ restoreHash ? cover(빈 덮개) : welcome)  — hasAssetsAttr = html[data-has-assets](#4.61)
  // 자산 0건 && !isSharePending && !syncAssetId && !restoreHash → welcome(게이트 미렌더, 웰컴 inapp 슬롯이 안내) / 그 외 gate(현행)
hasRestoreHash(hash): boolean   // share·sync·asset·vault 해시 — 처리 후 replaceState로 지워지므로 게이트는 첫 렌더에 1회 캡처(useState 초기화)
```

### hooks/use-external-move.ts (#4.38) — 인앱 → 외부 브라우저 이동 **단일 구현**
```typescript
useExternalMove(isIOS) → { go(urlOrPromise), iosFallback }   // 게이트·웰컴 inapp 슬롯 공용
moveExternal({ isIOS, url, copy, openExternal, onTrack })    // 순수 판정: iOS 복사 → "ios-fallback" / 그 외 openExternalBrowser → "opened", GA pwa_install inapp_move 호출당 1회
copyUrlForIOS(urlOrPromise)                                  // 제스처 보존 ClipboardItem(Promise) → 실패 시 writeText
```
- 인앱 감지 `IN_APP_BROWSER_RE`(detect-browser.ts)에 #4.38 `barcelona`(Threads)·`daumapps`(다음)·`band\/`(밴드) 추가. 오탐은 `isBackgroundWorkBlocked`로 시세 갱신까지 멈추므로 토큰 추가 시 음성 UA 고정 테스트(`detect-browser-inapp.test.ts`) 필수

### asset/screenshot-stock-map.ts (#4.39) — 주식 스크린샷 응답 → 등록용 매핑 **단일 구현**
```typescript
mapParsedStocks(raw: ParsedStock[], { activeTab }) → { stocks, defaultCategory, defaultBroker, isMixed }  // 공통 일괄 변환은 하지 않음
applyCommonDefaults(stocks, defaultCategory, defaultBroker, usdRate)  // 공통 모드 일괄 적용(카테고리 변환+증권사)
convertStockCategory(stock, category, usdRate)  // foreign↔domestic 가격/통화 환산
isMixedSections(raw)  // 국내(또는 기타)와 해외 section 공존
```
- `StockScreenshotImport` 업로드 경로와 인계 경로(`initialParsed`)가 공용. **혼합(`isMixed`)이거나 인계면 개별 모드로 시작**, 단일 section 업로드만 공통 모드(#64)

### ratio-preview/ (#4.39 #63) — 비중 미리보기 순수 로직
- `ratio-list.ts`: `buildRatioList(raw, {USD, JPY(100엔당)}) → RatioResult`(비중 %·종목 수만, 금액 필드 없음), `largestRemainderTenths`(0.1% 단위 합 1000 보정), `stockValueKrw`. 종목 수는 인식 전체, 비중은 가격 있는 종목 기준
- `ratio-sample.ts`(#4.40 #66): `RATIO_SAMPLE_STOCKS`(가상 6종목, 티커 없음, 비중 28/22/16/14/12/8 · 국내 58/해외 42)·`RATIO_SAMPLE_RATES`(고정 환율). `/ratio` 예시 모드 전용. `ga.ts` `PARAM_VALUES.method`에 `sample`(라벨 "예시 보기")
- `handoff.ts`: `setHandoff/peekHandoff/takeHandoff`(모듈 메모리, 10분 타이머로 참조 삭제, 1회 소비), `canOpenHandoff(gate)`(isDataLoaded·!잠금·!공유대기·!마법사·!체험; 튜토리얼 activeStep은 조건 아님)
- `analytics/utm-allow.ts` `allowedUtmQuery(pathname, search)`: `/ratio`에서만 utm_source|medium|campaign(`[A-Za-z0-9._-]{1,50}`)을 `ga.ts pageLocation()`에 부착
- 서버 `api-guard.ts`: `reserveGeminiCalls(request, n, msg, pool?)` + `RATIO_POOL`(입구 전역 60·IP 5/일)·`isRatioEntry(request, entry)`·`STOCK_TOTAL_POOL`(5.164 화면 합계 전용 호출, 일 60, `GeminiPool.name` = `"ratio" | "stock-total"`). 순서 IP일반→입구IP→입구전역→전역, 실패 시 앞 단계 전부 −n
- `config/app.ts` `OG_IMAGE`(루트 layout·/ratio 공용), `security-copy.ts` `RATIO_PREVIEW_UPLOAD_NOTICE`(저장 전용 고지, `SCREENSHOT_UPLOAD_NOTICE`와 병치 금지), `useExternalMove(isIOS, onTrack?)`(미전달 시 기존 pwa_install 계측)

### config/security-copy.ts (#4.38) — 보안 안내 문구 **단일 출처**
- `SECURITY_COPY`(카드 3 `{ id: local|sync|admin, title, desc }`, 웰컴 보안 상세·앱가이드 공용), `APP_GUIDE_SECURITY_DESC`, `SYNC_MENU_SECURITY_DESC`(동기화 메뉴 설명 마지막 문장), `SCREENSHOT_UPLOAD_NOTICE`(업로드 박스 4종). 텍스트만(React·아이콘 import 없음)
- **동기화 암호화 설명 5문장은 `DEVICE_ENCRYPTION_COPY` 한 블록**(대표 지시로 실제 방식 기준 명칭 확정: "기기에서 암호화하는 동기화", 본문은 "기기에서 암호화…(종단간 암호화)"). 바꿀 때 블록만 교체. 옛 표현 재유입은 테스트가 `src/` 전체에서 막는다. "관리자도 알 수 없어요"는 동기화 자산 한정. "저장·전송"은 `\u2060` 묶음
- 근거 1줄: 자산 암호화는 AES-256-GCM 1겹(기기 종단) + 전송 구간 HTTPS = "기기 종단 암호화 + 전송 구간 암호화". 새 안내 문구에 "서버"를 주어로 한 역할 나열 금지

### 온보딩 마법사 시작 단계 (#5.131 #249)
- `onboarding-wizard-store.ts` `open(start?: WizardCategory)` → `startCategory`(메모리만, `close()`에서 null). `onboarding-wizard-status.ts` `resolveWizardStart(status, start)` = start가 pending이면 그 단계, 아니면 `getResumeCategory ?? "intro"`. `getNextCategory(status, from)` = 뒤쪽 pending 첫 단계(flow `goToNextCategory`가 사용). 저장 형식·`wizard_step` 전송 무변경

### trial/ — 체험 모드 (#4.38 #59, risk high)
- `trial-mode.ts`(정적·의존 0): `isTrialMode()`, `markTrialActive()`(게이트 전용, 되돌리는 경로 없음), `TRIAL_QUERY_KEY`·`TRIAL_ENTRY_URL`·`TRIAL_EXIT_KEY`(sessionStorage)·`TRIAL_BLOCKED_PATHS`(`/api/parse-screenshot`·`/api/share`·`/api/sync`·`/api/feedback` 및 하위)·`TRIAL_BLOCKED_MESSAGE`("체험 중에는 사용할 수 없어요")
- `trial-boot.ts`(**동적 import 전용**, 정적 import 0건 테스트):
  - `trialRejectReason(original, hash)` — 메모리 설치 **전** 원본을 `getItem`·`Object.keys`·`JSON.parse`로만(getAssetData 금지 — 구버전 마이그레이션 쓰기). 거부: 자산 데이터 손상·비객체·배열 아닌 값·1건 이상 / 구버전 `secretasset-asset-data` / `secretasset_sync` / `secretasset_pwa_auth*` / 복원 해시
  - `createMemoryStorage()` — 키를 own 열거 속성으로(`clearAssetData`의 `Object.keys(localStorage)` 정리 동작). GA `ga-optout`·`ga-debug`만 원본에서 복사
  - `bootTrial(deps)` → `"trial" | "rejected" | "failed"`: `window.localStorage` defineProperty + `window.fetch = createTrialFetch(...)`(복구 코드 없음) → 검증 5종(window·전역 식별자·probe 원본 미누출·열거·fetch) 통과 시에만 `markTrialActive` + 주입. 원본 쓰기는 probe 누출 시 removeItem 1건뿐
  - `isTrialBlockedRequest(input, base)`(같은 출처 + 거부 경로, 해석 실패=거부) · `trialBlockedResponse()`(합성 403 `{error}` — 호출처가 토스트로 띄움)
  - `runTrialBoot()` — 실제 주입은 `injectDemoPayload({ nickname: "" })`(Hero "순자산") + `skipDemoTutorial()`, 결과와 무관하게 `?trial` 제거
- 가드(1줄씩): `isCloudSyncEnabled() && !isTrialMode()`, `isBackgroundWorkBlocked() … || isTrialMode()`, `resolveInAppGate({ isTrial })` 맨 앞 none, ga.ts `track`·`trackScreen`·`trackThenNavigate` no-op, 루트 layout 인라인 GA `trial=1 → ga-disable-<ID>`
- sessionStorage는 격리하지 않음(알려진 한계)
- `trial-exit.ts`(#5.131 #249, 순수 + Storage 주입): `resolveTrialExit(viewKey)` → `{ asset: stock|crypto|cash|loan|real-estate|null, ga: {asset_type}|{source: activity|detail}|null }` — 허용 목록 `Map`(프로토타입 키 통과 0), 모르는 값·빈 값 = 없음(현행). `writeTrialExit(storage, viewKey)`(둘째 키 → `trial_exit` 순), `consumeTrialExit(storage)` → `{returned, from}`(`trial_exit=1`일 때만 둘째 값 읽고 두 키 삭제, 아니면 둘째 키만 삭제, 예외 = 복귀 아님). 상수 `TRIAL_EXIT_FROM_KEY = "trial_exit_from"`은 `trial-mode.ts`(STORAGE_KEYS 밖, 탭 한정 1회용 — 저장 키 변경 아님)

### preview/demo-inject.ts (#4.38) — 데모 주입 공용 절차(preview `?demo=1`·체험)
```typescript
injectDemoPayload({ nickname? })   // 데모 JSON 동적 import(이 파일만) → materializeDemo → applyImportedPayload(전역 localStorage 대상) + assetRefresh 메타. nickname 주면 주입본 사본만 교체
skipDemoTutorial({ marker? })      // 튜토리얼 전체 건너뛰기 + 공지 읽음(GA 없음) + initTutorial, marker는 preview 표식
stripQueryParams(keys)             // replaceState로 쿼리 키 제거(해시 유지)
```

### pwa/background-gate.ts — 자동 백그라운드 동작 차단 판정

```typescript
isBackgroundWorkBlocked(): boolean       // isInAppGateActive() || isPwaLocked() || isTrialMode()(#4.38)
```
전체화면 게이트(인앱 브라우저 게이트·앱 잠금)가 덮고 있는 동안 시세·환율·코인·스냅샷 저장·부동산 재조회·연결 모달 등 **사용자가 인지하지 못하는 부작용**을 막는다. 게이트가 2종이라 지점마다 따로 쓰면 한쪽을 빠뜨리므로 반드시 이 함수를 경유한다(R22).

### name-match.ts (`src/lib/name-match.ts`, #4.29) — 종목명 오타 허용 매칭

```typescript
normalizeStockName(name)                    // 괄호·공백·-·&… 제거, 끝 "." 제거, 소문자 — ticker-map(normalizeName 별칭)·거래 스크린샷 후보 매칭 공용
fuzzyThreshold(len)                         // 허용 편집거리: <6 → 0(퍼지 금지), <12 → 1, 이상 → 2
editDistance(a, b, max)                     // Levenshtein, max 초과 확정 시 max+1 조기 종료
findClosestNames(normalizedInput, keys)     // 허용 거리 이내 최소 거리 키 전부(동률 포함). exact는 호출부가 먼저 처리
```
- 서버 `lookupTicker`는 prefix(잘린 이름) **다음**에 국내 오타 보정을 두고 **유일 최근접만** 채택(`fuzzyLookupKr`), 동률이면 suffix·substring 추정까지 막는다 — 순서를 바꾸면 잘린 이름 83건이 다른 종목으로 바뀌는 회귀(전 ETF 점검 테스트 `ticker-lookup-kr-etf.test.ts`)
- 클라이언트(거래 스크린샷)는 티커 미인식일 때만 보유 종목명에 적용하고, 유사 일치 후보는 자동 선택하지 않는다

### preview/demo-payload.ts (`src/lib/preview/demo-payload.ts`, #4.34) — preview 데모 진입 순수 함수
- `resolvePreviewAction(isPreview, search, hasAssets, choiceDismissed?)` → `"none"|"demo"|"empty"|"choose"`. `isPreview` false면 항상 `"none"`(운영 무동작 보증)
- `materializeDemo(raw, today)` — 날짜 토큰(`@M<월오프셋>D<일>`·`@M<오프셋>`·`@D<일오프셋>`·`@NOW`)을 기준일(KST) 날짜로 변환. 이번 달 날짜는 오늘을 넘지 않게 보정
- `buildDemoRefreshMeta(now)` — 기존 `secretasset_asset_refresh` 형식(현금·대출 40일 전, 주식·코인 2일 전)
- 데모 원본 `src/lib/preview/demo-data.json`은 **동적 import 전용**(정적 import 금지, `preview-safety.test.ts`가 소스 검색으로 강제)
- preview 판별은 `cloud-sync/config.ts`의 `isPreviewEnv()` 단일 출처(`NEXT_PUBLIC_VERCEL_ENV === "preview"`). `isCloudSyncEnabled()`는 preview에서 false

### number-utils.ts

```typescript
formatNumberWithCommas(value): string   // "1,234,567"
parseNumberFromCommas(value): number
formatCurrency(value): string           // "₩1,234,567"
formatShortCurrency(value): string      // "2.3억원" · "9,999만원" (0.1억·만원 단위 버림)
formatShortCurrencyDecimal(value): string // "2.01억원" · "1.13백만원" · "2.9만원" (소수 둘째 자리 버림·끝 0 제거)
formatNarrowKRW(value, { signed?, tiny? }): string // 640 미만 칸·막대 한 줄 "5.67억"·"+0.88억"·"+877만"·"−6.6만" (원 생략·floor·끝 0 제거·U+2212. 억 소수는 글자 예산 tiny(<375) 3·그 외 4 안에서 최대 2, 만은 정수부 1자리일 때만 소수 1. 1천만 미만 증감은 4.95와 같은 문자열, 4.96. formatCalendarDiff·formatCompactKRW 대체)
// 두 함수 모두 원 단위 정수를 표시 최소 단위로 정수 나눗셈해 버린다(#129). 축약 버림 표기를 새로 만들 때 곱셈 뒤 Math.floor 금지 — 이 함수 재사용
calculateHoldingDays(purchaseDate): number
formatHoldingPeriod(purchaseDate): string  // "1년 3개월" 형식
```

### utils.ts

```typescript
cn(...inputs: ClassValue[]): string     // clsx + tailwind-merge
getInitials(str): string                // "홍길동" → "홍"
```

### analytics/ga.ts (`src/lib/analytics/ga.ts`, S-4.28 · 4.41 #68 단순화) — GA4 계측 **단일 진입점**

```typescript
track(name: GaEvent, params?: GaParams): void     // 이벤트 22종 union. 전송 = { page_title, page_location }만(맞춤 매개변수 전송 없음)
trackScreen(viewKey): void                        // 직전 화면이 있으면 직전 title·경로의 screen_leave(비예약 커스텀 이벤트)를 먼저(#131: 직전 화면 참여 시간 _et 귀속), 이어 page_view(/v/<viewKey>, page_title=SCREEN_TITLES). 같은 화면 연속 호출 무시
featureTitleOf(eventName, params, currentScreenKey): string | undefined  // 순수. 이벤트→사용 기능 이름. 매핑 없으면 현재 화면 title, 그것도 없으면 undefined(title 생략)
trackThemeMode(mode): void                        // #4.42 theme_mode("다크/라이트 모드 사용") 세션당 모드별 1회, 체험 0. 앱 시작=navigation-context, 전환=settings-page
trackAssetSave(params, prevAssetCount): void      // asset_save + 기기당 1회 first_asset_saved(gaFlags)
trackParse(importType, result): void              // screenshot_parse (거래 스크린샷은 주식·코인으로 집계)
countAssets(data) / toGaAssetType(kebab) / screenPath(viewKey)
```
- 호출부의 의미 인자(`PARAM_VALUES` enum: asset_type·method·category 등)는 **title 결정용 내부 인자**일 뿐 GA로 나가지 않는다. 신규 이벤트는 `GaEvent`에 추가하고 `featureTitleOf` 매핑(없으면 화면 title로 귀결)과 테스트 표를 함께 갱신.
- 기능 이름 목록: 화면(SCREEN_TITLES) + 웰컴·온보딩·자산 추가 시작·자산 저장·스크린샷 등록·거래 입력(각 `·자산종류` 접미)·인증카드 저장·공유·인증카드 열기·앱 가이드 열기·기기 동기화·백업·데이터 관리·앱 설치·월 결산·X-Ray·절세 시뮬레이션·홈 팁·의견 보내기·테마 변경·AI 프롬프트 복사·체험 모드.
- **인앱 웰컴 title 분리(5.122 #234, 맞춤 정의 0)**: `welcome_view` source=inapp → `웰컴·인앱`(web·pwa는 `웰컴`) / `pwa_install` installed → `앱 설치`(완료만), inapp_move → `인앱·외부 이동`, prompt_view·accepted·dismissed → `앱 설치·설치창` / `feature_use` demo+source=inapp → `체험 모드·인앱`(칩 — 5.123부터 인앱 둘러보기 진입점은 칩 1개, 보조 버튼·`체험 모드·인앱 버튼` 삭제). source 없는 demo는 `체험 모드`, 가이드 화면은 `가이드·체험` 그대로. 호출 인자는 `welcome-guide.tsx` `WELCOME_TRIAL_PARAMS`(chip·inAppChip), 진입 공통은 파일 로컬 `useTrialEntry`(연타 1회 + `trackThenNavigate`). 판독 경계: 머지 시각부터 `웰컴` 분모에서 인앱 제외, `앱 설치`는 완료만.
- **폐기(4.41)**: `PARAM_LABELS`·한국어 라벨 치환·`labelOf`·`sanitizeParams`·`setUserProps`/`GaUserProps`/사용자 속성·`assetCountBucket`·`nav_source` 전송. GA 맞춤 정의(이벤트 8·사용자 5)는 대표가 보관처리, 신규 판독은 "페이지 및 화면" 보고서 한 장.
- gtag 부재(로컬·preview·옵트아웃)·예외 시 no-op — 앱 흐름 영향 0. `window.gtag` 직접 호출 금지, 금액·종목·티커·닉네임·ID 전송 금지.
- `trackThenNavigate(name, params, url, navigate?)`(#4.38 #59) — 이벤트 후 이동. `event_callback` 또는 `NAVIGATE_TRACK_TIMEOUT_MS`(300) 중 먼저 오는 쪽에서 1회 `location.assign`. 체험 중·gtag 없음·예외는 즉시 이동. 체험 페이지에서는 `track`·`trackScreen` no-op
- 4.79 신규 추적: `feature_use{category:"change_week_all"}`(성과·자산 변화·최근 7일) — 전체 범위에서 `주`를 누를 때 `changePeriod`, 홈 팁 `week-causes` 진입 시 `AppFeature.entryCategory`(+`source:"home_tip"`, **source는 GA로 나가지 않아 page_title만 같다**). 복원·첫 진입 0건
- 4.41 신규 추적: `feature_use{category:"share_card"}`(인증카드 열기: 상단 버튼·홈 팁 dispatch), `{category:"app_guide"}`(앱 가이드 열기)
- 동기화 이벤트(`sync_action`)는 수동 동작 결과 확정 후 UI 쪽에서만 1줄 — 자동 push/pull·sync 로직에는 걸지 않는다.

### server/api-guard.ts (`src/server/api-guard.ts`, S-4.28) — 공개 API 공통 방어
- `guardL1Only(request, route, l1PerMinute)`(4.53): 출처·본문 검사 없이 L1만. sync(서명 인증 라우트)용

```typescript
guardRequest(req, { route, maxBodyBytes?, l1PerMinute? }): Response|null  // cross-site 403 · 411/413 · L1 429
guardRateLimit(req, route, limit, windowSec): Promise<Response|null>       // 5.113: L1 메모리 버킷(IP는 Redis 미저장, 창>1분 라우트는 분당 환산 최소 3회)
exceedsDailyGlobal(name, limit): Promise<boolean>   // IP 없는 일 전역 상한 rl:{name}:global:{KST 날짜}. 상수 SYNC_PUT_PER_VAULT_PER_MINUTE·SYNC_NEW_VAULT_DAILY_LIMIT·SHARE_POST_DAILY_LIMIT·GEMINI_GLOBAL_HOURLY_LIMIT
withinUpstreamBudget(upstream: "kis"|"molit"|"kakao"|"logo", weight?): Promise<boolean>
reserveGeminiCalls(req, n, msg): Promise<Response|null>                     // IP 일 30회 + 전역 원자 예약
getClientIp(req)        // x-vercel-forwarded-for → x-real-ip → XFF 우측
isCrossSiteRequest(req) / badRequest(msg) / cdnCacheHeaders(maxAge, swr?) / secondsUntilNextHour(now?)
isValidTicker(t) / parseTickerList(raw, max) / isOneOf(v, list) / cleanText(v, max)
```
- 신규 API 라우트는 반드시 `guardRequest`로 시작하고 `export const maxDuration`을 둔다. 라우트별 `getClientIp`·rate limit 복붙 금지.

### local-storage.ts (`src/lib/local-storage.ts`)

```typescript
STORAGE_KEYS = {
  assetData, dailySnapshots, monthlySnapshots,
  exchangeRate, exchangeSyncDate, collapsibleUsed,
  noticeHideUntil, geminiUsage,
  shareOwnerId, financeApiErrorCount,
  profitBasis,    // "secretasset_profit_basis" — 종가 기준 옵션
  tutorialStatus, // "secretasset_tutorial_status"
  gaFlags         // "secretasset_ga_flags" — GA 1회성 플래그({firstAssetSent}), clearAssetData keepKeys 보존(S-4.28)
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

### share-crypto.ts (#5.112)
`generateShareUrlKey()`(CSPRNG base62 22자(rejection sampling), localKey 생성은 이것만 사용 — Math.random 금지)·`encryptShare/decryptShare`(v73A). `generateShareToken/parseShareToken`은 async. PBKDF2 반복수는 `cloud-sync/crypto.ts` `PBKDF2_ITERATIONS` 재사용.

### asset-storage.ts

```typescript
hasAnyAssets(d): boolean   // #4.38 5배열(부동산·주식·코인·현금·대출) 1건 이상. page.tsx·use-share-artifacts·preview-gate 공용(배열 존재 전제 — 원본 JSON은 정규화 후). top-bar·bottom-nav·asset-data-context의 같은 식은 미교체(후보)
getAssetData(): AssetData
saveAssetData(data): boolean
exportAssetData(currentData?): boolean   // currentData 전달 시 저장소와 어긋나면 중단하고 false
isExportDataStale(currentData): boolean  // 화면 state ↔ localStorage 항목 **건수** 비교 (파생필드 제외)
importAssetData(file): Promise<{ assetData, snapshotRestored }>
clearAssetData(): boolean
saveAssetDataRaw(data): boolean         // superRefine 우회 (스크린샷 경로)
buildExportPayload(): Record<string, unknown>   // 내보내기·동기화 공용 (assetData+스냅샷+옵션+닉네임)
applyImportedPayload(parsed, { keepLocalSnapshots?, syncedIds? })
  // → { assetData, snapshotRestored, mergedAdditions, remoteIds }
reconcileAdditiveMerge(before, after, syncedIds): { data: AssetData; changed: boolean }
collectAssetIds(data): string[]         // 자산 5종·거래 4종 id + yearlyNetAssets는 `year:{year}`
generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult
// STORAGE_KEYS, migrateStorageKeys는 local-storage.ts에서 re-export
// 공유 토큰 v7.2 stock 필드: inactiveStatus 직렬화 ("d"=delisted, "h"=halted, ""=활성)
```

**`syncedIds` 기준점 병합(클라우드 pull 전용, 2026-08 P0)** — pull은 `clearAssetData` 후 원격 데이터로 통째로 교체하므로, 다른 기기가 거의 동시에 push하면 이 기기가 막 추가한 자산이 흔적 없이 사라졌다. `reconcileAdditiveMerge`가 덮어쓰기 **직전**의 로컬을 읽어 되살리되, **무엇을 되살릴지는 기준점으로 판별**한다:

- 삭제는 tombstone 없이 배열 제거라(`delete*` 전부 `filter`) **"로컬에 있고 원격에 없다"만으로는 "내가 방금 추가함"과 "상대가 삭제함"을 구분할 수 없다.** 기준점 없이 무조건 되살리면 다른 기기의 삭제가 부활하고 그 결과가 재-push되어, 다기기 환경에서 삭제가 무력화된다(실제로 이 버그를 냈고 R28로 고정).
- `syncedIds`(= `sync-state.ts`의 `secretasset_sync.syncedIds`, "마지막으로 서버와 맞춰진 항목 키")에 **없으면** 아직 안 올라간 신규 추가 → **보존**. **있으면** 예전엔 서버에도 있었는데 지금 원격에 없음 = 원격에서 삭제됨 → **존중(제외)**.
- 키 규칙은 `collectAssetIds`가 단일 출처(자산·거래는 `id`, `yearlyNetAssets`는 `year:{year}`) — 수집과 판별이 갈리면 삭제 존중이 깨진다.
- 같은 id를 양쪽이 다르게 수정한 진짜 충돌은 원격 값 유지(범위 밖).
- 되살린 게 있으면 `mergedAdditions: true` → `runPull`이 **즉시 재-push**(안 하면 이 기기에만 남아 다음 pull 때 또 사라짐).

**기준점 갱신 시점이 이 설계의 함정** — pull 성공 시엔 `remoteIds`(**병합 전** 원격 키)로 갱신한다. 병합으로 살려둔 로컬 신규분까지 넣으면, 그게 서버에 올라가기 전에 다음 pull이 "삭제됨"으로 오판해 방금 지켜낸 자산을 스스로 지운다. push 성공 시엔 push한 payload의 키로 갱신. `forgetRemembered`도 `syncedIds`를 보존해야 한다(떨구면 병합이 안전 폴백으로 꺼진다).

`syncedIds`가 없으면(구버전·첫 동기화) 병합을 끄고 원격이 그대로 대체한다(안전 폴백). 파일 가져오기와 `connect`(다른 금고 채택, `pullAsset(..., { merge: false })`)도 이 대체 경로 — 남의 백업·금고에 내 로컬 잔여 항목을 섞으면 안 된다(F-CLOUD-SYNC S2 "자산 동일"). `unlock`(같은 금고)은 병합.

### real-estate-address.ts (`src/lib/realestate/real-estate-address.ts`)

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

### stock-cache-slot.ts (`src/lib/finance/stock-cache-slot.ts`)

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

### profit-utils.ts (`src/lib/finance/profit-utils.ts`)

```typescript
computeDailyStockProfit(stocks, refData, currentRates, options?: { useLivePrice?: boolean })
  // → { dailyProfit, dailyProfitRate } | null
  // 기본(useLivePrice 미지정=false): 종가 vs 종가(refPrice vs prevPrice) — profit-chart.tsx·performance-hub.tsx가 쓰는 기존 동작 그대로
  // useLivePrice:true(2026-08-27): #4.73부터 호출처 없음(상세·주식 칩은 today-chip.ts로 대체). 테스트만 유지

type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly" | "ytd"   // ytd(#4.78) = 시장과 비교 전용. profit-chart는 Exclude<…,"ytd">로 좁혀 기간 선택에 안 나옴
type ProfitBasis = "sameBusinessDay" | "kstAccessDay"   // 기본 sameBusinessDay

getProfitBasis() / setProfitBasis(b)   // localStorage(STORAGE_KEYS.profitBasis) 읽기/쓰기

getProfitCacheKey(tickers, period, basis = "kstAccessDay"): string
  // "secretasset_profit:{basis}:{period}:{date}:{tickers}"
  // daily date: sameBusinessDay=foreign refDate / kstAccessDay=domestic refDate

fetchProfitRef(tickers, period, options?): Promise<ProfitRefResponse>
// options.onFailed(#170): 429·5xx로 받은 종목 0일 때만(abort·점검·부분 성공 제외)
  // options: { onProgress?, onComplete?, signal?, basis? }
  // basis 미전달 시 kstAccessDay(legacy) — 스냅샷·기존 호출 동작 보존
  // 1) localStorage 캐시 hit → onProgress + onComplete(fromCache=true) 즉시 호출
  // 2) miss → BATCH_SIZE=3, BATCH_DELAY_MS=1000 배치 fetch
  //    배치마다 onProgress(누적 결과), 완료 후 캐시 저장 + onComplete(false)
  // 3) inFlightFetches Map으로 동일 cacheKey 호출 dedup (네트워크 1회만)
readCompleteProfitCache(tickers, period, basis?) → ProfitRefResponse | null
  // #5.134: fetchProfitRef 1)단계의 '완전한 캐시' 판정을 동기 함수로 추출(동작 동일). 요청 0 — useQuery initialData용
```

---

## config/theme.ts

```typescript
ASSET_THEME = { important, primary: {text, bg, bgLight}, text: {default, muted}, categoryBox, todayBox, liability, ... }
getProfitLossColor(value: number): string   // >0 수익색 / <0 손실색 / =0 기본색

// 인증카드 캡처 DOM 전용 토큰 (sm: 없음 — R32).
ASSET_THEME_SHOT      // 프리뷰 전용. 상세>주식 탭 모바일보다 ~2px 작다(2026-09 축소): cardInfoName/cardAmountMain
                      //   text-xs(12), summaryValue text-[17px], profitAmount text-sm(14), profitRate text-xs(12),
                      //   icon size-5(20), iconInitial text-[8px], badge text-[9px], bodyText/legendText text-xs(12).
                      //   간격 키(cardHeader/cardTriggerButton/legendGrid) 고정. footerBrand/footerDomain은
                      //   2026-09 푸터(브랜드명+도메인) 전체 제거와 함께 삭제됨.
ASSET_THEME_SHOT_BIG  // 저장 PNG 캡처용 = 캡처 기준 base(cardInfoName/legendText/bodyText 14, summaryValue 20,
                      //   profitAmount 16, icon 24 …)를 SHOT_BIG_SCALE배 하드코딩(현재 1.46: 20/29/23/20/35px,
                      //   iconInitial 13, badge 15). 2026-09부터 프리뷰(SHOT)와 base 분리 — 캡처 크기 불변.
                      //   간격 키는 SHOT과 동일.
SHOT_BIG_SCALE = 1.46 // 캡처 텍스트 배율의 **단일 출처(문서용 상수)**. Tailwind JIT가 text-[Npx]를 소스에서 스캔하므로
                      //   런타임 계산 불가 → 이 값을 바꾸면 ASSET_THEME_SHOT_BIG 값들을 base×SCALE 반올림으로 재계산해
                      //   교체할 것(theme.ts 주석에 base 표 있음). portfolio-ring-card.tsx는 도넛 라벨이 JS 숫자라
                      //   SHOT_BIG_SCALE을 import해 rLabelFont=round(12*SCALE)로 직접 파생.
                      // share-card.tsx가 shotBig=!responsive로 골라 하위(StockRowHeader/StockIcon/StockCategorySection/
                      //   DetailSummaryHeader/ProfitMetric/PortfolioSectorBar `big`)에 스레딩.
```

---

## config/asset-options.ts

```typescript
stockCategories, realEstateTypes, cashTypes, loanTypes
cryptoExchanges: string[]
popularCryptos: { symbol, name }[]          // BTC/ETH/XRP 등 20개
financialInstitutions: OptionGroup[]        // 은행/저축은행/보험사 (현금·대출 공통 — 대출 Select가 그대로 씀, 수정 금지)
securitiesFirms: OptionGroup[]
cashInstitutionGroups: { group, items }[]   // #5.167 현금 선택 전용 = 은행·2금융 4그룹 + `대형 증권사`·`온라인 증권사`(원본 `기타` 제외) + `기타` 1개(43항목, 값 중복 0). cash-input·cash-screenshot-import만 사용
quickButtonPresets: { stock, realEstate, loan }
```

---

## 커스텀 이벤트 (컴포넌트 간 통신)

> `navigation/asset-dispatch.ts`: `dispatchOpenYearlyNetAsset()`(FAB → 과거 순자산 입력창) — 이벤트 + **1회 요청 기록**(`YEARLY_NET_ASSET_OPEN_TTL_MS` 3초). `YearlyNetAssetChart`가 마운트 시·이벤트 수신 시 `consumeYearlyNetAssetOpenRequest()`로 꺼내 쓰고(1회 소멸) 유효시간이 지나면 폐기 — setTimeout 의존 없음(#4.49).

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

// 닉네임 변경: persistNickname() → useNickname·cloud-sync(사용자 편집으로 취급 → push)에서 수신
window.dispatchEvent(new CustomEvent(NICKNAME_EVENT))  // "secretasset-nickname-change"

// 사용자 명시 편집: AssetDataContext의 saveData·addStockRaw 성공 시, 우회 저장 경로는 notifyAssetUserEdit()
// (무티커 스크린샷 등록·파일 가져오기·공유 반영) → cloud-sync에서 수신
notifyAssetUserEdit()  // = dispatch ASSET_USER_EDIT_EVENT "secretasset-asset-user-edit"
// 클라우드 동기화의 **유일한** 자동 push 트리거(닉네임 제외) — api-reference.md "자동 push 트리거".
// 시세·스냅샷 자동 갱신은 saveAssetData를 직접 호출하므로 이 이벤트가 발생하지 않는다 → 조회 기기 push 없음.
```

### 닉네임 (`src/hooks/use-nickname.ts`)

- `persistNickname(next)`: `sanitizeNickname`(한글·영문·숫자, 최대 8자) → `assetData.nickname` 저장 + `NICKNAME_EVENT` 발행. 공유/가져오기/pull 복원(`applyImportedPayload`)도 이 함수 사용.
- `useNickname()`: `[nickname, setNickname]`. `NICKNAME_EVENT`·`storage` 수신해 상태 동기화.
- **커밋 시점 = 더보기 탭 이탈(언마운트) 1회** ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): 입력란은 로컬 `draft` state로 분리해 키 입력 중엔 저장·push 안 함. `useEffect([nickname])`로 외부 pull 변경을 draft에 반영, 언마운트 `commitRef`에서 `draft!==nickname`일 때만 `setNickname` 커밋(no-op 가드 → stale 닉네임 재push 차단). 키 입력마다 즉시 저장하던 ping-pong 동기화 버그 해결.

### X-Ray 분류 자동 fetch (`src/lib/xray/use-xray-classifications.ts`)

- `useXrayClassifications(stocks) → { tick, progress }` — 마운트/`stocks` 변경 시 `fetchAndStoreClassifications(stocks, onProgress)` 실행(캐시 완비면 즉시 no-op, 모듈 `inflight` dedup), 완료 시 `tick++`.
- **사용법**: `tick`을 `computeBreakdown`/`pickHighlights`를 감싸는 `useMemo` deps에 넣어 localStorage 분류 갱신을 재계산에 반영(`classification-store`엔 구독 메커니즘이 없음).
- **트리거 끄기**: 빈 배열(`[]`, 안정 참조)을 넘기면 no-op — 조건부 실행에 사용(예: 인증카드 다이얼로그는 `open && variant==="portfolio"`일 때만 `assetData.stocks` 전달).
- 소비처 3곳: `stock-xray-view.tsx`(진행률 % 표시), `stock-tools.tsx`(백그라운드, 4.83에서 `stock-insight-strip.tsx`에서 이전), `ShareScreenshotDialog`(포트폴리오 분야 막대바). 이전엔 앞 2곳이 동일 useEffect+tick 패턴을 복붙했으나 이 훅으로 통합.

### 종목 유형 분류 (`STOCK_TYPE_ENUM`, `src/lib/xray/classification-store.ts`)

- `STOCK_TYPE_ENUM`(8개: 성장주/**혁신주**/배당성장주/배당주/지수투자/가치주/채권·현금성/기타) — 한 종목당 정확히 1개 배정하는 **"종목 유형(투자 성격)"** 축(#4.24). `SECTOR_ENUM`(산업이 뭔가)과는 별개 축이라 혼용 금지 — 의도적으로 "투자 스타일"이라 부르지 않는다(투자자의 스타일이 아니라 종목 자체의 성격). **혁신주**는 검증 안 된 파괴적 기술 베팅(매출 미미·적자, 성패가 이분법적 — 로켓랩·아이온큐·임상단계 바이오텍류)을 대형 흑자 성장주(성장주)와 분리하기 위해 추가.
- `KnownClassification.stockType`에 저장, Gemini 분류(`api/xray-classify/route.ts`)가 `sector`와 나란히 채운다.
- `stock-xray.ts`의 `extractStockType`이 소비 — AI가 업종명 고정관념으로 흔들리기 쉬운 대표 ETF·우량주는 티커·이름 하드코딩 매핑으로 우선 확정(전수 목록 아님, 대표 예시만 — `extractIndex`의 `US_INDEX_ETF_MAP`·`extractSector`의 `domesticOverrides`와 동일한 "확실한 것만 하드코딩" 철학):
  - `COVERED_CALL_TICKERS`(JEPI/JEPQ/QYLD/YMAX 등) → 배당주, `DIVIDEND_GROWTH_ETF_TICKERS`(SCHD/DGRO/VIG 등) → 배당성장주 — 두 상품군이 AI 판단으로 뒤바뀌는 걸 원천 차단.
  - `DIVIDEND_ARISTOCRAT_TICKERS`(KO/PG/JNJ/O 등 25년+ 연속 증액) → 배당성장주, `HIGH_YIELD_VALUE_TICKERS`(T/VZ/MO, KT&G/KT 등) → 배당주, `TRADITIONAL_VALUE_TICKERS`(BAC/WFC, 국내 금융지주 등) → 가치주, `INNOVATION_TICKERS`(RKLB/IONQ/JOBY/ACHR) → 혁신주.
  - `BOND_CASH_TICKERS`/`BOND_CASH_NAME_KEYWORDS`(SGOV/TLT/국채 등) → 채권/현금성(최우선순위 아님, 위 개별 오버라이드 뒤에 체크).
- **`STOCK_TYPE_PROMPT_VERSION`**(classification-store.ts) — stockType 분류 규칙(프롬프트·오버라이드 목록)이 바뀔 때마다 올리는 버전 마커. 서버 캐시 유효성 체크(`xray-classify/route.ts`)와 클라이언트 게이트(`fetch-classifications.ts`) **양쪽 다** 이 값과 일치해야 "분류 완료"로 인정한다 — 하나라도 빠뜨리면 그쪽에서 재분류 요청 자체가 안 나가는 버그가 난다(2026-09-05 실제 발생·수정). 버전을 올리면 이미 (구버전 규칙으로) 캐시된 종목도 전부 강제 재분류된다.

### '오늘' 등락 칩 (`src/lib/finance/today-chip.ts`, #4.73 #134)

```typescript
getTodayChipSession(market: "domestic"|"foreign", now?): { phase: "live"|"afterCloseGap"|"closed"; tradeDate; baseDate }
  // 순수 함수. 국내 한국 영업일 09:00~15:30 live, 15:30~16:00 gap / 미국 ET 영업일 09:30~16:00 live, 16:00~17:00 gap(Intl로 서머타임 반영)
  // closed: tradeDate=마지막 거래일, baseDate=그 전 거래일(kr/us-holidays). '기간 수익 종가 기준' 설정과 무관
getStockChipQuote(stock, refData, now?, gapConfirmed?) → { live, closeDate, numerator, denominator } | null  // 체험·데모(demo_st_) 종목은 장중·마감직후 null(#142)
  // live: currentPrice ÷ refPrice(baseDate ≤ refDate < tradeDate일 때만) / closed: refPrice ÷ prevPrice(refDate=tradeDate·prevDate=baseDate일 때만)
  // 두 거래일 종가를 못 구하면 null(같은 종가끼리 0.0% 금지). gap은 AFTER_CLOSE_GAP_CONFIRMED[market]이면 종가 라벨, 미확인이면 AFTER_CLOSE_GAP_FALLBACK_LIVE(국내 true → live `오늘`, 미국 false → 숨김)
computeTodayChip(stocks, refData, currentRates, now?) → { rate(%), anyLive, closeDates } | null
  // 현지 가격 등락을 원화 평가액(현재 환율)으로 가중 — 환율 효과 0. 같은 티커 묶음이면 곧 종목 등락률
todayChipLabel(chip, "row"|"header")   // 라벨 정본 TODAY_CHIP_LABELS(본안 `오늘`/`M/D 종가`, 헤더 `종가`)
// #4.73 U7: closed 분기는 응답 쌍이 맞지 않으면 ref.chipPair(서버 보강)가 지금 세션 쌍과 같을 때만 사용(live·gap 분기 불변)
// #4.73 U7 숨김 규칙(computeTodayChip 한 곳): 칩 대상(국내 6자리·미국 USD 티커, 비상장·상장폐지·거래정지 아님, 수량·현재가 있음) 중
//   응답 키가 없는 종목이 있거나, 응답 non-null 대상이 있는 시장(국내·미국)에 칩이 0이면 null. 거래정지·일본·기준가 null은 숨김을 만들지 않는다
sortByChipRate(items, rateOf) → T[]   // #4.73 상세·주식 `등락률 순` — 표시 소수 1자리 높은 순(부호 그대로), null 맨 뒤, 동률·null끼리 입력(평가금) 순
// #5.134 #246: computeTodayChip 결과에 krwChange(= 분자 합 − 분모 합, 원화 등락 기여) 추가 — 홈 '내 종목 오늘' 고르기 전용, 화면·서버 미사용
```

### 홈 '내 종목 오늘' (`src/lib/finance/my-stock-today.ts`, #5.134 #246)

```typescript
myStockTickerList(stocks) → string          // stock-tab useFilteredStockData·saveSnapshots와 같은 필터·중복 제거·정렬
myStockQueryKey(tickerList)                  // ["profit","daily","kstAccessDay",tickerList] — 상세·주식 '오늘' 칩과 같은 키(새 캐시 키 0)
buildMyStockRows(stocks, refData, rates, now?) → { name, chip, value }[]  // 상세·주식 `전체` 행 = 평가금 순 정렬 → groupStocksByTicker → 묶음별 computeTodayChip
pickMyStockToday(rows) → { name, label, rateText, sign, rate, more } | null
  // 칩 있고 rateTenths ≠ 0인 행 중 |krwChange| 최대 → 동률(원 단위) |rateTenths| → 평가금. more = 칩 있는 나머지 행 수(0.0% 포함). 기여 금액은 결과에 없음
myStockLineState({ screenshotMode?, hasHeaderChange, hasTickerStock, fetching, picked }) → "off"|"pending"|"on"  // 팁 입력 없음
myStockText(pick) / myStockAriaLabel(pick)  // `{이름} {라벨} {+x.x%|-x.x%} · 외 N종목` / `내 종목 보기, … , 외 N종목` (formatCompareRate — ASCII -)
```
- 조회는 `dashboard.tsx` `useMyStockToday` 1곳: 같은 queryKey `useQuery` 1개, `staleTime` 5분, `enabled` = 첫 저장 당일 아님 + 티커 있음, 취소 effect 없음. 캐시 적중은 `initialData: readCompleteProfitCache(...)`로 첫 렌더에 결과.

### 시장과 비교 (`src/lib/finance/market-compare.ts` · `profit-dates.ts` · `hooks/use-market-compare.ts`, #4.73 #132)

```typescript
// profit-dates.ts — profit·market-index 라우트 공용 날짜(구 profit/route getDates 이동, 출력 무변경 대조 vitest)
resolveRefDates(period, basis, now?) → { kr: { refDate, prevDate?, refHoliday }, us: {…} }
pickCloseOnOrBefore(series, date, lookback) · buildRefEntryFromSeries · getSeriesRange

// market-compare.ts — 순수 함수, 저장 0·금액 0
classifyHoldings(stocks, peerCodes) → { kr, us, notCompared, unlisted, delisted }   // K1: 국내 카테고리 + 생성 목록(개별주·국내 주식형 ETF)만 kr, USD 미국 티커만 us. 같은 티커 병합. delisted는 화면에서 쓰지 않음(요청·셈 0)
loadKospiPeerCodes()          // src/lib/data/kr-kospi-peer-codes.ts 동적 import(첫 화면 번들 제외). 마스터 갱신 시 재생성(README)
computeMarketCompare(classified, stockRefs, indexRefs) → MarketCompareBlock[]   // 시장×기간 PeriodCell(loading|holiday|empty|ok, 최빈 (시작,끝) 쌍, indexState ok|failed|dateMismatch, rows = 등락 높은 순 + 시장 줄)
computeIndexSpan(market, period, indexRefs)   // 지수 등락 — 페이지 표·진입 글줄 공용(A11)
isDailyIndexHoliday(market, period, start, end)   // #4.90 하루 구간 휴장 판정 — computePeriodCell·홈 종가 줄·시장 타일 공용
marketLineState({screenshotMode?, hasHeaderChange, hasTickerStock, markets}) → "on"|"pending"|"off"   // #4.90 홈 종가 줄 노출·기능 팁 '시장과 비교' 억제 단일 판정
marketLineGroups(values) · marketLineLabel(values, hideRest?) · marketLineItemText · monthDay   // `11/11 종가 코스피 +0.8% · S&P 500 -0.3%`, 값 = formatCompareRate(C65)
computeNotComparedRows · compareTickers
summarizeCompare(classified, blocks) → { blockCounts, notCompared, excluded } | null   // 블록 N = 세 기간 중 하나 이상 합산, 제외 = 한 기간이라도 빠진 고유 종목 + 비상장(이름 1), 일부 기간만이면 `1개월 기준가 없음`, 조회 중이면 null
refRangeParts(start, end, withYear?) → ["M/D→", "M/D"] (올해 ["YY.M.D→","YY.M.D"]) · cellRange(cell, period?)   // 행 머리·묶음 머리 같은 표기, 휴장 `휴장`, 올해 연초 휴장 `pending`(끝 종가일이 시작과 같은 해) → `집계 전`
rateTenths · formatCompareRate(+1.2%, 0.0은 부호 없음) · formatCompareDiff(+0.8%p, 차이 = 보이는 두 값의 차)
COMPARE_PERIOD_LABEL · MARKET_INDEX_NAME(`코스피`/`S&P 500`)

// hooks/use-market-compare.ts — 페이지·글줄 공용(같은 queryKey ["market-index", period, basis, dailyToken])
useCompareBasis() · useDailyRefToken() · useKospiPeerCodes() · useMarketIndexRefs(basis, enabled, token, periods?) · fetchMarketIndex
// #4.90: useKospiPeerCodes(enabled = true) — false면 종목 마스터 청크를 불러오지 않음. useMarketEntryValue(period, visible, enabled) · values[]에 endDate·holiday 추가
// lib/report/home-today.ts — pickTopCause(causes)(|amount| 최대, 동률 앞 항목) · weekTrendTitle(snapshots)(연속이면 최근 N일, 아니면 최근 기록 N일)
// lib/report/hero-cause-display.ts(5.153 #304) — 홈 Hero·원인 행 표시 글자 단일 출처: formatHeroDelta(Δ)(`▲ +`/`▼ −`, U+2212) · formatHeroPct(pct)(5.155: `+1.2%`/`−1.2%`, 표시값 0.0은 부호 없음) · formatSignedShort(v)(부호+formatShortCurrency) · heroManwon(Δ)(0 방향 버림 만원) · allocateManwon(amounts, total)(만원 정수 최대 나머지 배분, 0만원·부호 반전 금지, 막히면 절댓값 큰 행) · heroCauseTexts(amounts, Δ)(행 합 = Hero). 엔진 fmtManwon·AttributionDisplayItem.text(AI·결산·home-today용)는 그대로 — 합계·내역이 한 카드에 같이 보이면 표시 단계에서 이 배분을 쓴다
// feature-usage pickRecommendedFeature(assetData, excludeIds?) · home-tip pickHomeTip({suppressFeatureIds}) — dismiss 기록 없이 이번 판정에서만 제외
// market-compare-view listPeriodFromInit(init) — init.period "day" → 하루, 그 밖 1주
```
- **올해(ytd, #4.78)**: `ComparePeriod`·`COMPARE_PERIODS`에 `ytd` 4번째. 시작 종가 = 명목일 (Y−1)-12-31 이하 최근 종가(`getPeriodRefDates("ytd")`, 컷오프 shift 없음), 끝 = 일별 ref. 클라이언트 캐시 토큰 = 날짜(기본값, ytd 분기 없음), `prunePeriodProfitCache` PERIODS에 포함. 서버 기준가 TTL = 다음 자정(`secondsUntilNextRefBoundary("ytd")` 공개), 미국 ytd만 `fetchOverseasHistoricalPrice(…, adjusted=true)`(MODP=1) + `getRefPrice/setRefPrice(…, adj)` 키 `finance:refprice:adj:*`. PeriodCell state `pending` 추가.
- 종목 기준가는 기존 `fetchProfitRef`(profit-chart와 같은 티커 목록·사용자 종가 기준 → 자산 변화와 같은 캐시 키). 키 없음 = 조회 중(부분 합 금지), `null` = 기준가 없음. 키가 빠지면 60초 뒤 최대 2회 재조회.

### profit-fetch-gate.ts (`src/lib/finance/profit-fetch-gate.ts`, #4.73 #137·#138)
```typescript
createFetchSlot() → { inFlightKey, latestKey, controller }   // 조회 1종당 useRef 1개
beginLatestFetch(slot, key) → { controller, isCurrent(), done() } | null   // 같은 key 진행 중이면 null(보존), 다른 key면 이전 abort. 콜백 직전 isCurrent()로 늦은 응답 버림
resetFetchSlot(slot)                                          // 데이터 삭제·불러오기 — abort + 늦은 응답 버림
cancelThenRefetchProfit(queryClient)                          // ["profit"] 취소 뒤 활성 쿼리만 재조회(취소만 하면 pending으로 남음)
```
- 사용처: `profit-chart.tsx` ref·daily effect, `stock-tab.tsx` `useFilteredStockData` 리셋 effect.

### navigation-context 시장과 비교 이동 (#4.73 #132 K3)
- `ActivityTab`에 `change-market`(`#activity/change-market`, 화면 키 `activity:change-market`, 뒤로 라벨 `뒤로`).
- `rememberChangeInit({scope, period})` — 자산 변화 글줄이 비교로 가기 직전 모듈 메모리에 기억. `withRestoredChangeInit(next, from, remembered)` — popstate로 비교 화면(from)에서 자산 변화로 돌아오면 init 복원(새로고침하면 기억 없음). **history.state는 쓰지 않는다** — Next App Router가 `__NA` 없는 state의 popstate를 전체 새로고침으로 처리한다(preview 실측).
- `marketCompareBackAction(enteredInApp, history.length)` — `navigate()`로 들어왔으면(모듈 메모리) `history.back()`, 주소 진입·새로고침이면 자산 변화(주식·주).
- 입력 refData는 `fetchProfitRef(tickers, "daily", { basis: "kstAccessDay" })`(stock-tab `useFilteredStockData`). 저장 호출 0.

### 기업 로고 src 해석 (`src/lib/finance/logo-source.ts`)

- `resolveLogoSrc(ticker, name, isForeign, { size?, theme? }) → string | null` — `/api/logo` 쿼리를 만드는 **단일 출처**. 해외 티커(`/^[A-Z]+$/`) → `?ticker=`, 국내 ETF 브랜드 접두(`getEtfDomain`) 또는 국내 개별주(`DOMESTIC_STOCK_DOMAIN_MAP`) → `?domain=`. 어디에도 안 걸리면 `null`(호출부가 이니셜·티커 텍스트로 폴백).
- **`captureLogoSize(displayPx) → number`** = `ceil(displayPx * CAPTURE_PIXEL_RATIO / 2)` = `displayPx * 1.5`. `/api/logo` route가 항상 `retina=true`를 강제해 **반환 PNG = 요청 `size`의 2배**이므로, 표시px×pixelRatio(3) 해상도를 얻으려면 요청 `size`는 그 절반이면 된다. `LogoSourceOptions.size`엔 **반드시 `captureLogoSize(표시px)`로 환산해 전달**한다 — 과거 `BrandMark`가 44~92px 칩에 `size*6`(clamp 512 → retina 1024px PNG)를 요청해 모바일 Web‑View가 디코드/메모리 한계로 로고를 통째로 못 그렸다(인증카드 저장 시 로고 누락, 2026-09). `CAPTURE_PIXEL_RATIO`(=3)는 `share-menu.tsx` `captureImage`의 `pixelRatio`와 동일해야 한다.
- **`KR_ETF_BRANDS`(22개 브랜드 접두어) 단일 출처** — `stock-xray.ts`가 여기서 import한다(과거엔 양쪽에 중복 정의돼 있었고 주석이 존재하지 않는 파일을 가리켰다). `ETF_DOMAIN`(13개, 브랜드→운용사 도메인)은 그 부분집합.
- `getEtfBrand(name)` — 국내 ETF면 브랜드명(TIGER/KODEX/ACE…) 반환. **운용사 로고가 흰 배경 사각 이미지라** 도넛 조각처럼 색면 위에 얹으면 흰 박스로 뜬다. `resolveLogoSrc` 자체는 국내 ETF를 배제하지 않는다(`StockIcon`은 원형 아바타라 흰 배경도 자연스러워 그대로 씀) — **`BrandMark`가 `etfBrand` 유무로 먼저 분기해 이 함수를 호출하지 않고 텍스트 배지로 대체**한다. 새 소비처를 추가할 때도 이 방식(호출 전 분기)을 따르고 `resolveLogoSrc`에 배제 로직을 넣지 말 것.
- 소비처 2곳: `StockIcon`(주식 탭, 원형 아바타) / `BrandMark`(인증카드 포트폴리오 도넛, 투명 로고). 둘 다 **`useLogoSrc` 훅 경유**로 이 함수를 호출한다(직접 호출 금지 — 재시도가 빠진다). 새로 로고를 그릴 곳이 생기면 `useLogoSrc`를 재사용한다.

### 로고 로드 재시도 훅 (`src/hooks/use-logo-src.ts`)

- `useLogoSrc(ticker, name, isForeign, opts?) → { src, failed, imgProps }`
  - `imgProps`(`{ src, onError, onLoad }`) — `<img key={imgProps.src} {...imgProps} />`로 스프레드. `null`이면 로고 URL 없음(도메인 매핑 없음) **또는 재시도 3회 소진**.
  - `failed` — URL은 있으나 재시도까지 실패. 호출부가 이니셜 등 폴백을 그릴 신호(`imgProps===null`과 동치이나 의미 구분용).
- 내부: `resolveLogoSrc`(단일 출처 재사용)로 `base` URL → `onError` 시 지수 백오프(400·800·1600ms)로 `attempt++`, 3회 초과 시 `failed`. `onLoad` 시 대기 타이머 취소. `base`(종목·옵션) 변경 시 상태 리셋. 언마운트 시 `clearTimeout`.
- 재시도 URL엔 캐시버스터 `&r=N`만 붙는다 — `/api/logo` route가 이 파라미터를 파싱하지 않아 **서버 캐시 키 불변(HIT 유지)**, 무력화 대상은 브라우저 HTTP 캐시뿐. 목적은 "모바일 WebView 1회성 디코드 실패" 복구.
- **왜 필요**: 과거 `BrandMark`/`StockIcon`은 `imgError` state가 한 번 `true`면 영구히 폴백으로 굳어, 캡처(`toPng`) 실행 전에 이미 로고가 사라진 상태였다(인증카드 저장 시 로고 누락, 2026-09). `imgError` 영구 폴백 패턴을 이 훅으로 교체.

### 5.115 알림 팁·저장 보호·iOS 판별
- `lib/push/client.ts` `isNotifyTipEligible()` — `detectPushEnv()==="ready" && Notification.permission==="default" && !readPushPrefs().on`. 호출부(`home-tip-box.tsx`)가 `!isTrialMode() && !isPwaLocked() && !isTipDismissed(NOTIFY_OFFER_ID)`를 더해 `pickHomeTip`의 `notifyOk`로 넘긴다. `HomeTip` kind `notify`(우선순위: 최신화 아래·기능 위).
- `lib/pwa/persist-storage.ts` `ensureStoragePersist()` — 모듈 플래그로 로드당 1회, `navigator.storage.persist` 미지원·`Firefox/` UA 제외, `persisted()` 참이면 GA 0, 아니면 `persist()` 결과로 `feature_use{category:persist_ok|persist_denied}` 1건, 예외 삼킴.
- `lib/pwa/detect-browser.ts` `isIosBelow164(ua?)` — UA `OS 16_3`/`Version/16.3`, 파싱 실패 false. 설치 안내 문장 분기용.
- `AssetView` `{type:"settings"; focus?:"notify"}` — 메모리 상태만, `SettingsPage`가 `#settings-section-notify`로 1회 스크롤(`scroll-mt-16`).

### 첫 저장 설치 안내 신호·판정 (`src/lib/pwa/first-save-signal.ts` · `install-nudge-policy.ts`, #4.45 #78)
- `markFirstSave()`는 `ga.ts trackAssetSave`의 첫 저장 판정 분기(`writeFlags` 직후)에서만 호출 — 모듈 메모리뿐(새 저장 키·gaFlags 쓰기 추가 0, 새로고침 시 소멸). `dismissInstallNudge`·`markNudgeShown`(노출 GA 세션당 1회)·`subscribeFirstSave`(`useSyncExternalStore`용)
- `shouldShowInstallNudge(input)` 순수 함수: 신호·미닫힘·체험 아님·인앱 아님·모바일·`isIOS||isInstallable`·홈·자산≥1·`tutorialFinished===true`·마법사/다이얼로그 없음. `isTutorialFinished`는 `skipStep`/`skipAllTutorialSteps`로도 true

### 연말 세금 시즌 판정 (`src/lib/tax-utils.ts`, #4.45 #79)
- `isTaxSimCandidate(stock)`: 해외·거래 가능·수량>0 — `groupForeignStocksByTicker`와 줄이 같은 정본. `isForeignTaxSeason(today = todayKst())`: KST `MM-DD`가 11-01~12-31

### sitemap·정본 호스트·UTM (#4.45 #77)
- `APP_CONFIG.siteUrl` 기본값은 www. 정본 URL(canonical·og·sitemap)은 모두 이 값에서 파생하고 표시용 도메인 문자열은 리터럴로 분리. `sitemap.ts`는 `new Date()` 금지(문서별 고정 lastModified). `allowedUtmQuery`는 `/ratio`·`/guide/<slug>`만 UTM 3키 허용. `WEB_APPLICATION_JSON_LD`(`config/app.ts`)는 루트 layout head에 1개

### 배당 공용 계산 (`src/lib/finance/dividend-calc.ts`, #313 5.157) — 배당 금액 계산의 단일 출처
- `computeDividends(rows, txs, usdRate, todayKst)` → `{ months[12]{month, byCategory{paid,expected}}, byStock: Map<key, {paid,expected,paidForeign,expectedForeign,perMonth{paid,expected,paidForeign,expectedForeign}[12],monthState[12],firstPayout,qtyUsed,heldQty}>, annual{paid,expected,total} }`(전부 반올림 전 — 소비처가 마지막 합산 뒤 1회 `Math.round`). 입력 `rows`는 **계좌별 원본 행**(`mergeStockGroup` 결과 금지 — id가 바뀌어 거래 매칭이 끊긴다). 엔화 행·카테고리 밖 행은 제외
- `heldQtyAt(stock, txs, payoutDate)` → `{qty, qtyUsed:'derived'|'current'}`: `지급일 <= purchaseDate`면 0, 반영 거래(`stockId===stock.id && reflected`) 0건·역산 음수·NaN·`positionSource==="manual"`이고 `positionEffectiveDate`(없으면 매수일)가 지급일 뒤면 지금 수량, 그 밖은 `지금 수량 − Σ매수 + Σ매도`(지급일 당일 이후 거래 되돌림, `reverseTransaction` 수량 규칙, 소수 8자리 정리). 수량 0은 0원(폴백 아님)
- `roundedAnnual(calc)` → `{paid, expected, total}` 연 합계 단일 정본(각각 반올림 후 합산, 5.162) — 배당 Hero·결론 줄·허브·성적표 입력 공용. 월 행 total = totalActual + totalEstimated
- `isDividendPaid(p, todayKst)` = `payoutDate <= 오늘 && !isEstimated`(연-월 판정 금지) · `monthSums(calc)`(월별 지급·예상 합, 툴팁 합계 = 월 선택 Hero) · `dividendStockKey(stock)`(= `groupStocksByTickerCategory` 키) · `isDividendExcludedCurrency`(JPY) · `DIVIDEND_CATEGORY_KEYS`
- `nextDividendMonth(calc, todayKst, keys?)` → `{month,count}|null`(오늘 달 이상 예상이 있는 가장 이른 달·그 달 예상 종목 수, 새 금액 계산 0, #317). 훅 `useDividendData({enabled?, stocks?})`(`stocks`를 주면 `assetData.stocks` 대신 그 행만 — 종목 한 장)(`views/activity/use-dividend-data.ts`) → `{groups(병합 표시 행+원본 items+payouts), calc, isLoading, loadedCount, failedCount, totalCount, jpyCount}`. 조회는 ticker·카테고리당 1회(쿼리 키 불변), 엔화는 쿼리 0. 순수 `buildDividendGroups(stocks)`. 배당 차트·종목 표(props)·`useDividendAnnualTotals`가 사용 — 새 배당 표시는 이 훅·함수를 재사용하고 컴포넌트에서 재계산하지 않는다. 불리기 `annualAtHeldQty`(지금 수량 × 올해 전체 지급)는 다른 정의라 공용 계산 밖

### 배당 투입 대비 배당 계산 (`src/lib/finance/dividend-yield.ts`, #4.46 #80)
- `computeDividendYield(items, usdRate, mode, calc)` → `{pct, text, excluded}|null`. `items` = 표시 단위(병합) 종목, 포함 종목=평단>0이고 KRW/USD, 분모 Σ평단×지금 수량×(USD면 현재 환율), 분자 = `calc.byStock`의 그 종목 값(#313, `actual` 모드는 지급만). 0<값<0.05는 "0.1% 미만"

### 도넛 라벨 글자색 (`config/theme.ts` `pickDonutLabelColor`, #4.46 #82)
- 조각색 위에서 흰/검정 중 WCAG 대비가 큰 쪽(알파 없음). `pickOnColor`(휘도 0.45 컷)와 별개 — MAIN_PALETTE 12색 모두 4.5:1 이상이 테스트로 고정

### 보유 현황 맞추기 순수 함수 (`src/lib/asset/resync/`, #4.50 #91)
- 새 종목 매수일(#146, 4.77): `ResyncSelection.purchaseDate?`(메모리 상태, 없으면 `resyncNewPurchaseDate`). 첫 등록용 `lib/asset/import-inherit.ts`: `pairStockImport`/`pairCryptoImport`(같은 키 기존 항목 1:1 짝, 증권사 같음→매수일 이른 것→기존 순서), `planStockImport`/`planCryptoImport`(merge·reset 저장 목록, 짝은 이어받기 `inheritStock`/`inheritCrypto`, 신규만 입력 매수일), `freshImportCount`, `defaultNewPurchaseDate`·`isValidNewPurchaseDate`·`kstTodayString`. 충돌 단계 `교체` 배지는 `keyOfStock`/`keyOfCrypto`(holdings-conflict, 불변) 기준이고 입력 줄 N은 같은 키 기준 짝짓기에서 나온다.
- 끊긴 거래 다시 잇기(#147, 4.77): `resync/relink.ts` `detectRelink(data): RelinkRow[]`(대상 S = `(stock|crypto)_import_<ms>_N` + 매수일 = 만든 날/만든 해 1/1, 고아 묶음 합산·전량 매도 회차 구분·`reverseTransaction` 역산 일관 구간·새 매수일), `applyRelink(data, picks)`(적용 직전 재감지, 바뀌는 값 = 거래 stockId/cryptoId·S.purchaseDate), `relinkTotalCount`, `RELINK_OFFER_ID`(`feature-usage` dismissedTipIds). 되돌리기는 `buildUndoEntries`(coll `transactions`·`cryptoTransactions` 추가) + `planUndo`. `pickHomeTip`은 입력 `hasRelink`(호출부가 체험·잠금·해제 판정)로 `{kind:"relink"}` 반환(결산 창 아래). `clearAssetData` keepKeys에 `featureUsage`.
- 저장·push·notify·모듈 상태 호출 0(정적 테스트로 고정). `resolveScreens`(장 증권사 ①brokerHint ②기존 항목 과반 ③사용자 선택, 국내 계좌 추정)→`mergeScreens`(장 사이 같은 키 1건, 수량 다르면 `quantityCandidates`)→`computeDiff`(rows·removes·kept·scopes·incomplete)→`summarize`/`resolveRow`/`applyResync`(선택 `ResyncSelection`: include·remove·pick·qty·ticker·fx)→`buildUndoEntries(before, after, coll)`·`planUndo(entries, current)`(overwrite-guard `planRevert`/`applyRevert` 재사용, 현재 데이터를 새로 읽어 넘길 것).
- 코인 저장 계획·되돌리기(5.161): `transfer.ts` `planCryptoResyncSave(fresh, nextCrypto, planDelete)`(삭제 id = fresh.crypto에 있고 nextCrypto에 없는 id → 호출측이 `(d, ids) => planDeleteCryptos(d, ids, rates)`를 넘겨 거래 정리, 지운 코인 0이면 거래 참조 유지), `undo.ts` `buildCryptoResyncUndoEntries(before, after)`(crypto·cryptoTransactions).
- 결과 대조(5.164): `resync/reconcile.ts` `reconcileTotal({screenTotal, rows, flags}): {state:"match"|"diff"|"hidden"}`·`reconcileLines`(일치일 때만 1줄, 차이·숨김은 `[]`)·`reconcileGaCategory(view, fetchStatus?)`(match·diff·none·skip)·`reconcileTolerance(base)`=max(base/200, 1000)·`isStockTotalLabel(label)`('평가' 포함, 자산·예수금·예탁·추정·순·손익·현재가·매입·단가·수익·줄바꿈 제외)·`isImplausibleScreenTotal(total, rows)`(합계가 행 평가액 합의 50% 미만, 또는 행 2개 이상에서 한 행 평가액 ±0.5%와 같고 행 합보다 작으면 true → 일치가 아닐 때 줄 숨김)·`collectReconcileRows({diff, sel, result, existing, rates})`(화면 행 ↔ 맞춘 뒤 앱 종목, unapplied·stalePrice·hasForeign)·`screenTotalTarget({kind, shots, failedRemoved, asked})`(합계 호출을 보낼 장 id | null)·`parseScreenTotalResponse(data)`·`settledScreenTotal(fetch)`·`ScreenTotalFetch`(none·pending·failed·done)·`SCREEN_TOTAL_MODE`·`SCREEN_TOTAL_TIMEOUT_MS`(8000). 전부 순수·메모리만(저장 0). 호출은 `resync/screen-total-call.ts` `startScreenTotalCall(image, {fetchImpl?, timeoutMs?}) → {state(), cancel()}`(이미지 + 모드 값만, 1회, index 재수출 없음). 서버 `app/api/parse-screenshot/screen-total.ts` `respondScreenTotal`·`parseScreenAmount(text)`(화면 금액 글자 → 숫자, 규칙 밖 null)·`readScreenTotalFields`·`sanitizeScreenTotal`·`buildScreenTotalPrompt`·`SCREEN_TOTAL_SCHEMA`.
- 저장 계획·증권사 이관(#310, 5.156): `resync/transfer.ts` `detectTransfers(diff): TransferCandidate[]`(diff.kept의 A × 화면 행, tickerKey·category·broker만, A 1개·행 1개, path `inherit`(행 추가)/`merge`(행 변경·그대로, `to`=B)), `checkedTransfers(diff, sel)`(`ResyncSelection.transfer?: Set<A.id>`), `planResyncSave(fresh, result, planDelete)`(합치기 거래 stockId·대출 linkedStockId 재지정 + 실제 삭제 종목 거래 정리 — 호출측이 `(d, ids) => planDeleteStocks(d, ids, rates)`를 넘김, 반환 `{data, moved, movedTx}`, 안 바뀐 항목 참조 유지), `pruneStockTarget(target, liveIds)`(store 대상 없는 id 제거, 비면 null). `ApplyResult.transfers`(`AppliedTransfer` fromId·toId·path). 되돌리기 `buildResyncUndoEntries(before, after)`(stocks·transactions·loans, `buildUndoEntries` coll에 `loans` 추가). 카드 체크 쌍은 `inheritedPreds`에서 `pickPredecessor` 순위보다 먼저 A로 고정.
- 매칭·증권사: `sameBroker`·`isUnassignedBroker`(`""`·`항목 N`=미지정)·`matchExisting`. 코인은 `crypto.ts`의 `cryptoToStock`/`stocksToCrypto`/`parsedCryptoToRaw`/`matchExchangeHint`로 같은 함수를 쓴다(범위=거래소).
- 평단 규칙: `averagePriceEstimated=false` 화면 실값만 변경(상대 차 0.1% 초과), 역산은 기존 유지(1% 초과 시 `avgKept` 표시).
- 매수일(#139): `applyResync`의 추가 행은 이번에 지우는 같은 종목(티커·시장)을 이어받고(id·매수일 승계), 이어받을 게 없으면 매수일 `resyncNewPurchaseDate(today)`(= 그해 1월 1일), `positionEffectiveDate`=오늘. 결산 예측 추정(`estimatePeriodInflows`)은 매수일 대신 `resyncInflowDate(item)`(맞추기 신규 `stock_import_<ms>`·직접 등록 신규 `stock_<ms>`(기본값 올해 1/1, #142) + 매수일 기본값 그대로면 id의 만든 날 KST)을 쓴다.

### 잔액 맞추기·저장 실패 알림 (`src/lib/asset/balance-edits.ts`·`save-failure.ts`, #4.52 #93)
- `balance-edits.ts`(순수): `applyBalanceEdits(list, edits)`→`{list, applied}`(balance만 교체, 없는 id 건너뜀, 같은 값 미계산)·`checkBalanceRow(category, current, next)`→`{changed, issue: "cash-zero"|"magnitude"|null}`·`sanitizeBalanceText`/`parseBalanceText`/`formatBalanceText`·`maxDecimalsOf`·`orderBalanceRows`(상세 탭 순서). 호출부는 `getAssetData()` 최신 목록에 적용해 `saveData` 1회(렌더 클로저의 `updateCash` 반복 금지)
- 이중 반영 경고: `shouldWarnTxAfterResync({txDate, reflected, refreshedAtIso})`·`kstDateOfIso`·`TX_AFTER_RESYNC_WARNING`(balance-edits.ts), `lastRefreshedAt(category)`(asset-refresh-status.ts). `cash-tx-input`·`loan-tx-input`이 사용
- 시세 신선도(#309, 5.155): `lib/finance/price-freshness.ts`(순수) — `currentPriceSlots()`(국내·해외·코인 칸, 오늘 KST, 환율 유효 날짜) · `planPriceResync({stocks, crypto, exchangeSyncDate, slots, attempts})` → `{exchange, stock, coin}`(호출 전 사전 판정, `syncTodayStockPrices` outdated 규칙과 같음, 같은 칸 이미 시도면 false, 환율은 오늘 또는 유효 날짜면 최신) · `hasResyncWork` · `failedPriceTickers(intended, patched)` · `isPriceAsOfTarget(stock)`(티커·비상장 아님·상장폐지 아님) · `priceAsOf(baseDate, market)`(getStockCacheSlot 역함수 → 실제 KST 시각, 장중 칸 국내 16시 전·해외 07시 전은 다음 날, 국내 종가 D 15:30, 미국 종가 D+1 05/06시) · `priceAsOfText`(`14시 시세`·`11/25 14시 시세`·`11/21 종가`·`미국 11/25 종가`) · `priceAsOfLine(stocks, failed, {today, prefix})`(실패 제외 최솟값 + `N종목 이전 시세`, 문자열 min 금지). `lib/pwa/page-resume.ts` — `onPageResume(cb)`(visibilitychange→visible·pageshow persisted만) · `createSingleFlight(run, canStart)`. `stores/price-sync-status-store.ts` `usePriceSyncStatusStore.failedTickers`(메모리, 저장 키 0). asset-data-context: `resumePriceSync`(silent, pull epoch 바뀌면 코인·스냅샷 생략)·`priceAttemptsRef`·`priceChainBusyRef`, `syncTodayExchangeRate/syncTodayStockPrices/saveSnapshots`에 `{silent}` 옵션
- 시세 응답 병합(#104): `lib/asset/price-patch.ts` `buildStockPricePatches`/`buildCryptoPricePatches`(응답->id별 시세 필드 패치)·`applyPricePatches(latest, patches, keyOf)`(최신 목록에 id로 적용, 삭제 부활 0·키 바뀐 항목 건너뜀). 자동 시세 동기화는 시작 시점 data를 되쓰지 말고 `getAssetData()` 최신본에 병합해 저장한다
- `save-failure.ts`: `saveAssetDataNotify(data)` — `saveAssetData` 래퍼, 실패 시 세션당 1회 토스트 + GA `feature_use save_failed`. 자동 저장 경로(시세·스냅샷·마이그레이션·공유 반영·닉네임)는 `saveAssetData` 대신 이 함수를 쓴다(반환값 버리기 금지). 사용자 편집은 `saveData` 경로의 각자 실패 토스트

### 동기화 덮임 감지 (`src/lib/cloud-sync/overwrite-guard.ts`, #4.47 #84)
- 메모리 전용(저장 키·sync 상태 필드 0). `beginPush`/`commitPush`(push 성공 시 기준 갱신), `beginPull(data, auto)`/`commitPull(before, data)`(자동 pull 직전·직후 비교 → 덮인 내 항목 목록 합치기, 기준 갱신), `refreshEntries`(R1), `resetOverwriteGuard`(연결 끊기·다른 금고 연결). 순수: `captureSnapshot`·`detectOverwrites`·`planRevert`·`applyRevert`. 비교는 사용자 입력 필드만 — 앱이 자동으로 쓰는 필드는 제외: stocks(`currentPrice`·`baseDate`·`name` 자동 보정·`inactive*`), crypto(`currentPrice`·`baseDate`), realEstate(`marketEstimate*`, `currentValue`는 사용자 입력이라 비교), 올해 연도별 순자산(note "자동"). 새 자동 갱신 경로를 추가하면 `overwrite-guard.ts` 표에 함께 등록
- 규약: 감지 함수에서 save·push·notify 호출 금지(C16). 되돌리기 저장은 호출측이 `saveData` 경로로만 한다(`applyImportedPayload`·`clearAssetData` 금지). 기준 없는 폴백 알림 금지(남의 변경을 내 변경으로 오탐)

### 거래 입력 처음 사는 종목·같은 조합 전환 (`src/lib/trade/effective-target.ts`·`new-stock.ts`, #5.134 #258·#259)

- `effective-target.ts`(순수): `findSameComboStock(target, candidates)`·`resolveEffectiveTarget(target, candidates)` — 신규 자산 등록의 증권사·종류가 같은 종목 보유 항목과 같으면 그 기존 항목(existing)이 실효 대상(증권사 빈 값은 비교 안 함). 거래 입력은 `groupCandidates`, 스크린샷 가져오기는 비유사(fuzzy 아님) 후보만 넘긴다. 저장 함수(`addTransactionsBatch`)·picker props 의미 무변경, 화면 선택값(target)은 그대로 두고 저장·미리보기·중복 검사만 실효 대상을 쓴다
- `new-stock.ts`(순수): `MARKET_CATEGORIES`(kr 4종/us 1종)·`findHeldByPicked`(AC-4, 양쪽 `normalizeTicker`·시장 군 비교)·`buildPickedStockDraft`·`withInitialPrice`(조회 실패 → 현재가 = 유효 체결 단가, `baseDate` 비움 — 오늘 날짜를 넣으면 시세 갱신이 건너뛴다). `link-track.ts` `trackTradeNewStock(link)`: 새 종목 저장 성공 뒤 `trade_new_stock`(+연결이면 `_linked`) 1회
- `ticker-search-nav.ts`: `nextSearchKey(key, activeIndex, length)` 검색 키보드 이동(공용 `TickerSearchField`)

### 직접 입력 기록 폼 공용 순수 함수 (`src/lib/trade/trade-form.ts`, #5.158 #311)
```typescript
resolveTradeRate({ input, currentRate, isForeign }): number | undefined // 체결 환율 단일 값: 칸>0 → 현재 환율>0 → undefined. 0 반환 0, 국내 undefined
shouldAskPastDate({ date, today, isNewSelected? }): boolean            // 과거 날짜 질문 표시(date < todayKst(), 빈 날짜·신규 자산 false)
roundTradePrice(value, currency): number                                // '현재가 넣기' 반올림 USD 3·JPY 4·KRW 0
```
- 거래 폼 `linkRate`(칸·미리보기·연결 금액·`÷ N`)와 `buildTransaction` 저장이 `resolveTradeRate` 하나를 쓴다. 해외 종목이 정해지면 칸을 현재 환율로 채우고(`rateTouched` ref로 사용자가 고친 값은 유지, 자동 값은 통화·환율 변경 시 재채움) 안내 `exrate-auto-help`. `trade-utils`(포지션 정·역)는 저장 포지션과 대칭이어야 해서 여기에 두지 않았다.
- 체결 환율 0(예전 폼에서 칸을 지워 저장) 읽기 보정은 `tax-utils.computeForeignRealizedGain` 한 곳(replay·매도 환율 모두 '값 없음' → 현재 환율 + `estimated`). `trade-utils`·`tradeKrwRate`는 손대지 않는다(후자는 이미 `>0` 검사).

### 거래 연결 계좌 (`src/lib/trade/linked-record.ts`·`link-text.ts`, #4.58 #103)
- `linked-record.ts`(순수, 정본): `cashLinkId`/`loanLinkId`(`ctx_link_<거래id>`·`ltx_link_<거래id>`)·`linkedTradeIdOf`·`findLinkedRecord`·`linkAmount`(수량×단가±수수료, 통화 최소 단위 반올림)·`isLinkDateAllowed`(거래일이 오늘 KST와 같은 달)·`linkCandidates`(같은 통화 현금 → 외화 거래면 원화 현금 → 대출, 0원 대출은 매도 후보 제외, #4.63 #119)·`linkAmountIn`(계좌 통화 기준 금액: 원화 환산 = `roundMoney((수량×단가±수수료)×tradeKrwRate, "KRW")` 한 번만 반올림, 환율 없으면 `"rate"`)·`needsKrwConversion`·`linkAccountCurrency`·`buildLink`(기록+잔액 patch 생성, 가드 실패 시 `{ok:false, reason}`)·`planRemoveLink`/`removeLink`(짝 기록 현재 값 기준 되돌림, `cashBalanceFloor`(cash-tx-utils, 하한 정본))·`stockLinkTrade`/`cryptoLinkTrade`. 접두어 문자열은 이 파일 밖에서 쓰지 않는다(`linked-record.test.ts` grep 단언).
- 환산 배수는 엔진 `tradeKrwRate`(`report/asset-report.ts`, export 1줄) 하나만 쓴다(사본 금지). `LinkTrade.exchangeRate?`(메모리 전용)·`BuildLinkResult` 실패 사유 `rate`. 거래 폼 `buildTransaction`이 빈 체결 환율을 저장 시점에 `resolveTradeRate`(연결 여부 무관, 현재 환율)로 채움 — #5.158에서 `linkEval.conv.rate` 분기 대체(스키마·저장 키 diff 0).
- `link-text.ts`: `evaluateLink`(표시 통화 = 선택 계좌 통화, `conv` 환산 정보)·`linkPreviewText`·`linkSavedToast`·`revertNoteText`·`revertToastSuffix`·`LINK_NONE`/`parseLinkValue`/`linkValueOf`. 신규 화면 문자열 금지어 단언은 `link-text.test.ts`.
- Context: `addTransactionWithPosition(tx, id, patch, link?)`·`addTransactionsBatch(…, newStocks, link?)`·`addCryptoTransactionWithPosition(…, link?)`·`delete{Transaction,CryptoTransaction}WithPosition(…, {revertLink?})` — 모두 `saveData` 1회.
- 결산: `matchRecordedTransferDetail` → `{out, in, viaLoan}`, `matchRecordedTransfers` = out − in. 골든 테스트 `report/__tests__/linked-settlement.test.ts`.


### restore-focus.ts (#4.62) — 창 닫힘 포커스 복귀 공용 함수
`restoreFocusAfterDialog(opener, { skipIfOtherDialog? })` (`src/lib/restore-focus.ts`) — onCloseAutoFocus에서 `e.preventDefault()` 후 호출. 순서: 보이는 `[data-tutorial="tutorial-fab"]`(opacity-0 제외) → 열기 직전 요소(DOM에 있을 때) → `main`(tabindex -1, `preventScroll`). `skipIfOtherDialog`면 닫는 창(`#fab-sheet`) 외 열린 `[role=dialog]`가 있을 때 생략. 사용처: `balance-resync-dialog`(#4.60, goAddRef로 '새로 추가' 시 호출측이 생략), FAB 시트(`floating-add-button`, `handoffRef`로 다른 창이 이어서 열리면 생략). 다른 FAB 경유 창은 이 함수를 직접 쓰지 않고 훅 `useReturnFocusOnClose(open)`(#4.64, 같은 파일)을 쓴다 — 열릴 때 직전 포커스 요소를 기억(layout effect), 닫힐 때 그 요소가 사라졌으면(FAB 시트 버튼) 이 함수로 복귀, 남아 있으면 Radix 기본 복귀. 반환 핸들러를 `DialogContent onCloseAutoFocus`에 연결. 적용: 부동산·실물·현금·대출·코인·주식 입력 창, 연도별 순자산 창, 보유 현황 맞추기 창.

### profitTone (#4.62) — 상세 화면 손익 0 표기 단일 출처
`profitTone(value, rate = value, digits = 0)` → `{ isZero, sign, colorClass, amount, rate }` (`views/detail/detail-summary-header.tsx`). `Math.round(value*10^digits) === 0`이면 부호 없음·`text-muted-foreground`·amount/rate 0(-0 방지), 아니면 `getProfitLossColor` + `+`. `ProfitMetric`·상세 탭 카드 행/펼침(코인·주식·부동산·실물)·허브 행이 사용. digits=1은 부동산 실투자금 수익률처럼 수익률 값 자체로 판정할 때. 공용 `theme.ts`·결산·Hero·성적표는 사용하지 않는다(환차손익·등락 칩도 범위 밖).

### 종목 한 장 (`src/lib/finance/stock-page.ts` · `price-history.ts` · `stores/stock-page-store.ts` · `hooks/use-price-history.ts`, #4.81 #157)
```typescript
// stock-page.ts — 순수 함수, 저장 0·서버 전송 0
buildStockGroupHead(items, rates, displayCurrency) → { merged, currentVal, profit, profitRate, quantity, averagePrice, valueText, profitText, rateText, colorClass }   // 상세·주식 행과 같은 mergeStockGroup+computeStockMetrics+formatByDisplayCurrency+profitTone (C65)
hasPriceFlow(stock) · groupStocksByRowTicker(stocks, ticker)   // 비상장·티커 없음·상장폐지 = 서버 요청 0 / 시장 비교 줄 → 전체 그룹
pickBuyTransactions(transactions, groupStockIds, type="buy") → BuyTx[]     // type 한 종류만(4.84 "sell"=매도 점)(purchaseDate로 점 금지, C74)
placeBuyDots(points, buys, windowStart) → { dots: BuyDot[], outsideCount }   // 매수일 이상 첫 봉(마지막 봉 뒤는 마지막 봉), y=봉 종가, 창 시작 전은 건수만
computeYDomain(min, max, avg) → { domain, clamped: none|up|down }   // 8% 여백, 평단이 범위 ±40% 안이면 도메인 확장, 밖이면 가장자리 고정
computePriceChange(points) → % | null
// price-history.ts(서버) — fetchPriceHistory·collectPages·buildPricePoints·rangeStart·computeListedFrom, PAGE_SIZE 100·MAX_PAGES 4
// stores/stock-page-store.ts — useStockPageStore { target: {groupStockIds,name,ticker,category,displayCurrency,origin:"stocks"|"market-compare"}, tradesFromStockPage }  (메모리만)
// hooks/use-price-history.ts — usePriceHistory(ticker, range, enabled) · requestPriceHistory · buildPriceHistoryUrl  (queryKey ["price-history", ticker, range], 요청 키 {ticker, range})
```

```
// lib/push/ (#4.93 알림, 4.91) — 서버에는 endpoint·keys(암호화)·알림 종류 ID(morning·kr·settle·tax)·cond만
// quotes.ts(server) — fetchUsQuotes(직전 미국 거래일)·fetchFxQuote(아침 환율: 기대일=오늘, 오늘 값=전일 값이면 flat 생략, #241)·fetchKrQuotes(16시: 코스피·코스닥+환율 `X`/FX@KRW)·changeFromSeries(마지막 행 날짜=기대 거래일 검증)·항목별 status ok|stale|fail|flat·estimateKisCalls(us,fx,kr)
// cron-run.ts(server) — runPushCron(req,"morning"|"kr"): 종류별 플래그(시세 없으면 미설정)·구독자별 합치기·`[push-cron]` 로그(quotes=·subs=morning:n|kr:n·건수). loadPushQuotes(today,{us,fx,kr},round) → {us,fx,kr,status} — 아침 = 미국 + 오늘 환율(국내 조회 0), kr 회차 = 오늘 국내 3종
// catalog.ts — PUSH_CATALOG(4: morning·kr·settle·tax)·normalizePushTopics·getPushTopic
// message.ts — buildMorningMessage(today,us,fx,cond: `미국 M/D 종가 … | 환율 …`, 국내 지수 0)·expectedCloseDate(today: 미국 기대 거래일, 조회·본문 공용)·isRepeatedClose(today: 미국 반복 거래일)·buildKrCloseMessage·mergePushPayloads(PUSH_MERGE_ORDER)·holidayMarketsOn, pushDueOn(todayKst) → [{kind,payload{m,t,b}}]·buildSettleMessage·TAX_PUSH_DATES(5/1·12/24). 결산 창 첫날 = settlement.ts isSettlementWindowOpenDay
// prefs.ts — secretasset.push_prefs {v:3,on,topics,cond}(v1·v2 무시·기본 off·미선택)·summarizePushPrefs·consumePushFlag(→ target morning|kr|settle|tax)
// client.ts — detectPushEnv(standalone 아니면 needs-install)·enablePush·updatePushTargets·unsubscribePush(keepPrefs)·sendTestPush·reconcilePush
// validate.ts — parseSubscribeBody(standalone 필수·허용 호스트·카탈로그 ID)·parseEndpointBody
// crypto.ts(server) — 5.113 HKDF 분리 — pushSubId=HMAC(HKDF(master,"…/subid/v2"), endpoint)·sealSecret="2:"+AES-256-GCM(HKDF "…/aes/v2" 키)·openSecret 구 형식(접두 없음·마스터 직접) 이중 읽기·pushSubIdLegacy(이행 기간 삭제·폴백 전용, 다음 릴리스에서 제거)·보관 30일(PUSH_SUB_TTL_SEC)·storage.capLegacyPushTtl(cron이 구 형식 만료를 30일로 1회 축소)
// prefix.ts — pushKeyPrefix() = push:{prod|preview|dev}: (VERCEL_ENV)
// send.ts(server-only) — isPushConfigured·sendPush(web-push, ok|gone|fail)
// cron-run.ts(server-only) — runPushCron(req)·kstToday·isCronAuthorized (Cron 1개 /api/push/cron, 시세 호출 0)
// cache-storage.ts — putPushSub/getPushSub/deletePushSub/listPushSubIdsByTopics/markPushSent (접두어·암호화는 저장소 내부 처리)
```
- 스크린샷 평단·현재가 정합(#196, 5.0): `parse-screenshot/price-consistency.ts reconcilePrices(cur, avg, rate, {quantity?, currentValue?, profitAmount?})` → `{currentPrice, averagePrice, action: keep|swap|estimate}`. swap 전 E1(평가금액÷수량)·E2(손익/수익률 부호) 교차 확인, 근거 없으면 4.99 동작.
- 이미지 단위 정합(5.101): `reconcileImagePrices(rows: {currentPrice, averagePrice, profitRate, evidence?}[])` → 행별 결과 배열. 한 이미지의 위치 방향을 swap 다수결로 소수익률 행에 적용(동률·근거 부족이면 행별 `reconcilePrices` 그대로). `name-normalize.ts stripTrailingQuantity`는 `(숫자` 꼬리·`구분 | 티커`·말줄임 제거 + 마스터 표기 통일.

### report/networth-benchmark.ts (#5.102 #201) — 가계 통계 순자산 구간 판정 순수 함수
- 상수 `src/config/household-networth-stats.ts`: `HOUSEHOLD_NETWORTH_STATS { meta | null, brackets[] }`(`min`/`max` 원 단위·`null`은 열린 끝, `sharePct` 공표값 그대로, `label?`은 원문 표기 고정용), `EOK`·`MAN`. 현재 값 = 통계표 12 2025년 순자산 분위 경계값(10구간·각 10%, `referenceDate`는 확인 불가 시 null, `tableSource.url` 선택). 통계 교체는 이 파일만.
- `validateStats(stats)` → 통과 시 `{meta, brackets}`, 실패 시 null(빈 배열·meta 누락·구간 5개 미만·열린 끝 위치·경계 빈틈/겹침·소수 자리 초과·합 오차 > 구간 수 × 0.5 × 10^-shareDecimals).
- `findBracketIndex(netAsset, valid)`: `Math.round(netAsset)`으로 비교(홈 헤더 표시와 같은 정수), `boundary`(lower/upper-inclusive)대로 귀속, 비유한값 null.
- `computeCounts(index, valid)` → `{n, m, isTop, nText, mText}`: 누적을 `sharePct × 10^shareDecimals` 정수로 더해 반올림, `N = U − L`·`M = 100 − U`, 최상위(`max === null`)는 U=100·`mText` null, `N === 0 || sharePct < 0.5`·비최상위 `M === 0`은 `약 1곳 미만`. `benchmarkSentence(counts)`.
- `bracketLabel(b, boundary)`(경계를 만원 단위 그대로 `1억 296만`으로 표기·반올림 없음, `label` 우선), `buildNetworthBenchmark({netAsset, realEstateCount, stats})` → 행(라벨·mine)·`columnLabel`(비중이 모두 같으면 `순자산 구간(가구 10%씩)`)·`hidden`(부동산 0건이 음수 판정보다 먼저)·문장·라벨/출처 조각, 검증 실패면 null.
  - v2 구성 표: `mapMyComposition`(앱 → 통계 분류), `sharePctOf`, `quintileOf`(10분위 → 5분위 올림), `buildCompositionView`, `boundaryText`(export, 억·만 표기 재사용). 상수 `HOUSEHOLD_COMPOSITION`(전체 1 + 5분위 5, 원 단위·원문 그대로)은 `config/household-networth-stats.ts`.

## 투자 탭 유틸 (`src/lib/invest/`, #5.137 #263; 5.145부터 앱 탭 없음 — 공개 가이드 전용)
- 5.145: `navigation-context.tsx` `isRetiredHash`(폐지 `#invest*` 판정 → 초기·popstate에서 replaceState로 홈), `trial-exit.ts`·`ga.ts`의 `source:"invest"`·`웰컴·체험·투자`·화면 키 `invest` 제거(`invest_*` category·가이드용은 유지)
- `types.ts`·`calc.ts`(지그재그 −15%·금리 방향 0.25%p·NBER 겹침·`buildIndexView`·`calcInvest`(반올림 전 값)·`pickDefaultIndex`·`rateAxisMax`), `text.ts`(문장·출처 4줄·금지어 규칙 R1~R11), `chart.ts`(logTicks·`mergeEventDots` C1·`bandRect`·`stepPath`), `default-index.ts`(`holdingSplit` 기기 안 계산), `market-history.ts`(정적 데이터 진입점, 투자 번들 전용)
- 데이터: `data/market-history/*.csv` 정본 → `scripts/market-history/build.mjs`(`--check`) → `data/market-history.generated.json` + `public/datasets/market-history/`(CC BY-SA, Damodaran 수준값 제외). `verify-h15.mjs`는 H.15 XML과 10년물 월말 전 월 대조. 갱신 절차 `docs/ops/market-history-refresh.md`
- 저장 키 0·서버 전송 0·새 API 0. GA는 `invest_*` category 6종(page_title만)
- R4: `pattern.ts` — `buildPattern`·`RISE_THRESHOLD`(>+20%, 반올림 전)·`monthsLabel`. 데이터 `spread-monthly.csv`·`events-extra.csv`(점 없는 사건 10건). GA category `invest_rise_tab`·`invest_pattern`
- 5.138: `main-chart.tsx` — `xLabelPlan(PW, span)`(x축 라벨 폭별 규칙 1곳: 5년→5년 `'80`→10년→10년 `'80`→20년, 간격 ≥4px) · `retAxisCap(view, max, min)`(연간 등락 상한: 나스닥 +60·코스피 +80, 넘으면 막대 자르고 실제 값 라벨). `decade-table.tsx` `decadeCounts()`(연대별 오른 해 수). GA category `invest_year_pick`·`invest_drop_open`(투자·해 선택/하락 행 펼침, 진입당 1회, 연도·금액 0)·`guide_move`(가이드·내 자산 이동, 홈 이동 link CTA). 데이터 `events-year.csv` 54행(1996 연준 의장 연설 추가)
- 5.139: `calc.ts` `blsYear`·`IndexView.same`·`YearRow.cpi/un`, `guide-tables.ts`(`hikePhases`·`hikeYearRows`·`recessionYearRows` — 개수만, 인상 국면=첫 인상~인하 전 마지막 인상), `text.ts` `BLS_SOURCE`·`BLS_INFO`·`BLS_GAP_NOTE`·`fmtPct1Plain`. 데이터 `data/market-history/macro-us-bls.csv`(FRED CPIAUCNS·UNRATENSA 월값의 12개월 평균, 1961~2025, 2025는 10월 미공표로 빈 칸), `events-year.csv` 93행(1962~, 한국 1건 IMF 보도자료, 빈 해 1963·1983·1988·2006). 원자료·스크립트는 memory `issues/5.139-267-invest-r2/{data,tools}`
- 5.141: `three.ts`(신규 순수 함수 — `commonRange`·`classifyYears` A1 5분류(합=공통 해 수)·`sameYearRets`·`decadeRows`(누적·해마다 평균은 `periodResult` 재사용)·`decadeText`), `text.ts` **`TERMS`**(용어 사전 단일 출처: 지수 ⓘ `INDEX_INFO`·`LIST_SUB`·`CALC_DIV`·`GLOSS`·출처 패널 `PANEL_TERM_IDS`가 참조, 이음 마침표는 `LIST_SUB_SENTENCE` 1곳) · `recoverySummary`(A4) · `THREE_TEXT`·`threeSourceLines`·`topic`(은/는) · `RATIO_LINK_LABEL`(= 가이드 RATIO_CTA 문구, 테스트가 일치 고정) · `guide-tables.ts` `recoveryRows`·`kospiDropYears`. 네비 `navigation-context.tsx` `parseHash`가 `#invest/…` 전부 투자 탭으로 받고 `isSameNavHash`로 재탭 push 0, 칸 선택은 InvestView가 `#invest/three`를 마운트 때 1회 읽음. `trial-exit.ts` `invest` → `source:"invest"`(`웰컴·체험·투자`). GA category `invest_three`·`invest_decade`·`invest_ratio`(값만 추가, 파라미터 키 0), source 값 `invest`, 화면 키 `guide:recovery-years`·`guide:kospi-by-year`. 저장 키·서버 요청 0
- 5.142: `three.ts` `criterionRows`(A2 — 기준 `rate|cpi|unemp|spread`, 분류는 PatternSection과 같은 `classifyDelta(rateDelta)`·`blsYear`·`spreadNegMonths`(pattern.ts에서 export)) · `a2Class`·`spreadFirstMonth` · `recessionAround`(A3 9구간 전해·시작 해·끝난 다음 해, `view.ret`·`recessionLabel` 재사용). `period.ts` `rollingRange`(A6, `periodSeries` 한 번에 넣기 배수만 사용)·`lumpCagrOf`(기간 카드·A6 공용 식). `text.ts` `TERMS.rateDir`·`TERMS.spreadNeg`(`patternNote`가 참조, 출력 글자 동일)·`A1_INFO_FIRST`·`A2_TEXT`·`A3_TEXT`·`A6_TEXT`·`a6Bounds`·`B1_OPTION`. `default-index.ts` `firstBuyYear`(B1, 기기 안 전용·상장폐지·수량 0·무효 날짜 제외). `lib/xray/region-split.ts` `regionSplit`(B2 — X-Ray 지역 축 `computeBreakdown("region")`·`formatBreakdownPct` 그대로: 국내=`KR`, 해외=US·JP·CN·HK 비중 합, 기타=`Other`, 100−국내 금지, 분류 캐시 읽기만·네트워크 0). `guide-tables.ts` `monthlyBuyingRows`(G2, `periodResult` 재사용). `InvestView` 신규 props `firstBuyYear`·`mySplit`·`onOpenXray`(호출부 `InvestTab`이 체험·자산 0이면 비움), D3 `hashchange` 구독(앱 전용). GA category `invest_phase_table|invest_recession|invest_range|invest_my_start|invest_my_xray`(값만 추가), 화면 키 `guide:monthly-buying`. 저장 키·서버 요청 0
- 5.143 R3-3(#280·#282): `calc.ts` `fxYear`·`fxAxis`(원/달러 연평균 1982~·오른쪽 축 100원 단위 내림·올림, 눈금 `ticks3`/`ticks4`), `text.ts` `FX_SOURCE`·`FX_INFO`·`FX_DATASET_HREF`·`FX_DATASET_LABEL`, `guide-tables.ts` `spreadYearRows`(G4: `spreadNegMonths`·A1 규칙 재사용), `year-grid.tsx` 칸 글자는 `fmtPct` 한 벌. 데이터 `data/market-history/fx-krw-usd-annual.csv`(`build.mjs`가 JSON `fx`·공개 CSV 생성, 변환 도구는 memory 이슈 폴더 `tools/make-fx-annual.mjs`, 원자료 `data/EXKOUS.csv`). 저장 키·서버 요청 0.

### broker-totals (`src/lib/asset/broker-totals.ts`, #5.160 #319)
- `computeBrokerTotals(stocks, rates, displayCurrency)` → `{ rows, scale }`. 행 = `{ name, unassigned, count, valueUnits, profitUnits, profitRate|null, shareTenths }`(units = 원/센트). 묶음 = `sameBroker`·`isUnassignedBroker`, 평가·손익 = `computeStockTotals` 묶음별 호출 + `apportionUnits`(최대 잔여)로 합 = 헤더. 비중 = `largestRemainderTenths`.
- `brokerCashByRow(rows, cash, rates)`(#5.167 #335) → `Map<행 이름, 원화 정수>`. 행 이름이 증권사 목록 값(`기타` 제외)이고 공백 지운 `cash.institution`이 **정확히 같은** 현금만 `Math.round(Σ balance × getMultiplier)`. `sameBroker`(부분 일치) 미사용 — `키움`·`하나`·`하나은행`·`기타`·자유 텍스트·미지정은 조인 0. 합 0원 행은 Map에 없음. 읽기 전용 참고값으로 헤더·행 평가금·비중에 더하지 않는다(C150).
- `resolveScreensWithDefaultBroker(screens, existing, opts, defaultBroker?)`(`resync/merge.ts`) — 확정 못 한 장에만 증권사 기본값. `dispatchAddStock(mode, broker?)`·`HoldingsResyncDialog initialBroker?`(UI 상태, 저장 0).

### exchange-totals (`src/lib/asset/exchange-totals.ts`, #5.163 #325)
- `computeExchangeTotals(crypto)` → `BrokerTotalRow[]`(broker-totals와 같은 행 모양, units = 원). 모집단 = 수량>0 전체(목록의 `value>0` 필터 미사용 — 헤더 `getAssetSummary().cryptoValue·cryptoProfit`과 같음). 합계 target은 헤더와 같은 순서·같은 식으로 더한 값의 `Math.round`, `apportionUnits`로 행 합 = 헤더 표시값. 비중 `largestRemainderTenths`(합 1000). 정렬 = 평가금 내림차순, 미지정 맨 아래. 코인 수 = 거래소 안 심볼(대소문자 무시) 고유 수.
- `exactExchangeLabel(raw)` — 공백·대소문자를 뺀 값이 `cryptoExchanges` 라벨·value와 **완전히 같을 때만** 라벨. 부분 일치가 필요한 가져오기·맞추기는 기존 `matchExchangeHint`(`resync/crypto.ts`)를 그대로 쓴다. 자유 텍스트 묶음 키는 공백만 뺀 글자 그대로.
- GA: `feature_use` category `crypto_exchange_open` → title `상세·암호화폐·거래소별 열기`(`ga.ts` 허용 목록·`featureTitleOf`).
