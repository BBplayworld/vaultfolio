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
- **TaxCalendarView** (`views/tax/tax-calendar-view.tsx`, S-4.23): `#tax` 뷰. 12개월 세금 일정 세로 리스트(`InlineSelector` 내 세금/전체 필터 · `Collapsible` 상세 · 현재 월 강조·`scrollIntoView`). 해외주식 실현차익 근거 박스 + 하단 면책 고정. `settings`와 동일한 더보기 하위 페이지 패턴(하단탭 미등록). shadcn `Calendar`는 날짜 선택기라 사용하지 않는다

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
- 홈 `RefreshNudge`의 CTA는 `open-add-asset-sheet` 이벤트에 `detail.category`(가장 오래된 카테고리 1개, 단수)를 실어 hub/holdings를 건너뛰고 해당 카테고리의 단건 흐름(`handleHoldingsClick`)으로 직행(다건 프리셋 아님)
- 보유현황 스크린샷 저장 성공 시 각 `*-screenshot-import.tsx`가 `markCategoryRefreshed(category)` 호출(`lib/asset/asset-refresh-status.ts`)

### ScrollToTop (`layout/floating/scroll-to-top.tsx`)

화면 우하단 utility 버튼. 100px 스크롤 시 노출.

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

**`screenshotMode` 분기 (인증카드 = share-card 전용)** — 캡처 DOM은 460px 고정폭(`CARD_WIDTH`, share-menu.tsx)이라 `sm:` 뷰포트 반응형 금지(R25). `screenshotMode`인 컴포넌트는 `ASSET_THEME` 대신 **`ASSET_THEME_SHOT`**(theme.ts, 데스크톱 값 고정)을 쓴다.

- `StockCard` — 헤더 + 비중 그라데이션 바만 노출. Collapsible·상세 그리드·수정/삭제 버튼·담보대출·보유 메타 모두 미렌더. `maskFn`으로 hideAmounts 마스킹 전달
- `StockRowHeader` / `StockIcon` — 이름·금액·아이콘·Badge 클래스를 SHOT 토큰으로 스왑. 비중%는 미노출(범례로 통합), `TodayChangeChip`(오늘 등락) 미렌더
- `StockCategorySection` — **범례는 인증카드도 노출**(주식 탭과 공통, `!screenshotMode` 가드 없음): 색점+종목명+비중%, `maxItems` 초과분은 `그 외 N종목 X%`. 인증카드 grid는 `ASSET_THEME_SHOT.legendGrid`(`grid-cols-2` 고정)+`legendText`(`text-sm` 고정, R25). 루트 패딩 `px-1`, 리스트 상단 여백 `mt-7`(주식 탭은 `mt-8`). 리스트 초과분 "그 외 N종목" 행은 `maskFn`+`exchangeRates` prop이 있으면 종목 카드와 동일한 우측 2줄(평가금액 합 / 손익 `(+X.X%)`, `computeStockMetrics` 합산 — 개별 평균 아닌 `(Σ평가−Σ원가)/Σ원가`)로 렌더, 비중%는 미노출
- `StockSummaryHeader` → `DetailSummaryHeader`/`ProfitMetric`의 `screenshotMode` prop으로 전달 (원/달러 셀렉터·오늘 등락 미렌더, 인증카드는 배경 박스 없이 헤더 값 텍스트 `ASSET_THEME_SHOT.summaryValue`)

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
| BackupNudge         | `views/home/backup-nudge.tsx`           | 백업 넛지 배너 — 홈 상단 알림 슬롯. dismiss 배너 구조 레퍼런스 |
| RefreshNudge (S-4.30) | `views/home/refresh-nudge.tsx`        | 자산 최신화 넛지(30일 기준) — `BackupNudge`와 동일 구조, `suppressed` prop으로 백업 넛지와 동시 노출 배제(dashboard.tsx가 `onVisibilityChange`로 조율). CTA는 FAB를 `preselect`와 함께 오픈 |
| TaxNoticeBox        | `views/home/tax-notice-box.tsx`         | 세금 안내 배너(S-4.23) — 자산 분포 카드 **아래**. **내 자산에서 파생된** 일정만(전 국민 공통 `common` 제외), 매칭 근거 문구 포함. 닫으면 그 달 미노출(월 단위 재노출) |
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

**내용은 주식 기준으로만** 구성한다(자산군 도넛·포트폴리오 구성 바·자산군 통합 랭킹 없음):

```tsx
// 닉네임 미노출(2026-08-08 제거)
<StockSummaryHeader screenshotMode maskFn={mask} />                  // 배경 없이 "총 주식 평가금액" + 평가손익
<StockCategorySection screenshotMode maxItems={SHOT_MAX /* =5 */}    // 비중바+범례(상위5+그 외) + 종목 리스트(상위5+그 외 N종목)
  maskFn={mask} exchangeRates={exchangeRates}
  renderItem={(s,_,c) => <StockCard screenshotMode maskFn={mask} ... />} />
푸터: APP_CONFIG.name + siteHost + 날짜
```

- 데이터는 `useFilteredStockData("all")` 단일 출처 — 주식 탭과 캐시 키 공유(중복 fetch 없음)
- 종목 파생값은 `computeStockMetrics(stock, exchangeRates, totalValue)` 재사용
- 마스킹 규약: 금액만 `••••`, 비중%·수익률%는 항상 노출
- 금액 포맷(2026-08-08): `mask`(→`formatCurrency`, 전체 금액 — 상세 탭 `PRICE_DISPLAY_MODE="full-only"`와 동일)를 헤더·종목 리스트·"그 외 N종목" 전부에서 공유. `StockSummaryHeader`의 `maskFn`은 `DetailSummaryHeader`의 `fmtFull`·`fmt`를 동시에 덮어쓰므로(`ProfitMetric`도 `formatShort` 단일 포매터) 축약 포매터를 넘기면 평가금액·평가손익 둘 다 축약으로 새는 점 주의(과거엔 이 버그로 헤더만 축약 표시됐었음)
- 캡처: `share-menu.tsx`의 `ScaledCardPreview`(`CARD_WIDTH`=460px 고정폭 + CSS scale), `pixelRatio = ceil(1100 / el.offsetWidth)`(460 기준 3 → 최종 PNG 1380px). `innerRef`(460px 박스) 는 반드시 `shrink-0` — 없으면 flex가 레이아웃 단계에서 먼저 축소하고 `transform: scale()`이 그 위에 또 곱해져 이중 축소(2026-08-08 회귀 수정). `CARD_WIDTH`는 기존 480→460으로 소폭 축소(2026-08-08) — 검은 카드 박스 자체의 바깥 폭을 줄이는 유일한 레버(내부 패딩은 박스 안쪽만 조정할 뿐 바깥 폭엔 무관)
- **간격(2026-08-08)**: 비중바·리스트 래퍼는 배경 없이 `py-3.5 px-2` — 세로(`py-3.5`)는 헤더~범례~리스트 실제 노출 간격 28px 통일용 마진 계산의 기준점(절대 변경 금지), 가로(`px-2`)는 카드 폭을 넓게 쓰기 위한 좌우 여백. 헤더·푸터 좌우 패딩은 `px-2`(래퍼 `px-2`+내부 `px-0`와 동일, 카드 전체 좌우 오프셋 `outer p-3`+8=20px), 카드 최상단~헤더값/푸터~카드 최하단 간격도 `pt-2`/`pb-2`로 대칭. 모바일 미리보기([share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx))는 `DialogContent` 폭을 `w-[95vw] sm:w-full`(뷰포트 상대 단위로 확실히 95% 확보)로, 미리보기 컨테이너는 좌우 `px-4`(스케일 계산 기준 `outer.clientWidth`만 줄임 — `CARD_WIDTH=480` 고정인 캡처 PNG와는 무관)로 조정

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
