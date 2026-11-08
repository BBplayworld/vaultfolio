# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-08 22:30 KST** · 정기 실행: 매일 07:53 / 13:53 / 19:53 KST (~12/07)

## 🟥 대표 승인 필요 (지금)
| 릴리스 | 내용 | 위험 | 미리보기 · 확인 경로 | 결정 |
|---|---|---|---|---|
| **4.50** [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) (#91) | 주식·코인 잔고 스크린샷 최대 5장으로 보유 현황 맞추기 — 미리보기·되돌리기, 매수/매도 기록·매입 환율 보존, 덮어쓰기/초기화 통합 | high (대량 수정이 동기화로 전파) | [preview](https://secretasset-git-issue-450-bbplayworlds-projects.vercel.app/?demo=1) › FAB › 보유 현황 업데이트 › 주식/코인 › 스크린샷 | 머지=반영 / 닫기=미반영 · 권장 ≤11/26 (#93 개발 선행 조건) · **대표 상세 검토 중** |

검증: qa PASS · UI 승인 · COO PASS @f2661d7 · Vercel success. 한계: 거래 기록 미생성, 화면에 평단·환율 없으면 기존 값 유지, 되돌리기는 결과 화면·직후 토스트만, 증권사 앱별 인식 정확도 미검증. 상세: [decision-brief](https://github.com/BBplayworld/vaultfolio/blob/memory/issues/4.50-91-screenshot-resync/4.50-decision-brief.md)

## 🟨 대표 승인 예정 (미리 알림)
| 예정일 | 대상 | 이유 |
|---|---|---|
| ~12/11 | #83 월 탭 자산 구성 블록 (브랜치 issue-4.48 대기, 머지 시 번호 재배정) + p2 `/api/sync` 남용 방어 | 결산 화면 변경(12/11~12/26 머지) · 동기화 라우트 수정 risk:medium |
| ~1/12 | #58 실물 자산 | 저장 키 추가 risk:high |

## 🔄 진행 중 (팀 자율)
| 이슈 | 단계 | 다음 일정 | 머지 방식 |
|---|---|---|---|
| [#93](https://github.com/BBplayworld/vaultfolio/issues/93) 현금·대출 잔액 한 번에 맞추기 (+p2 6건: 연 탭 작년 말 순자산 링크, 직접 갱신 최신화 인정, NEW 정리, 업로드 문구·오타, 적용 환율, 저장 실패 알림) | design-review 완료 | 4.50 머지 후 4.51 개발 11/27~12/5 → qa ~12/9 | 위임 머지 12/11 목표 (risk:low) |

## ✅ 위임 머지 완료 (risk:low, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

## ✅ 대표 승인 머지 완료 (최근)
| 릴리스 | 머지일 | 내용 |
|---|---|---|
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 📅 주요 일정·제약
- 결산 창 11/27~12/10: 결산 화면·홈 결산 팁·첫 화면 변경 머지 금지
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 4.49 PASS)
