# 컴포넌트 참조

> 마지막 업데이트: 2026-06-09

## 자산 컴포넌트 (`src/app/(main)/asset/_components/`)

> **디렉토리 rename(2026-05-23)**: `bottom-nav` → `forms`, `main-nav` → `views`, `top-nav` → `header`. `layout`·`tutorial`은 유지.

```
_components/
├── forms/asset-update/    # (구 bottom-nav)
│   ├── input/              # 자산 입력 폼 + 목록 렌더링
│   │   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   │   ├── real-estate-input.tsx, cash-input.tsx, crypto-input.tsx, loan-input.tsx
│   │   └── exchange-rate-input.tsx
│   └── screenshot/         # 스크린샷 가져오기 다이얼로그
│       ├── stock-screenshot-import.tsx   # 3단계: upload→conflict→preview
│       ├── crypto-screenshot-import.tsx  # 2단계: upload→preview (conflict 있음)
│       ├── cash-screenshot-import.tsx, loan-screenshot-import.tsx  # 항상 append
├── views/                 # (구 main-nav)
│   ├── home/
│   │   ├── dashboard.tsx           # 도넛+필터칩(InlineSelector) — Dashboard()
│   │   └── (entry-cards.tsx 삭제됨 — 1차 탭 복원으로 대체)
│   ├── detail/
│   │   ├── asset-detail-tabs.tsx    # 5탭 컨테이너 + 공통 유틸 export
│   │   └── tabs/
│   │       ├── stock-tab.tsx        # Card+CardHeader+CardTitle 외피, StockCard(screenshotMode·maskFn), 카테고리 selector는 SummaryHeader 아래
│   │       ├── real-estate-tab.tsx, cash-tab.tsx, crypto-tab.tsx, loan-tab.tsx
│   ├── activity/
│   │   ├── net-asset-chart.tsx      # Hero(현재 순자산+전년 대비) + 년도별/월별/일별 InlineSelector(CardHeader)
│   │   ├── profit-chart.tsx         # 카드 헤더 InlineSelector + 시장 selector(size sm) + collapse 안 기준종가표
│   │   ├── dividend-chart.tsx       # Hero(연간/월 배당) + InfoHint + 카테고리 범례 + 예상/실제 토글
│   │   └── monthly-dividend-stocks.tsx
│   └── data-source-badge.tsx        # "실시간" / "캐시" 등 데이터 출처 Badge
├── layout/                # 라우팅·공용 UI
│   ├── navigation-context.tsx      # NavigationProvider + useAssetNavigation
│   ├── asset-page-tabs.tsx         # view 분기 라우터 (HomeView/DetailView/ActivityView)
│   ├── inline-selector.tsx         # 모든 탭·셀렉터 공용 (size sm/md/lg, label ReactNode)
│   ├── info-hint.tsx               # Popover hover/tap 패턴 (가이드 §3)
│   ├── floating-add-button.tsx     # bg-foreground/85 FAB
│   ├── scroll-to-top.tsx           # bg-foreground/70 utility (native button)
│   ├── welcome-guide.tsx, notice-dialog.tsx, copyright-footer.tsx
├── header/                # (구 top-nav)
│   ├── top-bar.tsx                 # ← 뒤로가기 + 페이지 타이틀 + 인증샷·도구 아이콘
│   ├── tool-menu.tsx               # 데이터 관리 + 기능(다크모드 통합)
│   ├── app-guide.tsx, share/
└── tutorial/tutorial-overlay.tsx
```

---

### AssetPageTabs (`layout/asset-page-tabs.tsx`) — drill-down 라우터

`useAssetNavigation().view` 분기로 단일 view만 mount.

- **HomeView**: InlineSelector size="lg" (홈/상세/성과) + Dashboard. 상세/성과 클릭 = drill-down 진입
- **DetailView({tab})**: InlineSelector(주식/부동산/암호화폐/현금/대출) + 해당 탭 컴포넌트 (1개만 mount)
- **ActivityView({tab})**: InlineSelector(순자산/수익/배당) + YearlyNetAssetChart/ProfitCard/DividendCard
- 입력 폼 5종 `<div className="hidden">` 래핑으로 DOM에 상시 마운트 (편집 다이얼로그용)

### NavigationProvider (`layout/navigation-context.tsx`)

- `AssetView = home | detail/{tab} | activity/{tab}` 상태 + hash 동기화 + popstate 리스너
- `navigate(view)`: pushState + scrollTo(0,0)
- `back()`: 항상 `navigate({type:"home"})` (history.back() 아님 — 어디서나 홈 복귀)
- `parseHash`/`toHash`/`getViewTitle` export

---

### FloatingAddButton (`layout/floating-add-button.tsx`)

화면 하단 중앙 fixed FAB. 클릭 → Sheet → 자산 유형 6개 선택 → 방법 선택(스크린샷/직접입력) → CustomEvent dispatch.

- 위치 정책: `fixed bottom-5 sm:bottom-10 left-1/2` 중앙 — 모바일 thumb zone 최적, 어떤 페이지든 노출. layout.tsx 본문에 `pb-20 md:pb-24`로 카드 가림 방지
- 색상: `bg-foreground/85 text-background` (라이트=검정 음영+흰, 다크=흰 음영+검정 자동 반전). hover 시 풀톤
- 모바일: `side="top"`, PC/패드: `side="right"` Sheet
- 이벤트: `trigger-add-{real-estate|stock|crypto|cash|loan|yearly-net-asset}`
- 수정 액션: `navigate({type:"detail", tab})` 직접 호출 (CustomEvent 미사용)

### ScrollToTop (`layout/scroll-to-top.tsx`)

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

**StockCard `screenshotMode` 분기**: 인증샷 모드면 헤더 + 비중 그라데이션 바만 노출, Collapsible·상세 그리드·수정/삭제 버튼·담보대출·보유 메타 모두 미렌더. `maskFn` prop으로 hideAmounts 마스킹 전달.

**StockRowHeader 비활성 Badge:**

- `halted` → amber `text-amber-600 border-amber-600` "거래정지"
- `delisted` → red `text-red-600 border-red-600` "상장폐지"

### stock-screenshot-import.tsx conflict 및 미리보기 UI 처리

- **덮어쓰기(merge):** 스크린샷 ticker 제거 후 전체 push
- **초기화(reset):** 기존 주식 전부 제거 후 스크린샷만 등록
- **미리보기 UI:** 1행(이름+티커+환산뱃지), 2행(수량/현재가/평단가/평가금액 그리드 패널 bg-muted/40), 3행(드롭다운 가로 배치 및 증권사 선택 max-w-[220px] 짤림 방지)
- ticker 없는 종목: `saveAssetDataRaw()` 우회 저장 후 `refreshData()`

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

- `TopBar` — 좌측: `view !== "home"`일 때 ChevronLeft + getViewTitle("상세"/"성과"). 우측: 인증샷·도구 아이콘 2개 (h-10 sm:h-11, MAIN_PALETTE[5]/foreground 토큰)
- `ShareScreenshotButton` (Camera 아이콘만) → `ShareScreenshotDialog` → `ShareCard` (인증샷 생성)
- `ToolMenu` (Settings 아이콘만) — Dropdown: 데이터 관리(내보내기/가져오기/공유/캐시초기화/삭제) + 기능(AI 평가 / **다크모드 토글** / 앱 가이드 보기). `ThemeSwitcher` 컴포넌트는 삭제됨 — 도구 메뉴에 통합
- `AppGuide` — 평소 hidden, `trigger-restore-guide` 수신 시 표시
- `MajorUiUpdateNoticeDialog` — 업데이트 공지 (일주일간 숨기기)

### ShareCard (`header/share/share-card.tsx`)

`sections.stock` 단일 토글로 stockHeader+stockList 통합. 다음 외피로 stock-tab 본체와 시각 완전 일치:

```tsx
<Card><CardHeader><CardTitle>주식</CardTitle></CardHeader>
  <CardContent>
    <StockSummaryHeader screenshotMode maskFn={maskFn} />
    <StockCategorySection screenshotMode renderItem={(s,_,c) => <StockCard screenshotMode maskFn={maskFn} ... />} />
  </CardContent>
</Card>
```

`SectionVisibility = { donut, chart, stock }` (이전 stockHeader/stockList 통합). share-menu 체크박스 한 줄(가로 스크롤, 스크롤바 숨김).

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
