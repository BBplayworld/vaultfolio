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
- 👤 요약 헤더 평가손익·전일 대비, 해외 상세 환차손익(금액/수익률 2줄, 우측 매입환율 영역 미침범)
- ⚙ `computeStockMetrics`·`mergeStockGroup`·`groupStocksByTicker` 동일 ticker 병합(1회 집계)
- 엣지: 해외주식 원화/달러 평단 입력 분기, 환차익 계산
- 회귀: delisted 종목이 stockCount·stockCost·환차익에서 제외

### F-TRADE. 주식 거래내역 (매매 로그) ([trade-input.tsx](../../src/app/(main)/_components/forms/trade/trade-input.tsx) · [stock-trades-view.tsx](../../src/app/(main)/_components/views/detail/trades/stock-trades-view.tsx))
- 👤 거래 입력(매수/매도), 반영 ON/OFF, 반영 후 예상 포지션 인라인 미리보기, 중복 거래 인라인 확인
- 👤 거래 삭제 → 미반영 즉시삭제 / 반영 롤백 다이얼로그
- ⚙ `trade-utils`: 가중평균 평단·환율, 매도 차감, 미반영 스킵, **역산 롤백(수동 보유분 보존)**, `findDuplicateTransaction`, `pruneTransactions` 3년 롤링
- ⚙ `validate-reflection`: oversell/중복반영 restrict, manual_override/backdated confirm
- 엣지: 수동 보유분+반영거래 삭제 시 보유분 보존(P1 회귀), 전량매도 평단 0, 보유초과 매도 차단, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 저장(stale-closure 방지)

### F-CASH-TX. 현금 입출금 거래내역 ([cash-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx) · [cash-tx-view.tsx](../../src/app/(main)/_components/views/detail/cash-tx/cash-tx-view.tsx)) — 명세 [S-4.22](../specs/4.22-cash-transactions.md)
- 👤 현금 카드 "입출금 기록/내역" 진입 → 입금/출금(입금 시 정기·비정기 토글)·반영 ON/OFF·반영 후 예상 잔액·중복 인라인 확인. 로그 뷰 총입금·총출금·순유입 통계, 기간·유형 필터
- 👤 반영 거래 삭제 → 잔액 역가감 확인 다이얼로그 / 미반영 즉시 삭제
- ⚙ `cash-tx-utils`: `pruneCashTransactions`(3년 롤링)·`findDuplicateCashTx`(계좌·날짜·금액·유형)·`reflectedBalanceDelta`(반영분만)·`isCashWithdrawalValid`(출금초과 가드). `cash[].balance`는 진실원본 — 로그 추가/삭제해도 balance 단일 저장으로만 변경
- ⚙ 단일 저장 `addCashTransactionWithBalance`/`deleteCashTransactionWithBalance`(로그+잔액, stale-closure 방지, R4 대칭)
- 엣지: 출금 반영액>잔액 차단, 미반영 로그는 잔액 무변경, 미래·보존기간(3년) 밖 날짜 차단, 통화(USD·JPY/100) 환산
- ⚙ **날짜 필드 KST 기준(2026-08)** — 기본값·`max`(`todayStr`)이 `Date.now() + 9시간` 기준(구 UTC 자정 기준은 KST 00~09시에 오늘 날짜 선택 자체가 불가능했고, 기록된 거래가 하루 전으로 저장돼 F-ACTIVITY 원인분해 `income` 집계에서 누락되는 부작용도 있었음)
- 회귀: 공유 토큰 `parts[12]` 왕복·`caIdx` 재연결·구버전 파싱(R3), `getComparablePayloadString` 포함(사용자 편집 push, R14 핑퐁 없음)

### F-LOAN-TX. 대출 상환/추가 대출 거래내역 ([loan-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-tx-input.tsx) · [loan-tx-view.tsx](../../src/app/(main)/_components/views/detail/loan-tx/loan-tx-view.tsx)) — 명세 [S-4.24](../specs/4.24-loan-transactions.md)
- 👤 대출 카드 "상환/대출 기록·내역" 진입 → 상환/추가대출 토글·반영 ON/OFF·반영 후 예상 잔액·중복 인라인 확인. 로그 뷰 총상환·총추가대출·순상환 통계, 기간·유형 필터. 전역 "자산 업데이트" 플로팅 버튼의 대출 선택 → "상환/대출 기록"에서도 동일 폼 진입(대상 미지정, 폼에서 대출 직접 선택 — 현금과 대칭)
- 👤 반영 거래 삭제 → 잔액 역가감 확인 다이얼로그 / 미반영 즉시 삭제
- ⚙ `loan-tx-utils`: `pruneLoanTransactions`(3년 롤링)·`findDuplicateLoanTx`(대출·날짜·금액·유형)·`reflectedLoanBalanceDelta`(반영분만)·`isLoanRepaymentValid`(상환초과 가드). `loans[].balance`는 진실원본 — 로그 추가/삭제해도 balance 단일 저장으로만 변경. 대출은 통화 필드 없음(항상 KRW) — `cashTransactionSchema` 대비 `currency`·`recurring` 필드 없음
- ⚙ 단일 저장 `addLoanTransactionWithBalance`/`deleteLoanTransactionWithBalance`(로그+잔액, stale-closure 방지, R4 대칭)
- ⚙ **완납(balance=0)·재활성화** — 상환으로 잔액이 정확히 0이 되면 `loan-tab.tsx`의 `allLoans`(`balance > 0` 필터)에서 자동으로 빠지고, 별도 "완납된 대출" 요약 목록(비중 바·이자 집계 미포함, 이름·"완납" 배지·내역/기록 버튼만)에 노출. 그 목록의 "기록"에서 추가 대출(반영 ON, `+amount`)을 남기면 `balance > 0`으로 복귀해 `allLoans`에 재노출(별도 재활성화 로직 없이 필터 재평가만으로 성립)
- ⚙ **원인분해 `debt` cause 정확화(예측 경로 한정)** — 정밀(bothEnriched) 경로의 `debtEffect`는 스냅샷 `breakdown.loans` 델타라 이미 정확해 미변경. 예측 경로의 `estimatePeriodInflows`는 `loan.startDate` 기반 **신규 대출만** 포착해 기존 대출의 기간 내 상환을 놓쳤다 — `reflectedLoanFlow(assetData, from, to)`(통화 무관, `reflectedCashInflow`/`reflectedTradeFlow`와 동형)로 보강. 신규 대출이면서 동시에 반영 거래도 있는 경우 이중계산 방지를 위해 `estimatePeriodInflows`가 해당 대출을 `loanTxLoanIds`로 skip(`tradedStockIds` 패턴 미러링). 신규 cause 키는 만들지 않음(기존 `debt` 그대로)
- 엣지: 상환 반영액>잔액 차단, 미반영 로그는 잔액 무변경, 미래·보존기간(3년) 밖 날짜 차단
- 엣지: **신규 대출 등록은 잔액 0을 거부**(`loan-input.tsx` 폼 레벨 가드, `!editData && balance<=0`) — 완납은 상환 거래내역으로만 도달해야 하며, 등록 즉시 완납 상태로 생성되는 것을 방지(수정은 허용, 상환 반영으로 0 도달 가능)
- 회귀: 공유 토큰 `parts[13]` 왕복·`loanIdx` 재연결·구버전 파싱(R3), `getComparablePayloadString` 포함(사용자 편집 push, R14 핑퐁 없음), **R27**(`loanCount`≠존재 여부 — 아래 참조)
- 자동: `src/lib/__tests__/loan-tx-utils.test.ts`(prune·중복탐지·잔액델타·상환초과 가드), `src/lib/report/__tests__/asset-report.test.ts`(예측 경로 단독 상환 포착·신규대출+반영거래 이중계산 방지 2건)

### F-CRYPTO-TX. 암호화폐 매수/매도 거래내역 ([crypto-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx) · [crypto-tx-view.tsx](../../src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx)) — 명세 [S-4.25](../specs/4.25-crypto-transactions.md)
- 👤 코인 카드(병합·거래소별 하위 카드) "매수/매도 기록·내역" 진입, "자산업데이트" 플로팅 버튼(코인 선택) → "매수/매도 기록"에서도 동일 폼 진입(현금·대출과 동일 동선). 폼: 코인 선택·매수/매도 토글·수량·체결단가·날짜·메모·반영 ON/OFF·반영 후 예상 포지션 인라인 미리보기·중복 인라인 확인. 로그 뷰 총매수·총매도 통계, 기간·유형 필터
- 👤 반영 거래 삭제 → 포지션 롤백 확인 다이얼로그(수량·평단 변화 표시) / 미반영 즉시 삭제
- ⚙ **계산 엔진은 잔액 선형 가감(현금·대출)이 아니라 수량×평단 가중평균** — `trade-utils.ts`를 새 유틸 파일 없이 재사용(`computeNewPosition`/`recomputeFromLog`/`reverseTransaction`/`deriveBaseSnapshot`/`rollbackTransaction`/`pruneTransactions`/`findDuplicateTransaction`을 `TxLike`/`PositionLike` 구조적 타입으로 일반화, `validateReflection`도 동일). 삭제 시 단순 산술 역가감이 아니라 `rollbackTransaction`(거래로그 전체 재적용)으로 재계산
- ⚙ 단일 저장 `addCryptoTransactionWithPosition`/`deleteCryptoTransactionWithPosition`(로그+포지션, stale-closure 방지, R4 대칭)
- ⚙ 종합 카드는 하위 항목(거래소) 존재 시 `!hasSubItems` 조건으로 기록/내역 버튼을 항상 숨김(1개 거래소만 지정된 경우도 포함) — 개별 거래소 하위 카드(`SubCryptoCard`)에서만 기록. 주식(F-STOCK)과 동일 규칙
- ⚙ 원인분해 `buy:crypto`/`sell:crypto`가 `reflectedCryptoFlow`(반영된 실제 거래) 기반으로 정확화 — 이전엔 스냅샷 원가 델타 추정치였음. 예측 경로 `estimatePeriodInflows`는 `tradedCryptoIds`로 반영 거래 있는 코인을 매수일 추정에서 제외(이중계산 방지, `tradedStockIds` 패턴)
- 엣지: 초과매도 반영 차단, 미반영 로그는 포지션 무변경, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: 공유 토큰 `parts[14]` 왕복·`crIdx` 재연결·구버전 파싱(R3), `getComparablePayloadString` 포함(사용자 편집 push, R14 핑퐁 없음)
- 자동: `src/lib/__tests__/trade-utils.test.ts`(코인 구조적 타입 재사용 2건), `src/lib/report/__tests__/asset-report.test.ts`(정밀/예측 분기 buy:crypto 정확화·이중계산 방지 2건)

### F-TAX. 세금 신고 안내 ([tax-notice-box.tsx](../../src/app/(main)/_components/views/home/tax-notice-box.tsx) · [tax-calendar-view.tsx](../../src/app/(main)/_components/views/tax/tax-calendar-view.tsx)) — 명세 [S-4.23](../specs/4.23-tax-calendar.md)
- 👤 **홈 배너**: 자산 분포 카드 **아래**에 "내 자산 세금 일정" 박스. 이번 달·다음 달 항목 최대 3건 + 각 항목의 매칭 근거("상가·사무실 1건 보유 → 대상"). "월별 세금 일정 전체 보기" → `#tax`
- ⚙ **자산 파생 항목만 노출**(AC2): `getAssetDrivenHighlights`는 `common`(연말정산·건강보험료) 전용 항목을 제외한다. 자산이 없거나 해당 항목이 0건이면 **배너 자체가 렌더되지 않는다**
- ⚙ **월 단위 dismiss**(AC4): `STORAGE_KEYS.taxNotice` = `{ dismissedMonth: "YYYY-MM" }`(KST). 같은 달 재방문 미노출, 달이 바뀌면 재노출
- ⚙ **태그 매칭**(AC1): 상가(`realEstate.type==="commercial"`)→business, 부동산 보유→realestate, `category==="foreign" || currency!=="KRW"`→foreign, irp/isa/pension→pension, `mortgage-home`→loan, 현금 보유→cash
- ⚙ **해외주식 실현차익**(AC6·AC7): `computeForeignRealizedGain`이 거래 로그를 날짜순 replay(`computeNewPosition` 재사용)해 당해 매도분 손익을 KRW 통산. 250만원 초과 시 이듬해 5월 신고 대상 표기. 매수 로그·체결 환율 누락 시 현재 평단·환율 폴백 + "추정" 표기. 거래 로그 없거나 당해 매도 0건이면 `null`(미표시). 국내주식(KRW)은 집계 제외
- 👤 **캘린더 뷰**: `내 세금`/`전체` 필터, 현재 월 강조·자동 스크롤, 카드 `Collapsible` 상세, 하단 면책 문구 항상 노출
- 엣지: 12월 → 다음 달 1월 롤오버, `high` severity 우선 정렬, `전체` 모드에서 비해당 항목 `opacity-60`
- 회귀: `#tax` 직접 진입 복원 · 뒤로가기는 `history.back()`으로 진입 경로(홈/더보기) 복귀 · 백업 복원·동기화 pull 후에도 dismiss 유지(`asset-storage.ts` keepKeys) · sync payload 미포함(R14 핑퐁 없음)

### F-TRADE-SS. 거래 스크린샷 가져오기 ([trade-screenshot-import.tsx](../../src/app/(main)/_components/forms/trade/trade-screenshot-import.tsx))
- 👤 스크린샷 업로드→인식→선택 등록, 다종목 일괄(`addTransactionsBatch`)
- 엣지: 통화 KRW/USD 분기, 중복 거래 처리, 매칭 실패 종목 제외

### F-CRYPTO. 코인 시세 자동 갱신 (업비트) ([upbit-service.ts](../../src/lib/upbit-service.ts) · [api/finance/crypto](../../src/app/api/finance/crypto/route.ts)) — 명세 [S-4.20](../specs/4.20-upbit-crypto-price.md)
- ⚙ **1시간 슬롯**([coin-cache-slot.ts](../../src/lib/coin-cache-slot.ts) `getCoinCacheSlot`): 코인은 24시간 무휴장이라 주식과 달리 장중/장외·영업일·DST 판정 없이 **항상** `{YYYY-MM-DD}-H{HH}`(KST). `c.baseDate === slot`이면 재조회 스킵(AC1·AC2)
- ⚙ **공통 캐시**: 서버 키가 마켓 단위(`finance:coin:KRW-BTC-{slot}`)라 같은 코인 보유자끼리 캐시 공유 → 외부 호출이 슬롯당 1회로 수렴(AC3)
- ⚙ **캐시 버킷 분리**: 파일 캐시는 `COINS`/`COINS_LAST`로 `STOCKS`와 분리 — `writeFinanceCache` prune이 주식 유효일 문자열 매칭이라 같은 버킷이면 코인이 매 write마다 삭제됨. Upstash도 `finance:coin:` 접두 분리(`finance:stock:` SCAN 정리와 충돌 방지)
- ⚙ **rate limit 방어**(업비트 IP 기준 10 req/s의 20%만 사용): 슬롯 캐시 → stale(3시간) 즉시 반환 + `after()` 백그라운드 갱신 → 최초만 동기 대기(AC7). 외부 호출은 `finance:upbit:lock`(SET NX EX 5s)로 직렬화 + 최소 500ms 간격(AC8). 로컬은 단일 프로세스라 모듈 스코프 in-flight dedup으로 대체
- ⚙ **무효 심볼 방어**: `market/all`(1일 캐시)과 교집합 후 조회 — 미상장 심볼이 섞이면 ticker 요청 **전체가 400 실패**하므로 필수. 응답에 없는 심볼은 수동 입력값 유지(AC4)
- ⚙ 심볼 단위 중복 제거 — 같은 코인을 여러 거래소에 보유해도 1회 조회(AC5). epoch+AbortController로 취소된 응답 미반영(AC6)
- ⚙ 429·418 수신 시 재시도 없이 stale 유지 + `X-Upbit-Unavailable` 헤더(AC9)
- 👤 코인 보유 상태로 접속 → 현재가가 업비트 시세로 갱신, 같은 시간 내 재접속 시 외부 호출 없음
- 엣지: 업비트 미상장 코인(해외 거래소 전용) 수동값 보존, 코인 0개일 때 호출 자체 스킵
- 회귀: crypto `baseDate`·`currentPrice`가 `getComparablePayloadString`에서 제외되는지(R14 핑퐁), 공유 토큰(packV7) crypto 섹션 8필드 유지(R3)

### F-REALESTATE. 부동산 실거래 추정 ([realestate-service.ts](../../src/lib/realestate-service.ts) · [api/realestate](../../src/app/api/realestate/route.ts)) — 명세 [S-4.21](../specs/4.21-realestate-transaction-price.md)
- ⚙ **데이터셋별 면적 필드**(AC8): apt/offi/rh=`excluUseAr`, sh=`totalFloorAr`, nrg=`buildingAr`, 폴백 `plottageAr`. `areaKind`(exclusive/gross/plottage)가 다른 거래는 **절대 섞어 비교하지 않으며**, 후보 0건이어도 전체 풀로 되돌리지 않는다
- ⚙ **오매칭 차단**(AC9): `matchBy:"area"`(단독 sh·상가 nrg)에서 면적 미상이면 `matchTrade`는 반드시 `null`. 과거 회귀 = 시군구 전체 최근 거래 1건이 추정치로 노출됨
- ⚙ **매칭 점수**: 지번일치 > 단지명 > 법정동 > 면적근접 > 최근성. 면적 허용 오차는 **상대 ±10%(최소 ±3㎡)**. `resolveAddress`의 `jibun`이 estimate 요청까지 전달되는지(누락 시 정확도 급락)
- ⚙ **단가 폴백**(AC10): 같은 법정동·같은 areaKind·±30% 표본의 ㎡당 단가 중앙값 × 내 면적. **표본 3건 미만이면 미노출**. 등급(exact/similar/approx/estimated)·표본수 응답 포함
- ⚙ 조회 창 6→12→24개월 단계 확장, 캐시 슬롯 `${dataset}:${lawd}:${ym}` 재사용
- 👤 아파트: 주소 조회 → 추정가·근거(단지·면적·층) 표시, 상세 카드에 면적 수치 노출. 상가·단독: 면적 입력(㎡/평 토글) 전에는 추정 미노출, 입력 후 등급 배지와 함께 표시
- 회귀: `marketEstimate*` 전 필드가 `getComparablePayloadString`에서 제외되는지(R14 핑퐁), 공유 토큰 pack/unpack 포맷 미변경(R3)
- 자동: `src/lib/__tests__/realestate-match.test.ts`

### F-XRAY. 주식 X-Ray ([stock-xray-view.tsx](../../src/app/(main)/_components/views/detail/xray/stock-xray-view.tsx) · [lib/xray](../../src/lib/xray))
- 👤 5축(핵심분야·시가총액·지수·지역·통화) 전환, 분포바·집중도 등급, AI 분류 진행률, 프롬프트 확인·복사
- ⚙ `stock-xray` `computeBreakdown` 단일배정·합 100%, 미분류 처리, 레버리지/인버스 ETF 지수매핑(TQQQ·QLD→NASDAQ100, UPRO·SSO→S&P500)
- ⚙ `fetch-classifications` 캐시 hit 스킵·dedup·스트리밍, 실패 토스트 폴백, `classification-store` localStorage 90일
- 엣지: 전량 미분류 시 "준비 중", 집중도 임계값 0.6/0.35, delisted 가치 0
- 회귀: ticker 병합 후 집계(1회 노출)

### F-ACTIVITY. 성과 (순자산·수익·배당) ([views/activity](../../src/app/(main)/_components/views/activity))
- 👤 순자산 차트(현재+전년 대비), 수익 차트(기간별 일/주/월/연, basis 토글), 배당 차트(연간+월평균, 예상/실제)·월별 배당 종목
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
- ⚙ **`buy`/`sell`(주식 신규 매수·매도 회수) cause** — `assetData.transactions` 중 **반영된** 주식 거래를 체결액(체결 환율 우선, 없으면 현재 환율)으로 집계해 `saving`에서 분리(`reflectedTradeFlow`). **`buy + sell + saving = 종전 savingEffect` 항등식**이라 합계=deltaNet 불변. **예측(estimated) 경로도 동일 분리 적용**(과거엔 분리 안 해 매수 반영 시 `purchaseDate`가 갱신되지 않는 점 때문에 기존 보유 종목의 기간 내 추가 매수가 `estimatePeriodInflows`에서 통째로 누락돼 시세로 흡수되는 회귀가 있었음) — `estimatePeriodInflows`는 **기간 내 반영 거래가 있는 종목을 건너뛰어**(권위=거래내역) 이중계산 방지. 한계: 거래내역 스키마가 주식 전용이라 코인·부동산 매수는 `saving`에 남고, 매도는 체결액 기준이라 실현손익 차이를 `saving`이 흡수
- ⚙ **flow 윈도우 경계는 `inFlowWindow` 단일 출처 — 두 축으로 결정된다(2026-08-06)** — `reflected{Trade,Crypto,CashInflow,Loan}Flow` 4종이 `inFlowWindow(date, from, to, includeFrom)` 하나를 공유한다. **① 자산군 축**: 주식·코인은 `includeFrom=false` 고정 — `buy`/`sell`은 `dCostStock`(스냅샷 원가 차이)에서 **차감**되는 값이라, 시작 스냅샷이 그날 거래를 이미 반영했으면(반영 후 저장이 일반적) 같은 금액이 두 번 계상돼 `stockManual`이 반대 부호로 튀고 **입력한 적 없는 "주식 매도"가 매수와 같은 금액으로 쌍을 이뤄 표시**된다(실사례: 08-05 매수 2건 62,235+55,280=117,515원). 제외해도 누락되지 않는다 — 스냅샷 저장 **후** 소급 반영분은 원가가 올라가 `stockManual`이 같은 부호로 잡아 "주식 매수"가 된다. **② 구간 위치 축(현금·대출만)**: `income`/`debt`는 독립 항이라 누락되면 무관한 `cash` 잔차로 새므로(2026-08 P1) 시작일 당일을 포함해야 하지만, **전체 기간의 첫 구간에만** 적용한다(`resolveAttribution(..., isFirstSegment)`). 하이브리드가 `[prevOld,mid]` + `(mid,curr]`로 쪼갤 때 양쪽 다 포함하면 **mid 당일 거래가 두 구간에 잡혀 `income`이 2배가 되고 반대급부로 없는 "현금 잔액 감소"가 뜬다**(2026-08-06 QA 발견). 두 구간의 합집합 = `[prevOld, curr]`, 교집합 = 공집합이어야 한다. `detectCashRoundTrip`의 `incomeToDate`도 **같은 경계**를 써야 `netCashEffect`와 기준이 맞는다(단일=true, 하이브리드=false). **네 함수를 같은 경계로 통일하려 들지 말 것** — 어느 방향으로 통일해도 위 둘 중 하나가 회귀한다
- ⚙ **외화 원가 환율 재평가 누출(`costFxRevaluation`)** — `cost.total`이 현재 환율로 환산된 주식·현금 원가를 포함해, 환율만 움직여도 `savingFull`이 재평가분을 흡수해 `saving`↔`price`가 허위로 갈렸다(`fxEffect`가 평가액 기준 환차익을 이미 별도 계산하므로 이중귀속). `savingFullReal = savingFull − costFxRevaluation(...)`로 제외
- ⚙ **휴장 여부로 시세 원인을 억제하지 않는다** — 해외 종가는 `getDailyClosingRefDates("foreign")` 기준 **KST 화~토** 새벽에 갱신되고 국내는 평일에 열리므로 **월~토는 매일 주식 변동이 실재**한다. 옛 `isClosedForBothMarkets` 억제는 토요일(=미국 금요일장 종가가 새로 확정된 날)의 실제 상승을 통째로 "그 외"로 묻는 P1 회귀를 냈다(2026-08). 되살리지 말 것
- ⚙ **일요일 quote 노이즈 방어는 이제 R23(slot 고정)이 유일한 수단이다** — 일요일은 실측 변동이 없는 유일한 날인데, `getStockCacheSlot`이 휴장일 slot을 직전 영업일로 고정하므로 **재조회 자체가 일어나지 않아** `price:stock`이 0이 된다. **"금액이 작아서 안 보인다"는 방어가 아니다**: `pickTopCauses`는 `topCauses[0]`에 `CAUSE_DISPLAY_MIN`을 적용하지 않아(`|amount| > 0`만 확인) 유일한 비영 원인이면 금액과 무관하게 표시된다. 홈은 `negligible`(|deltaNet| < 1만원)로 한 번 더 막지만 **성적표에는 그 가드가 없다**. R23을 되돌리면 일요일에 허위 "주식 시세" 금액이 성적표에 그대로 노출된다(과거 changelog 2026-07-26의 "+366만원" 사례)
- ⚙ **토요일 스냅샷 stale 시 일요일 홈에 "주식 시세 상승" 오표시(2026-08 수정)** — R23은 quote **재조회**를 막을 뿐, 스냅샷 **시작점**이 이미 stale하면 방어하지 못한다. 토요일 KST 새벽(해외 컷오프 06/07시 이전) 접속 시 `getDailyClosingRefDates("foreign")`이 한 칸 더 과거로 물러나 그날 스냅샷에 **목요일 종가**가 박히는데, 종전엔 일요일 분기(`saveSnapshots`)가 `hasSaturdaySnapshot`이면 재기록을 건너뛰어(`if (!hasSaturdaySnapshot)`) 이 stale 값이 그대로 남았다. 일요일 시점의 `getDailyClosingRefDates`는 국내·해외 모두 반드시 금요일을 가리키므로, **일요일엔 토요일 슬롯을 항상 upsert**하도록 가드를 제거해 금요일 확정 종가로 자동 교정한다(`grade` 보존·환율 이력 기록도 upsert 경로로 통일). `src/lib/report/__tests__/asset-report.test.ts`에 stale/교정 두 시나리오로 `price:stock` 임계값 통과·미달을 회귀 고정
- ⚙ **시작점(prev) 선정은 같은 날짜에서 daily 우선**(`byDateThenDaily`) — 월말 daily와 monthly는 `_date`가 같아 안정 정렬만으로는 monthly가 먼저 잡힌다. 그러면 헤더 라벨이 "전일 대비" 대신 "지난 접속(7월) 이후"로 나오고, monthly에 v2 필드가 없으면 **예측 모드**로 떨어져 자산군별 시세가 통합 `price`로 뭉친다
- ⚙ **기간별 실측/예측 하이브리드 합성(`computePeriodAttribution`, 2026-08)** — **1주·1개월·3개월·올해 전부 같은 알고리즘**(기간별 특수 분기 없음). daily는 30일 롤링인데 1개월 목표일도 정확히 `오늘−30`이라 daily 후보가 단 하루뿐이고, 과거 monthly엔 v2 enrich가 없어(2026-07-23 이전 저장분) 1·3개월이 사실상 항상 예측이던 문제를 해소. 규칙: **`prevOld`가 이미 `isFullyEnriched`면 애초에 `mid`를 찾지 않는다**(전체 실측, 쪼갤 이유 없음 — 1주가 이 케이스). `prevOld`가 예측(레거시)일 때만 `prevOld`~`curr` 구간에서 `isFullyEnriched`(breakdown·fx·fxBase·cost 전부)를 만족하는 가장 오래된 **daily**를 `mid`로 찾아, `(prevOld,mid]`은 예측 + `(mid,curr]`은 실측으로 각각 계산 후 `mergeAttributions`로 key별 `effects` 합산(→ `pickTopCauses` 1회 재실행). `mid`는 monthly 제외(값 시점이 저장일과 최대 30일 어긋나 flow 윈도우 누락) — daily만 허용. **`mid` 없으면 단일 구간(종전과 완전히 동일 결과)**. `assetData.yearlyNetAssets`를 `YYYY-12-31` 앵커로 승격해 먼 과거의 폴백 후보도 넓힘(항상 예측 경로).
  - **P1 회귀(2026-08 발견·수정)**: "`prevOld`가 이미 실측이면 mid를 찾지 않는다" 가드가 없으면, 1주처럼 `prevOld`가 daily 30일 창 안이라 이미 완전히 실측인 경우에도 사이의 아무 enriched daily나 `mid`로 잡아 불필요하게 쪼갰다. `mergeAttributions`가 `older.estimated`를 확인 안 하고 무조건 `estimatedUntil`을 채우던 구현과 겹쳐, **전 구간이 실측인데 "그 날짜 이전은 추정치" 배지가 근거 없이 표시**됐다(실사용 재현: 1주가 07/27 이전 추정치로 오표시). 수정: mid 탐색 자체를 가드 + `mergeAttributions`도 `older.estimated`가 실제 `true`일 때만 `estimatedUntil`을 채우도록 방어적으로 이중 처리.
- ⚙ **`cashRoundTrip` 힌트(2026-08)** — 기간 중 `breakdown.cash`가 baseline에서 크게 벗어났다가 순변화 없이 되돌아오면(왕복) `resolveAttribution`이 두 끝점만 비교하는 특성상 `cash` 원인이 통째로 사라진다. `detectCashRoundTrip`이 실측 daily 구간(`mid`~`curr` 또는 이미 실측인 `prevOld`~`curr`)에서 최대 이탈폭·날짜를 찾아 `cashRoundTrip`으로 붙이고, 뷰가 "{날짜}에 최대 N만원 변동 후 복귀돼 순변화엔 반영 안 됐어요" 캡션으로 노출(`estimatedUntil` 캡션과 같은 자리, 둘 다 축약형 — 2026-08 문구 축약). 순변화가 최고 이탈폭의 절반 이상이면 조용히 생략(진짜 왕복이 아니라 단조 변화로 판단). `cash`만 대상(시세 등은 상시 변동이 정상이라 일반화 시 노이즈), 성적표 기간 선택기(`computePeriodAttribution`)에만 적용.
  - **오탐 회귀(2026-08 수정)**: 이탈폭(`breakdown.cash`, 기록된 입금 포함)과 왕복 판정(`cash` cause 잔차, 기록된 입금은 `income`으로 분리돼 제외)이 서로 다른 기준을 썼다. `cashTransactions`에 반영된 큰 입금이 있으면 잔액은 영구히 오르는데 `cash` 잔차는 ≈0이라 "왕복 후 복귀"로 오판되고, 이미 "월급·목돈 유입으로 +N만원 늘었어요"(`income`)가 표시된 화면에 모순되는 힌트가 함께 떴다(실사용 재현: 입금일=구간 끝 날짜인데도 힌트 노출). `detectCashRoundTrip`의 이탈폭 계산에서 시점별 `reflectedCashInflow`(시작점~해당 일자 누적)를 빼 **기록으로 설명되지 않는 변동만**으로 두 값의 기준을 맞춤. 진짜 왕복(현금이 실제로 나갔다 돌아온 경우)은 그대로 감지된다 — 그 이동은 기록이 없거나 입출금이 상쇄돼 누적 income이 0이기 때문.
- ⚙ **`estimated`→`estimatedUntil` 계약 확장** — `estimated: boolean`은 하위호환용(전체 구간이 예측일 때만 true). 부분예측(하이브리드 병합 결과)은 `estimatedUntil?: string`(이 날짜 **이전**만 예측)으로 표현. 뷰는 `estimated` → "예측" 배지, `!estimated && estimatedUntil` → "일부 예측" 배지로 구분(`asset-report-view.tsx`). `computeAttributionSince`(홈 "지난 접속 이후")는 **하이브리드 대상이 아니다** — 기존 `?? candidates[0]` 폴백만 유지
- ⚙ **원인 표시 카테고리 순서(`getOrderedCauses`)** — 절대값 크기순이 아닌 주식시세→코인시세→부동산시세→(예측)시세→환율→주식매수→주식매도→코인매수→코인매도→부동산매수→부동산매도→소득(income)→현금잔차(cash)→대출→임차보증금(deposit) 고정 순서로 나열(연관 원인이 나란히 보이도록). `topCauses[0]`(절대값 최대)의 선정 로직은 그대로, 나열 순서만 결정
- ⚙ **잔차 흡수는 부호가 같은 원인에만**(`getAttributionItems`, 2026-08) — 임계값 미만 잔차 합을 절대값 최대 원인에 얹되, 부호가 다르면 얹지 않는다(방향 고정 라벨에 반대 부호가 붙어 "주식 매수로 −3만원 늘었어요" 같은 모순 문장이 나오는 것 방지). 부호가 맞는 원인이 없으면 `cash`로(없으면 신설)
- ⚙ **용어**: 신규투입은 자산군별 "매수/매도"로 통일(`주식 매수`·`코인 매수`·`부동산 매도` …), 시세도 자산군 접두("주식 시세 상승"). 통합(자산군 미분리) `price`="보유자산 시세 상승/하락"(2026-08, 구 "시세 상승/하락"에서 명확화 — `price:stock` 등 실측 자산군별 라벨과 구분). `income`="현금 입금"/"현금 출금"(2026-08, 구 "소득 유입"/"인출·지출"에서 매수·매도와 같은 패턴으로 통일, 문장도 "현금 입금으로 ~ 늘었어요" 패턴), `cash`="현금 잔액 증가"/"현금 잔액 감소"(짧은 라벨은 사건을 단정하지 않지만, 서술형 문장은 "현금 잔액 직접 수정으로 ~ 추정돼요" — 실사례 디버깅으로 대부분 직접 잔액 수정이 원인임을 확인해 "추정" 어투로 반영, 2026-08), `deposit`="임차보증금 반환"/"임차보증금 증가", `debt`="대출 상환"/"신규 대출"(임차보증금 제외, 실제로 대출 잔액만 반영하므로 "부채"보다 정확). "그 외" 라벨은 없다. **라벨 단일 출처는 `causeShortLabel`** — `AttributionCause.label`·`causeSentence`가 모두 여기서 파생되므로 두 표기가 어긋날 수 없다(구 `CAUSE_LABELS` 소비처 0이라 제거)
- ⚙ **현금·대출 그룹은 항상 완전 분리(2026-08 QA)** — `groupAttributionItems`에 있던 "이 기간에 `debt`가 하나라도 있으면 `cash`를 `loan` 그룹으로 강제 편입" 규칙을 **완전히 제거**했다. 금액·연관성과 무관하게 트리거돼, 신규 현금 자산 대량 추가(8600만원)와 전혀 무관한 소액 대출 변동이 같은 기간에 겹쳤다는 이유만으로 그 현금이 통째로 "대출" 섹션에 표시되는 오분류가 있었다. `cash`는 항상 `ATTRIBUTION_GROUP.cash`(현금), `debt`는 항상 `loan`. `dCostCash` 계산식 자체는 `loans`를 참조하지 않아 금액은 원래도 정확했다(회귀 테스트로 확정)
- ⚙ **자산 타입별 그룹 박스 + 항목별 "일부 예측" 배지 + 부동산 안분 제외(2026-08)** — `groupAttributionItems`가 `getAttributionItems` 결과를 주식·코인·부동산·현금(`income`+`cash`)·대출(`debt`) 그룹으로 묶어 박스 하나에 여러 줄로 렌더(`fx`·`deposit`·통합 `price`는 그룹 없이 단독 박스). 그룹 나열 순서는 그룹 내 금액 순합의 절대값 큰 순서. `mergeAttributions`가 하이브리드 구간의 통합 `price`를 mid 시점 breakdown의 **주식·코인 비중에만** 안분해 실측 `price:stock`/`price:crypto`와 한 줄로 합치고 `estimated:true`로 표시(부동산은 안분 대상에서 제외 — `real-estate-input.tsx`는 시장가 자동 갱신이 없어 사용자가 안 건드린 부동산에 "시세 하락"이 뜨는 오귀속 방지). 안분된 줄에는 개별 "일부 예측" 배지(구간 전체가 `attribution.estimated`면 상단 배지로 충분하므로 중복 생략)
- ⚙ **현금 입출금 기록 날짜 기본값 KST 통일(2026-08)** — `cash-tx-input.tsx`의 날짜 필드 기본값·최대값(`todayStr`)이 `new Date().toISOString()`(UTC 자정 기준)이면 한국시간 00~09시에 입력한 거래가 하루 전 날짜로 저장돼 원인분해 `income` 집계에서 누락(→ `cash` 잔차로 오분류)될 뿐 아니라, **날짜 입력 `max` 제약이 KST 기준 "오늘"을 미래로 오판해 그 시간대엔 오늘 날짜를 아예 선택할 수 없었다**. 스냅샷 등 다른 "오늘" 계산과 동일하게 `Date.now() + 9시간` 기준으로 통일. 동일 UTC 패턴이 `trade-input.tsx`(주식 매매)·`loan-tx-input.tsx`(대출 거래)에도 남아 있음(이번 수정 범위 밖, 후속 검토 대상)
- 자동: `src/lib/report/__tests__/asset-report.test.ts` — 항등식(정밀·예측·표시항목), 미반영 현금기록 제외, buy/sell 분리(정밀·예측 양쪽), 체결 환율 환산, 외화 원가 fx-중립화, **토요일 실시간 끝점의 주식 시세 노출**·**"그 외" 라벨 부재**·**동일 날짜 daily 우선**, 자산군별 시세·매수 분해, 직접 수정분 방향 합산, 카테고리 순서, **income↔cash 실제 반응**·**deposit 분리**·**잔차 흡수 부호 일치**·**computePeriodAttribution 하이브리드 합성(4기간 공통·mid 부재 회귀·폴백)**, **토요일 stale 스냅샷의 price:stock 임계값 재현/교정(일요일 오표시 회귀)**, **기록된 입금의 cashRoundTrip 오탐 방지(income 반영 후 이탈폭 재계산)**, **하이브리드 price 안분(mid 구성비로 price:stock 병합·estimated 표시, 부동산 제외 확인 2건)**, **groupAttributionItems(자산군·대출 그룹핑, 순변동 절대값 정렬)**, **income 라벨/문장 통일**. `src/lib/__tests__/stock-cache-slot.test.ts` — 휴장일 slot 고정(F-SYNC 연계)
- 엣지: 전년 데이터 없음, 조회 중 상태, 배당 매수일 이전 payout 제외
- 회귀: 2단 캐시(REF_DATE_MAP/REF_PRICES) 휴장일 영구 hit, daily 캐시 키, 일별 표시값(국내 휴장 시 직전 영업일 종가) 불변

### F-REPORT. 자산 성적표 (5축 별점·트로피 티어) ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx) · [asset-grade.ts](../../src/lib/report/asset-grade.ts)) — 명세 [S-4.18](../specs/4.18-asset-report-card.md)
> 레버리지 박스(이자 vs 투자 수익)는 F-ACTIVITY에 있음 — 여기선 **5축 채점·티어·재정규화·이력화·delta**만 다룬다(중복 금지).
- ⚙ 5축 가중(growth .3 / earning .2 / leverage .2 / diversification .2 / habit .1). 측정 불가 축은 `null` → **측정 가능한 축만 가중 재정규화**해 종합 산출(신규 사용자도 등급, AC2)
- ⚙ 레버리지 축: 무부채(loanBalance≤0)=**5.0**(건전성 만점, AC3) / 자본잠식(equity≤0 & 부채>0)=**0.5**(AC4). 부채비율 40/60%·평균금리 6%·이자 커버리지 감가점
- ⚙ 채점 컷 전부 `GRADE_THRESHOLDS` 단일 소스(AC5) — 티어 4.5/3.5/2.5(platinum/gold/silver), 컷 근거는 각 score 함수 주석
- ⚙ 전 축 non-pending 확정 시 오늘 daily·이번 달 monthly `grade` 기록(`recordGradeSnapshot`, **동일 값 스킵=멱등**, 과거 불소급, AC6). `diffGrade`로 종합·축별 ▲▼·티어 승·강등(AC7) — 최근 과거 daily 우선, 없으면 이전 달 monthly 대비
- ⚙ **habit 저축 규칙성**(S-4.22) — ②'꾸준함'을 순자산 상승개월과 **현금 입금 관측 개월(최근 6개월, `savingsRhythm`)** 중 높은 비율로 채점(저축을 시세와 분리). 가중치 0.1·재정규화·티어 불변. 현금 거래 없으면 순자산 상승 폴백. habit 카드 → 현금 상세 딥링크
- ⚙ 투자 레버리지(부동산 담보 제외) 有 + 코인/부동산 보유 시 "암호화폐·부동산 수익 측정 불가 비교 제외" 캡션 + InfoHint(AC8)
- 👤 자산 0 → "자산을 등록하면 성적표가 계산됩니다"만 표시(AC1). 자산 등록 → Hero 티어(트로피 글로우)·종합 별점·축별 카드(reason/action·딥링크) 표시
- ⚙ **4대 섹션 아이콘 톤 구분(2026-08)** — "투입 대비 성과"(Wallet)·"5축 측정"(Star)·"순자산 변화, 왜?"(Landmark)·"AI 평가 프롬프트"(Sparkles) 4개 대주제 섹션이 `SectionHeader`의 `tone` prop(`brand`/`gold`/`important`/`info`, `asset-report-view.tsx`)으로 아이콘 배경·색만 구분(제목 텍스트는 `text-foreground` 공통 유지). AI 프롬프트도 이때 `SectionHeader` 사용으로 전환(이전엔 아이콘 배경 칩 없는 인라인 구조)돼 나머지 3개와 시각적 무게가 맞춰졌다. 새 톤을 추가할 색은 design-system.md에 이미 의미가 정해진 토큰만 재사용(신규 색 지양)
- 회귀: `grade`는 오늘 daily·이번 달 monthly에만 기록 → `getComparablePayloadString`이 두 곳을 이미 제외하므로 등급 확정이 push를 유발하지 않음(R14 핑퐁 없음). `SnapshotGrade` optional → 구버전 백업/공유 토큰(packV7)과 호환(R3)
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
- 회귀: **공유 토큰 버전 호환**(신규 필드 추가가 기존 URL 파싱 안 깨뜨리는지), 스냅샷 구분자 충돌

### F-SCREENSHOT. 인증카드 (share-card) ([share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx), [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx))
- 👤 상단바·하단네비 "인증카드" 버튼(`IdCard` 아이콘)으로 다이얼로그 오픈, "저장" 단일 버튼(`variant="brand"`)으로 이미지 다운로드
- 👤 다이얼로그 헤더는 모바일 포함 전 뷰포트 좌측 정렬(`text-left`로 shadcn `DialogHeader`의 `text-center` 오버라이드), 상하 여백 균등(`py-4`)
- 👤 **내용은 주식 기준으로만** — 자산군 도넛·"포트폴리오 구성" 바·자산군 통합 랭킹("핵심 자산 Top") 없음
- 👤 상단: **닉네임 미노출**(2026-08-08 제거) → `StockSummaryHeader`(주식 탭과 동일 컴포넌트, `DetailSummaryHeader`의 `screenshotMode` 분기) — 배경 박스 없이 아래 비중 바·리스트와 좌우 여백 동일(`px-2`=8px, 카드 전체 좌우 오프셋 20px), "총 주식 평가금액" 히어로 숫자는 `ASSET_THEME_SHOT.summaryValue`(`text-2xl`) + 평가손익(수익금·수익률). 원/달러 셀렉터·오늘 등락 칩은 미노출. **금액 전부(헤더·종목 리스트·"그 외 N종목") 전체 금액**(`840,180,000원` 형태, 상세 탭과 동일, `share-card.tsx`의 `mask`→`formatCurrency`) — 축약(`8.4억원`) 미사용
- 👤 비중 바 — **상위 5종목 색 구간 + 회색 `그 외`(#9ca3af) 구간** + 바로 아래 **범례**(색점 + 종목명 + 비중%, `그 외 N종목` 포함). 캡처 폭 고정이라 범례는 `ASSET_THEME_SHOT.legendGrid`(`grid-cols-2`)·`legendText`(`text-sm`) 사용, `sm:` 금지(R25). 비중 바·범례·리스트를 감싸는 래퍼는 **배경색 없음**(카드 전체 배경과 통일, 패딩 `p-3.5`만 간격 계산용으로 유지)
- 👤 종목 리스트 — 상세 > 주식 탭과 동일 형태(`StockCard screenshotMode`: 로고 아이콘 + 이름 + `N주`(**비중% 미노출** — 범례로 통합) + 우측 평가금액/손익 2줄 + 하단 비중 스트립). 상위 5개만, 초과분은 `그 외 N종목` 요약행 — **우측은 종목 카드와 동일 2줄**(나머지 평가금액 합 / 손익 `(+X.X%)`). 종합 수익률은 `(Σ평가−Σ원가)/Σ원가`(개별 평균 아님), 상장폐지 종목은 손익 합산에서 제외. **비중% 미노출**(범례 `그 외 N종목`과 중복)
- 👤 헤더~범례~리스트~푸터 간격 통일: 헤더~범례·범례~리스트 실제 노출 간격 28px로 동일(숨은 패딩까지 계산해 마진값 역산), 카드 최상단↔헤더 값·푸터↔카드 최하단 간격도 대칭(`pt-2`/`pb-2`). 금액 표시 스위치 끄면 금액류만 `••••` 마스킹(비중%·수익률%는 항상 노출), 푸터 좌측에 "시크릿에셋"(`text-xs text-foreground`) + 도메인(`secretasset.xyz`), 우측에 날짜
- ⚙ 데이터는 `useFilteredStockData("all")` 단일 출처 — 주식 탭과 캐시 키 공유(중복 fetch 없음). 종목 파생값은 `computeStockMetrics`
- ⚙ 색은 주식 탭과 동일한 `assignColors`(`MAIN_PALETTE`) — `SHARE_SAFE_PALETTE`는 더 이상 쓰지 않음(현재 소비처 0, design-system.md 참조)
- 엣지: 주식 미보유 시 `등록된 주식이 없습니다.` 빈 상태, 보유 5종목 이하면 "그 외" 구간·범례 `그 외 N종목`·"그 외 N종목" 요약행 모두 미노출

### F-IMPORT-EXPORT. 데이터 내보내기/가져오기
- 👤 JSON 내보내기→가져오기 라운드트립, 자산·스냅샷·옵션 보존
- ⚙ `use-asset-import`, 스키마·`validate-reflection` 검증, 악성·손상 JSON 방어
- ⚙ **내보내기 정합 가드(2026-08-06)** — 백업은 **localStorage**(`buildExportPayload`→`getAssetData`)를 뜨는데 화면은 **React state**를 렌더한다. 둘은 CRUD마다 `setAssetData`+`saveAssetData` 쌍으로 수동 정합되고, 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준: 다른 탭만) 잠시 갈라질 수 있다. 그 순간 백업하면 **최신 기록이 빠진 파일**이 만들어지고 나중에 그걸로 복원하면 그대로 유실된다(실사례: 08-05 매수 2건이 빠진 백업, 25분 뒤 재백업은 정상). `exportAssetData(currentData?)`가 `isExportDataStale`(자산 5종+거래 4종 **건수** 비교, 파생필드 제외로 오탐 방지)로 감지되면 다운로드를 중단하고 `false` 반환 → 호출처 2곳(`use-data-export`·`backup-nudge`)이 `EXPORT_STALE_MSG` 토스트. **인자를 빼면 검사가 꺼진다** — 새 호출처는 반드시 화면 state를 넘길 것
- 회귀: 가져오기 후 `dataResetVersion`++로 진행 중 fetch abort

### F-CLOUD-SYNC. E2EE 클라우드 동기화 ([cloud-sync](../../src/lib/cloud-sync) · [api/sync](../../src/app/api/sync/route.ts))

#### 코드레벨(⚙)
- ⚙ 용어 표준화 — `AssetEnvelope`(구 VaultEnvelope), `assetId`(구 syncId), `pushAsset/pullAsset`, Redis 키 `csync:asset:{assetId}`. **URL 해시 `#sync=<assetId>`, `SYNC_HASH_PARAM = "sync"`**(구 `#asset=`/`#vault=` 진입 호환 — provider `detect`·`clearPendingConnect` 모두 신구 처리) ([config.ts:27](../../src/lib/cloud-sync/config.ts) · [provider:153,291-295](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **`#sync=` 해시 삭제 시점** — `detect`는 `aid`를 `pendingConnectAssetId` state로 캡처만, **해시 제거는 연결 모달이 닫힐 때 `clearPendingConnect`(291-303)에서** 수행(성공·취소 공통). **detect(다이얼로그 여는 틱)에서 replaceState 금지** — Next 패치 replaceState가 Radix `Dialog`를 즉시 닫는 버그(R20). `#sync=`는 비밀 없는 assetId 포인터(E2EE 금고암호 별도)라 모달 표시 중 잔존 허용·완료 시 제거. 연결 모달은 `pendingConnectAssetId` state 기반(해시 비의존, [connect-dialog:87,100,130,178](../../src/app/(main)/_components/functions/cloud-sync/cloud-sync-connect-dialog.tsx)) ([provider:149-162,291-303](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **앱잠금 중 pull 차단(잠금 우회·인증키 삭제 방지)** — `autoPullIfNewer` 진입부 `if (isPwaLocked()) return`로 잠금화면 위 자동 pull(→`clearAssetData`) 차단. 잠금 해제 시 `PwaLockScreen`이 `PWA_UNLOCKED_EVENT`(`secretasset:pwa-unlocked`) 발행 → 폴링 effect 리스너가 즉시 1회 pull. `isPwaLocked`/`PWA_UNLOCKED_EVENT`는 `pwa-lock-screen.tsx` export 단일 소스 ([provider:221-245](../../src/lib/cloud-sync/cloud-sync-provider.tsx) · [pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx))
- ⚙ **3-상태 모델**: `none`(금고 미설정) / `locked`(assetId만 보유, 이번 세션 미무장) / `armed`(키 메모리 보유→자동 동기화). 마운트 시 `loadRememberedMaster` unwrap 성공+assetId 존재 → 자동 `armed`, 아니면 `locked`/`none` ([provider:124-146](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **자동 동기화** — 송신: 자산(`assetData`)·닉네임(`NICKNAME_EVENT`→`changeTick`) 변경 → `AUTO_PUSH_DEBOUNCE_MS=2500` 디바운스 무음 push. 수신: **`POLL_INTERVAL_MS=60000`(60s)** 폴링(`document.visibilityState==="visible"`일 때만)+`focus`+`visibilitychange`+effect 셋업 즉시 1회 → `fetchRemoteVersion > getVersion()`이면 자동 pull. (문서가 오래 "30s"로 적혀 있었으나 코드는 도입 이후 `60000` 불변 — 2026-08 정정)
- ⚙ **push 트리거 2경로** — ① 파생값 제외 비교(`getComparablePayloadString`) 불일치 ② `ASSET_USER_EDIT_EVENT`(`saveData`·`addStockRaw`만 발행) → `userEditRef`. ②는 pull 직후 skip과 파생값 비교를 **모두 우회**한다. 파생 갱신(시세·코인·스냅샷·부동산·마이그레이션)은 `saveAssetData`를 직접 호출해 ②를 내지 않는 것이 규약 — `saveData`로 되돌리면 자동 정리만으로 push가 강제된다.
- ⚙ **편집 대기 중 자동 pull 보류(시간 상한 필수)** — `autoPullIfNewer({ force })`는 `Date.now() - userEditAtRef.current < USER_EDIT_PULL_HOLD_MS`(디바운스 2.5s×4=10s)면 return한다. pull은 로컬을 통째로 덮어쓰면서 `userEditRef`까지 지우므로, 디바운스 대기 중 pull이 끼어들면 **방금 한 편집이 push되지도 복구되지도 않고 소실**된다(무음). **`userEditRef`(boolean)만으로 막으면 안 된다** — push 실패(오프라인·busy·conflict)로 플래그가 안 풀리면 타 기기 변경이 영구히 안 들어온다(과거 회귀). 409 conflict 화해는 `autoPullRef.current({ force: true })`로 이 보류를 우회 — conflict는 push가 서버에 거부된 상태라 pull이 유일한 진로다.
- ⚙ **실패한 pull은 `skipNextChangeRef`를 되돌린다** — `empty`/`error`로 끝났는데 skip 예약이 남으면 다음 비-사용자편집 변경 1회를 삼킨다(닉네임 변경은 `changeTick`만 올리고 `userEditRef`는 안 올려 그대로 걸린다).
- ⚙ **서버 push는 원자적 CAS(2026-08 P0)** — `/api/sync` PUT의 버전 비교+저장은 `compareAndSetAssetEnvelope`([cache-storage.ts](../../src/lib/cache-storage.ts)) 단일 호출로 처리한다. 과거처럼 `getAssetEnvelope`(읽기)→비교→`setAssetEnvelope`(쓰기)로 쪼개면 두 기기가 거의 동시에 push할 때 **둘 다 버전 체크를 통과해(TOCTOU) 나중 쓰기가 먼저 쓰기를 조용히 지운다(lost update) — 어느 쪽도 409를 못 받는다.** Upstash는 Lua 스크립트(`redis.eval`)로 GET→비교→SET을 Redis 내부 단일 원자 연산으로 실행하고, 로컬 `FileCacheStorage`는 읽기·비교·쓰기를 **중간 `await` 없이 동기 fs 호출로만** 구성해 같은 보장을 만든다. pubKey 교체 불가(403) 체크만 원자성 밖(사전 체크, 최악도 데이터 손실 아닌 거부)
- ⚙ **pull의 기준점(syncedIds) 병합(2026-08 P0)** — `applyImportedPayload`가 pull 한정으로 덮어쓰기 직전 로컬을 읽어 **원격에 없는 로컬 항목 중 "아직 서버에 올라간 적 없는 것"만 되살린다**(`reconcileAdditiveMerge`, state-and-utils 참조). 없으면 "A가 추가 → B가 편집하다 409 → 복구 pull이 로컬 통째 교체 → B의 추가분 소실"이 정상 멀티기기 사용에서 구조적으로 반복됐다. **판별 기준점이 반드시 필요하다** — 삭제가 tombstone 없이 배열 제거라 "로컬에 있고 원격에 없다"만으로는 신규 추가와 원격 삭제를 구분할 수 없고, 무조건 되살리면 **다른 기기의 삭제가 부활해 재-push까지 되어 삭제가 무력화**된다(R28). 되살린 게 있으면 `runPull`이 `lastPushedRef=null`로 파생값 비교를 건너뛰고 **즉시 재-push**한다. 기준점은 pull 시 **병합 전 원격 키**로, push 시 **push한 키**로 갱신(순서 틀리면 지켜낸 자산을 다음 pull이 스스로 지운다). 같은 id를 양쪽이 다르게 수정한 충돌은 여전히 원격 우선(범위 밖). `connect`는 `merge:false`로 원격 완전 대체(S2 "자산 동일"), `unlock`은 병합
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
- **S10 push-loop/동시성 가드**: pull 직후 `skipNextChangeRef`로 디바운스 push 미발생, `busyRef` 뮤텍스로 push/pull 동시 실행 차단("동기화 중입니다.")
- **S11 앱잠금+동기화 첫 진입(P0 회귀)**: 앱잠금 ON + remembered 기기 첫 진입 → 잠금화면 위에서 자동 pull·**자동 push 모두 미실행**(`isPwaLocked()` 가드 양쪽). PIN 해제 → `unlockAndLoad` 완료 후 `PWA_UNLOCKED_EVENT` → pull로 다른 기기 변경 반영(F-APPLOCK 해제 순서 참조 — 병렬로 두면 서로 덮어씀). **해제 후 PIN 재검증 정상**(pull의 `clearAssetData`가 `secretasset_pwa_auth_*` 보존 → "비밀번호 불일치" 버그 없음)

#### 엣지·회귀
- 엣지: 첫 pull(404→`empty`), 서명 만료(ts±300s 초과→401), assetId 없는 상태 push/pull 차단("잠금 해제가 필요합니다."), 4MB 초과(413), 동일 출처 XSS는 device-key decrypt 호출 가능(완전 방어 아님, 표준 완화)
- 회귀: `clearAssetData` 후 `SYNC_STATE_KEY` 재기록(S9), `getComparablePayloadString()`이 `lastUpdated` 제외 비교로 무한 push 루프 차단, **`clearAssetData` keepKeys에 `secretasset_pwa_auth*` 보존(S11 앱잠금 해시 유실 방지)**

### F-SYNC. 가격·환율 동기화
- 👤 종목 현재가·환율(USD/JPY) 자동 갱신, 갱신 완료 토스트
- 👤 **기기 동기화 pull 후 시세 갱신** — 다른 기기 변경 반영(pull) 직후 "오늘의 주식 및 환율 정보를 모두 업데이트했습니다." 토스트가 뜨고 현재가·환율이 갱신되는지(양쪽 기기 모두 자산 보유 상태에서)
- ⚙ `getStockCacheSlot` 장중 1시간/장외 날짜 슬롯, outdated 판정, 3개씩 배치+1초 간격
- ⚙ **휴장일 slot 고정(R23)** — 국내·해외 영업일 판정을 `isInSession` 체크보다 **먼저** 수행해, 휴장일(주말·공휴일)은 시간대·세션모양과 무관하게 직전 영업일(`rollbackToBusinessDay`/`rollbackToUsBusinessDay`)로 slot을 고정한다. 과거엔 `effectiveDate`(달력 날짜)가 휴장 중에도 매일 바뀌어 매일 실시간 재조회가 발생, quote 미세 흔들림이 원인분해에 "휴장일 시세 변동"으로 허위 노출됐다(F-ACTIVITY 연계)
- ⚙ pull(`runPull`/`armWithPull`)이 `initAndSync` 경유로 시세 동기화 트리거 — 마운트·0→양수 외 추가 진입 경로(F-CLOUD-SYNC 자동 동기화)
- 엣지: 데이터 삭제/불러오기 중 sync abort(epoch+AbortController), 취소된 응답 미반영
- 회귀: foreign+KRW→USD 마이그레이션, market 캐시 비었을 때 재조회

### F-SNAPSHOT. 자산 스냅샷
- ⚙ 일별(이번 달)·월별(올해 12개월)·년도별 종가 기준 저장, 토/일 보완
- 회귀: `saveSnapshotsBlockedRef` 차단, tickerList 정렬, 종가(refPrice) 폴백

### F-NAV. 네비게이션 (drill-down)
- 👤 `#detail/stocks` 직접진입·새로고침·뒤로가기, InlineSelector 탭 전환, scrollTo(0,0)
- ⚙ **콜드스타트 뒤로가기 폴백은 항상 홈(R24)** — `settings`/`tax`가 `history.length<=1`(딥링크·새 세션 진입 등)일 때 `navigate({type:"home"})` 직행. `settings`를 과거처럼 `"more"`로 보내면, `more`의 back()이 다시 `history.length` 의존적(`history.back()`)이라 **설정↔더보기를 오가며 홈에 도달 못하는 루프**가 발생(더보기 화면 라벨은 "홈"인데 실제로는 되감아 설정으로 돌아감)
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
- ⚙ **게이트 렌더 조건**([in-app-browser-gate.tsx](../../src/app/(main)/_components/pwa/in-app-browser-gate.tsx)): `isInApp && !isStandalone`일 때만 전체화면 오버레이(`layout.tsx`에 `AssetDataProvider`·`CloudSyncProvider` 하위 마운트). 일반 브라우저·PWA standalone은 `null`(앱 정상)
- ⚙ **외부 이동 유틸**([open-external-browser.ts](../../src/lib/pwa/open-external-browser.ts) `openExternalBrowser`): Android 카카오톡=`kakaotalk://web/openExternal?url=`, Android 그 외=`intent://<host><path>#Intent;scheme=https;S.browser_fallback_url=<enc>;end`(원본 해시는 intent `#Intent` 구분자 충돌 방지 위해 fallback_url에만 담음), **iOS=`false` 반환**(자동 이동 스킴 없음→호출측 수동 폴백)
- ⚙ **자산 이동 분기**: 자산 없음→origin URL 이동 / 자산 있음→PIN 4자리 입력 후 `useShareArtifacts().generateShareArtifacts(pin)`로 `#share=` URL 생성 이동(실패 시 origin 폴백) / 동기화 기기→PIN 없이 `syncLink` 이동. iOS는 `go()`가 제스처 보존 `ClipboardItem` Promise로 대상 URL 복사 후 `InAppExternalGuide`(3단계 수동 가이드, `pwa-install-flow` inAppStep과 공용) 노출
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

### F-ONBOARD. 튜토리얼·온보딩 ([welcome-guide.tsx](../../src/app/(main)/_components/layout/onboarding/welcome-guide.tsx) · [app-guide.tsx](../../src/app/(main)/_components/header-menu/app-guide.tsx))
- 👤 웰컴가이드(자산 0개)에서 대시보드 미리보기 영역이 실제 `dashboard.tsx` 컴포넌트를 공통 사용하여 동일 포맷으로 노출되며, 미리보기 카드 내부의 클릭이나 모든 액션들이 완전 차단 및 방지되는지 확인, 앱가이드 단독 보기, 튜토리얼 step 진행/스킵
- 👤 **모바일 웹 PWA 우선 레이아웃**(`useIsMobile() && !isStandalone`): 보안 소개+포트폴리오 미리보기 노출 후 PWA 설치 유도 섹션 강조. "웹앱 설치하기" 버튼이 홈 버튼과 동일한 `PwaInstallFlow` 공용 흐름 호출(iOS는 브라우저 칩+SVG 가이드). 즉시 자산 등록 CTA는 **기본 숨김**, "설치 없이 웹에서 바로 시작" 링크 클릭 시에만 노출(`showAssetCta` 토글)
- 👤 **데스크톱·standalone(설치된 앱)**: 기존 레이아웃 유지(자산 등록 CTA 항상 노출), 모바일 전용 분기 미적용 확인
- ⚙ 웰컴가이드는 `PwaInstallGuideDialog` 직접 호출 제거(공용 `PwaInstallFlow`로 대체). 분기 키: `mobileWeb = mounted && isMobile && !isStandalone`, `ctaVisible = !mobileWeb || showAssetCta`
- ⚙ `app-guide.tsx`는 `useState/useEffect` 사용 → `"use client"` 지시어 필수(서버 컴포넌트 빌드 에러 방지)
- ⚙ `secretasset_tutorial_status` 단일 키, 마이그레이션(merge-tutorial-status)

### F-ONBOARD-WIZARD. 스크린샷 일괄 온보딩 마법사 ([onboarding-wizard-flow.tsx](../../src/app/(main)/_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx) · [onboarding-wizard-status.ts](../../src/lib/onboarding-wizard-status.ts) · [onboarding-wizard-store.ts](../../src/stores/onboarding-wizard-store.ts)) — 명세 [S-4.29](../specs/4.29-onboarding-wizard.md)
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
- ⚙ **카테고리당 이미지 1장**: 4개 스크린샷 컴포넌트 모두 `input`에 `multiple` 없음(단일 파일) — v1은 이 제약을 그대로 받아들임(Gemini 일일 15회 한도 대비 마법사 1회 최대 4호출로 여유 확보)
- ⚙ **진행 상태**: `STORAGE_KEYS.onboardingWizardStatus` 단일 키 — `STORAGE_KEYS.tutorialStatus`(스팟라이트 튜토리얼)와 코드 패턴만 동일, 값 공유 없음. `tutorial-overlay.tsx`/`tutorial-store.ts` 무변경
- 엣지: 카테고리 스킵 후 다음 카테고리로 정상 진행, 모든 다이얼로그는 마법사가 직접 마운트(전역 hidden `*Input` 재사용 아님) — 부동산만 예외적으로 `RealEstateInput` hidden 마운트 필요
- 회귀: 마법사 열림 중에도 `AssetDataContext`·시세 동기화 등 기존 훅 정상 동작(별도 Provider 분기 없음), 마법사 닫으면 `assetData` 최신 상태 그대로 홈에 반영
- 자동: `src/lib/__tests__/onboarding-wizard-status.test.ts`(재개 지점 계산, dismissed 플래그, 키 분리)

### F-NOTICE. 공지 시스템
- ⚙ `NEXT_PUBLIC_NOTICE` JSON: `{ enabled, expiresAt }` 만 평가 (`getNoticeWindow()`). id·title·items 없음 — 본문은 branch 코드 `notice.tsx`.
- ⚙ `notice.tsx`: `NOTICE_ID="20260808"`(내용 갱신 시 bump→재노출), `NOTICE_TITLE="자산 성적표 · 실거래가 · 인증카드 업데이트"`, `NoticeContent` export. `pointer-events-none` + `select-none`으로 인터랙션 차단. **상태·브라우저 분기 없는 정적 컴포넌트**(SVG 애니메이션 미사용). 본문 = 강조 배너(+`v{APP_VERSION}` 뱃지) → `FEATURES` 배열 카드 4장(**①자산 성적표 ②암호화폐 시세 자동 갱신 ③부동산 실거래가 추정 ④인증카드 개편**, 아이콘+텍스트만) → **행동 요청 콜아웃(amber, 신용대출-부동산 연계 지정 안내)** → 기타 개선 1문단(자산 변동 노출) → 의견 보내기 배너
- ⚙ **수동 공지 진입** — 자동 1회 팝업(`UpdateNoticeDialog`) 외에, 더보기 > **"앱 가이드 · 공지사항"** 통합 진입점([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)) 선택기 → 공지 뷰어가 **동일 `NoticeContent`·`NOTICE_TITLE` 재사용**(중복 본문 없음). 앱 가이드는 `trigger-restore-guide` 이벤트
- ⚙ PWA standalone: `NEXT_PUBLIC_*` 빌드 타임 인라인, SW 자동 갱신(`controllerchange`→reload, `updateViaCache:'none'`)으로 재방문 시 새 번들 즉시 반영 → 별도 업데이트 불필요.
- ⚙ **공지 열람 상태 단일 키** — `secretasset_notice_seen`(값 `{ id, seenAt, expiresAt }`) **한 개만** 유지(구 `secretasset_notice_seen_{id}` per-id 다중 키 폐기). `readNoticeSeenId()===NOTICE_ID`면 열람. `cleanExpiredNoticeKeys(NOTICE_ID)`가 매 진입 시 현재 공지 레거시 키를 단일 키로 이관(열람 상태 보존) 후 레거시 `_*` 전부 제거 / init 경로(no-id)는 만료 레거시만 정리. 죽은 `secretasset_notice_hide_until`은 `consolidate-notice-keys` 마이그레이션으로 제거. keepKeys는 `secretasset_notice_seen`(접미 `_` 없이) 보존
- 엣지: 잘못된 JSON→미표시, 만료(`expiresAt` 경과)→미표시, `NOTICE_ID` 기준 1회 노출(단일 키, PWA standalone 분리). 수동 뷰어는 노출 이력·만료와 무관하게 항상 열람 가능

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
- 👤 PIN 오류 1~2회: "비밀번호가 일치하지 않습니다" 문구. 3회+: "비밀번호를 다시 확인해주세요" 경고 노출.
- 👤 설정 > 앱 잠금 설정 OFF → 현재 PIN 입력 후 비활성화, 이후 재접속 시 PIN 화면 미노출.
- ⚙ **잠금화면은 소프트 키보드를 쓰지 않는다(P1 규약)** — 이 화면에는 **포커스 가능한 입력 요소를 두지 말 것**. 자체 숫자패드(`Button` 3×4 그리드) + 4점 표시(`role="status"`, 순수 표시용 `<span>`)로 입력받고, 물리 키보드는 `window` `keydown`(0~9·Backspace)으로 받는다. iOS standalone의 소프트 키보드는 포커스 강탈·present/dismiss 경합에 취약해 앱 코드로 결정론적 제어가 불가능하며(키패드가 열리려다 닫히는 반복), **`focus()`/`blur()` 개입과 오버레이 `overflow-y-auto` 스크롤 컨테이너화로 오히려 고정 회귀를 만든 이력이 있다**(2026-07-31). `InputOTP` 복귀·자동 포커스·tap-to-focus 도입 금지
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
- ⚙ `/api/feedback` POST: message 공백 검증(400)·2000자 절단, IP `checkRateLimit` 재사용(429), `SLACK_WEBHOOK_URL` 미설정(500)·웹훅 실패(502), 닉네임 자동 첨부. **서버 저장 없음**(웹훅 전달만)

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
| R14 | **자동 push 무한루프/동시성 가드** | pull 직후 `skipNextChangeRef` 스킵(**실패 시 되돌리기 필수**) + `getComparablePayloadString()` 제외 목록 + `busyRef` 뮤텍스로 push↔pull 동시 실행 차단(S10). **제외 전량**: `lastUpdated` / 올해 `yearlyNetAssets` / **오늘·어제 daily**·이번달 monthly / 부동산 `marketEstimate*` 9개 + `regionCode`·`legalDong`·`complexName` / 코인 `baseDate`·`currentPrice` / API 종목 `baseDate`·`name`·`inactiveCheckedAt`(halted 포함)·활성종목 `currentPrice`·`inactiveStatus`·`inactiveReason`. **어제자까지 제외하는 이유**: `saveSnapshots`가 일요일에 토요일 스냅샷을 생성하고 등급도 토요일 항목에 기록하며, 자정을 넘겨 켜두면 어제자가 비교에 편입돼 파생 변경만으로 push된다. **`baseDate`(장외=매일·장중=매시간 슬롯 도장)가 비교에 남으면 자산 미변경에도 핑퐁** — 제외 필수. `buildExportPayload`(실제 push)는 불변. R5(sync abort)와 연계 |
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
| R24 | **뒤로가기 콜드스타트 폴백 홈 직행** | `back()`의 `history.length<=1` 폴백은 항상 `navigate({type:"home"})`. 다른 history-의존적 화면(`more`처럼 자신도 `history.back()`을 쓰는 화면)으로 폴백하면, 그 화면에서 다시 뒤로가기 시 방금 만든 push를 되감아 원래 화면으로 돌아오는 **홈 도달 불가 루프**가 생긴다(과거 `settings`→`"more"` 폴백 버그, F-NAV) |
| R28 | **동기화 push의 원자성·기준점 병합** | ① `/api/sync` PUT의 버전비교+저장은 반드시 `compareAndSetAssetEnvelope` 단일 호출 — read-then-write로 되돌리면 동시 push 시 lost update(어느 쪽도 409를 못 받고 나중 쓰기가 먼저 쓰기를 지움). ② pull 병합은 **반드시 `syncedIds` 기준점 기반**이어야 한다. **CAS·pull-first로는 이걸 못 막는다** — 그건 "최신을 못 본 채 쓰지 마라"(쓰기 순서)만 통제하고, 최신을 정상 수신한 기기가 그걸 **잘못 해석해 되살린 뒤 push**하는 건 baseVersion이 최신이라 CAS 관점에서 완벽히 정당한 요청이다. 기준점을 빼고 "로컬에 있고 원격에 없으면 되살림"으로 되돌리면 **다른 기기의 삭제가 부활→재-push→상대 기기에서도 부활**해 "지웠는데 1분 뒤 다시 나타남"이 무한 반복된다(삭제가 tombstone 없이 배열 제거라 부재가 신규추가/삭제 두 의미를 갖는 게 근본 원인). ③ 기준점 갱신은 pull=**병합 전 원격 키**, push=**push한 키** — pull 후 병합 결과로 갱신하면 아직 안 올라간 신규분을 다음 pull이 "삭제됨"으로 오판해 스스로 지운다. ④ `forgetRemembered`가 `syncedIds`를 보존. ⑤ armed 폴링 effect의 `online` 리스너(force pull) 유지. 하나라도 빠지면 "자산이 조용히 사라지거나 지운 게 되살아나는" P0가 재현된다(F-CLOUD-SYNC) |
| R25 | **인증카드 캡처 DOM에 뷰포트 기준 반응형 금지** | share-card.tsx의 캡처 대상(`cardRef`) DOM에는 `sm:` 등 뷰포트 미디어쿼리 클래스를 쓰지 않는다 — 캡처는 고정폭(`CARD_WIDTH`, share-menu.tsx — 480→460px, 2026-08-08 축소) 카드인데 `sm:`은 브라우저 뷰포트 기준이라 PC/모바일에서 같은 사용자가 다른 크기로 캡처되는 버그가 있었다(F-SCREENSHOT). 축소 미리보기는 `ScaledCardPreview`(share-menu.tsx)의 CSS `transform: scale()`로만 처리 — 레이아웃 크기 자체는 항상 `CARD_WIDTH` 고정. **`captureImage`의 `pixelRatio` 계산은 반드시 `el.offsetWidth`(레이아웃 폭) 기준이어야 한다 — `getBoundingClientRect().width`는 `ScaledCardPreview`의 transform 영향을 받아 기기마다 다른 pixelRatio·최종 해상도가 나온다(QA에서 발견, 2026-07-27 수정)** | **주식 탭 컴포넌트를 재사용하는 `screenshotMode` 경로(`StockCard`/`StockRowHeader`/`StockIcon`/`StockCategorySection`/`DetailSummaryHeader`/`ProfitMetric`)는 `ASSET_THEME` 대신 `ASSET_THEME_SHOT`(theme.ts, 데스크톱 값 고정) 토큰을 쓴다 — 캡처 DOM에 새 클래스를 넣을 때 반응형이 필요하면 `sm:`을 직접 쓰지 말고 이 토큰에 고정값을 추가할 것.**
| R29 | **원인분해 flow 윈도우 경계(`inFlowWindow`)** | 경계는 **자산군 축**(주식·코인=항상 시작일 제외 / 현금·대출=포함)과 **구간 위치 축**(현금·대출은 전체 첫 구간만 포함, 하이브리드 `newer`는 제외)의 조합이다 — **네 함수를 같은 경계로 통일하면 반드시 회귀한다**(F-ACTIVITY 경계 항목 참조). 되살아나는 것: ①없는 "주식 매도"가 매수와 쌍으로(2026-08-06) ②income/debt가 무관한 `cash` 잔차로 증발(2026-08 P1) ③mid 당일 거래 이중계상으로 income 2배 + 유령 "현금 잔액 감소"(2026-08-06 QA). `resolveAttribution`에 `isFirstSegment` 인자를 추가하거나 새 호출처를 만들 때 이 값을 반드시 명시할 것(기본값 `true`라 하이브리드 2번째 구간에서 빠뜨리면 조용히 ③ 재현). `detectCashRoundTrip`도 같은 경계 사용. **합계 = `deltaNet` 항등식은 어느 쪽이든 유지되므로 기존 항등식 테스트로는 못 잡는다** — 반드시 key별 금액을 단정하는 테스트로 고정 |
| R30 | **화면(React state) ↔ localStorage 정합** | 백업·push는 localStorage를 읽고 화면은 React state를 렌더한다. 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준) 정합이 pull 후 `initAndSync(getAssetData())` 재호출 하나에만 의존한다. 갈라진 순간의 백업은 최신 기록이 빠진 파일이 되고 그걸로 복원하면 유실된다 — `exportAssetData(currentData)`의 `isExportDataStale` 가드가 유일한 방어이므로 **호출처가 화면 state를 넘기는지** 확인(F-IMPORT-EXPORT). **근본 원인(어느 경로가 localStorage를 되돌리는지)은 미추적** — 2026-08-06 실사례에서 25분 뒤 자연 복구돼 영구 유실은 없었으나 재발 시 계측(pull 완료·`syncTodayStockPrices` 저장 직전·push 직전 caller/건수 로깅)부터 할 것 |

---

## Phase 3 — 산출물

- 발견 이슈를 **P0(데이터 손실/크래시) / P1(기능 오작동) / P2(UX·표시)** 로 분류
- 회귀면 R# 매핑, 신규면 근본 원인·재현 경로(파일:라인) 기록
- 수동 항목(👤) 중 프리뷰로 검증 불가한 것(KIS 실시간 가격, OCR 정확도, 모바일 레이아웃)은 사용자 실행 체크리스트로 전달
- **이 스킬은 코드 이슈 진단·보고까지만 수행한다. 코드 수정은 사용자 승인 후 별도로.**

---

## Phase 4 — 지식베이스 최신화 (QA 마무리 단계)

> QA에서 확인한 최근 변경을 KB에 반영해 **문서-코드 드리프트**를 상시 0으로 유지한다. KB 문서는 코드가 아니므로 명백한 최신화는 직접 적용, 사양 판단이 갈리면 제안으로 남긴다.

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

_최종 갱신: 2026-08-02 · **대출 상환/추가 대출 거래내역 신설**(F-LOAN-TX, S-4.24) — 현금 입출금(S-4.22) 미러링. `loanSchema.balance` 0 허용(완납)해 `loan-tab.tsx`·레버리지 박스의 기존 `balance > 0` 필터가 완납 대출을 자동 제외, 완납 요약 목록으로 히스토리·재활성화 진입점 제공. 원인분해 `debt` cause는 예측 경로만 `reflectedLoanFlow`로 보강(정밀 경로는 이미 정확, 신규 cause 없음). 공유 토큰 `parts[13]` 꼬리 추가(R3). 이전: **일요일 "주식 시세 상승" 오표시 + cashRoundTrip 오탐 수정**(F-ACTIVITY) — 토요일 새벽 접속 시 stale(목요일 종가)해지는 토요일 스냅샷을 일요일에도 항상 upsert하도록 고쳐 R23(slot 고정)만으로는 못 막던 시작점 오염을 해소. `detectCashRoundTrip`의 이탈폭 계산에 `reflectedCashInflow` 누적을 반영해 왕복 판정과 기준을 통일 — 기록된 입금만으로 단조 증가한 경우의 오탐 제거. 이전: 2026-08-01 · **원인분해 기간 하이브리드 + income/cash/deposit 분리**(F-ACTIVITY) — `computePeriodAttribution`이 1주·1개월·3개월·올해 공통 알고리즘으로 실측 가능 구간과 예측 구간을 `mergeAttributions`로 합성(`estimatedUntil`로 부분예측 표시). `income`(기록된 입출금)과 `cash`(설명 안 되는 잔차)를 분리해 `incomeEffect`가 대수적으로 소거되던 P1 회귀 수정("인출·지출 −480만원"이 거래 기록 0건인데 표시되던 문제), `deposit`(임차보증금 증감) 신설로 `SnapshotBreakdown`에 없던 필드의 누출 원천 축소, 잔차 흡수 부호 안전장치 추가. **원인분해 자산군 분해 + "그 외" 범주 폐지** — `price:stock`/`price:crypto`/`price:realEstate`·자산군별 매수/매도, 잔차는 `priceResidual`→`cash`와 절대값 최대 원인 흡수로 처리(합계=deltaNet 항등식 대수적 보장). **`isClosedForBothMarkets` 휴장 억제 폐지**(토요일 실제 상승을 묻던 P1 회귀) — 일요일 방어는 R23(slot 고정)이 유일 수단. **앱잠금 백그라운드 차단**(F-APPLOCK) — 잠금 판정 `isPwaLocked()` 단일화(구 `checkIsLocked`의 standalone 조건 제거)·`isBackgroundWorkBlocked()` 공통 가드(R22 확장)·부트스트랩 단일 함수화·해제 순서 직렬화. **동기화 파생 변경 결함 수정**(F-CLOUD-SYNC) — 편집 대기 중 pull 보류(시간 상한)·pull "없으면 유지"(R26)·daily 제외를 오늘·어제로 확장·폴링 60s 정정·S9/R13 전제 무효 표기. 이전: 2026-07-26 · 원인분해 정확도 일괄 수정 — 외화 원가 환율 재평가 누출(`costFxRevaluation`)·예측 경로 신규 매수 누락(`estimatePeriodInflows` 거래종목 skip)·원인 카테고리 고정 순서(`getOrderedCauses`)·용어 통일. **휴장일 slot 계산 순서 수정**(F-SYNC, R23) — 영업일 판정을 `isInSession`보다 먼저 실행해 휴장일 slot 고정. 이전: 2026-07-11 · **인앱 브라우저 하드 게이트**(외부 이동 `openExternalBrowser`·게이트 활성 시 자동 동작 차단 `isInAppGateActive`, R22)·**동기화 변경 감지에 `baseDate`·`name` 제외**(장외 매일/장중 매시간 슬롯 도장 핑퐁 차단, R14 보강). 이전: 2026-06-30 · **기기 동기화 pull 후 `initAndSync` 전체 시세 동기화**(refreshData→initAndSync, R21)·**닉네임 커밋 시점 탭 이탈(언마운트) 1회로 변경**(draft 분리·외부 pull 반영, R17 보강). 이전: 2026-06-28 앱잠금+동기화 정합(clearAssetData `pwa_auth*` 보존·`isPwaLocked()` pull 가드·`PWA_UNLOCKED_EVENT` 즉시 pull, S11·R18)·share/sync URL 해시 삭제는 모달 닫힘 시점으로(R19)·**다이얼로그 여는 틱 replaceState 금지(Next 패치→Radix 즉시 닫힘 버그 수정, R20)**·인앱 복사 sync 기기 `#sync=` 링크 분기·iOS Safari 신형 임계값 15→18(iOS 18 ⋯메뉴 도입 반영) 추가. 이전: 2026-06-25 SVG 애니메이션 공용화(`StepAnimationPlayer`·3500ms·`PwaSetupAnimation`/`SyncSetupAnimation`)·"복원 코드"/"다른 기기 동기화 링크" 개명·공지 수동 진입·복원 2종 구분, R16. 2026-06-24 F-CLOUD-SYNC·F-PWA 정밀 QA(S1~S10·P1~P5·R13~R15)_
