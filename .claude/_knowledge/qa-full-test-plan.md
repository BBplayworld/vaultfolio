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

> 이 `F-*` 매트릭스가 **기존 기능의 현행 사양** 역할을 겸한다(별도 명세 문서를 만들지 않는 이유).
> 신규 기능은 [`.claude/specs/`](../specs/) 명세 §6이 지정한 `F-*` 항목을 여기에 추가한 뒤 완료 처리한다.

### F-ASSET. 자산 CRUD (주식·암호화폐·부동산·현금·대출·년도별 순자산)
- ⚙ add/update/delete가 `saveData` 단일 저장 경로 사용, 삭제 후 합계 재계산 ([asset-data-context](../../src/contexts/asset-data-context.tsx) `getAssetSummary`)
- 👤 각 자산 유형 추가→수정→삭제, 순자산/총자산/총부채 즉시 갱신
- 👤 비종목 자산(부동산·대출·현금) 카드 접힘행 왼쪽=`이름 / 비중%`만, 상세 펼침에 종류·매입가(부동산)·금리·금융기관(대출) 노출 — 주식 카드 패턴과 통일
- 👤 주식 보유종목 스크린샷 가져오기 미리보기([stock-screenshot-import.tsx](../../src/app/(main)/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx)) 카드 레이아웃 그리드 정렬 및 증권사 드롭다운 텍스트 짤림 방지 확인
- 👤 주식 스샷 **공통/개별 적용 토글**: 기본 "공통 적용"(카테고리·증권사 1세트 → 전 종목 일괄), "개별 선택" 전환 시 종목별 드롭다운 노출. 공통 카테고리 변경 시 해외↔국내 가격/통화 환산이 개별 변경과 동일한지
- ⚙ `convertStockCategory` 단일 헬퍼로 `updateCategory`·`applyCommonCategory` 환산 로직 일원화(중복 제거), 파싱 직후 다수=해외→`foreign`/그 외 도메스틱·`activeTab` 기준 공통 기본값 설정 + `matchBrokerHint` 증권사 자동 매칭
- 엣지: 0개 상태(웰컴가이드 노출), 단일 항목 표시(`length > 0` 규칙)
- ⚙ **하위 항목(증권사·거래소) 보유 자산의 거래입력 노출 규칙(필수)** — 종합 카드는 `!hasSubItems` 단일 조건으로만 거래입력 행을 숨김/노출한다. 하위 항목이 1개든 여러 개든 존재하면 종합 레벨에서는 항상 숨기고, 하위 항목(`SubStockCard`/`SubCryptoCard`)에서만 노출한다(중복 노출 금지). "병합 대표 id라 편집 불가" 판단(수정 버튼 disabled 등, `effectiveGroupItems.length > 1`)과는 별개 조건이므로 섞어 쓰지 않는다. 하위 항목이 없는 자산(현금·부동산·대출)은 카드 자체가 곧 대상이므로 거래입력 버튼을 항상 노출한다.
- ⚙ **완납 대출(balance=0) 제외(S-4.24)** — `loanSchema.balance`는 0 허용(상환 거래내역으로 도달). `loan-tab.tsx`의 `allLoans`·`asset-report.ts`의 `loanInterest`/`investLoanBalance`가 이미 `balance > 0` 필터라 완납 대출은 목록·비중 바·이자 집계·레버리지 박스에서 자동 제외된다. `getAssetSummary().loanCount`도 동일하게 `balance > 0`만 카운트(`detail-hub` 배지·진입 게이트와 정합, `stockCount`의 `delisted` 제외 선례와 동일 논리)
- 회귀: 부동산 임차보증금(tenantDeposit) 순자산 차감, 대출 잔액 차감

### F-STOCK. 주식 상세 탭 ([stock-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/stock-tab.tsx))
- 👤 종목 카드 펼침/접힘, 증권사별 분할(`SubStockCard`)·나누기 다이얼로그, 주식담보대출 연결 표시 — 종합 카드 거래입력 노출 규칙은 F-ASSET 참조(암호화폐와 동일)
- 👤 비활성: 상장폐지(red)·거래정지(amber) Badge, delisted 평가 제외 / halted 마지막가 유지
- 👤 요약 헤더 평가손익·'오늘' 칩(장중 `오늘`/장 종료 후 `종가`), 해외 상세 환차손익(금액/수익률 2줄, 우측 매입환율 영역 미침범)
- ⚙ **'오늘' 등락 칩 장중/종가 기준(#4.73, #134 — 2026-08-27 실시간화 대체)**: `today-chip.ts` `getTodayChipSession`(시장·시각·휴장 → `live`/`afterCloseGap`/`closed` + 종가일 쌍, 순수 함수)·`computeTodayChip`. 장중(국내 한국 영업일 09:00~15:30 / 미국 현지 영업일 정규장 KST 23:30~06:00, 서머타임 22:30~05:00) 라벨 `오늘` = 현재가 ÷ 전 거래일 종가, 그 밖 `M/D 종가` = 마지막 거래일 종가 ÷ 그 전 거래일 종가(미국은 현지 거래일, **현재가 미사용**). 마감~컷오프(국내 15:30~16:00, 미국 마감+1h)는 `AFTER_CLOSE_GAP_CONFIRMED` 미확인이라 국내 `오늘`(현재가 ÷ 전 거래일 종가), 미국 숨김(`AFTER_CLOSE_GAP_FALLBACK_LIVE`). 두 거래일 종가를 못 구하면(응답 종가일 ≠ 기대 거래일, 휴장 명목일) **칩 숨김 — 0.0% 금지**. 종목 칩 = 현지 통화 가격 등락률(환율·기기 환율 이력 무관), 헤더 칩 = 원화 평가액(현재 환율) 가중, 라벨은 하나라도 장중이면 `오늘` 아니면 `종가 기준`(라벨 정본 `TODAY_CHIP_LABELS`). 칩 쿼리는 설정 '기간 수익 종가 기준'과 무관하게 `kstAccessDay`(기존 캐시 변형). 기본 분기 `computeDailyStockProfit`(자산 변화 Hero·일 탭·스냅샷·성적표·홈) 무변경. 시각표 vitest `today-chip.test.ts`. 알려진 숨김 구간: 국내 휴장일 16:00~다음 개장, 미국 휴장 다음 날 KST 07:00~23:30, 미국 종목 일·월 KST 00~07시
- ⚙ **휴장 구간 칩 보강·헤더 부분 합산 숨김(#4.73 U7)** — profit `daily&kstAccessDay` 응답 선택 필드 `chipPair`(서버 시각 칩 세션 closed·쌍이 다를 때만, 실제 종가일 = 요청일만, 실패면 생략·CDN 헤더 없음, 평일 정상 시각 KIS 추가 0). 클라이언트는 `chipPair` 쌍 = 지금 세션 쌍일 때만 사용(live·gap 분기 불변). 헤더 칩: 칩 대상 종목 응답 미수신 또는 응답 non-null 대상 시장에 칩 0이면 숨김(미국 마감 직후 1h 혼합 보유·429 부분 응답 → 숨김), 거래정지·일본·기준가 null은 숨김 안 만듦. 데이터 안전: 구 캐시(필드 없음) → 숨김, 새 캐시 → main 코드 무시·오류 0, 요청 URL 불변. 자동: `today-chip-u7.test.ts`·`profit/__tests__/route-chip-pair.test.ts`
- 👤 **시장과 비교 진입 = 상세·주식 도구 타일(#4.83, 옛 #4.73 U5 요약 안 글줄 대체)** — 요약 박스 바로 아래 `stock-tools` 묶음의 `stock-market-entry` 타일: `1주 코스피 −x% · S&P 500 −y%`(320·375는 첫 시장만, sm↑ 전부) = 시장과 비교 페이지 1주 지수 문자열(국내만·미국만·둘 다), 비교할 종목 0(해외형 ETF만)이면 타일 없음, 지수 실패 `지수와 나란히 보기`, 인증카드에 없음. 요약 박스 안 글줄(`stock-market-entry-wrap`) DOM 0. 자세한 사양은 F-STOCK-ENTRY
- ⚙ **시작 직후·리셋 때 칩 재조회(#4.73 D2, #138)** — `dataResetVersion` 변화(시작 시세 동기화·데이터 삭제·불러오기) 때 `cancelThenRefetchProfit`: `cancelQueries(["profit"])` 뒤 `invalidateQueries({refetchType:"active"})`. 앱 로드 후 0·0.5·1·2초에 상세·주식에 들어가도 동기화가 끝나고 몇 초 안에 칩 수 = 20초 대기 진입과 같음, `등락률 순`이면 칩 도착 후 재배열, 화면에 없는 이전 키는 재조회 0
- 👤 **`등락률 순` 정렬(#4.73 U6, `stock-sort`)** — 카테고리 줄 오른쪽(줄 수 +0) `평가금 순`(기본)/`등락률 순` 2개, 토글 없음. 등락률 순 = 종목 칩 값(소수 1자리) 높은 순·부호 그대로, 칩 없는 종목 맨 뒤(평가금 순), 동률 평가금 순, 기준가 다 받기 전엔 평가금 순. 비중 막대·인증카드 순서 불변. 선택은 모듈 메모리(새로고침 기본값, 저장 키 0), 카테고리 바꿔도·비교 페이지 왕복해도 유지. 아이콘형(히트 40×40)은 `평가금 순`일 때만 360 미만 또는 7칸·400 미만, `등락률 순` 선택 중엔 폭 무관 라벨 `등락률 순 ⌄`(qa D1·ui r2), 320·375 × 7칸 가로 넘침 0, 히트 40px. 자동 `stock-sort-rate.test.ts`
- ⚙ `computeStockMetrics`·`mergeStockGroup`·`groupStocksByTicker` 동일 ticker 병합(1회 집계)
- 엣지: 해외주식 원화/달러 평단 입력 분기, 환차익 계산
- ⚙ **320 주식 행(#4.49)** — 억 단위 손익에서 `stock-row-left`/`stock-row-right` 겹침 0·가로 스크롤 0, 375 일반 행 높이 불변, screenshotMode(웰컴·인증카드) 클래스 불변
- 회귀: delisted 종목이 stockCount·stockCost·환차익에서 제외

### F-TRADE. 주식 거래내역 (매매 로그) ([trade-input.tsx](../../src/app/(main)/_components/forms/trade/trade-input.tsx) · [stock-trades-view.tsx](../../src/app/(main)/_components/views/detail/trades/stock-trades-view.tsx))
- ⚙ **체결일 기본값·max = KST 오늘(#4.35, `todayKst()`)** — KST 00:00~08:59에도 전날이 아닌 오늘. 현금·대출 입력과 같은 함수. 기존 저장 날짜는 보정하지 않음(`src/lib/__tests__/today-kst-inputs.test.ts`)
- 👤 거래 입력(매수/매도), 반영 ON/OFF, 반영 후 예상 포지션 인라인 미리보기(`PositionChangePreview`), 중복 거래 인라인 확인
- 👤 **반영할 자산 항목 직접 선택(#4.29)** — 카테고리·종목 선택 후 그 종목의 **전체 보유 항목**(카테고리 필터 무관)을 `StockTargetPicker` 카드(타입 배지·증권사·수량·평단)로 고른다. 증권사 Select·`resolveMatch` 자동 라우팅은 제거(같은 증권사 안 IRP·ISA·연금저축 구분 불가 문제). 후보 1개면 자동 선택. **신규 자산 등록**(매수만) = 증권사+주식 타입 선택 → 종목 메타 복제·포지션 0 초안(`NEW_STOCK_ID` 자리표시)으로 미리보기 후 `addTransactionsBatch([tx], [], [newStock])` 저장, 반영 강제(체크박스 비활성)·중복 검사 생략. 매도로 바꾸면 신규 선택 해제. 상세 진입(`lockedStock`)은 종전대로
- 👤 거래 삭제 → 미반영 즉시삭제 / 반영 롤백 다이얼로그
- ⚙ `trade-utils`: 가중평균 평단·환율, 매도 차감, 미반영 스킵, **역산 롤백(수동 보유분 보존)**, `findDuplicateTransaction`, `pruneTransactions` 3년 롤링
- ⚙ `validate-reflection`: oversell/중복반영 restrict, manual_override/backdated confirm
- 엣지: 수동 보유분+반영거래 삭제 시 보유분 보존(P1 회귀), 전량매도 평단 0, 보유초과 매도 차단, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 저장(stale-closure 방지)

### F-STOCK-PAGE. 종목 한 장 (`#detail/stocks-item`, #4.81 #157, [stock-page-view.tsx](../../src/app/(main)/_components/views/detail/stock-page/stock-page-view.tsx))
- 👤 진입 2곳: 상세·주식 펼침 이름 줄 전체(`stock-page-entry`, #4.83에서 `종목 보기 ›` 링크 대체 — F-STOCK-ENTRY) → 누른 행 그룹으로 열림(뒤로 라벨 `주식`) / 성과 › 시장 비교 종목 줄 탭 → 전체 그룹(뒤로 라벨 `뒤로`, 지수 줄은 눌리지 않음). GA `page_title=상세·주식·종목` 1회, 해시·page_title·page_location에 종목명·티커 0
- 👤 머리: 평가·내 수익 금액(%)이 누른 행·펼침 값과 문자열까지 같음(총 N주는 종목 한 장 머리만 — 상세·주식 펼침 `총 N주`는 #4.83에서 삭제, 수량 정본 = 접힌 행·증권사별 항목)(전체 탭·계좌 필터 탭·KRW/USD 토글), 라벨 `내 수익`(머리에 `등락` 없음) / 차트 머리 `1년|5년 주가 등락`(`수익` 없음)
- 👤 가격 흐름: 1년 일봉 기본·5년은 탭 시 조회(탭 전 요청 0), 요청 URL 키 `ticker`·`range`뿐. 평단선 `내 평단 {가격}` = 펼침 평단(합산), 범위 밖이면 `data-clamped=up|down`·`↑/↓`, 평단 0이면 선 없음. 매수 점은 거래 기록 buy만(purchaseDate 점 없음), 점 탭 → `{날짜} 매수 N주 · 거래 단가`, 같은 점·빈 곳·기간 전환 시 해제
- ⚙ **C76 6구간**(`stock-page-view.test.tsx`): ① 거래 0 → 점 0·`stock-page-no-trades` ② 증권사 2곳 → 합산 평단선·두 계좌 점 ③ 1년 밖 → `stock-page-outside` N건·`5년에서 보기`(5년은 텍스트) ④ 분할 전 매수 → 점 y=봉 종가·탭 시 원단가 ⑤ 상장 1년 미만 → 정의 줄 `상장 이후 기간만 있어요` ⑥ 비상장·티커 없음·상장폐지 → `stock-page-no-price`·요청 0
- 👤 뒤로 체인: 종목 한 장 → 거래내역(`거래내역 N건`) → 뒤로 → 종목 한 장 → 뒤로 → 상세·주식 / 시장 비교 → 종목 한 장 → 뒤로 → 시장 비교. 새로고침·직접 URL·그룹 종목 삭제 → 상세·주식(오류 0, 단 새로고침 시 해시 진입 page_view는 가드로 상세·주식만 기록)
- 엣지: 상태 4종(로딩·정상·오류 `다시 시도`·가격 없음) 차트 박스 높이 동일, 320·375·1280 가로 넘침 0, 라이트·다크. 인증카드 3종·시장 비교 표 계산·저장 키 diff 0
- ⚙ API: `price-history` 라우트 `range=2y`/없음/티커 없음 400, 허용 밖 쿼리 무시, 성공 CDN 헤더·실패 no-store·예산 초과 503·외부 호출 0, 페이징 250행 3회(`price-history*.test.ts`)

### F-CASH-TX. 현금 입출금 거래내역 ([cash-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx) · [cash-tx-view.tsx](../../src/app/(main)/_components/views/detail/cash-tx/cash-tx-view.tsx)) — 명세 [S-4.22](../specs/4.22-cash-transactions.md)
- 👤 현금 카드 "입출금 기록/내역" 진입 → 입금/출금(입금 시 정기·비정기 토글)·반영 ON/OFF·반영 후 예상 잔액·중복 인라인 확인. 로그 뷰 총입금·총출금·순유입 통계, 기간·유형 필터
- 👤 반영 거래 삭제 → 잔액 역가감 확인 다이얼로그 / 미반영 즉시 삭제
- ⚙ `cash-tx-utils`: `pruneCashTransactions`(3년 롤링)·`findDuplicateCashTx`(계좌·날짜·금액·유형)·`reflectedBalanceDelta`(반영분만)·`isCashWithdrawalValid`(출금초과 가드). `cash[].balance`는 진실원본 — 로그 추가/삭제해도 balance 단일 저장으로만 변경
- ⚙ 단일 저장 `addCashTransactionWithBalance`/`deleteCashTransactionWithBalance`(로그+잔액, stale-closure 방지, R4 대칭)
- 엣지: 출금 반영액>잔액 차단, 미반영 로그는 잔액 무변경, 미래·보존기간(3년) 밖 날짜 차단, 통화(USD·JPY/100) 환산
- ⚙ **날짜 필드 KST 기준(2026-08)** — 기본값·`max`(`todayStr`)이 `Date.now() + 9시간` 기준(구 UTC 자정 기준은 KST 00~09시에 오늘 날짜 선택 자체가 불가능했고, 기록된 거래가 하루 전으로 저장돼 F-ACTIVITY 원인분해 `income` 집계에서 누락되는 부작용도 있었음)
- 회귀: 공유 토큰 `parts[12]` 왕복·`caIdx` 재연결·구버전 파싱(R3), 사용자 편집 신호(`saveData`→`ASSET_USER_EDIT_EVENT`)로 push(R14)

### F-LOAN-TX. 대출 상환/추가 대출 거래내역 ([loan-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-tx-input.tsx) · [loan-tx-view.tsx](../../src/app/(main)/_components/views/detail/loan-tx/loan-tx-view.tsx)) — 명세 [S-4.24](../specs/4.24-loan-transactions.md)
- ⚙ **날짜 기본값·max = KST 오늘(#4.35, `todayKst()`)** — 주식·현금 입력과 동일 기준
- 👤 대출 카드 "상환/대출 기록·내역" 진입 → 상환/추가대출 토글·반영 ON/OFF·반영 후 예상 잔액·중복 인라인 확인. 로그 뷰 총상환·총추가대출·순상환 통계, 기간·유형 필터. 전역 "자산 업데이트" 플로팅 버튼의 대출 선택 → "상환/대출 기록"에서도 동일 폼 진입(대상 미지정, 폼에서 대출 직접 선택 — 현금과 대칭)
- 👤 반영 거래 삭제 → 잔액 역가감 확인 다이얼로그 / 미반영 즉시 삭제
- ⚙ `loan-tx-utils`: `pruneLoanTransactions`(3년 롤링)·`findDuplicateLoanTx`(대출·날짜·금액·유형)·`reflectedLoanBalanceDelta`(반영분만)·`isLoanRepaymentValid`(상환초과 가드). `loans[].balance`는 진실원본 — 로그 추가/삭제해도 balance 단일 저장으로만 변경. 대출은 통화 필드 없음(항상 KRW) — `cashTransactionSchema` 대비 `currency`·`recurring` 필드 없음
- ⚙ 단일 저장 `addLoanTransactionWithBalance`/`deleteLoanTransactionWithBalance`(로그+잔액, stale-closure 방지, R4 대칭)
- ⚙ **완납(balance=0)·재활성화** — 상환으로 잔액이 정확히 0이 되면 `loan-tab.tsx`의 `allLoans`(`balance > 0` 필터)에서 자동으로 빠지고, 별도 "완납된 대출" 요약 목록(비중 바·이자 집계 미포함, 이름·"완납" 배지·내역/기록 버튼만)에 노출. 그 목록의 "기록"에서 추가 대출(반영 ON, `+amount`)을 남기면 `balance > 0`으로 복귀해 `allLoans`에 재노출(별도 재활성화 로직 없이 필터 재평가만으로 성립)
- ⚙ **원인분해 `debt` cause 정확화(예측 경로 한정)** — 정밀(bothEnriched) 경로의 `debtEffect`는 스냅샷 `breakdown.loans` 델타라 이미 정확해 미변경. 예측 경로의 `estimatePeriodInflows`는 `loan.startDate` 기반 **신규 대출만** 포착해 기존 대출의 기간 내 상환을 놓쳤다 — `reflectedLoanFlow(assetData, from, to)`(통화 무관, `reflectedCashInflow`/`reflectedTradeFlow`와 동형)로 보강. 신규 대출이면서 동시에 반영 거래도 있는 경우 이중계산 방지를 위해 `estimatePeriodInflows`가 해당 대출을 `loanTxLoanIds`로 skip(`tradedStockIds` 패턴 미러링). 신규 cause 키는 만들지 않음(기존 `debt` 그대로)
- 엣지: 상환 반영액>잔액 차단, 미반영 로그는 잔액 무변경, 미래·보존기간(3년) 밖 날짜 차단
- 엣지: **신규 대출 등록은 잔액 0을 거부**(`loan-input.tsx` 폼 레벨 가드, `!editData && balance<=0`) — 완납은 상환 거래내역으로만 도달해야 하며, 등록 즉시 완납 상태로 생성되는 것을 방지(수정은 허용, 상환 반영으로 0 도달 가능)
- 회귀: 공유 토큰 `parts[13]` 왕복·`loanIdx` 재연결·구버전 파싱(R3), 사용자 편집 신호(`saveData`→`ASSET_USER_EDIT_EVENT`)로 push(R14), **R27**(`loanCount`≠존재 여부 — 아래 참조)
- 자동: `src/lib/__tests__/loan-tx-utils.test.ts`(prune·중복탐지·잔액델타·상환초과 가드), `src/lib/report/__tests__/asset-report.test.ts`(예측 경로 단독 상환 포착·신규대출+반영거래 이중계산 방지 2건)

### F-CRYPTO-TX. 암호화폐 매수/매도 거래내역 ([crypto-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx) · [crypto-tx-view.tsx](../../src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx)) — 명세 [S-4.25](../specs/4.25-crypto-transactions.md)
- 👤 코인 카드(병합·거래소별 하위 카드) "매수/매도 기록·내역" 진입, "자산업데이트" 플로팅 버튼(코인 선택) → "매수/매도 기록"에서도 동일 폼 진입(현금·대출과 동일 동선). 폼: 코인 선택·매수/매도 토글·수량·체결단가·날짜·메모·반영 ON/OFF·반영 후 예상 포지션 인라인 미리보기·중복 인라인 확인. 로그 뷰 총매수·총매도 통계, 기간·유형 필터
- 👤 반영 거래 삭제 → 포지션 롤백 확인 다이얼로그(수량·평단 변화 표시) / 미반영 즉시 삭제
- ⚙ **계산 엔진은 잔액 선형 가감(현금·대출)이 아니라 수량×평단 가중평균** — `trade-utils.ts`를 새 유틸 파일 없이 재사용(`computeNewPosition`/`recomputeFromLog`/`reverseTransaction`/`deriveBaseSnapshot`/`rollbackTransaction`/`pruneTransactions`/`findDuplicateTransaction`을 `TxLike`/`PositionLike` 구조적 타입으로 일반화, `validateReflection`도 동일). 삭제 시 단순 산술 역가감이 아니라 `rollbackTransaction`(거래로그 전체 재적용)으로 재계산
- ⚙ 단일 저장 `addCryptoTransactionWithPosition`/`deleteCryptoTransactionWithPosition`(로그+포지션, stale-closure 방지, R4 대칭)
- ⚙ 종합 카드는 하위 항목(거래소) 존재 시 `!hasSubItems` 조건으로 기록/내역 버튼을 항상 숨김(1개 거래소만 지정된 경우도 포함) — 개별 거래소 하위 카드(`SubCryptoCard`)에서만 기록. 주식(F-STOCK)과 동일 규칙
- ⚙ 원인분해 `buy:crypto`/`sell:crypto`가 `reflectedCryptoFlow`(반영된 실제 거래) 기반으로 정확화 — 이전엔 스냅샷 원가 델타 추정치였음. 예측 경로 `estimatePeriodInflows`는 `tradedCryptoIds`로 반영 거래 있는 코인을 매수일 추정에서 제외(이중계산 방지, `tradedStockIds` 패턴)
- 엣지: 초과매도 반영 차단, 미반영 로그는 포지션 무변경, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: 공유 토큰 `parts[14]` 왕복·`crIdx` 재연결·구버전 파싱(R3), 사용자 편집 신호(`saveData`→`ASSET_USER_EDIT_EVENT`)로 push(R14)
- 자동: `src/lib/__tests__/trade-utils.test.ts`(코인 구조적 타입 재사용 2건), `src/lib/report/__tests__/asset-report.test.ts`(정밀/예측 분기 buy:crypto 정확화·이중계산 방지 2건)

### F-TAX. 세금 신고 안내 ([tax-calendar-view.tsx](../../src/app/(main)/_components/views/tax/tax-calendar-view.tsx)) — 명세 [S-4.23](../specs/4.23-tax-calendar.md)
- **홈 배너는 F-HOME-TIP으로 통합됨(S-4.32 후속)** — 아래는 `#tax` 캘린더 화면 자체의 사양.
- ⚙ **자산 파생 항목 판정**(AC2): `getAssetDrivenHighlights`는 `common`(연말정산·건강보험료) 전용 항목을 제외한다.
- ⚙ **월 단위 dismiss**(AC4): `STORAGE_KEYS.taxNotice` = `{ dismissedMonth: "YYYY-MM" }`(KST). 같은 달 재방문 미노출, 달이 바뀌면 재노출
- ⚙ **태그 매칭**(AC1): 상가(`realEstate.type==="commercial"`)→business, 부동산 보유→realestate, `category==="foreign" || currency!=="KRW"`→foreign, irp/isa/pension→pension, `mortgage-home`→loan, 현금 보유→cash
- ⚙ **해외주식 실현차익**(AC6·AC7): `computeForeignRealizedGain`이 거래 로그를 날짜순 replay(`computeNewPosition` 재사용)해 당해 매도분 손익을 KRW 통산. 250만원 초과 시 이듬해 5월 신고 대상 표기. 매수 로그·체결 환율 누락 시 현재 평단·환율 폴백 + "추정" 표기. 거래 로그 없거나 당해 매도 0건이면 `null`(미표시). 국내주식(KRW)은 집계 제외
- 👤 **캘린더 뷰**: `내 세금`/`전체` 필터, 현재 월 강조·자동 스크롤, 카드 `Collapsible` 상세, 하단 면책 문구 항상 노출
- ⚙ **이번 달 정렬(#4.92)**: 세금 화면 이번 달 섹션은 마감 지난 항목(`dueEndDate` < 오늘)을 아래로(`sortPastDueLast`, 12/16 첫 카드 ≠ 종부세, 12/31 당일은 지남 아님). 새 칩·문구 없음
- ⚙ **홈 배너 정렬·마감 필터(#4.29)** — `getAssetDrivenHighlights`는 **이번 달 우선 → 같은 달 내 high 우선**(종전 severity 우선이라 다음 달 high가 이번 달 일정을 밀어내던 문제). 이번 달 항목 중 `dueLabel` 마지막 `M/D`(`dueEndDate`)가 오늘보다 이전이면 제외, 날짜 없는 라벨("2월 급여"·"시행 예정")은 월말까지 유지
- 엣지: 12월 → 다음 달 1월 롤오버, 같은 달 내 `high` severity 우선 정렬, `전체` 모드에서 비해당 항목 `opacity-60`
- 회귀: `#tax` 직접 진입 복원 · 뒤로가기는 `history.back()`으로 진입 경로(홈/더보기) 복귀 · 백업 복원·동기화 pull 후에도 dismiss 유지(`asset-storage.ts` keepKeys) · sync payload 미포함(R14 핑퐁 없음)

### F-TAX-SIM. 연말 절세 시뮬레이션 ([tax-year-end-simulator.tsx](../../src/app/(main)/_components/views/tax/tax-year-end-simulator.tsx)) — 명세 [S-4.31](../specs/4.31-tax-sell-simulation.md)
- 👤 **진입 경로 1곳으로 통합**: 상세 허브 하단 `detail-hub-tax-row`(4.89, 더보기에서 이동; 보조줄 `detail-hub-tax-sub`=내 자산 파생 일정 1건·임박 0~6일만 날짜 주황·없으면 기본 문구·인증카드 숨김, 체험 진입 가능, `#tax` 활성 탭=상세) → 최상단 `InlineSelector`로 "세금 일정관리"/"**절세 시뮬레이션**" 전환. 개별 주식 카드의 진입 버튼은 없음(전량 제거, 이 화면 하나로 통일). **탭 영역은 `sticky top-0`로 고정**(2026-08-27) — 마운트 시 이번 달로 자동 스크롤돼도 탭 전환이 항상 화면에 보임
- ⚙ **null 게이팅 제거**(회귀 방지 핵심): `getYearEndTaxSimulation`은 당해 매도 거래가 없어도(`computeForeignRealizedGain`이 `null`이어도) `baselineGainKrw=0`으로 계산해 **항상** 후보 목록을 반환한다. 보유 해외주식이 1건도 없을 때만 "보유 중인 해외주식이 없습니다" 빈 상태 — 모든 훅(`useMemo`/`useState`)이 이 조기 return **이전에** 호출되므로 Rules of Hooks 위반 없음. 빈 상태 스타일은 2026-08-28에 앱 공통 empty-state 패턴(`border border-dashed`+`h-36`+`items-center justify-center`, `stock-tab.tsx`/`crypto-tab.tsx`/`cash-tab.tsx` 등과 동일)으로 통일 — 기존엔 `bg-muted/30 p-6 rounded-xl`로 이질적이었음
- ⚙ **후보는 증권사가 아니라 티커 기준으로 종합**(2026-08-27 수정, dev-rules.md "주식 계산·집계는 항상 종목 기준" 참조): 동일 종목을 여러 증권사에 나눠 보유해도 `groupForeignStocksByTicker`(내부, `asset-detail-tabs.tsx`의 `groupStocksByTicker`/`mergeStockGroup`과 동형 로직 — 수량 합산, 평단·매입환율 수량 가중평균)로 병합한 뒤 후보 1건만 노출. 증권사별로 나눠 세액을 따로 계산하던 이전 버그 수정
- 👤 **체크박스 + 버튼 전용 입력**(텍스트 입력 없음): 종목 `Checkbox` 선택 → 기본 "전량" 프리셋, 이익 종목이면 "한도까지 (N주 · 비과세)"(잔여 공제 한도를 정확히 채우는 수량) 프리셋 칩, `±1` 스테퍼 + **`±5`/`±10` 버튼**(2026-08-27 추가, 보유수량이 각 임계값을 넘는 종목에만 노출)로 수량 조정
- ⚙ **후보 목록 계산**(`getYearEndTaxSimulation`): 보유 해외주식을 티커 기준 종합 후 전량 매도 가정으로 손익 계산(원가는 replay 없이 `Stock.averagePrice` 그대로), 손실 큰 순 → 이익 큰 순 정렬. 매입 환율 없으면 현재 환율 폴백 + "(추정)" 배지
- ⚙ **선택 시뮬레이션**(`simulateSelectedForeignSale`): 선택 없음(빈 배열)도 유효 입력 — baseline만으로 항상 결과를 반환한다. 체크된 종목(티커 종합 id, 부분 수량은 선형 계산)을 당해 실현손익과 합산해 250만원 공제 적용 후 22% 세액 산출
- 👤 **상단 통합 결과 박스**(2026-08-28, `sticky top-28` 고정 — 스크롤과 무관하게 항상 보임): "예상 양도소득세"(`text-3xl` 큰 숫자, 선택이 없어도 baseline 기준 세액을 항상 표시) + 하단에 3개 보조 수치를 한 줄로:
  - **{year}년 실현손익**(`sim.baselineGainKrw`) — 이미 확정된 매도 합계라 **선택과 무관하게 고정**
  - **잔여 공제 한도** — `FOREIGN_CAPITAL_GAIN_DEDUCTION - result.combinedGainKrw`(0 미만이면 0)로 **선택할 때마다 즉시 갱신**. 클램프 없이 그대로 뺀다 — `combinedGainKrw`가 음수(순손실)면 한도가 250만원보다 커지는 게 정상 손익통산(2026-08-28, 아래 버그 수정과 동일 원리)
  - **합산 손익**(`result.combinedGainKrw`) — `text-foreground font-medium`으로 강조
  - (과거엔 최상단 baseline 박스와 최하단 "선택 시 예상 세액" 박스가 분리돼 있었으나 정보 중복이라 **하나로 통합**하고 최상단으로 이동)
- ⚙ **"한도까지" 종목별 실시간 재계산 — 손익통산 미반영 버그 수정(2026-08-28)**: 손실 종목(예: 비트마인·DIREXION TSLA 2X)을 먼저 체크한 뒤 대형 이익 종목(예: 엔비디아)의 "한도까지"를 보면, 이미 선택된 손실만큼 한도가 늘어야 하는데 그대로였던 버그를 재현·수정. 원인은 두 곳의 "잔여 한도 = `Math.max(DEDUCTION - Math.max(baseGain,0), 0)`" 공식이 baseGain(기준 손익)이 **음수일 때도 0으로 클램프**해 손익통산 효과를 지워버린 것(`getYearEndTaxSimulation`의 `remainingDeductionKrw`·`rebuyQuantity` 둘 다) — 내부 클램프를 제거해 `Math.max(DEDUCTION - baseGain, 0)` 하나로 정리(신규 export `computeRebuyQuantity`). `tax-year-end-simulator.tsx`는 종목별 행마다 **"이 종목을 제외한 현재 선택 전체 + baseline"**을 baseGain으로 넘겨 매 렌더 재계산 — 정적 `candidates[].rebuyQuantity`(선택 0개 기준 초기값)를 그대로 쓰지 않는다.
- 👤 **재매수 절세 팁 문구 축약**(2026-08-27): 종목별로는 "한도까지" 칩 라벨에 "· 비과세"만 표기, 별도 설명 문장은 없음(하단 면책 문구로 통합)
- 👤 **하단 면책 문구**(2026-08-28 재정리): `"한도까지" 수량은 현재 선택된 다른 종목의 손익까지 반영해 계산됩니다. 참고용 추정치이며 실제 세액은 세무 전문가 확인이 필요합니다.` — 위 버그 수정으로 실제로 다른 선택을 반영하게 됐으므로 문구도 그에 맞게 정정(이전엔 "무관하게 계산"이라고 돼 있어 수정 후엔 오히려 틀린 문구가 됨)
- 👤 시뮬레이터 조작은 `assetData` 변경 없음(순수 계산)
- ⚙ **통화 표기**: `formatCurrency`는 반드시 `@/lib/number-utils`(KRW 포맷)를 import — `@/lib/utils`의 동명 함수는 기본 USD/`en-US`라 "250만원"이 "$2,500,000"로 잘못 표시되는 회귀가 있었음(2026-08-27 수정, `tax-calendar-view.tsx`도 동일 버그 함께 수정)

### F-TRADE-SS. 거래 스크린샷 가져오기 ([trade-screenshot-import.tsx](../../src/app/(main)/_components/forms/trade/trade-screenshot-import.tsx) · 코인 [crypto-trade-screenshot-import.tsx](../../src/app/(main)/_components/forms/trade/crypto-trade-screenshot-import.tsx))
- 👤 스크린샷 업로드→인식→선택 등록, 다종목 일괄(`addTransactionsBatch`/코인은 `saveData`)
- 👤 **주식: 거래마다 반영할 자산 항목 직접 선택(#4.29)** — 전역 증권사 Select·`resolveMatch`/`MatchInfo` 자동 라우팅 제거. 후보 = 티커 일치 → 정규화 종목명 일치 → (티커 미인식 시) 보유 종목명 유사 일치(`findClosestNames`, OCR 오타). 기본값: 후보 1개(정확 일치)면 자동 선택, 2개 이상·유사 일치는 미선택+안내, 미보유 매수는 "신규 자산"(인식 증권사·국내/해외 프리필). 각 행에 `StockTargetPicker` + 체결일 오름차순 누적 `PositionChangePreview`(반영 OFF+기존="거래내역에만 기록"), 보유 초과 매도는 경고+등록 차단. 신규 자산은 (종목·증권사·타입) 단위로 묶어 1개 생성(보유 후보가 있으면 메타 복제). **코인**: 미보유 매수 인식 시 자동 신규 등록(상단 거래소 select 필수), 반영 ON/OFF와 무관하게 항상 포지션 생성, `currentPrice`는 체결가로 임시 채움
- ⚙ **종목명 OCR 오타 보정(#4.29)** — `lookupTicker`([ticker-map.ts](../../src/app/api/parse-screenshot/ticker-map.ts)) 단계: exact → prefix(잘린 이름 우선) → **국내 오타 보정**(`name-match.ts` 편집거리, 길이<6 금지·<12 ≤1·이상 ≤2, **유일 최근접만**) → 오타 후보가 2개 이상이면 suffix·substring 추정 금지("") → US. 회귀 테스트 [ticker-lookup-kr-etf.test.ts](../../src/lib/__tests__/ticker-lookup-kr-etf.test.ts)가 국내 ETF 전 종목 정확명 100%·오타 시뮬레이션 오매칭 0건을 고정(잘린 이름과 구별 불가 2건은 제외 집계)
- 엣지: 통화 KRW/USD 분기, 중복 거래 처리, **매도인데 미보유면 계속 매칭 실패로 차단**(신규 등록은 매수만 허용 — 팔 종목이 없는 매도 신규 생성 금지), 코인 신규 등록 시 거래소 미선택이면 등록 차단

### F-CRYPTO. 코인 시세 자동 갱신 (업비트) ([upbit-service.ts](../../src/lib/finance/upbit-service.ts) · [api/finance/crypto](../../src/app/api/finance/crypto/route.ts)) — 명세 [S-4.20](../specs/4.20-upbit-crypto-price.md)
- ⚙ **1시간 슬롯**([coin-cache-slot.ts](../../src/lib/finance/coin-cache-slot.ts) `getCoinCacheSlot`): 코인은 24시간 무휴장이라 주식과 달리 장중/장외·영업일·DST 판정 없이 **항상** `{YYYY-MM-DD}-H{HH}`(KST). `c.baseDate === slot`이면 재조회 스킵(AC1·AC2)
- ⚙ **공통 캐시**: 서버 키가 마켓 단위(`finance:coin:KRW-BTC`, 2026-08 슬롯 접미 제거·market 레코드 1개로 통합)라 같은 코인 보유자끼리 캐시 공유 → 외부 호출이 슬롯당 1회로 수렴(AC3)
- ⚙ **market 레코드 1개로 신선/stale 겸용(2026-08)** — 과거엔 `finance:coin:{market}-{slot}`(슬롯 캐시)와 `finance:coin:last:{market}`(3시간 stale 폴백)를 별개 키로 둬 `setCoin` 1회 호출이 SET을 2번 날렸다. 지금은 `{value, slot, updatedAtMs}` 레코드 하나(TTL 3시간)로 합쳐 `getCoin(market, slot)`은 `slot` 일치로, `getCoinStale(market)`은 레코드 존재(=TTL 이내)로 같은 레코드에서 판정 — SET 1회로 축소(`cache-storage.ts`). 파일 캐시도 `COINS` 단일 버킷(구 `COINS_LAST` 폐기)
- ⚙ **캐시 버킷 분리**: 파일 캐시는 `COINS`를 `STOCKS`와 분리 — `writeFinanceCache` prune이 주식 유효일 문자열 매칭이라 같은 버킷이면 코인이 매 write마다 삭제됨. Upstash도 `finance:coin:` 접두 분리(`finance:stock:` SCAN 정리와 충돌 방지)
- ⚙ **rate limit 방어**(업비트 IP 기준 10 req/s의 20%만 사용): 슬롯 캐시 → stale(3시간) 즉시 반환 + `after()` 백그라운드 갱신 → 최초만 동기 대기(AC7). 외부 호출은 `finance:upbit:lock`(SET NX EX 5s)로 직렬화 + 최소 500ms 간격(AC8). 로컬은 단일 프로세스라 모듈 스코프 in-flight dedup으로 대체
- ⚙ **무효 심볼 방어**: `market/all`(1일 캐시)과 교집합 후 조회 — 미상장 심볼이 섞이면 ticker 요청 **전체가 400 실패**하므로 필수. 응답에 없는 심볼은 수동 입력값 유지(AC4)
- ⚙ 심볼 단위 중복 제거 — 같은 코인을 여러 거래소에 보유해도 1회 조회(AC5). epoch+AbortController로 취소된 응답 미반영(AC6)
- ⚙ 429·418 수신 시 재시도 없이 stale 유지 + `X-Upbit-Unavailable` 헤더(AC9)
- 👤 코인 보유 상태로 접속 → 현재가가 업비트 시세로 갱신, 같은 시간 내 재접속 시 외부 호출 없음
- 엣지: 업비트 미상장 코인(해외 거래소 전용) 수동값 보존, 코인 0개일 때 호출 자체 스킵
- 회귀: 코인 시세 갱신(`baseDate`·`currentPrice`)이 push를 유발하지 않는지(R14 — 자동 push는 사용자 편집 신호만), 공유 토큰(packV7) crypto 섹션 8필드 유지(R3)

### F-PHYSICAL. 실물 자산 (#4.55, 이슈 #58) — 분리 키 `secretasset.physical_assets`
- 등록: FAB → 보유 현황 업데이트 → 실물 자산(0건이면 연필 없음) → 폼(종류 5칩·이름·평가액·매입가 선택·매입일·메모, 등록 시 이중 계상 안내). 저장 토스트 "실물 자산을 저장했어요."
- 표시: 허브 카드(1건 이상)·실물 탭(평가액 내림차순, 삭제 마지막 1건이면 허브 복귀)·홈 도넛 "실물" 조각(색 #7a6236, 클릭→실물 탭). 순자산에 합산, 금융자산엔 미포함.
- 데이터: 본 키에 physicalAssets 없음, 구버전 pull·가져오기·저장 후에도 보존, 구 백업 가져오기는 유지+토스트, 복원 코드 미포함 안내, 모든 삭제·공유 반영 시 비움, `/?trial=1` 거부.
- 결산: 평가액 수정=평가 갱신, 등록=내부 이동 풀(출금 ±3일 짝짓기), 월·연 원인 합계=Δ순자산. 실물 0건이면 기존 화면과 동일.

### F-REALESTATE. 부동산 실거래 추정 ([realestate-service.ts](../../src/lib/realestate/realestate-service.ts) · [api/realestate](../../src/app/api/realestate/route.ts)) — 명세 [S-4.21](../specs/4.21-realestate-transaction-price.md)
- ⚙ **데이터셋별 면적 필드**(AC8): apt/offi/rh=`excluUseAr`, sh=`totalFloorAr`, nrg=`buildingAr`, 폴백 `plottageAr`. `areaKind`(exclusive/gross/plottage)가 다른 거래는 **절대 섞어 비교하지 않으며**, 후보 0건이어도 전체 풀로 되돌리지 않는다
- ⚙ **오매칭 차단**(AC9): `matchBy:"area"`(단독 sh·상가 nrg)에서 면적 미상이면 `matchTrade`는 반드시 `null`. 과거 회귀 = 시군구 전체 최근 거래 1건이 추정치로 노출됨
- ⚙ **매칭 점수**: 지번일치 > 단지명 > 법정동 > 면적근접 > 최근성. 면적 허용 오차는 **상대 ±10%(최소 ±3㎡)**. `resolveAddress`의 `jibun`이 estimate 요청까지 전달되는지(누락 시 정확도 급락)
- ⚙ **단가 폴백**(AC10): 같은 법정동·같은 areaKind·±30% 표본의 ㎡당 단가 중앙값 × 내 면적. **표본 3건 미만이면 미노출**. 등급(exact/similar/approx/estimated)·표본수 응답 포함
- ⚙ 조회 창 6→12→24개월 단계 확장, 캐시 슬롯 `${dataset}:${lawd}:${ym}` 재사용
- 👤 아파트: 주소 조회 → 추정가·근거(단지·면적·층) 표시, 상세 카드에 면적 수치 노출. 상가·단독: 면적 입력(㎡/평 토글) 전에는 추정 미노출, 입력 후 등급 배지와 함께 표시
- 👤 토지: 실거래가 조회 기능 없음(지목별 형평 비교·지분 문제로 신뢰 가능한 추정이 어려워 제외) — 시세는 수동 입력만
- 회귀: 실거래 추정 자동 갱신(`marketEstimate*`)이 push를 유발하지 않는지(R14 — `saveAssetData` 직접 호출이라 사용자 편집 신호 없음), 공유 토큰 pack/unpack 포맷 미변경(R3)
- 자동: `src/lib/__tests__/realestate-match.test.ts`

### F-STOCK-ENTRY. 신기능 진입 경로 (#4.83 #161 — 상세·주식 도구 타일·펼침 이름 줄·성과 허브 행·`새`) ([stock-tools.tsx](../../src/app/(main)/_components/views/detail/stock-tools.tsx) · [stock-row-flow.tsx](../../src/app/(main)/_components/views/detail/stock-row-flow.tsx) · [hub-change-rows.tsx](../../src/app/(main)/_components/views/activity/hub-change-rows.tsx))
- 👤 **도구 타일**: 요약 박스와 카테고리 줄 사이 입구는 `stock-tools` 1묶음뿐(요약 안 글줄·`X-RAY 인사이트` 상자·세금 문장 상자 0). 시장 → `change-market`, X-Ray → 타일 값의 축으로 열림(첫 줄 `{항목} … {pct}%` = 타일 값, 소수 1자리), 세금 → 세금 관리 시뮬레이터. 100% 단일 축은 제외하고 다음 축 값을 보임(국내만 보유 시 `한국`·`원화` 100% 대신 `핵심 분야` 등 다음 축, 후보가 없거나 모두 100%이거나 분류 수집 중일 때만 폴백 `분야·지역 비중 보기`). 새 종목 추가 후 진입 시 분류 요청·`주식 X-Ray 분류가 완료되었습니다` 토스트가 지금과 같이 뜸(훅이 타일로 이전)
- 👤 **펼침 이름 줄**: 줄 전체 버튼 1개(≥56px)·`총 N주`·`종목 보기` 텍스트 0, 둘째 줄 `1년 주가 등락 +x%` = 이어서 연 종목 한 장 `stock-page-change`(1년), **(4.84) 아래 전폭 밴드 80px**(1년 종가 + 평단 점선(범위 밖이면 생략) + 가격 눈금 2~3줄 + 현재가 태그 `현재가`·값 = 같은 카드 `현재가` 칸 문자열, 접힌 행·`none` 행 밴드 없음). 로딩·429·티커 없음에서 펼침 높이 변화 ±1px(밴드 80px 동일), 문구 `주가 흐름과 내 평단 보기`/`내 평단 보기`. 분할 종목: 접힌 행 수량 = 증권사별 항목 수량 합
- ⚙ **요청 조건(C2·C79)**: 1년 조회는 펼칠 때만(접힌 행·인증카드 캡처 0), 같은 티커는 쿼리 키 `["price-history", ticker, "1y"]` 1개, 실패 티커는 접었다 펴도 재요청 0(`retryOnMount:false` — 503 3회 재펼침 fetch 1회 테스트), 서버로 나가는 값 `ticker`·`range=1y`뿐
- 👤 **성과 허브 `자산 변화` 행**: 머리(월 결산)와 행 3개(`최근 7일`·`월별 기록 N개월`·`시장과 비교`)가 따로 눌림(중첩 버튼 0, 행 ≥44px). 행 1 `data-value` = 주 탭 `change-hero-delta`·이름 = `week-title`(C76 D 구간: 7·8·9 / 10·14 / 15 기록 부족 / 없음 기록 쌓는 중), 행 2 N = 월별 기록 `모두 보기` 후 gap 아닌 행 수(C84)이고 N<2·첫 달이면 숨김, 행 2 → 월 탭 렌더 후 월별 기록 카드로 1회 스크롤(reduced-motion 즉시)
- 👤 **`새`**: `new-chip` 상세·주식·허브 각 ≤1(상세·주식 = 시장 타일, 허브 = 최근 7일 > 월별 기록 > 시장과 비교), 방문하면 꺼지고 다음 자리로 넘어감, 게시일+30일 후 꺼짐. 홈·헤더·하단 네비·더보기·X-Ray·세금 타일·체험·인증카드 0
- ⚙ 방문 기록: `change-week`는 주 탭이 보일 때(init 진입·탭 전환) 실제 `recordVisit`으로 기록 → 홈 팁 `주간 변화 원인` 추천 순위 하락, `monthly-log`는 카드 50% 이상 보일 때 진입당 1회
- 👤 **새 소식 바로 가기 정정**: 05 바로 가기 없음, 07 → 인증카드 `주식 현황` 탭, 04 → 월 탭 월별 기록 보임. `monthly-log`·`share-card-stock`은 `tip:false`라 홈 기능 팁 후보 0
- 테스트: `stock-entry-tools.test.tsx`·`hub-change-rows.test.tsx`·`entry-paths-483.test.ts`·`market-entry-line.test.tsx`

### F-CHART-AXIS. 주가 차트 눈금·현재가·매도 점·칩 폴백·공통 로딩 (#4.84 #163 #164 — [stock-row-flow.tsx](../../src/app/(main)/_components/views/detail/stock-row-flow.tsx) · [price-chart.tsx](../../src/app/(main)/_components/views/detail/stock-page/price-chart.tsx) · [price-axis-layer.tsx](../../src/app/(main)/_components/views/detail/price-axis-layer.tsx) · [loading-note.tsx](../../src/components/ui/loading-note.tsx))
- 👤 **눈금·현재가(A1~A5)**: 펼친 행 밴드 80px(로딩=성공=실패 동일 높이, 320 플롯 ≥190px, 가로 스크롤 0), 눈금 값 = 간격 {1,2,5}×10^k의 배수(`4만`·`$160`)·2~3줄·평단선·태그와 글자 겹침 0, 선이 최고 눈금 위로 나가지 않음(원본 points 기준), 태그 문자열 = 같은 카드 `현재가` 칸(KRW·USD), 라벨 `현재가`(`오늘` 0), 종목 한 장 1년·5년 같은 가격 칸·x축 라벨 정상
- 👤 **칩 폴백(B1)**: 삼성 5년형에서 칩이 선을 가리지 않음(`stock-page-avg-chip[data-mode]` plot|short|gutter)
- 👤 **매도 점(C1·C2)**: 파랑 마름모/빨강 원(흑백 구분), 같은 봉 둘 다 탭 가능, Tab 날짜순·매수→매도, 매수만 종목 문구 기존과 동일, 매도만·혼합 종목 문구 모순 0(`점을 누르면 매도 기록을…`·`1년보다 전 거래 N건`), 슬롯 높이 점프 0
- 👤 **X·포커스(D1·D2)**: 홈 팁 X 박스 40×40, PC 시트 X `elementFromPoint` 40×40(아이콘 불변), 더보기 경로 Esc 후 `document.activeElement === main`
- 👤 **로딩(E1~E4)**: `/api/finance` 5초+ 지연 375 다크에서 시장 비교·종목 차트·배당에 문구가 스크롤 없이 보임, 300ms 이내 응답은 `loading-note` 미노출, 스켈레톤이 카드와 구분(다크·라이트)·reduced-motion 정지·완료 전후 y 차 0, 구 문구 0(`점검 중`·오류 토스트 불변), `sidebar`·`ratio-preview` 스켈레톤 캡처 이상 없음
- ⚙ 서버 전송 0·저장 스키마 변경 0, 새 소식 `20261111-09`·`-10`(대상 정확 C80)
- 테스트: `stock-page-axis.test.ts`·`stock-page-chip.test.ts`·`stock-page-sell.test.ts`·`stock-page-view.test.tsx`·`stock-entry-tools.test.tsx`·`use-loading-phase.test.ts`·`loading-note.test.tsx`·`whats-new.test.ts`

### F-XRAY. 주식 X-Ray ([stock-xray-view.tsx](../../src/app/(main)/_components/views/detail/xray/stock-xray-view.tsx) · [lib/xray](../../src/lib/xray))
- 👤 6축(핵심분야·**종목 유형**·시가총액·지수·지역·통화) 전환, 분포바·집중도 등급, AI 분류 진행률, 프롬프트 확인·복사
- ⚙ `stock-xray` `computeBreakdown` 단일배정·합 100%, 미분류 처리, 레버리지/인버스 ETF 지수매핑(TQQQ·QLD→NASDAQ100, UPRO·SSO→S&P500)
- ⚙ **종목 유형(`stockType`) 축**(#4.24) — 성장주/**혁신주**/배당성장주/배당주/지수투자/가치주/채권·현금성/기타 8종, `sector`(산업이 뭔가)와 별개 축("투자 스타일"이라 부르지 않음 — 종목 자체의 투자 성격). AI가 업종명 고정관념(예: "유틸리티=배당주")으로 오분류하기 쉬운 대표 ETF·우량주(커버드콜 ETF·배당성장 ETF·배당귀족·전통 은행주·혁신 성장주 등)는 티커·이름 하드코딩 매핑으로 우선 확정(`extractStockType`). `STOCK_TYPE_PROMPT_VERSION`(classification-store.ts)이 서버·클라 캐시 유효성 체크 양쪽에 다 걸려 있어야 하며, 분류 규칙이 바뀌면 이 값을 올려 전체 강제 재분류한다(2026-09-05 한쪽만 걸어서 재분류가 아예 안 나가던 버그 발견·수정)
- ⚙ `fetch-classifications` 캐시 hit 스킵·dedup·스트리밍, 실패 토스트 폴백, `classification-store` localStorage 90일
- 엣지: 전량 미분류 시 "준비 중", 집중도 임계값 0.6/0.35, delisted 가치 0
- 회귀: ticker 병합 후 집계(1회 노출)

### F-ACTIVITY. 성과 (자산 변화·배당·성적표) ([views/activity](../../src/app/(main)/_components/views/activity))
- 👤 **성과 허브 카드 3개(#4.34, 이슈 #32 r2)** — 자산 변화(`hub-card-change`)·배당·자산 성적표. 별도 결산 카드 없음(`settlement-card` 삭제). 자산 변화 카드: 말일−3일~다음 달 10일이고 비교할 직전 월 기록이 있으면 배지 "N월 결산"(`hub-change-settlement-badge`) + 구간 + 증감·% "지난 기록 대비" → 탭 시 월 탭 해당 달(`source=card`), 창 밖이면 "N월 · 진행 중" 증감(`source=menu`), 첫 달·자산 0건이면 금액 없이 "다음 달부터 결산이 열려요". 순자산·전년 대비 표시 없음
- 👤 **자산 변화(`#activity/change`, [asset-change-view.tsx](../../src/app/(main)/_components/views/activity/asset-change-view.tsx))** — 제목 행 h-11 오른쪽 범위 선택(`[role=radiogroup][aria-label=범위 선택]`, 전체/주식) + 각 본문 `change-hero`(이름 → `change-hero-delta` → `change-hero-start`→`change-hero-end` → 기간 선택 `[aria-label=기간 선택]` 일/주/월/연). Radix `[role=tablist]` 없음, 범위 배지 없음. 375×812 전체·월에서 증감 y ≤ 200. 칸·화살표 히트영역 ≥ 40×40, ←/→·Home/End 이동·Tab 1회 이탈, reduced-motion이면 썸 전환 0s. 전체·일/연 = `YearlyNetAssetChart`(`view` 제어 → 제목·"현재 순자산" 숨김, Hero "M/D 기록 대비"/"YYYY년 말 대비"), 전체·주 = (#4.79) Hero `week-title` `최근 7일`(시작 7~9일 전, `week-range` `M/D → 오늘`)/`M/D 이후`(그 외 14일 이내, 구간 없음)·증감은 홈 Hero와 같은 실시간 끝점 + `cause-block[data-scope=week]` 6줄(줄 `data-value` 합 = `change-hero-delta`, |증감|<1만이면 `뚜렷한 변화 원인이 없어요`) + 푸터(`week-records` 기록 내역 N건·`week-market-link` `종목 등락 보기`→시장과 비교 1주, 뒤로 1회 전체·주) + `week-closing-toggle` `날짜별 마감 기록`(기본 접힘·`inert`, 펼치면 `week-row` 7일) / 14일 초과 `week-insufficient` / 기록 0 `week-empty`, 홈 팁 `주간 변화 원인`(`week-causes`, market-compare 앞)·GA `change_week_all`, 전체·월 = 월말 결산, 주식·* = `ProfitCard`(`period` 제어 → 제목·요약 박스 숨김, Hero "하루/1주/1개월/1년 주식 수익"·시장 필터 시 "국내 · …", 조회 중 스켈레톤 `change-hero-loading`, API 점검 시 "점검 중")
- 👤 **자산 변화 › 일 탭(#4.95 #184)**: Hero 제목 `day-title`=`전일 대비`(홈 라벨이 전일 대비일 때 `change-hero-delta` data-value·시작→끝이 홈과 원 단위 일치), `cause-block[data-scope=week]` 줄 합 = Hero 증감, `작년 말 순자산` 문구 0, 기록 없음이면 `day-empty`(홈 7일 카드 문구), 달력 월초 1일 칸 증감 표시·머리 `종가 기준`. 640 미만 홈 7일 막대 값·달력 칸 순자산·증감 `원` 없는 11px 한 줄(<375 tiny/375~639 기본/≥640 기존 표기, `formatNarrowKRW`, 4.96. 1천만 미만 증감은 4.95와 같은 문자열, 320 `+877만` 잘림은 현행 한계), 320 배당 `N월 예정` 칩 이웃 글자 간격 4px 이상.
- 👤 **시장과 비교(`#activity/change-market`, #4.73 #132, [market-compare-view.tsx](../../src/app/(main)/_components/views/activity/market-compare-view.tsx))** — 정의 한 줄(`market-definition`) → 비교 카드 `market-compare`: 가진 시장만 국내→미국 블록(`market-block[data-market]`, 머리 `코스피와 비교한 국내 주식 N종목` / `S&P 500과 비교한 미국 주식 N종목 (달러)`), **(#4.78 전치)** 행 하루·1주·1개월·올해(`data-period`) × 열 `보유 종목`/지수/`차이`(차이 = 보이는 두 값의 차·전경색·`%p`), 행 머리 아래 기준 종가 `M/D→M/D`(375 미만 2줄, 올해 `25.12.30→26.11.10`). 올해 = 작년 마지막 거래일 종가 → 일별 ref, 연초 휴장이면 올해 행 `—`·`집계 전`·`— 올해 첫 종가가 나오면 보여드려요`(`market-ytd-pending`), 올해 상장 종목은 올해만 `기준가 없음`. 종목별 기간 4칸(`market-list-period-ytd`, 올해 선택 시 `market-to-change` 숨김), `비교 기준 자세히` 7줄. 미국 올해 기준가 MODP=1·adj 키, TTL 다음 자정. 399px 이하 보유 값 14px·차이 12px(최악값 `+123.4%`·`-123.4%p` 열 안), 목록 기간 4칸 라벨 전체 표시(`1개월` 잘림 없음). 안내 줄 `비교하지 않은 종목 N · 이유`(이유 2개면 줄마다, `자산·채권·금리형` U+2060·`S&P 500` U+00A0) / `제외 N · 사유별`, `기준가 조회 중…`은 카드에 1회(일부 기간만 빠지면 `1개월 기준가 없음`), 상장폐지는 어디에도 세지 않음. 상태: 조회 중(스켈레톤 + `기준가 조회 중…`, 부분 숫자·제외 셈 0) / 지수 실패(시장·차이 `—`, `시장 값을 불러오지 못했어요`) / 기준일 어긋남(그 열 `—`, `— 기준일이 달라 비교하지 않았어요`, 0.0%p 없음) / 하루 휴장(그 블록 하루 세 칸 `—`·열 머리 `휴장`) / 점검(기존 문구, 목록 없음) / 비교할 종목 0(`market-empty`). `종목별` 카드: 기간 선택(기본 1주, 같은 노드 썸 이동, 위 표 불변), 묶음 국내/미국 (달러)/비교하지 않은 종목, 등락률 높은 순 안에 시장 줄(`market-list-index` 면 줄, 오른쪽 끝 x = 종목 줄), 휴장이면 묶음 머리 `휴장`·종목 `—`·시장 줄 없음·평가금 순. `금액은 자산 변화 › 주식에서 ›`(→ 자산 변화 주식·목록 기간), `비교 기준 자세히` 접기 5줄. 금지어·금액 0. 375×667 `?demo=1` 두 블록 첫 화면 안. 자동 `market-compare*.test.ts`·`market-compare-view.test.tsx`
- ⚙ **기간 전환 경합(#4.73 D1, #137)** — 주식 범위에서 일·주·월·연을 어떤 순서·속도로 눌러도(예: `연` 직후 0.3초 안 `주`) 제목 기간 = 구간 날짜 = 금액 기간 = 글줄 기간. `profit-chart.tsx` ref·daily 조회는 `profit-fetch-gate.ts` `beginLatestFetch`(다른 key면 이전 요청 abort, 늦은 응답·진행 콜백 버림, 같은 key 재실행은 보존). Hero 계산식 diff 0(A14). 자동 `profit-fetch-gate.test.ts`(수정 전 main 재현 포함)
- 👤 **자산 변화 › 주식 시장 타일(#4.88 #172, 옛 #4.73 글줄 대체, `change-market-entry`)** — Hero 카드 바로 아래 형제 단일 타일(`change-market-entry-button`, 값 `change-market-entry-value`, 헤어라인·지수 글줄 0). 값 접두 일 `하루`·주 `1주`·월 `1개월` + 도착 화면과 같은 지수 값(375는 첫 시장 1개, 640+는 두 지수). **연 탭(#4.78)은 값 없이 `올해 지수와 나란히 보기`**(`data-period="ytd"`, 지수 조회 0). 비교 종목 0이면 타일 0, 로딩은 값 자리 스켈레톤(CLS 0). 누르면 범위·기간을 기억하고 이동 → 뒤로 시 주식·기간 복원. 새 chip 없음. 면·radius는 상세·주식 타일과 동일(`ToolTile`)
- 👤 **변화 원인 6항목(#4.34, 대표 수정 2026-10-29)** — 월·연 탭 공통 순서 시세 변동 → 평가 갱신 → 환율 효과 → 순유입 → **대출**(`cause-row-loan`, 항상 ≤ 0) → 기록 안 된 변화, 0원 숨김. 대출 = 기록 안 된 변화 U가 음수일 때만 −min(|U|, 대출 순증 + 이자 추정(현재 잔액×금리×일수/365)), 이자 포함 시 예측 배지. 대출과 기록 안 된 변화는 반대 부호가 아니다. 순유입은 기록된 출금↔기록된 매수·상환 ±3일 짝짓기만 상쇄(짝 없는 출금은 순유입 −). 현금 거래가 있는 구간은 입출금 안내 없음
- 👤 **연 탭 변화 원인(#4.34 보완, B안)** — 전체·연에서 Hero("YYYY년 말 대비" + `year-inprogress` "진행 중") 아래 `cause-block[data-scope=year]`, 그 아래 차트·연도별 목록. 체인 = 앵커(작년 수동 순자산 `YYYY-12-31`, 전년 12월 월 스냅샷이 있으면 그것) → 올해 enrich 월 스냅샷(이번 달 제외, `resolveYearChain`) → 실시간. 구간마다 월 탭과 같은 `computeAttributionBetween(…, false)`라 실측 구간 원인 = 월 탭 원인 합, 첫 구간(앵커가 수동값이면 예측)은 "일부 예측"/"예측" 배지. 합계 = `change-hero-delta`(실시간↔종가 차는 "기록 안 된 변화"). 전년 1~11월 월 스냅샷 미사용(C8), 시작일 당일 제외(C15). 첫 해는 블록 없음, `cause-insufficient`는 앵커 근거가 없을 때만, 예외는 `cause-error`. 주식·연 원인 없음, 연 진입 `settlement_view` 0회. preview 데모에 작년 수동값(`@PY` 토큰) 포함
- 👤 **월말 결산([settlement-view.tsx](../../src/app/(main)/_components/views/activity/settlement-view.tsx))** — Hero 이름 `settlement-title` "10월 결산"(진행 중 "11월"+`settlement-inprogress`, 전년 "25년 10월 결산", 첫 달 "7월") + 구간 "9/28 → 10/28"(레거시 "YYYY-MM 기록"), 35일 초과 `settlement-gap-note`, 이전 값 자산이 있으면 `hero-stale-badge` "일부 이전 값"(→ 다음 달 준비로 스크롤). ‹ › `settlement-prev-month`/`settlement-next-month`: 기록 없는 달 건너뜀, 끝에서 disabled, 공유 캡처 숨김. 본문 변화 원인 5항목(시세 변동·평가 갱신·환율 효과·순유입·기록 안 된 변화, 0원 숨김, 매수·매도·상환 문구 없음) / 다음 달 준비(`getStaleCategories` "N일 전 값 기준" → 입력 시트, `.ics` 버튼 + 안내). 빈/첫 달/오류 `settlement-empty`/`settlement-first-month`/`settlement-error`. `cause-row-*` `data-value` 합계 = `change-hero-delta` = end − start. "순자산 비교"·월 칩 없음
- 👤 **AI 질문(#4.37, 이슈 #54)** — 비교 가능한 달(첫 달·빈·오류 제외) 변화 원인 아래·다음 달 준비 위에 보조 카드형 행 `settlement-ai-button`("AI에게 {N}월 변화 물어보기" / "복사해서 외부 AI에 붙여넣기", `data-screenshot-hide`, brand 아님, `transition-[background-color,scale]`). 탭 → `PromptPreviewDialog`(탭 1개) 제목 "{N}월 변화 AI 질문", 주황 고지 `settlement-ai-notice`. 프롬프트 = `buildSettlementPrompt`(화면 값만, 투자 권유 문구 없음). 복사 성공 시 `feature_use{ai_prompt, prompt_copy, settlement}` 1회(실패 0). 성적표 AI 복사는 source `report`. 서버 전송·저장 키 없음. 테스트 `settlement-prompt.test.ts`·`settlement-ai.test.tsx`
- ⚙ **결산 매핑([settlement.ts](../../src/lib/report/settlement.ts) `mapSettlementCauses`)** — 엔진 키 15종 → 5항목. 내부 이동 풀(매수·매도·debt·deposit·cash)은 상쇄 후 잔여만 "기록 안 된 변화"(= Δ순자산 − 표시 4항목, 항등식). 현금 미등록(시작·끝 `breakdown.cash` 0 + 구간 입출금 0)이면 매수·매도만 순유입. 엔진·홈 헤더 무변경, 과거 두 시점은 `computeAttributionBetween`(단일 구간, `isFirstSegment=true`, R29)
- 👤 **처음 맞는 결산(#4.94, F-FIRST-SETTLEMENT)** — F1(11/3 2건·11/6 3건 등록 후 매일 기록): 11/27 팁 `11/7 이후 변화를 볼 수 있어요`, 허브 `11월 · 진행 중`(배지 없음, `hub-change-desc`), 결산 `settlement-title` `11월`+`settlement-inprogress`+`settlement-range` `11/7 → 11/27`; 12/2는 세 곳 모두 `11/7 → 11/28 변화`(`11월 결산` 0건, 결산 `settlement-range` 부재). Hero·허브 증감 `data-value` 원 단위 일치, 기록 안 된 변화 < 50%·부호 반전 없음(F2 현금 매수 포함), A는 구성·월별 기록·AI 숨김·원인 블록 노출, GA result `first_month`. F3: 등록 당일만·id에 ms 없음·date 없는 기록·시작 후 6일(문구 유지)/7일(열림)·창 중 신규 등록(세 곳 구간 동일)·30일 밀림, 수용 한계 2건(새 종목 매수 시 구간 초기화·최근 등록 자산 삭제 시 R 앞당김) FAIL 아님. 체험: Hero 전일 대비 |Δ| ≤ 0.5%·순자산 = 웰컴 ±1%·허브·결산 상식 범위. 자동: `report/__tests__/settlement-first-record.test.ts`·`__tests__/demo-rebase.test.ts`·`home-tip.test.ts`
- ⚙ **결산 구간(`resolveSettlementWindow`)** — 시작 = 대상 달 직전 최근 스냅샷, 지난 달 끝 = 그 달 스냅샷, 이번 달 끝 = 실시간. 이번 달은 간격 25일 이상이면 날짜 구간 제목(`range`), 미만이면 "진행 중". 1~10일엔 전월 기록일이 21일 이후일 때만 전월 결산(`pickSettlementMonth`). 임계 21·25·35일·50%는 추정값
- 👤 순자산 차트(현재+전년 대비), 수익 차트(기간별 일/주/월/연, basis 토글), 배당 차트(연간+월평균, 예상/실제)·월별 배당 종목
- ⚙ **배당 조회 실패 처리(#4.97)** — `fetchDividend`가 `!res.ok`·`X-KIS-Unavailable`이면 throw(빈 배당 캐시 금지), 실패 종목이 있으면 배당 탭·성과 허브 배당 카드에 `배당을 불러오지 못한 종목이 있어요. 앱을 다시 열면 다시 불러올게요` 1줄. 새 대출·코인·실물·부동산 입력 기본 날짜는 `todayKst()`(`dividend-client.test.ts`·`today-kst-inputs.test.ts`).
- ⚙ **성적표 배당 실패(#4.98)** — 배당 로딩 중이거나 1종목이라도 실패하면 '수익의 질'·'레버리지' 잠정, 스냅샷 기록·▲▼ 대비 없음, 계산 근거 금융자산·연간 '—', 5축 아래 실패 안내 1줄. 정상 시 기존과 동일(`report-dividend-fail.test.ts`).
- ⚙ **배당 월 배지(#4.49)** — 월 선택·해제 시 차트 top 불변(`dividend-sub-slot` 공유 칸), 배지는 `button`(Tab 포커스·Enter 해제, 히트 40px), 320에서 "배당" 제목 1줄. InfoHint 9곳 coarse 포인터 ≥40×40·이웃 `elementFromPoint` 검사, 다크 설정 ON 배지 대비 ≥4.5
- 👤 수익 차트 "기준 종가 비교": 시작 종가가 휴장으로 직전 영업일에 폴백되면 "휴장제외" 최소 표시 — 일별=시작~종료 사이 휴장(`hasHolidayBetween`), 주/월/연=명목 기준 시작일 자체가 휴장(`isKr/UsHoliday`)
- ⚙ `fetchProfitRef` + `getProfitCacheKey`: **tickerList `.sort()` 필수**(캐시 중복 회귀 다발), basis별 캐시 분리
- ⚙ `computeDailyStockProfit` 전일 종가 대비, `ProfitBasis`(sameBusinessDay/kstAccessDay), `getDailyClosingRefDates` 시장별 컷오프(국내16:00·해외06:00/07:00 KST)
- ⚙ 휴장 폴백 캐시: 요청일이 비영업일(`isKrBusinessDay`/`isUsBusinessDay`)일 때만 응답일 기준 ref-date 매핑 저장(churn 제거), 영업일+장중 미확정은 미저장(stale 방지) ([route.ts](../../src/app/api/finance/profit/route.ts))
- ⚙ **자산 성적표 레버리지 박스의 3개 기간 축** — 이자=`잔액 × 금리` 향후 12개월 환산 / 주식=`period:"yearly"`(정확히 1년 전, TTM) / 배당=**`annualTotal`(올해 실적+예상 12개월)**. 셋 다 1년 길이여야 하며, 배당을 `annualActual`(YTD)로 되돌리면 연중 N/12만 잡혀 과소계상 회귀. `AssetGradeInputs.dividend.annual`도 동일 값
- ⚙ **레버리지 박스 구성** — **①결론 Hero(이자 내고 남는 돈 + 판정 문구) ②나가는/들어오는 2박스 ③`계산 근거 · 대출 상세` 접기(기본 접힘)** 3블록. 접기 안에 총액·분모·산출 근거·대출 목록·제외 안내가 순서대로. 근거를 기본 화면으로 되돌리면 결론이 묻히는 회귀(design-system §11)
- ⚙ **대출 행 딥링크** — 접기 안 대출 행 클릭 → `trigger-edit-loan`(`detail:{id}`) dispatch → 대출 수정 다이얼로그. `LoanInput`이 [asset-page-tabs.tsx](../../src/app/(main)/_components/layout/navigation/asset-page-tabs.tsx)의 **뷰 전환 밖 hidden 영역에 상시 마운트**되어야 성과 탭에서 동작한다(뷰 안으로 옮기면 깨짐). `!isRealEstate` 행에만 `부동산 연결` 라벨
- ⚙ **레버리지 분모 = 금융자산만** — 대출비율 = `investLoanBalance ÷ (stockCost + cryptoCost)`(`financialInvestCost`)라 '넣은 돈 대비 성과'(= 부동산·현금 포함 `totalCost`)와 **분모가 다르다**. 두 블록에 `금융자산만`/`모든 자산` 뱃지가 유지되는지. 부동산 연계 대출(`type==="mortgage-home" || linkedRealEstateId`)은 이자·잔액 모두 비교 제외
- ⚙ **연계 부동산 선택은 전 대출 종류에 노출**([loan-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-input.tsx)) — `mortgage-home` 한정으로 되돌리면 신용·마이너스대출로 산 부동산을 연결할 수 없어 레버리지 이자·비율이 부풀려지는 회귀
- ⚙ **원인분해 표시 합계 불변 조건** — 홈 헤더·성적표 원인분해가 표시하는 금액의 합 = `deltaNet`(만원 반올림 오차 제외). `topCauses` + `restCauses`(≥1만원) + 잔차(`restEffect − Σ restCauses`, ≥1만원일 때만 **절대값 최대 원인에 흡수**) 구조를 깨면 헤더 증감액과 원인 합계가 어긋난다(과거 P1 회귀 지점). **표시 항목의 단일 출처는 `getAttributionItems`** — 잔차 흡수까지 이 함수가 끝내며, 홈은 `label`+만원, 성적표는 `sentence`+원 단위로 같은 목록을 렌더한다. 뷰에서 잔차를 다시 계산하면(과거 성적표가 `10000` 하드코딩으로 그랬음) 임계값이 갈려 두 화면 합계가 어긋난다
- ⚙ **"그 외"(`rest`) 범주 부재** — 순자산 변동의 원인은 시세·환율·자산 유입/유출뿐이므로 `AttributionCauseKey`에 잔차 키를 두지 않는다. 설명되지 않는 조각을 "그 외"로 흘리는 폴백을 되살리면, 실제 원인(주식 시세 등)이 통째로 묻히는 회귀(2026-08 P1)가 재현된다
- ⚙ **원인의 자산군 분해** — 시세는 `price:stock`/`price:crypto`/`price:realEstate`, 신규투입은 `buy|sell:stock/crypto/realEstate`로 자산군까지 명시한다(스냅샷 `breakdown`−`cost` 델타). `priceEffect`·`savingInvest` **총액은 불변**이고 그 안을 나눌 뿐이라 항등식은 유지된다. 거래내역 없는 주식 원가 변동(직접 수정·스크린샷 등록)은 **방향별로** `buy:stock`/`sell:stock`에 합산(같은 라벨 두 줄 방지), 투자 3종+임차보증금으로 설명 안 되는 원가 증감(현금 잔액 직접 수정)은 `cash`에 합산(`income` 아님, 아래 참조). **환율효과의 주식 몫 = `fxEffect − costFx.cash`** — 현금 몫은 원가=잔액이라 정확히 계산되므로 나머지를 주식 몫으로 두면 안분 근사 오차가 0이 되어 자산군별 시세의 합 = `priceEffect`가 성립한다(`stockFxShare` 보유비율 안분으로 되돌리면 오차가 잔차로 되살아남). 스냅샷의 `netAsset`과 `breakdown` 합이 어긋날 때만 남는 `priceResidual`은 `depositEffect`를 뺀 뒤 `dCostCash`(→`cash`)에 합산해 항등식을 보장. **시작 스냅샷이 레거시인 예측 모드는 시세만 통합 `price`로 남는다**(자산군별 평가액 부재)
- ⚙ **`income`≠`cash` — 실제 기록과 잔차를 분리한다(2026-08 P1 회귀 수정)** — `income`은 기간 내 **반영된** 현금 순유입(입금−출금, KRW, `reflectedCashInflow`)만 집계한 값. `cash`는 투자 3종+임차보증금으로 설명되지 않는 현금성 원가 증감(`dCostCash`). **종전엔 `income = incomeEffect + dCostCash`로 합쳐서 방출해 `incomeEffect`가 대수적으로 완전히 소거됐다**(`savingInvest = savingFullReal − incomeEffect`이므로 합치면 도로 상쇄) — **`cashTransactions`를 기록하든 안 하든 표시 금액이 똑같았고, 기록이 0건인데도 "현금 인출·지출 −N만원"이 확정적 사건처럼 표시되는 회귀**였다(실측 확인: `breakdown.cash` 실제 감소분과 `priceResidual`이 정확히 일치 = 계산은 맞았고 라벨만 틀렸음). 미반영(과거 소급) 기록은 `income`에 집계하지 않는다 — 순자산을 움직이지 않으므로 변동 원인이 아니다.
- ⚙ **`cash` 라벨은 대출(`debt`)과 동일 패턴 — "직접 수정(추정)"으로 되돌리지 말 것(2026-08-07)** — `dCostCash`는 주식·코인·부동산(`dCostStock` 등 스냅샷 원가 델타)·대출(`breakdown.loans` 델타)과 **완전히 같은 방식**으로 신규 추가를 감지한다(`createdAt` 같은 생성시점 필드 없이 델타만으로). 네 자산 모두 "신규 항목 추가"와 "기존 항목 수정"을 구분하지 않고 같은 라벨(매수/새로 추가한 대출)로 뭉뚱그리므로, `cash`도 동일하게 맞춘다. 라벨(`causeShortLabel`)은 대출의 "대출 상환"/"추가 대출"과 같은 2어절 압축 명사구 `"신규 현금"`/`"현금 정리"`, 문장(`causeSentence`)은 대출의 "새로 추가한 대출로 ~"(하드코딩, `label` 변수 미사용)와 동일한 동사구를 명사만 바꾼 `"새로 추가한 현금으로 ~"`. 실사례(2026-08-07): 신규 CMA 계좌(86,000,000원)를 추가했는데 "현금 잔액 직접 수정으로 8,560만원 늘어난 것으로 추정돼요"로 표시되어 "잔액을 몰래 고쳤다"는 오해를 줬다 — 계산(금액)은 이미 정확했고 라벨만 문제였다. `createdAt` 스키마 확장으로 "진짜 신규 계좌"만 정확히 구분하는 방안도 검토했으나, 다른 4개 자산에 없는 기능을 현금에만 추가하는 비일관성이라 기각(스키마·공유토큰 무변경 유지)
- ⚙ **`deposit`(임차보증금 증감) cause 신설** — `netAsset = totalValue − loans − tenantDeposit`인데 `SnapshotBreakdown`에 `tenantDeposit`(optional, v4)이 없으면 그 변동이 `priceResidual`→`cash`로 새어나가 무관한 원인으로 오귀속된다. `breakdown.tenantDeposit`을 프레임에 추가하고 `depositEffect = -(ΔtenantDeposit)`(debt와 동일 부호 규약: 증가=음수)로 분리. **양쪽 스냅샷 모두 필드가 있을 때만** 분리되고, 과거 스냅샷(필드 부재)이 섞인 구간은 여전히 잔차로 흡수된다(소급 불가)
- ⚙ **`buy`/`sell`(주식 신규 매수·매도 회수) cause** — `assetData.transactions` 중 **반영된** 주식 거래를 체결액(체결 환율 우선, 없으면 현재 환율)으로 집계해 `saving`에서 분리(`reflectedTradeFlow`). **`buy + sell + saving = 종전 savingEffect` 항등식**이라 합계=deltaNet 불변. **예측(estimated) 경로도 동일 분리 적용**(과거엔 분리 안 해 매수 반영 시 `purchaseDate`가 갱신되지 않는 점 때문에 기존 보유 종목의 기간 내 추가 매수가 `estimatePeriodInflows`에서 통째로 누락돼 시세로 흡수되는 회귀가 있었음) — `estimatePeriodInflows`는 **기간 내 반영 거래가 있는 종목을 건너뛰어**(권위=거래내역) 이중계산 방지. 한계: 거래내역 스키마가 주식 전용이라 코인·부동산 매수는 `saving`에 남는다. (#4.64) 정밀 분기에서는 반영 매도의 실현손익 R(체결액 − 수량×직전 평단×월초 환율)을 `price:stock/crypto`로 보내고 `기록 안 된 변화`·`buy:`에 남지 않게 한다(예측 분기는 종전: 실현손익을 잔차가 흡수). 전량 매도(평단 소거)·역산 불가는 R=0
- ⚙ **flow 윈도우 경계는 `inFlowWindow` 단일 출처 — 두 축으로 결정된다(2026-08-06)** — `reflected{Trade,Crypto,CashInflow,Loan}Flow` 4종이 `inFlowWindow(date, from, to, includeFrom)` 하나를 공유한다. **① 자산군 축**: 주식·코인은 `includeFrom=false` 고정 — `buy`/`sell`은 `dCostStock`(스냅샷 원가 차이)에서 **차감**되는 값이라, 시작 스냅샷이 그날 거래를 이미 반영했으면(반영 후 저장이 일반적) 같은 금액이 두 번 계상돼 `stockManual`이 반대 부호로 튀고 **입력한 적 없는 "주식 매도"가 매수와 같은 금액으로 쌍을 이뤄 표시**된다(실사례: 08-05 매수 2건 62,235+55,280=117,515원). 제외해도 누락되지 않는다 — 스냅샷 저장 **후** 소급 반영분은 원가가 올라가 `stockManual`이 같은 부호로 잡아 "주식 매수"가 된다. **② 구간 위치 축(현금·대출만)**: `income`/`debt`는 독립 항이라 누락되면 무관한 `cash` 잔차로 새므로(2026-08 P1) 시작일 당일을 포함해야 하지만, **전체 기간의 첫 구간에만** 적용한다(`resolveAttribution(..., isFirstSegment)`). 하이브리드가 `[prevOld,mid]` + `(mid,curr]`로 쪼갤 때 양쪽 다 포함하면 **mid 당일 거래가 두 구간에 잡혀 `income`이 2배가 되고 반대급부로 없는 "현금 잔액 감소"가 뜬다**(2026-08-06 QA 발견). 두 구간의 합집합 = `[prevOld, curr]`, 교집합 = 공집합이어야 한다. `detectCashRoundTrip`의 `incomeToDate`도 **같은 경계**를 써야 `netCashEffect`와 기준이 맞는다(단일=true, 하이브리드=false). **네 함수를 같은 경계로 통일하려 들지 말 것** — 어느 방향으로 통일해도 위 둘 중 하나가 회귀한다
- ⚙ **외화 원가 환율 재평가 누출(`costFxRevaluation`)** — `cost.total`이 현재 환율로 환산된 주식·현금 원가를 포함해, 환율만 움직여도 `savingFull`이 재평가분을 흡수해 `saving`↔`price`가 허위로 갈렸다(`fxEffect`가 평가액 기준 환차익을 이미 별도 계산하므로 이중귀속). `savingFullReal = savingFull − costFxRevaluation(...)`로 제외 (#4.65) 재평가 대상은 **구간 시작 보유분**(구간 안 산 외화 주식·들어온 외화 현금 제외) — 구간 안 외화 매수·입출금의 (끝−체결 환율) 몫은 `fx` 원인으로, 같은 금액을 `stockManual`·`cash` 잔차에서 뺀다(합계 불변). 검증: 해외주식 매수(원화/대출 연결·수동 출금)·달러 현금 연결 매도 + 환율 변동 + 대출 보유 → `대출 일부 예측`·`기록 안 된 변화` 0, 홈 `주식 매도` 없음. 외화 거래·입출금 없는 구간·예측 분기는 main과 동일.
- ⚙ **휴장 여부로 시세 원인을 억제하지 않는다** — 해외 종가는 `getDailyClosingRefDates("foreign")` 기준 **KST 화~토** 새벽에 갱신되고 국내는 평일에 열리므로 **월~토는 매일 주식 변동이 실재**한다. 옛 `isClosedForBothMarkets` 억제는 토요일(=미국 금요일장 종가가 새로 확정된 날)의 실제 상승을 통째로 "그 외"로 묻는 P1 회귀를 냈다(2026-08). 되살리지 말 것
- ⚙ **일요일 quote 노이즈 방어는 이제 R23(slot 고정)이 유일한 수단이다** — 일요일은 실측 변동이 없는 유일한 날인데, `getStockCacheSlot`이 휴장일 slot을 직전 영업일로 고정하므로 **재조회 자체가 일어나지 않아** `price:stock`이 0이 된다. **"금액이 작아서 안 보인다"는 방어가 아니다**: `pickTopCauses`는 `topCauses[0]`에 `CAUSE_DISPLAY_MIN`을 적용하지 않아(`|amount| > 0`만 확인) 유일한 비영 원인이면 금액과 무관하게 표시된다. 홈은 `negligible`(|deltaNet| < 1만원)로 한 번 더 막지만 **성적표에는 그 가드가 없다**. R23을 되돌리면 일요일에 허위 "주식 시세" 금액이 성적표에 그대로 노출된다(과거 changelog 2026-07-26의 "+366만원" 사례)
- ⚙ **토요일 스냅샷 stale 시 일요일 홈에 "주식 시세 상승" 오표시(2026-08 수정)** — R23은 quote **재조회**를 막을 뿐, 스냅샷 **시작점**이 이미 stale하면 방어하지 못한다. 토요일 KST 새벽(해외 컷오프 06/07시 이전) 접속 시 `getDailyClosingRefDates("foreign")`이 한 칸 더 과거로 물러나 그날 스냅샷에 **목요일 종가**가 박히는데, 종전엔 일요일 분기(`saveSnapshots`)가 `hasSaturdaySnapshot`이면 재기록을 건너뛰어(`if (!hasSaturdaySnapshot)`) 이 stale 값이 그대로 남았다. 일요일 시점의 `getDailyClosingRefDates`는 국내·해외 모두 반드시 금요일을 가리키므로, **일요일엔 토요일 슬롯을 항상 upsert**하도록 가드를 제거해 금요일 확정 종가로 자동 교정한다(`grade` 보존·환율 이력 기록도 upsert 경로로 통일). `src/lib/report/__tests__/asset-report.test.ts`에 stale/교정 두 시나리오로 `price:stock` 임계값 통과·미달을 회귀 고정
- ⚙ **시작점(prev) 선정은 같은 날짜에서 daily 우선**(`byDateThenDaily`) — 월말 daily와 monthly는 `_date`가 같아 안정 정렬만으로는 monthly가 먼저 잡힌다. 그러면 헤더 라벨이 "전일 대비" 대신 "지난 접속(7월) 이후"로 나오고, monthly에 v2 필드가 없으면 **예측 모드**로 떨어져 자산군별 시세가 통합 `price`로 뭉친다
- ⚙ **기간별 실측/예측 하이브리드 합성(`computePeriodAttribution`, 2026-08)** — **1주·1개월·3개월·올해 전부 같은 알고리즘**(기간별 특수 분기 없음). daily는 30일 롤링인데 1개월 목표일도 정확히 `오늘−30`이라 daily 후보가 단 하루뿐이고, 과거 monthly엔 v2 enrich가 없어(2026-07-23 이전 저장분) 1·3개월이 사실상 항상 예측이던 문제를 해소. 규칙: **`prevOld`가 이미 `isFullyEnriched`면 애초에 `mid`를 찾지 않는다**(전체 실측, 쪼갤 이유 없음 — 1주가 이 케이스). `prevOld`가 예측(레거시)일 때만 `prevOld`~`curr` 구간에서 `isFullyEnriched`(breakdown·fx·fxBase·cost 전부)를 만족하는 가장 오래된 **daily**를 `mid`로 찾아, `(prevOld,mid]`은 예측 + `(mid,curr]`은 실측으로 각각 계산 후 `mergeAttributions`로 key별 `effects` 합산(→ `pickTopCauses` 1회 재실행). `mid`는 monthly 제외(값 시점이 저장일과 최대 30일 어긋나 flow 윈도우 누락) — daily만 허용. **`mid` 없으면 단일 구간(종전과 완전히 동일 결과)**. `assetData.yearlyNetAssets`를 `YYYY-12-31` 앵커로 승격해 먼 과거의 폴백 후보도 넓힘(항상 예측 경로).
  - **P1 회귀(2026-08 발견·수정)**: "`prevOld`가 이미 실측이면 mid를 찾지 않는다" 가드가 없으면, 1주처럼 `prevOld`가 daily 30일 창 안이라 이미 완전히 실측인 경우에도 사이의 아무 enriched daily나 `mid`로 잡아 불필요하게 쪼갰다. `mergeAttributions`가 `older.estimated`를 확인 안 하고 무조건 `estimatedUntil`을 채우던 구현과 겹쳐, **전 구간이 실측인데 "그 날짜 이전은 추정치" 배지가 근거 없이 표시**됐다(실사용 재현: 1주가 07/27 이전 추정치로 오표시). 수정: mid 탐색 자체를 가드 + `mergeAttributions`도 `older.estimated`가 실제 `true`일 때만 `estimatedUntil`을 채우도록 방어적으로 이중 처리.
- ⚙ **`cashRoundTrip` 힌트(2026-08)** — 기간 중 `breakdown.cash`가 baseline에서 크게 벗어났다가 순변화 없이 되돌아오면(왕복) `resolveAttribution`이 두 끝점만 비교하는 특성상 `cash` 원인이 통째로 사라진다. `detectCashRoundTrip`이 실측 daily 구간(`mid`~`curr` 또는 이미 실측인 `prevOld`~`curr`)에서 최대 이탈폭·날짜를 찾아 `cashRoundTrip`으로 붙이고, 뷰가 "{날짜}에 최대 N만원 변동 후 복귀돼 순변화엔 반영 안 됐어요" 캡션으로 노출(`estimatedUntil` 캡션과 같은 자리, 둘 다 축약형 — 2026-08 문구 축약). 순변화가 최고 이탈폭의 절반 이상이면 조용히 생략(진짜 왕복이 아니라 단조 변화로 판단). `cash`만 대상(시세 등은 상시 변동이 정상이라 일반화 시 노이즈), 성적표 기간 선택기(`computePeriodAttribution`)에만 적용.
  - **오탐 회귀(2026-08 수정)**: 이탈폭(`breakdown.cash`, 기록된 입금 포함)과 왕복 판정(`cash` cause 잔차, 기록된 입금은 `income`으로 분리돼 제외)이 서로 다른 기준을 썼다. `cashTransactions`에 반영된 큰 입금이 있으면 잔액은 영구히 오르는데 `cash` 잔차는 ≈0이라 "왕복 후 복귀"로 오판되고, 이미 "월급·목돈 유입으로 +N만원 늘었어요"(`income`)가 표시된 화면에 모순되는 힌트가 함께 떴다(실사용 재현: 입금일=구간 끝 날짜인데도 힌트 노출). `detectCashRoundTrip`의 이탈폭 계산에서 시점별 `reflectedCashInflow`(시작점~해당 일자 누적)를 빼 **기록으로 설명되지 않는 변동만**으로 두 값의 기준을 맞춤. 진짜 왕복(현금이 실제로 나갔다 돌아온 경우)은 그대로 감지된다 — 그 이동은 기록이 없거나 입출금이 상쇄돼 누적 income이 0이기 때문.
- ⚙ **`estimated`→`estimatedUntil` 계약 확장** — `estimated: boolean`은 하위호환용(전체 구간이 예측일 때만 true). 부분예측(하이브리드 병합 결과)은 `estimatedUntil?: string`(이 날짜 **이전**만 예측)으로 표현. 뷰는 `estimated` → "예측" 배지, `!estimated && estimatedUntil` → "일부 예측" 배지로 구분(`asset-report-view.tsx`). `computeAttributionSince`(홈 "지난 접속 이후")는 **하이브리드 대상이 아니다** — 기존 `?? candidates[0]` 폴백만 유지
- ⚙ **항목별 날짜·기록 타임라인(S-4.33)** — `getAttributionRecords(attr, assetData, rates)`가 구간(`windowFrom`/`windowTo` = 시작·끝 스냅샷 `_date`, monthly 시작점의 표시용 "YYYY-MM"과 분리) 안 **반영된** 현금·주식·코인·대출 기록을 날짜→입력순으로 나열(경계는 `inFlowWindow`: 매매 `(from,to]`, 현금·대출 `[from,to]`, 주식 환산은 `tradeKrwRate` 공용). `attachCauseDates`가 key별 최초~최신일을 `dateLabel`("10/21"·"10/20~10/23")로 부착, `sortCausesByDate`는 시세·환율 → 날짜 있는 항목(최초일순) → 날짜 없는 항목(`CAUSE_ORDER`). 금액·합계 불변. 홈 펼침=비교 구간 캡션+날짜+`AttributionRecordList`(스크린샷 모드 제외), 성과=그룹 순서 유지·그룹 내부만 날짜 정렬+목록 하단 기록 내역
- ⚙ **원인 표시 카테고리 순서(`getOrderedCauses`)** — 절대값 크기순이 아닌 주식시세→코인시세→부동산시세→(예측)시세→환율→주식매수→주식매도→코인매수→코인매도→부동산매수→부동산매도→소득(income)→현금잔차(cash)→대출→임차보증금(deposit) 고정 순서로 나열(연관 원인이 나란히 보이도록). `topCauses[0]`(절대값 최대)의 선정 로직은 그대로, 나열 순서만 결정
- ⚙ **잔차 흡수는 부호가 같은 원인에만**(`getAttributionItems`, 2026-08) — 임계값 미만 잔차 합을 절대값 최대 원인에 얹되, 부호가 다르면 얹지 않는다(방향 고정 라벨에 반대 부호가 붙어 "주식 매수로 −3만원 늘었어요" 같은 모순 문장이 나오는 것 방지). 부호가 맞는 원인이 없으면 `cash`로(없으면 신설)
- ⚙ **용어**: 신규투입은 자산군별 "매수/매도"로 통일(`주식 매수`·`코인 매수`·`부동산 매도` …), 시세도 자산군 접두("주식 시세 상승"). 통합(자산군 미분리) `price`="보유자산 시세 상승/하락"(2026-08, 구 "시세 상승/하락"에서 명확화 — `price:stock` 등 실측 자산군별 라벨과 구분). `income`="현금 입금"/"현금 출금"(2026-08, 구 "소득 유입"/"인출·지출"에서 매수·매도와 같은 패턴으로 통일, 문장도 "현금 입금으로 ~ 늘었어요" 패턴), `cash`="현금 잔액 증가"/"현금 잔액 감소"(짧은 라벨은 사건을 단정하지 않지만, 서술형 문장은 "현금 잔액 직접 수정으로 ~ 추정돼요" — 실사례 디버깅으로 대부분 직접 잔액 수정이 원인임을 확인해 "추정" 어투로 반영, 2026-08), `deposit`="임차보증금 반환"/"임차보증금 증가", `debt`="대출 상환"/"신규 대출"(임차보증금 제외, 실제로 대출 잔액만 반영하므로 "부채"보다 정확). "그 외" 라벨은 없다. **라벨 단일 출처는 `causeShortLabel`** — `AttributionCause.label`·`causeSentence`가 모두 여기서 파생되므로 두 표기가 어긋날 수 없다(구 `CAUSE_LABELS` 소비처 0이라 제거)
- ⚙ **현금·대출 그룹은 항상 완전 분리(2026-08 QA)** — `groupAttributionItems`에 있던 "이 기간에 `debt`가 하나라도 있으면 `cash`를 `loan` 그룹으로 강제 편입" 규칙을 **완전히 제거**했다. 금액·연관성과 무관하게 트리거돼, 신규 현금 자산 대량 추가(8600만원)와 전혀 무관한 소액 대출 변동이 같은 기간에 겹쳤다는 이유만으로 그 현금이 통째로 "대출" 섹션에 표시되는 오분류가 있었다. `cash`는 항상 `ATTRIBUTION_GROUP.cash`(현금), `debt`는 항상 `loan`. `dCostCash` 계산식 자체는 `loans`를 참조하지 않아 금액은 원래도 정확했다(회귀 테스트로 확정)
- ⚙ **자산 타입별 그룹 박스 + 항목별 "일부 예측" 배지 + 부동산 안분 제외(2026-08)** — `groupAttributionItems`가 `getAttributionItems` 결과를 주식·코인·부동산·현금(`income`+`cash`)·대출(`debt`) 그룹으로 묶어 박스 하나에 여러 줄로 렌더(`fx`·`deposit`·통합 `price`는 그룹 없이 단독 박스). 그룹 나열 순서는 그룹 내 금액 순합의 절대값 큰 순서. `mergeAttributions`가 하이브리드 구간의 통합 `price`를 mid 시점 breakdown의 **주식·코인 비중에만** 안분해 실측 `price:stock`/`price:crypto`와 한 줄로 합치고 `estimated:true`로 표시(부동산은 안분 대상에서 제외 — `real-estate-input.tsx`는 시장가 자동 갱신이 없어 사용자가 안 건드린 부동산에 "시세 하락"이 뜨는 오귀속 방지). 안분된 줄에는 개별 "일부 예측" 배지(구간 전체가 `attribution.estimated`면 상단 배지로 충분하므로 중복 생략)
- ⚙ **현금 입출금 기록 날짜 기본값 KST 통일(2026-08)** — `cash-tx-input.tsx`의 날짜 필드 기본값·최대값(`todayStr`)이 `new Date().toISOString()`(UTC 자정 기준)이면 한국시간 00~09시에 입력한 거래가 하루 전 날짜로 저장돼 원인분해 `income` 집계에서 누락(→ `cash` 잔차로 오분류)될 뿐 아니라, **날짜 입력 `max` 제약이 KST 기준 "오늘"을 미래로 오판해 그 시간대엔 오늘 날짜를 아예 선택할 수 없었다**. 스냅샷 등 다른 "오늘" 계산과 동일하게 `Date.now() + 9시간` 기준으로 통일. 동일 UTC 패턴이 `trade-input.tsx`(주식 매매)·`loan-tx-input.tsx`(대출 거래)에도 남아 있음(이번 수정 범위 밖, 후속 검토 대상)
- 자동: `src/lib/report/__tests__/asset-report.test.ts` — 항등식(정밀·예측·표시항목), 미반영 현금기록 제외, buy/sell 분리(정밀·예측 양쪽), 체결 환율 환산, 외화 원가 fx-중립화, **토요일 실시간 끝점의 주식 시세 노출**·**"그 외" 라벨 부재**·**동일 날짜 daily 우선**, 자산군별 시세·매수 분해, 직접 수정분 방향 합산, 카테고리 순서, **income↔cash 실제 반응**·**deposit 분리**·**잔차 흡수 부호 일치**·**computePeriodAttribution 하이브리드 합성(4기간 공통·mid 부재 회귀·폴백)**, **토요일 stale 스냅샷의 price:stock 임계값 재현/교정(일요일 오표시 회귀)**, **기록된 입금의 cashRoundTrip 오탐 방지(income 반영 후 이탈폭 재계산)**, **하이브리드 price 안분(mid 구성비로 price:stock 병합·estimated 표시, 부동산 제외 확인 2건)**, **groupAttributionItems(자산군·대출 그룹핑, 순변동 절대값 정렬)**, **income 라벨/문장 통일**. `src/lib/__tests__/stock-cache-slot.test.ts` — 휴장일 slot 고정(F-SYNC 연계)
- 엣지: 전년 데이터 없음, 조회 중 상태, 배당 매수일 이전 payout 제외
- 회귀: 2단 캐시(REF_DATE_MAP/REF_PRICES) 휴장일 영구 hit, daily 캐시 키, 일별 표시값(국내 휴장 시 직전 영업일 종가) 불변

- ~~연 탭 자산 구성 변화 카드(#4.43)~~ — #4.44에서 제거됨(`composition-card` DOM 없음). 외화 노출 줄(성적표 분산·비중)은 유지.
- **월 탭 자산 구성 변화 블록(#4.51, `composition-block`)**: 변화 원인 바로 아래·AI 행 위, 배지 "총자산 기준"+InfoHint 1개, 막대 2줄(라벨=Hero 시작·끝점, 이번 달 "지금")·증감 행(반올림 차 0이면 "변화 없음", 손익색 0). 숨김: 첫 달·시작/끝 breakdown 없음(7월 결산·레거시)·총자산 0·두 시점 단일 자산군. 이번 달 끝값=`buildLiveAttributionCurr().breakdown`(Hero·원인과 같은 출처). 자동: `report/__tests__/composition-month.test.ts`. 대출 많은 사용자는 홈 도넛과 %가 달라야 정상(분모 차이).
- **월별 기록(#4.67 R3, `monthly-log-block`)**: 전체·월 탭, 구성 블록 아래·AI 행 위 SECTION 카드 1개(`월별 기록`, 캡션 `금액 아래 숫자는 바로 앞 기록보다 늘거나 줄어든 금액이에요`, 13줄이면 `최근 13개월까지 보여요`). 숨김: 기록된 달(저장된 달 ∪ 이번 달, 13개월 창) <2·첫 달 화면·빈 상태·자산 0·결산 오류·주식 범위. 진입 행·시트·`role=dialog`·표·가로 스크롤 0, GA 화면 키 없음. 줄(최신순): 월·이번 달 `진행 중`·기록일(`오늘`·M/D·레거시 `YYYY-MM 기록`) / 순자산 원 단위 전체(`만`·`억` 0) + 앞 기록 대비 변화(상승 rose `+`, 하락 blue U+2212, 0 muted `0원`, 값 = 이번 순자산 표시값 − 앞 표시값 — 소수 달도 결산 Hero Δ와 원 단위까지 같음 — `settlementDelta` = round(끝) − round(시작), 허브 자산 변화 카드·원인 합계·AI 질문 동일), 첫 기록 `첫 기록`(색 없음), 빈 달 `기록 없음`(비교·펼침 없음), 그 다음 줄 `· N월 대비`. full 줄 탭 → 자산군 금액(부채 −)·순자산 기여 변화(대출 증가 = 파랑 −, 각 줄 변화 = 그 줄 표시 금액 차, 소수 달은 합이 순자산 Δ와 반올림 잔차 수 원) 펼침(`aria-expanded`, 이번 달만 기본 펼침, 다중 펼침, 접힘 `inert`, `sm↑` 금액·변화 한 줄, 1280에서 금액·변화 우측 끝 줄마다 동일, 10억 이상 변화 줄 포함 `sm:min-w-28`). net-only 줄은 펼침 없음 + `종류별 기록 없음`, 앞 기록이 net-only면 패널 금액만 + `이전 기록에 종류별 값이 없어 금액만 보여요`. 7줄 이상이면 6줄 + `이전 N개월 더 보기`(누르면 전체·버튼 소멸). 월 화살표 이동에 블록 리마운트·펼침 초기화 없음. 320/375/1280 가로 스크롤 0. '월말' 0, 저장·전송 0. 자동: `report/__tests__/monthly-log.test.ts`·`views/activity/__tests__/monthly-log.test.tsx`.
- ⚙ (제거된 4.43 카드) 구성 카드 데이터 규칙: 총자산 분모(부채 제외), 이번 달=실시간 `getAssetSummary` 값, 음수 0 처리, 색은 이번 달 기준 1회(13칸 공통)

### F-REPORT. 자산 성적표 (5축 별점·트로피 티어) ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx) · [asset-grade.ts](../../src/lib/report/asset-grade.ts)) — 명세 [S-4.18](../specs/4.18-asset-report-card.md)
- 축 제목(#5.103): 값 없는 축(측정불가·배당 실패 '—')은 320에서 빈 별이 숨고 제목이 최대 2줄·어절 꺾임 0, 360 이상은 별 그대로.
> 레버리지 박스(이자 vs 투자 수익)는 F-ACTIVITY에 있음 — 여기선 **5축 채점·티어·재정규화·이력화·delta**만 다룬다(중복 금지).
- ⚙ 5축 가중(growth .3 / earning .2 / leverage .2 / diversification .2 / habit .1). 측정 불가 축은 `null` → **측정 가능한 축만 가중 재정규화**해 종합 산출(신규 사용자도 등급, AC2)
- ⚙ 레버리지 축: 무부채(loanBalance≤0)=**5.0**(건전성 만점, AC3) / 자본잠식(equity≤0 & 부채>0)=**0.5**(AC4). 부채비율 40/60%·평균금리 6%·이자 커버리지 감가점
- ⚙ 채점 컷 전부 `GRADE_THRESHOLDS` 단일 소스(AC5) — 티어 4.5/3.5/2.5(platinum/gold/silver), 컷 근거는 각 score 함수 주석
- ⚙ 전 축 non-pending 확정 시 오늘 daily·이번 달 monthly `grade` 기록(`recordGradeSnapshot`, **동일 값 스킵=멱등**, 과거 불소급, AC6). `diffGrade`로 종합·축별 ▲▼·티어 승·강등(AC7) — 최근 과거 daily 우선, 없으면 이전 달 monthly 대비
- ⚙ **habit 순자산 상승 비교 범위(#4.34)** — 월 스냅샷이 13개월 보존돼도 가장 최근 기록 달의 해(올해)만 최근 7개(비교쌍 6)로 본다(종전 올해분 저장과 같은 결과, 1~6월 전년 달 혼입 방지)
- ⚙ **habit 저축 규칙성**(S-4.22) — ②'꾸준함'을 순자산 상승개월과 **현금 입금 관측 개월(최근 6개월, `savingsRhythm`)** 중 높은 비율로 채점(저축을 시세와 분리). 가중치 0.1·재정규화·티어 불변. 현금 거래 없으면 순자산 상승 폴백. habit 카드 → 현금 상세 딥링크
- ⚙ 투자 레버리지(부동산 담보 제외) 有 + 코인/부동산 보유 시 "암호화폐·부동산 수익 측정 불가 비교 제외" 캡션 + InfoHint(AC8)
- 👤 **외화 노출 2줄(#4.43)** — 분산·비중 카드 reason 아래 `외화 자산 비중 N% (달러 a% · 엔 b%)`·`환율이 1% 움직이면 순자산이 약 ±X 움직여요`·캡션(`[data-testid=fx-exposure-lines]`). N은 `fxRatioSum.toFixed(0)`(reason "외화 비중 N%"와 동일), 통화 1개면 `(달러)`만, 외화 0·총자산 0이면 DOM 없음. 채점·reason·action 불변
- 👤 자산 0 → "자산을 등록하면 성적표가 계산됩니다"만 표시(AC1). 자산 등록 → Hero 티어(트로피 글로우)·종합 별점·축별 카드(reason/action·딥링크) 표시
- ⚙ **4대 섹션 아이콘 톤 구분(2026-08)** — "투입 대비 성과"(Wallet)·"5축 측정"(Star)·"순자산 변화, 왜?"(Landmark)·"AI 평가 프롬프트"(Sparkles) 4개 대주제 섹션이 `SectionHeader`의 `tone` prop(`brand`/`gold`/`important`/`info`, `asset-report-view.tsx`)으로 아이콘 배경·색만 구분(제목 텍스트는 `text-foreground` 공통 유지). AI 프롬프트도 이때 `SectionHeader` 사용으로 전환(이전엔 아이콘 배경 칩 없는 인라인 구조)돼 나머지 3개와 시각적 무게가 맞춰졌다. 새 톤을 추가할 색은 design-system.md에 이미 의미가 정해진 토큰만 재사용(신규 색 지양) — #4.34에 "순자산 변화, 왜?" 섹션 삭제(변화 원인 정본은 자산 변화 월 탭), 현재 3개
- 회귀: `grade`는 오늘 daily·이번 달 monthly에만 기록 → 등급 기록은 사용자 편집 신호가 아니므로 push를 유발하지 않음(R14). `SnapshotGrade` optional → 구버전 백업/공유 토큰(packV7)과 호환(R3)
- ⚙ **홈 진입점(2026-09)** — `dashboard.tsx`의 `NetAssetSummaryBox`가 우상단에 트로피+점수 미니 배지 노출(`components.md` 대시보드 표 참고). 성적표 화면 방문 이력이 있어야(스냅샷 `grade` 필드 존재) 뜨고, 재계산 없이 저장된 최신값만 읽음 — 미방문 계정은 배지 자체가 렌더 안 됨(조용한 생략)
- 👤 성적표를 한 번도 안 연 계정은 홈에 배지가 안 뜨는지, 한 번 연 뒤에는 홈에 트로피+점수 배지가 뜨고 탭하면 성적표 화면으로 바로 이동하는지, 다크·라이트 모두 티어별 색이 잘 보이는지
- 자동: `src/lib/report/__tests__/asset-grade.test.ts` (미작성 — 후속 과제)

### F-HUB. 집중도·허브·대시보드
- 👤 `detail-hub`(카테고리별 평가손익·건수), `performance-hub`(순자산·수익·배당 KPI), `dashboard` 도넛/금융자산 바
- 엣지: 빈 카테고리 클릭 비활성, 단일 종목, 0·음수 값
- ⚙ `assignColors` 최대값=MAIN_PALETTE[0]

### F-SHARE. 공유 (Zero-Knowledge) ([header-menu/share](../../src/app/(main)/_components/header-menu/share) · [api/share](../../src/app/api/share))
- 👤 공유 URL 생성·로드, Short URL(s:KEY), PIN 보호(4자리), 잘못된 토큰→invalid-access
- ⚙ **`#share=` 해시 삭제 시점(보안)** — 복호화 키(localKey) 포함 베어러 토큰이라 소비 **완료 시** `history.replaceState`로 제거: 데이터 적용(712)·PIN 확정(`handlePinConfirm` 746)·취소(`handlePinCancel` 761)·무효(invalid-access). **PIN 다이얼로그가 열리는 틱에는 제거 금지** — Next 패치 replaceState가 Radix `Dialog`를 즉시 닫는 버그(아래 R20). `processShareToken(rawTokenStr)`은 인자만 사용(해시 재읽기 없음)·PIN 확정은 `pendingToken` state라 제거 후에도 복원 정상
- 👤 공유 시 발신 기기의 테마가 라이트 모드이면 URL 뒤에 `&theme=light` 파라미터가 포함되며, 수신 기기에서 이 링크로 진입 시 즉시 라이트 모드로 전환 및 쿠키 동기화되는지 확인
- 👤 공유 테마 링크 진입 시, 자바스크립트(Hydration) 로드 이전 HTML 극초기 렌더링 단계에서 테마 깜빡임(Flash) 현상 없이 즉시 송신 측 배경색(bg)으로 표시되는지 확인
- ⚙ packV7/v7.2/v72Z 직렬화·복호화, 스냅샷·profitBasis·nickname 포함
- 엣지: PIN 불일치 재시도, v72Z localKey 손상 시 즉시 invalid, URLSearchParams `+`→공백 복구
- 👤 **인증카드 금액 숨김(#4.80)** — `금액 표시` OFF에서 주식 현황 종목 행 수량이 `••••주`(숫자 수량 0), 평가금액·손익 금액도 `••••`. ON이면 `N주` 기존과 동일. 상세>주식 탭 수량 표시 불변. 자동 `stock-row-qty-mask.test.tsx`
- 회귀: **공유 토큰 버전 호환**(신규 필드 추가가 기존 URL 파싱 안 깨뜨리는지), 스냅샷 구분자 충돌
- ⚙ `/api/share`: GET key `^[0-9a-f]{10}$` 외 400(내부 `rl:` 키 접근 차단), POST `v72Z`만 저장(그 외 400 → 클라이언트는 start_url 없이 폴백), 토큰 ≤900k자, `owner_id` UUID만

### F-SCREENSHOT. 인증카드 (share-card) ([share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx), [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx))
- 👤 상단 오른쪽 "인증카드" 아이콘(`IdCard`; 브라우저·PWA 공통 — PWA 홈은 `pwa-home-header` 줄, 상세·성과 허브는 제목 줄 `hub-share-card` 발송 버튼, 하단네비 칸 없음 #4.66; 버튼 채움 = brand 인디고 `#5b6fbf`+흰 아이콘(라이트·다크 동일, 하단 업데이트 버튼과 같은 색), 두 버튼 같은 색 R8)으로 다이얼로그 오픈, 브랜드 버튼으로 이미지 공유·저장 — **모바일(Web Share 지원)**: "공유"(`navigator.share({files})`, `title` 없음) + 저장 아이콘 / **PC(미지원)**: "저장" + 클립보드 이미지 복사 아이콘(`canCopyImage` 지원 시). 다이얼로그 상단 설명은 3타입 공통 "내 {대상}을 …하고 친구에게 공유해보세요."(PC만 노출)
- 👤 다이얼로그 헤더는 좌측 정렬(`text-left`로 shadcn `DialogHeader`의 `text-center` 오버라이드)
- 👤 **모바일 셸**(#4.24): `DialogContent`가 모바일에서 **좌우 12px 인셋**(`left-3 right-3`) + **세로는 `top-[max(0.75rem,env(safe-area-inset-top))]` 앵커 + `h-auto`** → 팝업 세로 길이가 내부 주식현황/포트폴리오 콘텐츠 높이만큼 늘어남(뷰포트 고정 아님, 내부 프리뷰에 자체 스크롤바 없음). 콘텐츠가 화면을 넘으면 팝업 셸 전체가 스크롤(`max-h-[calc(100dvh - safe-area top - safe-area bottom)]` + `overflow-x-hidden overflow-y-auto`, `sm:overflow-hidden`). `translate-x/y-0`로 중앙 배치 해제, `rounded-2xl border shadow-lg` — 가장자리로 공용 `DialogOverlay`(`bg-black/70 backdrop-blur-sm`)가 살짝 비침. 프리뷰 컨테이너는 모바일 `flex-none overflow-visible` / `sm:flex-1 sm:overflow-y-auto`. `DialogDescription` 숨김(`hidden sm:block`), 헤더 `px-3 pt-3 pb-2`, X 버튼 `top-3`, 프리뷰 컨테이너 `px-0`. 데스크톱(`sm:`)은 중앙 배치 복귀(760px, 94dvh, `p-4`, `sm:top/left-[50%] sm:translate-x/y-[-50%] sm:bottom/right-auto`, `sm:max-h-[96dvh]`). 셸 클래스는 캡처 대상 아님(R32 무관)
- 👤 **프리뷰/캡처 분리**(#4.24): 미리보기 `<ShareCard responsive />`와 저장 대상이 **별개 인스턴스**지만 하위 렌더 구조는 **동일**하다 — 두 인스턴스 모두 하위 컴포넌트에 `screenshotMode`(정적 · 펼침 없음 · `ASSET_THEME_SHOT` 고정 토큰)를 넘긴다. `responsive`가 바꾸는 건 **outer 폭·패딩**(`w-full`+`p-2 sm:p-3` vs 680 고정+`p-3`)과 `PortfolioRingCard`의 **링 fit-to-width 스케일**(`scale = min(1, floor(clientWidth)/VIEW_W)`, `overflow-hidden` → 도넛이 모바일 폭을 꽉 채우고 가로 스크롤 없음 R33)뿐. **저장 PNG는 화면 밖 별도 고정 680px 캡처 인스턴스**(`<div aria-hidden className="fixed left-[-9999px]" style={{width:680}}><ShareCard cardRef={cardRef} /></div>`)를 `toPng`이 캡처 — `pixelRatio = ceil(1400/el.offsetWidth) = ceil(1400/680) = 3`(~2040px). 뷰포트·기기 무관 100% 동일. (직전 시안의 `shot = !responsive` 분기는 프리뷰에서 `StockCard` 펼침 기능이 되살아나 제거 — 인증카드는 정적 이미지라 펼침 없음.)
- 👤 **타입 3종**(#4.24, **③투자 유형 #4.26 추가 — 다이얼로그 기본 진입**, 아래 F-SCREENSHOT 투자 유형 항목) — 제어 바 `InlineSelector`로 전환: **①주식 현황**(아래 내용) **②포트폴리오**(대형 종목 도넛 `PortfolioRingCard` + 하단 막대바 2개 `PortfolioSectorBar`: "분야 구성"·"보유 유형 구성"). 상세 사양은 [components.md](components.md) `ShareCard`/`PortfolioRingCard`/`PortfolioSectorBar` 참조. `ShareScreenshotDialog`는 `initialVariant?` prop을 받아 열릴 때 그 타입으로 맞춤(`dispatchOpenShareCard("portfolio")` → `trigger-open-share-card` `detail.variant`, 홈 "새 공지" 팁이 사용). 자산군 통합 랭킹("핵심 자산 Top")은 없음
- 👤 **보유 유형 구성 막대바**: `stock.category`별 비중. `irp`+`pension`은 이 막대바에서만 "연금저축펀드·IRP" 한 버킷으로 병합(`stockCategories` 원본 6종은 불변). ISA·비상장은 분리 유지 → 최대 5개 버킷
- 👤 **분야 구성 막대바**: X-Ray theme 축, 상위 `SECTOR_MAX`(5) + "그 외 N개 분야"(최대 6항목). 유효 분야 2개 미만이면 미렌더
- 👤 상단: **닉네임 미노출**(2026-08-08 제거) → `StockSummaryHeader`(주식 탭과 동일 컴포넌트, `DetailSummaryHeader`의 `screenshotMode` 분기) — 배경 박스 없이 아래 비중 바·리스트와 좌우 여백 동일(`px-2`=8px, 카드 전체 좌우 오프셋 20px), "총 주식 평가금액" 히어로 숫자는 `ASSET_THEME_SHOT.summaryValue`(`text-[17px]` — 2026-09 프리뷰 축소, 상세 탭보다 ~2px 작게) + 평가손익(수익금 `text-sm`·수익률 `text-xs`). 원/달러 셀렉터·오늘 등락 칩은 미노출. **금액 전부(헤더·종목 리스트·"그 외 N종목") 전체 금액**(`840,180,000원` 형태, 상세 탭과 동일, `share-card.tsx`의 `mask`→`formatCurrency`) — 축약(`8.4억원`) 미사용
- 👤 비중 바 — **상위 7종목(SHOT_MAX, 2026-08) 색 구간 + 회색 `그 외`(#9ca3af) 구간** + 바로 아래 **범례**(색점 + 종목명 + 비중%, `그 외 N종목` 포함). 범례는 `ASSET_THEME_SHOT.legendGrid`(`grid-cols-2`)·`legendText`(`text-xs`, 2026-09 프리뷰 축소) 사용, `sm:` 금지(R32) — 프리뷰·캡처 두 인스턴스 모두 `screenshotMode` 경로라 동일. 저장 PNG 결정성은 화면 밖 680 고정 캡처 인스턴스가 담당. 비중 바·범례·리스트를 감싸는 래퍼는 **배경색 없음**(카드 전체 배경과 통일, 패딩 `p-3.5`만 간격 계산용으로 유지)
- 👤 종목 리스트 — 상세 > 주식 탭과 동일 형태(`StockCard screenshotMode`: 로고 아이콘 + 이름 + `N주`(**비중% 미노출** — 범례로 통합) + 우측 평가금액/손익 2줄 + 하단 비중 스트립). 상위 7개만(SHOT_MAX), 초과분은 `그 외 N종목` 요약행 — **우측은 종목 카드와 동일 2줄**(나머지 평가금액 합 / 손익 `(+X.X%)`). 종합 수익률은 `(Σ평가−Σ원가)/Σ원가`(개별 평균 아님), 상장폐지 종목은 손익 합산에서 제외. **비중% 미노출**(범례 `그 외 N종목`과 중복)
- 👤 헤더~범례~리스트 간격 통일: 헤더~범례·범례~리스트 실제 노출 간격 **40px**로 동일(숨은 패딩까지 계산해 마진값 역산 — 2026-09 28→40px 상향, 래퍼 `py-[26px]` + 리스트 `mt-10`, 상세>주식 탭과 동일 간격), 카드 최상단↔헤더 값 간격도 헤더 자체 `pt-2`로 정렬. 금액 표시 스위치 끄면 금액류만 `••••` 마스킹(비중%·수익률%는 항상 노출). **푸터 없음**(2026-09) — 브랜드명("시크릿에셋")·도메인(`secretasset.xyz`)·날짜 전부 제거, 종목 리스트가 카드의 마지막 콘텐츠
- ⚙ 데이터는 `useFilteredStockData("all")` 단일 출처 — 주식 탭과 캐시 키 공유(중복 fetch 없음). 종목 파생값은 `computeStockMetrics`
- ⚙ **텍스트·아이콘 크기 — 프리뷰/캡처 분리**(2026-09) — 프리뷰(`responsive`)는 `ASSET_THEME_SHOT`. 상세>주식 탭 모바일보다 **의도적으로 ~2px 작다**(2026-09 축소 — 프리뷰에서 주식 현황이 포트폴리오 도넛 라벨(실효 ~12px)보다 커 보여 낮춤): 본문 `text-xs`(12), `summaryValue` `text-[17px]`, `profitAmount` `text-sm`(14), `iconInitial` `text-[8px]`, `badge` `text-[9px]`, `icon` `size-5`(20). **PC 프리뷰(≥640px)는 본문 계열만 `sm:text-sm`(14)로 한 단계 ↑**(`cardInfoName`/`cardAmountMain`/`profitRate`/`legendText`/`bodyText`, 2026-09 — `summaryValue`/`profitAmount`/`badge`/`iconInitial`은 미해당, `profitAmount`는 원래 이미 14). 이 `sm:`은 프리뷰 전용 세트(`ASSET_THEME_SHOT`)에만 있고 저장 PNG는 항상 `ASSET_THEME_SHOT_BIG`(아래)라 R32와 무관. **캡처(저장 PNG, `shotBig`=`!responsive`)는 `ASSET_THEME_SHOT_BIG`** = 캡처 기준 base(14/9/10/20/16/14·icon 24)를 `SHOT_BIG_SCALE`배 한 결과를 하드코딩(현재 1.46 → 20/13/15/29/23/20px, `icon` `size-[35px]`). 프리뷰(SHOT)와 base 분리 — 캡처 크기 불변. `SHOT_BIG_SCALE`(theme.ts)은 문서용 배율 상수 — **Tailwind JIT가 `text-[Npx]`를 소스에서 스캔하므로 CSS 변수/런타임 계산 불가**, 값 바꾸면 BIG 값을 base×SCALE 반올림으로 재계산해 교체(theme.ts 주석 base 표). `shotBig`은 `screenshotMode`와 별개 플래그(재결속 시 프리뷰 펼침 부활). `ASSET_THEME_SHOT_BIG`은 전부 `sm:` 없는 고정값(R32) — `ASSET_THEME_SHOT`은 위처럼 캡처에 안 쓰이는 게 검증된 키에 한해 `sm:` 허용. 예외: `cardHeader`/`cardTriggerButton`/`legendGrid` 간격. 하드코딩 본문은 `bodyText` 공용 키.
- ⚙ **포트폴리오 도넛 라벨 — 프리뷰/캡처 분리** — 라벨 `<span>`은 인라인 `fontSize: rLabelFont`. 프리뷰(`responsive`): 링 전체 `transform: scale(<1)` 축소 → `rLabelFont = Math.max(floor, floor/scale)`(floor=모바일 12·**PC(≥640px) 14**, `isPcPreview`는 `matchMedia('(min-width:640px)')`로 판정 — 위 본문 `sm:text-sm` 전환과 같은 640px 기준, 2026-09). 같은 스케일 컨테이너 안의 `BrandMark`(조각 안 ETF 브랜드 배지) 폰트는 **동일 보정을 적용하면 안 된다** — 칩(`size`)이 scale과 무관한 고정 px 좁은 컨테이너라 `/scale`로 폰트만 키우면 넘친다(2026-09 시도 후 회귀, 롤백). 대신 메인·서브 조각 모두 `ETF_LABEL_FONT_SIZE`(14px 고정, 아래 칩 크기 항목 참고)를 `fontSize` prop으로 직접 전달. 캡처(저장 PNG, `!responsive`): `rLabelFont = Math.round(12 * SHOT_BIG_SCALE)`(theme.ts import; 1.46→18, 이 값은 여전히 모바일 기준 12 base — PC 프리뷰가 14로 갈라진 뒤에도 갱신 안 됨, 변경 시 재검토 필요). **종목명 짤림 방지는 프리뷰·캡처 공통**: `line-clamp-3`, `labelMaxW` 하한 좌우 `max(64, …)`(9/3시 가용폭 초과 시 링 좌표계 이탈→화면 밖 짤림이라 64)·top/bottom `208`, 프리뷰 `scale`이 좌우 `PREVIEW_SIDE_INSET`(8px)씩 여백, `rGap` 프리뷰 `round(rLabelFont*4.5)`·캡처 `round(rLabelFont*5)`. `VIEW_W`/`VIEW_H`/`CX`/`CY`/`R_*` 불변 → 아트보드·`pixelRatio` 유지(R32). `PortfolioSectorBar` 텍스트는 프리뷰 `text-xs`(2026-09 `text-sm`→`text-xs`) / 캡처(`big`=`shotBig`) `text-[20px]`·막대·색점 `size-[15px]`.
- ⚙ **포트폴리오 도넛 조각 안 칩(로고·ETF 배지) 크기 — 통일 고정**(2026-09, 이전 비례 보간에서 전환) — `chipSizeFor()`는 조각 각도와 무관하게 고정 타깃 `CHIP_MIN`(50px)을 반환(로고 반경 현(chord)×0.7 안전 상한만 적용, 결과가 `CHIP_HIDE_BELOW`(32px) 미만이면 로고 생략). ETF 텍스트 배지 폰트도 `ETF_LABEL_FONT_SIZE`(14px 고정, 메인·서브 공통)를 `BrandMark`의 `fontSize` prop으로 전달 — 조각 크기와 무관하게 모든 라벨이 같은 크기. **"그 외" 서브칩**은 `SUB_CHIP`(38px, 2026-09 28→38) 3개를 **세로(반지름) 방향**으로 쌓는다(이전 원주 방향 각도 오프셋에서 전환 — 밴드 두께가 더 넓어 안전). 상세 상수·계산은 [components.md](components.md) `PortfolioRingCard` 참조.
- ⚙ **ETF 브랜드 텍스트 배지**(`brand-mark.tsx`) — 6자 이상 브랜드명(`KR_ETF_BRANDS`, `logo-source.ts`)은 `ETF_BRAND_ABBR` 수동 매핑으로 4자 축약 표시(원문 `etfBrand`는 안 바꿈, 5자 이하는 축약 불필요). 배지 원형 배경은 `darkenColor(bgColor)`(조각색을 검정 쪽 55% 혼합, design-system.md)로 조각마다 다르게 하고, 글자색은 `pickOnColor(badgeBg)`로 그 배경과 대비되게 자동 선택(2026-09 — 이전엔 배경=조각색 그대로라 밋밋했고, 그 다음 `pickOnColor(bgColor)` 흰/검정 2톤 고정은 팔레트 대부분이 흰색으로 수렴).
- ⚙ **로고(`BrandMark`·`StockIcon`)** — `useLogoSrc` 훅 경유(`resolveLogoSrc` 직접 호출 금지). 요청 크기는 `captureLogoSize(표시px)`(=×1.5, route retina로 ×2 → 표시px×3). **512/retina 과대 요청 금지** — 모바일 WebView 디코드 실패로 저장 PNG에서 로고 통째 누락(2026-09). 로드 실패 시 훅이 3회 재시도(`&r=N` 캐시버스터), 소진 후에만 폴백(`BrandMark`=칩 생략, `StockIcon`=이니셜).
- ⚙ **`captureImage` 오케스트레이션** — pre-pass 전 `settleImages`(이미지별 4s·전체 12s 예산)로 `<img>` 로드/디코드 대기 → `fetch(cache:'force-cache')` + 1회 재시도 + `console.warn` → `toPng`에 `imagePlaceholder`(1x1 투명)·`fetchRequestInit`. `handleSave` 20s 하드 타임아웃(`Promise.race`). 어느 것도 무한 대기·버튼 고착 없어야 함.
- ⚠ **저장 PNG 해상도로 "외부 사이트에서의 표시 크기"를 제어하려는 시도는 재발 금지**(2026-09, 시도 후 즉시 원복) — 네이버 카페 등은 업로드 이미지를 원본 해상도와 무관하게 컨테이너 폭에 강제로 늘려(stretch) 표시한다. `CAPTURE_TARGET_PX`(1400, `pixelRatio=3`→2040px)를 낮춰도 그런 플랫폼에서의 표시 크기는 그대로고, 오히려 업스케일돼 화질만 나빠진다. 다운로드된 정적 파일이 제3자 사이트에서 몇 px로 보일지는 그 사이트의 렌더링 규칙이 전적으로 결정 — 앱이 제어 불가능한 영역이다(PNG DPI/pHYs 메타데이터도 웹 `<img>` 렌더링에서 대부분 무시됨). `CAPTURE_TARGET_PX`/`CAPTURE_PIXEL_RATIO`(`logo-source.ts`, 둘은 반드시 같은 배율로 동기화)는 순수하게 "확대/인쇄 선명도" 트레이드오프로만 조정할 것.
- ⚙ 색: **주식 현황** 타입 비중바·리스트는 `segFill`(=`SHARE_SAFE_PALETTE`)로 색만 덮어씀(주식 탭 원본 `barItems`/`barColors`·`MAIN_PALETTE`는 불변, #4.24). **포트폴리오** 타입은 `SHARE_SAFE_PALETTE`(=`PORTFOLIO_PALETTE` 고채도 신규 세트, `MAIN_PALETTE`와 별개) + `SHARE_ETC_COLOR` (design-system.md §1.3)
- 👤 인증카드 포트폴리오 타입에서 비중이 크게 다른 메인 조각들의 로고/텍스트 배지 크기가 서로 같아 보이는지, "그 외" 조각 안 미니 로고 3개가 세로로 쌓여 보이는지, ETF 텍스트 배지가 조각 색과 다른 도드라진 원형(밝은/어두운 두 톤 자연 분배)으로 보이는지, PC 프리뷰(넓은 창)에서 본문 텍스트가 모바일보다 한 단계 커 보이는지
- 엣지: 주식 미보유 시 `등록된 주식이 없습니다.` 빈 상태, 보유 5종목 이하면 "그 외" 구간·범례 `그 외 N종목`·"그 외 N종목" 요약행 모두 미노출
- ⚙ **투자 유형 타입(#4.26)** — 데이터는 `resolveInvestorType()`([investor-type.ts](../../src/lib/xray/investor-type.ts))가 결정적으로 산출(같은 포트폴리오=항상 같은 결과, `seeded-pick.ts`의 `hashString`/`pick` 공유). 카드 구성: [InvestorAvatar](../../src/app/(main)/_components/header-menu/share/investor-avatar.tsx)(176/208px) → 제목 → 부제 배지 → 설명 → 해시태그 쪽지. 숫자·금액 미노출.
  - **투자 유형 문구 규칙(#4.26)** — 어휘 풀 확장·`pickFilled` 어미 반복 가드·슬롯 뒤 받침 조사 금지·쪽지 9자 제한·섹터 수준 어휘만 사용. 미국 배지는 `regionPool`로 보유 구성(개별 빅테크 / 나스닥·S&P ETF 중심)에 맞는 후보만 합류(ETF 위주에 "빅테크 동행자" 금지). 분류 진행(`classifying`) 중 공유·저장·복사 버튼 비활성화("분석 중..."). 설명은 `break-keep [overflow-wrap:anywhere]`로 어절 단위 줄바꿈("즐기/는 편" 분리 방지).
  - **설명 줄바꿈 = `max-w`(%) + `targetChars` 한 쌍** — `renderDescriptionInLines`가 문장을 글자수 그리디로 묶어 `<br />`. 모바일 프리뷰 97%/27자(`break-keep`)·PC 프리뷰(`usePcPreview`) 90%/50자·캡처 82%/35자. **텍스트 블록 래퍼 `w-full` 필수**(없으면 %가 "가장 긴 묶음 폭" 기준이 돼 최장 묶음이 항상 줄바꿈·고아 줄). 폭만 바꾸고 `targetChars`를 두면 넓힌 공간이 무용지물 → 항상 함께 조정(수용 글자수 ≈ 실효 폭 ÷ (글자 크기×0.79), targetChars = 수용−3).
  - **캡처 전용 값**(`!responsive`, `sm:` 금지 R32): 부제 배지 `text-[14px]`, 쪽지 글자 14px·패딩 `px-4 py-[9px]`·간격 `gap-x-3.5 gap-y-[18px]`·`max-w-[400px]`, 아바타 코너 배지 글자·아이콘은 `size` 비례(176→10px/24px, 208→12px/28px). 설명↔쪽지 캡처 `mt-7`, 프리뷰 `mt-8` — 실제 간격 = `gap-2.5`(10) + 마지막 줄 half-leading(≈7) + `mt` − 압정 돌출(9). 상단 체감 간격은 배지 박스가 아니라 배지 글자 하단 기준(저대비라 박스 경계가 안 보임).
  - **캡처 섀도 아티팩트 방지** — 캡처 인스턴스의 작은 장식 요소(소품 타일·코너 배지)는 `flat`으로 box-shadow 제거, 압정은 `shadow+ring` 대신 `border-2`(웨일에서 요소 옆 어두운 띠·삐침 발생, 2026-09). 캡처 DOM에 새 소형 요소를 넣을 때 box-shadow/ring 지양.
- ⚙ **공유 플로우(`share-menu.tsx`)** — `navigator.share`는 **클릭 제스처 안에서 `await` 없이** 호출해야 한다(WebKit 등에서 캡처 대기 뒤 호출하면 조용히 실패해 다운로드로 새던 원인). 다이얼로그가 열려 있는 동안 variant/금액표시/분류 진행(400ms 디바운스)마다 사전 캡처해 `preparedShareRef`에 캐시 → `handleShareClick`이 동기 호출, 캐시 없으면 `handleShareSlow` 폴백. PC 클립보드 복사는 `ClipboardItem`에 **미완료 Promise**를 담아 클릭 시점에 `write`(`pwa-install-flow.tsx` 패턴). `share()`에 `title`/`text`를 넣으면 카카오톡에 텍스트로 같이 전송된다.
  - **캐시 무효화(P1 수정 완료)**: `preparedShareRef`는 `{file, key}`(`key = variant|showAmounts|xrayTick`)이고 이펙트 시작 시 즉시 `null`, 변환(`dataUrlToFile`) 뒤 `cancelled` 재확인, `handleShareClick`이 키 일치 시에만 사용(불일치·없음 → `handleShareSlow`). 모바일은 `isPreparing` 동안 공유 버튼 "준비 중…" 비활성화. (미해결 P2: 사전 캡처와 사용자 캡처가 같은 노드를 동시에 `toPng`할 수 있음)
- ⚙ **포트폴리오 도넛(#4.26)** — 캔버스 높이는 `VIEW_H` 고정이 아니라 `viewH`(링 하단 `CY+R_OUTER`와 라벨 추정 최하단+40px 중 큰 값, 상한 `VIEW_H`)로 동적 산정 — 6시 라벨이 없으면 ≈100px 회수. 라벨 높이 추정이 작으면 하단 라벨이 잘릴 수 있으니(프리뷰 래퍼 `overflow-hidden`) 하단 라벨 있는 카드로 회귀 확인. 도넛 라벨은 **종목 이름**(`seg.name`)으로 통일(주식 현황 범례·투자 유형 설명과 동일, 티커는 로고 `BrandMark`용), 3·9시 좁은 존은 `word-break:keep-all`. 하단 막대 범례는 주식 현황과 같은 "이름 %" 인라인(`gap-1`), 섹션 제목은 `font-bold text-foreground`·범례보다 한 단계 큼.
- ⚙ **포트폴리오 도넛 프리뷰 라벨 배치(#4.27)** — 프리뷰는 링 축소(`scale≈0.47`)·폰트 `floor/scale`(≈25px 링좌표)라 라벨이 캡처보다 훨씬 많은 줄을 차지한다. 보정은 전부 **프리뷰 전용**(캡처 `!responsive`는 0/기존 식): `topInset`(12시 라벨 상단 잘림)·`sideExtra=64`(좌우 폭)·`ringH` `VIEW_H` 상한 해제(하단 라벨 잘림)·좌/우 `pushOutside`(`PUSH_R`·`PUSH_MAX=24`·상단 라벨 `UPPER_SHIFT_UP=20`). 종목명은 `splitNameWords`(공백·한글↔영문숫자·`(` 경계 + `NAME_LEXICON` 어휘 분할)로 **단어 단위** 줄바꿈, **이름 ≤3줄 + 비중 1줄 = 최대 4줄**(`line-clamp-3`, 넘치면 말줄임, 화면 밖 잘림 금지). 회귀 확인: 긴 이름(테슬라밸류체인액티브·미국필라델피아반도체나스닥·차이나전기차SOLACTIVE)을 상·하·좌·우 존에 두고 프리뷰(모바일 ≈380px)에서 잘림·링 밀착 없는지, 저장 PNG 구도 불변인지(👤).
- ⚙ **기기별 캡처 일관성(2026-09, iOS 웨일 vs Windows PC 실기기 확인)** — 웹폰트가 Inter(Latin)뿐이라 한글은 OS 폰트로 그려진다. 캡처 DOM은 ① 글자 폭을 `useKoreanAdvanceScale`(PC 기준 자폭 0.92em)로 보정(`krPx`)하고 ② 세로는 px 고정 — 설명 `lineHeight:31px` + 줄 묶음 `height:31px` 블록(`renderDescriptionInLines(…, fixedLinePx)`, 글자수 ≤ `targetChars`인 묶음만 고정·초과는 `min-height`), 제목 `h-[45px]`·유형 배지 `h-[31px]`·쪽지 `h-[39px]`. 배수 줄높이(`leading-[1.85]`)는 Inter+OS 한글 폰트가 섞일 때 줄 박스가 폰트 메트릭에 따라 커져 카드 높이·설명↔쪽지 간격이 기기별로 달라진다.
- 👤 투자 유형: 모바일 프리뷰·PC 프리뷰·저장 PNG에서 설명 줄바꿈(고아 줄 없음)·쪽지 3-3-1 배치·간격·비율이 자연스러운지, 웨일 다운로드·카카오톡 공유 이미지에 어두운 띠·삐침이 없는지, 공유 시 "인증카드" 텍스트가 같이 안 가는지, PC에서 복사 후 카카오톡 PC에 붙여넣기 되는지.
- (2026-08-27: 도넛 차트(사각형→원형) 교체를 두 차례 시도했으나 실사용 확인 후 전면 롤백, 위 원래 구성으로 확정)

### F-IMPORT-EXPORT. 데이터 내보내기/가져오기
- 👤 JSON 내보내기→가져오기 라운드트립, 자산·스냅샷·옵션 보존
- ⚙ `use-asset-import`, 스키마·`validate-reflection` 검증, 악성·손상 JSON 방어
- ⚙ **내보내기 정합 가드(2026-08-06)** — 백업은 **localStorage**(`buildExportPayload`→`getAssetData`)를 뜨는데 화면은 **React state**를 렌더한다. 둘은 CRUD마다 `setAssetData`+`saveAssetData` 쌍으로 수동 정합되고, 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준: 다른 탭만) 잠시 갈라질 수 있다. 그 순간 백업하면 **최신 기록이 빠진 파일**이 만들어지고 나중에 그걸로 복원하면 그대로 유실된다(실사례: 08-05 매수 2건이 빠진 백업, 25분 뒤 재백업은 정상). `exportAssetData(currentData?)`가 `isExportDataStale`(자산 5종+거래 4종 **건수** 비교, 파생필드 제외로 오탐 방지)로 감지되면 다운로드를 중단하고 `false` 반환 → 호출처 2곳(`use-data-export`·`home-tip-box.tsx`, 구 `backup-nudge.tsx`)이 `EXPORT_STALE_MSG` 토스트. **인자를 빼면 검사가 꺼진다** — 새 호출처는 반드시 화면 state를 넘길 것
- 회귀: 가져오기 후 `dataResetVersion`++로 진행 중 fetch abort

### F-CLOUD-SYNC. E2EE 클라우드 동기화 ([cloud-sync](../../src/lib/cloud-sync) · [api/sync](../../src/app/api/sync/route.ts))

#### 코드레벨(⚙)
- ⚙ **preview 동기화 차단(#4.34)** — `isPreviewEnv()`(`NEXT_PUBLIC_VERCEL_ENV === "preview"`)면 `isCloudSyncEnabled()` false → provider 자동 pull·폴링·push·연결 진입점 비활성. 추가로 `sync-client`의 `pushAsset`·`pullAsset`·`fetchRemoteVersion` 입구 가드가 UI와 무관하게 fetch 0건 보장. 운영·로컬 반환값은 `NEXT_PUBLIC_CLOUD_SYNC`만으로 결정(불변). 자동: `src/lib/__tests__/preview-safety.test.ts`
- ⚙ **/api/sync 남용 방어(#4.53)** — IP는 `api-guard.getClientIp`(XFF 좌측 위조 불가), GET L1 120/분/IP(429, 저장소 호출 0), assetId·nonce·sig·ts 형식 불량은 저장소 조회 전 401(정상 id=22자 base64url, 연결 입력 20~24자 ⊂ 8~128자). 정상 다기기 폴링·409 충돌 흐름 무영향. 자동: `src/lib/__tests__/sync-route-guard.test.ts`. 운영 스모크: 2기기 pull·push·409
- 👤 **preview 데모 점검(#4.34)** — `<preview>/?demo=1` → `html[data-demo-ready="1"]` 후 홈에 자산·쿼리 제거, 재접속 멱등. `?demo=empty` → 웰컴. 쿼리 없는 첫 접속 + 자산 0건 → `preview-demo-btn`/`preview-empty-btn`. 전 과정 `/api/sync`·GA 요청 0건. 스크립트: memory 브랜치 `.memory/qa/preview-check.mjs`
- ⚙ 용어 표준화 — `AssetEnvelope`(구 VaultEnvelope), `assetId`(구 syncId), `pushAsset/pullAsset`, Redis 키 `csync:asset:{assetId}`. **URL 해시 `#sync=<assetId>`, `SYNC_HASH_PARAM = "sync"`**(구 `#asset=`/`#vault=` 진입 호환 — provider `detect`·`clearPendingConnect` 모두 신구 처리) ([config.ts:27](../../src/lib/cloud-sync/config.ts) · [provider:153,291-295](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **`#sync=` 해시 삭제 시점** — `detect`는 `aid`를 `pendingConnectAssetId` state로 캡처만, **해시 제거는 연결 모달이 닫힐 때 `clearPendingConnect`(291-303)에서** 수행(성공·취소 공통). **detect(다이얼로그 여는 틱)에서 replaceState 금지** — Next 패치 replaceState가 Radix `Dialog`를 즉시 닫는 버그(R20). `#sync=`는 비밀 없는 assetId 포인터(E2EE 금고암호 별도)라 모달 표시 중 잔존 허용·완료 시 제거. 연결 모달은 `pendingConnectAssetId` state 기반(해시 비의존, [connect-dialog:87,100,130,178](../../src/app/(main)/_components/functions/cloud-sync/cloud-sync-connect-dialog.tsx)) ([provider:149-162,291-303](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **앱잠금 중 pull 차단(잠금 우회·인증키 삭제 방지)** — `autoPullIfNewer` 진입부 `if (isPwaLocked()) return`로 잠금화면 위 자동 pull(→`clearAssetData`) 차단. 잠금 해제 시 `PwaLockScreen`이 `PWA_UNLOCKED_EVENT`(`secretasset:pwa-unlocked`) 발행 → 폴링 effect 리스너가 즉시 1회 pull. `isPwaLocked`/`PWA_UNLOCKED_EVENT`는 `pwa-lock-screen.tsx` export 단일 소스 ([provider:221-245](../../src/lib/cloud-sync/cloud-sync-provider.tsx) · [pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx))
- ⚙ **3-상태 모델**: `none`(금고 미설정) / `locked`(assetId만 보유, 이번 세션 미무장) / `armed`(키 메모리 보유→자동 동기화). 마운트 시 `loadRememberedMaster` unwrap 성공+assetId 존재 → 자동 `armed`, 아니면 `locked`/`none` ([provider:124-146](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **자동 동기화** — 송신: 사용자 편집(`ASSET_USER_EDIT_EVENT`)·닉네임(`NICKNAME_EVENT`) → `userEditRef`+`changeTick` → `AUTO_PUSH_DEBOUNCE_MS=2500` 디바운스 무음 push. 수신: **`POLL_INTERVAL_MS=60000`(60s)** 폴링(`document.visibilityState==="visible"`일 때만)+`focus`+`visibilitychange`+effect 셋업 즉시 1회 → `fetchRemoteVersion > getVersion()`이면 자동 pull. (문서가 오래 "30s"로 적혀 있었으나 코드는 도입 이후 `60000` 불변 — 2026-08 정정)
- ⚙ **push 트리거 = 사용자 편집 신호만(2026-10)** — `ASSET_USER_EDIT_EVENT`(`saveData`·`addStockRaw`·`notifyAssetUserEdit()` — 무티커 스크린샷 등록·파일 가져오기·공유 반영) + `NICKNAME_EVENT` → `userEditRef`. 파생값 제외 payload 비교(구 `getComparablePayloadString`)·`lastPushedRef`·`skipNextChangeRef`는 **제거**됐다 — 제외 목록에 없는 파생 변화(2026-07 `baseDate`, 2026-10 daily 30일 롤링 절단·`dailyArchive` 이관)가 생길 때마다 조회만 한 기기가 push해 편집 기기에 "다른 기기의 변경을 반영했습니다" 토스트가 반복됐다. 파생 갱신(시세·코인·스냅샷·부동산·마이그레이션)은 `saveAssetData` 직접 호출로 신호를 내지 않는 것이 규약이고, 다음 사용자 편집 push에 함께 실린다. **새 사용자 편집 경로가 `saveData`를 우회하면 반드시 `notifyAssetUserEdit()`** — 누락 시 그 편집이 다른 기기로 안 간다. 비교 트리거 재도입 금지
- ⚙ **편집 대기 중 자동 pull 보류(시간 상한 필수)** — `autoPullIfNewer({ force })`는 `Date.now() - userEditAtRef.current < USER_EDIT_PULL_HOLD_MS`(디바운스 2.5s×4=10s)면 return한다. pull은 로컬을 통째로 덮어쓰면서 `userEditRef`까지 지우므로, 디바운스 대기 중 pull이 끼어들면 **방금 한 편집이 push되지도 복구되지도 않고 소실**된다(무음). **`userEditRef`(boolean)만으로 막으면 안 된다** — push 실패(오프라인·busy·conflict)로 플래그가 안 풀리면 타 기기 변경이 영구히 안 들어온다(과거 회귀). 409 conflict 화해는 `autoPullRef.current({ force: true })`로 이 보류를 우회 — conflict는 push가 서버에 거부된 상태라 pull이 유일한 진로다.
- ⚙ **pull 직후 되-push 없음** — `runPull` 성공 시 `userEditRef=false`(덮어쓴 로컬엔 대기 편집이 없다). 신호 기반이라 pull로 바뀐 `assetData`가 자동 push를 일으키지 않는다(구 `skipNextChangeRef` 불필요)
- ⚙ **서버 push는 원자적 CAS(2026-08 P0)** — `/api/sync` PUT의 버전 비교+저장은 `compareAndSetAssetEnvelope`([cache-storage.ts](../../src/lib/cache-storage.ts)) 단일 호출로 처리한다. 과거처럼 `getAssetEnvelope`(읽기)→비교→`setAssetEnvelope`(쓰기)로 쪼개면 두 기기가 거의 동시에 push할 때 **둘 다 버전 체크를 통과해(TOCTOU) 나중 쓰기가 먼저 쓰기를 조용히 지운다(lost update) — 어느 쪽도 409를 못 받는다.** Upstash는 Lua 스크립트(`redis.eval`)로 GET→비교→SET을 Redis 내부 단일 원자 연산으로 실행하고, 로컬 `FileCacheStorage`는 읽기·비교·쓰기를 **중간 `await` 없이 동기 fs 호출로만** 구성해 같은 보장을 만든다. pubKey 교체 불가(403) 체크만 원자성 밖(사전 체크, 최악도 데이터 손실 아닌 거부)
- ⚙ **pull의 기준점(syncedIds) 병합(2026-08 P0)** — `applyImportedPayload`가 pull 한정으로 덮어쓰기 직전 로컬을 읽어 **원격에 없는 로컬 항목 중 "아직 서버에 올라간 적 없는 것"만 되살린다**(`reconcileAdditiveMerge`, state-and-utils 참조). 없으면 "A가 추가 → B가 편집하다 409 → 복구 pull이 로컬 통째 교체 → B의 추가분 소실"이 정상 멀티기기 사용에서 구조적으로 반복됐다. **판별 기준점이 반드시 필요하다** — 삭제가 tombstone 없이 배열 제거라 "로컬에 있고 원격에 없다"만으로는 신규 추가와 원격 삭제를 구분할 수 없고, 무조건 되살리면 **다른 기기의 삭제가 부활해 재-push까지 되어 삭제가 무력화**된다(R28). 되살린 게 있으면 `runPull`이 `runPushRef.current(true)`로 **즉시 재-push**한다. 기준점은 pull 시 **병합 전 원격 키**로, push 시 **push한 키**로 갱신(순서 틀리면 지켜낸 자산을 다음 pull이 스스로 지운다). 같은 id를 양쪽이 다르게 수정한 충돌은 여전히 원격 우선(범위 밖). `connect`는 `merge:false`로 원격 완전 대체(S2 "자산 동일"), `unlock`은 병합
- ⚙ **온라인 복귀 시 pull-first 보장(2026-08)** — armed 폴링 effect가 `window "online"` 리스너로 `autoPullRef.current({ force: true })`를 호출한다. 없으면 오프라인 중 쌓인 디바운스 push가 다음 폴링(최대 60초)보다 먼저 나가, 오프라인 동안 다른 기기가 올린 변경을 모르는 채 충돌 경로로 들어간다(마운트 pull-first와 같은 취지)
- ⚙ **pull은 "없으면 유지"** — 원격 payload에 스냅샷 키가 없으면(`buildExportPayload`는 스냅샷이 비면 키 자체를 넣지 않음) `clearAssetData`가 지운 로컬 daily/monthly를 **되돌려 쓴다**. 미보완 시 스냅샷 없는 새 기기가 push한 걸 기존 기기가 pull하면 이력이 통째로 증발한다(`dailyArchive`는 이미 merge 복원).
- ⚙ **pull 후 전체 동기화(R-신규)** — `runPull`·`armWithPull`(연결)은 복원 직후 `refreshData()`가 아니라 **`initAndSync(getAssetData())`** 호출 → 환율→주식 현재가→스냅샷 전체 재동기화. `refreshData`는 진행 중 sync만 취소하고 오늘자 주식·환율을 갱신하지 않아, 양쪽 기기 모두 자산 보유 시 pull 후 시세 미갱신 버그가 있었음. `initAndSync` 진입의 `syncTodayStockPrices`가 이전 sync abort·`saveSnapshotsBlockedRef=false`·`dataResetVersion++`를 모두 수행(기존 `refreshData` 역할 포함) ([provider:205,280](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ `crypto.ts` 키 파생(결정적): `deriveSalt = SHA-256("secretasset-salt|"+assetId)[:16]`(서버 미전송, 접두 불변) → `masterBits = PBKDF2(passphrase, salt, 200k, SHA-256, 32B)` → `encKey = HKDF(info"enc")`(AES-256-GCM) + `ed25519Seed = HKDF(info"ed25519")`(Ed25519 키쌍). `generateAssetId()` 128비트 base64url. 전송=iv·ciphertext·pubKey(1회)·서명뿐
- ⚙ `device-key.ts`: remember 시 `masterBits`만 **기기 비추출(non-extractable) AES-GCM 키**(IndexedDB `secretasset_kv`)로 wrap → `rememberedKey`(평문 금지). IndexedDB는 `clearAssetData`(localStorage 한정)에 안 지워짐
- ⚙ `sync-state.ts`: `SYNC_STATE_KEY = "secretasset_sync"` 단일 키. `assetId/version/lastSyncedAt/rememberedKey`. salt·privKey·pubKey 미저장
- ⚙ `sync-client.ts` `makeAuthToken`: canonical=`[method, assetId, ...extra, ts, nonce].join("|")`. nonce 12바이트 base64url, ts 초단위
- ⚙ `pushAsset`: AES-GCM 암호화 → PUT `/api/sync`. canonical extra=`[baseVersion, sha256(ciphertext)]`. 409 → `{status:"conflict", remoteVersion}`
- ⚙ `pullAsset`: GET `/api/sync` → AES-GCM 복호화 → `applyImportedPayload`(검증 실패 throw→기존 보존). 404→`empty`, 401/복호화 실패→error
- ⚙ `fetchRemoteVersion`: GET `/api/sync?meta=1` — 미존재/오류 → `null`
- ⚙ **서버([route.ts](../../src/app/api/sync/route.ts))**: TOFU 최초 등록은 `body.pubKey`로 검증, 기존 금고는 저장된 pubKey로만 검증 + `pubKey` 교체 시도 시 **403**. `current.version > baseVersion` → **409**(낙관적 동시성, version+1). `SIG_FRESHNESS_SEC=300`(±5분), `MAX_CIPHERTEXT=4MB`→**413**, PUT만 `checkRateLimit`(IP)→**429**. Redis `csync:asset:{assetId}` + `CSYNC_TTL_SECONDS` 슬라이딩 만료(get 시 expire 갱신) ([cache-storage.ts:548-558](../../src/lib/cache-storage.ts))

#### 정밀 실행 시나리오(👤 단계별 — 사전조건→단계→기대)
- **S1 신규 금고(none→armed)**: 더보기>기기 동기화 → 금고 암호(8~50자, **영문 소문자+숫자+특수문자 필수** `validatePassphrase`) → "동기화 시작"(`enableSync`: generateAssetId→clearSyncState→첫 push TOFU) → armed, 복구 링크/QR/`sync:` 코드 노출
- **S2 링크 진입 연결**: 다른 기기에서 `#sync=<assetId>` 열기 → `CloudSyncConnectDialog` 자동(pendingConnectAssetId, sync 코드 readOnly) → 금고 암호만 입력 → `connect`→pull→armed, 자산 동일(로컬에 자기 자산이 있었어도 원격으로 **완전 대체** — `pullAsset(..., { merge: false })`, 남의 금고에 로컬 잔여 항목을 섞지 않는다)·튜토리얼 전체 스킵(`skipAllTutorialSteps`). **모달이 닫히지 않고 유지되는지**(R20: 여는 틱 replaceState 금지). **dev(StrictMode)는 mount-unmount-remount로 노출→닫힘→재노출 깜빡임이 정상** — prod(`npm start`)는 단일 노출(초기 로드 hashchange 미발화). 자산 0개면 웰컴가이드 위에 표시
- **S3 수동 코드 연결**: none 화면 "기존 기기 동기화 연결" → `sync:xxxx`(assetId 정규식 `^[A-Za-z0-9-_]{20,24}$`) → 연결. `/`·`#`·`?` 포함 시 "복구 링크는 주소창에" 거부
- **S4 PWA 첫 실행 연결**: standalone+자산 0개 → `PwaConnectPrompt` 전체화면 → `sync:` 붙여넣기 → `#sync=` 해시 설정 → 금고 암호 모달. `share:` 코드는 `importSharedByCode`(PIN 경로)
- **S5 잠금 해제(locked→armed)**: rememberedKey 없는 재진입 → locked → 금고 암호 → `unlock`(armWithPull). remember 재선택 가능
- **S6 충돌(409)**: A push 후 B가 stale baseVersion push → conflict → "클라우드가 더 최신…" 토스트 + 자동 pull(`autoPullRef.current()`)로 수렴
- **S7 암호 오류**: 틀린 금고 암호 → pull 401/복호화 실패 → "금고 암호가 올바르지 않습니다." + **기존 로컬 데이터 보존**(keysRef null 복귀)
- **S8 기억/해제**: remember ON→`saveRememberedMaster`→재진입 무암호 자동 armed. armed 화면 "이 기기 연결 끊기"(`forget`)→clearSyncState→none
- **S9 pull 후 자격 재기록(전제 무효 — 중복 방어로 유지)**: `clearAssetData` keepKeys에 `STORAGE_KEYS.syncState`가 **이미 포함**되어 `secretasset_sync`는 삭제되지 않는다. `runPushAfterRestoreFix`의 재기록은 현재 no-op에 가까운 이중 방어다(2026-08 확인). 코드·주석의 "clearAssetData가 secretasset_sync를 지움" 서술은 낡음
- **S10 push-loop/동시성 가드**: 조회만 한 기기(편집 없음)는 시세·스냅샷 갱신 후에도 push하지 않음 → 편집 기기에 "다른 기기의 변경" 토스트 미노출. pull 직후 디바운스 push 미발생, `busyRef` 뮤텍스로 push/pull 동시 실행 차단("동기화 중입니다.")
- **S11 앱잠금+동기화 첫 진입(P0 회귀)**: 앱잠금 ON + remembered 기기 첫 진입 → 잠금화면 위에서 자동 pull·**자동 push 모두 미실행**(`isPwaLocked()` 가드 양쪽). PIN 해제 → `unlockAndLoad` 완료 후 `PWA_UNLOCKED_EVENT` → pull로 다른 기기 변경 반영(F-APPLOCK 해제 순서 참조 — 병렬로 두면 서로 덮어씀). **해제 후 PIN 재검증 정상**(pull의 `clearAssetData`가 `secretasset_pwa_auth_*` 보존 → "비밀번호 불일치" 버그 없음)

#### 엣지·회귀
- 엣지: 첫 pull(404→`empty`), 서명 만료(ts±300s 초과→401), assetId 없는 상태 push/pull 차단("잠금 해제가 필요합니다."), 4MB 초과(413), 동일 출처 XSS는 device-key decrypt 호출 가능(완전 방어 아님, 표준 완화)
- 회귀: `clearAssetData` 후 `SYNC_STATE_KEY` 재기록(S9), 자동 push는 사용자 편집 신호만(파생 변경·pull로 무한 push 루프 없음), **`clearAssetData` keepKeys에 `secretasset_pwa_auth*` 보존(S11 앱잠금 해시 유실 방지)**

### F-SYNC. 가격·환율 동기화
- 👤 종목 현재가·환율(USD/JPY) 자동 갱신, 갱신 완료 토스트
- 👤 **기기 동기화 pull 후 시세 갱신** — 다른 기기 변경 반영(pull) 직후 "오늘의 주식 및 환율 정보를 모두 업데이트했습니다." 토스트가 뜨고 현재가·환율이 갱신되는지(양쪽 기기 모두 자산 보유 상태에서)
- ⚙ `getStockCacheSlot` 장중 1시간/장외 날짜 슬롯, outdated 판정, 3개씩 배치+1초 간격
- ⚙ **국내주식 실시간가**(`fetchStocksFromKorea`, `inquire-price`/`FHKST01010100`): 과거엔 `search-stock-info`의 `thdt_clpr`(당일 종가)를 썼으나 실시간성이 부족해 실시간 현재가 필드(`stck_prpr`)로 전환. 종목명·시장구분("코스피"/"코스닥"/"국내ETF")은 `kr-master.ts`(로컬 정적 마스터, API 호출 없음)로 대체 — `inquire-price` 응답엔 해당 필드 없음
- ⚙ **국내주식 분류(KOSPI200 등) 90일 캐시 분리**: 가격(1시간 슬롯)과 별도로 `fetchDomesticClassifications`(`search-stock-info`)를 90일 분류 캐시(`storage.getStockClassification`)가 없는 티커에만 호출 — 최초 등록 시에만 가격+분류 2회, 이후 매시간은 가격만 1회
- ⚙ **국내 레이트리밋 방어**: 해외 조회와 동일하게 티커 간 350ms 간격, `msg_cd=EGW00201`(미검증) 감지 시 500ms 대기 후 1회 한정 재시도 후 skip(무한 재시도 금지). 개별 티커 실패는 try/catch로 격리돼 배치 전체에 영향 없음
- ⚙ **휴장일 slot 고정(R23)** — 국내·해외 영업일 판정을 `isInSession` 체크보다 **먼저** 수행해, 휴장일(주말·공휴일)은 시간대·세션모양과 무관하게 직전 영업일(`rollbackToBusinessDay`/`rollbackToUsBusinessDay`)로 slot을 고정한다. 과거엔 `effectiveDate`(달력 날짜)가 휴장 중에도 매일 바뀌어 매일 실시간 재조회가 발생, quote 미세 흔들림이 원인분해에 "휴장일 시세 변동"으로 허위 노출됐다(F-ACTIVITY 연계)
- ⚙ **해외 개장 전(pre-open) flat 라벨 고정(R24)** — 해외 마감 컷오프(`getEffectiveDateStr("foreign")`=07:00 KST)가 개장(17:00 DST/18:00 STD KST)보다 훨씬 일러, 07:00~개장 전 구간에서 "오늘" flat 라벨에 "어제 종가"가 캐싱되고 이 라벨이 이후 휴장일 롤백 결과와 우연히 동일해지면(예: 금요일 오전 캐싱 → 토요일 롤백도 "금요일") 클라이언트의 `baseDate===currentSlot` 판정이 재조회를 스킵해 하루 이상 stale한 값이 노출됐다. `getStockCacheSlot`에 `beforeTodaysOpen`(오늘 영업일이지만 세션 개장 전) 분기를 추가해 이 구간엔 직전 영업일로 명시적 롤백하도록 수정(2026-08-22, TSLA 실사용 사례로 발견)
- ⚙ pull(`runPull`/`armWithPull`)이 `initAndSync` 경유로 시세 동기화 트리거 — 마운트·0→양수 외 추가 진입 경로(F-CLOUD-SYNC 자동 동기화)
- 엣지: 데이터 삭제/불러오기 중 sync abort(epoch+AbortController), 취소된 응답 미반영
- 회귀: foreign+KRW→USD 마이그레이션, market 캐시 비었을 때 재조회

### F-SNAPSHOT. 자산 스냅샷
- ⚙ 일별(이번 달)·월별(**최근 13개월 롤링**, `pruneMonthlySnapshots` — #4.34에서 `startsWith(올해)` 필터의 1월 전년분 삭제 결함 수정, 스키마·키 불변)·년도별 종가 기준 저장, 토/일 보완. 동기화 pull(`keepLocalSnapshots`)은 월 스냅샷을 **월 단위 병합**(`mergeMonthlySnapshots`: 로컬 전용 달 보존, 같은 달은 수신값 — 단 수신값에 `breakdown`이 없고 로컬에 있으면 로컬) 후 13개월 롤링 — 구버전(올해분만 보존) 기기가 섞여도 신버전 기기 보존분이 줄지 않음(`monthly-sync-merge.test.ts` 순환 증명). 파일 가져오기·공유 링크는 기존처럼 교체. 일별은 교체 그대로
- 회귀: `saveSnapshotsBlockedRef` 차단, tickerList 정렬, 종가(refPrice) 폴백

### F-NAV. 네비게이션 (drill-down)
- ⚙ **FAB 과거 순자산(#4.49)** — 연 탭 이동 후 입력창 1개(타이머 없음, 연타 시 1개), 이동 중 이탈 후 3초 경과 시 자동 열림 0
- 👤 `#detail/stocks` 직접진입·새로고침·뒤로가기, InlineSelector 탭 전환, scrollTo(0,0)
- ⚙ **콜드스타트 뒤로가기 폴백은 항상 홈(R31)** — `settings`/`tax`가 `history.length<=1`(딥링크·새 세션 진입 등)일 때 `navigate({type:"home"})` 직행. `settings`를 과거처럼 `"more"`로 보내면, `more`의 back()이 다시 `history.length` 의존적(`history.back()`)이라 **설정↔더보기를 오가며 홈에 도달 못하는 루프**가 발생(더보기 화면 라벨은 "홈"인데 실제로는 되감아 설정으로 돌아감)
- ⚙ **옛 성과 해시 리다이렉트(#4.34)** — `#activity/netasset` → 자산 변화(전체·연), `#activity/profit` → 자산 변화(주식·일). `parseHash`가 `init`을 붙이고 첫 진입 시 주소창을 `#activity/change`로 `replaceState`. FAB 연도별 순자산 입력·성적표 growth 축 링크(→ 전체·연)·허브 자산 변화 카드도 `init`으로 탭 지정
- ⚙ **시장과 비교 뒤로(#4.73 K3)** — `navigate()`로 들어왔으면 뒤로(버튼·브라우저) = `history.back()`(상세·주식은 정렬 선택 유지, 자산 변화는 `rememberChangeInit`(모듈 메모리)로 기억한 주식·기간 복원 — `withRestoredChangeInit`, history.state 미사용: Next가 `__NA` 없는 state pop을 새로고침함), 주소 진입·새로고침 뒤 뒤로 = 자산 변화(주식·주). 뒤로 라벨 `뒤로`. 앱 안 좌우 스와이프는 기존대로 1차 메뉴 이동. 자동 `market-compare-nav.test.ts`
- ⚙ **종목 한 장 뒤로(#4.81)** — `tradesBackAction`·`stockPageBackAction`·`guardStockPageView`(store 비면 상세·주식으로 `replaceState`, 첫 진입·popstate 모두) — `src/lib/__tests__/stock-page-nav.test.ts`
- 엣지: 잘못된 hash 폴백, `back()` 항상 홈 복귀, 웰컴가이드 시 헤더 미노출

### F-PWA. PWA 설치 및 오프라인 접근성 ([pwa](../../src/app/(main)/_components/pwa))
- ⚙ `manifest.ts` (/manifest.webmanifest) 동적 JSON 응답 및 `share_target` 매핑 설정 정상 동작 확인
- ⚙ `layout.tsx` `appleWebApp` 메타데이터(`capable: true`, `statusBarStyle: "black-translucent"`) 및 `icons.apple`(`/icons/icon-192x192.png` 180×180) 포함 출력 확인
- ⚙ 서비스 워커 `/sw.js` 성공적인 브라우저 등록 및 static 에셋 오프라인 로컬 캐싱(Stale-While-Revalidate) 보장
- ⚙ `usePWAInstall`: `isIOS`·`isInApp`은 **`detectBrowserEnv()` 단일 소스 위임**(`platform==="ios"`/`isInApp`). **iPadOS 13+ 데스크톱 위장 UA(Macintosh) → `maxTouchPoints>1`로 iPad=iOS 인식**(미인식 시 iPad가 PC로 빠져 설치·코드복사 흐름 깨짐). standalone 제외 처리 확인
- ⚙ `detectBrowserEnv()` ([lib/pwa/detect-browser.ts](../../src/lib/pwa/detect-browser.ts)) → `BrowserEnv { platform: "ios"|"android"|"pc", browser: GuideBrowser, isInApp, iosSafariModern }`. `GuideBrowser` = `safari`/`chrome`/`whale`/`samsung`. flow에서 `useEffect(setEnv(detectBrowserEnv()))`로 마운트 후 1회 감지. **`iosSafariModern`** = iOS 순정 Safari + 메이저 **≥ 18**(`IOS_SAFARI_MODERN_MAJOR=18`, `parseIosMajor`: `os N_` 우선, iPad 위장 UA는 `version/N` 폴백) → 신형 가이드(`IosSafariNewShareStep`: 하단 단일 바 **⋯ 더보기 메뉴**→공유, iOS 18 도입). **iOS 17 이하는 구형(`IosShareStep`: 하단 공유 버튼 직접 탭)** — iOS 18부터 ⋯ 메뉴 안에 공유가 들어가는 UI 변경 반영(이전 임계값 15는 iOS 17.6.1을 신형 오분류). **iPad(iPadOS 13+)는 Macintosh UA+`maxTouchPoints>1`로 iOS 판별** — UA만으론 PC 오인식(회귀 위험). 브라우저: crios=chrome / whale=whale / 그 외 safari, samsungbrowser=samsung(Android)
- ⚙ **설치 흐름 단일화** — 설치 다이얼로그+로직(state·`handleButtonClick`·`handleInstall`·`generateShareArtifacts`·iOS/인앱/동기화 분기)은 공용 컴포넌트 [pwa-install-flow.tsx](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx) 단일 소스. 트리거는 children(render-prop, `{ onClick, loading, isIOS, isInApp, isInstallable }`)로 주입. [pwa-install-button.tsx](../../src/app/(main)/_components/pwa/pwa-install-button.tsx)는 다운로드 아이콘 버튼만 전달하는 얇은 래퍼. **홈 버튼·웰컴가이드가 동일 흐름 공유** — 한쪽만 수정 시 회귀 주의
- ⚙ **설치 가이드 단일화** — 옛 `PwaInstallGuideDialog`(3탭 다이얼로그) 제거 → [pwa-install-guide-content.tsx](../../src/app/(main)/_components/pwa/pwa-install-guide-content.tsx) `InstallGuideContent({ env })`로 통합. flow의 `iosStep`·`guideStep` 모두 동일 컴포넌트 임베드. 모바일=설치 애니메이션+step1/step2 설명+"다른 브라우저인가요?" 칩 재선택(오감지 대비)+접이식 "설치가 안 되나요?", PC=시크릿모드/`chrome://apps` 재설치/Firefox 미지원 문제해결
- ⚙ iOS·Android step SVG([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)) `InstallGuideAnimation({ platform, browser })`는 **실제 브라우저 UI 구조 반영(주소창 하단)**: Safari=하단 중앙 `공유`→`홈 화면에 추가` / Chrome(iOS)=주소창 우측 `공유` 직접 / Chrome(Android)=우측상단 `⋮`→`공유` / Whale=하단 우측 `≡`→`공유` / 삼성인터넷=하단 `☰`→`+ 현재 페이지 추가`→홈 화면. step1/step2 안내 문구(`step1Text`/`step2Text`)도 각 구조와 일치. **aspect-ratio 미지원(구형 Safari) 대비 `paddingTop` 스페이서로 220:290 비율 폴백**
- ⚙ **SVG 애니메이션 공용화**([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)) — 모든 단계형 애니메이션이 공용 `StepAnimationPlayer`(캡션 옵션·**멈춤/시작 버튼**·단계 점 클릭 이동·`resetKey`)에 위임. 컷 간격 **3000ms 통일**, `prefers-reduced-motion` 시 자동재생 끔. `SyncSetupAnimation`=기기 동기화 4컷(① ⋯더보기[가로 점]→간편공유·기기동기화 가로 카드 → ② 금고암호 → ③ 동기화 링크 → ④ **새 기기**[teal `tone="new"`+`DeviceBadge` "새 기기" — 실제 다른 기기]). **노출 위치는 [cloud-sync-menu-entry.tsx](../../src/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx)의 `status === "none"`(동기화 시작 화면)** — 4.18 공지 개편으로 공지에서 이 화면으로 이전
- ⚙ **PWA 가이드 단일화**([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx) `PwaSetupAnimation({platform,browser})`) — **공지(notice)와 설치 가이드(`InstallGuideContent`)가 동일 컴포넌트 공유**(구 `InstallGuideAnimation` 제거). **①앱 설치(복원 코드)·④앱(PWA) 첫 실행 복원**(같은 기기 — 기본 frame + brand `DeviceBadge` "앱 (PWA)", 동기화의 "새 기기"와 구분 / 동기화=금고암호·일반=PIN 4자리 2케이스)은 공통, **②③은 `getGuideSteps(platform,browser)`로 접속 브라우저별 공유/메뉴→홈 화면 추가** SVG. PC(`platform==="pc"`)는 네이티브 설치라 ②③ 생략(공통 2컷). 브라우저 재선택 칩 변경 시 `resetKey`로 ②③ 즉시 갱신. **iOS Safari는 `iosSafariModern`(UA iOS 메이저 ≥ 18)로 신형(⋯메뉴→공유)/구형(중앙 공유) SVG·step1 문구 분기**. 컷 간격 **3000ms**
- ⚙ **구형 iOS Safari 컷 미전환 버그 수정** — 원인=opacity로 스택된 컷 레이어의 repaint 누락(구형 Safari)으로 다음 컷 안 바뀜. 해결=**활성 컷 1개만 렌더 + `key={active}` remount**(`StepAnimationPlayer`)로 모든 브라우저 전환 보장. 진입 페이드는 `motion-safe:animate-in fade-in`. 자동 전환은 콘텐츠 진행이라 reduced-motion에서도 동작(페이드만 비활성), 멈춤 버튼으로 정지. opacity 스택 레이어 방식 재도입 금지
- ⚙ **컨트롤 클릭성** — 멈춤/시작·단계 점은 `pointer-events-auto`로 공지 본문(`pointer-events-none`) 안에서도 동작. 점은 `size-3`+`after:-inset-2` 히트영역, 클릭 시 해당 컷 이동+일시정지
- 👤 완전 오프라인(네트워크 단절) 상태에서 앱 새로고침 시에도 자산 대시보드 화면이 에러 없이 로컬 스토리지로부터 정상 로드 및 렌더링되는지 확인
- 👤 **PC/Android Chrome·Edge**: `beforeinstallprompt` 발생 → 설치 버튼 클릭 → PIN 4자리 입력 → 설치하기 → 네이티브 A2HS 창 열림 확인
- 👤 **iOS(Safari·크롬·웨일 등)·Android(크롬·웨일·삼성인터넷)**: 설치 버튼 클릭 → PIN 입력 → "추가 방법 보기" → `iosStep` 가이드(`detectBrowserEnv` 감지 브라우저의 설치 애니메이션 + step1/step2) 노출. `navigator.share()` 호출 없음, Safari 한정 문구 없음 확인. 오감지 시 "다른 브라우저인가요?" 칩으로 재선택
- 👤 가이드 step SVG·문구가 실제 스샷과 일치하는지(브라우저별 공유/메뉴 진입 위치). 칩 재선택 시 애니메이션·step 문구가 즉시 해당 브라우저로 갱신
- 👤 **인앱 브라우저(카카오톡·인스타·페북·라인 등)**: 설치 버튼 클릭 → `inAppStep` 가이드(메뉴→다른 브라우저로 열기→앱 설치) 노출, 현재 URL 클립보드 복사 시도 확인
- 👤 **설치 불가 상태(고스트)**: PC에서 `beforeinstallprompt` 없을 시 `guideStep`(제목 "앱 설치 가이드") + `InstallGuideContent` PC 문제해결 노출 — 시크릿모드 불가 콜아웃, `chrome://apps` 자동/수동 복사, Firefox 미지원 주의. 모바일은 접이식 "설치가 안 되나요?"에 인앱·재설치 안내
- 👤 PWA 외부 공유 대상(Web Share Target)을 통해 자산 동기화 링크가 공유 되었을 때, 진입 즉시 쿼리 파라미터(`url`/`text`)에서 해시를 추출하여 연결/복구 창으로 즉각 라우팅하는지 확인

#### 인앱 브라우저 하드 게이트 (R22)
- ⚙ **게이트 렌더 조건**([in-app-browser-gate.tsx](../../src/app/(main)/_components/pwa/in-app-browser-gate.tsx)): `resolveInAppGate` — 일반 브라우저·PWA standalone은 `null`(앱 정상) / 인앱 + 로드 전 = 문구 없는 빈 덮개(`inapp-gate-cover`) / **인앱 + 자산 0건 + 공유 대기·동기화 assetId·복원 해시(share·sync·asset·vault, 첫 렌더 캡처) 없음 = 게이트 미렌더 → 웰컴 inapp 슬롯**(#4.38) / 그 외 = 같은 노드에 현행 게이트(`layout.tsx`에 `AssetDataProvider`·`CloudSyncProvider` 하위 마운트)
- 👤 **인앱 도착(#4.38)**: 카톡 UA + 0건 + 해시 없음 → 웰컴, 슬롯 `data-state=inapp`, `welcome-cta-wizard`·`welcome-cta-more`·설치 버튼 부재. Android 버튼 → `kakaotalk://`/`intent://`, iOS → 주소 복사 + `welcome-inapp-guide` 0fr→1fr, "주소가 복사됐어요…" 1회·"앱 설치 기능" 문장 없음. 1건 이상·`#share`·`#sync`·동기화 보유 → 로드 전 빈 덮개 → 같은 노드에 현행 게이트. 설치 흐름·1건 이상 게이트의 iOS 가이드는 기존 문구(`notice` 미전달)
- ⚙ **인앱 감지 토큰**: 기존 + `barcelona`·`daumapps`·`band/`. 양성(Threads·다음·밴드)·음성(Chrome·Safari·삼성·웨일·Edge·Firefox iOS/Android, 데스크톱) UA 고정 테스트 `src/lib/__tests__/detect-browser-inapp.test.ts`. 실기기 UA 미수집(C9, 추정)
- ⚙ **외부 이동 유틸**([open-external-browser.ts](../../src/lib/pwa/open-external-browser.ts) `openExternalBrowser`): Android 카카오톡=`kakaotalk://web/openExternal?url=`, Android 그 외=`intent://<host><path>#Intent;scheme=https;S.browser_fallback_url=<enc>;end`(원본 해시는 intent `#Intent` 구분자 충돌 방지 위해 fallback_url에만 담음), **iOS=`false` 반환**(자동 이동 스킴 없음→호출측 수동 폴백)
- ⚙ **자산 이동 분기**: 자산 없음→origin URL 이동 / 자산 있음→PIN 4자리 입력 후 `useShareArtifacts().generateShareArtifacts(pin)`로 `#share=` URL 생성 이동(실패 시 origin 폴백) / 동기화 기기→PIN 없이 `syncLink` 이동. iOS는 `go()`(`useExternalMove`, #4.38 게이트·웰컴 공용)가 제스처 보존 `ClipboardItem` Promise로 대상 URL 복사 후 `InAppExternalGuide`(3단계 수동 가이드, `pwa-install-flow` inAppStep과 공용) 노출
- ⚙ **자동 동작 차단(R22)**: 게이트 활성 시 `isInAppGateActive()`로 cloud-sync 자동 arm·`#sync=` 모달·`initAndSync` 시세/스냅샷·0→양수 동기화 전부 차단(데이터 로드·assetId/syncLink는 유지)
- 👤 PC Chrome DevTools 커스텀 UA로 카카오톡(Android)/네이버/인스타/iOS 카카오톡 진입 → 게이트 노출, Android는 스킴 이동 시도·iOS는 주소 복사+가이드. 일반 UA 복귀 시 게이트 사라짐. Network 탭에 `/api/sync`·`/api/finance` 자동 요청 없음, 동기화 기기 UA에서 연결 모달 미노출

#### PWA 설치 정밀 시나리오 (isSyncMode 분기)
- ⚙ **isSyncMode 분기**([pwa-install-flow.tsx:84-88,135-181](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx)): 설치 시 `getAssetId()` 존재(동기화 기기) → **PIN 불필요**, 코드=`sync:<assetId>`(서버 업로드 없음). 비동기화 → **PIN 4자리(InputOTP) 필수** + 코드=`share:KEY_LOCALKEY`(공유 토큰 `/api/share` POST 저장). `codeLabel`도 "동기화 코드"/**"복원 코드"**(구 "연결 코드" 전면 개명)로 구분
- ⚙ **인앱 복사 sync 분기**(`openInAppGuide`): 동기화 기기(`isSyncMode`)는 서버 share 토큰 업로드 없이 **`useCloudSync().syncLink`(`#sync=<assetId>&theme=` 복원코드 링크) 즉시 복사**(동기 값이라 `writeText` 1회). 비동기화는 기존 `generateShareArtifacts`→`#share=` 경로 유지. 외부 브라우저 진입 시 `#sync=` 감지→금고암호 연결 모달(동일 기기 내 연동) ([pwa-install-flow.tsx](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx))
- ⚙ **iOS 클립보드 보존**: `await fetch` 뒤 `writeText`는 제스처 만료로 실패 → `ClipboardItem`에 Promise(text/plain) 동기 전달로 자동 복사 보존 → 실패 시 `writeText` 폴백([pwa-install-flow.tsx:153-168](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx)). 인앱 가이드(`openInAppGuide`)의 비동기화 경로도 동일 기법으로 현재 URL 복사
- ⚙ `usePWAInstall`: `isInstallable`/`isIOS`는 `&& !isStandalone`로 노출, `__bipEvent`(head 캡처) 우선 사용해 제스처 내 `installPWA` 호출([use-pwa-install.ts](../../src/hooks/use-pwa-install.ts))
- 👤 **P1 PC/Android Chrome·Edge**: `beforeinstallprompt`(또는 `__bipEvent`) → 버튼 클릭 → 즉시 네이티브 A2HS(`installPWA`), 성공 토스트
- 👤 **P2 iOS/인앱**: iOS=PIN/코드 준비 후 `iosStep`(STEP1 홈추가 + STEP2 코드 붙여넣기), 인앱=`inAppStep`(외부 브라우저 유도+URL 복사)
- 👤 **P3 동기화 기기 설치**: isSyncMode → PIN 입력란 없음, "설치하기" 후 `sync:<assetId>` 자동 복사. 새 기기 앱 첫 실행 → `PwaConnectPrompt`에 붙여넣기 → 금고 암호로 복원(F-CLOUD-SYNC S4)
- 👤 **P4 비동기화 설치**: PIN 4자리 → `share:` 코드 자동 복사 → 새 기기에서 붙여넣기 → PIN 입력 복원
- 👤 **P5 설치불가 고스트(PC)**: `beforeinstallprompt` 없음 → `chrome://apps` 자동 복사 + `guideStep`(InstallGuideContent PC 문제해결)
- 👤 **PWA 홈 락업(#4.66 logo-spec·R6·R8)** — standalone 홈 맨 위 줄 왼쪽 Leckerli One S(파비콘과 같은 모양) + "시크릿에셋": 375 S 잉크 높이 15.25±0.2·워드마크 13±0.1, S 잉크 좌측 = 카드 외곽 12 − 0.4(lg 48 − 0.46), 잉크 간격 4.76±0.2(lg S 17.6·간격 5.49), 두 잉크 중심 차 0.25(lg 0.3), 심볼·워드마크 같은 색(`--brand-logo` 다크 #F2F3F6/라이트 #111111), 320 가로 스크롤 0·인증카드와 겹침 0. 브라우저 모드는 심볼만 32px 박스

### F-4.85. 첫 등록 준비·정돈 묶음 (#4.85, #166)
- ⚙ **GA**: `onboarding_action` method별 page_title `웰컴·스크린샷 등록|직접 입력|가져오기|동기화 연결|웹에서 시작|체험`(1:1), `first_asset_saved` = `첫 자산 저장·*`(`ga.test.ts`). 전송은 page_title·page_location만(맞춤 정의 0).
- ⚙ **튜토리얼**: 단계 1·3·4·5(2단계 '더보기' 삭제, 말풍선 `n / 4`), 저장 키 `secretasset_tutorial_status` 형식 불변(이전 값의 2단계 pending도 정상 이어짐·완료), PWA는 1단계 자동 건너뜀(`tutorial-cleanup.test.ts`).
- ⚙ **시세 대조 부분 실패**: 429·5xx면 캐시 저장·완료 콜백 없음, 재시도 실행당 1회·Retry-After 10초 초과 시 없음, 실패 뒤 재호출은 재조회(`profit-partial-failure.test.ts`).
- 👤 **배당 화면**(성과→배당) 320·375·1280: 막대 값 라벨이 겹치지 않고(겹치면 큰 값만), Y축 눈금이 등간격 둥근 값(`2만원·4만원`), 표 금액 `72,800원`이 한 줄(`dividend-axis.test.ts`).
- 👤 **상세 허브**: 0건 카드 보조 줄 `추가하기`, 누르면 해당 자산군 추가 시트(주식·부동산·암호화폐·현금·대출), 보유 카드는 기존대로 탭 이동, 실물 0건 숨김(`detail-hub-empty-cards.test.tsx`).
- 👤 **종목 한 장**: 평단 칩이 가격 칸 라벨과 6px 이상·격자선과 겹치지 않음, 라이트 로딩 문구가 배경 칩 위. 성과 허브 `자산 변화` 행이 구분선·쉐브론과 정렬. 더보기 `앱 가이드 · 새 소식` 선택창 문구가 보안 가이드 기준.
- 동승 확인(qa 1회): 튜토리얼 말풍선 아이콘 색 대비, PC 새 소식 시트 X 히트영역 40px.

### F-ONBOARD. 튜토리얼·온보딩 ([welcome-guide.tsx](../../src/app/(main)/_components/layout/onboarding/welcome-guide.tsx) · [app-guide.tsx](../../src/app/(main)/_components/header-menu/app-guide.tsx))
- 👤 웰컴가이드(자산 0개)에서 대시보드 미리보기 영역이 실제 `dashboard.tsx` 컴포넌트를 공통 사용하여 동일 포맷으로 노출되며, 미리보기 카드 내부의 클릭이나 모든 액션들이 완전 차단 및 방지되는지 확인, 앱가이드 단독 보기, 튜토리얼 step 진행/스킵
- ⚙ **루트 첫 화면 사전 조각(#4.61)**: 로컬 운영 빌드 `curl /` 원본 HTML에 h1 1개·`나만의 비밀 자산 금고`·부제·신뢰 3항목·`first-paint-shell`, `/?trial=1`에는 부재. 키 3개(`secretasset_asset_data`·`secretasset.physical_assets`·`secretasset-asset-data`) 중 하나라도 있으면 `html[data-has-assets]` → 조각 `display:none`(보유자 노출 0프레임). 0건 기기는 조각→웰컴 전환 시 h1·신뢰 줄 위치 이동 0·`getAnimations()` 0·h1 동시 ≤1·hydration 경고 0. 인앱 0건(해시 없음)은 `inapp-gate-cover` 0. 회귀 테스트 `onboarding/__tests__/welcome-intro.test.tsx`
- 👤 **첫 화면 순서(#4.35)**: 히어로 < 신뢰 한 줄(+자세히 보기) < 보안 상세 < 예시 순자산 < CTA 슬롯 < 주식 미리보기 (< 설치 박스: 데스크톱만). 375×812 스크롤 0(진입 모션 후)에 제목·신뢰 줄·순자산 금액·설치/바로 시작 버튼이 보인다. 접힘 상태 가시 텍스트에 PBKDF2·Ed25519·blob 없음, "로그인 없" 1회
- 👤 **보안 안내 문구(#4.38)**: 웰컴 보안 상세·앱가이드 카드 3쌍이 문자 단위로 같다(`SECURITY_COPY`). 구 문구 0건("절대 벗어나지"·"원천 불가"·"문제없습니다"·"(blob)"·"(pubKey)"·"E2EE 암호학적" — 정정 7파일+`security-copy.ts` 한정), 업로드 박스 4종 문구·클래스 동일·테두리 0, 동기화 메뉴 설명 마지막 문장 상수(preview에선 `cs.enabled=false`라 미렌더 → 정적 테스트). 320·375에서 "저장·/전송" 분리 0, 신뢰 한 줄 "… 저장 · / 원하면 암호화 동기화". 금고 암호 문장(cloud-sync-menu-entry·connect-dialog)·home-tip 백업 팁·config/app.ts 무변경. 자동: `src/config/__tests__/security-copy.test.tsx`
- 👤 **보안 상세 펼침**: 토글 1회 탭 → 3카드(`SECURITY_COPY`) 노출, 재탭 접힘, 새로고침 시 접힘(저장 없음). 같은 노드 유지(grid-rows 전환), 닫힘 `inert`·`invisible`. 토글은 gtag 호출 0
- 👤 **모바일 웹 미설치(#4.86)**: CTA 슬롯 `data-state=asset` — 설치 버튼·"웹에서 바로 시작"·캡션 없음(화면에 `웹앱 설치하기` 0개). "스크린샷으로 자산 등록"(brand) + "직접 입력 · 가져오기" 팝오버(직접 입력 라벨 + 부동산·주식·암호화폐·현금성 자산·대출 5행 → 구분선 → 가져오기 2행). 행 탭 → 팝오버 닫힘 + 해당 자산군 추가 창 1개, `onboarding_action{manual}` 1회(`asset_add_start` 없음). pending 셸 높이 모바일 216px = asset 높이(점프 0). 첫 저장 뒤 홈 #78 안내로 설치
- 👤 **데스크톱·standalone(설치된 앱)**: 슬롯 `asset`(자산 등록 CTA 바로 노출). 데스크톱 미설치는 주식 미리보기 아래 설치 박스(설치 버튼 1개)
- 👤 **링크 미리보기(#4.35)**: `og:image` = `${siteUrl}/og-image.png`(1200×630, 텍스트 "안전한 자산 관리,"·"시크릿에셋"만), `twitter:card=summary_large_image`. 이미지 교체 시 파일명 변경(크롤러 캐시)
- ⚙ 분기 키: `welcomeCtaState({ mounted, isStandalone, isInApp })` → pending/inapp/asset(#4.38 inapp은 mounted 다음 최우선, standalone이면 제외). 마운트 전 pending 빈 셸(hydration 불일치·깜빡임 없음). 회귀 테스트 `onboarding/__tests__/welcome-guide.test.tsx`(정적 마크업·GA 매핑·`PARAM_VALUES` 스냅샷·저장 경로 grep)
- ⚙ `app-guide.tsx`는 `useState/useEffect` 사용 → `"use client"` 지시어 필수(서버 컴포넌트 빌드 에러 방지)
- ⚙ `secretasset_tutorial_status` 단일 키, 마이그레이션(merge-tutorial-status)

### F-TRIAL. 체험 모드 `/?trial=1` ([trial-gate.tsx](../../src/app/(main)/_components/trial/trial-gate.tsx) · [trial-boot.ts](../../src/lib/trial/trial-boot.ts) · [trial-banner.tsx](../../src/app/(main)/_components/views/home/trial-banner.tsx)) — #4.38 #59, risk high
- 👤 **진입**: 웰컴(0건) ③ 행 "직접 둘러보기" 칩 → `feature_use{demo}` 1건(연타 1건, 이동 직전 실제 페이지) → 로딩 덮개(문구 0, 300ms 전 투명) → 체험 홈, URL 쿼리 제거. `#share`·`#sync` 해시·공유 대기 웰컴에는 칩 없음. 375에서 CTA 슬롯 top 불변, 320 배지만 둘째 줄
- 👤 **체험 홈**: `trial-banner` 1개(홈만, static), Hero "순자산"(닉네임 없음). FAB·상단 더보기/설치·하단 update/more 부재, 인증카드 유지. 상세 행 편집은 메모리만(새로고침 시 소멸). 성과·결산은 "기록 부족" 없이 월 결산·연 탭(작년 `@PY` 수동값)
- 👤 **네트워크**: 무조작 탐색 중 자동 시세 0건(`/api/finance?type=exchange|stock`·`/api/finance/crypto`·`/api/realestate`). 스크린샷 탭 업로드 → 합성 403 토스트 "체험 중에는 사용할 수 없어요", `/api/parse-screenshot`·`/api/share`·`/api/sync*`·`/api/feedback` 실제 요청 0. `/api/finance/dividend`·`/api/finance/profit`·`/api/xray-classify`(예시 티커)는 허용. `indexedDB.open` 0회
- 👤 **GA**: 체험 페이지 앱 gtag 호출 0(`settlement_view`·`page_view`·`asset_count_bucket` 포함), 인라인 스크립트가 `trial=1`에서 `ga-disable-<ID>`. 종료 복귀 웰컴 `onboarding_action{trial_start}` 1건
- 👤 **종료**: "내 자산으로 시작" → `/` 웰컴 슬롯 `asset`, `welcome-cta-wizard` 포커스, 원본 저장소 빈 상태. 새로고침·탭 닫기 = 일반 화면. 인앱 UA는 외부 이동(iOS 가이드 펼침)
- 👤 **데이터 안전(S1~S5)**: 원본 `secretasset_*` 키·값 해시가 진입·탐색·종료 후 불변(새 기기 체험 중 원본 키 0). 원본에 자산 1건 / 구버전 `secretasset-asset-data` / 손상 JSON / `secretasset_sync` / `secretasset_pwa_auth*` / 복원 해시 → 일반 화면, 원본 바이트 동일. 인앱 UA + 체험 → 인앱 게이트 미렌더. 다른 탭 실제 데이터 수정 → 체험 탭·원본 무해
- ⚙ **쿼리 없을 때 main과 동일**: TrialGate는 children 그대로(마크업 동일, 첫 렌더 지연 0). trial-boot 정적 import 0. preview `?demo=1` 데모 닉네임 '데모' 유지
- ⚙ 자동: `src/lib/__tests__/trial-boot.test.ts`(거부 판정·S1 모킹 ①~⑤·정상 경로·닉네임), `trial-guards.test.ts`(GA no-op·trackThenNavigate·가드·숨김 정적 검사), `trial/__tests__/trial-gate.test.tsx`, `preview-safety.test.ts` 9번(데모 JSON 동적 import = `demo-inject.ts`)
- ⚠ 알려진 한계(C9): iOS Safari·WKWebView·삼성 실기기 defineProperty 미검증(fail-closed), 인앱 체험 종료 후 `trial_start`·`inapp_move` 미집계, sessionStorage 미격리, 거부·실패된 1회 로드 GA 미집계, 상세·성과 예시 표기 없음

### F-ONBOARD-WIZARD. 스크린샷 일괄 온보딩 마법사 ([onboarding-wizard-flow.tsx](../../src/app/(main)/_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx) · [onboarding-wizard-status.ts](../../src/lib/onboarding-wizard-status.ts) · [onboarding-wizard-store.ts](../../src/stores/onboarding-wizard-store.ts)) — 명세 [S-4.29](../specs/4.29-onboarding-wizard.md)
- 👤 **#4.55**: 추가 스크린샷 실패·빈 결과·네트워크 예외 시 업로드 칸 자리에 박스(토스트 0), [다른 캡처 고르기]·[직접 입력으로 등록/잔액 고치기]. 마법사는 입력 폼 숨김 마운트 + `directInput="add"`, 직접 저장 시 단계 완료 1회(`wizard_step done` 1건). GA 실패 title `스크린샷 등록 실패·<자산>`. 홈 최신화 팁은 보유 자산군만. 연 탭 자동 prev 캡션 `· 고치기`(지난 연도 메모 빈 칸 시작).
- 👤 **자동 노출 없음**: 웰컴가이드가 항상 먼저 노출되어야 한다는 요구에 따라 `page.tsx`의 자동 오픈 effect(AC1)는 제거됨 — 자산 0건이어도 첫 진입은 항상 `WelcomeGuide`, 마법사는 CTA를 명시적으로 눌렀을 때만 열림
- 👤 **재진입**: 웰컴가이드 하단 "스크린샷으로 자산 등록" CTA에서만 `useOnboardingWizardStore().open()` 호출(더보기 메뉴의 동일 버튼은 중복이라 제거됨). `page.tsx`가 `isWelcomeGuide`보다 먼저 `isWizardOpen`을 체크해 마법사를 렌더
- 👤 **재노출 억제**(AC2): X 닫기·"나중에 할게요"·완료·전체 건너뛰기 등 마법사가 닫히는 모든 경로가 `markWizardDismissed()`를 호출해 `dismissed:true`를 세움 — 한 번이라도 닫으면 이후 자동 노출 안 됨(재진입은 CTA로만 가능)
- 👤 **4단계 순서**: 주식→코인→현금→대출, 각 단계 "스크린샷 업로드"(카테고리당 1장) 또는 "이 카테고리는 없어요"(건너뛰기). 어느 화면에서든 하단 "부동산은 직접 입력할게요" 링크로 `dispatchAddRealEstate()` 즉시 호출(부동산은 인식 엔진 없음, AC4)
- 👤 **완료 화면**: 실제 `Dashboard` 컴포넌트를 그대로 렌더(가짜 프리뷰 아님, AC7) + "확인 완료"(목표 설정 연결 카드는 S-4.28 롤백으로 제거됨)
- 👤 **전체 건너뛰기**(AC10): 4개 카테고리 전부 건너뛰고 부동산도 미등록이면 완료 화면을 만들지 않고 그대로 닫아(`finish()`) **실제 `WelcomeGuide`**로 복귀(별도 안내 화면을 새로 만들지 않음)
- ⚙ **신규 인식 로직 없음**: 각 단계는 기존 `{Stock,Crypto,Cash,Loan}ScreenshotImport`를 `open`/`onOpenChange`로 직접 마운트해 그대로 재사용, `parse-screenshot` API·프롬프트·스키마 무변경
- ⚙ **완료 신호는 `onSaved` 콜백**(4개 컴포넌트에 옵셔널 prop 추가, F-STOCK 섹션 참고): 저장 성공 시에만 호출되므로 사용자가 다이얼로그를 취소한 경우와 구분됨. `onSaved` 호출 시 `markCategoryStatus(category, "done")` → 다음 카테고리로 자동 전환
- ⚙ **재개(AC6)**: 자동 재노출 시(위 AC1) `OnboardingWizardFlow` 마운트 시점에 `getResumeCategory`가 `pending`인 첫 카테고리를 반환해 그 단계부터 시작 — 처음부터 다시 시키지 않음. 인트로 화면에서 "시작하기"를 사용자가 직접 누르면 진행 여부와 무관하게 첫 카테고리부터 훑되, 재업로드는 각 컴포넌트의 기존 append 동작을 그대로 따라 기존 자산을 덮어쓰지 않음(AC9)
- ⚙ **부동산 인식 불가**: `api/parse-screenshot/route.ts`의 `ParseAssetType`에 `realEstate` 없음 — v1 스코프에서 의도적으로 제외(명세 §2 확정)
- ⚙ **카테고리당 이미지 1장**: 4개 스크린샷 컴포넌트 모두 `input`에 `multiple` 없음(단일 파일) — v1은 이 제약을 그대로 받아들임(Gemini 일일 30회 한도 대비 마법사 1회 최대 4호출로 여유 확보)
- ⚙ **진행 상태**: `STORAGE_KEYS.onboardingWizardStatus` 단일 키 — `STORAGE_KEYS.tutorialStatus`(스팟라이트 튜토리얼)와 코드 패턴만 동일, 값 공유 없음. `tutorial-overlay.tsx`/`tutorial-store.ts` 무변경
- 엣지: 카테고리 스킵 후 다음 카테고리로 정상 진행, 모든 다이얼로그는 마법사가 직접 마운트(전역 hidden `*Input` 재사용 아님) — 부동산만 예외적으로 `RealEstateInput` hidden 마운트 필요
- 회귀: 마법사 열림 중에도 `AssetDataContext`·시세 동기화 등 기존 훅 정상 동작(별도 Provider 분기 없음), 마법사 닫으면 `assetData` 최신 상태 그대로 홈에 반영
- 자동: `src/lib/__tests__/onboarding-wizard-status.test.ts`(재개 지점 계산, dismissed 플래그, 키 분리)

### F-RATIO. 스크린샷 비중 미리보기 `/ratio` ([ratio-preview.tsx](../../src/app/ratio/ratio-preview.tsx) · [ratio-list.ts](../../src/lib/ratio-preview/ratio-list.ts) · [handoff.ts](../../src/lib/ratio-preview/handoff.ts) · [ratio-handoff-host.tsx](../../src/app/(main)/_components/ratio/ratio-handoff-host.tsx)) — #4.39 #63, risk medium
- 👤 `/ratio`는 로그인·금고 없이 열리고 SSR 본문(제목·설명·고지·업로드 버튼)과 canonical/og:url=`/ratio`·og:image·twitter summary_large_image가 JS 없이 보인다. 결과에 금액이 없고 종목 목록·국내/해외 막대 합이 100.0
- 👤 저장 버튼 → `/` 이동 후 확인 창(충돌/미리보기, 개별 모드)이 다시 업로드 없이 열리고 등록 결과·종목 수가 미리보기와 같다. 새로고침·취소·10분 경과 후 미재오픈. 앱 잠금·공유 대기·마법사 중 대기 후 해제 시 오픈, 0건·튜토리얼 미완료 기기에서도 오픈(웰컴 위 겹침 없음)
- 👤 인앱 UA(카카오톡·barcelona)는 "브라우저에서 열어 저장하기" + 재업로드 안내(GA `open`만, `pwa_install` 미전송)
- 👤 예시 모드(#4.40 #66): 첫 화면 고지 아래 "예시로 먼저 보기" → 로딩 없이 예시 결과(맨 위 "예시 데이터예요…", 6행 28/22/16/14/12/8, 국내 58·해외 42, 금액·티커 0). 저장·인앱·다시보기·노트 DOM 없음, brand "내 캡처로 해보기" → dropzone 복귀(파일창 미오픈, 포커스), 이어서 업로드는 현행. limit·device 오류는 복귀 시 복원, empty·fail은 idle. 예시 중 `/api/*`·저장소·`peekHandoff` 변화 0, GA `method: sample` 1건만(`ratio-sample.test.ts`)
- ⚙ 입구 한도: 입구 전역 60·IP 5/일(entry 또는 Referer `/ratio`), 초과 시 마감 문구 429, 실패 시 앞 단계 카운터 롤백, 일반 요청 영향 없음(`api-guard.test.ts`). 기기 30회 초과는 업로드 안 함
- ⚙ GA: `/v/ratio` page_view, `feature_use{ratio_preview, submit success|fail|empty|limit / click / open / create}`, UTM은 `/ratio`에서만 page_location에 부착, 종목명·금액·비중 파라미터 없음. `screenshot_parse` 미전송
- ⚙ 회귀(#64): 국내·해외 혼합 인식은 앱 내 업로드도 개별 모드로 시작해 카테고리·가격 유지, 단일 section은 현행 동일(`screenshot-stock-map.test.ts`). 웰컴·결산·홈 팁·`page.tsx` diff 0
- 자동: `ratio-preview.test.ts`·`screenshot-stock-map.test.ts`·`utm-allow.test.ts`·`api-guard.test.ts`·`ga.test.ts`·`app/ratio/__tests__/ratio-page.test.ts`

### F-ASSET-REFRESH. 자산 최신화 (FAB 통합 카드) ([floating-add-button.tsx](../../src/app/(main)/_components/layout/floating/floating-add-button.tsx) · [holdings-conflict.ts](../../src/lib/asset/holdings-conflict.ts) · [asset-refresh-status.ts](../../src/lib/asset/asset-refresh-status.ts)) — 명세 [S-4.30](../specs/4.30-asset-refresh-fab.md)
- 👤 **FAB "자산 업데이트" 클릭 → hub(2단계, 2026-08 재설계)** — "보유 현황 업데이트"/"매수·매도 거래 기록" 2개 상위 타일 선택 → 각각 카테고리 컴팩트 리스트(`holdings`/`trade`). 두 화면 모두 **단건 전용**(체크박스·다건 시퀀스·완료 원인분해 요약 화면 전부 2026-08 제거 — `attribution-summary.tsx` 삭제됨). 행 직접 클릭은 기존과 동일하게 즉시 단건 처리
- 👤 hub 타일에 "어떤 메뉴를 써야 하나요?" `InfoHint` — 보유현황=재동기화(거래 이력 없음), 거래기록=손익·세금 정확 반영이라는 역할 구분 안내
- 👤 stock/cash/loan 보유현황 스크린샷 재등록 시 기존 crypto와 동일하게 "덮어쓰기(merge)/초기화 후 등록(reset)" 선택 노출(동일 키 중복 감지). stock=`ticker:category`, cash=`name:institution`(근사), loan=`name:institution:type`
- **홈 최신화 넛지는 F-HOME-TIP으로 통합됨(S-4.32 후속)** — `getStaleCategories`/`shouldShowRefreshNudge`(아래 판정 로직)는 그대로 재사용.
- 👤 암호화폐 "매수/매도 기록"에 "스크린샷 가져오기" 옵션(`crypto-tx-input.tsx`) — 체결내역 화면 인식, 기존 보유 symbol 매칭, 중복 체결 감지(주식과 동형). **미보유 매수 심볼은 신규 코인으로 자동 등록**(F-TRADE-SS 참조), 매도는 계속 차단
- ⚙ 병합형 로직은 `lib/asset/holdings-conflict.ts`(`keyOfStock/Crypto/Cash/Loan`, `countConflicts`, `resolveKept`) 공용 — crypto의 기존 merge/reset을 일반화해 stock/cash/loan에 이식(crypto 자체 동작 변경 없음)
- ⚙ `STORAGE_KEYS.assetRefresh` 단일 키(카테고리별 lastUpdatedAt + 오늘 넛지 노출 여부), `clearAssetData` keepKeys 포함(백업 메타와 동일 근거), "모든 데이터 삭제" 시 `clearAssetRefreshStatus()`로 명시적 제거
- ⚙ crypto 거래 스크린샷은 API `assetType="crypto-trade"` 신규 분기(`CRYPTO_TRADE_SCHEMA`/`buildCryptoTradePrompt`/`processCryptoTradeResults`, `parse-screenshot/route.ts`) — 주식 trade와 대칭이나 국내/해외 구분 없음
- 엣지: cash/loan은 스키마에 계좌 고유 식별자가 없어 근사 매칭(동명 계좌 오매칭 가능) — preview에서 "교체" 배지 확인 후 개별 체크/해제로 대응, 완전 자동 신뢰 아님
- 회귀: 더보기(tool-menu.tsx)에 신규 메뉴 없음, 온보딩 마법사(F-ONBOARD-WIZARD)·bottom-nav 구조·개별 상세탭 "+" 거래 추가 버튼 무변경. **다건 시퀀스 관련 코드(`checkedTypes`/`AttributionSummary`) 재도입 금지** — 요구사항 재검토로 명시적으로 제거된 기능(2026-08)

- 👤 **이어서 맞추기(#110)** — 보유 현황 목록: 보유 자산군 → 미보유(`추가`) → 과거 순자산 순, 오늘 맞춘 자산군 `✓ 오늘 맞춤`(순서 불변). 창(직접 입력·스크린샷·잔액 맞추기·보유 현황 맞추기)에서 저장 성공 시 탭 0회로 같은 시트가 holdings로 복귀(상단 `{자산군} 맞췄어요`, 보유 4종 전부 맞춤+부동산·실물 미보유면 `보유한 자산을 모두 맞췄어요`, 하단 [완료]). 취소·상세 탭 편집·마법사·거래 스크린샷 저장은 복귀 없음. 홈 최신화 팁·결산 '다음 달 준비' 진입도 복귀. 보유 현황 맞추기는 결과 화면을 닫을 때만 복귀. GA `feature_use`/`resync_continue`→`이어서 맞추기`는 복귀 목록에서 다른 최신화 행 선택 시 1회. 알려진 한계: 되돌리기는 ✓를 되돌리지 않음. ⚙ 새 저장 키·스키마 0, 대기는 FAB 메모리 ref
- 회귀(이어서 맞추기): `lib/asset/__tests__/resync-return.test.ts` 신호·KST·정렬·GA 조건·정적 검사

### F-WHATS-NEW. 새 소식 (#4.82, 이슈 #159 — 구 F-NOTICE 대체) ([whats-new.ts](../../src/config/whats-new.ts) · [lib/whats-new.ts](../../src/lib/whats-new.ts) · [whats-new-sheet.tsx](../../src/app/(main)/_components/views/home/whats-new-sheet.tsx))
- ⚙ `notice.tsx`·공지 다이얼로그·`NOTICE_ID`·`markCurrentNoticeSeen`·`isNoticeUnseen`·`NOTICE_SHOWN_SESSION_KEY` 삭제. 읽음 기록은 기존 단일 키 `secretasset_notice_seen`(`{id, seenAt, expiresAt}`)의 의미만 바뀜(id = 마지막으로 읽은 새 소식 id, seenAt = 7일 시계, 만료 = 쓰는 시점+90일). 동기화 payload 제외·가져오기 보존. `cleanExpiredNoticeKeys()`는 init에서 만료 정리만.
- ⚙ **목록 `WHATS_NEW`**: id `YYYYMMDD-NN`·날짜 내림차순·같은 날 NN 오름차순·미래 날짜 없음·`featureId`는 `APP_FEATURES` id·title 2~32자·body ≤48자·금액/투자 판단/과장/보장 어휘 없음(`config/__tests__/whats-new.test.ts`). 릴리스 PR 본문에 `새 소식: <id> | 해당 없음(사유)` 한 줄(C82).
- ⚙ **판정(`lib/whats-new.ts`)**: id는 숫자 비교(`-10` > `-09`, `20260924` < `20261112-01`). 안 본 항목 = id > 기록 id && 30일 이내(KST 일수). 팁 = 안 본 항목 ≥1 && (기록 없음 || seenAt+7일 이상). 시트 목록 = 60일 이내 위 20개, `새` = 열기 직전 기준 안 본 항목 전부(= 팁 N).
- ⚙ **홈 팁**: 배지 `소식`·제목 `새 소식 N개`·설명 = 맨 위 안 본 항목 title. 자산 있음·체험/잠금 아님·`isDataLoaded` 이후만. 첫 실행(불러오기 후 자산 0·기록 없음)은 항상 마운트되는 `WhatsNewHost`가 조용히 최신 id(같은 날 NN 최대) 기록(GA 없음, 웰컴 화면에서도). X = 읽음 + 세션 박스 숨김, 클릭 = 시트 열기.
- 👤 **시트**(`whats-new-sheet`): 머리 `새 소식`·`지금 버전 v{APP_VERSION}`(`whats-new-version`), 항목(`whats-new-item`)=제목+본문+`M/D`+`바로 가기 ›`(`whats-new-go`, featureId 있을 때. 누르면 시트 닫고 기존 기능 이동, 기능 팁 dismiss 없음), `새`(`whats-new-item-new`) 열린 동안 유지, 빈 상태 `whats-new-empty` `최근 60일 동안 새 소식이 없어요`. 모바일 bottom(핸들 스와이프>80px 닫기)/PC right.
- 👤 **더보기** `앱 가이드 · 새 소식` > `새 소식 보기`(`more-whats-new`): 7일 조건과 무관하게 같은 시트를 열고 읽음 처리.
- ⚙ **GA**: `whats_new`(page_title `새 소식`) 시트 열기 view 1회(source home_tip|more), 바로 가기 click + 대상 `entryCategory`(source `whats_new`). 홈 팁 view/click/close는 `home_tip`.
- ⚙ **preview `?demo=1`**: 읽음 기록을 쓰지 않음 → 새 브라우저(결산 창 밖)에서 `새 소식 8개`가 첫 팁. 같은 브라우저에서 이전 데모 기록이 있으면 7일 안엔 안 뜸(qa는 새 컨텍스트).
- ⚙ 롤백: 구버전은 9월 공지를 1회 재노출(결산 창이면 그 세션 결산 1회 가림), 자산 데이터 손실 0.
- PWA standalone: `NEXT_PUBLIC_*` 빌드 타임 인라인, SW 자동 갱신으로 재방문 시 새 번들 즉시 반영.

### F-HOME-TIP. 홈 알림/팁 통합 박스 ([home-tip-box.tsx](../../src/app/(main)/_components/views/home/home-tip-box.tsx) · [home-tip.ts](../../src/lib/home-tip.ts) · [app-features.ts](../../src/config/app-features.ts) · [feature-usage.ts](../../src/lib/feature-usage.ts)) — S-4.32 후속
- ⚙ 홈 자산 분포 카드 **아래** 1곳에만 존재. 과거 상단 `BackupNudge`/`RefreshNudge` + 하단 `TaxNoticeBox`/`FeatureTipBox` **4개를 흡수**해 한 번에 1개만 노출(사용자 요청 — 알림 박스 난립 정리). 마운트 시 `pickHomeTip({assetData, hasAssets, syncArmed})` 1회 호출 — `null`이면 컴포넌트 자체가 렌더 안 됨.
- ⚙ **우선순위**(#4.82 갱신): ①백업(`shouldShowBackupNudge`) ②**임박 세금(#4.36, `isImminentTaxMatch`: 이번 달 마감 0~6일)** ③**결산(#4.36, `pickSettlementCard`, 말일−3일~다음 달 10일·첫 달 제외·자산 있음)** ④**새 소식(#4.82, F-WHATS-NEW)** ⑤끊긴 거래 잇기(#147) ⑥그 외 세금 ⑦최신화 ⑧기능(저방문만, isNew 폐지) — 첫 매치 1개만. 공지(`notice`) 종류 삭제.
- 👤 **기능 팁 `시장과 비교`(#4.73 #132)** — 4.82에서 isNew·`신규` 배지 폐지(새 소식 항목 + 바로 가기로 흡수), 방문 횟수 적은 순으로만 추천. 설명 `지금 보유한 종목의 등락을 코스피·S&P 500 옆에서 봐요`(`MARKET_PAIR_TEXT`: `·` 양옆 U+2060, `S&P`·`500` 사이 U+00A0 — 320·375에서 덩어리 안 갈라짐), 탭 → `#activity/change-market`.
- 👤 **결산 팁(#4.36, 4.94 갱신)**: 배지 "결산"·`CalendarCheck`·제목 settled "{N}월 결산이 열렸어요"(연도 다르면 "{YY}년 …")/range "M/D → M/D 변화를 볼 수 있어요"/in_progress "M/D 이후 변화를 볼 수 있어요"(`settlementWindowName` 1곳, 허브·결산과 같은 구간)·설명 "순자산이 무엇 때문에 바뀌었는지 볼 수 있어요." 금액·기간 라벨 없음. 탭 → 자산 변화 월 결산(`init.source="home_tip"` → `settlement_view{source:home_tip}`), X = 기존 세션 숨김. 새 저장 키 없음. testid `home-tip`(`data-kind`)·`home-tip-title`·`home-tip-close`(6종 공통). 테스트 `src/lib/__tests__/home-tip.test.ts`
- 👤 **새 소식 X = 읽음(#4.82)**: 홈 팁 X → `markWhatsNewSeen()` + home_tip close 1, 같은 세션 팁 0, 새 세션에서 새 소식 팁 없음(7일 시계). 시트는 열리지 않음.
- ⚙ **preview `?demo=1`(#4.36, #4.82 갱신)**: 튜토리얼 전체 건너뜀 + 표식 `secretasset_preview_demo_tutorial_skipped`(새 소식 읽음은 기록하지 않음). `?demo=empty`는 표식 있을 때만 튜토리얼·읽음 키 삭제. 운영 무동작
- ⚙ **팁 셸 공통(#4.36)**: 제목·설명 `break-keep wrap-break-word`, X `relative after:absolute after:-inset-1`(히트 40×40)
- 👤 **홈 Hero 증감(#4.36)**: 금액·% 각각 `whitespace-nowrap`, 증감 span `flex-wrap gap-y-0.5`, 라벨 `break-keep` — 320·375에서 "+661만/원" 분리·가로 넘침 없음. 하단 고지 `<p>` 2개 `break-keep text-pretty`
- 👤 **보유 필터(#170, 4.87)**: 첫 기능 팁 — 현금·국내주식·코인·대출만 보유 = 세금 일정, 해외주식(상장·수량>0) = 연말 절세 시뮬, 상폐 해외주식만 = 세금 일정. 미보유 자산군·주식 계열 팁 없음(수량 0 주식 = 미보유), 후보 0이면 `home-tip` DOM 없음. GA 팁 누름 `홈 팁·누름`. 수익 칸: `/api/finance/profit` 429 → 스켈레톤 사라지고 `지금은 불러오지 못했어요, 다음에 열면 다시 불러올게요`(카드 `profit-fetch-failed`), 점검 헤더면 기존 점검 문구. 배당 320 '분기' 배지 줄바꿈. 자동: `home-tip-holdings.test.ts`·`profit-partial-failure.test.ts`
- ⚙ **새 소식(`whats_new`, #4.82)**: F-WHATS-NEW 참조. `home-tip-box.tsx` effect는 `isDataLoaded` 이후에만 판정·기록하고, 강제 노출 없이 다른 팁과 같은 `SESSION_DISMISS_KEY` 규칙을 따른다.
- ⚙ **재노출 정책은 종류별로 원래 정책 그대로 보존**(하나로 뒤섞지 않음): 백업·최신화=노출되는 순간 오늘 flag(`markNudgeShown`/`markRefreshNudgeShown`, daily), 세금=명시적으로 닫아야만 이번 달 flag(`markTaxNoticeDismissed`, monthly — 클릭 이동만으로는 안 닫힘), 새 소식=X·클릭 모두 읽음(7일 시계), 기능=닫기·클릭 이동 둘 다 영구 dismiss(`dismissTip`, 재노출 없음).
- ⚙ **승자만 "오늘 떴다" flag를 찍는다** — 마운트 effect에서 `pickHomeTip`이 반환한 `kind`가 backup/refresh일 때만 해당 mark 함수를 호출. 하위 순위라 안 보인 항목까지 flag를 찍으면 실제로 못 본 채로 그날 소비된다(과거 `RefreshNudge`가 `suppressed`일 때 mark를 건너뛰던 것과 동일 원리).
- ⚙ **인터랙션은 5종 모두 통일** — 카드 전체 클릭(`role="button"`) = 그 종류의 유일한 동작(백업: `exportAssetData`+토스트 / 세금: `navigate({type:"tax"})` / 최신화: `open-add-asset-sheet` 이벤트 dispatch(가장 오래된 카테고리 1개) / 새 소식: `dispatchOpenWhatsNew("home_tip")` / 기능: `action` 또는 `beforeNavigate`+`navigate`), X 닫기 = 해당 종류의 dismiss만(이동 없음). 과거 백업·최신화가 갖던 별도 "지금 백업하기"/"지금 최신화하기" **버튼은 제거**되고 카드 클릭 하나로 단순화됨.
- ⚙ 기능(feature) 카탈로그는 `APP_FEATURES`(#4.83에 `monthly-log`·`share-card-stock` `tip:false` 추가 — 이전 15개: #4.73에 `market-compare`("시장과 비교") 추가, #4.34에 `netasset`·`profit`을 `change`("자산 변화") 1개로 통합, 저장된 옛 id 방문 기록은 무시. #4.24에 `share-card-portfolio`, #4.26에 `share-card-type`("투자 유형 인증카드", `dispatchOpenShareCard("type")`) 추가. `recordVisit`은 리스너가 `"share-card"`만 기록하므로 세부 타입 팁은 클릭 시 `dismissTip`으로만 소진. 백업·피드백·설정·기기 동기화는 카탈로그 제외 대상)에 신규 공용 기능 추가 시 등록 필수. **`isNew`는 이번 릴리스 신규만** — 지난 릴리스 항목의 `isNew`는 해제해야 다음 신규가 `pickRecommendedFeature`의 `.find(isNew)`에 걸린다(#4.24에 `tax-simulator` isNew 해제·`stocks-xray`/`share-card-portfolio` isNew 설정). 방문 기록은 `navigation-context.tsx`의 `navigate()` 단일 지점 `recordVisit(viewToKey(v))` + `share-card`(action형)는 `top-bar.tsx`의 `trigger-open-share-card` 리스너가 별도 기록.
- 👤 (새 소식 안 본 상태, 자산 있음) 홈 진입 → 결산 창 밖이면 `새 소식 N개` 팁이 백업·임박 세금 다음에 노출·클릭 시 새 소식 시트 오픈(#4.82) / 읽은 뒤 → 백업 30일 이상 미실행 시 백업 카드·클릭 시 파일 다운로드 / 세금 신고 대상 자산 보유 시 세금 카드·클릭 시 `#tax` / 자산 30일 이상 미갱신 시 최신화 카드 / 그 외 저방문 기능 팁(isNew 없음)
- 엣지: 여러 조건 동시 충족 시 우선순위 1개만 노출 · 공지를 X로 닫은 뒤 같은 세션 내 홈 재진입 시 다시 뜨지 않아야 함(세션내 미노출) · 다른 팁을 X로 닫아도 미열람 공지는 최초 1회는 반드시 노출 · 전체 기능 dismiss + 공지 열람 + 백업/세금/최신화 미충족 시 박스 미노출 · 공지·인증카드 항목 클릭 시 페이지 이동 없이 다이얼로그만 열리는지

### F-APPLOCK. 앱 잠금 (PIN) ([pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx))
- ⚙ 웹·PWA 모두 동작 — `authEnabled && !sessionStorage("pwa_authenticated")` 조건(standalone 체크 제거). SHA-256 PIN 해시 비교, 세션 인증 후 `sessionStorage.setItem("pwa_authenticated","true")`.
- ⚙ 잠금 유틸은 **[app-lock.ts](../../src/lib/pwa/app-lock.ts) 순수 모듈 단일 소스** — `isPwaAuthEnabled()` / `setPwaAuthPin(pin)` / `disablePwaAuth()` / `verifyPwaAuthPin(pin)` / **`isPwaLocked()`**(인증 활성+세션 미인증) / `markPwaAuthenticated()` / `emitPwaUnlocked()` / `PWA_UNLOCKED_EVENT`. UI 컴포넌트에 두면 `asset-data-context`·`cloud-sync-provider`가 import할 때 **순환 참조**가 된다(잠금화면이 `useAssetData`를 쓰므로).
- ⚙ **잠금 중 백그라운드 동작 전면 차단(P1)** — 판정은 `isPwaLocked()` **단일 소스**. 과거 `asset-data-context`가 `standalone &&`를 AND로 요구하는 별도 `checkIsLocked()`를 쓴 탓에, **브라우저 탭에서는 PIN 화면 뒤로 `initAndSync` 전체(환율·시세·코인·profit·스냅샷 저장·`lastVisitDate` 기록)가 그대로 돌았다**(해제 후 "지난 접속 이후" 브리핑 소실). 별도 판정 함수를 다시 만들지 말 것.
- ⚙ 가드는 **`isBackgroundWorkBlocked()`**([background-gate.ts](../../src/lib/pwa/background-gate.ts) = 인앱 게이트 ∪ 앱잠금) 하나로 통일 — 두 게이트를 지점마다 따로 쓰면 한쪽을 빠뜨린다(실제로 부동산 갱신 effect가 인앱 가드 없이 돌고 있었다). 적용: `initAndSync` 본문·0→양수 전환 effect·부동산 실거래 갱신 effect·`#sync=` 연결 모달 detect. 추가로 자동 push effect·storage 핸들러·마운트 초기화는 `isPwaLocked()` 직접 가드.
- ⚙ **부트스트랩은 `runBootstrap()` 단일 함수**(마이그레이션·환율 hydrate·monthly 백필·Share Target 변환·진입 분기) — 잠금이면 마운트에서 건너뛰고 **해제 시 `unlockAndLoad`가 이 함수를 그대로 호출**한다(`bootstrapDoneRef`로 세션당 1회 보장). 개별 항목을 `unlockAndLoad`에 하나씩 복제하면 반드시 빠뜨린다(과거 실제로 hashchange 리스너·monthly 백필·Share Target 변환 3가지가 누락됐다 — monthly 백필은 한번 건너뛰면 영구 재실행 불가능이라 특히 위험). `hashchange` 리스너는 예외로 **잠금 여부와 무관하게 항상 등록**하고 핸들러(`handleHashChange`) 안에서 `isPwaLocked()`를 본다 — 리스너 자체를 잠그면 해제 후에도 재등록되지 않는다.
- ⚙ **해제 순서 = ① `markPwaAuthenticated()` ② `try { await unlockAndLoad() } finally { emitPwaUnlocked() }`** — ①이 없으면 `unlockAndLoad`가 자기 가드에 막히고, ②③를 병렬로 두면 원격 pull(`clearAssetData`→전체 교체)과 구 데이터 기준 시세·스냅샷 저장이 동시에 진행돼 서로를 덮어쓴다. `finally`가 없으면 `unlockAndLoad`가 throw할 때(스토리지 차단 환경 등) 해제 알림이 유실된다.
- ⚙ `armed` 진입은 잠금 중에도 허용 — IndexedDB 언랩뿐이라 네트워크·저장이 없고, 해제 직후 pull 리스너가 armed 전용 effect 안에 있어 막으면 재arm 트리거를 새로 만들어야 한다.
- ⚙ **동기화-잠금 정합(P0)** — PIN 해시 키 `secretasset_pwa_auth_enabled`/`secretasset_pwa_auth_pin_hash`는 `clearAssetData` keepKeys(`secretasset_pwa_auth*` 프리픽스)로 **동기화 pull에도 보존**(미보존 시 해시 유실→해제 후 "비밀번호 불일치" P0). 동기화 pull은 `isPwaLocked()` 가드로 **잠금 해제 전 미실행**, 해제 시 `PWA_UNLOCKED_EVENT`로 즉시 1회 pull(F-CLOUD-SYNC S11).
- 👤 설정 > 앱 잠금 설정 ON → 브라우저 새 탭/재접속 시 PIN 화면 즉시 노출, 4자리 입력 → 잠금 해제 → 대시보드 진입.
- 👤 PIN 오류 1~2회: "비밀번호가 일치하지 않습니다" 문구. 3회+: "비밀번호를 다시 확인해주세요" 경고 노출. (#4.42) 문구는 도트 아래 상시 마운트 슬롯(`lock-error`, `role=alert`)에 표시돼 노출 여부로 다른 요소 위치가 변하지 않는다. 모바일: 칩 없는 `Lock` 아이콘(`lock-icon`) + 72px(낮은 화면 64px) 무테 키패드(`lock-keypad`, 눌림만 `bg-muted` 원), PC: `h-12 w-48` 입력칸.
- 👤 설정 > 앱 잠금 설정 OFF → 현재 PIN 입력 후 비활성화, 이후 재접속 시 PIN 화면 미노출.
- ⚙ **잠금화면은 소프트 키보드를 쓰지 않는다(P1 규약, 모바일/PWA 한정)** — **PC(`isPC`)는 예외**: 소프트 키보드 포커스 강탈 버그는 iOS standalone 한정이라 데스크톱은 네이티브 `Input`(공용 `components/ui/input.tsx`, `type="password" autoFocus`)을 그대로 쓴다. 그 외(모바일/PWA)는 **포커스 가능한 입력 요소를 두지 말 것** — 자체 숫자패드(`Button` 3×4 그리드) + 4점 표시(`role="status"`, 순수 표시용 `<span>`)로 입력받고, 물리 키보드는 `window` `keydown`(0~9·Backspace)으로 받는다. iOS standalone의 소프트 키보드는 포커스 강탈·present/dismiss 경합에 취약해 앱 코드로 결정론적 제어가 불가능하며(키패드가 열리려다 닫히는 반복), **`focus()`/`blur()` 개입과 오버레이 `overflow-y-auto` 스크롤 컨테이너화로 오히려 고정 회귀를 만든 이력이 있다**(2026-07-31). `InputOTP` 복귀·자동 포커스·tap-to-focus 도입 금지(모바일/PWA 한정)
- ⚙ **PC 잠금화면 Input 다크모드 테두리(2026-09)** — 공용 `Input`은 다크모드 미포커스 시 `dark:border-0`(배경 채움만)이라 어두운 배경 위에서 위치를 찾기 어려웠다. 공용 `input.tsx`는 다른 화면(설정·거래 입력 등) 영향 없게 그대로 두고, `pwa-lock-screen.tsx`의 이 `<Input>`에만 `dark:border dark:border-ring` 추가 — 포커스 때와 동일한 테두리를 항상 노출.
- ⚙ **키패드는 `onPointerDown`으로 누르는 즉시 반영**하고 `click`은 `detail === 0`(키보드·보조기술)이면서 직전 pointerdown이 없을 때만 처리한다(중복 입력 이중 가드). `onClick`으로 되돌리면 pointerup 이후에 입력돼 굼떠진다. 키에 **`touch-none`** 필수 — 세로 팬을 허용하면(`touch-manipulation`·루트 `pan-y`) iOS가 "탭 vs 스크롤"을 판별하느라 `pointerdown`을 늦춘다(잠금화면은 스크롤 대상이 없어 안전). 전환은 키 `duration-50`(`Button` 기본 150ms를 tailwind-merge로 덮어씀), **자릿수 점은 전환 없음**(즉시 채움). `select-none`·tap-highlight 제거는 `bottom-nav` 관례
- ⚙ 자동 제출은 `pin.length === 4`를 보는 **별도 effect**로(상태 updater 안에서 검증하면 StrictMode 이중 실행). `checkingRef`로 중복 검증 차단하고, 검증 중엔 그리드에 `pointer-events-none opacity-60`만 준다. `unlockAndLoad`는 비메모 context value에서 와 식별자가 흔들리므로 **ref 경유**(deps 직접 참조 시 provider 리렌더마다 콜백 재생성)
- 👤 **iOS PWA 실기기**: 앱 첫 실행 → 숫자 버튼 탭 → 점이 채워짐. **소프트 키보드가 전혀 뜨지 않고** 화면 흔들림·줌 없음(핵심 수용 기준) / 4자리 오입력 → 점 초기화 후 즉시 재입력 / 데스크톱은 물리 키보드·마우스 클릭 모두 동작
- 👤 **브라우저 탭에서 앱잠금 ON → 새 탭 재접속**: PIN 화면에서 네트워크 탭에 `/api/finance*`·`/api/realestate`·`/api/sync` 요청 **0건**, `secretasset_daily_snapshots`·`secretasset_last_visit_date` 미변경. 해제 후에야 1회 실행되고 "지난 접속 이후" 브리핑이 살아있는지
- 엣지: PWA standalone에서도 동일 동작(세션 분리 → 앱 재실행마다 PIN 요구)

### F-MISC. 닉네임·테마·AI 프롬프트·환율 입력
- 👤 닉네임 저장·공유 반영, 다크모드 토글, 도구 메뉴(`tool-menu`) AI 자산현황 프롬프트, 수동 환율 입력
- 👤 **닉네임 커밋 시점 = 탭 이탈(언마운트)** — 더보기 탭에서 닉네임 여러 글자 입력 중에는 저장·push 미발생(로컬 draft만), **더보기 탭을 벗어날 때 1회만** 커밋. 편집 중 다른 기기 pull로 닉네임이 바뀌면 입력란이 자동 갱신되고, 그대로 탭 이탈 시 stale 값 재push 없음(draft==현재 닉네임 → 커밋 no-op)
- 👤 더보기 `지원` 섹션 **"앱 가이드 · 공지사항"** 통합 진입점 — 선택기에서 앱 가이드 보기 / 공지사항 보기 분기(메뉴 행 1개로 통합). 공지 뷰어는 정적 카드 4장(SVG 애니메이션 없음 — 4.18 개편). 동기화 4컷 애니메이션의 멈춤/시작은 **더보기 > 기기 동기화(미설정 상태)** 화면에서 확인
- ⚙ **닉네임 입력 draft 분리**([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): `onChange`는 로컬 `draft` state만 갱신(localStorage·`NICKNAME_EVENT`·push 없음), `useEffect([nickname])`로 외부 변경 반영, 언마운트 클로저(`commitRef`)에서 `sanitizeNickname(draft)!==nickname`일 때만 `setNickname` 커밋. `persistNickname` 로직 재사용·호출 시점만 변경
- ⚙ 닉네임 변경(`NICKNAME_EVENT`) 발생 시 React `assetData` 상태가 실시간 업데이트되며, 자산 CRUD/동기화 시 닉네임이 빈 값으로 덮어써지지 않는지 검증
- ⚙ 공유 토큰 파싱(`parseShareToken`/`unpackV7`) 및 데이터 가져오기 시 닉네임이 `validated.nickname` 및 `data.nickname`에 누락 없이 복원되어 보존되는지 검증

### F-FEEDBACK. 의견·요청 보내기 ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx) · [api/feedback](../../src/app/api/feedback/route.ts))
- 👤 더보기 > "의견·요청 보내기" 다이얼로그: 내용 Textarea(초기 min-h-160, max-h-40vh 내부 스크롤) + 연락처(선택), 전송 중 스피너, 성공/실패 토스트. **다이얼로그 스크롤로 하단 "보내기" 버튼 항상 노출**
- ⚙ `/api/feedback` POST: message 공백 검증(400)·2000자 절단, `guardRequest`(본문 ≤16KB, cross-site 403)·L2 `rl:feedback` 10분 5회(429), Slack `& < >` 이스케이프, `SLACK_WEBHOOK_URL` 미설정(500)·웹훅 실패(502), 닉네임 자동 첨부. **서버 저장 없음**(웹훅 전달만)

### F-API-SECURITY. 공개 API 방어 ([api-guard.ts](../../src/server/api-guard.ts) · [next.config.mjs](../../next.config.mjs)) — S-4.28 보안 범위
- ⚙ 공개 라우트 목록 = 클라이언트 호출처가 있는 것만(`npm run build` 라우트 목록에 `debug-overseas` 없음, `"use server"` 파일 0개, `/_next/image` 404)
- ⚙ 거부 순서: cross-site(`Sec-Fetch-Site` cross/same-site·Origin 불일치·`null`) 403 → Content-Length 없음 411·초과 413 → L1 429 → 캐시 히트 즉시 응답 → (미스만) L2 `rl:{route}:{ip}` 429 + `Retry-After` → 업스트림 예산 초과 시 stale/`X-KIS-Unavailable`
- ⚙ 입력: 티커 형식 위반·쿼리 구분자(`&`,`?`,`#`,`*`) 제외, 개수 상한 절단, enum 화이트리스트(profit `period`, realestate `op`, dividend `type`), logo size 버킷 스냅·SVG 거부
- ⚙ Gemini: `reserveGeminiCalls` 원자 예약(IP 30/일, 과사용 IP 전역 70%), parse-screenshot 매직바이트 검사·rawText 미반환, xray 프롬프트는 서버 마스터 이름만
- ⚙ `cache-storage`: production·preview + KV 미설정 → throw(fail-closed), `setStock` SCAN 없음, upbit 락 소유자 토큰 해제
- ⚙ 보안 헤더: CSP **Report-Only**, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `x-powered-by` 없음
- 👤 배포 후 프로브: 타 출처 Origin → 403, `/api/share?key=rl:1.2.3.4` → 400, `/api/finance/dividend?type=x` → 400, 과대 본문 → 413, 연속 요청 → 429, 공개 시세 응답 `x-vercel-cache: HIT`
- 👤 CSP Report-Only 위반 콘솔 확인 후 enforce 전환 / Vercel Firewall(`/api/*` rate limit·Attack Challenge)·Spend Management 설정
- 회귀: 정상 사용 패턴(배치 3개·1초 간격)이 L2 한도에 걸리지 않는지 — 캐시 미스에서만 L2 적용. 통신사 공용 IP(CGNAT)에서 Gemini IP 30/일 도달 여부 운영 관측
- 테스트: `src/lib/__tests__/api-guard.test.ts`, `cache-storage.test.ts`

### F-ANALYTICS. GA4 사용자 행동 추적 ([ga.ts](../../src/lib/analytics/ga.ts)) — 명세 [S-4.28](../specs/4.28-ga-event-tracking.md)
- ⚙ config `send_page_view:false` + `page_location`에 해시·쿼리 없음(`#share=`·`#sync=`·`?url=` 미전송), 화면은 `trackScreen` 가상 경로 `/v/<viewKey>`
- ⚙ **`settlement_view`(#4.34)** — 월 탭 마운트당 1회(월 화살표 이동·같은 칸 재선택은 재전송 없음, 다른 기간·범위에서 월(전체)로 돌아오면 재마운트로 1회 `source=menu`, 주식 범위는 0회), `source`=card/menu, `result`=settled/in_progress/first_month만. 화면키 `activity:netasset`·`activity:profit` → `activity:change`
- ⚙ **4.41 단순화(#68)**: 모든 이벤트·page_view payload는 `page_title`·`page_location`만(debug 플래그 시 `debug_mode` 추가). 맞춤 매개변수·`gtag('set','user_properties')` 호출 0, `nav_source` 미전송. `featureTitleOf` 전수 매핑(자산 종류 접미 `·주식` 등), 매핑 없는 이벤트는 현재 화면 title, 화면 title 불변. 체험 모드 전송 0. 인증카드 열기(상단 버튼·홈 팁)·앱 가이드 열기 `feature_use` 1회씩. (옛 sanitizer·한국어 라벨·`USER_PROP_LABELS`는 폐기)
- ⚙ gtag 부재·예외 시 no-op(AC1·AC4), 같은 화면 연속 page_view 1회(AC7), `first_asset_saved` 기기당 1회(`gaFlags`, 공유 복원·가져오기·pull 제외)(AC8)
- ⚙ `sync_action`은 수동 enable·connect·push·pull 결과에서만 — 60초 폴링·focus·online 자동 동기화 미발생(AC9). 동기화 로직 무변경
- ⚙ head 인라인 스크립트: gtag 큐 정의가 try 블록 밖·앞(localStorage 예외에도 큐 보장)
- 👤 `?ga-debug=1` → DebugView에서 이벤트 page_title이 기능 이름으로 붙고 page_location 해시 없음 확인, `?ga-debug=0` 해제
- 👤 GA 관리: 향상된 측정 "브라우저 기록 기반 페이지 변경" 끄기, 기존 맞춤 정의 12개 보관처리(폐기), 핵심 이벤트 지정. 배포 24~48시간 뒤 "페이지 및 화면"에서 기본 title("시크릿에셋 — …") 행 소멸 확인
- ⚙ **#4.73 title 3개(맞춤 정의 0)** — page_view `activity:change-market` → `성과·자산 변화·시장 비교`, `feature_use{change_scope_stock}` → `성과·자산 변화·주식`(범위 칩 사용자 클릭만, 복원·첫 진입 0), `feature_use{stock_sort_rate}` → `상세·주식·등락률 순`(고를 때 1건, 되돌릴 때 0). 금액·종목·% 미전송
- 테스트: `src/lib/__tests__/ga.test.ts`

### F-GUIDE. 검색 입구·가이드 ([app/guide](../../src/app/guide)) — #4.45 #77
- ⚙ `/sitemap.xml` 4건(루트·/ratio·/guide/stock-ratio·/guide/net-worth) 모두 `https://www.` 접두, lastModified 호출마다 동일(고정). canonical·og:url·twitter images가 편마다 재선언
- ⚙ 가이드 본문은 JS 없이 HTML에 h1 1·h2 전부·`/ratio`·`/?trial=1` 링크·브랜드 문장 포함. 금액·예시 %·권유어·세금 0, 보안 문장은 `security-copy` 원문 일치, 본문 800~1,500자
- ⚙ GA: `guide:*` page_title 2종, 체험 이동 `feature_use demo`(page_location `/v/guide/<slug>`), UTM은 `/ratio`·`/guide/<slug>`만 허용
- ⚙ 루트 JSON-LD `WebApplication` 1개(offers 없음), 안내 그림 도메인은 `secretasset.xyz` 리터럴
- 👤 preview 320/375/1280 × 라이트/다크에서 어절 중간 줄바꿈 0·버튼 높이 44 이상·헤어라인 노출, `/ratio` 파일 diff 0, 운영 스모크에서 canonical이 www인지(Vercel `NEXT_PUBLIC_SITE_URL` 잔존 시 대표 설정)
- 테스트: `src/app/guide/__tests__/guide.test.tsx`, `src/lib/__tests__/utm-allow.test.ts`

### F-INSTALL-NUDGE. 첫 저장 설치 안내 ([install-nudge.tsx](../../src/app/(main)/_components/pwa/install-nudge.tsx)) — #4.45 #78
- ⚙ `trackAssetSave` 첫 저장 판정(create·직전 0건·플래그 없음)에서만 신호 on(gtag 없어도), 기존 보유·update·플래그 있음은 off. 새 저장 키 0
- ⚙ `shouldShowInstallNudge` 조건 1개씩 false면 미노출(체험·인앱·데스크톱·홈 아님·마법사/다이얼로그). **튜토리얼 종료 조건 없음**(4.85) — 튜토리얼이 남은 첫 저장 세션에도 1회 노출, 카드가 보이는 동안 튜토리얼 말풍선은 숨고 닫으면 이어짐(`install-nudge-first-save.test.ts`). `manifest.ts` 아이콘 3항목·lang ko·categories finance·id/start_url/scope/share_target 불변
- 👤 375 iOS UA 새 세션에서 첫 저장→홈에서 카드 1개(튜토리얼 말풍선과 겹치지 않음), 추가하기→기존 PIN 다이얼로그(카드 숨김·다이얼로그 유지), 나중에→카드만 사라짐, 새로고침·재저장 시 재노출 0, 상단바 가로 클리핑·레이아웃 회귀 없음
- 테스트: `src/lib/__tests__/install-nudge-policy.test.ts`, `manifest.test.ts`, `ga.test.ts`

### F-HOLDINGS-RESYNC. 스크린샷으로 보유 현황 맞추기 ([holdings-resync-dialog.tsx](../../src/app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx)) — #4.50 #91
- 항목 선택 칸(#5.103): 고른 뒤 트리거 두 줄 모두 좌측 정렬·말줄임, 높이 40px, 320·360·375에서 수량 줄이 보임. 목록 안 2줄 표시는 그대로.
- ⚙ vitest: `lib/asset/resync/__tests__`(매칭 표·C20 ①~⑧·S1~S5·K1~K3·코인 대응), `report/__tests__/resync-flows.test.ts`·`resync-crypto-flows.test.ts`(C21 (a)~(g), rollback 음수 기준 0 절단 현상 고정), `lib/__tests__/resync-sync.test.ts`(S8 2기기 하네스: A 맞추기→B 동일, B 미push→알림, A 되돌리기→B 복원, 4.49 스키마 키, 정적 규칙: saveData 2곳·asset_save 0·금지 문구 0), `ga.test.ts`(category 3개)
- 진입: 주식(코인) 보유 ≥1건이면 제목 `스크린샷으로 보유 현황 맞추기`, `덮어쓰기`·`초기화 후 등록` 0건. 0건이면 기존 첫 등록(`StockScreenshotImport`/`CryptoScreenshotImport`)
- 올리기: 최대 5장, 6장 선택 시 5장만+토스트, 남은 횟수 0이면 올리기 비활성, 장별 상태(인식 중·완료·인식하지 못했어요·일부만 인식됐어요·오늘 인식 횟수를 다 썼어요), 실패 장만 `다시 시도`
- 미리보기: 요약 1줄, 변경 행은 바뀌는 칸만 전→후, 삭제 후보 기본 체크는 S1·S2, 확인 필요 `이 항목도 맞추기`(+캡션 `체크하지 않으면 그대로 둬요`), 평가금액·손익·비중·총액 0건, 고지 2줄(+해외 삭제 후보일 때 양도세 1줄)이 320·375에서 어절 중간 줄바꿈 0
- 적용: 저장 1회, 변경 0이면 버튼 비활성, 거래 기록 배열 불변, 결과 화면·닫은 직후 토스트 외 되돌리기 입구 0, `앱을 닫기 전까지` 0건
- 매수일(#139, v4.74): 연결(변경) 항목은 id·매수일·매입 환율·메모 승계. 매칭 실패로 `추가`가 된 행이 이번에 지우는 같은 종목(티커·시장 같음, 증권사 같음→계좌 같음→매수일 이른 순)을 **이어받는다**(id·매수일·매입 환율·메모 유지, 수량·평단·증권사·계좌만 화면 값, 되돌리기 `modified`) — 거래 기록 연결·올해 배당 유지. 정말 새 종목(코인 포함)의 매수일 = **올해 1월 1일**(`resyncNewPurchaseDate`, 대표 결정 11-10), `positionEffectiveDate`=오늘, 해외 매입 환율=입력값/오늘 환율. 결산 예측 구간 투입일은 `resyncInflowDate`(맞추기 신규 + 매수일 기본값 그대로 → 만든 날, 그 밖 purchaseDate). 이어받기를 뺀 실제 신규 생성이 있으면 `새 종목(코인) 매수일` 입력 줄(#146 4.77, `resync-new-date`, 기본 올해 1/1·오늘 이전만·주식만 InfoHint; `resync-notice-3` 삭제). vitest `resync/__tests__/purchase-date-139.test.ts`, `resync-flows.test.ts` (d')(이번 달·연·1월·정밀 4구간 main과 원인 동일)·(d'')
- 이어받기 건수(#144, v4.76): 미리보기 요약·결과 건수·행 라벨은 이어받은 행을 `추가 1·삭제 1`이 아니라 `변경 1`로 센다(`inheritedPreds`, 행은 기존 변경 행 모양 전→후). 적용 결과·되돌리기 불변
- 새 종목 매수일(#146, v4.77): 맞추기·첫 등록(주식·코인) 미리보기 `새 종목/코인 매수일` 줄(`resync-new-date`·`import-new-date`, 신규 N개 `새로 들어가는 N개에 모두 적용돼요`, 0개면 줄 없음). 빈 값·내일 → `오늘이나 그 이전 날짜를 골라 주세요` + 확인 버튼 비활성. 첫 등록 `교체`·`초기화 후 등록`은 같은 키 기존 항목을 이어받음(id·매수일·매입 환율·메모 유지, 수량·평단·증권사·계좌=화면 값, manual·오늘). vitest `resync/__tests__/import-inherit-146.test.ts`, `report/__tests__/resync-flows.test.ts` 첫 등록 (d')
- 끊긴 거래 다시 잇기(#147, v4.77): 홈 팁 `home-tip-relink`(결산 창 아래)·거래내역 안내 줄 `relink-entry`·`relink-dialog`(행 체크·`다시 잇기`·`그대로 두기`·결과·`되돌리기`·토스트). 감지 ⓐ~ⓛ·적용·되돌리기·4.76 하위호환 `resync/__tests__/relink.test.ts`, 결산 합계 불변·대조 픽스처 동일 `report/__tests__/relink-flows.test.ts`, A3 `__tests__/relink-a3-4.77.test.ts`. qa 재현 JSON `resync/__tests__/fixtures/relink-4.77-qa.json`(도구 메뉴 `데이터 가져오기`)
- 최소 노출 비중(#148, v4.77): 홈 도넛·비중 바(항목 5개 이하)에서 1% 미만 항목도 조각·막대가 보이고 % 숫자는 실제 값. `report/__tests__/min-share.test.ts`
- preview(`?demo=1` → FAB → 보유 현황 업데이트 → 주식/코인 → 스크린샷): `데모증권` 장은 ②로 확정 또는 1회 선택 경로, 합성 잔고 이미지 2~3장(실캡처 금지)

### F-BALANCE-RESYNC. 현금·대출 잔액 맞추기 ([balance-resync-dialog.tsx](../../src/app/(main)/_components/forms/asset-update/balance-resync-dialog.tsx) · [balance-edits.ts](../../src/lib/asset/balance-edits.ts)) — #4.52 #93
- ⚙ vitest: `lib/asset/__tests__/balance-edits.test.ts`(저장 1회·깊은 동등·없는 id·행 검사 표·입력 문자열), `balance-resync-settlement.test.ts`(결산 픽스처 ①~④·월초 귀속), `direct-save-refresh-static.test.ts`(p2-2), `save-failure.test.ts`(p2-6)
- 진입: 현금(대출) 보유 ≥1건이면 FAB 제목 `현금성 자산 업데이트`(`대출 업데이트`), `직접 입력` 보조 `계좌별(대출별) 잔액 고치기` → `… 잔액 맞추기` 화면. 0건(`?demo=empty`)은 `… 추가`·기존 추가 대화상자, `first_asset_saved` 퍼널 diff 0
- 행: 상세 탭 순서, `현재 …원`(외화 원통화 단위), 빈 칸·같은 값은 변경 아님, 현금 0 차단(문구에 `삭제` 0)·대출 0 허용, 10배·1/10 경고(저장 가능), 합계·비중·순자산 노출 0
- 저장: `바뀐 N개 저장` → 토스트 `잔액 N개를 고쳤어요`, `balance` 외 필드·거래 기록 불변, `getStaleCategories`에서 해당 카테고리 제거, GA `자산 저장·현금/대출` 1건 + `잔액 맞추기 저장` 1건. 변경 ≥1이면 바깥 탭·Esc 불가·`새 계좌 추가` 링크 비활성, 취소 시 저장 0·GA 0
- p2: 연 탭 `작년 말 순자산 넣기` 링크(기존 입력 창)·연도별 저장 GA / 직접 추가·수정 후 최신화 기록 / `isNew` 0 / 업로드 문구 `눌러서 사진 고르기` / FAB `적용 환율` / 자동 저장 실패 토스트 세션당 1회
- preview(`?demo=1` → FAB → 보유 현황 업데이트 → 현금성/대출 → 직접 입력): 현금 3개(USD 1개 포함), 대출 1개

### F-LINKED-TRADE. 거래 연결 계좌 ([linked-record.ts](../../src/lib/trade/linked-record.ts)) — #4.58 #103
- ⚙ 짝 id 규칙·금액 반올림·가드(잔액 부족·초과 상환·대금 0 이하·통화·중복·이번 달 아님)·저장 합성 1회·저장 실패 시 전부 이전 값(`linked-record.test.ts`·`linked-save.test.ts`), 되돌림 픽스처 3종(하한, 대출 완납 복귀)·짝 기록 현재 값 기준·`reflected:false`·고아 불변
- ⚙ 결산·홈: F5·F6·F13·F14·F23·경계(`linked-settlement.test.ts`) + 4.55 함수 골든 사본 대비 무작위 400건 신/구 detail 동일(과거 결산 diff 0), 기존 settlement/cross-asset/physical 테스트 파일 수정 0
- ⚙ 문구·금지어(`link-text.test.ts`), GA `거래 저장·계좌 함께 반영`(`ga.test.ts`)
- 👤 preview: `?demo=1` → 주식 거래 직접 입력(즉시 반영 ✓) → `연결 계좌` 현금/대출 각 1회 → 홈 원인·캡션 → 거래 삭제(다이얼로그 1줄·토스트) → 입출금·대출 기록 확인, 외화 종목은 원화 현금·대출도 후보(#119), 현금·대출 0개면 행 없음, 375·1280 × 라이트·다크
- ⚙ #4.63 #119 통화 축: USD·JPY × 원화 현금, USD × 대출(수수료·소수 수량 0.5주=85,798원·priceInKrw·환율 빈칸 `rate`·잔액=대금 `zero`), Σ원인=Δ순자산·새 원인 줄 0, 삭제 원화 되돌림, 백업 왕복, 소스 단언(`report/__tests__/linked-krw-conv.test.ts`). v4.62 코드 하네스(읽기·삭제·결산 짝) 1회 통과
- 👤 preview(#119): Apple 선택 → `연결 계좌`에 `원화 현금`·`대출` 후보 → 원화 통장 선택 시 `체결 환율` 칸 채움·환산식 보조 줄(원화 계좌에 `$` 금액 없음) → 거래일 지난달로 변경 시 행 숨김+`account-link-note` → 저장 후 삭제 시 원화 금액 되돌림
- 알려진 한계: 처음 사는 티커는 거래 입력에서 고를 수 없어 연결 불가 / 구버전 기기 삭제 시 짝 기록 잔존 / 토큰 이동 시 연결 풀림 / 동시 편집 갈라짐 / 현금 0원 불가(스키마)

### F-QUALITY-109. 품질 정돈 묶음 — 삭제 고아 거래·외화 문구·반올림·손익 0·포커스·작은 이미지 — #4.60 #109
- ⚙ (a) `delete-assets-flow.test.ts`: 흐름 표 A1~A8(코인·주식, today 2026-11-05 고정, 모든 행 10월 causes = main, 지난달 연결 거래 A4·A6 보존, 경계 10-31/11-01), 단건·코인 묶음·주식 묶음, 코인 잔량 1e-12·시세 0·주식 전량 매도 후 삭제(거래 보존), 평가액 1원 이상 삭제(거래 0건), 항목별 판정, 연결 짝 기록·잔액 불변. `quality-batch-109.test.ts`: saveData 1회·탭 직접 saveData 없음. `linked-c42.test.ts` F24에 `deleteStocks`·`deleteCryptos` 포함
- ⚙ (c) ProfitMetric 0 회색·부호 없음, ±1원 이상 불변 / (d) USD 전액 차단 `$0으로`, KRW 문구 불변 / (e) USD 1000−999.99 = 0.01 (`quality-batch-109.test.ts`)
- ⚙ **#4.62(#115) 품질 정돈 묶음 2** (`quality-batch-115.test.ts`): (A) 홈 팁 `keepShown` — 승자(backup·refresh)는 effect 재실행에도 유지, 비승자 종류엔 미적용, 결산 판정은 keepShown 유무·결산 창 안/밖과 무관, 결산 창 안 백업 유지 시 그 마운트는 백업 팁(재마운트 때 결산) / (B) `profitTone` 0 회색·부호 없음(코인·주식·부동산·실물 카드/하위 행/펼침·허브 행·공유 캡처 주식 카드, 실투자금 수익률은 값 자체 판정), ±1원 이상 불변 / (C) 되돌린 맞추기 — 결과 화면 되돌리기→닫기(원복·신호 없음), 토스트 되돌리기(원복), 되돌리기 실패(원복 없음·신호 있음), 이전 값 null(키만 삭제·nudgeShownOn 보존), appliedAt 불일치(원복 없음) / (D) FAB 시트 닫힘 포커스 FAB→opener→main, 방법 선택 시 생략, 잔액 맞추기 4.60 동작 불변 / (E) 현금·대출 입출금 도움말 `break-keep text-pretty`
- ⚙ (f) `parse-screenshot/__tests__/tiny-image-guard.test.ts`: 1×1 PNG·50×50 JPEG 미호출·reserve 0·빈 결과 형태 동일, 1080×150 통과, HEIC·판독 실패 통과, 판독 경계
- 👤 preview 375px: 코인 삭제 후 홈·결산 원인에 그 코인 줄 없음 / FAB → 현금 → 직접 입력 → 맞추기 창 취소·Esc·저장 후 `document.activeElement`가 '자산 업데이트' 버튼 / 달러 계좌 전액 출금 문구 320·375 줄바꿈 / 매입가 빈 실물 탭 `0원 (0.0%)` 회색
- 알려진 한계: 일부 매도 후 잔량째 삭제 시 `입금 +Y`·`시세 −V` 두 줄 / 이미 남은 고아 거래는 정리 안 함

### F-SYNC-OVERWRITE. 동기화 덮임 알림·되돌리기 ([overwrite-guard.ts](../../src/lib/cloud-sync/overwrite-guard.ts)) — #4.47 #84
- ⚙ 기기 2개 localStorage 분리 + 409 모의 하네스(`sync-overwrite.test.ts`): 같은 항목 수정·무관 항목 수정·삭제 부활·신규 추가(목록 제외)·원격 삭제·오프라인 복귀, 재시작 후(기준 없음) 알림 0, 편집 없는 pull 알림 0, 되돌리기 없는 흐름의 localStorage가 guard 없는 흐름과 동일(C13)
- ⚙ 되돌리기: 목록 항목만 내 값으로(목록 밖 원격 변경 보존), R1 이후 변경 항목 제외, 월 스냅샷·설정 불변, 되돌리기 push 409면 같은 감지 재진입, 그대로 두기·새로고침 후 메모리 0·새 저장 키 0
- ⚙ 앱 자동 갱신 필드(시세·종목명 보정·추정 시세·올해 순자산 자동 업서트)만 달라진 pull은 알림 0, 사용자 입력 변경(부동산 currentValue·주식 수량)은 감지
- ⚙ 알려진 한계: 되돌리기 push 실패 시 안내 토스트 없음(기존 silent 실패와 동일)
- ⚙ 정적: 감지 모듈에 저장·push·notify 호출 없음, sync-client/state·asset-storage에 덮임 로직 없음, GA는 UI 계층만, 새 문구에 '서버'·보안 수식어 0
- 👤 (두 기기 필요, preview는 동기화 꺼짐) 토스트 1개(기존 2종 대체)·12초·[확인하기]→목록, 카드·목록·확인 단계 320/375/1280 라이트·다크 줄바꿈, 확정 시 건수 변동 문구
### F-DIVIDEND-YIELD. 배당 투입 대비 배당 ([dividend-yield.ts](../../src/lib/finance/dividend-yield.ts)) — #4.46 #80
- ⚙ 평단 0·JPY는 분자·분모 제외 + 제외 수, 지급만은 예상분 제외(지급 0이면 null), USD만 보유 시 환율 변경에도 % 동일, 운영 형태 픽스처(추정 평단·올해 매수·무배당 종목) 값 존재, 0.1% 미만 표기
- 👤 성과 › 배당: Hero 아래 "투입 대비 배당 N%"·캡션, 월 막대 선택 시 보이지 않음(막대 위치 불변), 조회 중·배당 0이면 줄 없음, 허브 배당 카드·월별 종목 표·성적표 텍스트 main과 동일
- 테스트: `src/lib/__tests__/dividend-yield.test.ts`

### F-MORE-SETTINGS. 더보기·설정 ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)) — #4.46 #81
- 👤 더보기 섹션 순서 프로필 · 공유 · 백업 · 지원 + 설정 행(4.89에서 '도구' 섹션·세금 관리 행 제거), 공유·백업 안 순서 공유·동기화 → 백업 → 가져오기 → 저장 현황, 자산 0에서도 가져오기 동작(숨은 input 항상 렌더), 설정에 가져오기·저장 현황 없음·순서 보안→화면→표시→데이터→버전·삭제 행 맨 아래, 다크 모드 ON/OFF 배지(`aria-pressed`), 백업·가져오기·캐시·삭제 문구 변경 0
- 1280 행 폭 672px 이하 좌정렬, 320 어절 줄바꿈 0

### F-HOME-DONUT. 홈 도넛 ([dashboard.tsx](../../src/app/(main)/_components/views/home/dashboard.tsx)) — #4.46 #82
- ⚙ 웰컴 도넛(`screenshotMode`) 마크업 스냅샷 불변(`donut-welcome-snapshot.test.tsx`), 라벨 최소 비율·금액 없음·필터 시 선택 조각만, `pickDonutLabelColor` 12색 4.5:1
- 👤 [92/5/3]·[80/12/8]·[50/50]·[100]·[60/39.9/0.1] 라벨이 조각 안, 조각 바깥 링 없음, 범례 금액·% 끝 x 정렬, 행 40px, 카드 높이 증가 16px 이하, 필터 이동 유지
- 테스트: `src/app/(main)/_components/views/home/__tests__/`

### F-TAX-SEASON. 연말 세금 진입 (상세·주식 도구 타일 `stock-tool-tax`, [stock-tools.tsx](../../src/app/(main)/_components/views/detail/stock-tools.tsx)) — #4.45 #79, #4.83에서 문장 상자 → 타일
- ⚙ `isForeignTaxSeason` 10/31 false·11/1 true·12/31 true·1/1 false(KST 변환 포함), `isTaxSimCandidate`(국내·상폐·정지·수량0 제외)와 시뮬 `candidates` 판정 일치
- 👤 11/1~12/31 + 해외주식 보유 시 상세>주식 도구 타일 묶음에 `해외주식 세금` 타일 1개(값 고정 `1년 합산 · 기본공제 적용`, 숫자·D-day·금액 0), 누르면 세금 관리 시뮬레이터 탭, 뒤로가기로 주식 탭 복귀, 국내만 보유·시즌 밖·체험/데모(해외 없음)는 미노출
- 테스트: `src/lib/__tests__/tax-utils.test.ts`

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
- ⚙ **축약 금액 버림 정확도(#4.68 #129)**: `formatShortCurrency`(0.1억)·`formatShortCurrencyDecimal`(0.01억·0.01백만·0.01만)은 원 단위 정수(`Math.round`)를 표시 최소 단위로 **정수 나눗셈 후 버림** — 딱 떨어지는 값이 원 단위 표기와 같은 숫자(230,000,000 → `2.3억원`, 201,000,000 → `2.01억원`, 1,130,000 → `1.13백만원`). 부동소수 곱셈 뒤 `Math.floor` 금지(이전엔 2.3억→`2.29억`). 회귀 = `number-utils-short.test.ts` 1억~50억 100만원 배수 전수 루프. 사용처: 홈 최근 순자산 막대(`dashboard.tsx`)·순자산 달력 칸(`net-asset-chart.tsx`)
- 리스트 카드 위계: 접힘행 왼쪽=핵심 식별(이름·비중), 상세는 펼침에 — 비종목 자산도 동일(`design-system.md §11`)

### U5. 디테일 폴리시 (design-system.md §6)
> UI 신규·수정 시 항상 검토. CSS 전환 + `tw-animate-css`(framer-motion 미사용), `motion-safe`로 reduced-motion 대응.
- **`transition: all` 금지** → `transition-[color,box-shadow,transform]` 등 변하는 속성만 명시(button/toggle/kpi-card/accordion/dialog/navigation-menu/sidebar/switch 적용 완료)
- **누름 피드백** `active:not-disabled:scale-[0.96]`(카드류 0.98~0.99). `Button`은 기본 적용 — link 변형·`static` prop은 제외
- **진입 stagger** `motion-safe:animate-in fade-in slide-in-from-bottom-*`(뷰 컨테이너: dashboard/detail-hub/performance-hub) + 리스트는 `animationDelay`로 분산(FAB 타입 선택 40ms 간격)
- **숫자 `tabular-nums`** — 수량·환율·건수·금액 등 자릿수 흔들리는 표기 전부
- **`text-balance`(제목)·`text-pretty`(본문)** — 헤딩/설명 줄바꿈 균형
- **최소 히트영역 40×40px** — 작은 닫기/dismiss 버튼은 `after:absolute after:-inset-*`로 터치영역 확장, 헤더 아이콘 버튼 `h-10 sm:h-11`
- **`will-change` 절제**, 동심 radius·광학 정렬·shadow 우선·이미지 outline 검토

> 스캔 예시:
> ```bash
> grep -rn "onClick" src --include=*.tsx | grep "<div\|<span"        # 클릭 가능 div/span
> grep -rn "size=\"icon\"" src --include=*.tsx                        # 아이콘 버튼 aria 누락 후보
> grep -rn "text-black\|text-white\|bg-white\|bg-black\|#[0-9a-fA-F]\{6\}" src --include=*.tsx  # 하드코딩 색
> grep -rn "transition-all" src --include=*.tsx                       # transition:all 잔존(폴리시 위반)
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
| R11 | **PWA 설치 흐름 공용화** | 홈 버튼·웰컴가이드가 `PwaInstallFlow` 단일 소스 공유 — 한쪽 트리거/문구만 고쳐 다른 진입점이 어긋나지 않는지. `PwaInstallButton` 공개 API 시그니처 보존. 설치 가이드는 `InstallGuideContent({ env })` 단일 소스(iosStep·guideStep 공유) |
| R12 | **transition:all 잔존** | UI 컴포넌트에 `transition-all` 재유입 금지 — 변하는 속성만 명시(레이아웃 thrash·원치 않는 transition 방지) |
| R13 | **pull 후 sync-state 재기록** (전제 무효) | `clearAssetData` keepKeys에 `STORAGE_KEYS.syncState`가 이미 있어 `secretasset_sync`는 삭제되지 않는다 — `runPushAfterRestoreFix`는 이중 방어로만 남아 있다. keepKeys에서 `syncState`를 빼면 이 항목이 다시 살아난다(F-CLOUD-SYNC S9) |
| R14 | **자동 push 트리거·동시성 가드** | 자동 push는 **사용자 편집 신호만**(`ASSET_USER_EDIT_EVENT`·`notifyAssetUserEdit()`·`NICKNAME_EVENT`) + `busyRef` 뮤텍스로 push↔pull 동시 실행 차단(S10). 파생값 제외 payload 비교(구 `getComparablePayloadString`)를 **재도입 금지** — 제외 목록 방식은 파생 필드가 늘 때마다 새서(2026-07 `baseDate` 매시간 핑퐁, 2026-10 daily 롤링 절단·`dailyArchive` 이관으로 조회 기기 push) 편집 기기에 "다른 기기의 변경" 토스트가 반복됐다. 반대 방향 위험: `saveData`를 우회하는 **사용자 편집 경로가 신호를 안 쏘면 동기화 누락** — 신규 경로 추가 시 `notifyAssetUserEdit()` 호출 확인. 파생 갱신은 `saveAssetData` 직접 호출(신호 없음) 유지. R5(sync abort)와 연계 |
| R26 | **pull이 로컬을 지우기만 하고 복원하지 않는 필드** | `applyImportedPayload`는 `clearAssetData` **전에** 로컬을 읽어두고 수신분이 없으면 되돌려 써야 한다(daily/monthly 스냅샷·`dailyArchive`). "payload에 없음"을 "삭제"로 처리하면 스냅샷 없는 기기가 push한 순간 다른 기기의 이력이 증발한다. 신규 payload 필드를 추가할 때 이 패턴을 따를지 판단할 것 |
| R27 | **집계 카운트 ≠ 존재 여부** | `getAssetSummary()`의 `*Count` 필드가 특정 조건(예: `loanCount`는 `balance>0`만, S-4.24)으로 필터링되면, 그 필드를 "탭에 갈 데이터가 있는가"를 묻는 네비게이션 게이트(`onClick={() => s.xCount ? go(...) : ''}` 류)에 그대로 재사용하지 않는다 — 필터링된 항목만 있으면 카운트가 0이 되어 그 데이터로 진입할 방법이 없어진다(대출 전부 완납 시 상세 허브 "대출" 카드가 no-op이 되던 회귀, 2026-08 QA). 네비게이션 게이트는 원본 배열의 `length > 0`(존재 여부)로, 표시용 숫자는 `*Count`(현황)로 **분리**할 것. 새 `*Count` 필드에 필터를 추가할 때마다 그 필드의 모든 소비처(KPI 표시·게이트·AI 프롬프트 헤더-본문 정합 등)를 함께 점검 |
| R15 | **동기화 해시·코드 호환** | `#sync=` 신규, `#asset=`/`#vault=` 구 진입 호환 유지(provider detect·clearPendingConnect). `sync:`(동기화 코드) ↔ `share:`(복원 코드) 구분 보존 |
| R16 | **SVG 애니메이션 공용 플레이어** | 모든 단계형 애니메이션은 `StepAnimationPlayer` 단일 경로(`InstallGuideAnimation`·`SyncSetupAnimation`·`PwaSetupAnimation` 위임). **각 애니메이션의 소비처가 최소 1곳은 유지되는지**(공지 개편처럼 사용처를 걷어내면 고아 코드가 되고 가이드가 앱에서 사라짐 — `SyncSetupAnimation`=기기 동기화 설정 화면, `PwaSetupAnimation`=`InstallGuideContent`). 멈춤/시작·단계 점 컨트롤은 `pointer-events-auto`(`pointer-events-none` 컨테이너 내부 동작 보장). SVG fill에 색 토큰 className 직접 사용 금지 → `fill="currentColor" className={토큰}` (className을 `fill={HINT}`로 넣으면 다크모드 미표시) |
| R17 | **닉네임 상태 동기화 누락** | 닉네임 변경(`NICKNAME_EVENT`) 시 `AssetDataProvider`의 `assetData` 상태 동기화 누락으로 CRUD/동기화 시 닉네임 초기화 방지. **커밋은 탭 이탈(언마운트) 1회** — 입력 중 draft만 갱신, `useEffect([nickname])`로 외부 pull 반영해 stale 재push 차단(F-MISC) |
| R21 | **pull 후 시세 미갱신** | 기기 동기화 pull(`runPull`·`armWithPull`)은 `refreshData`가 아닌 **`initAndSync(getAssetData())`** 호출 — 양쪽 기기 자산 보유 시 pull 후 오늘자 주식·환율 미갱신 방지. `refreshData`로 회귀 금지(F-SYNC·F-CLOUD-SYNC) |
| R18 | **동기화 pull의 앱잠금 인증키 삭제** | `clearAssetData` keepKeys에 `secretasset_pwa_auth*` 보존 + `autoPullIfNewer` 진입 `isPwaLocked()` 가드. 누락 시 동기화 후 PIN 해시 유실→"비밀번호 불일치"(P0), 또는 잠금화면 위 pull로 우회. 해제는 `PWA_UNLOCKED_EVENT`로만 즉시 pull(F-CLOUD-SYNC S11) |
| R19 | **share/sync 해시 삭제 시점** | `#share=`(localKey 포함)·`#sync=`는 **소비 완료/모달 닫힘 시** 제거(share=확정·취소·데이터적용, sync=`clearPendingConnect`). 복원·연결·코드획득은 `pendingToken`/`pendingConnectAssetId`/`syncLink` **state 기반**이라 해시 비의존(해시 재읽기 코드 재유입 금지) |
| R20 | **다이얼로그 여는 틱 replaceState 금지** | Next.js(App Router)는 `history.replaceState`를 패치해 라우터 갱신 유발 → Radix `Dialog`가 **열리는 같은 틱**에 호출하면 `DismissableLayer`가 즉시 `onOpenChange(false)`로 닫힘(연결/PIN 팝업 즉시 닫힘 버그). 해시 제거 등 replaceState는 **다이얼로그를 여는 경로에서 분리**(닫힘 시점에 수행) |
| R22 | **전체화면 게이트 활성 시 자동 동작 차단** | 게이트는 **2종**(인앱 브라우저 `isInAppGateActive()` · 앱잠금 `isPwaLocked()`)이고 백그라운드 동작 가드는 **`isBackgroundWorkBlocked()`**([background-gate.ts](../../src/lib/pwa/background-gate.ts)) 하나로 통일한다 — 지점마다 따로 쓰면 한쪽을 빠뜨린다(부동산 갱신 effect가 실제로 그랬다). 적용: asset-data `initAndSync`(데이터 로드 후 조기 return)·0→양수 전환 effect·부동산 실거래 갱신 effect·cloud-sync `#sync=` 연결 모달. cloud-sync arm effect는 인앱 게이트만(armed 진입 차단, assetId/lastSyncedAt/syncLink 유지) — 앱잠금은 arm을 막지 않고 push/pull을 각각 `isPwaLocked()`로 막는다. 누락 시 게이트 뒤에서 자동 동기화·오늘자 시세/스냅샷이 계속 돎. 일반 브라우저·비잠금에선 `false`라 정상 동작(회귀 주의) |
| R23 | **휴장일 slot 계산 순서** | `getStockCacheSlot`의 영업일 판정은 `isInSession` 체크보다 반드시 먼저 실행 — 순서가 바뀌면 휴장일에 세션-모양 시간대일 때 `effectiveDate`(달력 날짜)가 그대로 반환돼 매일 slot이 바뀌고, 실시간 quote 재조회가 원인분해에 허위 "시세 변동"으로 노출된다(F-SYNC·F-ACTIVITY 연계) |
| R24 | **해외 개장 전 flat 라벨 미고정 시 stale 재발** | `getStockCacheSlot("foreign")`의 `!isInSession` 분기에서 `beforeTodaysOpen`(오늘 영업일·세션 개장 전) 판정 없이 `effectiveDate`만 반환하면, 마감 컷오프(07:00 KST)~개장(17:00/18:00 KST) 구간의 flat 라벨이 "오늘"이 되어 어제 종가가 오늘 날짜로 캐싱된다. 이 라벨이 이후 휴장일 롤백 결과와 우연히 같아지면(예: 금요일 오전 캐싱="금요일" = 토요일 롤백 결과="금요일") 클라이언트가 재조회를 스킵해 하루 이상 stale 노출(2026-08-22 TSLA 실사용 사례). `beforeTodaysOpen` 분기 제거 금지 |
| R25 | **`PWA_UNLOCKED_EVENT`에 로컬 시세 동기화 리스너 중복 추가 금지** | 마운트 시점에 `isPwaLocked()`가 true면 `runBootstrap()` 자체가 호출되지 않아(`bootstrapDoneRef`가 `false`로 남음) "잠금 해제 후 동기화가 재개 안 된다"로 오진하기 쉽지만, 실제로는 `pwa-lock-screen.tsx`가 PIN 성공 시 `unlockAndLoad()`(=`runBootstrap()`)를 직접 호출해 `initAndSync`→`syncTodayStockPrices`까지 이미 정확히 1회 수행한다. 이 오진으로 `asset-data-context.tsx`에 별도 `PWA_UNLOCKED_EVENT` 리스너를 추가해 같은 동기화 시퀀스를 또 실행시켰던 적이 있는데, `unlockAndLoad()` 완료 직후 `emitPwaUnlocked()`가 쏘는 같은 이벤트를 이 리스너가 다시 소비해 "PWA 접근 시 오늘자 동기화가 항상 2번 실행" 회귀로 이어졌다(2026-08-22 발견·제거). `PWA_UNLOCKED_EVENT`는 `cloud-sync-provider.tsx`의 원격 pull 트리거·hashchange 감지 용도로만 쓰고, 로컬 시세 동기화는 `unlockAndLoad`/`runBootstrap` 경로 단일화 유지 |
| R31 | **뒤로가기 콜드스타트 폴백 홈 직행** | `back()`의 `history.length<=1` 폴백은 항상 `navigate({type:"home"})`. 다른 history-의존적 화면(`more`처럼 자신도 `history.back()`을 쓰는 화면)으로 폴백하면, 그 화면에서 다시 뒤로가기 시 방금 만든 push를 되감아 원래 화면으로 돌아오는 **홈 도달 불가 루프**가 생긴다(과거 `settings`→`"more"` 폴백 버그, F-NAV) |
| R28 | **동기화 push의 원자성·기준점 병합** | ① `/api/sync` PUT의 버전비교+저장은 반드시 `compareAndSetAssetEnvelope` 단일 호출 — read-then-write로 되돌리면 동시 push 시 lost update(어느 쪽도 409를 못 받고 나중 쓰기가 먼저 쓰기를 지움). ② pull 병합은 **반드시 `syncedIds` 기준점 기반**이어야 한다. **CAS·pull-first로는 이걸 못 막는다** — 그건 "최신을 못 본 채 쓰지 마라"(쓰기 순서)만 통제하고, 최신을 정상 수신한 기기가 그걸 **잘못 해석해 되살린 뒤 push**하는 건 baseVersion이 최신이라 CAS 관점에서 완벽히 정당한 요청이다. 기준점을 빼고 "로컬에 있고 원격에 없으면 되살림"으로 되돌리면 **다른 기기의 삭제가 부활→재-push→상대 기기에서도 부활**해 "지웠는데 1분 뒤 다시 나타남"이 무한 반복된다(삭제가 tombstone 없이 배열 제거라 부재가 신규추가/삭제 두 의미를 갖는 게 근본 원인). ③ 기준점 갱신은 pull=**병합 전 원격 키**, push=**push한 키** — pull 후 병합 결과로 갱신하면 아직 안 올라간 신규분을 다음 pull이 "삭제됨"으로 오판해 스스로 지운다. ④ `forgetRemembered`가 `syncedIds`를 보존. ⑤ armed 폴링 effect의 `online` 리스너(force pull) 유지. 하나라도 빠지면 "자산이 조용히 사라지거나 지운 게 되살아나는" P0가 재현된다(F-CLOUD-SYNC) |
| R32 | **인증카드 캡처 DOM에 뷰포트 기준 반응형 금지** | share-card.tsx의 캡처 대상(`cardRef`) DOM에는 `sm:` 등 뷰포트 미디어쿼리 클래스를 쓰지 않는다 — 캡처는 고정폭(`CARD_WIDTH`, share-menu.tsx — 480→460px 2026-08-08 → 520 → 680px #4.24 확대(레퍼런스급 대형 도넛). 단일 고정값이라 기기 무관 동일 PNG 결정성은 유지. `CARD_WIDTH` 변경 시 `portfolio-ring-card.tsx`의 `VIEW_W`(=CARD_WIDTH−24)와 `CAPTURE_TARGET_PX` 기반 pixelRatio 계단을 함께 확인할 것) 카드인데 `sm:`은 브라우저 뷰포트 기준이라 PC/모바일에서 같은 사용자가 다른 크기로 캡처되는 버그가 있었다(F-SCREENSHOT). 미리보기와 저장 대상은 **별개 인스턴스**(#4.24, `ScaledCardPreview` 폐기): 프리뷰 `<ShareCard responsive />`(화면 표시, outer `w-full`)와 화면 밖 고정 680px 캡처 `<ShareCard cardRef={cardRef} />`(항상 마운트, `toPng` 대상). **두 인스턴스 모두 하위 컴포넌트에 `screenshotMode`를 넘겨 렌더 구조가 동일**하다 — 차이는 outer 폭·패딩과 `PortfolioRingCard`의 링 fit-to-width 스케일(`responsive`)뿐. **`captureImage`의 `pixelRatio` 계산은 반드시 `el.offsetWidth`(레이아웃 폭) 기준 — 캡처 인스턴스의 `offsetWidth`는 항상 680이라 `ceil(1400/680)=3` 고정. `getBoundingClientRect().width`로 되돌리면 transform 영향으로 기기마다 다른 해상도(QA에서 발견, 2026-07-27 수정)**. 프리뷰 표시 방식(다이얼로그 폭·패딩·링 스케일)은 저장 PNG에 무영향. 금지는 어디까지나 캡처 대상(`cardRef` 하위 = `share-card.tsx`) DOM에 한정. | **주식 탭 컴포넌트를 재사용하는 `screenshotMode` 경로(`StockCard`/`StockRowHeader`/`StockIcon`/`StockCategorySection`/`DetailSummaryHeader`/`ProfitMetric`)는 `ASSET_THEME` 대신 `ASSET_THEME_SHOT`(theme.ts, 데스크톱 값 고정) 토큰을 쓴다 — 캡처 DOM에 새 클래스를 넣을 때 반응형이 필요하면 `sm:`을 직접 쓰지 말고 이 토큰에 고정값을 추가할 것. `StockCard`는 `screenshotMode`면 함수 상단에서 조기 return 해 `Collapsible`(펼침) DOM 자체를 렌더하지 않는다 — 인증카드는 정적 이미지라 프리뷰·캡처 모두 펼침 없음(`shot = !responsive` 분기 폐기, #4.24).**
| R29 | **원인분해 flow 윈도우 경계(`inFlowWindow`)** | 경계는 **자산군 축**(주식·코인=항상 시작일 제외 / 현금·대출=포함)과 **구간 위치 축**(현금·대출은 전체 첫 구간만 포함, 하이브리드 `newer`는 제외)의 조합이다 — **네 함수를 같은 경계로 통일하면 반드시 회귀한다**(F-ACTIVITY 경계 항목 참조). 되살아나는 것: ①없는 "주식 매도"가 매수와 쌍으로(2026-08-06) ②income/debt가 무관한 `cash` 잔차로 증발(2026-08 P1) ③mid 당일 거래 이중계상으로 income 2배 + 유령 "현금 잔액 감소"(2026-08-06 QA). `resolveAttribution`에 `isFirstSegment` 인자를 추가하거나 새 호출처를 만들 때 이 값을 반드시 명시할 것(기본값 `true`라 하이브리드 2번째 구간에서 빠뜨리면 조용히 ③ 재현). `detectCashRoundTrip`도 같은 경계 사용. **합계 = `deltaNet` 항등식은 어느 쪽이든 유지되므로 기존 항등식 테스트로는 못 잡는다** — 반드시 key별 금액을 단정하는 테스트로 고정 |
| R30 | **화면(React state) ↔ localStorage 정합** | 백업·push는 localStorage를 읽고 화면은 React state를 렌더한다. 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준) 정합이 pull 후 `initAndSync(getAssetData())` 재호출 하나에만 의존한다. 갈라진 순간의 백업은 최신 기록이 빠진 파일이 되고 그걸로 복원하면 유실된다 — `exportAssetData(currentData)`의 `isExportDataStale` 가드가 유일한 방어이므로 **호출처가 화면 state를 넘기는지** 확인(F-IMPORT-EXPORT). **근본 원인(어느 경로가 localStorage를 되돌리는지)은 미추적** — 2026-08-06 실사례에서 25분 뒤 자연 복구돼 영구 유실은 없었으나 재발 시 계측(pull 완료·`syncTodayStockPrices` 저장 직전·push 직전 caller/건수 로깅)부터 할 것 |
| R33 | **가로 스크롤바 전역 금지** | `globals.css` `body { overflow-x: hidden }`(+ `html { touch-action: pan-y }`)로 페이지 레벨 가로 스크롤을 차단한다. **신규 UI가 뷰포트를 가로로 넘기면 스크롤바가 아니라 그 컴포넌트를 `min-w-0`/`max-w-full`/`truncate`로 수렴**시켜 해결(날짜 input R10, 인증카드 미리보기 = 반응형 렌더 + `PortfolioRingCard` 링 서브트리 fit-to-width 스케일과 동일 원칙). `body` 규칙은 **내부 `overflow-x-auto` 컨테이너**(X-Ray 넓은 표·코드블록 등 의도적 가로 스크롤)는 막지 않는다 — 이건 그대로 유지. `overflow-x: hidden`을 다른 곳에서 걷어내지 말 것(#4.24 인증카드 모바일 확대에서 도입) |
| R34 | **인증카드 로고 로드 견고성** | 로고 `<img>`는 반드시 **`useLogoSrc` 훅**(`src/hooks/use-logo-src.ts`) 경유 — `resolveLogoSrc`를 직접 부르면 재시도가 빠진다. 영구 `imgError` state 폴백 패턴 재도입 금지(한 번 실패하면 캡처까지 로고가 안 돌아옴). 요청 크기는 **`captureLogoSize(표시px)`**로 환산(`/api/logo`가 `retina=true` 강제 → 반환 PNG ×2). `size:512`/`size*N` 같은 과대 요청 금지 — 44~92px 칩에 1024px PNG를 7~14장 요청해 모바일 Whale WebView가 디코드/메모리 한계로 로고를 통째로 못 그렸다(2026-09, PC는 정상이라 놓치기 쉬움). `captureImage`는 pre-pass 전 `settleImages`(이미지별·전체 타임아웃)로 로드 대기하고, `handleSave`는 전체 하드 타임아웃(`Promise.race` 20s)으로 감싼다 — 이미지 실패가 저장 무한 대기·버튼 고착으로 이어지지 않게. `/api/logo`는 진행 중 요청 `cacheKey` dedup(모듈 `inFlight` Map) + upstream 8s. |
| R35 | **인증카드 프리뷰/저장 텍스트 크기 분리** | 저장 PNG는 680px 아트보드, 프리뷰는 ~374px이라 같은 절대 px면 저장본 텍스트가 프리뷰의 절반 비율. 캡처 인스턴스(`shotBig`=`!responsive`)는 `ASSET_THEME_SHOT_BIG`(폰트·아이콘을 `SHOT_BIG_SCALE`배 한 결과를 하드코딩, 현재 1.46) + `PortfolioSectorBar big` + 도넛 라벨 `rLabelFont=round(12*SHOT_BIG_SCALE)`(→18)로 저장 이미지가 프리뷰와 비슷한 시각 비율이 되게 한다. 프리뷰(`ASSET_THEME_SHOT`)와 캡처(`ASSET_THEME_SHOT_BIG`)의 base는 2026-09부터 분리 — 프리뷰만 상세 탭보다 ~2px 낮췄고 캡처 크기는 그대로. `ASSET_THEME_SHOT`은 인증카드 프리뷰 전용이라 상세>주식 탭·저장 PNG에 영향 없음. **배율 조정 시 `SHOT_BIG_SCALE`을 바꾸고 `ASSET_THEME_SHOT_BIG` 값들을 `base×SCALE` 반올림으로 재계산해 교체**(Tailwind JIT가 `text-` 임의값을 소스 문자열로 스캔 → CSS 변수·런타임 계산·템플릿 리터럴 불가. calc + CSS 변수 임의값 방식은 시도했다가 프리뷰 아이콘 blowout·비중바 소멸로 롤백). `screenshotMode`를 `!responsive`에 재결속 금지(프리뷰 펼침 부활 — `shotBig`은 별도 플래그). `CARD_WIDTH`(680)·`pixelRatio`(3)·`VIEW_W`/`VIEW_H` 불변 → PNG 해상도·구도·프리뷰 크기 동일. |
| R36 | **투자 유형 설명 `max-w`↔`targetChars` 한 쌍 + 래퍼 `w-full`** | `share-card.tsx`의 설명 줄바꿈은 `max-w`(%)와 `renderDescriptionInLines`의 `targetChars`(문장 묶음 글자수)가 함께 결정한다 — 폭만 넓히면 글자수 기준이 그대로라 넓힌 공간이 무용지물이다(PC 프리뷰에서 실제 발생). 텍스트 블록 래퍼에 `w-full`이 없으면 래퍼가 `items-center` flex 자식이라 가장 긴 문장 묶음 폭으로 줄어들어 %가 그 폭 기준이 되고, 가장 긴 묶음이 항상 줄바꿈되며 고아 줄이 생긴다(2026-09 스크린샷 실측). 수용 글자수 ≈ 실효 폭 ÷ (글자 크기×0.79), `targetChars` = 수용−3. PC/모바일 분기는 `usePcPreview`. | 폭·글자수를 따로 조정 금지, 래퍼 `w-full` 제거 금지 |
| R37 | **`navigator.share`는 클릭 제스처 안에서 `await` 없이** | 캡처(수 초)를 `await`한 뒤 `share()`를 부르면 WebKit 등에서 제스처가 만료돼 조용히 실패하고 다운로드로 폴백(카카오톡 공유 불가의 원인). 사전 캡처 캐시(`preparedShareRef`)로 동기 호출하고, `title`/`text`를 넣으면 카카오톡에 텍스트로 같이 전송된다. **캐시는 키(`variant|showAmounts|xrayTick`)로 검증하고 내용 변경·닫힘 시 즉시 폐기**(탭 전환 직후 이전 이미지가 공유되던 P1, 2026-09 수정) — 준비 중엔 공유 버튼 비활성화. | 클릭 핸들러에서 캡처 `await` 후 `share()` 호출 금지, 캐시 키 검증·리셋 제거 금지 |
| R38 | **인증카드 캡처 DOM 소형 장식 요소에 box-shadow/ring 금지** | 웨일(Chromium)에서 `html-to-image` 캡처 시 box-shadow·`ring`이 있는 작은 둥근 요소(아바타 소품 타일·코너 배지·압정) 옆에 어두운 띠·삐침 아티팩트가 발생(검은 카드에선 섀도가 보이지도 않음). 캡처 인스턴스는 `InvestorAvatar flat`으로 섀도 제거, 압정은 `border`로 대체. | 캡처 DOM에 소형 요소를 추가할 때 섀도·링 지양 |
| R40 | **도넛 라벨 폭·높이 추정은 렌더 줄바꿈과 같은 규칙** | `portfolio-ring-card.tsx`의 `estLabelHeight`(→`ringH`·`topInset`·`pushOutside`)는 `splitNameWords` 토큰 그리디(`wrappedLineCount`)로 줄 수를 구한다. 렌더의 `<wbr />`·`line-clamp-3`와 규칙이 어긋나면(예: 총 em÷폭 근사로 되돌림) 하단/상단 라벨이 캔버스 밖으로 잘린다. 프리뷰 보정(`topInset`·`sideExtra`·`VIEW_H` 상한 해제·`pushOutside`)은 **캡처(`!responsive`)에서 0/기존 식**이어야 저장 PNG 구도가 유지된다(R32). 이름은 ≤3줄+비중 1줄, 화면 밖 잘림 금지. | 프리뷰 보정을 캡처에 적용 금지, 줄 수 추정과 렌더 토큰화 분리 금지 |
| R39 | **인증카드 캡처 텍스트 크기·높이는 기기(OS 한글 폰트) 무관하게** | 웹폰트가 Inter(Latin)뿐이라 한글은 OS 폰트(맑은 고딕 0.92em·Apple SD Gothic Neo 등)로 그려져 같은 px여도 캡처 글자 폭·줄 박스 높이가 기기마다 달랐다(iOS 웨일 vs PC, 카드 높이 ≈26px·글자 폭 ≈5~6% 차이). 캡처 텍스트는 `krPx()`(`useKoreanAdvanceScale`, PC 기준 `TARGET_ADVANCE=0.92`)로 글자 크기를 보정하고, 세로는 배수 `leading-*` 대신 **px 고정 줄높이 + 고정 높이 블록**으로 폰트 메트릭 영향을 차단한다. 간격 튜닝 공식의 half-leading 수치는 Windows 기준 근사값. | 캡처 DOM에 배수 줄높이·글자 크기 하드코딩 새로 넣기 금지(고정 px 블록·`krPx` 경유), PC에서만 확인하고 끝내기 금지(iOS 병행) |

---

## Phase 3 — 산출물

- 발견 이슈를 **P0(데이터 손실/크래시) / P1(기능 오작동) / P2(UX·표시)** 로 분류
- 회귀면 R# 매핑, 신규면 근본 원인·재현 경로(파일:라인) 기록
- 수동 항목(👤) 중 프리뷰로 검증 불가한 것(KIS 실시간 가격, OCR 정확도, 모바일 레이아웃)은 사용자 실행 체크리스트로 전달
- **이 스킬은 코드 이슈 진단·보고까지만 수행한다. 코드 수정은 사용자 승인 후 별도로.**

---

## Phase 4 — 지식베이스 최신화 (QA 마무리 단계)

> QA에서 확인한 최근 변경을 KB에 반영해 **문서-코드 드리프트**를 상시 0으로 유지한다. KB 문서는 코드가 아니므로 명백한 최신화는 직접 적용, 사양 판단이 갈리면 제안으로 남긴다.
>
> **실행 시점(CLAUDE.md "KB 문서 갱신은 배치로" 규칙)**: 작업마다 이 Phase를 돌리지 않는다. 여러 작업을 연속 진행한 뒤 **최종 push 직전** `/qa-full-test` 한 번으로 세션 내 누적된 `git diff` 전체를 한 번에 반영한다.

**대상 문서** (`.claude/_knowledge/`): `architecture.md` · `components.md` · `design-system.md` · `state-and-utils.md` · `dev-rules.md` · `types-and-schemas.md` · `api-reference.md` · `asset-and-subscription.md` · `changelog.md` · 본 문서의 `F-*` 현행 사양.

**점검 항목** (직전 작업·`git diff`가 닿은 영역 우선):
- [ ] **신규 공용 자산 카탈로그 등록** — 이번 변경으로 생긴 재사용 컴포넌트·유틸·디자인 토큰·패턴이 해당 카탈로그에 등록됐는가(CLAUDE.md 재사용 우선 규칙). UI→`components.md`/`design-system.md`, 유틸·Context·Store→`state-and-utils.md`, 코드 패턴·주의→`dev-rules.md`. 미등록 신규 공용 자산 금지.
- [ ] **스테일 참조 제거** — 삭제·리네임된 심볼(컴포넌트·함수·prop·토큰·경로)을 참조하는 문서 구절이 남아있지 않은가. 특히 R6(디렉토리 rename)·백링크·제거된 진입점.
- [ ] **`changelog.md` 반영** — 사용자 체감 변경·회귀 수정·신규 규약이 changelog에 기록됐는가.
- [ ] **`F-*` 현행 사양 일치** — 표시·동선·명칭이 바뀐 기능의 `F-*` 항목이 실제 동작과 일치하는가. 신규 회귀 위험이 확인되면 `R#` 레지스트리에 추가.
- [ ] **`design-system.md` 규약 동기화** — 새 색·간격·구분선·컴포넌트 규약이 생겼으면 문서에 흡수됐는가(문서에 없는 새 규약 잔존 금지).

**산출**: 갱신한 문서 목록 + 변경 요지. 제안으로 남긴 항목은 근거와 함께 별도 표기.

---

## 디자인·코드 규칙 (점검 시 함께 적용)

- 확인·제출 버튼 `Button variant="brand"`, 체크박스 기본 `Checkbox`(자동 brand). 매수=빨강/매도=파랑, 삭제=destructive 의미색만 예외
- 카드 액션 버튼: `Button size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5) 통일
- 목록 표시는 항상 `length > 0`, 비교 키 tickerList는 `.sort()`
- UI/화면 작업 시 `design-system.md`(단일 출처: 토큰·간격·컴포넌트·모션·정보 설계 휴리스틱) 준수

---

_최종 갱신: 2026-10-18 · **공개 API 방어(F-API-SECURITY)·GA4 행동 추적(F-ANALYTICS) 신설**(S-4.28) · 이전: 2026-08-02 · **대출 상환/추가 대출 거래내역 신설**(F-LOAN-TX, S-4.24) — 현금 입출금(S-4.22) 미러링. `loanSchema.balance` 0 허용(완납)해 `loan-tab.tsx`·레버리지 박스의 기존 `balance > 0` 필터가 완납 대출을 자동 제외, 완납 요약 목록으로 히스토리·재활성화 진입점 제공. 원인분해 `debt` cause는 예측 경로만 `reflectedLoanFlow`로 보강(정밀 경로는 이미 정확, 신규 cause 없음). 공유 토큰 `parts[13]` 꼬리 추가(R3). 이전: **일요일 "주식 시세 상승" 오표시 + cashRoundTrip 오탐 수정**(F-ACTIVITY) — 토요일 새벽 접속 시 stale(목요일 종가)해지는 토요일 스냅샷을 일요일에도 항상 upsert하도록 고쳐 R23(slot 고정)만으로는 못 막던 시작점 오염을 해소. `detectCashRoundTrip`의 이탈폭 계산에 `reflectedCashInflow` 누적을 반영해 왕복 판정과 기준을 통일 — 기록된 입금만으로 단조 증가한 경우의 오탐 제거. 이전: 2026-08-01 · **원인분해 기간 하이브리드 + income/cash/deposit 분리**(F-ACTIVITY) — `computePeriodAttribution`이 1주·1개월·3개월·올해 공통 알고리즘으로 실측 가능 구간과 예측 구간을 `mergeAttributions`로 합성(`estimatedUntil`로 부분예측 표시). `income`(기록된 입출금)과 `cash`(설명 안 되는 잔차)를 분리해 `incomeEffect`가 대수적으로 소거되던 P1 회귀 수정("인출·지출 −480만원"이 거래 기록 0건인데 표시되던 문제), `deposit`(임차보증금 증감) 신설로 `SnapshotBreakdown`에 없던 필드의 누출 원천 축소, 잔차 흡수 부호 안전장치 추가. **원인분해 자산군 분해 + "그 외" 범주 폐지** — `price:stock`/`price:crypto`/`price:realEstate`·자산군별 매수/매도, 잔차는 `priceResidual`→`cash`와 절대값 최대 원인 흡수로 처리(합계=deltaNet 항등식 대수적 보장). **`isClosedForBothMarkets` 휴장 억제 폐지**(토요일 실제 상승을 묻던 P1 회귀) — 일요일 방어는 R23(slot 고정)이 유일 수단. **앱잠금 백그라운드 차단**(F-APPLOCK) — 잠금 판정 `isPwaLocked()` 단일화(구 `checkIsLocked`의 standalone 조건 제거)·`isBackgroundWorkBlocked()` 공통 가드(R22 확장)·부트스트랩 단일 함수화·해제 순서 직렬화. **동기화 파생 변경 결함 수정**(F-CLOUD-SYNC) — 편집 대기 중 pull 보류(시간 상한)·pull "없으면 유지"(R26)·daily 제외를 오늘·어제로 확장·폴링 60s 정정·S9/R13 전제 무효 표기. 이전: 2026-07-26 · 원인분해 정확도 일괄 수정 — 외화 원가 환율 재평가 누출(`costFxRevaluation`)·예측 경로 신규 매수 누락(`estimatePeriodInflows` 거래종목 skip)·원인 카테고리 고정 순서(`getOrderedCauses`)·용어 통일. **휴장일 slot 계산 순서 수정**(F-SYNC, R23) — 영업일 판정을 `isInSession`보다 먼저 실행해 휴장일 slot 고정. 이전: 2026-07-11 · **인앱 브라우저 하드 게이트**(외부 이동 `openExternalBrowser`·게이트 활성 시 자동 동작 차단 `isInAppGateActive`, R22)·**동기화 변경 감지에 `baseDate`·`name` 제외**(장외 매일/장중 매시간 슬롯 도장 핑퐁 차단, R14 보강). 이전: 2026-06-30 · **기기 동기화 pull 후 `initAndSync` 전체 시세 동기화**(refreshData→initAndSync, R21)·**닉네임 커밋 시점 탭 이탈(언마운트) 1회로 변경**(draft 분리·외부 pull 반영, R17 보강). 이전: 2026-06-28 앱잠금+동기화 정합(clearAssetData `pwa_auth*` 보존·`isPwaLocked()` pull 가드·`PWA_UNLOCKED_EVENT` 즉시 pull, S11·R18)·share/sync URL 해시 삭제는 모달 닫힘 시점으로(R19)·**다이얼로그 여는 틱 replaceState 금지(Next 패치→Radix 즉시 닫힘 버그 수정, R20)**·인앱 복사 sync 기기 `#sync=` 링크 분기·iOS Safari 신형 임계값 15→18(iOS 18 ⋯메뉴 도입 반영) 추가. 이전: 2026-06-25 SVG 애니메이션 공용화(`StepAnimationPlayer`·3500ms·`PwaSetupAnimation`/`SyncSetupAnimation`)·"복원 코드"/"다른 기기 동기화 링크" 개명·공지 수동 진입·복원 2종 구분, R16. 2026-06-24 F-CLOUD-SYNC·F-PWA 정밀 QA(S1~S10·P1~P5·R13~R15)_

- (#142, v4.75) 주식 직접 추가: 매수일 기본값 = 올해 1월 1일(안내 문구 "기본값은 올해 1월 1일이에요. 실제 매수일을 알면 수정해 주세요."), 평단·현재가 입력으로 매수일이 자동 변경되지 않음, 수정 시 저장된 매수일 유지. 체험(`?trial=1`)·데모 종목은 장중·마감직후 '오늘' 칩 숨김(종가 후 칩 유지). 성과 › 자산 변화 › 주식 목록은 320px에서 세로 쌓기(겹침 없음), 400px 이상 2열. vitest `today-chip.test.ts`, `purchase-date-139.test.ts`.
- (#144, v4.76) 성과 › 자산 변화 › 주식 카테고리 헤더: 400px 미만 세로 쌓기·금액 좌측 정렬(320·360·375 `원` 분리 0), 400px 이상 우측 정렬.

### F-HOME-CAUSE-OPEN. 홈 원인 펼침 계측 — #4.89, 4.90에서 입구 변경
- ⚙ B 줄(원인 1개 이상) 탭·원인 0개 쉐브론을 **열 때(false→true)만** `feature_use` category `home_cause_open`(`홈 변동 원인 열기`) 1건(핸들러 `toggleCause` 1개, 송출처 grep 1곳), `접기`·닫을 때·체험 0건. 4.90부터 의미 = '원인 1줄을 보고 더 보기'. 테스트 `tax-entry-489.test.ts`

### F-HOME-TODAY. 홈 '오늘' — 지수 종가 줄·가장 큰 원인 1줄·7일 막대 — #4.90 #175 ([dashboard.tsx](../../src/app/(main)/_components/views/home/dashboard.tsx) · [market-entry-line.tsx](../../src/app/(main)/_components/views/activity/market-entry-line.tsx) · [market-compare.ts](../../src/lib/finance/market-compare.ts) · [home-today.ts](../../src/lib/report/home-today.ts))
- ⚙ **휴면 복귀(#4.92)**: 마지막 기록 20일 전 + 이번 주 일별 기록 ≥2 → 도착 Hero·허브 행 `M/D 이후`(가장 이른 이번 주 기록), 값 동일(C65). 이번 주 1개뿐 → `기록이 부족해요`. 매일 7일 `최근 7일`·신규 3일 `M/D 이후` 불변. 체험(`?demo=1`·`?trial=1`) Hero `전일 대비`(데모 `@D-1`)
- ⚙ A 문구 확정표(같은 날짜 1번·날짜 다름 시장별 `종가`·한 시장·휴장 `휴장`/전부 휴장 `종가` 생략·`오늘`/`실시간` 0), `marketLineState` 진리표, C69 시각 경계 4종(`market-line-490.test.ts`: kstAccessDay 15:59/16:00·STD 06:59/07:00·DST 05:59/06:00·토/월 06:30/10:00·11/27 추수감사절 다음 날), C65(홈 값 = 도착 '하루' 행 지수 열·휴장 = 도착 `휴장`), `pickTopCause`·`weekTrendTitle`, 팁 억제(dismiss 기록 0), GA title 표·송출처 전수, `listPeriodFromInit`, 시장 타일 하루 휴장 `휴장`. 테스트 `home-today-490.test.tsx`·`home-today-490.test.ts`·`home-today.test.ts`·`market-line-490.test.ts`
- 👤 주식 보유+과거 기록 있음: Hero 바로 아래·분포 필터 위에 20px 1줄(375·360 두 시장, 320 코스피만, 가로 넘침·2줄 0), 탭 → 시장과 비교 목록 '하루' 선택·표 '하루' 행 지수 열 = 줄 값, 뒤로 → 홈. B 줄 `보유자산 시세 상승 +734만원 외 1개` 탭 → 줄 사라지고 목록·`접기`, 포커스 패널 → `접기` 후 B 줄, 노드 재마운트 0. 7일 카드(기록 2개↑) 탭 → 자산 변화 전체·주. 첫 저장 당일·주식 없음·캡처: A·B·C 신규 표시 0. 홈 팁에 '시장과 비교' 기능 팁 안 나옴

