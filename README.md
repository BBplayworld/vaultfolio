# 팀 메모리 (memory 브랜치)

이 폴더는 저장소의 **`memory` 브랜치**에만 존재한다. main과 분리한 이유:
- 매 실행이 끝날 때마다 바로 저장해야 하는데, main은 PR 없이 쓸 수 없다 (보호 브랜치)
- 메모리 갱신이 코드 PR·배포를 일으키지 않게 하기 위함 (Vercel은 이 브랜치를 빌드하지 않도록 설정 — 이 브랜치 루트의 `vercel.json` 삭제 금지. Vercel은 배포 대상 커밋의 vercel.json을 읽는다)

## 파일과 규칙

| 파일 | 내용 | 쓰는 방식 |
|---|---|---|
| `STATE.md` | 지금 이 순간의 팀 상태: 진행 중 이슈, 막힌 것, 다음 할 일, 대표 결정 대기 목록 | 매 실행 끝에 **전체 덮어쓰기** |
| `DECISIONS.md` | 확정된 결정 (대표 결정 + 에이전트 결정) | **추가만**. 수정·삭제 금지. 뒤집히면 새 줄로 "번복" 기록 |
| `LEARNINGS.md` | 대표가 반려·수정한 이유, 반복하면 안 되는 실수 | **추가만**. 같은 교훈이 쌓이면 월 1회 묶어서 정리 |
| `HISTORY.md` | 시간순 진행 이력 (이슈 단위 요약) | 이슈가 끝날 때 한 단락 추가 |
| `CHECKLIST.md` | 누적 최종 점검 항목(대표 지적·qa FAIL·결함에서 추출). qa가 매 릴리스 전 항목 판정 | **추가만**. cto 회고로 추가 |
| `run-log.md` | 매 예약 실행 한 줄 기록 | 맨 위에 추가, 60줄 넘으면 월별 요약 |
| `issues/<번호>-<slug>/` | 이슈 산출물 (direction·challenge·spec·business·tech-review·ui·dev-notes·qa-report·screenshots·decision-brief) | 단계별 담당이 작성 |
| `marketing/<YYYY-WW>/` | 주간 마케팅 초안 | business-pm 작성, qa 검사 |

## 읽기 규칙 (모든 실행, 모든 에이전트)
1. 실행 시작 시 오케스트레이터가 네 파일을 모두 읽는다.
2. 에이전트를 호출할 때 **STATE.md 전체 + 해당 이슈 관련 DECISIONS·LEARNINGS 줄**을 함께 넘긴다.
3. 에이전트는 DECISIONS.md와 다른 방향을 제안할 수 없다. 바꿔야 한다고 판단하면 `status:needs-human` 으로 올린다.
4. LEARNINGS.md에 있는 반려 사유와 같은 제안을 다시 하지 않는다.

## 쓰기 규칙
- 실행 마지막 단계에서 반드시 갱신하고 `memory` 브랜치에 push한다. **push 실패 시 그 실행은 실패로 간주**하고 run-log에 남긴다.
- 대표의 결정(PR 머지, PR 닫기, 이슈 코멘트)은 다음 실행에서 DECISIONS.md·LEARNINGS.md에 옮겨 적는다. 대표의 말은 요약하되 의미를 바꾸지 않는다.
- 비밀값, 사용자 개인 자산 금액은 기록하지 않는다.
