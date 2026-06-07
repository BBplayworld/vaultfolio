# 전체 기능 QA 테스트 계획 (secretasset)

> 앱 **전체 기능**의 회귀 테스트 + **UI 품질 유지** 상시 체크리스트. 릴리즈 전·대형 변경 후 이 문서를 단일 출처로 일괄 점검한다.
> 원칙: **라이브 프리뷰 검증 제외**(CLAUDE.md). ⚙ 자동·코드레벨 검증은 직접 수행, 👤 앱 수동 항목은 사용자 실행 체크리스트로 산출한다.
> 사용법: 변경 범위에 해당하는 섹션만 골라 점검하거나, 릴리즈 전 전체를 순회한다. 발견 이슈는 P0(데이터 손실/크래시)·P1(기능 오작동)·P2(UX·표시)로 분류.

---

## Phase 0 — 자동 베이스라인 (항상 먼저)

```bash
npx tsc --noEmit        # 타입 0 errors
npx vitest run          # 단위 테스트 전부 pass (trade-utils, validate-reflection)
npm run lint            # ESLint 0 errors (기존 warning 외 신규 무발생)
npm run build           # 프로덕션 빌드 + 전체 라우트 생성
```

- [ ] tsc 0 errors
- [ ] vitest 전부 pass
- [ ] lint 0 errors (신규 warning 없음)
- [ ] build 성공 (모든 라우트 생성)

> 실패 시 해당 기능 Phase로 내려가 코드 경로를 추적한다(추측 패치 금지 — 근본 원인부터).

---

## Phase 1 — 기능별 테스트 매트릭스

각 기능: **핵심 / 엣지·경계 / 회귀**. ⚙=자동·코드레벨, 👤=앱 수동.

### F-ASSET. 자산 CRUD (주식·암호화폐·부동산·현금·대출·년도별 순자산)
- ⚙ add/update/delete가 `saveData` 단일 저장 경로 사용, 삭제 후 합계 재계산 ([asset-data-context](../../src/contexts/asset-data-context.tsx) `getAssetSummary`)
- 👤 각 자산 유형 추가→수정→삭제, 순자산/총자산/총부채 즉시 갱신
- 👤 비종목 자산(부동산·대출·현금) 카드 접힘행 왼쪽=`이름 / 비중%`만, 상세 펼침에 종류·매입가(부동산)·금리·금융기관(대출) 노출 — 주식 카드 패턴과 통일
- 엣지: 0개 상태(웰컴가이드 노출), 단일 항목 표시(`length > 0` 규칙)
- 회귀: 부동산 임차보증금(tenantDeposit) 순자산 차감, 대출 잔액 차감

### F-STOCK. 주식 상세 탭 ([stock-tab.tsx](../../src/app/(main)/asset/_components/views/detail/tabs/stock-tab.tsx))
- 👤 종목 카드 펼침/접힘, 증권사별 분할(`SubStockCard`)·나누기 다이얼로그, 주식담보대출 연결 표시
- 👤 비활성: 상장폐지(red)·거래정지(amber) Badge, delisted 평가 제외 / halted 마지막가 유지
- 👤 요약 헤더 평가손익·전일 대비, 해외 상세 환차손익(금액/수익률 2줄, 우측 매입환율 영역 미침범)
- ⚙ `computeStockMetrics`·`mergeStockGroup`·`groupStocksByTicker` 동일 ticker 병합(1회 집계)
- 엣지: 해외주식 원화/달러 평단 입력 분기, 환차익 계산
- 회귀: delisted 종목이 stockCount·stockCost·환차익에서 제외

### F-TRADE. 주식 거래내역 (매매 로그) ([trade-input.tsx](../../src/app/(main)/asset/_components/forms/trade/trade-input.tsx) · [stock-trades-view.tsx](../../src/app/(main)/asset/_components/views/detail/trades/stock-trades-view.tsx))
- 👤 거래 입력(매수/매도), 반영 ON/OFF, 반영 후 예상 포지션 인라인 미리보기, 중복 거래 인라인 확인
- 👤 거래 삭제 → 미반영 즉시삭제 / 반영 롤백 다이얼로그
- ⚙ `trade-utils`: 가중평균 평단·환율, 매도 차감, 미반영 스킵, **역산 롤백(수동 보유분 보존)**, `findDuplicateTransaction`, `pruneTransactions` 3년 롤링
- ⚙ `validate-reflection`: oversell/중복반영 restrict, manual_override/backdated confirm
- 엣지: 수동 보유분+반영거래 삭제 시 보유분 보존(P1 회귀), 전량매도 평단 0, 보유초과 매도 차단, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 저장(stale-closure 방지)

### F-TRADE-SS. 거래 스크린샷 가져오기 ([trade-screenshot-import.tsx](../../src/app/(main)/asset/_components/forms/trade/trade-screenshot-import.tsx))
- 👤 스크린샷 업로드→인식→선택 등록, 다종목 일괄(`addTransactionsBatch`)
- 엣지: 통화 KRW/USD 분기, 중복 거래 처리, 매칭 실패 종목 제외

### F-XRAY. 주식 X-Ray ([stock-xray-view.tsx](../../src/app/(main)/asset/_components/views/detail/xray/stock-xray-view.tsx) · [lib/xray](../../src/lib/xray))
- 👤 5축(핵심분야·시가총액·지수·지역·통화) 전환, 분포바·집중도 등급, AI 분류 진행률, 프롬프트 확인·복사
- ⚙ `stock-xray` `computeBreakdown` 단일배정·합 100%, 미분류 처리, 레버리지/인버스 ETF 지수매핑(TQQQ·QLD→NASDAQ100, UPRO·SSO→S&P500)
- ⚙ `fetch-classifications` 캐시 hit 스킵·dedup·스트리밍, 실패 토스트 폴백, `classification-store` localStorage 90일
- 엣지: 전량 미분류 시 "준비 중", 집중도 임계값 0.6/0.35, delisted 가치 0
- 회귀: ticker 병합 후 집계(1회 노출)

### F-ACTIVITY. 성과 (순자산·수익·배당) ([views/activity](../../src/app/(main)/asset/_components/views/activity))
- 👤 순자산 차트(현재+전년 대비), 수익 차트(기간별 일/주/월/연, basis 토글), 배당 차트(연간+월평균, 예상/실제)·월별 배당 종목
- 👤 수익 차트 "기준 종가 비교": 시작 종가가 휴장으로 직전 영업일에 폴백되면 "휴장제외" 최소 표시 — 일별=시작~종료 사이 휴장(`hasHolidayBetween`), 주/월/연=명목 기준 시작일 자체가 휴장(`isKr/UsHoliday`)
- ⚙ `fetchProfitRef` + `getProfitCacheKey`: **tickerList `.sort()` 필수**(캐시 중복 회귀 다발), basis별 캐시 분리
- ⚙ `computeDailyStockProfit` 전일 종가 대비, `ProfitBasis`(sameBusinessDay/kstAccessDay), `getDailyClosingRefDates` 시장별 컷오프(국내16:00·해외06:00/07:00 KST)
- ⚙ 휴장 폴백 캐시: 요청일이 비영업일(`isKrBusinessDay`/`isUsBusinessDay`)일 때만 응답일 기준 ref-date 매핑 저장(churn 제거), 영업일+장중 미확정은 미저장(stale 방지) ([route.ts](../../src/app/api/finance/profit/route.ts))
- 엣지: 전년 데이터 없음, 조회 중 상태, 배당 매수일 이전 payout 제외
- 회귀: 2단 캐시(REF_DATE_MAP/REF_PRICES) 휴장일 영구 hit, daily 캐시 키, 일별 표시값(국내 휴장 시 직전 영업일 종가) 불변

### F-HUB. 집중도·허브·대시보드
- 👤 `detail-hub`(카테고리별 평가손익·건수), `performance-hub`(순자산·수익·배당 KPI), `dashboard` 도넛/금융자산 바
- 엣지: 빈 카테고리 클릭 비활성, 단일 종목, 0·음수 값
- ⚙ `assignColors` 최대값=MAIN_PALETTE[0]

### F-SHARE. 공유 (Zero-Knowledge) ([header/share](../../src/app/(main)/asset/_components/header/share) · [api/share](../../src/app/api/share))
- 👤 공유 URL 생성·로드, Short URL(s:KEY), PIN 보호(4자리), 잘못된 토큰→invalid-access
- ⚙ packV7/v7.2/v72Z 직렬화·복호화, 스냅샷·profitBasis·nickname 포함
- 엣지: PIN 불일치 재시도, v72Z localKey 손상 시 즉시 invalid, URLSearchParams `+`→공백 복구
- 회귀: **공유 토큰 버전 호환**(신규 필드 추가가 기존 URL 파싱 안 깨뜨리는지), 스냅샷 구분자 충돌

### F-SCREENSHOT. 인증샷 (share-card) ([share-card.tsx](../../src/app/(main)/asset/_components/header/share/share-card.tsx))
- 👤 인증샷 생성, 섹션 선택(도넛·주식), 금액/카테고리 숨김 마스킹, 핵심 포트폴리오 강조
- 👤 주식 섹션: 비중바·포트폴리오(범례) 하단에 종목 리스트(헤더+비중 그라데이션 바) 노출, 요약 헤더는 전일 대비/구분선 제거·평가손익이 평가금액과 동일 행 정렬
- ⚙ `screenshotMode` 본문과 시각 일치, `maskFn` 적용
- 엣지: 카테고리 필터(전체/해외 등), 빈 섹션

### F-IMPORT-EXPORT. 데이터 내보내기/가져오기
- 👤 JSON 내보내기→가져오기 라운드트립, 자산·스냅샷·옵션 보존
- ⚙ `use-asset-import`, 스키마·`validate-reflection` 검증, 악성·손상 JSON 방어
- 회귀: 가져오기 후 `dataResetVersion`++로 진행 중 fetch abort

### F-SYNC. 가격·환율 동기화
- 👤 종목 현재가·환율(USD/JPY) 자동 갱신, 갱신 완료 토스트
- ⚙ `getStockCacheSlot` 장중 1시간/장외 날짜 슬롯, outdated 판정, 3개씩 배치+1초 간격
- 엣지: 데이터 삭제/불러오기 중 sync abort(epoch+AbortController), 취소된 응답 미반영
- 회귀: foreign+KRW→USD 마이그레이션, market 캐시 비었을 때 재조회

### F-SNAPSHOT. 자산 스냅샷
- ⚙ 일별(이번 달)·월별(올해 12개월)·년도별 종가 기준 저장, 토/일 보완
- 회귀: `saveSnapshotsBlockedRef` 차단, tickerList 정렬, 종가(refPrice) 폴백

### F-NAV. 네비게이션 (drill-down)
- 👤 `#detail/stocks` 직접진입·새로고침·뒤로가기, InlineSelector 탭 전환, scrollTo(0,0)
- 엣지: 잘못된 hash 폴백, `back()` 항상 홈 복귀, 웰컴가이드 시 헤더 미노출

### F-ONBOARD. 튜토리얼·온보딩 ([app-guide.tsx](../../src/app/(main)/asset/_components/header/app-guide.tsx))
- 👤 웰컴가이드(자산 0개), 앱가이드 단독 보기, 튜토리얼 step 진행/스킵
- ⚙ `secretasset_tutorial_status` 단일 키, 마이그레이션(merge-tutorial-status)

### F-NOTICE. 공지 시스템
- ⚙ `NEXT_PUBLIC_NOTICE` 단일 JSON 파싱(enabled/expiresAt/id), items[] + 이미지 매칭(Vercel Blob)
- 엣지: 잘못된 JSON→미표시, 만료, id 기준 1회 노출(localStorage)

### F-MISC. 닉네임·테마·AI 프롬프트·환율 입력
- 👤 닉네임 저장·공유 반영, 다크모드 토글, 도구 메뉴(`tool-menu`) AI 자산현황 프롬프트, 수동 환율 입력

---

## Phase 1B — UI 품질 유지 (코드레벨 상시 점검)

> **라이브 프리뷰/브라우저 접속 없이** 정적 분석으로만 수행. 실사용자 테스트는 대체 불가.

### U1. 접근성 (a11y)
- 아이콘 전용 버튼에 `aria-label`/`title` 존재
- `<img>`에 `alt`(의미 없으면 `alt=""`)
- **클릭 가능 요소는 `<button>`/`<a>`** — `onClick` 단 `<div>`/`<span>`은 키보드·스크린리더 불가
- 폼 입력에 `<Label>` 연결(OTP/체크박스 라벨 포함)

### U2. 터치·반응형
- 터치 타겟 최소 크기 — 아이콘 버튼 `size-7.5`(≈30px) 이상, hover 전용 노출 금지(터치 도달 불가)
- `sm:`/`lg:` 분기 일관, 가로 넘침은 `overflow-x-auto`+`min-w-0` 체인
- **날짜 input 넘침**: `globals.css` 전역 규칙(`input[type="date"]` 등 `appearance:none`+`min-width:0`+`max-width:100%`+webkit 의사요소 리셋)으로 모바일 컨테이너 넘침 원천 차단, 폼별 `max-w-[160px]` 임시방편 미부활(전폭 통일)
- 모바일 분기(`useIsMobile`)의 `undefined`(hydration 전) 처리

### U3. 다크모드·디자인 토큰
- 하드코딩 색(`text-black`/`bg-white`/원시 `#hex` className) 금지 → `text-foreground`/`bg-background` 등 토큰
- 의미색 규칙: 확인·제출 `Button variant="brand"`, 체크박스 기본 `Checkbox`(자동 brand), 매수=빨강·매도=파랑, 삭제=destructive만 예외
- 카드 액션 버튼 `Button size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5) 통일

### U4. 정보위계·사용성 (휴리스틱)
- 빈/로딩/에러/단일항목 상태 메시지 존재 (목록은 `length > 0`)
- 위계: Hero→필터→리스트 순서, InlineSelector 탭 통일
- 파괴적 액션(삭제) 확인 단계(`confirm`/다이얼로그)
- 숫자 표기 `tabular-nums`, 통화 포맷 일관(`formatCurrency`/`formatShortCurrency`)
- 리스트 카드 위계: 접힘행 왼쪽=핵심 식별(이름·비중), 상세는 펼침에 — 비종목 자산도 동일(`ui-design-guidelines.md`)

> 스캔 예시:
> ```bash
> grep -rn "onClick" src --include=*.tsx | grep "<div\|<span"        # 클릭 가능 div/span
> grep -rn "size=\"icon\"" src --include=*.tsx                        # 아이콘 버튼 aria 누락 후보
> grep -rn "text-black\|text-white\|bg-white\|bg-black\|#[0-9a-fA-F]\{6\}" src --include=*.tsx  # 하드코딩 색
> ```

---

## Phase 2 — 회귀 위험 레지스트리 (상시 점검)

변경 시 반드시 확인하는 과거 회귀 다발 지점:

| # | 위험 | 점검 |
|---|------|------|
| R1 | **tickerList 정렬 누락** | `fetchProfitRef`·useQuery·캐시 키의 tickerList는 항상 `.sort()` (3회+ 회귀) |
| R2 | **목록 표시 조건** | 항목 렌더는 `length > 0`만, `> 1`/`<= 1` 금지(단일 항목 누락) |
| R3 | **공유 토큰 버전 호환** | 새 필드 추가가 기존 packV7~v72Z 파싱·역직렬화를 깨지 않는지 |
| R4 | **단일 저장 경로** | 거래+포지션은 `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 saveData(stale-closure) |
| R5 | **sync abort 정합성** | 데이터 삭제/불러오기 시 epoch·AbortController·blocked 플래그로 취소된 응답이 빈 state 덮어쓰지 않는지 |
| R6 | **디렉토리 rename 잔존** | `top-nav→header`, `main-nav→views`, `bottom-nav→forms` 깨진 import 없는지 |
| R7 | **삭제 롤백 보유분 보존** | 거래 삭제 롤백이 거래로그에 없는 수동 보유분을 유실하지 않는지(현재 포지션 역산) |
| R8 | **캐시 슬롯 전환** | 장중/장외 슬롯 전환 직후 stale 캐시 표시 안 되는지 |
| R9 | **휴장 폴백 캐시 매핑** | ref-date 매핑은 응답일==요청일 또는 요청일이 비영업일일 때만 저장 — 영업일+장중 미확정에 저장돼 stale 영구 hit 안 되는지 |
| R10 | **날짜 input 모바일 넘침** | `globals.css` 전역 규칙 유지, 신규 날짜 input이 별도 `max-w` 없이 `w-full`로 컨테이너 내 수렴하는지 |

---

## Phase 3 — 산출물

- 발견 이슈를 **P0(데이터 손실/크래시) / P1(기능 오작동) / P2(UX·표시)** 로 분류
- 회귀면 R# 매핑, 신규면 근본 원인·재현 경로(파일:라인) 기록
- 수동 항목(👤) 중 프리뷰로 검증 불가한 것(KIS 실시간 가격, OCR 정확도, 모바일 레이아웃)은 사용자 실행 체크리스트로 전달
- **이 스킬은 진단·보고까지만 수행한다. 코드 수정은 사용자 승인 후 별도로.**

---

## 디자인·코드 규칙 (점검 시 함께 적용)

- 확인·제출 버튼 `Button variant="brand"`, 체크박스 기본 `Checkbox`(자동 brand). 매수=빨강/매도=파랑, 삭제=destructive 의미색만 예외
- 카드 액션 버튼: `Button size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5) 통일
- 목록 표시는 항상 `length > 0`, 비교 키 tickerList는 `.sort()`
- UI/화면 작업 시 `ui-design-guidelines.md`(위계·색상·정보처리·집중도) 병행

---

_최종 갱신: 2026-06-07 · issue-5.1 기준 전체 재작성 (보더리스 UI 구축 및 폼 인지성 강화)_
