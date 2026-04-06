# _workspace/ — Vaultfolio 지식 베이스

Claude와의 장기 개발 협업을 위한 지식 베이스입니다.
매 대화마다 전체 코드를 재분석하는 비용을 줄이고, 빠른 컨텍스트 복구를 위해 운영합니다.

## 파일 목록

| 파일 | 목적 | 업데이트 빈도 |
|------|------|--------------|
| [architecture.md](./architecture.md) | 전체 아키텍처·스택·데이터 흐름 | 큰 구조 변경 시 |
| [types-and-schemas.md](./types-and-schemas.md) | Zod 스키마 + TS 타입 정의 요약 | 타입 추가/변경 시 |
| [api-reference.md](./api-reference.md) | API 라우트·캐시·외부 서비스 연동 | API 변경 시 |
| [components.md](./components.md) | 컴포넌트 목록·역할·props | 컴포넌트 추가/변경 시 |
| [state-and-utils.md](./state-and-utils.md) | Context·Store·유틸 함수 시그니처 | 함수 추가/변경 시 |
| [dev-rules.md](./dev-rules.md) | 코딩 규칙·패턴·주의사항 | 규칙 합의 시 |
| [changelog.md](./changelog.md) | 주요 변경 이력 (무엇을·왜) | 매 작업 후 |

## 운영 규칙

1. **Claude가 코드를 수정할 때마다** 관련 KB 파일을 함께 업데이트한다.
2. **새 대화 시작 시** Claude는 관련 KB 파일을 먼저 읽고 작업한다.
3. **코드가 KB와 충돌**하면 실제 코드를 신뢰하고 KB를 수정한다.
4. **changelog.md**는 "왜" 변경했는지를 중심으로 간결하게 기록한다.
