---
description:
alwaysApply: true
---

# CLAUDE.md

# 규칙

- 응답은 한국어, 최대한 간결하게
- 진행 과정 설명 최소화, 결과만 출력
- 코드 주석·커밋 메시지도 한국어

# KB (.claude/\_knowledge/)

세션 시작 시 작업 유형에 맞는 KB만 읽고 시작한다.

| 작업 유형     | KB 파일                                |
| ------------- | -------------------------------------- |
| 공통 (필수)   | `architecture.md`                      |
| UI 컴포넌트   | + `components.md`                      |
| 타입·스키마   | + `types-and-schemas.md`               |
| API·캐시·공유 | + `api-reference.md`                   |
| 스크린샷      | + `api-reference.md` + `components.md` |
| Context·유틸  | + `state-and-utils.md`                 |
| 새 기능·패턴  | + `dev-rules.md`                       |
| 최근 변경     | + `changelog.md`                       |
