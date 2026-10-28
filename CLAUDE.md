---
description:
alwaysApply: true
---

# CLAUDE.md

# 규칙

- **응답은 반드시 한국어로만 작성한다(최우선, 예외 없음). 일본어·중국어는 절대 사용하지 않는다.** 코드 주석·커밋 메시지·문서·진행 상황 설명 전부 포함. 최대한 간결하게
- 진행 과정 설명 최소화, 결과만 출력
- 코드 주석·커밋 메시지도 한국어
- **요청한 사항만 정확히 적용. 요청하지 않은 추가 변경 절대 금지**
- **재사용 우선 · 작업 최소화 (강제)**:
  - **기존 구현 방식이 이후 모든 작업의 기본 방향.** 신규 라이브러리·상태관리 방식·색/간격/컴포넌트 패턴·데이터 접근 방식을 새로 도입하기 전, 기존 방식으로 가능한지 먼저 확인. 불가피할 때만 근거를 남기고 도입.
  - **신규·수정 구현 전 재사용 지도를 반드시 먼저 검색**(중복 코드 작성 금지): UI→`components.md`·`design-system.md`, 유틸·Context·Store→`state-and-utils.md`, 코드 패턴·주의→`dev-rules.md`, 현행 사양→`qa-full-test-plan.md` `F-*`. 동일 역할이 있으면 재사용, 없을 때만 신규.
  - **재사용 가능한 신규 공용 코드(컴포넌트·유틸·패턴·토큰)는 반드시 해당 카탈로그에 등록**(components.md / state-and-utils.md / design-system.md) — 단, 등록 시점은 매 작업 직후가 아니라 아래 **"KB 문서 갱신은 배치로"** 규칙을 따른다. 등록 누락 상태로 최종 push하는 것만 금지.
  - 상세 절차는 [`dev-rules.md`](.claude/_knowledge/dev-rules.md)의 **"재사용 우선 체크리스트"**를 단일 출처로 따른다. (src 신규 파일 생성 시 `.claude/hooks/reuse-reminder.mjs` 훅이 상기시킴)
- **KB 문서 갱신은 배치로 — 작업마다 하지 않는다 (토큰 낭비 방지, 강제)**:
  - 자잘한 수정·기능 작업을 진행하는 동안에는 `qa-full-test-plan.md`/`components.md`/`state-and-utils.md`/`design-system.md`/`changelog.md`를 **매번 갱신하지 않는다.** 코드 변경만 하고 다음 작업으로 넘어간다.
  - **사용자가 최종 push를 요청하면**, push 실행 전 반드시 이 순서를 거친다: ① `/qa-full-test` 실행(그 세션에서 누적된 변경 전체 대상) → ② Phase 4 결과로 위 KB 문서를 **한 번에 일괄** 갱신(드리프트 탐지·신규 공용 자산 카탈로그 등록·changelog 반영 포함) → ③ 커밋·푸시.
  - 예외: 사용자가 특정 작업에서 "지금 바로 문서화해줘" 등으로 즉시 갱신을 명시적으로 요청하면 그 요청을 따른다.
- **계획 md 파일(`C:/Users/궁빈/.claude/plans/*.md`)은 완료된 작업은 모두 제거하고 신규 작업 계획만 유지한다.**
- **라이브 프리뷰 및 동작 검증 제외** (preview_start·browser eval 등으로 앱을 띄워 확인하는 절차 생략. 타입 체크·코드 변경 결과 보고로 마무리)
- **확인·제출 버튼은 `Button variant="brand"`(= `--brand`/`MAIN_PALETTE[0]`), 체크박스는 기본 `Checkbox`(자동 brand)로 색상 통일. 매수=빨강/매도=파랑, 삭제=destructive 등 의미색만 예외.**
- **모든 UI/디자인 작업은 [`.claude/_knowledge/design-system.md`](.claude/_knowledge/design-system.md)를 단일 출처(source of truth)로 준수한다.** 색 토큰(블랙 배경/화이트 전경·순자산=주황 `important`/액션=brand 인디고·손익 빨강/파랑)·간격(4px 그리드, 섹션 gap-5·카드 gap-3)·동심 radius·테두리보다 그림자 우선·컴포넌트 규약·모션 폴리시·접근성을 모두 이 문서에 맞춘다. 신규 색·간격·컴포넌트 패턴을 만들기 전에 design-system.md에 흡수 가능한지 먼저 확인하고, 문서에 없는 새 규약이 생기면 design-system.md에 반영한다.
- **[`.claude/specs/README.md`](.claude/specs/README.md)의 판정 체크리스트(스키마·저장 키·공유 토큰·동기화·마이그레이션·새 자산 타입·새 API·2개 이상 화면의 새 기능)에 하나라도 해당하면 구현 전 `/spec`으로 명세를 먼저 작성한다. 해당 없으면 명세 없이 진행한다. 판정 축은 "새 데이터·기능이 생기는가"이며 **변경 파일 수는 기준이 아니다**(리팩토링·규칙 통일은 규모와 무관하게 제외).**
- **UI 디테일 폴리시 체크리스트(design-system.md §6)를 기본 적용한다.** 동심 radius·광학 정렬·shadow 우선·인터럽터블 전환·split/stagger 진입·subtle exit·tabular-nums·text-balance/pretty·이미지 outline·press scale(0.96)·`transition: all` 금지·`will-change` 절제·최소 히트영역 40×40px. (framer-motion 미사용 → CSS 전환 + `tw-animate-css`, `motion-safe`로 reduced-motion 대응)

# KB (.claude/\_knowledge/)

세션 시작 시 작업 유형에 맞는 KB만 읽고 시작한다.

| 작업 유형     | KB 파일                                          |
| ------------- | ------------------------------------------------ |
| 공통 (필수)   | `architecture.md`                                |
| UI 컴포넌트   | + `components.md` + `design-system.md` |
| 페이지·화면 UI | + `design-system.md` |
| 타입·스키마   | + `types-and-schemas.md`                         |
| API·캐시·공유 | + `api-reference.md`                             |
| 스크린샷      | + `api-reference.md` + `components.md`           |
| Context·유틸  | + `state-and-utils.md`                           |
| 새 기능·패턴  | + `dev-rules.md` + `design-system.md` + [`specs/README.md`](.claude/specs/README.md) |
| 구독·자산 단위 | + `asset-and-subscription.md`                    |
| 최근 변경     | + `changelog.md`                                 |
| 진행 중 기능  | + [`specs/{번호}-*.md`](.claude/specs/)          |

> **UI/화면 작업 시 `design-system.md`를 단일 출처로 준수한다 — 색·간격·반경·고도·컴포넌트 규약(§1~§5)·모션/디테일 폴리시(§6)·접근성(§7)·정보 설계 휴리스틱(§11).**

> **문서 계층**: `CLAUDE.md`(규칙) · `_knowledge/`(현재 코드가 어떤가) · [`specs/`](.claude/specs/)(이번에 무엇을 왜 만드나) · `skills/`(어떻게 작업하나). 기존 기능의 현행 사양은 `qa-full-test-plan.md`의 `F-*`가 담당하며 specs로 복제하지 않는다.

# 에이전트 팀 운영 (시크릿에셋)

이 저장소는 5인 AI 에이전트 팀이 클라우드 예약 작업으로도 운영한다. 모든 세션은 기억 없이 새로 시작하므로,
**팀의 기억은 `memory` 브랜치에 있고, 매 예약 실행은 그것을 읽고 시작해서 그것을 갱신하고 끝난다.**
위 "# 규칙"·"# KB"는 에이전트에게도 그대로 적용된다. 아래 "8. 기존 규칙과의 관계"만 예외.

## 1. 실행 시작 시 반드시 읽을 것 (순서대로)
1. 팀 메모리 (`memory` 브랜치, `.memory/` 로 체크아웃)
   ```bash
   git fetch origin memory
   git worktree add -B memory .memory origin/memory 2>/dev/null || git -C .memory pull origin memory
   ```
   - `.memory/STATE.md` 현재 상태
   - `.memory/DECISIONS.md` 확정된 결정 — **이와 다른 방향 제안 금지**
   - `.memory/LEARNINGS.md` 대표의 반려 사유 — **같은 제안 반복 금지**
   - `.memory/HISTORY.md` 지금까지의 흐름
2. `docs/product/PRINCIPLES.md` 제품 원칙
3. `docs/ops/WORKFLOW.md` 단계·라벨·산출물 규칙
4. 작업 중인 이슈 폴더 `.memory/issues/<버전>-<GitHub 이슈번호>-<slug>/` (파일명도 `<버전>-<문서>.md`, 9장)

## 2. 실행 끝에 반드시 할 것
`.memory/` 를 갱신하고 `memory` 브랜치에 push한다 (규칙: `.memory/README.md`).
```bash
git -C .memory add -A && git -C .memory commit -m "memory: <요약>" && git -C .memory push origin memory
```
메모리 갱신 없이 끝난 실행은 실패한 실행이다.

## 3. 팀 구성 (`.claude/agents/`)
| 에이전트 | 역할 |
|---|---|
| `planner-designer` | 서비스 기획·정보 구조·사용자 흐름 (사업 PM과 기획 방향 공동 정의) |
| `ui-designer` | UI/UX 비주얼·인터랙션 사양(ui.md), 구현 UI 검수(ui-review.md) — developer와 역할 분리 |
| `business-pm` | 초기 사업 확장, 지표, 마케팅 (기획 디자이너와 기획 방향 공동 정의) |
| `developer` | 프론트엔드·백엔드 구현, preview 배포 확인 |
| `qa` | 모든 결과물의 품질 검증 |
| `cto` | 대표 결정을 위한 판정 보고서 작성, 위험 등급 판정. **최종 결정권 없음** |

에이전트 이름이 subagent_type으로 등록되지 않은 세션이면 `general-purpose` 에이전트에 해당 `.claude/agents/<이름>.md` 본문(frontmatter 제외)과 frontmatter의 model을 넘겨 호출한다.

**대표(사람, GitHub `BBplayworld`, 레벨 1)의 결정은 마지막 한 번: "이 개선을 라이브에 반영할지"** — PR 머지 = 반영, PR 닫기 = 미반영.
기획·사업 검토, 개발, QA(preview 실제 점검 포함)는 팀이 끝까지 해낸다. **대표에게 QA·화면 확인·중간 판단을 요청하지 않는다.** `needs-human`은 제품 원칙 변경이 필요할 때만.
과제는 신규뿐 아니라 개선·버그·통합·축소·제거·정리를 모두 포함하며, 같은 기여도면 줄이기·고치기를 우선한다.

## 4. 절대 규칙
- **사용자 자산 데이터(보유수량, 매입단가, 평가금액, 잔액, 부채)는 서버로 보내지 않는다.** 서버는 시세 조회와 E2EE 동기화 중계만 한다.
- 투자 조언 문구 금지.
- 마케팅 문구에 구체적 금액 금지. 브랜드는 "안전한 자산 관리, 시크릿에셋".
- 로컬 저장소 스키마를 바꾸면 마이그레이션 코드 + "이전 버전 데이터 → 새 버전" 복원 테스트 필수. 자동으로 `risk:high`.
- `main` 직접 push 금지, PR 머지 금지 (머지는 대표만).
- 비밀값을 파일·이슈·커밋·로그·메모리에 쓰지 않는다.
- 외부 채널 실제 게시 금지. 마케팅은 초안까지.
- 제품 원칙(PRINCIPLES.md)을 바꿔야만 진행 가능하면 `status:needs-human` + 이유. 그 밖의 불확실성은 cto 판정으로 팀 안에서 해결.

## 5. 브랜치·버전과 Vercel preview
- **버전 = 브랜치 = 서비스 표시 버전 = 릴리스 1건.** 버전은 작업마다가 아니라 **묶음(릴리스) 단위**로만 올린다. 브랜치 **`issue-4.NN`** 하나에 관련 GitHub 이슈 여러 개를 함께 담는다 (기존 관행: 4.29에 여러 기능 포함).
  - **열린 릴리스는 항상 1개.** 머지되지 않은 `issue-4.NN`이 있으면 development에 들어가는 모든 이슈(같은 흐름의 기능·개선·버그·정리)는 **그 브랜치·그 PR에 추가**한다. 새 버전을 만들지 않는다.
  - 새 버전 배정은 열린 릴리스가 없을 때만: developer가 기존 브랜치·`.claude/specs/`·커밋의 가장 큰 4.NN + 0.01로 배정
  - QA 수정, 교차 검토 반영, 작은 후속 변경은 전부 같은 브랜치에 push (새 브랜치·새 버전 금지)
  - 매핑 기록: GitHub 이슈 제목 앞 `[4.NN]`, `.memory/STATE.md` "열린 릴리스" 절과 DECISIONS에 `4.NN = #a, #b…`
  - 릴리스 PR은 1개: 본문에 포함 이슈마다 `Closes #<번호>`. 반영 결정(owner-review)도 릴리스 단위 1회 — 포함된 모든 이슈가 qa PASS일 때
  - 예외: 운영 이상 긴급 수정은 열린 릴리스가 있으면 거기에 추가, 없을 때만 다음 버전
- Vercel이 브랜치 push마다 preview를 배포한다. 같은 브랜치는 고정 URL을 가진다 (**브랜치명의 점(.)은 빠진다**):
  `https://secretasset-git-issue-4NN-bbplayworlds-projects.vercel.app` (예: `issue-4.34` → `issue-434`)
- 최신 배포 상태는 GitHub MCP로 PR의 커밋 상태·체크(`pull_request_read` / `get_commit`)에서 Vercel 항목의 URL을 확인한다.
- preview 환경에서는 실제 동기화 쓰기가 꺼져 있고 데모 데이터로 확인한다 (시드0 이슈에서 구현).
- 운영 배포는 Vercel이 `main` 머지 시 자동으로 한다. 에이전트는 배포 명령을 실행하지 않는다.
- `memory` 브랜치는 Vercel 빌드 제외 (`vercel.json`).

## 6. 기술 정보
- 프론트엔드: Next.js(App Router, turbopack) + TypeScript + Tailwind / 백엔드(시세·동기화): Next.js API 라우트 (`src/app/api/`)
- 설치 `npm ci` · 테스트 `npx vitest run` · 린트 `npm run lint` · 빌드 `npm run build` · 타입 `npx tsc --noEmit`
- GitHub 조작(이슈·라벨·코멘트·PR)은 `gh` CLI 대신 **GitHub MCP 도구(`mcp__github__*`)** 를 쓴다. 저장소: `BBplayworld/vaultfolio`. MCP를 쓸 수 없으면 **git CLI 전용 모드**(`docs/ops/ORCHESTRATOR.md` "GitHub 접근 방식")로 진행한다.
- **품질 최종 사인·결함 확정은 qa만** 한다. qa는 매번 `.memory/CHECKLIST.md`(누적 최종 점검 항목) 전체와 **데이터 안전 점검**(사용자 자산 데이터·기록의 하위호환·구버전 혼재·롤백)을 수행한다. 대표 지적·qa FAIL·결함은 cto 회고로 CHECKLIST에 추가해 같은 실수를 반복하지 않는다. 대표 알림은 새 과제 방향 확정(기획+사업 합의 완료)·owner-review 진입 때만 (`ORCHESTRATOR.md` "대표 알림"). 운영 이상은 즉시 버그 수정 빠른 경로로 착수.
- 수동 실행: 어느 세션에서든 `/secretasset-run` (정기 실행 1회, `weekly` 인자 시 주간 기획).

## 7. 커밋·PR·소통
- 커밋: `[#4.NN] <무엇을 왜>` (기존 관행), 릴리스 PR 본문에 포함 이슈별 `Closes #<GitHub 이슈번호>`
- 모든 산출물 한국어, 문서는 1~2쪽 이내
- 단계 완료 시 이슈 코멘트 1개: `[역할] 결과 / 산출물 경로 / 다음 단계`

## 8. 기존 규칙과의 관계 (에이전트 실행에만 적용)
- "라이브 프리뷰 및 동작 검증 제외" → 에이전트는 로컬 앱 실행 대신 **Vercel preview URL**로 확인한다.
- "구현 전 `/spec`" → 에이전트 이슈는 이슈 폴더의 `spec.md`가 명세를 대신한다. `.claude/specs/`에 중복 작성하지 않는다.
- "KB 문서 갱신은 배치로" → developer가 PR을 qa로 넘기기 직전 1회, 변경분을 KB(`components.md`·`state-and-utils.md`·`design-system.md`·`changelog.md`·`qa-full-test-plan.md`)에 일괄 반영해 같은 PR에 포함한다. qa는 `qa-full-test-plan.md`의 관련 `F-*` 항목을 회귀 검사에 사용한다.
- 계획 md(`C:/Users/...plans`) 규칙은 대표 로컬 작업 전용, 에이전트와 무관.

## 9. 이슈별 문서 파일명 — 버전 표기
- **이슈 단위로 생성되는 문서는 폴더·파일명 모두 버전을 앞에 붙인다.** 공통 문서(CLAUDE.md, docs/ops·product, 에이전트 정의, memory의 STATE·DECISIONS 등)는 공통 이름 유지.
- memory 이슈 폴더: `.memory/issues/<버전>-<GitHub 이슈번호>-<slug>/`, 파일: `<버전>-direction.md`, `<버전>-challenge.md`, `<버전>-spec.md`, `<버전>-business.md`, `<버전>-tech-review.md`, `<버전>-ui.md`, `<버전>-ui-review.md`, `<버전>-dev-notes.md`, `<버전>-qa-report.md`, `<버전>-decision-brief.md`, `<버전>-log.md` (스크린샷 폴더는 `screenshots/`)
- 시드·이슈 본문: `docs/seed-issues/<버전>-<순번>-<slug>.md`
- 버전 미배정(planning~design-review) 동안은 `4.xx`로 쓰고, development 진입 시 버전이 정해지면 developer가 폴더·파일명을 `git mv`로 `4.NN`으로 바꾸고 STATE·DECISIONS 경로도 갱신한다.
