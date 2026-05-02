# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-05-02

### AssetPageTabs 컴포넌트 분리 및 홈 서브탭 추가
- `page.tsx` 탭 로직 → `layout/asset-page-tabs.tsx`로 이동
- 홈 탭 서브탭(전체/금융/부동산/부채) 추가 — `useDashboardTabs` 훅으로 동적 생성
- 탭이 1개면 TabsList 숨김
- **이유:** page.tsx 단순화 + 대시보드 서브탭 뷰 도입

### local-storage.ts 신규 분리
- `STORAGE_KEYS`, `STORAGE_KEY_PREFIXES`, `migrateStorageKeys` → `src/lib/local-storage.ts`로 분리
- `asset-storage.ts`에서 re-export (하위 호환 유지)
- **이유:** 스토리지 키 관리 모듈화, 여러 파일에서 직접 import 가능

### profit-utils.ts 신규 추가
- `fetchProfitRef(tickers, period)` — localStorage 캐시 → `/api/finance/profit` 조회
- `getProfitCacheKey(tickers, period)` — 기간별 캐시 키 생성
- **이유:** 기간별 수익(일/주/월/년) 기준가 조회 로직 공유

### finance-service.ts 배당·과거종가 조회 추가
- `fetchDividendDomestic` — 국내 배당 [국내주식-145]
- `fetchDividendOverseas` — 해외 배당 [해외주식-052]
- `fetchDomesticHistoricalPrice` — 국내 과거 종가 (roll-back 5일)
- `fetchOverseasHistoricalPrice` — 해외 과거 종가 (NAS→NYS→AMS)
- `DividendPayoutResult`, `DividendFrequency` 타입 추가

### TopBar 컴포넌트 도입 + AppGuide 리팩터링
- `top-bar.tsx` 신규: GuideMiniButton + ShareScreenshotButton + ToolMenu + ThemeSwitcher 통합
- GuideMiniButton: 가이드 토글 버튼 (이전: `guide-mini-banner.tsx`)
- AppGuide: `trigger-restore-guide`/`trigger-dismiss-guide` CustomEvent 수신

### 공유 토큰 v7.2 (Zero-Knowledge)
- `v72Z` 프리픽스: PIN + localKey 조합 암호화 (`cryptWithKey`)
- Short URL 공유 시 localKey를 URL 해시에 포함 → 서버 단독 복호화 불가

---

## 2026-04-26

### 디렉토리 구조 재편 — layout/ 신설
- `floating-add-button.tsx`, `welcome-guide.tsx`, `copyright-footer.tsx` → `layout/`으로 이동
- `bottom-nav/asset-update/input/`, `bottom-nav/asset-update/screenshot/` 경로 확정
- **이유:** top-nav/bottom-nav/main-nav/layout 명확한 역할 분리

### page.tsx 탭 구조 3탭으로 정리
- 홈/상세/성과 탭으로 단순화, `navigate-to-tab` 이벤트 → 상세 탭 직접 이동
- layout.tsx `max-w-screen-2xl` (이전 3xl=1680px 제거)

### ProfitCard 수익 차트 — 기준가 대비 현재금액 표시 추가
- 인증샷 섹션 분리: 수익 > 기준가, 현재 금액 별도 표시
- **이유:** 수익률만으로는 자산 규모 파악 불가

---

## 2026-04-25

### FloatingAddButton "빠른 이동" 섹션 추가
- FAB Sheet에 자산 탭 바로가기 5개 추가 (주식/부동산/암호화폐/현금/대출)
- `navigate-to-tab` CustomEvent 발사 → `page.tsx`에서 수신해 상세 탭 전환
- **이유:** 자산 수정 진입점 개선 — 수정할 항목이 있는 탭으로 빠르게 이동

---

## 2026-04-19

### YearlyNetAssetChart 과거 순자산 추가 버튼 → FAB 이벤트 방식 전환
- 카드 헤더 DialogTrigger 제거 → `trigger-add-yearly-net-asset` CustomEvent 리스너로 교체

### Sheet 오버레이 어두움 + layout 헤더 sticky 적용
- SheetOverlay `bg-black/50` → `bg-black/80`, layout 헤더에 `sticky top-0` 추가

### FAB PC/패드 환경 확장
- PC 분기에 `<FloatingAddButton />` 추가, 각 `*-input.tsx` 카드 헤더 추가 버튼 `hidden`으로 전환

### 모바일 UI: 입력/상세 분리 + FAB
- FAB: 화면 하단 중앙 fixed → Sheet → 자산 유형 6개 → 스크린샷/직접입력 → CustomEvent dispatch
- **이유:** 입력(Form)과 상세(목록)가 하나의 탭에 혼재되어 UX 불명확

---

## 2026-04-18

### 공유 URL 로드 후 월별 스냅샷 데이터 유지 버그 수정
- `packSnapshots` 구분자 `^` → `;` (packV7 섹션 구분자와 충돌 방지)
- `initAndSync`에 `skipSnapshots` 옵션 추가

### 스크린샷 가져오기 — 해외주식 원화/달러 인식 분기 환산 버그 수정
- `originalCurrency` 필드 추가, 클라이언트에서 분기 환산 처리

### 일별/월별 스냅샷 정책 개선 및 공유 URL 포함
- 일별: 이번 달 한 달치만, 월별 `secretasset_monthly_snapshots` 신규 추가

### 자산 분포 카드 — 모바일 탭 전환
- `useIsMobile()` 도입, isMobile 시 4개 Card → Tabs 전환

### 스크린샷 가져오기 — 주식 탭 카테고리 자동 적용 + 현금 금융기관 Select 교체
- `activeTab` prop 추가, 금융기관 `Input` → `financialInstitutions` 그룹 `Select`로 교체

### 캐시 갱신 주기 시장 마감 시간 기준 세분화
- `getEffectiveDateStr(type)`: 해외주식 KST 07:00, 국내주식 16:00, 환율 09:00 이전이면 전일
