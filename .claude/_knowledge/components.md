# 컴포넌트 참조

> 마지막 업데이트: 2026-05-16

## 자산 입력 컴포넌트 (`src/app/(main)/asset/_components/`)

```
_components/
├── bottom-nav/asset-update/
│   ├── input/              # 자산 입력 폼 + 목록 렌더링
│   │   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   │   ├── real-estate-input.tsx    # 부동산
│   │   ├── cash-input.tsx           # 현금성 자산
│   │   ├── crypto-input.tsx         # 암호화폐
│   │   ├── loan-input.tsx           # 대출
│   │   └── exchange-rate-input.tsx
│   └── screenshot/         # 스크린샷 가져오기 다이얼로그
│       ├── stock-screenshot-import.tsx   # 3단계: upload→conflict→preview
│       ├── crypto-screenshot-import.tsx  # 2단계: upload→preview (conflict 있음)
│       ├── cash-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
│       └── loan-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
├── main-nav/
│   ├── home/dashboard.tsx
│   ├── detail/
│   │   ├── asset-detail-tabs.tsx    # 5탭 컨테이너 + 공통 유틸 export
│   │   └── tabs/
│   │       ├── stock-tab.tsx        # 주식 상세 (7 서브탭) + halted/delisted Badge
│   │       ├── real-estate-tab.tsx, cash-tab.tsx, crypto-tab.tsx, loan-tab.tsx
│   ├── activity/
│   │   ├── net-asset-chart.tsx      # 순자산 추이 (년도별/월별/일별)
│   │   ├── profit-chart.tsx         # 수익 차트 (점진 로드 + toast 완료 알림)
│   │   ├── dividend-chart.tsx       # 배당 카드 (DividendCard)
│   │   └── monthly-dividend-stocks.tsx
│   └── data-source-badge.tsx        # "실시간" / "캐시" 등 데이터 출처 Badge
├── layout/
│   ├── asset-page-tabs.tsx, notice-dialog.tsx, floating-add-button.tsx
│   ├── welcome-guide.tsx, copyright-footer.tsx
├── top-nav/                # top-bar, theme-menu, tool-menu, app-guide, share/
└── tutorial/tutorial-overlay.tsx
```

---

### AssetPageTabs (`layout/asset-page-tabs.tsx`)
최상위 3탭 컨테이너. `page.tsx`에서 렌더링.

- **홈**: Dashboard + 서브탭 (전체/금융/부동산/부채) — `useDashboardTabs`가 데이터에 따라 동적 생성, 탭이 1개면 TabsList 숨김
- **상세**: 주식/부동산/암호화폐/현금/대출 — `forceMount`로 항상 DOM 유지
- **성과**: 순자산/수익/배당 — `forceMount`로 항상 DOM 유지
- `navigate-to-tab` CustomEvent 수신 → 홈탭을 "detail"로 전환 + 하위 탭 이동
- 입력 폼 5종 `<div className="hidden">` 래핑으로 DOM에 상시 마운트

---

### FloatingAddButton (`layout/floating-add-button.tsx`)
화면 하단 중앙 fixed FAB. 클릭 → Sheet → 자산 유형 6개 선택 → 방법 선택(스크린샷/직접입력) → CustomEvent dispatch.
- 모바일: `side="top"`, PC/패드: `side="right"` Sheet
- 이벤트: `trigger-add-{real-estate|stock|crypto|cash|loan|yearly-net-asset}`
- "빠른 이동" 섹션: `navigate-to-tab` CustomEvent dispatch

### *-input.tsx 공통 구조
1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어 (`hideList` prop)

### 스크린샷 다이얼로그 공통 패턴
- `open/onOpenChange` props로 외부 제어
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(15회) 체크
- **중복 처리:** stock/crypto → merge/reset 선택, cash/loan → 항상 append

---

### stock-input.tsx 카드 레이어

| Layer | 내용 |
|-------|------|
| 1 헤더 | 카테고리 Badge + 종목명 + 티커 + 조회기준일 + 편집/삭제 |
| 2 핵심지표 | 평가금액(좌) / 평가손익·수익률(우, `items-end`) |
| 3 가격비교 | 평균단가 / 현재가 |
| 3b 환차손익 | 해외주식 외화 종목만 |
| 4 주식담보대출 | linkedStockId 연계 대출 |
| 5 보조정보 | 수량 / 보유일 / 매수일 / 설명 |

- **정렬:** 평가금액(원화 환산) 내림차순 → 동일 시 이름순
- **탭:** 전체/국내/해외/IRP/ISA/연금/비상장 (7탭)
- `lookupState`: `"idle"|"success"|"failed"` — idle 시 종목명·현재가 숨김

### stock-tab.tsx export 목록 (share-card에서 재사용)
- `StockBarChart`, `StockRowItem`, `StockRowHeader`, `StockSummaryHeader`, `StockCategorySection`
- `useFilteredStockData(activeCategory)` — 필터된 주식 계산 훅
  - 정렬된 tickerList (`.sort()`) 보장 → 다른 컴포넌트와 캐시 키 일치
  - `inactiveStatus !== "delisted"` 필터 포함
- `CATEGORY_TABS`

**StockRowHeader 비활성 Badge:**
- `halted` → amber `text-amber-600 border-amber-600` "거래정지"
- `delisted` → red `text-red-600 border-red-600` "상장폐지"

### stock-screenshot-import.tsx conflict 처리
- **덮어쓰기(merge):** 스크린샷 ticker 제거 후 전체 push
- **초기화(reset):** 기존 주식 전부 제거 후 스크린샷만 등록
- ticker 없는 종목: `saveAssetDataRaw()` 우회 저장 후 `refreshData()`

---

## 대시보드 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| Dashboard | `main-nav/home/dashboard.tsx` | 총자산/순자산/손익 요약 + 분포 |
| AssetDetailTabs | `main-nav/detail/asset-detail-tabs.tsx` | 5탭 상세 목록 |
| YearlyNetAssetChart | `main-nav/activity/net-asset-chart.tsx` | 순자산 추이 — 년도별/월별/일별 |
| ProfitCard | `main-nav/activity/profit-chart.tsx` | 기간별 수익 차트 (점진 로드) |
| DividendCard | `main-nav/activity/dividend-chart.tsx` | 배당 카드 |
| DataSourceBadge | `main-nav/data-source-badge.tsx` | "실시간"/"캐시" 출처 Badge |

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

### top-nav (`top-nav/`)
- `TopBar` — GuideMiniButton + ShareScreenshotButton + ToolMenu + ThemeSwitcher 배치
- `ShareScreenshotButton` → `ShareScreenshotDialog` → `ShareCard` (인증샷 생성)
- `ToolMenu` — 데이터 내보내기/가져오기/공유/삭제 + AI 프롬프트 + **앱 가이드 보기** (`trigger-restore-guide` + `tutorialStore.showStep0(true)`)
- `AppGuide` — 평소 hidden, `trigger-restore-guide` 수신 시 표시. localStorage 저장 키 제거 — 세션 단위 표시만
- `MajorUiUpdateNoticeDialog` — 업데이트 공지 (일주일간 숨기기)

### WelcomeGuide (`layout/welcome-guide.tsx`)
첫 진입 안내 페이지. `page.tsx`의 `isWelcomeGuide` 분기에서 `<AppGuide />` 위에 표시.
- 순자산 카드: `DataSourceBadge kind="realtime"` 포함, `bgLight` 토대
- 미리보기 데이터: `welcome-preview-data.json`
- `StockSummaryHeader`에 `currencyGain`/`dailyProfit`/`dailyProfitRate`/`screenshotMode={false}` 전달

### TutorialOverlay (`tutorial/tutorial-overlay.tsx`)
Step 0~5 오버레이. Step 5 내부 sub-step: activity → profit.
- **Step 0 단독 보기**(`isStandaloneStep0=true`): 메뉴-앱가이드 보기에서 호출. 버튼 "확인"으로 표시, 다음 단계 진행하지 않고 `closeStandaloneStep0()` 호출
- WelcomeGuide에서는 Step 0이 일반적으로 숨겨지지만, `isStandaloneStep0`일 때는 표시

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
  tabList1/tabTrigger1,  // 페이지 메인 탭 (홈/상세/성과)
  tabList2/tabTrigger2,  // 2단계 탭 (순자산/수익/배당)
  tabList3/tabTrigger3,  // 3단계 서브탭 (국내/해외/IRP 등)
  tabList3Wrap/tabTrigger3Wrap,  // 래핑 변형
  categoryBox, todayBox, inputHeader, liabilityBadge,
  important, liability, profit, loss,
  primary: { text, bg, bgLight }, text: { default, muted },
  realEstateTypeColors, distributionCard,
}
MAIN_PALETTE  // 10색 팔레트 (인덱스 고정: 0=최대비율, 1=대출, 2=임차보증금)
getProfitLossColor(value)
```
