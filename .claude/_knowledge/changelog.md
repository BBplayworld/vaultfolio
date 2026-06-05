# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-06-05

### 일별 수익 휴장 처리 + UI 정리 (issue-4.1)

- **휴장 폴백 캐시 매핑** (`/api/finance/profit`): ref-date 매핑 저장 가드를 `res.date === task.date || !reqIsBusinessDay`로 완화. 요청일이 비영업일(`isKrBusinessDay`/`isUsBusinessDay`)이라 직전 영업일로 폴백된 경우(영구 확정값)도 응답일 기준 저장 → 휴장일 동안 매번 KIS 재호출되던 churn 제거. 영업일+장중 미확정(응답일이 더 이름)은 stale 영구 hit 방지로 여전히 미저장. **일별 수익 표시값·날짜 로직은 불변.**
- **"휴장제외" 표시** (`profit-chart`): 기준 종가 비교 표에서 시작 종가가 휴장으로 직전 영업일에 폴백되면 시작일 아래 최소 표시. 일별=시작~종료 사이 휴장(`hasHolidayBetween`), 주/월/연=명목 기준 시작일 자체가 휴장(`isKrHoliday`/`isUsHoliday`)
- **인증샷 보강** (`stock-tab`/`share-card`): `StockCategorySection`이 인증샷 모드에서도 비중바·포트폴리오 하단에 종목 리스트 노출(`!screenshotMode` 가드 제거). 요약 헤더는 인증샷 시 전일 대비+상단 구분선 제거 → 평가손익이 평가금액과 동일 행 정렬
- **해외 상세 환차손익**: 금액 아래 줄에 수익률(`block`)로 분리 — 우측 매입환율 영역 침범 방지
- **비종목 자산 카드 정리** (real-estate/loan/cash): 접힘행 왼쪽=`이름 / 비중%`만(종류 배지·매입가·금리·기관 제거), 상세 펼침에 종류·매입가(부동산)·금리·금융기관(대출) 이동 — 주식 카드 패턴과 통일
- **날짜 input 모바일 넘침 원천 차단** (`globals.css`): `input[type="date"]` 등에 `appearance:none`+`min-width:0`+`max-width:100%`+webkit 의사요소 리셋 전역 규칙. 폼별 `max-w-[160px] sm:max-w-full` 임시방편 제거 → 전폭 통일
- **이유:** 동일 영업일 기준에서 국내 휴장일이 KIS 폴백으로 우연히 맞던 값을 캐시·표시까지 일관화하고, 비종목 자산 리스트의 정보 위계를 주식과 통일, 모바일 날짜 input 넘침을 소스 레벨에서 차단

## 2026-05-23

### UI 정보구조 전면 재설계 — drill-down 라우팅 + 통일 디자인 시스템

- **디렉토리 rename**: `bottom-nav→forms`, `main-nav→views`, `top-nav→header` (목적 기반 명명, layout/tutorial 유지)
- **NavigationProvider 신설** (`layout/navigation-context.tsx`):
  - `AssetView = home | detail/{tab} | activity/{tab}` 모델 + hash 동기화 + popstate
  - URL `/asset#detail/stocks` 직접 진입·새로고침·뒤로가기 모두 동작
  - `back()`은 항상 `navigate({type:"home"})` (어디서나 홈 복귀 정책)
  - `navigate()` 시 자동 `scrollTo(0,0)`
- **InlineSelector 공용** (`layout/inline-selector.tsx`): 모든 1·2·3·4차 탭이 segmented control로 통일
  - size 토큰: `sm/md/lg`(PC에서 한 단계 ↑: 14·16·18)
  - 컨테이너 라이트 짙음(`bg-muted/60`), 활성 `bg-background`, label `ReactNode`(모바일 축약 JSX 지원)
- **InfoHint 공용** (`layout/info-hint.tsx`): Popover hover/tap 패턴 — 가이드 §3
- **상세 5탭 Card 외피 통일**: stock/real-estate/cash/loan/crypto 모두 `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>` 구조. 카테고리 selector는 SummaryHeader 아래 (Hero→필터→리스트)
- **카드 액션 버튼 위치 통일**: `ASSET_THEME.cardActions`("flex justify-end gap-2 px-3 py-2 bg-muted/10") 신 정의 — 5탭 모두 detail grid 하단 별도 라인
- **StockCard `screenshotMode` + `maskFn`**: 인증샷이 페이지 본체와 시각 완전 일치. share-card는 stock-tab의 외피·StockCard 그대로 사용 (펼침·버튼만 차단)
- **share-menu 통합**: stockHeader+stockList → 단일 `stock` 섹션. 체크박스 한 줄 가로 스크롤
- **FAB·ScrollToTop 무채색 토큰화**: `MAIN_PALETTE[11]`(#4e5763) → `bg-foreground/85`(FAB), `bg-foreground/70`(ScrollToTop). 메뉴탭 무채색 세트와 시각 일관
- **layout 본문 `pb-20 md:pb-24`**: FAB이 마지막 카드 가림 방지
- **ToolMenu 통합**: ThemeSwitcher 삭제 → 도구 메뉴 안 다크모드 토글로 흡수. 상단 아이콘 인증샷·도구 2개로 축소(h-10 sm:h-11)
- **순자산·배당 Hero 추가**: net-asset-chart에 "현재 순자산 + 전년 대비", dividend-chart에 "올해 연간 배당 + 월 평균"
- **dividend-chart**: 설명 3줄 → InfoHint, 카테고리 범례 신규, 예상/실제 토글 신규
- **이유:** 토스/애플 시니어 디자이너 관점 일관성 강화 — 컨테이너 위계 명확, drill-down으로 헤더 누적 해소, 무채색 토큰 통일

### 환율 히스토리 7일로 확장
- `EXCHANGE_HISTORY_DAYS` 3→7 (`lib/cache-storage.ts`) — 연휴·주말 컷오프 버퍼

## 2026-05-21

### 성과-수익 기간별 종가 기준 2옵션 (issue-3.9)
- `ProfitBasis = "sameBusinessDay" | "kstAccessDay"` 도입 (기본 sameBusinessDay)
  - `sameBusinessDay`(동일 영업일): 서버에서 국내·해외 모두 `getDates(period,"foreign")` 사용 → 같은 영업일 종가로 정렬
  - `kstAccessDay`(KST 접속일): 국내=domestic, 해외=foreign 독립 산출 (기존 동작)
- `/api/finance/profit`에 `basis` 쿼리 추가, `fetchProfitRef(options.basis)`, `getProfitCacheKey(tickers,period,basis)` — 캐시 키 `secretasset_profit:{basis}:...`로 옵션 분리
- 전역 store `src/stores/profit-basis-store.ts` (zustand, localStorage 동기화 + hydrate). profit-chart 토글 + stock-tab 전일대비가 함께 구독
- **스냅샷·기존 호출은 basis 미전달 = kstAccessDay(legacy)** 유지 → 스냅샷은 항상 오늘자 종가 기준 (옵션 무관)
- 옵션 영속화: `STORAGE_KEYS.profitBasis` + 내보내기 JSON(`profitBasis`) + 공유 토큰 packV7 parts[9]("k"=kstAccessDay)
- UI: 시작/종료 종가 영역을 표 형태(국내/해외/합계 행 × 시작/종료 열)로 재구성, 종가 날짜는 베이스 날짜 + 마감 메타(MM-DD HH:MM) 2줄. 해외 일별 표시의 강제 +1 shift 제거 → 두 옵션 공통으로 ET 거래일을 그대로 표기
- **이유:** 국내·해외 시차로 같은 영업일/접속일 기준 수익이 혼동되어 사용자가 명시적으로 기준을 선택하도록

## 2026-05-16

### 시간별 주식 갱신 + 기준가 캐시 안정화 (issue-3.5, 3.6)
- `stock-cache-slot.ts` 신규: 장중 1시간 슬롯 / 장외 effectiveDate 단일 캐시 슬롯 추상화. 서버·클라 공용 순수 함수
- `/api/finance/profit` 2단 캐시 도입: `REF_DATE_MAP` (요청일→KIS 응답일) + `REF_PRICES` (응답일 기준 가격) → 휴장/공휴일로 요청일과 응답일이 달라도 다음 호출부터 영구 hit
- 해외 과거종가: STOCKS 캐시의 market 필드에서 EXCD 사전 조회 → NAS/NYS/AMS 순차 fallback 호출 제거
- `fetchProfitRef` 점진 로드: BATCH_SIZE=3, 1초 간격 배치 + `onProgress`/`onComplete`/`signal` 옵션 + `inFlightFetches` Map dedup
- daily 캐시 키에서 us_refDate 제거 — KST 자정에 kr과 함께 변경되므로 키 단순화
- ProfitCard tickerList를 currentPrice 무관 풀세트로 고정 → syncTodayStockPrices가 가격을 채우는 동안에도 캐시 키 안정
- **이유:** 시간별 슬롯 전환 직후 stale 캐시 표시 + tickerList 부분집합에서 캐시 누락 회귀

### 주식 비활성 상태 자동 감지 (issue-3.3 / 3.4 ~ 3.6)
- `Stock` 타입에 `inactiveStatus: "delisted"|"halted"`, `inactiveReason`, `inactiveCheckedAt` 추가
- `classifyOverseasInactive()`: lstg_abol_dt → delisted / ovrs_stck_tr_stop_dvsn_cd / last_rcvg_dtime>30일 → halted
- `computeNetAsset` / `getAssetSummary`: delisted 제외, halted는 마지막 currentPrice 유지
- `useFilteredStockData`, `DividendCard`, `MonthlyDividendStocks`, `ProfitCard`: delisted 필터링
- `StockRowHeader`: 거래정지(amber) / 상장폐지(red) Badge 표기
- 공유 토큰 v7.2 stocks 필드에 inactiveStatus 직렬화 ("d"/"h"/"")
- **이유:** 상장폐지·거래정지 종목이 자산 평가를 왜곡 + 보유 종목 상태를 사용자에 시각화

### 메뉴-앱가이드 보기 단독 모드
- `AppGuide`: localStorage(`secretasset_guide_dismissed`) 제거 → 평소 hidden, `trigger-restore-guide` 수신 시에만 표시
- `tutorialStore.showStep0(standalone=true)` + `closeStandaloneStep0()`: 단독 보기 시 버튼 "확인", 다음 단계 미진행
- `WelcomeGuide`에서도 `isStandaloneStep0`이면 Step 0 표시
- `migrateStorageKeys`: 레거시 guideDismissed 키 정리
- **이유:** 가이드를 "한 번 닫으면 영원히 숨김"에서 "필요할 때 즉시 다시 보기"로 전환

### 튜토리얼 키 단일 객체로 통합
- step별 12개 키(`secretasset_tutorial_step{0..5}_{done|skipped}`) → 단일 키 `secretasset_tutorial_status` (Record<step, status>)
- `one-time-migrations.ts`의 `merge-tutorial-status` 마이그레이션 — 레거시 존재 시에만 통합
- migration id 날짜 prefix 제거: 매 진입 시 done 체크 → 미실행만 실행 패턴 명시화
- **이유:** 키 관리 단순화 + 향후 step 추가 시 키 폭발 방지

### profit 캐시 일괄 정리 마이그레이션
- `2026-05-16-clear-profit-cache-final`: 응답일 통일 + tickerList 정렬 + daily 캐시 키 단순화 이전 entry 일괄 제거
- **이유:** 캐시 구조 변경 누적 → 일관된 새 캐시로 강제 갱신

### WelcomeGuide 순자산 카드 + AppGuide 통합
- 순자산 카드: `primary.bgLight` 토대 + `DataSourceBadge kind="realtime"` 표시, 폰트 사이즈 정리
- `StockSummaryHeader`에 `currencyGain`/`dailyProfit`/`dailyProfitRate` 전달, `screenshotMode=false`
- `page.tsx`의 `isWelcomeGuide` 분기에 `<AppGuide />` 추가 (가이드 영역도 함께 노출)
- **이유:** 첫 진입 시 핵심 정보(순자산·환차익·일별손익)를 더 확실히 보여주기

### KIS 과거종가 진단 로그 강화
- domestic/overseas `fetchXxxHistoricalPrice`에 HTTP 실패 / 빈 데이터 / 유효 row 없음 / 가격 0 케이스별 console.warn
- **이유:** 종목별로 ref price miss가 발생하는 원인을 운영 로그로 빠르게 식별

---

## 2026-05-02

### AssetPageTabs 컴포넌트 분리 및 홈 서브탭 추가
- `page.tsx` 탭 로직 → `layout/asset-page-tabs.tsx`로 이동
- 홈 탭 서브탭(전체/금융/부동산/부채) 추가 — `useDashboardTabs` 훅으로 동적 생성
- 탭이 1개면 TabsList 숨김

### local-storage.ts 신규 분리
- `STORAGE_KEYS`, `STORAGE_KEY_PREFIXES`, `migrateStorageKeys` → `src/lib/local-storage.ts`로 분리
- `asset-storage.ts`에서 re-export (하위 호환 유지)

### profit-utils.ts 신규 추가
- `fetchProfitRef(tickers, period)` — localStorage 캐시 → `/api/finance/profit` 조회

### finance-service.ts 배당·과거종가 조회 추가
- `fetchDividendDomestic`, `fetchDividendOverseas`, `fetchDomesticHistoricalPrice`, `fetchOverseasHistoricalPrice`
- `DividendPayoutResult`, `DividendFrequency` 타입 추가

### TopBar 컴포넌트 도입 + AppGuide 리팩터링
- `top-bar.tsx`: GuideMiniButton + ShareScreenshotButton + ToolMenu + ThemeSwitcher 통합
- AppGuide: `trigger-restore-guide`/`trigger-dismiss-guide` CustomEvent 수신

### 공유 토큰 v7.2 (Zero-Knowledge)
- `v72Z` 프리픽스: PIN + localKey 조합 암호화

---

## 2026-04-26

### 디렉토리 구조 재편 — layout/ 신설
- `floating-add-button.tsx`, `welcome-guide.tsx`, `copyright-footer.tsx` → `layout/`으로 이동

### page.tsx 탭 구조 3탭으로 정리
- 홈/상세/성과 탭으로 단순화

### ProfitCard 수익 차트 — 기준가 대비 현재금액 표시 추가
- 인증샷 섹션 분리: 수익 > 기준가, 현재 금액 별도 표시

---

## 2026-04-25

### FloatingAddButton "빠른 이동" 섹션 추가
- FAB Sheet에 자산 탭 바로가기 5개 추가
- `navigate-to-tab` CustomEvent → `page.tsx`에서 수신

---

## 2026-04-19

### YearlyNetAssetChart 과거 순자산 추가 버튼 → FAB 이벤트 방식 전환
- 카드 헤더 DialogTrigger 제거 → `trigger-add-yearly-net-asset` CustomEvent 리스너

### Sheet 오버레이 어두움 + layout 헤더 sticky 적용
- SheetOverlay `bg-black/50` → `bg-black/80`, layout 헤더 `sticky top-0`

### FAB PC/패드 환경 확장
- PC 분기에 `<FloatingAddButton />` 추가

### 모바일 UI: 입력/상세 분리 + FAB
- FAB: 하단 중앙 fixed → Sheet → 자산 유형 6개 → 스크린샷/직접입력

---

## 2026-04-18

### 공유 URL 로드 후 월별 스냅샷 데이터 유지 버그 수정
- `packSnapshots` 구분자 `^` → `;` (packV7 섹션 구분자와 충돌 방지)

### 스크린샷 가져오기 — 해외주식 원화/달러 인식 분기 환산 버그 수정
- `originalCurrency` 필드 추가, 클라이언트에서 분기 환산 처리

### 일별/월별 스냅샷 정책 개선 및 공유 URL 포함
- 일별: 이번 달 한 달치만, 월별 `secretasset_monthly_snapshots` 신규 추가

### 자산 분포 카드 — 모바일 탭 전환
- `useIsMobile()` 도입, isMobile 시 4개 Card → Tabs 전환

### 캐시 갱신 주기 시장 마감 시간 기준 세분화
- `getEffectiveDateStr(type)`: 해외주식 KST 07:00, 국내주식 16:00, 환율 09:00 이전이면 전일
