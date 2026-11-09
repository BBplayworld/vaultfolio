# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. **버그·기획 누락 수정은 COO 자체 승인으로 진행되며 사후 보고는 이 페이지 목록으로만 합니다(11/09 대표 결정).** 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-09 23:30 KST** · 정기 실행(깨우기·안전망): 01:53(알림 없음) / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행

## 🟥 대표 승인 필요 (지금)
**⏸ (R2 수정 중, 승인 보류) v4.66 반영 결정 — [PR #126](https://github.com/BBplayworld/vaultfolio/pull/126) (#125 하단 네비 개편 v2, risk:low)** · 승인 시 표시 버전 v4.69(main 반영·증분 qa 후 머지)
- ✅ 권고: 반영 — 대표 지시대로 인증카드는 핵심 기능으로 **상단 오른쪽**(설치 앱도 브라우저와 동일), 더보기는 설정 전용 그대로. 하단은 홈·상세·[업데이트]·성과·더보기 5칸(업데이트 가운데)
- 🖼 전/후(설치 앱 홈 375): [ui2-compare-before-after-375-light.png](issues/4.66-125-nav-restructure/screenshots/ui2-compare-before-after-375-light.png)
- 🔗 preview: https://secretasset-git-issue-466-bbplayworlds-projects.vercel.app — 하단 메뉴는 설치 앱에서만 보임(휴대폰 '홈 화면에 추가' → '데모 데이터로 보기'). 브라우저 화면은 변화 없음
- 🔁 대표 지적 R1 반영: 앱 홈 상단 'S' → 화면 제목 "홈"(상세·성과와 같은 제목 줄), 'S'는 하단 홈 탭에만 · 전/후: [before 375](issues/4.66-125-nav-restructure/screenshots/ui-r1-before-375-light.png) → [after 375](issues/4.66-125-nav-restructure/screenshots/qa-r1-pwa375-home-light.png)
- 🧪 qa PASS · UI 승인 · COO PASS · Vercel success @94e54ec (R1 7276c84 + main v4.68 병합)
- ⚠️ 비용: 인증카드가 엄지 쪽 하단 → 화면 위쪽(홈·상세·주식·성과·자산 변화 5개 화면 1탭, 그 밖 2탭) · 앱 홈 첫 카드 +20px(아이폰 +44, PC 앱 +40) · 앱 360·375 상세 부제 2줄 · 옛 칸 자리 오탭은 화면 이동만(데이터 변화 0) · 실기기 앱 미검증(에뮬레이션)
- ↩️ 롤백: PR revert 1회 · 브리프: [4.66-decision-brief-v2.md](issues/4.66-125-nav-restructure/4.66-decision-brief-v2.md)
- 👉 결정: PR #126 머지 = 반영 / 닫기 = 미반영 · '홈' 제목이 여전히 비어 보이면 `수정: 제목 크기`

**v4.67 반영 결정 — [PR #128](https://github.com/BBplayworld/vaultfolio/pull/128) (#127 월별 기록, 신규 기능, risk:low)** · 승인 시 다음 표시 버전(v4.69 또는 v4.70)
- ✅ 권고: 반영 — 엑셀 '월별 자산 현황' 시트를 앱 안에서 대체: 성과 › 월 탭에 '월별 기록' 행 → 지난 여러 달의 자산군별 금액·순자산 표(최신순, 최대 13개월). 앱 밖으로 내보내기 없음
- 🖼 화면: [375 라이트](issues/4.67-127-monthly-log/screenshots/qa4-fix-w375-light.png) · [375 다크](issues/4.67-127-monthly-log/screenshots/qa4-fix-w375-dark.png) · [1280](issues/4.67-127-monthly-log/screenshots/qa4-fix-w1280-light.png)
- 🔗 preview: https://secretasset-git-issue-467-bbplayworlds-projects.vercel.app — 성과 › 월 탭 › 월별 기록 (데모 10월 줄 '—'는 데모 데이터 오타, 실사용 무관)
- 🔁 대표 지적 R1 반영: ① 구성 변화 막대 자산군별 최소 폭 7%(실제 %는 아래 목록 그대로) [375](issues/4.67-127-monthly-log/screenshots/ui-u3-w375-light-composition.png) ② 월별 기록 표 가로 스크롤 1개로 통일 — 열 순서 `월 | 순자산 | 부동산…`, 월 열만 고정 [375](issues/4.67-127-monthly-log/screenshots/ui-u3-w375-light-sheet.png) · [밀었을 때](issues/4.67-127-monthly-log/screenshots/ui-u3-w375-light-sheet-scrolled.png)
- ℹ️ iOS 실기기 재현은 못 했습니다(팀 환경에 iOS Safari 없음). 대표님 캡처를 픽셀 단위로 대조해 원인을 확정하고 조치했습니다.
- 🔁 R2 원인: 가로 스크롤은 처음부터 1개, iOS가 고정된 '월' 칸을 스크롤 막대 위에 그려 막대가 두 조각으로 보임 → 고정 칸을 막대 아래로·표 아래 여백 12px·끝에서 튕김 차단(저장·데이터 변경 0)
- 📱 iPhone 확인: preview `?trial=1` › 성과 › 월 탭 › 월별 기록에서 표를 좌우 끝까지 밀었을 때 아래 막대가 한 줄로 이어지면 반영된 상태
- 🧪 qa PASS · UI 승인 · COO PASS · Vercel success @0c05de1
- ⚠️ 한계: 값은 '그 달 마지막으로 앱을 연 날' 기준(캡션으로 안내) · 375에서 자산군 5개 이상·10억 이상이면 가로 스크롤 · 7/23 이전 달은 순자산만
- #32 관계: 결산 Hero로 옮긴 월별 증감은 다시 넣지 않았고, 사라졌던 '여러 달 한눈에'만 금액 표로 되살림
- 📏 판독: 머지~1/10 사용자 3명 이상 유지 / 0~1명 제거 후보 · ↩️ 롤백: PR revert 1회
- 👉 결정: PR #128 머지 = 반영 / 닫기 = 미반영 · 폰에서 스크롤이 여전히 2개로 보이면 캡처와 함께 `수정:` · 브리프: [4.67-decision-brief.md](issues/4.67-127-monthly-log/4.67-decision-brief.md)

## 🔴 운영 결함 (p0)
- [#107] → 핫픽스 PR #108 위임 머지 41fbc03(v4.57) · **운영 스모크 PASS**
- [#104] → 핫픽스 PR #105 **대표 승인·머지 028cffd(11/09) · 운영 스모크 PASS**

## 🟨 대표 승인 예정 (미리 알림)
- 없음

## 🔄 진행 중 (완료 즉시 머지 — 결산 창 제약 해제, 대표 11/09)
| 릴리스(운영 표시) | 이슈 | 단계 | 일정(목표) | 머지 방식 |
|---|---|---|---|---|
| **4.67** [PR #128](https://github.com/BBplayworld/vaultfolio/pull/128) | [#127](https://github.com/BBplayworld/vaultfolio/issues/127) 월별 기록 — 지난 여러 달의 자산군별 금액 한눈에(엑셀 월별 시트 대체) | R2 반영(iOS 스크롤 막대 가림 원인 확정·조치) 완료(0c05de1) → 🟥 대표 재승인 대기 | 11/26 전 | 🟥 대표 승인 |
| **4.66** [PR #126](https://github.com/BBplayworld/vaultfolio/pull/126) | [#125](https://github.com/BBplayworld/vaultfolio/issues/125) 하단 네비 정리 — 업데이트 가운데, 인증카드 상단 오른쪽(설치 앱 포함) | 대표 R2 지적('홈' 글씨 어색, 공식 느낌 필요) → 상단 브랜드 재설계 중 | 11/26 전 | 🟥 대표 승인 |

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
- 운영: 이상 없음 (최근 스모크 v4.68 PASS, 11/09)
