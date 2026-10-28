# #31 preview 안전장치·데모 데이터 — cto 반대 검토 (challenge.md)

## 판정: 통과
direction 합의안이 이미 작은 편이다(새 게이트 없음, 새 저장 로직 없음, 스키마 변경 없음). 남은 축소 사항은 합의를 뒤집지 않는 수준이라 아래 7장 spec 조건으로 확정하고 재검토는 하지 않는다.

## 1. 꼭 해야 하는가 — 예
- 대표 결정 방식("머지/닫기만, QA 요청 0")과 WORKFLOW 8장("시드0 전에는 다른 이슈 development 금지")의 전제 조건이다. 이게 없으면 #32가 development에 들어갈 수 없다.
- 코드 확인: preview(`VERCEL_ENV=preview`)도 운영과 같은 `/api/sync` 경로를 쓰고 `cache-storage.ts:115`에서 KV를 필수로 쓴다. 지금 preview에서 `#sync=` 링크로 연결하면 검증 전 코드가 실제 금고에 push할 수 있다. 사용자 데이터 손실 위험을 막는 일이라 근거는 충분하다.
- 목표 기여는 간접적이다(#32 선행). 사업 절도 직접 기여를 주장하지 않아 정직하다.

## 2. 더 작게
- **서버 `/api/sync`의 preview 거부: "선택"으로 두지 말고 제외로 확정한다.** preview는 origin이 달라 localStorage에 금고 자격이 없고, 연결 진입점은 모두 `enabled` 기준으로 막힌다(코드 확인: `cloud-sync-menu-entry.tsx:75` null 반환, `cloud-sync-connect-dialog.tsx:89` `open = cs.enabled && …`, `tool-menu.tsx:304` disabled, 해시 감지·마운트 pull effect도 `if (!enabled) return`). 서버 API를 고치면 risk가 올라가고 이득은 없다.
- 대신 차단 지점은 하나 더 낮춘다. provider의 `enableSync`/`pushNow`/`pullNow`/`connect`는 자체적으로 `enabled`를 확인하지 않고 UI 숨김에 기대고 있다(현재 호출부는 모두 막혀 있어 결함은 아님). `sync-client.ts`의 `pushAsset`/`pullAsset`/`fetchRemoteVersion` 입구에 `isCloudSyncEnabled()` 가드 한 줄을 두면 "preview 요청 0건"을 UI와 무관하게 단위 테스트 하나로 보장할 수 있다. 운영 동작은 그대로다.
- 웰컴 화면 버튼 2개는 `WelcomeGuide`를 고치지 않고 preview 전용 컴포넌트(배지와 같은 파일)에서 렌더한다. 운영 컴포넌트 diff를 0으로 둔다.
- 데모 JSON은 preview 분기 안에서 동적 import로 불러와 운영 초기 번들에 포함하지 않는다.

## 3. 빼거나 합치기
- 기존 자산과 겹치는 부분은 이미 재사용한다. `applyImportedPayload`(검증 후 저장, 스냅샷 복원), `isCloudSyncEnabled()`(단일 스위치), `next.config.mjs` `env` 주입 패턴. 새로 만들 것은 env 1개, 배지, 데모 JSON, 진입 처리뿐이다.
- `welcome-preview-data.json`은 형식이 달라 재사용할 수 없다는 경험 절 판단을 확인했다. 합칠 대상은 없다.

## 4. DECISIONS·LEARNINGS 충돌
- 충돌 없음. PRINCIPLES 5장("preview는 데모 데이터만, 동기화 쓰기 안 함")을 그대로 구현한다.
- LEARNINGS "테스트 데이터는 커뮤니티 반감이 크다": 데모 데이터는 QA 전용으로 둔다. 마케팅 소재로 쓸 때는 기존 규칙(금액 숨김, 비중·%만)을 따른다. 이 이슈 범위 밖이다.
- LEARNINGS "데이터 가정은 저장 코드로 확인": 월 스냅샷 저장(`asset-data-context.tsx:770`)은 로드할 때마다 **올해가 아닌 달을 지운다**. 오늘(10월) 기준 -3~0 오프셋은 7~10월이라 문제없다. 하지만 1~3월에 주입하면 전년 달이 첫 저장에서 사라진다. #32의 13개월 롤링 보존이 들어가면 해소되므로 이 이슈에서 저장 로직은 건드리지 않는다. spec에는 이 의존 관계만 명시한다.

## 5. 성공 측정
사용자 지표가 아니라 팀 운영 기준이다(신규 GA 없음, production에서만 GA가 렌더되므로 preview 이벤트도 0).
- (a) `sync-client` 가드 단위 테스트: preview env에서 fetch 호출 0건.
- (b) env 미설정·production에서 `isPreview*`가 false이고 데모 주입·배지가 렌더되지 않는다(테스트).
- (c) 데모 payload가 `assetDataSchema.parse`를 통과하고 유형·기간·거래 조건을 만족한다(테스트).
- (d) #32 qa-report가 `?demo=1`만으로 스크린샷을 남기고 대표 확인 요청 0건.

## 6. 위험 등급 초안: `risk:high`
- 근거: 동기화 경로(`config.ts`/`sync-client.ts`)에 분기를 추가한다. WORKFLOW 6장상 동기화는 high이고, 애매하면 높은 쪽을 택한다. 저장소 스키마와 서버 API 변경은 없다.
- 완화: 운영 분기 값은 기존과 같다는 것을 (b) 테스트로 보장한다.
- 롤백: PR revert. 운영 데이터 변경이 없어 되돌림 비용이 0이다.

## 7. spec 조건 (③에서 반드시 반영)
1. preview 판별은 `next.config.mjs` `env`에 `NEXT_PUBLIC_VERCEL_ENV` 주입 + 판별 함수 1개로 한다. 로컬 개발(미설정)은 운영과 같이 취급한다.
2. `isCloudSyncEnabled()`는 preview에서 false를 반환한다. 추가로 `sync-client.ts`의 3개 함수 입구에 가드를 둔다. 서버 `/api/sync`는 변경하지 않는다(제외 확정).
3. 운영 컴포넌트(`WelcomeGuide` 등)는 수정하지 않는다. 배지와 선택 버튼은 preview 전용 컴포넌트 하나에 두고 production에서는 DOM에 없게 한다.
4. 데모 JSON은 동적 import로 불러오고 `applyImportedPayload`로 주입한다. 새 저장 키·스키마는 없다.
5. 데모 날짜는 월 오프셋으로 두고 주입할 때 오늘 기준으로 변환한다. 월 스냅샷에는 `date`·`fx`를 포함하고, 달마다 fx가 다르게 한다.
6. 종목은 실제 공개 티커를 쓰고 수량·금액만 가상으로 둔다. 가상 티커는 시세 조회가 실패해 화면을 깨뜨린다. 이번 달 값은 로드 시 시세로 다시 계산되므로 qa 기대값은 "0이 아님·항목 존재"로 정의하고 정확한 금액으로 정하지 않는다.
7. 유형당 1~3개, 거래는 월 3~5건으로 둔다. 외부 입출금, 매수·매도, 대출 상환, 코인 거래, 부동산 재평가, 미기록 소액 차이를 모두 포함한다.
8. 진입은 `?demo=1`(항상 덮어쓰기, 멱등) / `?demo=empty`(`clearAssetData`)로 하고, 처리 후 쿼리를 제거한다. 셀렉터 `preview-badge`·`preview-demo-btn`·`preview-empty-btn`과 `dataset.demoReady="1"`을 고정한다.
9. 배지 `PREVIEW · v4.NN`은 `data-screenshot-hide`를 달고, 레이아웃을 밀지 않으며 헤더의 조작 요소를 가리지 않게 한다(위치는 ui.md에서 확정).
10. 테스트 5장 (a)(b)(c)를 PR에 포함한다. 1~3월 주입 시 전년 달 삭제는 #32 보존 수정에 의존한다고 spec에 명시한다.

## 결함 의심 (qa 확인 요청)
- 없음. 참고로 provider 액션이 `enabled`를 자체 확인하지 않는 구조는 현재 모든 호출부가 막혀 있어 결함으로 보지 않는다. 2장의 가드로 구조적으로 닫는다.
