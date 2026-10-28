
## 코드 QA (4.34)
대상: `issue-4.34` @73b80e9 (PR 미생성, git CLI 모드). 판정: **PASS**

### 1. 자동 검사
| 항목 | 결과 |
|---|---|
| `npx vitest run` | 19파일 269건 통과 (preview-safety 28건 포함) |
| `npx tsc --noEmit` | 오류 0 |
| `npm run build` | 성공 |
| `npm run lint` | `src`·`next.config.mjs` 오류 0 (경고 17, 신규는 테스트 fs 경고). 전체 실행 시 error 1건은 worktree로 들어온 `.memory/qa/preview-check.mjs`의 parserOptions 파싱 오류 — 브랜치 코드 아님, main 체크아웃에는 `.memory` 없음 |

### 2. spec 완료 기준 (1~17)
- 1~9 vitest PASS: `src/lib/__tests__/preview-safety.test.ts` 28건 전체 통과(isPreviewEnv 4값, isCloudSyncEnabled, push/pull/fetchRemoteVersion fetch 0건, production DOM 비어 있음·`?demo=1`에도 apply/clear 미호출, 스키마 parse, 유형·거래·월 스냅샷 4건·fx 상이, 티커 허용목록, 동적 import 전용). 소스 검색으로 `demo-data` 참조는 `preview-gate.tsx` 1곳(동적 import)뿐.
- 10 PASS `?demo=1` → demoReady·쿼리 제거·홈(자산 1,6,1,2,1) / 11 PASS 재접속 멱등 / 12 PASS `?demo=empty` 웰컴 / 13 PASS 첫 접속 버튼 2개 / 14 PASS 배지 `PREVIEW · v4.34`·`data-screenshot-hide`·h=20·헤더 버튼 비겹침 / 15 PASS `/api/sync` 0건(`#sync=abc` 포함, 독립 스크립트로도 4조합 0건) / 16 PASS 홈→성과 콘솔 오류 0·GA 0 / 17 PASS 무변경 (`preview-check.mjs` 9/9 PASS).

### 3. 결정과의 일치
- direction·challenge c1~c10과 일치: 서버·`/api/sync`·`WelcomeGuide`·`asset-storage`·`asset-data-context`·`cloud-sync-provider` 무변경(diff 12파일: next.config 1줄, config.ts·sync-client.ts 가드, layout.tsx 분기, preview 신규 3파일, 테스트, KB 4개). 스키마·저장 키 불변이라 마이그레이션 테스트 해당 없음.
- 배지 위치 `top-0` → 헤더 아래 `top-[3.25rem]`는 DECISIONS(2026-10-28)에 기록된 의도된 변경이며 완료 기준 14 충족을 위한 것. ui.md 문서와 차이가 있으나 결정 기록이 우선(범위 초과 아님).

### 4. 원칙 검사
- 자산 값 네트워크 전송: preview 코드(`src/lib/preview`, preview-gate)에 fetch/XHR/WebSocket 없음. sync-client의 `/api/sync` fetch 3곳 전부 입구 가드 뒤. PASS
- 투자 조언 문구: 없음(안내·버튼·실패 문구 확인). PASS
- 스키마 변경: 없음. PASS
- 공유 이미지: 배지·선택 카드 모두 `data-screenshot-hide`. PASS
- preview 동기화 쓰기 0건: 실측 `/api/sync` 0건 + vitest fetch 0건. PASS
- production 미동작: `isPreviewEnv()`가 `"preview"`만 true, 레이아웃 분기·`PreviewGate` 내부 가드 이중, vitest(기준 4)로 DOM·apply/clear 미호출 확인. production 배포 본문 확인은 불가(머지 전)이므로 테스트·로컬 빌드(VERCEL_ENV 미설정)로 보증.

### 5. 회귀 (F-CLOUD-SYNC·F-SYNC)
`isCloudSyncEnabled()`는 production·미설정에서 `NEXT_PUBLIC_CLOUD_SYNC`만으로 결정(기존과 동일, 테스트 확인), cloud-sync 관련 기존 테스트 전부 통과. preview에서만 연결·폴링·push가 꺼지는 것이 의도.

### 6. Preview 실제 점검
`https://secretasset-git-issue-434-bbplayworlds-projects.vercel.app` 응답 200. 375×812·1280×800 × 라이트·다크 × (데모 홈·빈 상태·`#sync` 해시) 캡처 + 선택 카드·성과 허브. 스크린샷: `screenshots/` (10-demo-home, 12-empty, 13-choice, 16-activity, q-{m,d}-{light,dark}-{home,empty,syncHash}).
- 가로 넘침 없음(scrollWidth=clientWidth, 4조합 모두), 배지 한 줄 113×20, 1280px 중앙 정렬, 선택 카드 버튼 한 줄·40px 이상.
- 콘솔: 앱 오류 0. 샌드박스 프록시의 외부 리소스 `ERR_TUNNEL_CONNECTION_FAILED` 1건은 환경 요인(앱 요청 아님).
- 앱이 다크 고정 테마라 라이트/다크 스크린샷이 동일(토큰만 사용, 위반 없음).
- 비고(비차단): 웰컴 화면에서 배지가 "시작하기" 칩과 제목 사이에 맞닿아 놓임(텍스트 가림 없음, pointer-events-none). 데모 첫 진입 시 튜토리얼 오버레이가 뜸(운영과 동일 동작).

### 7. 한계
- 1~3월 주입 시 전년 달 스냅샷 삭제는 #32 보존 수정 병합 후 유효(spec 명시). 이번 달 금액은 실시간 재계산이라 고정값 아님.
- PR·이슈 제목·라벨은 MCP 불가로 미반영(log.md 기록) — 코드 품질과 무관.

### 대표 요약
1. 무엇이 바뀌었나: preview 배포에서는 동기화 요청이 코드 수준에서 차단되고, `?demo=1`/`?demo=empty`와 `PREVIEW · v4.34` 배지로 사람 없이 화면을 점검할 수 있게 됨(운영 동작 불변).
2. 확인한 범위: 단위·타입·빌드·lint 통과, preview 375/1280px 데모·빈 상태·성과 화면 실측 — `/api/sync` 요청 0건, 콘솔·넘침 문제 없음.
3. 남은 한계: 1~3월 데모 전년 스냅샷 보존은 #32 의존, 이번 달 금액은 실시간 시세 기준.
