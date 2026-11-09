# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 13:40 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 승인 필요 (지금)
없음.

## 🔴 운영 결함 (p0)
- [#107](https://github.com/BBplayworld/vaultfolio/issues/107) **운영 결함(qa 확정)**: 코인 수동 입력 '즉시 반영' 저장이 항상 막힘 · 현금 잔액 전액 출금 기록·반영 입금 삭제 시 저장 실패 — 핫픽스 개발 중(팀 위임 머지)
- [#104] → 핫픽스 PR #105 **대표 승인·머지 028cffd(11/09) · 운영 스모크 PASS**

## 🟨 대표 승인 예정 (미리 알림)
- 4.56 → v4.57 #103 연결 계좌 (high) — 목표 ~11/13 요청

## 🔄 진행 중 (완료 즉시 머지 — 결산 창 제약 해제, 대표 11/09)
| 릴리스(운영 표시) | 이슈 | 단계 | 일정(목표) | 머지 방식 |
|---|---|---|---|---|
| 4.52 → **v4.54** [PR #96](https://github.com/BBplayworld/vaultfolio/pull/96) | [#93](https://github.com/BBplayworld/vaultfolio/issues/93) 잔액 맞추기 + 전 자산 흐름 보강(이중 반영 경고) | qa·UI·COO PASS. 핫픽스 병합(import 1줄) → 증분 qa 후 🟥 승인 요청 | 오늘 11/09 요청 → 승인 즉시 머지 | 대표 승인 |
| 4.54 → **v4.55** [PR #102](https://github.com/BBplayworld/vaultfolio/pull/102) | [#99](https://github.com/BBplayworld/vaultfolio/issues/99) 스크린샷 인식 실패 뒤 다음 행동 | qa·COO PASS. 4.52 머지 뒤 병합·증분 qa | 4.52 머지 당일 | 위임 머지 (low) |
| 4.55 → **v4.56** [PR #101](https://github.com/BBplayworld/vaultfolio/pull/101) | #58 실물 자산 + [#103](https://github.com/BBplayworld/vaultfolio/issues/103) A 홈 원인 상쇄 | UI 승인·qa 증분 PASS. 남은 것: 4.52 병합 확인 테스트 → 최종 qa·COO | 4.52 머지 +1일 (~11/10~11) | 팀 머지 (#58 대표 위임) |
| 4.56 → **v4.57** | [#103](https://github.com/BBplayworld/vaultfolio/issues/103) 연결 계좌 — 주식·코인 매수·매도 시 현금 또는 대출 함께 증감, 삭제 시 되돌림 | 개발 중 → qa(데이터 안전·구버전 기기 혼재) → COO → 🟥 | 개발 ~11/11 → 승인 요청·머지 목표 ≤11/14 | 대표 승인 (high, 저장 형식 변경 없음) |

## ✅ 위임 머지 완료 (risk:low, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.56 [PR #101](https://github.com/BBplayworld/vaultfolio/pull/101) | 11/09 | 실물 자산 등록(#58, 대표 위임)·홈 원인에서 자산 간 이동 상쇄(#103 A) | D0 진행 중 · D+1 11/10 |
| v4.55 [PR #102](https://github.com/BBplayworld/vaultfolio/pull/102) | 11/09 | 스크린샷 인식 실패 뒤 다음 행동·최신화 팁 보유 자산군만·연 탭 자동 값 기록일(#99) | PASS |
| 4.51 [PR #95](https://github.com/BBplayworld/vaultfolio/pull/95) | 11/08 23:15 | 성과 월 탭 자산 구성 변화 블록(#83, 대표 위임 판단) ⚠️ 10월 결산 창 안 머지(판정 누락, 블록 추가뿐이라 유지·C39 추가) | PASS |
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

## ✅ 대표 승인 머지 완료 (최근)
| 릴리스 | 머지일 | 내용 |
|---|---|---|
| v4.54 [PR #96](https://github.com/BBplayworld/vaultfolio/pull/96) | 11/09 | 현금·대출 잔액 한 번에 맞추기 + 전 자산 흐름 보강 · 운영 스모크 PASS |
| v4.53 핫픽스 [PR #105](https://github.com/BBplayworld/vaultfolio/pull/105) | 11/09 | 시세 갱신 중 저장한 편집 되돌아감 결함(#104) · 운영 스모크 PASS |
| 4.53 [PR #98](https://github.com/BBplayworld/vaultfolio/pull/98) | 11/09 | /api/sync 남용 방어 · 운영 스모크 PASS(2기기 생성·pull·폴링·409 수렴·401) |
| 4.50 [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) | 11/08 | 주식·코인 스크린샷 보유 현황 맞추기 · 운영 스모크 PASS |
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 🔍 발굴 중 (병렬)
- 4.53이 먼저 머지됨 → 4.52는 머지 시 번호 재배정 검토.
- D8 완료: #99 선정. 보류 — 이어서 맞추기(#58 머지 뒤 1순위), 첫 결산 공백(12/11 판독 뒤), 미사용 기능 판독(12/4 상시)

## 📅 주요 일정·제약
- 결산 기간 머지 금지: **11/09 대표 결정으로 해제** — 준비된 릴리스는 결산 기간에도 바로 머지(판독 경계일 기록은 유지)
- 핫픽스: 팀 위임 머지(11/09 대표 결정)
- risk:low·medium: COO 판단으로 팀 자체 승인·머지(11/09 대표 결정). risk:high·제품 원칙·결제·외부 게시만 대표 승인
- 결산 창 전 머지 컷 11/26 23:59 (#83·#93) / 12/19~12/27 머지 없음
- #54 2차 판독 경계·GA `activity:change:composition` 판독 시작 = 11/08 (#83 머지일)
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 4.53 PASS, 11/09)
