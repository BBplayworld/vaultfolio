# D2 선정 (cto, 2026-11-13) — v4.97 병행 릴리스 판정 (기준 main 4314839)

## ① 후보 사실 재확인 (코드)
| 후보 | 판정 | 근거 |
|---|---|---|
| 1 배당 실패가 빈 배당으로 고착 | **사실** | route.ts:225·231-234 KIS 예산 초과·토큰 불가 = 200+`data:[]`+`X-KIS-Unavailable`, 429(guardRateLimit)·500은 `!res.ok`. 클라 3곳(dividend-chart:74·monthly-dividend-stocks:31·performance-hub:28)이 둘 다 `[]` 성공 처리 → `staleTime 30일`·`retry:false`. persist 없음(react-query-provider 기본 QueryClient) → "30일"이 아니라 **새로고침 전까지**(관찰자 모두 사라지고 5분 gc 후 재조회). 서버 Redis에는 불가 응답을 저장하지 않음(334행은 정상 조회만). 영향: 배당 탭·성과 허브 '올해 배당'·자산 리포트(useDividendAnnualTotals) 과소, 안내 없음 |
| 2 새 입력 기본 날짜 UTC | **사실, 범위 1곳 추가** | loan-input:88·crypto-input:59·physical-input:41 + **real-estate-input:166 누락분**. 거래 입력은 #46에서 `todayKst`(tax-utils, export) 통일 완료·`today-kst-inputs.test.ts` 존재. 소비처: 실물·부동산 purchaseDate → 자산 리포트 `inPeriod`(asset-report:679·683)·결산 구성 변화 `inWin`(change-hero:205), 코인 → `resyncInflowDate`(asset-report:675)·relink effectiveDate, 대출 startDate → 경과일·이자(loan-tab:268). **12/1 00~09시 KST 등록이 11월 결산·리포트로 귀속** = 실영향. 주식 배당 purchaseDate 필터는 stock 입력이 KST라 해당 없음 |
| 3 콘솔 [API Logs] | **운영 사실 아님** | route.ts:186 `withMessages`가 `IS_DEV`(NODE_ENV=development)에서만 messages 포함 → 운영 출력 0. 단독 과제 탈락, 1의 공용 fetch 통합 시 자연 삭제(추가 비용 0) |
| 4 홈 '어제' 로컬 타임존 | 사실이나 영향 극소 | dashboard.tsx:575-577 setDate 로컬. 비DST 지역은 24h 차감과 같아 정확, DST 전환일만 1h 어긋남(KST 자정 근처에서만 날짜 뒤집힘). 1줄 수정 |

## ② 범위·컷 순서 (4.97 = 1+2(+4), p3 동승)
- 핵심 A(#1): 공용 `fetchDividend` 1개(3곳 중복 제거) — `!res.ok`·`X-KIS-Unavailable`이면 throw(캐시 안 됨, 다음 진입 재조회), 헤더 없는 200 빈 배열은 정상 빈 배당. 실패 종목 수를 훅에서 노출, 배당 탭·성과 허브 배당 줄 아래 안내 1줄.
- 핵심 B(#2): 입력 4곳 기본값을 `todayKst()`로. 저장값은 사용자가 확인·수정 가능한 기본값만 바뀜(기존 저장 데이터·수정 화면 기존값 불변).
- 컷 순서(먼저 뺌): ① p3 경계 정리 ② 후보 4 ③ 자산 리포트 안내 줄(합계는 A로 자동 정확해짐) — A·B 핵심은 컷 불가.
- p3 동승 **가**: 표시 전용·데이터 0, A의 ui-review에 같이 태움. qa 실측(358/359/360·373/374/375·398/399/400) 1회 추가가 부담되면 ①로 즉시 컷.

## ③ 오류 안내 문구 (1)
`일부 종목 배당을 불러오지 못했어요. 다음에 열면 다시 불러올게요` — profit-chart `FETCH_FAILED_MESSAGE`·market-compare-view:339 패턴(`<p className="text-sm text-muted-foreground text-pretty break-keep">`) 재사용, 투자 조언·금액 없음. ui.md 불요, **ui-review(간이) 필요**(UI 문구 추가 → 브리프 조건).

## ④ 위험·위임
risk:low, **위임 가**. 저장 키·스키마·마이그레이션·동기화·공유 토큰·서버 전송 변경 0(클라 fetch 처리·폼 기본값·표시 클래스만, 서버 route 불변). 보안·데이터 문구 0. B는 데이터 안전상 "새로 만드는 기록의 기본 날짜가 KST 오늘로 바로잡힘"이며 기존 기록 무변경 → C74 소비처 표(dev-notes)와 qa main 대비 결과(11/30 23:30 UTC=12/1 08:30 KST 등록 → 12월 귀속)로 확인. 대표 반려 영역 아님(배당 장부 확장 반려와 무관한 버그 수정).

## ⑤ PR #180(issue-4.91 @e324876) 겹침
src 파일 겹침 **0**(#180: header-menu·pwa·layout·api/push·lib/push·whats-new·ga·cache-storage·finance-service·sw·next.config·vercel.json / 4.97: activity 배당 3파일·forms input 4파일·dashboard·tool-tile·stock-tab·market-compare-view·tax-utils 테스트). 겹침은 KB md(changelog·state-and-utils·design-system·qa-full-test-plan)뿐 → 뒤 머지 쪽이 origin/main merge 커밋으로 해소(C43 관행). 4.97은 whats-new.ts·finance-service.ts 수정 금지.

## ⑥ 일정 (머지 ≤11/20)
11/14 development → 11/16 PR·KB 일괄 → 11/17~18 qa·ui-review → 11/18 COO → 11/19 위임 머지(늦어도 11/20). 11/20까지 qa 미진입 시 컷 ①②③ 적용 후 A·B만.

## 판정: 통과 (축소 조건: 후보 3 단독 과제 폐기, 후보 4·p3는 컷 대상)
