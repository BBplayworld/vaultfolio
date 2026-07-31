# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

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

## 2026-07-25

### 현금 입출금 거래내역 — 소득·저축 유입 원인분해 + 습관 축 결합 (issue-4.19 · S-4.22)

- **현금 입출금 로그 신설** ([transaction.ts](../../src/types/transaction.ts) `cashTransactionSchema`, [asset.ts](../../src/types/asset.ts) `cashTransactions` 최상위 배열): 현금 자산에 입금/출금 이력이 없어 월급·목돈 유입을 분석에 못 썼다 → 주식 `transactions` 패턴 답습(잔액 선형 가감이라 가중평균 불필요). 입금에 **정기/비정기** 구분, `reflected` ON이면 `cash[].balance` 자동 가감(과거 소급은 로그만). `cash[].balance`는 진실원본 유지 → 요약·스냅샷 계산 무변경.
- **CRUD 단일 저장** ([asset-data-context.tsx](../../src/contexts/asset-data-context.tsx) `addCashTransactionWithBalance`/`deleteCashTransactionWithBalance`): 로그+잔액을 한 번에 저장(stale-closure 방지, 주식 대칭). 신규 [cash-tx-utils.ts](../../src/lib/cash-tx-utils.ts)(`pruneCashTransactions` 3년·`findDuplicateCashTx`·`reflectedBalanceDelta`·`isCashWithdrawalValid` 출금초과 가드).
- **입력 폼·로그 뷰·진입점**: [cash-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/cash-tx-input.tsx)(입금/출금·정기 토글·반영·출금 가드·중복 확인), [cash-tx-view.tsx](../../src/app/(main)/_components/views/detail/cash-tx/cash-tx-view.tsx)(총입금·출금·순유입 통계·기간/유형 필터·반영 삭제 시 잔액 역가감), 신규 탭 `cash-transactions`([navigation-context](../../src/app/(main)/_components/layout/navigation/navigation-context.tsx)·[asset-page-tabs](../../src/app/(main)/_components/layout/navigation/asset-page-tabs.tsx)), [cash-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/cash-tab.tsx) 카드에 "입출금 기록·내역" 버튼, [cash-tx-view-store.ts](../../src/stores/cash-tx-view-store.ts).
- **원인분해 `income` cause 분리** ([asset-report.ts](../../src/lib/report/asset-report.ts)): 기존 `saving`(현금 유입+투자 매수 혼합)에서 **기간 내 반영된 현금 순유입**(입금−출금, KRW 환산)을 `income`("소득·저축 유입")으로 떼어냄. `saving`은 투자자산 신규 매수만 남고, `priceEffect`는 계속 잔차 → **표시 합계 = deltaNet 불변**. 홈 헤더·지난 접속 브리핑·성적표 원인분해에 자동 반영(파이프라인은 key 추가만으로 흐름).
- **성적표 습관 축 저축 규칙성 + 딥링크** ([asset-grade.ts](../../src/lib/report/asset-grade.ts)): habit ②'꾸준함'을 순자산 상승개월과 **현금 입금 관측 개월(최근 6개월)** 중 높은 쪽으로 채점(저축을 시세상승과 분리해 직접 측정). 가중치 0.1·재정규화·티어 불변. habit 카드에 현금 상세 딥링크 추가.
- **공유 토큰**([asset-storage.ts](../../src/lib/asset-storage.ts) packV7 `parts[12]`): 현금 거래를 `caIdx`로 부모 계좌 참조해 직렬화(꼬리 추가 → 구버전 하위호환, R3). `getComparablePayloadString`엔 `restAssetData`로 자연 포함(사용자 편집 push, R14 핑퐁 없음). 명세 [S-4.22](../specs/4.22-cash-transactions.md).

### v4.19 UI 마감 — 암호화폐 종합 뷰·amber 구분선 표준화·X-Ray 정합·홈 도넛 중복 제거 (issue-4.19)

- **암호화폐 상세 "종합" 뷰 추가** ([crypto-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/crypto-tab.tsx)): 거래소 분할 코인은 종합 그리드가 `!hasSubItems`에 묶여 사라져 주식과 형태가 달랐다 → 병합 대표(`mergeCryptoGroup`) 기준 헤더행(코인명·심볼·총 N개) + 종합 그리드를 **항상 노출**하고 하단에 거래소별 항목을 잇는 주식 동일 구조로 통일.
- **주식 이름 최대 2줄** ([stock-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/stock-tab.tsx)): 모바일 `truncateName` 15자 하드컷 제거 → `line-clamp-2`로 전체 노출하되 2줄 초과분만 말줄임(모바일·PC 공통 단일 span).
- **amber 강조 구분선 표준화** ([theme.ts](../../src/config/theme.ts) `ASSET_THEME.dividerAccent`, [design-system.md](design-system.md) §3.3·§11): 성적표에 임시 인라인으로 넣은 amber 구분선(`border-amber-400/25`, 별점 톤)을 **공식 토큰**으로 승격하고 문서에 "구분선 2종"(중립 헤어라인=일반 분리 / amber accent=논리 그룹·섹션 경계) 규약 명문화. 성적표 레버리지 근거 7행을 **3단 논리 그룹**(입력값/수익 배분/최종)으로 amber 경계 구분, 성과 수익 국내/해외/IRP 섹션에도 동일 적용.
- **성적표 투입 대비 성과 text-sm 통일**: 라벨·헤더·설명·등락률의 `text-xs`를 `text-sm`으로(design-system §2 인지성 규약, 뱃지 예외 유지).
- **X-Ray 정합·프롬프트 범위 구분** ([stock-xray-view.tsx](../../src/app/(main)/_components/views/detail/xray/stock-xray-view.tsx)): AI 프롬프트가 더보기→자산 성적표로 이관돼 스테일이 된 "전체 자산 종합 진단 → 더보기" 백링크(`goFullDiagnosis`) 제거, "보유 주식만 대상" 범위 설명 추가. 두 프롬프트는 **분리 유지 + 명칭으로 범위 구분**(성적표="전체 자산 AI 평가 프롬프트" / X-Ray="주식 X-Ray AI 프롬프트"). 허브 성적표 카드 설명에 AI 진단 힌트로 진입성 보강.
- **홈 도넛 헤더 중복 제거** ([dashboard.tsx](../../src/app/(main)/_components/views/home/dashboard.tsx)): 개별 자산(금융/부동산/부채) 선택 시 헤더 우측 상세가 바로 아래 `SectionBar` 범례와 동일 데이터를 이중 노출 → 헤더 우측 제거, 좌측 총액 `w-full`. 상세는 비중바 범례에만 유지.
- **일별 달력 하단 문구 분리** ([net-asset-chart.tsx](../../src/app/(main)/_components/views/activity/net-asset-chart.tsx)): "총 N일 기록됨"이 미래 날짜 짧은 셀 아래 떠 보여, 중립 헤어라인+여백으로 그리드와 분리(실제 겹침은 없었음).
- **보조 설명 간결성 규약** ([design-system.md](design-system.md) §11): 카드·허브·섹션 보조 설명은 짧은 명사구 한 줄, 문장형 장문은 `InfoHint`로 내리도록 [필수] 명문화(hub·신규 페이지 공통).
- **QA에 KB 최신화 단계 추가** ([qa-full-test SKILL·plan](qa-full-test-plan.md) Phase 4): 전체 테스트 마무리에 문서-코드 드리프트 점검·KB 갱신 단계 상설화.

---

## 2026-07-24

### 자산 성적표 모바일 반응형 + 동기화 변경 감지 누락 수정 (issue-4.19)

- **성적표 3기준 표 붕괴 수정** ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)): `grid-cols-[1fr_auto_auto_auto]`에서 값 3열이 `auto`라 모바일에서 `1fr` 라벨 열이 0으로 붕괴, "부동산·주식·코인·현금"이 **한 글자씩 세로로** 깨졌다(`min-w-[280px]`가 자연 폭 440px보다 작아 `overflow-x-auto`도 무력). → 행 배열(`perfRows`) 하나를 두 레이아웃이 공유하게 하고 **모바일은 기준별 세로 스택, `sm+`만 표**(min-w 440px). 한글 라벨·캡션에 `break-keep` 적용, `SpecRow`는 `flex-wrap`으로 값이 다음 줄 우측으로 내려가게.
- **대출 행 어포던스 소실 수정**: 이름·이율·뱃지를 감싼 래퍼 전체에 `truncate`가 걸려 **`부동산 연결`·`비교 제외` 뱃지가 말줄임에 먹혀 사라졌다**(바로 위 캡션은 "연계 부동산을 지정하세요"라고 안내 중) → 말줄임은 이름에만, 뱃지는 `shrink-0` + `flex-wrap`으로 둘째 줄에 내려가게.
- **동기화 변경 감지 누락 수정** ([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx), [asset-data-context.tsx](../../src/contexts/asset-data-context.tsx)): 부동산 실거래가를 다시 조회해 저장하면 바뀌는 필드가 `marketEstimate*`뿐인데 이 필드들이 **핑퐁 방지용 비교 제외 목록에 있어 push가 아예 안 됐다**. 또 디바운스(2.5s) 중 폴링 pull이 끼어들면 effect cleanup이 타이머를 지우고 조기 return해 **사용자 편집 push가 조용히 취소**됐다. → `saveData`(자산 CRUD 전용 경로) 성공 시 **`ASSET_USER_EDIT_EVENT`** 발행, 수신 측은 파생값 비교와 pull 직후 skip을 **모두 우회해 push**. 자동 갱신은 `saveAssetData`를 직접 호출하므로 이벤트가 없어 핑퐁 방지는 그대로 유지된다.
- **공유 토큰에 부동산 검색 키 추가** ([asset-storage.ts](../../src/lib/asset-storage.ts) `packV7`/`unpackV7`): 부동산을 8필드만 실어 `regionCode`·`legalDong`·`complexName`·`addressDetail`·`exclusiveArea`·`areaUnitPreference`가 전부 유실됐다 — PWA 설치는 공유 URL로 이관하므로 **PWA로 넘어가면 실거래가 연동이 통째로 날아갔다**. 섹션 끝에 6필드 추가(꼬리 추가라 양방향 하위호환, `row()`가 빈 값을 pop해 미설정 물건은 길이 증가 없음). `marketEstimate*`는 파생값이라 계속 미포함 — 이관 후 자동 갱신이 다시 채운다. JSON 내보내기(`buildExportPayload`)는 원래부터 전 필드 포함이라 변경 없음.
- **상세 카드에 상세주소 표시** ([real-estate-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/real-estate-tab.tsx)): 펼침 하단에 `address`만 `truncate` 한 줄로 나와 **동·호수(`addressDetail`)는 어디에도 안 보이고 긴 주소는 잘렸다** → 신규 [real-estate-address.ts](../../src/lib/real-estate-address.ts)(`getAddressDetail`/`formatFullAddress`, 구 `dongName`·`hoName` 병합 정본)로 통일하고 줄바꿈 허용. 폼 기본값의 인라인 병합식도 같은 유틸로 교체.
- **실투자금 '남긴 돈' 이자 차감(ROE 표준)** ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)): 실투자금 행의 남긴 돈이 전체 평가손익(`summary.totalProfit`)을 그대로 쓰고 이자는 `—`(미부과)라, 레버리지 upside는 누리면서 financing 비용은 반영 안 해 수익률이 과대 표시됐고 바로 위 '모든 자산' 행(이자 차감)과도 불일치했다 → 남긴 돈 = `allNet`(평가손익 − 전체이자)로 통일(모든 자산과 동일 분자), 수익률만 분모를 실투자금으로(`equityNetRate`). 이자 열도 실제 값 표기. 레버리지 수익은 분자에 그대로 포함. 등급은 `equityReturnRate` 미사용이라 불변. InfoHint 문구도 "평가손익에서 연간 이자를 뺀 값" 으로 갱신.

---

## 2026-07-22

### 부동산 실거래 추정 정확도 개선 + 홈·주식·인증샷 UI 정리 (issue-4.18)

- **오매칭 근본 원인 3종 제거** ([realestate-service.ts](../../src/lib/realestate-service.ts)): ① `parseTradesXml`이 아파트 태그(`excluUseAr`·`aptNm`)만 읽어 **단독(sh)·비주거용(nrg)은 전 거래 면적이 0**이었다 → 데이터셋별 필드 테이블(sh=`totalFloorAr`, nrg=`buildingAr`, 폴백 `plottageAr`)과 `areaKind`(전용/연면적/대지) 도입. ② 면적이 0이면 면적 필터가 통째로 스킵되고 `matchBy:"area"`는 단지명 필터도 없어 **시군구 전체 최근 거래 1건**이 그대로 추정치가 됐다 → 면적 미상이면 추정 자체를 금지하는 하드 가드. ③ 면적 종류가 다른 거래를 섞어 비교하지 않으며, 후보 0건이어도 전체 풀로 되돌리지 않는다(이 완화가 곧 오매칭).
- **매칭 재작성**: 절대 ±3㎡ → **상대 ±10%(최소 ±3㎡)**(대형 상가에서 절대치는 무의미). 점수 = 지번일치 > 단지명 > 법정동 > 면적 근접 > 최근성이며, 카카오가 이미 주는 **`jibun`을 estimate에 전달**(기존엔 해석만 하고 버려 가장 큰 정확도 손실). 1단계 실패 시 같은 법정동·같은 면적종류·±30% 표본의 **㎡당 단가 중앙값 × 내 면적**으로 폴백하되 **표본 3건 미만이면 미노출**. 결과는 등급(`exact`/`similar`/`approx`/`estimated`)·표본수와 함께 반환. 조회 창은 6→12→24개월 단계 확장(상가·단독은 거래 희소, 캐시 슬롯 재사용).
- **면적 직접 입력(㎡/평 토글)** ([real-estate-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/real-estate-input.tsx)): 기존엔 조회 성공 시에만 면적이 세팅돼 상가·단독은 영원히 매칭 불가한 순환이었다. 저장은 항상 ㎡, 토글 상태만 `areaUnitPreference`로 보존(왕복 변환 오차 방지를 위해 입력값은 로컬 상태로 유지). 라벨은 종류별(전용면적/연면적/건물면적).
- **아파트 면적 미노출 해소** ([asset-data-context.tsx](../../src/contexts/asset-data-context.tsx)): 자동 갱신이 매칭 면적을 어디에도 저장하지 않아 상세 근거 줄이 비어 있었다 → `marketEstimateArea`(사용자 입력과 분리) 저장 + 기존 물건도 다음 접속에 채워지도록 갱신 조건 확장. 신규 `marketEstimate*` 필드는 전부 sync 변경감지 제외(R14).
- **UI 정리**: 홈 헤더 원인 문구를 기본 접힘(토글)으로 돌리고 `animate-pulse` 제거 / 주식 개별 카드의 '오늘' 칩을 우측 3줄 → 좌측 메타 줄로 이동 / 인증샷 `text-[11px]` → `text-sm` 승격 + 보유 비중을 좌측(이름 아래)으로 이동.
- **공지 4.18 개편** ([notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx), `NOTICE_ID` `20260624`→**`20260722`**): 6월 릴리스 기준의 PWA 설치·기기 동기화 2카드(+SVG 애니메이션 2종)를 **이번 릴리스 기능 4카드**(자산 성적표·암호화폐 시세 자동 갱신·부동산 실거래가 추정·인증샷 개편)로 전면 교체. 카드 정의를 `FEATURES` 배열로 데이터화해 마크업 반복 제거, 브라우저 분기가 사라져 `usePWAInstall`·`detectBrowserEnv`·state 없는 **정적 컴포넌트**가 됨. "자산 변동 노출 개선"은 5번째 카드 대신 하단 1문단으로 흡수. `.env.local` `NEXT_PUBLIC_NOTICE.expiresAt` 2026-07-25→08-22 연장(운영 환경변수도 별도 연장 필요).
- **레버리지 수익 기간 불일치 수정** ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)): "레버리지 이자 vs 투자 수익"에서 이자는 연 환산(12개월)·주식은 TTM(12개월)인데 **배당만 `annualActual`(올해 실지급분, 연중이면 N/12)** 이라 레버리지 몫 수익이 구조적으로 과소계상됐다 → `annualTotal`(올해 실적+예상 12개월)로 교체. 같은 값이 `AssetGradeInputs.dividend`로도 흘러 배당수익률(`divYield`)이 연중 과소평가되던 문제도 함께 해소(필드명 `annualActual`→`annual`로 정정). 두 박스에 **`1년 기준` 뱃지 + 각 산출 근거 캡션**(이자=현재 잔액×금리·향후 1년 / 수익=주식 최근 1년+올해 배당) 추가 — 세 값의 창이 미묘하게 달라 뱃지 하나로 뭉뚱그리지 않고 박스별로 명시.
- **원인분해 "그 외" 상세화** ([asset-report.ts](../../src/lib/report/asset-report.ts) `pickTopCauses`): 상위 1~2개만 이름을 갖고 나머지(환율·부채·저축)는 `restEffect` 단일 숫자로 뭉쳐 "그 외 −1,200만원"이 무엇인지 알 수 없었다 → **`restCauses`**(임계값 1만원 이상, 절대값 내림차순) 추가. 홈 헤더(`formatAttributionSentence`)·성적표 원인분해 모두 전 원인을 이름으로 펼치고, 임계값 미만 잔차만 "그 외"로 남긴다. **표시 금액 합계 = Δ순자산** 불변 조건은 잔차(`restEffect − Σ표시분`) 계산으로 유지.
- **백업 날짜 "(오늘)" 오표시 수정** ([backup-status.ts](../../src/lib/backup-status.ts) `formatLastBackup`): 오늘/어제 라벨을 `daysSinceBackup`(경과 24h 블록)으로 판단해, 어제 저녁 백업 후 오늘 아침(24h 미만)이면 "(오늘)"로 잘못 표기 → **KST 달력일 차이**로 판단하도록 교체(`daysSinceBackup`은 30일 stale 임계값용이라 그대로 유지).
- **인증샷 헤더 순서**: 대표 지표 행을 `총 수익률 → 수익금`에서 **`수익금 → 총 수익률`**로 스왑(금액을 먼저).
- **성적표 '넣은 돈' 혼선 완화**: 넣은 돈(총 투입원가)이 대출·보증금을 포함해 순자산보다 커 보이던 혼선 → **`그중 실투자금 N (부채 제외 내 돈)`** 캡션(`report.equity`)을 병기하고 InfoHint에 실투자금·순자산 관계 문단 추가.
- **레버리지 '들어오는 돈' 계산 투명화**: 레버리지 몫 수익 아래에 **`금융 수익 +N (+Y%) × 대출비율 42%`** 한 줄 추가 — 총 금융자산 1년 수익(`totalFinReturn`)과 그 수익률을 노출해 어떻게 그 금액이 나왔는지 직관적으로 보이게.
- **성적표 대주제 구분 + 넣은돈·레버리지 통합** ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)): 대주제 섹션이 같은 `BOX` 스타일로 뭉개져 구분이 약했다 → `SECTION`(bg-card+shadow-sm)로 띄우고 `SectionHeader`(아이콘 칩+굵은 제목)로 각 섹션 시작을 명시(투입 대비 성과 / 5축 측정 / 순자산 변화). 5축은 헤더 없이 카드만 흩어져 있던 것을 섹션으로 묶고 축 카드는 `bg-muted/30` 내부 톤으로 낮춤. **'넣은 돈 대비 성과'와 '레버리지 이자' 박스를 하나로 통합** — `모든 자산 / 실투자금 / 순수 레버리지` **3기준 × (넣은 돈·이자·번 돈) 비교 표**(컬럼 정렬 grid, `formatShortCurrency` 압축, 모바일 `overflow-x-auto`)로 재구성. 넣은돈=총원가·번돈=누적, 이자·레버리지 수익=연간임을 InfoHint·표 캡션에 명시. 순수 레버리지 결론(이자 내고 남는 돈)은 강조 줄, 계산 근거·대출 상세는 압축 접기로 유지. 미사용된 `BOX`·`hasLoans` 제거.
- **명세 행(`SpecRow`) 패턴 도입**: 좁은 타일에서 값+설명이 한 캡션에 섞여 모바일 줄바꿈이 지저분하던 문제 → 라벨(좌·text-pretty)·값(우·tabular-nums) 분리 헬퍼로 통일. 설명 문장은 `text-pretty`로 위계 구분.
- **레버리지 박스 위계 재설계** ([asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx)): 정확도를 올리는 과정에서 블록이 8개까지 늘어 결론이 묻혔다 → **①결론 Hero(이자 내고 남는 돈, `text-xl~2xl` + 판정 문구 1줄) ②나가는/들어오는 2박스(산출 캡션 제거해 2줄로 압축) ③접기 트리거** 3블록으로 재구성. 총액·분모·산출 근거·대출 목록·제외 안내는 전부 **`계산 근거 · 대출 상세` 접기(기본 접힘)** 로 이동(design-system §11 "Hero 최상단·부차 정보는 접이식"). 9문단짜리 InfoHint도 3문단으로 압축하고 나머지는 접기 본문으로. **계산 로직 불변** — `netLeverage`/`netRate`만 IIFE 밖으로 끌어올려 Hero와 등급 `coverage`가 같은 값을 공유.
- **대출 → 부동산 연결 딥링크**: 접기 안 대출 행을 `<button>`으로 바꿔 클릭 시 **기존 `trigger-edit-loan` 이벤트**를 dispatch → 해당 대출 수정 다이얼로그가 열린다(`LoanInput`이 [asset-page-tabs.tsx](../../src/app/(main)/_components/layout/navigation/asset-page-tabs.tsx) 뷰 전환 밖 hidden 영역에 상시 마운트라 성과 탭에서도 닿음 — 신규 배선 0). 연결 필요한 대출(`!isRealEstate`)에만 `Link2` + `부동산 연결` 라벨. `AssetReport.loanInterest`에 `id` 추가(렌더 key도 `name-rate` 조합 → `id`로 교체, 동명이 대출 충돌 제거).
- **공지 행동 요청 콜아웃**: 기존 사용자는 연결 UI가 열린 걸 모르므로 [notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx)에 amber 톤 콜아웃 추가(경로 안내 포함, 공지는 `pointer-events-none`이라 링크 불가).
- **신용대출로 산 부동산 연결 가능**([loan-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/loan-input.tsx)): `연계 부동산` 선택이 `selectedType === "mortgage-home"`일 때만 렌더돼, **신용·마이너스대출로 산 부동산은 연결할 수단 자체가 없었다** → 해당 대출이 영원히 "투자 레버리지"로 분류되어 성적표의 레버리지 이자·대출비율이 부풀려짐(실사용 데이터에서 투자 레버리지 1.277억 중 7,000만원이 사무실 용도 신용대출로 확인). 종류 조건을 제거해 전 대출에서 연결 가능하게 하고, 연결 시 레버리지 비교에서 빠진다는 `FormDescription` 추가. **계산 로직은 이미 `linkedRealEstateId`를 보고 있어 UI 조건만 해제**.
- **분모 노출·기준 뱃지**: 레버리지 박스에 `금융자산만` 뱃지 + `금융 투자 원가 N원 대비 42%` 캡션(`AssetReport.financialInvestCost` 신설)을 추가해 사용자가 %를 직접 검산 가능하게. '넣은 돈'에는 `부동산 · 주식 · 코인 · 현금 합산` 캡션 — **두 블록의 분모가 다르다**(전체 자산 대비 11%가 금융투자 대비 42%로 보이는 이유)는 점이 혼동 지점이었다.
- **"모든 자산 기준" 명시**: 성과 허브 자산 성적표 카드의 "투입원가 대비"에 `모든 자산` 뱃지 추가 + 성적표 본문 Hero 아래에 **넣은 돈·번 돈·수익률 요약 블록 신설**(카드에만 있고 정작 성적표엔 없던 값). 현금이 분모에 포함돼 수익률을 희석한다는 점을 InfoHint로 안내.
- **실거래 오매칭 P1 수정 — 다른 단지가 "근사"로 확정 노출**([realestate-service.ts](../../src/lib/realestate-service.ts)·[asset-data-context.tsx](../../src/contexts/asset-data-context.tsx)): 결함 3개 연쇄. ① `matchBy:"complex"` 후보 제외 가드가 `opts.complexName`이 있을 때만 동작하고 그마저 `dongHit`(법정동 substring)만으로 통과 → **같은 법정동에서 면적만 근접한 아무 아파트**가 뽑혀 `approx` + 그 거래의 단지명이 근거로 확정 노출(실사용: 강남대로 39길 물건에 "현대성우주상복합아파트 151.2㎡"). → **지번 또는 단지명이 실제 일치할 때만 개별 거래 특정**으로 강화, 나머지는 단지명을 내보내지 않는 2단계 `estimated`(㎡당 단가 중앙값)로 정직하게 degrade. ② **자산 표시 이름을 단지명 폴백으로 질의·저장**하던 3곳 제거 — "우리집" 같은 별칭이 매칭 키가 되어 nameHit 실패를 유발하고 가짜 단지명이 레코드에 영구 저장됐다. ③ 자동 갱신이 `e.estimate` 있을 때만 패치해 **매칭 실패로 바뀌어도 옛 오염값이 영구 잔존**(①만 고치면 화면이 안 고쳐지는 이유) → 정상 응답+무매칭이면 `marketEstimate*` 전 필드를 정리하고, `e.error`·네트워크 실패는 기존대로 보존(graceful). 회귀 테스트 2건 추가(35→37).
- **부동산 상세탭 실거래 추정 모바일 정리 + 미확보 CTA**([real-estate-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/real-estate-tab.tsx)): 추정 셀 라벨에 날짜·등급뱃지·info가 한 줄로 몰려 `grid-cols-2` 반폭에서 뱃지가 잘리거나 우측이 비던 문제 → 셀을 `col-span-2 sm:col-span-1`(모바일 전폭)로, 날짜는 라벨에서 분리해 값 아래 별도 줄로. `GradeBadge` 루트에 `shrink-0` 기본 적용(입력폼도 동일 이득). **추정 미확보 시 아무 표시가 없던 것**(S-4.21 AC4 상세탭 미구현)을 원인별 축약 CTA(`주소 검색 필요`/`{면적} 입력 필요`/`실거래 매칭 실패`) + 수정 버튼으로 채움 — 기존 `trigger-edit-real-estate` 이벤트 재사용(신규 배선 0).
- **백업 메타 localStorage 2키 → 1키 통합**([backup-status.ts](../../src/lib/backup-status.ts)·[local-storage.ts](../../src/lib/local-storage.ts)): 4.18 추가 키 중 `secretasset_last_backup_at`·`secretasset_backup_nudge_shown_on`이 같은 개념·같은 라이프사이클(둘 다 keepKeys 보존·`clearBackupStatus` 동시 삭제·기기 로컬 전용)이라 **단일 객체 `secretasset_backup { lastBackupAt, nudgeShownOn }`** 로 통합. 접근은 `readBackupMeta`/`writeBackupMeta` read-modify-write로 캡슐화(소비처 무변경). `consolidate-backup-keys` 마이그레이션으로 옛 2키 이관. (검토 결과 `lastVisitDate`는 clear 동작 상이·`dailyArchive`는 데이터 blob이라 통합 제외 — 나머지 4.18 키는 모두 bounded 단일 키)
- **공지 localStorage 단일 키 통합**([local-storage.ts](../../src/lib/local-storage.ts)·[notice-dialog.tsx](../../src/app/(main)/_components/layout/onboarding/notice-dialog.tsx)): 릴리스마다 `secretasset_notice_seen_{id}` per-id 키가 만료 전까지 누적되고 죽은 `secretasset_notice_hide_until`(구 "일주일 숨기기" 잔재)이 계속 이관·보존되던 sprawl 제거 → **단일 키 `secretasset_notice_seen`**(`{id,seenAt,expiresAt}`)로 통합. `cleanExpiredNoticeKeys(currentId)`가 현재 공지 레거시 키를 단일 키로 이관(열람 상태 보존) 후 나머지 전부 정리, `consolidate-notice-keys` 마이그레이션으로 죽은 hide_until 제거. `merge-tutorial-status`(12키→1키) 선례 패턴.
- **공지 문구 오늘 작업 반영 + 성적표 패턴 등록**([notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx)·[design-system.md](design-system.md) §5.1): 자산 성적표 카드에 투입 대비 성과 3기준·AI 프롬프트 고도화 문구를, 기타 개선 문단에 원인분해 상세화·백업 날짜 정확도를 보강(`NOTICE_ID` 불변). 성적표에서 만든 재사용 UI 패턴 4종(**대주제 섹션 구분·소그룹 뱃지 라벨·비교 그리드·명세 행 SpecRow**)을 design-system §5.1에 레시피+레퍼런스로 등록.
- **이유(공지):** 공지의 성패는 정보량이 아니라 인지율이다. PWA 설치는 홈 배너·상단 아이콘으로 이미 상시 노출 중이라 공지에서 빼도 유입 손실이 없고, 그 자리를 비워야 신규 기능 4개가 스크롤 없이 들어온다.
- **이유:** 추정치가 틀리면 병기하지 않느니만 못하다. 이번 변경의 축은 "더 많이 추정"이 아니라 **근거가 약하면 내보내지 않고, 내보낼 땐 등급·표본을 함께 보여준다**에 있다.

---

## 2026-07-20

### 업비트 코인 시세 자동 갱신 — 1시간 슬롯 캐싱 (issue-4.20)

- **코인 시세 자동화** ([upbit-service.ts](../../src/lib/upbit-service.ts)·[coin-cache-slot.ts](../../src/lib/coin-cache-slot.ts)·[api/finance/crypto](../../src/app/api/finance/crypto/route.ts) 신규): 암호화폐만 현재가가 100% 수동 입력이라 사용자가 직접 고치지 않으면 평가액·순자산·성적표가 낡은 값으로 계산되던 문제 해결. 업비트 Quotation API(인증 불필요·콤마로 복수 페어 1회 조회)로 접속 시 자동 갱신. 코인은 24시간 무휴장이라 주식의 장중/장외·영업일·DST 판정이 무의미해 **항상 1시간 슬롯**(`{YYYY-MM-DD}-H{HH}` KST)만 쓰는 별도 슬롯 유틸로 단순화. `cryptoSchema.baseDate`(optional) 도장으로 같은 슬롯이면 재조회 스킵. 업비트는 복수 조회를 지원하므로 주식의 배치 루프(3개/1초)가 통째로 불필요.
- **공통 캐시 + rate limit 방어**: 서버 캐시 키가 마켓 단위(`finance:coin:KRW-BTC-{slot}`)라 같은 코인 보유자끼리 캐시를 공유해 외부 호출이 슬롯당 1회로 수렴. 업비트 한도(IP 기준 10 req/s)의 **20%만 사용**하도록 ① 슬롯 캐시 → **stale(3시간) 즉시 반환 + `after()` 백그라운드 갱신**(사용자 대기 0) → 최초만 동기 대기 ② 외부 호출은 `finance:upbit:lock`(SET NX EX 5s)로 직렬화 + **최소 500ms 간격** ③ 클라이언트 **0~5초 지터**로 매시 정각 몰림(thundering herd) 분산. 로컬(단일 프로세스)은 모듈 스코프 in-flight dedup으로 락 대체. 429·418 수신 시 재시도 없이 stale 유지.
- **캐시 버킷 분리(함정)** ([cache-storage.ts](../../src/lib/cache-storage.ts)): 파일 캐시를 `COINS`/`COINS_LAST`로 `STOCKS`와 분리. `writeFinanceCache`의 prune이 주식 유효일 문자열 매칭(`key.includes('-{effectiveDate}')`)이라 같은 버킷에 넣으면 코인이 매 write마다 통째로 삭제됨. Upstash도 `finance:coin:` 접두로 분리해 `finance:stock:` SCAN 정리와 충돌 방지. 실측으로 주식 캐시 보존 확인.
- **무효 심볼 방어**: 업비트 미상장 심볼이 하나라도 섞이면 ticker 요청 **전체가 400 실패**하므로, `market/all`(1일 캐시)과 교집합을 취한 뒤 조회. 응답에 없는 코인(해외 거래소 전용)은 수동 입력값을 그대로 유지.
- **동기화 핑퐁 차단** ([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx) `getComparablePayloadString`): crypto의 `baseDate`·`currentPrice`를 변경감지에서 제외. 미제외 시 자산 미변경에도 매시간 자동 push가 발생(R14, 주식과 동일한 이유). 공유 토큰(packV7)은 crypto 섹션이 8필드 고정 배열이라 `baseDate` 미포함 — 주식도 `baseDate`를 공유 토큰에 넣지 않는 선례를 따름(R3).
- **이유:** 자산 5종 중 코인만 시세가 멈춰 있어 순자산·성적표의 정확도를 떨어뜨렸다. 업비트는 인증이 없고 복수 조회가 되어 주식보다 오히려 단순하게 붙지만, IP 기준 초당 제한과 서버리스 IP 공유가 위험이라 캐시·락·stale·지터로 호출 자체를 슬롯당 1회로 수렴시키는 데 설계를 집중했다.

---

## 2026-07-11

### 인앱 브라우저 외부 이동 하드 게이트 + 동기화 잦은 version 갱신 개선 (issue-4.12)

- **인앱 브라우저 하드 게이트** ([in-app-browser-gate.tsx](../../src/app/(main)/_components/pwa/in-app-browser-gate.tsx) 신규, [layout.tsx](../../src/app/(main)/layout.tsx) 마운트): 카카오톡·네이버 등 인앱 브라우저 진입 시 앱 전체를 전체화면 오버레이로 가리고 외부 브라우저(Chrome/Safari)로 이동 유도. 렌더 조건 `isInApp && !isStandalone`. **Android는 버튼으로 자동 이동**([open-external-browser.tsx](../../src/lib/pwa/open-external-browser.ts) 신규 `openExternalBrowser`: 카카오톡=`kakaotalk://web/openExternal?url=`, 그 외=`intent://…;S.browser_fallback_url=…;end`), **iOS는 자동 이동 스킴이 없어 `false` 반환** → 현재 주소 클립보드 복사 + 3단계 수동 가이드([in-app-external-guide.tsx](../../src/app/(main)/_components/pwa/in-app-external-guide.tsx) 신규, `pwa-install-flow`의 `inAppStep`과 공유). 자산 있으면 이동 전 PIN 4자리 입력 → 복원코드 `#share=` URL로 이동, 동기화 기기는 PIN 없이 `syncLink`로 이동. `generateShareArtifacts`는 [use-share-artifacts.ts](../../src/hooks/use-share-artifacts.ts) 신규 훅으로 추출해 게이트·설치 흐름 공용(중복 제거).
- **게이트 활성 시 자동 동작 전면 차단** ([detect-browser.ts](../../src/lib/pwa/detect-browser.ts) `isInAppGateActive()`/`isStandaloneDisplay()` 신규): 게이트가 화면만 덮고 뒤에서 자동 동기화·시세가 계속 돌던 문제 수정. cloud-sync arm effect는 `assetId`/`lastSyncedAt` 세팅은 유지(syncLink 생성)하되 **armed 진입만 차단**(→pull/폴링/push 정지), `#sync=` 연결 모달도 차단. asset-data-context `initAndSync`·0→양수 전환 effect는 **데이터 로드 후 게이트면 조기 return**해 오늘자 환율·시세·스냅샷 자동 저장 skip.
- **동기화 잦은 version 갱신(핑퐁) 개선** ([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx) `getComparablePayloadString`): 변경 감지 필터가 `currentPrice/inactive*`만 제외하고 **`baseDate`(시세 슬롯 도장)·`name`(API 이름)을 빠뜨려**, 자산 미변경이어도 접속마다(장외=매일, 장중=매시간) baseDate 갱신이 자동 push를 유발하던 원인 제거. 이제 API 동기화 종목(halted 포함)에서 `baseDate`·`name`·`inactiveCheckedAt` 항상 제외, 활성 종목은 `currentPrice`·`inactiveStatus`·`inactiveReason`도 제외, **halted는 `currentPrice`(보존 가격)·`inactiveStatus`(정지 상태) 유지**. 무티커·비상장은 사용자 입력값이라 그대로 비교. 실제 push payload(`buildExportPayload`)는 불변이라 데이터는 온전히 동기화 (R14 보강).
- **이유:** 인앱 브라우저의 세션 끊김 데이터 유실 리스크를 소프트 안내에서 하드 게이트로 격상하고, 게이트 뒤 자동 동작이 그 목적과 충돌하던 것을 차단. 동기화는 오늘자 접근·장중마다 양 기기가 무의미한 version을 주고받던 핑퐁을 감지기에서 근본 차단.

---

## 2026-06-30

### 기기 동기화 pull 후 시세 동기화 + 닉네임 커밋 시점 변경 (issue-4.7)

- **pull 후 전체 시세 동기화** ([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx) `runPull`·`armWithPull`): 다른 기기 변경 반영(pull)·신규 연결 직후 호출을 `refreshData()` → **`initAndSync(getAssetData())`** 로 교체. `refreshData`는 진행 중 sync 취소 + localStorage 재로드만 하고 오늘자 환율·주식 현재가를 재동기화하지 않아, **양쪽 기기 모두 자산 보유 시 pull 후 시세가 갱신되지 않던 버그** 수정(시세 동기화는 마운트·0→양수 전환에서만 트리거됐음). `initAndSync` 진입의 `syncTodayStockPrices`가 이전 sync abort·`saveSnapshotsBlockedRef=false`·`dataResetVersion++`(기존 `refreshData` 역할 포함)를 모두 수행. `runPushAfterRestoreFix`(자격 재기록)·`skipNextChangeRef`(push 루프 가드) 호출 순서·로직 보존.
- **닉네임 커밋 시점 = 탭 이탈** ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): 닉네임 입력을 로컬 `draft` state로 분리. `onChange`는 draft만 갱신(localStorage 저장·`NICKNAME_EVENT`·push 없음), `useEffect([nickname])`로 외부 pull/다른 탭 변경을 입력란에 반영, **더보기 탭 이탈(언마운트) 시 `commitRef`로 1회만 커밋**(`sanitizeNickname(draft)!==nickname`일 때만 `setNickname`→no-op로 stale 재push 차단). `persistNickname` 로직은 그대로 재사용·호출 시점만 변경.
- **이유:** 닉네임을 키 입력마다 즉시 저장→push하던 탓에, 기기 A의 신규 닉네임을 받은 기기 B가 자신의 오래된 닉네임으로 되돌려 동기화하는 ping-pong이 관찰됨. 커밋을 탭 이탈 1회로 늦추고 외부 변경을 draft에 반영해 원천 차단. 동기화 pull이 시세 갱신 진입 경로에서 누락돼 있던 것도 함께 정정.

---

## 2026-06-25

### SVG 가이드 애니메이션 공용화 + 복원 코드 개명 + 공지 수동 진입 (issue-4.5)

- **SVG 애니메이션 공용 플레이어** ([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)): 3벌 중복 플레이어를 `StepAnimationPlayer` 단일 컴포넌트로 통합(`InstallGuideAnimation`·`SyncSetupAnimation`·`PwaSetupAnimation` 위임). **멈춤/시작 버튼 + 단계 점 클릭 이동**(`pointer-events-auto`로 공지 `pointer-events-none` 내부에서도 동작), 컷 간격 3500ms 통일, `prefers-reduced-motion` 시 자동재생 끔. 신규 `SyncSetupAnimation`(기기 동기화 4컷). 새 기기 화면은 `PhoneFrame tone="new"`(teal)+"새 기기" 배지로 구분, 더보기 ⋯는 가로 점.
- **PWA 설치 가이드 단일화** ([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)·[pwa-install-guide-content.tsx](../../src/app/(main)/_components/pwa/pwa-install-guide-content.tsx)): 공지와 실제 설치 가이드(`InstallGuideContent`)가 동일 `PwaSetupAnimation({platform,browser})` 공유(구 `InstallGuideAnimation` 제거). **①앱 설치(복원 코드)·④새 기기 복원은 공통, ②③은 접속 브라우저별**(`getGuideSteps` 공유/메뉴→홈 추가) SVG. PC는 ②③ 생략(공통 2컷). notice는 `detectBrowserEnv()`로 브라우저 감지해 전달. **iOS Safari 구형/신형 분기**(`iosSafariModern`=UA iOS 메이저 ≥ 15): 신형은 하단 ⋯ 메뉴→공유(`IosSafariNewShareStep` 신규), 구형은 하단 중앙 공유. 컷 간격 3000ms. **구형 iOS Safari 컷 미전환 버그**(opacity 스택 레이어 repaint 누락) → **활성 컷 1개만 `key={active}` remount 렌더**로 전환 보장, 진입 페이드는 `motion-safe`.
- **iPad UA 오인식 수정** ([detect-browser.ts](../../src/lib/pwa/detect-browser.ts)·[use-pwa-install.ts](../../src/hooks/use-pwa-install.ts)): iPadOS 13+ Safari가 데스크톱(Macintosh) UA로 위장 → `pc` 오분류로 iPad가 설치·복원 가이드 대신 PC 문제해결을 받던 버그. `maxTouchPoints>1`로 iPad=iOS 판별, `usePWAInstall.isIOS/isInApp`도 `detectBrowserEnv()` 단일 소스로 위임. `parseIosMajor`는 위장 UA용 `version/N` 폴백 추가.
- **"복원 코드" 개명** ([pwa-install-flow.tsx](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx)·[pwa-connect-prompt.tsx](../../src/app/(main)/_components/pwa/pwa-connect-prompt.tsx) 등): 비동기화 설치 코드 "연결 코드" → **"복원 코드"**(일회성 데이터 복원이라 의미 명확화, `동기화 코드`와 구분). "다른 기기 연결 및 복구 링크" → **"다른 기기 동기화 링크"**. 자동 pull 폴링 60→30s.
- **공지 PWA 우선 + 복원 2종 구분** ([notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx), `NOTICE_ID="20260624"`): 카드 순서 PWA 설치 먼저 → 기기 동기화. PWA 복원을 **동기화=금고 암호 / 일반=PIN 4자리** 2케이스로 텍스트·SVG 명확 구분.
- **공지 수동 진입 통합** ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)): "앱 가이드 보기" → **"앱 가이드 · 공지사항"** 통합 선택기. 공지 뷰어는 자동 팝업과 동일 `NoticeContent`·`NOTICE_TITLE` 재사용(메뉴 과밀 회피).
- **렌더 버그 수정**: SVG `fill={HINT}`(색 토큰 className을 fill에 직접 사용 → 다크모드 미표시) → `fill="currentColor" className={HINT}` 정정(비밀번호 점·PIN 표시).
- **이유:** 향후 SVG 가이드 확장 대비 단일 플레이어로 일원화하고 사용자 제어(멈춤/이동) 추가. "연결 코드"가 "기기 연결/동기화"와 혼동되어 행위(복원) 기준으로 개명. 공지를 메뉴 과밀 없이 상시 재열람 가능하게.

---

## 2026-06-22

### PWA 설치 가이드 통일 + 행위 prefix 통일 + UI 디테일 폴리시 (issue-4.5)

- **설치 가이드 단일화** ([pwa-install-guide-content.tsx](../../src/app/(main)/_components/pwa/pwa-install-guide-content.tsx) 신규 · 구 `pwa-install-guide-dialog.tsx` 제거): 3탭 다이얼로그 → `InstallGuideContent({ env })` 통합 본문. flow의 `iosStep`·`guideStep`이 동일 컴포넌트 임베드. 모바일=감지 브라우저 설치 애니메이션+step1/step2 문구+"다른 브라우저인가요?" 칩 재선택+접이식 "설치가 안 되나요?", PC=시크릿모드/`chrome://apps` 재설치/Firefox 문제해결.
- **브라우저 환경 감지** ([lib/pwa/detect-browser.ts](../../src/lib/pwa/detect-browser.ts) 신규): `detectBrowserEnv()` → `BrowserEnv { platform: ios/android/pc, browser: safari/chrome/whale/samsung, isInApp }`. **Android(크롬·웨일·삼성인터넷) 가이드 추가** — iOS 한정에서 확장. `InstallGuideAnimation`이 `platform`·`browser` props로 분기.
- **행위 prefix 통일** ([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx), [asset-data-context.tsx](../../src/contexts/asset-data-context.tsx), [config.ts](../../src/lib/cloud-sync/config.ts), [pwa-connect-prompt.tsx](../../src/app/(main)/_components/pwa/pwa-connect-prompt.tsx) 등): 동기화 연결/복구 사용자 문구·로그 prefix 일관화.
- **UI 디테일 폴리시(make-interfaces-feel-better)**: `transition-all` → 변하는 속성만 명시(button/toggle/switch/accordion/dialog/navigation-menu/sidebar/kpi-card). `Button` 누름 피드백 `active:not-disabled:scale-[0.96]` 내장 + `static` prop으로 비활성. 뷰 진입 stagger(`motion-safe` animate-in: dashboard/detail-hub/performance-hub, FAB 리스트 40ms 분산). `tabular-nums`(수량·환율·건수), `text-balance`/`text-pretty`(제목·본문). 작은 닫기 버튼 `after:-inset-*`로 40×40 히트영역, 헤더 아이콘 버튼 `h-10 sm:h-11`. iOS 가이드 SVG aspect-ratio 폴백(`paddingTop` 스페이서).
- **이유:** iOS 전용이던 설치 가이드를 Android 포함 전 환경으로 일반화하고 환경 자동감지로 단일 컴포넌트화(다이얼로그 중복 제거). 누름·진입·숫자 정렬 등 마이크로 인터랙션을 스킬 체크리스트로 일괄 정비.

---

## 2026-06-20 (2)

### 기기 동기화 명칭 통일 + 앱 잠금 웹 확장 + 공지 컴포넌트화 (issue-4.5)

- **명칭 통일** — 사용자 노출 텍스트 전체: "클라우드 동기화" → "기기 동기화 Plus" / "지금 백업" → "지금 동기화" / "클라우드 → 이 기기 불러오기" → "기기 데이터 가져오기" / "이 기기 연결 해제" → "이 기기 연결 끊기". 변경 파일: [cloud-sync-menu-entry.tsx](../../src/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx), [settings-page.tsx](../../src/app/(main)/_components/header-menu/settings-page.tsx), [tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx), [pwa-install-flow.tsx](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx), [notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx).
- **앱 잠금 설정 웹 확장** ([pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx)): 기존 `standalone && authEnabled` → `authEnabled`만으로 조건 변경. 웹 브라우저에서도 잠금 ON 시 세션 진입마다 PIN 요구.
- **공지 컴포넌트화** ([notice.tsx](../../src/app/(main)/_components/layout/onboarding/notice.tsx) 신규): branch 단위 공지를 실제 사이트 컴포넌트(`pointer-events-none`)로 구성. `NOTICE_ID="202606"`, `NOTICE_TITLE`, `NoticeContent` export. 내용: 기기 동기화 Plus + 앱 설치(PWA) 소개.
- **이유:** "클라우드"라는 모호한 표현 대신 기기 중심 명칭으로 서비스 본질 강조. 앱 잠금을 PWA 전용에서 웹으로 확대해 비PWA 사용자도 보안 설정 활용 가능.

---

## 2026-06-20

### PWA 설치 흐름 공용화 + 웰컴가이드 모바일 최적화 + iOS 가이드 SVG 실사화 (issue-4.5)

- **설치 흐름 공용 컴포넌트 추출** ([pwa-install-flow.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-flow.tsx) 신규): 홈 설치 버튼에 인라인돼 있던 설치 다이얼로그+전체 로직(state·`handleButtonClick`·`handleInstall`·`generateShareArtifacts`·iOS/인앱/동기화 분기)을 단일 컴포넌트로 분리. 트리거는 children render-prop(`{ onClick, loading, isIOS, isInApp, isInstallable }`)로 외부 주입. [pwa-install-button.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-button.tsx)는 다운로드 아이콘 버튼만 넘기는 얇은 래퍼로 축소(공개 API 동일).
- **웰컴가이드 모바일 웹 PWA-우선 레이아웃** ([welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/layout/onboarding/welcome-guide.tsx)): `mobileWeb = mounted && useIsMobile() && !isStandalone`일 때 보안·포트폴리오 소개 노출 후 PWA 설치 유도를 메인 CTA로 강조. 즉시 자산 등록 CTA는 기본 숨김, "설치 없이 웹에서 바로 시작" 링크 클릭(`showAssetCta`) 시에만 노출. "웹앱 설치하기"는 홈 버튼과 동일한 `PwaInstallFlow` 호출. 기존 `PwaInstallGuideDialog` 직접 호출 제거. 데스크톱·standalone은 기존 레이아웃 유지.
- **iOS step1 가이드 SVG 실사화** ([pwa-guide-illustrations.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)): 실제 브라우저 스크린샷 기준으로 주소창 하단 + 진입 구조 재현. Safari=하단 우측 원형 `⋯`→세로 팝업 최상단 `공유`(`IosShareStep`), Chrome=주소창 우측 `공유`(box-arrow) 직접 탭(`IosChromeShareStep`), Whale=하단 우측 `≡`→그리드 팝업의 `공유` 타일(`IosWhaleShareStep`). step2(`IosAddToHomeStep`)는 3종 공통. 다이얼로그 step1 문구도 각 구조에 동기화.
- **app-guide `"use client"` 추가** ([app-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/app-guide.tsx)): `useState/useEffect` 사용으로 서버 컴포넌트 빌드 에러 발생 → 지시어 추가.
- **이유:** 홈 버튼과 웰컴가이드가 각각 다른 설치 경로(인라인 vs `PwaInstallGuideDialog`)를 써서 불일치 → 단일 흐름으로 통합. 모바일 웹 신규 사용자를 PWA 설치로 집중 유도(미설치 선택 시에만 웹 자산 등록). iOS 가이드 SVG가 실제 UI와 달라 사용자 혼동 → 실제 스크린샷 구조로 교정.

---

## 2026-06-14

### PWA iOS/인앱 브라우저 설치 플로우 개선 + 앱가이드 가독성 향상 (issue-4.5)

- **iOS 전 브라우저 감지** ([use-pwa-install.ts](file:///e:/2.project/js/secret-asset/src/hooks/use-pwa-install.ts)): `isIOS` 감지를 Safari 한정에서 `/iphone|ipad|ipod/` UA 전체로 확장. iOS Chrome·웨일에서도 홈 화면 추가 가이드가 노출됨.
- **인앱 브라우저 감지 + 외부 브라우저 유도** ([pwa-install-button.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-button.tsx)): `isInApp` (카카오톡·인스타·FB·라인·네이버 인앱 UA) 감지 추가. 인앱에서는 현재 URL 클립보드 복사 → `inAppStep` 외부 브라우저 유도 가이드(메뉴→다른 브라우저로 열기→앱 설치) 표시.
- **iOS 가이드 개선**: `navigator.share()` 호출 제거. 대신 `iosStep` 플로우(공유→홈 화면에 추가→추가) 가이드 UI로 교체. 버튼 라벨 "추가 방법 보기" (Safari 제한 문구 없음).
- **`apple-touch-icon` / `appleWebApp` 메타데이터 추가** ([layout.tsx](file:///e:/2.project/js/secret-asset/src/app/layout.tsx)): `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }` + `icons.apple` (`/icons/icon-192x192.png`, 180×180) — iOS 홈 화면 아이콘 및 스탠드얼론 모드 인식.
- **PwaInstallGuideDialog 재검토** ([pwa-install-guide-dialog.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-guide-dialog.tsx)): 제목 "앱 설치가 안 되나요?", 설명 3상황(버튼 안 보임/재설치 불가/설치 불가 환경) 재작성. PC·Android·iOS 탭에 인앱/Firefox 불가 환경 주의 콜아웃 추가. iOS 탭 라벨 "iOS (Safari·크롬·웨일 등)"로 브라우저 무관 일반화.
- **앱가이드·웰컴가이드 가독성 향상** ([app-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/app-guide.tsx), [welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/layout/onboarding/welcome-guide.tsx)): 카드 여백 `p-5`, 제목 `text-[15px]`, 본문 `text-[13px] leading-7 tracking-[0.01em]` 통일.
- **이유:** iOS에서 설치 버튼을 눌러도 아무 반응 없던 문제 해결. 카카오톡 등 인앱 브라우저에서 홈 화면 추가 불가 환경을 명확히 안내. iOS 홈 화면 아이콘 품질 개선(apple-touch-icon 누락).

---

### Plus 구독 모델을 위한 용어(Asset) 정의 및 코드 표준화

- **용어집 작성 및 표준 정의**: `.claude/_knowledge/asset-and-subscription.md`를 생성하여 전체 자산 데이터 묶음을 `Asset` (식별자 `assetId`), 서버 저장 암호화 본을 `AssetEnvelope`으로 명확히 규정.
- **서버 저장소 통합 및 `sync-storage.ts` 삭제**: 
  * [sync-storage.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-storage.ts) 파일을 전면 삭제하고, 파일/Redis 입출력 동작을 [cache-storage.ts](file:///e:/2.project/js/secret-asset/src/lib/cache-storage.ts)의 `getAssetEnvelope` 및 `setAssetEnvelope` 메서드로 이관하여 서버 캐시/스토리지 로직을 단일화.
  * `UpstashCacheStorage`에서 Redis 키를 `csync:asset:${assetId}`로 변경하여 저장 관리. (레거시 검증이므로 하위 호환 마이그레이션 생략)
- **클라우드 동기화 및 크립토 리네임**:
  * [config.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/config.ts): `VaultEnvelope` -> `AssetEnvelope` 변경 및 `SYNC_HASH_PARAM`을 `"asset"`으로 변경.
  * [crypto.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/crypto.ts): `VaultKeys` -> `AssetKeys` 리네임 및 주석 내 `syncId` 혼용 제거, `assetId`로 명확히 통일.
  * [sync-state.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-state.ts): 불필요한 레거시 `syncId` 마이그레이션 분기 제거 및 `assetId` 기반으로 단순화.
  * [sync-client.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-client.ts): `pushVault`/`pullVault` -> `pushAsset`/`pullAsset` 리네임, GET API 응답 JSON 필드 `vault` -> `asset` 변경.
- **API 라우트 및 UI 컴포넌트 업데이트**:
  * [route.ts (API Sync)](file:///e:/2.project/js/secret-asset/src/app/api/sync/route.ts): `sync-storage` 대신 `cache-storage` 싱글톤을 활용하여 E2EE 암호 봉투 저장/조회. API 응답 필드 `vault` -> `asset` 변경.
  * [cloud-sync-provider.tsx](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/cloud-sync-provider.tsx): `SYNC_HASH_PARAM="asset"` 반영으로 동기화 링크가 `#asset=<assetId>`로 빌드/탐지되도록 수정. `sync` 해시 폴백 감지 유지.
  * [cloud-sync-connect-dialog.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/functions/cloud-sync/cloud-sync-connect-dialog.tsx) 및 [cloud-sync-menu-entry.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx): 리네임된 변수명 연동 및 UI 텍스트 정비.
  * [tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/tool-menu.tsx): Share(1회 공유)와 Cloud Sync(지속 동기화)의 가치 포지셔닝 차이를 설명 및 메뉴 카피에 명시.
- **이유:** 향후 Plus 유료 구독 모델을 안정적으로 설계하고 연동하기 위해 구독/과금 대상의 공통 단위를 `asset` (`assetId`)으로 확정하고, 중구난방이던 서버 저장 키와 URL 파라미터, 소스 코드 구조를 깔끔하게 단일화함.

---

## 2026-06-11

### 주식 스샷 공통/개별 적용 옵션 + 의견·요청 보내기(Slack 웹훅) (issue-4.3)

- **주식 스크린샷 공통/개별 적용 토글** ([stock-screenshot-import.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx)):
  * 동일 증권사·카테고리 화면을 한 번에 캡쳐하는 일반적 사용 패턴을 위해 미리보기에 **"공통 적용"(기본) ↔ "개별 선택"** 세그먼트 토글 추가. 공통 모드는 카테고리·증권사 `Select` 1세트로 전 종목 일괄 적용, 개별 모드는 기존 종목별 드롭다운.
  * `updateCategory` 내부 환산 로직을 순수 헬퍼 `convertStockCategory(stock, category, usdRate)`로 추출 → `updateCategory`·공통 일괄 적용(`applyCommonCategory`)이 동일 헬퍼 재사용(해외↔국내 가격/통화 환산 일관, 중복 제거).
  * 파싱 직후 공통 기본값 자동 설정: 다수 종목이 해외면 `foreign`, 아니면 도메스틱/`activeTab` 국내계열. 증권사는 `matchBrokerHint(brokerHint)` 자동 매칭(거래 스샷과 동일 방식).
- **의견·요청 보내기 메뉴** ([tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/tool-menu.tsx) · 신규 [api/feedback/route.ts](file:///e:/2.project/js/secret-asset/src/app/api/feedback/route.ts)):
  * 더보기 "설정/기능"에 "의견·요청 보내기" 추가 → `Textarea`(내용 필수, 최대 2000자) + 연락처(선택) 다이얼로그. 닉네임 자동 첨부.
  * `/api/feedback` POST는 `SLACK_WEBHOOK_URL`로 메시지 전달만 수행하고 **서버에 저장하지 않음**. message 공백 검증(400), IP `checkRateLimit` 재사용(429), 웹훅 미설정(500)·실패(502). 기존 `share/route.ts`의 `getClientIp`·rate-limit 패턴 재사용.
  * Textarea는 `field-sizing-content` 자동 확장으로 다이얼로그를 밀어내 하단 버튼이 가려지던 문제 → `min-h-[160px] max-h-[40vh] overflow-y-auto`로 상한+내부 스크롤, `DialogContent`에 `max-h-[85vh] overflow-y-auto` 추가.
- **이유:** 같은 증권사 다종목 등록 시 반복 입력을 없애 입력 효율을 높이고, 사용자 의견을 서버 저장 없이 Slack으로 즉시 받는 피드백 창구를 마련.

---

## 2026-06-09

### 공유 URL 테마 모드 동기화 및 스크린샷 가져오기 UI 정돈 (issue-6.1)

- **공유 URL 테마(라이트 모드) 동기화 적용**:
  * [tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/tool-menu.tsx)에서 짧은 공유 URL 및 전체 공유 URL을 복사하여 생성할 때, 현재 발신 브라우저의 테마 상태가 라이트 모드(`themeMode === "light"`)라면 URL 뒤에 `&theme=light` 파라미터가 포함되어 생성되도록 수정했습니다.
  * [asset-data-context.tsx](file:///e:/2.project/js/secret-asset/src/contexts/asset-data-context.tsx)에서 공유 데이터를 해석하고 최종 저장하는 시점(`applySharedData`)에 URL 해시에서 `theme=light` 여부를 검출하는 `checkAndApplyThemeMode` 콜백을 호출하게 하여 수신 기기가 진입하자마자 즉시 preferences 스토어, 쿠키, HTML DOM의 테마 상태를 라이트 모드로 자동 동기화 갱신하도록 처리했습니다.
- **보유 주식 스크린샷 가져오기 미리보기 UI 정돈**:
  * [stock-screenshot-import.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx) 내에서 종목명, 티커 입력란, 환산 뱃지를 1행으로 간결하게 정렬했습니다.
  * 수량/현재가/평단가/평가금액 데이터 영역을 `grid grid-cols-2 sm:grid-cols-4` 형태의 은은한 패널(`bg-muted/40`) 구조로 개선하여 시각적 정돈과 정보 위계를 명확히 강화했습니다.
  * 카테고리 및 증권사 드롭다운 선택창의 가로 배치를 최적화하고, 증권사 선택(`Select`) 컴포넌트의 최대 가로 너비를 `sm:max-w-[220px]`로 확장하여 **"증권사 선택 안 함"** 텍스트가 짤리는 레이아웃 깨짐 현상을 해결했습니다.
- **웰컴 가이드 대시보드 미리보기 연동**:
  * [welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/layout/onboarding/welcome-guide.tsx) 하단의 대시보드 미리보기 영역이 임의의 마크업 대신 실제 [dashboard.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/home/dashboard.tsx) 컴포넌트를 공통 공유하여 렌더링되도록 개선했습니다.
  * 미리보기 시 모든 클릭이나 액션 이벤트를 차단/방지하여 UI 정합성을 유지하도록 처리했습니다.
- **이유:** 공유 URL로 자산을 가져올 때 테마 상태(특히 라이트 모드)도 완벽하게 연동되게 보장하고, 스크린샷 가져오기에서 텍스트가 잘리거나 정보 배치가 뭉개지는 사용성을 다듬어 프리미엄 감각을 높였습니다.

---

## 2026-06-07

### 보더리스 UI 구축 및 입력/상세 폼 인지성 강화 (issue-5.1)

- **전역 공용 UI 입력 필드 보더리스화**: 공용 Input([input.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/input.tsx)), SelectTrigger([select.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/select.tsx)), Textarea([textarea.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/textarea.tsx))의 외곽 테두리(`border`) 및 그림자를 제거하고, 옅은 회색 배경(`bg-muted/60`, 다크모드 `dark:bg-muted/30`)을 주어 보더가 없더라도 입력 상자임을 또렷하게 인식하도록 개선. SelectTrigger 우측 `ChevronDownIcon`의 불투명도를 `opacity-100`으로 높이고 브랜드 인디고 색상(`text-primary`)을 적용해 Select 표시 인지성을 강화.
- **자산 업데이트 및 거래 입력 폼 보더리스 & 취소 버튼 secondary 통일**:
  * `forms` 하위 모든 `*-input.tsx` 및 `trade-input.tsx` 파일 내 다이얼로그 풋터의 취소/새로 추가 버튼들을 `variant="outline"`에서 보더가 없고 은은한 배경이 채워진 `variant="secondary"`로 교체.
  * `NumberInput` 하단의 퀵 추가 버튼들 및 `trade-input.tsx` 내 매수/매도 토글 시 선택되지 않은 버튼들 역시 `variant="secondary"`로 변경하여 테두리 일괄 제거.
  * `trade-input.tsx` 내의 직접 입력/스크린샷 가져오기 버튼들의 테두리를 제거하고 `bg-muted/60` 배경 및 우측 `ChevronRight` 아이콘을 배치해 플랫하고 보더리스한 UI를 완성.
  * 보유 주식 정보 박스, 예상 포지션 미리보기 카드, 중복 거래 경고 안내 카드의 테두리를 제거하고 각각 `bg-muted/50`, `bg-destructive/10`, `bg-amber-500/10` 등의 선명한 배경색을 입혀 식별력 강화.
- **상세 탭 및 과거 순자산 탭 내 수정/삭제/나누기 버튼 일괄 개선**:
  * 상세 자산의 모든 탭([stock-tab.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/detail/tabs/stock-tab.tsx) 등) 및 과거 순자산 탭([net-asset-chart.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/activity/net-asset-chart.tsx))에 존재하는 "수정", "삭제", "증권사별 나누기" 등의 카드 액션 버튼들을 `variant="outline"`에서 `variant="secondary"`로 일괄 변경하여 테두리 제거 및 배경 강조 적용.
- **인증샷 모드 및 공유 메뉴 개선**:
  * 주식 상세 탭 내의 `StockSummaryHeader`에서 인증샷 모드(`screenshotMode: true`)가 활성화되었을 때 환차손익 지구본 팝오버 아이콘(`CurrencyGainHint`)을 노출 리스트에서 제외.
  * 인증샷 생성 모달([share-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/share/share-menu.tsx)) 내 카테고리 필터 `Select` 컴포넌트의 드롭다운 아이템들을 사용자가 실제로 보유 중인 주식의 카테고리 항목들(국내, 해외, IRP 등)만 필터링하여 노출하도록 개선.
  * 인증샷 뷰어([share-card.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/share/share-card.tsx))에서 자산 분포 도넛 차트와 주식 항목 사이에 불필요하게 붕 떠 있던 패딩 공간을 Card (`py-0`) 및 CardContent (`pt-0 px-0 sm:px-0`) 조정을 통해 제거 및 최적화.
- **이유:** 앱 전반의 외곽 테두리를 대폭 걷어내 플랫(Flat)하고 보더리스한 트렌디한 디자인 룩을 완성하면서도, 배경 및 아이콘/variant 변경 처리를 강화해 사용자가 폼 필드와 버튼 영역을 직관적이고 명확하게 인식할 수 있도록 조치.

---

<!-- 2026-06-05 항목은 "최근 10개 유지" 정책에 따라 제거됨 (일별 수익 휴장 폴백 캐시 매핑·"휴장제외" 표시·인증샷 종목 리스트·비종목 카드 정리·날짜 input 모바일 넘침 전역 차단) -->
<!-- 2026-05-23 항목은 "최근 10개 유지" 정책에 따라 제거됨 (UI 정보구조 전면 재설계 — drill-down 라우팅 + 통일 디자인 시스템, 환율 히스토리 7일 확장) -->

