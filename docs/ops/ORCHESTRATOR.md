# 예약 실행 지시서 (오케스트레이터)

예약 작업 프롬프트에는 "docs/ops/ORCHESTRATOR.md 의 '<실행 종류>'를 수행하라"만 적는다.
모든 실행은 **0단계(메모리 읽기)로 시작하고 마지막 단계(메모리 저장)로 끝난다.** 예외 없음.

---

## 0단계 — 공통 준비 (모든 실행)
1. `git pull`, `CLAUDE.md` 1장 순서대로 읽기 (메모리 → 원칙 → 워크플로우)
2. 대표 결정 동기화 (WORKFLOW.md 4장)
   - `gh pr list --state all --search "updated:>=<STATE.md 마지막 갱신일>" --json number,state,mergedAt,closedAt,headRefName,comments`
   - `gh issue list --state open --json number,labels,comments` 에서 `수정:` / `결정:` 코멘트 찾기
   - 발견한 대표 결정은 즉시 `.memory/DECISIONS.md`(반려는 `LEARNINGS.md`)에 기록하고 라벨 처리

---

## A. 정기 실행 (하루 2회)
1. **0단계 수행**
2. **작업 큐**: 열린 이슈 중 `needs-human / on-hold / rejected / done / owner-review` 제외, 우선순위→오래된 순, WORKFLOW.md 7장 제한 적용해 최대 2건
3. **담당 호출** (Agent 도구, subagent_type = 에이전트 이름). 넘길 정보: 이슈 번호, 이슈 폴더, 이번 할 일, 완료 조건, **`.memory/STATE.md` 전문과 관련 DECISIONS·LEARNINGS 줄**
   | 상태 | 호출 |
   |---|---|
   | planning, direction.md 미합의 | WORKFLOW.md 2장 순서대로 `business-pm` → `planner-designer` → `business-pm` |
   | planning, direction.md 합의됨 | `planner-designer`(spec.md) + `business-pm`(business.md) 병렬 → 교차 검토 |
   | design-review | `developer`(tech-review.md) + `planner-designer`(ui.md) 병렬 → 교차 검토 |
   | development | `developer` (PR + preview URL 확인까지) |
   | qa | `qa` |
   | qa PASS 직후 | `cto` → decision-brief.md 작성 후 `status:owner-review` |
4. **단계 전환**: 완료 조건 충족 시에만 `gh issue edit` 로 라벨 변경. 미충족이면 막힌 이유 코멘트.
5. **owner-review 진입 시**: 이슈 코멘트에 `@{{OWNER_GITHUB_ID}}` 멘션 + preview URL + 권고 한 줄 (대표 알림 역할)
6. **마지막 단계 — 메모리 저장** (아래)

처리할 것이 없으면: 메모리 STATE.md의 "마지막 갱신"만 바꾸고 저장 후 종료. 일을 만들어내지 않는다.

---

## B. 주간 기획 실행 (주 1회)
1. **0단계 수행**
2. `business-pm`: 메모리와 열린 이슈를 보고 목표(월 활성 사용자 100명)에 기여할 아이디어 **최대 1건** 또는 "없음". 이번 주 마케팅 초안 `docs/marketing/<YYYY-WW>/` 작성
3. `planner-designer`: 아이디어가 있으면 경험 관점 의견 (제안 단계의 공동 검토)
4. `cto`: DECISIONS·LEARNINGS·PRINCIPLES 3장과 대조해 채택/기각 권고. 채택 권고 시 이슈 생성(`status:idea` + 우선순위) — **planning 진입은 대표가 라벨을 바꿔야 시작**
5. `qa`: 마케팅 초안 규칙 검사
6. `cto`: 2주 이상 움직임 없는 이슈 on-hold 권고 코멘트
7. **마지막 단계 — 메모리 저장**

---

## C. 배포 후 점검 (매일, 머지가 있었던 날만)
1. **0단계 수행**. 지난 24시간 머지가 없으면 메모리 저장 후 종료
2. `qa`: 운영 URL 스모크 점검 (qa.md 참조)
3. 이상 시 `type:bug` + `priority:p0` + `status:needs-human` 이슈 생성 + 대표 멘션. 롤백은 대표가 Vercel에서 직접 (Instant Rollback)
4. **마지막 단계 — 메모리 저장**

---

## 마지막 단계 — 메모리 저장 (모든 실행)
1. `.memory/STATE.md` 전체 덮어쓰기: 대표 결정 대기 목록(이슈·preview URL·권고), 진행 중 표, 막힌 것, 다음 할 일
2. 이번 실행에서 생긴 결정 → `DECISIONS.md` 추가
3. 반려·실패에서 얻은 교훈 → `LEARNINGS.md` 추가
4. 이번 실행에서 `done`/`rejected` 된 이슈 → `HISTORY.md` 한 단락
5. `.memory/run-log.md` 표 맨 위에 한 줄 (`일시 | 실행 종류 | 처리 이슈 | 단계 변화 | 특이사항`). 60줄 넘으면 오래된 줄은 월별 한 줄 요약으로 접기
6. commit + push (`CLAUDE.md` 2장 명령). 실패 시 1회 재시도, 그래도 실패면 실행 요약 맨 위에 "메모리 저장 실패" 표시
