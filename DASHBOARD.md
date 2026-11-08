# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 11:10 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 승인 필요 (지금)
| 릴리스 | 내용 | 위험 | 확인 방법 | 결정 |
|---|---|---|---|---|
| **4.53** [PR #98](https://github.com/BBplayworld/vaultfolio/pull/98) (#97) | `/api/sync` 남용 방어 — 헤더 위조로 호출 제한 우회 차단, 조회 분당 120회/IP 제한, 잘못된 형식 요청은 저장소 조회 전 거절 | medium (동기화 서버 수정) | 서버 전용 변경이라 화면 확인 불가(preview는 동기화 꺼짐). qa가 기존 동기화 ID 하위호환·다기기 시나리오 검증, 머지 후 운영 2기기 스모크 | 머지=반영 / 닫기=미반영 · 결산 창 제약 없음 |

검증: qa PASS · COO PASS @6efe730 · Vercel success. 정상 사용자 끊김 위험 없음(ID 생성 4.5 이후 불변, 실제 ID 300개 통과), 제한에 걸려도 조용히 60초 뒤 재시도·덮어쓰기 없음. 한계: 서버 인스턴스별 한도라 다중 인스턴스 시 느슨. 롤백 revert 1회. 상세: [decision-brief](https://github.com/BBplayworld/vaultfolio/blob/memory/issues/4.53-97-sync-guard/4.53-decision-brief.md)

## 🟨 대표 승인 예정 (미리 알림)
없음.

## 🔄 진행 중 (팀 자율 — #83·#58은 대표 위임 판단: cto 통과)
| 릴리스 | 이슈 | 단계 | 일정 | 머지 방식 |
|---|---|---|---|---|
| 4.52 | [#93](https://github.com/BBplayworld/vaultfolio/issues/93) 현금·대출 잔액 한 번에 맞추기 + p2 6건 | [PR #96](https://github.com/BBplayworld/vaultfolio/pull/96) qa PASS·COO PASS @757c9b0 → **11/11 00:05 위임 머지 예약**(10월 결산 창 10/28~11/10 종료 후) ([preview](https://secretasset-git-issue-452-bbplayworlds-projects.vercel.app/?demo=1) › FAB › 보유 현황 업데이트 › 현금성/대출 › 직접 입력) | 11/11 머지 → 운영 스모크 | 위임 머지 (risk:low) |
| 4.55 | #58 실물 자산 ([draft PR #101](https://github.com/BBplayworld/vaultfolio/pull/101)) | 핵심 구현 완료(저장 계층·결산·UI·GA, vitest 1047) → UI 검수 중 → 4.52·4.53 머지 후 main 병합·KB·qa | 머지 12/11~12/14 (컷 12/18) | 조건부 팀 머지 (risk:high) |
| 4.54 | [#99](https://github.com/BBplayworld/vaultfolio/issues/99) 스크린샷 인식 실패 뒤 다음 행동 (+최신화 팁 보유 자산군만, 연 탭 자동 값 기록일) | 개발 착수(11/09, 4.52 브랜치 위 로컬 선행 — 원격 issue-4.54 정리 대기) | 4.52 머지 후 main 병합 → qa ~11/22 → 위임 머지 ≤11/26 | 위임 머지 (risk:low) |

## ✅ 위임 머지 완료 (risk:low, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| 4.51 [PR #95](https://github.com/BBplayworld/vaultfolio/pull/95) | 11/08 23:15 | 성과 월 탭 자산 구성 변화 블록(#83, 대표 위임 판단) ⚠️ 10월 결산 창 안 머지(판정 누락, 블록 추가뿐이라 유지·C39 추가) | PASS |
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

## ✅ 대표 승인 머지 완료 (최근)
| 릴리스 | 머지일 | 내용 |
|---|---|---|
| 4.50 [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) | 11/08 | 주식·코인 스크린샷 보유 현황 맞추기 · 운영 스모크 PASS |
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 🔍 발굴 중 (병렬)
- D8 완료: #99 선정. 보류 — 이어서 맞추기(#58 머지 뒤 1순위), 첫 결산 공백(12/11 판독 뒤), 미사용 기능 판독(12/4 상시)

## 📅 주요 일정·제약
- 결산 창(매월 28일~다음 달 10일, 현재 10/28~11/10 · 다음 11/27~12/10): 결산 화면·홈 결산 팁·첫 화면·결산 행 도착지 변경 머지 금지
- 결산 창 전 머지 컷 11/26 23:59 (#83·#93) / 12/19~12/27 머지 없음
- #54 2차 판독 경계·GA `activity:change:composition` 판독 시작 = 11/08 (#83 머지일)
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 4.51 PASS, 11/08)
