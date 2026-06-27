---
description:
alwaysApply: true
---

# CLAUDE.md

# 규칙

- 응답은 한국어, 최대한 간결하게
- 진행 과정 설명 최소화, 결과만 출력
- 코드 주석·커밋 메시지도 한국어
- **요청한 사항만 정확히 적용. 요청하지 않은 추가 변경 절대 금지**
- **신규·수정 기능 작성 시 기존에 동일한 역할의 함수·로직이 있으면 재사용. 중복 코드 작성 금지**
- **계획 md 파일(`C:/Users/궁빈/.claude/plans/*.md`)은 완료된 작업은 모두 제거하고 신규 작업 계획만 유지한다.**
- **라이브 프리뷰 및 동작 검증 제외** (preview_start·browser eval 등으로 앱을 띄워 확인하는 절차 생략. 타입 체크·코드 변경 결과 보고로 마무리)
- **확인·제출 버튼은 `Button variant="brand"`(= `--brand`/`MAIN_PALETTE[0]`), 체크박스는 기본 `Checkbox`(자동 brand)로 색상 통일. 매수=빨강/매도=파랑, 삭제=destructive 등 의미색만 예외.**
- **모든 UI/디자인 작업은 [`.claude/_knowledge/design-system.md`](.claude/_knowledge/design-system.md)를 단일 출처(source of truth)로 준수한다.** 색 토큰(블랙 배경/화이트 전경·순자산=주황 `important`/액션=brand 인디고·손익 빨강/파랑)·간격(4px 그리드, 섹션 gap-5·카드 gap-3)·동심 radius·테두리보다 그림자 우선·컴포넌트 규약·모션 폴리시·접근성을 모두 이 문서에 맞춘다. 신규 색·간격·컴포넌트 패턴을 만들기 전에 design-system.md에 흡수 가능한지 먼저 확인하고, 문서에 없는 새 규약이 생기면 design-system.md에 반영한다.
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
| 새 기능·패턴  | + `dev-rules.md` + `design-system.md` |
| 구독·자산 단위 | + `asset-and-subscription.md`                    |
| 최근 변경     | + `changelog.md`                                 |

> **UI/화면 작업 시 `design-system.md`를 단일 출처로 준수한다 — 색·간격·반경·고도·컴포넌트 규약(§1~§5)·모션/디테일 폴리시(§6)·접근성(§7)·정보 설계 휴리스틱(§11).**
