# 이슈 워크플로우

모든 일은 GitHub 이슈 1개 단위. 현재 단계는 `status:*` 라벨 하나로만 표시한다.
산출물은 `docs/issues/<번호>-<slug>/`, 팀 기억은 `memory` 브랜치.

## 1. 단계 흐름

```
status:idea
  → status:planning
       ① 방향 정의   planner-designer + business-pm 공동 → direction.md (두 사람 합의 필수)
       ② 상세 기획   planner-designer → spec.md / business-pm → business.md
  → status:design-review   developer → tech-review.md / planner-designer → ui.md
  → status:development     developer → PR (브랜치 issue-<번호>) → Vercel preview
  → status:qa              qa → qa-report.md (preview URL 포함 검증)
  → status:owner-review    cto → decision-brief.md (권고 + preview URL) → 대표 결정
  → status:done            대표가 PR 머지 → Vercel 운영 자동 배포
```
분기: `status:needs-human`, `status:rejected`, `status:on-hold`

마케팅 이슈(`type:marketing`): `idea → planning(① 공동 방향 → ② business-pm 초안) → qa → owner-review → done`.
게시는 대표가 직접 한다.

## 2. 기획 ① 방향 정의 (공동)
에이전트끼리 직접 대화할 수 없으므로 오케스트레이터가 차례로 중재한다.
1. `business-pm`: direction.md 초안의 "사업" 절 작성 (왜 지금, 누구를 위해, 무엇이 달라져야 성공인가)
2. `planner-designer`: 같은 문서에 "경험" 절 작성 (사용자 행동, 범위, 하지 않을 것) + 사업 절에 대한 의견
3. `business-pm`: 의견 반영 후 "합의" 절 작성 → 두 에이전트 모두 `합의함` 표기 시 완료
4. 2회 왕복 후에도 합의가 안 되면 쟁점을 정리해 `status:needs-human`

direction.md가 합의되기 전에는 spec.md·business.md를 쓰지 않는다.

## 3. 단계별 담당·검증·산출물

| 단계 | 담당 | 검증 | 산출물 | 다음 단계 조건 |
|---|---|---|---|---|
| planning ① | planner-designer + business-pm | 상호 합의 | `direction.md` | 둘 다 `합의함` |
| planning ② | planner-designer, business-pm | 교차 검토 | `spec.md`, `business.md` | 상호 `승인` 코멘트 |
| design-review | developer, planner-designer | 교차 검토 | `tech-review.md`, `ui.md` | 위험 등급 초안 + 범위 확정 |
| development | developer | qa | PR, `dev-notes.md`, preview URL | CI 통과 + preview 배포 성공 |
| qa | qa | — | `qa-report.md` | PASS |
| owner-review | cto | — | `decision-brief.md` | 대표가 머지/닫기/수정 요청 |

## 4. 대표 결정 읽기 (매 실행 시작 시)
| 대표 행동 | 의미 | 오케스트레이터 처리 |
|---|---|---|
| PR 머지 | 승인 | `status:done`, DECISIONS·HISTORY 기록 |
| PR 닫기 (머지 없음) | 반려 | `status:rejected`, 닫으며 남긴 코멘트를 LEARNINGS 기록 |
| 이슈에 `수정:` 으로 시작하는 코멘트 | 수정 요청 | 내용을 DECISIONS 기록, cto가 되돌릴 단계 판단(보통 development 또는 planning) |
| 이슈에 `결정:` 으로 시작하는 코멘트 | needs-human 해소 | DECISIONS 기록, 원래 단계로 복귀 |

## 5. 되돌림 규칙
- QA FAIL → `status:development`. 같은 이슈 FAIL 2회 누적 시 `status:needs-human`.
- 교차 검토 2회 연속 불합의 → cto가 정리, 그래도 안 되면 `status:needs-human`.

## 6. 위험 등급 (cto가 판정, 대표 판단용 정보)
| 등급 | 해당 변경 |
|---|---|
| `risk:low` | 문구, 스타일, 레이아웃. 데이터 로직 변경 없음 |
| `risk:medium` | 새 화면·컴포넌트, 읽기 전용 계산 로직 |
| `risk:high` | 로컬 저장소 스키마, 동기화·암호화, 금액 계산 규칙, 의존성 메이저 업그레이드, 서버 API |
애매하면 높은 쪽.

## 7. 진행 제한
- 한 번의 정기 실행에서 단계를 전진시키는 이슈 **최대 2건**
- `status:development` 동시 **최대 1건**
- `status:owner-review` 가 **3건 이상 쌓이면** 새 개발을 시작하지 않는다 (대표 결정이 병목이면 만들어도 소용없음)
- 새 idea는 주간 기획 실행에서만, 주 1건 이하

## 8. 우선순위
`priority:p0` > `p1` > `p2`, 같으면 오래된 것부터. `#0 preview 안전장치`가 끝나기 전에는 다른 이슈를 development로 넘기지 않는다.

## 9. 코멘트 형식
```
[역할] <단계> 완료
- 결과: <한두 줄>
- 산출물: docs/issues/<번호>-<slug>/<파일>
- preview: <URL, 해당 시>
- 다음: <다음 단계 / 담당>
```
