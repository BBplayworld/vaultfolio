# 예약 실행 지시서 (오케스트레이터)

예약 작업 프롬프트에는 "docs/ops/ORCHESTRATOR.md 의 '<실행 종류>'를 수행하라"만 적는다.
모든 실행은 **0단계(메모리 읽기)로 시작하고 마지막 단계(메모리 저장)로 끝난다.** 예외 없음.
**대표 알림은 아래 "대표 알림" 표의 두 경우뿐이다.** 그 밖의 실행은 조용히 끝낸다.

## GitHub 접근 방식
1. **기본: GitHub MCP 도구**(`mcp__github__*`, 저장소 `BBplayworld/vaultfolio`). 세션에 저장소가 없으면 `add_repo`(access push)로 붙인다. `gh` CLI는 쓰지 않는다.
2. **MCP를 쓸 수 없으면 git CLI 전용 모드**로 같은 흐름을 진행한다 (실행을 멈추지 않는다):
   - 이슈 단계·라벨·코멘트 → `.memory/STATE.md` 진행 표와 `.memory/issues/<버전>-<번호>-<slug>/<버전>-log.md`(코멘트 형식 그대로)에 기록. 다음 MCP 가능 실행에서 GitHub에 일괄 반영
   - PR 생성 → `issue-4.NN` 브랜치 push까지. 대표 알림에 비교 링크 `https://github.com/BBplayworld/vaultfolio/compare/main...issue-4.NN?expand=1` 포함 (대표가 한 번 눌러 PR 생성·머지)
   - 대표 결정 읽기 → `git fetch origin main` 후 `git log origin/main`의 머지 커밋으로 반영 여부 확인
   - 실행 요약 첫 줄에 "git 전용 모드" 표시

## 대표 알림 (아래 두 경우에만, 실행당 최대 1건으로 묶음)
| 알림 | 언제 | 제목 |
|---|---|---|
| 🆕 새 과제 방향 확정 | 이슈의 기획+사업 방향 정의(direction.md 공동 합의)가 완료됐을 때. 운영 이상 버그는 방향 정의가 없으므로 qa 확정 직후 | `[시크릿에셋] 새 과제: #<번호> <제목>` + 유형·합의된 방향 2줄 |
| 🔔 대표 결정 필요 | 릴리스 owner-review 진입. **아래 3가지가 모두 같은 최종 커밋 기준일 때만**: ① qa 최종 점검 PASS ② cto(COO 겸임) 사용자 관점 최종 점검 PASS + 최종 반영 의견(decision-brief) 완료 ③ 그 커밋이 Vercel preview에 배포 완료(PR 체크 Vercel success, head SHA 일치) | `[시크릿에셋] 반영 결정 필요: v4.NN` + **포함 이슈별 핵심 반영 내용 한 줄 요약**(`#번호 한 줄`) + 권고 한 줄 + PR·decision-brief·preview 링크 |
- 전달: `PushNotification`(가능 시) + 실행 최종 요약 **첫 줄**에 같은 문구. owner-review는 이슈 코멘트 `@BBplayworld` 멘션도 함께
- **새벽 실행(KST 00:00~06:59, 현재 01:53 회차)은 알림을 보내지 않는다** (PushNotification·`@BBplayworld` 멘션 모두). 라벨 전환·문서·PR 코멘트 본문은 그대로 진행하고, 보낼 알림 문구는 `.memory/STATE.md` "보류 알림" 절에 적는다. 다음 비새벽 실행(09:53)이 0단계 직후 보류 알림을 묶어 보내고 절을 비운다
- 그 밖의 단계 이동·문서 작성·검토 왕복은 알리지 않는다. 알림이 없는 실행은 최종 요약 첫 줄을 `알림 불필요: <한 줄>`
**대표에게 QA·화면 확인을 요청하지 않는다.**

---

## 0단계 — 공통 준비 (모든 실행)
1. `git pull`, `CLAUDE.md` "# 에이전트 팀 운영" 1장 순서대로 읽기 (메모리 → 원칙 → 워크플로우)
2. 대표 결정 동기화 (WORKFLOW.md 4장)
   - `list_pull_requests`(state all, 최근 갱신순)로 STATE.md 마지막 갱신 이후 머지·닫힘 PR 확인
   - `list_issues`(open) + `issue_read`(comments)로 대표(`BBplayworld`)의 `수정:` / `결정:` 코멘트와 대표가 새로 만든 이슈 확인
   - 발견한 대표 결정은 즉시 `.memory/DECISIONS.md`(미반영은 `LEARNINGS.md`)에 기록하고 라벨 처리

---

## A. 정기 실행 (하루 3회, 8시간 간격)
1. **0단계 수행**
1-1. **배포 후 점검 겸함**: 직전 실행 이후 main에 머지가 있었으면 먼저 C를 수행한다 (별도 예약 없음)
2. **작업 큐**: 열린 이슈 중 `needs-human / on-hold / rejected / done / owner-review / idea` 제외, 우선순위→오래된 순, WORKFLOW.md 7장 제한 적용해 최대 2건
3. **담당 호출** (Agent 도구, subagent_type = 에이전트 이름, 미등록이면 CLAUDE.md 에이전트 3장 방식). 넘길 정보: 이슈 번호, 이슈 폴더, 이번 할 일, 완료 조건, **`.memory/STATE.md` 전문과 관련 DECISIONS·LEARNINGS 줄**
   | 상태 | 호출 |
   |---|---|
   | planning, direction.md 미합의 | WORKFLOW.md 2장 ① 순서대로 `business-pm` → `planner-designer` → `business-pm` (필요 시 1회 더 왕복) |
   | planning, direction.md 합의됨 · challenge.md 없음 | `cto` 반대 검토 |
   | planning, challenge.md 통과 | `planner-designer`(spec.md) + `business-pm`(business.md) 병렬 → 교차 검토 |
   | design-review | `developer`(tech-review.md) + `ui-designer`(ui.md) 병렬 → 교차 검토(planner-designer는 ui.md 흐름 검토) |
   | development | `developer` (PR + preview URL 확인까지) → `ui-designer` UI 검수(ui-review.md) — `UI 승인` 전에는 qa로 넘기지 않음 |
   | qa | `qa` (CHECKLIST.md 전 항목 + 데이터 안전 점검 필수) → FAIL이면 `developer` 수정 후 같은 실행에서 `qa` 1회 재검증 가능 |
   | qa PASS 직후 | `cto` → decision-brief.md 작성 후 `status:owner-review` |
4. **단계 전환**: 완료 조건 충족 시에만 `issue_write`로 라벨 변경. 미충족이면 막힌 이유 코멘트. 막힘은 WORKFLOW.md 5장대로 팀 안에서 해결
5. **owner-review 진입 시**: 위 "대표 알림" ①②③ 조건을 PR head SHA로 확인한 뒤 수행 (포함 이슈별 한 줄 요약 + 권고 한 줄 + decision-brief·PR·preview 링크, "반영하려면 PR 머지, 아니면 닫기"). 하나라도 미충족이면 `status:owner-review`로 바꾸지 않고 알리지 않는다. 결정 요청 뒤 커밋이 추가되면 ①②③을 새 커밋 기준으로 다시 거친다
6. **마지막 단계 — 메모리 저장** (아래)

**작업 큐가 비면(진행할 열린 이슈 0건, 또는 남은 것이 `priority:p2` 소규모 수정뿐) 반드시 "D. 자율 과제 발굴"을 같은 실행에서 수행한다.** p2 소규모 수정은 다음 릴리스에 함께 실어 처리한다. "처리할 것 없음"으로 끝내지 않는다.
(owner-review 대기만 남은 경우도 큐가 빈 것으로 본다. 단 WORKFLOW.md 7장의 owner-review 3건 이상 제한에 걸리면 D는 후보 정리까지만)

---

## B. 주간 기획 실행 (주 1회)
1. **0단계 수행**
2. **후보 발굴** — 신규만이 아니라 서비스를 발전시키는 모든 방향 (WORKFLOW.md 9장)
   - `developer`: 현재 코드 점검 → 버그 의심, 중복 화면·기능, 과하게 복잡한 흐름, 정리할 코드 후보 (근거: 파일 경로)
   - `business-pm`: 메모리·열린 이슈·GA 이벤트 정의(`src/` 내 GA 코드)를 보고 목표(월 활성 사용자 100명) 기여 후보 + 이번 주 마케팅 초안 `docs/marketing/<YYYY-WW>/` (memory 브랜치)
   - `planner-designer`: 사용자 경험 관점 후보 (헷갈리는 메뉴, 통합·축소할 화면)
   - `ui-designer`: UI 품질이 낮은 화면·컨트롤 후보 (스크린샷 근거)
3. **선정**: 후보 전체를 `type:feature / improvement / bug / simplify`로 분류, 목표 기여·비용으로 순위. 같은 기여도면 줄이기·고치기 우선. **최대 1건** 선정 (근거 없으면 "이번 주 없음")
4. `cto` 반대 검토 (WORKFLOW.md 2장 ② 기준) → 통과 시 이슈 생성 + **바로 `status:planning`** + 우선순위. 탈락 후보는 STATE.md "후보 목록"에 이유와 함께 남긴다 (다음 주 재검토 가능)
5. `qa`: 마케팅 초안 규칙 검사
6. `cto`: 2주 이상 움직임 없는 이슈 on-hold 또는 폐기 판정 (대표에게 묻지 않음)
7. **마지막 단계 — 메모리 저장**

---

## D. 자율 과제 발굴 (정기 실행에서 작업 큐가 비었을 때 필수)
팀이 스스로 다음 일을 만든다. 신규 서비스·기존 개선·버그 수정·정리/통합/축소/제거를 모두 후보로 보고, **기획·사업 관점에서 가장 가치 있는 1건**을 골라 그 실행 안에서 바로 진행한다.
1. **근거 수집(병렬)** — 근거 없는 후보는 버린다
   - `business-pm`: 목표(월 활성 사용자 100명) 기준 지표 가설, GA 이벤트 정의(`src/` GA 코드)로 측정 가능한 퍼널 병목, 경쟁·시장 관점의 차별점, 성장·유지 후보
   - `planner-designer`: 현재 화면·흐름의 혼란·중복·이탈 지점, 통합·축소 후보, 사용자 시나리오 공백
   - `developer`: 코드 기준 버그 의심, 중복·죽은 코드, 성능·안정성 위험, 기술 부채 정리 후보 (근거: 파일 경로)
   - `ui-designer`: 품질이 낮은 화면·컨트롤 (preview 스크린샷 근거)
   - 함께 볼 것: STATE.md "후보 목록", LEARNINGS(반려 방향 제외), DECISIONS, 직전 릴리스의 알려진 한계·범위 밖 후보
2. **선정** — `cto`(COO 겸임)가 후보 전체를 `type:feature / improvement / bug / simplify`로 분류하고 순위를 매긴다. **1순위 기준은 장기 목표 "월 활성 사용자 100명"에 직접 기여하는 서비스 과제**(신규 유입·첫 사용 경험·재방문·핵심 가치 체감). 소규모 버그·정리·내부 신뢰성 수정은 사용자 체감 영향이 크지 않으면 자율 과제로 선정하지 않고 `priority:p2`로 두어 다음 릴리스에 함께 싣는다. 같은 서비스 기여도면 줄이기·고치기 우선. 1건 선정 + 반대 검토(WORKFLOW.md 2장 ② 기준). 탈락 후보는 이유와 함께 STATE "후보 목록"
3. **이슈 생성** — 통과 시 GitHub 이슈 생성(`status:planning`, 유형·우선순위 라벨, 본문에 근거·기대 지표), 같은 실행에서 A의 planning ① 방향 정의(`business-pm` → `planner-designer` → `business-pm`)까지 진행. 합의되면 "🆕 새 과제 방향 확정" 알림(새벽 규칙 적용)
4. 방향의 질 기준: 서비스 성장(사용자 수·재방문)으로 이어지는 근거가 있어야 하고, 단순 기능 추가가 아니라 **누구의 어떤 문제를, 어떤 지표로, 왜 지금** 해결하는지가 direction.md에 있어야 한다. 사업 절(성공 지표·측정 방법)과 경험 절(바뀌는 화면·줄이는 것)이 모두 없으면 cto가 반려한다
5. 정말로 근거 있는 후보가 0건이면 그 이유(어떤 근거를 봤는지)를 run-log에 남긴다 — "할 일 없음"만 적는 것은 금지

## C. 배포 후 점검 (정기 실행 1-1에서 수행)
1. `qa`: 운영 URL 스모크 점검 (qa.md 참조)
2. **이상 시 즉시 수정 착수 (빠른 경로)** — 사람 판단을 기다리지 않는다
   - `type:bug` + `priority:p0` 이슈 생성
   - `qa`가 재현·확정 → 원인 파일 특정 → "🆕 새 과제 방향 확정" 알림
   - planning·design-review 생략: `developer`가 같은 실행에서 바로 수정 — 열린 릴리스 `issue-4.NN`이 있으면 거기에, 없으면 다음 버전 → PR → preview
   - `qa` 검증 PASS → `cto` decision-brief → owner-review ("🔔 대표 결정 필요"). 수정 범위는 버그 원인에 한정
   - 확정 결함이 아니면(재현 안 됨) 이슈를 닫고 LEARNINGS 기록
   - 롤백이 더 빠르면 decision-brief에 Vercel Instant Rollback 권고를 함께 적는다
3. **마지막 단계 — 메모리 저장**

---

## 자기 개선 — 회고 (해당 시 마지막 단계 전에 수행)
다음 중 하나가 생기면 `cto`가 회고를 하고 `.memory/CHECKLIST.md`에 항목을 **추가**한다 (같은 실수를 두 번 하지 않는다):
- 대표가 PR을 닫거나 `수정:`/직접 피드백으로 팀이 놓친 문제를 지적했을 때
- qa FAIL, 운영 이상, 머지 후 결함 발견
- 결함 의심이 확정됐을 때(그 결함을 더 일찍 잡을 수 있었던 단계)
회고 기록: `CHECKLIST.md`에 `| 날짜 | 출처 | 점검 항목(관찰 가능한 문장) | 담당 단계 | 검증 방법 |`. 에이전트 정의 변경이 필요하면 STATE.md "개선 제안"에 적어 다음 설정 PR에 반영한다.

## 마지막 단계 — 메모리 저장 (모든 실행)
1. `.memory/STATE.md` 전체 덮어쓰기: 대표 결정 대기 목록(이슈·PR·권고), 진행 중 표, 막힌 것, 다음 할 일, 후보 목록
2. 이번 실행에서 생긴 결정 → `DECISIONS.md` 추가
3. 반려·실패·폐기에서 얻은 교훈 → `LEARNINGS.md` 추가
4. 이번 실행에서 `done`/`rejected` 된 이슈 → `HISTORY.md` 한 단락
5. `.memory/run-log.md` 표 맨 위에 한 줄 (`일시 | 실행 종류 | 처리 이슈 | 단계 변화 | 특이사항`). 60줄 넘으면 오래된 줄은 월별 한 줄 요약으로 접기
6. commit + push (`CLAUDE.md` 에이전트 2장 명령). 실패 시 1회 재시도, 그래도 실패면 실행 요약 맨 위에 "메모리 저장 실패" 표시
