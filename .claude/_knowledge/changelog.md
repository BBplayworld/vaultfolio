# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록.

---

## 2026-04-18

### KB 및 CLAUDE.md 최신화

- **파일:** `.claude/_knowledge/architecture.md`, `.claude/_knowledge/api-reference.md`, `.claude/_knowledge/state-and-utils.md`, `CLAUDE.md`
- **변경:** (1) `architecture.md` — `_components` 디렉토리 구조 `input/`, `screenshot/` 분리 반영, 스크린샷 기능 설명 4종 지원으로 확장, ticker-map 규모 업데이트. (2) `api-reference.md` — `ICacheStorage`에 Gemini 한도 관련 메서드 3개 추가, `getEffectiveDateStr` 함수 추가. (3) `state-and-utils.md` — `initAndSync` 시그니처 수정(opts 파라미터), `addStockRaw` 추가, `saveAssetDataRaw` 추가. (4) `CLAUDE.md` — Key Files 테이블 경로 수정(`screenshot/` 하위), `v72Z` 토큰 프리픽스, `use-gemini-usage.ts` 추가.
- **이유:** 04-17~18 대규모 기능 추가(스크린샷 4종 확장, 스냅샷, 캐시 개선) 이후 KB가 실제 코드와 불일치 상태였음

## 2026-04-18

### 공유 URL 로드 후 월별 스냅샷 데이터 유지 버그 수정

- **파일:** `src/contexts/asset-data-context.tsx`, `src/app/(main)/asset/_components/yearly-net-asset-chart.tsx`, `src/lib/asset-storage.ts`
- **변경:** (1) `packSnapshots` 내부 구분자를 `^` → `;`로 변경. `unpackSnapshots`에서 `;`/`^` 모두 허용(구 버전 호환). (2) `initAndSync`에 `skipSnapshots` 옵션 추가. `applySharedData`에서 `skipSnapshots: true`로 호출. (3) `snapshotVersion` state 추가 — `saveSnapshots` 완료 및 공유 데이터 로드 시 증가. 차트 훅이 `snapshotVersion`을 의존성으로 받아 localStorage 재읽기.
- **이유:** (핵심) `packSnapshots`가 `^`를 구분자로 사용해 `packV7`의 섹션 구분자와 충돌 → `unpackV7`에서 `parts[8]`이 daily만, monthly는 `parts[9]`로 누락되어 월별 항상 빈 배열. (부수) 공유 로드 후 `initAndSync` → `saveSnapshots`가 이번 달 1개로 덮어쓰고, 차트 훅이 마운트 1회만 읽어 반영 안 됨

### 스크린샷 가져오기 — 해외주식 원화/달러 인식 분기 환산 버그 수정

- **파일:** `src/app/api/parse-screenshot/route.ts`, `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx`
- **변경:** 서버 반환 객체에 `originalCurrency` 필드 추가 (AI 원본 인식 통화 보존). 클라이언트에서 `originalCurrency`로 분기: USD/JPY 인식 시 그대로 저장, KRW(또는 미인식) 시 `/ usdRate` 환산 후 USD 저장. 미리보기 표시·Badge 문구·업로드 안내 문구도 동일 분기 적용. 프롬프트에 "화면에 원화 표시 있으면 해외종목이어도 KRW 우선" 지시 강화. 서버에서 가격 크기 보정 추가: 해외주식인데 currentPrice ≥ 1000이면 원화 표시 앱으로 간주
- **이유:** 토스증권 등 원화 표시 앱에서 해외주식 금액이 KRW로 인식될 때 환산 없이 그대로 USD로 저장되어 550,000원→550,000달러가 되는 버그. AI가 "해외섹션 기본값=USD" 규칙에 의해 화면의 원화 표시를 무시하고 USD를 반환하는 경우가 있어 프롬프트+가격 크기 이중 방어 추가

### 스크린샷 가져오기 — 해외주식 미리보기/저장 시 환율 이중 나눗셈 버그 수정

- **파일:** `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx`
- **변경:** 등록 로직과 미리보기 표시 로직에서 `currentPrice / usdRate`, `averagePrice / usdRate` 나눗셈 제거. 서버가 이미 USD 달러값을 반환하므로 그대로 사용.
- **이유:** 이전 버전(currency 항상 KRW) 시절 "원화→달러 변환" 코드가 잔존하여, 서버가 `$400.62`를 반환해도 클라이언트에서 `400.62 / 1457.8 = $0.27`로 재계산하는 이중 오류 발생

### 스크린샷 가져오기 — 해외주식 currentPrice/averagePrice 오계산 버그 수정

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:** 프롬프트에 `currentPrice`/`averagePrice`/`currentValue` 모두 "화면에 명시된 경우만·계산 금지" 강화. `STOCK_SCHEMA` 및 `GeminiStock` 타입에 `averagePrice` 필드 추가. `processStockResults`에서 averagePrice 직접 제공 시 역산 대신 그대로 사용
- **이유:** 토스증권처럼 현재가/평균단가 컬럼 없이 총평가금액·수익률만 표시할 때 Gemini가 currentPrice를 추론해 엉뚱한 값($0.27 등)을 반환, 메리츠/한투는 평균단가 컬럼이 직접 표시되므로 averagePrice 직접 사용

### 스크린샷 가져오기 — 해외주식 currency 버그 수정 (KRW 고정 → USD/JPY 자동 판별)

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:** `STOCK_SCHEMA`에 `currency` 필드 추가. 프롬프트에 달러·"외화" → USD, 엔 → JPY, 원화·"원화로 보기" → KRW 판별 지시 추가. `GeminiStock` 타입에 `currency?` 추가. `processStockResults`에서 Gemini 응답 currency 우선 적용, 미제공 시 `category === "foreign"` → USD, 나머지 → KRW fallback
- **이유:** 해외주식 currency가 항상 "KRW"로 고정되어 테슬라 $400가 원화 400원으로 오인 저장되는 버그

### 스크린샷 가져오기 — 현재가 컬럼만 있는 해외주식 화면 인식 개선

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:** `STOCK_SCHEMA`에 `currentPrice`, `profitAmount` 필드 추가. 프롬프트에 각 필드 추출 지시 추가. `processStockResults` 필터 조건을 `currentValue > 0` 단일 조건에서 현재가·평가금액·수익금 중 하나라도 있으면 통과하도록 완화. 현재가 계산 우선순위: `currentPrice` → `currentValue÷수량` → `profitAmount÷profitRate 역산`
- **이유:** 평가금액 컬럼 없이 현재가+수량+평가손익만 표시하는 해외주식 화면(예: 키움 외화)에서 4~5번째 항목이 `currentValue=0`으로 인식되어 필터링 탈락하는 문제

## 2026-04-18

### 일별/월별 스냅샷 정책 개선 및 공유 URL 포함

- **파일:** `src/types/asset.ts`, `src/lib/asset-storage.ts`, `src/contexts/asset-data-context.tsx`, `src/app/(main)/asset/_components/yearly-net-asset-chart.tsx`, `src/app/(main)/asset/_components/sidebar/nav-user.tsx`
- **변경:**
  1. 일별 스냅샷: 이번 달 한 달치만 저장 (월 바뀌면 이전 달 자동 삭제)
  2. 월별 스냅샷 신규 추가 (`secretasset_monthly_snapshots`): 올해 12개월치 저장, `saveSnapshots` 호출 시 이번 달 업서트
  3. 공유 토큰에 스냅샷 포함: `generateShareToken`에 `snapshots?` 파라미터 추가, `packV7` 섹션[8]에 직렬화. `parseShareToken` 반환 타입에 `snapshots?` 포함
  4. 기존 `dailySnapshots`에서 `monthlySnapshots` 원타임 마이그레이션 (마운트 시 1회)
  5. 차트 월별 탭: `dailySnapshots`에서 월말 값 추출하던 방식 → `monthlySnapshots` 직접 읽기로 교체
- **이유:** 일별 스냅샷 보존 범위가 올해 전체여서 1월 데이터가 연말까지 누적. 이달 한 달로 줄이되 월별 이력은 별도 보관. 공유 링크 수신자도 차트 이력을 볼 수 있도록 토큰에 스냅샷 포함

### 자산 분포 카드 — 모바일 탭 전환

- **파일:** `src/app/(main)/asset/_components/asset-distribution-cards.tsx`
- **변경:** `useIsMobile()` 도입, isMobile 시 4개 Card를 Tabs(자산 분포/금융자산/부동산/대출)로 전환. 데스크탑은 기존 lg:grid-cols-2 유지. 카드 JSX를 `distributionCard` 변수 + `getCardByKey()` 함수로 추출해 모바일·데스크탑 양쪽에서 재사용
- **이유:** 모바일에서 카드가 세로로 나열되어 스크롤이 길어지는 UX 문제 개선

## 2026-04-18

### 스크린샷 가져오기 — 주식 탭 카테고리 자동 적용 + 현금 금융기관 Select 교체

- **파일:** `src/app/(main)/asset/_components/input/stock-input.tsx`
- **변경:** `Tabs`를 `defaultValue` → `value/onValueChange` controlled로 전환, `activeTab` 상태 추가 후 `StockScreenshotImport`에 전달
- **이유:** 사용자가 IRP 탭 선택 후 스크린샷을 올리면 국내 종목이 자동으로 IRP 카테고리로 설정되어야 함

- **파일:** `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx`
- **변경:** `activeTab` prop 추가, `DOMESTIC_CATEGORIES` Set으로 국내 카테고리 여부 판별 후 AI 탐지 카테고리 대신 탭 카테고리 우선 적용. 계좌 유형 수동 선택 UI 제거
- **이유:** 탭 정보를 prop으로 받아 처리하는 방식으로 단순화

- **파일:** `src/app/(main)/asset/_components/screenshot/cash-screenshot-import.tsx`
- **변경:** 금융기관 `Input` → `financialInstitutions` 그룹 `Select`로 교체
- **이유:** 자유 입력보다 선택지 제공이 오입력 방지에 유리

### 스크린샷 가져오기 — 카테고리 중복 탐지 로직 수정

- **파일:** `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx`
- **변경:** 중복 탐지를 `(ticker, category)` 복합 키 기준으로 정확하게 처리. 해외 섹션은 항상 `foreign` 고정. 국내/기타는 AI 탐지 카테고리 그대로 유지하고, 동일 ticker라도 카테고리가 다르면 별개 계좌로 취급해 중복 아님으로 처리
- **이유:** 기존 로직이 ticker만으로 카테고리를 덮어써서, `pension`에 등록된 종목을 `irp` 스크린샷으로 가져올 때 `pension:ticker` 키 충돌로 잘못된 중복 경고 발생. 카테고리별 계좌는 독립적으로 관리해야 함

### 스크린샷 버튼 Popover 메뉴 통일 + Crypto 평균단가 미리보기

- **파일:**
  - `src/app/(main)/asset/_components/input/cash-input.tsx`
  - `src/app/(main)/asset/_components/input/crypto-input.tsx`
  - `src/app/(main)/asset/_components/input/loan-input.tsx`
- **변경:** 독립 "스크린샷" 버튼 → StockInput과 동일한 Popover 드롭다운 메뉴 ("스크린샷 가져오기" / "직접 입력") 패턴으로 통일. `DialogTrigger` 제거하고 `isDialogOpen` 상태로 직접 제어
- **이유:** UX 일관성. Stock만 Popover였고 나머지는 버튼 2개 배치 방식이었음

- **파일:** `src/app/(main)/asset/_components/screenshot/crypto-screenshot-import.tsx`
- **변경:** 미리보기 항목에 `평균단가` 추가 (수량 → 평균단가 → 현재가 → 평가금액 순)
- **이유:** AI 인식 후 평균단가가 올바른지 사용자가 미리보기에서 확인할 수 없었음

### 캐시 갱신 주기 시장 마감 시간 기준 세분화

- **파일:** `src/lib/cache-storage.ts`, `src/app/api/finance/route.ts`
- **변경:** `getEffectiveDateStr(type)` 함수 추가. 해외주식 KST 07:00, 국내주식 KST 16:00, 환율 KST 09:00 이전이면 전일 날짜를 유효 캐시 키로 사용. `FileCacheStorage.writeFinanceCache()` 정리 로직도 동일 기준 적용
- **이유:** 기존에는 단순 날짜 비교로 오전 접속 시 전날 종가가 있어도 재조회하는 낭비 발생

### 올해 월별·일별 순자산 차트 + 일별 스냅샷 자동 저장

- **파일:** `src/types/asset.ts` — `DailyAssetSnapshot { date, netAsset, financialAsset }` 인터페이스 추가
- **파일:** `src/lib/asset-storage.ts` — `STORAGE_KEYS.dailySnapshots = "secretasset_daily_snapshots"` 추가
- **파일:** `src/contexts/asset-data-context.tsx` — `saveDailySnapshot()` 추가. `initAndSync` 완료 후 최신 state 기반 스냅샷 저장. 올해 데이터만 유지, 오늘은 덮어쓰기
- **파일:** `src/app/(main)/asset/_components/yearly-net-asset-chart.tsx` — Tabs 3개 (년도별/월별/일별). 월별 BarChart, 일별 LineChart (순자산+금융자산). `useDailySnapshots()` 훅으로 localStorage 로드
- **이유:** 주식 급등락에 의한 일별 자산 변화 추적 기능 요청

---

## 2026-04-17

### 스크린샷 가져오기 확장 + Gemini 사용 한도 관리

- **파일:**
  - `src/lib/cache-storage.ts` — `getGeminiDailyCount`, `incrementGeminiDailyCount`, `checkGeminiDailyLimit` 메서드 추가 (FileCacheStorage: JSON 파일 내 `GEMINI_COUNT` 필드, UpstashCacheStorage: Redis `gemini:daily:YYYY-MM-DD` 키)
  - `src/hooks/use-gemini-usage.ts` — 신규 생성. localStorage `secretasset-gemini-YYYY-MM-DD` 키로 기기별 하루 10회 제한
  - `src/app/api/parse-screenshot/route.ts` — `assetType` 파라미터 추가 (stock/crypto/cash/loan 분기), 서버 한도(200회) 체크, 타입별 Gemini 프롬프트·스키마·후처리 함수 분리
  - `src/app/(main)/asset/_components/screenshot/crypto-screenshot-import.tsx` — 신규 생성
  - `src/app/(main)/asset/_components/screenshot/cash-screenshot-import.tsx` — 신규 생성 (conflict 없이 append)
  - `src/app/(main)/asset/_components/screenshot/loan-screenshot-import.tsx` — 신규 생성 (conflict 없이 append, 대출일 미인식 Badge)
  - `src/app/(main)/asset/_components/input/crypto-input.tsx` — 스크린샷 버튼 + `CryptoScreenshotImport` 연동
  - `src/app/(main)/asset/_components/input/cash-input.tsx` — 스크린샷 버튼 + `CashScreenshotImport` 연동
  - `src/app/(main)/asset/_components/input/loan-input.tsx` — 스크린샷 버튼 + `LoanScreenshotImport` 연동
  - `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx` — `useGeminiUsage` 통합 (한도 표시 Badge, 초과 시 비활성화)
- **변경:** 주식 전용이던 스크린샷 가져오기를 암호화폐·현금성자산·대출까지 확장. Gemini 비용 보호를 위해 서버 전역 하루 200회 + 기기별 하루 10회 이중 한도 추가
- **이유:** 사용자가 코인/현금/대출도 스크린샷으로 등록 요청. 유료 API 남용 방지 목적으로 한도 관리 추가

### _components 디렉토리 구조 분리

- **파일:** `src/app/(main)/asset/_components/` 전체
- **변경:** `*-input.tsx` 6개 → `input/` 하위로 이동, `stock-screenshot-import.tsx` → `screenshot/` 하위로 이동
- **이유:** 스크린샷 가져오기 기능 확장(코인·현금·대출) 준비를 위해 input과 screenshot 파일군을 디렉토리로 구분. `page.tsx`와 `stock-input.tsx`의 import 경로 업데이트

---

## 2026-04-17

### 스크린샷 가져오기: 국내 ETF 분류 오류 및 수량 미표시 계산 수정

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:**
  1. `DOMESTIC_TICKERS` Set 생성 (ETF + 국내주식 티커 전체) — Gemini가 "해외"로 잘못 분류해도 이 Set에 있으면 `domestic` 강제
  2. `quantityMissing` 필드를 스키마·프롬프트에 추가 — Gemini가 수량 미표시 여부를 직접 반환
  3. 수량 미표시 시 `quantity=1`, `currentPrice=currentValue(원화)` 로 설정 — 프론트에서 해외주식이면 USD 환산 그대로 적용
  4. section 반환값을 category 기준으로 재설정 — 국내 ETF 강제 분류 이후 일관성 보장
- **이유:** TIGER/KODEX 등 국내 ETF가 Gemini에 의해 "해외"로 분류되는 케이스 발생. 수량 없는 종목의 currentPrice가 평가금액 그대로 설정되어 해외주식 USD 환산 시 이중 오류 발생

### 스크린샷 가져오기: 국내 주식 ticker-map 107개 → 214개 확장

- **파일:** `src/app/api/parse-screenshot/ticker-map.ts`
- **변경:** 반도체/장비·2차전지·바이오·방산·금융·게임·유통·건설/리츠·에너지 등 107개 추가
- **이유:** ticker-map에 종목명이 있으면 Gemini 인식 실패 시 lookupTicker() fallback으로 티커 자동 매핑 가능 → 인식률 향상

### 스크린샷 가져오기: Gemini 비용 전면 최적화 (프롬프트·출력·config)

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:**
  1. 프롬프트 압축 — 설명형 문장 제거, 필드 규칙을 1줄 형식으로 압축 (~60% 토큰 절감)
  2. `responseMimeType: "application/json"` + `responseSchema` 적용 — JSON 구조 강제로 마크다운 블록 방어 코드 제거, 불필요한 출력 필드 차단
  3. `temperature: 0` — 추출 작업이므로 창의성 불필요, 결정론적 출력
  4. `maxOutputTokens: 2048` — 출력 상한 설정 (종목 50개 기준 여유)
  5. `thinkingBudget: 0` 유지 — thinking 토큰 비활성화
  6. ETF 테이블 구분자 줄바꿈 → 콤마로 변경 (공백 토큰 절감)
- **이유:** gemini-2.5-flash-lite 실사용 시 이미지 토큰+thinking 토큰으로 예상보다 비용 높게 발생. 전방위 최적화로 입출력 토큰 최소화

### 스크린샷 가져오기: Gemini thinking 비활성화로 비용 절감

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:** `thinkingConfig: { thinkingBudget: 0 }` 추가
- **이유:** gemini-2.5-flash-lite는 thinking 모델로 보이지 않는 thinking 토큰이 출력에 포함되어 과금됨. 단순 JSON 추출 작업엔 thinking 불필요 → 비활성화로 출력 토큰 절반 이하로 절감

---

## 2026-04-17

### 스크린샷 가져오기: Gemini 프롬프트 토큰 최적화 (~70% 절감)

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:**
  1. 해외 주식·ETF 참조 테이블 전체 제거 (Gemini 자체 지식으로 추론)
  2. 국내 주식 참조 테이블 제거 (lookupTicker fallback으로 충분)
  3. 하드코딩된 국내 ETF 테이블 → `DOMESTIC_ETF_MAP` 런타임 자동 생성으로 교체
  4. `DOMESTIC_ETF_TABLE` 모듈 레벨 상수로 1회 빌드
- **이유:** Gemini API 결제 등록 후 첫 토큰부터 과금. 참조 테이블 ~850토큰 → ~250토큰으로 절감

### 스크린샷 가져오기: 안내 문구 확장 + 잘린 종목명 티커 매칭 개선

- **파일:** `src/app/(main)/asset/_components/stock-screenshot-import.tsx`, `src/app/api/parse-screenshot/ticker-map.ts`
- **변경:**
  1. DialogDescription 및 안내 bullet 수정: 토스증권/도미노 한정 → 종목명·수량·금액이 명확하면 모든 증권 앱 인식 가능 안내 추가
  2. `lookupTicker()` 함수에 3단계 매칭 로직 추가:
     - 1단계(기존): 정규화 후 정확한 일치
     - 2단계(신규): prefix 매칭 — 입력이 키의 접두사인 경우 (가장 짧은 키 선택)
     - 3단계(신규): 키가 입력의 접두사인 경우 (가장 긴 키 선택)
     - 4자 미만은 오탐 방지로 fuzzy 매칭 생략
- **이유:** 스크린샷에서 긴 종목명이 잘릴 때(예: "KODEX 미국배당커버드콜액") 기존 정확 매칭 실패 → prefix 매칭으로 자동 티커 인식 가능하게 개선

## 2026-04-16

### 스크린샷 가져오기: ticker null 버그 수정 + 미식별 종목 카테고리 자동 설정

- **파일:** `src/app/api/parse-screenshot/route.ts`
- **변경:**
  1. Gemini가 ticker를 문자열 `"null"`로 반환할 때 truthy 평가되어 티커로 저장되던 버그 수정 → 명시적 `"null"` 문자열 필터링
  2. ticker 미식별 종목의 category를 직전 종목(위 항목)의 category로 fallback 설정 (section 판단 실패 대비)
- **이유:** "비트마인 이머선 테크놀로지스" 같은 종목에서 ticker=null이 문자열로 저장되고, 카테고리가 국내주식으로 잘못 설정되는 버그 발생

### 스크린샷 가져오기: merge 로직 수정 + 도미노 앱 지원 + ticker-map 확장

- **파일:** `src/app/(main)/asset/_components/stock-screenshot-import.tsx`, `src/app/api/parse-screenshot/route.ts`, `src/app/api/parse-screenshot/ticker-map.ts`
- **변경:**
  1. `merge` 모드 로직 수정: 기존 수량 합산 → 스크린샷 기준 ticker 덮어쓰기 (비중복 기존 주식은 유지)
  2. conflict step UI: "합산" → "덮어쓰기", 설명 텍스트 및 preview badge("합산" → "교체") 수정
  3. `route.ts` 프롬프트: 토스증권 전용 → 토스증권·도미노 앱 양쪽 지원. 소수점 수량, 평가금액 역산 안내 추가
  4. 수량 소수점 6자리 처리 추가 (도미노 앱: 310.536919주 등)
  5. DialogDescription에 "또는 도미노" 문구 추가
  6. `ticker-map.ts`: 한국인 매수 top 100 기준 해외주식 약 100개 추가 (우주/모빌리티, 핀테크, 소비재, 통신, 방산, 리츠, 레버리지ETF, YieldMax ETF 등)
- **이유:** merge가 기존 수량에 합산하는 것이 아닌 스크린샷 기준으로 덮어쓰기가 맞다는 사용자 요구. 도미노 앱 스크린샷 지원 요청.

### Gemini SDK 교체 및 스크린샷 가져오기 중복 처리 개선

- **파일:** `package.json`, `src/app/api/parse-screenshot/route.ts`, `src/app/(main)/asset/_components/stock-screenshot-import.tsx`
- **변경:**
  1. `@google/generative-ai` → `@google/genai` 패키지 교체 (v1.0.0)
  2. `route.ts`: `GoogleGenerativeAI` → `GoogleGenAI`, 모델 `gemini-1.5-flash` → `gemini-2.5-flash`, API 호출 방식 `genAI.models.generateContent()` 형태로 변경
  3. `stock-screenshot-import.tsx`: 파싱 완료 후 기존 주식과 ticker 기준 중복 탐지, 중복 시 `conflict` step 삽입
  4. conflict step UI: 합산(가중평균 단가·수량 합산) / 초기화 후 등록 2가지 선택지 제공
  5. `handleRegister`: `merge` 모드 시 `updateStock`으로 기존 항목 업데이트, `reset` 모드 시 `deleteStock` 전체 후 `addStock`
  6. preview step에서 합산 대상 종목에 "합산" badge 표시
- **이유:** `gemini-1.5-flash`가 2026년 기준 완전 폐기(404)되어 API 오류 발생. 기존 주식이 있는 상태에서 스크린샷 가져오기 시 중복 종목이 무조건 추가되어 데이터 중복 문제 발생

---

## 2026-04-11

### 주식 폼 조회 연동 UX 개선 + 소수점 2자리 정책 변경

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  1. `lookupState` 상태(`"idle" | "success" | "failed"`) 추가 — 신규 추가 시 `"idle"` 초기값, 편집 모드는 `"success"` 초기값
  2. 종목명(`name`)·현재가(`currentPrice`) 필드를 `lookupState !== "idle"` 조건부 렌더링으로 변경 — 최초 입력 시 숨김
  3. 조회 성공 시 `setLookupState("success")`, 실패/에러 시 `setLookupState("failed")` 설정 — 실패 시 필드 노출 + 수동 입력 안내 텍스트 표시
  4. 카테고리 변경 시 `lookupState` 리셋 (비상장은 `"success"`, 나머지는 `"idle"`)
  5. `quantity`, `averagePrice`, `currentPrice`의 `maxDecimals` 1→2 변경, 설명 텍스트 동일 업데이트
- **이유:** 조회 전 빈 종목명·현재가 필드가 노출되어 UX 흐름이 불명확했고, 해외 주식 단가(예: 135.47달러)에서 소수점 1자리로 인한 반올림 오차 발생

### scroll-to-top 모든 환경 노출 + toast 잔류 버그 방어 처리

- **파일:** `src/components/scroll-to-top.tsx`, `src/contexts/asset-data-context.tsx`
- **변경:**
  1. `scroll-to-top.tsx` — `md:hidden` 클래스 제거 → PC/태블릿 포함 전체 환경에서 버튼 노출
  2. `asset-data-context.tsx` — `dismissStaleToasts()` 유틸 추가: 마지막 toast 이후 4초 이상 경과한 경우 `toast.dismiss()` 호출 후 새 toast 표시. `notify.success/error/info` 세 곳 모두 적용
- **이유:** scroll-to-top이 모바일에서만 보였고, 자산 입력 액션 중 이전 toast가 닫히지 않고 남아있는 버그 방어

---

## 2026-04-10

### 자산 입력 컴포넌트 모바일 UX 개선 + 환율 소수점 입력
- **파일:** `cash-input.tsx`, `real-estate-input.tsx`, `loan-input.tsx`, `crypto-input.tsx`, `stock-input.tsx`, `exchange-rate-input.tsx`
- **변경:**
  1. DialogContent에 `overflow-x-hidden overscroll-contain` 추가 → 가로 스크롤 제거, 빈 영역 드래그 고정
  2. 날짜 Input(`type="date"`)에 `max-w-[160px] sm:max-w-full text-sm` 추가 → 모바일에서 박스 이탈 방지 (대출 2-col 그리드는 `min-w-0`)
  3. 환율 NumberInput에 `allowDecimals={true} maxDecimals={1}` 추가 → USD/JPY 소수점 첫째 자리 입력 가능, 모바일 decimal 키패드 표시
- **이유:** 모바일(375px)에서 날짜 입력이 카드 밖으로 넘치고, 다이얼로그 빈 영역 드래그 시 화면이 움직이며, 환율 정수만 입력 가능했던 문제 수정

### 주식 폼 티커 입력 placeholder·설명 카테고리별 개선

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  - `getTickerPlaceholder()` / `getTickerDescription()` 헬퍼 추가 → 카테고리(domestic/foreign/irp/isa/pension/unlisted)별 분기
  - `unlisted`일 때 조회 버튼(`!editData && !isUnlisted`) 숨김 처리
  - `isUnlisted`는 `maxLength=20`으로 완화, ETF 카테고리는 6자리 유지
- **이유:** IRP·ISA·연금은 국내 상장 ETF 코드 6자리이고, 비상장은 API 조회 불가 — 카테고리마다 맥락에 맞는 안내가 필요

---

## 2026-04-06

### max-width 1680px 커스텀 breakpoint 추가

- **파일:** `src/app/globals.css`, `src/app/(main)/asset/layout.tsx`
- **변경:** `@theme { --breakpoint-3xl: 1680px }` 추가 → layout에서 `max-w-screen-3xl` 적용
- **이유:** 기존 `2xl`(1536px)은 넓은 모니터에서 여백이 과도하고, `3xl`(기본 1920px)은 너무 넓어 중간값 필요

### 주식 수익률 표시 개선

- **파일:** `src/app/(main)/asset/_components/stock-input.tsx`
- **변경:**
  - 수익률 `(+41.99%)`을 평가손익 금액 `<span>` 내부 인라인에서 분리 → 독립 줄
  - 평가손익 컬럼 정렬: `items-end sm:items-start` → `items-end` (항상 우측 정렬)
- **이유:** 금액 자리수가 클 때 수익률이 자동 줄바꿈되면서 모바일 레이아웃 깨짐
