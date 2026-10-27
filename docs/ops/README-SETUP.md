# 시크릿에셋 5인 에이전트 팀 설정 가이드

**로컬 PC에서 할 일은 없다.** 설치·운영 모두 클라우드(Claude 클라우드 세션 + GitHub + Vercel)에서 이뤄진다.
대표가 직접 하는 일은 웹 화면에서의 설정 몇 가지와, 이후 preview를 보고 머지(승인)하는 것뿐이다.

## 0. 구조

```
[Claude 예약 작업 · 클라우드]  하루 2회 정기 / 주 1회 기획 / 매일 머지 후 점검
   │ 0단계: memory 브랜치에서 팀 메모리 읽기 + 대표 결정(머지·닫기·코멘트) 반영
   ▼
[오케스트레이터]  status 라벨을 보고 단계 담당자 호출
   ├─ planner-designer ┐ 기획 방향 공동 정의 (direction.md)
   ├─ business-pm      ┘
   ├─ developer        구현 → issue-<번호> 브랜치 → Vercel preview
   ├─ qa               검증 + 대표용 체크리스트
   └─ cto              대표 결정용 보고서 (권고·위험·preview URL)
   │ 마지막 단계: 팀 메모리 갱신 → memory 브랜치 push
   ▼
[대표]  이슈 알림 → preview URL 확인 → PR 머지(승인) / 닫기(반려) / "수정:" 코멘트
   ▼
[Vercel]  main 머지 시 운영 자동 배포
```

## 1. 팀 메모리 — 모든 진행과 결정을 기억하는 방법
- 저장소의 **`memory` 브랜치**에 5개 파일: `STATE`(현재 상태), `DECISIONS`(결정, 추가만), `LEARNINGS`(반려 사유, 추가만), `HISTORY`(이력), `run-log`(실행 기록)
- **모든 실행은 메모리를 읽고 시작해서 메모리를 저장하고 끝난다.** 저장 실패는 실행 실패로 기록된다.
- 대표의 결정(머지·닫기·`수정:`·`결정:` 코멘트)은 다음 실행이 자동으로 DECISIONS·LEARNINGS에 옮겨 적는다.
- 에이전트는 DECISIONS와 다른 방향을 제안할 수 없고, LEARNINGS의 반려 사유와 같은 제안을 반복할 수 없다.
- 오늘까지의 모든 논의(1·2차 라운드 설계, 문구 규칙, 수익화 탐색, 반려된 아이디어, 오늘 결정)는 이미 기록되어 있다.
- main과 분리한 이유: main은 보호 브랜치라 PR 없이 쓸 수 없고, 메모리 갱신이 배포를 일으키면 안 되기 때문.

## 2. 이슈별 Vercel preview
- 이슈마다 브랜치 하나: `issue-<번호>`. QA 수정도 같은 브랜치라 **이슈당 preview 주소가 고정**된다:
  `https://<프로젝트>-git-issue-<번호>-<팀>.vercel.app`
- owner-review 단계에서 cto 에이전트가 이슈에 대표를 멘션하며 preview URL, 권고, 확인할 것 3개를 남긴다.
- preview는 운영과 주소가 달라 대표의 실제 데이터가 보이지 않는다. 그래서 **시드0 이슈(preview 안전장치)**가 최우선이다: preview 표시, 동기화 쓰기 차단, 데모 데이터. 이게 끝나기 전에는 다른 이슈가 개발로 넘어가지 않는다.

## 3. 대표의 결정 방법
| 하고 싶은 것 | 방법 |
|---|---|
| 승인 | PR 머지 → Vercel 운영 배포 |
| 반려 | PR 닫기 + 이유 코멘트 (LEARNINGS에 기록됨) |
| 수정 요청 | 이슈에 `수정: <내용>` 코멘트 |
| needs-human 해소 | 이슈에 `결정: <내용>` 코멘트 |
| 새 아이디어 투입 | 이슈 생성 + `status:planning` |
| 주간 기획이 제안한 아이디어 시작 | `status:idea` → `status:planning` 으로 라벨 변경 |
| 운영 문제 롤백 | Vercel 대시보드 Instant Rollback |

## 4. 설치

### 4-1. Claude가 클라우드에서 하는 일 (저장소만 연결해 주면 됨)
1. 저장소 코드를 읽고 `CLAUDE.md`·`ci.yml`·에이전트 파일의 `{{...}}` 자리(스택, 테스트·빌드 명령, Vercel 프로젝트명) 채우기
2. 설정 파일 추가 PR 생성 → **대표가 머지** (첫 번째 결정)
3. 라벨 생성 (`scripts/setup-labels.sh`)
4. memory 브랜치 생성 (`scripts/init-memory-branch.sh`)
5. 시드 이슈 4건 생성 (`scripts/create-seed-issues.sh`)
6. 예약 작업 3개 등록 (아래 4-3)

### 4-2. 대표가 웹에서 하는 일 (휴대폰·아무 PC 브라우저 가능)
- **Claude**: 이 대화에 GitHub 저장소 연결 허용 (push 권한)
- **GitHub → Settings → Branches**: `main` 보호 — PR 필수, `ci` 체크 통과 필수, force push 금지
- **GitHub → 저장소 Watch**: Participating and @mentions 알림 + GitHub 모바일 앱 알림 켜기 (owner-review 멘션을 받기 위함)
- **Vercel**: 프로젝트가 이 저장소에 Git 연동되어 있는지, Preview Deployments가 켜져 있는지 확인. `vercel.json.snippet`의 내용을 vercel.json에 합치는 것은 Claude가 PR에 포함
- **Vercel → Deployment Protection**: preview 보호를 켤지 결정. 데모 데이터만 쓰므로 꺼도 위험은 낮고, 끄면 QA 에이전트가 preview를 자동 점검할 수 있다
- **Claude 예약 작업**: 각 작업의 승인 설정을 "자동 승인"으로 (아니면 승인 대기에서 멈춤)

### 4-3. 예약 작업 (클라우드 실행, PC 꺼져 있어도 동작)
| 이름 | 주기 (KST) | 프롬프트 |
|---|---|---|
| 시크릿에셋 정기 실행 | 매일 02:47, 13:47 | `시크릿에셋 저장소에서 docs/ops/ORCHESTRATOR.md 의 "A. 정기 실행"을 그대로 수행하라.` |
| 시크릿에셋 주간 기획 | 매주 월 07:47 | `시크릿에셋 저장소에서 docs/ops/ORCHESTRATOR.md 의 "B. 주간 기획 실행"을 그대로 수행하라.` |
| 시크릿에셋 머지 후 점검 | 매일 10:17 | `시크릿에셋 저장소에서 docs/ops/ORCHESTRATOR.md 의 "C. 배포 후 점검"을 수행하라.` |

실행당 진행 이슈 2건, 개발 동시 1건, 대표 결정 대기 3건 이상이면 새 개발 중단 — 토큰 사용량을 예측 가능하게 하고, 대표 결정이 병목일 때 헛일을 막는다.

## 5. 첫 주 운영
1. 정기 실행을 수동으로 1회 돌려 메모리 갱신·이슈 코멘트를 확인
2. 시드0·1의 direction.md(공동 방향)와 spec.md 품질 확인 → 마음에 안 들면 `.claude/agents/*.md` 수정 (이게 팀 교육)
3. 시드0 preview에서 데모 데이터와 PREVIEW 표시 확인 후 머지
4. 이후 대표는 멘션 알림만 챙기면 된다

## 6. 나중에: 결정 권한 위임
대표 결정이 반복적으로 권고와 같아지면, `risk:low` 이슈부터 cto 에이전트에게 머지 권한을 넘기는 단계를 추가할 수 있다. 판단 근거는 memory의 DECISIONS(권고 대비 실제 결정 일치율)로 확인한다.

## 파일 목록
```
CLAUDE.md                          팀 공통 규칙 (메모리 읽기/쓰기, preview, 금지사항)
.claude/agents/*.md                5인 에이전트 정의
docs/product/PRINCIPLES.md         제품 원칙 (대표만 변경)
docs/ops/WORKFLOW.md               단계·라벨·공동 기획·대표 결정 읽기
docs/ops/ORCHESTRATOR.md           예약 실행 지시서
docs/seed-issues/00~03             오늘 논의 기반 시드 이슈
memory/*                           memory 브랜치 초기 내용 (설치 후 main에서는 삭제)
.github/workflows/ci.yml           PR 테스트·빌드
.github/ISSUE_TEMPLATE/issue.md    이슈 템플릿
vercel.json.snippet                memory 브랜치 빌드 제외 설정
scripts/*.sh                       라벨·메모리 브랜치·시드 이슈 생성
.gitignore.append                  .gitignore에 추가할 줄
```
