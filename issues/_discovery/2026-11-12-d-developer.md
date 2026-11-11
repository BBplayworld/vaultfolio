# D 자율 과제 발굴 — developer(코드 관점), 2026-11-12 (main 14aaea7, 읽기 전용 점검)

## 후보 (우선순위 순)

### 1. 주가 대조 배치 429·부분 실패가 "정상 완료"로 캐시됨 (bug 의심, 안정성) — 권장
- 근거: `src/lib/finance/profit-utils.ts` 366~395 `runFetch`. 배치(3종목, 1초 간격)가 `res.ok`가 아니면(429·5xx) 조용히 건너뛰고, X-KIS-Unavailable만 중단 조건. 이후 `!hitUnavailable`이면 `merged`(일부 종목 누락)를 localStorage 캐시에 저장하고 `onComplete(false)` 호출 → 다음 호출이 "완료"로 보고 재시도하지 않음. 서버 `profit/route.ts` l1PerMinute 120이라 다수 종목·탭 중복 시 순간 429 가능.
- 영향: Hero 오늘/기간 수익 부분 합, 칩 누락이 캐시 만료(기간 TTL)까지 지속. 11-10 관찰(STATE l171)과 동일 원인.
- 규모: 소 — 실패 배치 있으면 `hitUnavailable`처럼 "불완전" 표시해 저장·완료 생략 + 429 Retry-After 1회 재시도. 테스트 1~2개(profit-ref-dedup·profit-fetch-gate 인접).
- 위험: low. 저장 스키마·서버 전송 변경 0(요청은 기존 티커 목록 그대로). 단 재시도로 요청량 소폭 증가 → 1회 한정.

### 2. formatPrice 4중 복제 정리 (중복 코드)
- 근거: 동일 USD/JPY/KRW 분기 본문이 `forms/trade/stock-target-picker.tsx:17`(export), `views/detail/trades/stock-trades-view.tsx:27`(export), `forms/trade/guards/delete-rollback-dialog.tsx:26`(비공개)에 3벌, `crypto-trade-screenshot-import.tsx:277`은 별개(KRW 전용 래퍼). 소비처가 `stock-trades-view`에서 import(`stock-page-view`, `price-chart`)하는 역방향 의존이라 화면 파일끼리 얽힘. 유사 `number-utils.ts`의 formatPriceByMode와는 용도 다름.
- 영향: 통화 추가(예: EUR)·소수 자릿수 변경 시 한 곳 누락 → 화면 간 표기 불일치.
- 규모: 소(3파일 → `src/lib/number-utils.ts`에 `formatPriceByCurrency` 1개, import 교체, KB state-and-utils 등록, 동작 동일 단위 테스트). 위험 low, 사용자 가시 변화 0.

### 3. us-stock-master 거래소 전부 NAS (데이터 품질, 영향 작음)
- 근거: `src/lib/data/us-stock-master.json` 7013건 exchange 100% NAS(실측). `us-master.ts` `getUsExchange`가 힌트로 쓰이나 `price-history.ts:157~159`는 이미 [힌트, NAS, NYS, AMS] 폴백 + 첫 성공 고정으로 주석 명시, `finance-service.ts:790`도 NAS/NYS/AMS 순차. 즉 오분류 영향은 NYSE·AMEX 종목의 첫 NAS 호출 1회 낭비(요청량 +1, 응답 빈 값) 수준이며 결과 오류 없음. `dividend/route.ts:193`은 `excd = "NAS"` 고정이라 NYSE 종목 배당 조회가 빈 값일 가능성은 별도 확인 필요(STATE l100 JPY 관찰과 함께).
- 판단: 마스터 재생성은 README 절차·외부 원본 필요 → 단독 과제로는 가치 낮음. 후보 1과 별개로 "dividend 해외 excd 폴백" 실측 후 필요 시 소규모 수정. 위험 low~medium(시세 요청 경로).

### 4. PC 새 소식 시트 X·바로 가기 히트영역 — 결함 아님(재평가 완료, 과제화 불필요)
- 근거: `src/components/ui/sheet.tsx:80` 닫기 버튼 `after:absolute after:-inset-2.5 sm:after:-inset-2`, 아이콘 `size-5 sm:size-6`(24px) → 확장 후 PC 40×40. 모바일은 `hideClose`(whats-new-sheet.tsx:86). `whats-new-sheet.tsx:163` 바로 가기도 `after:-inset-y-2.5 after:-inset-x-2` → 20+20=40높이, 76+16=92폭. 코드상 40px 충족. 실측(elementFromPoint·Playwright)은 미수행(읽기 전용 점검) — 이웃 요소가 겹쳐 가로채는지만 qa가 1회 확인하면 종결 가능. 단독 이슈 만들지 말 것(다음 UI 릴리스 동승 검증 항목).

### 5. 기타 스타일 후보 (UI, 코드 미확인·STATE 인용) — 평단 칩-눈금 간격, 라이트 로딩 박스 문구-윤곽선, 허브 2px
- 본 점검에서는 코드 근거 수집 안 함(시각 판단은 ui-designer 몫). 3건 묶어 "p2 UI 정돈" 1건으로 합치되 단독 릴리스 가치는 낮음 — 후보 1·2와 같은 릴리스에 동승이 적절.

## 이미 해결된 STATE 관찰 (정리 필요)
- STATE l172 "시작 시 cancelQueries가 첫 '오늘' 칩 쿼리 취소": `src/lib/finance/profit-fetch-gate.ts:54` + `__tests__/profit-fetch-gate.test.ts`로 재현·게이트 수정된 흔적 있음 → 후보 목록에서 제거 가능(운영 확인은 qa).

## 서킷·요청량 점검
- `src/lib/finance/kis-token.ts`: 3회 연속 실패→10분 서킷, 토큰 발급 락·single-flight, Slack 1회 알림 — 설계 양호, 이슈 없음.
- 클라 `profit-utils.ts`: 배치 3종목/1초, inFlight dedup, abort 정리 양호. 약점은 후보 1(비정상 응답 처리).
- `price-history.ts` 해외 폴백: 마스터가 전부 NAS라 NYS/AMS 종목은 회차마다 최대 3회 KIS 호출이나 성공 시 거래소 고정으로 회차 내 1회만 낭비.

## 제안
- 이번 릴리스 묶음: 1(bug·요청 안정성) + 2(중복 정리), 합쳐도 소규모, 위험 low. 3은 dividend excd 실측 후 판단, 4는 이슈화하지 않고 qa 검증에 흡수.
