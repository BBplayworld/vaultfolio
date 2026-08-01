---
description:
alwaysApply: true
---

# CLAUDE.md

# 규칙

- **응답은 반드시 한국어로만 작성한다(최우선, 예외 없음). 일본어·중국어는 절대 사용하지 않는다.** 코드 주석·커밋 메시지·문서·진행 상황 설명 전부 포함. 최대한 간결하게
- 진행 과정 설명 최소화, 결과만 출력
- 코드 주석·커밋 메시지도 한국어
- **요청한 사항만 정확히 적용. 요청하지 않은 추가 변경 절대 금지**
- **재사용 우선 · 작업 최소화 (강제)**:
  - **기존 구현 방식이 이후 모든 작업의 기본 방향.** 신규 라이브러리·상태관리 방식·색/간격/컴포넌트 패턴·데이터 접근 방식을 새로 도입하기 전, 기존 방식으로 가능한지 먼저 확인. 불가피할 때만 근거를 남기고 도입.
  - **신규·수정 구현 전 재사용 지도를 반드시 먼저 검색**(중복 코드 작성 금지): UI→`components.md`·`design-system.md`, 유틸·Context·Store→`state-and-utils.md`, 코드 패턴·주의→`dev-rules.md`, 현행 사양→`qa-full-test-plan.md` `F-*`. 동일 역할이 있으면 재사용, 없을 때만 신규.
  - **재사용 가능한 신규 공용 코드(컴포넌트·유틸·패턴·토큰)는 생성과 동시에 해당 카탈로그에 등록**(components.md / state-and-utils.md / design-system.md). 등록 없는 신규 공용 자산 금지.
  - 상세 절차는 [`dev-rules.md`](.claude/_knowledge/dev-rules.md)의 **"재사용 우선 체크리스트"**를 단일 출처로 따른다. (src 신규 파일 생성 시 `.claude/hooks/reuse-reminder.mjs` 훅이 상기시킴)
- **계획 md 파일(`C:/Users/궁빈/.claude/plans/*.md`)은 완료된 작업은 모두 제거하고 신규 작업 계획만 유지한다.**
- **라이브 프리뷰 및 동작 검증 제외** (preview_start·browser eval 등으로 앱을 띄워 확인하는 절차 생략. 타입 체크·코드 변경 결과 보고로 마무리)
- **확인·제출 버튼은 `Button variant="brand"`(= `--brand`/`MAIN_PALETTE[0]`), 체크박스는 기본 `Checkbox`(자동 brand)로 색상 통일. 매수=빨강/매도=파랑, 삭제=destructive 등 의미색만 예외.**
- **모든 UI/디자인 작업은 [`.claude/_knowledge/design-system.md`](.claude/_knowledge/design-system.md)를 단일 출처(source of truth)로 준수한다.** 색 토큰(블랙 배경/화이트 전경·순자산=주황 `important`/액션=brand 인디고·손익 빨강/파랑)·간격(4px 그리드, 섹션 gap-5·카드 gap-3)·동심 radius·테두리보다 그림자 우선·컴포넌트 규약·모션 폴리시·접근성을 모두 이 문서에 맞춘다. 신규 색·간격·컴포넌트 패턴을 만들기 전에 design-system.md에 흡수 가능한지 먼저 확인하고, 문서에 없는 새 규약이 생기면 design-system.md에 반영한다.
- **[`.claude/specs/README.md`](.claude/specs/README.md)의 판정 체크리스트(스키마·저장 키·공유 토큰·동기화·마이그레이션·새 자산 타입·새 API·2개 이상 화면의 새 기능)에 하나라도 해당하면 구현 전 `/spec`으로 명세를 먼저 작성한다. 해당 없으면 명세 없이 진행한다. 판정 축은 "새 데이터·기능이 생기는가"이며 **변경 파일 수는 기준이 아니다**(리팩토링·규칙 통일은 규모와 무관하게 제외).**
- **UI 디테일 폴리시 체크리스트(design-system.md §6)를 기본 적용한다.** 동심 radius·광학 정렬·shadow 우선·인터럽터블 전환·split/stagger 진입·subtle exit·tabular-nums·text-balance/pretty·이미지 outline·press scale(0.96)·`transition: all` 금지·`will-change` 절제·최소 히트영역 40×40px. (framer-motion 미사용 → CSS 전환 + `tw-animate-css`, `motion-safe`로 reduced-motion 대응)

# KB (.claude/\_knowledge/)

세션 시작 시 작업 유형에 맞는 KB만 읽고 시작한다.

| 작업 유형     | KB 파일                                          |
| ------------- | ------------------------------------------------ |
| 공통 (필수)   | `architecture.md`                                |
| UI 컴포넌트   | + `components.md` + `design-system.md` |
| 페이지·화면 UI | + `design-system.md` |
| 타입·스키마   | + `types-and-schemas.md`                         |
| API·캐시·공유 | + `api-reference.md`                             |
| 스크린샷      | + `api-reference.md` + `components.md`           |
| Context·유틸  | + `state-and-utils.md`                           |
| 새 기능·패턴  | + `dev-rules.md` + `design-system.md` + [`specs/README.md`](.claude/specs/README.md) |
| 구독·자산 단위 | + `asset-and-subscription.md`                    |
| 최근 변경     | + `changelog.md`                                 |
| 진행 중 기능  | + [`specs/{번호}-*.md`](.claude/specs/)          |

> **UI/화면 작업 시 `design-system.md`를 단일 출처로 준수한다 — 색·간격·반경·고도·컴포넌트 규약(§1~§5)·모션/디테일 폴리시(§6)·접근성(§7)·정보 설계 휴리스틱(§11).**

> **문서 계층**: `CLAUDE.md`(규칙) · `_knowledge/`(현재 코드가 어떤가) · [`specs/`](.claude/specs/)(이번에 무엇을 왜 만드나) · `skills/`(어떻게 작업하나). 기존 기능의 현행 사양은 `qa-full-test-plan.md`의 `F-*`가 담당하며 specs로 복제하지 않는다.
