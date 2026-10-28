---
name: secretasset-run
description: 시크릿에셋 에이전트 팀 정기 실행을 수동으로 1회 수행한다. 사용자가 "/secretasset-run", "정기 실행 돌려줘", "에이전트 실행" 등을 요청할 때 사용한다. 인자로 "weekly"(주간 기획)를 줄 수 있다.
---

# 시크릿에셋 에이전트 정기 실행 (수동)

memory 브랜치를 기준으로 예약 실행과 동일하게 1회 수행한다. 이전 대화 기억에 의존하지 않는다.

1. 준비
   ```bash
   cd /home/user/vaultfolio && git fetch origin
   git worktree list | grep -q '\.memory' || git worktree add -B memory .memory origin/memory
   git -C .memory fetch origin memory && git -C .memory reset -q --hard origin/memory
   ```
   - 작업 트리에 미커밋 변경이 있으면(다른 실행의 개발 진행 중) main으로 reset하지 않는다. 문서는 `git show origin/main:<경로>`로 읽는다.
   - 미커밋 변경이 없으면 `git checkout -q main && git reset -q --hard origin/main`.
2. `CLAUDE.md`(특히 "# 에이전트 팀 운영")를 읽는다.
3. `docs/ops/ORCHESTRATOR.md`를 수행한다.
   - 인자 없음: "A. 정기 실행" (머지가 있었으면 1-1의 C 포함)
   - 인자 `weekly`: "B. 주간 기획 실행"
4. 에이전트는 `.claude/agents/*.md` 등록 에이전트(subagent_type)로 호출한다.
5. 품질 사인·결함 확정은 qa만. 대표(BBplayworld)에게 QA·화면 확인 요청 금지.
6. 알림은 ORCHESTRATOR.md "대표 알림" 표의 세 경우만.
7. 메모리 저장(push) 성공까지 확인하고 끝낸다. 모든 출력 한국어, 간결히.
