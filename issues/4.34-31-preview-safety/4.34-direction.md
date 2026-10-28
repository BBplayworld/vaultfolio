# #31 preview 안전장치·데모 데이터 — 방향 정의 (direction.md)

## 사업 (business-pm)

### 왜 지금
- 사용자 기능이 아니라 **팀 QA 인프라**다. 대표 결정이 "머지/닫기" 하나이고 QA·화면 확인을 대표에게 맡기지 않기로 했다(DECISIONS 2026-10-27). 그 전제는 qa 에이전트가 preview를 Playwright로 직접 점검하는 것이고, preview에는 자산이 없고 동기화는 실제 데이터를 덮어쓸 위험이 있어 지금은 성립하지 않는다.
- 목표(월 활성 100명) 기여는 간접적이다. 리텐션의 핵심인 #32 월말 결산을 검증된 상태로 내보내는 선행 조건이다. 리텐션/첫 발견에 직접 기여하는 사용자 기능은 아니며, 그렇게 주장하지 않는다.
- #32가 이 이슈에 막혀 있어(STATE) 순서상 지금이 맞다.

### 누구를 위해 (팀·qa·대표 결정)
- qa: 사람 없이 끝까지 조작·스크린샷할 수 있는 환경이 필요하다.
- 대표: 머지 전에 실제 화면 증거(스크린샷)를 받아야 한다. QA를 직접 하지 않는다.
- 간접 수혜: 운영 사용자. 검증 전 코드가 실제 동기화 데이터를 덮어쓰는 사고를 막는다. 데이터가 기기에만 있어 되돌릴 방법이 없다.

### 성공의 모습 (관찰 가능한 기준)
사용자 지표(GA)가 아니라 팀 운영 기준이다. 사용자 데이터 수집 없음, 신규 GA 이벤트 없음.
1. qa가 `?demo=1` 같은 고정 진입만으로 사람 없이 데모 상태에 들어가 #32 시나리오를 끝까지 점검하고 `qa-report.md`에 스크린샷을 남긴다. 다음 이슈(#32)의 qa 단계에서 대표 확인 요청이 0건이다.
2. 데모 데이터가 #32 요구를 충족한다. 2개월 이상 기록으로 지난달 대비 변화가 보이고, 외부 입출금, 매수·매도, 환율 변화, 부동산 재평가가 모두 있다. 그래서 결산의 "순유입 / 시장 변화 / 기록 안 된 변화"가 모두 0이 아닌 값으로 나온다.
3. preview에서 동기화 쓰기 호출이 0건이고, 운영 빌드에서는 이 코드 경로가 실행되지 않음이 테스트로 보장된다.

### 하지 않으면 무엇을 잃나
- 강함: 같은 이슈마다 qa가 점검할 수 없어 대표가 QA를 떠안거나(결정 방식 위반), 검증 없이 머지된다. 특히 #32는 운영 월 스냅샷을 다루므로 위험이 크다.
- 강함: 동기화 쓰기가 열린 채 preview를 쓰면 실제 동기화 데이터 손상 가능성이 있다. 복구 수단이 없다.
- 약함: 사용자 수 증가에 대한 직접 효과는 없다. #32의 선행 조건이라는 점만이 근거다.

### 범위를 줄일 수 있는 것
이미 결정된 것은 뒤집지 않는다. 그 안에서 줄일 후보만 제시하고 최종은 합의 절에서 정한다.
- 데모 데이터 자산 유형 전부(국내·해외·연금·ISA, 부동산, 코인, 현금, 대출, 배당)를 한 번에 채우지 않고, #32 결산과 #33이 쓰는 유형 위주로 먼저 채운다. 단 이슈 본문은 전체 유형을 요구하므로, 줄인다면 planner-designer 의견과 함께 합의가 필요하다.
- 거래 기록은 본문의 "3개월치"를 유지하면 #32의 2개월 이상을 포함한다. 더 늘리지 않는다.
- "빈 상태로 보기"는 데모를 거절했을 때의 기본 상태와 같아 추가 구현이 거의 없어야 한다. 별도 화면을 만들지 않는다.
- 월 스냅샷은 #32 선행 작업(13개월 롤링 보존)과 겹치므로, 데모 데이터는 해당 보존 규칙 안의 기간만 사용하고 이 이슈에서 저장 로직은 건드리지 않는다.
- 열린 질문 "기존 데모 계정 데이터 재사용"은 코드로 확인한 뒤 있으면 재사용한다. 새로 만들지 않는다.

## 경험 (planner-designer)

### 1. 현재 코드 기준 관련 지점
- 동기화 쓰기·읽기: `src/lib/cloud-sync/sync-client.ts`(`pushAsset` PUT, `pullAsset`/`fetchRemoteVersion` GET)를 `src/lib/cloud-sync/cloud-sync-provider.tsx`가 호출한다(마운트 자동 pull, 2.5s 디바운스 push, 60s 폴링, `pushNow`/`pullNow`/`enableSync`/`connect`). 서버는 `src/app/api/sync/route.ts`.
- 이미 있는 단일 스위치: `src/lib/cloud-sync/config.ts`의 `isCloudSyncEnabled()`(`NEXT_PUBLIC_CLOUD_SYNC=off`). provider의 `enabled`가 false면 자동 pull·폴링·push가 모두 멈추고, `pwa-install-flow.tsx`·`in-app-browser-gate.tsx`도 이 함수를 쓴다. 즉 **preview에서 이 함수가 false를 반환하게 하면 읽기·쓰기가 한 번에 꺼진다**(새 게이트 신설 불필요). 단 UI의 "동기화 연결" 버튼(`welcome-guide.tsx`의 `sync_connect`, 설정/도구 메뉴)은 `enabled` 기준으로 숨는지 developer가 확인해야 한다.
- 환경 판별: `src/app/layout.tsx`가 `process.env.VERCEL_ENV === "production"`을 서버에서만 쓴다. 클라이언트용은 `next.config.mjs`의 `env`에 `NEXT_PUBLIC_VERCEL_ENV`를 추가하는 방식이 기존 `NEXT_PUBLIC_APP_VERSION` 주입 패턴과 같다.
- 버전/번호: preview 브랜치는 `issue-4.NN`이고 `NEXT_PUBLIC_APP_VERSION`(= `APP_VERSION`, `src/config/app-version.ts`)이 이미 4.NN을 담는다. **GitHub 이슈 번호(#31)는 빌드 환경에 없다.**
- 첫 진입: `src/app/(main)/page.tsx`는 자산 5종이 모두 0건이면 `WelcomeGuide`(`_components/layout/onboarding/welcome-guide.tsx`)를 연다. 거기에 이미 "백업 가져오기"(`useAssetImport` → `importAssetData` → `applyImportedPayload`, `src/lib/asset/asset-storage.ts:277`)와 마법사 진입이 있다.
- 데모 데이터 재사용 결과(열린 질문 답): `welcome-preview-data.json`은 웰컴 화면 예시용 요약값(주식 일부·합계)일 뿐 `AssetData`/스냅샷/거래 형식이 아니라 **그대로는 못 쓴다**. 반면 `applyImportedPayload(payload)`는 `{assetData, snapshots{daily,monthly,dailyArchive}}`를 검증(`assetDataSchema`)·저장·스냅샷 복원까지 하므로 **데모 주입 경로는 이 함수를 재사용**한다(새 저장 로직 없음, 스키마 변경 없음). 거래는 `assetData` 안의 `transactions`/`cashTransactions`/`loanTransactions`/`cryptoTransactions`에 들어간다(`src/types/asset.ts`).
- 공유 이미지: `share-menu.tsx`는 화면 밖 고정 680px 인스턴스를 `toPng`으로 캡처한다(헤더/탑바는 캡처 대상 아님). `data-screenshot-hide`는 현재 `stock-insight-strip.tsx`에만 있고 "향후 캡처용 마커"다. PREVIEW 배지는 탑바류에 두면 캡처에 안 들어가지만, 원칙(PRINCIPLES 5장)대로 속성도 함께 단다.
- GA: `layout.tsx`가 production에서만 GA를 렌더하므로 preview 이벤트는 이미 0건이다. 추가 작업 없음.

### 2. qa·대표가 preview에서 겪는 흐름
1. qa가 `https://secretasset-git-issue-4NN-bbplayworlds-projects.vercel.app/?demo=1` 접속(새 브라우저 컨텍스트 = 빈 localStorage).
2. 앱이 preview임을 감지하고 `demo=1`이면 선택창 없이 데모 payload를 `applyImportedPayload`로 주입 → 홈이 자산 있는 상태로 열림. `demo=1`은 항상 데모로 덮어쓴다(멱등, 재실행해도 같은 상태). 주소의 `?demo`는 주입 직후 `history.replaceState`로 제거해 새로고침 시 재주입을 막는다.
3. `?demo=empty`면 저장소를 비우고 웰컴 화면으로(= "빈 상태로 보기"). 별도 화면 없음.
4. 쿼리 없이 처음 열면(자산 0건, 선택 이력 없음) 웰컴 화면 최상단에 두 버튼: `데모 데이터로 보기` / `빈 상태로 보기`. 사람(대표)이 직접 열어보는 경로이며 qa는 쓰지 않아도 된다.
5. 고정 셀렉터: 배지 `[data-testid="preview-badge"]`, 버튼 `[data-testid="preview-demo-btn"]`, `[data-testid="preview-empty-btn"]`. 주입 완료는 `document.documentElement.dataset.demoReady="1"`로 신호(qa가 대기 조건으로 사용).
6. 운영 환경(`VERCEL_ENV=production`)과 로컬 개발: 쿼리가 있어도 아무 일도 일어나지 않는다. 배지 없음, 버튼 없음, 동기화 기존 동작 유지.
7. preview에서 사용자가 동기화를 켜려 해도 서버 호출이 나가지 않는다: 연결/켜기 진입점은 숨기거나 "preview에서는 동기화가 꺼져 있어요" 안내만 보인다(요청 0건).

### 3. 범위
- 포함
  - preview 감지(`NEXT_PUBLIC_VERCEL_ENV`)와 `isCloudSyncEnabled()` preview=false (읽기·쓰기 동시 차단, 새 게이트 없음).
  - PREVIEW 배지.
  - 데모 payload 고정 파일 1개 + `?demo=1`/`?demo=empty` 진입 + 웰컴 화면 선택 버튼 2개.
  - 테스트: (a) preview에서 `/api/sync` 호출 0건(`isCloudSyncEnabled()` false), (b) production/미설정에서 `demo` 쿼리 주입·배지 코드가 실행되지 않음, (c) 데모 payload가 `assetDataSchema`로 파싱되고 필수 유형·기간 조건을 만족.
- 줄일 수 있는 것(동의 요청)
  - 사업 절 제안 중 "자산 유형 일부만 먼저"는 **채택하지 않는다.** 데모 파일은 어차피 한 번 쓰는 정적 JSON이고, 유형을 나누면 이후 이슈(#33 등)마다 파일을 다시 열게 된다. 대신 **분량으로 줄인다**: 유형당 대표 항목 1~3개, 거래는 합쳐서 월 3~5건 수준.
  - "빈 상태로 보기"는 `clearAssetData` 호출 + 웰컴 노출뿐(신규 화면 0).
  - 서버 `/api/sync`의 preview 거부(서버측 이중 방어)는 이번에 **선택**으로 둔다. 클라이언트 차단으로 요건(쓰기 0건)은 충족하고, 서버 API 변경은 `risk:high`라 비용이 크다. developer·cto가 tech-review에서 필요성 판단.
- 하지 않을 것
  - 운영 코드 경로 변경, 저장소 스키마·키 변경, 월 스냅샷 보존 로직 변경(#32 선행 작업 몫).
  - 데모 데이터 자동 갱신 서버/스크립트, 데모 모드 토글 설정 메뉴, 데모 전용 라우트.
  - 이슈 번호(#31)를 배지에 표시하기 위한 별도 env·API 신설(아래 4장 참고).
  - 실제 사용자 데이터 가져오기/사용, 새 GA 이벤트.

### 4. PREVIEW 표시 UI와 데모 시나리오
**배지**
- 위치: 화면 최상단 고정 얇은 띠(높이 24px, 콘텐츠 위가 아니라 레이아웃 흐름 밖 `fixed top-0`, `pointer-events-none`). 375px에서 한 줄. 문구: `PREVIEW · v4.NN`(`tabular-nums`). 색은 기존 `important`(주황) 토큰이 순자산에 쓰이므로 피하고, 중립 `muted` 배경 + `foreground` 글자로 둔다.
- `data-screenshot-hide` 속성을 달고 공유 이미지·QA 스크린샷에서 제외 가능하게 한다. production에서는 DOM에 존재하지 않는다.
- 이견 아님/조정: 본문 결정은 "이슈 #<번호>"였으나 빌드 환경에 이슈 번호가 없고 브랜치=버전이라 **`v4.NN`으로 표시**하자고 제안(같은 식별 목적, 추가 env 불필요). 합의 절에서 확정.

**데모 시나리오(고정 파일, 가상 인물·가상 종목 비율)**
- 기준일: 파일에 날짜를 박지 않고 **월 오프셋(-3,-2,-1,0)** 으로 두고 주입 시 오늘 기준으로 변환한다. 박아두면 한 달 뒤 "지난달"이 아니게 되어 #32 점검이 깨진다.
- 월 스냅샷: 직전 3개월 + 이번 달(= 13개월 보존 규칙 안). `date` 필드 포함(원인분해가 사용). 일별 스냅샷은 최근 30일 일부만(채우기 위한 최소).
- 자산 유형: 국내주식, 해외주식(USD), 연금, ISA, 부동산(시세 재평가가 월별로 바뀌도록 값 이력), 코인, 현금, 대출 1건, 배당 기록.
- 거래: 3개월치. 반드시 포함 — 외부 입금·출금(`cashTransactions`), 주식 매수·매도(`transactions`), 대출 상환(`loanTransactions`), 코인 거래, 부동산 재평가 월 1회 이상.
- 환율: 월 스냅샷 `fx`가 달마다 달라(예: USD 1,3xx→1,4xx) 환율효과가 0이 아니게.
- 기대 결과(#32 요구): 지난달 대비 순자산이 증가/감소 어느 쪽이든 0이 아니고, 결산의 "순유입 / 시장 변화 / 기록 안 된 변화"가 모두 0이 아닌 값. 기록 안 된 변화는 일부러 한 달에 소액의 미기록 차이를 남겨 만든다.
- #33(투자 유형) 대비: 주식 비중이 70% 이상인 상태와 낮은 상태 모두 확인할 수 있도록 `?demo=1` 외에 변형이 필요한지는 #33 재개 시 결정(on-hold). 이번엔 변형을 만들지 않는다.
- 닉네임은 "데모". 실제 인물·계좌 정보 없음.
- #32 검증 한계(spec 단계 인계): 결산 카드 노출 구간이 말일 3일 전~다음 달 10일이라, 오늘이 구간 밖이면 홈 카드가 안 보인다. 월 탭 결산 블록은 항상 확인 가능하므로 qa는 그 경로로 점검하고, 홈 카드 노출은 단위 테스트로 보증하는 방안을 #32 spec에서 정한다(이 이슈에 날짜 조작 기능을 넣지 않는다).

### 5. 사업 절에 대한 의견
**동의**(성공 기준 1·3 포함). 조정 두 가지만 합의 절에서 확인 요청:
1. "자산 유형 일부만 먼저"는 채택하지 않고 항목 수로 줄인다(위 3장). 이슈 본문의 전체 유형 요구와도 일치.
2. 배지 표기를 `이슈 #번호` 대신 `v4.NN`으로(빌드에서 알 수 있는 값). 이견이라기보다 구현 가능성 조정.

## 합의 (business-pm)

### 최종 방향
- preview 감지(`NEXT_PUBLIC_VERCEL_ENV`) 시 `isCloudSyncEnabled()`를 false로 만들어 동기화 읽기·쓰기를 한 번에 막는다. 새 게이트와 운영 경로 변경은 없다.
- 상단 배지는 `PREVIEW · v4.NN`으로 표시한다. 이슈 번호는 빌드에서 알 수 없고 브랜치가 곧 버전이라 사업 절의 "이슈 #번호"를 이 표기로 대체한다. 공유 이미지에서는 숨기고 production에는 존재하지 않는다.
- 데모 데이터는 고정 JSON 1개로 하고 `applyImportedPayload`로 주입한다. 자산 유형은 전부 포함하되 유형당 1~3개, 거래는 월 3~5건으로 항목 수를 줄인다(사업 절의 "유형 일부만 먼저"는 철회). 월 오프셋 방식으로 #32 요구(2개월 이상, 입출금, 매수·매도, 환율 변화, 부동산 재평가, 미기록 소액 차이)를 충족한다.
- 진입은 `?demo=1` / `?demo=empty`와 웰컴 화면 버튼 2개이고, 고정 셀렉터와 `demoReady` 신호로 qa가 사람 없이 조작한다.
- 서버 `/api/sync`의 preview 거부는 선택 사항으로 두고 risk:high를 피한다. 필요성은 tech-review에서 판단한다.

### 남은 쟁점
없음. (design-review로 넘길 항목: 서버 /api/sync preview 거부 필요 여부, "동기화 연결" 진입점의 `enabled` 기준 숨김 확인, 데모 payload 스키마 검증 테스트 기준)

business-pm 합의함

planner-designer 합의함
