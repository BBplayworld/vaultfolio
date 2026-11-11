# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-11-11 (v4.77)

### 매수일 입력·끊긴 거래 다시 잇기·최소 노출 비중 (#4.77, 이슈 #146 #147 #148, risk:high 대표 승인)
- **#146 새 종목 매수일 일괄 입력**: 맞추기(주식·코인)·첫 등록(주식·코인) 미리보기에 `새 종목/코인 매수일` 줄 1개(기본 올해 1/1, 오늘 이전만, 주식만 배당 InfoHint). `resync-notice-3` 삭제. 첫 등록 `교체`·`초기화 후 등록`은 같은 키 기존 항목을 이어받음(`lib/asset/import-inherit.ts`, id·매수일·매입 환율·메모 유지, 거래 연결 유지). `resolveKept` 불변.
- **#147 끊긴 거래 다시 잇기**: `lib/asset/resync/relink.ts`(감지·적용 순수), 확인 화면 `RelinkDialog`(홈 팁 `relink`·거래내역 안내 줄 진입), 적용 1회 저장·되돌리기(결과·토스트). 홈 팁 우선순위 결산 창 아래. A3: `clearAssetData` 보존 목록에 `featureUsage` 추가(pull·복원 때 팁 해제 유지), 모든 데이터 삭제에서는 명시 삭제. A2(`rollbackTransaction` 0 절단) 결함은 vitest로 확정 → 감지 단계에서 역산 일관 구간만 이음.
- **#148 최소 노출 비중**: `lib/report/min-share.ts` `displayShareWidths`(항목 5개 이하만 폭·각도 최소 보장, 숫자 실제 값) — 홈 도넛·SectionBar·상세 5탭 비중 바·인증카드 섹터 바·/ratio 국내/해외 바. 구성 막대 `displayBarWidths`는 같은 모듈로 이동(재노출).
- **범위**: 저장 스키마·키·동기화·공유 토큰·서버 전송 diff 0(GA 허용값 `relink` 추가 제외).

---

## 2026-11-11 (v4.78)

### 시장과 나란히 '올해' (#4.78, 이슈 #150)
- **비교 화면**: 기간 4번째 `올해`(작년 마지막 거래일 종가 → 오늘) 추가, 시장 표를 행=기간으로 전치(4행이 폭 안에), 종목별 기간 4칸, 연초 휴장은 `집계 전`, 비교 기준 자세히 2줄.
- **자산 변화 › 주식 › 연 탭**: 값 없이 `올해 시장과 비교 ›` 링크만(Hero 1년 값과 오독 방지).
- **API**: `market-index`·`profit`에 `period=ytd`. 미국 올해 기준가만 수정주가(MODP=1)·`adj` 캐시 키, ytd 기준가 서버 TTL 다음 자정(국내·미국), 클라이언트 토큰 날짜. 저장 스키마·저장 키 변경 0.

---

## 2026-11-10 (v4.76)

### 품질 묶음 5 (#4.76, 이슈 #144)
- **보유 현황 업데이트 건수**: 같은 종목 이어받기 행을 요약·결과 건수·미리보기 행에서 `추가+삭제`가 아닌 `변경`으로 표시(`inheritedPreds` 공용 판정을 `summarize`·`applyResync`·미리보기가 공유). 적용·되돌리기 결과 불변.
- **자산 변화 › 주식 카테고리 헤더**: 400px 미만에서 세로 쌓기·금액 좌측 정렬(행과 일관).

---

## 2026-11-10 (v4.75)

### 품질 묶음 4 (#4.75, 이슈 #142)
- **직접 추가 매수일**: 수익률 역산 자동 과거 추정(`estimatePurchaseDateFromReturn`, 연 8% 가정 최대 30년 전) 제거 — 호출처가 stock-input 하나뿐이라 기능 제거에 따라 함수와 안내 문구도 정리(테스트는 원래 없음). 신규 기본값 = 올해 1월 1일(KST, `resyncNewPurchaseDate(todayKst())`), 안내 "기본값은 올해 1월 1일이에요. 실제 매수일을 알면 수정해 주세요.". 수정 경로·기존 저장 데이터 변경 0. 결산 예측 투입일 `resyncInflowDate`가 직접 등록 id `stock_<ms>`도 판별(기본값 1/1 그대로면 만든 날 투입, C74).
- **체험·데모 칩**: `getStockChipQuote` 장중·마감직후는 체험(`isTrialMode`)·데모 종목(`demo_st_`)이면 null(칩 숨김), 종가 쌍 경로 유지.
- **자산 변화 › 주식 목록 320px**: 행을 400px 미만에서 세로 쌓기, 티커 truncate.
- **범위**: 저장 키·스키마·동기화·공유 토큰·서버 전송 diff 0.

---

## 2026-11-10 (v4.74)

### 보유 현황 업데이트(맞추기) 후 매수일·거래 기록·올해 배당 보존 (#4.74, 이슈 #139, 버그)
- **왜**: 대표 제보 — 보유 현황 업데이트로 일괄 맞추면 매수일이 등록일로 잡혀 기존 매수 기록이 사라지고 배당 탭 올해 지급·예상에서 빠짐. 원인: 매칭(티커+계좌+증권사)에 실패한 기존 종목은 미리보기에서 `추가`+`삭제`가 되고, 적용 시 새 id·매수일 오늘로 다시 만들어져 거래 기록(stockId)이 끊기고 배당 필터(`payoutDate < purchaseDate` 제외)에서 올해 지급분이 빠졌다(예: 해외 종목 티커 미인식 → 티커 입력 → 기존 항목 기본 삭제 체크). 연결(변경) 경로는 원래 보존됐다.
- **변경**: `resync/apply.ts` — 추가 행이 이번에 지우는 같은 종목(티커·시장)을 이어받음(id·매수일·매입 환율·메모 승계, 수량·평단·증권사·계좌만 화면 값). 정말 새 종목 매수일 = 올해 1월 1일(대표 결정, `resyncNewPurchaseDate`), `positionEffectiveDate`는 오늘 유지. 미리보기 고지 1줄(`resync-notice-3`, 추가 행 있을 때만).
- **범위**: 저장 키·스키마·동기화·공유 토큰·서버 전송 diff 0. 알려진 한계: 미리보기 요약은 이어받은 행도 `추가 1 · 삭제 1`로 셈, 이어받은 해외 행은 `새 해외 종목 매입 환율` 입력을 쓰지 않음(기존 환율 유지). 결산 예측 구간(시작 스냅샷에 원가 없음)의 신규 투입 추정은 `resyncInflowDate`로 맞추기 신규 항목(id `stock_import_<ms>`/`crypto_import_<ms>` + 매수일이 만든 해 1월 1일 그대로)을 만든 날(KST)에 넣는다 — 1월 결산 소급·이번 달 매수의 시세 오귀속 없음(qa D1, main과 4구간 원인 동일 테스트 (d')). 미리보기 1월 1일 안내는 이어받기를 뺀 실제 신규 생성이 있을 때만(O1). 이미 잘못 덮인 데이터는 자동 복구하지 않음.

---

## 2026-11-10 (v4.73)

### 시장과 나란히 — 내 종목 등락을 코스피·S&P 500 옆에서 (#4.73, 이슈 #132, 브랜치 issue-4.72, risk medium, 대표 승인 대상)
- **왜**: 증권사·계좌를 여러 곳 쓰는 주식 투자자는 지금 가진 종목 전체가 시장만큼 움직였는지 한곳에서 볼 수 없었고, 가장 자주 여는 상세·주식에 다음 갈 곳이 없었다.
- **변경**: ① 신규 화면 `시장과 비교`(`#activity/change-market`, 성과 › 자산 변화 하위) — 시장별 3기간 장부형 표(보유 종목·지수·차이 %p, 지금 수량 × 시작 종가 가중, 미국은 달러 가격), 시장 줄이 낀 종목별 목록, 비교 기준 접기. ② 진입 글줄 2곳(상세·주식 요약 헤더, 자산 변화 › 주식 기간 선택 아래) + 홈 신규 팁. ③ 상세·주식 목록 정렬 `평가금 순`/`등락률 순`. ④ '오늘' 칩 휴장 구간 보강(profit 일별 선택 필드 `chipPair`)과 헤더 칩 시장 단위 숨김. 새 라우트 `/api/finance/market-index`(기간·종가 기준만 받음, CDN 캐시만), 날짜 계산 `profit-dates.ts`로 공용화(출력 무변경 대조), K1 국내 주식형 판별 생성 목록(`kr-kospi-peer-codes.ts`, 동적 import). 뒤로가기 복원(모듈 메모리 — history.state는 Next가 새로고침 처리해 미사용), GA title 3개.
- **버그(#137)**: 자산 변화 › 주식에서 `연` 직후 `주`를 누르면 늦게 온 1년 응답이 `1주` 제목 아래 남던 문제 → `profit-fetch-gate.ts` `beginLatestFetch`로 마지막 선택만 반영(이전 기간 요청 abort·늦은 응답 버림).
- **버그(#138)**: 시작 시세 동기화·리셋이 상세·주식 '오늘' 칩 쿼리를 취소만 해 칩·`등락률 순`이 다시 열 때까지 비던 문제 → 취소 뒤 활성 쿼리 재조회(`cancelThenRefetchProfit`).
- **범위**: 저장 키·스키마·동기화·공유 토큰·마이그레이션 0, 렌더 중 저장 0. 서버로 새로 나가는 값은 지수 라우트의 기간·종가 기준뿐(종목코드·수량·금액 0). 기존 Hero·종목별 목록·성적표·스냅샷 계산 diff 0. 알려진 한계: 기간 중 산 종목의 사기 전 등락 포함, 미국 하루는 달러 기준이라 자산 변화 하루와 다름, 국내는 주식형만 코스피와 비교, 코스닥도 코스피와 비교.

---

## 2026-11-10 (v4.72)

### 상세·주식 '오늘' 등락 칩 — 장중 `오늘`, 장 종료 후 `M/D 종가` (#4.72, 이슈 #134, 브랜치 issue-4.73, risk low, 버그)
- **왜**: 칩이 기준 종가를 `refDate === 오늘(KST)`로만 골라 개장 전·주말·휴장일에 같은 종가끼리 비교한 0.0%, 한국 낮 미국 종목은 환율 변동분만(모든 종목 같은 값), 새벽에는 어제 등락을 `오늘`로 표시. 대표 기대: 장중 오늘 등락률, 장 종료 후 종가 기준 등락률.
- **변경**: 신규 `today-chip.ts`(상태 판정 순수 함수 `getTodayChipSession` + `computeTodayChip`). 장중 `오늘` = 현재가 ÷ 전 거래일 종가, 그 밖 `M/D 종가` = 마지막 거래일 종가 ÷ 그 전 거래일 종가(현재가 미사용, 미국은 현지 거래일). 종목 칩 = 현지 통화 가격 등락률, 헤더 = 원화 평가액 가중(`오늘`/`종가`). 두 종가를 못 구하면 칩 숨김. 마감~컷오프 구간은 국내 `오늘`(현재가 ÷ 전 거래일 종가, main과 같은 값), 미국(KST 06~07시, 애프터마켓 혼입 가능)은 숨김(`AFTER_CLOSE_GAP_FALLBACK_LIVE`). 칩 쿼리는 `kstAccessDay` 고정(기존 캐시 변형). `stock-tab.tsx` 칩 prop `dailyRate` → `todayChip{rate,label}`.
- **범위**: 서버 응답·저장 키·스키마·동기화 diff 0. `computeDailyStockProfit` 기본 분기(Hero·일 탭·스냅샷·성적표·홈) diff 0. 알려진 한계: 국내 휴장일 16:00~다음 개장, 미국 휴장 다음 날 KST 07:00~23:30, 미국 종목 일·월 KST 00~07시는 응답에 맞는 종가쌍이 없어 숨김(보강은 4.72 tech-review). 미국 조기 폐장 시각 미반영(13:00~16:00 ET도 `오늘`, 값은 그날 등락).

---

## 2026-11-10 (v4.71)

### GA 화면별 참여 시간 귀속 수정 (#4.71, 이슈 #131, risk low)
- **왜**: `send_page_view:false` + 새 화면 title page_view만 보내, gtag가 직전 화면에서 쌓은 참여 시간(_et)을 새 화면 title에 실었다(화면 우열 판독 불가).
- **변경**: `ga.ts trackScreen`이 화면 전환 시 직전 화면 title·경로의 `screen_leave`(비예약 커스텀 이벤트, GA4 예약명 user_engagement 회피)를 page_view 직전에 1회 보냄. page_view 호출·조회수·활성 사용자 불변. 저장·서버 전송 값 종류 불변(title·경로 모두 기존 사전). 판독 경계: 머지일 이후 참여 시간만 화면별로 사용.

---

## 2026-11-10 (v4.70)

### 월별 기록 — 지난 여러 달의 자산군별 금액을 결산 안에서 한눈에 (#4.70, 이슈 #127, risk low, 대표 승인 대상)
- **왜**: 엑셀에 매달 자산군별로 한 줄씩 적던 사용자가 결산 뒤에도 시트를 연다. 자산군별 금액은 월 스냅샷 `breakdown`에 저장돼 있었지만 그리는 화면이 없었다(결산은 화살표로 한 달씩, 구성 블록은 2시점 %만).
- **변경**: 월 탭 구성 블록 아래 `월별 기록` 행(기록된 달 ≥2) → bottom 시트에 달마다 한 줄(월·기록일·가진 자산군 금액·순자산, 최신순). 줄 조립 `report/monthly-log.ts` `buildMonthlyLog` 1개(결산과 같은 `listSettlementMonths` 범위·스냅샷 값·live breakdown 재사용, 줄 단위 합 검증 >1원이면 순자산만). GA 화면 키 `activity:change:monthly-log` 1개(열 때). AI 행 진입 지연 120→160ms(stagger).
- **범위 밖**: 증감·%·비중 열(#32 정본 = 결산 Hero), 행 탭 이동·선택 달 강조, `dailyArchive`, 복사·내보내기, '월말' 표기. 저장 키·스키마·동기화·공유 토큰·서버 전송 diff 0.
- **대표 피드백 R3(2026-11-10)**: "차이 금액 인지가 불편, 다이얼로그 말고 페이지에서 성과 UI로 변화 금액까지" → 진입 행·bottom 시트·표·가로 스크롤 전부 폐지, 월 탭 구성 블록 아래 SECTION 카드 `MonthlyLogBlock`(`monthly-log-block.tsx`) 인라인. 달마다 한 줄(월·기록일 / 순자산 원 단위 + 앞 기록 대비 변화 손익색 `+`/U+2212), 줄 탭 펼침으로 자산군 금액·순자산 기여 변화(이번 달 기본 펼침, 합 = 순자산 변화), 7줄째부터 `이전 N개월 더 보기`. 신규 순수 함수 `buildMonthlyLogChanges`·`formatMonthlyLogDelta`. R3 보정: 변화는 순자산·자산군 모두 표시값(원 반올림)끼리의 차(소수 달 ±1원 어긋남 해소, 최대 잉여법 제거), 1280 패널 변화 열 최소 폭(`sm:min-w-28`, 10억 이상 변화도 넘침 없음)으로 우측 끝 정렬. COO R3: 결산 Hero 증감 `settlementDelta` = `round(끝) − round(시작)`(화면 금액 차 — Hero·허브 자산 변화 카드·원인 합계·AI 질문·월별 기록 변화가 소수 달에도 원 단위 일치, 정수 데이터 불변), 데모 스냅샷 미기록 차이 픽스처를 @M-1→@M-2로 이동(데모·체험 기본 펼친 이번 달 패널에 자산군 변화가 보이게). 삭제: `monthly-log-sheet.tsx`, `MonthlyLogButton`, `monthlyLogRangeLabel`, GA 화면 키 `activity:change:monthly-log`(화면 아님). 짧은 표기(억·만)는 화면에서 폐지(`formatMonthlyLogAmount` short 경로는 남김). 구성 바 최소 폭(R1)·저장 diff 0 유지.

---

## 2026-11-09 (v4.69)

### 하단 네비 6칸 → 5칸 — 업데이트를 가운데로, 인증카드는 상단 오른쪽(설치 앱 포함) (#4.69, 이슈 #125, risk low, 대표 승인 대상)
- **왜**: 강조 버튼 '업데이트'가 4번째 칸이라 가운데가 아니고 탭 순서가 스와이프 순서와 어긋남. 인증카드는 핵심 기능이라 브라우저와 같은 '맨 위 오른쪽'으로 통일(더보기는 설정 전용, 더보기 이동안은 대표 반려로 철회 — v2).
- **변경**: `bottom-nav.tsx` 홈·상세·업데이트·성과·더보기 `grid-cols-5`(체험 3), 인증카드 칸·다이얼로그 제거, `aria-current`·testId. `top-bar.tsx` 홈에 `pwa-home-header`(PWA 한 줄 헤더: 로고+인증카드, 높이 40px+safe-area), 설치·더보기·선택기만 `contents pwa-hide-actions`로 숨기고 인증카드는 standalone에서 노출, 클릭 시 `recordVisit("share-card")`, 리스너 출처 `detail.source ?? "home_tip"`. 상세·성과 허브 제목 줄에 PWA 전용 발송 버튼 `HubShareButton`(`dispatchOpenShareCard(undefined,"top_bar")`). `globals.css` `pwa-home-header`·`pwa-home-logo`(PC PWA 숨김)·`pwa-only-action`. `tool-menu.tsx`·`app-features.ts` main과 동일.
- **범위**: 저장 키·스키마·동기화·서버 전송 diff 0, 브라우저 화면·FAB·홈 결산 팁·`PAGE_ORDER` 무변경. 인증카드 대화상자·리스너는 top-bar 1곳. 테스트 `bottom-nav-5col.test.ts`.

### 인증카드 버튼 메인 인디고 + 락업 S를 Leckerli One 글리프로 (#4.66 이슈 #125 R8)
- **왜**: 대표 "인증카드 다크/화이트 색상은 좀 튀긴 하네, 메인 인디고 적용" · "S 아이콘은 Leckerli One 폰트 모양(오른쪽 대각선으로 누운 자연스러운 s자)이 제일 예뻐".
- **변경**: `menu-styles.ts` `HEADER_ENTRY_BTN_INVERT` → `HEADER_ENTRY_BTN_BRAND`(`bg-brand text-white`·누름 0.96), 두 버튼 적용. `brand-symbol.tsx` 기하형 C 레이어 S path 2개 → Leckerli One "S" 아웃라인 path 1개(fonttools 변환, 폰트 파일 미포함), `globals.css` `.bs-hi/.bs-lo` 제거·`.pwa-home-symbol` 18.21px(S 잉크 높이 15.25, lg 21.01px·17.6)·여백 -4.46/-5.14px, 워드마크 `ml-[0.7px] lg:ml-[0.81px]`. design-system §5·§14.
- **범위**: 저장·스키마·동기화·서버 전송 diff 0. 워드마크·하단 홈 탭·앱 아이콘·파비콘 불변. 테스트 `brand-lockup.test.tsx`·`bottom-nav-5col.test.ts`.

### 인증카드 버튼 foreground 반전 + 락업 S 추가 축소 (#4.66 이슈 #125 R7)
- **왜**: 청록(`MAIN_PALETTE[5]`) 버튼은 차트 데이터색 재사용이고 흑백 로고와 이질, 인디고는 하단 업데이트 버튼과 겹침(대표 의견) → 로고와 같은 흑백 체계. 대표 "S 사이즈 확실히 줄여줘".
- **변경**: `menu-styles.ts` `HEADER_ENTRY_BTN_INVERT`(`bg-foreground text-background`·누름 0.96) 신설, `top-bar.tsx`·`hub-share-button.tsx` 인라인 청록 제거 후 적용. `.pwa-home-symbol` 19.58→17.31px(S 잉크 16.4→14.5, lg 22.6→19.98px·16.73), 음수 여백 -3.3/-3.81px, 워드마크 `ml-[1.22px] lg:ml-[1.41px]`(간격 규칙 42.3% 유지). design-system §5 진입 버튼 규약 1줄.
- **범위**: 저장·스키마·동기화·서버 전송 diff 0. 크기·히트영역·aria 불변, 더보기 회색 버튼 불변. 테스트 `brand-lockup.test.tsx`·`bottom-nav-5col.test.ts`.

### 홈 상단 공식 로고 락업 — S 심볼 + 워드마크, 단일색 `--brand-logo` (#4.66 이슈 #125 R2~R6, logo-spec)
- **왜**: PWA 홈 맨 위 줄이 "홈" 글자·필기체 S라 공식 서비스 느낌이 없다는 대표 지적. 대표 R3~R6 피드백(C 레이어 S, 크기 축소, 흑백, 글자 간격·S 크기)을 ui-designer 확정 사양(logo-spec)으로 고정.
- **변경**: `brand-symbol.tsx` 외곽선 면 path 2개(`bs-hi` 틈 1.3 / `bs-lo` 틈 1.7, 1x 화면 교체), `brand-wordmark.tsx` Pretendard Variable 750 아웃라인(자간 +110/2048em + 커닝 시크 -15·크릿 -80·릿에 +40·에셋 +60, R6에서 +50→+110), `brand-lockup.tsx` 워드마크 여백·무게중심 하향, `globals.css` `--brand-symbol`·`--brand-wordmark` → `--brand-logo`(라이트 #111111/다크 #F2F3F6), `.pwa-home-symbol` 19.58px(S 잉크 16.4, R6에서 17.6→16.4, lg 22.6px). design-system.md §14 신설.
- **범위**: 저장·스키마·동기화·서버 전송 diff 0. 브라우저 모드는 심볼만(32px 박스), 앱 아이콘·파비콘·인증카드 청록 버튼 불변. 테스트 `brand-lockup.test.tsx`.

---

## 2026-11-09 (v4.68)

### 억 단위 축약 표기 부동소수 오차 수정 — 2.3억이 2.29억으로 보이던 문제 (#4.68, 이슈 #129, risk low)
- **왜**: `number-utils.ts` `truncToFixed`(`Math.floor(n*100)/100`)가 부동소수 오차로 0.01을 한 번 더 버려, 홈 최근 순자산 막대·순자산 달력 칸에서 230,000,000원이 `2.29억원`, 201,000,000원이 `2억원`으로 표시(1억~50억 100만원 배수 4,901개 중 284개, 백만·만 구간 각 9,900개 중 570개). 같은 값이 원 단위 화면에선 `230,000,000원`이라 어긋남.
- **변경**: `formatShortCurrencyDecimal`은 원 단위 정수(`Math.round`, `formatCurrency`와 같은 기준)를 100만·1만·100원으로 정수 나눗셈 후 버림, 새 내부 헬퍼 `formatTruncatedUnits`로 소수부·끝 0 제거·천 단위 콤마. `truncToFixed` 제거. `formatShortCurrency`(0.1억)도 같은 패턴이라 1,000만원 정수 나눗셈으로 정리(1억~50억 100만원 배수·무작위 30만 값 기준 표기 변화 0).
- **범위**: 저장·스키마·동기화·서버 전송 diff 0. 바뀌는 표기는 위 오차 값뿐(무작위 금액 40만 개 비교 시 차이 0). 테스트 `src/lib/__tests__/number-utils-short.test.ts`.

---

## 2026-11-09 (v4.65)

### 외화 환율 잔차를 환율 원인으로 — 대출 예측·주식 매도 오표시 해소 (#4.65, 이슈 #122, risk medium)
- **왜**: 구간 안에서 산 외화 주식·들어온 외화 현금까지 시작 보유분처럼 환율 재평가돼, 환율 몫이 시세·잔차로 새어 음수면 `대출 일부 예측`(D6)·홈 `주식 매도 −`로 보임(F1·U1·U3 −20,000, P5b −5,800). Hero·합계는 정확, 원인 분류만 오류.
- **변경**: `asset-report.ts` `costFxRevaluation`이 주식·현금 몫을 **구간 시작 보유분** 기준으로 계산(주식 = `deriveBaseSnapshot`로 구간 안 반영 거래 역산 후 구간 안 매도분 제외, 현금 = 구간 안 반영 외화 입출금 역가감). 구간 안 외화 매수·입출금의 (끝 환율 − 체결 환율) 몫(`flowFxStock/flowFxCash`)은 `fxEffect`·`fx` 원인에 더하고 `stockManual`·`dCostCash`·`savingEffect`에서 같은 금액을 뺌(키 간 이동, 합계 불변). 시세·시작 보유분 환율(`fxEffectBase`) 계산은 불변. `reflectedTradeFlow` 위 '한계 ②' 주석을 4.64 이후 상태로 정정.
- **범위**: 예측 분기 diff 0, 외화 거래·외화 입출금 없는 구간 causes = main 동일(테스트 단언 `fx-flow-residual.test.ts`), 새 원인 키 0, 저장·스키마·동기화 diff 0.
- **QA 후속(연결 매도 대금)**: 같은 외화 현금 계좌에 연결 입금된 외화 매도는 `realizedSellGains`가 대금을 입금 기록과 같은 환산(끝 환율)으로 잡고 `matchRecordedTransferDetail`의 짝 금액도 입금 환산으로 맞춤 → 체결>끝·체결<끝 양방향, 대출 유무와 무관하게 대출·기록 안 된 변화·시세/순유입 짝 잔차 0(환율 한 줄). 짝 없는 일반 외화 입금은 현행(끝 환율) 유지.

---

## 2026-11-09 (v4.64)

### 12월 결산 대비 결함 수정 — 반영 매도 실현손익 시세 분류·미리보기 문구 + 품질 정돈 묶음 3 (#4.64, 이슈 #117·#118, risk medium)
- **왜**: 12월 결산 창 리허설(qa)에서 반영된 이익·손실 매도의 실현손익이 월 결산 `기록 안 된 변화`·홈 `주식 매수 +`로 표시됨(Hero·합계는 정확, 원인 분류만 오류).
- **D1**: `asset-report.ts` 정밀 분기(`bothEnriched`)에서만 `realizedSellGains`(신규 내부 함수)가 반영 매도마다 `R = 체결액(tradeKrwRate) − 수량 × 매도 직전 평단 × 월초 환율(prev.fx)`을 계산(직전 평단 = `deriveBaseSnapshot`로 현재 포지션에서 그 매도 이후 거래 역순 제거). `priceEffect`·`price:stock/crypto`에 +R, `stockManual/cryptoManual`·`savingEffect`에서 −R (키 간 이동, 합계 불변). 매도 대금(`sellEffect`·`reflectedTradeFlow`·짝 함수) 불변. 평단 역산 불가(전량 매도 평단 소거 등)면 R=0. 예측 분기 diff 0. 저장·스키마·동기화 diff 0.
- **D4**: 보유 현황 맞추기 미리보기 `resync-notice-2` → "바뀐 수량·평단은 이번 달 결산 증감에 함께 반영돼요"(주식·코인 동일).
- **#118**: 연 수익률 0.0% 회색(`AnnualizedReturn`이 `profitTone(cagr,cagr,1)` 재사용), 허브 `평가손익` 라벨 `whitespace-nowrap`, 보유 현황·잔액 맞추기 창 열림 시 포커스=제목, FAB 경유 창 닫힘 포커스 복귀 공용 훅 `useReturnFocusOnClose`(`lib/restore-focus.ts`).
- 알려진 한계: 외화 매도의 환율 몫은 R에 함께 들어가 시세로 감(2차 오차). 전량 매도는 평단이 지워져 R=0(현행 동작). D3(기간 중 산 외화 주식 재평가)는 이번에 제외.

---

## 2026-11-09 (v4.63)

### 거래 연결 계좌 — 해외주식을 원화 계좌·대출로 연결 (#4.63, 이슈 #119, risk medium)
- **왜**: 원화 예수금으로 해외주식을 사는 것이 기본형인데 연결 후보가 같은 통화 현금뿐이라 행이 사라졌다(통화 축 누락, C49).
- `linkCandidates` 외화 거래에 원화 현금·대출 추가, `buildLink`가 `linkAmountIn`으로 원화 환산(엔진 `tradeKrwRate` export 1줄 재사용, 마지막에 한 번만 반올림). 짝 기록은 기존 KRW 현금/대출 기록·id 규칙 그대로(스키마·저장 키·동기화 diff 0, 엔진 로직 diff 0).
- 거래 폼: 원화 계좌 선택 시 빈 체결 환율 칸을 현재 환율로 채우고, `buildTransaction`이 저장 시점에 환율을 보장(없으면 사유 `rate`로 차단). 미리보기 표시 통화 = 선택 계좌 통화, 보조 줄 환산식. 지난달 거래일이면 안내 1줄(`account-link-note`).
- 의도된 부수 효과: 원화 연결 매수는 가중평균 환율에 채운 환율 반영, 원화 연결 매도는 양도세 추정 `estimated` 표시 빠짐. 한계: 처음 사는 티커·외화 현금↔원화 종목·환전 기록은 범위 밖.

---

## 2026-11-09 (v4.62)

### 품질 정돈 묶음 2 — 최신화 팁 유지·손익 0 회색·되돌린 맞추기·시트 포커스·320 줄바꿈 (#4.62, 이슈 #115, risk low)
- **왜**: 4.59·4.60 qa에서 나온 사용자 영향 5건(저장 스키마·저장 키·동기화·서버 전송·문구 변경 0).
- **A 홈 팁 유지**: `pickHomeTip`에 선택 입력 `keepShown?: "backup"|"refresh"` 추가, `shouldShowBackupNudge`·`shouldShowRefreshNudge`에 선택 옵션 `keepShown`(해당 종류 '오늘 노출' 검사만 건너뜀, 미지정 = 현행). `HomeTipBox`가 이번 마운트 승자(backup·refresh)를 ref로 기억해 effect 재실행(시세 동기화 등)에도 같은 팁 유지, activate·X 닫기에서 해제. 결산·세금·공지 분기 diff 0.
- **B 손익 0**: 상세 전용 `profitTone(value, rate?, digits?)`(detail-summary-header.tsx)로 `ProfitMetric`의 0 판정을 단일 출처화. 코인·주식·부동산·실물 카드/하위 행/펼침, 그 외 N종목, 공유 캡처 주식 카드, 허브 행이 0이면 회색·부호 없음. 부동산 '실투자금 수익률'은 수익률 값(소수 1자리)으로 판정. 테스트용 `data-testid="profit-text"`·`hub-profit` + `data-zero`. `theme.ts`(`getProfitLossColor`)·결산·Hero·성적표 diff 0.
- **C 되돌린 맞추기**: `holdings-resync-dialog`의 `undoRef` 사본에 `kind·prevRefreshedAt·appliedAt` 추가, `markCategoryRefreshed`가 쓴 시각을 반환, `restoreCategoryRefreshed`(compare-and-restore, `nudgeShownOn`·다른 자산군 보존)로 되돌리기 성공 시 refresh 메타 원복. 되돌린 뒤 닫으면 복귀 신호 없음(`shouldNotifyResyncClose`).
- **D 시트 포커스**: 공용 `lib/restore-focus.ts`(`restoreFocusAfterDialog`)로 잔액 맞추기 창 복귀 순서를 추출해 FAB 시트도 사용. 방법 선택 등으로 다른 창이 이어서 열리면 `handoffRef` 플래그로 복귀 생략(1순위), 열린 다른 대화상자가 있으면 생략(보조).
- **E**: 현금·대출 입출금 도움말 `<p>`에 `break-keep text-pretty`(+`data-testid="tx-help"`).
- 알려진 한계: 토스트 되돌리기는 이미 열린 복귀 목록의 ✓를 닫기 전까지 유지. 허브 행 수익률은 기존 소수 2자리 유지(`0원 (0.00%)`).

---

## 2026-11-09 (v4.61)

### 첫 화면 빈 화면 없애기 — 웰컴 첫 부분 먼저 보여 주기 (#4.61, 이슈 #113, risk medium)
- **왜**: 루트 `/`가 `isDataLoaded` 전까지 `null`이라 0건 새 방문자(특히 인앱·느린 회선)는 빈 검은 화면(+인앱 빈 덮개)을 보았고, JS 없는 수집기는 본문을 읽지 못했다.
- `welcome-intro.tsx`로 히어로·신뢰 줄 공용 조각 추출(`WelcomeHero`·`WelcomeTrustLine`), `page.tsx` 로드 전 분기가 `RootFirstPaint`를 SSR. `layout.tsx` 기존 `data-device` try 블록에 키 3개 존재 판정 → `html[data-has-assets]`, `globals.css` 1규칙으로 보유자는 조각 숨김. 조각→웰컴은 `skipHeroEnter`로 같은 자리 무애니메이션.
- `resolveInAppGate`에 `hasAssetsAttr` 추가: 로드 전이라도 속성·복원 해시·동기화가 없으면 `cover` 대신 `welcome`.
- CLAUDE.md 4장 머지 위임 ⑥을 11-09 대표 결정(결산 창 머지 제한 폐지, 판독 경계일 기록 유지)에 맞게 정정.
- 새 문구 0, 저장 키·스키마·동기화·서버 전송 변경 0(키 존재만 읽음).

---

## 2026-11-09 (v4.60)

### 품질 정돈 묶음 — 삭제 고아 거래·외화 문구·반올림·손익 0 색·포커스·작은 이미지 (#4.60, 이슈 #109, risk medium)
- **왜**: 결산 원인·입력 안내가 "내 숫자가 맞나"를 의심하게 만드는 결함 6건(저장 스키마·저장 키·동기화 변경 0).
- **(a) 자산 삭제**: `deleteCryptos(ids)`·`deleteStocks(ids)`로 일원화(단건 `deleteCrypto`·`deleteStock`은 래퍼, 코인·주식 탭의 직접 `saveData` 제거, `saveData` 1회). 순수 계획 `planDeleteCryptos`·`planDeleteStocks`(asset-data-context.tsx)는 항목마다 삭제 시점 평가액을 `computeNetAsset`(스냅샷 합계와 같은 식, 원화 환산)으로 구해 반올림 0원 이하(전량 매도·코인 부동소수 잔량·시세 0·상장폐지)면 그 항목 거래를 보존하고 나머지는 id 기준 전부 삭제. 예외 ②: 연결 짝 기록이 있고 거래일 또는 짝 기록일이 이번 달 1일(`today = todayKst()`) 이전인 거래도 보존(닫힌 달 id 짝 상쇄 유지, A4·A6 = main). 연결 짝 기록·계좌 잔액은 건드리지 않음(4.58 F24). 흐름 표 A1~A8 vitest 고정.
- **(b)** 잔액 맞추기 창 `onCloseAutoFocus`: 보이는 `[data-tutorial="tutorial-fab"]` → 열기 직전 요소 → `main`(이 창만).
- **(c)** `ProfitMetric` 안에서만 반올림 0이면 부호 없이 `text-muted-foreground`(`getProfitLossColor` 불변).
- **(d)(e)** 외화 전액 차단 문구 통화 표기(`cash-tx-input`·`link-text`), USD 반영 입출금 잔액·미리보기 `roundMoney` 반올림.
- **(f)** `parse-screenshot`: PNG·JPEG·WEBP 헤더 판독(`image-size.ts`)으로 긴 변 < 200px이면 Gemini 미호출·한도 차감 0, Gemini 빈 배열과 같은 응답(`respondParsed` 공유). 판독 실패·HEIC 통과, 프롬프트·로그 변경 0.
- 알려진 한계: 일부 매도 후 잔량째 삭제하면 `입금 +Y`·`시세 −V` 두 줄이 남음(주식 단건 main 현행과 동일) / 이미 남은 고아 거래는 정리하지 않음(연 탭 원인에 올해 말까지) / 지난달 원인 라벨 이동은 원가 없는 레거시 스냅샷만(Hero·합계 불변).

---

## 2026-11-09 (v4.59)

### 이어서 맞추기 — 보유 현황 정렬·저장 후 목록 복귀 (#4.59, 이슈 #110, risk low)
- **왜**: 자산군마다 저장할 때마다 시트가 닫혀 3~4탭을 반복하고 "다 했나"를 기억해야 했다.
- `markCategoryRefreshed(category, {notify?})`가 저장 후 window 이벤트 `asset-category-refreshed`를 발행(호출부 수정 0). 보유 현황 맞추기는 결과 화면이 열려 있어 `notify:false` + 닫을 때 `notifyCategoryRefreshed`, 거래 스크린샷 2곳은 `notify:false`.
- FAB: 보유 우선 정렬·`추가`·오늘 맞춤 ✓, 창 선택 시 메모리 ref로 대기 → 같은 자산군 신호에 holdings로 복귀(상단 줄·[완료]). 홈 팁·결산 진입 동일. 순수 함수 `lib/asset/resync-return.ts`, `isRefreshedToday`(KST).
- GA는 `feature_use` category `resync_continue`(page_title `이어서 맞추기`) 1개만 추가. 스키마·저장 키·동기화·서버 전송 변경 0.

---

## 2026-11-09 (v4.58)

### 거래 연결 계좌 — 거래 저장 시 현금·대출을 함께 증감 (#4.58, 이슈 #103, risk high)
- **왜**: 매수·매도를 기록해도 현금·대출 잔액을 따로 고쳐야 했고 거래를 지워도 돈 쪽이 그대로였다. 결산에도 입금↔매도 짝이 없어 `순유입 +X / 기록 안 된 변화 −X`로 갈렸다.
- **저장 방식**: 새 필드·스키마·저장 키·동기화 형식 변경 0. 짝 기록 id 규칙 `ctx_link_<거래id>`(현금)·`ltx_link_<거래id>`(대출). 정본 `lib/trade/linked-record.ts`(id·금액·가드·`buildLink`·`planRemoveLink`·`removeLink`, 접두어 직접 사용 금지). 구버전은 id 문자열을 그대로 보존(zod strip이 새 필드를 지우는 4.55 D1형 탈락을 구조적으로 차단).
- **저장·삭제**: `addTransactionWithPosition`·`addTransactionsBatch`(신규 종목 단건)·`addCryptoTransactionWithPosition`에 `link` 옵션, `deleteTransactionWithPosition`·`deleteCryptoTransactionWithPosition`에 `{revertLink}` 옵션. 모두 `saveData` 1회(실패 시 전부 이전 값). 가드: 현금 출금 초과·대출 상환 초과·대금 0 이하·통화 불일치(외화 거래의 대출)·중복·**거래일이 이번 달(KST)이 아니면** 저장 함수가 `false`. 되돌림은 짝 기록의 현재 값 기준, 감소 방향 하한(현금은 cashSchema가 balance>0을 요구해 1원/0.01, 대출 0, cto 5-6 수용), 짝 없음·계좌 없는 고아는 건드리지 않음, `reflected:false` 짝은 기록만 삭제.
- **결산·홈**: `matchRecordedTransferDetail`에 id 짝 0단계(출금↔매수 `out`, 입금↔매도 `in`, 대출 증가↔매수·상환↔매도 `viaLoan`) 추가, 나머지 ±3일 추정 코드 무변경. `matchRecordedTransfers` = out − in(음수 가능), `mapSettlementCauses` 가드 `> 0` → `!== 0`. `viaLoan`은 결산 `대출` 몫(`withLoanCause`의 대출 순증)에서만 제외(대출로 매수한 몫이 `대출`로 오표시되던 것). 홈 헤더는 풀 상쇄가 이미 0으로 만들어 `viaLoan` 소비 없음(측정). 과거 결산 diff 0: 4.55 함수를 골든 사본으로 박제한 무작위 400건 속성 테스트.
- **UI**: 거래 입력(주식·코인 수동, 즉시 반영 ✓일 때) `연결 계좌` 행(`forms/trade/link-account-row.tsx`, 기본 `연결 안 함`·기억 없음)+잔액 미리보기+오류 박스, 삭제 다이얼로그(주식 `DeleteRollbackDialog`·코인 모달) 되돌림 1줄, 토스트 꼬리. GA `feature_use` category `linked_trade` = `거래 저장·계좌 함께 반영`(연결 저장 성공 1회=1건).
- 알려진 한계: 구버전 기기에서 연결 거래를 지우면 짝 기록·잔액 잔존 / 공유 토큰으로 옮기면 연결 풀림 / 두 기기 동시 편집 시 거래와 잔액이 갈라질 수 있음(원격 우선 병합) / 외화 거래는 같은 통화 현금만(대출 불가) / 현금 계좌를 0원으로 만드는 연결·되돌림은 불가(저장 스키마 제약).

---

## 2026-11-08 (v4.55)

### 실물 자산 등록 (#4.55, 이슈 #58, risk high)
- **왜**: 금 등 실물이 현금·부동산 'other'로 위장 입력되거나 빠졌다. 평가액 방식(매입가·현재 평가액, 시세 없음)으로 5유형(금·은·귀금속·수집품·기타) 등록.
- **저장**: 분리 키 `secretasset.physical_assets`(secretasset_ 접두 아님 → 구버전 clearAssetData·접두 정리에 안 걸려 롤백해도 보존). `saveAssetData`/`saveAssetDataRaw`는 `physicalAssets===undefined`면 분리 키 미변경, `[]`는 삭제 의도, 본 키에는 쓰지 않음. `getAssetData`가 합쳐 `assetData.physicalAssets`로 제공. 읽기는 완화(모르는 type→other, passthrough, 제약 위반 항목 유지).
- **동기화·가져오기**: 원격 키 없음=로컬 유지, 있으면 mergeById. 구 백업 가져오기는 유지+토스트(`physicalKept`). 공유 반영·모든 삭제·데모 주입은 `clearPhysicalAssets`. 월 스냅샷 병합은 구버전(physical 필드 없음)이 로컬 실물 스냅샷을 덮지 못함. 체험 거부는 분리 키도 확인.
- **합산·결산**: `computeNetAsset/Cost`·스냅샷(`breakdown.physical`·`cost.physical`, 0도 기록)·요약, `hasAnyAssets` 인라인 5종 체인 교체. 원인 키 `price/buy/sell:physical`(평가 갱신은 부동산과 합산, 매입은 내부 이동 풀, `matchRecordedTransfers` 후보에 실물 신규분), #84 COLLS·#83 구성 키(색 MAIN_PALETTE[8]).
- **UI**: `physical-input.tsx`·`physical-tab.tsx`, 허브 카드(1건 이상), FAB 행, 홈 도넛 조각(색 고정, 클릭→실물 탭), 복원 코드 미포함 안내. GA는 page_title '자산 저장·실물 자산'만.
- 알려진 한계 4개: 구버전 '모든 삭제' 후 잔존·노출 / 구버전 기기가 쓴 날 일별 그래프 하락 / 복원 코드 제외 / 구 백업 가져오기 시 실물 기존 값 유지.

---
## 2026-11-09 (v4.55)

### 스크린샷 인식 실패 뒤 다음 행동 + 최신화 팁 보유 자산군만 + 연 탭 자동 기록 안내 (#4.55, 이슈 #99, risk low)
- **왜**: 추가 스크린샷(주식·코인·현금·대출) 인식 실패 시 토스트만 남아 직접 입력으로 가려면 FAB부터 다시 들어가야 했고, 마법사엔 갈 곳이 없었다. 실패와 성공이 같은 GA title이라 누수 판정도 불가.
- `ScreenshotFailNotice`(`forms/asset-update/screenshot/screenshot-fail-notice.tsx`) 신설: 업로드 칸 자리 박스(role=alert, [다른 캡처 고르기]/[직접 입력]). 서버 오류는 `lib/asset/screenshot-fail.ts` `mapParseErrorTitle` 목록 매핑(원문 미노출). [직접 입력]=`runDirectInput`(asset_add_start manual 1건 + FAB와 같은 도착지, 현금·대출 보유자는 잔액 맞추기, 마법사 `directInput="add"`는 항상 추가 폼). 남은 횟수 0이면 [다른 캡처] 숨김·한도 박스 미렌더. 같은 사건 토스트 제거, 티커 누락 토스트에 `체크를 풀면 나머지만 등록돼요` 추가.
- 마법사: `page.tsx` 마법사 분기에 입력 폼 4종 숨김 마운트, `CategoryStep`은 `createStepCompleter`(onSaved와 건수 증가 중 먼저 온 1회만, `key={phase}`로 초기화).
- GA: `screenshot_parse` result fail·empty → `스크린샷 등록 실패·<자산>`(ga.test 갱신).
- p2-1: `heldRefreshCategories`·`getStaleCategories(…, held?)`·`shouldShowRefreshNudge({held?})` — `home-tip.ts`만 보유 필터 적용(결산 화면 diff 0).
- p2-2: 연 탭 Hero `note` 슬롯에 `작년 말 값은 … 기록이에요 · 고치기`(`lib/asset/yearly-auto.ts`), 지난 연도 `자동` 항목은 수정 폼 메모를 빈 칸으로 시작(저장 = 확정).
- 스키마·저장 키·동기화·overwrite-guard 코드 변경 0. `ADD_TRIGGER_EVENTS`를 `asset-dispatch.ts`로 이동(FAB `EVENT_MAP` 단일 정의).

---

## 2026-11-09 (v4.52)

### 현금·대출 잔액 한 번에 맞추기 + 소형 정리 6건 (#4.52, 이슈 #93, risk low)
- **왜**: 현금·대출 갱신 입구 3곳(FAB·홈 최신화 팁·결산 '다음 달 준비')이 모두 `○○ 추가` 폼을 열어, 기존 잔액은 계좌마다 상세 수정(필드 6~10개)으로만 고칠 수 있었다.
- 현금(대출) 보유 ≥1건이면 FAB `select-method` 제목이 `현금성 자산 업데이트`(`대출 업데이트`), `직접 입력`은 `계좌별(대출별) 잔액 고치기`로 열리는 `BalanceResyncDialog`(`forms/asset-update/balance-resync-dialog.tsx`, `category="cash"|"loan"`). 바뀐 행만 입력 → 저장 1번. 보유 판정은 `handleHoldingsClick`에서 1회(`getAssetData()`), 0건은 기존 추가 흐름 diff 0.
- 순수 로직 `lib/asset/balance-edits.ts`: `applyBalanceEdits`(저장 시점 최신 목록 map 교체, balance 외 필드 보존·없는 id 건너뜀)·`checkBalanceRow`(현금 0 차단·대출 0 허용·10배/1/10 경고)·입력 문자열 정리·`orderBalanceRows`(상세 탭 순서). 저장은 `getAssetData()` 기반 `saveData` 1회(`updateCash`/`updateLoan` 반복 금지, C37), 성공 후 `markCategoryRefreshed`·`asset_save(update, manual)`·`feature_use balance_resync`(`잔액 맞추기 저장`).
- 변경 ≥1이면 바깥 탭·Esc 차단, `새 계좌 추가` 링크 비활성. 데모 시드에 USD 현금 1개 추가(1,000 USD).
- p2: ① 연 탭 빈 상태·1점 Hero 인라인 링크 `작년 말 순자산 넣기`+연도별 저장 `asset_save` 계측 ② 현금·대출·주식·코인 직접 추가·수정 성공 시 `markCategoryRefreshed` ③ 기능 팁 `isNew` 3개 해제 ④ 업로드 문구 `눌러서 사진 고르기`·`bg-amber-500/10 px-3` 오타 ⑤ FAB `환율 설정`→`적용 환율`, `exchange-rate-input.tsx` 삭제 ⑥ 자동 저장 실패 알림 `saveAssetDataNotify`(`lib/asset/save-failure.ts`, 세션당 1회 토스트+GA `저장 실패`).
- 스키마·저장 키·동기화·서버 전송·스냅샷·결산 코드 diff 0. 결산 픽스처 ①~④·월초 귀속은 `lib/asset/__tests__/balance-resync-settlement.test.ts`로 고정(외화 직접 수정+환율 변동 시 늘어난 수량의 환율 변동분은 현행 엔진상 시세 변동에 남음 — v1 무변경).
- 후속(cto 권고 (a)): 머리말 교체(임시), 현금·대출 입출금 기록에서 거래일 이후 맞춘 기록(`assetRefresh`)이 있으면 `즉시 반영` 아래 경고 1줄(`shouldWarnTxAfterResync`·`TX_AFTER_RESYNC_WARNING`, 문구 임시), 자산 간 흐름 시나리오 S1~S7을 `cross-asset-flow-scenarios.test.ts`로 현재 동작 고정.
- 결함 수정 #104(p0): 주식·코인 시세 동기화가 시작 시점 data 전체를 되써 요청 중 사용자 저장(현금·종목 추가/삭제)을 덮던 문제 -> 응답을 저장 시점 최신본에 시세 필드만 병합(`price-patch.ts`).
- 알려진 한계: 그대로 확인 저장 없음, `assetRefresh`는 기기 로컬, 직접 고친 차액은 `기록 안 된 변화`.

## 2026-11-08 (v4.53)

### /api/sync 남용 방어 (#4.53, 이슈 #97, risk medium)
- **왜**: sync 라우트만 자체 `getClientIp`(XFF 맨 왼쪽 신뢰)를 써 rate limit이 헤더 조작에 취약했고, GET은 한도 없이 서명 검증 전 Redis 조회를 수행했다.
- `getClientIp`를 `api-guard`로 통일, `guardL1Only`(`api-guard.ts`) 신설해 GET 120/분/IP, 토큰(assetId·nonce·sig·ts) 형식을 저장소 조회 전 401. 프로토콜·저장 포맷·스키마·서버 전송 값 무변경. 테스트 `sync-route-guard.test.ts`.

## 2026-11-08 (v4.51)

### 월 탭 자산 구성 변화 블록 (#4.51, 이슈 #83, risk low)
- **왜**: 월 결산은 금액·원인만 보여주고 "구간 동안 자산 비중이 어떻게 바뀌었나"는 앱 어디에도 없었다. 4.44에서 제거한 연 탭 카드와 달리 월 탭 Hero와 같은 구간(`resolveSettlementWindow`의 w)을 비교한다.
- `lib/report/composition.ts` `computeMonthComposition`(키 4개, 부채 제외, 반올림 정수 차), `views/activity/composition-block.tsx`(배지 "총자산 기준"+InfoHint 1개, 막대 2줄, 증감 행). `settlement-view.tsx`는 import·렌더 1줄·memo의 `live` 전달만 변경. 이번 달 끝값은 Hero·원인과 같은 `buildLiveAttributionCurr` breakdown.
- 스키마·저장 키·동기화·서버 전송·AI 프롬프트 무변경. GA는 기존 화면 키 `activity:change:composition`만 사용. 실물 키는 4.49(#58).

## 2026-11-08 (v4.50)

### 스크린샷으로 보유 현황 맞추기 — 주식·코인 (#4.50, 이슈 #91, risk high)
- **왜**: 기존 `덮어쓰기`는 증권사를 구분하지 않아 다른 증권사 줄을 지우고, `초기화 후 등록`은 전부 지우며, 둘 다 새 id로 교체해 매수일·매입 환율·메모가 사라지고 거래 기록이 끊겼다. 1장만·미리보기 없음·되돌리기 없음.
- 주식(코인)을 1건 이상 보유하면 `StockInput`(`CryptoInput`)이 `HoldingsResyncDialog`(`screenshot/holdings-resync-dialog.tsx`, `kind="stock"|"crypto"`)를 연다(열 때 1회 고정). 0건 첫 등록·온보딩·/ratio 인계는 기존 `StockScreenshotImport`·`CryptoScreenshotImport` 그대로(diff 0).
- `src/lib/asset/resync/`(순수, 저장·React 0): `merge`(장 증권사·계좌 확정, 장 사이 중복 합침 K1)·`match`(티커+category+증권사 ①①'②③④, 실데이터 broker 형태)·`diff`(추가·변경·삭제·그대로·확인 필요, 삭제 범위 증권사×category S1, 기본 체크 해제 S2)·`apply`(id·매수일·매입 환율·메모 승계, 평단은 화면 실값만, 수량·평단이 바뀐 항목만 positionSource manual)·`undo`(overwrite-guard 순수 함수 재사용, #84 목록 불변)·`crypto`(코인→Stock 어댑터, 범위=거래소).
- 서버 `/api/parse-screenshot` 응답에 additive 3개: 잘림 시 422+`code:"truncated"`, 주식 `quantityMissing`·`averagePriceEstimated`. 서버로 가는 자산 값 증가 0.
- 적용·되돌리기는 각각 클릭 핸들러의 `saveData` 1회(일반 편집 경로). 거래 기록은 만들지도 지우지도 않는다. 되돌리기는 결과 화면과 닫은 직후 토스트까지.
- GA `feature_use` category `resync_start`·`resync_apply`·`resync_undo`(맞추기 경로 `asset_save` 0).
- 알려진 한계: 화면에 없는 평단·매입 환율은 기존 값 유지, `rollbackTransaction`의 음수 기준 0 절단은 기존 현상(후속 이슈), 되돌리기 이후 복구는 백업뿐.

## 2026-11-08 (v4.49)

### 품질 정돈 묶음 (#4.49, 이슈 #89, risk low)
- **왜**: 검수에서 '비차단 후속'으로 쌓인 소형 화면·조작 결함 정리. 새 문구·저장 변경 0.
- ④ 320 주식 행: `stock-tab.tsx` StockRowHeader 비스크린샷에 `max-sm:` 가산(우측 열 `max-[359px]:max-w-[50%] min-[360px]:max-sm:max-w-[60%]` — 폭 구간 분리, 로컬 Playwright 실측: 320 '삼성전자' 이름 66px 1줄, 360+ 일반 금액(≤8천만) 행 39.5px 유지·375 이상은 억 단위도 1줄, 360 억 단위만 줄바꿈 63.5px, 320·340은 우측 50%라 일반 금액도 63.5px, 1280 40.8px 불변·손익 줄 wrap·금액/(%) nowrap·이름 `break-keep`). 웰컴·인증카드(screenshotMode) 클래스 불변. testid `stock-row-left/right`.
- ⑤ FAB 과거 순자산: 50ms `setTimeout` 제거 → `asset-dispatch.ts` 1회 요청 + `net-asset-chart.tsx` 마운트/이벤트 소비(3초 유효). `asset-change-view` 무변경.
- ① InfoHint 터치 40px 확장(`pointer-coarse` after, 래퍼 없음) + 설정 InlineSelector `relative z-10`.
- ③ 다크 ON 배지 `dark:bg-brand/15 dark:text-indigo-300`(라이트 불변).
- ② 배당 월 배지: 설명과 같은 grid 칸에 겹쳐 월 선택·해제 시 차트가 밀리지 않음, 배지는 `button`(키보드 해제), 히트 40px. testid `dividend-sub-slot`·`dividend-month-badge`.
- ⑥ 미사용 shadcn UI 27개 삭제(level-meter 보존).

## 2026-11-08 (v4.47)

### 동기화 충돌 시 내 수정 덮임 알림·되돌리기 (#4.47, 이슈 #84, risk high)
- **왜**: 자동 pull이 로컬을 원격으로 통째 교체해, 아직 올라가지 않은 수정·삭제가 알림 없이 사라졌다(수정 소실·삭제 부활). 저장 형식을 바꾸는 항목 단위 병합(B안)은 후속으로 두고, 저장 형식 무변경 A안으로 "모르는 손실"을 "알림 + 앱을 닫기 전까지 되돌리기"로 바꿨다. 덮임 자체를 막지는 않는다.
- `lib/cloud-sync/overwrite-guard.ts`: 마지막 push/pull 성공 시점 사본(메모리)을 기준으로 pull 직전·직후와 비교해 덮인 내 항목(수정 덮임·삭제 부활·원격 삭제)을 찾는 순수 함수 + `planRevert`(R1 재계산)·`applyRevert`. 새 저장 키·`secretasset_sync` 필드·payload·`/api/sync` 변경 0. 기준이 없으면(앱 시작 직후) 감지·폴백 알림 없음.
- `cloud-sync-provider.tsx`: runPush/runPull에 기준 갱신·감지 연결, 덮임이 있으면 토스트 1개(고정 id `sync-overwrite`)로 기존 "다른 기기의 변경을 반영했습니다."·"클라우드가 더 최신이라…"를 대체(후자는 pull 완료 뒤 필요할 때만). `showOverwriteList` 상태 노출, `revertOverwrites`는 `saveData`(사용자 편집과 같은 저장 + `notifyAssetUserEdit`) 후 일반 디바운스 push.
- UI: `sync-overwrite-dialog.tsx`(layout에 마운트, 목록·되돌리기 확인 단계·R1 건수 변동 문구), 기기 동기화 다이얼로그 armed 상태줄 아래 안내 카드. GA `feature_use` category `sync_overwrite_notice`(실행당 1회)·`sync_overwrite_undo`.
- 알려진 한계: 앱을 다시 연 직후 동기화에서 덮인 경우(오프라인 편집 후 재시작)는 알림도 되돌리기도 없음(현행과 같음). 되돌리기 push 실패 시 별도 안내 토스트는 두지 않음(기존 silent push 실패와 동일, 자동 push 재시도 경로). 덮임 토스트 설명·닫기 버튼 색을 앱 토큰(`text-muted-foreground`, `bg-popover`/`text-popover-foreground`)으로 지정해 OS·앱 테마 불일치 4조합에서도 4.5:1 확보(sonner 기본 색 덮어쓰기). 알려진 한계 추가: 사용자가 직접 바꾼 주식 종목명, 사용자가 직접 입력한 올해 연도별 순자산이 덮여도 감지하지 않음(자동 보정과 구분 불가, main과 동일해 악화 아님). UI 재검수 권고 반영(확인 박스 제목 `break-keep`, 토스트 닫기 히트영역 `-inset-2.5`). UI 검수 반영: 시세 토스트 정리(`dismissStaleToasts`)가 덮임 토스트를 닫지 않도록 id 제외, '되돌렸어요'는 이전 토스트 옵션 병합 없이 새로 표시, 확인 단계에서 목록 축소·포커스 이동. 비교에서 제외하는 앱 자동 갱신 필드: stocks(currentPrice·baseDate·name 보정·inactive*), crypto(currentPrice·baseDate), realEstate(marketEstimate*; currentValue는 사용자 입력), 올해 연도별 순자산(자동 업서트).

## 2026-11-07 (v4.46)

### 배당 투입 대비 배당 + 더보기·설정 정돈 + 홈 도넛 정돈 (#4.46, 이슈 #80·#81·#82, risk low)
- #80: 배당 카드 Hero 아래 "투입 대비 배당 N%" + 캡션(`lib/finance/dividend-yield.ts` `computeDividendYield`). 분자=Hero와 같은 올해 배당(예상 포함/지급만), 분모=평단×수량×(USD면 현재 환율). 평단 0 이하·JPY 제외("N종목 제외"), 월 막대 선택 시 `opacity-0`+`aria-hidden`(레이아웃 유지), InfoHint 문장 1개 추가. 허브 성적표의 "투입 대비"(손익률)와 구분하려 라벨에 '배당'을 넣음.
- #81: 더보기 섹션 프로필 · 공유 · 백업 · 도구 · 지원(+설정 행). 데이터 가져오기·저장 현황 줄을 설정에서 더보기로 이동(숨은 file input은 조건부 밖 항상 렌더, 설정에서 훅·ref·input 제거). 세금 관리는 도구로. 설정 순서 보안·화면·표시·데이터·버전, 삭제 행 맨 아래, 다크 모드 ON/OFF 배지. 공용 `header-menu/menu-styles.ts`. 행·토스트·확인 창 문구 무변경.
- #82: 홈 도넛 라벨 이름+% 2줄(`DONUT_LABEL_MIN_PCT`로 조각 안에 들어갈 때만), 조각색별 글자색 `pickDonutLabelColor`, 조각 경계 `var(--background)`, 범례 금액·% 열 정렬(tabular-nums, 행 40px). 홈 선택 조각 `brightness(1.15)` 제거(라벨 대비 4.5:1·경계 링 보존, 웰컴만 유지). 웰컴 미리보기(`screenshotMode`)는 `legacy`로 현행 유지, 마크업을 vitest 스냅샷으로 고정.
- 스키마·저장 키·동기화·서버 전송·GA 무변경. 결산·홈 팁·웰컴 파일 diff 0.

## 2026-11-07 (v4.45)

### 검색 입구 정비 + 첫 저장 설치 안내 + 연말 세금 줄 (#4.45, 이슈 #77·#78·#79, risk low)
- **왜**: 검색으로 닿을 문서가 없고(sitemap 루트 1건, 정본이 리다이렉트되는 비 www), 첫 저장 직후 설치 제안과 연말 세금 진입이 없었다. 모두 저장 키·서버 전송 추가 0.
- #77: `config/app.ts` `siteUrl` 기본값 `https://www.secretasset.xyz`(환경변수 신설 없음), 안내 그림 `DOMAIN`은 리터럴 `"secretasset.xyz"`로 고정. `sitemap.ts` 4건(루트·/ratio·/guide/stock-ratio·/guide/net-worth, 문서별 고정 lastModified). `app/guide/*` 정적 가이드 2편(`guide-copy.ts` 문구 정본·`guide-shell.tsx`·`_components/guide-article.tsx`·`guide-actions.tsx`). 루트 head `WebApplication` JSON-LD(`WEB_APPLICATION_JSON_LD`). ga `SCREEN_TITLES` `guide:*` 2행, `utm-allow.ts`가 `/guide/<slug>` 허용.
- #78: 첫 저장 직후 `ga.ts trackAssetSave`가 세션 메모리 신호(`lib/pwa/first-save-signal.ts`)를 켜고, 튜토리얼 종료 후 상단바 설치 아이콘 아래 1회 카드(`pwa/install-nudge.tsx`, 판정 `install-nudge-policy.ts`). 설치 흐름은 `PwaInstallFlow` 재사용(diff 0). `manifest.ts` 512 any 아이콘·`lang ko`·`categories finance` 추가. ga category `install_nudge`/`install_nudge_tap`. 상단바 헤더 `overflow-hidden`→`overflow-x-clip`(카드 세로 클리핑 해소).
- #79: KST 11/1~12/31 + 해외주식 시뮬 후보 보유 시 상세>주식에 `tax-season-strip.tsx` 한 줄 → 세금 관리 시뮬레이터. `tax-utils.ts`에 `isTaxSimCandidate`(추출, 동작 불변)·`isForeignTaxSeason`.
- 스키마·저장 키·동기화·서버 전송 무변경. 홈·홈 팁·세금 일정·결산·웰컴·security-copy·`/ratio` diff 0.

## 2026-11-06 (v4.44)

### 상세 다크 BOX 구조 + 자산 구성 변화 리본 차트 (#4.44, 이슈 #75, 대표 반려 후 재설계)
- **왜**: 항목별 면(3단계)은 검정 well·모서리 불일치를 낳음. 리스트 전체를 card 1장으로 감싸고 항목은 헤어라인으로만 구분(성과 카드 방식). 구성 변화 막대는 작아 비중 변화가 안 보임.
- `theme.ts`: `listBox`(rounded-xl card shadow-sm)·`summaryBoxDark` 신설, `cardExpandBox/Section/Meta/Actions` 다크 투명, `subCard dark:bg-popover`, `subItemsWell` 투명, `cardHeader dark:px-4 py-3`. 5개 탭 리스트·완납 대출·거래내역·현금/대출 거래·X-Ray·요약 박스에 적용. 라이트·인증카드·SHOT 상수 무변경.
- v3: 다크 `listBox`의 항목 사이 divide-y 제거 → 닫힌 항목은 비중 바만, 펼친 항목(마지막 제외)만 `cardOpenDivider` 하단선(5탭). **라이트 모바일 변경**: 주식 탭 `StockRowHeader`의 보유 비중 `·`+% 를 `max-sm:hidden`(모바일 <640px 숨김, 라이트 포함; PC·인증카드·비중 바 불변).
- 주식 행 오늘 등락 칩(`StockRowHeader`): 모바일(<640px)은 좌측 칩 `max-sm:hidden` + 우측 손익 줄 아래 `sm:hidden` 칩(우측 정렬), 배지(거래정지·상장폐지) 종목은 이름 `max-sm:line-clamp-1`. PC·인증카드·온보딩 불변, 라이트·다크 동일.
- **연 탭 자산 구성 변화 카드 제거(CTO 판정)**: `composition-card.tsx`·`computeCompositionSeries` 등 계산 함수·보정 스케일 삭제. `buildFxExposureLines`·`COMPOSITION_KEYS/LABELS/FORBIDDEN_WORDS`·ga `SCREEN_TITLES` 항목은 4.45 재사용으로 유지. 아래 구성 변화 관련 항목은 폐기.
- (폐기) 구성 변화: SVG 리본+막대 차트, 보정 스케일(`compositionScaleMode`·`compositionDisplayScale`), 선택 칸 후광·스크럽·←→ 키.
- 검수 반영: 막대 폭<40px면 막대 안 % 생략, 리본 다크 0.24/선택 접촉 0.38, 비선택 막대 fill만 0.7(라벨 유지), 4칸 이하 BAR_MAX 120, 가상자산 헤더 수량·비중 nowrap(다크), 요약 inline 줄 다크 flex(하단 여백 제거).
- 스키마·저장·동기화·서버 전송 무변경.

## 2026-11-06 (v4.43)

### 자산 구성 변화 + 외화 노출 (#4.43, 이슈 #72, risk low)
- **왜**: 자산군 비중이 시간에 따라 어떻게 바뀌었는지, 주식·현금을 합친 외화 노출이 얼마인지 보는 화면이 없었다. 저장 데이터를 읽기만 하고 금액은 노출하지 않는다.
- 연 탭(`net-asset-chart.tsx`, 제어 모드) 맨 아래에 `CompositionCard`: 월 스냅샷 `breakdown` 기반 최대 13칸 100% 막대(총자산 기준)·사실 문장(`지난 기록(10월) 대비 주식 +4%p, …`)·범례. 이번 달은 실시간 값. 계산은 `lib/report/composition.ts` 순수 함수.
- 성적표 분산·비중 카드(`axis.key === "diversification"`)의 reason 아래에 외화 사실 2줄+캡션(`buildFxExposureLines`, `computeFxExposure` 결과 재사용·채점 무변경).
- GA: `SCREEN_TITLES`에 `activity:change:composition`("성과·자산 변화·구성") 추가, 카드 50% 노출 시 1회 `trackScreen`.
- 스키마·저장 키·동기화·서버 전송 무변경. 결산 파일·홈 팁 diff 0.

## 2026-11-06 (v4.42)

### 공식적 UI 고도화 (#4.42, 이슈 #70, 대표 데모 후 반영 결정)
- **왜**: AI/개인 사이트 느낌을 줄이고 애플·토스처럼 절제된 인상으로. 원칙 "테두리·그림자 대신 배경 톤차, 장식 제거".
- 토큰: `--radius` 0.75rem·`--radius-2xl` 신설, 라이트 `--border` .91·`--background` #F0F2F4·`--shadow-*` 저불투명, 시스템 글꼴 스택(Inter 제거). 다크 토큰 불변.
- 프리미티브(Card·Button·Input·Select·Dialog·Sheet·Popover·Drawer)·SECTION/ROW/KpiCard/ASSET_THEME 라이트 border·shadow 제거(다크 보존), `border-border/NN` 라이트 헤어라인 치환, 컬러 아이콘 칩 제거.
- 잠금 화면 `Lock` 아이콘·72px 키패드·오류 슬롯 상시 마운트(동작·문구 불변), 하단 네비 알약/색 그림자 제거, 설치 배너·FAB 정리, 그라데이션 제거(인증카드 제외). 저장·동기화·스키마 무변경.

- 후속: 다크 톤 정돈 — `.dark` 토큰을 hue 265 3단 고도(bg<card<popover<muted<accent)로 교체, Card·Dialog·Sheet·Drawer 다크 테두리 제거(`dark:bg-popover`), Input·Select 경계 복구, 테마 사용 GA(`theme_mode`, 세션당 1회). 라이트 불변.

## 2026-11-06 (v4.41)

### GA 단순화 — page_title 하나로 통일 (#4.41, 이슈 #68, risk low)
- **왜**: `track()`이 `page_title`을 안 보내 액션 이벤트가 문서 기본 title 행에 몰렸고, 맞춤 정의(이벤트 8·사용자 속성 4~5)는 대표가 쓰지 않는 분해용이었다. "어떤 기능·페이지를 주로 쓰는가"만 보면 된다.
- `ga.ts`: 모든 이벤트·page_view가 `{ page_title(사용 기능 이름), page_location }`만 전송. 신규 순수 함수 `featureTitleOf`. 폐기: `PARAM_LABELS`·`labelOf`·`sanitizeParams`·`setUserProps`·`GaUserProps`·`assetCountBucket`·`nav_source` 전송, `asset-data-context`의 사용자 속성 effect.
- 신규 추적 2곳: 인증카드 열기(`feature_use` category `share_card`), 앱 가이드 열기(`app_guide`).
- 저장·스키마·동기화·서버 전송 무변경. 대표 GA 작업: 맞춤 정의 12개 보관처리, 배포 24~48시간 뒤 "페이지 및 화면" CSV 공유.

## 2026-11-01 (v4.40)

### /ratio 예시로 먼저 보기 (#4.40, 이슈 #66, risk low)
- **왜**: 캡처를 올려야만 결과가 보여 처음 온 방문자가 "무엇이 나오는지" 모른 채 망설였다.
- 고정 가상 6종목(`ratio-preview/ratio-sample.ts`)을 `buildRatioList`로 로컬 계산해 즉시 결과 표시. 서버 호출·기기 한도·인계 저장 없음, 저장·인앱·다시보기 숨김, "내 캡처로 해보기"로 업로드 화면 복귀. GA `method: sample`(라벨 "예시 보기") 값 1개 추가, 스키마·저장 키 무변경.

## 2026-11-01 (v4.39)

### 주식 스크린샷 국내·해외 혼합 인식 결함 수정 (#4.39, 이슈 #64)
- **왜**: 공통 모드가 파싱 직후 전 종목을 한 카테고리로 변환해, 혼합 캡처의 소수 쪽 종목이 카테고리·통화·가격(×/÷환율)까지 바뀐 채 저장될 수 있었다.
- 매핑을 `lib/asset/screenshot-stock-map.ts` 순수 함수로 분리, 국내·해외가 섞이면 개별 선택 모드로 시작(공통 적용은 사용자가 누를 때만). 단일 section 결과는 현행과 동일(vitest 고정). 저장 경로·기존 기록 보정 없음.

### 스크린샷 비중 미리보기 `/ratio` (#4.39, 이슈 #63, risk medium)
- **왜**: 설치·금고 없이 캡처 1장으로 종목 비중을 먼저 보여 줄 입구가 없어 첫 방문 → 첫 저장 전환이 0이었다.
- `(main)` 밖 공개 라우트. 업로드(`entry=ratio`) → 비중 %·국내/해외 비율·종목 수만 표시(금액 없음, largest remainder로 합 100.0). 저장 버튼은 모듈 메모리 인계(`ratio-preview/handoff.ts`, 10분·1회) 후 `/` 이동, `(main)/layout.tsx`의 `RatioHandoffHost`가 조건(`canOpenHandoff`) 충족 시 `StockScreenshotImport initialParsed`(개별 모드)로 연다. 인앱은 외부 열기 안내(인계 없음, 재업로드).
- 서버: `reserveGeminiCalls` 선택 인자 `pool`(입구 전역 60·IP 5/일, entry 또는 Referer 판정, 실패 시 앞 단계 전부 롤백) — 입구 요청의 429는 마감 문구.
- GA: `/v/ratio`, category `ratio_preview`, UTM 3키는 `ga.ts pageLocation()`에서만 `/ratio`일 때 부착(`utm-allow.ts`). `useExternalMove(isIOS, onTrack?)`. `OG_IMAGE`는 `config/app.ts`로 이동. 스키마·저장 키 무변경.

---

## 2026-11-01 (v4.38)

### 보안 안내 문구 정정 (#4.38, 이슈 #61)
- **왜**: "데이터가 기기를 절대 벗어나지 않습니다"는 동기화·스크린샷 인식과 맞지 않고, 업로드 박스의 "개인정보 측면에서 문제없습니다"는 법적 단정이면서 이미지 전송을 알리지 않았다.
- 7곳 정정, 웰컴·앱가이드 카드 3종을 `src/config/security-copy.ts` 단일 상수로 통합(기술 용어 span 제거), 업로드 박스 4종 "스크린샷은 AI 인식을 위해 전송돼요…" + 테두리 제거. 금고 암호 문장·홈 백업 팁·메타 title은 사실이라 유지.
- 동기화 암호화 명칭은 대표 지시로 **실제 방식 기준**("기기에서 암호화하는 동기화", 종단간 암호화 — 기기에서 AES-256-GCM 암호화 후 전송, 전송 구간 HTTPS)으로 확정. 5문장을 `DEVICE_ENCRYPTION_COPY` 한 블록에 모음.
- 줄바꿈: "저장·전송" WORD JOINER, 신뢰 한 줄 `text-balance` 제거(design-system §5.1).

### 인앱 브라우저 도착 개선 (#4.38, 이슈 #60)
- **왜**: 인앱 브라우저는 자산 0건 방문자도 앱을 보기 전에 전체 차단했고, Threads·다음·밴드는 감지되지 않아 등록 후 유실 위험이 있었다.
- `resolveInAppGate`: 로드 전 빈 덮개 → 0건·공유/동기화/복원 해시 없음이면 웰컴 inapp 슬롯("외부 브라우저에서 시작하기"), 그 외 같은 노드에 현행 게이트. 외부 이동 `useExternalMove` 단일화, `InAppExternalGuide notice` prop, 감지 토큰 3개 + 음성 UA 테스트, `hasAnyAssets` 헬퍼(3곳 교체). 신규 GA 이벤트·저장 키 없음.

### 체험 모드 `/?trial=1` (#4.38, 이슈 #59)
- **왜**: 첫 방문자는 등록 전에 성과·결산을 만져 볼 수 없었다(웰컴 7기기 → 첫 저장 0).
- 웰컴 ③ "직접 둘러보기" → `/?trial=1`. `TrialGate`(provider 바깥)가 원본을 읽기 전용으로 거부 판정 → 메모리 Storage + fetch 거부 래퍼 설치 → 검증 5종 fail-closed → 데모 주입(닉네임 비움). 원본 복구 코드 없음, 종료는 `/` 이동. 홈 배너 1곳, FAB·더보기·설치 숨김, GA 전면 끔(인라인 `ga-disable` 포함), 동기화·백그라운드 갱신·인앱 게이트 차단. GA 값 2개(`demo`·`trial_start`), 스키마·저장 키 무변경.
- 컷 규칙: 11/24까지 qa PASS가 아니면 #59 커밋(KB 포함)만 revert.

---

## 2026-10-31 (v4.37)

### 결산 화면 AI에게 N월 변화 물어보기 (#4.37, 이슈 #54)
- **왜**: 결산은 숫자·원인을 보여주고 끝나 "왜 이랬나"를 풀어 줄 다음 행동이 없었고, AI 프롬프트 복사 계측이 0이었다.
- 결산 화면 원인 블록 아래 보조 카드형 버튼 → 화면 값만 담은 질문(`buildSettlementPrompt`) 미리보기·복사, 금액 포함 주황 고지. `PromptPreviewDialog`에 `onCopy`(복사 성공 후만)·`copyPrompt` 헬퍼. GA enum 4개 추가(`ai_prompt`·`prompt_copy`·`settlement`·`report`), 성적표 복사도 계측. 서버 전송·저장 키·새 이벤트명 없음.
- design-system §6: Tailwind 4.1 scale 전환은 `transition-[…,scale]`.

---

## 2026-10-30 (v4.36)

### 결산 창 홈 팁 (#4.36, 이슈 #51)
- **왜**: 월 결산은 활동 탭 허브 카드에서만 열려 홈만 보는 사용자는 결산 창이 열린 걸 몰랐다.
- `pickHomeTip`에 결산 1종(공지>백업>세금>**결산**>최신화>기능), 판정은 허브와 같은 `pickSettlementCard`. 문구 "{N}월 결산이 열렸어요"(금액 없음), 탭 → 월 결산(`settlement_view` source `home_tip`, 기존 허용 값). `ChangeInit.source`에 `home_tip` 추가. 저장 키·스키마·GA 이벤트 무변경.
- 동승: 팁 셸 제목·설명 `break-keep wrap-break-word`·X 40px, 홈 Hero 증감 금액·% `whitespace-nowrap` + `flex-wrap`(라벨·쉐브론 한 덩어리), 하단 고지 `break-keep`.
- 대표 지적 후(cto 판정): 순서를 공지 > 백업 > **임박 세금(이번 달 마감 0~6일)** > 결산 > 그 외 세금으로 — 세금 태그 사용자는 결산 창 내내 세금 팁에 가려졌다. **공지 X = 읽음**(X로만 닫는 사용자에게 공지가 세션마다 되살아나 하위 팁을 영영 가리던 문제). preview `?demo=1`은 튜토리얼 건너뜀·공지 읽음.

---

## 2026-10-30

### 첫 화면 "가치 먼저" 재배열 + 링크 미리보기 (#4.35, 이슈 #48)
- **왜**: 375 첫 화면이 제목+보안 카드 3장으로 차고 예시 순자산은 스크롤 2~3번 뒤였다. 모바일 웹은 시작 버튼이 맨 아래 텍스트 링크뿐이었고, 링크 미리보기에 이미지가 없었다.
- 순서 = 히어로 → 신뢰 한 줄(+자세히 보기, 보안 3카드 원문 제자리 펼침) → 예시 순자산 → CTA 단일 슬롯(모바일 웹: 설치 + 웹에서 바로 시작) → 주식 미리보기 → 설치 박스(데스크톱만). 배지·히어로 서브 2줄·설치 3단계·맨 아래 링크 삭제. 마운트 전 빈 슬롯으로 깜빡임 제거.
- `public/og-image.png`(1200×630, 브랜드 문구만) + `twitter:card=summary_large_image`. GA 이벤트·값·저장 키·스키마 무변경.

### 주식·대출 거래 입력 날짜 KST (#4.35, 이슈 #46)
- **왜**: 기본 날짜·max가 UTC라 KST 00~09시에 전날로 저장돼 월 경계 결산이 어긋났다. 현금 입력은 이미 KST.
- 세 입력 모두 `todayKst()`(tax-utils) 사용. 기존 저장 날짜는 건드리지 않는다. 백업·PNG 파일명 날짜는 범위 밖.

---

## 2026-10-28

### 변화 원인 정확도 — 순유입 짝짓기·대출 항목 (#4.34, qa R1~R5·대표 수정)
- **왜**: 실데이터에서 출금→매수·상환이 "순유입 −, 기록 안 된 변화 +"로 갈렸고, 대출 이자·마이너스통장 사용이 기록 안 된 변화에 섞였다.
- 기록된 출금↔기록된 매수·상환을 ±3일 안에서 짝지어서만 상쇄(`matchRecordedTransfers`), 예측 구간 시세 잔차는 기록 안 된 변화(예측), 기록 안 된 변화에서 대출 이자·순증 사용분을 "대출" 항목으로 분리(`splitLoanCause`). 엔진·홈·성적표 무변경.

### 연 탭 변화 원인 (#4.34 보완, 대표 수정 지시)
- **왜**: 월 탭에만 원인이 있어 "올해 왜 바뀌었나"를 볼 수 없었다. 월 원인 블록·계산을 그대로 재사용해 연 Hero 아래 올해 원인 1벌을 둔다.
- 운영 사용자는 전년 12월 월 스냅샷이 없어(과거 1월 삭제 결함) 작년 수동 순자산을 앵커로 쓴다: `resolveYearChain`(앵커 → 올해 enrich 월) → 실시간을 월 탭과 같은 함수로 구간별 분해(`computeChainCauses`). `CauseBlock`·계산을 `change-hero.tsx`로 옮겨 월·연 공용. 엔진 무변경, 합계 = Hero 증감, 연초~첫 enrich 달은 예측.

### 월 스냅샷 데이터 안전 보강 (#4.34, qa 데이터 안전 점검)
- **왜**: 구버전(v4.33) 기기가 1월에 올해분만 남겨 push하면 pull의 통째 교체로 신버전 기기의 13개월 보존분이 지워졌다(#32 수정 무력화). 13개월 보존으로 습관 축이 1~6월에 전년 달을 섞어 점수가 바뀌었고, 인접 월 결산이 경계일 입금을 두 달에 모두 잡았다.
- pull 월 스냅샷 월 단위 병합(`mergeMonthlySnapshots`, 상세 있는 쪽 우선) 후 13개월 롤링. 습관 축 비교를 올해분으로 고정. `computeAttributionBetween(…, includeStartDay)` 추가(기본 true 기존 동작), 결산은 false. 키·스키마 불변.

### 성과 정보 구조 r2 — 지표 정본 1곳 + 자산 변화 상단 컨트롤 C안 (#4.34, 이슈 #32)
- **왜**: r1이 메뉴만 줄이고 항목은 복제했다(변화 원인이 결산·성적표 두 곳, 월 증감 4곳). 상단 컨트롤 3~4줄이 Hero보다 먼저 와 375px에서 결산 증감이 y≈525였고, 탭 스타일 두 종류(`border-2` 외곽선 포함)가 섞여 있었다.
- 자산 변화: 제목 행 오른쪽 범위 선택 + 본문별 공통 `ChangeHero`(이름→증감→시작→끝→기간 선택). Radix Tabs·범위 배지 삭제, `InlineSelector fullWidth` 신설(기본 경로 스냅샷 고정). 월 탭 = "N월 결산" Hero + ‹ › 화살표(월 칩·순자산 비교·범위 캡션 삭제).
- 허브 4→3카드(결산 카드를 자산 변화 카드에 흡수, `settlementDelta` 공용), 성적표 "순자산 변화, 왜?" 삭제·growth 링크 → 연 탭, `tabList2/3` 토큰 삭제. 결산 계산 useMemo가 매 렌더 무효였던 결함(qa 확정) 수정. 엔진·스키마·저장 키·GA 정의 무변경.

### 성과 메뉴 정리 + 자산 변화 월 탭 = 월말 결산 (#4.34, 이슈 #32)
- **왜**: 스크린샷 갱신 구조라 다시 열 이유가 없었고(월 1회 의식 필요), 성과의 순자산·수익이 "기간 대비 변화"로 겹쳐 혼동됐다. 월 스냅샷이 1월 첫 저장에 전년분을 지우는 결함(qa 확정)도 결산의 전제를 깨고 있었다.
- 월 스냅샷 보존을 올해분 → 최근 13개월 롤링(`pruneMonthlySnapshots`)으로. 스키마·저장 키·동기화 pull 경로 불변.
- 성과 허브 카드 4→3(자산 변화·배당·성적표) + 말일−3일~다음 달 10일 결산 카드. 자산 변화 = 범위(전체/주식)×기간(일/주/월/연), 전체·월 = 결산 블록(헤더·순자산 비교·변화 원인 5항목·다음 달 준비 + `.ics`). 엔진은 `computeAttributionBetween` 래퍼 1개만 추가, 홈 헤더 무변경.
- 옛 `#activity/netasset`·`#activity/profit` 리다이렉트, 기능 카탈로그 15→14, GA `settlement_view`(source·result 열거형만), 화면키 `activity:change`.

### Vercel preview 안전장치·데모 데이터 (#4.34, 이슈 #31)
- **왜**: preview가 운영과 같은 `/api/sync`를 써서 검증 전 코드가 실제 금고에 쓸 수 있었고, origin이 달라 빈 화면이라 qa가 사람 없이 점검할 수 없었다.
- `next.config.mjs` `env`에 `NEXT_PUBLIC_VERCEL_ENV` 주입 → `isPreviewEnv()`(정확히 `"preview"`만 true). `isCloudSyncEnabled()`는 preview에서 false, `sync-client`의 `pushAsset`·`pullAsset`·`fetchRemoteVersion` 입구 가드(fetch 0건). 운영·로컬 반환값 불변, 서버 `/api/sync` 무변경.
- preview 전용 `PreviewGate`(`(main)/layout.tsx`에서 preview일 때만 `AssetDataProvider` 바깥을 감쌈): `PREVIEW · v4.NN` 배지, `?demo=1`(데모 JSON 동적 import → `applyImportedPayload`, 멱등)·`?demo=empty`(`clearAssetData`), 처리 후 쿼리 제거 + `html[data-demo-ready="1"]`, 자산 0건이면 하단 선택 카드. 스키마·저장 키 변경 없음.

---

## 2026-10-24

### 매수/매도 기록 — 보유 자산 항목 직접 선택 + 변경 미리보기 (#4.29)
- **왜**: "종목+증권사"로 보유 항목을 자동 라우팅해, 같은 증권사 안에서 IRP·ISA·연금저축으로 나뉜 국내 상장 해외 ETF가 엉뚱한 항목에 반영됐다.
- 거래 스크린샷·수동 입력 모두 증권사 Select·`resolveMatch` 제거 → `StockTargetPicker`로 보유 항목(타입·증권사·수량·평단) 직접 선택, 신규면 증권사+주식 타입 선택. 후보 1개면 자동 선택. `PositionChangePreview`로 수량·평단 before→after(스크린샷은 체결일순 누적), 보유 초과 매도 차단.

### 거래 스크린샷 — 종목명 OCR 오타 보정 + 국내 ETF 전 종목 점검 (#4.29)
- **왜**: "SOL 미국TOP5채권혼합50"이 "…채권합50"으로 인식돼 IRP 보유 종목이 신규로 잡혔다(티커 매칭이 정확·잘림만 지원).
- `name-match.ts`(편집거리) 신설, `lookupTicker`에 prefix 다음 국내 오타 보정(유일 최근접만)·동률 시 suffix/substring 추정 차단. 클라이언트는 티커 미인식 시 보유 종목명 유사 후보(자동 선택 안 함). 전 ETF 테스트: 오타 3,427건 오매칭 0.

### 홈 세금 안내 — 이번 달 일정 우선·마감 지난 항목 제외 (#4.29)
- **왜**: severity 우선 정렬이라 10/24에 11월 중간예납(high)이 10월 부가세 예정고지(~10/25)를 밀어냈다. 정렬을 이번 달 → high 순으로, 이번 달 마감 경과 항목은 제외.

### 자산 변화 원인분해 — 항목별 날짜·기록 타임라인 (#4.29, S-4.33)
- **왜**: 오랜만의 접속·입출금+매수 연속 입력 시 합계 원인만으로는 흐름을 이해하기 어려웠다. 기록 기반 원인에 날짜(단일/범위), 시세·환율 → 날짜순 정렬, "기록 내역" 펼침, 홈 비교 구간 표기. 금액 계산 무변경.

### 기기 동기화 — 자동 push를 사용자 편집 신호로만 한정 (#4.29)
- **왜**: 파생값 제외 비교가 남아 있어, 날짜가 바뀐 조회 기기의 daily 30일 롤링 절단·`dailyArchive` 이관만으로 push → 편집 기기(사파리)에 "다른 기기의 변경을 반영했습니다" 토스트가 반복됐다.
- `getComparablePayloadString`·`lastPushedRef`·`skipNextChangeRef` 제거, 트리거 = `ASSET_USER_EDIT_EVENT`·`NICKNAME_EVENT`. 우회 저장 경로(무티커 스크린샷 등록·파일 가져오기·공유 반영)에 `notifyAssetUserEdit()` 추가.

---

## 2026-10-18

### 공개 API 보안 강화 — 최소 표면·악성 요청·DDoS 방어 (#4.28)
- **왜**: AI 기반 자동화 공격 증가. 공개 API를 통한 Vercel 함수·Redis·외부 API(KIS·Gemini 등) 자원 소모와 캐시 오염, 미사용 엔드포인트 악용, 악성 사이트가 방문자 브라우저를 동원하는 분산 요청(좀비형)을 애플리케이션 계층에서 차단.
- **표면 축소**: `finance/debug-overseas`·`server-actions.ts`(공개 Server Action)·`realestate op=raw` 삭제, `/_next/image` 비활성, 미사용 의존성(axios·vercel·@vercel/blob·dom-to-image-more·simple-icons·ts-node) 제거, next 16.4.2(`npm audit --omit=dev` 0건). 테마 쿠키는 클라이언트 `persistThemeModeCookie`로 대체.
- **공통 가드 `src/server/api-guard.ts`**: cross-site 403 → 본문 크기 411/413 → L1 메모리 버킷 → 캐시 우선 → (미스만) L2 `rl:{route}:{ip}` → 업스트림 분당 예산 → Gemini 원자 예약(IP 30/일). 라우트별 입력 화이트리스트·개수 상한, `maxDuration`, 에러 원문 미노출.
- **DDoS 흡수**: 공개 시세류 응답 `Vercel-CDN-Cache-Control` 엣지 캐시, KIS 토큰 single-flight, upbit 락 소유자 토큰, `setStock` 전체 SCAN 제거, KV 미설정 시 fail-closed.
- **브라우저**: CSP(Report-Only)·`X-Frame-Options: DENY`·nosniff·Referrer/Permissions-Policy, `robots` `/api/` 차단. xray 프롬프트는 서버 마스터 이름만(프롬프트 인젝션·캐시 오염 차단).
- **동기화(`/api/sync`·`cloud-sync/*`) 로직 무변경** — 인접 항목(S6)은 별도 승인 대상.
- 사양: qa-full-test-plan `F-API-SECURITY`. 사용자 작업: Vercel Firewall·Spend Management, CSP 위반 확인 후 enforce.

### GA4 사용자 행동 추적 — 이벤트 20종 (#4.28, S-4.28) — 맞춤 매개변수·한국어 라벨·사용자 속성은 4.41에서 폐기
- **왜**: GA4 보고서·탐색 분석에서 별도 가공 없이 활성화 퍼널·스크린샷 성공률·공유·동기화 채택을 바로 분석하기 위해. 기존엔 page_view만 있었고 `#share=` 해시(복호화 키)가 page_location에 실릴 위험이 있었다.
- `src/lib/analytics/ga.ts` 단일 진입점(`track`·`trackScreen`·`setUserProps`·sanitizer), `APP_CONFIG.gaId` 단일 출처, config `send_page_view:false`·해시/쿼리 미전송, 가상 경로 `/v/<viewKey>` page_view, `?ga-debug=1` DebugView 플래그, `first_asset_saved` 기기당 1회(`STORAGE_KEYS.gaFlags`).
- 공용 파라미터 8개(이벤트 범위)+사용자 속성 5개만으로 전 이벤트 교차 분석. 전송 값은 한국어 라벨(코드 enum은 영문 유지).
- 동기화 이벤트는 수동 동작 결과 후 UI에서만 기록(자동 폴링 미발생, 동기화 로직 무변경).
- 사양: qa-full-test-plan `F-ANALYTICS`. 사용자 작업: 향상된 측정 페이지 변경 끄기, 맞춤 측정기준 13개 등록(명세 §3-C).

---

## 2026-09-25

### 인증카드 포트폴리오 도넛 — 모바일 프리뷰 라벨 잘림·치우침 수정 + 종목명 단어 단위 줄바꿈 (#4.27)
- **왜**: 모바일 프리뷰에서 긴 ETF명이 12시(상단)·6시(하단)에서 잘리고, 좌우 라벨이 링에 밀착·치우쳤다. 프리뷰는 링을 축소하고 라벨 폰트를 `floor/scale`로 키워 줄 수가 늘지만, 높이 상한(`VIEW_H`)·좌우 폭·상단 여백은 캡처 기준이라 부족했다(캡처는 정상).
- **수정(프리뷰 전용, 캡처 불변)**: `topInset`(상단), `ringH`의 `VIEW_H` 상한 해제(하단), `sideExtra=64`(좌우 폭), 좌/우 `pushOutside`(링 밀착 방지, 이동량 `PUSH_MAX=24`)·상단 라벨 20px 상향(조각과 위치 정렬).
- **종목명 줄바꿈**: "미국나스닥1/00"처럼 글자 중간에서 끊기던 것을 `splitNameWords`(공백·한글↔영문숫자·`(` 경계, 6자 이상 한글은 `NAME_LEXICON` 어휘 분할)로 단어 단위화 + `<wbr />` + `overflow-wrap:break-word`. `estLabelHeight`가 같은 토큰으로 줄 수 계산. 이름 ≤3줄 + 비중 1줄(최대 4줄), 넘치면 말줄임(잘림 금지).
- 상세: [components.md](components.md) `PortfolioRingCard` (#4.27) 항목.

## 2026-09-24

### 인증카드 — "투자 유형" 타입 신설 + 공유 플로우 개선 + 포트폴리오 UI 정리 (#4.26)
- **투자 유형(`variant="type"`, 다이얼로그 기본 진입)**: 포트폴리오를 분석한 유형 제목·부제·개인화 설명·해시태그 "쪽지"(대자보 핀업) + SVG 캐릭터 아바타. 분석은 `lib/xray/investor-type.ts`의 `resolveInvestorType()`(섹터·집중도·지역·계좌·종목유형·통화·지수·2위 종목 등 축을 seed 해시로 조합, 결정적). 문장 선택은 공용 `lib/xray/seeded-pick.ts`(`hashString`/`pick`)를 아바타와 공유.
- **아바타(`investor-avatar.tsx`)**: 눈=집중도 3풀, 입=종목유형 8풀, 바깥 원=테마와 무관한 30색 HSL 팔레트(단일 색 3단 그라데이션), 코너 배지는 지역(국내/해외 2종)·계좌. 캡처 전용 `flat`(섀도 제거) — 웨일에서 섀도 있는 작은 요소 옆에 어두운 띠 아티팩트가 나와 캡처에서만 제거, 압정 `shadow+ring`은 실제 `border`로 교체.
- **설명 줄바꿈**: `renderDescriptionInLines(text, terms, targetChars)` — 문장(`.!?` 뒤 공백)을 글자수 기준 그리디로 묶어 `<br />`. `max-w`(%)와 `targetChars`는 **한 쌍**(모바일 97%/27자, PC 90%/50자, 캡처 82%/35자)이며 텍스트 블록 래퍼에 `w-full`이 있어야 %가 카드 폭 기준으로 확정된다(없으면 래퍼가 가장 긴 문장 묶음 폭으로 줄어 항상 고아 줄 발생).
- **캡처 전용 보정**: 유형 배지 14px·쪽지 글자 14px(≈1.15배)·간격/최대폭 캡처 분기, 지역 배지 글자·아이콘은 아바타 `size` 비례. 설명↔쪽지 캡처 `mt-7`(프리뷰 `mt-8`) — 실제 간격=`gap-2.5`+half-leading+`mt`−압정 돌출(9px).
- **공유 플로우(`share-menu.tsx`)**: 카카오톡 등 공유가 다운로드로만 새던 원인은 `navigator.share`를 캡처 `await` 뒤에 호출해 사용자 제스처가 만료되던 것 — 열림·변경 400ms 후 사전 캡처해 `preparedShareRef`에 캐시하고 클릭 시 동기 호출. `share()`의 `title: "인증카드"` 제거(카톡에 텍스트로 같이 전송되던 문제). PC(Web Share 미지원)는 `ClipboardItem`에 미완료 Promise를 담는 기존 패턴(`pwa-install-flow.tsx`)으로 이미지 클립보드 복사 버튼 추가.
- **포트폴리오**: 도넛 캔버스 높이를 라벨 실제 최하단 기준 동적 산정(`viewH`, 6시 라벨 없으면 ≈100px 회수, 하단 +40 여백), 도넛 라벨을 종목 **이름**으로 통일(티커는 로고용), 하단 막대 범례를 주식 현황과 같은 "이름 %" 인라인으로, 섹션 제목 위계 강화.
- **홈 팁**: `share-card-type`("투자 유형 인증카드") 추가, `dispatchOpenShareCard`에 `"type"` 변형. 상단 설명 문구 3종 통일, 워터마크 S 로고 24→21px.
- **공용 훅**: `header-menu/share/use-pc-preview.ts`(`usePcPreview(responsive)`) — 도넛 라벨 폰트·설명 줄바꿈 기준 공용(기존 `portfolio-ring-card.tsx` 로컬 구현 이동).
- **기기별 캡처 차이 보정(iOS 웨일 vs Windows PC)**: 같은 자산인데 캡처가 달랐다 — 앱 웹폰트는 Inter(Latin)뿐이라 한글이 OS 폰트로 그려져(맑은 고딕 자폭 0.92em, iOS Apple SD Gothic Neo는 더 조밀) 글자 폭이 ≈5~6% 다르고, 한 줄에 Inter+OS 한글 폰트가 섞여 `leading-[1.85]` 줄 박스가 폰트 메트릭에 따라 커져 카드 높이·설명↔쪽지 간격이 달랐다. `useKoreanAdvanceScale`(한글 20자를 100px로 그려 자폭 실측, PC 기준 `TARGET_ADVANCE=0.92`보다 좁은 기기만 최대 1.12배 확대)로 캡처 글자 크기 보정, 설명 줄높이 31px·줄 묶음 고정 높이 블록·제목 45px·배지 31px·쪽지 39px 고정으로 높이 통일(캡처 DOM만). 실기기(iOS·PC) 정상 확인.
- **공지 갱신**: `NOTICE_ID` 20260924, 투자 유형 인증카드·공유 개선으로 교체, 새 공지 팁 클릭 시 투자 유형 탭 직행.
- **P1 수정 — 탭 전환 직후 이전 이미지 공유**: 사전 캡처 캐시 `preparedShareRef`가 내용 변경 시 무효화되지 않아, 타입 탭을 옮긴 직후(다음 캡처 완료 전)나 재오픈 직후 공유하면 이전 이미지가 나갔다(사용자 직접 확인). 캐시에 `variant|금액표시|분류진행` 키를 붙이고, 이펙트 시작 시 즉시 폐기·변환 후 취소 재확인·클릭 시 키 검증, 모바일은 준비 중 `isPreparing`으로 공유 버튼 "준비 중…" 비활성화(사전 캡처에 20초 타임아웃).
- **어휘 대폭 확장 + 문구 안전 규칙**: 제목·설명·배지·쪽지 풀을 3개→7~10개로 확장하고 어미 반복 가드(`pickFilled`)·슬롯 뒤 조사 금지·쪽지 9자 제한 적용(시뮬: 고유 제목 351→876, 인접 문장 같은 어미 5.28%→0.24%). 지역·섹터 키만으로 고르는 풀이라 특정 기술·사업 단정 표현(라이다·배터리·H주 등)은 섹터 수준 어휘로 교체.
- **미국 배지 컨텍스트화**: S&P500·나스닥100 ETF 중심 포트폴리오에 "빅테크 동행자"가 붙던 어색함 해소 — `regionPool`이 개별 빅테크(MAG7) 중심일 때만 "빅테크 동행자", 나스닥 ETF 중심이면 "기술주 동행자"·"나스닥 러버", S&P면 "S&P 탐험가"를 후보에 합류. `resolveInvestorType`에 `topHoldings`(상위 3종목) 입력 추가.
- **기타**: 분류 진행 중 공유·저장·복사 비활성화, 모바일 프리뷰 설명 폭 97%/27자 + `break-keep`(어절 단위 줄바꿈).

---

## 2026-09-13

### 홈 화면 — 자산 성적표 트로피·점수 미니 배지 추가 (#4.24)

- **왜**: "자산 성적표"(F-REPORT, S-4.18)는 이미 완전히 구현돼 있지만 홈에서 진입 동선이 없었음 — 흥미 유발용 티저를 순자산 헤더에 노출해달라는 요청.
- `dashboard.tsx`: `useLatestAssetGrade()` 신규 훅이 `readDailySnapshots()`에서 `grade` 필드가 있는 최신 스냅샷을 읽는다(재계산 없음 — `computeAssetGrade()` 재호출은 profit-ref 등 무거운 입력이 필요해 중복 계산). `NetAssetSummaryBox`에 옵션 `grade?`/`onGradeClick?` prop 추가, `grade && !hasRightSide`일 때만 우상단 `absolute` 배치로 트로피(티어색+글로우)+점수 노출, 클릭 시 `navigate({type:"activity", tab:"report"})`. `asset-report-view.tsx`의 `TIER_STYLE`을 export해 색 재사용(새 팔레트 없음). `welcome-guide.tsx` 프리뷰 호출부는 두 prop 다 안 넘겨 무영향. 성적표 미방문 계정은 배지 자체가 렌더 안 됨.

### 상단바 로고~InlineSelector 간격 재조정 (`ml-2`→`ml-3`)

- **왜**: 여전히 약간 붙어 보인다는 피드백 — 좌/우 그룹 폭 예산 분석(320px 최소 지원 폭 기준 여유 확인) 후 4px만 더 확보.

### 인증카드 — PC 프리뷰 본문 텍스트 `text-sm` 확대

- **왜**: PC(넓은 화면) 프리뷰가 모바일과 같은 축소 크기(`text-xs`)라 가독성이 아쉽다는 지적. 모바일은 기존 유지(포트폴리오 도넛 라벨과의 시각 밀도 균형 때문에 의도적으로 작게 잡은 값이라 손대지 않음).
- `theme.ts`의 `ASSET_THEME_SHOT`(프리뷰 전용 세트 — 저장 PNG는 항상 별도 `ASSET_THEME_SHOT_BIG`이라 무관, R32 안전) `cardInfoName`/`cardAmountMain`/`profitRate`/`legendText`/`bodyText`에 `sm:text-sm` 추가. `portfolio-ring-card.tsx`의 도넛 라벨(`rLabelFont`)도 같은 640px 기준(`matchMedia`)으로 PC는 14px, 모바일은 12px 유지하도록 분기.

### 인증카드 포트폴리오 도넛 — 조각 안 로고·ETF 배지 크기 통일 + "그 외" 세로 배치 + 대비 원형 배경

- **왜**: 3단계 반복 요청 — ①ETF 브랜드 라벨이 조각 크기에 비례해 커져 조각마다 들쭉날쭉해 보임 ②"그 외" 미니 로고가 가로로 좁게 배치돼 작음 ③ETF 배지 배경이 항상 흰색이라 단조로움.
- **라벨/칩 크기 통일**: `chipSizeFor()`를 `CHIP_MIN`(44→**50**px) 고정 타깃 + chord 안전장치로 단순화(기존 `CHIP_MAX`/`CHIP_REF_ARC` sqrt 비례 보간 폐기). 목표 크기와 "너무 좁으면 생략" 기준을 `CHIP_HIDE_BELOW`(32px)로 분리해, 확대해도 극단적으로 좁은 조각에서 로고가 갑자기 사라지지 않게 함. `BrandMark`에 `fontSize?` prop 추가 — 메인·서브 조각 모두 `ETF_LABEL_FONT_SIZE`(14px 고정) 전달.
- **6자 이상 브랜드 축약**: `ETF_BRAND_ABBR`(수동 매핑 10종 — KBSTAR→KBST 등, 4자 슬라이스 자동 규칙은 HANARO→HANA처럼 실제 브랜드와 겹쳐 반려) 도입. 5자 이하(TIGER/KODEX 등)는 14px에서 이미 안 잘려 축약 불필요.
- **"그 외" 세로 배치 + 확대**: 서브칩 배치를 원주(각도) 오프셋 → **반지름(세로) 오프셋**으로 전환(밴드 두께가 원주 방향 여유폭보다 넓어 더 큰 칩이 안전) — `SUB_CHIP` 28→**38**px, `SUB_CHIP_GAP` 6→7.
- **ETF 배지 대비 원형**: 배경을 조각색 그대로(초안) → `pickOnColor(bgColor)` 흰/검정 2톤(팔레트 대부분이 흰색으로 수렴해 "무조건 흰색" 문제) → 최종 `darkenColor(bgColor)`(신규 유틸, theme.ts — 조각색을 검정 쪽 55% 혼합)로 조각마다 다른 톤 확보, 글자색은 `pickOnColor(badgeBg)`로 재계산.

### 인증카드 저장 PNG 해상도 축소 시도 → 효과 없음 확인 후 즉시 원복 (`a7c0340` → `2f2faa2` revert)

- **왜**: 아이폰에서 저장한 PNG가 2040×3174px라 네이버 카페 등에 재업로드하면 원본 그대로(1600px 이상) 크게 노출된다는 신고 — 저장 파일 자체 해상도를 카드 레이아웃과 같은 680px(`CAPTURE_TARGET_PX` 1400→680, `pixelRatio` 3→1)로 낮춰 외부 공유 시 작게 보이게 하려 시도.
- **원복 이유**: 실사용 확인 결과 **네이버 카페 앱은 업로드 이미지를 원본 해상도와 무관하게 컨테이너 폭(PC/모바일 각각)에 강제로 늘려(stretch) 표시** — 파일 해상도를 낮춰도 화면에 보이는 "크기(폭)"는 똑같이 컨테이너 100%로 고정되고, 오히려 680px 원본을 업스케일하며 글자만 흐려지는 손해만 남았다. **다운로드 이후 제3자 사이트에 재업로드된 정적 파일의 표시 크기는 그 사이트의 렌더링 규칙(CSS)이 전적으로 결정 — 앱이 제어할 수 있는 영역이 아니다**(PNG의 DPI/pHYs 메타데이터도 웹 `<img>` 렌더링에서 대부분 무시됨). `share-menu.tsx`/`logo-source.ts`/`brand-mark.tsx`/`logo-source.test.ts` 4개 파일을 `git revert`로 정확히 원상복구(`pixelRatio=3`, 2040px, `CAPTURE_PIXEL_RATIO=3` 그대로).
- **교훈**: "저장 파일 해상도"로 "외부 사이트에서의 표시 크기"를 제어하려는 시도는 재발 금지 — 대상 플랫폼이 이미지를 컨테이너 폭에 강제로 맞추는 반응형 뷰어를 쓰는 이상 근본적으로 불가능하다.

---

## 2026-09-12

### GA(Google Analytics) 수집을 프로덕션(main)에서만 활성화

- **왜**: preview·로컬 개발 환경까지 GA 수집이 섞여 실제 사용자 데이터가 오염됨 — main 브랜치(프로덕션) 배포에서만 수집되게 요청.
- `src/app/layout.tsx`에 `gaEnabled = process.env.VERCEL_ENV === "production"` 게이트 추가, GA 스크립트 블록(옵트아웃 인라인 스크립트 + gtag.js 로더 + config) 전체를 조건부 렌더로 감쌈. Vercel의 `VERCEL_ENV`는 Production Branch(기본 `main`) 배포일 때만 `"production"`이라 preview·로컬은 자동 제외 — 기존 "로드는 되고 런타임에 옵트아웃 플래그" 방식보다 강력(스크립트 자체가 서버에서 렌더 안 됨, 네트워크 요청 없음).
- 블록 내부(호스트명 기반 로컬 차단, `ga-optout` 개인 옵트아웃, `settings-page.tsx` 수동 토글)는 무변경.

### 상단바 로고~InlineSelector 간격 확보

- **왜**: 로고와 "상세/성과" 배경 박스가 너무 붙어 보임.
- `top-bar.tsx`의 `InlineSelector`에 `className="ml-2"` 추가(로고는 그대로, 박스만 우측 이동). `inline-selector.tsx`의 `xl` 변형(이 자리 전용) 버튼 패딩도 `px-4`→`px-3`로 축소.

### 직전 커밋 회귀 2건 수정 — ETF 배지 오버플로우 롤백 + 상단바 로고 재정렬 (#4.24)

- **ETF 배지 오버플로우**: 도넛 라벨과 같은 패턴으로 `BrandMark`(ETF 브랜드 배지)에 넣은 `/scale` 보정이 모바일 프리뷰에서 배지 글자가 칩 밖으로 크게 넘쳐 잘리는 회귀를 일으킴 — 원인은 칩(`size`)이 scale과 무관한 고정 px에 딱 맞춰 튜닝된 좁은 정사각 컨테이너인데 폰트만 `/scale`로 키워 `transform` 적용 전에 이미 넘쳤기 때문(여유 폭 넉넉한 도넛 라벨과 근본적으로 다른 케이스). `scale` prop과 보정 로직 전부 롤백 — 원래대로 칩과 같은 비율로 자연 축소.
- **상단바 로고 재정렬**: `top-bar.tsx`의 `<Logo>`에 넣은 `ml-4`(대시보드 카드 "텍스트" 시작선 기준)가 모바일에서 카드보다 오른쪽으로 처지는 회귀를 일으킴 — 정렬 기준이 카드 텍스트가 아니라 **카드 색상 박스 자체의 외곽 모서리**(사용자 확인)였고, 이 모서리는 top-bar 컨테이너의 `px-3`만으로 이미 일치하는 지점이라 `ml-4` 자체가 불필요했음. 마진 제거.
- 두 회귀 모두 직전 커밋(`fd42883`)에서 "도넛 라벨과 같은 문제일 것"·"카드와 정렬 맞춘 것"이라는 유추만으로 고쳤다가 실제 스크린샷 확인 후 뒤집힌 사례 — 시각적 정렬/스케일 보정은 코드 추론만으로 확정하지 말고 스크린샷으로 재확인할 것.

### CLAUDE.md — "KB 문서 갱신은 배치로" 규칙 신설

- **왜**: 작업마다 `qa-full-test-plan.md`/`components.md`/`state-and-utils.md`/`changelog.md`를 매번 갱신하는 게 비효율적이라는 지적 — 작은 단위 작업을 이어서 진행한 뒤 최종 push 직전에 한 번에 몰아서 갱신하도록 규칙화.
- `CLAUDE.md`에 규칙 추가: 작업 중엔 KB 문서를 갱신하지 않고, **최종 push 요청 시** `/qa-full-test` 실행(Phase 0 자동 검증) → Phase 4에서 KB 일괄 갱신 → 커밋·푸시 순서로 진행. `qa-full-test` 스킬·`qa-full-test-plan.md` Phase 4·`dev-rules.md`의 "신규 공용 자산 등록 시점" 문구도 이 규칙을 참조하도록 함께 정정.

### 인증카드 워터마크 — 서비스 로고(`Logo`) 확정 + 공용 컴포넌트 분리 (#4.24)

- **왜**: 인증카드에 아주 작은 서비스 출처 표시가 필요 — "파비콘 수준"으로 시작해 여러 차례 반려·재설계를 거쳐 확정. 이력: 앱 로고 PNG(스탬프 느낌, 정렬·크기 실패) → lucide `IdCard` 아이콘("기업 로고가 아니다"로 반려) → 파비콘과 동일한 **Leckerli One 서체 "S"** 텍스트 마크로 확정, 사용자가 "여러 서비스 페이지에서 재사용 가능한 별도 컴포넌트로 구성" 요청 → 공용 컴포넌트로 분리.
- 신규 `src/components/logo.tsx`(`Logo`) — `next/font/google`의 `Leckerli_One` 로더를 이 파일 모듈 스코프에서 호출(다른 파일 무변경). `size`/`className`/`style` props로 배치를 호출부에 위임하는 순수 마크. 도메인에 속하지 않는 범용 브랜드 UI 원자라 `(main)/_components/` 도메인 트리가 아니라 `src/components/`(shadcn 전용 `ui/`와 별도)에 배치.
- `share-card.tsx`: 워터마크를 `Logo`로 확정, 크기는 `SHOT_BIG_SCALE`로 프리뷰(24px)→캡처(`Math.round(24×1.46)`=35px) 자동 파생. 위치는 좌측 "총 주식 평가금액" 라벨 최상단과 정렬, 우측 여백은 하단 리스트·막대바(`px-2`)와 동일한 인셋(`right-4 sm:right-5`/`right-5`)으로 통일. 투명도는 최종 100%(불투명), 크기는 사용자 요청에 따라 여러 차례 축소를 거쳐 확정.

### 홈 영역 로고 추가 — 상단바·PWA 하단 네비 (#4.24)

- **왜**: 인증카드 워터마크에 이어 앱의 홈 진입점에도 브랜드 마크 노출.
- `top-bar.tsx`: 홈 화면 좌측("상세/성과" 옆)에 `<Logo size={22}>` 추가. 정렬은 대시보드 최상단 카드(`NetAssetSummaryBox`, `px-4`) 텍스트 시작선 기준 `ml-4` — 처음엔 `ChevronLeft`의 `-ml-1 sm:-ml-2`(아이콘 SVG 내부 여백 보정용)를 같은 이유일 거라 잘못 유추해 반대 방향으로 옮겼다가, 카드가 페이지 콘텐츠(`px-3`)보다 `px-4`만큼 더 안쪽에서 시작한다는 걸 재조사해 정정.
- `bottom-nav.tsx`: PWA standalone 하단 네비 "홈" 탭만 `Home`(lucide) → `<Logo size={20}>`로 교체(활성 시 `MAIN_PALETTE[0]` 색상, 다른 5개 탭 무변경 — 폰트가 단일 weight라 `strokeWidth` 굵기 차이는 재현하지 않음).
- **서브페이지 뒤로가기 버튼(`TopBar`의 `ChevronLeft`)에는 의도적으로 미적용** — 구현 자체는 공용 컴포넌트 1곳뿐이라 단순하지만, 방향 신호(뒤로가기)와 브랜드(홈) 의미가 한 버튼에서 충돌하고 `back()`의 실제 목적지가 대부분 홈이 아니라 상위 허브/이전 화면이라 오히려 혼란을 유발할 수 있어 스킵.

### 인증카드 포트폴리오 도넛 라벨 — PC 프리뷰 크기 불일치 수정 (#4.24)

- **왜**: PC 버전 인증카드에서 도넛 라벨(종목명·%)만 나머지 텍스트(`text-xs`=12px)보다 크게(`text-sm`급) 보인다는 지적. 원인: `rLabelFont = Math.max(15, 12/scale)`의 하한 `15`가 2026-09 프리뷰 본문 축소(14→12px) 이전 값으로 남아있어, PC처럼 도넛이 축소 없이(`scale≈1`) 렌더될 때만 `12/scale=12` 대신 `15`가 이겨 커 보였음(모바일은 `scale<1`이라 `12/scale`이 항상 15를 넘어 문제 없었음 — PC에서만 드러나는 회귀).
- `portfolio-ring-card.tsx`: 하한을 `15`→`12`로 정정(`Math.max(12, 12/scale)`) — PC·모바일 모두 실효 12px로 통일.
- 같은 패턴을 `brand-mark.tsx`(도넛 조각 안 ETF 브랜드 배지 폰트)에서도 발견 — `/scale` 보정이 전혀 없어 모바일처럼 `scale`이 작을 때 배지 글자가 사실상 안 보이는 크기까지 줄어들 수 있었음. `BrandMark`에 `scale?: number`(기본 1) prop 추가해 도넛 라벨과 동일하게 보정, `portfolio-ring-card.tsx`의 두 호출부(메인 칩·"그 외" 미니 칩)에서 `scale={scale}` 전달.
- 재점검 결과 캡처(680px)와 프리뷰(~374px) 텍스트 비율이 소폭(0.2~0.6pp, 워터마크는 1.27pp) 어긋나 있으나, 이는 2026-09 "프리뷰만 축소, 캡처는 유지" 결정의 의도된 부작용이라 별도 수정하지 않음(사용자 확인).

### PWA 잠금화면 — 비밀번호 input 다크모드 테두리 상시 노출 (#4.24)

- **왜**: PC 다크모드에서 미포커스 시 공용 `Input`이 `dark:border-0`(배경 채움만)이라 어두운 배경 위에서 input 위치를 찾기 어려움.
- `pwa-lock-screen.tsx`의 `<Input>`에만 `dark:border dark:border-ring` 추가(공용 `input.tsx`는 무변경) — 포커스 때와 동일한 테두리를 항상 노출.

### 인증카드 저장 배경 — 순수 흑/백으로 고정 (#4.24)

- **왜**: 모바일 환경에서 저장한 PNG 전체 배경이 "옅은 검정"으로 보임 — `bg-background`(다크 `oklch(0.145 0 0)`)가 이론상 거의 검정이지만 oklch 퍼센트 값이라 기기·뷰어에 따라 완전한 `#000`이 아닌 미묘한 톤으로 렌더될 수 있음.
- `share-card.tsx` 캡처(`!responsive`) 분기의 배경을 `bg-background` → **`bg-white dark:bg-black`**로 교체 — 톤 편차 없는 완전한 흰/검정. 프리뷰(`responsive`)는 다이얼로그와의 시각적 통일을 위해 기존 `bg-background` 유지(변경 범위는 저장 PNG로 한정).
- `toPng`의 `backgroundColor`는 캡처 엘리먼트의 `getComputedStyle` 값을 그대로 쓰므로(share-menu.tsx) 이 클래스 교체만으로 저장 이미지 배경이 순수 흑/백이 된다.

### 인증카드 푸터 — 도메인까지 완전 제거 (#4.24)

- **왜**: 직전에 서비스 이름 텍스트만 지웠는데도 도메인(`secretasset.xyz`)이 남아 여전히 출처가 노출됨 → 푸터 전체 제거 요청.
- `share-card.tsx`에서 푸터 `<div>`(도메인 `<span>`) 전체 삭제. 연쇄로 `siteHost`·`APP_CONFIG` import·`footerTok` 변수·`theme.ts`의 `footerDomain` 토큰(양쪽 `ASSET_THEME_SHOT(_BIG)`)까지 죽은 코드가 되어 함께 정리.
- 종목 리스트(주식 현황)/막대바(포트폴리오)가 이제 카드의 마지막 콘텐츠. 카드 하단 여백은 리스트·막대바 래퍼 자체 패딩 + outer padding만 적용(이전의 "헤더 pt-2 ↔ 푸터 pb-2 대칭" 계산은 더 이상 해당 없음 — 별도 조정 요청 시 처리).

### 인증카드 푸터 — 서비스 이름 텍스트 노출 제거 (#4.24)

- **왜**: 공유용 이미지 하단에 "시크릿에셋" 브랜드 텍스트가 노출되는 것을 원치 않음.
- `share-card.tsx` 푸터에서 `APP_CONFIG.name`("시크릿에셋") `<span>`을 제거 — **도메인만**(`secretasset.xyz`) 남김. `theme.ts` `ASSET_THEME_SHOT`/`ASSET_THEME_SHOT_BIG`의 `footerBrand` 토큰(소비처가 없어져 죽은 코드가 됨)도 함께 삭제, `footerDomain`만 유지.
- 프리뷰·저장 PNG 공통(둘 다 같은 `share-card.tsx` 렌더 경로). 간격 토큰(`mt-1.5`/`pb-2`)은 도메인 한 줄 기준으로 그대로 — 레이아웃 변화 없음.

### 인증카드 다크 배경 확인 — preview/저장 이미 동일 적용됨 (#4.24, 코드 변경 없음)

- "저장 시 프리뷰에서 제거된 옅은검정 배경을 동일하게 제거해달라"는 요청 확인 결과: `share-card.tsx`의 `dark:bg-card` 제거(2026-09-06 커밋)가 `responsive`(프리뷰)·`!responsive`(캡처) **두 분기 모두**에 이미 적용돼 있음(`share-card.tsx:179`, [git log](../../src/app/(main)/_components/header-menu/share/share-card.tsx) 확인). 저장 PNG는 캡처 인스턴스의 `getComputedStyle(el).backgroundColor`를 그대로 `toPng` 배경으로 쓰므로(share-menu.tsx) 프리뷰와 동일한 `--background`(다크 `oklch(0.145)`)가 반영된다. 추가 코드 변경 불필요 — 여전히 옅은 검정이 보이면 캐시된 빌드/PWA 서비스워커 문제일 가능성이 높다.

## 2026-09-06

### 인증카드 프리뷰 텍스트 ~2px 축소 (주식 현황 + 포트폴리오 막대바) (#4.24)

- **왜**: 프리뷰에서 "주식 현황" 타입 텍스트(본문 14px·히어로 20px)가 "포트폴리오" 타입(도넛 라벨 실효 ~12px)보다 커 보여, 타입 전환 시 밀도가 튐. 막대바 범례(14px)는 주식 현황 본문과 동일, 도넛 라벨만 작았던 것.
- `theme.ts` `ASSET_THEME_SHOT`(인증카드 프리뷰 전용 토큰) 폰트·아이콘을 ≈12/14로 축소: 본문/범례/수익률/도메인 `text-sm`→`text-xs`(12), `summaryValue` `text-xl`→`text-[17px]`, `profitAmount` `text-base`→`text-sm`(14), `iconInitial` 9→`text-[8px]`, `badge` 10→`text-[9px]`, `footerBrand` `text-xs`→`text-[10px]`, `icon` `size-6`→`size-5`(20).
- `portfolio-sector-bar.tsx` 프리뷰 분기 `big ? "text-[20px]" : "text-sm"` → `… : "text-xs"`(막대·색점 `2.5`는 유지 — 텍스트만). 축소 후 본문·범례·도넛 라벨이 모두 12px대로 수렴.
- **불변**: 저장 PNG(`ASSET_THEME_SHOT_BIG` × `SHOT_BIG_SCALE` 1.46, 이제 프리뷰와 base 분리), 상세>주식 탭(별도 클래스), 간격 토큰, 도넛 기하·`rLabelFont`. `shotBig` 삼항으로 프리뷰/캡처 분리 유지.

### 인증카드 — 다크모드 카드 배경의 옅은검정(`dark:bg-card`) 제거 (#4.24)

- `share-card.tsx` outer div `bg-background dark:bg-card` → **`bg-background`**(프리뷰·캡처 두 브랜치 공통). 다크모드에서 `--card`(`oklch(0.205)`)가 모달 `--background`(`oklch(0.145)`)보다 밝아 카드가 옅은검정 박스로 떠 보이던 것을 제거 — 카드가 모달/앱 배경과 완전히 같은 검정으로 융화.
- 라이트모드는 원래 `dark:` 프리픽스라 무영향. 저장 PNG 배경은 `getComputedStyle(el).backgroundColor` 추적이라 다크 저장 시에도 동일하게 `oklch(0.145)`로 통일. 간격·텍스트·구도 불변.

### 인증카드 포트폴리오 도넛 ↔ 종목명 간격 +8px (#4.24)

- `portfolio-ring-card.tsx` `LABEL_R` 256 → **264**(R_OUTER 240과의 간격 16→24px). 도넛 바깥과 링 밖 종목명 라벨이 살짝 더 떨어진다. 프리뷰·캡처 공통(기하 상수).
- 264가 상한 — 그 이상이면 3/9시 방향 라벨 박스가 `VIEW_W`(656)를 넘어 짤린다(`labelMaxW` 하한 64 기준). `labelMaxW`·`VIEW_W`·`R_OUTER` 등 나머지 불변.

### 인증카드 모달 — 모바일 전체화면 → 12px 인셋 + 콘텐츠 높이(가장자리 블러 오버레이 노출) (#4.24)

- `share-menu.tsx` `DialogContent` 모바일 override를 `w-screen h-[100dvh] rounded-none border-0`(전체화면) → **좌우 12px 인셋**(`left-3 right-3`) + **세로는 `top-[max(0.75rem,env(safe-area-inset-top))]` 앵커 + `h-auto`**: 팝업 세로 길이가 내부 주식현황/포트폴리오 콘텐츠만큼 늘어난다(뷰포트 고정 아님). `translate-x/y-0`로 공용 중앙 배치 해제, `w-auto max-w-none`, `rounded-2xl border shadow-lg`. 가장자리로 공용 `DialogOverlay`(`bg-black/70 backdrop-blur-sm`)가 살짝 비친다.
- **내부 스크롤바 제거**: 직전 시안은 `top`+`bottom` 동시 앵커로 팝업이 뷰포트에 고정돼 프리뷰 영역(`flex-1 overflow-y-auto`)에 자체 세로 스크롤바가 생겼다 → 프리뷰 컨테이너를 모바일 `flex-none overflow-visible`(자연 높이) / `sm:flex-1 sm:overflow-y-auto`로 분기. 콘텐츠가 뷰포트를 넘으면 팝업 셸 전체가 스크롤: `max-h-[calc(100dvh - safe-area top - safe-area bottom)]` + `overflow-x-hidden overflow-y-auto`(`sm:overflow-hidden`).
- `sm:` 이상은 `sm:top/left-[50%] sm:translate-x/y-[-50%] sm:bottom/right-auto sm:w-full sm:max-w-[760px] sm:h-[94dvh] sm:max-h-[96dvh] sm:rounded-lg`로 기존 중앙 배치 복귀.
- 다이얼로그가 노치 아래로 인셋되므로 헤더 `pt-[max(0.875rem,env(safe-area-inset-top))]`→`pt-3`, X 버튼 `top-[max(...)]`→`top-3`.
- 저장 PNG(캡처 인스턴스)·프리뷰 렌더는 무영향(R32).

### 비중바 ↔ 종목 리스트 간격 40px 통일 (상세>주식 · 인증카드>주식 현황) (#4.24)

- `StockCategorySection`(공유) 리스트 블록 `screenshotMode ? "mt-7" : "mt-8"` → `mt-10` 고정(인증카드 28→40px, 상세 32→40px, 두 표면 동일). 섹션 `space-y-3`(12px)은 마진 상쇄로 계속 안 보임 → 이 `mt` 단일 값이 실제 간격.
- 상세 탭은 상쇄 후 마진 하나뿐이라 비대칭 없음. **인증카드는 `mt-7`이 4개 세로 이음새(헤더→범례·범례→리스트·리스트→푸터)를 28px로 맞춘 시스템의 일부**라, `mt`만 키우면 저장 PNG에서 한 이음새만 넓어진다 → `share-card.tsx` 래퍼 `py-3.5`→`py-[26px]`(14→26)로 4개를 함께 40px로 통일. 주석 수치 갱신.
- 저장 PNG 세로만 소폭 증가(pixelRatio 3 → ~+72px). 해상도·구도·텍스트 크기·프리뷰 불변.

### 인증카드 저장 텍스트 배율 조정(1.57→1.42→1.5→1.46) + `SHOT_BIG_SCALE` 문서 상수화 (#4.24)

- **값 조정**: 캡처(저장 PNG) 텍스트 배율 ~1.57 → 1.42 → 1.5 → **1.46**. `ASSET_THEME_SHOT_BIG` 값 재계산(base×1.46): 14→20·20→29·16→23·9→13·10→15px, `icon` `size-[35px]`, footer 18/20. `PortfolioSectorBar big` `text-[20px]`·`size-[15px]`. 도넛 `rLabelFont = round(12*SHOT_BIG_SCALE)` → 18.
- **`SHOT_BIG_SCALE`** 상수를 theme.ts에 도입 — **문서용 배율 기준**. Tailwind JIT가 `text-` 임의값을 소스 문자열로 스캔하므로 CSS 변수/런타임 계산으로는 못 만든다(calc + `--shot-scale` CSS 변수 임의값 방식을 시도했으나 프리뷰에서 아이콘이 원본 크기로 blowout·비중바가 사라져 **롤백**). 이 값을 바꾸면 `ASSET_THEME_SHOT_BIG` 값들을 `base×SCALE` 반올림으로 재계산해 교체(theme.ts 주석에 base 표). `rLabelFont`만 JS 숫자라 `SHOT_BIG_SCALE` import로 자동 파생.
- 프리뷰·`CARD_WIDTH`·`pixelRatio`·`VIEW_W/H`·간격 불변. R35 갱신.

### 인증카드 저장 PNG — 캡처 텍스트를 프리뷰 비율만큼 확대 (680px 아트보드 유지) (#4.24)

- **문제**: 프리뷰(~374px)와 저장 PNG(680px 아트보드)가 같은 `ASSET_THEME_SHOT` 토큰(절대 px 동일)을 써서, 저장 이미지의 텍스트가 카드에서 차지하는 비율이 프리뷰의 ~55%로 작아 보임.
- **조치**: 캡처 전용 큰 토큰 세트. `theme.ts`에 `ASSET_THEME_SHOT_BIG`(폰트·아이콘 ~×1.57: 14→22·20→32·16→26·9→14·10→16px, `icon` `size-[38px]`, 신규 `bodyText` 키) 추가. (실기기 확인 후 초기 ×1.8에서 소폭 축소.) `share-card.tsx`가 `const shotBig = !responsive`를 만들어 `StockSummaryHeader`/`StockCategorySection`/`StockCard`(→`StockRowHeader`→`StockIcon`)·`DetailSummaryHeader`/`ProfitMetric`·`PortfolioSectorBar`(`big` prop)에 스레딩. 각 `screenshotMode ? SHOT.x : "…"` → `screenshotMode ? (shotBig ? SHOT_BIG.x : SHOT.x) : "…"`. 토큰 미경유 하드코딩(`text-sm` "N주"·우측 손익/률·"그 외 N종목"·헤더 라벨/secondary·푸터)도 `bodyText` 또는 인라인으로 분기.
- **도넛 라벨 짤림 방지(프리뷰·캡처 공통)**: `portfolio-ring-card.tsx` — 캡처 `rLabelFont` `null`→`19`, `line-clamp-2`→`line-clamp-3`, top/bottom `labelMaxW` `180`→`208`, `rGap` 프리뷰 `rLabelFont*4`→`*4.5`·캡처 `96`. **좌우 하한은 `Math.max(96,…)`로 올렸다가 9/3시 방향 라벨 박스가 링 좌표계를 벗어나 화면 밖으로 짤려서 `Math.max(64,…)`로 정정** — 가용폭(≈68) 이하로만. 프리뷰는 `scale`에 `PREVIEW_SIDE_INSET`(8px×2)를 빼 좌우 최소 공백도 확보. 좁은 존 긴 이름은 3줄 + 말줄임으로 수렴(화면 밖 짤림 아님). `PortfolioSectorBar`는 `big`이면 텍스트 `text-sm`→`text-[22px]`·막대/색점 `2.5`→`16px`. `StockIcon` 캡처 로고 요청도 `captureLogoSize(28)`→`captureLogoSize(44)`.
- **불변**: `screenshotMode`(정적 렌더·펼침 제거)는 재사용 그대로 — `!responsive`에 재결속 금지(과거 프리뷰 펼침 부활 회귀). `CARD_WIDTH`(680)·`pixelRatio`(3)·`VIEW_W`/`VIEW_H`·간격 토큰 전부 불변 → PNG 해상도·구도·프리뷰 크기 모두 동일. `zoom`/`transform:scale` 래퍼는 `offsetWidth×zoom` Chromium 버전 의존(R32 회귀)·도넛 오버플로로 기각.
- R-registry에 R35 추가.

### 인증카드 프리뷰 텍스트 크기 — 주식현황 히어로 상세탭 통일 + 포트폴리오 도넛 라벨 확대 (#4.24)

- **주식 현황 히어로/아이콘**: 직전 "1px 정렬"에서 종목 행만 맞췄는데, 히어로("총 주식 평가금액")·평가손익·로고 아이콘이 여전히 상세탭 모바일보다 큼. `theme.ts` `ASSET_THEME_SHOT`: `summaryValue` `text-2xl`→`text-xl`(24→20px), `profitAmount` `text-lg`→`text-base`(18→16px), `profitRate` `text-base`→`text-sm`(16→14px), `icon` `size-7`→`size-6`(28→24px). 이제 `ASSET_THEME_SHOT` = `ASSET_THEME` 모바일값에서 `sm:`/`lg:`만 제거한 세트(`cardHeader`/`cardTriggerButton` 간격만 컴팩트 예외). 프리뷰·캡처 공용이라 저장 PNG 히어로도 같이 축소(2040px에서 비가시).
- **포트폴리오 도넛 라벨 프리뷰**: `PortfolioRingCard`가 `responsive`면 링 전체를 `transform: scale(~0.57)`로 축소해 `text-[15px]` 라벨이 모바일에서 ~8.6px로 렌더됨(바로 아래 "분야 구성" `PortfolioSectorBar`는 scale 밖이라 14px 그대로 → 확연히 작음). `portfolio-ring-card.tsx`: `rLabelFont = Math.max(15, 12/scale)`를 라벨 `<span>` 인라인 `fontSize`로(실효 ~12px), `spreadVertically`에 `gap` 파라미터 추가해 `responsive`면 `rGap = max(MIN_LABEL_GAP, rLabelFont*4)`로 세로 겹침 방지. `responsive` 미전달(캡처)이면 분기 안 타므로 **저장 PNG 라벨 15px 완전 불변**(R32).

### 인증카드 주식 현황 종목 행 텍스트 — 상세>주식 탭(모바일)과 1px 정렬 (#4.24)

- "프리뷰/캡처 분리" 이후 프리뷰도 항상 `screenshotMode`(`ASSET_THEME_SHOT`)를 써서, `ASSET_THEME_SHOT`이 `sm:` 데스크톱 값으로 고정돼 있던 탓에 모바일 프리뷰의 종목 행 텍스트가 상세 탭보다 1px 커 보였다.
- `theme.ts` `ASSET_THEME_SHOT`: `cardInfoName` `text-[15px]`→`text-sm`, `cardAmountMain` `text-[15px]`→`text-sm`, `iconInitial` `text-[10px]`→`text-[9px]`, `badge` `text-[11px]`→`text-[10px]` — 전부 모바일 `ASSET_THEME` 값과 동일. `summaryValue`·`profitAmount`·`profitRate`·`icon`은 공유 이미지 강조로 큰 값 유지(사용자 확인).
- `ASSET_THEME_SHOT` 소비처는 `share-card.tsx`뿐 → 인증카드 프리뷰 + 저장 PNG에만 반영(PNG 종목명·금액 1px 축소, 2040px에서 비가시). R32 불변(모두 `sm:` 없는 고정값).

### 인증카드 — 모바일 Whale 저장 시 종목 로고 전부 누락 수정 (#4.24)

- **증상**: 모바일 Whale에서 인증카드 저장 시 주식 현황은 로고 없는 색 원형만, 포트폴리오 도넛은 로고 칩 대부분 빈 공간. PC는 정상.
- **원인 4가지 중첩**:
  1. **과대 요청 크기(주 원인)** — `BrandMark`가 44~92px 칩에 `size*6`(clamp 512) 요청 + `/api/logo`가 항상 `retina:true` → 실제 **1024px PNG**를 7~14장. 680px 카드 × pixelRatio 3(2040px 캔버스)와 겹쳐 모바일 WebView가 디코드/메모리 한계로 `<img> onError`.
  2. **영구 폴백** — `BrandMark`/`StockIcon`의 `imgError` state가 한 번 true면 리셋·재시도 없이 굳어, `toPng` 실행 전 이미 로고가 사라진 상태.
  3. **침묵 실패 pre-pass** — `captureImage`의 dataURL 인라인이 `catch {}` 완전 공백 + settle 대기·타임아웃·재시도 전무.
  4. **콜드 stampede** — `/api/logo` in-flight dedup 없음 + upstream 5s 타임아웃 → 일부 404.
- **조치(레이어별)**:
  - **L1 요청 크기 정상화**: `logo-source.ts`에 `captureLogoSize(표시px)`(=×1.5, route retina로 ×2 → 표시px×3) + `CAPTURE_PIXEL_RATIO`. `BrandMark`는 `captureLogoSize(size)`, `StockIcon`은 캡처 경로만 `captureLogoSize(28)`(실사용 아바타는 무변경). 512/1024px → 84~276px로 축소.
  - **L2 공유 훅 `src/hooks/use-logo-src.ts`**: `imgError` 영구 폴백을 유한 재시도(3회·지수 백오프·`&r=N` 캐시버스터)로 교체. `resolveLogoSrc` 재사용. `BrandMark`·`StockIcon` 채택. `StockIcon`은 로고 URL이 있어도 **최종 실패 시 이니셜 폴백**(기존엔 빈 색 원형).
  - **L3 캡처 오케스트레이션**(`share-menu.tsx`): pre-pass 전 `settleImages`(이미지별 4s·전체 12s), pre-pass `fetch(cache:'force-cache')` + 1회 재시도 + `console.warn`, `toPng`에 `imagePlaceholder`(1x1 투명)·`fetchRequestInit`, `handleSave` `Promise.race` 20s 하드 타임아웃.
  - **L5 `/api/logo`**: 진행 중 요청 `cacheKey` dedup(모듈 `inFlight` Map), upstream 타임아웃 5s→8s.
- 신규 테스트 `src/lib/__tests__/logo-source.test.ts`(8). R-registry에 R34 추가.

### 인증카드 — 주식 펼침 제거 + 포트폴리오 도넛·라벨 확대 (#4.24)

- **주식 현황 펼침 제거**: 위 "프리뷰/캡처 분리"에서 프리뷰 인스턴스에 `screenshotMode={!responsive}`(=false)를 넘기면서, `StockCard`의 상세>주식탭용 펼침(`Collapsible`) 기능이 프리뷰에서 되살아났다. 인증카드는 정적 이미지라 펼침이 없어야 함. → `share-card.tsx`에서 `const shot = !responsive` 삭제, `screenshotMode` 3곳(`StockSummaryHeader`/`StockCategorySection`/`StockCard`)을 **항상 true**로. `StockCard`는 `screenshotMode`면 함수 상단에서 조기 return 해 펼침 DOM 자체가 없음(`stock-tab.tsx:769`). `responsive`는 outer 폭·패딩과 `PortfolioRingCard` 스케일에만 계속 사용. 두 인스턴스의 하위 렌더가 이제 완전히 동일(`ASSET_THEME_SHOT` 고정) — 프리뷰가 저장 이미지와 1:1. (프리뷰 종목 행 텍스트가 잠시 15px이 됐다가 위 "1px 정렬" 항목에서 상세 탭 모바일 14px로 되돌림.)
- **포트폴리오 도넛·라벨 확대**: 링 밖 주식명이 고정 `text-sm` + 위치별로 좁아지는 `labelMaxW` + `line-clamp-2` 조합이라 "임의로 축소된" 느낌. `portfolio-ring-card.tsx` 기하 상수 조정 — `R_INNER` 78→66(밴드 150→174, 도넛이 더 커 보임)·`R_OUTER` 228→240(지름 456→480, 카드폭의 69→73%)·`LABEL_R` 244→256·`VIEW_H` 620→664·`CY` 300→322·`MIN_LABEL_GAP` 58→66·`CHIP_MIN/MAX` 40/84→44/92. 라벨 폰트 `text-sm`→`text-[15px]`(이름·%), `labelMaxW` top/bottom 160→180(좌우 하한 80은 유지 — 올리면 라벨 박스가 카드 패딩을 넘어 짤림).
- **`CARD_WIDTH`(680)·`VIEW_W`(656)는 불변** — `pixelRatio = ceil(1400/CARD_WIDTH)`가 700 부근에서 3→2로 급락하므로. 저장 PNG 가로 해상도·구도 동일, 세로만 pixelRatio(3)배로 +132px. 사용자 확인: 프리뷰·저장 이미지 모두 확대 적용.

### 인증카드 — 프리뷰/캡처 인스턴스 분리 (#4.24)

- **문제**: `ScaledCardPreview`가 680 고정 카드를 통째로 `transform: scale(~0.57)` 축소 → 모바일 프리뷰의 텍스트·도넛이 상세>주식탭보다 훨씬 작게 보였다. 카드 내부 텍스트(`ASSET_THEME_SHOT` 15px)는 이미 상세탭(`ASSET_THEME` 모바일 14px)보다 크거나 같아, 작아 보인 원인은 100% 스케일 축소였다.
- **결정**(사용자): "프리뷰는 모바일에 맞춰 노출, **저장할 때만** 고정 680px." → 미리보기와 캡처를 **별개 `ShareCard` 인스턴스**로 분리.
- **조치**:
  - `share-card.tsx`에 `responsive?: boolean` prop. `responsive`면 전 하위 `screenshotMode={false}` → `ASSET_THEME`(`sm:` 반응형), outer `w-full`. 미전달(캡처 기본)은 현행 `ASSET_THEME_SHOT` 고정.
  - `portfolio-ring-card.tsx`에 `responsive?` prop — 링 서브트리만 자체 fit-to-width 스케일(`min(1, floor(clientWidth)/VIEW_W)`, `overflow-hidden`). 도넛이 모바일 폭을 꽉 채움. 캡처 인스턴스는 `VIEW_W`(656) 고정 불변.
  - `share-menu.tsx`: `ScaledCardPreview` **제거**. 프리뷰 컨테이너에 `<ShareCard responsive />`(ref 없음). 화면 밖(`fixed left-[-9999px] aria-hidden`)에 고정 680 `<ShareCard cardRef={cardRef} />` 상시 마운트 → `toPng`이 이걸 캡처. `pixelRatio = ceil(1400/680) = 3` 불변 → **저장 PNG(~2040px) 변경 전과 100% 동일**.
- **R32 범위 조정**: `sm:` 금지는 캡처 인스턴스(`screenshotMode` 경로)에만 적용. 반응형 프리뷰 인스턴스는 `ASSET_THEME`(`sm:` 포함) 사용, 저장 결정성은 캡처 인스턴스가 담당.
- **X 버튼/헤더 상단 여백**(사용자 추가 요청): `DialogHeader` `pt-[max(0.875rem,env(safe-area-inset-top))]`, 닫기 X `[&_[data-slot=dialog-close]]:top-[max(0.875rem,env(safe-area-inset-top))] sm:top-4` — 노치·상태바 겹침 방지. 좌측은 이미 여백 충분해 그대로.
- **한계**: 도넛은 폭을 꽉 채우지만 링 밖 라벨 폰트는 도넛 비율로 축소됨. 라벨 네이티브화는 viewBox SVG + %-좌표 재설계가 필요(범위 밖, 필요 시 후속).

## 2026-09-05

### 인증카드 다이얼로그 모바일 확대 + 가로 스크롤 전역 금지 (#4.24)

- **문제**: 캡처 대상 카드는 항상 680px 고정(R32)이라 `ScaledCardPreview`가 fit-to-width로 축소 → 모바일에서 scale ≈ 0.5, 도넛·텍스트가 안 보임.
- **제약 확정**(사용자): 저장 PNG는 기기 무관 동일(680 아트보드 유지) · 가로 스크롤바 금지 · 확대 버튼/핀치줌 안 함 · 좌우 여백 제거해 최대 확대. → 물리적 상한 = 뷰포트폭÷680(가로 스크롤 없이 680 고정이면 <680 폰에선 축소 불가피).
- **조치**(`share-menu.tsx` 단독): `DialogContent` 모바일 전체화면(`w-screen h-[100dvh]`, 테두리·라운드 제거, `sm:`는 현행 유지), `DialogDescription` `hidden sm:block`, 헤더·제어바 패딩 축소, 프리뷰 컨테이너 `px-0`(좌우 여백 0). 헤더 패딩 축소에 맞춰 공용 닫기(X) 버튼도 `[&_[data-slot=dialog-close]]:top-1.5 sm:top-3.5` 오버라이드로 제목과 같은 높이 라인에 맞춤(`dialog.tsx` 공용 기본은 미변경). `ScaledCardPreview`는 `floor(clientWidth)` 사용 + outer `overflow-x-hidden`로 서브픽셀 넘침 방어. **캡처 파이프라인·`pixelRatio`·`share-card.tsx` 전부 불변** — `offsetWidth`가 transform 무관 항상 680이라 저장 PNG(~2040px) 동일.
- **가로 스크롤 전역 금지(R33)**: `globals.css` `body { overflow-x: hidden }` 추가. 페이지 레벨만 차단하고 내부 `overflow-x-auto`(X-Ray 표 등)는 무영향. `design-system.md` §8·qa R-registry에 규칙 명문화 — 신규 UI가 뷰포트를 넘기면 스크롤바가 아니라 `min-w-0`로 수렴.
- 페이지 라우트 전환은 검토 후 기각(다이얼로그가 이미 사실상 전체화면, 내비 배관 대비 이득 미미).

### 홈 팁 박스에 "새 공지" 노출 재도입 (#4.24)

- **배경**: NOTICE_ID를 4.24로 갱신했는데, 사용자가 "기존과 같이 신규 공지의 홈 노출 로직을 다시 적용해달라"고 요청. 조사 결과 과거 홈 진입 시 자동 팝업하던 `UpdateNoticeDialog`는 S-4.32에서 "공지보다 기능 추천 프레임이 낫다"는 이유로 **의도적으로 제거**됐던 이력이 있어, 그대로 부활시키기 전에 사용자에게 방식을 재확인함.
- **선택**: 강제 팝업 부활 대신, **홈 팁 박스(`HomeTipBox`)에 "새 공지" 카드를 5번째 종류로 추가**하는 절충안 채택 — 기존 기능 추천 프레임은 유지하면서 새 버전 안내만 챙긴다.
- **구현**: `home-tip.ts`에 `HomeTip`의 `{ kind: "notice" }` 추가, `pickHomeTip`이 `readNoticeSeenId() !== NOTICE_ID`면 반환. 이미 정의만 돼 있고 어디서도 안 쓰이던 `readNoticeSeenId`/`markNoticeSeen`(`local-storage.ts`)를 이번에 처음 실제로 연결. `markCurrentNoticeSeen()`(`home-tip.ts` export, TTL 90일)을 열람 처리의 단일 출처로 둠(최종 호출 지점은 아래 후속들 참조 — 홈 팁 클릭, 더보기 메뉴 수동 열람).
- **후속 1 — 필수 노출로 우선순위 최상단 이동**: "신규 버전 공지는 홈팁 자체가 필수로 뜨도록" 요청에 따라 `notice`를 백업·세금·최신화보다도 **먼저** 체크하도록 재조정(우선순위: **새 공지(필수)** > 백업 > 세금 > 최신화 > 기능).
- **후속 2 — X 닫기로는 영구 dismiss 안 되게**: "X 닫기를 넘어서 최초 1회는 노출"해야 한다는 요청에 따라 `close()`에서 `notice`의 `markCurrentNoticeSeen()` 호출을 제거 — X는 이번 세션만 숨기고(`SESSION_DISMISS_KEY`), **실제로 카드를 클릭해 다이얼로그를 열어야만**(`activate()`) 열람 처리된다. 그냥 계속 닫기만 하면 다음 세션에 다시 최우선으로 뜬다.
- **후속 3 — 다른 팁의 X 닫기가 공지 노출을 가로막지 않게**: 우선순위상 공지가 항상 먼저 뜨긴 하지만, 세션 숨김 플래그(`SESSION_DISMISS_KEY`)는 팁 종류 구분 없이 공용이라 자칫 다른 팁의 X 닫기로 세워진 플래그가 아직 못 본 공지까지 함께 가려버릴 수 있는 구조적 위험이 있었다. `home-tip.ts`에 `isNoticeUnseen()` export 추가, `home-tip-box.tsx`의 `useEffect`가 이 값이 true인 동안은 `SESSION_DISMISS_KEY` 체크 자체를 건너뛰고 `pickHomeTip`을 무조건 호출하도록 수정 — 공지의 "최초 1회 노출"이 다른 팁의 상호작용과 완전히 독립적으로 보장된다.
- **후속 4 — 클릭 시 공지 본문 대신 홍보 기능으로 직행**: "해당 공지 클릭 시 인증카드-포트폴리오 즉시 팝업" 요청에 따라, 공지 팁 클릭 액션을 `dispatchOpenNotice()`(공지 다이얼로그)에서 `dispatchOpenShareCard("portfolio")`로 교체. `dispatchOpenShareCard(variant?)`가 이벤트 `detail.variant`를 싣고, `ShareScreenshotDialog`에 `initialVariant?` prop을 추가해 열릴 때 그 타입으로 맞춘다(`useEffect([open, initialVariant])`). 이제 안 쓰이는 `dispatchOpenNotice`/`trigger-open-notice` 리스너(`tool-menu.tsx`)는 삭제 — 더보기 메뉴 수동 열람은 `showNotice` 로컬 상태로 유지. 릴리스마다 홍보 대상이 바뀌면 `home-tip-box.tsx`의 이 액션도 `notice.tsx` 콘텐츠와 함께 갱신해야 함.
- **공지 내용**(`notice.tsx`): `NOTICE_ID` "20260829"→"20260905", 제목·배너·피처 카드 2개(포트폴리오 인증카드 강화·종목 유형 분석)로 교체, 홈 팁용 한 줄 요약 `NOTICE_SUMMARY` 신규 추가.
- **QA 수정 3건**(`/qa-full-test`에서 발견):
  - **P1 — 공지 X 닫기 후 같은 세션 재진입 시 재노출**: 후속 3의 바이패스가 미열람인 동안 매 마운트 SESSION_DISMISS_KEY를 건너뛰어, X로 닫아도 홈 재진입 시 재노출됐다(사용자 요구 "세션내 미노출" 위반). `NOTICE_SHOWN_SESSION_KEY`(세션 플래그)를 추가해 **공지가 이번 세션에 1회 렌더되면 바이패스를 끈다** — 이후 X 닫기가 정상 작동, 새 세션에선 다시 노출.
  - **P1 — vitest 회귀**: `feature-usage.test.ts`가 `pickRecommendedFeature()` 결과를 `"tax-simulator"`(구 isNew)에 하드코딩. isNew 이동으로 실패 → `picked?.isNew === true` + 카탈로그 첫 isNew id 대조로 의도 검증하게 변경.
  - **P2 — "포트폴리오 인증카드" 홈 팁이 포트폴리오로 안 감**: `app-features.ts`의 `action: dispatchOpenShareCard`(bare)가 인자 없이 호출돼 주식 현황으로 열렸다 → `action: () => dispatchOpenShareCard("portfolio")`.

### 홈 팁·공지사항 4.24 업데이트 (#4.24)

- **홈 팁**(`config/app-features.ts`): 신규 `share-card-portfolio`(포트폴리오 인증카드, `isNew: true`) 추가 — 도넛+로고+분야/보유유형 막대바를 홍보. 기존 `stocks-xray` 설명에 "종목 유형" 축 언급을 추가하고 `isNew: true`로 전환. 지난 릴리스 스포트라이트였던 `tax-simulator`의 `isNew`는 해제(`pickRecommendedFeature`가 카탈로그 순서상 첫 `isNew` 미해제 항목만 보여주므로, 안 지우면 새 항목이 영영 안 뜬다).
- **공지사항**(`layout/onboarding/notice.tsx`): `NOTICE_ID` "20260829"→"20260905", 제목·배너·2개 피처 카드(포트폴리오 인증카드 강화·종목 유형 분석)·마무리 문단을 4.24 내용으로 교체.

### 인증카드 포트폴리오 "보유 유형 구성" — IRP·연금저축펀드 통합 (#4.24)

- **변경**: `categoryItems`(share-card.tsx) 그룹핑 시 `stock.category`가 `irp`·`pension`이면 `"pension_irp"` 키로 합쳐 "연금저축펀드·IRP" 한 버킷으로 표시. 둘 다 세제혜택 은퇴 계좌라 성격이 같다고 판단.
- **`stockCategories`(config/asset-options.ts) 자체는 불변** — 카테고리 필터 탭 등 다른 소비처(6종 그대로)는 영향 없음. 이 막대바 계산에서만 국소적으로 병합.
- **ISA·비상장주식은 그대로 분리 유지** — ISA는 국내·해외 지수 ETF를 다 담을 수 있지만 계좌 성격 자체가 뚜렷이 달라 병합 대상 아님.

### X-Ray "종목 유형" 분류 정확도 개선 — "혁신주" 신설 + 대표 ETF·우량주 결정론화 (#4.24)

- **증상**: VST(비스트라 에너지)가 "배당주"로, 개별 우량주 분류가 업종명만 보고 흔들리는 문제.
- **원인**: `buildPrompt()`의 stockType 규칙이 정량 데이터 없이 "유틸리티=배당주", "은행/자동차=가치주" 같은 **업종명 스테레오타입** 예시에만 의존. 실시간 배당수익률 연동은 조사 결과 배제(`/api/finance/dividend`가 티커당 최대 3회 순차 KIS 호출+슬립이 들어가는 무거운 API라 배치 분류에 끼워 넣으면 지연·레이트리밋 위험 큼 — 국내 종목은 이미 조회 중인 현재가 응답에 PER/PBR/EPS가 포함돼 파싱만 추가하면 저비용이지만 국내 한정이라 이번 범위에서는 보류, 향후 검토로 남김).
- **조치 1 — 프롬프트 반스테레오타입화**: 업종명 나열 예시 제거, "실제로 잘 알려진 배당수익률·재무 프로필로 판단하라"는 지침 + VST를 교정 반례로 명시.
- **조치 2 — 대표 ETF·우량주 결정론적 오버라이드**(`extractStockType`, 전수 목록 아님·대표 예시만): 커버드콜 ETF(JEPI/JEPQ/YMAX 등)→배당주, 배당성장 ETF(SCHD/DGRO 등)→배당성장주, 배당귀족 개별주(KO/PG/O 등)→배당성장주, 고배당 개별주(T/VZ, KT&G 등)→배당주, 전통 은행·경기민감 대형주(BAC/WFC, 국내 금융지주 등)→가치주.
- **조치 3 — "혁신주" 신설**(`STOCK_TYPE_ENUM` 8번째 값): 로켓랩·아이온큐·초기 바이오텍처럼 검증 안 된 파괴적 기술 베팅 종목을 대형 흑자 성장주(성장주)와 분리. 테슬라는 대량 양산·상당한 매출 규모라 성장주에 유지(하드코딩 안 함, AI 판단).
- **조치 4 — 전체 강제 재분류**: `STOCK_TYPE_PROMPT_VERSION` 버전 마커 도입. 서버 캐시 유효성 체크(`route.ts`)와 클라이언트 게이트(`fetch-classifications.ts`) **양쪽 다** 이 값을 요구해야 한다 — 하나만 걸면 그쪽에서 재분류 요청 자체가 안 나가는 버그가 난다(바로 전 커밋에서 `stockType` 필드 추가 시 클라 게이트 누락으로 실제 겪은 버그와 동일 함정, 이번엔 처음부터 양쪽 다 반영). 버전을 올려 VST·현대차 등 이미 캐시된 종목도 다음 방문 시 전부 재분류되게 함.

### X-Ray "종목 유형" 축 — 전부 미분류 버그 수정 (#4.24)

- **증상**: 채권/현금성(하드코딩 매핑) 1건만 정상, 나머지 전부 "미분류".
- **원인**: `fetch-classifications.ts`의 클라이언트측 "분류 완료 여부" 게이트가 `themes`·`indices`·유효한 `sector`만 확인하고 `stockType`은 확인하지 않았다. 기존에 이미 분류된 종목(예전부터 themes/sector/indices 보유)은 "완료됨"으로 판정돼 `/api/xray-classify` 요청 목록에서 아예 빠졌다 — 서버측 `stockType` 캐시 유효성 체크(어제 추가)는 요청 자체가 안 오니 무용지물이었다.
- **수정**: 같은 필터에 `hasValidStockType` 체크 추가(`route.ts`의 서버측 체크와 동일 조건). 다음 X-Ray 탭 방문 시 기존 캐시 종목도 재요청→백필된다.


### X-Ray "종목 유형" 축 신설 (#4.24)

- **용어 정정**: 인증카드 검토 중 제안했던 "투자 스타일"(성장주/배당성장주/배당주/지수투자) 분류가 실제로는 "투자자의 스타일"이 아니라 "종목 자체의 투자 성격"이라는 지적에 따라 **`stockType`("종목 유형")** 으로 이름을 바꿔 확정. `sector`(산업이 뭔가) 축과 나란한 별개 축.
- **채권/현금성 신설**: 국채·SGOV·TLT류 달러 표시 채권/현금성 자산 요구에 따라 `채권/현금성` 값 추가 — 총 7종(성장주/배당성장주/배당주/지수투자/가치주/채권·현금성/기타).
- **서버측 하드코딩 우선 매핑**: SGOV/BIL/SHV/TLT 등 대표 티커·"국채"·"채권" 등 이름 키워드는 AI 호출 전에 확정 배정(`extractStockType`, `extractIndex`의 `US_INDEX_ETF_MAP` 패턴 재사용) — 애매한 AI 판정 여지 원천 차단.
- **범위**: 이번엔 주식 X-Ray 탭까지만(`stock-xray-view.tsx` 6번째 탭). 포트폴리오 인증카드 적용은 후속 작업.
- **배관**: `theme`(핵심 분야) 축의 기존 패턴(분류 캐시 스키마→Gemini 응답 스키마·프롬프트→집계 엔진 extractor→UI 탭) 그대로 재사용. 서버 캐시 유효성 체크에 `stockType`을 추가해 `indices` 필드 도입 때와 동일하게 이미 캐시된 티커도 점진적으로 백필.
- `.claude/specs/README.md` 판정 체크리스트 확인 결과 스키마·저장 키·공유 토큰·새 API 라우트·다중 화면 어디에도 해당 없어 명세(`/spec`) 없이 진행.

### 인증카드 포트폴리오 — "분야 구성" 상위 5 + "그 외 N개 분야"로 통일 (#4.24)

- 상위 노출 개수를 종목 리스트와 공유하던 `SHOT_MAX`(7)에서 분리해 전용 `SECTOR_MAX`(5) 도입. 항목 수가 들쭉날쭉(최대 8개까지) 늘어지던 걸 항상 **5개 + "그 외 N개 분야"** 최대 6항목으로 고정. "그 외" 라벨도 개수 없는 "그 외"에서 도넛 "그 외 N종목"과 같은 형식(`그 외 N개 분야`)으로 통일.

### 인증카드 포트폴리오 — "보유 유형 구성" 비중 계산 버그 수정 (#4.24)

- **증상**: 총 주식 9.1억 중 IRP 실보유 0.57억(6.3%)인데 막대바엔 1.3%로 축소 표시.
- **원인**: `categoryItems`가 `mergedStocks`(useFilteredStockData("all")의 병합 결과)를 순회했는데, "all" 필터는 **카테고리 무관 티커 단위**로 병합한다(`groupByTickerOnly`). 같은 ETF(예: ACE 미국S&P500)를 연금 계좌와 IRP 계좌 양쪽에 보유하면 병합 대표 1건에 `category`가 하나만 남아, 다른 계좌의 보유분이 그 카테고리 합계에서 통째로 빠졌다.
- **수정**: `mergedStocks` 대신 **병합 전 원본 `assetData.stocks`**를 순회(delisted만 제외해 `totalValue` 분모와 동일 필터)해 각 보유분을 실제 계좌 카테고리로 정확히 집계. 병합은 "같은 종목을 한 행으로 보여주는" 표시 로직이라 카테고리별 합산엔 애초에 맞지 않는 소스였음.

### 인증카드 포트폴리오 — "보유 유형 구성" 막대바 추가 (#4.24)

- **선정 근거**: 후보 3가지(계좌/보유유형·통화·국가) 중 `Stock.category`(국내주식/해외주식/IRP/ISA/연금저축펀드/비상장주식) 채택. 종목 등록 시 **필수 입력**이라 분류 캐시 의존이 0이고(통화 축은 국내 계좌 4종이 전부 KRW로 뭉쳐 정보량이 적고, 국가 축은 `classification-store` 캐시 의존이라 미분류 가능성 있음), 기존 "분야 구성"(무엇을 샀는지)과 상호보완적(어디에 담겨있는지).
- **컴포넌트 재사용**: `PortfolioSectorBar`를 새로 안 만들고 `title` prop만 추가해 "분야 구성"·"보유 유형 구성" 양쪽에 재사용. 라벨도 `stockCategories`(`config/asset-options.ts`, 카테고리 필터 탭과 동일 출처)를 그대로 씀 — 신규 라벨 맵 없음.
- 카테고리 수가 최대 6개뿐이라 "분야 구성"과 달리 상위 N 절삭·"그 외" 롤업 없이 전부 노출. 표시 조건은 `length > 0`(단일 카테고리도 항상 노출).

### 인증카드 — 주식 현황 비중바 팔레트 통일·포트폴리오 텍스트 확대·도넛 확대 (#4.24)

- **주식 현황 비중바 색 교체**: `ShareCard`가 훅에서 받은 `barItems`/`barColors`(`MAIN_PALETTE`, 주식 탭과 공유)를 `StockCategorySection`에 그대로 넘기지 않고, `segFill`(=`SHARE_SAFE_PALETTE`)로 색만 덮어씌운 `shareBarItems`/`shareBarColors`를 새로 만들어 전달. 포트폴리오 도넛·분야 막대바와 색 계열 통일. 주식 탭 원본 배열·`MAIN_PALETTE`는 불변(인증카드 전용 오버레이).
- **포트폴리오 텍스트 확대**: 도넛 라벨(이름·%) `text-[13px]`→`text-sm`, 분야 막대바 캡션·범례(`text-[11px]`/`text-[12px]`)→`text-sm`. 주식 현황 쪽(`ASSET_THEME_SHOT`)은 이미 `text-sm`(범례) / `15px`(카드 이름·금액)라 기준 이상 — 변경 없음.
- **도넛 크기 확대**: `R_OUTER` 215→**228**, `LABEL_R` 231→**244**(간격 16px 유지). `R_INNER=78`은 고정 — 중앙 홀 크기는 그대로 두고 바깥 링만 커짐. `LOGO_R`(≈168)·칩 크기 상한(chord 기반)은 공식 그대로라 재계산만 되고 로직 변경 없음.

## 2026-09-04

### 인증카드 포트폴리오 — 구분선·ETF 배지·고채도 팔레트·"그 외" 미니 로고 (#4.24)

- **원인 실측**: logo.dev 로고 PNG를 디코드해 확인 — ACE ETF는 순백 `#FFFFFF` 불투명이 전체의 **92.9%**, TIGER(미래에셋)는 **97.0%**. KODEX(삼성)는 이미 투명, TSLA·NVDA는 브랜드 컬러로 꽉 참. 즉 흰 배경 이질감은 **국내 ETF 운용사 로고** 문제였다.
- **국내 ETF는 브랜드 텍스트 배지**: `resolveLogoSrc`는 그대로 두고(주식 탭 `StockIcon`은 원형 아바타라 흰 배경 로고도 자연스러워 계속 사용), `BrandMark`가 `etfBrand`(TIGER/KODEX/ACE…) prop 유무로 **호출 전에** 분기해 로고 요청 없이 브랜드명을 원형 칩에 텍스트로 그린다. (최초 구현은 `resolveLogoSrc`에서 국내 ETF를 무조건 `null` 처리했는데, 이 함수가 `StockIcon`과 공유돼 주식 현황 탭의 ETF 로고까지 사라지는 회귀가 있어 즉시 되돌림.) 글자색은 조각색 휘도로 자동 선택(`pickOnColor`). 브랜드 접두어 목록(`KR_ETF_BRANDS` 22개)을 `logo-source.ts`로 일원화하고 `stock-xray.ts`가 import — 중복 정의와 존재하지 않는 파일을 가리키던 stale 주석 정리.
- **로고 완전 원형**: `object-contain`+패딩 → `object-cover`로 칩을 꽉 채워 클립. TSLA 등의 사각 모서리 제거.
- **고채도 팔레트 신설**: `PORTFOLIO_PALETTE`(10색, hue 고르게 분산). `MAIN_PALETTE`는 앱 다른 차트용으로 **불변**. 다크 대비 4.3~8.6:1.
- **구분선 두께** 2.5 → **5px**.
- **중앙 홀 축소**: `R_INNER` 108 → **78**(밴드 107→137px). 이때 `LOGO_R`을 밴드 중앙에 두면 현 길이가 짧아져 최소 조각 로고가 생략되므로 **바깥쪽 0.6 지점(≈160)** 으로 재정의.
- **"그 외" 미니 로고 3개**: `RingSegment.subLogos`(상위 3종목)를 조각 각도 범위에 균등 배치(28px 칩). `computeRingArcs(pcts, minArcs?)`에 세그먼트별 최소각을 추가해 "그 외"에 `ETC_MIN_ARC`=40°를 보장 — 부족분은 다른 조각에서 비례 회수하되 `MIN_ARC_DEG` 바닥은 침범하지 않는 후처리 1패스(합 360·단조성 유지, 대표 입력 3종 검산 완료).

## 2026-09-03

### 인증카드 포트폴리오 — 선명도 개선(로고 칩 통일·무지개 복귀·구분선 제거) (#4.24)

- **왜**: 레퍼런스 대비 흐릿하고 촌스러웠다. 원인 3가지 — ① logo.dev 이미지 자체가 흰 배경 사각형이라 "투명 로고"가 애초에 불가능(조각 위에 흰 박스가 뜬 모양) ② 조각 사이 반투명 구분선이 어두운 seam·앨리어싱으로 저해상도처럼 보임 ③ 인디고 단색 램프의 채도가 낮아 흐림.
- **로고 = 흰 라운드 사각 칩으로 통일**(`BrandMark`): 제각각인 로고 배경과 싸우는 대신 모두 같은 칩(`bg-white rounded-[12px] shadow-sm`, 60×46)에 담아 *의도된 배지*로 전환. 로고 없으면 칩 안 티커 텍스트. 요청 해상도 `max(w,h)*6`로 상향.
- **팔레트 원본 복귀**: 칩이 로고를 조각색에서 분리하므로 램프의 전제(로고 충돌 방지)가 사라짐 → `SHARE_SAFE_PALETTE` = **`MAIN_PALETTE.slice(0,11)` 원본 색 그대로**(앱 다른 차트와 동일한 쨍한 색감). 이 카드엔 부채·손익 표기가 없어 의미 예약색(빨강·주황)도 포함. 텍스트 전용 배열(`SHARE_RAMP_TEXT`/`SHARE_LABEL_TEXT`)·`onRampColor()` 전부 삭제 — **조각 fill 과 % 텍스트가 같은 색**(주식 탭 범례 규약).
- **로고 칩 지름은 비중(조각 각도)에 비례**(`chipSizeFor`: 22°→40px … 110°→84px, sqrt 이징 + 현 길이 상한). 최소 조각각에서도 들어가도록 하한을 잡았다. 칩은 **원형 + 배경 = 해당 조각색** — 투명 여백 로고가 조각과 자연스럽게 이어진다. **로고가 없으면 칩 자체를 그리지 않는다**("그 외" 조각의 빈 배지 제거).
- **조각 구분선 = 라이트 화이트 / 다크 검정**(`--ring-divider` 고정값). 반투명 stroke가 어두운 seam·앨리어싱으로 보이던 문제 해결. `GAP_DEG` 0.4→0.
- **도넛 외곽 링 제거**: `--ring-hairline` `<circle>`·변수 모두 삭제 — 별도 테두리 없이 색면만으로 마감.

## 2026-09-02

### 인증카드 포트폴리오 — 대형 도넛 + 조각 안 기업 로고 (#4.24)

- **왜**: 레퍼런스(Buffett Portfolio 인포그래픽)처럼 도넛이 카드의 절반 이상을 차지하고, 조각 안에 투명 배경 기업 로고가 박히는 형태를 목표. 기존엔 도넛이 카드 폭의 ~45%였고 로고가 링 바깥 컬러 원형 아바타였다.
- **카드 확대**: `CARD_WIDTH` 520→**680**, 다이얼로그 `max-w-[560px] sm:max-w-[760px]`, 링 기하 `R_OUTER` 118→**215**(지름 430 ≈ 카드 폭 63%)·`R_INNER` 44→**108**(중앙 비움, 밴드 107px)·`VIEW_W/H` 656/620. pixelRatio 목표를 `CAPTURE_TARGET_PX=1400`으로 상수화(680 기준 3배 → PNG ~2040px, 그대로 뒀으면 2배로 떨어져 해상도가 낮아졌음).
- **조각 안 로고**(신규 `brand-mark.tsx`): 원형 배경·`object-cover` 없이 투명 로고를 밴드 중앙(`LOGO_R`)에 배치. 호 18° 미만 조각은 생략. 로고 없으면 티커 텍스트 폴백. 링 바깥 라벨에서 아이콘 제거(이름+%만).
- **로고 API 개편**(`/api/logo`): logo.dev 옵션을 실제로 사용하도록 개편 — `format=png`(**기본이 JPEG라 투명 배경이 불가능했음**, 조각 위 투명 로고의 핵심)·`size`+`retina=true`(캡처 pixelRatio 3 대응)·`theme=light|dark`(조각 밝기별 변형)·`fallback=404`(logo.dev 기본 모노그램 대신 우리 티커 텍스트 폴백). 캐시 키 `v2:{d|t}:{key}:{size}:{theme}`. **티커 실패 시 302 리다이렉트 제거** — 크로스오리진이라 캡처의 dataURL 인라인이 CORS로 실패해 저장 PNG에서 로고가 통째로 빠지던 버그 수정.
- **Brandfetch는 도입 불가로 결론**: Logo Link 가이드라인이 서버 측 fetch·프록시·캐싱을 명시 금지하고 `x-bf-error: automated_traffic`으로 302 차단한다(유효한 client ID여도 동일 — 잘못된 키만 403). 브라우저 `<img>` 직접 hotlink만 허용인데 우리는 캡처를 위해 same-origin 바이트가 필수라 구조적으로 비호환. 관련 코드·환경변수 없음.
- **공용화**: 로고 src 해석을 `lib/finance/logo-source.ts`의 `resolveLogoSrc`로 추출 — `StockIcon`(원형)과 `BrandMark`(투명)가 공유. `ETF_DOMAIN`도 이 파일로 이동.
- **팔레트**: `SHARE_SAFE_PALETTE`를 무지개 → **브랜드 인디고 단색 램프 9단**(밝은 1위 → 어두운 하위). 풀컬러 로고가 어느 조각에서도 살도록. 텍스트 전용 `SHARE_RAMP_TEXT`(명도 정규화)·조각 위 대비색 `onRampColor(i)` 신설.
- **문서 stale 정리**: components.md R25→R32 오기·중복 문단·`SHOT_MAX =5`·`MIN_LABEL_GAP`/`GAP_DEG` 값 불일치, api-reference의 "Clearbit" 오기, qa-full-test-plan의 `SHARE_SAFE_PALETTE` 소비처 0 서술.

## 2026-09-01

### 인증카드 포트폴리오 — 유려함 + 분야(섹터) 막대바 (#4.24)

- **왜**: 포트폴리오 카드를 "글로벌 공식 포트폴리오 인포그래픽" 톤으로. 종목 도넛만으로는 분야 편중(예: "AI 및 반도체" 집중)이 안 보임.
- **분야 막대바**(신규 `portfolio-sector-bar.tsx`): 종목 도넛 아래에 X-Ray 테마 축 분포(`computeBreakdown("theme", …)` 재사용) 상위 7 + "그 외", **분야명 + %만**(금액·개별 종목 없음). 유효 분야 2개 미만이면 조용히 생략.
- **팔레트**: 포트폴리오 도넛·막대바를 미사용이던 `SHARE_SAFE_PALETTE`(의미색 빨강·주황 제외 9색) 공용으로 전환 — 색 조정은 이 배열만 손봄. 주식 현황 타입은 `assignColors`/`MAIN_PALETTE` 유지.
- **도넛 유려함**: 웨지 stroke 3→2px + `GAP_DEG`(0.8°) hairline 간극, 라벨 이름 `font-bold`→`semibold tracking-tight`, %는 조각색 bold. 중앙 빈 홀 → **핵심 지표**("N 종목", `R_INNER` 35→44). **동심 헤어라인 외곽선**(`var(--border)` 1px 원선 2개).
- **분류 자동 fetch**: 인증카드 다이얼로그가 포트폴리오 선택 시 `useXrayClassifications`(신규 공용 훅 — `stock-xray-view`·`stock-insight-strip` 복붙 통합)로 X-Ray 분류 캐시를 자동 보충 → 완료 시 분야 막대바 등장(비차단). X-Ray 탭 방문 없이도 동작.
- **팔레트·라인**: `SHARE_SAFE_PALETTE` = `MAIN_PALETTE` 무지개 hue 유지 + 애플 시스템 톤으로 값 정제(채도 정돈·탁함 제거) 9색, `[0]` 인디고 원본 고정, "그 외"=`#8E8E93`. 도넛 조각 구분선 = `--ring-divider`(라이트 흰색 / 다크 white/22) 2.5px stroke — 다크에서도 조각이 또렷이 분리. 외곽 링 = `--ring-hairline`(라이트 black/24 / 다크 white/48) 2.5px `<circle>` — 도넛을 확실히 두르는 프레임. (기존 `var(--border)` 헤어라인이 캡처에서 안 보이던 문제 해결.)

### 홈 팁 박스 — X 닫기 시 이번 세션 재노출 금지

- **왜**: `HomeTipBox`의 X를 누르면 해당 종류만 억제되고 `useEffect` 재실행 때 바로 다음 순위 팁이 같은 창에 튀어나와, 닫아도 계속 새 팁이 뜨는 두더지잡기 경험이었다.
- **변경**(`views/home/home-tip-box.tsx` 단일 파일): `close()`에서 기존 종류별 mark에 더해 `sessionStorage`에 `secretasset_home_tip_session_dismissed` 플래그를 찍고, 팁 계산 `useEffect` 최상단에서 이 플래그가 있으면 `pickHomeTip`을 건너뛰고 `null` 처리. `pwa-connect-prompt.tsx`의 세션 dismiss 패턴 재사용.
- **재접속(새 세션)** 시 `sessionStorage`가 비므로 각 종류의 재노출 정책(기능=영구 dismiss→다음 기능, 세금=이번 달 등)에 따라 다음 팁이 정상 회전 노출. 새 localStorage 키·동기화 없음.

## 2026-08-31

### 인증카드 "포트폴리오" 타입 추가 (#4.24)

- **왜**: 기존 인증카드는 "주식 현황" 단일 레이아웃뿐. 금액을 뺀 종목 구성 비중만 보여주는 공유용 카드 수요 — 첨부 레퍼런스("Trump's Updated Portfolio") 스타일의 원형 링.
- **교체 아닌 타입 추가**: `ShareScreenshotDialog`에 `InlineSelector`(로컬 state, 저장 안 함)로 "주식 현황 / 포트폴리오" 전환. 과거 2회 도넛 *교체* 시도가 롤백됐던 것과 달리 기존 타입은 코드 경로 무변경.
- **신규**: `header-menu/share/portfolio-ring-card.tsx`(`PortfolioRingCard` + `computeRingArcs` 순수 함수). 각도 압축 = 조각별 최소각(`MIN_ARC_DEG`) + 비중 구간별 최대 호 상한(`MAX_ARC_BY_PCT`) + 단조 clamp + 360° 정규화 → 단일 종목 80~90%여도 링이 한 조각에 먹히지 않음. 상수만 바꿔 튜닝.
- **재사용**: 데이터는 `ShareCard`의 `useFilteredStockData("all")`/`computeStockMetrics`/`barColors` 그대로 주입(훅 중복 없음), 로고는 `StockIcon`(`stock-tab.tsx`에서 `export`만 추가) → `/api/logo`, 세그먼트 토글은 `InlineSelector`, 캡처는 `share-menu.tsx` 기존 파이프라인 무변경.
- **폰트**: 종목명 디스플레이 서체로 Playfair Display(`--font-playfair`, `layout.tsx` `next/font/google`) — 라틴만, 한글은 시스템 폰트 폴백. 이 타입 밖으로 확장 금지.
- **후속 조정 1차**: (1) 두 타입 공통 푸터에서 **날짜 제거**. (2) 포트폴리오 링 **중앙 브랜드 마크·하단 "MY PORTFOLIO" 문구 제거**. (3) 링 기하 확대. (4) 라벨 종목명 1줄 `truncate` → **2줄 `line-clamp-2`**.
- **후속 조정 2차(가독성)**: (1) `CARD_WIDTH` 460→**520**(단일 고정값, 다이얼로그 `max-w-[520/680]` 안, 기기 무관 동일 PNG=R25 유지) — 도넛·라벨 공간 확보. (2) **비중%를 도넛 조각 안쪽 SVG `<text>`**(흰 글씨 + 어두운 `paintOrder=stroke` 외곽선)로 이동, 조각 밖 라벨은 **아이콘+종목명만**. (3) 도넛 대폭 확대 + **중앙 홀 최소화**(`R_OUTER` 122→166, `R_INNER` 74→44, 밴드 ~122px). (4) 주식 현황 "금액 표시" 스위치를 제어 바 **2번째 줄로 분리 + 축소**(`scale-75`, `text-xs`).
- **후속 조정 3차(레퍼런스 정렬)**: (1) 도넛 **축소**(`R_OUTER` 166→124, `R_INNER` 44→64, `VIEW_H` 470→420) — 링 밖 라벨 공간 확보. (2) 비중%를 다시 **링 바깥 라벨**로(조각 안 `<text>` 제거), 이름 아래 `text-muted-foreground`로 위계 분리. (3) **Playfair(세리프) 전면 폐기**(`layout.tsx`에서 `next/font` import·body variable 제거) → 앱 기본 산세리프. 종목명 `font-bold text-foreground`. (4) **라벨 텍스트 하이브리드**: 해외=티커 / 국내=종목명. (5) 링 밖 라벨 존별 가로 배치(측면)·세로 배치(상하).

## 2026-08-29

### PWA 스크롤버튼 겹침·시뮬레이터 박스 크기·공지사항 최신화

- **왜**: PWA standalone에서 `ScrollToTop`(`scroll-to-top.tsx`)의 `bottom-18/22` 고정 오프셋이 `BottomNav`(pt+버튼+safe-area 반영 padding으로 실제 높이 약 95~120px)보다 낮아 하단 네비에 가려짐. 절세 시뮬레이션 상단 결과 박스의 세액 숫자가 `text-3xl` 고정이라 모바일에서 과도하게 큼. `notice.tsx`의 "인증카드 개편" 카드는 그 기능이 이후 세션에서 전면 롤백돼 **실제로 존재하지 않는 기능을 안내하는 사실 오류** 상태였음.
- **ScrollToTop**: `usePWAInstall().isStandalone`(기존 `top-bar.tsx` 등이 쓰는 훅 재사용)으로 standalone일 때만 `bottom-[calc(7rem+env(safe-area-inset-bottom))]`로 상향, 브라우저 탭은 기존 값 유지.
- **절세 시뮬레이션**: 세액 숫자를 `text-3xl` → `text-2xl sm:text-3xl`(`dashboard.tsx`/`net-asset-chart.tsx`와 동일한 반응형 관례).
- **notice.tsx**: `NOTICE_ID`를 `20260829`로 bump, 사실과 다른 "인증카드 개편" 카드 제거하고 실제 신규 기능(연말 절세 시뮬레이션·홈 기능 추천 팁) 2개로 교체. 08-08 업데이트에 종속됐던 "신용대출-부동산 연계" 1회성 행동요청 배너도 이번 내용과 무관해 함께 제거.

## 2026-08-28

### 홈 알림 박스 4개(백업·최신화·세금·기능팁) → 1개로 통합

- **왜**: 홈 화면에 상단(백업 넛지·자산 최신화 넛지) + 하단(기능 팁 박스·세금 안내 박스) 총 4개의 알림성 박스가 각자 독립 판단으로 뜨다 보니 화면이 산만했다 — 사용자가 "모두 팁 박스로 통합" 요청.
- **통합 위치·우선순위**: 하단 1곳(자산분포 카드 아래, 기존 기능 팁 박스 자리)에만 존재 — 상단 자리는 없어짐. 위험도 순으로 1개만 노출: 백업(데이터 손실 위험) > 세금(마감 시한) > 자산 최신화 > 신규 기능 > 저방문 기능(전부 사용자 확정).
- **신규**: `src/lib/home-tip.ts`(`pickHomeTip` — 기존 4개 유틸의 순수 판정 함수를 조합만 함, 신규 판정 로직 없음), `views/home/home-tip-box.tsx`(통합 UI, 기존 `feature-tip-box.tsx`의 보더리스 셸 재사용).
- **재노출 정책은 종류별로 원래 그대로 보존**(하나로 뭉개지 않음) — 백업·최신화는 노출되는 순간 오늘 flag(daily), 세금은 명시적으로 닫아야만 이번 달 flag(monthly), 기능은 닫기·클릭 이동 둘 다 영구 dismiss. 우선순위상 하위라 안 뜬 종류는 flag를 찍지 않는다(과거 `RefreshNudge`의 `suppressed` 시 mark 생략과 동일 원리).
- **인터랙션 통일**: 4종 모두 "카드 전체 클릭 = 유일한 동작(백업 다운로드/세금 화면 이동/최신화 시트 오픈/기능 화면 이동), X = 닫기"로 단순화 — 백업·최신화가 갖고 있던 별도 "지금 백업하기"/"지금 최신화하기" 버튼은 제거.
- **삭제**: `backup-nudge.tsx`, `refresh-nudge.tsx`, `tax-notice-box.tsx`, `feature-tip-box.tsx` 4개 파일. 판정 로직(`backup-status.ts`/`asset-refresh-status.ts`/`tax-utils.ts`/`feature-usage.ts`)은 UI가 아니므로 전부 그대로 유지.
- **KB**: `qa-full-test-plan.md`의 F-NOTICE(세금 홈 배너 부분)·F-ASSET-REFRESH(RefreshNudge 부분)를 신규 F-HOME-TIP 섹션으로 통합, `components.md`·`state-and-utils.md` 갱신.

### 홈 "기능 활용 팁" 추천 박스 신설 + 자동 팝업 공지 제거

- **왜**: 기존 계획은 "공지사항 요약 박스"였으나, 신규 기능(절세 시뮬레이션)을 사용자가 놓치지 않게 하는 것이 목적이라면 "공지"보다 "지금 써볼 만한 기능 추천"이 더 맞는 프레임이라는 판단. 이번 릴리스 신규 기능을 최우선 추천하고, 이후엔 로컬 방문 기록 기반으로 사용자가 자주 안 쓰는 기능을 추천해 기능 발견성을 높인다.
- **신규**: `src/config/app-features.ts`(`APP_FEATURES`, 핵심 기능 13개 카탈로그 — 백업·피드백·설정·기기 동기화는 유틸리티류라 제외), `src/lib/feature-usage.ts`(방문 기록 + `pickRecommendedFeature` 추천 로직, `STORAGE_KEYS.featureUsage` 단일 키), `src/stores/tax-view-store.ts`(세금 관리 진입 시 초기 탭 지정, `loan-tx-view-store.ts` 패턴), `views/home/feature-tip-box.tsx`(홈 UI, `tax-notice-box.tsx`와 동일 보더리스 셸).
- **방문 기록 훅**: `navigation-context.tsx`의 `navigate()` 단일 지점에 `recordVisit(viewToKey(v))` 추가 — 모든 페이지 이동이 이 함수를 통과하므로 훅 지점은 여기 한 곳. `navigate`를 안 쓰는 인증카드(`share-card`, action형)는 신규 `dispatchOpenShareCard()` + `top-bar.tsx`의 `trigger-open-share-card` 리스너가 별도로 `recordVisit("share-card")` 호출(asset-dispatch.ts↔feature-usage.ts 순환 참조를 피하려 기록 로직은 리스너 쪽에 둠).
- **추천 우선순위**: ①dismiss 안 된 `isNew` 항목(카탈로그 순) ②dismiss 안 된 항목 중 방문횟수 오름차순(0회 우선). 닫기·클릭 이동 모두 해당 팁을 **영구** dismiss — 2026-08-12 자산 신선도·목표 설정 알림이 "반복 리마인드 효용 낮음"으로 롤백된 전례를 근거로 주기적 재노출 대신 영구 미노출을 채택.
- **방문 기록에 별도 동의 UI 없음** — `lastVisitDate`·`assetRefresh`·`tutorialStatus` 등 기존 로컬 전용 사용 상태 키들도 전부 동의 절차 없이 기록되며 서버로 전송되지 않는다는 기존 원칙을 그대로 따름.
- **자동 팝업 제거**: `UpdateNoticeDialog`(홈 첫 진입 시 자동으로 뜨던 공지 다이얼로그)와 그 파일(`notice-dialog.tsx`)을 삭제. 더보기 > "앱 가이드 · 공지사항"의 수동 열람(`notice.tsx`의 `NoticeContent` 재사용)은 그대로 유지 — 공지 확인 수단 자체가 없어지는 것은 아님.
- **공지·팁 작성 규칙 문서화**: `dev-rules.md`에 "공지·팁 콘텐츠 작성 3원칙"(①기능 위치·이동 경로 명시 ②SVG로 인지성 극대화 ③핵심 위주 간결함) 신설 — `notice.tsx`·`feature-tip-box.tsx` 공통 적용.

## 2026-08-27

### 연말 절세 시뮬레이션 — "한도까지" 손익통산 미반영 버그 수정

- **왜**: 손실 종목(비트마인·DIREXION TSLA 2X)을 이미 선택한 상태에서 대형 이익 종목(엔비디아)의 "한도까지"가 24주로 표시됐는데, 손실만큼 손익통산 여력이 커져 더 많은 수량이 비과세 한도 안에 들어와야 한다는 사용자 재현 리포트. 원인은 "잔여 한도 = `Math.max(DEDUCTION - Math.max(baseGain,0), 0)`" 공식(`getYearEndTaxSimulation`의 `remainingDeductionKrw`·`rebuyQuantity` 둘 다)이 baseGain이 음수(순손실)일 때도 0으로 클램프해 손익통산 효과를 지워버린 것 — 실제 세법상 손실이 크면 한도가 250만원보다 커지는 게 정상이다. 게다가 `rebuyQuantity`는 baseline만으로 1회 계산되는 정적값이라 다른 종목을 체크/해제해도 갱신되지 않았다.
- **수정**(`lib/tax-utils.ts`): 내부 클램프 제거 → `Math.max(DEDUCTION - baseGain, 0)` 하나로 정리. 잔여한도→수량 변환을 `computeRebuyQuantity(gainPerShareKrw, quantity, baseGainKrw)` 순수 함수로 추출·export.
- **동적 재계산**(`tax-year-end-simulator.tsx`): 종목별 "한도까지" 행마다 "그 종목을 제외한 현재 선택 전체 + baseline"을 `baseGainKrw`로 넘겨 매 렌더 재계산 — 정적 `candidates[].rebuyQuantity`(선택 0개 기준) 사용 중단. 상단 통합 박스의 "잔여 공제 한도"도 동일 원리로 내부 클램프 제거.
- 면책 문구도 실제 동작에 맞춰 정정: "다른 선택 종목과 무관하게" → "현재 선택된 다른 종목의 손익까지 반영해".
- 신규 테스트 5건(`computeRebuyQuantity` 4건, baseline 순손실 시 잔여한도 250만원 초과 확인 1건).

### 연말 절세 시뮬레이션 — 상단 통합 결과 박스 + 잔여 한도 실시간화 + 문구 축약

- **왜**: ① 최상단 baseline 박스(실현손익·잔여한도)와 최하단 예상 세액 박스가 분리돼 있어 정보가 흩어지고 스크롤해야 둘 다 보였다. ② "잔여 공제 한도"가 체크박스를 선택해도 바뀌지 않아 "지금 이대로 팔면 한도가 얼마 남는지"를 알 수 없었다 — 실현손익(이미 확정된 매도 합계)은 고정이 맞지만 잔여 한도는 선택을 반영해야 의미가 있다는 지적. ③ 하단 면책 문구가 여전히 길고, "종목만 단독으로 팔 때 기준"이라는 표현이 부정확했다(baseline은 항상 반영되므로 "단독"이 아니라 "다른 선택 종목과 무관"이 맞는 표현).
- **박스 통합 + 상단 고정**: 두 박스를 하나로 합쳐 최상단으로 옮기고 `sticky top-28`로 고정(부모 `TaxCalendarView`의 헤더+탭 sticky 높이만큼 오프셋) — 스크롤 위치와 무관하게 항상 보임. 예상 양도소득세 큰 숫자 + 실현손익(고정)·잔여 공제 한도(동적)·합산 손익(강조) 3개 보조 수치를 한 줄로.
- **잔여 공제 한도 실시간화**: `simulateSelectedForeignSale`을 선택이 비어 있어도(빈 배열) 항상 호출하도록 바꾸고, `FOREIGN_CAPITAL_GAIN_DEDUCTION - max(result.combinedGainKrw, 0)`로 매 선택마다 재계산.
- **면책 문구 재축약**: 두 문장(문구 정정+절세팁 설명)을 한 문장으로 합치고 "단독으로 팔 때"를 "다른 선택 종목과 무관하게"로 정정.

### 연말 절세 시뮬레이션 — 문구 정리·오류 문구 정정·색상 규칙 준수

- **왜**: 실사용 확인 결과 ① 종목 카드마다 "한도까지" 설명 문장이 반복돼 장황했고, ② 하단 면책 문구 "여러 종목을 선택하면 한도는 종목별로 독립 계산됩니다"가 실제 계산(해외주식은 항상 당해 손익을 합산해 하나의 250만원 공제로 계산)과 반대로 틀린 내용이었으며, ③ 결과 박스의 절감/증가 배지 색이 design-system.md의 "이익=빨강·손실=파랑" 규칙과 반대로 하드코딩돼 있었다.
- **문구 축약**: 종목별 반복 설명 문장을 제거하고 "한도까지" 칩에 "· 비과세"만 짧게 표기, 전체 설명은 후보 리스트 하단에 한 번만 노출.
- **면책 문구 정정**: `simulateSelectedForeignSale`은 실제로 항상 당해 손익을 전부 합산해 계산한다는 사실에 맞춰 문구 교체 — 종목별로 독립 계산되는 것은 `rebuyQuantity`(그 종목 단독 매도 기준 참고치)뿐임을 명시.
- **색상 규칙 준수**: 절감/증가 배지의 하드코딩된 blue/rose 클래스를 제거하고 `getProfitLossColor(result.savingsKrw)` 재사용 — 절감(호재)=빨강, 증가(악재)=파랑으로 design-system.md §1.2 규칙과 일치시킴. 예상 세액 숫자의 주황(`ASSET_THEME.important`)은 "순자산 전용이 아니라 화면 전체 범용 강조색" 규칙에 부합해 유지.
- **같은 날 후속**: "미선택 대비 절감/증가" 배지가 바로 위 "예상 양도소득세" 숫자와 정보가 중복된다는 피드백으로 배지 자체를 제거, 대신 "합산 손익" 금액을 `text-foreground font-semibold`로 강조.

### 연말 절세 시뮬레이션 — 증권사별 계산 버그 수정 + 재사용 규칙 문서화

- **왜**: 동일 종목을 여러 증권사에 나눠 보유하면 `getYearEndTaxSimulation`/`simulateSelectedForeignSale`이 증권사별 `Stock` 로우를 그대로 순회해 종목마다 별개 세액을 계산했다 — 양도소득세는 증권사가 아니라 종목 단위로 손익을 합산해 판정하므로 실제 세법과 맞지 않는 계산이었다.
- **수정**(`lib/tax-utils.ts`): 신규 `groupForeignStocksByTicker`(내부 헬퍼)가 `asset-detail-tabs.tsx`의 `groupStocksByTicker`+`mergeStockGroup`(상세 > 주식 탭 "전체" 카테고리가 이미 쓰는 표준 병합 — 수량 합산, 평단·매입환율 수량 가중평균)과 동형 로직으로 해외주식을 티커 기준 종합한다. `lib`가 컴포넌트 파일을 역참조하면 계층 위반이라 import 대신 동일 로직을 이 파일 안에 복제. `getYearEndTaxSimulation`(후보 목록)·`simulateSelectedForeignSale`(선택 시뮬레이션) 둘 다 이 종합 목록을 사용하도록 교체.
- **재사용 규칙 문서화**: `dev-rules.md`에 "주식 계산·집계는 항상 종목(티커) 기준 종합이 기본" 규칙 신설(강제) — 증권사별 세분화는 명시적 요청이 있을 때만. 신규 테스트 2건(증권사 2곳 보유 시 후보 1건으로 종합, 티커 종합 id로 선택 시뮬레이션).

- **왜**: 상세 > 주식 리스트의 종목별 "전일 대비 %"가 순수 종가-vs-종가 비교라, 국내 장중(16:00 컷오프 전)엔 어제 종가끼리 비교해 하루 종일 갱신되지 않았다(`Stock.currentPrice`는 이미 1시간 단위로 실시간 갱신 중인데 활용을 안 하고 있었음).
- `computeDailyStockProfit(..., { useLivePrice: true })`(신규 옵션, 기본 false로 기존 호출처 전원 무변경) — 분자를 종가(`refPrice`)에서 실시간 `currentPrice`로 교체. baseline은 `refDate===오늘`이면 `prevPrice`, 아니면 `refPrice`를 써서 시간대와 무관하게 항상 "가장 최근 확정 종가(어제)"로 수렴 — 장 마감 후엔 기존 값과 완전히 같아 회귀 없음, 장중엔 실시간으로 갱신됨. `stock-tab.tsx`의 두 호출부(집계 헤더·종목별 개별)만 옵션 켬 — `profit-chart.tsx`·`performance-hub.tsx`는 무변경.

### 인증카드 도넛 차트 시도 후 전면 롤백 + 세금 관리 UX·버그 수정

- **왜**: 인증카드를 "비중 바 + 종목 리스트"에서 도넛 차트로 개편해봤으나(사각형 → 원형 두 차례 시도, 아래 상세) 실사용 확인 결과 완성도가 기준에 못 미쳐 **전면 롤백**하고 원래 구성으로 되돌리기로 결정. 별도로 연말 절세 시뮬레이션(S-4.31)을 실사용해보니 ① 최상단 "일정관리/시뮬레이션" 탭이 이번 달로 자동 스크롤되며 화면 밖으로 밀려나 찾기 어렵고, ② 250만원이 `$2,500,000`로 잘못 표시되며, ③ 예상 세액 결과가 눈에 안 띄고, ④ 수량 조정이 `±1`뿐이라 불편했다.
- **인증카드 롤백**: `share-card.tsx`를 원본으로 복원, 시도했던 `SquareDonutChart`(사각형)·`PortfolioDonutChart`(원형, recharts)와 관련 파일 전부 삭제. `stock-tab.tsx`의 `StockIcon`도 원래 인라인 로직으로 되돌림(도넛 라벨용으로 추출했던 `resolveStockLogoSrc` 제거).
- **통화 표기 버그 수정**: `src/lib/utils.ts`와 `src/lib/number-utils.ts`에 이름이 같은 `formatCurrency`가 각각 존재(전자는 기본 `USD`/`en-US`, 후자가 앱 전역 KRW 포맷). `tax-calendar-view.tsx`·`tax-year-end-simulator.tsx`가 잘못된 쪽(`@/lib/utils`)을 import해 원화 금액이 `$` 기호로 표시됐다(계산 자체는 정확한 KRW 값이었고 표시 포맷만 문제) — `tax-calendar-view.tsx`의 이 버그는 S-4.23부터 있던 기존 결함. 둘 다 `@/lib/number-utils`로 교체.
- **세금 관리 탭 접근성**: `TaxCalendarView` 헤더+`InlineSelector`(일정관리/시뮬레이션) 영역을 `sticky top-0`로 고정 — 이번 달 자동 스크롤이 일어나도 탭 전환이 항상 화면에 보이도록. 현재 월 섹션의 `scroll-mt`도 sticky 헤더 높이에 맞춰 재조정.
- **예상 세액 결과 박스 강조**: `tax-year-end-simulator.tsx`의 결과 박스를 더 큰 글씨(`text-3xl`)·아이콘·테두리로 강조하고 절감/증가 배지를 색상으로 구분해 인지성을 높임.
- **수량 조정 ±5/±10 버튼 추가**: 기존 `±1` 스테퍼 옆에 `-10/-5/+5/+10` 프리셋 버튼 추가(보유 수량이 각 임계값을 넘는 종목에만 노출) — 큰 수량 조정 시 클릭 수 감소.

<details>
<summary>인증카드 도넛 시도 상세 (롤백됨, 참고용)</summary>

- **1차(사각형)**: `SquareDonutChart` — `<rect pathLength=100>` 세그먼트로 사각 링을 그리고 링 바깥에 리더라인 + 로고(원본 비율) + 종목명 + 비중%만 노출(개별 금액 제거), 중앙엔 이모지🔒+닉네임. `StockIcon`에서 `resolveStockLogoSrc` 순수 함수를 추출해 공유.
- **2차(원형 재작업)**: 실사용 확인 결과 ① 단일 종목이 70~80%대로 크면(테슬라 76.7% 사례) 커스텀 dasharray 계산이 무너지고, ② "사각형" 자체를 철회(원형이 맞다고 판단), ③ 중앙 이모지가 완성도를 깎고, ④ "검은 바탕+무지개 컬러의 고급스러움" 기준에 못 미쳐 — `PortfolioDonutChart`(recharts `PieChart`/`Pie`/`Cell`, `dashboard.tsx`의 `AssetDonutChart`와 동일 패턴)로 교체, 중앙 완전히 비움, `ShareCard` 루트에 `dark` 클래스 강제.
- **최종 롤백**: 2차도 실사용 확인 후 완성도 기준 미달로 전면 철회 — 위 "인증카드 롤백" 참고.

</details>

### 연말 절세 시뮬레이션 전면 개편 — 메뉴 분리 + 체크박스·버튼 입력 (issue-4.31 후속)

- **왜**: 직전(08-26) 1차 구현을 사용자가 확인한 결과 세 가지 문제가 드러났다. ① 세금 캘린더의 "연말 절세 인사이트" 섹션이 `computeForeignRealizedGain`이 `null`(=당해 매도 거래 0건)이면 통째로 렌더되지 않아 대부분의 사용자에게 사실상 항상 숨어 있었다(근본 원인 버그). ② 개별 주식 카드 버튼과 캘린더 섹션 두 곳에 기능이 흩어져 하나의 도구로 인지되지 않았다. ③ 손실 종목 손익통산 비교와 이익 종목 재매수 절세 팁이 없었다.
- **메뉴 개편**: 더보기 > 지원 "세금 일정" → **"세금 관리"**로 명칭 변경. 페이지(`#tax`) 최상단에 `InlineSelector`(기존 "모든 탭 UI의 공용 컴포넌트")로 "세금 일정관리"/"절세 시뮬레이션" 두 화면 전환(라우팅은 `#tax` 그대로, 페이지 내부 상태 전환).
- **null 게이팅 제거**: `getYearEndTaxSimulation`(신규, `simulateForeignStockSale`/`getYearEndTaxInsight` 대체)은 당해 거래가 없어도 `baselineGainKrw=0`으로 항상 후보 목록을 반환 — 보유 해외주식이 1건도 없을 때만 빈 상태.
- **체크박스+버튼 전용 입력**: 텍스트 입력 폼 제거. 종목 `Checkbox` 선택 → "전량"/"한도까지"(이익 종목의 잔여 공제 한도 소진 수량) 프리셋 칩 + `±1` 스테퍼로만 수량 조정.
- **손익통산 비교 + 재매수 팁 추가**: `simulateSelectedForeignSale`(신규)로 체크된 여러 종목을 합산해 미선택 대비 절감액을 즉시 계산. 이익 종목은 `rebuyQuantity`(잔여 공제 한도 내 비과세 매도 가능 수량)를 계산해 "매도 후 재매수" 절세 팁 노출.
- 신규 컴포넌트 `TaxYearEndSimulator`가 1차의 `TaxSellSimulatorSheet`(개별 종목 `Sheet`)를 완전히 대체·삭제. 주식 상세 화면의 "예상 세금" 버튼도 제거해 진입 경로를 탭 하나로 통일. 스키마·저장 키·API 변경 없음(순수 계산 + 읽기 전용 UI 재구성).

## 2026-08-26

### 해외주식 매도 세금 시뮬레이션 (issue-4.31)

- **왜**: 기존 세금 캘린더(S-4.23)는 "언제 신고할지"만 안내하고 세액 계산은 의도적으로 제외했는데, 사용자가 실제 매도를 고민하는 순간 가장 궁금한 "지금 팔면 세금이 얼마인가"에는 답하지 못했다. 참고용 추정치임을 명확히 하는 조건으로 이 결정을 재검토해 실질적인 절세 의사결정 도구를 추가했다.
- **해외주식 단일 종목 시뮬레이션**: `simulateForeignStockSale`(신규, `lib/tax-utils.ts`) — "지금 팔면"은 미래 시점 가정이라 거래로그 replay 없이 `Stock.averagePrice`(현재 평단)를 원가로 바로 사용. 당해 기존 실현손익(`computeForeignRealizedGain` 재사용)과 합산 후 250만원 공제 적용해 22% 세액 산출. 매입·매도 환율 정보가 없으면 현재 환율로 폴백하고 "추정치" 배지 표시.
- **연말 절세 인사이트**: `getYearEndTaxInsight`(신규) — 세금 캘린더 뷰(`#tax`)에 당해 250만원 공제 잔여 한도와 미실현 손실 보유 해외주식 목록 섹션 추가(정보 나열, 통산 재계산 없음).
- **범위 축소**: 최초 명세는 국내 비상장주식·손익통산 시나리오 비교("같이 매도" 다중 선택)까지 포함했으나, 구현 착수 전 사용자 판단으로 해외주식 단일 계산 중심으로 축소(명세 [S-4.31](../specs/4.31-tax-sell-simulation.md) 갱신 반영).
- 신규 컴포넌트 `TaxSellSimulatorSheet`(라우팅 없는 로컬 `Sheet`) — 세금 캘린더 뷰와 주식 상세 화면(해외주식만) 양쪽에서 진입. 신규 스키마·저장 키·API 없음(순수 계산 + 읽기 전용 UI).

## 2026-08-22

### 시세 정확도·자산 업데이트 UX·코드 구조 정리 (issue-4.23 연장)

- **왜**: 사용자가 해외주식 현재가 stale 이슈를 보고 → 근본 원인 2건을 순차 발견해 수정. 함께 자산 업데이트 진입 흐름·소스 구조도 재정비.
- **해외 개장 전 flat 라벨 stale 버그(R24)**: `getStockCacheSlot("foreign")`이 마감 컷오프(07:00 KST)~개장(17:00/18:00 KST) 구간에 "오늘" 라벨로 어제 종가를 캐싱했고, 이 라벨이 이후 휴장일 롤백 결과와 우연히 같아지면(금요일 오전 캐싱=금요일, 토요일 롤백도 금요일) 재조회가 스킵돼 하루 이상 stale 노출. `beforeTodaysOpen` 분기 추가로 수정(TSLA 실사용 사례).
- **앱잠금 해제 후 동기화 미재개 버그(R25)**: 위 수정을 검증하다 발견 — 잠금 상태로 페이지가 로드되면 `initAndSync`가 그 즉시 return하고, PIN을 풀어도 `PWA_UNLOCKED_EVENT`가 cloud-sync pull만 재트리거해 시세·환율·스냅샷이 그 세션 내내 갱신되지 않았다. `asset-data-context.tsx`에 리스너 추가로 해제 시 전체 재동기화하도록 수정.
- **국내주식 실시간가 전환**: `search-stock-info`(당일 종가, `thdt_clpr`) → `inquire-price`(실시간, `stck_prpr`)로 교체. 종목명·시장구분은 `kr-master.ts`(로컬 정적 마스터)로 API 호출 없이 대체, KOSPI200 등 분류는 90일 캐시 분리로 매시간 재조회 방지.
- **암호화폐 Redis 캐시 통합**: `finance:coin:{market}-{slot}`+`finance:coin:last:{market}` 2키 → `finance:coin:{market}` 1키(slot+updatedAtMs 포함 레코드)로 합쳐 `setCoin`의 SET 호출을 2회→1회로 축소.
- **FAB "자산 업데이트" hub 재설계**: `select-type`+`select-action`을 hub(보유현황/거래기록 2타일) → 카테고리 컴팩트 리스트로 재구성했다가, 이후 요구사항 재검토로 **다건 체크박스·시퀀스·완료 원인분해 요약 화면을 전부 제거**하고 항상 단건 처리로 되돌림(`attribution-summary.tsx` 삭제). 매수/매도 스크린샷에서 미보유 매수 심볼은 신규 종목/코인으로 자동 등록하도록 강화(매도는 계속 차단).
- **부동산 토지 실거래가**: `inquire-price` 실시간 전환과 별개로 토지는 지목별 형평 비교·지분 문제로 실거래가 조회 기능 자체를 제외 유지(수동 입력만).
- **src/lib 도메인 재구성**: 35개 평면 파일을 `finance/`·`asset/`·`trade/`·`realestate/` 4개 도메인 폴더로 이동(`src/app/api` 폴더 명명 관례 참고), 미사용 `layout-utils.ts` 삭제. ~60개 파일의 import 경로 일괄 갱신.
- toast 기본 노출 시간 3.5초 → 2초 단축.

## 2026-08-12

### Round 2 M1~M3: 온보딩 마법사 (issue-4.29)

- **왜**: 리텐션(재방문 습관화)과 신규 유저 온보딩이 이번 라운드 목표. 업로드된 원 스펙(PRICE-ALERT·GOAL-TRACKING·ONBOARDING-WIZARD)을 코드베이스와 대조 검토한 결과 Web Push 인프라·서버 판정 파이프라인·부동산 스크린샷 인식이 전부 없어 원 스펙 그대로는 구현 불가 — Push·서버 관여를 전면 배제하고 완전 로컬 기능으로 재설계해 명세(S-4.27~4.29)로 확정 후 구현. (S-4.26 자산 신선도·S-4.27 평가금액 알림·S-4.28 목표 설정은 함께 구현했으나 전부 적용 철회 — 아래 8/12 후속 항목 참고)
- **S-4.29 온보딩 마법사**: 주식→코인→현금→대출 4단계 스크린샷 업로드 마법사. 부동산은 인식 엔진이 없어 즉시 수동 입력 연결. 완료 화면은 실제 `<Dashboard/>` 렌더. 기존 스크린샷 인식 다이얼로그 4종에 `onSaved` 콜백만 추가해 재사용(신규 인식 로직 없음). [onboarding-wizard-flow.tsx](../../src/app/(main)/_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx).
- **QA에서 발견해 함께 수정**: S-4.29 최초 구현이 AC10(전체 건너뛰기 시 실제 WelcomeGuide 복귀)을 충족하지 못해 spec-check 후 수정.
- 신규 로컬 저장 키 1개(`secretasset_onboarding_wizard_status`) `asset-storage.ts` keepKeys에 등록.

### 자산 신선도·평가금액 알림·목표 설정 전체 철회 + 온보딩 마법사 노출 방식 조정 (issue-4.22 후속)

- **왜**: S-4.26 자산 신선도, S-4.27 평가금액 % 변동 알림에 이어 **S-4.28 목표 설정(순자산 목표·카테고리 배분·부채비율) 기능도 전체 롤백**하기로 결정 — 순자산 목표 진행률 바 UI를 여러 차례 다듬는 과정에서 기능 자체를 걷어내는 쪽으로 결론. `goal-utils.ts`·`goal-settings-view.tsx` 삭제, `assetDataSchema`의 `goals` 필드 제거(zod가 알 수 없는 키를 무시하므로 기존 저장 데이터도 안전하게 로드됨), 더보기 메뉴의 "목표 설정" 진입점·`#goal` 라우팅·대출 탭 부채비율 표시·온보딩 마법사 완료 화면의 목표 연결 카드까지 전부 제거. S-4.27도 "Push 알림이 없는 앱 구조상 효용성이 낮고 자산관리앱 성격에 안 맞는다"는 판단으로 전체 롤백(저장 실패 버그 수정이 아니라 기능 자체 제거). 또한 S-4.29 온보딩 마법사가 데스크톱/PWA 최초 진입 시 웰컴가이드보다 먼저 자동으로 떠 있던 것을 "웰컴가이드가 항상 먼저 보여야 한다"는 요구에 맞춰 자동 노출 로직 제거 — 마법사는 이제 웰컴가이드 CTA를 명시적으로 눌렀을 때만 열린다([page.tsx](../../src/app/(main)/page.tsx)).
- 더보기 > 지원 메뉴의 "스크린샷으로 자산 등록" 버튼 제거 — 웰컴가이드·마법사 CTA로 진입 경로가 이미 있어 중복.
- 웰컴가이드 하단 CTA 5개(스크린샷 일괄 등록/부동산 추가/주식 추가 팝오버[스크린샷·직접입력]/기존 데이터 가져오기/동기화 연결)를 2개로 통합: "스크린샷으로 자산 등록"(마법사, 부동산 수동 입력 링크 내장) + "직접 입력·가져오기" 팝오버(주식 직접 입력/기존 데이터 가져오기/동기화 연결). 주식 팝오버의 "스크린샷 가져오기" 옵션은 마법사와 완전히 중복이라 제거. [welcome-guide.tsx](../../src/app/(main)/_components/layout/onboarding/welcome-guide.tsx).
- 순자산 목표 진행률 바를 다듬는 과정에서 만든 **"세그먼트 레벨미터"**(진행률을 칸으로 나눠 `SHARE_SAFE_PALETTE` 색을 순환시키며 채우는 시각화) 디자인은 기능 롤백과 별개로 마음에 들어 재사용 컴포넌트로 보존 — [level-meter.tsx](../../src/components/ui/level-meter.tsx) `LevelMeter`. 현재 적용처는 없고, 진행률·달성도 시각화가 필요할 때 우선 검토 대상.

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
- **백업 정합 가드**([asset-storage.ts](../../src/lib/asset/asset-storage.ts) `isExportDataStale` 신설): 조사 중 받은 첫 백업이 **25분 전(08-04) 상태**였다 — 백업은 localStorage(`getAssetData`)를 뜨는데 화면은 React state를 렌더하고, 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준) 둘이 잠시 갈라진다. 같은 파일 안에서 **스냅샷은 최신인데 `assetData`만 과거**인 게 결정적 증거(스냅샷은 `saveSnapshots(latestData)`가 state를 받아 계산). 재백업에서 정상 복구돼 영구 유실은 없었으나, 그 파일로 복원했다면 유실이었다. → `exportAssetData(currentData?)`가 항목 **건수**(자산 5종+거래 4종, 파생필드 제외로 오탐 방지) 불일치 시 다운로드를 중단하고 `EXPORT_STALE_MSG` 안내. **근본 원인(어느 경로가 localStorage를 되돌리는지)은 미추적** — 경합 버그라 계측 없이 패치하면 두더지잡기가 된다(R30에 재발 시 계측 절차 기록).
- **일별 달력 금액 넘침**([net-asset-chart.tsx](../../src/app/(main)/_components/views/activity/net-asset-chart.tsx)): 모바일 셀 텍스트 가용폭이 **42.6px**(`(390−24−gap12)/7 − p-1 8`)인데 `text-sm`에서 `+3,433`이 약 42.4px라 옆 칸을 침범했다(1,000만~9,999만원 대역, 순자산도 100억 넘으면 동일). 표기 체계를 바꾸는 대안(억 소수 전환=해상도 손실, 콤마 제거=앱 전체와 불일치)보다 대가가 작아 **`text-xs sm:text-sm`** + `tabular-nums`(규약상 원래 필수였는데 누락) + 셀 `overflow-hidden`으로 처리. `whitespace-nowrap`은 넣지 않음(단위가 둘째 줄로 wrap되는 2줄 레이아웃이라 한 줄로 묶으면 오히려 확실히 넘친다). design-system §타이포 `text-xs` 예외 목록에 등록.
- **하이브리드 구간 경계 이중계상 수정(위 수정 직후 QA에서 발견)**: `computePeriodAttribution`이 `[prevOld,mid]`+`(mid,curr]`로 쪼갠 뒤 `mergeAttributions`가 key별로 합산하는데, `reflectedCashInflow`가 **양쪽 구간 모두 시작일 당일을 포함**해 `mid` 당일 거래가 두 번 잡혔다 — **`income`이 2배가 되고 반대급부로 사용자가 한 적 없는 "현금 잔액 감소(추정)"가 같은 금액으로 표시**(주식 버그와 정확히 같은 형태). 현금 입출금 기본 날짜가 "오늘"이고 `mid`는 앱을 연 날의 daily 스냅샷이라 일상적으로 겹친다. 합계 = `deltaNet`은 유지돼(income +2배, cash −1배 상쇄) 기존 테스트 전부 통과한 채 살아 있었다. → 4종 flow 함수의 경계 판정을 **`inFlowWindow` 단일 헬퍼**로 통일하고, `resolveAttribution`에 `isFirstSegment`(기본 `true`)를 추가해 **현금·대출의 "시작일 당일 포함"을 전체 기간 첫 구간에만** 적용. 두 구간의 합집합 = `[prevOld, curr]`, 교집합 = 공집합. `detectCashRoundTrip`의 `incomeToDate`도 같은 경계를 쓰도록 맞춤(`netCashEffect`와 기준 일치, 안 맞추면 `cashRoundTrip` 오탐 회귀). R29를 이 3중 조건으로 확장.
- 신규 회귀 테스트 6건(경계일 이중계상·소급 반영 1회 계상·코인 동형 + mid 당일 현금/주식 중복 방지·전체 시작일 당일 income 보존), 전체 **147건** 통과. 두 수정 모두 되돌려 해당 테스트가 실제로 실패하는 것까지 확인. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build`(22개 라우트) 전부 통과.

## 2026-08-04 (4)

### 기기 동기화 데이터 손실 원천 차단 + 순자산 왜 현금/대출 완전 분리 (issue-4.21)

- **왜(동기화)**: "A기기에서 추가한 현금 자산이 B기기 접속 후 사라진다"는 재발 제보. 클라이언트의 pull-first 순서(마운트·연결·잠금해제)는 이미 있었으나, 심층 점검에서 **더 넓은 두 구멍**을 확인했다. ① 서버 `/api/sync` PUT의 버전 체크가 `getAssetEnvelope`→비교→`setAssetEnvelope`의 read-then-write라, 두 기기가 거의 동시에 push하면 둘 다 체크를 통과해(TOCTOU) 나중 쓰기가 먼저 쓰기를 조용히 지웠다(lost update — 어느 쪽도 409를 못 받음). ② 409 충돌 복구가 pull로 로컬을 통째로 교체할 뿐 **push하려던 로컬 편집을 재병합·재전송하지 않아**, 정상적인 멀티기기 사용에서 "막 추가한 자산"이 구조적으로 반복 소실됐다(같은 원인이 멀티탭·마운트 pull 창에서도 발생).
- **원자적 CAS**([cache-storage.ts](../../src/lib/cache-storage.ts) `compareAndSetAssetEnvelope` 신설, [route.ts](../../src/app/api/sync/route.ts)): 버전 비교+저장을 단일 원자 연산으로. Upstash는 Lua 스크립트(`redis.eval`)로 GET→비교→SET을 Redis 내부에서 처리(Lua는 항상 원자적), 로컬 `FileCacheStorage`는 중간 `await` 없는 동기 fs 호출로 같은 보장. pubKey 교체 불가(403)만 원자성 밖 사전 체크로 유지.
- **기준점(syncedIds) 병합**([asset-storage.ts](../../src/lib/asset/asset-storage.ts) `reconcileAdditiveMerge`·`collectAssetIds`, [sync-state.ts](../../src/lib/cloud-sync/sync-state.ts) `syncedIds`): pull이 덮어쓰기 직전 로컬을 읽어 **원격에 없는 로컬 항목 중 "아직 서버에 올라간 적 없는 것"만 되살린다**. 되살린 게 있으면 `runPull`이 `lastPushedRef=null`로 파생값 비교를 건너뛰고 즉시 재-push해 서버에도 반영. 같은 id를 양쪽이 다르게 수정한 진짜 충돌은 원격 우선으로 남김(과설계 회피).
  - **기준점이 없으면 삭제가 부활한다(작업 중 발견·수정한 P0)**: 삭제가 tombstone 없이 배열 제거라 "로컬에 있고 원격에 없다"가 *신규 추가*와 *원격 삭제* 두 의미를 갖는다. 최초 구현은 이를 무조건 신규로 해석해, A가 지운 자산을 B가 pull하며 되살리고 그 결과를 재-push → A에서도 부활 → "지웠는데 1분 뒤 다시 나타남"이 무한 반복되어 다기기 삭제가 무력화됐다. **CAS로는 못 막는다** — CAS는 쓰기 순서만 통제하고, B는 최신을 정상 수신한 뒤 baseVersion도 최신이라 CAS 관점에선 완벽히 정당한 요청이었다. `syncedIds`(마지막으로 서버와 맞춰진 항목 키)를 기준점으로 두어 *기준점에 없음=신규 보존 / 있음=원격 삭제 존중*으로 판별.
  - 기준점 갱신 시점이 함정 — pull은 **병합 전 원격 키**로 갱신해야 한다(병합으로 살려둔 신규분까지 넣으면 그게 올라가기 전에 다음 pull이 "삭제됨"으로 오판해 스스로 지운다). push는 push한 키로 갱신. `forgetRemembered`도 `syncedIds` 보존.
  - `connect`(다른 금고 채택)는 `pullAsset(..., { merge: false })`로 원격 완전 대체 — 로컬 잔여 자산을 남의 금고에 섞지 않는다(F-CLOUD-SYNC S2 "자산 동일"). `unlock`(같은 금고)은 병합.
- **온라인 복귀 pull-first**([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx)): armed 폴링 effect에 `window "online"` 리스너 추가(force pull). 없으면 오프라인 중 쌓인 디바운스 push가 다음 폴링(최대 60초)보다 먼저 나가 충돌 경로로 들어갔다.
- **왜(현금/대출)**: 자산성적표 "순자산 왜?"에서 신규 현금 자산이 "대출" 섹션에 표시되고 금액도 다르게 읽힌다는 제보. `groupAttributionItems`의 "이 기간에 `debt`가 하나라도 있으면 `cash`를 대출 그룹으로 강제 편입"(2026-08 설계)이 금액·연관성과 무관하게 트리거된 게 원인 — 8600만원 신규 현금과 전혀 무관한 소액 대출 변동이 같은 주에 겹쳤다는 이유만으로 끌려갔다. **병합 규칙을 완전히 제거해 현금·대출을 항상 각자 그룹으로 분리.** `dCostCash`는 원래도 `loans`를 참조하지 않아 금액은 정확했음을 회귀 테스트로 확정(금액 차이는 두 줄이 한 박스에 나란히 표시되며 생긴 시각적 오독).
- 신규 테스트 16건(CAS 4·기준점 병합 11·현금대출 분리 회귀 1 + 기존 2건 갱신), 전체 141건 통과. R28 회귀 항목 신설(원자성·기준점·갱신 시점·online 리스너 5개 조건). `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build` 전부 통과.

