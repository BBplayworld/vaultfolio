# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. **버그·기획 누락 수정은 COO 자체 승인으로 진행되며 사후 보고는 이 페이지 목록으로만 합니다(11/09 대표 결정).** 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-11 16:26 KST** · 정기 실행(깨우기·안전망): 01:53 / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행 · 운영 최신 **v4.81**

## 🟥 대표 결정 필요 (지금)
- 없음 (11/11 v4.77·v4.78 승인)

## 🔴 운영 결함 (p0)
- 없음 (최근 핫픽스: #107 v4.57, #104 v4.53 핫픽스 — 운영 스모크 PASS)

## 🟨 대표 승인 예정 (미리 알림)
- 없음

## 🔄 진행 중
| 릴리스 | 이슈 | 단계 | 머지 방식 |
|---|---|---|---|
| — | 열린 릴리스 없음 | 다음 후보 발굴 | — |

### ⏱ 예약된 운영 확인 (11/11)
- ✅ 10:06 국내 장중 S1 PASS: '오늘' 칩 기준값(삼성전자 +1.01%·SK하이닉스 +2.00%, 전일 종가 분모)·체험 장중 숨김 규칙대로·미국 'M/D 종가' 정상
- ✅ 10:21 국내 장중 ④ PASS: 코스피 하루 +4.39% vs KODEX 200 +4.47%(차 0.08%p)·비교 페이지 하루 값 지수와 일치
- 15:40 국내 마감 직후: 현재가=종가 실측(확인되면 마감 직후 30분도 'M/D 종가' 전환 판정)
- 23:50 미국 장중: S&P 500 재대조(SPY·VOO·IVV)
- 2027-01-04 15:50 v4.78 올해 비교 연초 pending→첫 종가 전환 운영 확인(예약)
- 11/16~17 미국 일·월 새벽·12/25 국내 휴장: 휴장 칩 보강(v4.73) 확인

## ✅ 위임 머지 완료 (risk:low·medium, 사후 보고)
| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.81 [PR #158](https://github.com/BBplayworld/vaultfolio/pull/158) | 11/11 | 종목 한 장(#157) — 여러 증권사 합친 평단선·1년/5년 가격 흐름·매수 점. 인증카드 변경 0, 서버로는 종목코드·기간만. 방향 알림 '뺀 것'에 매도 점 미표시 정정 추가 · COO 위임(medium) | PASS |
| v4.80 [PR #156](https://github.com/BBplayworld/vaultfolio/pull/156) | 11/11 | 인증카드에서 금액을 숨기면 종목 보유 수량도 함께 가림(#155, 평가금액 역산 차단) · COO 위임(low) | PASS |
| v4.79 [PR #154](https://github.com/BBplayworld/vaultfolio/pull/154) | 11/11 | 자산 변화 주 탭 '최근 7일' 변화 원인(홈과 같은 숫자)·종목 등락 연결·마감 기록 접힘(#153). 뺀 것: 움직인 종목 상·하위 3·매주 팁·대출 이자 추정(규모는 대표 기준 하한 아래). 홈 원인 줄 일부 이름 정정(숫자 불변). #152 ETF 속까지는 KIS 구성 데이터 게이트 실패로 보류 · COO 위임(medium) | PASS(체험 데이터, 원인 1줄·시작 행 일치) |
| v4.76 [PR #145](https://github.com/BBplayworld/vaultfolio/pull/145) | 11/11 | 품질 묶음 5(#144) — 보유 현황 업데이트 같은 종목 이어받기를 '변경'으로 집계·표시(요약·목록 일치), 자산 변화 주식 좁은 폭 헤더 좌측 정렬 · COO 자체 승인 | PASS |
| v4.75 [PR #143](https://github.com/BBplayworld/vaultfolio/pull/143) | 11/11 | 품질 묶음 4(#142) — 주식 직접 추가 시 매수일을 수익률 역산으로 몇 년 전으로 채우던 동작(4.18~, 대표 커밋 동작 — 이견 시 revert) 제거·올해 1월 1일 기본, 체험 장중 '오늘' 칩 비현실 값 숨김, 좁은 폭 주식 목록 겹침·금액 줄바꿈 · COO 자체 승인(medium) | PASS |
| v4.74 [PR #140](https://github.com/BBplayworld/vaultfolio/pull/140) | 11/10 | 보유 현황 업데이트 후 매수일·거래 기록·올해 배당 보존(#139, 대표 지적) — 같은 종목 이어받기, 새 종목 매수일 1/1 + 시세 기준가 조회 부분 결과 결함(#141) · COO 자체 승인(medium) | PASS |
| v4.72 [PR #135](https://github.com/BBplayworld/vaultfolio/pull/135) | 11/10 | 상세·주식 '오늘' 칩(#134, 대표 지적) — 장중 '오늘', 장 종료 후 'M/D 종가', 해외는 현지 가격 등락률(증권사 앱과 같은 값), 개장 전·주말 0.0%·미국 종목 같은 값 해소 · COO 자체 승인 | PASS(장중 실측 11/11) |
| v4.71 [PR #133](https://github.com/BBplayworld/vaultfolio/pull/133) | 11/10 | GA 화면별 참여 시간 귀속 수정(#131) — 직전 화면 시간을 screen_leave로 먼저 보냄. 참여 시간 판독 경계 11/10 · COO 자체 승인 | PASS(실발화는 다음 GA CSV) |
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
| v4.78 [PR #151](https://github.com/BBplayworld/vaultfolio/pull/151) | 11/11 | 시장과 나란히 '올해' 비교(#150) — 하루·1주·1개월·올해 표, 목록 올해, 연 탭 링크 · 54a759c · 운영 스모크 PASS(코스피·S&P 500 연말 종가 일치) |
| v4.77 [PR #149](https://github.com/BBplayworld/vaultfolio/pull/149) | 11/11 | 새 종목 매수일 일괄 입력(#146)·맞추기로 끊긴 거래 다시 잇기(#147, 기록 시각 기준)·5개 이하 도넛·비중 바 최소 비중(#148) · 61a15e1 · 운영 스모크 PASS(첫 등록 교체 실 UI는 AI 인식 필요로 미확인) |
| v4.73 [PR #136](https://github.com/BBplayworld/vaultfolio/pull/136) | 11/10 | 시장과 나란히(#132) — 보유 종목 등락 vs 코스피·S&P 500 비교 페이지·진입 글줄·등락률 순 정렬 + 기간 전환 경합(#137)·시작 직후 칩(#138) 수정 · 대표 위임(COO 확인 후 팀 머지) · 운영 스모크 PASS(장중 지수 재대조 11/11) |
| v4.70 [PR #128](https://github.com/BBplayworld/vaultfolio/pull/128) | 11/10 | 월별 기록(#127) — 결산 월 탭 카드, 달마다 변화 금액 색 표시 · 운영 스모크 PASS |
| v4.69 [PR #126](https://github.com/BBplayworld/vaultfolio/pull/126) | 11/10 | 하단 네비 5칸·상단 브랜드 로고(Leckerli S+시크릿에셋)·인증카드 인디고(#125) · 운영 스모크 PASS |
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
