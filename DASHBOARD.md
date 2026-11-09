# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 15:30 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 결정 필요 (지금)
**#103 매수·매도를 현금과 잇는 방식 선택** ([#103](https://github.com/BBplayworld/vaultfolio/issues/103), 근거 `.memory/issues/4.xx-103-cross-asset-flow/4.xx-challenge.md`)
1. **A만**: 홈 '지난 접속 이후'에서 자산 사이에 옮긴 돈(매수↔현금, 매도↔상환)을 원인에서 빼고, 현금은 지금처럼 직접 맞춤 — 위험 low
2. **A + 현금 함께 기록 (팀 권고)**: 주식·코인 매수·매도 저장 시 '현금 계좌에서도 반영'(기본 꺼짐)을 켜면 그 계좌 입출금 기록이 같이 남아 잔액과 결산이 맞음 — 저장 형식 변경 없음, 대출 연결 제외, 위험 medium(대표 승인)
3. ②에 더해 거래에 계좌 칸 신설·삭제 시 자동 되돌림 — 저장 형식 변경, 1월 이후

답이 없으면 ②로 기획 진행, 반영 여부는 PR에서 결정. 머지는 모두 12/11 이후.

## 🔴 운영 결함 (p0)
- [#104](https://github.com/BBplayworld/vaultfolio/issues/104) 앱을 연 직후 시세를 받아오는 몇 초 사이에 저장한 편집이 되돌아감 — **운영 재현 확정(기존 사용자 기록 손실)**. 수정 완료·검증 PASS(4.52 브랜치). 결산 창과 무관하게 바로 내보내도록 main 기준 **단독 핫픽스 준비 중** → qa·COO → 대표 승인 요청 예정

## 🟨 대표 승인 예정 (미리 알림)
없음.

## 🔄 진행 중 (팀 자율 — #83·#58은 대표 위임 판단: cto 통과)
| 릴리스 | 이슈 | 단계 | 일정 | 머지 방식 |
|---|---|---|---|---|
| 4.52 | [#93](https://github.com/BBplayworld/vaultfolio/issues/93) 현금·대출 잔액 한 번에 맞추기 | ⛔ **머지 보류** — 대표 지적(매수·매도↔현금·대출 흐름 등 전 자산 범위 검토 누락)으로 cto 주관 재검토 중 | 재검토 결론 후 결정 | — |
| 4.55 | #58 실물 자산 ([draft PR #101](https://github.com/BBplayworld/vaultfolio/pull/101)) | UI 승인 · qa 1차 FAIL(구버전 기기 혼재 시 클라우드 사본 실물 탈락) → 수정 c7a3bda → **qa 증분 PASS**. 남은 것: 4.52·4.53 머지 후 main 병합·완료 기준 22·최종 qa·COO | 머지 12/11~12/14 (결산 창 밖, 컷 12/18) | 조건부 팀 머지 (risk:high) |
| 4.54 | [#99](https://github.com/BBplayworld/vaultfolio/issues/99) 스크린샷 인식 실패 뒤 다음 행동 (+최신화 팁 보유 자산군만, 연 탭 자동 값 기록일) | ⛔ 머지 보류(4.52 위에 개발돼 함께 대기) — qa·COO PASS @fd0e8b3 | 4.52 재검토 결론 후 | 위임 머지 (risk:low) |
| 4.55 합류 | [#103](https://github.com/BBplayworld/vaultfolio/issues/103) 자산 간 돈의 흐름(홈 원인 상쇄 + 현금 함께 기록) | design-review 완료(spec·ui·tech-review·business 교차 승인) → 공통 A(홈 헤더 상쇄) 선행 개발 착수, B'는 대표 선택 대기 | qa PASS 컷 12/5 → 머지 12/11~12/18 | 대표 승인 (risk:medium, 4.55와 함께 high) |

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
| 4.53 [PR #98](https://github.com/BBplayworld/vaultfolio/pull/98) | 11/09 | /api/sync 남용 방어 · 운영 스모크 PASS(2기기 생성·pull·폴링·409 수렴·401) |
| 4.50 [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) | 11/08 | 주식·코인 스크린샷 보유 현황 맞추기 · 운영 스모크 PASS |
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 🔍 발굴 중 (병렬)
- 4.53이 먼저 머지됨 → 4.52는 머지 시 번호 재배정 검토.
- D8 완료: #99 선정. 보류 — 이어서 맞추기(#58 머지 뒤 1순위), 첫 결산 공백(12/11 판독 뒤), 미사용 기능 판독(12/4 상시)

## 📅 주요 일정·제약
- 결산 창(매월 28일~다음 달 10일, 현재 10/28~11/10 · 다음 11/27~12/10): 결산 화면·홈 결산 팁·첫 화면·결산 행 도착지 변경 머지 금지
- 결산 창 전 머지 컷 11/26 23:59 (#83·#93) / 12/19~12/27 머지 없음
- #54 2차 판독 경계·GA `activity:change:composition` 판독 시작 = 11/08 (#83 머지일)
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 4.53 PASS, 11/09)
