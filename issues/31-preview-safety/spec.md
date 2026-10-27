# #31 spec — preview 안전장치·데모 데이터

근거: direction.md 합의 + challenge.md 조건 1~10. 괄호 `(c#)` = challenge 조건 번호. 위험 `high`(동기화 경로 분기), 롤백은 PR revert.

## 1. 문제
- preview(`VERCEL_ENV=preview`)는 운영과 같은 `/api/sync`를 쓴다. 검증 전 코드가 실제 금고에 push하면 복구 수단이 없다.
- preview는 origin이 달라 localStorage가 비어 있어 qa가 사람 없이 화면을 점검할 수 없다.

## 2. 목표 행동 (qa 자동 점검 흐름)
1. qa가 `<preview URL>/?demo=1`로 새 브라우저 컨텍스트에서 접속한다.
2. `html[data-demo-ready="1"]`을 기다린다. 이후 홈·성과 화면을 조작하고 스크린샷을 `qa-report.md`에 남긴다.
3. 점검 중 `/api/sync` 요청은 0건이다. 대표 확인 요청은 0건이다.
4. 빈 상태 점검은 `?demo=empty`.

## 3. 범위
| 구분 | 내용 |
|---|---|
| 포함 | `next.config.mjs` `env`에 `NEXT_PUBLIC_VERCEL_ENV` 주입 + 판별 함수 `isPreviewEnv()` 1개 (c1) |
| 포함 | `isCloudSyncEnabled()` preview=false + `sync-client.ts` `pushAsset`/`pullAsset`/`fetchRemoteVersion` 입구 가드 (c2) |
| 포함 | preview 전용 컴포넌트 1개: 배지 + 진입 처리(`?demo`) + 웰컴 선택 버튼 2개. production에서 DOM 없음 (c3) |
| 포함 | 데모 JSON 1개, 동적 import, `applyImportedPayload`로 주입 (c4) |
| 포함 | 테스트 (a)(b)(c) (c10) |
| 줄임 | 유형당 1~3개, 거래 월 3~5건. 데모 변형·날짜 조작 기능 없음. "빈 상태"는 `clearAssetData`뿐 |
| 제외 | 서버 `/api/sync` 변경(제외 확정, c2), `WelcomeGuide` 등 운영 컴포넌트 수정, 새 저장 키·스키마, 월 스냅샷 저장 로직, 새 GA |

## 4. 흐름
1. 빌드 시 `NEXT_PUBLIC_VERCEL_ENV`가 주입된다. `isPreviewEnv()`는 값이 정확히 `"preview"`일 때만 true (미설정·production·development는 false) (c1).
2. 루트 레이아웃에서 `isPreviewEnv()`일 때만 preview 컴포넌트를 렌더(동적 import). 배지 `[data-testid="preview-badge"]`: `PREVIEW · v4.NN`(`APP_VERSION`), `data-screenshot-hide`, `fixed`·`pointer-events-none`으로 레이아웃·헤더 조작을 가리지 않음. 위치·스타일은 ui.md (c9).
3. `?demo=1`: 데모 JSON 동적 import → 월 오프셋을 오늘 기준 날짜로 변환 → `applyImportedPayload` → `history.replaceState`로 쿼리 제거 → `dataset.demoReady="1"`. 재실행해도 같은 상태(항상 덮어쓰기) (c8).
4. `?demo=empty`: `clearAssetData()` → 쿼리 제거 → `demoReady="1"` (c8).
5. 쿼리 없이 자산 0건이면 웰컴 화면 위에 `preview-demo-btn`(데모 데이터로 보기) / `preview-empty-btn`(빈 상태로 보기) 노출. 같은 처리를 호출.
6. 동기화: `isCloudSyncEnabled()`가 false라 provider 자동 pull·폴링·push와 연결 진입점이 꺼지고, 입구 가드가 UI와 무관하게 fetch를 막는다.

## 5. 데모 시나리오 (c5, c6, c7)
공통: 닉네임 "데모", 실제 공개 티커 + 가상 수량·금액. 날짜는 월 오프셋(-3,-2,-1,0)으로 저장, 주입 시 오늘 기준 변환. 월 스냅샷은 `month`·`date`·`fx`·`fxBase`·`breakdown`·`cost` 포함, 달마다 `fx.USD` 상이(예 1,330 → 1,350 → 1,380 → 1,400). 일별 스냅샷은 최근 30일 중 일부만.

| 유형 | 항목(유형당 1~3) | 월 오프셋 사건 |
|---|---|---|
| 국내주식 | 삼성전자(005930) 등 1~2 | -2 매수, -1 일부 매도 |
| 해외주식(USD) | AAPL 등 1~2 | -1 매수 (환율 변화 노출) |
| 연금 | 연금 계좌 1 (티커 보유) | 0 입금 |
| ISA | ISA 계좌 1 | -2 매수 |
| 코인 | BTC 1 | -1 코인 거래 1건 |
| 부동산 | 1 | 값 이력 -3, -1에서 재평가(월 1회 이상) |
| 현금 | 계좌 1~2 | -2 외부 입금, -1 외부 출금 (`cashTransactions`) |
| 대출 | 1 | -1 상환 (`loanTransactions`) |
| 배당 | 기록 1~2 | -2 또는 -1 |

- 거래 합계는 월 3~5건, 위 사건(외부 입출금, 매수·매도, 대출 상환, 코인 거래, 부동산 재평가)을 모두 포함. 한 달에 소액 미기록 차이를 남긴다(스냅샷 netAsset과 항목 합의 차이) (c7).
- 월 스냅샷은 -3~0(= 직전 3개월 + 이번 달). 이번 달 값은 로드 시 시세로 재계산되므로 qa 기대값은 "0이 아님·항목 존재"이며 정확한 금액을 단정하지 않는다 (c6).
- #32 요구 매핑: 순유입≠0(입출금), 시장 변화≠0(주식·코인), 환율 효과≠0(fx 변화), 부동산 재평가≠0, 기록 안 된 변화≠0(미기록 차이) → 결산 "순유입 / 시장 변화 / 기록 안 된 변화"가 모두 0이 아님. #32 완료 기준 5·7·14(날짜 상황별 헤더, 현금 미등록, 레거시)는 데모 변형 없이 #32 단위 테스트로 보증한다(이 이슈에 변형을 만들지 않음).
- #32 홈 결산 카드 노출 구간(말일 3일 전~다음 달 10일) 밖이면 카드가 안 보인다. qa는 월 탭 경로로 점검하고 카드는 #32 단위 테스트로 보증.

## 6. 엣지 케이스
- production·로컬 미설정: `isPreviewEnv()` false. `?demo=1`을 붙여도 주입·삭제·배지·버튼 없음, `isCloudSyncEnabled()`는 기존 동작(`NEXT_PUBLIC_CLOUD_SYNC !== "off"`). 운영 초기 번들에 데모 JSON 미포함.
- 쿼리 반복: `?demo=1` 재접속은 같은 상태로 덮어쓴다(멱등). 주입 후 쿼리가 제거돼 새로고침 시 재주입 없음(사용자가 preview에서 만든 변경 보존). `?demo=empty` 후 `?demo=1`은 데모로 덮어쓴다. 알 수 없는 값(`?demo=x`)은 무시.
- 주입 실패(스키마 파싱 오류): 기존 데이터 유지(`applyImportedPayload` 1단계 동작), `demoReady`를 설정하지 않아 qa가 대기 시간 초과로 실패를 인지.
- 연 경계 의존성 (c10): 월 스냅샷 저장(`asset-data-context.tsx:770`)은 올해가 아닌 달을 삭제한다. 오늘이 4~12월이면 -3 오프셋도 같은 해라 무관하나, 1~3월에 주입하면 전년 달이 첫 저장에서 사라진다. #32의 13개월 롤링 보존 수정에 의존하며 이 이슈는 저장 로직을 건드리지 않는다. 1~3월 qa는 #32 보존 수정 병합 후에 유효.
- 첫 사용자(preview 최초 접속, 쿼리 없음): 웰컴 + 선택 버튼 2개. 이미 자산이 있으면 버튼 숨김.
- 배지가 공유 이미지에 들어가지 않음(`data-screenshot-hide`, 캡처 대상 밖).

## 7. 완료 기준 (qa가 vitest·Playwright로 검사)
vitest
1. `NEXT_PUBLIC_VERCEL_ENV`가 `"preview"`일 때만 `isPreviewEnv()`가 true이고, 미설정·`production`·`development`에서 false (c1, c10b).
2. preview에서 `isCloudSyncEnabled()`는 false, production·미설정에서는 `NEXT_PUBLIC_CLOUD_SYNC`만으로 결정되며 기존 값과 같다 (c2, c10b).
3. preview에서 `pushAsset`·`pullAsset`·`fetchRemoteVersion` 호출 시 `fetch` 호출이 0건이다 (c2, c10a).
4. production·미설정에서 preview 컴포넌트를 렌더하면 DOM이 비어 있고, `?demo=1`이어도 `applyImportedPayload`·`clearAssetData`가 호출되지 않는다 (c3, c10b).
5. 데모 JSON이 `assetDataSchema.parse`를 통과한다 (c10c).
6. 데모 JSON이 모든 유형(국내·해외·연금·ISA·부동산·코인·현금·대출·배당)을 포함하고, 유형당 1~3개, 거래가 월별 3~5건이며 외부 입금·출금, 매수·매도, 대출 상환, 코인 거래, 부동산 재평가를 각각 1건 이상 포함한다 (c7, c10c).
7. 월 오프셋 변환 결과 월 스냅샷이 오늘 기준 직전 3개월 + 이번 달 4건이고 각각 `date`·`fx`가 있으며 `fx.USD` 값이 모두 다르다. 서로 다른 기준일 2개(예 2026-02-10, 2026-10-27)에서 모두 성립한다 (c5, c10c).
8. 데모의 모든 종목 티커가 실제 공개 티커 허용 목록(테스트 내 고정 목록)에 속한다 (c6).
9. 데모 JSON이 동적 import로만 참조된다(정적 import 0건, 소스 검색) (c4).
Playwright (preview URL)
10. `/?demo=1` 접속 후 `html[data-demo-ready="1"]`이 설정되고, `location.search`에 `demo`가 없으며 홈에 자산이 있는 상태(웰컴 화면 아님)다.
11. 같은 컨텍스트에서 `/?demo=1`을 다시 열어도 같은 자산 수·순자산 구성이 유지된다(멱등).
12. `/?demo=empty` 접속 후 `demo-ready`가 설정되고 웰컴 화면이 보인다.
13. 쿼리 없는 첫 접속에서 `preview-demo-btn`·`preview-empty-btn`이 보이고 각각 탭하면 10·12와 같은 상태가 된다.
14. `preview-badge` 텍스트가 `PREVIEW · v4.NN` 형식이고 `data-screenshot-hide` 속성이 있다. 375px 뷰포트에서 한 줄이며 헤더 버튼의 클릭 가능 영역과 겹치지 않는다 (c9).
15. 위 흐름 전체에서 `/api/sync`로 나간 요청이 0건이고, `#sync=<id>` 해시로 접속해도 0건이다.
16. 홈 → 성과 허브 이동 시 콘솔 오류가 0건이다. GA 요청 0건.
17. 운영 컴포넌트 diff: `WelcomeGuide` 및 `src/app/api/sync/` 변경이 없다(`git diff --stat`) (c2, c3).

## 교차 검토 (business-pm)
direction 합의(preview 감지로 동기화 차단, `v4.NN` 배지, 단일 JSON·`applyImportedPayload`, `?demo` 진입, 서버 제외), challenge 조건 1~10, business.md 성공 기준 4개(qa 완주, 요청 0건, 대표 확인 0건, payload 조건)와 모두 일치한다. 새 GA·사용자 데이터 수집 없음, 범위 확대 없음.

business-pm 승인
