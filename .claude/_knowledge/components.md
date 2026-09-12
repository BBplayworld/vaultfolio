# 컴포넌트 참조

> 마지막 업데이트: 2026-06-22

## 자산 컴포넌트 (`src/app/(main)/_components/`)

> **구조 변경(2026-06)**: `(main)/asset/` 레이어 제거 → `(main)/_components/`로 평탄화, `header` → `header-menu`로 rename. (이전 2026-05-23 rename: `bottom-nav`→`forms`, `main-nav`→`views`, `top-nav`→`header`)

```
_components/
├── forms/                 # 자산 입력 폼 + 스크린샷/거래 다이얼로그
│   ├── asset-update/
│   │   ├── input/          # 자산 입력 폼 + 목록 렌더링
│   │   │   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   │   │   ├── real-estate-input.tsx, cash-input.tsx, crypto-input.tsx, loan-input.tsx
│   │   │   └── exchange-rate-input.tsx
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
│   │   └── xray/                    # stock-xray-view, stock-insight-strip
│   └── activity/
│       ├── net-asset-chart.tsx      # Hero(현재 순자산+전년 대비) + 년도별/월별/일별 InlineSelector(CardHeader)
│       ├── profit-chart.tsx         # 카드 헤더 InlineSelector + 시장 selector(size sm) + collapse 안 기준종가표
│       ├── dividend-chart.tsx       # Hero(연간/월 배당) + InfoHint + 카테고리 범례 + 예상/실제 토글
│       └── performance-hub.tsx, monthly-dividend-stocks.tsx
├── layout/                # 라우팅·공용 UI
│   ├── navigation/        # navigation-context(NavigationProvider+useAssetNavigation), asset-page-tabs(view 분기 라우터), asset-dispatch
│   ├── ui/                # inline-selector(size sm/md/lg), kpi-card, info-hint, prompt-preview-dialog
│   ├── floating/          # floating-add-button(bg-foreground/85 FAB), scroll-to-top
│   ├── onboarding/        # welcome-guide, notice, notice-dialog
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
- **ActivityView({tab})**: InlineSelector(순자산/수익/배당) + YearlyNetAssetChart/ProfitCard/DividendCard
- 입력 폼 8종(자산 5종 + Cash/Loan/CryptoTx) `<div className="hidden">` 래핑으로 DOM에 상시 마운트 (편집 다이얼로그용)
- **CashTxInput** (`forms/asset-update/input/cash-tx-input.tsx`, S-4.22): 현금 입출금 기록 폼. `trigger-add-cash-tx`(`dispatchAddCashTx(cashId)`)로 오픈. 입금/출금·정기 토글·반영·출금초과 가드·중복 인라인 확인. hidden 영역 상시 마운트
- **CashTxView** (`views/detail/cash-tx/cash-tx-view.tsx`, S-4.22): `cash-transactions` 탭. 총입금·출금·순유입 통계·기간/유형 필터·반영 삭제 시 잔액 역가감. 진입 대상은 `useCashTxViewStore`. 현금 카드 "입출금 기록/내역" 버튼·성적표 habit 딥링크로 진입
- **LoanTxInput** (`forms/asset-update/input/loan-tx-input.tsx`, S-4.24): 대출 상환/추가대출 기록 폼. `trigger-add-loan-tx`(`dispatchAddLoanTx(loanId)`)로 오픈. `CashTxInput` 미러링(통화 분기·정기 토글 없음, 상환초과 가드·중복 인라인 확인). hidden 영역 상시 마운트
- **LoanTxView** (`views/detail/loan-tx/loan-tx-view.tsx`, S-4.24): `loan-transactions` 탭. 총상환·추가대출·순상환 통계·기간/유형 필터·반영 삭제 시 잔액 역가감·완납 배지. 진입 대상은 `useLoanTxViewStore`. 대출 카드 "상환/대출 기록·내역" 버튼으로 진입
- **CryptoTxInput** (`forms/asset-update/input/crypto-tx-input.tsx`, S-4.25): 코인 매수/매도 기록 폼. `trigger-add-crypto-tx`(`dispatchAddCryptoTx(cryptoId)`)로 오픈. `CashTxInput` 구조 미러링이나 계산은 잔액 가감이 아니라 `trade-utils.computeNewPosition` 가중평균(주식과 동형) — 반영 시 수량·평단 재계산, 반영 후 예상 포지션 인라인 미리보기·초과매도 가드(`validateReflection`)·중복 인라인 확인. hidden 영역 상시 마운트
- **CryptoTxView** (`views/detail/crypto-tx/crypto-tx-view.tsx`, S-4.25): `crypto-transactions` 탭. 총매수·총매도 통계·기간/유형 필터. 반영 삭제는 잔액 역가감이 아니라 `trade-utils.rollbackTransaction`(거래로그 전체 재적용)으로 포지션 롤백. 진입 대상은 `useCryptoTxViewStore`. 코인 카드(병합·거래소별 하위 카드) "매수/매도 기록·내역" 버튼 및 "자산업데이트" 플로팅 버튼(코인 선택 시)으로 진입
- **TaxCalendarView** (`views/tax/tax-calendar-view.tsx`, S-4.23·S-4.31 개편): `#tax` 뷰, 타이틀 "세금 관리". 헤더+`InlineSelector`(size="lg", "세금 일정관리"/"절세 시뮬레이션" 전환)를 `sticky top-0`로 고정(라우팅 불변, 페이지 내부 상태 전환 — 이번 달 자동 스크롤에도 탭이 항상 보이도록 2026-08-27 추가). 일정관리 탭 = 기존 12개월 세로 리스트(`InlineSelector` 내 세금/전체 필터 · `Collapsible` 상세 · 현재 월 강조·`scrollIntoView`(`scroll-mt-32`로 고정 헤더 높이만큼 여유) · 해외주식 실현차익 근거 박스 · 하단 면책). 시뮬레이션 탭 = `TaxYearEndSimulator` 렌더. `settings`와 동일한 더보기 하위 페이지 패턴(하단탭 미등록). shadcn `Calendar`는 날짜 선택기라 사용하지 않는다
- **TaxYearEndSimulator** (`views/tax/tax-year-end-simulator.tsx`, S-4.31): 연말 절세 시뮬레이션. `TaxCalendarView`의 "절세 시뮬레이션" 탭 콘텐츠로만 존재(별도 Sheet·라우팅 없음, 개별 종목 카드의 진입 버튼도 없음 — 이 화면 하나로 통합). 입력은 **체크박스 + 버튼만**(텍스트 입력 없음): 종목 `Checkbox` 선택 → 프리셋 칩("전량"/이익 종목이면 "한도까지 · 비과세") + `±1`/`±5`/`±10` 버튼으로 수량 조정. `getYearEndTaxSimulation`(당해 실현손익 0이어도 candidates 반환)과 `simulateSelectedForeignSale`(선택이 비어 있어도 baseline 기준 결과를 항상 반환 — 2026-08-28부터 무조건 호출) 재사용.
  - **상단 통합 결과 박스**(2026-08-28, `sticky top-28` — 부모 헤더+탭 높이만큼 오프셋을 둬 스크롤과 무관하게 항상 노출): 예상 양도소득세 큰 숫자 + 보조 수치 3개(실현손익=고정, 잔여 공제 한도=선택 반영해 실시간 갱신, 합산 손익=`text-foreground` 강조). 과거엔 baseline 박스(최상단)와 예상 세액 박스(최하단)가 분리돼 있었으나 정보 중복이라 하나로 합쳐 상단으로 이동.
  - 손익 색상은 전역 규칙(`getProfitLossColor`, 이익=빨강/손실=파랑) 그대로 재사용. 순수 조회 UI(`assetData` 변경 없음)
  - **"한도까지"는 종목별로 매 렌더 재계산**(2026-08-28): `lib/tax-utils.ts`의 `computeRebuyQuantity(gainPerShareKrw, quantity, baseGainKrw)` 재사용 — 각 행마다 "자기 자신을 제외한 현재 선택 전체 손익 + baseline"을 `baseGainKrw`로 넘긴다. 손실 종목을 먼저 선택한 뒤 이익 종목의 한도가 그만큼 늘어야 하는데(손익통산) 정적 `candidates[].rebuyQuantity`(선택 0개 기준 초기값)만 쓰던 버그를 수정.

### NavigationProvider (`layout/navigation/navigation-context.tsx`)

- `AssetView = home | detail/{tab} | activity/{tab}` 상태 + hash 동기화 + popstate 리스너
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

### ScrollToTop (`layout/floating/scroll-to-top.tsx`)

화면 우하단 utility 버튼. 100px 스크롤 시 노출. `window.scrollTo(top:0)` 고정이라 마운트된 페이지의 스크롤 컨테이너가 `window`(일반 페이지 스크롤)일 때만 재사용 가능.

- 적용처: 세금 관리 > 일정 관리 탭(`tax-calendar-view.tsx`, S-4.32) — 월별 리스트가 길어 상단 헤더+탭까지 되돌아가는 용도. 시뮬레이션 탭은 자체 상단 sticky 결과 박스가 있어 제외.

- `<button>` native 태그 (shadcn Button의 outline variant `bg-background` 덮어쓰기 회피)
- `bg-foreground/70 text-background` (선명한 무채색 회색). hover `bg-foreground/90 scale-105`
- 크기: `size-10`, `shadow-md` — FAB보다 시각 비중 약함 (utility 위계)

### \*-input.tsx 공통 구조

1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어 (`hideList` prop)

### 스크린샷 다이얼로그 공통 패턴

- `open/onOpenChange` props로 외부 제어
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(15회) 체크
- **중복 처리:** stock/crypto → merge/reset 선택, cash/loan → 항상 append

---

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
- `useFilteredStockData(activeCategory)` — 필터된 주식 계산 훅
  - 정렬된 tickerList (`.sort()`) 보장 → 다른 컴포넌트와 캐시 키 일치
  - `inactiveStatus !== "delisted"` 필터 포함
  - `dailyProfit`은 `filteredStocks` 기준 합산 (카테고리 selector 따라 즉시 변동)
- `CATEGORY_TABS`

**`screenshotMode` 분기 (인증카드 = share-card 전용)** — 캡처 DOM은 680px 고정폭(`CARD_WIDTH`, share-menu.tsx)이라 `sm:` 뷰포트 반응형 금지(R32). `screenshotMode`인 컴포넌트는 `ASSET_THEME` 대신 **`ASSET_THEME_SHOT`**(theme.ts)을 쓴다.

- **프리뷰(`responsive`)** — `ASSET_THEME_SHOT`. 상세>주식 탭 모바일보다 **의도적으로 ~2px 작다**(2026-09 조정 — 프리뷰에서 "주식 현황"이 "포트폴리오" 도넛 라벨(실효 ~12px)보다 커 보여 낮춤): `cardInfoName`/`cardAmountMain`/`legendText`/`bodyText`/`profitRate`/`footerDomain` `text-xs`(12px), `summaryValue` `text-[17px]`, `profitAmount` `text-sm`(14px), `iconInitial` `text-[8px]`, `badge` `text-[9px]`, `footerBrand` `text-[10px]`, `icon` `size-5`(20px). 포트폴리오 하단 막대바(`PortfolioSectorBar` 비-`big`)도 `text-xs`로 함께 낮춰 도넛 라벨과 밀도 정렬. 상세 탭·저장 PNG는 무관.
- **캡처(저장 PNG, `shotBig`=`!responsive`)** — 680px 아트보드는 프리뷰(~374px)의 2배라 같은 절대 px면 비율이 절반. 캡처는 **`ASSET_THEME_SHOT_BIG`**(폰트·아이콘을 `SHOT_BIG_SCALE`배 한 결과를 하드코딩; 현재 1.46 → 14→20·20→29·16→23·9→13·10→15px, `icon` `size-[35px]`)을 쓴다. `SHOT_BIG_SCALE`(theme.ts)은 문서용 배율 상수 — Tailwind JIT가 `text-` 임의값을 소스에서 스캔하므로 CSS 변수/런타임 계산 불가, 값 바꾸면 BIG 값들을 base×SCALE로 재계산해 교체(theme.ts 주석에 base 표). `shotBig`은 `screenshotMode`와 **별개 플래그**(재결속 시 프리뷰 펼침 부활). 배율 이력 ×1.8 → 1.57 → 1.42 → 1.5 → 1.46.
- 예외: `cardHeader` `py-2`·`cardTriggerButton` `gap-4`·`legendGrid` 간격은 프리뷰·캡처 공통(텍스트만 확대, 간격 불변).
- 토큰 미경유 하드코딩 본문(`text-sm` "N주"·"그 외 N종목"·헤더 라벨·푸터 도메인 등)은 `ASSET_THEME_SHOT(_BIG).bodyText`(14 / 22px) 공용 키로 분기.

- `StockCard` — 헤더 + 비중 그라데이션 바만 노출. Collapsible·상세 그리드·수정/삭제 버튼·담보대출·보유 메타 모두 미렌더. `maskFn`으로 hideAmounts 마스킹 전달
- `StockRowHeader` / `StockIcon` — 이름·금액·수량·아이콘·Badge 클래스를 `screenshotMode`면 `shotBig ? ASSET_THEME_SHOT_BIG : ASSET_THEME_SHOT`으로 스왑. 비중%는 미노출(범례로 통합), `TodayChangeChip`(오늘 등락) 미렌더. `StockIcon`은 로고를 `useLogoSrc` 훅으로 로드(캡처 시 `captureLogoSize(shotBig ? 34 : 28)` 요청, 재시도 3회) — **로고 URL이 있어도 최종 로드 실패 시 이니셜 폴백**(과거엔 빈 색 원형만 남았음, 2026-09 수정)
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
| Dashboard           | `main-nav/home/dashboard.tsx`           | 총자산/순자산/손익 요약 + 분포 |
| AssetDetailTabs     | `main-nav/detail/asset-detail-tabs.tsx` | 5탭 상세 목록                  |
| YearlyNetAssetChart | `main-nav/activity/net-asset-chart.tsx` | 순자산 추이 — 년도별/월별/일별 |
| ProfitCard          | `main-nav/activity/profit-chart.tsx`    | 기간별 수익 차트 (점진 로드)   |
| DividendCard        | `main-nav/activity/dividend-chart.tsx`  | 배당 카드                      |
| DataSourceBadge     | `main-nav/data-source-badge.tsx`        | "실시간"/"캐시" 출처 Badge     |
| AssetReportView     | `views/activity/asset-report-view.tsx`  | 자산 성적표 — 재사용 UI 패턴(섹션 구분·뱃지 라벨·비교 그리드·SpecRow) 레퍼런스, [design-system.md](design-system.md) §5.1 참조 |
| HomeTipBox (S-4.32 후속) | `views/home/home-tip-box.tsx`      | 홈 알림/팁 통합 박스 — 자산 분포 카드 **아래** 1곳에만 존재. 과거 상단 `BackupNudge`/`RefreshNudge` + 하단 `TaxNoticeBox`/`FeatureTipBox` **4개를 흡수**해 화면엔 한 번에 1개만 뜬다. 판정은 [state-and-utils.md](state-and-utils.md) `home-tip.ts`의 `pickHomeTip()`이 **새 공지(필수 노출)>백업>세금>자산최신화>신규기능>저방문기능** 순으로 골라 반환, 종류별 재노출 정책은 원래 로직 그대로(백업·최신화=노출 시 오늘 flag, 세금=명시적 닫기 시 이번 달 flag, **공지=열람(클릭)해야만 `markCurrentNoticeSeen()`으로 TTL 90일 dismiss — X 닫기는 이번 세션만 숨기고 열람 처리 안 함(최소 1회 열람 강제)**, 기능=닫기·클릭 이동 둘 다 영구 dismiss). **X 닫기는 종류별 mark에 더해 `sessionStorage` 세션 플래그(`secretasset_home_tip_session_dismissed`, `pwa-connect-prompt.tsx` 패턴)를 찍어 이번 세션(창) 동안 박스 전체를 숨긴다 — 다음 순위 팁이 바로 튀어나오는 두더지잡기 방지. 재접속(새 세션) 시 초기화되어 각 종류의 정책대로 다음 팁이 정상 회전 노출. 단, `isNoticeUnseen() && !NOTICE_SHOWN_SESSION_KEY`인 동안(= 미열람 공지가 이번 세션에 아직 안 뜸)은 이 세션 플래그를 무시하고 무조건 `pickHomeTip`을 호출한다(#4.24) — 다른 팁을 X로 닫아 세션 플래그가 서도 공지의 "최초 1회 노출"은 가로막히지 않는다. 공지가 실제 렌더되면 `NOTICE_SHOWN_SESSION_KEY`를 세워 바이패스를 끄므로, 이후 공지 X 닫기 → 같은 세션 재진입 시 재노출 안 됨(QA에서 재노출 버그 발견·수정).** 인터랙션은 5종 모두 "카드 전체 클릭=유일한 동작(백업 다운로드/세금 화면 이동/최신화 시트 오픈/**공지→해당 기능 다이얼로그 오픈**/기능 화면 이동), X=닫기"로 통일된 단일 보더리스 셸. **공지(#4.24 재도입, 필수 노출)**: 홈 진입 시 강제 팝업하던 과거 `UpdateNoticeDialog`(S-4.32에서 제거)와 달리 다이얼로그를 억지로 띄우진 않지만, 팁 카드 자체는 **최우선순위**라 새 버전 공지가 있으면 백업·세금 안내보다도 먼저 반드시 노출. **클릭 시 공지 본문 다이얼로그가 아니라 이번 릴리스가 홍보하는 실제 기능으로 직행**(#4.24 후속) — 지금은 `dispatchOpenShareCard("portfolio")`로 인증카드를 포트폴리오 타입으로 즉시 오픈(릴리스마다 홍보 대상이 바뀌면 이 액션도 함께 갱신). 더보기 메뉴의 공지 수동 열람(`notice.tsx`, `tool-menu.tsx`의 `showNotice`)은 그대로 유지 |
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

### header (`header/`, 구 top-nav)

- `TopBar` — 좌측: `view !== "home"`일 때 ChevronLeft + getViewTitle("상세"/"성과"). 우측: 인증카드·도구 아이콘 2개 (h-10 sm:h-11, MAIN_PALETTE[5]/foreground 토큰)
- `ShareScreenshotButton` (`IdCard` 아이콘) → `ShareScreenshotDialog` → `ShareCard` (인증카드 생성)
- `ToolMenu` (Settings 아이콘만) — Dropdown: 데이터 관리(내보내기/가져오기/공유/캐시초기화/삭제) + 기능(AI 평가 / **다크모드 토글** / **앱 가이드 · 공지사항** 통합 선택기). 공지 뷰어는 자동 팝업과 동일 `NoticeContent`·`NOTICE_TITLE` 재사용. `ThemeSwitcher` 컴포넌트는 삭제됨 — 도구 메뉴에 통합
- `AppGuide` — 평소 hidden, `trigger-restore-guide` 수신 시 표시 (도구 메뉴 "앱 가이드 · 공지사항"에서 앱 가이드 선택 시 디스패치)
- `MajorUiUpdateNoticeDialog` — 업데이트 공지 (일주일간 숨기기)

### ShareCard = 인증카드 (`header-menu/share/share-card.tsx`)

사용자 노출 명칭은 **"인증카드"**(버튼·네비·다이얼로그·튜토리얼·공지). 파일·식별자는 `share-card.tsx` / `ShareCard` / `ShareScreenshotDialog` / `screenshotMode` 유지.

**타입 2종** — `ShareScreenshotDialog` 제어 바의 `InlineSelector`(로컬 state `variant`, 저장 안 함)로 전환. `ShareCard`가 `variant` prop(`"stock" | "portfolio"`)을 받아 분기하고 푸터(브랜드명 + 도메인, **날짜 없음** — #4.24 후속 제거)는 공통. `ShareScreenshotDialog`는 `initialVariant?` prop을 받아, 열릴 때(`open && initialVariant`) 그 타입으로 맞춘다 — `dispatchOpenShareCard("portfolio")`(`asset-dispatch.ts`, `trigger-open-share-card` 이벤트 `detail.variant`)로 홈 "새 공지" 팁이 포트폴리오로 직행할 때 사용(#4.24). 인자 없이 상단 아이콘 버튼으로 열면 직전 선택을 그대로 유지(리셋 안 함).

1. **주식 현황**(`variant="stock"`, 기본) — 아래 원래 구성. "금액 표시" 스위치는 이 타입에서만 노출.
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
푸터: APP_CONFIG.name + siteHost
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
- **간격(2026-08-08, 2026-09 28→40px)**: 비중바·리스트 래퍼는 배경 없이 `py-[26px] px-2` — 세로(`py-[26px]`)는 헤더~범례~리스트~푸터 실제 노출 간격 **40px** 통일용 마진 계산의 기준점(리스트 `mt-10`과 한 세트로만 조정 — 4개 이음새를 동시에 맞춰야 비대칭이 안 생김), 가로(`px-2`)는 카드 폭을 넓게 쓰기 위한 좌우 여백. 헤더·푸터 좌우 패딩은 `px-2`(래퍼 `px-2`+내부 `px-0`와 동일, 카드 전체 좌우 오프셋 `outer p-3`+8=20px), 카드 최상단~헤더값/푸터~카드 최하단 간격도 `pt-2`/`pb-2`로 대칭. **모바일 미리보기**([share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx), #4.24): `DialogContent`가 모바일에서 **좌우 12px 인셋**(`left-3 right-3`) + **세로는 `top-[max(0.75rem,env(safe-area-inset-top))]` 앵커 + `h-auto`** → 팝업 높이가 내부 주식현황/포트폴리오 콘텐츠 높이만큼 늘어난다(뷰포트 고정 아님, 내부 프리뷰 영역에 자체 스크롤바 없음). 콘텐츠가 뷰포트를 넘으면 팝업 셸이 통째로 스크롤: `max-h-[calc(100dvh_-_max(0.75rem,env(safe-area-inset-top))_-_max(0.75rem,env(safe-area-inset-bottom)))]` + `overflow-x-hidden overflow-y-auto`(sm 이상 `sm:overflow-hidden`). `translate-x-0 translate-y-0`로 공용 중앙 배치 해제, `w-auto max-w-none`, `rounded-2xl border shadow-lg`. 가장자리로 공용 `DialogOverlay`(`bg-black/70 backdrop-blur-sm`)가 살짝 비친다. `sm:` 이상은 `sm:top/left-[50%] sm:translate-x/y-[-50%] sm:bottom/right-auto sm:w-full sm:max-w-[760px] sm:h-[94dvh] sm:max-h-[96dvh] sm:rounded-lg`로 중앙 배치 복귀. 미리보기 컨테이너는 모바일 `flex-none overflow-visible`(자연 높이) / `sm:flex-1 sm:overflow-y-auto`(고정 높이 다이얼로그의 스크롤 본문). `DialogDescription` `hidden sm:block`, 헤더 `px-3 pt-3 pb-2 sm:px-5 sm:py-4`, 공용 닫기(X) `[&_[data-slot=dialog-close]]:top-3 sm:top-4`. **셸 변경은 저장 PNG에 무영향**(저장은 화면 밖 고정 680 캡처 인스턴스 기준 — R32)

### PortfolioRingCard (`header-menu/share/portfolio-ring-card.tsx`)

인증카드 "포트폴리오" 타입 = **대형 종목 도넛 + 하단 분야 막대바(`PortfolioSectorBar`)** 2단(#4.24). 레퍼런스(Buffett Portfolio 인포그래픽) 형태 — 도넛이 카드 폭의 **73%**를 차지하고 **조각 안에 투명 배경 기업 로고**가 박힌다. 데이터는 `ShareCard`에서 계산해 props로 주입(로컬 훅 호출 없음).

- **props**: `segments: RingSegment[]` + `responsive?: boolean`. `responsive`면(화면용 프리뷰) 링 서브트리(`const ring`)를 `<div ref={outerRef} className="w-full … overflow-hidden">` + `transform: scale(min(1, floor(clientWidth)/VIEW_W))`로 폭에 맞춰 축소(가로 스크롤 없음 — R33, 레이아웃 박스도 스케일된 크기). `responsive` 미전달(캡처 인스턴스)이면 `VIEW_W`(656) 고정 — 저장 PNG 구도 불변. (중앙 지표 `holdingsCount`는 제거 — 중앙은 비움)
- **`RingSegment`**: `{ key; name; ticker; isForeign; truePct; color; etfBrand?; subLogos? }`. `subLogos`(최대 3, `SubLogo[]`)가 있으면 그 조각은 미니 칩 여러 개로 렌더된다("그 외" 전용). 상위 7 + "그 외" = 최대 8. `color`=조각 fill, `labelColor`=링 밖 % 텍스트, `color`는 조각 fill 과 링 밖 % 텍스트에 공용.
- **중앙**: **비움**(두꺼운 밴드 확보용). 과거의 "N 종목" 지표 블록은 삭제됨.
- **각도 압축**(`computeRingArcs(pcts, minArcs?)` export, 순수 함수): ① 조각별 최소각 `MIN_ARC_DEG`(22°) + 나머지를 비중 비례 배분 → ② 실제 비중 구간별 최대 호 상한 `MAX_ARC_BY_PCT`(`[[90,110],[80,100],[70,92],[60,84],[50,76]]`, <50%는 무제한) 초과분을 미고정 조각에 재분배(수렴까지) → ③ 실제 비중 내림차순 단조 clamp(역전 방지) → ④ 합 360° 정규화. 조각 1개면 360°. → ⑤ `minArcs`가 있으면 `enforceMinArcs`가 세그먼트별 최소각을 보장(부족분을 다른 조각에서 비례 회수하되 각자 `MIN_ARC_DEG` 바닥은 침범 안 함, 합 360·단조성 유지). **상수만 바꿔 튜닝**.
- **렌더**: SVG 도넛 웨지 `<path>` — `stroke="var(--ring-divider)" strokeWidth={5} strokeLinejoin="round"`, `GAP_DEG=0`. 구분선 색은 **라이트 `#ffffff` / 다크 `#000000`** 고정. 인접 조각의 stroke가 공유 모서리에서 겹쳐 한 줄 구분선이 된다. **외곽 링·안쪽 홀 라인 모두 없음** — 별도 테두리 없이 색면만으로 마감.
  - **조각 안 로고**: 로고 반경 `LOGO_R = R_INNER + (R_OUTER−R_INNER)*0.6`(밴드 바깥쪽 0.6 지점), 조각 `mid` 각도에 HTML 절대배치(`translate(-50%,-50%)`)로 `<BrandMark size={chipSizeFor(arc)} bgColor={seg.color} />`(**조각색 원형** 칩). **칩 지름은 조각 각도(=비중)에 비례**(`chipSizeFor`) — `MIN_ARC_DEG`(22°)~`CHIP_REF_ARC`(110°)를 `CHIP_MIN`(44px)~`CHIP_MAX`(92px)로 sqrt 이징 보간하고, 로고 반경에서의 현(chord)×0.7로 상한을 걸어 조각 밖으로 넘치지 않게 한다. 하한도 못 채우는 좁은 조각이나 **로고가 없으면 생략**.
  - **"그 외" 조각**: `subLogos`가 있으면 큰 칩 1개 대신 **`SUB_CHIP`(28px) 미니 칩 3개**를 조각 각도 범위에 균등 배치(`SUB_CHIP_GAP`=6px 간격). 이를 위해 `computeRingArcs`에 **세그먼트별 최소각**(`ETC_MIN_ARC`=40°)을 넘긴다.
  - **링 바깥 라벨** = 이름 + 비중%만(**아이콘은 조각 안으로 이동**). 존별 정렬: `right` 좌측정렬 / `left` 우측정렬 / `top`·`bottom` 가운데정렬, 모두 `flex-col`.
  - **라벨 텍스트 = 하이브리드**: 해외 종목(`seg.isForeign && seg.ticker`) → **티커**, 그 외 → **`seg.name`**.
  - **색·서체**: 앱 기본 산세리프(Inter). 이름 = `text-[15px] font-semibold tracking-tight text-foreground`, % = `text-[15px] font-bold tabular-nums` + `style={{ color: seg.color }}`(가독성 위해 `text-[15px]`로 상향, #4.24).
  - **종목명 짤림 원천 차단**: 라벨 컨테이너 `overflow-hidden` + `maxWidth`, 텍스트 컬럼 `min-w-0 max-w-full`, 이름 span `[overflow-wrap:anywhere] line-clamp-2 max-w-full`. `break-keep`은 줄바꿈을 막아 카드 밖 짤림을 유발하므로 **사용 금지**.
  - **라벨 겹침 방지**(`spreadVertically`): 좌/우 그룹의 `ly`를 `MIN_LABEL_GAP`(66px)만큼 벌린 뒤(아래로 밀고 그룹 중심 복원) 렌더. `lx`는 불변. `top`/`bottom` 존은 미적용.
- **라벨 폭**: 존별 기하 계산 — `right`는 `Math.max(64, VIEW_W - lx - 4)`, `left`는 `Math.max(64, lx - 4)`, `top`/`bottom`은 `208`(프리뷰·캡처 공통). **하한을 9/3시 방향 가용폭(≈68)보다 크게 잡으면 라벨 박스가 링 좌표계(0..VIEW_W)를 벗어나 화면 밖으로 짤린다** — 그래서 64. 좁은 존은 `line-clamp-3` + `[overflow-wrap:anywhere]` + 말줄임으로 수렴(2026-09).
- **프리뷰 좌우 공백**: `scale = min(1, (clientWidth − PREVIEW_SIDE_INSET*2) / VIEW_W)`(`PREVIEW_SIDE_INSET=8`) — 스케일 링을 16px 좁혀 `flex justify-center`로 좌우 8px씩 여백. 9/3시 라벨이 화면 끝에 붙어 짤리는 것 방지. 캡처(`!responsive`)는 `useEffect` early-return이라 `scale=1` 불변.
- **링 기하 상수**(고정 px, `CARD_WIDTH=680` 기준): `VIEW_W=656`(=CARD_WIDTH−24, **CARD_WIDTH 변경 시 반드시 동반 조정**) · `VIEW_H=664` · `CX=328` · `CY=322` · **`R_OUTER=240`** · `R_INNER=66`(중앙 비움, 밴드 174px — 홀 축소로 도넛이 더 커 보임) · `LABEL_R=264`(R_OUTER와 24px 간격 — 도넛↔종목명, 2026-09; **264 초과 시 3/9시 라벨 박스가 VIEW_W를 넘어 짤림**) · `LOGO_R = R_INNER + (R_OUTER−R_INNER)*0.6`(≈170 — 밴드 중앙에 두면 최소 조각의 칩이 `CHIP_MIN` 아래로 떨어져 로고가 생략된다)/`CHIP_MIN=44`/`CHIP_MAX=92`/`CHIP_REF_ARC=110`/`SUB_CHIP=28`/`ETC_MIN_ARC=40` · `MIN_LABEL_GAP=66` · `GAP_DEG=0`. 캡처 DOM이라 뷰포트 반응형 클래스 금지. (2026-09-06 도넛·라벨 확대: `R_INNER` 78→66·`R_OUTER` 228→240·`VIEW_H` 620→664·라벨 `text-sm`→`text-[15px]`, `CARD_WIDTH`/`VIEW_W`는 불변이라 저장 PNG 가로 해상도 동일·세로만 +132px)
- **라벨 폰트 — 프리뷰/캡처 분리**(2026-09): 라벨 `<span>`(이름·%)은 인라인 `style={{ fontSize: rLabelFont, lineHeight: 1.15 }}`.
  - 프리뷰(`responsive`): 링 전체가 `transform: scale(min(1, clientWidth/VIEW_W))`로 축소돼 `text-[15px]`가 모바일 ~8px로 렌더 → `rLabelFont = Math.max(15, 12/scale)`(모바일 ~21px 언스케일 → 실효 ~12px, `PortfolioSectorBar` 프리뷰 `text-xs`(12px)와 동일; 데스크톱 scale≈1이면 15px).
  - 캡처(저장 PNG, `!responsive`): `rLabelFont = Math.round(12 * SHOT_BIG_SCALE)`(theme.ts import; 1.46 → 18, 1.42 → 17). 도넛 라벨은 좁은 존 짤림 때문에 본문(계수 14)보다 조금 작게.
  - **종목명 짤림 방지 — 프리뷰·캡처 공통**: `line-clamp-3`, `labelMaxW` 하한 좌우 `Math.max(64, …)`·top/bottom `208`, 프리뷰 `scale`이 좌우 8px씩 여백 확보(위 "라벨 폭"·"프리뷰 좌우 공백"). `spreadVertically`의 `gap` = `rGap`: 프리뷰 `max(MIN_LABEL_GAP, rLabelFont*4.5)`(3줄 라벨 수용), 캡처 `96`. `VIEW_W`/`VIEW_H`/`CX`/`CY`/`R_*` 불변 → 아트보드·구도·`pixelRatio` 유지.

### BrandMark (`header-menu/share/brand-mark.tsx`)

도넛 **조각 안**에 얹는 기업 로고 배지. **원형 칩 배경 = 해당 조각색**(`bgColor`) — 투명 여백이 있는 로고는 조각과 자연스럽게 이어지고, 흰 배경이 박힌 로고도 원형으로 정돈된다.

- **props**: `{ ticker; name; isForeign; size; bgColor; etfBrand? }`. 로고 요청 해상도는 **`captureLogoSize(size)`**(= 표시 px × 1.5, route retina로 ×2 되어 결국 표시px×3). 과거 `size*6`(clamp 512 → retina 1024px PNG)은 모바일 WebView가 못 그렸다(2026-09 로고 누락).
- 칩: `rounded-full overflow-hidden` + `backgroundColor: bgColor`, 내부 `<img object-cover>`가 칩을 **꽉 채워** 완전한 원이 된다(로고 자체의 사각 모서리가 안 보임).
- **국내 ETF는 `etfBrand` 텍스트 배지**: 운용사 로고가 흰 배경 사각 이미지라(ACE 92.9%·TIGER 97.0%가 순백 불투명, 실측) 조각 위에서 흰 박스로 뜬다 → `BrandMark`가 `etfBrand` prop 유무로 `resolveLogoSrc` 호출 **전에** 분기해 브랜드명을 원형 칩에 텍스트로 렌더(로고 요청 자체를 안 함). 글자색 `pickOnColor(bgColor)`, 폰트는 브랜드명 길이에 반비례. **`resolveLogoSrc` 자체는 국내 ETF를 배제하지 않는다** — `StockIcon`(주식 탭 원형 아바타)은 같은 함수로 운용사 로고를 그대로 쓴다(흰 배경도 원 안에서는 자연스러움).
- **로고 URL이 없거나 로드 재시도 3회 소진 시 `null` 반환 — 칩 자체를 그리지 않는다.** "그 외"처럼 로고 없는 조각에 빈 배지가 남지 않게.
- src 해석·로드 재시도는 **`useLogoSrc` 훅**(`src/hooks/use-logo-src.ts`, `state-and-utils.md`) 경유 — `resolveLogoSrc`를 직접 부르지 말 것(재시도 누락). `StockIcon`도 같은 훅. `imgError` state 영구 폴백 패턴(2026-09 로고 누락 원인)은 이 훅으로 교체됨.
- 캡처 DOM 전용 — 고정 px, `sm:` 금지(R32). `<img>`여야 `captureImage`의 dataURL 인라인 루프를 타므로 인라인 `<svg>`로 바꾸지 말 것.

### PortfolioSectorBar (`header-menu/share/portfolio-sector-bar.tsx`)

인증카드 "포트폴리오" 타입 도넛 **하단** — X-Ray 테마(분야) 축 분포. **금액 미표기**(분야명 + 비중%만, 개별 종목 서브 항목 없음). 캡처 DOM 전용(고정 px).

- **props**: `title: string`(캡션), `items: { key; label; pct; color }[]`, `big?: boolean`(캡처 저장 PNG 전용 — 캡션·라벨·% `text-[20px]`, 막대·색점 `size-[15px]`/`h-[15px]`; 2026-09). 프리뷰(비-`big`)는 캡션·라벨·% `text-xs`(12px, 2026-09 `text-sm`→`text-xs`로 낮춰 도넛 라벨 실효 ~12px과 밀도 정렬), 막대·색점 `2.5`(10px). `ShareCard`가 `big={shotBig}`(=`!responsive`) 전달. **범용 컴포넌트** — "분야 구성"·"보유 유형 구성" 두 곳에서 재사용(#4.24, 캡션만 다름).
- **데이터 1 — 분야 구성**(`ShareCard.sectorItems`): `computeBreakdown("theme", mergedStocks, exchangeRates)`(`lib/xray/stock-xray.ts`, X-Ray 탭과 동일 엔진) → `items` 평가액 desc → 상위 `SECTOR_MAX`(5) + 나머지 `ratio` 합산 "그 외 N개 분야"(최대 6항목으로 통일, #4.24). fill = `SHARE_SAFE_PALETTE[i]`(도넛과 공용), % 텍스트도 같은 색, "그 외"=`SHARE_ETC_COLOR`.
  - **가드**: `key !== "unclassified" && ratio > 0`인 분야가 2개 미만이면 `[]` 반환 → 막대바 섹션 미렌더. 분류 fetch는 `ShareScreenshotDialog`가 `useXrayClassifications`로 자동 수행(위 ShareCard 항목 참조).
- **데이터 2 — 보유 유형 구성**(`ShareCard.categoryItems`): **`assetData.stocks` 원본**(병합 전)을 `stock.category`로 그룹핑해 `computeStockMetrics(...).pct` 합산 → 값 desc 정렬(delisted만 제외, `totalValue` 분모와 동일 필터). **`mergedStocks`를 쓰면 안 됨** — "all" 필터는 카테고리 무관 티커 단위로 병합해(예: 같은 ETF를 연금+IRP 양쪽에 보유) 병합 대표 1건의 category만 남아 다른 카테고리 보유분이 누락된다(#4.24 회귀 발견·수정). **`irp`·`pension`은 그룹핑 시점에 `"pension_irp"` 키로 합쳐 "연금저축펀드·IRP" 라벨 하나로 표시**(#4.24) — `stockCategories` 값 자체는 안 바꾸고 이 계산에서만 병합. 나머지 라벨은 `stockCategories`(`config/asset-options.ts`) 재사용. 필수 입력 필드라 미분류 가드 불필요, `items.length > 0`이면 항상 렌더(단일 카테고리만 있어도 노출 — 프로젝트 규칙: 목록 표시 조건은 `length > 0`, `> 1` 금지).
- **렌더**: 캡션(프리뷰 `text-xs` / 캡처 `text-[20px]`, `text-muted-foreground`) + 가로 스택바(`h-2.5 rounded-full` / 캡처 `h-[15px]`) + 2열 범례(색점 + 분야명 truncate + `pct%` 조각색 bold, 텍스트 크기는 `txt`와 동일). 재사용 참고: `dashboard.tsx` `SectionBar` 구조 / `stock-tab.tsx` `StockBarChart` 스타일(단 ₩ 제거).

### WelcomeGuide (`layout/welcome-guide.tsx`)

첫 진입 안내 페이지. `page.tsx`의 `isWelcomeGuide` 분기에서 `<AppGuide />` 위에 표시.

- 순자산 카드: `DataSourceBadge kind="realtime"` 포함, `bgLight` 토대
- 미리보기 데이터: `welcome-preview-data.json`
- 미리보기 대시보드: 실제 `dashboard.tsx` 컴포넌트를 공통 공유하여 동일 포맷으로 노출하되, 내부의 클릭이나 인터랙션은 차단/방지 처리.
- `StockSummaryHeader`에 `currencyGain`/`dailyProfit`/`dailyProfitRate`/`screenshotMode={false}` 전달
- **모바일 웹 PWA-우선 분기**: `mobileWeb = mounted && useIsMobile() && !isStandalone`. 참이면 PWA 설치 유도를 메인 CTA로 강조, 즉시 자산 등록 CTA는 기본 숨김(`showAssetCta` 토글, "설치 없이 웹에서 바로 시작" 링크로 노출). `ctaVisible = !mobileWeb || showAssetCta`. 데스크톱·standalone은 기존 레이아웃.
- 설치 버튼은 홈 버튼과 동일한 공용 `PwaInstallFlow`(render-prop) 호출 — `PwaInstallGuideDialog` 직접 호출 제거

### TutorialOverlay (`tutorial/tutorial-overlay.tsx`)

Step 1~5 오버레이(Step 0 제거됨). Step 5 내부 sub-step: activity → profit.

- 앱 소개 단독 보기는 별도 `app-guide.tsx`(`AppGuideContent`, `"use client"`) 다이얼로그로 분리 — 튜토리얼 오버레이와 무관
- 외부 진입(공유/클라우드 동기화)·standalone 시 `skipAllTutorialSteps()`로 전체 자동 스킵. 상태는 `secretasset_tutorial_status` 단일 키

---

## shadcn/ui 주요 컴포넌트 (`src/components/ui/`)

```
Button, Input, NumberInput(커스텀), Label, Badge
Card, CardHeader, CardTitle, CardDescription, CardContent
Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
Form, FormField, FormItem, FormLabel, FormControl, FormMessage
Select, Tabs, Textarea, Separator, Skeleton, toast(Sonner)
Collapsible, CollapsibleContent, CollapsibleTrigger
InputOTP, InputOTPGroup, InputOTPSlot
Alert (hidden prop으로 표시 제어)
```

**NumberInput** (`number-input.tsx`): `value`, `onChange`, `quickButtons[]`, `allowDecimals`, `maxDecimals` — 천 단위 콤마 자동 포맷

**Button** (`button.tsx`): 기본 누름 피드백 `active:not-disabled:scale-[0.96]` 내장. `link` 변형·`static` prop(`<Button static>`) 전달 시 scale 비활성. 전환은 `transition-[color,box-shadow,transform] duration-150 ease-out`(transition-all 금지). 의미색은 `variant="brand"`(확인·제출) 등 CLAUDE.md 규칙 준수.

> **폴리시 공통(design-system.md §6)**: shadcn 프리미티브(toggle/switch/accordion/dialog/navigation-menu/sidebar)는 `transition-all` 대신 변하는 속성만 명시. 작은 닫기 버튼은 `after:absolute after:-inset-*`로 40×40 히트영역 확보.

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
  // tab* 토큰은 더 이상 사용 안 함 — 모든 탭이 InlineSelector로 통일됨 (legacy 잔존)
  cardWrapper, cardHeader, cardActions("flex justify-end gap-2 px-3 py-2 bg-muted/10"),
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
- InlineSelector 배경: `bg-muted/60 dark:bg-muted/40` (라이트 짙음)
- FAB·ScrollToTop: `bg-foreground/{85,70}` 무채색 토큰 (라이트 검정/다크 흰 자동 반전)
- Card 모바일 padding: `px-4 sm:px-6` (CardHeader/CardContent/CardFooter)
