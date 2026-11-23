# 지수 3기능 끄기 — 명세 초안 (2026-11-23, 버전 미배정)

근거: KIS 약관 대표 결정(`2026-11-22-kis-terms.md`), CEO round3(홍보일 확정 전 초안만). 코드 기준 main 3d90cf8, 읽기만 했다. 홍보일 확정 전 착수 금지.

## 1. 끄는 방식 권고 — 플래그 1곳 + 서버 방어 (제거 아님)
- 신규 `src/config/market-index.ts`: `export const MARKET_INDEX_ENABLED = false`. 클라이언트·서버 공용 상수 1개. 되살리기 = `true` 1줄 + 배포. 코드·테스트·카탈로그·GA 키는 삭제하지 않는다(KIS 정식 계약 후 복구 전제).
- 이유: 제거는 화면 5곳·훅·라우트·push 모듈·테스트 15여 개를 건드려 복구 비용이 크다. 플래그는 진입점 4곳 + 서버 2곳만 막는다.
- 서버 방어는 필수. 구 번들이 남은 PWA·탭이 계속 호출하므로 클라이언트 숨김만으로는 KIS 호출 0이 보장되지 않는다.

## 2. 기능별 끄는 지점
**A. 시장과 비교** (화면 `change-market`, 입구 4곳)
- 핵심 1곳: `src/app/(main)/_components/views/activity/market-entry-line.tsx:45` `useMarketEntryValue` — 플래그 off면 `open:false, markets:[]`를 즉시 반환하고 `useKospiPeerCodes`·`useMarketIndexRefs` enabled를 false로 둔다. 이것으로 아래 입구가 자동으로 사라진다: 허브 행(`hub-change-rows.tsx:24` showMarket), 주식 도구 타일(`detail/stock-tools.tsx:80`), 자산 변화 `MarketTile`(`market-entry-line.tsx:122`), 홈 지수 줄(B).
- 플래그 직접 확인 필요: 자산 변화 주식 범위 `MarketTile` 자리(`asset-change-view.tsx:93`)와 주 단위 링크 `week-market-link`(`asset-change-view.tsx:160~175`, `hasStock` 조건에 플래그 추가).
- 화면 자체: `layout/navigation/asset-page-tabs.tsx:72`에서 플래그 off면 `change-market` 탭을 렌더하지 않고 `change`로 대체(북마크·히스토리 복원 방어). `navigation-context.tsx:34` ACTIVITY_TABS 파싱은 두고 렌더 쪽에서만 막는다.
- 안내 노출: `config/app-features.ts:116` `market-compare` 항목(메뉴·홈 팁), `config/whats-new.ts:105·151`(`featureId:"market-compare"`), `config/new-spots.ts:7·10`(NEW 칩) — 플래그 off면 필터로 제외. `feature-usage.ts:88` 추천 후보도 제외.
- 호출 경로: `hooks/use-market-compare.ts:52` `fetchMarketIndex` → `/api/finance/market-index`(`app/api/finance/market-index/route.ts:32` GET).

**B. 홈 지수 줄**
- `views/home/dashboard.tsx:792~793`(`useMarketEntryValue("daily")`→`marketLineState`)가 A의 훅 하나로 `"off"`가 된다. 표시부 `dashboard.tsx:276·467`·`CauseMarketSegment`는 `marketLine !== "off"` 조건이라 추가 수정 불필요. 홈 팁 `home-tip-box.tsx:91`의 suppress도 자동 해제되나 market-compare를 팁 후보에서 제외해야 한다(A).
- GA `home_market`(`dashboard.tsx:864`): 입구가 없어 발생 0, 키는 유지.

**C. 시장 알림(푸시 morning·kr)**
- 시세 조회 차단: `lib/push/cron-run.ts:123~124` — 플래그 off면 `needUs·needFx·needKr=false`로 `loadPushQuotes` 미호출(`:45` 진입부 가드도 추가). 그러면 `:56~` KIS 토큰·예산 호출도 0. `hasContent`가 거짓이라 morning·kr은 `markPushSent`도 안 잡히고 발송 0. settle·tax는 그대로 발송.
- preview 테스트 경로: `lib/push/test-payloads.ts:21` 도 같은 가드(off면 morning·kr 시세 생략 또는 미지원 응답). `app/api/push/test/route.ts`.
- 설정 UI: `header-menu/notify-section.tsx`(카탈로그 `lib/push/catalog.ts:13~14` morning·kr 행, `:78` 큰 움직임 조건 라디오)에서 off면 두 행·조건 라디오를 **표시만 숨기고** `PUSH_CATALOG`·`normalizePushTopics`는 그대로 둔다(아래 4번).
- Cron(`vercel.json` 2개)은 유지. settle·tax 때문에 끄면 안 된다. 대시보드 Cron Disable은 쓰지 않는다.

## 3. 서버 방어(구 번들 대응)
- `market-index/route.ts:32` GET 맨 앞(guard보다 먼저): 플래그 off면 `NextResponse.json({KOSPI:null,SPX:null},{headers:{"X-KIS-Unavailable":"1","Cache-Control":"s-maxage=3600"}})` 반환. KIS 토큰·예산·`finance-service.ts:913·926` 호출 0. 클라이언트 `fetchMarketIndex`는 이 헤더를 이미 null 처리한다.
- 주의: `/api/finance`(종목 시세)·`price-history`·`profit`·`dividend`는 KIS를 계속 쓴다. 이번 범위는 **지수 호출 0**이지 KIS 호출 0이 아니다(CEO 확인 문구에 명시할 것).

## 4. 사용자에게 보이는 변화 · 데이터 영향
- 빈 자리 처리: 홈 지수 줄·허브 행·주식 도구 타일·자산 변화 타일은 조건부 렌더라 자리 자체가 접힌다(`MarketTile`은 null). 대체 문구 없음 — 사라지는 것이 정본(별도 안내문은 홍보 전 불필요).
- 알림 구독자: 서버에는 topic ID(morning·kr)만 저장돼 있다(`catalog.ts:2`). **저장 키·서버 구독 데이터 변경 0**으로 가능 — 구독 유지, 시장 알림만 발송 0. 따라서 `PUSH_CATALOG`를 줄이지 말 것(줄이면 `normalizePushTopics`가 local `secretasset.push_prefs`와 서버 topics를 다음 저장 때 재작성해 롤백 시 선택 손실 → risk 상향). 표시 숨김만 한다.
- 남는 엣지: 시장 알림만 켠 사용자는 `on=true`지만 오지 않는다. 설정 알림 섹션에 "시장 알림은 잠시 쉬어요" 1줄을 그 사용자에게만 표시하는 안(문구는 ui-designer 확인)을 권고. 대안은 미표시 — CEO 결정 사항.
- 저장 스키마·동기화·스냅샷·거래·공유·백업·성적표: 변경 0. react-query 메모리 캐시만 쓰던 기능이라 저장값이 없다. 구버전 혼재·롤백 시 손실 0(플래그만 되돌리면 복귀).
- 체험(데모) 모드: 지수 전용 시드 데이터 없음. 지수는 전부 API로 받았으므로 체험에서도 입구가 사라진다(체험 가이드·`trial-exit.ts:34` 맵은 라벨용이라 유지). 체험 투어 문구에 시장 비교가 있는지 구현 때 grep 확인.
- GA 키: 유지(`ga.ts:166` `activity:change-market`, `home_market`, `push_click_morning|kr`). 발생만 0이 된다.

## 5. 투자 탭 무관 확인
`views/invest/invest-view.tsx`는 `lib/invest/market-history`·`calc`·`pattern`(정적 번들 데이터)만 import하고 `/api`·KIS 호출 0(fetch 없음). 연말값 갱신은 `docs/ops/market-history-refresh.md`(수동). 플래그와 무관하게 동작. 구현 PR에서 invest 테스트 통과로 재확인.

## 6. 운영 KIS 지수 호출 0 확인
1. 사전(preview): Playwright로 홈·성과·자산 변화(전체/주식)·주식 도구·설정 알림을 열고 네트워크에 `market-index` 요청 0.
2. 단위 테스트: 플래그 off에서 route가 `getKisAccessToken` 미호출·헤더 반환, `runPushCron`이 `loadPushQuotes` 미호출(모킹 spy), `useMarketEntryValue` 요청 0.
3. 사후(운영): 머지 후 Vercel 로그에서 24시간 동안 `market-index`의 KIS 업스트림 호출 0(응답은 early-return 건), 다음 morning·kr Cron 로그에 `us.*`·`fx`·`kr.*` status 키 없음·`kis` budget 증가 없음. 구 번들 잔존 요청은 early-return이라 KIS 호출 아님.
4. 코드 grep: `fetchKospiDailySeries|fetchOverseasIndexDailySeries|fetchFxKrwDailySeries` 호출자가 플래그 뒤에만 남는지(현재 호출자: market-index route, push quotes뿐).

## 7. qa 차단 조건
- off 상태에서 `/api/finance/market-index`·push cron이 KIS 호출 1회라도 발생(테스트·로그).
- `PUSH_CATALOG`·`secretasset.push_prefs`·서버 구독 topics 변경 발견(롤백 손실).
- 입구 잔존(홈 줄·허브 행·주식 타일·자산 변화 타일·`week-market-link`·메뉴/팁/새 소식 항목) 또는 빈 껍데기·깨진 레이아웃.
- settle·tax 알림 발송 회귀, 투자 탭 회귀, 모바일 홈 레이아웃(지수 줄 사라진 뒤 높이) 점검.
- 기존 `market-*` 테스트는 플래그 on 주입으로 유지(삭제·우회 금지). 플래그 on에서 기존 동작 동일 확인.
- 마케팅·보안 문구에 "지수 제공" 잔존 여부(`security-copy`·가이드).

## 8. 예상 risk·규모
- 예상 risk:medium. 저장 스키마·키·동기화·공유·서버 구독 데이터 변경 0이라 high 요건 해당 없음. 단 PRINCIPLES상 기능 제거(사용자 가시 변화)이므로 CEO 사용자 관점 점검 필수. `PUSH_CATALOG` 변경·구독 topic 재작성이 필요해지면 risk:high로 상향.
- 규모: 소(src 약 12개 파일·순증 100줄 안팎 + 테스트 5~6개). 신규 파일 1(`config/market-index.ts`), 마이그레이션 0.
- 선행 확정 필요: ① 안내 1줄 표시 여부 ② 홍보일(착수·머지 시점) ③ 3기능을 한 PR로 묶을지(권고: 1 PR).
