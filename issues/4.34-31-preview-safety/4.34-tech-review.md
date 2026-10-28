# #31 tech-review — developer (2026-10-28, main 4234d0d 기준)

근거: spec.md(승인본), challenge 조건 1~10, #32 tech-review 7장, 실제 코드. 결함 판정은 하지 않으며 의심은 `결함 의심:`으로만 남긴다.

## 1. 영향 파일
| 구분 | 경로 | 변경 |
|---|---|---|
| env | `next.config.mjs` `env` | `NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? ""` 1줄 (기존 `NEXT_PUBLIC_APP_VERSION`과 같은 패턴) |
| 판별·스위치 | `src/lib/cloud-sync/config.ts` | `isPreviewEnv()` 추가(`=== "preview"`만 true). `isCloudSyncEnabled()`에 `!isPreviewEnv() &&` 추가 |
| 입구 가드 | `src/lib/cloud-sync/sync-client.ts` | `pushAsset`·`pullAsset`·`fetchRemoteVersion` 첫 줄에서 비활성이면 fetch 없이 `error`/`null` 반환 |
| preview 전용(신규) | `src/app/(main)/_components/preview/preview-gate.tsx` | 배지 + `?demo` 처리 + 웰컴 위 버튼 2개. `isPreviewEnv()` false면 `null` |
| 순수 함수(신규) | `src/lib/preview/demo-payload.ts` | `resolvePreviewAction(env, search, hasAssets)`, `materializeDemo(raw, today)`(월 오프셋→날짜) |
| 데모(신규) | `src/lib/preview/demo-data.json` | 동적 import 전용 |
| 마운트 | `src/app/(main)/layout.tsx` | `AssetDataProvider` **바깥**에 게이트 1곳 삽입(아래 5-1) |
| 변경 없음 | `welcome-guide.tsx`, `src/app/api/sync/`, `asset-storage.ts`, `asset-data-context.tsx`, `cloud-sync-provider.tsx` | 완료 기준 17 |

UI 진입점 차단은 코드로 확인함: `cloud-sync-menu-entry.tsx:75` null, `cloud-sync-connect-dialog.tsx:89` `cs.enabled &&`, provider 해시·마운트 pull·폴링·push effect 모두 `if (!enabled) return`(:141, :170, :256, :288), `pwa-install-flow.tsx:64`·`in-app-browser-gate.tsx:41`도 같은 함수를 쓴다.

## 2. 스키마·저장 키
변경 없음. `applyImportedPayload`(asset-storage.ts:277)·`clearAssetData`(:374)와 기존 키(`assetData`·`monthlySnapshots`·`dailySnapshots`·`nickname`·`assetRefresh`)만 쓴다. 마이그레이션 코드와 복원 테스트 대상이 아니다.
- #32 요구(블록 7) 대응: `assetRefresh`는 `clearAssetData`의 keepKeys라 import로 덮이지 않는다. 그래서 게이트가 주입 직후 기존 키 `secretasset_asset_refresh`에 기존 형식(`{categories:{stock,crypto,cash,loan}: ISO}`)으로 직접 기록한다. 현금·대출은 40일 전, 주식·코인은 2일 전으로 넣는다(형식은 `asset-refresh-status.ts`의 `AssetRefreshMeta` 재사용, 새 키 없음). `?demo=1`을 다시 열면 같은 값으로 덮어써 멱등을 지킨다.
- #32 요구 레거시 월 1건: -3 오프셋 스냅샷은 `date`·enrich 없이 둔다. 나머지 3건은 `date`·`fx`·`fxBase`·`breakdown`·`cost`를 포함한다. 현금 미등록 변형은 만들지 않고 #32 단위 테스트로 대신한다(spec 5장).

## 3. 서버 전송 값
늘지 않고 줄어든다. preview에서 `/api/sync` 요청은 0건이다. 데모 종목은 실제 공개 티커라 기존 시세·배당 API에 **티커만** 나간다(운영과 같은 경로, 수량·금액은 없음). GA는 preview에서 렌더되지 않는다(layout.tsx `gaEnabled`). production 번들의 분기 값은 기존과 같다.

## 4. 위험 등급 초안: `risk:high`
동기화 경로(`config.ts`·`sync-client.ts`)에 분기를 추가하므로 WORKFLOW 6장상 high다(cto 초안과 같음). 완화: production·미설정에서 `isCloudSyncEnabled()`의 반환값이 기존과 같음을 vitest 2로 고정한다. 롤백은 PR revert로 하고 운영 데이터 변경은 없다.

## 5. 커지는 부분과 축소안
1. **주입 후 화면 갱신.** `AssetDataProvider`는 마운트 때만 localStorage를 읽는다. 홈 안에서 주입하면 `initAndSync`·`bumpSnapshotVersion`·내비 등 `use-asset-import.ts` 수준의 연동이 필요해진다. 축소안: 게이트를 provider 바깥에 두고 `?demo`가 있으면 주입이 끝날 때까지 children을 렌더하지 않는다. 그다음 provider가 새 데이터를 처음부터 읽는다. 웰컴 버튼은 `location.assign("/?demo=1")`로 같은 경로를 탄다. 컨텍스트 연동 코드는 0줄이다.
2. **웰컴 위 버튼(운영 컴포넌트 미수정).** 게이트가 주입 전에 `getAssetData()`로 자산 0건 여부를 판단해 fixed 영역에 렌더한다. 위치는 ui.md를 따른다.
3. **완료 기준 4의 DOM 검사.** vitest 환경이 `node`이고 jsdom이 설치돼 있지 않다. 의존성을 추가하지 않는다. 대신 `react-dom/server` `renderToStaticMarkup`으로 빈 문자열인지 확인하고, 주입·삭제 호출 여부는 순수 함수 `resolvePreviewAction`이 `"none"`을 반환하는지로 확인한다.
4. **배당 기록.** 결함 의심(spec 차이): `assetDataSchema`(types/asset.ts:161)에는 배당 필드가 없고, 배당은 보유 티커 기준으로 시세 API(finance-service.ts:559)에서 받는다. 데모에서는 배당 지급 종목(005930·AAPL)을 보유하는 것으로 대체하고, vitest 6의 "배당" 조건을 "배당 지급 티커 1개 이상 보유"로 바꿔 검사한다. planner-designer 확인 필요.
5. **부동산 재평가.** 값 이력 필드가 없다. 월 스냅샷 `breakdown.realEstate`를 -3→-2, -1→0에서 다르게 두는 것으로 표현한다(엔진 `price:realEstate`).

## 6. 테스트 계획
**vitest 9** — `src/lib/__tests__/preview-safety.test.ts` 신규 1파일(`vi.stubEnv`, `vi.stubGlobal("fetch")`).
1 `isPreviewEnv` 4값 · 2 `isCloudSyncEnabled` 매트릭스(preview × CLOUD_SYNC on/off) · 3 3개 함수 fetch 0건 · 4 비 preview에서 렌더 결과 `""`와 `resolvePreviewAction` `"none"`(`?demo=1` 포함) · 5 `materializeDemo` 결과 `assetDataSchema.parse` 통과 · 6 유형·개수·월별 거래 3~5건·사건 종류 · 7 기준일 2026-02-10과 2026-10-27 각각에서 월 스냅샷 4건, `date`·`fx` 존재(레거시 1건은 예외), `fx.USD` 서로 다름 · 8 티커 허용 목록 · 9 `src/` 전체에서 `demo-data.json` 정적 import 0건(fs 검색).

**Playwright 8 (10~17)** — 저장소에는 Playwright 의존성·설정이 없고, 실행 환경에는 전역 `playwright`(/opt/node22)가 있다. 의존성을 추가하지 않고 qa가 실행할 스크립트를 **`memory` 브랜치 `.memory/qa/preview-check.mjs`**에 둔다. memory 브랜치는 Vercel 빌드에서 빠지고, lint·빌드 대상도 아니며, #32 이후 재사용한다. 실행: `NODE_PATH=$(npm root -g) node .memory/qa/preview-check.mjs <previewURL>`. chromium·375×812 viewport에 시나리오별로 새 컨텍스트를 쓴다. `page.on("request")`로 `/api/sync`와 GA 요청 수를, `page.on("console")`로 오류를 수집하고, 스크린샷은 이슈 폴더에 저장한다. 17은 브라우저가 아니라 `git diff --stat origin/main...issue-4.34 -- <대상>`이 비어 있는지 보는 스크립트 단계로 실행한다. 스크립트 초안은 developer가 development 단계에서 작성하고 qa가 수정한다.

## 7. 구현 순서·버전
버전: `.claude/specs/` 최대 4.33, 커밋 최대 `[#4.29]` → development 진입 시 **4.34** 배정 예정(브랜치 `issue-4.34`, preview `secretasset-git-issue-434-bbplayworlds-projects.vercel.app`). 그 결과 #32는 4.35로 예상된다.
순서: ① config·sync-client 가드와 vitest 1~3 → ② 데모 JSON·`materializeDemo`·`resolvePreviewAction`과 vitest 4~9 → ③ preview-gate와 layout 삽입 → ④ 4종 검사 → ⑤ KB 일괄 갱신(state-and-utils·components·changelog·qa-full-test-plan F-SYNC) → PR(`Closes #31`, `risk:high`) → preview 확인 → `.memory/qa/preview-check.mjs` 1회 실행.

## 교차 검토 (planner-designer)
- 배당 대체 승인: `src/types/asset.ts`에 배당 필드가 없음을 확인했다. "배당 지급 티커 보유"로 대체하고 spec 5장 표와 완료 기준 6을 같은 내용으로 고쳤다.
- ui.md와 일치: 게이트가 provider 바깥에서 주입 중 children을 막아도 ui.md의 "주입 중" 카드로 표시되고, 웰컴 버튼의 `location.assign("/?demo=1")`은 로딩 상태와 충돌하지 않는다. 부동산 재평가를 스냅샷 `breakdown.realEstate` 차이로 표현하는 것도 문제없다.
- 참고: 주입 중 children을 렌더하지 않으므로 qa는 `demoReady` 전 화면이 카드뿐인 것이 정상임을 안다.

planner-designer 승인
