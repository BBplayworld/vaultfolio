# 체험 모드 보강(p2·p3 묶음) — tech-review (developer, 2026-11-20)

기준: `origin/issue-5.132` @c40e461(5.130·5.131·5.132 위) `git show` 읽기만. 근거: DECISIONS 11/19(#249 tech-review·CEO challenge 후보), `5.131-tech-review.md` 7·8절, `5.131-qa-report.md` R-1, `5.131-ui-review.md` p2-1.
확인하지 못한 것: 런타임 실측(이번은 코드만). 스와이프 도달은 5.131 tech-review 7절 실측(성과→`#more`, 해시 `#more`·`#settings` 직접 입력)을 근거로 쓴다.

## 판정: **4건 모두 진행 가능 · 묶음 1건 · risk:low(3번 포함 시 medium 권고) · 규모 S(src 4파일 + 테스트 3파일, 약 60줄)**
수정 금지 영역(`trial-boot.ts`·`trial-gate.tsx`·`ga.ts` 체험 가드·`layout.tsx` 인라인 스크립트) **파일 변경 0**. 저장 키·스키마·동기화·서버 전송 증가 0.

## 1. (p2) 체험 중 스와이프로 더보기·설정 도달
- 원인: `src/app/(main)/_components/layout/navigation/navigation-context.tsx:94` `PAGE_ORDER = ["home","detail","activity","more"]`를 `:329~352` 스와이프가 체험 구분 없이 사용. 체험은 더보기를 의도적으로 뺐다(`bottom-nav.tsx:88` `id !== "more"`, `top-bar.tsx` `showMore … && !trial` — `trial-guards.test.ts:117~122`가 고정). 스와이프만 빠진 가드. 해시 `#more`·`#settings`도 `parseHash`(`:104~105`)가 그대로 연다(초기 `:233`·popstate `:254`).
- 최소 수정(이 파일 1개, `isTrialMode` import — 의존 0 모듈이라 순환 없음):
  1. 순수 함수 2개 export: `swipeOrderOf(trial)` = 체험이면 `["home","detail","activity"]`, 아니면 `PAGE_ORDER` / `guardTrialView(v, trial)` = 체험이고 `more`·`settings`면 `{type:"home"}`, 아니면 `v` 그대로(같은 참조).
  2. `handleTouchEnd`의 `PAGE_ORDER` 3곳 → `swipeOrderOf(isTrialMode())`. 성과에서 왼쪽 스와이프는 아무 일 없음(홈으로 돌리지 않음).
  3. 초기 동기화·onPop에서 `guardStockPageView` 결과에 `guardTrialView`를 한 번 더 씌우고, 바뀌었으면 `replaceState(toHash(home))`(기존 종목 한 장 가드와 같은 패턴).
  - `PAGE_ORDER`·`computeSlideDir`·`mainTypeOf`·`navigate`는 무변경(슬라이드 방향 계산은 체험에서도 그대로 맞음).
- 금지 영역: 닿지 않음 → **risk:low**.
- 테스트: 단위 — `swipeOrderOf(true/false)`, `guardTrialView`(more·settings·settings+focus → home, home·detail·activity·tax → 같은 참조, trial=false면 전부 같은 참조). 정적 — `trial-guards.test.ts`에 `swipeOrderOf(isTrialMode())` 문자열 1줄 추가(기존 검사 무수정). qa Playwright 390 터치: `/?trial=1` → 성과 → 왼쪽 스와이프 → 해시 `#activity` 유지, 주소에 `#more`·`#settings` 입력 → 홈. 비체험 `/`에서 성과 → 왼쪽 스와이프 → `#more` 현행 확인(회귀).
- 사용자 영향: 체험 사용자는 더보기·설정(동기화·백업·삭제 등)에 닿지 않게 됨 — 지금도 실제 저장·서버 쓰기는 0(5.131 tech-review 8절)이라 데이터 차이 없음, 화면만 의도대로. 실사용자: 두 함수 모두 `trial=false`면 입력 그대로 → 경로 동일. `isTrialMode()`는 `trial-boot`의 `markTrialActive()` 뒤에만 true(되돌림 없음, `trial-mode.ts:7~18`).

## 2. (p3) 숨은 GA 제외 토글이 체험 중 ga-disable을 false로
- 원인: `src/app/(main)/_components/header-menu/settings-page.tsx:84~99` `handleGaOptoutTap`. 체험의 `localStorage`는 메모리이고 `ga-optout`만 원본에서 복사된다(`trial-boot.ts:21` `COPY_KEYS`). 그래서 `ga-optout=1` 기기(팀·대표·C141 스모크)에서 7회 탭하면 `on=true` 분기 → `window['ga-disable-…'] = false` → 루트 인라인(`layout.tsx:156`)의 체험 차단을 덮어써 gtag 자동 측정이 체험 페이지에서 나갈 수 있다(앱 `track`은 `ga.ts` 가드로 계속 no-op). 원본 저장소의 `ga-optout`은 메모리라 안 바뀜.
- 최소 수정: `handleGaOptoutTap` 첫 줄 `if (isTrialMode()) return;`(`isTrialMode`는 이미 import, `:49`). 숨은 기능이라 토스트 없이 무시. 1번 적용 뒤에는 체험에서 설정 도달 자체가 0 → 이건 2중 방어.
- 금지 영역: `ga.ts`·`layout.tsx` 무변경 → **risk:low**. 단 GA 동작 관련이라 ⑤(보안·데이터 문구)는 비해당(문구 0).
- 테스트: 정적 1줄(`trial-guards.test.ts`에 `if (isTrialMode()) return;`이 `handleGaOptoutTap` 본문에 있는지 — 함수 블록 잘라 검사). 렌더 테스트는 7회 탭 상태 때문에 과함.
- 사용자 영향: 체험·실사용자 자산 데이터 무관. 실사용자는 `isTrialMode()=false` → 현행 토글 그대로.

## 3. (p3) `/api/push/*`가 `TRIAL_BLOCKED_PATHS`에 없음
- 원인: `src/lib/trial/trial-mode.ts:30` 목록 4개. push 라우트 3종(`/api/push/subscribe` POST·DELETE, `/api/push/test`, cron은 서버 전용). 클라이언트 `src/lib/push/client.ts:65~67` `postJson`이 전역 `fetch`(체험 시 래퍼)를 쓰므로 목록에 넣으면 합성 403으로 막힌다. 현재는 화면 가드(`NotifySection` null·`PushHost` 가드·설정 삭제 `:139`)로 도달 0.
- 최소 수정: 목록에 `"/api/push"` 1개 추가(하위 전부 거부, `/api/pushx`는 통과 — 판정 로직 `trial-boot.ts:113` 그대로).
- 금지 영역: **`trial-boot.ts` 파일은 무변경이나, 그 fetch 래퍼가 읽는 상수를 바꾸므로 체험 게이트 동작이 달라진다**(더 막는 쪽, fail-closed 방향). 11/19 CEO 조건 '`trial-boot.ts`·`TrialGate` 수정 시 high'는 파일 기준이라 문자상 비해당 → **risk:medium 제안**(CEO 승인 대상, 금지 영역 인접 명시). CEO가 '게이트 동작 변경 = high'로 해석하면 이 1건만 빼서 별도로(나머지 low 묶음 유지).
- 테스트: `trial-boot.test.ts:90` 거부 목록 `it.each`에 `/api/push/subscribe`·`/api/push/test` 추가, 통과 목록에 `/api/pushx` 추가(기존 케이스 삭제 0).
- 사용자 영향: 래퍼는 체험 탭에만 설치(`createTrialFetch`) → 실사용자 알림 구독·해제·테스트 무영향. 서버로 나가는 값은 줄기만 함.

## 4. (p3) 320 `현금성 / 자산으로` 줄 나뉨
- 원인: `src/app/(main)/_components/layout/onboarding/welcome-guide.tsx:441` `WELCOME_PICK_COPY.cash.desc` 일반 공백. 체험 종료 후 현금 화면에서 복귀한 웰컴에서만 보임(`:465` `pick`일 때).
- 최소 수정: `"방금 본 화면이 내 현금성 자산으로 채워져요."`(5.132 c40e461 새 소식과 같은 U+00A0 방식, design-system 신규 규약 0). 기대 320: `방금 본 화면이 내 / 현금성 자산으로 채워져요.`(줄 수 현행과 같음).
- 금지 영역: 닿지 않음 → **risk:low**. 체험 아닌 웰컴은 `pick` 없음 → `welcome-non-trial-snapshot` 스냅샷 diff 0(그대로 통과해야 함, 갱신 금지).
- 테스트: `welcome-trial-return.test.tsx:29` 기대 문자열 ` `로 갱신, `:38` `toContain(desc)`는 상수 참조라 자동. ui-review가 320·375에서 복귀 웰컴(현금) 실제 렌더 캡처(C25·C113).
- 사용자 영향: 문구 공백 1자. 저장·전송 0.

## 5. 묶음 권고
- **4건 한 묶음**: 모두 '체험 경계 정리', 합계 S, 서로 파일 겹침 0, 실사용자 경로 무변경. 따로 내면 릴리스 4번의 qa·스모크 비용만 늘어난다.
- 위험 등급: 3번 포함 시 **medium(CEO 승인)**, 3번 제외 시 **low(위임 머지)**. 3번이 high로 판정되면 3번만 분리.
- 브랜치: 열린 릴리스 규칙상 새 버전 금지 → **qa 전인 `issue-5.132`에 추가** 권고. `issue-5.131`은 qa PASS가 나 있어 추가 시 재검증 필요(비권고). 단 5.132 머지가 12/11까지 막히면 1번(p2)만 늦어지므로, 11/25 조기 해제 판정이 '불가'로 나면 5.131·5.132 머지 뒤 단독 정리 릴리스로 옮기는 것을 오케스트레이터가 재판정.
- 4번은 `WELCOME_PICK_COPY`가 5.131에서 생긴 상수라 5.131 이전 브랜치에는 얹을 수 없다(5.132는 위에 쌓여 있어 문제없음).
- 줄이는 순서(필요 시): ③ 제외(화면 가드로 도달 0이라 실익 가장 작음) → ② 제외(1번 적용 뒤 도달 0). ①은 줄이지 않는다(해시 가드 빼면 주소 입력으로 여전히 도달).
