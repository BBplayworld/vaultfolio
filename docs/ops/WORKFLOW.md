# 이슈 워크플로우

모든 일은 GitHub 이슈 1개 단위. 현재 단계는 `status:*` 라벨 하나로만 표시한다.
산출물은 `memory` 브랜치의 `.memory/issues/<GitHub 이슈번호>-<slug>/` (기획부터 결정까지 한 폴더, 코드 PR과 분리), 팀 기억도 `memory` 브랜치.
GitHub 조작은 GitHub MCP 도구(`mcp__github__*`)로 한다.

**대표(레벨 1)의 결정은 마지막 한 번뿐이다: "이 개선을 라이브에 반영할지" (PR 머지 / 닫기).**
그 전의 기획·사업 검토, 개발, QA, preview 확인은 전부 팀이 끝낸다. 대표에게 QA·화면 확인을 넘기지 않는다.

**품질 최종 사인은 qa만 한다.** 결함(버그) 판정·재현·확정도 qa의 일이다. 다른 역할이 코드를 읽다 결함을 의심하면 직접 확정하지 않고 `결함 의심: <파일·조건>`으로 기록해 qa에 넘긴다. qa가 재현(테스트·preview)으로 확정한 것만 결함으로 다루고, qa PASS 없이는 owner-review로 갈 수 없다.

## 1. 단계 흐름

```
status:idea          (주간 기획 후보 — cto 반대 검토 통과 시 자동으로 planning)
  → status:planning
       ① 방향 정의   planner-designer + business-pm 공동 → direction.md (두 사람 합의)
       ② 반대 검토   cto → challenge.md (통과 / 축소 / 폐기)
       ③ 상세 기획   planner-designer → spec.md / business-pm → business.md (교차 승인)
  → status:design-review   developer → tech-review.md / planner-designer → ui.md
  → status:development     developer → 버전 4.NN 배정 → PR (브랜치 issue-4.NN) → Vercel preview
  → status:qa              qa → qa-report.md (자동 테스트 + preview 실제 점검 + 스크린샷)
       FAIL → development 자동 복귀, 최대 3회 → 이후 cto가 축소/폐기 판정
  → status:owner-review    cto → decision-brief.md → 대표가 머지(반영) / 닫기(미반영)
  → status:done            Vercel 운영 자동 배포
```
분기: `status:rejected`(폐기·미반영), `status:on-hold`, `status:needs-human`(**제품 원칙 변경이 필요한 경우에만**)

마케팅 이슈(`type:marketing`): `planning(① 공동 방향 → business-pm 초안) → qa → owner-review → done`. 게시는 대표가 직접 한다.

## 2. 기획 — 치열한 검토
에이전트끼리 직접 대화할 수 없으므로 오케스트레이터가 차례로 중재한다.

### ① 방향 정의 (공동)
1. `business-pm`: direction.md "사업" 절 (왜 지금, 누구를 위해, 성공 지표, **하지 않으면 무엇을 잃나**)
2. `planner-designer`: "경험" 절 (사용자 행동, 범위, **줄일 수 있는 것·하지 않을 것**, 현재 코드 기준 바뀌는 화면) + 사업 절에 `동의` / `이견`
3. `business-pm`: "합의" 절 → 두 에이전트 모두 `합의함` 표기 시 완료
4. 2회 왕복 후에도 불합의 → cto가 쟁점을 판정해 정리 (대표에게 넘기지 않음)

### ② cto 반대 검토 → challenge.md
- 꼭 해야 하는가 / 더 작게 할 수 있는가 / 빼거나 합치는 쪽이 낫지 않은가 / LEARNINGS의 반려 방향과 겹치지 않는가 / 목표(월 활성 사용자 100명) 기여 근거가 있는가
- 판정: `통과` / `축소: <줄일 범위>`(① 합의 절 수정 후 재검토 1회) / `폐기: <이유>`(→ `status:rejected`, LEARNINGS 기록)

### ③ 상세 기획
challenge.md `통과` 후에만 spec.md·business.md를 쓴다. 상호 `승인` 코멘트로 완료.

## 3. 단계별 담당·검증·산출물

| 단계 | 담당 | 검증 | 산출물 | 다음 단계 조건 |
|---|---|---|---|---|
| planning ① | planner-designer + business-pm | 상호 합의 | `direction.md` | 둘 다 `합의함` |
| planning ② | cto | — | `challenge.md` | `통과` |
| planning ③ | planner-designer, business-pm | 교차 검토 | `spec.md`, `business.md` | 상호 `승인` |
| design-review | developer, planner-designer | 교차 검토 | `tech-review.md`, `ui.md` | 위험 등급 초안 + 범위 확정 |
| development | developer | qa | PR, `dev-notes.md`, preview URL | CI 통과 + preview 배포 성공 |
| qa | qa | — | `qa-report.md`, `screenshots/` | PASS |
| owner-review | cto | — | `decision-brief.md` | 대표가 머지/닫기 |

## 4. 대표 결정 읽기 (매 실행 시작 시)
| 대표 행동 | 의미 | 오케스트레이터 처리 |
|---|---|---|
| PR 머지 | 반영 | `status:done`, DECISIONS·HISTORY 기록 |
| PR 닫기 (머지 없음) | 미반영 | `status:rejected`, 닫으며 남긴 코멘트를 LEARNINGS 기록 |
| 이슈에 `수정:` 코멘트 (선택) | 방향 지시 | DECISIONS 기록, cto가 되돌릴 단계 판단 |
| 이슈에 `결정:` 코멘트 | needs-human 해소 | DECISIONS 기록, 원래 단계로 복귀 |
| 대표가 직접 이슈 생성 | 새 과제 투입 | `status:planning` 으로 바로 시작 |

## 5. 되돌림 규칙 (팀 안에서 해결)
- QA FAIL → `status:development` 자동 복귀. **같은 이슈 FAIL 3회 누적** 시 cto가 `축소`(범위 줄여 재개발) 또는 `폐기` 판정.
- 교차 검토 2회 연속 불합의 → cto 판정.
- preview 배포 실패 → developer가 로그를 읽고 고쳐 다시 push.
- `needs-human`은 PRINCIPLES.md를 바꿔야만 진행 가능한 경우에만.

## 6. 위험 등급 (cto 판정, 대표 판단용 정보)
| 등급 | 해당 변경 |
|---|---|
| `risk:low` | 문구, 스타일, 레이아웃. 데이터 로직 변경 없음 |
| `risk:medium` | 새 화면·컴포넌트, 읽기 전용 계산 로직 |
| `risk:high` | 로컬 저장소 스키마, 동기화·암호화, 금액 계산 규칙, 의존성 메이저 업그레이드, 서버 API |
애매하면 높은 쪽.

## 7. 진행 제한
- 한 번의 정기 실행에서 단계를 전진시키는 이슈 **최대 2건**
- `status:development` 동시 **최대 1건**
- `status:owner-review` 가 **3건 이상 쌓이면** 새 개발을 시작하지 않는다
- 새 과제(idea → planning)는 주간 기획 실행에서만, 주 1건 이하

## 8. 우선순위
`priority:p0` > `p1` > `p2`, 같으면 오래된 것부터. 시드0(preview 안전장치·데모 데이터)이 끝나기 전에는 다른 이슈를 development로 넘기지 않는다 (QA 자동 점검의 전제).

## 9. 과제 유형 — 늘리기만이 아니다
| 라벨 | 의미 |
|---|---|
| `type:feature` | 신규 기능 |
| `type:improvement` | 기존 기능 개선 |
| `type:bug` | 버그 수정 |
| `type:simplify` | 통합·축소·제거·정리 (화면·메뉴·코드) |
| `type:marketing` | 마케팅 초안 |
같은 기여도면 늘리기보다 **줄이기·합치기·고치기**를 우선한다.

## 10. 코멘트 형식
```
[역할] <단계> 완료
- 결과: <한두 줄>
- 산출물: memory 브랜치 issues/<번호>-<slug>/<파일>
- preview: <URL, 해당 시>
- 다음: <다음 단계 / 담당>
```
