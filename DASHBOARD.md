# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-08 23:00 KST** · 정기 실행: 매일 07:53 / 13:53 / 19:53 KST (~12/07)

## 🟥 대표 승인 필요 (지금)
없음.

## 🟨 대표 승인 예정 (미리 알림)
| 예정일 | 대상 | 이유 |
|---|---|---|
| ~11/19 | 4.53 `/api/sync` 남용 방어 (단독 릴리스) | 동기화 라우트 수정 risk:medium |

## 🔄 진행 중 (팀 자율 — #83·#58은 대표 위임 판단: cto 통과)
| 릴리스 | 이슈 | 단계 | 일정 | 머지 방식 |
|---|---|---|---|---|
| 4.51 | #83 성과 월 탭 자산 구성 변화 블록 | 4.48 구현 재사용(cherry-pick) 개설 중 → UI·qa 재검 | 팀 머지 ≤11/13 (컷 11/26) | 팀 머지 (risk:low) |
| 4.52 | [#93](https://github.com/BBplayworld/vaultfolio/issues/93) 현금·대출 잔액 한 번에 맞추기 + p2 6건 | design-review 완료 | 개발 11/9~14 → qa ~11/17 → 머지 ≤11/19 (컷 11/26) | 위임 머지 (risk:low) |
| 4.54 | #58 실물 자산 | spec·tech-review 정정 4건 ~11/14 | 개발 11/18~12/2 → qa ~12/9 → 머지 12/11~12/14 (컷 12/18) | 조건부 팀 머지 (risk:high, 복원·왕복·동기화 테스트 필수) |

## ✅ 위임 머지 완료 (risk:low, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

## ✅ 대표 승인 머지 완료 (최근)
| 릴리스 | 머지일 | 내용 |
|---|---|---|
| 4.50 [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) | 11/08 | 주식·코인 스크린샷 보유 현황 맞추기 (운영 스모크 진행 중) |
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 📅 주요 일정·제약
- 결산 창 11/27~12/10: 결산 화면·홈 결산 팁·첫 화면 변경 머지 금지
- 결산 창 전 머지 컷 11/26 23:59 (#83·#93) / 12/19~12/27 머지 없음
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 4.49 PASS)
