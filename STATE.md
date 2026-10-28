# 팀 현재 상태 (매 실행 끝에 전체 덮어쓰기)

마지막 갱신: 2026-10-28 (정기 실행: #31 development 완료 → qa, git 전용 모드)

## 대표 결정 대기
- 없음

## 진행 중
| 이슈 | 버전 | 단계 | 담당 | 다음 할 일 |
|---|---|---|---|---|
| #31 시드0 preview 안전장치·데모 데이터 | 4.34 | development 완료 → qa | qa | preview https://secretasset-git-issue-434-bbplayworlds-projects.vercel.app 에서 `node .memory/qa/preview-check.mjs <URL>` + dev-notes 순서 점검. git 전용 모드라 PR·이슈 제목·코멘트는 log.md 대기(다음 MCP 실행에서 반영) |
| #32 시드1 성과 메뉴·월말 결산 | — | design-review 완료(대기) | developer | tech-review·ui 상호 승인, 위험 high 확정, 동기화 병합 v1 제외. #31 머지 후 main에서 분기해 development(WORKFLOW 8장) |
| #33 시드2 투자 유형 온보딩 | — | on-hold | — | 대표 지시로 보류 (월간 결산 라인 우선) |
| #34 시드3 채널 운영 | — | on-hold | — | 대표 지시로 보류 (월간 결산 라인 우선) |

## 막힌 것
- 없음

## 확인 필요 (첫 실행에서 처리)
- 2차 라운드 스펙(평가금액 알림, 목표 설정, 온보딩 마법사) 실제 구현 여부: changelog상 알림·신선도·목표 설정은 철회(4.22 후속), 온보딩 마법사는 4.29에서 구현 — 코드로 재확인
- 현재 테스트: vitest 19파일 269건 통과 (2026-10-28, issue-4.34)
- 가장 큰 버전: 4.34(#31) → 다음 배정 4.35

## 후보 목록 (주간 기획 탈락·대기)
- [type:improvement] 동기화 pull 월 스냅샷 합집합 병합(같은 달 충돌: enrich 우선→date 늦은 쪽) — #32 v1에서 제외(cto 2026-10-28), 착수 조건은 #32 spec §5-1
- [type:simplify] 홈 헤더 원인분해의 "주식 매수/매도·대출 상환" 라벨 정리 — LEARNINGS(앱 안 이동은 원인 아님)와 어긋난 기존 부채. #32 v1에서 분리 (cto, 2026-10-27)
- [type:bug, qa 확정 2026-10-27] 월 스냅샷이 연 경계(1월 첫 저장)에 전년분 삭제 (`src/contexts/asset-data-context.tsx:770`) — 운영 사용자에게 이미 발생(2025→2026 전년분 소실, 복구 불가). #32 선행 조건으로 13개월 롤링 보존 처리 예정. 근거 issues/32-monthly-settlement/qa-report.md

## 지표
- 월 활성 사용자: 약 50명 (2026-10 기준, 집계 방식 미정 — GA 이벤트 `.claude/specs/4.28-ga-event-tracking.md` 참고)
- 목표: 100명 이상
