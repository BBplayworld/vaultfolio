# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

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

---

## 2026-04-17

### 스크린샷 가져오기 확장 + Gemini 사용 한도 관리
- crypto/cash/loan 스크린샷 다이얼로그 신규 추가
- 서버 전역 하루 300회 + 기기별 15회 이중 한도 (`use-gemini-usage.ts`)

### _components 디렉토리 구조 분리
- `*-input.tsx` → `input/`, `*-screenshot-import.tsx` → `screenshot/`

---

## 2026-04-11

### 주식 폼 조회 연동 UX 개선 + 소수점 2자리 정책 변경
- `lookupState` 상태 추가, 조회 전 종목명·현재가 필드 숨김
- `maxDecimals` 1 → 2 변경
