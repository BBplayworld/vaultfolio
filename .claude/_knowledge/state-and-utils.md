# 상태 관리 & 유틸 함수 참조

> 마지막 업데이트: 2026-08-01 (원인분해 income/cash 분리·deposit 신설·기간 하이브리드 합성)

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

## LoanTxViewStore (`src/stores/loan-tx-view-store.ts`)

대출 상환/추가 대출 내역 뷰(`loan-transactions` 탭) 진입 대상 전달. `target: { loanId, name } | null` · `setTarget`/`clear`. `CashTxViewStore` 미러링(S-4.24).

## CryptoTxViewStore (`src/stores/crypto-tx-view-store.ts`)

암호화폐 매수/매도 내역 뷰(`crypto-transactions` 탭) 진입 대상 전달. `target: { cryptoId, name } | null` · `setTarget`/`clear`. `CashTxViewStore` 미러링(S-4.25).

## TaxViewStore (`src/stores/tax-view-store.ts`, S-4.32)

세금 관리(`#tax`) 페이지 진입 시 초기 탭(`"schedule"|"simulator"`) 지정. `initialTab: TaxInitialTab | null` · `setInitialTab`/`clear`. `#tax` 내부 탭은 URL이 아닌 로컬 state라 외부(홈 팁 박스 등)에서 직접 지정할 수단이 `loan-tx-view-store` 류의 "진입 대상 미리 지정 후 navigate" 패턴뿐이라 재사용. `tax-calendar-view.tsx`가 `useState` 초기값 함수에서 1회 소비 후 즉시 `clear()`.

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
getAssetDrivenHighlights(assetData, today?, limit=3): TaxEventMatch[]  // 홈 배너 전용 — common 전용 항목 제외
isTaxNoticeDismissed() / markTaxNoticeDismissed() / shouldShowTaxNotice(assetData)
todayKst() / currentMonthKst()                   // KST YYYY-MM-DD / YYYY-MM
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
실현차익은 `trade-utils.computeNewPosition`으로 이동평균 원가를 replay해 산출하며, 매수 로그·체결 환율 누락 시 현재 평단·환율로 폴백하고 `estimated: true`를 세운다.
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

```typescript
viewToKey(view: AssetView): string          // "type" 또는 "type:tab" — navigate 훅·카탈로그 공유 방문 버킷 키
recordVisit(key: string): void              // 문자열 키 직접 기록(action형 항목도 자체 키로 기록 가능)
isTipDismissed(id): boolean / dismissTip(id): void   // 영구 dismiss(재노출 없음)
pickRecommendedFeature(): AppFeature | null
  // 1순위: dismiss 안 된 isNew(카탈로그 순) — 2순위: dismiss 안 된 항목 중 방문횟수 오름차순(0회 우선, 동률은 카탈로그 순)
  // 전부 dismiss면 null
```
onboarding-wizard-status.ts와 동일한 "단일 키 + JSON 객체" 패턴(`STORAGE_KEYS.featureUsage`). 기기 로컬 전용 — 동의 UI 없음(`lastVisitDate`·`assetRefresh`·`tutorialStatus` 등 기존 로컬 전용 키들과 동일 원칙), sync payload 미포함(R14), `clearAssetData` keepKeys에도 넣지 않음(전체 초기화 시 함께 리셋되어도 무방).
카탈로그는 `src/config/app-features.ts`의 `APP_FEATURES`(`AppFeature[]`) — `id`/`title`/`description`/`icon` + 이동 방식(`target`(navigate) 또는 `action`(이동 없이 그 자리에서 실행, 예: 인증카드 다이얼로그 오픈) 중 하나, `beforeNavigate`로 target 진입 직전 로컬 서브탭 지정). `navigation-context.tsx`의 `navigate()` 본문에 `recordVisit(viewToKey(v))` 훅 1곳으로 모든 이동을 커버하고, action형(`share-card`)은 `top-bar.tsx`의 `trigger-open-share-card` 리스너가 `recordVisit("share-card")`를 직접 호출(asset-dispatch.ts↔feature-usage.ts 순환 참조 방지 목적으로 dispatch 함수 자체엔 기록 로직을 넣지 않음).

### home-tip.ts (S-4.32 후속) — 홈 알림/팁 통합 판정

```typescript
pickHomeTip({ assetData, hasAssets, syncArmed }): HomeTip | null
  // HomeTip = { kind: "notice" } | { kind: "backup", days } | { kind: "tax", matches }
  //         | { kind: "refresh", staleCategories } | { kind: "feature", feature }
  // 새 공지는 **필수 노출**(readNoticeSeenId()!==NOTICE_ID) — 다른 무엇보다 최우선, 안전 안내(백업·세금)보다도 먼저 반환.
  // 그다음 위험도 순: 백업(shouldShowBackupNudge) > 세금(isTaxNoticeDismissed===false && getAssetDrivenHighlights) >
  //                 자산최신화(shouldShowRefreshNudge) > 기능(pickRecommendedFeature) — 첫 매치 1개만 반환
```
`backup-status.ts`/`asset-refresh-status.ts`/`tax-utils.ts`/`feature-usage.ts`의 기존 순수 함수를 그대로 조합만 한다(신규 판정 로직 없음). 4종을 독립 컴포넌트(`BackupNudge`/`RefreshNudge`/`TaxNoticeBox`/`FeatureTipBox`)로 각자 띄우던 것을 `home-tip-box.tsx` 1개로 통합하며 도입 — 종류별 "오늘/이번달/영구" 재노출 정책은 각 원본 유틸에 그대로 남아있고, 승자가 아닌 종류는 "오늘 떴다" flag를 찍지 않는다(호출부 책임, [components.md](components.md) `HomeTipBox` 참조).

**`notice` 종류(#4.24 재도입, 필수 노출)** — 과거 홈 진입 시 자동 팝업하던 `UpdateNoticeDialog`는 S-4.32에서 "기능 추천" 프레임으로 대체하며 의도적으로 제거됐었다. 이번엔 그 방식(강제 팝업) 대신 **다른 팁과 동일한 카드 1장**으로 재도입하되, **우선순위를 맨 위로**(백업·세금보다도 먼저) 둬 신규 버전 안내가 사용자가 보거나 닫기 전까지 반드시 뜨게 한다 — `isNoticeUnseen()`(`readNoticeSeenId() !== NOTICE_ID`, `home-tip.ts` export)이 true면 노출.
- **최초 1회 노출 보장**: `home-tip-box.tsx`의 `useEffect`는 `isNoticeUnseen() && !NOTICE_SHOWN_SESSION_KEY`인 동안(= 미열람 공지가 이번 세션에 아직 한 번도 안 뜸)만 `SESSION_DISMISS_KEY`(공용 세션 숨김 플래그) 체크를 **건너뛰고** `pickHomeTip`을 호출한다 — 다른 팁의 X 닫기가 공지의 "최초 1회 노출"을 못 막게. 공지 tip이 실제 렌더되면 `NOTICE_SHOWN_SESSION_KEY`를 세워 바이패스를 끈다. 그 뒤부터는 X 닫기(→`SESSION_DISMISS_KEY`)가 정상 작동해 **같은 세션 내 재진입 시 재노출 안 됨**. 새 세션(sessionStorage 초기화)에선 다시 바이패스 활성 → 미열람 공지 재노출(#4.24 후속, QA에서 "X 닫고 홈 재진입 시 재노출" 버그 수정).
- **열람 처리는 클릭에서만, 공지 본문이 아니라 해당 기능으로 직행**(#4.24 후속): 클릭 시 `markCurrentNoticeSeen()`(`home-tip.ts` export, TTL 90일)으로 영구 열람 처리하면서 `dispatchOpenNotice()`(공지 다이얼로그) 대신 **이번 릴리스가 홍보하는 실제 기능**을 바로 연다 — `dispatchOpenShareCard("portfolio")`(`asset-dispatch.ts`, `variant` 인자 지원)로 인증카드를 포트폴리오 타입으로 즉시 오픈. 공지 문구만 보여주고 끝나지 않고 결과물을 바로 체험시키는 의도. **다음 릴리스에서 홍보 대상이 바뀌면 `home-tip-box.tsx`의 이 액션도 `notice.tsx` 콘텐츠와 함께 갱신해야 한다** — 자동 연동 아님. 이제 아무도 안 쓰는 `dispatchOpenNotice`/`trigger-open-notice`는 삭제(더보기 메뉴의 수동 열람은 `tool-menu.tsx`의 `showNotice` 로컬 상태로 그대로 유지).
- **X 닫기는 세션 숨김만**(#4.24 후속, 영구 dismiss 아님) — `markCurrentNoticeSeen()`을 호출하지 않고 `SESSION_DISMISS_KEY`만 세워 이번 세션에서만 숨긴다. 다음 세션엔 `isNoticeUnseen()`이 여전히 true라 다시 최우선으로 떠서, 사용자가 실제로 공지를 최소 1번 열어보게(또는 더보기 메뉴에서 수동으로 열람) 강제한다.

### holdings-conflict.ts (S-4.30) — 보유현황 스크린샷 재등록 시 병합(merge)/전체교체(reset) 공용

```typescript
keyOfStock(s) / keyOfCrypto(c) / keyOfCash(c) / keyOfLoan(l): string   // 카테고리별 중복 판정 키
countConflicts(existing, incoming, keyOf): number
resolveKept(existing, importedKeys, mode: "merge"|"reset", keyOf): T[]  // merge=겹치는 기존 항목만 제외, reset=전부 제외
```
`crypto-screenshot-import.tsx`가 최초 구현한 패턴을 일반화 — stock은 `ticker:category`, cash는 `name:institution`(근사), loan은 `name:institution:type`으로 매칭. cash/loan은 스키마에 고유 식별자가 없어 근사 매칭(오매칭 가능, preview에서 사용자가 개별 체크/해제).

### asset-refresh-status.ts (S-4.30) — 카테고리별 자산 최신화 상태(홈 넛지용)

```typescript
markCategoryRefreshed(category)              // 보유현황 스크린샷 등록 성공 시 호출
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
costFxRevaluation(data, prevFx, currFx)              // → { stock, cash } 외화 원가의 환율만으로 인한 재평가분 — saving에서 제외해 fx와 이중귀속 방지
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
- `yearlyAnchorPoints(assetData)` — `assetData.yearlyNetAssets`(연도별 종가 순자산, netAsset만)를 `YYYY-12-31` 앵커로 승격해 후보 풀에 추가. enrich가 없어 항상 예측 경로로만 쓰이지만, daily(30일 롤링)·monthly(올해분만)가 못 미치는 먼 과거에서도 "기록 없음" 대신 예측 시작점을 잡을 수 있게 한다.
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

### pwa/background-gate.ts — 자동 백그라운드 동작 차단 판정

```typescript
isBackgroundWorkBlocked(): boolean       // isInAppGateActive() || isPwaLocked()
```
전체화면 게이트(인앱 브라우저 게이트·앱 잠금)가 덮고 있는 동안 시세·환율·코인·스냅샷 저장·부동산 재조회·연결 모달 등 **사용자가 인지하지 못하는 부작용**을 막는다. 게이트가 2종이라 지점마다 따로 쓰면 한쪽을 빠뜨리므로 반드시 이 함수를 경유한다(R22).

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
  // useLivePrice:true(2026-08-27, stock-tab.tsx 상세 > 주식 리스트 등락율 전용): 분자를 st.currentPrice(실시간)로 교체,
  //   baseline은 refDate===오늘이면 prevPrice, 아니면 refPrice — 둘 다 "가장 최근 확정 종가"로 수렴해 시간대 무관하게 일관됨

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

// 인증카드 캡처 DOM 전용 토큰 (sm: 없음 — R32).
ASSET_THEME_SHOT      // 프리뷰용 = ASSET_THEME 모바일값(sm:/lg: 제거): cardInfoName/cardAmountMain 14, summaryValue 20,
                      //   profitAmount 16, profitRate 14, icon size-6, iconInitial 9, badge 10, bodyText/legendText 14,
                      //   footerBrand text-xs, footerDomain text-sm. 간격 키(cardHeader/cardTriggerButton/legendGrid) 고정.
ASSET_THEME_SHOT_BIG  // 저장 PNG 캡처용 = 위 폰트/아이콘을 SHOT_BIG_SCALE배 한 결과를 하드코딩(현재 1.46:
                      //   20/29/23/20/35px, iconInitial 13, badge 15, footer 18/20). 간격 키는 SHOT과 동일.
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

### X-Ray 분류 자동 fetch (`src/lib/xray/use-xray-classifications.ts`)

- `useXrayClassifications(stocks) → { tick, progress }` — 마운트/`stocks` 변경 시 `fetchAndStoreClassifications(stocks, onProgress)` 실행(캐시 완비면 즉시 no-op, 모듈 `inflight` dedup), 완료 시 `tick++`.
- **사용법**: `tick`을 `computeBreakdown`/`pickHighlights`를 감싸는 `useMemo` deps에 넣어 localStorage 분류 갱신을 재계산에 반영(`classification-store`엔 구독 메커니즘이 없음).
- **트리거 끄기**: 빈 배열(`[]`, 안정 참조)을 넘기면 no-op — 조건부 실행에 사용(예: 인증카드 다이얼로그는 `open && variant==="portfolio"`일 때만 `assetData.stocks` 전달).
- 소비처 3곳: `stock-xray-view.tsx`(진행률 % 표시), `stock-insight-strip.tsx`(백그라운드), `ShareScreenshotDialog`(포트폴리오 분야 막대바). 이전엔 앞 2곳이 동일 useEffect+tick 패턴을 복붙했으나 이 훅으로 통합.

### 종목 유형 분류 (`STOCK_TYPE_ENUM`, `src/lib/xray/classification-store.ts`)

- `STOCK_TYPE_ENUM`(8개: 성장주/**혁신주**/배당성장주/배당주/지수투자/가치주/채권·현금성/기타) — 한 종목당 정확히 1개 배정하는 **"종목 유형(투자 성격)"** 축(#4.24). `SECTOR_ENUM`(산업이 뭔가)과는 별개 축이라 혼용 금지 — 의도적으로 "투자 스타일"이라 부르지 않는다(투자자의 스타일이 아니라 종목 자체의 성격). **혁신주**는 검증 안 된 파괴적 기술 베팅(매출 미미·적자, 성패가 이분법적 — 로켓랩·아이온큐·임상단계 바이오텍류)을 대형 흑자 성장주(성장주)와 분리하기 위해 추가.
- `KnownClassification.stockType`에 저장, Gemini 분류(`api/xray-classify/route.ts`)가 `sector`와 나란히 채운다.
- `stock-xray.ts`의 `extractStockType`이 소비 — AI가 업종명 고정관념으로 흔들리기 쉬운 대표 ETF·우량주는 티커·이름 하드코딩 매핑으로 우선 확정(전수 목록 아님, 대표 예시만 — `extractIndex`의 `US_INDEX_ETF_MAP`·`extractSector`의 `domesticOverrides`와 동일한 "확실한 것만 하드코딩" 철학):
  - `COVERED_CALL_TICKERS`(JEPI/JEPQ/QYLD/YMAX 등) → 배당주, `DIVIDEND_GROWTH_ETF_TICKERS`(SCHD/DGRO/VIG 등) → 배당성장주 — 두 상품군이 AI 판단으로 뒤바뀌는 걸 원천 차단.
  - `DIVIDEND_ARISTOCRAT_TICKERS`(KO/PG/JNJ/O 등 25년+ 연속 증액) → 배당성장주, `HIGH_YIELD_VALUE_TICKERS`(T/VZ/MO, KT&G/KT 등) → 배당주, `TRADITIONAL_VALUE_TICKERS`(BAC/WFC, 국내 금융지주 등) → 가치주, `INNOVATION_TICKERS`(RKLB/IONQ/JOBY/ACHR) → 혁신주.
  - `BOND_CASH_TICKERS`/`BOND_CASH_NAME_KEYWORDS`(SGOV/TLT/국채 등) → 채권/현금성(최우선순위 아님, 위 개별 오버라이드 뒤에 체크).
- **`STOCK_TYPE_PROMPT_VERSION`**(classification-store.ts) — stockType 분류 규칙(프롬프트·오버라이드 목록)이 바뀔 때마다 올리는 버전 마커. 서버 캐시 유효성 체크(`xray-classify/route.ts`)와 클라이언트 게이트(`fetch-classifications.ts`) **양쪽 다** 이 값과 일치해야 "분류 완료"로 인정한다 — 하나라도 빠뜨리면 그쪽에서 재분류 요청 자체가 안 나가는 버그가 난다(2026-09-05 실제 발생·수정). 버전을 올리면 이미 (구버전 규칙으로) 캐시된 종목도 전부 강제 재분류된다.

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
