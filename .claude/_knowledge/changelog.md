# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록.

---

## 2026-04-19

### YearlyNetAssetChart 과거 순자산 추가 버튼 → FAB 이벤트 방식 전환
- 카드 헤더 DialogTrigger 제거 → `trigger-add-yearly-net-asset` CustomEvent 리스너로 교체
- **이유:** FAB 방식 통합 시 카드 내부 추가 버튼 중복

### Sheet 오버레이 어두움 + layout 헤더 PC sticky 적용
- SheetOverlay `bg-black/50` → `bg-black/80`, layout 헤더에 `lg:sticky lg:top-0` 추가
- **이유:** 오버레이가 충분히 어둡지 않았음. PC 스크롤 시 헤더 사라지는 문제

### scroll-to-top 위치 조정 + theme.ts value 클래스 제거
- `bottom-6` → `bottom-5` (FAB 겹침 방지), `ASSET_THEME.value` 미사용 클래스 제거

### FAB PC/패드 환경 확장
- PC 분기에 `<FloatingAddButton />` 추가, 각 `*-input.tsx` 카드 헤더 추가 버튼 `hidden`으로 전환
- **이유:** FAB가 모바일에만 적용되어 있었으나 PC/패드도 동일 UX로 통일

### 모바일 UI: 입력/상세 분리 + 하단 플로팅 추가 버튼(FAB)
- 모바일 탭 "입력" → "상세" 변경, 신규 `FloatingAddButton` 컴포넌트 추가
- FAB: 화면 하단 중앙 fixed → Sheet → 자산 유형 6개 → 스크린샷/직접입력 → CustomEvent dispatch
- **이유:** 입력(Form)과 상세(목록)가 하나의 탭에 혼재되어 UX 불명확

---

## 2026-04-18

### KB 및 CLAUDE.md 최신화
- architecture.md, api-reference.md, state-and-utils.md, CLAUDE.md 업데이트

### 공유 URL 로드 후 월별 스냅샷 데이터 유지 버그 수정
- `packSnapshots` 구분자 `^` → `;` (packV7 섹션 구분자와 충돌 방지)
- `initAndSync`에 `skipSnapshots` 옵션 추가, `snapshotVersion` state 추가
- **이유:** `^` 충돌로 `unpackV7`에서 monthly가 parts[9]로 누락되어 항상 빈 배열

### 스크린샷 가져오기 — 해외주식 원화/달러 인식 분기 환산 버그 수정
- `originalCurrency` 필드 추가, 클라이언트에서 분기 환산 처리
- **이유:** 토스증권 원화 표시 앱에서 해외주식 금액이 KRW로 인식될 때 환산 없이 USD로 저장되는 버그

### 일별/월별 스냅샷 정책 개선 및 공유 URL 포함
- 일별: 이번 달 한 달치만 저장, 월별 `secretasset_monthly_snapshots` 신규 추가
- 공유 토큰에 `snapshots?` 포함, `generateShareToken` snapshots 파라미터 추가
- **이유:** 일별 스냅샷이 올해 전체 누적되어 이달 한 달로 줄이되 월별 이력 별도 보관

### 자산 분포 카드 — 모바일 탭 전환
- `useIsMobile()` 도입, isMobile 시 4개 Card → Tabs 전환, 데스크탑은 lg:grid-cols-2 유지
- **이유:** 모바일에서 카드 세로 나열로 스크롤 길어지는 UX 문제

### 스크린샷 가져오기 — 주식 탭 카테고리 자동 적용 + 현금 금융기관 Select 교체
- `activeTab` prop 추가, 국내 카테고리 우선 적용
- 금융기관 `Input` → `financialInstitutions` 그룹 `Select`로 교체
- **이유:** IRP 탭 선택 후 스크린샷 올리면 국내 종목이 IRP 카테고리로 자동 설정되어야 함

### 스크린샷 — 카테고리 중복 탐지 `(ticker, category)` 복합 키 기준으로 수정
- **이유:** 기존 ticker만으로 판단 시 다른 계좌의 동일 종목이 잘못 충돌 처리됨

### 캐시 갱신 주기 시장 마감 시간 기준 세분화
- `getEffectiveDateStr(type)` 추가: 해외주식 KST 07:00, 국내주식 16:00, 환율 09:00 이전이면 전일 날짜 사용
- **이유:** 단순 날짜 비교로 오전 접속 시 전날 종가가 있어도 재조회하는 낭비

---

## 2026-04-17

### 스크린샷 가져오기 확장 + Gemini 사용 한도 관리
- crypto/cash/loan 스크린샷 다이얼로그 신규 추가
- 서버 전역 하루 200회 + 기기별 10회 이중 한도 (`use-gemini-usage.ts`)
- **이유:** 코인/현금/대출도 스크린샷으로 등록 요청. 유료 API 남용 방지

### 스크린샷 Gemini 비용 전면 최적화
- 프롬프트 압축 (~60% 절감), `responseMimeType: "application/json"` + `responseSchema` 강제
- `temperature: 0`, `maxOutputTokens: 2048`, `thinkingBudget: 0`
- **이유:** 이미지 토큰+thinking 토큰으로 예상보다 비용 높게 발생

### _components 디렉토리 구조 분리
- `*-input.tsx` → `input/`, `stock-screenshot-import.tsx` → `screenshot/`
- **이유:** 스크린샷 기능 확장 준비, input과 screenshot 파일군 구분

---

## 2026-04-11

### 주식 폼 조회 연동 UX 개선 + 소수점 2자리 정책 변경
- `lookupState` 상태 추가, 조회 전 종목명·현재가 필드 숨김
- `maxDecimals` 1 → 2 변경
- **이유:** 조회 전 빈 필드 노출로 UX 불명확. 해외 주식 단가 소수점 1자리 반올림 오차

---

## 2026-04-06

### max-width 1680px 커스텀 breakpoint 추가
- `globals.css`에 `--breakpoint-3xl: 1680px`, layout에 `max-w-screen-3xl` 적용
