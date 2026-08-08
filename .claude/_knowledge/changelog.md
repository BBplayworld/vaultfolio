# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-08-08

### 인증카드: 닉네임 제거 + 비중 범례를 중앙으로 이동 (issue-4.22)

- **왜**: ① 닉네임(`@nickname`)은 공유 시 불필요한 개인정보 노출. ② 직전 개편에서 "심플한 가로 박스" 의도로 범례를 뺐더니, 어떤 종목이 얼마인지 알려면 하단 리스트를 훑어야 해서 한눈에 안 들어왔다. ③ 범례를 살리면 리스트 행의 `N주 · 비중%`와 퍼센트가 중복된다.
- **수정**: ① [share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx) 상단 닉네임 블록·`useNickname` 제거. ② [stock-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/stock-tab.tsx) `StockCategorySection` 범례의 `!screenshotMode` 가드를 제거해 상위 4개 + `기타 N종목`을 인증카드에도 노출(계산은 기존 `barShown`/`barRest`/`restPct` 그대로, 신규 로직 없음). ③ `StockRowHeader`는 `screenshotMode`일 때 `· 비중%` 미렌더 — "외 N종목 · 비중 X%" 요약 행과 카드 하단 비중 게이지 바는 유지.
- **"외 N종목" 요약 행**: 우측을 종목 카드와 동일한 2줄(나머지 평가금액 합 / 손익 `(+X.X%)`)로 맞추고 `비중 X%`는 제거(범례 `기타 N종목`과 중복). 손익은 기존 `computeStockMetrics`를 rest에 합산하고 `(Σ평가−Σ원가)/Σ원가` 공식(`useFilteredStockData`와 동일)을 쓰며, 상장폐지 종목은 총계 기준과 맞춰 제외. `StockCategorySection`에 optional `maskFn`·`exchangeRates` prop 추가(주식 탭은 `maxItems` 미지정 → rest 없음, 영향 없음). 별도 배경 박스(`bg-muted/30 px-3`)는 좌우 패딩 차이로 위 카드들과 정렬이 어긋나 제거하고, 같은 `cardWrapper`+`cardHeader`+아이콘 자리(spacer) 구조로 통일.
- **문구·간격**: 범례 "기타 N종목"과 리스트 "외 N종목"이 서로 다른 단어를 써서 "그 외 N종목"으로 통일(범례 툴팁 포함). 인증카드 종목 행 세로 패딩을 `py-2.5`→`py-2`로 살짝 축소(`ASSET_THEME_SHOT.cardHeader` — 이 토큰은 인증카드 전용이라 다른 화면 영향 없음).
- **간격·크기 미세조정(2026-08-08 추가)**: 요약 헤더~비중 바~종목 리스트 세 영역의 **실제 노출 여백**을 28px로 통일. 단순히 마진 값만 같게 두면 헤더 쪽은 배경 없는 박스의 자체 패딩(`py-4` 하단 16px)과 아래 박스의 상단 패딩(`p-3.5`=14px)이 마진에 더해져 legend~list보다 더 벌어져 보이는 문제가 있었다 — 헤더 하단 패딩을 0으로 없애고(`pt-4`만 유지) 마진을 `mt-3.5`(14px)로 줄여 `14(마진)+14(아래 박스 상단 패딩)=28px`로 맞춤(범례~리스트의 순수 `mt-7`=28px와 동일). 리스트~푸터는 `mt-4`(16px) 유지. 푸터에 `px-[18px]`을 추가해 좌우 여백을 헤더·비중 바·리스트와 동일하게 정렬(기존엔 패딩이 없어 카드 가장자리에 더 가깝게 붙어 위 영역과 어긋나 보였음). 비중바·리스트 래퍼의 옅은 회색 배경(`bg-muted/20 dark:bg-muted/10`)을 제거해 카드 전체 배경과 통일(패딩은 간격 계산 유지를 위해 존치). **상위 노출 개수 4→5개**(`SHOT_MAX`)로 확대 — 범례·리스트·비중 바 모두 동일 상수 하나로 축약되므로 파생 변경 없음. 카드 최상단↔"총 주식 평가금액"과 "시크릿에셋"↔카드 최하단 간격은 헤더 `pt-2`/푸터 `pb-2`로 축소해 동일값(outer `p-3`+2=20px) 유지. 리스트~푸터 간격은 "그 외 N종목" 행 자체 하단 패딩(`cardHeader py-2`=8px) + 비중바·리스트 래퍼 하단 패딩(`p-3.5`=14px)까지 포함해 계산 — 마진을 `mt-7`이 아닌 `mt-1.5`(6px)로 둬야 `6+8+14=28px`로 범례~리스트(순수 `mt-7`=28px)와 실제 노출 간격이 같아진다(이전엔 이 숨은 패딩들을 못 빼서 50px로 훨씬 넓어 보였음). `ASSET_THEME_SHOT.summaryValue`(총 주식 평가금액 히어로 숫자)를 `text-3xl`→`text-lg`(평가손익 `profitAmount`와 동일)로 축소했다가, `text-xl`을 거쳐 최종 `text-2xl`로 확정 — SHOT 전용 토큰이라 인증카드 외 영향 없음.
- **전체 금액 표시로 통일(2026-08-08, 6차)**: 상세 > 주식 탭은 `PRICE_DISPLAY_MODE="full-only"`(number-utils.ts)라 금액이 원래 전체 표기(`840,180,000원`)인데, 인증카드는 `maskFn`(항상 `formatShortCurrency` 또는 마스킹 함수)이 `StockSummaryHeader`의 `fmtFull`·`fmt` 둘 다를 덮어써서 요약 헤더가 축약(`8.4억원`)으로 새고 있었다. [share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx)의 `mask` 포매터를 `formatShortCurrency`→`formatCurrency`(전체 금액)로 교체 — 헤더(총 평가금액·평가손익)·종목 리스트·"그 외 N종목" 행 전부 `mask` 하나를 공유해 한 번에 상세 탭과 동일한 전체 금액이 됐다(헤더 전용 `maskFull` 변수는 리스트까지 확장하며 불필요해져 제거, `mask`로 통합).
- **`CARD_WIDTH` 480→460 축소(2026-08-08, 5차)**: 검은 카드 박스(`ShareCard` 루트) 자체의 바깥 폭은 오직 `CARD_WIDTH`(`share-menu.tsx`)로만 결정되고, 헤더·래퍼·푸터의 내부 좌우 패딩(px-2 등)은 그 안쪽 콘텐츠 위치만 조정할 뿐 박스 바깥 폭엔 전혀 영향을 주지 않는다는 점을 확인한 뒤, 사용자 요청으로 `480`→`460`px 축소. `pixelRatio = ceil(1100/460) = 3`(기존과 동일)이라 최종 PNG는 `1440`→`1380`px, 화질 저하 없음. R25(기기 무관 고정폭)는 값이 무엇이든 "고정"이면 충족되므로 위반 아님.
- **좌우 여백 재조정(2026-08-08, 4차)**: 헤더·래퍼·푸터 `px-1`(4px)→`px-2`(8px) — `outer p-3(12)+8=20px`로 세 지점 통일 재확인. 미리보기 컨테이너 패딩은 `px-2`→`px-4`로 재조정 — `outer.clientWidth`(스케일 계산 기준)만 줄여 미리보기 축소율이 살짝 커질 뿐, 캡처 PNG 실제 폭(`CARD_WIDTH=480` 고정, R25)과는 무관.
- **모바일 미리보기 진짜 원인: `ScaledCardPreview`의 flex-shrink 이중 축소(2026-08-08, 3차 — 근본 수정)**: 앞선 두 차례(다이얼로그 폭·컨테이너 패딩·카드 내부 여백 조정)로도 스크린샷상 카드가 여전히 확연히 좁게 보였다 — 원인은 [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx) `ScaledCardPreview`의 `innerRef` div가 `width: 480px` 인라인 스타일만 두고 `flex-shrink`를 지정하지 않은 것. flex item의 `flex-shrink` 초기값은 1이라, 컨테이너가 480px보다 좁은 대부분의 모바일에서 **flexbox가 레이아웃 단계에서 먼저** 이 박스를 컨테이너 폭으로 축소한 뒤, JS가 계산한 `transform: scale(outer.clientWidth/480)`이 **그 위에 다시 곱해져** 이중으로 작아졌다(예: 390px 컨테이너 → 최종 317px, 의도한 폭의 81%). 패딩을 아무리 줄여도 이 배율 자체는 그대로라 개선 폭이 미미했다. `shrink-0`(`flex-shrink:0`) 한 줄 추가로 레이아웃 폭을 항상 480 고정 → `scale`만이 유일한 축소 수단이 되어 컨테이너를 정확히 채운다. 이전 조정(`w-[95vw]`, 카드 내부 `px-1`)은 원인은 아니었지만 방향은 맞아 그대로 유지. 컨테이너 패딩은 `shrink-0` 수정으로 스케일이 꽉 차게 되면서 `px-0`이 카드를 다이얼로그 가장자리에 완전히 붙여버려 `px-2`로 최소 여백만 복원.
- **모바일 미리보기 확대 + 카드 내부 좌우 여백 축소(2026-08-08, 2차 조정)**: 1차 시도(컨테이너 패딩만 축소 + 카드 내부는 오히려 확대 18→22px)가 의도와 반대라 롤백. 24px로 축소한 2차 시도도 여전히 "카드 박스가 화면 중앙에 좌우 여백을 두고 떠 있다"는 피드백을 받아 원인을 재검토 — [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx)의 `DialogContent`가 기본 `w-full`(`%` 기반, containing block 의존)이라 실제로는 예상만큼 뷰포트 전체 폭을 못 쓰고 있을 가능성이 있어, `w-[95vw] sm:w-full`로 교체해 뷰포트에 항상 상대적인 `vw` 단위로 모바일에서 확실히 화면의 95%를 쓰도록 명시(`sm:` 이상은 기존 `max-w-[680px]` 그대로). 미리보기 컨테이너 자체 패딩은 `px-0 py-2`(스케일 계산용, 캡처 PNG 무관) 유지. 카드 내부(헤더·범례·리스트·푸터) 좌우 여백은 24px→**16px**로 재축소 — 래퍼(`share-card.tsx`) `py-3.5 px-1`, `StockCategorySection` 내부(`stock-tab.tsx`) `px-0`(변경 없음), 헤더(`detail-summary-header.tsx`) `px-1`, 푸터(`share-card.tsx`) `px-1` — `outer p-3(12)+4=16px`로 세 지점 일치, 세로 28px 간격 계산은 `py-3.5` 불변이라 무영향. 카드 내부 패딩은 R25상 기기별 분기 불가해 저장되는 PNG에도 동일 반영(사용자 승인).
- **헤더 내부 간격 불일치 수정**: "총 주식 평가금액"↔평가손익 간격이 종목 리스트 행의 "금액"↔"손익"(`cardAmountProfitRow`의 `mt-0.5`=2px)보다 2배(`mt-1`=4px) 넓어 눈으로 봐도 차이가 났다 — `screenshotMode`에서만 `mt-0.5`로 맞춤(다른 4개 상세 탭은 `mt-1` 불변).
- **요약 헤더 박스 제거**: [detail-summary-header.tsx](../../src/app/(main)/_components/views/detail/detail-summary-header.tsx) `DetailSummaryHeader`에 `screenshotMode` 분기 추가 — 인증카드는 배경(`ASSET_THEME.primary.bgLight`) 없이 좌우 패딩만 아래 비중 바·리스트 박스(래퍼 `p-3.5` + 내부 `px-1` = 18px)와 정확히 맞춤(`px-[18px]`). 상세 탭(주식/부동산/암호화폐/현금/대출 공통 컴포넌트)은 배경·패딩 불변.
- **R25 대응**: 범례가 쓰던 `grid-cols-2 sm:grid-cols-4`·`text-sm sm:text-base`를 캡처 경로에서 쓰면 뷰포트 반응형이 섞이므로 `ASSET_THEME_SHOT`에 `legendGrid`(`grid-cols-2` 고정)·`legendText`(`text-sm` 고정) 토큰 추가 후 `screenshotMode`에서만 스왑. 주식 탭 렌더는 불변.
- 스키마·저장 키·공유 토큰·API 무변경 — 명세 판정 기준 비해당. `npx tsc --noEmit` 통과(EXIT=0).

### 자산 카드 → "인증카드" 개편: 내용을 주식 기준으로 되돌리고 주식 탭 리스트 이식 (issue-4.22)

- **왜**: 2026-07-27 개편에서 카드를 자산군 통합 랭킹("핵심 자산 Top 8", 색점+비중%+금액 1줄)으로 압축하면서, 상세 > 주식 탭 리스트가 가진 정보 밀도와 색감(로고 아이콘·`N주 · 비중%` 메타·우측 평가금액/손익 2줄·하단 비중 스트립)을 잃었다. 사용자 판단으로 주식 탭 리스트가 더 매력적이라 그 UI를 카드에 그대로 이식하고, 카드 내용도 주식 기준으로만 좁혔다.
- **재사용만으로 구현**: 새 리스트 컴포넌트를 만들지 않고 stock-tab.tsx가 이미 export 해둔 `screenshotMode` 경로(`StockSummaryHeader`/`StockCategorySection`/`StockCard`/`StockRowHeader`)를 부활시켰다 — 7-27 개편 이후 아무 데서도 호출되지 않던 사실상 죽은 코드였다. 데이터도 `useFilteredStockData("all")` + `computeStockMetrics` 단일 출처를 그대로 쓴다(tickerList `.sort()` 내장 → 주식 탭과 캐시 키 공유, 중복 fetch 없음).
- **구조**([share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx)): `@닉네임` → `StockSummaryHeader`(총 주식 평가금액 + 평가손익) → 비중 바(상위 4 + 회색 `기타`) → 종목 리스트(상위 4 + `외 N종목 · 비중 X%`) → 푸터. **자산군 "포트폴리오 구성" 섹션과 범례는 완전 제거** — 분포는 가로 박스 하나로만 두고 종목 식별은 아래 리스트가 담당한다. 그 결과 `SHARE_SAFE_PALETTE`(자산군 색 상속 규칙)는 소비처가 사라졌고, 카드 색은 주식 탭과 같은 `assignColors`(`MAIN_PALETTE`)를 쓴다.
- **R25 대응**([theme.ts](../../src/config/theme.ts) `ASSET_THEME_SHOT` 신규): 이식하려는 주식 탭 컴포넌트들이 `sm:`/`lg:`를 써서, 그대로 넣으면 480px 고정폭 캡처에 뷰포트 반응형이 섞여 PC/모바일에서 다른 PNG가 나오는 R25 회귀가 재현된다. `sm:`/`lg:` 값을 데스크톱 값으로 고정한 캡처 전용 토큰 세트를 추가하고 `screenshotMode`일 때만 스왑하도록 했다(`StockIcon`·`StockRowHeader`·`StockCard`·`StockCategorySection`·`DetailSummaryHeader`·`ProfitMetric`). 기존 토큰은 건드리지 않아 일반 모드 렌더는 불변.
- **명칭**: 사용자 노출 문구를 전부 "인증카드"로 통일(share-menu·top-bar·bottom-nav·tutorial-step-config·notice). 파일·식별자(`share-card.tsx`/`ShareCard`/`ShareScreenshotDialog`/`screenshotMode`)는 diff 최소화를 위해 유지하고, 코드 주석의 잔재 "인증샷"만 정리했다. `NOTICE_ID` `20260722`→`20260808` bump + 공지 4번째 카드 본문 교체(`APP_VERSION` 배지 유지).
- 스키마·저장 키·공유 토큰·API 무변경 — 기존 컴포넌트 재구성 + 명칭 변경이라 명세 판정 기준 비해당.
- `npx tsc --noEmit` 통과(EXIT=0), 변경 파일 `eslint` 0 errors(기존 `no-img-element` 경고 1건만 잔존).

## 2026-08-07

### 원인분해: "현금 잔액 직접 수정" 문구를 대출과 동일 패턴으로 통일 (issue-4.22)

- **왜**: 신규 CMA 계좌(86,000,000원)를 추가했더니 성적표에 "현금 잔액 직접 수정으로 8,560만원 늘어난 것으로 추정돼요"로 표시돼 "잔액을 몰래 고쳤다"는 오해를 줬다. 사용자는 다른 자산(주식·코인·부동산·대출)도 `createdAt` 같은 생성시점 필드로 신규 추가를 판별하는지 물었다 — 코드 검증 결과 **넷 다 `createdAt` 필드가 없고**(`purchaseDate`/`startDate`는 예측(레거시) 분기에만 쓰임), 스냅샷 원가·잔액 **델타만으로** 신규 추가를 감지한다(주식 `dCostStock`, 대출 `breakdown.loans` 델타 등). "신규 항목 추가"와 "기존 항목 수정"을 구분하지 않고 같은 라벨(매수/새로 추가한 대출)로 뭉뚱그리는 것이 기존 설계다. `dCostCash`도 감지 방식은 완전히 동일(신고된 8,560만원도 계산 자체는 정확)했고, 유일한 차이는 라벨이 "직접 수정"(편집으로 단정)이라는 단어를 쓴다는 것뿐이었다.
- **수정**([asset-report.ts](../../src/lib/report/asset-report.ts) `causeShortLabel`·`causeSentence`): 스키마 확장(`createdAt` 추가) 없이 대출(`debt`)과 동일한 패턴으로 통일. 대출은 짧은 라벨("대출 상환"/"추가 대출")과 실제 문장("새로 추가한 대출로 ~", `label` 변수 미사용 하드코딩)이 서로 다른 단어를 쓰는 기존 구조가 있었다 — `cash`도 이를 그대로 따라 라벨 `"신규 현금"`/`"현금 정리"`, 문장 `"새로 추가한 현금으로 ~ 늘었어요."`/`"현금 정리로 ~ 줄었어요."`로 교체("(추정)" 헤지·"직접 수정" 단정 제거). 방향은 대출과 반대(대출은 부채라 상환=양수, 현금은 자산이라 증가 자체가 양수라 뒤집을 필요 없음). 계산 로직(금액)은 전혀 손대지 않아 회귀 없음.
- 스키마·저장 키·공유 토큰 무변경 — 순수 문구 수정이라 명세 판정 기준에 해당하지 않는다(작업 중 `createdAt` 스키마 확장안으로 명세 초안까지 작성했으나, 다른 4개 자산과의 일관성 문제로 기각 후 폐기).
- `npx tsc --noEmit`·`npx vitest run`(147건 전부 통과, 회귀 없음)·`npm run lint`(0 errors)·`npm run build` 전부 통과.

## 2026-08-06

### 원인분해: 입력한 적 없는 "주식 매도"가 매수와 쌍으로 뜨던 이중계상 수정 + 백업 정합 가드 + 일별 달력 금액 넘침 (issue-4.22)

- **왜**: "08-05에 매수 기록만 2건 넣었는데 홈 '전일 대비'에 주식 매수 11.8만·주식 매도 11.8만이 같이 뜬다"는 제보. 백업 JSON 대조로 08-05·08-06 스냅샷 `cost.stock`과 현재 보유 원가가 **정확히 117,515원**(= 314250 1주×62,235 + 360200 2주×27,640, 스크린샷 확인) 어긋나는 걸 잡아 원인을 특정했다.
- **근본 원인**([asset-report.ts](../../src/lib/report/asset-report.ts) `reflectedTradeFlow`): 08-05 스냅샷은 거래 **반영 이후**에 저장돼 `cost.stock`에 117,515원이 이미 포함 → `dCostStock = 0`. 그런데 flow 함수가 시작일 당일 거래를 다시 세어 `buyEffect = +117,515`가 되고, 균형을 맞추는 `stockManual = dCostStock − buyEffect = −117,515`가 **"주식 매도"로 둔갑**했다. 두 항이 상쇄돼 **합계 = `deltaNet` 항등식은 유지**되므로 기존 테스트 57건이 전부 통과한 채 살아 있었다.
- **수정**: 주식(`reflectedTradeFlow`)·코인(`reflectedCryptoFlow`)만 `t.date < fromDate` → **`t.date <= fromDate`**(시작일 당일 제외). 현금(`reflectedCashInflow`)·대출(`reflectedLoanFlow`)은 **그대로 둔다** — 2026-08 P1(소급 기록한 입출금이 무관한 `cash` 잔차로 증발)이 되살아나기 때문. **경계가 자산군마다 다른 것은 의도된 비대칭**이다: `income`/`debt`는 독립 항이라 누락되면 잔차로 새지만, `buy`/`sell`은 원가 diff에서 차감되는 값이라 포함하면 반드시 이중계상된다. 주식에서 제외해도 누락되지 않는다 — 스냅샷 저장 **후** 소급 반영한 거래는 원가가 올라가 `stockManual`이 같은 부호로 잡아 "주식 매수"로 표시된다. 세 함수 주석에 근거를 남기고 R29로 회귀 고정.
- **백업 정합 가드**([asset-storage.ts](../../src/lib/asset-storage.ts) `isExportDataStale` 신설): 조사 중 받은 첫 백업이 **25분 전(08-04) 상태**였다 — 백업은 localStorage(`getAssetData`)를 뜨는데 화면은 React state를 렌더하고, 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준) 둘이 잠시 갈라진다. 같은 파일 안에서 **스냅샷은 최신인데 `assetData`만 과거**인 게 결정적 증거(스냅샷은 `saveSnapshots(latestData)`가 state를 받아 계산). 재백업에서 정상 복구돼 영구 유실은 없었으나, 그 파일로 복원했다면 유실이었다. → `exportAssetData(currentData?)`가 항목 **건수**(자산 5종+거래 4종, 파생필드 제외로 오탐 방지) 불일치 시 다운로드를 중단하고 `EXPORT_STALE_MSG` 안내. **근본 원인(어느 경로가 localStorage를 되돌리는지)은 미추적** — 경합 버그라 계측 없이 패치하면 두더지잡기가 된다(R30에 재발 시 계측 절차 기록).
- **일별 달력 금액 넘침**([net-asset-chart.tsx](../../src/app/(main)/_components/views/activity/net-asset-chart.tsx)): 모바일 셀 텍스트 가용폭이 **42.6px**(`(390−24−gap12)/7 − p-1 8`)인데 `text-sm`에서 `+3,433`이 약 42.4px라 옆 칸을 침범했다(1,000만~9,999만원 대역, 순자산도 100억 넘으면 동일). 표기 체계를 바꾸는 대안(억 소수 전환=해상도 손실, 콤마 제거=앱 전체와 불일치)보다 대가가 작아 **`text-xs sm:text-sm`** + `tabular-nums`(규약상 원래 필수였는데 누락) + 셀 `overflow-hidden`으로 처리. `whitespace-nowrap`은 넣지 않음(단위가 둘째 줄로 wrap되는 2줄 레이아웃이라 한 줄로 묶으면 오히려 확실히 넘친다). design-system §타이포 `text-xs` 예외 목록에 등록.
- **하이브리드 구간 경계 이중계상 수정(위 수정 직후 QA에서 발견)**: `computePeriodAttribution`이 `[prevOld,mid]`+`(mid,curr]`로 쪼갠 뒤 `mergeAttributions`가 key별로 합산하는데, `reflectedCashInflow`가 **양쪽 구간 모두 시작일 당일을 포함**해 `mid` 당일 거래가 두 번 잡혔다 — **`income`이 2배가 되고 반대급부로 사용자가 한 적 없는 "현금 잔액 감소(추정)"가 같은 금액으로 표시**(주식 버그와 정확히 같은 형태). 현금 입출금 기본 날짜가 "오늘"이고 `mid`는 앱을 연 날의 daily 스냅샷이라 일상적으로 겹친다. 합계 = `deltaNet`은 유지돼(income +2배, cash −1배 상쇄) 기존 테스트 전부 통과한 채 살아 있었다. → 4종 flow 함수의 경계 판정을 **`inFlowWindow` 단일 헬퍼**로 통일하고, `resolveAttribution`에 `isFirstSegment`(기본 `true`)를 추가해 **현금·대출의 "시작일 당일 포함"을 전체 기간 첫 구간에만** 적용. 두 구간의 합집합 = `[prevOld, curr]`, 교집합 = 공집합. `detectCashRoundTrip`의 `incomeToDate`도 같은 경계를 쓰도록 맞춤(`netCashEffect`와 기준 일치, 안 맞추면 `cashRoundTrip` 오탐 회귀). R29를 이 3중 조건으로 확장.
- 신규 회귀 테스트 6건(경계일 이중계상·소급 반영 1회 계상·코인 동형 + mid 당일 현금/주식 중복 방지·전체 시작일 당일 income 보존), 전체 **147건** 통과. 두 수정 모두 되돌려 해당 테스트가 실제로 실패하는 것까지 확인. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build`(22개 라우트) 전부 통과.

## 2026-08-04 (4)

### 기기 동기화 데이터 손실 원천 차단 + 순자산 왜 현금/대출 완전 분리 (issue-4.21)

- **왜(동기화)**: "A기기에서 추가한 현금 자산이 B기기 접속 후 사라진다"는 재발 제보. 클라이언트의 pull-first 순서(마운트·연결·잠금해제)는 이미 있었으나, 심층 점검에서 **더 넓은 두 구멍**을 확인했다. ① 서버 `/api/sync` PUT의 버전 체크가 `getAssetEnvelope`→비교→`setAssetEnvelope`의 read-then-write라, 두 기기가 거의 동시에 push하면 둘 다 체크를 통과해(TOCTOU) 나중 쓰기가 먼저 쓰기를 조용히 지웠다(lost update — 어느 쪽도 409를 못 받음). ② 409 충돌 복구가 pull로 로컬을 통째로 교체할 뿐 **push하려던 로컬 편집을 재병합·재전송하지 않아**, 정상적인 멀티기기 사용에서 "막 추가한 자산"이 구조적으로 반복 소실됐다(같은 원인이 멀티탭·마운트 pull 창에서도 발생).
- **원자적 CAS**([cache-storage.ts](../../src/lib/cache-storage.ts) `compareAndSetAssetEnvelope` 신설, [route.ts](../../src/app/api/sync/route.ts)): 버전 비교+저장을 단일 원자 연산으로. Upstash는 Lua 스크립트(`redis.eval`)로 GET→비교→SET을 Redis 내부에서 처리(Lua는 항상 원자적), 로컬 `FileCacheStorage`는 중간 `await` 없는 동기 fs 호출로 같은 보장. pubKey 교체 불가(403)만 원자성 밖 사전 체크로 유지.
- **기준점(syncedIds) 병합**([asset-storage.ts](../../src/lib/asset-storage.ts) `reconcileAdditiveMerge`·`collectAssetIds`, [sync-state.ts](../../src/lib/cloud-sync/sync-state.ts) `syncedIds`): pull이 덮어쓰기 직전 로컬을 읽어 **원격에 없는 로컬 항목 중 "아직 서버에 올라간 적 없는 것"만 되살린다**. 되살린 게 있으면 `runPull`이 `lastPushedRef=null`로 파생값 비교를 건너뛰고 즉시 재-push해 서버에도 반영. 같은 id를 양쪽이 다르게 수정한 진짜 충돌은 원격 우선으로 남김(과설계 회피).
  - **기준점이 없으면 삭제가 부활한다(작업 중 발견·수정한 P0)**: 삭제가 tombstone 없이 배열 제거라 "로컬에 있고 원격에 없다"가 *신규 추가*와 *원격 삭제* 두 의미를 갖는다. 최초 구현은 이를 무조건 신규로 해석해, A가 지운 자산을 B가 pull하며 되살리고 그 결과를 재-push → A에서도 부활 → "지웠는데 1분 뒤 다시 나타남"이 무한 반복되어 다기기 삭제가 무력화됐다. **CAS로는 못 막는다** — CAS는 쓰기 순서만 통제하고, B는 최신을 정상 수신한 뒤 baseVersion도 최신이라 CAS 관점에선 완벽히 정당한 요청이었다. `syncedIds`(마지막으로 서버와 맞춰진 항목 키)를 기준점으로 두어 *기준점에 없음=신규 보존 / 있음=원격 삭제 존중*으로 판별.
  - 기준점 갱신 시점이 함정 — pull은 **병합 전 원격 키**로 갱신해야 한다(병합으로 살려둔 신규분까지 넣으면 그게 올라가기 전에 다음 pull이 "삭제됨"으로 오판해 스스로 지운다). push는 push한 키로 갱신. `forgetRemembered`도 `syncedIds` 보존.
  - `connect`(다른 금고 채택)는 `pullAsset(..., { merge: false })`로 원격 완전 대체 — 로컬 잔여 자산을 남의 금고에 섞지 않는다(F-CLOUD-SYNC S2 "자산 동일"). `unlock`(같은 금고)은 병합.
- **온라인 복귀 pull-first**([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx)): armed 폴링 effect에 `window "online"` 리스너 추가(force pull). 없으면 오프라인 중 쌓인 디바운스 push가 다음 폴링(최대 60초)보다 먼저 나가 충돌 경로로 들어갔다.
- **왜(현금/대출)**: 자산성적표 "순자산 왜?"에서 신규 현금 자산이 "대출" 섹션에 표시되고 금액도 다르게 읽힌다는 제보. `groupAttributionItems`의 "이 기간에 `debt`가 하나라도 있으면 `cash`를 대출 그룹으로 강제 편입"(2026-08 설계)이 금액·연관성과 무관하게 트리거된 게 원인 — 8600만원 신규 현금과 전혀 무관한 소액 대출 변동이 같은 주에 겹쳤다는 이유만으로 끌려갔다. **병합 규칙을 완전히 제거해 현금·대출을 항상 각자 그룹으로 분리.** `dCostCash`는 원래도 `loans`를 참조하지 않아 금액은 정확했음을 회귀 테스트로 확정(금액 차이는 두 줄이 한 박스에 나란히 표시되며 생긴 시각적 오독).
- 신규 테스트 16건(CAS 4·기준점 병합 11·현금대출 분리 회귀 1 + 기존 2건 갱신), 전체 141건 통과. R28 회귀 항목 신설(원자성·기준점·갱신 시점·online 리스너 5개 조건). `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build` 전부 통과.

## 2026-08-04 (3)

### 암호화폐 종합 카드 매수/매도 버튼 중복 노출 수정 + 상세탭 공통 규칙 명문화 (issue-4.21)

- **왜**: 거래소가 1개만 지정된 코인은 종합 카드(`CryptoCard`)와 거래소별 하위 카드(`SubCryptoCard`) 양쪽에 동일 코인의 "매수/매도 기록·내역" 버튼이 중복 노출됐다(사용자 점검 요청으로 발견). 주식(`StockCard`)은 거래입력 노출 조건이 `!hasSubItems` 하나뿐인데, 암호화폐는 "병합 대표 id 편집 불가" 판단용 조건(`effectiveGroupItems.length > 1`)을 거래입력 노출에도 잘못 재사용해 두 자산의 기준이 벌어졌던 것이 원인.
- **수정**: [crypto-tab.tsx:166](../../src/app/(main)/_components/views/detail/tabs/crypto-tab.tsx)의 `CryptoCard` 거래입력 행 노출 조건을 `!(hasSubItems && effectiveGroupItems.length > 1)`→`!hasSubItems`로 변경, 주식과 완전히 동일한 규칙으로 통일. 수정 버튼 disabled 조건(`effectiveGroupItems.length > 1`)은 의미가 다르므로 그대로 유지.
- **KB 반영**: `qa-full-test-plan.md` F-ASSET에 "하위 항목 보유 자산의 거래입력 노출 규칙(필수)" 명문화, F-STOCK·F-CRYPTO-TX 상호 참조 추가. `dev-rules.md`에 "자산 상세탭 공통 적용 판단 체크리스트" 신설 — 앞으로 5탭(현금·암호화폐·주식·부동산·대출) 중 하나라도 수정 시 하위 항목(증권사·거래소) 이슈면 주식+암호화폐 동시 수정, 그 외 공통 이슈면 5탭 전체 검토를 강제.
- `npx tsc --noEmit`·`npx vitest run`(125건 통과)·`npm run lint`(0 errors, 기존 warning 외 신규 없음)·`npm run build` 전부 통과(QA 완료).

## 2026-08-04 (2)

### 암호화폐 매수/매도 거래내역 신설 (issue-4.21, S-4.25)

- **왜**: `crypto[]`는 `quantity`·`averagePrice`(잔고 스냅샷)만 있고 거래 이력이 없었다 — 주식(`transactions`)·현금(`cashTransactions`)·대출(`loanTransactions`)은 이미 갖춘 기능이 코인만 빠져 있었고, 원인분해의 `buy:crypto`/`sell:crypto`도 실제 거래가 아니라 스냅샷 원가 델타 추정치였다. "자산업데이트" 플로팅 버튼에도 현금·대출은 기록 액션이 있는데 코인만 진입로가 없었다(사용자 제보).
- **계산 엔진 재사용**: [trade-utils.ts](../../src/lib/trade-utils.ts)의 가중평균 재계산 함수 5개(`computeNewPosition`·`recomputeFromLog`·`reverseTransaction`·`deriveBaseSnapshot`·`rollbackTransaction`)와 `pruneTransactions`·`findDuplicateTransaction`, `validate-reflection.ts`를 `TxLike`/`PositionLike` 구조적 타입으로 일반화해 주식 코드를 복제하지 않고 코인에도 재사용(현금·대출의 잔액 선형 가감과 달리 코인은 매수 시 평단이 바뀌므로 계산 구조가 주식과 동일).
- **진입 동선 통일**: `floating-add-button.tsx`의 "자산업데이트" 플로우에 현금 "입출금 기록"·대출 "상환/대출 기록"과 동일 위치·패턴으로 코인 "매수/매도 기록" 액션 추가([asset-dispatch.ts](../../src/app/(main)/_components/layout/navigation/asset-dispatch.ts) `dispatchAddCryptoTx`). 코인 상세 탭 카드에도 기록/내역 버튼 추가(병합 카드는 거래소 분할 보유 시 합성 id라 비활성화, 거래소별 하위 카드에서 개별 기록).
- **신규**: [types/transaction.ts](../../src/types/transaction.ts) `cryptoTransactionSchema`(주식 `transactionSchema`에서 통화·환율·수수료 필드 제거), `assetData.cryptoTransactions[]`, [crypto-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx)·[crypto-tx-view.tsx](../../src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx)(`crypto-transactions` 탭), `asset-data-context` CRUD 4종(단일 저장, R4 대칭).
- **원인분해 정확화**([asset-report.ts](../../src/lib/report/asset-report.ts)): `reflectedCryptoFlow` 신설로 `buy:crypto`/`sell:crypto`를 실제 반영 거래 기반으로 계산(정밀·예측 분기 모두). `estimatePeriodInflows`에 `tradedCryptoIds` 추가해 반영 거래 있는 코인을 매수일 추정에서 제외(이중계산 방지, `tradedStockIds` 패턴).
- **공유 토큰**: packV7 `parts[14]`에 코인 거래내역 섹션을 꼬리로 추가(`crIdx`로 부모 코인 참조). 꼬리 추가라 구버전 토큰 호환(R3).
- 명세 [S-4.25](../specs/4.25-crypto-transactions.md) 역작성. 신규 테스트 4건(trade-utils 코인 재사용 2건, asset-report buy:crypto 정확화·이중계산 방지 2건), 전체 122건 통과. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors, 기존 warning 외 신규 없음)·`npm run build` 전부 통과(QA 완료).

## 2026-08-04 (1)

### 순자산 왜 — 대출 상환 오분류·기간별 노출 불일치 수정 (issue-4.21)

- **왜**: 08-03 백업 데이터 기준으로 홈 "자산 원인"에 실제 대출 상환이 "현금 감소(추정)"로, 자산성적표 1개월/3개월 기간에서 1주엔 보이던 대출·현금 기록이 사라지는 문제가 제보됨.
- **대출 상환 오분류**([asset-report.ts](../../src/lib/report/asset-report.ts) `resolveAttribution`): 예측(estimated) 분기가 `inflows.debt`(신규 대출만 감지)+`reflectedLoanFlow`(기록된 상환 거래만 집계)만 써서, 대출 잔액을 직접 수정한 경우(백업 복원 등, 상환 기록 없음)를 놓쳐 `debtEffect≈0`이 되고 실제 변화가 잔차로 새어나갔다. `breakdown`(fx·cost 없이도 존재 가능)이 양쪽에 있으면 정밀 분기와 동일하게 `-(curr.breakdown.loans - prev.breakdown.loans)`로 직접 계산하도록 보강.
- **기간별 노출 불일치**: `buildAttributionPoints`가 monthly 스냅샷의 `_date`를 실제 캡처일이 아니라 그 달 마지막 날(월말)로 강제해, 실제 캡처일~월말 사이 거래가 `reflectedXFlow` 범위 필터에서 누락됐다(1주는 daily라 문제없고 1·3개월만 monthly를 써서 증상 발생). `MonthlyAssetSnapshot`에 실제 캡처일(`date`, optional) 필드를 추가해 `_date`로 우선 사용, 레거시(필드 없음)만 월말 폴백.
- 신규 테스트 4건, 전체 118건 통과. `npx tsc --noEmit`·`npx vitest run` 통과(라이브 프리뷰 생략, CLAUDE.md 지침).

## 2026-08-02 (4)

### 순자산 변화, 왜? — 자산 타입 그룹 박스·부동산 안분 제외·문구 통일 (issue-4.21)

- **왜**: 예측+실측이 섞인 하이브리드 구간에서 "시세 하락"(통합 예측)과 "주식 시세 하락"(실측)이 별도 두 줄로 뜨는 문제, 월급·목돈 유입 문구가 매수/매도와 다른 패턴인 문제, 현금 입금 기록이 있는데도 "현금 잔액 직접 수정"으로 오노출되는 문제, 원인 목록이 자산 타입별로 묶이지 않아 산발적으로 보이는 문제를 사용자가 순차적으로 제보.
- **하이브리드 시세 통합**([asset-report.ts](../../src/lib/report/asset-report.ts)): `mergeAttributions`가 older(예측)의 통합 `price`를 `reallocatePriceEffects`로 mid 시점 breakdown 구성비에 안분해 newer(실측)의 `price:stock`/`price:crypto`와 한 항목으로 합친다. **부동산은 안분 대상에서 제외** — 부동산 `currentValue`는 주식·코인과 달리 자동 시세 갱신이 없고 사용자가 실거래가 조회 후 수동으로만 갱신하는 계단식 값이라(`real-estate-input.tsx`), 안 건드린 부동산에 근거 없는 "부동산 시세 하락"이 뜨는 것을 방지. 안분된(추정치가 섞인) 항목은 `AttributionCause.estimated`가 true가 되어 뷰가 개별 "일부 예측" 배지를 붙인다. 안분 불가(구성 정보 없음) 시 라벨을 "보유자산 시세"로 명확화(자산군 통합임을 표시).
- **자산 타입 그룹 박스**: 신규 `groupAttributionItems`가 `getAttributionItems` 결과를 주식·코인·부동산·현금(`income`+`cash`)·대출(`debt`) 그룹으로 묶고, 그룹 순변동(양음 상쇄 반영) 절대값이 큰 순서로 정렬. `fx`·`deposit`·통합 `price`는 그룹 없이 단독 박스 유지. [asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)가 그룹당 박스 하나(`GROUP_BADGE` 라벨 + 구분선 있는 줄들)로 렌더.
- **문구 통일**: `income` 라벨을 "소득 유입"/"인출·지출" → "현금 입금"/"현금 출금", 문장도 매수/매도와 동일 패턴("현금 입금으로 ~ 늘었어요")으로 변경.
- **근본 원인 수정**([cash-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx)): 현금 입출금 기록의 날짜 기본값·최대값이 UTC 자정 기준이라 KST 00~09시에 기록한 거래가 하루 전 날짜로 저장돼 원인분해 `income` 집계에서 누락(→`cash` 잔차 오분류)되고, 그 시간대엔 오늘 날짜 선택 자체가 막혀 있었다 — 스냅샷과 동일한 KST(`Date.now()+9h`) 기준으로 통일.
- **4대 섹션 아이콘 톤 구분**: "투입 대비 성과"·"5축 측정"·"순자산 변화, 왜?"·"AI 평가 프롬프트" 4개 대주제 섹션 아이콘 배경·색을 `SectionHeader`의 `tone` prop(brand/gold/important/info)으로 구분(제목 텍스트는 공통 유지). design-system.md에 이미 정의된 토큰만 재사용.
- 신규 테스트 6건(하이브리드 price 안분·부동산 제외 확인 2건·groupAttributionItems 3건·income 문구 1건), 전체 112건 통과. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(신규 warning 없음)·`npm run build` 전부 통과(QA 완료).

## 2026-08-02 (3)

### S-4.24 QA 후속 수정 — loanCount 필터링의 파급 4건 (issue-4.24-loan-transactions)

- **왜**: `/qa-full-test`로 S-4.24를 코드레벨 정밀 점검한 결과, `getAssetSummary().loanCount`를 완납(balance=0) 대출 제외로 바꾼 여파가 네 곳에서 실사용 버그로 이어졌다 — `loanCount`가 "현황 표시용(활성만)"과 "탭에 갈 데이터가 있는가(존재 여부)"라는 두 역할을 겸하던 자리들이 갈라지지 않은 채 남아 있었다(R27 신설).
- **수정**: ①[detail-hub.tsx](../../src/app/(main)/_components/views/detail/detail-hub.tsx) "대출" KPI 카드의 네비게이션 게이트를 `s.loanCount`(활성만) → `assetData.loans.length > 0`(존재 여부)로 분리 — 완납 대출만 있어도 탭 진입 가능(표시 숫자는 `loanCount` 그대로 유지). ②[dashboard.tsx](../../src/app/(main)/_components/views/home/dashboard.tsx) 홈 부채 탭의 "대출 N건"이 `assetData.loans.length`(완납 포함)를 쓰던 것을 `summary.loanCount`(활성만)로 맞춰 detail-hub·loan-tab과 건수를 일치. ③[ai-prompts.ts](../../src/lib/ai-prompts.ts) `buildLoanList`가 `data.loans` 전체를 나열해 헤더의 `loanCount`와 본문 목록 건수가 어긋나던 것을 `balance > 0` 필터로 통일. ④[loan-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-input.tsx) 신규 대출 등록 폼에 `!editData && balance<=0` 가드를 추가 — 완납은 상환 거래내역을 거쳐서만 도달해야 하는데, 등록 즉시 잔액 0으로 만들 수 있어 ①의 재현 조건을 더 쉽게 만들던 경로를 차단(수정은 여전히 0 허용).
- 회귀 레지스트리에 **R27**(집계 카운트 ≠ 존재 여부) 신설 — 향후 `*Count` 필드에 필터를 추가할 때 네비게이션 게이트·표시·AI 프롬프트 소비처를 함께 점검하도록 명시.
- 검증: `npx tsc --noEmit`(EXIT=0)·`npx vitest run`(105/105)·`npm run lint`(0 errors, 기존 warning 10건 외 신규 없음)·`npm run build` 전부 통과.

## 2026-08-02 (2)

### 대출 상환/추가 대출(마이너스통장) 거래내역 신설 (issue-4.24-loan-transactions, S-4.24)

- **왜**: 대출(`loans[]`)은 `balance` 단일 스칼라만 있어 상환·추가 대출 이력이 전혀 없었다 — 현금이 S-4.22 이전 겪던 것과 동일한 결함. 자산 성적표 원인분해의 `debt` cause도 "얼마 변했다"만 알 뿐 상환인지 신규 대출인지, 언제 얼마씩인지 설명하지 못했다.
- **구현**: S-4.22(현금 입출금)를 그대로 미러링 — [types/transaction.ts](../../src/types/transaction.ts) `loanTransactionSchema`(통화 필드 없음, 대출은 항상 KRW), [lib/loan-tx-utils.ts](../../src/lib/loan-tx-utils.ts)(prune·중복탐지·잔액델타·상환초과 가드), `asset-data-context`에 CRUD 4종(단일 저장 경로, R4 대칭), [loan-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-tx-input.tsx)·[loan-tx-view.tsx](../../src/app/(main)/_components/views/detail/loan-tx/loan-tx-view.tsx) 신설, `loan-transactions` 탭 등록, 대출 카드·전역 "자산 업데이트" 플로팅 버튼 두 인입 경로 모두 대칭 추가.
- **완납 처리**: `loanSchema.balance`의 `.refine(val => val > 0)`를 제거해 0(완납)을 허용. `loan-tab.tsx`의 `allLoans`·`asset-report.ts`의 `loanInterest`/`investLoanBalance`가 이미 `balance > 0` 필터를 쓰고 있어, 스키마 하한만 풀면 완납 대출이 목록·비중 바·이자 집계·레버리지 박스에서 **자동으로** 제외됐다(새 "완납 섹션" 카드를 만들 필요 없음). 다만 완납 대출은 목록에서 사라져 재활성화(추가 대출) 진입점이 없어지므로, `loan-tab.tsx`에 비중 바·집계와 완전히 분리된 별도 "완납된 대출" 요약 목록(이름·배지·내역/기록 버튼만)을 추가해 히스토리 열람과 재활성화 경로를 확보했다. `getAssetSummary().loanCount`도 `balance > 0`만 카운트하도록 맞춰 `detail-hub` 배지·진입 게이트의 모순(완납만 있는데 "1건"으로 표시)을 해소.
- **원인분해 `debt` cause 정확화**: 정밀(bothEnriched) 경로의 `debtEffect`는 스냅샷 `breakdown.loans` 델타라 이미 정확해 손대지 않았다. 반면 예측(estimated) 경로의 `estimatePeriodInflows`는 `loan.startDate`가 기간 내인 신규 대출만 잡아 기존 대출의 기간 내 상환을 전혀 포착하지 못했다 — 신규 함수 `reflectedLoanFlow`(통화 무관, `reflectedCashInflow`/`reflectedTradeFlow`와 동형)로 보강하고, 신규 대출이면서 동시에 반영 거래도 있는 경우의 이중계산은 `estimatePeriodInflows`가 해당 대출을 `loanTxLoanIds`로 skip(주식 `tradedStockIds` 패턴 미러링)해 방지했다. 신규 cause 키는 만들지 않고 기존 `debt`를 그대로 유지.
- **공유 토큰**: packV7 `parts[13]`에 대출 거래내역 섹션을 꼬리로 추가(`loanIdx`로 부모 대출 참조, `cashTransactions`의 `parts[12]` 패턴과 동형). 꼬리 추가라 구버전 토큰 파싱은 그대로 호환(R3).
- 신규 테스트: `src/lib/__tests__/loan-tx-utils.test.ts`(4건, `cash-tx-utils.test.ts` 미러링), `asset-report.test.ts`에 예측 경로 `debt` cause 정확화 회귀 2건(단독 상환 포착·신규대출+반영거래 이중계산 방지) 추가 — 전체 105건 통과.

## 2026-08-02

### 일요일 "주식 시세 상승" 오표시 + 기록된 입금의 cashRoundTrip 오탐 수정 (issue-4.21)

- **왜(일요일 시세)**: 홈에서 일요일에도 "주식 시세 상승 +327만원"이 표시된다는 리포트. R23(휴장일 slot 고정)은 quote **재조회**만 막을 뿐 스냅샷 **시작점** 자체가 stale하면 방어하지 못한다 — 토요일 KST 새벽(해외 컷오프 06/07시 이전)에 접속하면 `getDailyClosingRefDates("foreign")`이 한 칸 더 과거로 물러나 그날 스냅샷에 **목요일 종가**가 박히는데, 종전 일요일 분기(`saveSnapshots`)는 `hasSaturdaySnapshot`이면 재기록을 건너뛰어 이 값이 그대로 남았다. 일요일 홈은 이 stale 스냅샷(목요일 종가)과 실시간 끝점(금요일 확정 종가)을 비교해 미국 금요일장 하루치 변동 전체를 `price:stock`으로 노출했다.
- **수정** ([asset-data-context.tsx](../../src/contexts/asset-data-context.tsx) `saveSnapshots`): 일요일 분기의 `if (!hasSaturdaySnapshot)` 가드를 제거하고 토요일 슬롯을 **항상 upsert**. 일요일 시점의 `getDailyClosingRefDates`는 국내·해외 모두 반드시 금요일을 가리키므로, 재기록 시 자동으로 금요일 확정 종가로 교정된다. 토요일에 확정된 성적표(`grade`)는 보존해 넘기고, 환율 이력 기록도 upsert 경로로 통일(종전엔 토요일 스냅샷이 있으면 일요일 환율 이력이 기록되지 않았다).
- **왜(cashRoundTrip 오탐)**: 명확히 기록된 현금 입금 2,800만원("월급·목돈 유입으로 +2,800만원 늘었어요")이 있는데도 같은 화면에 "8/1에 최대 2,800만원 변동 후 복귀돼 순변화엔 반영 안 됐어요" 힌트가 함께 떠 서로 모순됐다. `detectCashRoundTrip`이 이탈폭은 `breakdown.cash`(기록된 입금 포함)로 재고, 왕복 여부는 `cash` cause 잔차(기록된 입금은 `income`으로 분리돼 제외)로 판정하는 **기준 불일치** 때문 — 기록된 입금만으로 잔액이 단조 증가해도 `cash` 잔차는 ≈0이라 "왕복 후 복귀"로 오판됐다.
- **수정** ([asset-report.ts](../../src/lib/report/asset-report.ts)): `detectCashRoundTrip`의 이탈폭 계산에서 시점별 `reflectedCashInflow`(시작점~해당 일자 누적, 기존 함수 재사용) 누적분을 빼 왕복 판정과 같은 기준(기록으로 설명되지 않는 변동)으로 맞췄다. 진짜 왕복(현금이 실제로 나갔다 돌아온 경우)은 그대로 감지된다.
- 회귀 테스트 3건 추가(토요일 stale→일요일 오표시 재현·교정 확인 2건, 기록된 입금의 왕복 힌트 미노출 1건) — 총 34건.

## 2026-08-01

### 원인분해: 1주가 실측인데 잘못 "일부 예측" 표시되던 하이브리드 회귀 수정 + cash 잔차 정밀 진단 스크립트 (issue-4.21)

- **왜**: 직전 하이브리드 합성 작업 배포 직후 사용자가 "1개월·3개월·올해는 07/24 이전 추정치로 정상 표시되는데, 1주는 이미 daily 30일 창 안이라 전부 실측이어야 하는데도 07/27 이전이 추정치로 나온다"고 리포트. 원인은 `computePeriodAttribution`의 `mid` 탐색이 `prevOld`가 이미 실측(`isFullyEnriched`)인지 확인하지 않고 무조건 실행돼, 1주처럼 `prevOld`가 이미 완전 실측인 경우에도 사이의 아무 enriched daily나 붙잡아 불필요하게 두 구간으로 쪼갰다. `mergeAttributions`가 `older.estimated`를 확인 안 하고 무조건 `estimatedUntil`을 채우던 구현과 겹쳐, 전 구간이 실측인데도 근거 없는 "추정치" 배지가 붙었다.
- **수정** ([asset-report.ts](../../src/lib/report/asset-report.ts)): `prevOld`가 이미 `isFullyEnriched`면 `mid`를 애초에 찾지 않도록 가드(근본 수정 — 불필요한 분할·연산 자체를 없앰). `mergeAttributions`도 방어적으로 `older.estimated`가 실제 `true`일 때만 `estimatedUntil`을 채우도록 고쳐, 호출부가 실수해도 잘못된 배지가 나오지 않게 이중 방어. 회귀 테스트 1건 추가(실측 `prevOld`·`mid`·`curr` 셋 다 구성해 쪼개지지 않음을 검증) — 총 29건.
- **cash −480만원 정밀 진단**: 사용자가 이전 디버깅 스크립트 결과로도 원인을 특정하지 못함(계산은 정확했으나 "왜"까지는 못 밝힘) → `scripts/debug-attribution.js`를 재작성. 구 버전은 income/cash/deposit 분리 이전 공식을 재현하고 있어 이미 낡았고, 양 끝점 비교만 해 "언제" 변했는지 좁힐 수 없었다. 추가한 것: ① 기간 내 매일 `breakdown.cash` 타임라인(전일 대비, 100만원 이상 급변일 자동 강조) ② `cashTransactions` 전체 무필터 덤프 + **경계일(`fromDate`) 자동 탐지** — `reflectedCashInflow`의 `t.date <= fromDate` 제외 규칙 때문에 기간 시작일 당일 기록은 집계에서 빠지는 것을 확인해 강조 표시 ③ 현재 현금 계좌 목록(계좌에 수정 이력 필드가 없어 과거 잔액은 원천적으로 복원 불가임을 명시) ④ 임차보증금 채널 재확인. 계좌 삭제·잔액 직접수정처럼 앱에 이력이 전혀 남지 않는 경우는 코드로 확정할 수 없다는 한계를 스크립트 결론 로그에 명시.
- **실사례로 원인 확정 → `cash` 서술형 문장 갱신**: 위 스크립트로 사용자가 직접 타임라인을 대조해 "07/25 +480만·07/27 +50만이 07/30 −530만으로 정확히 상쇄"되는 패턴을 확인 — 입출금 기록이 아니라 **현금 계좌 잔액을 직접 수정(입력 후 되돌림)**한 경우였다. [asset-report.ts](../../src/lib/report/asset-report.ts) `causeSentence`의 `cash` 문구를 "현금 잔액이 알 수 없는 이유로 ~"에서 **"현금 잔액 직접 수정으로 ~ 추정돼요"**로 변경 — 실사례로 확인된 가장 유력한 원인을 안내하되, 단정("~때문이에요")이 아니라 "추정"으로 남겨 다른 원인(계좌 삭제 등)의 가능성은 열어둔다. 짧은 라벨("현금 잔액 증가/감소")은 그대로 유지.
- **`cashRoundTrip` 힌트 신설**: 이어서 "1주엔 −480만원이 보이는데 왜 1개월·3개월·올해엔 안 보이냐"는 질문이 나왔다 — 실측 확인 결과 **버그가 아니라 델타 비교의 본질적 특성**이었다. 1개월의 실측 시작점(`mid`=07-24)과 끝점(`curr`=08-01)의 `breakdown.cash`가 정확히 같아(9,450,000원) 순변화=0, 반면 1주의 시작일(07-25)은 이미 왕복 중간(07-24→07-25 급등 이후)이라 뒷부분(−480만)만 잡힌 것. 다만 "분명히 뭔가 있었는데 안 보인다"는 혼란을 막기 위해 `detectCashRoundTrip`을 신설 — 실측 daily 구간에서 baseline 대비 최대 이탈폭을 찾아 순변화가 그 절반 미만이면 `cashRoundTrip`으로 붙이고, 성적표에 "{날짜}에 현금 잔액이 일시적으로 최대 N만원까지 움직였다가 되돌아와 순변화에는 반영되지 않았어요" 캡션을 노출한다. `cash`만 대상(시세 등 상시 변동 채널에 일반화하면 노이즈). 회귀 테스트 2건 추가(왕복 감지·오탐 방지) — 총 31건.

### 원인분해: 기간 실측/예측 하이브리드 합성 + income·cash·deposit 분리 (issue-4.21)

- **왜**: 성적표 "순자산 변화, 왜?"의 1개월·3개월이 사실상 항상 "예측" 배지였다. daily가 30일 롤링인데 1개월 목표일도 정확히 오늘−30이라 daily 후보가 단 하루뿐이고, 과거 monthly엔 v2 enrich(2026-07-23 도입)가 없어 곧장 예측으로 떨어졌다. 사용자 요구: "1주에 실측된 자료가 있으면 1·3개월에도 그 구간은 실측으로 반영하고 나머지만 예측" — 기간별 특수 처리 없이 1주·1개월·3개월·올해 전부 동일 규칙을 적용해야 한다는 것.
  동시에 "현금 인출·지출 −480만원"이 `cashTransactions` 기록 0건인데 표시되는 문제도 발견됐다. 디버깅 스크립트(`scripts/debug-attribution.js`, 개발 전용)로 실제 데이터를 검증한 결과, 계산 자체(잔차)는 정확했다 — `breakdown.cash`의 실측 감소분과 `priceResidual`이 부동소수점 오차 수준까지 정확히 일치했다. 문제는 `income = incomeEffect + dCostCash`로 **합쳐서** 방출해 `incomeEffect`(실제 기록)가 `savingInvest = savingFullReal − incomeEffect` 정의 때문에 대수적으로 완전히 소거된 것 — 기록을 넣든 안 넣든 표시 금액이 같았고, "기록 없는 잔액 변동"이 "인출·지출"이라는 확정적 사건으로 단정됐다.
- **기간 하이브리드 합성** ([asset-report.ts](../../src/lib/report/asset-report.ts) `computePeriodAttribution`): `prevOld`(목표일 이하 최신, 없으면 최고참 포인트로 폴백) ~ `curr` 구간에서 `isFullyEnriched`(breakdown·fx·fxBase·cost 전부)를 만족하는 가장 오래된 **daily**를 `mid`로 찾아 `(prevOld,mid]`은 예측 + `(mid,curr]`은 실측으로 각각 계산 후 `mergeAttributions`로 key별 `effects`(신규 필드 — `pickTopCauses`가 버리던 raw 벡터를 보존)를 합산, `pickTopCauses`를 1회만 재실행한다. 효과 필드가 전부 가산적(텔레스코핑)이라 합계=deltaNet 항등식이 자동 유지된다. `mid`는 monthly 제외(`_date`가 월말로 강제돼 값 시점과 최대 30일 어긋나 flow 윈도우 누락) — daily만 허용. `assetData.yearlyNetAssets`를 `YYYY-12-31` 앵커로 승격해 먼 과거 폴백 후보도 확장(연초 "기록 없음" 해소). `estimated: boolean`(하위호환, 전체 예측)에 `estimatedUntil?: string`(이 날짜 이전만 예측)을 추가해 성적표에 "일부 예측" 배지를 신설.
- **income≠cash 분리** ([asset-report.ts](../../src/lib/report/asset-report.ts)): 합치지 않고 두 키로 나눠 방출하도록만 바꿨다(`{key:"income",amount:incomeEffect}, {key:"cash",amount:dCostCash}`) — 대수 자체는 그대로라 항등식은 유지되면서 의미가 분리된다. `income`은 실제 기록된 입출금만("소득 유입"/"인출·지출"), `cash`는 설명되지 않는 잔차("현금 잔액 증가"/"현금 잔액 감소" — 사건을 단정하지 않는 라벨).
- **`deposit`(임차보증금 증감) 신설**: `netAsset = totalValue − loans − tenantDeposit`인데 `SnapshotBreakdown`에 그 항목이 없어([types/asset.ts](../../src/types/asset.ts) `tenantDeposit?: number` v4 추가) 항등적으로 어긋나 있었다 — 임차보증금이 변하면 그 변동이 통째로 `cash` 잔차로 샜다. `depositEffect = -(ΔtenantDeposit)`로 분리(debt와 동일 부호 규약). 양쪽 스냅샷에 필드가 있을 때만 분리되고, 과거 스냅샷이 섞인 구간은 소급 불가라 여전히 잔차.
- **잔차 흡수 부호 안전장치** (`getAttributionItems`): 임계값 미만 잔차를 절대값 최대 원인에 얹을 때 **부호가 같은 원인에만** 얹도록 제한 — 방향 고정 라벨(`buy:stock` 등)에 반대 부호 잔차가 붙어 "주식 매수로 −3만원 늘었어요" 같은 모순 문장이 나오는 것을 막는다. 부호가 맞는 원인이 없으면 `cash`로.
- 회귀 테스트 7건 추가(하이브리드 합성 4기간 공통·mid 부재 회귀·연초 폴백, income↔cash 실제 반응, deposit 분리, 잔차 흡수 부호 일치) — 총 28건.

### 잠금화면 뒤 백그라운드 동작 전면 차단 + 동기화 파생 변경 결함 수정 (issue-4.21)

- **왜(잠금)**: `asset-data-context`의 `checkIsLocked()`가 `standalone`을 AND로 요구했는데 잠금화면([pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx))은 standalone을 보지 않는다 → **브라우저 탭에서 앱잠금 ON이면 PIN 화면 뒤로 `initAndSync` 전체(환율·주식·코인·profit 조회·스냅샷 저장·`lastVisitDate` 기록)가 그대로 실행**됐다(해제 후 "지난 접속 이후" 브리핑 소실). 게다가 그 가드는 7개 effect 중 1개에만 있었고, 마이그레이션은 가드 **위**에서 돌아 환율 이력 삭제 같은 파괴적 1회성 작업이 잠금화면 뒤에서 `done` 처리됐다. 부동산 실거래 갱신 effect는 잠금·인앱게이트·`isDataLoaded` **가드가 전무**해 `storage` 이벤트만으로 `/api/realestate` 요청이 나갔다.
- **잠금 판정 단일화** ([app-lock.ts](../../src/lib/pwa/app-lock.ts) 신설): 잠금 유틸을 UI에서 순수 모듈로 분리(잠금화면이 `useAssetData`를 쓰므로 컨텍스트가 import하면 순환 참조)하고 `checkIsLocked()`를 제거해 **`isPwaLocked()` 하나로 통일**. 백그라운드 가드는 [background-gate.ts](../../src/lib/pwa/background-gate.ts)의 `isBackgroundWorkBlocked()`(인앱 게이트 ∪ 앱잠금) 단일 함수로 묶었다 — 게이트가 2종인데 지점마다 따로 쓰면 한쪽을 빠뜨린다(실제로 부동산 effect가 그 상태였다). 마이그레이션은 가드 아래로 내리고 `unlockAndLoad`가 대신 실행한다. `armed` 진입은 IndexedDB 언랩뿐이라 그대로 두고 push/pull을 각각 막았다.
- **해제 순서 직렬화**: 종전엔 `PWA_UNLOCKED_EVENT`(→ pull → `clearAssetData` → `initAndSync`)와 `unlockAndLoad()`(→ `initAndSync`)가 **병렬**로 시작해, pull이 로컬을 덮어쓰는 동안 구 데이터 기준 시세·스냅샷 저장이 동시에 진행될 수 있었다 → `markPwaAuthenticated()` → `await unlockAndLoad()` → `emitPwaUnlocked()` 순으로 고정.
- **왜(동기화)**: "사용자가 명시적으로 바꾼 것만 전파" 설계는 대체로 지켜지고 있었으나 8건이 남아 있었다. **데이터가 실제로 없어지는 2건**: ① `autoPullIfNewer`에 `userEditRef` 가드가 없어 디바운스(2.5s) 대기 중 pull이 끼어들면 방금 한 편집이 push되지도 복구되지도 않고 소실 → pull 보류로 수정. ② `buildExportPayload`는 스냅샷이 비면 키 자체를 넣지 않는데 `applyImportedPayload`는 `clearAssetData` 후 **있을 때만** 복원 → 스냅샷 없는 새 기기가 push한 걸 pull하면 기존 기기 이력이 증발. `dailyArchive`가 쓰던 "로컬 먼저 읽어두고 없으면 되돌려 쓰기" 패턴을 daily/monthly에도 적용.
- **불필요한 자동 push 제거**: `saveSnapshots`가 일요일에 **토요일** 스냅샷을 만들고 등급도 토요일 항목에 기록하는데 비교 제외는 오늘자뿐이라 파생 변경만으로 push됐다(자정을 넘겨 켜둔 경우도 동일) → daily 제외를 **오늘·어제**로 확장해 두 케이스를 함께 해소. 부동산 `regionCode`·`legalDong`·`complexName`(주소 해석 API 자동 채움)도 제외 목록에 추가.
- **트리거 정합**: 실패한 pull이 `skipNextChangeRef`를 되돌리지 않아 다음 비-사용자편집 변경 1회를 삼키던 것 수정. `addStockRaw`(스크린샷 일괄 등록)는 명백한 사용자 편집인데 이벤트를 안 내 push가 호출처 `refreshData()`의 우연한 비교 통과에 의존하던 것 → 이벤트 발행. 반대로 `stock-tab`의 1회성 마이그레이션은 파생인데 `saveData`로 사용자 편집인 척 push를 강제하던 것 → `saveAssetData` 직접 호출로 전환.
- **QA에서 발견한 자기 회귀 5건 수정**(`/qa-full-test`): ① **P0** `setPwaAuthPin`이 세션 인증을 기록하지 않아 **앱잠금을 켠 그 세션의 push/pull/시세/스냅샷이 전부 무증상 정지**(잠금화면은 마운트 시에만 판정해 뜨지도 않음) → `markPwaAuthenticated()` 동반 호출. 가드를 넓힌 것의 직접적 부작용이었다. ② 잠금 시 마운트 effect를 통째로 건너뛰면서 hashchange 리스너·monthlySnapshots 백필(비가역)·Share Target 변환이 세션 내내 미실행 → 본문을 `runBootstrap()` 단일 함수로 추출해 마운트(비잠금)·`unlockAndLoad`(해제) 양쪽에서 호출하고, hashchange 리스너는 항상 등록하되 핸들러가 잠금을 가드. ③ `userEditRef` pull 보류가 **conflict 화해를 영구 차단**(conflict는 push 성공이 아니라 플래그가 안 풀림) → `autoPullIfNewer({ force })`로 충돌 경로만 우회. ④ push 실패 시 플래그가 안 풀려 pull이 무기한 차단 → `userEditAtRef` 타임스탬프로 보류에 10초 상한. ⑤ `stock-tab` 마이그레이션의 `refreshData()`가 `saveSnapshotsBlockedRef`를 세워 **그 세션의 오늘자 스냅샷 저장을 통째로 스킵**시킴(해제는 `syncTodayStockPrices` 안에서만) → `saveData` 유지로 롤백(이 마이그레이션은 API 파생값이 아니라 실제 사용자 데이터를 정정하므로 전파가 옳다).
- **부수 수정**: 해제 이벤트를 `try/finally`로 감싸 `unlockAndLoad`가 throw해도 유실되지 않게 함. `applyImportedPayload`의 스냅샷 폴백을 `keepLocalSnapshots` 옵션으로 분기(pull=보존 / 파일 가져오기=교체 — 남의 백업에 내 이력만 남으면 자산과 이력이 뒤섞인다)하고 빈 배열이 폴백을 우회하던 것(`[]`은 truthy)을 `?.length` 판정으로 수정. `npm run lint`가 `.claude/hooks/*.mjs`(tsconfig project 밖) 때문에 `fb7af6e`부터 계속 실패하던 것 → eslint `ignores`에 `".claude/"` 추가.
- **테스트**: "그 외" 폐지의 핵심인 **잔차 흡수 분기가 19개 테스트에서 한 번도 실행되지 않던 것**을 발견해 케이스 추가(개별 9천원×2 → 합 1.8만원이 최대 원인에 흡수), 예측 경로의 표시 항목 합계 검증도 추가(종전엔 집계 필드만 봐서 자산군 분해를 우회).
- **문서 정정**: 폴링 주기가 문서 3곳에 30초로 적혀 있었으나 코드는 도입 이후 `60000` 불변 → 60초로 정정. S9·R13의 전제("pull이 `secretasset_sync`를 지운다")는 keepKeys에 `syncState`가 이미 포함돼 **성립하지 않음**을 명시(`runPushAfterRestoreFix`는 이중 방어로 유지). R14 제외 목록 보강, R22를 게이트 2종 공통 가드로 확장, R26(pull이 지우기만 하고 복원 안 하는 필드) 신설.

### 원인분해 "그 외" 범주 폐지 + 주식 시세 상시 노출 (issue-4.21)

- **왜**: 토요일 홈 헤더에서 주식이 분명히 올랐는데 `주식 시세 상승`이 안 보이고 금액이 통째로 `그 외 +608만원`으로 묻혔다. 순자산 변동의 원인은 **시세·환율·자산 유입/유출**뿐이므로 "그 외"라는 범주 자체가 있을 이유가 없다는 판단으로, 증상(휴장일 억제)과 범주(잔차) 양쪽을 함께 걷어냈다.
- **휴장일 억제 제거** ([asset-report.ts](../../src/lib/report/asset-report.ts)): 직접 원인은 `isClosedForBothMarkets`였다. 토요일은 국내·해외 증시가 닫혀 있지만 **미국 금요일장 종가가 토요일 새벽 KST에 새로 확정**되므로 주식 변동이 실재한다. `getDailyClosingRefDates("foreign")` 기준으로 해외 종가는 화~토, 국내는 평일에 갱신되니 **월~토는 매일 주식 변동이 있고 일요일만 없다** — 일요일은 금액이 표시 임계값 미만이라 자동으로 안 보이므로 억제 로직 자체가 불필요했다.
- **잔차의 정체를 대수적으로 제거**: `restCarry = costFx.cash − fxCash − inflow.unreflected` 두 조각이 전부였다. ① 환율효과의 주식 몫을 `stockFxShare`(현재 보유 비율)로 안분하던 근사를 버리고 **`fxEffect − costFx.cash`**(정확히 계산되는 현금 몫을 빼는 방식)로 정의 → 오차 0. ② 잔액을 움직이지 않는 미반영 소급 현금기록은 변동 원인이 아니므로 집계에서 제외(`reflectedCashInflow`) — 실제 잔액 증가는 `dCostCash`로 이미 `income`에 잡히므로 표시 금액은 그대로다(사실상 이중계상 후 잔차로 상쇄하던 구조를 정리). 남는 `priceResidual`(스냅샷 `netAsset`↔`breakdown` 불일치 시에만 비영)은 `income`에 흡수시켜 **표시 합계 = `deltaNet` 항등식을 정의상 보장**한다.
- **`AttributionCauseKey`에서 `rest` 삭제** — switch exhaustive 검사가 잔존 참조를 컴파일 에러로 잡아준다. 임계값(1만원) 미만이라 숨겨진 원인들의 합은 `getAttributionItems`가 **절대값 최대 원인에 얹어** 흡수한다("+0만원" 노이즈 항목을 만들지 않으면서 합계 유지).
- **시작점 선정 tie-break**: 월말 daily와 monthly는 `_date`가 같아 안정 정렬만으로는 monthly가 먼저 잡혔다 → 헤더가 "전일 대비" 대신 "지난 접속(7월) 이후"로 표기되고, monthly에 v2 필드가 없으면 예측 모드로 떨어져 자산군별 시세가 통합 `price`로 뭉쳤다. `byDateThenDaily`로 daily 우선.
- 테스트 19케이스 통과(휴장일 억제 3케이스 → 토요일 노출·주식/코인 동시 노출·"그 외" 라벨 부재·동일 날짜 daily 우선로 교체). **스키마·저장 키·공유 토큰·sync payload 무변경.**

## 2026-07-31

### 잠금화면 PIN을 자체 숫자패드로 전환 — 소프트 키보드 의존 제거 (issue-4.20)

- **왜**: iOS PWA에서 잠금화면 PIN 입력을 누르면 숫자패드가 열리려다 닫히는 현상이 반복됐다. 같은 날 먼저 시도한 수정(`focus()` 개입)은 **오진이었고 증상을 간헐 → 고정 발생으로 악화시켰다**. 기록으로 남기는 실패 경로:
  - 증상을 "자동 포커스가 미리 `activeElement`를 잡아 탭에 focus 전환이 없어 키패드가 아예 안 뜬다"로 진단하고, 터치 자동 포커스를 끄는 대신 `onPointerDown`에서 `blur()→focus()`로 전환을 강제하는 훅(`use-otp-focus.ts`)을 넣었다. **브라우저 기본 포커스 처리보다 먼저 `focus()`를 걸면** 키보드가 올라오며 레이아웃이 밀려 뒤이은 `click`이 36px 입력란 밖에 떨어지고 iOS가 blur시킨다. 이미 포커스된 분기의 `blur()→focus()`는 WKWebView가 같은 태스크의 dismiss를 우선해 역시 "열리려다 닫힘"이다. 함께 넣은 오버레이 `overflow-y-auto`는 `fixed inset-0`을 스크롤 컨테이너로 만들어 탭 도중 입력란을 이동시켜 이를 증폭했다.
- **왜 표적 수정 대신 의존 제거인가**: 포커스를 훔치는 주체를 정적 분석으로 특정하지 못했다. 후보(`CloudSyncConnectDialog`의 Radix focus trap — `#sync=` 해시 필요, `PwaConnectPrompt` — trap 없음, `page.tsx` 하위 자동 open 다이얼로그 — standalone 잠금 시 미마운트)가 모두 이 케이스를 설명하지 못했고, iOS PWA는 devtools가 없어 더 좁힐 수 없었다. **원인이 무엇이든 성립하지 않게** 만드는 쪽을 택했다.
- **자체 숫자패드** ([pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx)): `InputOTP`를 걷어내고 **포커스 가능한 입력 요소를 아예 두지 않는다**. 기존 `Button`(누름 `scale-[0.96]`·전환 내장) 3×4 그리드 + 4점 표시(`role="status"`), 물리 키보드는 `window` `keydown`(0~9·Backspace)으로 받아 자동 포커스가 필요 없다. 소프트 키보드를 호출하지 않으므로 포커스 강탈·present/dismiss 경합·포커스 줌이 구조적으로 불가능해지고, "키보드가 입력칸을 가린다"는 문제도 함께 사라져 오버레이 레이아웃을 원본(`justify-center`)으로 되돌렸다. 자동 제출은 `pin.length === 4`를 보는 별도 effect로 분리(상태 updater 안 검증은 StrictMode 이중 실행), `unlockAndLoad`는 비메모 context value에서 오므로 ref 경유.
- **롤백**: `use-otp-focus.ts` 삭제, 공유 복원 PIN([asset-data-context.tsx](../../src/contexts/asset-data-context.tsx))은 검증되지 않은 변경을 남기지 않도록 이전 상태로 복구. 설정·설치흐름·공유메뉴의 PIN 3곳은 사용자 제스처로 열리는 다이얼로그라 현행 `InputOTP` 유지 — 잠금화면과 입력 방식이 달라지지만 문제가 보고되지 않은 화면의 회귀 위험을 늘리지 않는 선택이다.

### 원인분해: 자산군별 시세·매수 분해 + 표시 레이어 단일화 (issue-4.20)

- **왜**: "시세 상승 +12만원"만으로는 주식인지 코인인지 부동산인지 알 수 없었고, 신규 투입은 `saving`("코인·부동산 등") 한 덩어리라 무엇을 샀는지 읽히지 않았다. `priceEffect`가 잔차 하나였기 때문인데, 스냅샷에 이미 `breakdown`(자산군별 평가액)·`cost`(자산군별 원가)가 박제돼 있어 **스키마 변경 없이** 쪼갤 수 있었다.
- **원인 키에 자산군 명시** ([asset-report.ts](../../src/lib/report/asset-report.ts)): `price:stock`/`price:crypto`/`price:realEstate`, `buy|sell:stock/crypto/realEstate`. 시세는 `Δbreakdown − Δcost`(주식은 평가손익의 환차익 제외), 신규투입은 `Δcost`로 산출한다. **`priceEffect`·`savingInvest` 총액은 건드리지 않고 그 안을 나누므로** 표시 합계 = `deltaNet` 항등식이 그대로 유지되고, 분해되지 않는 조각만 `rest`가 흡수한다. 거래내역 없는 주식 원가 변동(직접 수정·스크린샷 등록)은 방향별로 `buy:stock`/`sell:stock`에 합산해 같은 라벨이 두 줄로 갈라지지 않게 했고, 투자 3종으로 설명되지 않는 원가 증감(현금 잔액 직접 수정)은 성격이 같은 `income`에 합산했다(구 설계대로 `rest`에 넣으면 "그 외"에 묻힌다). 시작 스냅샷이 레거시인 예측 모드는 자산군별 평가액이 없어 시세만 통합 `price`로 남는다.
- **휴장일 억제를 주식으로 한정**: 종전엔 증시 휴장일 실시간 끝점에서 "시세" 전체를 "그 외"로 보냈는데, 코인은 24시간 거래·부동산은 직접 입력이라 **진짜 변동까지 묻히고 있었다** → `price:stock`에만 적용.
- **표시 레이어 단일화**: 성적표가 인라인으로 복제하던 잔차 계산(+하드코딩 `10000`)을 제거하고 홈과 함께 `getAttributionItems` 하나만 쓰게 했다(임계값이 갈려 두 화면 합계가 어긋나는 것을 구조적으로 차단). 소비처가 0이던 `CAUSE_LABELS`를 제거하고 `causeShortLabel`을 라벨 단일 출처로 삼아 `label`·`sentence`가 여기서 파생되게 했으며, 3중 복제돼 있던 날짜 포맷을 `formatAttributionDate`로 승격했다. 홈 헤더의 도달 불가 폴백 분기와, 어디서도 import되지 않던 `last-visit-briefing.tsx`(홈 Hero로 통합된 잔재)도 함께 제거.
- 회귀 테스트 4케이스 추가(자산군별 시세 분해, 코인·부동산 매수 분리, 직접 수정분 방향 합산, 휴장일 주식 한정 억제) + 표시 항목 합계 검증(`getAttributionItems`) 도입. **스키마·저장 키·공유 토큰·sync payload 무변경.**

## 2026-07-27

### 인증샷 → "자산 카드" 개편 — 명칭·색 체계·정보 구조·품질

- **왜**: 앱 밖으로 나가는 유일한 산출물인데 명칭이 "인증샷"(버튼·네비)/"인증용 스크린샷"(다이얼로그)으로 갈려 있었고, "인증"이 과시·KYC로 오독될 여지가 있었다. 핵심자산 8색이 포트폴리오 바(자산군 4색)와 매칭되지 않아 색이 정보가 아닌 장식이었고, `sm:` 뷰포트 반응형이 캡처 대상에 남아 PC/모바일에서 같은 사용자가 다른 이미지를 얻는 버그가 있었다.
- **명칭 통일**: 버튼·네비·다이얼로그·튜토리얼·공지 문구를 전부 "자산 카드"로 통일, `Camera` 아이콘을 `IdCard`로 교체(top-bar.tsx, bottom-nav.tsx, share-menu.tsx, welcome-guide.tsx, tutorial-step-config.ts, notice.tsx).
- **색 체계 재설계** ([theme.ts](../../src/config/theme.ts) `SHARE_SAFE_PALETTE`, [share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx)): 의미색(부채 빨강·임차보증금 주황)과 충돌하지 않는 안전 팔레트를 도입하고, 색 배정 주체를 "개별 종목"에서 "자산군"으로 뒤집었다 — 자산군에 먼저 색을 배정하고 개별 종목이 그 색을 상속해, 포트폴리오 바와 핵심 자산 목록 색점이 항상 1:1로 매칭된다. 상세 탭의 `assignColors`(부채 포함)는 변경하지 않음.
- **정보 구조·브랜딩**: `useNickname()`으로 카드에 닉네임 pill 추가(설정 시에만 노출), 브랜딩 헤더를 "{앱이름}로 관리중인 자산" 문장으로 전환, 푸터에 도메인(`secretasset.xyz`) 표기, 핵심 자산 목록을 2줄→1줄(색점·종목명·비중%·금액)로 압축(개별 수익률 제거 — hero에 총 수익률 이미 존재).
- **품질 버그 수정** (R25): 캡처 대상 DOM의 `sm:text-3xl`을 고정 `text-3xl`로 변경하고, 미리보기 축소는 [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx)의 `ScaledCardPreview`(CSS `transform: scale()`)로만 처리해 캡처는 항상 480px 기준. 빈 `DialogDescription` 채움, 캡처 실패 시 `console.error`뿐이던 것에 `toast.error` 추가.
- **후속 조정**: 브랜딩 헤더의 "{앱이름}로 관리중인 자산" 문장을 제거(닉네임 pill만 남김), 대신 푸터에 한글 브랜드명 "시크릿에셋"(`text-xs text-foreground`)을 도메인 옆에 추가. 순자산 텍스트 색을 기존 주황(`important`)에서 "포트폴리오 구성" 제목과 동일한 `text-foreground`로 변경 — 이 카드에 한정된 예외이며 앱 본편의 순자산=주황 규칙은 그대로 유지.
- **버튼 통합**: [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx)의 "복사"·"저장" 버튼을 "저장"(다운로드) 단일 버튼으로 통합 — 클립보드 복사는 브라우저·기기별 성공률이 낮고(특히 모바일 사파리), 다운로드가 가장 안정적인 경로라 핵심 동작 하나로 압축. `variant="brand"`로 CLAUDE.md 확인·제출 버튼 색 규칙 통일(기존 인라인 `MAIN_PALETTE` 스타일 제거).
- **UI 마감**: 다이얼로그 헤더가 모바일에서만 중앙 정렬되던 것(shadcn `DialogHeader` 기본값 `text-center sm:text-left`)을 호출부 `text-left`로 오버라이드해 전 뷰포트 좌측 정렬 통일(공용 `dialog.tsx`는 전 화면 공유라 미수정), 상하 여백도 `pt-4 pb-1`→`py-4`로 균등화. 카드 최상위에 따로 떠 있던 닉네임 pill은 순자산 hero의 라벨로 흡수해 **"@닉네임 순자산" 한 문구**로 전환 — 배지 배경·세로 패딩(`py-1`)이 사라져 아래 `text-3xl` 금액과의 간격이 회복되고, 소유자와 지표가 하나의 구로 읽힌다(닉네임 미설정 시 "순자산"만).
- **QA 발견 수정** (R25 보강): `captureImage`의 `pixelRatio` 계산이 `el.getBoundingClientRect().width`(=`ScaledCardPreview`의 CSS transform 영향을 받는 시각적 크기)를 기준으로 삼아, 레이아웃은 480px로 고정됐는데도 미리보기 축소 비율에 따라 기기마다 최종 PNG 해상도가 달랐다(모바일이 더 고해상도). `el.offsetWidth`(transform 무관 실제 레이아웃 폭) 기준으로 변경해 pixelRatio·최종 해상도가 기기와 무관하게 항상 동일해지도록 수정.

### 뒤로가기: 설정 화면 콜드스타트 홈 도달 불가 루프 수정 (R24)

- **`navigation-context.tsx`의 `back()`**: `settings`가 `history.length<=1`(딥링크·새 세션 진입)일 때 `"more"`로 폴백하던 것을 `"home"`으로 변경. `more`의 back()도 history 의존적(`history.back()`)이라, `settings`→`more`로 폴백한 뒤 다시 뒤로가기를 누르면 방금 만든 push를 되감아 **원래의 설정 화면으로 돌아오는 루프**가 발생했다(더보기 화면의 뒤로가기 라벨은 "홈"인데 실제 동작은 설정으로 회귀 — 라벨-동작 불일치). `tax`는 이미 홈 직행이라 문제없었음. 정상 진입(홈→더보기→설정)은 `history.length>1`이라 기존처럼 `history.back()`으로 더보기 복귀, 영향 없음.

### 세금 신고 안내 — 보유 자산 기반 월별 세금 캘린더 (issue-4.20)

- **왜**: 앱이 순자산·수익률은 보여주면서 "그 자산을 가졌기 때문에 생기는 납세 의무"는 전혀 안내하지 않았다. 상가는 1·7월 부가세와 5월 종소세, 부동산은 6/1 과세기준일과 7·9월 재산세, 해외주식은 이듬해 5월 양도세가 각각 다른 기한으로 돌아오는데 이미 입력된 자산 구성만으로 특정할 수 있는 정보가 놀고 있었다. 명세 [S-4.23](../specs/4.23-tax-calendar.md).
- **세금 일정 정적 데이터** ([tax-calendar.ts](../../src/config/tax-calendar.ts)): 부가세(확정·예정고지)·종소세(확정·중간예납)·재산세·종부세·양도세·연말정산·건강보험료 정산·연금 납입마감 등 21건을 `TaxEvent`(월·기한·대상·요약·상세·태그·severity)로 정의. 외부 API 없이 상수만 쓴다.
- **개인화** ([tax-utils.ts](../../src/lib/tax-utils.ts)): `resolveTaxTags`가 보유 자산 → 세금 태그 + 근거 문구를 산출(상가 = `realEstate.type==="commercial"`). `computeForeignRealizedGain`은 거래 로그를 replay(`trade-utils.computeNewPosition` 재사용)해 당해 해외주식 실현손익을 KRW로 통산하고 **기본공제 250만원 초과 시 이듬해 5월 양도세 신고 대상**임을 알린다. 매수 로그·체결 환율이 없으면 현재 평단·환율로 폴백하고 "추정"으로 표기.
- **홈 배너** ([tax-notice-box.tsx](../../src/app/(main)/_components/views/home/tax-notice-box.tsx)): 자산 분포 카드 아래. **내 자산에서 파생된 항목만** 띄운다 — 연말정산·건강보험료 같은 전 국민 공통(`common`) 항목은 자산과 무관하므로 홈에서 제외하고 캘린더에서만 본다. 해당 항목이 0건이면 배너 자체가 렌더되지 않는다. 닫으면 **그 달 동안** 미노출(`STORAGE_KEYS.taxNotice` = `{dismissedMonth}`), 달이 바뀌면 재노출 — 5월 종소세·7월 부가세처럼 큰 일정을 영구히 놓치지 않게 하려는 의도. 백업 복원·동기화 pull이 닫기 상태를 지우지 않도록 `asset-storage.ts` keepKeys에 보존.
- **세금 캘린더 뷰** ([tax-calendar-view.tsx](../../src/app/(main)/_components/views/tax/tax-calendar-view.tsx), `#tax`): 12개월 세로 리스트 + `내 세금`/`전체` 필터 + 현재 월 자동 스크롤 + 하단 면책 고정. **하단탭은 늘리지 않고** `settings`와 동일한 더보기 하위 페이지 패턴을 복제(진입: 더보기 > 지원 > 세금 일정, 홈 배너 "전체 보기"). 뒤로가기는 `history.back()`이라 진입 경로로 복귀. shadcn `Calendar`는 날짜 선택기라 쓰지 않고 일정 목록으로 구성.
- 회귀 테스트 21케이스 추가([tax-utils.test.ts](../../src/lib/__tests__/tax-utils.test.ts)) · 스키마·공유 토큰·sync payload 무변경.

## 2026-07-26

### 원인분해: 카테고리 순서 정렬 + "대출" 용어 통일 (issue-4.19)

- **원인 표시 순서를 카테고리 고정 순서로 통일** ([asset-report.ts](../../src/lib/report/asset-report.ts) 신규 `CAUSE_ORDER`·`getOrderedCauses`): 기존엔 절대값 크기순(topCauses 1~2개 + restCauses)으로만 나열돼, 주식 매수·매도처럼 연관된 원인이 부채·저축 등에 밀려 뚝뚝 떨어져 표시됐다(예: 시세하락→신규매수→부채증가→새로 추가한 자산→매도 회수). → 시세·환율(시장) → 주식 매수·매도(거래) → 주식 외 자산 추가 → 소득 → 대출 → 그 외 순서로 항상 나란히 정렬. `pickTopCauses`의 선정(1~2개 강조·임계값 필터링) 로직과 `topCauses[0]`(지난 접속 브리핑의 한 줄 요약이 쓰는 "가장 큰 원인")은 그대로 두고, **나열 순서만** 바꿨다. `formatAttributionSentence`·`getAttributionItems`·[asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)의 원인 리스트가 모두 `getOrderedCauses`를 공유.
- **"부채" → "대출" 용어 통일**: `debtEffect`는 실제로 대출 잔액 증감만 반영(임차보증금 제외)해 "부채"보다 "대출"이 정확. `saving`의 "새로 추가한 자산"과 짝을 이루도록 `debt` 문구도 "새로 추가한 대출로 ~ 줄었어요" / "대출 상환으로 ~ 늘었어요" 구조로 통일(신규 유입 vs 신규 부채가 대칭 표현). 회귀 테스트 1건 추가(카테고리 순서 검증).

### 원인분해: "신규 매수" vs "새로 추가한 자산" 경계 명시 (issue-4.19)

- **buy/sell·saving 라벨에 "주식"/"주식 외" 명시** ([asset-report.ts](../../src/lib/report/asset-report.ts) `causeSentence`·`causeShortLabel`·`CAUSE_LABELS`): "신규 매수"(거래내역 반영분)와 "새로 추가한 자산(저축·코인·부동산 등)"이 둘 다 "새 투입"으로 읽혀 경계가 불명확했다 → `buy`="주식 신규 매수", `sell`="주식 매도 회수", `saving`="주식 외 새로 추가한 자산"(축약 "코인·부동산 등"/"주식 외 회수·인출")로 스코프를 라벨에서 바로 드러냄. [asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)의 InfoHint 설명 문구도 동일 용어로 정리.

### 원인분해: 실시간 끝점의 휴장일 quote 노이즈를 "시세" 원인에서 제외 (issue-4.19)

- **휴장일(국내·해외 모두) + 실시간 끝점일 때 "시세" 원인을 "그 외"로 대체** ([asset-report.ts](../../src/lib/report/asset-report.ts) `isClosedForBothMarkets`·`resolveAttribution`): slot 고정 수정 후에도, 실시간 quote(`currentPrice`)와 정산 종가(`refPrice`, 스냅샷 기준)가 애초에 다른 KIS API 소스라 휴장 중 재조회 시에도 몇 만원~몇 백만원 차이가 남을 수 있음을 확인(헤더 "전일 대비"에 실제 시장 움직임 없는 +366만원 "시세 상승" 노출). 순자산 총액(Hero) 자체는 정확하므로 건드리지 않고, **원인 귀속 라벨만** 휴장일 실시간 비교(`buildLiveAttributionCurr`, 신규 `_isLive` 마킹)일 때 "시세"→"그 외"로 바꿔 오귀속을 막는다. 과거 구간 비교(1주/1개월/3개월 등, `computePeriodAttribution`)는 스냅샷 간 비교라 항상 refPrice 기준이므로 영향 없음. 표시 합계=deltaNet 항등식 유지. 회귀 테스트 2케이스 추가.

### 휴장일 주식 캐시 slot 고정 — 재조회로 인한 원인분해 허위 "시세 변동" 제거 (issue-4.19)

- **`getStockCacheSlot` 수정** ([stock-cache-slot.ts](../../src/lib/stock-cache-slot.ts)): 휴장일(주말·공휴일)에도 slot이 `effectiveDate`(달력 날짜) 그대로라 매일 바뀌어, `syncTodayStockPrices`가 휴장 중에도 매일 실시간 시세를 재조회했다 — 실측 종가(스냅샷의 `refPrice`)는 안 바뀌었는데 실시간 quote만 미세하게 흔들려(KIS 리얼타임 vs 정산 종가 소스가 다름) 원인분해가 이를 "시세 상승"으로 오인(예: 일요일 헤더에 실제로는 없던 +366만원 시세 변동 표시). → 휴장일 판정을 시간대와 무관하게 최우선으로 옮기고, 휴장이면 `rollbackToBusinessDay`/`rollbackToUsBusinessDay`(기존 유틸, [kr-holidays.ts](../../src/lib/kr-holidays.ts)·[us-holidays.ts](../../src/lib/us-holidays.ts))로 **직전 영업일 slot에 고정** — 주말 내내 같은 slot이라 재조회가 발생하지 않는다. 영업일 로직은 변경 없음. 프로덕션(Upstash, TTL 1시간)은 slot 값과 무관해 영향 없음. 회귀 테스트 3케이스 추가.

### 원인분해: 예측 모드 신규 매수 누락 수정 + saving 문구 중복 정리 (issue-4.19)

- **`saving` 원인 문구에서 "신규 매수" 제거** ([asset-report.ts](../../src/lib/report/asset-report.ts) `causeSentence`·`causeShortLabel`): 매수/매도가 별도 `buy`/`sell` 원인으로 분리된 이후에도 `saving` 문구가 `(저축·신규 매수)`라 "신규 매수" 항목과 중복돼 보였다 → `(저축·코인·부동산 등)`, 축약 `저축·매수`→`저축·기타`. `saving`은 실제로 코인·부동산 매수·직접입력 잔여만 담는다.


- **예측(estimated) 모드가 기간 내 추가 매수를 놓치던 버그 수정** ([asset-report.ts](../../src/lib/report/asset-report.ts) `estimatePeriodInflows`·estimated 분기): 매수 반영 시 `stock.purchaseDate`는 갱신되지 않아(원매수일 유지), 예측 모드가 `purchaseDate`로만 신규투입을 추정하던 탓에 **기존 보유 종목에 기간 내 추가 매수한 물량이 통째로 누락**돼 시세 잔차로 흡수됐다(예: "순자산 변화, 왜?" 1개월에 테슬라 07-20 매수 미노출, 시세 하락폭 축소). → 예측 모드에도 `reflectedTradeFlow`로 `buy`/`sell`을 계산해 노출하고, 이중계산 방지로 `estimatePeriodInflows`는 **기간 내 반영 거래가 있는 종목을 건너뛴다**(권위=거래내역). 정밀 모드는 종전대로. 합계 = `deltaNet` 항등식 유지, 회귀 테스트 추가.

### 원인분해: 외화 원가 환율 재평가 누출 수정 + 만원 미만 변동 표기 정합 (issue-4.19)

- **외화 원가 환율 재평가 누출 수정** ([asset-report.ts](../../src/lib/report/asset-report.ts) `costFxRevaluation`): `cost.total`이 현재 환율로 환산한 원가(주식 `getMultiplier`·현금 `cashValue`)를 담아, 환율만 움직여도 `savingFull`이 외화 원가 재평가분을 흡수 → `savingEffect`에 `+(외화 원가×Δfx)`, `priceEffect`에 `−(외화 원가×Δfx)`가 허위로 갈렸다(합계 `deltaNet`은 불변). enriched 분기에서 원가 재평가분을 `savingFull`에서 제외(`savingFullReal`)해 **환율 변동일에도 저축·시세가 0, 환차익은 fx로만 귀속**. 평가액 기준 `fxEffect`가 환차익을 이미 담당하므로 이중 귀속 제거. 예측 경로는 매수일 기반이라 누출 없어 무변경.
- **만원 미만 변동 표기 정합** ([dashboard.tsx](../../src/app/(main)/_components/views/home/dashboard.tsx) `useHeaderNetChange`): hero는 원 단위(`+484원`), 원인 리스트는 만원 반올림(`+0만원`)이라 미세 변동 시 "시세 상승 +0만원"처럼 방향어+0이 깨져 보였다 → `|deltaNet| < CAUSE_DISPLAY_MIN`이면 금액·원인 대신 "`{label} 변동 없음`"으로 통일 표시(`negligible` 플래그).
- **회귀 테스트 3케이스 추가**: 외화 원가 fx-중립화, 환율+시세 동시 분리, 환율 동결 시 암호화폐 소폭 상승 → 시세 귀속.

### 원인분해에 매수·매도 분리 + 소급 입금 인식 · FAB 현금 입출금 진입 (issue-4.19)

- **`buy`/`sell` cause 신설** ([asset-report.ts](../../src/lib/report/asset-report.ts) `reflectedTradeFlow`): 원인분해가 `assetData.transactions`를 전혀 읽지 않아 신규 매수·매도가 `Δcost.total` 안에서 상계돼 보이지 않았다 → 기간 내 **반영된 주식 거래 체결액**(체결 환율 우선)을 `saving`에서 떼어내 "신규 매수"·"매도 회수"로 분리. `buy + sell + saving = 종전 savingEffect` 항등식이라 **표시 합계 = deltaNet 불변**. 예측(estimated) 경로는 `estimatePeriodInflows`가 매수일 기반이라 이중계산이 되므로 분리하지 않는다. 거래내역 스키마가 주식 전용이라 코인·부동산 매수는 종전대로 `saving`.
- **미반영(과거 소급) 현금 입출금도 `income`으로 인식** (`cashInflow`): 소급 기록은 잔액을 건드리지 않아 `cost.total`엔 없지만 그 입금은 **이미 잔액에 녹아 있어** `deltaNet`엔 있다 → 반영분은 종전대로 `saving`에서, **미반영분은 `price` 잔차에서** 차감. 소급 입력만으로도 소득이 "시세 상승"으로 오인되지 않는다. 미반영을 `saving`에서 빼면 `saving`이 음수로 왜곡되므로 두 값을 나눠 처리한다.
- **자동 테스트 신설** ([asset-report.test.ts](../../src/lib/report/__tests__/asset-report.test.ts)): 정밀·예측 두 경로의 합계 항등식, 미반영 income, buy/sell 분리, 체결 환율 환산 7케이스. 원인분해에 자동 테스트가 없어 회귀 감지가 불가능하던 상태를 해소.
- **FAB에 현금 "입출금 기록" 추가** ([floating-add-button.tsx](../../src/app/(main)/_components/layout/floating/floating-add-button.tsx)): 현금 입출금 진입점이 현금 상세 탭 안에만 있어 주식 "거래 입력"과 접근성이 달랐다 → `select-action` 스텝에 **같은 레벨**로 배치(`dispatchAddCashTx`, 계좌는 폼에서 선택). 스크린샷 일괄 가져오기는 S-4.22 제외 범위라 `select-method`를 거치지 않는다.
- **성적표 원인분해 InfoHint 갱신**: "4가지 원인"으로 고정돼 있어 `income`·`buy`/`sell`이 문구에서 누락돼 있었다 → 원인 목록과 각 원인의 출처(주식 거래내역 / 현금 입출금 내역)를 명시.

<!-- 2026-07-25 항목은 "최근 10개 유지" 정책에 따라 제거됨 (현금 입출금 거래내역 신설(S-4.22)·암호화폐 종합 뷰·amber 구분선 표준화·X-Ray 정합) -->
<!-- 2026-07-24 항목은 "최근 10개 유지" 정책에 따라 제거됨 (성적표 모바일 반응형 표 붕괴 수정·동기화 변경 감지 누락 수정(ASSET_USER_EDIT_EVENT)·공유 토큰 부동산 검색 키 추가) -->
<!-- 2026-07-22 항목은 "최근 10개 유지" 정책에 따라 제거됨 (부동산 실거래 추정 정확도 개선(면적 데이터셋별 필드·오매칭 방지·상대오차 매칭)·공지 4.18 개편·레버리지 수익기간 통일·원인분해 restCauses 도입·성적표 대주제 섹션 도입·부동산 오매칭 P1 수정) -->
<!-- 2026-07-20 항목은 "최근 10개 유지" 정책에 따라 제거됨 (업비트 코인 시세 자동 갱신 — 1시간 슬롯 캐싱, S-4.20) -->
<!-- 2026-07-11 항목은 "최근 10개 유지" 정책에 따라 제거됨 (인앱 브라우저 하드 게이트 신설·동기화 baseDate/name 변경감지 제외로 핑퐁 방지) -->
<!-- 2026-06-30 항목은 "최근 10개 유지" 정책에 따라 제거됨 (기기 동기화 pull 후 initAndSync 전체 시세 동기화, R21·닉네임 커밋 시점 탭 이탈로 변경) -->
<!-- 2026-06-25 항목은 "최근 10개 유지" 정책에 따라 제거됨 (SVG 가이드 애니메이션 공용 플레이어화·복원 코드 개명·공지 수동 진입 통합) -->
<!-- 2026-06-22 항목은 "최근 10개 유지" 정책에 따라 제거됨 (PWA 설치 가이드 단일화(Android 확장)·행위 prefix 통일·UI 디테일 폴리시 일괄 적용) -->
<!-- 2026-06-20 (2) 항목은 "최근 10개 유지" 정책에 따라 제거됨 (기기 동기화 명칭 통일("기기 동기화 Plus")·앱 잠금 웹 확장·공지 컴포넌트화) -->
<!-- 2026-06-20 항목은 "최근 10개 유지" 정책에 따라 제거됨 (PWA 설치 흐름 공용 컴포넌트 추출·웰컴가이드 모바일 PWA-우선 레이아웃·iOS 가이드 SVG 실사화) -->
<!-- 2026-06-14 항목은 "최근 10개 유지" 정책에 따라 제거됨 (PWA iOS/인앱 브라우저 설치 플로우 개선·Plus 구독 모델 용어 표준화(VaultEnvelope→AssetEnvelope 등 assetId 리네임)) -->
<!-- 2026-06-11 항목은 "최근 10개 유지" 정책에 따라 제거됨 (주식 스샷 공통/개별 적용 옵션·의견·요청 보내기(Slack 웹훅) 신설) -->
<!-- 2026-06-09 항목은 "최근 10개 유지" 정책에 따라 제거됨 (공유 URL 테마 모드 동기화·스크린샷 가져오기 UI 정돈) -->
<!-- 2026-06-07 항목은 "최근 10개 유지" 정책에 따라 제거됨 (보더리스 UI 전면 적용 — 입력 필드·버튼·카드) -->
<!-- 2026-06-05 항목은 "최근 10개 유지" 정책에 따라 제거됨 (일별 수익 휴장 폴백 캐시 매핑·"휴장제외" 표시·인증샷 종목 리스트·비종목 카드 정리·날짜 input 모바일 넘침 전역 차단) -->
<!-- 2026-05-23 항목은 "최근 10개 유지" 정책에 따라 제거됨 (UI 정보구조 전면 재설계 — drill-down 라우팅 + 통일 디자인 시스템, 환율 히스토리 7일 확장) -->

