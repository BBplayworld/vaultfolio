# 컴포넌트 참조

> 마지막 업데이트: 2026-06-22

## 자산 컴포넌트 (`src/app/(main)/_components/`)

### PhysicalInput · PhysicalTab (`forms/asset-update/input/physical-input.tsx`, `views/detail/tabs/physical-tab.tsx`, #4.55)
- 실물 자산 폼(Dialog+react-hook-form, 이벤트 `trigger-add-physical`/`trigger-edit-physical{id}`, `dispatchAddPhysical`)과 상세 탭(real-estate-tab 복제·축소: 카테고리 선택기·비중 막대 없음). 색은 `MAIN_PALETTE[8]` 고정. 허브 카드는 `physicalCount>0`일 때만. 신규 공용 컴포넌트·토큰 없음.

> **구조 변경(2026-06)**: `(main)/asset/` 레이어 제거 → `(main)/_components/`로 평탄화, `header` → `header-menu`로 rename. (이전 2026-05-23 rename: `bottom-nav`→`forms`, `main-nav`→`views`, `top-nav`→`header`)

```
_components/
├── forms/                 # 자산 입력 폼 + 스크린샷/거래 다이얼로그
│   ├── asset-update/
│   │   ├── input/          # 자산 입력 폼 + 목록 렌더링
│   │   │   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   │   │   └── real-estate-input.tsx, cash-input.tsx, crypto-input.tsx, loan-input.tsx
│   │   ├── balance-resync-dialog.tsx   # 현금·대출 잔액 맞추기(#4.52 #93)
│   │   └── screenshot/     # 스크린샷 가져오기 다이얼로그
│   │       └── stock/crypto/cash/loan-screenshot-import.tsx  # 4종 모두 upload→conflict(중복 시)→preview, 병합형(merge/reset, S-4.30) — `lib/holdings-conflict.ts` 공용
│   └── trade/              # trade-input, trade-screenshot-import(주식), crypto-trade-screenshot-import.tsx(코인, S-4.30)
│       └── guards/delete-rollback-dialog.tsx  # 반영 거래 삭제 롤백 확인
├── views/                 # 페이지 본문 콘텐츠
│   ├── home/dashboard.tsx           # 도넛+필터칩(InlineSelector) — Dashboard()
│   ├── detail/
│   │   ├── asset-detail-tabs.tsx    # 5탭 컨테이너 + 공통 유틸 export
│   │   ├── detail-hub.tsx, detail-summary-header.tsx
│   │   ├── tabs/                    # stock/real-estate/cash/crypto/loan-tab
│   │   │   └── stock-tab.tsx        # Card+CardHeader+CardTitle 외피, StockCard(screenshotMode·maskFn), 카테고리 selector는 SummaryHeader 아래
│   │   ├── trades/stock-trades-view.tsx
│   │   └── xray/                    # stock-xray-view
│   └── activity/
│       ├── net-asset-chart.tsx      # Hero(현재 순자산+전년 대비) + 년도별/일별 InlineSelector(CardHeader). view prop(제어) 시 제목·Hero 숨기고 ChangeHero로 대비값
│       ├── asset-change-view.tsx    # 자산 변화 셸(범위×기간) + 전체·주 목록 (#4.34)
│       ├── settlement-view.tsx      # 전체·월 = 월말 결산 블록 1·2·3·7 (#4.34)
│       ├── profit-chart.tsx         # 카드 헤더 InlineSelector + 시장 selector(size sm) + collapse 안 기준종가표. period prop(제어) 시 제목·요약 박스 숨기고 ChangeHero(로딩 스켈레톤·점검 중 포함)
│       ├── dividend-chart.tsx       # Hero(연간/월 배당) + InfoHint + 카테고리 범례 + 예상/실제 토글
│       └── performance-hub.tsx, monthly-dividend-stocks.tsx
├── layout/                # 라우팅·공용 UI
│   ├── navigation/        # navigation-context(NavigationProvider+useAssetNavigation), asset-page-tabs(view 분기 라우터), asset-dispatch
│   ├── ui/                # inline-selector(size sm/md/lg), kpi-card, info-hint(터치 40px 확장 #4.49), prompt-preview-dialog(onCopy·copyPrompt, #4.37)
│   ├── floating/          # floating-add-button(bg-foreground/85 FAB), scroll-to-top
│   ├── onboarding/        # welcome-guide
│   └── copyright-footer.tsx
├── header-menu/           # top-bar(←+타이틀+아이콘), tool-menu, settings-page, app-guide
│   └── share/             # share-card, share-menu
├── functions/cloud-sync/  # cloud-sync-menu-entry, cloud-sync-connect-dialog, sync-qr
├── pwa/                   # 설치 흐름 공용 + 가이드 (architecture.md 참조)
└── tutorial/tutorial-overlay.tsx
```

---

### AssetPageTabs (`layout/navigation/asset-page-tabs.tsx`) — drill-down 라우터

`useAssetNavigation().view` 분기로 단일 view만 mount.

- **HomeView**: InlineSelector size="lg" (홈/상세/성과) + Dashboard. 상세/성과 클릭 = drill-down 진입
- **DetailView({tab})**: InlineSelector(주식/부동산/암호화폐/현금/대출) + 해당 탭 컴포넌트 (1개만 mount)
- **ActivityView({tab, init})**: 허브(`PerformanceHub`) 또는 `AssetChangeView`(`change`, `view.init` 전달)·DividendCard·AssetReportView (#4.34에 netasset/profit 탭 → change 통합)
- 입력 폼 8종(자산 5종 + Cash/Loan/CryptoTx) `<div className="hidden">` 래핑으로 DOM에 상시 마운트 (편집 다이얼로그용)
- **CashTxInput** (`forms/asset-update/input/cash-tx-input.tsx`, S-4.22): 현금 입출금 기록 폼. `trigger-add-cash-tx`(`dispatchAddCashTx(cashId)`)로 오픈. 입금/출금·정기 토글·반영·출금초과 가드·중복 인라인 확인. hidden 영역 상시 마운트
- **CashTxView** (`views/detail/cash-tx/cash-tx-view.tsx`, S-4.22): `cash-transactions` 탭. 총입금·출금·순유입 통계·기간/유형 필터·반영 삭제 시 잔액 역가감. 진입 대상은 `useCashTxViewStore`. 현금 카드 "입출금 기록/내역" 버튼·성적표 habit 딥링크로 진입
- **LoanTxInput** (`forms/asset-update/input/loan-tx-input.tsx`, S-4.24): 대출 상환/추가대출 기록 폼. `trigger-add-loan-tx`(`dispatchAddLoanTx(loanId)`)로 오픈. `CashTxInput` 미러링(통화 분기·정기 토글 없음, 상환초과 가드·중복 인라인 확인). hidden 영역 상시 마운트
- **LoanTxView** (`views/detail/loan-tx/loan-tx-view.tsx`, S-4.24): `loan-transactions` 탭. 총상환·추가대출·순상환 통계·기간/유형 필터·반영 삭제 시 잔액 역가감·완납 배지. 진입 대상은 `useLoanTxViewStore`. 대출 카드 "상환/대출 기록·내역" 버튼으로 진입
- **CryptoTxInput** (`forms/asset-update/input/crypto-tx-input.tsx`, S-4.25): 코인 매수/매도 기록 폼. `trigger-add-crypto-tx`(`dispatchAddCryptoTx(cryptoId)`)로 오픈. `CashTxInput` 구조 미러링이나 계산은 잔액 가감이 아니라 `trade-utils.computeNewPosition` 가중평균(주식과 동형) — 반영 시 수량·평단 재계산, 반영 후 예상 포지션 인라인 미리보기·초과매도 가드(`validateReflection`)·중복 인라인 확인. hidden 영역 상시 마운트
- **CryptoTxView** (`views/detail/crypto-tx/crypto-tx-view.tsx`, S-4.25): `crypto-transactions` 탭. 총매수·총매도 통계·기간/유형 필터. 반영 삭제는 잔액 역가감이 아니라 `trade-utils.rollbackTransaction`(거래로그 전체 재적용)으로 포지션 롤백. 진입 대상은 `useCryptoTxViewStore`. 코인 카드(병합·거래소별 하위 카드) "매수/매도 기록·내역" 버튼 및 "자산업데이트" 플로팅 버튼(코인 선택 시)으로 진입
- **상세 허브 세금 행**(`views/detail/detail-hub.tsx`, 4.89): `detail-hub-tax-row` 전폭 가로 행(ToolTile 패턴 변형, 공용 추출 안 함) — 보조줄 `taxEntryLine`, 인증카드 숨김.
- **TaxCalendarView** (`views/tax/tax-calendar-view.tsx`, S-4.23·S-4.31 개편): `#tax` 뷰, 타이틀 "세금 관리". 헤더+`InlineSelector`(size="lg", "세금 일정관리"/"절세 시뮬레이션" 전환)를 `sticky top-0`로 고정(라우팅 불변, 페이지 내부 상태 전환 — 이번 달 자동 스크롤에도 탭이 항상 보이도록 2026-08-27 추가). 일정관리 탭 = 기존 12개월 세로 리스트(`InlineSelector` 내 세금/전체 필터 · `Collapsible` 상세 · 현재 월 강조·`scrollIntoView`(`scroll-mt-32`로 고정 헤더 높이만큼 여유) · 해외주식 실현차익 근거 박스 · 하단 면책). 시뮬레이션 탭 = `TaxYearEndSimulator` 렌더. `settings`와 동일한 더보기 하위 페이지 패턴(하단탭 미등록). shadcn `Calendar`는 날짜 선택기라 사용하지 않는다
- **TaxYearEndSimulator** (`views/tax/tax-year-end-simulator.tsx`, S-4.31): 연말 절세 시뮬레이션. `TaxCalendarView`의 "절세 시뮬레이션" 탭 콘텐츠로만 존재(별도 Sheet·라우팅 없음, 개별 종목 카드의 진입 버튼도 없음 — 이 화면 하나로 통합). 입력은 **체크박스 + 버튼만**(텍스트 입력 없음): 종목 `Checkbox` 선택 → 프리셋 칩("전량"/이익 종목이면 "한도까지 · 비과세") + `±1`/`±5`/`±10` 버튼으로 수량 조정. `getYearEndTaxSimulation`(당해 실현손익 0이어도 candidates 반환)과 `simulateSelectedForeignSale`(선택이 비어 있어도 baseline 기준 결과를 항상 반환 — 2026-08-28부터 무조건 호출) 재사용.
  - **상단 통합 결과 박스**(2026-08-28, `sticky top-28` — 부모 헤더+탭 높이만큼 오프셋을 둬 스크롤과 무관하게 항상 노출): 예상 양도소득세 큰 숫자 + 보조 수치 3개(실현손익=고정, 잔여 공제 한도=선택 반영해 실시간 갱신, 합산 손익=`text-foreground` 강조). 과거엔 baseline 박스(최상단)와 예상 세액 박스(최하단)가 분리돼 있었으나 정보 중복이라 하나로 합쳐 상단으로 이동.
  - 손익 색상은 전역 규칙(`getProfitLossColor`, 이익=빨강/손실=파랑) 그대로 재사용. 순수 조회 UI(`assetData` 변경 없음)
  - **"한도까지"는 종목별로 매 렌더 재계산**(2026-08-28): `lib/tax-utils.ts`의 `computeRebuyQuantity(gainPerShareKrw, quantity, baseGainKrw)` 재사용 — 각 행마다 "자기 자신을 제외한 현재 선택 전체 손익 + baseline"을 `baseGainKrw`로 넘긴다. 손실 종목을 먼저 선택한 뒤 이익 종목의 한도가 그만큼 늘어야 하는데(손익통산) 정적 `candidates[].rebuyQuantity`(선택 0개 기준 초기값)만 쓰던 버그를 수정.

### StockPageView · PriceChart (`views/detail/stock-page/stock-page-view.tsx`·`price-chart.tsx`, #4.81 #157)
종목 한 장(`#detail/stocks-item`). 머리 카드 `stock-page-head`(이름·(티커·시장)·분류 배지·평가 text-2xl·`내 수익` 금액(%)·총 N주(종목 한 장 머리는 유지), `buildStockGroupHead`) + 가격 흐름 카드 `stock-page-chart-card`(`N년 주가 등락`+`stock-page-change`, `InlineSelector` 1년|5년 `stock-page-range`, 차트 박스 `stock-page-chart[data-state=loading|ready|error|empty]` 고정 높이 h-48/52/64, 상태 줄 슬롯: 선택 점 `stock-page-buy-detail` > `stock-page-no-trades` > `stock-page-outside`, 정의 줄 `stock-page-basis`, 링크 `stock-page-trades-link`). `StockPageBody`는 테스트용 export. 대상은 `useStockPageStore`(메모리, 해시에 종목명 없음), 비면 상세·주식으로 `replaceState` 이동. `PriceChart`는 recharts 없이 SVG 1장(면적선·평단선 라벨 칩 `stock-page-avg-line[data-clamped]`·매수 점 `stock-page-buy-dot`(빨강 원)·매도 점 `stock-page-sell-dot`(파랑 마름모, 4.84)·같은 봉 매수+매도 ±6px·히트 반경 10~20 이웃(매수+매도) 거리 반분·빈 곳 탭 해제·드래그 읽기, 4.84: 우측 가격 칸 눈금·현재가 태그(`PriceAxisLayer`)·평단 칩 폴백 `stock-page-avg-chip[data-mode]`(`placeAvgChip`)·범례 `chart-legend`). 진입 링크: `stock-tab.tsx` 펼침 머리 `stock-page-entry`(`종목 보기 ›`, 분할·비분할 같은 자리), `MarketList`의 `stockLink` prop(종목 줄만 버튼·`ChevronRight`). 가격 표기는 `number-utils` `formatPriceByCurrency`(4.85, 구 `stock-trades-view.formatPrice` 삭제).

### NavigationProvider (`layout/navigation/navigation-context.tsx`)
- (#4.81) `DetailTab`에 `stocks-item`. 순수 함수 `guardStockPageView`(store 비면 stocks)·`tradesBackAction`·`stockPageBackAction`, `getBackLabel(view, stockPageOrigin?)`(시장 비교 진입 `뒤로`).

- `AssetView = home | detail/{tab} | activity/{tab, init?}` 상태 + hash 동기화 + popstate 리스너. `ActivityTab = hub|change|dividend|report`, `ChangeInit {scope?, period?, month?, source?}`는 해시에 싣지 않는 자산 변화 초기 탭 지정(옛 `#activity/netasset`·`profit` 리다이렉트·결산 카드·FAB·성적표 링크, #4.34)
- `navigate(view)`: pushState + scrollTo(0,0)
- `back()`: 항상 `navigate({type:"home"})` (history.back() 아님 — 어디서나 홈 복귀)
- `parseHash`/`toHash`/`getViewTitle` export

---

### FloatingAddButton (`layout/floating/floating-add-button.tsx`, S-4.30 재설계 → 2026-08 hub 단건화)

"자산 업데이트" 버튼 → Sheet. `Step = "hub" | "holdings" | "trade" | "select-method"`. hub는 "보유 현황 업데이트"/"매수·매도 거래 기록" 2개 상위 타일(+환율 설정 카드) — 각각 `holdings`(카테고리 6종 컴팩트 리스트)/`trade`(스크린샷 지원 4종 컴팩트 리스트)로 이동한다.

- **다건 체크박스·시퀀스·완료 원인분해 요약 화면은 전부 제거됨(2026-08)** — `checkedTypes`/`sequence`/`AttributionSummary`(`./attribution-summary.tsx`) 재도입 금지. 항상 행 클릭 = 즉시 단건 처리, 이벤트 dispatch 경로(`trigger-add-{type}`) 그대로
- `holdings` 행: `navigateTab`이 있으면 우측에 연필 아이콘(`handleActionEdit`, `navigate({type:"detail", tab})` 직접 호출)만 축소 노출 — "수정" 풀폭 버튼 없음
- hub 상단 `InfoHint`로 "보유현황=재동기화(거래 이력 없음)" vs "거래기록=손익·세금 정확 반영" 역할 구분 안내
- 홈 `HomeTipBox`의 최신화(refresh) 종류 클릭은 `open-add-asset-sheet` 이벤트에 `detail.category`(가장 오래된 카테고리 1개, 단수)를 실어 hub/holdings를 건너뛰고 해당 카테고리의 단건 흐름(`handleHoldingsClick`)으로 직행(다건 프리셋 아님, S-4.32 후속에서 `RefreshNudge`를 흡수)
- 보유현황 스크린샷 저장 성공 시 각 `*-screenshot-import.tsx`가 `markCategoryRefreshed(category)` 호출(`lib/asset/asset-refresh-status.ts`)
- **이어서 맞추기(#110)**: `holdings` 목록은 보유 자산군 우선 정렬(`sortHoldingsRows`, 과거 순자산 맨 아래)·미보유 `추가`·오늘(KST) 맞춘 자산군 `Check`+`오늘 맞춤`(`isRefreshedToday`). 창 선택 시 `armedRef`(메모리 1개)로 대기 → 저장 신호(`asset-category-refreshed`)가 같은 자산군이면 시트를 holdings로 다시 열고 상단 `role="status"` 줄(`{자산군} 맞췄어요` / 부동산·실물 미보유 시 전부 맞춤이면 `보유한 자산을 모두 맞췄어요`) + 하단 `Button variant="brand"` [완료]. 취소·상세 편집·마법사·화면 이동·시트 닫힘 시 대기 해제. 복귀 목록에서 방금 자산군이 아닌 최신화 행을 누르면 GA `feature_use`/`resync_continue`(`이어서 맞추기`) 1회. 홈 팁·결산 진입도 동일. testId `fab-holdings-row-{type}`·`fab-holdings-checked-{type}`·`fab-resync-notice`·`fab-resync-done`

### ScrollToTop (`layout/floating/scroll-to-top.tsx`)

화면 우하단 utility 버튼. 100px 스크롤 시 노출. `window.scrollTo(top:0)` 고정이라 마운트된 페이지의 스크롤 컨테이너가 `window`(일반 페이지 스크롤)일 때만 재사용 가능.

- 적용처: 세금 관리 > 일정 관리 탭(`tax-calendar-view.tsx`, S-4.32) — 월별 리스트가 길어 상단 헤더+탭까지 되돌아가는 용도. 시뮬레이션 탭은 자체 상단 sticky 결과 박스가 있어 제외.

- `<button>` native 태그 (shadcn Button의 outline variant `bg-background` 덮어쓰기 회피)
- `bg-foreground/70 text-background` (선명한 무채색 회색). hover `bg-foreground/90 scale-105`
- 크기: `size-10`, `shadow-md` — FAB보다 시각 비중 약함 (utility 위계)

### \*-input.tsx 공통 구조

1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어 (`hideList` prop)

### ScreenshotFailNotice (`forms/asset-update/screenshot/screenshot-fail-notice.tsx`, #4.54)

### NewDateRow (`forms/asset-update/screenshot/new-date-row.tsx`, #4.77 #146)
맞추기·첫 등록(주식·코인) 미리보기의 `새 종목/코인 매수일` 줄. props `prefix`(`resync`|`import`, testId 접두)·`kind`·`count`(실제 신규 건수)·`value`·`onChange`·`today`. 셸 `bg-muted/40 rounded-lg px-3 py-2.5`, 320 세로·sm 가로, 주식만 `InfoHint inModal`, 오류(빈 값·오늘 이후) `role="alert"`. 호출부가 신규 0개면 마운트하지 않고, 오류면 확인 버튼을 `disabled`로 둔다.

### RelinkHost · RelinkDialog · RelinkEntry (`forms/asset-update/relink/`, #4.77 #147)
`RelinkHost`((main) layout 1회)가 `open-relink-dialog`(`dispatchOpenRelink`)를 받아 `RelinkDialog`(확인 화면·결과·되돌리기·그대로 두기)를 연다. `RelinkEntry`(`relink-entry`)는 주식 거래내역·코인 거래 화면 목록 위 안내 줄(후보 0·체험·잠금·공유 대기 중 미렌더). 계산은 `lib/asset/resync/relink.ts`.
- 추가 import 4종(주식·코인·현금·대출) 업로드 단계 공용 실패 박스. props `fail`(`makeScreenshotFail`)·`assetType`·`canRetry`·`onRetry`·`onClose`·`directInput?:"add"`(마법사). 테스트 id `screenshot-fail-notice/-retry/-manual`, `data-kind`. 제목 매핑은 `lib/asset/screenshot-fail.ts`. 거래 스크린샷·맞추기에는 쓰지 않는다.

### 스크린샷 다이얼로그 공통 패턴

- `open/onOpenChange` props로 외부 제어
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(15회) 체크
- **중복 처리:** stock/crypto → merge/reset 선택, cash/loan → 항상 append
- **업로드 전 고지 박스(#4.38)**: stock·crypto·cash·loan 4종 동일 — `rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep`(테두리 없음) + `SCREENSHOT_UPLOAD_NOTICE`(`src/config/security-copy.ts`). 문구를 파일에 직접 쓰지 않는다

---

### StockTargetPicker · PositionChangePreview (`forms/trade/stock-target-picker.tsx`, #4.29)

- `StockTargetPicker({ candidates, value, onChange, allowNew, defaultCategory, defaultBroker? })` — 거래를 반영할 **보유 자산 항목 직접 선택** 카드 목록 — 2줄(1줄 증권사·종목명, 2줄 수량·평단) + 타입 배지는 주식 상세 `CATEGORY_TABS` 축약 표기(국내·해외·IRP·ISA·연금·비상장). 거래 스크린샷에서는 체크박스 들여쓰기 없이 거래 카드 전체 폭, 다이얼로그 그리드 아이템에 `min-w-0` 필수(누락 시 truncate 텍스트가 다이얼로그 폭을 밀어 모바일 가로 잘림). `TradeTarget = { kind:"existing"; stockId } | { kind:"new"; broker; category }`. `allowNew`(매수만)이면 마지막 "신규 자산 등록" 카드 → 증권사·주식 타입 Select 인라인. 수동 거래 입력(`trade-input.tsx`)·거래 스크린샷(`trade-screenshot-import.tsx`) 공용 — 증권사로 자동 라우팅하지 않는다(같은 증권사 IRP·ISA·연금저축 구분 불가)
- `PositionChangePreview({ before, after, currency, title? })` — 반영 후 예상 포지션(보유 수량·평단 before → after) 박스. 두 거래 입력 화면 공용
- 같은 파일 헬퍼 export: `formatPrice(value, currency)`(USD $·JPY ¥·KRW), `getPositionSnapshot(stock, lockedByManual=false)`(수동 입력은 수동 포지션을 lockedByManual로 래핑해 사용), `categoryLabel(category)`

### stock-input.tsx 카드 레이어

| Layer          | 내용                                                    |
| -------------- | ------------------------------------------------------- |
| 1 헤더         | 카테고리 Badge + 종목명 + 티커 + 조회기준일 + 편집/삭제 |
| 2 핵심지표     | 평가금액(좌) / 평가손익·수익률(우, `items-end`)         |
| 3 가격비교     | 평균단가 / 현재가                                       |
| 3b 환차손익    | 해외주식 외화 종목만                                    |
| 4 주식담보대출 | linkedStockId 연계 대출                                 |
| 5 보조정보     | 수량 / 보유일 / 매수일 / 설명                           |

- **정렬:** 평가금액(원화 환산) 내림차순 → 동일 시 이름순
- **탭:** 전체/국내/해외/IRP/ISA/연금/비상장 (7탭)
- `lookupState`: `"idle"|"success"|"failed"` — idle 시 종목명·현재가 숨김

### stock-tab.tsx export 목록 (share-card·welcome-guide에서 재사용)

- `StockBarChart`, `StockRowItem`, `StockRowHeader`, `StockSummaryHeader`, `StockCategorySection`, **`StockCard`**(screenshotMode 지원)
- `StockSummaryHeader`·`DetailSummaryHeader`의 `footer` 슬롯은 4.83에서 삭제(상세·주식 요약 박스는 4.73 이전 모양 — 시장 글줄은 `StockToolTiles` 시장 타일로 대체). 인증카드 diff 0
- 카테고리 줄(#4.73 U6, `stock-category-row`): 왼쪽 `min-w-0 flex-1 overflow-x-auto`(스크롤바 숨김) 안 `InlineSelector`(6칸 이상 `[&>button]:px-1.5`) + 오른쪽 로컬 `StockSortSelect`(`stock-sort`, 기존 `Select` 글자 버튼 — 면·테두리 없음, `h-8` 히트 40px `after:-inset-y-1`, `등락률 순` 선택 시 `font-semibold text-foreground`, 아이콘형 `ArrowDownWideNarrow`·라벨 sr-only·히트 `after:-inset-1` 40×40은 **`평가금 순`일 때만** 360 미만 또는 7칸이면서 400 미만 — `SORT_ICON_MODE` 정적 클래스 3벌, `등락률 순` 선택 중엔 항상 라벨). 선택은 모듈 메모리 `stockSortMemory`(저장 키 0), 목록만 `sortByChipRate`, 비중 막대·인증카드는 평가금 순. 카테고리·정렬 변경 시 선택 칸 `scrollIntoView`
- `useFilteredStockData(activeCategory)` — 필터된 주식 계산 훅
  - 정렬된 tickerList (`.sort()`) 보장 → 다른 컴포넌트와 캐시 키 일치
  - `inactiveStatus !== "delisted"` 필터 포함
  - `dailyProfit`은 `filteredStocks` 기준 합산 (카테고리 selector 따라 즉시 변동)
- `CATEGORY_TABS`

**`screenshotMode` 분기 (인증카드 = share-card 전용)** — 캡처 DOM은 680px 고정폭(`CARD_WIDTH`, share-menu.tsx)이라 `sm:` 뷰포트 반응형 금지(R32). `screenshotMode`인 컴포넌트는 `ASSET_THEME` 대신 **`ASSET_THEME_SHOT`**(theme.ts)을 쓴다.

- **프리뷰(`responsive`)** — `ASSET_THEME_SHOT`. 상세>주식 탭 모바일보다 **의도적으로 ~2px 작다**(2026-09 조정 — 프리뷰에서 "주식 현황"이 "포트폴리오" 도넛 라벨(실효 ~12px)보다 커 보여 낮춤): `cardInfoName`/`cardAmountMain`/`legendText`/`bodyText`/`profitRate` `text-xs`(12px), `summaryValue` `text-[17px]`, `profitAmount` `text-sm`(14px), `iconInitial` `text-[8px]`, `badge` `text-[9px]`, `icon` `size-5`(20px). `footerBrand`/`footerDomain` 토큰은 2026-09 푸터 전체(브랜드명+도메인) 제거와 함께 삭제. 포트폴리오 하단 막대바(`PortfolioSectorBar` 비-`big`)도 `text-xs`로 함께 낮춰 도넛 라벨과 밀도 정렬. 상세 탭·저장 PNG는 무관.
- **캡처(저장 PNG, `shotBig`=`!responsive`)** — 680px 아트보드는 프리뷰(~374px)의 2배라 같은 절대 px면 비율이 절반. 캡처는 **`ASSET_THEME_SHOT_BIG`**(폰트·아이콘을 `SHOT_BIG_SCALE`배 한 결과를 하드코딩; 현재 1.46 → 14→20·20→29·16→23·9→13·10→15px, `icon` `size-[35px]`)을 쓴다. `SHOT_BIG_SCALE`(theme.ts)은 문서용 배율 상수 — Tailwind JIT가 `text-` 임의값을 소스에서 스캔하므로 CSS 변수/런타임 계산 불가, 값 바꾸면 BIG 값들을 base×SCALE로 재계산해 교체(theme.ts 주석에 base 표). `shotBig`은 `screenshotMode`와 **별개 플래그**(재결속 시 프리뷰 펼침 부활). 배율 이력 ×1.8 → 1.57 → 1.42 → 1.5 → 1.46.
- 예외: `cardHeader` `py-2`·`cardTriggerButton` `gap-4`·`legendGrid` 간격은 프리뷰·캡처 공통(텍스트만 확대, 간격 불변).
- 토큰 미경유 하드코딩 본문(`text-sm` "N주"·"그 외 N종목"·헤더 라벨 등)은 `ASSET_THEME_SHOT(_BIG).bodyText`(14 / 22px) 공용 키로 분기.
- **카드 배경(2026-09)**: 프리뷰(`responsive`)는 `bg-background`(테마 토큰, 모달 배경과 통일). **캡처(저장 PNG, `!responsive`)는 `bg-white dark:bg-black`** — 순수 흑/백 고정. `bg-background`(oklch, 라이트 0.96·다크 0.145)는 모바일 기기·뷰어에 따라 "옅은 검정/흰색"으로 보일 수 있어, 저장 PNG만은 톤 편차 없는 완전한 흑/백으로 분리(`share-card.tsx:174`).
- **워터마크(2026-09, 여러 차례 개편 끝에 확정)**: 브랜드 텍스트/도메인 푸터 완전 제거 후 `Logo`(`src/components/logo.tsx`, Leckerli One "S") 하나로만 출처 표시. outer 카드 `relative` + `Logo` `absolute` 배치(두 variant 공통 좌표라 주식현황·포트폴리오 전환해도 위치 불변). 크기는 `SHOT_BIG_SCALE`로 프리뷰→캡처 파생: `LOGO_SIZE_PREVIEW=24`, `LOGO_SIZE_CAPTURE=Math.round(24*SHOT_BIG_SCALE)=35`(`share-card.tsx` 상단 상수). 위치는 좌측 "총 주식 평가금액" 라벨 최상단과 정렬(top 값은 라벨 top 실측치), 우측 여백은 하단 리스트·막대바(`px-2`)와 동일한 인셋이 되도록 `right-4 sm:right-5`(프리뷰)/`right-5`(캡처). 시행착오 이력: 앱 로고 PNG(스탬프 느낌, 크기·정렬 실패) → lucide `IdCard`(사용자가 "기업 로고가 아니다"로 반려) → `Logo` 확정.

- `StockCard` — 헤더 + 비중 그라데이션 바만 노출. Collapsible·상세 그리드·수정/삭제 버튼·담보대출·보유 메타 모두 미렌더. `maskFn`으로 hideAmounts 마스킹 전달
- `StockRowHeader` / `StockIcon` — **금액 숨김(maskFn이 `•` 반환) + screenshotMode면 수량도 `maskFn(quantity)`로 가림(#4.80)**. 이름·금액·수량·아이콘·Badge 클래스를 `screenshotMode`면 `shotBig ? ASSET_THEME_SHOT_BIG : ASSET_THEME_SHOT`으로 스왑. 비중%는 미노출(범례로 통합), `TodayChangeChip`(오늘 등락) 미렌더. `StockIcon`은 로고를 `useLogoSrc` 훅으로 로드(캡처 시 `captureLogoSize(shotBig ? 34 : 28)` 요청, 재시도 3회) — **로고 URL이 있어도 최종 로드 실패 시 이니셜 폴백**(과거엔 빈 색 원형만 남았음, 2026-09 수정)
- `StockCategorySection` — **범례는 인증카드도 노출**(주식 탭과 공통, `!screenshotMode` 가드 없음): 색점+종목명+비중%, `maxItems` 초과분은 `그 외 N종목 X%`. 인증카드 grid는 `ASSET_THEME_SHOT(_BIG).legendGrid`(`grid-cols-2` 고정)+`legendText`(프리뷰 `text-xs` / 캡처 `text-[20px]`, R32). 루트 패딩 `px-1`, 리스트 상단 여백 `mt-10`(캡처·주식 탭 공통, 2026-09 `mt-7`/`mt-8` → 통일 40px). 실제 노출 간격은 섹션 `space-y-3`(12px) 마진 상쇄 후 이 `mt` 단일 값. 리스트 초과분 "그 외 N종목" 행은 `maskFn`+`exchangeRates` prop이 있으면 종목 카드와 동일한 우측 2줄(평가금액 합 / 손익 `(+X.X%)`, `computeStockMetrics` 합산 — 개별 평균 아닌 `(Σ평가−Σ원가)/Σ원가`)로 렌더, 비중%는 미노출
- `StockSummaryHeader` → `DetailSummaryHeader`/`ProfitMetric`의 `screenshotMode`+`shotBig` prop으로 전달 (원/달러 셀렉터·오늘 등락 미렌더, 인증카드는 배경 박스 없이 헤더 값 텍스트 `summaryValue` = 프리뷰 20px / 캡처 28px). label/secondary는 `bodyText`.

**StockRowHeader 비활성 Badge:**

- `halted` → amber `text-amber-600 border-amber-600` "거래정지"
- `delisted` → red `text-red-600 border-red-600` "상장폐지"

### stock-screenshot-import.tsx conflict 및 미리보기 UI 처리

- **덮어쓰기(merge):** 스크린샷 ticker 제거 후 전체 push
- **초기화(reset):** 기존 주식 전부 제거 후 스크린샷만 등록
- **미리보기 UI:** 1행(이름+티커+환산뱃지), 2행(수량/현재가/평단가/평가금액 그리드 패널 bg-muted/40), 3행(드롭다운 가로 배치 및 증권사 선택 max-w-[220px] 짤림 방지)
- ticker 없는 종목: `saveAssetDataRaw()` 우회 저장 후 `refreshData()`

**4개 스크린샷 컴포넌트(stock/crypto/cash/loan) 공통 `onSaved?: (count: number) => void` prop(S-4.29)** — 저장 성공(`toast.success` 직후) 시 등록 건수와 함께 호출. 옵셔널이라 기존 FAB 등 호출부는 영향 없음. 온보딩 마법사가 이 콜백으로 단계 완료를 판단(다른 완료 신호가 없어 추가됨 — `onOpenChange(false)`만으로는 저장 성공과 사용자 취소를 구분할 수 없었음).

---

## 대시보드 컴포넌트

| 컴포넌트            | 파일                                    | 역할                           |
| ------------------- | --------------------------------------- | ------------------------------ |
| Dashboard           | `main-nav/home/dashboard.tsx`           | 총자산/순자산/손익 요약 + 분포. `NetAssetSummaryBox`(순자산 헤더)에 옵션 `grade?: SnapshotGrade | null`/`onGradeClick?`(2026-09, 자산 성적표 미니 배지) — `useLatestAssetGrade()` 훅이 `readDailySnapshots()`에서 `grade` 필드가 있는 최신 스냅샷을 찾아 전달(재계산 없음, `asset-report-view.tsx`가 성적표 화면 방문 시 기록해둔 값을 그대로 읽음 — 방문 전이면 `null`, 배지 미노출). `grade && !hasRightSide`일 때만 헤더 우상단에 `absolute` 배치(트로피+점수, `asset-report-view.tsx`의 `TIER_STYLE` export 재사용), 클릭 시 `navigate({type:"activity", tab:"report"})`. `welcome-guide.tsx` 프리뷰 호출부는 두 prop 모두 안 넘겨 기존과 동일(무영향) |
| AssetDetailTabs     | `main-nav/detail/asset-detail-tabs.tsx` | 5탭 상세 목록                  |
| YearlyNetAssetChart | `views/activity/net-asset-chart.tsx` | 순자산 추이 — 년도별/일별(월별은 #4.34에 결산으로 흡수). `view?: "yearly"\|"daily"`를 넘기면 외부 제어·내부 선택기 숨김 |
| ProfitCard          | `views/activity/profit-chart.tsx`    | 기간별 수익 차트 (점진 로드). `period?: ProfitPeriod`를 넘기면 외부 제어·내부 선택기 숨김 |
| AssetChangeView (#4.34, r2) | `views/activity/asset-change-view.tsx` | 성과·자산 변화 셸 — 제목 행 오른쪽 범위 선택(전체/주식, `InlineSelector fullWidth` `w-[164px]`) + 기간 선택(일/주/월/연, fullWidth) 노드를 각 본문 Hero 맨 아래로 전달(`periodSelector`). 전체·일/연=YearlyNetAssetChart, 전체·주=WeekList(#4.79: Hero `최근 7일`/`M/D 이후`+구간 `M/D → 오늘`(7≤D≤9만)+`CauseBlock scope="week"` 6줄+푸터(`기록 내역 N건`·`종목 등락 보기`)+`날짜별 마감 기록` 접힘 카드(`WeekClosingCard`, 기본 닫힘·탭 재진입 시 다시 닫힘)), 전체·월=SettlementView, 주식=ProfitCard. 같은 칸 재선택은 무시(결산 재마운트 방지). `init: ChangeInit` 변경 시 탭 재지정 |
| MarketCompareView (#4.73 #132) | `views/activity/market-compare-view.tsx` | 성과 › 자산 변화 › `시장과 비교`(`#activity/change-market`) — 제목+`InfoHint`·정의 한 줄 → 비교 카드(`market-compare`, 시장 블록 `market-block[data-market]` 장부형 4기간 **전치** 표 `role=table`(#4.78: 행 = 하루·1주·1개월·올해 `data-period`, 열 = `보유 종목`/지수/`차이`(전경색), 행 머리 아래 구간 `M/D→M/D`(375 미만 2줄)·올해 `25.12.30→26.11.10`·연초 휴장 `집계 전`+`market-ytd-pending` 문구, 399px 이하 보유 값 text-sm·차이 text-xs(최악값 열 안), 목록 선택 `InlineSelector tight`(칸 px-1)), 안내 줄 `market-notice`) → `종목별` 카드(`market-list`, `InlineSelector fullWidth w-[200px]` 하루·1주·1개월·올해(`market-list-period-ytd`) 기본 1주, 묶음 `GROUP_BADGE` 국내/미국 (달러)/비교하지 않은 종목, 시장 줄 `market-list-index` 면 줄, 하단 `market-to-change`(올해 선택 시 숨김)) → `비교 기준 자세히` 접기(7줄)(`market-basis-toggle`, 항상 마운트 grid-rows). 상태 7종(조회 중 스켈레톤·지수 실패·기준일 어긋남·휴장·점검·한 시장·비교할 종목 0). 정적 렌더용 `MarketBlock`·`CompareNotice`·`MarketList` export. 계산은 `market-compare.ts` |
| ToolTile (#4.83 → 4.88 공용 추출) | `layout/ui/tool-tile.tsx` | 도구 타일 버튼(`{icon, name, testId, onClick, className?, chip?, children(값 줄)}`) — `min-h-16 rounded-lg bg-muted/50 px-3 py-3`, 다크 `rounded-xl bg-card shadow-sm`, 아이콘 `size-4 text-primary`(<360px 숨김), `ChevronRight`, press scale 0.98. 소비처: `StockToolTiles`·`MarketTile` |
| MarketTile · MarketTileValue (#4.88 #172, 옛 MarketEntryLine 대체) | `views/activity/market-entry-line.tsx` | `MarketTile({period, onOpen, testId})` = 자산 변화 › 주식 Hero 카드 바로 아래 형제 단일 도구 타일(`sm:max-w-md`, 래퍼 `testId`+`data-period`+`data-screenshot-hide`, 버튼 `${testId}-button`, 값 `${testId}-value`). 값 접두 `COMPARE_PERIOD_LABEL`(하루/1주/1개월), 연 탭 `올해 지수와 나란히 보기`(값 없음), 지수 0건 `지수와 나란히 보기`. 비교 종목 0·판별 후 0시장이면 미렌더. `MarketTileValue({market, label, testId, className?})` = 로딩 `SKELETON_FILL`·빈·값 3분기 공용(상세·주식 타일 `1주` 고정과 공유). 훅 `useMarketEntryValue(period, visible?)`(→ `{hasTickerStock, markets, ready, values, linkOnly, ytdLinkReady, open}`)·`MarketIndexValues({values, restBelowSm?})`·`hasComparableStock(assetData)`는 허브 행·타일과 공유. 값 = `computeIndexSpan`(도착 화면과 같은 함수). `ChangeHeroFrame`의 `footer` prop은 4.88에서 삭제 |
| MarketLine (#4.90 #175) | `views/activity/market-entry-line.tsx` | 홈 Hero 아래 지수 종가 1줄 `MarketLine({market, onOpen})`(testId `home-market-today`·`-value`, `data-state` loading/ok/empty). 값 = `useMarketEntryValue("daily", true, enabled)` 1회(Dashboard) → 줄·팁 억제(`marketLineState`) 공용. 둘째 시장 숨김 `@container`+`@max-[300px]:hidden`(같은 날짜)·`@max-[380px]:hidden`(날짜 다름), 줄 `-mt-2`·히트 40px(after)·`data-screenshot-hide`. 로딩 스켈레톤 `h-4 w-44`. |
| 홈 B 원인 1줄 · WeekTrendCard (#4.90 #175) | `views/home/dashboard.tsx` | `NetAssetSummaryBox`에 `market`·`marketLine`·`onMarketOpen`(A 줄, 캡처·웰컴은 미전달) + B 줄(`home-cause-line`·`-more`·`-panel`·`-collapse`, `pickTopCause`, 항상 마운트·`inert` 접힘, 포커스 패널↔줄). 원인 0개는 쉐브론 유지. `WeekTrendCard({snapshots})` = 7일 막대 카드(2개↑ 버튼 `home-week-card`·`home-week-title`, `weekTrendTitle`). |
| StockToolTiles (#4.83 #161) | `views/detail/stock-tools.tsx` | 상세·주식 '내 주식 도구' 타일 묶음(`stock-tools`, `role=group aria-label="내 주식 도구"`, 요약 박스 바로 아래·`data-screenshot-hide`). `grid grid-cols-2 gap-2`(3개면 세금 `col-span-2`, 1개 전폭, `lg:grid-cols-{개수}`), 타일 `min-h-16 rounded-lg dark:rounded-xl bg-muted/50 dark:bg-card px-3 py-3`(새 토큰 0, hover·press 0.98·포커스 링). ① 시장과 비교(`stock-market-entry`, 값 `1주 코스피 −x% · S&P 500 …`(`stock-tool-market-value`), 지수 실패 `지수와 나란히 보기`, 로딩 스켈레톤, 비교 종목 0이면 없음, `새` ⓑ) ② X-Ray 분석(`stock-tool-xray`, 값 `{항목} {pct}%` = `pickXrayTile`·`useXrayViewStore.setInitialAxis`로 그 축으로 열림, 없으면 `분야·지역 비중 보기`, 항상 렌더) ③ 해외주식 세금(`stock-tool-tax`, 값 고정 `1년 합산 · 기본공제 적용`, `isForeignTaxSeason && isTaxSimCandidate`). `useXrayClassifications`(분류 수집·완료 토스트)를 이 묶음이 호출 — 옛 `StockInsightStrip`·`TaxSeasonStrip` 삭제 |
| StockPageEntry (#4.83 #161, 4.84 밴드) | `views/detail/stock-row-flow.tsx` | 상세·주식 펼침 이름 줄 = 종목 한 장 입구(`stock-page-entry` 줄 전체 버튼, min-h-14, press scale 없음·hover/active 배경, `flex-wrap`: 위줄 [이름 + `›`] / 아래줄 밴드). 둘째 줄 `1년 주가 등락 {signedRate}`(`stock-page-entry-change`). **(4.84) 아래에 전폭 밴드 80px**(`stock-row-band[data-state]`, aria-hidden): `RowBandChart`(export, w·h 주입 가능)가 선(40점 다운샘플)·눈금선·눈금 라벨(`chart-tick`)·현재가 태그(`chart-today-tag[data-value]`)·평단 점선+`평단` 라벨을 픽셀 SVG로 그림(`useBoxSize({w:0,h:0})` — 측정 전엔 빈 80px 슬롯). 버튼 `aria-label` = `{이름} 주가 흐름과 평단 보기, 1년 등락 {%}, 현재가 {문자열}`. 폴백 `주가 흐름과 내 평단 보기`(실패·429·빈 응답, 빈 슬롯 `stock-page-entry-spark-slot` 80px)·`내 평단 보기`(가격 흐름 없는 종목, 밴드 없음). 1년 요청은 `open && 가격 흐름 있음 && !screenshotMode`일 때만, `usePriceHistory(..., {retryOnMount:false})` |
| PriceAxisLayer (#4.84) | `views/detail/price-axis-layer.tsx` | 가격 눈금 SVG 조각 — `layer="grid"`(눈금선 `foreground/12` 실선, 평단 점선과 구별) / `"labels"`(눈금 라벨 10px muted·현재가 점+태그 2줄(`현재가` 라벨)·평단 가격 칸 라벨). 행 밴드·종목 한 장 `PriceChart`가 공유(선·점·칩은 각자). 입력은 `buildPriceAxis` 결과 |
| LoadingNote (#4.84) | `components/ui/loading-note.tsx` | 공통 로딩 문구 `<LoadingNote active label className chip? />`(chip: 곡선·격자 위에 올릴 때 `rounded-full bg-card/90` 배경 칩 — 종목 한 장 로딩 박스, #4.85) — 0~0.5초 스켈레톤만, 0.5초 뒤 스피너 14px+13px muted 문구(`loading-note[data-phase]`), 5초 뒤 지연 문구, sr-only `role=status` 1개(시각 문구 aria-hidden), 자리 `min-h-6` 예약(`className`으로 `min-h-5` 등 덮어쓰기). 상수 `LOADING_LABEL.{price,flow,dividend}`·`SLOW_LABEL`. 구 문구(`기준가 조회 중…`·`조회 중…`) 금지 |
| Skeleton · `SKELETON_FILL` (#4.84) | `components/ui/skeleton.tsx` | 로딩 막대 색 `bg-foreground/[0.13] motion-safe:animate-pulse`(카드와 구분). `Skeleton`이 쓰고, 인라인 막대는 상수를 직접 붙인다(화면별 즉석 `bg-muted animate-pulse` 금지) |
| NewChip · useNewSpot (#4.83) | `layout/ui/new-chip.tsx` | `새` 표시(`new-chip[data-spot]`, 시트 `whats-new-item-new`와 같은 모양, `sr-only` `, 새 기능`). `useNewSpot(보이는 자리 후보 우선순위 순)` → 켜진 1곳(마운트 후 판정, 체험 0). 판정 `lib/new-spot.ts`, 대응표 `config/new-spots.ts`. 자리 4곳: 상세·주식 시장 타일 / 허브 최근 7일·월별 기록·시장과 비교 |
| HubChangeRows (#4.83) | `views/activity/hub-change-rows.tsx` | 성과 허브 `자산 변화` 카드 안 행 3개(`hub-change-rows`, `KpiCard rows` 슬롯). 최근 7일(`hub-row-week`, 이름 = 주 탭 Hero 제목·값 = `useWeekHero` delta `data-value`, `기록 부족`·`기록 쌓는 중`) / 월별 기록(`hub-row-monthly`, `{N}개월` = `monthlyLogEntryCount`, N<2·첫 달 숨김, `focus:"monthly-log"`) / 시장과 비교(`hub-row-market`, 시장 타일과 같은 값). 행 `min-h-11`, 폭은 구분선·머리 쉐브론과 같다(`-mx` 없음, 히트영역만 `after:-inset-x-1`, 4.85) |
| KpiCard `rows` 슬롯 (#4.83) | `layout/ui/kpi-card.tsx` | `rows?: ReactNode` — 없으면 카드 전체가 onClick(배당·성적표 등 기존 호출 동작·`active:scale-[0.98]`·`data-tutorial` 불변). 있으면 머리(아이콘~secondary)만 `role=button`(Enter/Space, hover/active 배경·scale 없음), `rows`는 머리 뒤 형제 `mt-3 ml-9`(중첩 인터랙티브 0) |
| SettlementView (#4.34, r2) | `views/activity/settlement-view.tsx` | N월 결산 = ChangeHero(이름 "10월 결산"/진행 중 "11월"+배지/전년 "25년 10월 결산", 구간, ‹ › 월 화살표 `size-10` — 기록 없는 달 건너뜀·끝에서 disabled, "일부 이전 값" 배지 → 다음 달 준비로 스크롤) → 변화 원인(5항목, 40ms stagger) → 다음 달 준비. 마운트당 `settlement_view` 1회(화살표 이동 재전송 없음). 변화 원인 아래 `CompositionBlock`(4.51, memo의 `live.breakdown` 전달) |
| CompositionBlock (#4.51, 로컬) | `views/activity/composition-block.tsx` | 월 탭 "자산 구성 변화" — `SECTION`+`BODY_ENTER`, 배지 "총자산 기준"+`InfoHint` 1개(`data-screenshot-hide`), 사실 문장·시작/끝 막대 2줄(실제 비중 폭·11%↑만 막대 안 %)·증감 행(반올림 정수 차, U+2212, 손익색 없음). 숨김이면 null. 색 `COMPOSITION_COLORS`(MAIN_PALETTE 고정 매핑), 화면 키 `activity:change:composition`을 IntersectionObserver로 1회. 금액·버튼·리본·범례 없음, views/activity 전용 |
| MonthlyLogBlock (#4.67 R3, 로컬) | `views/activity/monthly-log-block.tsx` | 월 탭 "월별 기록" 인라인 카드 — 구성 블록 아래·AI 행 위(기록된 달 ≥2·!첫 달, `settlement-view.tsx`에서 key 없이 마운트 → 월 화살표로 리마운트·펼침 초기화 없음). `SECTION`+`BODY_ENTER`(120ms)+`SectionHeader(Table2, tone="info")`+캡션 `MONTHLY_LOG_CAPTION`(+13개월 한도 안내). 줄: 월·`진행 중`(`GROUP_BADGE`)·기록일 / 순자산 `formatMonthlyLogAmount(v,"full")` + 앞 기록 대비 변화 `formatMonthlyLogDelta`(`getProfitLossColor`, 0은 muted, 건너뛴 달 뒤 `· N월 대비`, 첫 기록 `첫 기록`). full 줄만 `button`(`aria-expanded`/`aria-controls`, min-h-14) → 패널 항상 마운트 `grid-rows-[0fr↔1fr]`·접힘 `inert`·`aria-hidden`, 자산군 금액(부채 −)·기여 변화(`buildMonthlyLogChanges`), 다중 펼침, 이번 달 기본 펼침. gap 줄 `기록 없음`, net-only 줄 `종류별 기록 없음`, 앞 기록 net-only면 패널 금액만+안내. `MONTHLY_LOG_VISIBLE`(6) 초과 시 `이전 N개월 더 보기`(되접기 없음). 가로 스크롤·표·시트 없음. views/activity 전용 |
| ChangeHero (#4.34 r2, 로컬) | `views/activity/change-hero.tsx` | 자산 변화 5개 본문 공통 Hero(이름 줄 min-h-10 → 증감 text-2xl/3xl → 시작→끝 → 기간 선택 mt-4), `aria-live`, `contentKey` 변경 시 fade만. `settlementDelta`(허브 카드·결산 Hero 공용 월 증감)·`settlementName`·`BODY_ENTER`·`CauseBlock`(변화 원인 5항목, `scope` month/year/week(#4.79)·`status` insufficient/error·`footer?` 슬롯(주 탭 푸터), 루트 `cause-block[data-scope]`, 줄 InfoHint는 scope별 `CAUSE_HINT`)·`computeSettlementCauses`(월 원인 계산)·`computeChainCauses`(연 원인 체인, 구간별 같은 함수) — 시작일 당일 제외·합계 = Hero 증감, 함께 export. `ChangeHero rangeTestId?`(주 탭 `week-range`) · views/activity 전용(공용 아님) · `ChangeHeroFrame footer?`(#4.73 — 기간 선택 바로 아래 선택 슬롯, 주식 범위의 `MarketEntryLine`만 전달, 없으면 렌더 diff 0) |
| SECTION·GROUP_BADGE·SectionHeader·SpecRow (#4.34 이동) | `layout/ui/report-section.tsx` | 성적표 로컬 정의를 동작 불변으로 공용화 — 섹션 외피·소그룹 뱃지·단색 아이콘 헤더(tone brand/gold/important/info, 칩 없음 #4.42)·라벨/값 행. 성적표·결산 공용 |
| DividendCard        | `main-nav/activity/dividend-chart.tsx`  | 배당 카드                      |
| DataSourceBadge     | `main-nav/data-source-badge.tsx`        | "실시간"/"캐시" 출처 Badge     |
| AttributionRecordList (S-4.33) | `views/attribution-records.tsx` | 원인분해 구간의 반영 기록(입출금·매매·대출) "기록 내역 N건" 펼침 — 날짜·구분·계좌/종목명·금액 시간순. 홈 순자산 헤더 펼침·성과 순자산 변화 공용, 기록 0건이면 미렌더 |
| AssetReportView     | `views/activity/asset-report-view.tsx`  | 자산 성적표 — 재사용 UI 패턴(섹션 구분·뱃지 라벨·비교 그리드·SpecRow, SpecRow·SectionHeader는 `layout/ui/report-section.tsx`) 레퍼런스, [design-system.md](design-system.md) §5.1 참조 |
| HomeTipBox (S-4.32 후속) | `views/home/home-tip-box.tsx`      | 홈 알림/팁 통합 박스 — 자산 분포 카드 **아래** 1곳에만 존재. 과거 상단 `BackupNudge`/`RefreshNudge` + 하단 `TaxNoticeBox`/`FeatureTipBox` **4개를 흡수**해 화면엔 한 번에 1개만 뜬다. 판정은 [state-and-utils.md](state-and-utils.md) `home-tip.ts`의 `pickHomeTip()`이 **백업>임박 세금>결산(#4.36)>새 소식(#4.82)>끊긴 거래 잇기>세금>자산최신화>저방문기능** 순으로 골라 반환, 종류별 재노출 정책은 원래 로직 그대로(백업·최신화=노출 시 오늘 flag, 세금=명시적 닫기 시 이번 달 flag, **새 소식(whats_new)=X·클릭 모두 `markWhatsNewSeen()`(읽음, 7일 시계) — 클릭은 `WhatsNewHost` 시트 열기, 강제 노출·`NOTICE_SHOWN_SESSION_KEY` 없음**, 기능=닫기·클릭 이동 둘 다 영구 dismiss). **X 닫기는 종류별 mark에 더해 `sessionStorage` 세션 플래그(`secretasset_home_tip_session_dismissed`, `pwa-connect-prompt.tsx` 패턴)를 찍어 이번 세션(창) 동안 박스 전체를 숨긴다 — 다음 순위 팁이 바로 튀어나오는 두더지잡기 방지. 재접속(새 세션) 시 초기화되어 각 종류의 정책대로 다음 팁이 정상 회전 노출. 단, `isNoticeUnseen() && !NOTICE_SHOWN_SESSION_KEY`인 동안(= 미열람 공지가 이번 세션에 아직 안 뜸)은 이 세션 플래그를 무시하고 무조건 `pickHomeTip`을 호출한다(#4.24) — 다른 팁을 X로 닫아 세션 플래그가 서도 공지의 "최초 1회 노출"은 가로막히지 않는다. 공지가 실제 렌더되면 `NOTICE_SHOWN_SESSION_KEY`를 세워 바이패스를 끄므로, 이후 공지 X 닫기 → 같은 세션 재진입 시 재노출 안 됨(QA에서 재노출 버그 발견·수정).** 인터랙션은 5종 모두 "카드 전체 클릭=유일한 동작(백업 다운로드/세금 화면 이동/최신화 시트 오픈/**공지→해당 기능 다이얼로그 오픈**/기능 화면 이동), X=닫기"로 통일된 단일 보더리스 셸. **공지(#4.24 재도입, 필수 노출)**: 홈 진입 시 강제 팝업하던 과거 `UpdateNoticeDialog`(S-4.32에서 제거)와 달리 다이얼로그를 억지로 띄우진 않지만, 팁 카드 자체는 **최우선순위**라 새 버전 공지가 있으면 백업·세금 안내보다도 먼저 반드시 노출. **클릭 시 공지 본문 다이얼로그가 아니라 이번 릴리스가 홍보하는 실제 기능으로 직행**(#4.24 후속) — 지금은 `dispatchOpenShareCard("type")`로 인증카드를 투자 유형 타입으로 즉시 오픈(#4.26, 이전엔 portfolio)(릴리스마다 홍보 대상이 바뀌면 이 액션도 함께 갱신). 더보기 메뉴의 공지 수동 열람(`notice.tsx`, `tool-menu.tsx`의 `showNotice`)은 그대로 유지 결산 팁(#4.36): 탭 = `navigate({type:"activity",tab:"change",init:{scope:"all",period:"month",month,source:"home_tip"}})`, 제목 N월은 `settlementName(month, tip.today, true)` 재사용. 셸 공통 제목·설명 `break-keep wrap-break-word`, X 히트 40px(`after:-inset-1`), testid `home-tip`/`home-tip-title`/`home-tip-close` |
| LevelMeter           | `ui/level-meter.tsx`                    | 세그먼트 레벨미터(범용) — 진행률을 칸(기본 10)으로 나눠 `SHARE_SAFE_PALETTE` 색을 순환시키며 채움. 순자산 목표 진행률 바(S-4.28, 롤백됨)에서 처음 만든 디자인을 재사용 컴포넌트로 보존 — **현재 적용처 없음**, 진행률/달성도 시각화가 필요할 때 우선 검토 |
| OnboardingWizardFlow | `layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx` | 스크린샷 일괄 온보딩 마법사(S-4.29) — 주식→코인→현금→대출 4단계(카테고리당 이미지 1장), 부동산은 `dispatchAddRealEstate()`로 즉시 수동 입력 연결. 각 단계는 기존 `*-screenshot-import.tsx`를 `onSaved` 콜백과 함께 직접 마운트해 재사용(신규 인식 로직 없음). 완료 화면은 실제 `<Dashboard/>` 렌더. `useOnboardingWizardStore`로 열림 제어, 웰컴가이드 CTA를 명시적으로 눌렀을 때만 열림(자동 노출 없음) |

### ProfitCard 점진 로드 (`profit-chart.tsx`)

useQuery 제거 → `useEffect` + `useState` 직접 관리로 전환:

- `tickerList`: ticker 있고 unlisted/delisted 아닌 종목 전체 (`currentPrice` 무관)
  → 첫 mount부터 풀세트 → 캐시 키 안정 (syncTodayStockPrices가 백그라운드로 가격 채워도 영향 없음)
- `fetchProfitRef(..., { onProgress, onComplete, signal })` 사용 — 배치마다 부분 결과로 setState → 점진 노출
- `refInFlightKeyRef`로 동일 키 재실행 시 abort 방지 (의존성 흔들림 보존)
- 완료 toast: ref/daily 모두 네트워크 완료 시 1회 (`PROFIT_SYNC_COMPLETE_MSG`)
- 세션 단위 dedup: `notifiedKeysThisSession` (모듈 Set, 새로고침 시 초기화)
- 캐시 hit(`fromCache=true`)이면 toast 생략
- `pickMajorityDate(dates)`: 종목별 응답일이 다를 때 시장 단위는 **최빈값** 표시

### header-menu (`header-menu/`, 구 header/top-nav)

- `TopBar` — 좌측: `view !== "home"`(=`isSubView`)일 때 ChevronLeft + getViewTitle("상세"/"성과"), **홈 화면이면 `BrandLockup`(`src/components/brand-lockup.tsx`, #4.66 r2) + `InlineSelector`(상세/성과, `className="ml-2"`)** — 2026-09 추가. 로고 정렬 기준은 대시보드 최상단 카드 텍스트가 아니라 **카드 색상 박스(`bg-primary/10`) 자체의 외곽 모서리** — 이 모서리가 페이지 콘텐츠 영역(`data-content-area`) 좌측 끝과 같은 지점이라 top-bar `px-3` 패딩만으로 이미 정렬됨(카드 "텍스트" 시작선에 맞추려 `ml-4`를 넣었다가 모바일에서 카드보다 오른쪽으로 처지는 회귀가 있었음 — 되돌림). `ChevronLeft`의 `-ml-1 sm:-ml-2`는 아이콘 SVG 내부 여백 보정용으로 이 로고와는 무관. 로고~`InlineSelector` 사이 여유 공간은 `InlineSelector`의 `className="ml-2"`로 확보(박스만 우측 이동, 로고 위치 불변). `InlineSelector`의 `size="xl"` 변형(이 자리 전용, 다른 소비처 없음)은 버튼 좌우 패딩을 `px-4`→`px-3`로 축소. 우측: 인증카드·도구 아이콘 2개 (h-10 sm:h-11, MAIN_PALETTE[5]/foreground 토큰)
- `ShareScreenshotButton` (`IdCard` 아이콘) → `ShareScreenshotDialog` → `ShareCard` (인증카드 생성). **대화상자 렌더·`trigger-open-share-card` 리스너는 top-bar 1곳뿐**(#4.66). 클릭 시 `recordVisit("share-card")`+GA `top_bar`, 리스너는 `detail.source ?? "home_tip"`. PWA에서도 보임(`pwa-hide-actions` 밖, 홈은 `pwa-home-header` 한 줄 헤더). `HubShareButton`(`layout/ui/hub-share-button.tsx`) — 상세·성과 허브 제목 줄 PWA 전용(`pwa-only-action`) 발송 버튼, 대화상자 없음, `dispatchOpenShareCard(undefined,"top_bar")`, 자산 0건 숨김. 공용 아이콘 버튼 크기 `HEADER_ICON_BTN` + 채움 `HEADER_ENTRY_BTN_BRAND`(brand 인디고 `bg-brand text-white`·누름 0.96, #4.66 R8 — 두 버튼 공통, `header-menu/menu-styles.ts`)
- `ToolMenu` (Settings 아이콘만) — Dropdown: 데이터 관리(내보내기/가져오기/공유/캐시초기화/삭제) + 기능(AI 평가 / **다크모드 토글** / **앱 가이드 · 공지사항** 통합 선택기). 공지 뷰어는 자동 팝업과 동일 `NoticeContent`·`NOTICE_TITLE` 재사용. `ThemeSwitcher` 컴포넌트는 삭제됨 — 도구 메뉴에 통합
- `AppGuide` — 평소 hidden, `trigger-restore-guide` 수신 시 표시 (도구 메뉴 "앱 가이드 · 새 소식"에서 앱 가이드 선택 시 디스패치). `AppGuideContent` 카드 3개는 `SECURITY_COPY.map`(웰컴 보안 상세와 같은 상수, id→아이콘 `ShieldCheck`·`CloudLightning`·`EyeOff`), 설명 마지막 문장 `APP_GUIDE_SECURITY_DESC`(#4.38). 기술 용어 강조 span 없음
- `WhatsNewHost`(#4.82, `views/home/whats-new-sheet.tsx`) — 새 소식 시트. (main) layout에 1개 상시 마운트, `dispatchOpenWhatsNew("home_tip"|"more")`(`asset-dispatch.ts`)로 연다. 모바일 bottom(그랩 핸들 스와이프)/PC right 시트, 헤더(`새 소식`·`지금 버전 v{APP_VERSION}`)·목록만 스크롤·`닫기`(brand). 항목 = 제목+본문+`M/D`+`바로 가기 ›`(`featureId` 있을 때, `runFeatureEntry`). `새` chip = 열기 직전 기준 안 본 항목 전부(= 팁 N). testId `whats-new-sheet|version|item|item-new|go|empty`. 더보기 진입 `more-whats-new`.

### BottomNav (`pwa/bottom-nav.tsx`)

PWA standalone 전용 하단 탭바(`nav.pwa-nav-container`, `globals.css`의 `display-mode: standalone`
미디어쿼리로만 노출 — 일반 브라우저는 항상 `display:none`). `NAV_ITEMS`(홈/상세/**업데이트(가운데)**/성과/더보기, #4.66에 인증카드 칸 제거 —
`grid-cols-5` 균등, 체험 `grid-cols-3`, testId `bottom-nav-{id}`, 활성 `aria-current="page"`) 공통 렌더 루프가 `icon: Icon`(lucide)을 그리되, **(#4.66 r2 이전 설명, 현재는 홈도 lucide `Home` 동일 렌더) "홈" 탭만 예외적으로 `Logo`
(`src/components/logo.tsx`, size=20)로 교체**(2026-09) — 활성 시 `MAIN_PALETTE[0]` 색상은 다른 탭과
동일하게 적용하지만, 텍스트 글리프라 `strokeWidth`(2/2.5) 굵기 차이는 재현하지 않는다(폰트가 단일
weight라 생략). `NAV_ITEMS`의 `{ id: "home", icon: Home }` 자체는 타입·`aria-label` 용도로 그대로 유지.

### ShareCard = 인증카드 (`header-menu/share/share-card.tsx`)

사용자 노출 명칭은 **"인증카드"**(버튼·네비·다이얼로그·튜토리얼·공지). 파일·식별자는 `share-card.tsx` / `ShareCard` / `ShareScreenshotDialog` / `screenshotMode` 유지.

**타입 3종**(#4.26에 **투자 유형** 추가, 다이얼로그 기본 진입) — `ShareScreenshotDialog` 제어 바의 `InlineSelector`(로컬 state `variant`, 저장 안 함)로 전환. `ShareCard`가 `variant` prop(`"type" | "stock" | "portfolio"`, `ShareCardVariant`)을 받아 분기한다. **투자 유형**(`variant="type"`)은 `resolveInvestorType()`([state-and-utils.md](state-and-utils.md) investor-type.ts) 결과로 [InvestorAvatar](#investoravatar-header-menushareinvestor-avataritsx) → 제목 → 부제 배지 → 설명(`renderDescriptionInLines`, `max-w`%·`targetChars` 한 쌍·래퍼 `w-full`) → 해시태그 쪽지를 중앙 정렬로 렌더(숫자·금액 미노출, 캡처 전용 크기·간격은 qa-full-test-plan F-SCREENSHOT 참조). 홈 팁은 `dispatchOpenShareCard("type" | "portfolio")`로 타입 직행. **푸터 없음**(2026-09 — 브랜드명·도메인·날짜 전부 제거, 두 타입 모두 콘텐츠로 카드가 끝남). `ShareScreenshotDialog`는 `initialVariant?` prop을 받아, 열릴 때(`open && initialVariant`) 그 타입으로 맞춘다 — `dispatchOpenShareCard("portfolio")`(`asset-dispatch.ts`, `trigger-open-share-card` 이벤트 `detail.variant`)로 홈 "새 공지" 팁이 포트폴리오로 직행할 때 사용(#4.24). 인자 없이 상단 아이콘 버튼으로 열면 직전 선택을 그대로 유지(리셋 안 함).

1. **주식 현황**(`variant="stock"`) — 아래 원래 구성. "금액 표시" 스위치는 이 타입에서만 노출.
2. **포트폴리오**(`variant="portfolio"`) — `PortfolioRingCard`(대형 종목 도넛, 조각 안 기업 로고) + `PortfolioSectorBar` **2개**(분야 구성 · 보유 유형 구성, #4.24). 금액 완전 제외. `ShareCard`가 `mergedStocks` 상위 7 + "그 외" 1건을 `segments`로 주입(fill=`SHARE_SAFE_PALETTE`=`PORTFOLIO_PALETTE` 고채도 신규 세트 — `MAIN_PALETTE`와 별개, % 텍스트도 같은 색, "그 외"=`SHARE_ETC_COLOR`).
   - **보유 유형 구성**(`categoryItems`): `stock.category`(국내주식/해외주식/IRP/ISA/연금저축펀드/비상장주식, `stockCategories` 라벨 재사용, `config/asset-options.ts`)별 비중 합. **IRP·연금저축펀드는 이 막대바에서만 "연금저축펀드·IRP" 한 버킷으로 통합**(세제혜택 은퇴 계좌 성격이 같음, #4.24) — `stockCategories` 자체는 6종 그대로라 카테고리 필터 탭 등 다른 소비처는 영향 없음. ISA(국내·해외 지수 ETF 혼재 가능)·비상장주식은 계좌 성격이 뚜렷이 달라 계속 분리. 종목 등록 시 **필수 입력**이라 분류 캐시 의존이 전혀 없어 "분야 구성"과 달리 미분류 가드·"그 외" 롤업이 없음(카테고리 종류 자체가 최대 5개 버킷).
   - **분류 자동 fetch**: `ShareScreenshotDialog`가 `open && variant==="portfolio"`일 때 `useXrayClassifications(assetData.stocks)` 실행 → 완료 시 `xrayTick` prop 증가 → `sectorItems` useMemo 재계산으로 분야 막대바 등장. **비차단**(저장 버튼 안 막음), 진행 중엔 제어 바에 "분야 정보를 분석하는 중…" 안내(캡처 DOM 밖).

**주식 현황 타입 구성** — 2026-08-27 도넛 차트(사각형→원형 두 차례 시도)로 **교체**를 시도했으나 실사용 확인 후 전면 롤백. 교체가 아닌 별도 타입은 위 "포트폴리오"로 추가(#4.24). 원래 구성 유지:

```tsx
// 닉네임 미노출(2026-08-08 제거)
<StockSummaryHeader screenshotMode maskFn={mask} />                  // 배경 없이 "총 주식 평가금액" + 평가손익
<StockCategorySection screenshotMode maxItems={SHOT_MAX /* =7 */}    // 비중바+범례(상위7+그 외) + 종목 리스트(상위7+그 외 N종목)
  maskFn={mask} exchangeRates={exchangeRates}
  renderItem={(s,_,c) => <StockCard screenshotMode maskFn={mask} ... />} />
// 푸터 없음(2026-09 제거) — 리스트가 카드의 마지막 콘텐츠
```

- 데이터는 `useFilteredStockData("all")` 단일 출처 — 주식 탭과 캐시 키 공유(중복 fetch 없음)
- **비중바·리스트 색**: 훅이 주는 `barItems`/`barColors`(`MAIN_PALETTE`, 주식 탭과 동일)를 그대로 쓰지 않고, `ShareCard`가 `segFill`(=`SHARE_SAFE_PALETTE` 인덱스 순환, 포트폴리오 도넛과 동일 팔레트)로 색만 덮어씌운 `shareBarItems`/`shareBarColors`를 만들어 `StockCategorySection`에 넘긴다(#4.24). 주식 탭 원본 배열·`MAIN_PALETTE`는 불변 — 인증카드 전용 색 오버레이일 뿐 값 자체(정렬·비중)는 그대로 재사용.
- 종목 파생값은 `computeStockMetrics(stock, exchangeRates, totalValue)` 재사용
- 마스킹 규약: 금액만 `••••`, 비중%·수익률%는 항상 노출
- 금액 포맷(2026-08-08): `mask`(→`formatCurrency`, 전체 금액 — 상세 탭 `PRICE_DISPLAY_MODE="full-only"`와 동일)를 헤더·종목 리스트·"그 외 N종목" 전부에서 공유. `StockSummaryHeader`의 `maskFn`은 `DetailSummaryHeader`의 `fmtFull`·`fmt`를 동시에 덮어쓰므로(`ProfitMetric`도 `formatShort` 단일 포매터) 축약 포매터를 넘기면 평가금액·평가손익 둘 다 축약으로 새는 점 주의(과거엔 이 버그로 헤더만 축약 표시됐었음)
- **프리뷰/캡처 분리(#4.24)**: 미리보기와 저장 대상이 **별개 `ShareCard` 인스턴스**지만 하위 렌더 구조는 **동일**.
  - **두 인스턴스 공통**: 하위 컴포넌트(`StockSummaryHeader`/`StockCategorySection`/`StockCard`)에 항상 `screenshotMode` 전달 → 정적 렌더(`StockCard`는 `screenshotMode`면 함수 상단에서 조기 return, `Collapsible`/펼침 DOM 자체가 없음)·`ASSET_THEME_SHOT` 고정 토큰. (직전 시안의 `shot = !responsive` 분기는 프리뷰에서 펼침 기능이 되살아나 제거.)
  - **프리뷰**: `<ShareCard responsive />`(ref 없음) — outer `w-full`+`p-2 sm:p-3`. `PortfolioRingCard`만 `responsive` prop으로 링 서브트리에 자체 fit-to-width 스케일(`scale = min(1, floor(clientWidth)/VIEW_W)`, `overflow-hidden`) — 도넛이 모바일 폭을 꽉 채우고 가로 스크롤 없음(R33).
  - **캡처**: `share-menu.tsx`가 화면 밖에 `<div aria-hidden className="fixed left-[-9999px]" style={{width: CARD_WIDTH}}><ShareCard cardRef={cardRef} /></div>` 상시 마운트. `toPng`이 이 노드를 캡처(680 고정) — `pixelRatio = ceil(CAPTURE_TARGET_PX / el.offsetWidth)`(`CAPTURE_TARGET_PX`=1400, 680 기준 3 → 최종 PNG ~2040px). 뷰포트·기기 무관 100% 동일(R32).
  - **`captureImage` 오케스트레이션**(2026-09, 모바일 로고 누락 수정): ① `settleImages` — 캡처 노드 `<img>` 전부 로드/디코드 완료 대기(이미지별 4s·전체 12s 예산) → ② pre-pass `fetch(src, {cache:'force-cache'})` → dataURL 인라인, 실패 시 400ms 후 1회 재시도 + `console.warn` → ③ `toPng`에 `imagePlaceholder`(1x1 투명, 실패 이미지가 전체 throw 방지)·`fetchRequestInit:{cache:'force-cache'}`. `handleSave`는 `Promise.race`로 20s 하드 타임아웃(버튼 "처리 중..." 고착 방지).
  - `CARD_WIDTH`는 480→460(2026-08-08)→520→**680**(#4.24) — 카드 박스 바깥 폭을 바꾸는 유일한 레버이며, **`portfolio-ring-card.tsx`의 `VIEW_W`(=CARD_WIDTH−24)도 반드시 함께 조정**(안 하면 도넛만 안 커지고 좌우 여백만 늘어남). 700 이상이면 `pixelRatio`가 3→2로 떨어지므로 `CAPTURE_TARGET_PX`도 함께 상향 필요.
- **간격(2026-08-08, 2026-09 28→40px)**: 비중바·리스트 래퍼는 배경 없이 `py-[26px] px-2` — 세로(`py-[26px]`)는 헤더~범례~리스트 실제 노출 간격 **40px** 통일용 마진 계산의 기준점(리스트 `mt-10`과 한 세트로만 조정), 가로(`px-2`)는 카드 폭을 넓게 쓰기 위한 좌우 여백. 헤더 좌우 패딩은 `px-2`(래퍼 `px-2`+내부 `px-0`와 동일, 카드 전체 좌우 오프셋 `outer p-3`+8=20px), 카드 최상단~헤더값 간격은 헤더 자체 `pt-2` + outer padding으로 20px. **푸터 제거(2026-09)로 리스트가 카드의 마지막 콘텐츠** — 카드 최하단 간격은 래퍼 자체 하단 `py-[26px]` + outer padding(더 이상 헤더 쪽과 대칭 아님, 별도 조정 요청 없으면 현행 유지). **모바일 미리보기**([share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx), #4.24): `DialogContent`가 모바일에서 **좌우 12px 인셋**(`left-3 right-3`) + **세로는 `top-[max(0.75rem,env(safe-area-inset-top))]` 앵커 + `h-auto`** → 팝업 높이가 내부 주식현황/포트폴리오 콘텐츠 높이만큼 늘어난다(뷰포트 고정 아님, 내부 프리뷰 영역에 자체 스크롤바 없음). 콘텐츠가 뷰포트를 넘으면 팝업 셸이 통째로 스크롤: `max-h-[calc(100dvh_-_max(0.75rem,env(safe-area-inset-top))_-_max(0.75rem,env(safe-area-inset-bottom)))]` + `overflow-x-hidden overflow-y-auto`(sm 이상 `sm:overflow-hidden`). `translate-x-0 translate-y-0`로 공용 중앙 배치 해제, `w-auto max-w-none`, `rounded-2xl border shadow-lg`. 가장자리로 공용 `DialogOverlay`(`bg-black/70 backdrop-blur-sm`)가 살짝 비친다. `sm:` 이상은 `sm:top/left-[50%] sm:translate-x/y-[-50%] sm:bottom/right-auto sm:w-full sm:max-w-[760px] sm:h-[94dvh] sm:max-h-[96dvh] sm:rounded-lg`로 중앙 배치 복귀. 미리보기 컨테이너는 모바일 `flex-none overflow-visible`(자연 높이) / `sm:flex-1 sm:overflow-y-auto`(고정 높이 다이얼로그의 스크롤 본문). `DialogDescription` `hidden sm:block`, 헤더 `px-3 pt-3 pb-2 sm:px-5 sm:py-4`, 공용 닫기(X) `[&_[data-slot=dialog-close]]:top-3 sm:top-4`. **셸 변경은 저장 PNG에 무영향**(저장은 화면 밖 고정 680 캡처 인스턴스 기준 — R32)

### PortfolioRingCard (`header-menu/share/portfolio-ring-card.tsx`)

인증카드 "포트폴리오" 타입 = **대형 종목 도넛 + 하단 분야 막대바(`PortfolioSectorBar`)** 2단(#4.24). 레퍼런스(Buffett Portfolio 인포그래픽) 형태 — 도넛이 카드 폭의 **73%**를 차지하고 **조각 안에 투명 배경 기업 로고**가 박힌다. 데이터는 `ShareCard`에서 계산해 props로 주입(로컬 훅 호출 없음).

- **(#4.26) 캔버스 높이 `ringH`**: `VIEW_H`(664) 고정이 아니라 링 하단(`CY+R_OUTER`)과 라벨 추정 최하단(`estLabelHeight`) 중 큰 값 + 40px. 6시 방향 라벨이 없으면 링 아래 빈 공간(≈100px) 회수. **(#4.27) 상한 `VIEW_H`는 캡처(`!responsive`)에만 적용** — 프리뷰는 폰트가 `floor/scale`로 커져 하단 라벨(이름 2줄+%)이 상한(664)을 넘어 잘렸음. 라벨은 `labelMaxWOf(zone, lx)`를 렌더와 공유, 텍스트는 **종목 이름**(`seg.name`, 티커는 로고용). PC/모바일 폰트 분기는 `usePcPreview`.
- **(#4.27) 프리뷰 전용 여유 3종(캡처는 전부 0/불변, R32)**: ① `topInset` — 12시 라벨이 앵커 위로 자라 상단이 잘리던 문제, `estLabelHeight − ly` 초과분만큼 링 좌표계(내부 래퍼 `top`)를 아래로 밀고 `viewH`에 가산. ② `sideExtra`(`PREVIEW_SIDE_EXTRA=64`) — 캔버스를 좌우 64px씩 넓혀(`canvasW`, scale·`labelMaxWOf`·`pushOutside` 한계에 반영) 좌우 라벨 가용폭 확보(링은 그만큼 작아짐). ③ 좌/우 라벨 `pushOutside` — `spreadVertically` 이후 박스 모서리(CY에 가장 가까운 세로 변)가 `PUSH_R=R_OUTER+14` 원 안쪽이면 `lx`를 바깥으로 밀되 이동량 `PUSH_MAX=24` 이내, 링 상단 근처(`|ly−CY|>UPPER_LABEL_DY=150`) 라벨은 `UPPER_SHIFT_UP=20`px 위로 올리고 기준 반경 `R_OUTER+10`(조각과 위치 정렬).
- **(#4.27) 종목명 줄바꿈 = 단어 단위**: `splitNameWords(name): string[][]`(export) — 공백 → 한글↔영문·숫자 경계·`(` 앞 → 6자 이상 순한글 토큰은 `NAME_LEXICON`(ETF 마스터 빈출 어휘 약 150개, 2자 이상)으로 **전부 덮일 때만** 최소 조각 분할(all-or-nothing, 미포함 조각이 있으면 원형 유지). 렌더는 토큰 사이에 `<wbr />`, 이름 span `[word-break:keep-all] [overflow-wrap:break-word] line-clamp-3`(한 토큰이 폭보다 길 때만 마지막 수단으로 글자 분리). `estLabelHeight`도 같은 토큰으로 그리디 줄 수(`wrappedLineCount`, ≤3) 계산 — 렌더와 추정이 어긋나면 `ringH`/`topInset`이 틀어진다. **이름+비중 최대 4줄**(이름 ≤3 + `%` 1줄, `%`는 `whitespace-nowrap`). 어휘 추가는 `NAME_LEXICON`에만.
- **props**: `segments: RingSegment[]` + `responsive?: boolean`. `responsive`면(화면용 프리뷰) 링 서브트리(`const ring`)를 `<div ref={outerRef} className="w-full … overflow-hidden">` + `transform: scale(min(1, floor(clientWidth)/VIEW_W))`로 폭에 맞춰 축소(가로 스크롤 없음 — R33, 레이아웃 박스도 스케일된 크기). `responsive` 미전달(캡처 인스턴스)이면 `VIEW_W`(656) 고정 — 저장 PNG 구도 불변. (중앙 지표 `holdingsCount`는 제거 — 중앙은 비움)
- **`RingSegment`**: `{ key; name; ticker; isForeign; truePct; color; etfBrand?; subLogos? }`. `subLogos`(최대 3, `SubLogo[]`)가 있으면 그 조각은 미니 칩 여러 개로 렌더된다("그 외" 전용). 상위 7 + "그 외" = 최대 8. `color`=조각 fill, `labelColor`=링 밖 % 텍스트, `color`는 조각 fill 과 링 밖 % 텍스트에 공용.
- **중앙**: **비움**(두꺼운 밴드 확보용). 과거의 "N 종목" 지표 블록은 삭제됨.
- **각도 압축**(`computeRingArcs(pcts, minArcs?)` export, 순수 함수): ① 조각별 최소각 `MIN_ARC_DEG`(22°) + 나머지를 비중 비례 배분 → ② 실제 비중 구간별 최대 호 상한 `MAX_ARC_BY_PCT`(`[[90,110],[80,100],[70,92],[60,84],[50,76]]`, <50%는 무제한) 초과분을 미고정 조각에 재분배(수렴까지) → ③ 실제 비중 내림차순 단조 clamp(역전 방지) → ④ 합 360° 정규화. 조각 1개면 360°. → ⑤ `minArcs`가 있으면 `enforceMinArcs`가 세그먼트별 최소각을 보장(부족분을 다른 조각에서 비례 회수하되 각자 `MIN_ARC_DEG` 바닥은 침범 안 함, 합 360·단조성 유지). **상수만 바꿔 튜닝**.
- **렌더**: SVG 도넛 웨지 `<path>` — `stroke="var(--ring-divider)" strokeWidth={5} strokeLinejoin="round"`, `GAP_DEG=0`. 구분선 색은 **라이트 `#ffffff` / 다크 `#000000`** 고정. 인접 조각의 stroke가 공유 모서리에서 겹쳐 한 줄 구분선이 된다. **외곽 링·안쪽 홀 라인 모두 없음** — 별도 테두리 없이 색면만으로 마감.
  - **조각 안 로고**: 로고 반경 `LOGO_R = R_INNER + (R_OUTER−R_INNER)*0.6`(밴드 바깥쪽 0.6 지점), 조각 `mid` 각도에 HTML 절대배치(`translate(-50%,-50%)`)로 `<BrandMark size={chipSizeFor(arc)} bgColor={seg.color} fontSize={ETF_LABEL_FONT_SIZE} />`(**조각색 원형** 칩). **칩 지름은 조각 각도(비중)와 무관하게 전부 동일**(2026-09 — 이전 sqrt 비례 보간 폐기, "조각은 차등이되 로고·라벨은 통일감 있게" 요청): `chipSizeFor()`는 고정 타깃 `CHIP_MIN`(50px)을 그대로 반환하되 로고 반경에서의 현(chord)×0.7 안전 상한만 걸어 극단적으로 좁은 조각만 방어적으로 축소하고, 그 결과가 `CHIP_HIDE_BELOW`(32px) 미만이면 **로고 자체를 생략**(목표 크기와 "너무 작으면 생략" 기준을 분리해, 확대해도 극단값에서 갑자기 사라지지 않게 함). ETF 텍스트 배지도 `fontSize={ETF_LABEL_FONT_SIZE}`(14px 고정)로 조각 크기 무관 통일.
  - **"그 외" 조각**: `subLogos`가 있으면 큰 칩 1개 대신 **`SUB_CHIP`(38px) 미니 칩 3개**를 **세로(반지름 방향)** 오프셋으로 쌓는다(2026-09 — 이전 원주 방향 각도 오프셋에서 전환, 밴드 두께가 원주 방향 여유폭보다 넓어 더 큰 칩을 안전하게 세로로 쌓을 수 있음). `rStep = SUB_CHIP + SUB_CHIP_GAP`(=45)만큼 `LOGO_R` 기준 반지름을 대칭 오프셋(각도는 `mid` 고정) — `polar(LOGO_R + (i-(n-1)/2)*rStep, mid)`. 이를 위해 `computeRingArcs`에 **세그먼트별 최소각**(`ETC_MIN_ARC`=40°)을 넘긴다. 서브칩도 `fontSize={ETF_LABEL_FONT_SIZE}` 전달(메인 조각과 동일 크기).
  - **링 바깥 라벨** = 이름 + 비중%만(**아이콘은 조각 안으로 이동**). 존별 정렬: `right` 좌측정렬 / `left` 우측정렬 / `top`·`bottom` 가운데정렬, 모두 `flex-col`.
  - **라벨 텍스트 = 종목 이름(`seg.name`) 통일**(#4.26 — 과거 "해외=티커" 하이브리드 폐기, 티커는 `BrandMark` 로고용).
  - **색·서체**: 앱 기본 산세리프(Inter). 이름 = `text-[15px] font-semibold tracking-tight text-foreground`, % = `text-[15px] font-bold tabular-nums` + `style={{ color: seg.color }}`(가독성 위해 `text-[15px]`로 상향, #4.24).
  - **종목명 짤림 원천 차단**: 라벨 컨테이너 `overflow-hidden` + `maxWidth`, 텍스트 컬럼 `min-w-0 max-w-full`, 이름 span `line-clamp-3 max-w-full` + (#4.27) `[word-break:keep-all] [overflow-wrap:break-word]` + 토큰 경계 `<wbr />`(위 "종목명 줄바꿈 = 단어 단위"). 토큰 경계 없이 `keep-all`만 쓰면 긴 무공백 한글이 박스 밖으로 넘치므로 `overflow-wrap`(break-word) 필수.
  - **라벨 겹침 방지**(`spreadVertically`): 좌/우 그룹의 `ly`를 `MIN_LABEL_GAP`(66px)만큼 벌린 뒤(아래로 밀고 그룹 중심 복원) 렌더. `lx`는 불변. `top`/`bottom` 존은 미적용.
- **라벨 폭**: 존별 기하 계산 — `right`는 `Math.max(64, VIEW_W - lx - 4)`, `left`는 `Math.max(64, lx - 4)`, `top`/`bottom`은 `208`(프리뷰·캡처 공통). **하한을 9/3시 방향 가용폭(≈68)보다 크게 잡으면 라벨 박스가 링 좌표계(0..VIEW_W)를 벗어나 화면 밖으로 짤린다** — 그래서 64. 좁은 존은 `line-clamp-3` + `[overflow-wrap:break-word]`(#4.27, 구 `anywhere`) + 말줄임으로 수렴(2026-09). `sideExtra`(프리뷰)만큼 좌우 가용폭이 `+64` 확장됨.
- **프리뷰 좌우 공백**: `scale = min(1, (clientWidth − PREVIEW_SIDE_INSET*2) / (VIEW_W + PREVIEW_SIDE_EXTRA*2))`(`PREVIEW_SIDE_INSET=8`, #4.27부터 분모가 `canvasW`) — 스케일 링을 16px 좁혀 `flex justify-center`로 좌우 8px씩 여백. 9/3시 라벨이 화면 끝에 붙어 짤리는 것 방지. 캡처(`!responsive`)는 `useEffect` early-return이라 `scale=1` 불변.
- **링 기하 상수**(고정 px, `CARD_WIDTH=680` 기준): `VIEW_W=656`(=CARD_WIDTH−24, **CARD_WIDTH 변경 시 반드시 동반 조정**) · `VIEW_H=664` · `CX=328` · `CY=322` · **`R_OUTER=240`** · `R_INNER=66`(중앙 비움, 밴드 174px — 홀 축소로 도넛이 더 커 보임) · `LABEL_R=264`(R_OUTER와 24px 간격 — 도넛↔종목명, 2026-09; **264 초과 시 3/9시 라벨 박스가 VIEW_W를 넘어 짤림**) · `LOGO_R = R_INNER + (R_OUTER−R_INNER)*0.6`(≈170 — 밴드 중앙에 두면 최소 조각의 칩이 `CHIP_HIDE_BELOW` 아래로 떨어져 로고가 생략된다)/`CHIP_MIN=50`(메인 조각 로고 칩 고정 타깃, 2026-09 44→50)/`CHIP_HIDE_BELOW=32`(안전장치 생략 기준 — 옛 `CHIP_MAX`/`CHIP_REF_ARC`는 비례 보간 폐기로 삭제)/`ETF_LABEL_FONT_SIZE=14`(메인·서브 조각 ETF 배지 공통 고정 폰트)/`SUB_CHIP=38`(2026-09 28→38, 세로 배치 전환과 함께 확대)/`SUB_CHIP_GAP=7` · `ETC_MIN_ARC=40` · `MIN_LABEL_GAP=66` · `GAP_DEG=0`. 캡처 DOM이라 뷰포트 반응형 클래스 금지. (2026-09-06 도넛·라벨 확대: `R_INNER` 78→66·`R_OUTER` 228→240·`VIEW_H` 620→664·라벨 `text-sm`→`text-[15px]`, `CARD_WIDTH`/`VIEW_W`는 불변이라 저장 PNG 가로 해상도 동일·세로만 +132px)
- **라벨 폰트 — 프리뷰/캡처 분리**(2026-09): 라벨 `<span>`(이름·%)은 인라인 `style={{ fontSize: rLabelFont, lineHeight: 1.15 }}`.
  - 프리뷰(`responsive`): 링 전체가 `transform: scale(min(1, clientWidth/VIEW_W))`로 축소돼 `text-[15px]`가 모바일 ~8px로 렌더 → `rLabelFont = Math.max(15, 12/scale)`(모바일 ~21px 언스케일 → 실효 ~12px, `PortfolioSectorBar` 프리뷰 `text-xs`(12px)와 동일; 데스크톱 scale≈1이면 15px).
  - 캡처(저장 PNG, `!responsive`): `rLabelFont = Math.round(12 * SHOT_BIG_SCALE)`(theme.ts import; 1.46 → 18, 1.42 → 17). 도넛 라벨은 좁은 존 짤림 때문에 본문(계수 14)보다 조금 작게.
  - **종목명 짤림 방지 — 프리뷰·캡처 공통**: `line-clamp-3`, `labelMaxW` 하한 좌우 `Math.max(64, …)`·top/bottom `208`, 프리뷰 `scale`이 좌우 8px씩 여백 확보(위 "라벨 폭"·"프리뷰 좌우 공백"). `spreadVertically`의 `gap` = `rGap`: 프리뷰 `max(MIN_LABEL_GAP, rLabelFont*4.5)`(3줄 라벨 수용), 캡처 `96`. `VIEW_W`/`VIEW_H`/`CX`/`CY`/`R_*` 불변 → 아트보드·구도·`pixelRatio` 유지.

### BrandMark (`header-menu/share/brand-mark.tsx`)

도넛 **조각 안**에 얹는 기업 로고 배지. **이미지 로고는 원형 칩 배경 = 해당 조각색**(`bgColor`) — 투명 여백이 있는 로고는 조각과 자연스럽게 이어지고, 흰 배경이 박힌 로고도 원형으로 정돈된다. **국내 ETF 텍스트 배지는 조각색을 어둡게 혼합한 톤**(`darkenColor(bgColor)`, `design-system.md` 참고)을 원형 배경으로 써서 조각 위에서 도드라진다(2026-09 — 처음엔 조각색 그대로 써서 밋밋했고, 이후 `pickOnColor` 흰/검정 2톤 고정은 팔레트 대부분이 흰색으로 수렴해 "무조건 흰색"으로 보이는 문제가 있었다).

- **props**: `{ ticker; name; isForeign; size; bgColor; etfBrand?; fontSize? }`. `fontSize?` — 지정 시 이 값을 그대로 폰트 px로 사용(계산식 무시), 메인 조각에서 "칩이 커져도 라벨은 고정" 용도(`PortfolioRingCard`가 메인·서브 칩 모두 `ETF_LABEL_FONT_SIZE`=14 고정 전달, 사실상 항상 지정됨). 로고 요청 해상도는 **`captureLogoSize(size)`**(= 표시 px × 1.5, route retina로 ×2 되어 결국 표시px×3). 과거 `size*6`(clamp 512 → retina 1024px PNG)은 모바일 WebView가 못 그렸다(2026-09 로고 누락). `etfBrand` 텍스트 배지 폰트는 **scale 보정을 걸지 않는다** — 도넛 라벨(`rLabelFont`)과 달리 칩(`size`)이 scale과 무관한 고정 px에 딱 맞춰 튜닝된 좁은 정사각 컨테이너라, `/scale`로 폰트만 키우면 `transform` 적용 전에 이미 텍스트가 칩보다 커져 넘친다(2026-09 시도 후 회귀 확인·롤백 — "여유 폭 넉넉한 라벨 텍스트"와 "꽉 찬 고정 칩 텍스트"는 같은 처방을 쓰면 안 됨).
- 칩: `rounded-full overflow-hidden` + `backgroundColor: bgColor`(이미지 로고) 또는 `darkenColor(bgColor)`(ETF 텍스트), 내부 `<img object-cover>`가 칩을 **꽉 채워** 완전한 원이 된다(로고 자체의 사각 모서리가 안 보임).
- **국내 ETF는 `etfBrand` 텍스트 배지**: 운용사 로고가 흰 배경 사각 이미지라(ACE 92.9%·TIGER 97.0%가 순백 불투명, 실측) 조각 위에서 흰 박스로 뜬다 → `BrandMark`가 `etfBrand` prop 유무로 `resolveLogoSrc` 호출 **전에** 분기해 브랜드명을 원형 칩에 텍스트로 렌더(로고 요청 자체를 안 함). **6자 이상 브랜드명은 `ETF_BRAND_ABBR`(파일 상단, 수동 매핑 10종 — KBSTAR→KBST·HANARO→HANR·TIMEFOLIO→TFOL 등)로 축약 표시**(`getEtfBrand()`가 반환하는 원문 `etfBrand`는 안 바꿈, 5자 이하는 고정 14px에서 이미 안 잘려 축약 불필요 — 신규 브랜드 추가 시 매핑 누락되면 원문 그대로 폴백). 배경 `darkenColor(bgColor)`, 글자색은 그 배경과 대비되는 `pickOnColor(badgeBg)`. 폰트는 `fontSize` prop 우선, 없으면 브랜드명 길이에 반비례 계산. **`resolveLogoSrc` 자체는 국내 ETF를 배제하지 않는다** — `StockIcon`(주식 탭 원형 아바타)은 같은 함수로 운용사 로고를 그대로 쓴다(흰 배경도 원 안에서는 자연스러움).
- **로고 URL이 없거나 로드 재시도 3회 소진 시 `null` 반환 — 칩 자체를 그리지 않는다.** "그 외"처럼 로고 없는 조각에 빈 배지가 남지 않게.
- src 해석·로드 재시도는 **`useLogoSrc` 훅**(`src/hooks/use-logo-src.ts`, `state-and-utils.md`) 경유 — `resolveLogoSrc`를 직접 부르지 말 것(재시도 누락). `StockIcon`도 같은 훅. `imgError` state 영구 폴백 패턴(2026-09 로고 누락 원인)은 이 훅으로 교체됨.
- 캡처 DOM 전용 — 고정 px, `sm:` 금지(R32). `<img>`여야 `captureImage`의 dataURL 인라인 루프를 타므로 인라인 `<svg>`로 바꾸지 말 것.

### PortfolioSectorBar (`header-menu/share/portfolio-sector-bar.tsx`)

인증카드 "포트폴리오" 타입 도넛 **하단** — X-Ray 테마(분야) 축 분포. **금액 미표기**(분야명 + 비중%만, 개별 종목 서브 항목 없음). 캡처 DOM 전용(고정 px).

- **props**: `title: string`(캡션), `items: { key; label; pct; color }[]`, `big?: boolean`(캡처 저장 PNG 전용 — 캡션·라벨·% `text-[20px]`, 막대·색점 `size-[15px]`/`h-[15px]`; 2026-09). 프리뷰(비-`big`)는 캡션·라벨·% `text-xs`(12px, 2026-09 `text-sm`→`text-xs`로 낮춰 도넛 라벨 실효 ~12px과 밀도 정렬), 막대·색점 `2.5`(10px). `ShareCard`가 `big={shotBig}`(=`!responsive`) 전달. **범용 컴포넌트** — "분야 구성"·"보유 유형 구성" 두 곳에서 재사용(#4.24, 캡션만 다름).
- **데이터 1 — 분야 구성**(`ShareCard.sectorItems`): `computeBreakdown("theme", mergedStocks, exchangeRates)`(`lib/xray/stock-xray.ts`, X-Ray 탭과 동일 엔진) → `items` 평가액 desc → 상위 `SECTOR_MAX`(5) + 나머지 `ratio` 합산 "그 외 N개 분야"(최대 6항목으로 통일, #4.24). fill = `SHARE_SAFE_PALETTE[i]`(도넛과 공용), % 텍스트도 같은 색, "그 외"=`SHARE_ETC_COLOR`.
  - **가드**: `key !== "unclassified" && ratio > 0`인 분야가 2개 미만이면 `[]` 반환 → 막대바 섹션 미렌더. 분류 fetch는 `ShareScreenshotDialog`가 `useXrayClassifications`로 자동 수행(위 ShareCard 항목 참조).
- **데이터 2 — 보유 유형 구성**(`ShareCard.categoryItems`): **`assetData.stocks` 원본**(병합 전)을 `stock.category`로 그룹핑해 `computeStockMetrics(...).pct` 합산 → 값 desc 정렬(delisted만 제외, `totalValue` 분모와 동일 필터). **`mergedStocks`를 쓰면 안 됨** — "all" 필터는 카테고리 무관 티커 단위로 병합해(예: 같은 ETF를 연금+IRP 양쪽에 보유) 병합 대표 1건의 category만 남아 다른 카테고리 보유분이 누락된다(#4.24 회귀 발견·수정). **`irp`·`pension`은 그룹핑 시점에 `"pension_irp"` 키로 합쳐 "연금저축펀드·IRP" 라벨 하나로 표시**(#4.24) — `stockCategories` 값 자체는 안 바꾸고 이 계산에서만 병합. 나머지 라벨은 `stockCategories`(`config/asset-options.ts`) 재사용. 필수 입력 필드라 미분류 가드 불필요, `items.length > 0`이면 항상 렌더(단일 카테고리만 있어도 노출 — 프로젝트 규칙: 목록 표시 조건은 `length > 0`, `> 1` 금지).
- **(#4.26) 범례·제목**: 범례는 주식 현황과 같은 "이름 %" 인라인(`gap-1`, 이름 `flex-1` 없음), 섹션 제목은 `font-bold text-foreground` + 범례보다 한 단계 큼(캡처 `text-[22px]`, 프리뷰 `text-sm sm:text-base`). 아래 렌더 설명의 "캡션 `text-muted-foreground`" 문구는 이 변경 이전 기준.
- **렌더**: 캡션(프리뷰 `text-xs` / 캡처 `text-[20px]`, `text-muted-foreground`) + 가로 스택바(`h-2.5 rounded-full` / 캡처 `h-[15px]`) + 2열 범례(색점 + 분야명 truncate + `pct%` 조각색 bold, 텍스트 크기는 `txt`와 동일). 재사용 참고: `dashboard.tsx` `SectionBar` 구조 / `stock-tab.tsx` `StockBarChart` 스타일(단 ₩ 제거).

### InvestorAvatar (`header-menu/share/investor-avatar.tsx`)

인증카드 "투자 유형" 캐릭터(순수 SVG + CSS, 이미지 리소스 없음). props: `spec: InvestorAvatarSpec`(`themeKey`·`regionKey`·`accountKey`·`concentration`·`stockTypeKey`, `resolveInvestorType().avatar`), `size`(프리뷰 176 / 캡처 208), `flat?`(캡처 전용 — 소품 타일·코너 배지 box-shadow 제거, 웨일 캡처 아티팩트 방지).
- **얼굴 타원·소품 아이콘·계좌 아이콘 색**은 섹터(`THEME_VISUAL` 13종) 고정, **눈**은 집중도(`EYE_POOL_BY_CONCENTRATION` 3풀), **입**은 종목유형(`MOUTH_POOL_BY_STOCK_TYPE` 8풀)에서 seed(`avatarSeed`)로 `pick`(`lib/xray/seeded-pick.ts` 공유), **바깥 원**은 테마와 무관한 30색 HSL 팔레트(`OUTER_BG_PALETTE`, `hsl(h,68%,87%)→(h,62%,58%)→(h,68%,34%)` 방사형 그라데이션)에서 `pick`.
- 코너 배지: 우상단 지역(`국내`/`해외` 2종, 글자 `fontSize = round(size×0.057)`), 좌하단 계좌 아이콘(`ACCOUNT_ICON`). 소품·계좌 아이콘 크기는 `size` 비례(`accessorySize×0.5`, `badgeSize×0.83`).

### usePcPreview (`header-menu/share/use-pc-preview.ts`)

`usePcPreview(responsive: boolean): boolean` — 프리뷰(`responsive`)에서만 `matchMedia("(min-width: 640px)")`(Tailwind `sm:`과 같은 기준)를 추적, 캡처는 항상 `false`. `portfolio-ring-card.tsx`(도넛 라벨 폰트 12/14px)와 `share-card.tsx`(설명 `targetChars` PC/모바일 분기)가 공유하는 단일 출처 — 새로 PC/모바일 프리뷰 분기가 필요하면 이 훅 재사용.

### useKoreanAdvanceScale (`header-menu/share/use-korean-advance-scale.ts`)

`useKoreanAdvanceScale(enabled: boolean): number` — 인증카드 **캡처(`!responsive`) 전용**. 한글이 OS 폰트로 그려져 기기마다 글자 폭이 달라지는 문제(iOS가 PC보다 ≈5~6% 좁음)를 보정: 화면 밖 `<span>`에 "가"×20을 100px로 그려 자폭(em)을 재고 `scale = clamp(TARGET_ADVANCE / advance, 1, 1.12)`(줄이지 않고 키우기만, `document.fonts.ready` 뒤 재측정). `TARGET_ADVANCE = 0.92`(Windows 맑은 고딕 실측, PC=1 불변). `share-card.tsx`의 `krPx(px)`가 투자 유형 캡처의 제목 30·설명 17·유형 배지 14·쪽지 14·워터마크 글자에 적용. 개발 모드 콘솔 `[share] 한글 자폭(em)`으로 기기별 값 확인. 캡처 DOM에 글자 크기를 새로 넣을 때 재사용.

### WelcomeGuide (`layout/welcome-guide.tsx`)

첫 진입 안내 페이지. `page.tsx`의 `isWelcomeGuide` 분기에서 `<AppGuide />` 위에 표시.

### WelcomeHero · WelcomeTrustLine · RootFirstPaint (`layout/onboarding/welcome-intro.tsx`, #4.61)
- 웰컴 첫 부분(① 히어로 h1·부제, ② 신뢰 한 줄)의 **공용 조각**(`"use client"`·훅·window 없음 → 서버/클라이언트 첫 렌더 동일). `WelcomeGuide`와 `RootFirstPaint`가 같은 코드를 렌더한다(복제 금지). `WelcomeHero({enter})`: `enter=false`면 `ENTER` 없음. 래퍼 클래스 상수 `WELCOME_PAGE_WRAP`·`WELCOME_ROOT`·`WELCOME_TRUST_WRAP`과 `ENTER`(진입 stagger 클래스)도 여기 정본.
- `RootFirstPaint` = `page.tsx`의 `!isDataLoaded` 분기(`data-first-paint`, testid `first-paint-shell`). 히어로+신뢰 줄만, 버튼·CTA·미리보기 없음. `html[data-has-assets]`(layout.tsx head, 키 3개 존재만 판정)이면 `globals.css` 1규칙으로 `display:none`.
- `WelcomeGuide({ skipHeroEnter })`: 사전 조각을 거친 첫 웰컴 mount만 히어로·신뢰 줄 ENTER 생략(mount 시점 값 고정). `page.tsx`가 `skipHeroEnterRef`로 전달, 다른 화면이 렌더되면 해제.

- 순자산 카드: `DataSourceBadge kind="realtime"` 포함, `bgLight` 토대
- 보안 상세 카드 3장 = `SECURITY_COPY`(#4.38, 앱가이드와 같은 상수). 신뢰 한 줄은 "로그인 없음 · 자산은 내 기기에 저장 · 원하면 암호화 동기화"(nowrap 묶음 3개, `text-balance` 없음)
- 미리보기 데이터: `welcome-preview-data.json`
- 미리보기 대시보드: 실제 `dashboard.tsx` 컴포넌트를 공통 공유하여 동일 포맷으로 노출하되, 내부의 클릭이나 인터랙션은 차단/방지 처리.
- `StockSummaryHeader`에 `currencyGain`/`dailyProfit`/`dailyProfitRate`/`screenshotMode={false}` 전달
- **블록 순서(#4.35 "가치 먼저")**: ① 히어로(제목+쉬운 말 한 줄, 배지 없음) ② 신뢰 한 줄 + "자세히 보기" 토글 + 보안 상세(기존 `FeatureCard` 3장 원문, 제자리 grid-rows 펼침·기본 접힘·`inert`, 저장 안 함, GA 없음) ③ 예시 순자산(`NetAssetSummaryBox`) ④ **CTA 단일 슬롯**(#33 대체 지점) ⑤ 주식 미리보기("주식 미리보기"+예시 데이터 라벨) + 안내 문구 ⑥ 설치 박스(데스크톱·태블릿 미설치만, 1행). 루트 `space-y-5`
- **CTA 슬롯**: `welcomeCtaState({ mounted, isStandalone, isInApp })` → `pending`(마운트 전, 빈 셸 `min-h-[216px] sm:min-h-[160px]` = asset 높이와 같아 점프 0, SSR 동일) / **`inapp`(#4.38, 인앱 브라우저·standalone 아님 — mounted 다음 최우선)**: `WelcomeInAppCta({ isIOS })` = 제목 "자산 등록은 Chrome·Safari에서 시작해요"(nowrap 묶음)·본문·brand "외부 브라우저에서 시작하기"(`useExternalMove`, 처리 중 disabled+Loader2). iOS는 버튼 아래 항상 마운트된 grid-rows 펼침(`welcome-inapp-guide`, 래퍼 `pt-5 break-keep`) 안에 `InAppExternalGuide notice={캡션} lastStep=…`. 제목+버튼만 `space-y-5`, 가이드는 형제(닫힘 여백 0). 등록·설치·file input 미렌더, 데스크톱 설치 박스도 숨김 / `asset`(모바일 웹 미설치 포함, #4.86 `install` 상태 삭제. `WelcomeAssetCta` = 스크린샷 등록 brand + 직접 입력·가져오기 secondary Popover: 직접 입력 5행 `WELCOME_MANUAL_ROWS`(부동산·주식·암호화폐·현금성 자산·대출, `handleManualAdd(type)` = `onboarding_action{manual}` 1회 + `ADD_TRIGGER_EVENTS[type]` CustomEvent `{mode:"manual"}`, `asset_add_start` 미전송) + 구분선 + 가져오기 2행). 셸 노드 유지, 콘텐츠만 교체. 체험 복귀(`focusCta`) 시 포커스 → `welcome-cta-wizard`
- GA 매핑 순수 함수: `welcomeSource(standalone, inApp)`, `WELCOME_CTA_METHODS`(값은 기존 `PARAM_VALUES`와 동일)
- **③ 라벨 행 "직접 둘러보기"(#4.38 #59)**: `PreviewLabel`에 선택 prop `action`(있으면 제목+배지 `flex-wrap` 묶음 + 액션 첫 줄 오른쪽, `items-start`). `WelcomeTrialLink` 칩(`welcome-trial-link`, `bg-brand/15` 틴트·`h-8 -my-1.5`+`after:-inset-1` 40px 히트·연타는 ref 가드 1회) → `trackThenNavigate("feature_use",{category:"demo"},"/?trial=1")`. 노출 = 마운트 후 && `allowTrial`(page: `!isSharePending`) && 복원 해시 없음. 체험 종료 복귀: 별도 effect가 `trial_exit` 소비 → `onboarding_action{trial_start}` 1회 → `showAssetCta`(asset 상태·wizard 포커스)
- 고정 testid(qa 계약): `welcome-trial-link`(#59)·`welcome-cta-inapp`·`welcome-inapp-guide`·`welcome-inapp-caption`(#4.38)·`welcome-hero`·`welcome-trust`·`welcome-security-toggle`·`welcome-security-detail`·`welcome-preview-net`·`welcome-cta-slot`(`data-state`)·`welcome-install-btn`(데스크톱 설치 박스 전용)·`welcome-cta-wizard`·`welcome-cta-more`·`welcome-manual-label`·`welcome-manual-{real-estate|stock|crypto|cash|loan}`·`welcome-import`·`welcome-sync-connect`·`welcome-preview-stock`·`welcome-install-box`
- 설치 버튼(`InstallButton`, 파일 내부)은 홈 버튼과 동일한 공용 `PwaInstallFlow`(render-prop) 호출. 모바일은 슬롯, 데스크톱은 설치 박스에만 렌더(화면당 1개)

### InAppBrowserGate (`pwa/in-app-browser-gate.tsx`) · InAppExternalGuide (`pwa/in-app-external-guide.tsx`)
- 게이트는 `resolveInAppGate(env)`(state-and-utils) 결과만 따른다: `none`·`welcome` 미렌더 / `cover` = 데이터 로드 전(자산 키 속성·복원 해시·동기화일 때만, #4.61) 문구 없는 `fixed inset-0 bg-background`(`Z_LAYER.gate`, `data-testid="inapp-gate-cover"`, `aria-hidden`) / `gate` = **같은 루트 노드**에 기존 경고·PIN 내용(노드 교체 없음). 외부 이동은 `useExternalMove`(#4.38)
- `InAppExternalGuide({ lastStep?, notice? })` — `notice`(#4.38)를 넘기면 앰버 블록 안쪽(제목+"앱 설치 기능…" 문장)만 대체, 아이콘·1~3단계·하단 안내 유지. 미전달 시 기존 문구(설치 흐름·1건 이상 게이트). 소비처: 게이트, `pwa-install-flow` inAppStep, 웰컴 inapp 슬롯

### 가이드 페이지 (`src/app/guide/*`, #4.45 #77) · InstallNudge · TaxSeasonStrip
- 가이드 2편(`/guide/stock-ratio`·`/guide/net-worth`): `(main)` 밖 정적 서버 문서(`/ratio`와 같은 껍데기·`max-w-[480px]`). 문구 정본 `guide-copy.ts`(`GUIDES`·`GUIDE_SLUGS`, 보안 문장은 `security-copy` 원문 import, 슬러그·lastModified는 sitemap이 import). `guideMetadata(slug)`(guide-shell)가 canonical·openGraph·twitter(images 포함) 재선언. 본문 `_components/guide-article.tsx`(라우트 로컬, 공용 아님·단계 번호 `aria-hidden`·`guide-fact-box` 카드 1장), 클라이언트 `guide-actions.tsx`(`GuideScreenTracker`·`GuideActions`: 체험은 `<a href>` + `trackThenNavigate` 연타 1회 가드). 새 가이드 추가 = copy 항목 + 폴더 1개 + sitemap 자동 반영
- `InstallNudge`(`(main)/_components/pwa/install-nudge.tsx`): 상단바 설치 아이콘 옆 1회 카드(모바일). 신호 `lib/pwa/first-save-signal.ts`(모듈 메모리), 판정 `shouldShowInstallNudge`(튜토리얼은 `isTutorialFinished === true`만). `PwaInstallFlow` render-prop 재사용, 누른 뒤엔 카드만 `hidden`·마운트 유지(설치 다이얼로그 보존)
- ~~`TaxSeasonStrip`~~(4.83 삭제): 세금 진입은 상세·주식 도구 타일 `stock-tool-tax`(`StockToolTiles`)로 이전 — `setInitialTab("simulator")` 후 `navigate({type:"tax"})` 그대로

### RatioPreview (`src/app/ratio/ratio-preview.tsx`, #4.39 #63) · RatioHandoffHost (`(main)/_components/ratio/ratio-handoff-host.tsx`)
- `/ratio`(`(main)` 밖, 서버 `page.tsx`가 metadata·SSR 본문): 업로드·결과를 한 클라이언트 컴포넌트가 노드 유지 + 높이 펼침(`Unfold`, 이 파일 전용)으로 전환. `useAssetData`·react-query·토스트 사용 금지(provider 밖). 문구는 `ratio-copy.ts`
- `RatioHandoffHost`: `(main)/layout.tsx`에 1줄. 마운트 시 `peekHandoff()` null이면 영구 null. 조건 충족 시 `takeHandoff()` 후 `StockScreenshotImport open initialParsed`, `onSaved`에서 `feature_use{ratio_preview, submit, create}` 1회
- 예시 모드(#4.40 #66): `status "sample"` + `resultMode`("sample|real", `ratio-result[data-mode]`). dropzone Unfold 안 `ratio-sample-btn`(secondary) → `handleSample`이 `RATIO_SAMPLE_STOCKS`를 `buildRatioList`로 로컬 계산(서버 호출·`geminiUsage`·`setHandoff` 없음, GA `method: sample` 1건). 결과 맨 위 `ratio-sample-label`(포커스 대상), 액션은 brand `ratio-sample-cta`+캡션만(저장·인앱·다시보기·노트 숨김). 복귀 `handleSampleExit`: limit·device 오류만 복원, dropzone 포커스·파일창 미오픈. 문구는 `ratio-copy.ts` `RATIO_SAMPLE`
- `StockScreenshotImport`에 `initialParsed?: ParsedStock[]`(#4.39): open 시 같은 배열 1회만 처리, 업로드 단계 생략(`increment`·`trackParse` 미호출), 개별 모드로 conflict/preview 진입

### TrialGate (`trial/trial-gate.tsx`, #4.38 #59) — 체험 모드 게이트(운영 포함)
- `(main)/layout.tsx`에서 `ReactQueryProvider` 안·**PreviewGate 바깥**(데모를 넣은 메모리를 PreviewGate가 읽게)·`AssetDataProvider` 바깥
- `useSearchParams()`로 `?trial=1`을 첫 렌더에 1회 고정(SSR 동일). 없으면 `<>{children}</>`(DOM 추가 0). 있으면 children 보류 + 로딩 덮개(`trial-gate-loading`, `fixed inset-0 bg-background`·`Z_LAYER.gate`, 문구 없음·sr-only "불러오는 중", 페이드는 바깥 span 300ms 지연·회전은 안쪽 Loader2 — 같은 `animation` 속성이라 노드 분리) → `trial-boot` 동적 import → `trial`/`rejected`는 children, `failed`는 `location.reload()`

### TrialBanner (`views/home/trial-banner.tsx`, #4.38 #59) — 체험 "예시" 표기 정본 1곳
- `page.tsx` 정상 분기 `isTrialMode() && view.type === "home"`일 때 `AssetPageTabs` 앞 in-flow(고정 아님). 상세·성과에는 배지 추가 금지
- 중립 카드 면 + 주황 아이콘 칩(`Compass`) + brand "내 자산으로 시작"(`trial-start-btn`) 1개, `data-screenshot-hide`. 탭 → sessionStorage `trial_exit=1` → `location.assign("/")`. 인앱은 `useExternalMove`(iOS는 `trial-inapp-guide` 펼침, 표식 없음)
- 체험 중 숨김(1줄 가드): FAB(`page.tsx`), TopBar 더보기·설치(`PwaInstallButton` — 설치 흐름이 /api/share 사용), BottomNav `update`·`more`. 인증카드 유지(상단·허브 아이콘, PWA 포함)

### PreviewGate (`preview/preview-gate.tsx`, #4.34) — Vercel preview 전용
- `(main)/layout.tsx`가 `isPreviewEnv()`일 때만 `next/dynamic`으로 렌더해 `AssetDataProvider` 바깥을 감싼다. 운영·로컬은 children 그대로(DOM 추가 0)
- `?demo` 처리 중에는 children 렌더 보류 → provider가 주입된 데이터를 처음부터 읽는다(컨텍스트 연동 코드 0)
- 고정 셀렉터(qa 계약): `[data-testid="preview-badge"]`·`preview-demo-btn`·`preview-empty-btn`·`html[data-demo-ready="1"]`. 배지·카드 모두 `data-screenshot-hide`, z-index `Z_LAYER.modal - 1`
- 운영 컴포넌트(`WelcomeGuide` 등) 미수정 — 선택 카드는 fixed 하단 카드로 띄운다

### TutorialOverlay (`tutorial/tutorial-overlay.tsx`)

Step 1~5 오버레이(Step 0 제거됨). Step 5 내부 sub-step: activity → profit.

- 앱 소개 단독 보기는 별도 `app-guide.tsx`(`AppGuideContent`, `"use client"`) 다이얼로그로 분리 — 튜토리얼 오버레이와 무관
- 외부 진입(공유/클라우드 동기화)·standalone 시 `skipAllTutorialSteps()`로 전체 자동 스킵. 상태는 `secretasset_tutorial_status` 단일 키

---

## 공용 브랜드 컴포넌트 (`src/components/`, shadcn `ui/` 제외)

### Logo (`src/components/logo.tsx`)

시크릿에셋 서비스 로고 — 파비콘과 동일한 **Leckerli One** 서체(`next/font/google`, weight 400 단일,
이 파일 모듈 스코프에서 로딩)로 "S" 한 글자를 렌더. **props**: `{ size?: number(기본24); className?; style? }`.
위치·색·투명도는 전부 호출부 `className`/`style`로 위임 — 컴포넌트 자체는 배치를 가정하지 않는다.
자산/화면/폼 등 어떤 도메인에도 속하지 않는 범용 브랜드 UI 원자라 `(main)/_components/` 도메인 트리가
아니라 `src/components/`(shadcn 전용 `ui/`와는 별도)에 둔다. 종목 로고 배지인 `BrandMark`(아래,
`header-menu/share/brand-mark.tsx`)와는 무관 — 이름 혼동 주의.

- **소비처(2026-09)**: 인증카드(`share-card.tsx`, 우상단 워터마크) · 홈 상단바(`top-bar.tsx`, 홈
  화면 좌측 "상세/성과" 옆) · PWA 하단 네비(`bottom-nav.tsx`, "홈" 탭 아이콘 대체).
- 필기체 글리프는 좌측 여백(side-bearing)이 있어 박스 정렬만으로는 다른 텍스트/아이콘과 시각적으로
  안 맞을 수 있다 — 소비처마다 `ml-*`/`top-*` 등으로 개별 보정 필요(정렬 기준은 소비처 코드 주석 참고).

---

## shadcn/ui 주요 컴포넌트 (`src/components/ui/`)

> #4.49: 사용처 없는 27개(accordion·alert·avatar·calendar·carousel·command·dropdown-menu·navigation-menu·scroll-area·table 등) 삭제. 필요하면 shadcn CLI로 다시 추가. `level-meter.tsx`는 보존.

```
Button, Input, NumberInput(커스텀), Label, Badge
Card, CardHeader, CardTitle, CardDescription, CardContent
Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
Form, FormField, FormItem, FormLabel, FormControl, FormMessage
Select, Tabs, Textarea, Separator, Skeleton, toast(Sonner)
Collapsible, CollapsibleContent, CollapsibleTrigger
InputOTP, InputOTPGroup, InputOTPSlot
```

**NumberInput** (`number-input.tsx`): `value`, `onChange`, `quickButtons[]`, `allowDecimals`, `maxDecimals` — 천 단위 콤마 자동 포맷

**Button** (`button.tsx`): 기본 누름 피드백 `active:not-disabled:scale-[0.96]` 내장. `link` 변형·`static` prop(`<Button static>`) 전달 시 scale 비활성. 전환은 `transition-[color,box-shadow,transform] duration-150 ease-out`(transition-all 금지). 의미색은 `variant="brand"`(확인·제출) 등 CLAUDE.md 규칙 준수.

> **폴리시 공통(design-system.md §6)**: shadcn 프리미티브(toggle/switch/dialog/sidebar)는 `transition-all` 대신 변하는 속성만 명시. 작은 닫기 버튼은 `after:absolute after:-inset-*`로 40×40 히트영역 확보.

---

## 카드 레이아웃 패턴

```tsx
<div className="rounded-lg border bg-card overflow-hidden">
  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b">  {/* 헤더 */}
  <div className="flex flex-row items-start justify-between p-4">  {/* 핵심지표 */}
  <div className="px-4 py-3 bg-muted/10 border-t">  {/* 보조 섹션 */}
  <div className="px-4 py-2.5 flex flex-wrap text-xs text-muted-foreground border-t bg-muted/5">  {/* 하단 메타 */}
</div>
```

## config/theme.ts 주요 항목

```typescript
ASSET_THEME = {
  // tab* 토큰은 더 이상 사용 안 함 — 모든 탭이 InlineSelector로 통일됨 (tabList1·tabList3Wrap legacy 잔존, tabList2/3은 #4.34 삭제)
  cardWrapper, listBox(다크 리스트 box, #4.44)·cardOpenDivider(펼친 항목 하단선)·StockRowHeader 오늘 등락 칩 모바일 우측 이동(#4.44), summaryBoxDark, cardHeader, cardActions("flex justify-end gap-2 px-3 py-2 bg-muted/40 dark:bg-popover"),
  cardActionButton, cardTriggerButton, cardInfoLeft/Right/Title/Meta/Name,
  cardAmountMain/Sub/Rate/ProfitRow,
  cardDetailLabel/Value/ValueBold/PriceKRW/Meta,
  cardLoanSection/Title/Item/Name/Rate,
  categoryBox, todayBox, inputHeader, liabilityBadge,
  summaryHeader, important, liability, profit, loss,
  primary: { text, bgLight, border }, text: { default, muted },
  distributionCard,
}
MAIN_PALETTE  // 12색 팔레트 (인덱스 고정: 0=최대비율/인디고 primary, 1=대출, 2=임차보증금)
getProfitLossColor(value)  // 빨강(이익) / 파랑(손실)
```

**디자인 토큰 (이번 세션 정리):**
- 카드 액션 버튼 (수정/삭제)은 `ASSET_THEME.cardActions` (별도 라인, `flex justify-end ... bg-muted/10`) — 5탭 통일
- InlineSelector 배경: `bg-muted/60 dark:bg-muted/40` (라이트 짙음). `fullWidth` 모드(#4.34): 같은 폭 grid 칸 + 절대 위치 썸(`translateX(index*100%)`, `bg-card dark:bg-foreground/15 shadow-sm`) + ←/→·Home/End 로빙 tabindex, 칸 `min-h-10 text-sm`. 기본 경로는 스냅샷 테스트로 고정(`layout/ui/__tests__/inline-selector.test.tsx`)
- FAB·ScrollToTop: `bg-foreground/{85,70}` 무채색 토큰 (라이트 검정/다크 흰 자동 반전)
- Card 모바일 padding: `px-4 sm:px-6` (CardHeader/CardContent/CardFooter)

### 배당 투입 대비 배당 줄 · 메뉴 행 상수 · 홈 도넛 (#4.46)
- `DividendCard`(`views/activity/dividend-chart.tsx`): Hero 금액 아래 `data-testid="dividend-yield"` 블록(값 줄 "투입 대비 배당 N%" + 캡션). 계산은 `computeDividendYield(items, usdRate, mode)` 순수 함수(`lib/finance/dividend-yield.ts`). 조회 중·배당 0·계산 불가면 미렌더, 월 선택 시 언마운트 대신 `opacity-0 aria-hidden`
- `menu-styles.ts`(`header-menu/`): 더보기·설정 공용 `MENU_COLUMN`(max-w-2xl 좌정렬)·`MENU_ROW`·`MENU_ROW_DESTRUCTIVE`·`MENU_SECTION_LABEL`(muted)·`MENU_ICON`(단색)·`MENU_LABEL`·`MENU_DESC`·`menuBadge(on)`(앱 잠금·다크 모드 ON/OFF 배지)
- `AssetDonutChart`/`DonutLabel`(`views/home/dashboard.tsx`): 홈은 이름+% 2줄·`DONUT_LABEL_MIN_PCT(name)` 미만이면 라벨 없음·`pickDonutLabelColor(color)` 글자색·조각 stroke `var(--background)`·범례 열 정렬. `screenshotMode`(웰컴)는 `legacy` 경로로 3줄 라벨·`var(--card)`·기존 범례 유지(스냅샷 `__tests__/donut-welcome-snapshot.test.tsx`)

### 동기화 덮임 알림·되돌리기 (#4.47 #84)
- `BalanceResyncDialog`(`forms/asset-update/balance-resync-dialog.tsx`, #4.52 #93): 현금·대출 보유 ≥1건일 때 FAB `직접 입력`이 `trigger-resync-balance`(`dispatchResyncBalance`)로 여는 잔액 맞추기. prop `category="cash"|"loan"`, `CashInput`·`LoanInput`이 각각 마운트. Dialog 3분할(헤더/스크롤 본문/고정 푸터)·행 2줄 스택(이름·`현재 …`/입력)·`변경` 라벨+brand ring·오류(현금 0)·경고(자릿수)·`바뀐 N개 저장`. 계산은 `lib/asset/balance-edits.ts`, 저장은 `getAssetData()`+`saveData` 1회. 변경 ≥1이면 바깥 탭·Esc 차단. 닫힘 포커스(#4.60 #109): `onCloseAutoFocus`가 보이는 FAB(`data-tutorial="tutorial-fab"`) → 열기 직전 요소 → `main` 순으로 돌려준다(스크롤로 숨은 `.opacity-0` FAB 제외, `preventScroll`; FAB 버튼은 `focus-visible:ring-2 ring-ring`)(여는 버튼이 FAB 시트와 함께 사라져 Radix 기본 복귀 대상이 없음, 이 창만). `ProfitMetric`(detail-summary-header.tsx)은 표시 반올림 0이면 부호 없이 회색(`text-muted-foreground`) — 판정은 상세 전용 `profitTone` 헬퍼(#4.62, 카드 행·펼침·허브 행 공유, state-and-utils.md)에서만, 공용 `getProfitLossColor` 불변. 닫힘 포커스 순서는 `lib/restore-focus.ts` 공용 함수로 이동(#4.62), FAB 시트도 사용(방법 선택 등 다른 창 이어짐은 `handoffRef`로 생략).
- `YearlyAddLink`(`views/activity/net-asset-chart.tsx` 로컬): 연도별 순자산 입력 창을 여는 인라인 링크(`dispatchOpenYearlyNetAsset`), 연 탭 빈 상태·1점 Hero 공용
- `HoldingsResyncDialog`(`forms/asset-update/screenshot/holdings-resync-dialog.tsx`, #4.50 #91): 주식·코인 보유 ≥1건일 때 `stock-input`·`crypto-input` 진입 분기가 여는 `스크린샷으로 보유 현황 맞추기`. props `open`·`onOpenChange`·`kind="stock"|"crypto"`. 3단계(올리기·인식 최대 5장 순차 → 변경 미리보기 → 결과·되돌리기), 문구 증권사/거래소·주식/코인은 `COPY`+`KindCtx`. 계산은 `lib/asset/resync`, 저장은 적용·되돌리기 핸들러의 `saveData` 1회. 로컬 조각: `UploadStep`·`ShotThumb`·`PreviewStep`·`ItemRow`·`NeedsRow`·`CheckRow`(공용 승격 시 등록)
- `SyncOverwriteDialog`(`functions/cloud-sync/sync-overwrite-dialog.tsx`): `CloudSyncProvider` 하위 항상 마운트(layout). `useCloudSync()`의 `showOverwriteList`·`overwriteEntries`·`refreshOverwrites`·`revertOverwrites`·`dismissOverwrites` 사용. 열 때·확정 때 목록 재계산(R1), 확정 시 건수가 줄면 "그사이 바뀐 M건은 목록에서 뺐어요." 후 재확정. 기기 동기화 다이얼로그(`cloud-sync-menu-entry.tsx`) armed 상태줄 아래 `sync-overwrite-card`가 같은 다이얼로그를 연다

### LinkAccountRow (`forms/trade/link-account-row.tsx`, #4.58 #103) — 거래 입력 '연결 계좌' 행
- 주식 `trade-input`·코인 `crypto-tx-input` 수동 폼 공용. 즉시 반영 박스 바로 아래 별도 박스(같은 마크업): 라벨 `연결 계좌` + `Select`(`연결 안 함`/그룹: 원화 거래 `현금 계좌`·`대출`, 외화 거래 `달러 현금`|`엔화 현금` → `원화 현금` → `대출`, #4.63 #119) 1행, 아래 `cash-link-preview`(항상 마운트, grid-rows 펼침) + 보조 1줄, 4.52 `ResyncTxWarning` 재사용, 오류 박스(`cash-link-error`·`loan-link-error`, `role="alert"`). 후보 0개·즉시 반영 해제면 행 없음(후보는 있는데 거래일이 이번 달이 아니면 muted 안내 1줄 `account-link-note` `지난달 거래는 계좌 잔액을 바꾸지 않아요`), 외화→원화 계좌 선택 시 보조 줄이 환산식(`$1,235.73 × 1,390원만큼 현금이 줄어요`, 식 부분 `whitespace-nowrap`)이고 금액 표시 통화는 선택 계좌 통화, 선택이 후보에서 사라지면 `연결 안 함`으로 복귀(effect).
- 값·문구·평가는 `lib/trade/link-text.ts`(`evaluateLink`가 표시와 제출 차단에 같은 결과). 삭제 다이얼로그 안내는 `DeleteRollbackDialog`의 `linkedNote` prop·코인 모달 `delete-linked-record-note`.

- `BrandLockup`(`src/components/brand-lockup.tsx`, #4.66 logo-spec·R6·R8) — 홈 상단 왼쪽 공식 락업: `BrandSymbol` + `BrandWordmark`(기본 hidden, PWA standalone에서만 `.pwa-home-wordmark`로 노출), 색은 둘 다 `--brand-logo`. 브라우저 모드는 심볼만(32px 박스). PWA는 `.pwa-home-symbol` 18.21px(lg 21.01px, S 잉크 높이 15.25/17.6px, R8)·음수 좌측 여백 -4.46px(lg -5.14px, 박스 여백 7.1311/32 상쇄 + 기울기 광학 보정 0.4/0.46px), 워드마크 잉크 높이 13px(lg 15px), 잉크 간격 = S 잉크 높이 × 0.3124(4.76px, lg 5.49px; 워드마크 `ml-[0.7px] lg:ml-[0.81px]`), 세로 = 잉크 중심 일치 + 워드마크 `translate-y-[0.25px] lg:translate-y-[0.3px]`(무게중심 보정). 비인터랙티브, `data-testid="top-bar-brand"`. 규약은 design-system.md §14.
- `BrandSymbol`(`src/components/brand-symbol.tsx`, #4.66 R8) — Leckerli One "S" 글리프 아웃라인 인라인 SVG(파비콘·`Logo`와 같은 서체, 폰트 파일 미포함·SIL OFL 출처 주석). viewBox 32, path 1개, 잉크 높이 26.8(y 2.6~29.4 = 세로 중심 16)·폭 17.74(x 7.13~24.87, 가로 중앙), `fill: var(--brand-logo)`. 해상도 분기 없음. `size`는 SVG 속성이라 CSS width/height로 덮어쓸 수 있음.
- `BrandWordmark`(`src/components/brand-wordmark.tsx`, #4.66 logo-spec·R6) — "시크릿에셋" 글자 아웃라인 SVG(Pretendard Variable wght 750, OFL, 폰트 파일 미포함), 자간 +110/2048em(R6) + 커닝 시크 -15·크릿 -80·릿에 +40·에셋 +60, viewBox `25 -1641 9224 1833`(잉크 경계라 높이 클래스+`w-auto`로 크기 지정), `fill=currentColor`(락업에서 `text-[color:var(--brand-logo)]`), `aria-label`=서비스명.
