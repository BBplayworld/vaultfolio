# 시크릿에셋 5인 에이전트 팀 설정 가이드

**로컬 PC에서 할 일은 없다.** 설치·운영 모두 클라우드(Claude 클라우드 세션 + GitHub + Vercel)에서 이뤄진다.
대표(레벨 1)가 하는 일은 **"이 개선을 라이브에 반영할지" 결정(PR 머지/닫기) 하나뿐**이다. 기획·사업 검토, 개발, QA, preview 확인은 팀이 끝까지 한다.

## 0. 구조

```
[Claude 예약 작업 · 클라우드]  하루 2회 정기 / 주 1회 기획 / 매일 머지 후 점검
   │ 0단계: memory 브랜치에서 팀 메모리 읽기 + 대표 결정(머지·닫기·코멘트) 반영
   ▼
[오케스트레이터]  status 라벨을 보고 단계 담당자 호출
   ├─ business-pm ┐ 방향 공동 정의 (direction.md)
   ├─ planner-designer ┘
   ├─ cto              반대 검토 (challenge.md: 통과/축소/폐기)
   ├─ developer        구현 → issue-4.NN 브랜치 → Vercel preview
   ├─ qa               자동 테스트 + preview 실제 점검(Playwright·스크린샷). FAIL이면 자동 재개발
   └─ cto              반영 여부 결정 보고서 (권고·근거·위험)
   │ 마지막 단계: 팀 메모리 갱신 → memory 브랜치 push
   ▼
[대표]  멘션 알림 → decision-brief 읽기 → PR 머지(반영) / 닫기(미반영)
   ▼
[Vercel]  main 머지 시 운영 자동 배포
```

## 1. 팀 메모리
- 저장소의 **`memory` 브랜치**: `STATE`·`DECISIONS`(추가만)·`LEARNINGS`(추가만)·`HISTORY`·`run-log` + 이슈별 산출물 `issues/<버전>-<번호>-<slug>/<버전>-<문서>.md` + 마케팅 초안 `marketing/`
- **모든 실행은 메모리를 읽고 시작해서 메모리를 저장하고 끝난다.**
- main과 분리한 이유: main은 PR 없이 쓸 수 없고, 메모리 갱신이 배포를 일으키면 안 되기 때문 (`vercel.json`에서 빌드 제외).

## 2. 브랜치·버전·preview
- 이슈마다 브랜치 `issue-4.NN` (서비스 표시 버전과 동일, development 진입 시 배정)
- preview 고정 주소: `https://secretasset-git-issue-4NN-bbplayworlds-projects.vercel.app` (점 제거)
- **시드0(preview 안전장치·데모 데이터)**이 최우선: QA가 사람 없이 preview를 끝까지 점검하기 위한 전제.

## 3. 대표의 결정 방법
| 하고 싶은 것 | 방법 |
|---|---|
| 라이브 반영 | PR 머지 → Vercel 운영 배포 |
| 반영 안 함 | PR 닫기 (+ 이유 코멘트 시 LEARNINGS에 기록) |
| (선택) 방향 지시 | 이슈에 `수정: <내용>` 코멘트 |
| (드묾) 원칙 변경 판단 | `status:needs-human` 이슈에 `결정: <내용>` 코멘트 |
| (선택) 직접 과제 투입 | 이슈 생성 → 다음 실행에서 planning 시작 |
| 운영 문제 롤백 | Vercel 대시보드 Instant Rollback |

## 4. 설치 상태
### 4-1. Claude가 한 일
1. 설정 파일 추가 PR (`claude/brave-noether-g09mxu` → main) — **대표가 머지해야 예약 실행이 동작**
2. 라벨, memory 브랜치, 시드 이슈 4건 생성
3. 예약 작업 3개 등록 (아래 4-3)

### 4-2. 대표가 웹에서 할 일
- **GitHub → Settings → Branches**: `main` 보호 — PR 필수, `ci` 체크 통과 필수, force push 금지
- **GitHub → 저장소 Watch**: Participating and @mentions + 모바일 앱 알림
- **Vercel**: Git 연동·Preview Deployments 켜짐 확인, **Deployment Protection에서 preview 보호 끄기** (QA 자동 점검 전제)
- **Claude 예약 작업**: 각 작업 권한을 자동 승인으로 (아니면 승인 대기에서 멈춤)

### 4-3. 예약 작업 (클라우드 실행, PC 꺼져 있어도 동작)
| 이름 | 주기 (KST) | 프롬프트 요지 |
|---|---|---|
| 시크릿에셋 정기 실행 | 매일 02:47, 13:47 | ORCHESTRATOR.md "A. 정기 실행" |
| 시크릿에셋 주간 기획 | 매주 월 07:47 | ORCHESTRATOR.md "B. 주간 기획 실행" |
| 시크릿에셋 머지 후 점검 | 매일 10:17 | ORCHESTRATOR.md "C. 배포 후 점검" |

실행당 진행 이슈 2건, 개발 동시 1건, 대표 결정 대기 3건 이상이면 새 개발 중단.

## 5. 나중에: 결정 권한 위임
대표 결정이 반복적으로 권고와 같아지면, `risk:low` 이슈부터 cto 에이전트에게 머지 권한을 넘기는 단계(레벨 2)를 추가할 수 있다. 근거는 memory의 DECISIONS(권고 대비 실제 결정 일치율).

## 파일 목록
```
CLAUDE.md                          기존 규칙 + 에이전트 팀 운영 규칙 (백업: .claude/backup/)
.claude/agents/*.md                5인 에이전트 정의
docs/product/PRINCIPLES.md         제품 원칙 (대표만 변경)
docs/ops/WORKFLOW.md               단계·라벨·반대 검토·과제 유형
docs/ops/ORCHESTRATOR.md           예약 실행 지시서
docs/seed-issues/<버전>-0N-*.md   시드 이슈 본문 (버전 미배정은 4.xx)
.github/workflows/ci.yml           PR 테스트·린트·빌드
.github/ISSUE_TEMPLATE/issue.md    이슈 템플릿
vercel.json                        memory 브랜치 빌드 제외
```
