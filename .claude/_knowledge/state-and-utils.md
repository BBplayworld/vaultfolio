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
`PositionLike`/`TxLike`(같은 파일 export)는 필요한 필드만 뽑은 구조적 타입 — 주식(`Transaction`/`PositionSnapshot`, `stockId`)뿐 아니라 코인(`CryptoTransaction`, `cryptoId`, 환율 없음)도 그대로 통과한다. **잔액 선형 가감(현금·대출)이 아니라 수량×평단이 바뀌는 자산이면 여기를 재사용**하고 cash-tx-utils류를 새로 만들지 않는다. `validateReflection`(`src/lib/validate-reflection.ts`)도 동일 원리로 `TxLike`/`PositionLike` 제네릭.

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
