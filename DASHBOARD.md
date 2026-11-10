# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. **버그·기획 누락 수정은 COO 자체 승인으로 진행되며 사후 보고는 이 페이지 목록으로만 합니다(11/09 대표 결정).** 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 23:30 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 승인 필요 (지금)
**v4.66 반영 결정 — [PR #126](https://github.com/BBplayworld/vaultfolio/pull/126) (#125 하단 네비 개편 + 상단 브랜드 로고, risk:low)** · 머지 시 [#4.69](4.67보다 먼저일 때)
- ℹ️ 실기기 설치 앱 미검증(에뮬레이션 측정만)
- 반영: 상단 Leckerli S + 시크릿에셋 단색 락업, 인증카드 버튼 메인 인디고(앱 설치·하단 업데이트와 같은 색), 하단 홈 탭 집 아이콘, 브라우저 S도 앱과 같은 크기(15.25px)
- 🔗 preview: https://secretasset-git-issue-466-bbplayworlds-projects.vercel.app/?trial=1 — 맨 위 줄(설치 앱은 S+시크릿에셋, 브라우저는 S)과 오른쪽 인디고 인증카드, 하단 '상세' → 허브 인증카드
- 🖼 최종: [375 다크](issues/4.66-125-nav-restructure/screenshots/final-r8-375-dark.png) · [375 라이트](issues/4.66-125-nav-restructure/screenshots/final-r8-375-light.png) · [로고 3배](issues/4.66-125-nav-restructure/screenshots/final-r8-lockup-zoom-dark.png) · [브라우저 375](issues/4.66-125-nav-restructure/screenshots/final-r8b-brw375-light.png)
- 🧪 qa PASS · UI 승인 · COO PASS @565b047 · Vercel success · 위험 low, PR revert로 원복
- 👉 결정: PR #126 머지 = 반영 / 닫기 = 미반영

**v4.67 반영 결정 — [PR #128](https://github.com/BBplayworld/vaultfolio/pull/128) (#127 월별 기록, risk:low)** · 머지 시 [#4.69](4.66보다 먼저일 때, 나중이면 [#4.70])
- ✅ 권고: 반영 — 지적하신 대로 다이얼로그 없이 결산 월 탭 안 카드로, 달마다 순자산 아래 앞 기록 대비 변화를 빨강(증가)·파랑(감소) 원 단위로 표시
- 📦 줄을 누르면 자산군별 금액·변화 펼침(이번 달 기본 펼침). 변화는 화면 금액끼리 뺀 값이고, 위 결산 증감도 같은 방식으로 맞춰 원 단위까지 같은 숫자
- 🔗 preview: https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app/?demo=1 — 성과 › 자산 변화 › 월 탭 › 자산 구성 변화 아래 '월별 기록'
- 🖼 최종: [모바일 기본](issues/4.67-127-monthly-log/screenshots/qa-r3c-w375-dark-demo.png) · [허브와 숫자 일치](issues/4.67-127-monthly-log/screenshots/qa-r3c-w375-dark-demo-base-hub.png) · [데스크톱](issues/4.67-127-monthly-log/screenshots/dev-r3c-w1280-dark.png)
- 🧪 qa PASS · UI 승인 · COO PASS · Vercel success @4745c64 · 위험 low(저장·동기화·서버 전송 변경 0), PR revert 1회
- 👉 결정: PR #128 머지 = 반영 / 닫기 = 미반영

## 🔴 운영 결함 (p0)
- [#107] → 핫픽스 PR #108 위임 머지 41fbc03(v4.57) · **운영 스모크 PASS**
- [#104] → 핫픽스 PR #105 **대표 승인·머지 028cffd(11/09) · 운영 스모크 PASS**

## 🟨 대표 승인 예정 (미리 알림)
- 없음

## 🔄 진행 중 (완료 즉시 머지 — 결산 창 제약 해제, 대표 11/09)
| 릴리스(운영 표시) | 이슈 | 단계 | 일정(목표) | 머지 방식 |
|---|---|---|---|---|
| **4.73** | [#134](https://github.com/BBplayworld/vaultfolio/issues/134) 상세·주식 '오늘' 칩 — 개장 전·주말 0.0%, 미국 종목 낮 시간 환율분만 같은 값(버그, #132 선행) | ✅ v4.72 머지(962830d)·운영 스모크 PASS(국내 장중·마감 직후 실측은 11/11 예약) | 즉시 | COO 자체 승인 |
| **4.71** | [#131](https://github.com/BBplayworld/vaultfolio/issues/131) GA 화면별 참여 시간이 다음 화면으로 밀려 집계(버그, 선순위) | 개발 착수 | 즉시 | COO 자체 승인 |
| **4.72** | [#132](https://github.com/BBplayworld/vaultfolio/issues/132) 시장과 나란히 — 보유 종목 등락 vs 코스피·S&P 500 + 오늘 등락 순 + '오늘' 표시 점검 | [PR #136](https://github.com/BBplayworld/vaultfolio/pull/136) 개발 U1~U3 완료(지수 조회 게이트 통과) → 미결 규칙 COO 확정 → U4~U7 | 11/26 전 | 🟥 대표 승인(반영 1회) |

## ✅ 위임 머지 완료 (risk:low·medium, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.68 [PR #130](https://github.com/BBplayworld/vaultfolio/pull/130) | 11/09 | 억 단위 축약 표기 오차 수정(#129) — 홈·순자산 차트에서 2.3억이 2.29억으로 보이던 것을 바로잡음 · COO 자체 승인 | PASS |
| v4.65 [PR #123](https://github.com/BBplayworld/vaultfolio/pull/123) | 11/09 | 외화 환율 잔차 수정(#122) — 해외주식 매매·달러 현금 입출금의 환율 차이가 '대출 일부 예측'·'주식 매도'로 잘못 보이던 것을 '환율'로 · COO 자체 승인 | PASS |
| v4.64 [PR #121](https://github.com/BBplayworld/vaultfolio/pull/121) | 11/09 | 12월 결산 대비 결함 수정(#117 리허설 33조합) — 판 주식·코인의 이익이 '기록 안 된 변화·매수' 대신 '시세'로 분류, 보유 현황 맞추기 미리보기 문구 정정 + 품질 정돈 묶음 3(#118: 연 수익률 0 회색·허브 320·맞추기 창 포커스) · COO 자체 승인 | PASS |
| v4.63 [PR #120](https://github.com/BBplayworld/vaultfolio/pull/120) | 11/09 | 거래 연결 계좌 — 해외주식을 원화 계좌·대출로 연결(#119, 대표 지적 기획 누락 보완, COO 자체 승인) — 원화 예수금으로 산 미국·일본 주식도 현금·대출 함께 증감, 지난달 거래 안내 1줄 | PASS |
| v4.62 [PR #116](https://github.com/BBplayworld/vaultfolio/pull/116) | 11/09 | 품질 정돈 묶음 2(#115) — 홈 최신화·백업 팁 1초 교체 해소, 상세 손익 0 회색(10곳), 되돌린 맞추기 ✓ 제거, 추가 시트 닫힘 포커스, 320 줄바꿈 · 팀 운영 문서(CLAUDE.md 등) 위임 규칙을 11/09 결정에 맞게 정정 | PASS |
| v4.61 [PR #114](https://github.com/BBplayworld/vaultfolio/pull/114) | 11/09 | 첫 화면 빈 화면 없애기(#113, medium·COO 자체 승인) — 처음 온 사람은 데이터 로드 전에도 웰컴 첫 부분을 바로 봄, 자산 보유자 깜빡임 0, 인앱 빈 덮개 제거 | PASS |
| v4.60 [PR #112](https://github.com/BBplayworld/vaultfolio/pull/112) | 11/09 | 품질 정돈 묶음(#109, medium·COO 자체 승인) — 코인·묶음 삭제 시 거래 기록 함께 정리(지난 결산 불변), 외화 `$0` 문구·달러 반올림, 손익 0 회색, 잔액 맞추기 포커스, 아주 작은 이미지 인식 차단 | PASS |
| v4.59 [PR #111](https://github.com/BBplayworld/vaultfolio/pull/111) | 11/09 14:19 | 이어서 맞추기 — 저장 후 추가 시트가 목록으로 돌아와 다음 자산군 바로 맞추기, 오늘 맞춘 자산군 ✓(#110) | PASS |
| v4.57 핫픽스 [PR #108](https://github.com/BBplayworld/vaultfolio/pull/108) | 11/09 | 코인 즉시 반영 저장 차단·현금 0원 저장 실패 수정(#107) | PASS |
| v4.56 [PR #101](https://github.com/BBplayworld/vaultfolio/pull/101) | 11/09 | 실물 자산 등록(#58, 대표 위임)·홈 원인에서 자산 간 이동 상쇄(#103 A) | D0 PASS · D+1 PASS(11/10, 기기 간 동기화 pull 확인) |
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
- 운영: 이상 없음 (최근 스모크 v4.68 PASS, 11/09)
