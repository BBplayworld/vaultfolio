# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. **버그·기획 누락 수정은 COO 자체 승인으로 진행되며 사후 보고는 이 페이지 목록으로만 합니다(11/09 대표 결정).** 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 20:10 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 승인 필요 (지금)
없음.

## 🔴 운영 결함 (p0)
- [#107] → 핫픽스 PR #108 위임 머지 41fbc03(v4.57) · **운영 스모크 PASS**
- [#104] → 핫픽스 PR #105 **대표 승인·머지 028cffd(11/09) · 운영 스모크 PASS**

## 🟨 대표 승인 예정 (미리 알림)
- 없음

## 🔄 진행 중 (완료 즉시 머지 — 결산 창 제약 해제, 대표 11/09)
| 릴리스(운영 표시) | 이슈 | 단계 | 일정(목표) | 머지 방식 |
|---|---|---|---|---|
| **#127** (신규 기능) | [#127](https://github.com/BBplayworld/vaultfolio/issues/127) 월별 기록 — 지난 여러 달의 자산군별 금액을 앱 안에서 한눈에(엑셀 월별 시트 대체) | 사업 선정·COO 축소 통과 → 기획 경험 절·UI → 개발 | 11/26 전 목표 | 🟥 대표 승인 예정 |
| **4.66** [PR #126](https://github.com/BBplayworld/vaultfolio/pull/126) | 대표 방향 수정(11/09): 인증카드는 핵심 기능 — 더보기 대신 페이지/상단 배치로 재기획 중 | 기획·사업·COO(축소 통과, 12/4 보류 해제)·UI 완료 → 개발 완료(82e5186) → UI 승인·qa PASS·COO PASS → 🟥 대표 승인 대기 | 11/26 전 목표 | 🟥 대표 승인 예정 |

## ✅ 위임 머지 완료 (risk:low·medium, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.65 [PR #123](https://github.com/BBplayworld/vaultfolio/pull/123) | 11/09 | 외화 환율 잔차 수정(#122) — 해외주식 매매·달러 현금 입출금의 환율 차이가 '대출 일부 예측'·'주식 매도'로 잘못 보이던 것을 '환율'로 · COO 자체 승인 | PASS |
| v4.64 [PR #121](https://github.com/BBplayworld/vaultfolio/pull/121) | 11/09 | 12월 결산 대비 결함 수정(#117 리허설 33조합) — 판 주식·코인의 이익이 '기록 안 된 변화·매수' 대신 '시세'로 분류, 보유 현황 맞추기 미리보기 문구 정정 + 품질 정돈 묶음 3(#118: 연 수익률 0 회색·허브 320·맞추기 창 포커스) · COO 자체 승인 | PASS |
| v4.63 [PR #120](https://github.com/BBplayworld/vaultfolio/pull/120) | 11/09 | 거래 연결 계좌 — 해외주식을 원화 계좌·대출로 연결(#119, 대표 지적 기획 누락 보완, COO 자체 승인) — 원화 예수금으로 산 미국·일본 주식도 현금·대출 함께 증감, 지난달 거래 안내 1줄 | PASS |
| v4.62 [PR #116](https://github.com/BBplayworld/vaultfolio/pull/116) | 11/09 | 품질 정돈 묶음 2(#115) — 홈 최신화·백업 팁 1초 교체 해소, 상세 손익 0 회색(10곳), 되돌린 맞추기 ✓ 제거, 추가 시트 닫힘 포커스, 320 줄바꿈 · 팀 운영 문서(CLAUDE.md 등) 위임 규칙을 11/09 결정에 맞게 정정 | PASS |
| v4.61 [PR #114](https://github.com/BBplayworld/vaultfolio/pull/114) | 11/09 | 첫 화면 빈 화면 없애기(#113, medium·COO 자체 승인) — 처음 온 사람은 데이터 로드 전에도 웰컴 첫 부분을 바로 봄, 자산 보유자 깜빡임 0, 인앱 빈 덮개 제거 | PASS |
| v4.60 [PR #112](https://github.com/BBplayworld/vaultfolio/pull/112) | 11/09 | 품질 정돈 묶음(#109, medium·COO 자체 승인) — 코인·묶음 삭제 시 거래 기록 함께 정리(지난 결산 불변), 외화 `$0` 문구·달러 반올림, 손익 0 회색, 잔액 맞추기 포커스, 아주 작은 이미지 인식 차단 | PASS |
| v4.59 [PR #111](https://github.com/BBplayworld/vaultfolio/pull/111) | 11/09 14:19 | 이어서 맞추기 — 저장 후 추가 시트가 목록으로 돌아와 다음 자산군 바로 맞추기, 오늘 맞춘 자산군 ✓(#110) | PASS |
| v4.57 핫픽스 [PR #108](https://github.com/BBplayworld/vaultfolio/pull/108) | 11/09 | 코인 즉시 반영 저장 차단·현금 0원 저장 실패 수정(#107) | PASS |
| v4.56 [PR #101](https://github.com/BBplayworld/vaultfolio/pull/101) | 11/09 | 실물 자산 등록(#58, 대표 위임)·홈 원인에서 자산 간 이동 상쇄(#103 A) | D0 PASS(동기화 pull은 D+1에서) · D+1 11/10 |
| v4.55 [PR #102](https://github.com/BBplayworld/vaultfolio/pull/102) | 11/09 | 스크린샷 인식 실패 뒤 다음 행동·최신화 팁 보유 자산군만·연 탭 자동 값 기록일(#99) | PASS |
| 4.51 [PR #95](https://github.com/BBplayworld/vaultfolio/pull/95) | 11/08 23:15 | 성과 월 탭 자산 구성 변화 블록(#83, 대표 위임 판단) ⚠️ 10월 결산 창 안 머지(판정 누락, 블록 추가뿐이라 유지·C39 추가) | PASS |
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

## ✅ 대표 승인 머지 완료 (최근)
| 릴리스 | 머지일 | 내용 |
|---|---|---|
| v4.58 [PR #106](https://github.com/BBplayworld/vaultfolio/pull/106) | 11/09 | 거래 연결 계좌 — 매수·매도 시 현금·대출 함께 증감, 삭제 시 되돌림(#103) · 운영 스모크 D0 PASS · D+1 11/10 |
| v4.54 [PR #96](https://github.com/BBplayworld/vaultfolio/pull/96) | 11/09 | 현금·대출 잔액 한 번에 맞추기 + 전 자산 흐름 보강 · 운영 스모크 PASS |
| v4.53 핫픽스 [PR #105](https://github.com/BBplayworld/vaultfolio/pull/105) | 11/09 | 시세 갱신 중 저장한 편집 되돌아감 결함(#104) · 운영 스모크 PASS |
| 4.53 [PR #98](https://github.com/BBplayworld/vaultfolio/pull/98) | 11/09 | /api/sync 남용 방어 · 운영 스모크 PASS(2기기 생성·pull·폴링·409 수렴·401) |
| 4.50 [PR #92](https://github.com/BBplayworld/vaultfolio/pull/92) | 11/08 | 주식·코인 스크린샷 보유 현황 맞추기 · 운영 스모크 PASS |
| 4.47 [PR #88](https://github.com/BBplayworld/vaultfolio/pull/88) | 11/07 | 동기화 충돌 시 로컬 편집 소실 알림·되돌리기 |
| 문서 [PR #87](https://github.com/BBplayworld/vaultfolio/pull/87) | 11/07 | 머지 위임(저위험) 규칙 반영 |
| 4.44 [PR #76](https://github.com/BBplayworld/vaultfolio/pull/76) | 11/06 | 상세 다크 BOX·구분선 정리 |

## 🔍 발굴·기획 중 (병렬)
- 관찰 후보: 홈 최신화 팁이 약 1.2초 뒤 다음 팁으로 바뀜(v4.59 운영 스모크, 기존 동작·실사용자 재현 미확인)
- 보류: 첫 결산 공백(12/11 판독 뒤), 미사용 기능 판독(12/4), 기존 고아 거래 일괄 정리(1월 이후, high)

## 📅 주요 일정·제약
- 결산 기간 머지 금지: **11/09 대표 결정으로 해제** — 준비된 릴리스는 결산 기간에도 바로 머지(판독 경계일 기록은 유지)
- 핫픽스: 팀 위임 머지(11/09 대표 결정)
- risk:low·medium: COO 판단으로 팀 자체 승인·머지(11/09 대표 결정). risk:high·제품 원칙·결제·외부 게시만 대표 승인
- 결산 창 전 머지 컷 11/26 23:59 (#83·#93) / 12/19~12/27 머지 없음
- #54 2차 판독 경계·GA `activity:change:composition` 판독 시작 = 11/08 (#83 머지일)
- 12/11: #51·#54 지표 판독 / ~12/25: #48 판독 / ~2/5: #93 판독
- 운영: 이상 없음 (최근 스모크 v4.65 PASS, 11/09)
