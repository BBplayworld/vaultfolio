# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

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
