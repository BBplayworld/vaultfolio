# 📋 시크릿에셋 대표 대시보드

> 대표는 이 페이지만 보고 승인·진행을 판단합니다. **버그·기획 누락 수정은 COO 자체 승인으로 진행되며 사후 보고는 이 페이지 목록으로만 합니다(11/09 대표 결정).** 팀이 매 실행·단계 변화마다 이 파일 전체를 갱신합니다.
> 고정 주소: https://github.com/BBplayworld/vaultfolio/blob/memory/DASHBOARD.md
> **마지막 갱신: 2026-11-14 (주말 정리)** · 정기 실행(깨우기·안전망): 01:53 / 07:53 / 13:53 KST (~12/07) · 그 사이에도 한도 내 지속 진행 · 운영 최신 **v5.104**

## 🟥 이번 주말 대표님이 하실 일 — 1건
1. **📊 [#201](https://github.com/BBplayworld/vaultfolio/issues/201) 원문 통계표 1개 (11/16까지)** — 2025년 가계금융복지조사 '순자산 구간별 가구 분포' 표
   - 방법 택1: ⓐ 표 파일·보도자료 PDF 전달 ⓑ 이 환경에 kosis.kr·mods.go.kr 접속 허용
   - 11/17까지 없으면 보류(2차 보도 값으로 대신하지 않음)

## 🟨 다음 대표 결정 (팀 준비 중 — 지금 할 일 없음)
| 언제 | 무엇 | 대표 할 일 |
|---|---|---|
| ~11/25 | 🔔 PWA 알림 **A 교체**(지수 → 결산 열림 + 세금 마감 2건) [PR #180](https://github.com/BBplayworld/vaultfolio/pull/180) | 데모 확인 후 머지(=반영) · 11/27 첫 발송 목표, 늦으면 12월 창 |
| 표 수령 후 | #201 순자산 공개 통계 비교 [PR #202](https://github.com/BBplayworld/vaultfolio/pull/202) | 데모 확인 후 머지 |
| 개선안 후 | 홈 전일대비 영역 정보 정리(대표 지적 11/14) | 위임 범위면 팀 머지, 큰 방향 변경이면 승인 요청 |

## 📅 예정된 자료 요청 (날짜 되면 다시 알림)
- 11/18 · 11/25 · 12/9 전후: GA '페이지 및 화면' + '세션 소스/매체' CSV 각 1장(대표 기기 제외 7일)
- 12/11 전후: GA '홈' × 날짜 CSV 1장(결산 창 구간)

<details>
<summary>⚪ 여유 있을 때만 (선택, 급하지 않음)</summary>

- 검색 색인: 서치어드바이저 '수집 제한 3' URL이 /api/로 시작하는지, 구글 서치콘솔 등록 여부 — 답 없으면 팀이 sitemap·내부 링크로만 보강
</details>

<details>
<summary>✅ 최근 정리된 요청 (11/14)</summary>

- ETF 구성종목([#152](https://github.com/BBplayworld/vaultfolio/issues/152)): 국내(KRX PDF)·해외(SEC N-PORT) 원천 데이터 확보 경로 불명확 → **보류 유지, 대표 확인 요청 종료**. 무료·공식 전량 출처가 생기면 팀이 재검토
- PWA 알림: 데모 정상 확인 · 알림 내용 재검토 → **A 교체 결정**
- GA 7일 CSV·홈 기준선(일평균 4.4명) 수령 · 네이버 호스트 등록 확인 · Vercel 환경 변수 등록
</details>

## 🔴 운영 결함 (p0)
- 없음 (최근 핫픽스: #107 v4.57, #104 v4.53 핫픽스 — 운영 스모크 PASS)

## 🔄 진행 중
| 릴리스 | 이슈 | 단계 | 머지 방식 |
|---|---|---|---|
| (PWA) | [#179](https://github.com/BBplayworld/vaultfolio/issues/179) PWA 알림 **A 교체**(결산 열림+세금 마감, 대표 결정 11/14) | 재개발 중(origin/main 병합 포함) → qa·COO | 대표 승인(risk:high) |
| (신규) | 홈 전일대비 영역 정보 정리(대표 지적 11/14) | UI 개선안 작성 중 | 판정 후 결정 |
| v5.102 | [#201](https://github.com/BBplayworld/vaultfolio/issues/201) 내 순자산이 어디쯤인지 — 공개 가계 통계와 나란히 보기(신규) | 개발 1차 완료 [PR #202](https://github.com/BBplayworld/vaultfolio/pull/202)(draft, 통계 값 비어 화면 미표시) · 원문 표 대기(11/16) | **대표 승인**(원칙 3 인접, COO 판정) |

### ⏱ 예약된 운영 확인
- 2026-12-01~ #201: 2026년 가계금융복지조사(12월 첫 주 발표 예정) 공표 확인 → 통계 상수 교체(경량 트랙 + qa 원문 전수 대조)
- 15:40 국내 마감 직후: 현재가=종가 실측(확인되면 마감 직후 30분도 'M/D 종가' 전환 판정)
- 2027-01-04 15:50 v4.78 올해 비교 연초 pending→첫 종가 전환 운영 확인(예약)
- 11/16~17 미국 일·월 새벽·12/25 국내 휴장: 휴장 칩 보강(v4.73) 확인

## ✅ 위임 머지 완료 (risk:low·medium, 사후 보고 — 히스토리)
> 팀이 자체 승인·머지한 릴리스를 **묶음 단위**로 모읍니다. 최신 묶음은 펼쳐 두고 지난 묶음은 접습니다. 새 머지가 생길 때마다 최신 묶음에 추가하고, 묶음이 5건 이상이 되거나 날짜가 바뀌면 다음 묶음을 엽니다(묶음 머리줄에 한 줄 요약 갱신).

### 📦 묶음 7 · 11/13~ · v4.98~ (진행 중)
**요약**: 배당 조회 실패 후속 정합, 보유 현황 스크린샷 인식 정확도(평단가·종목명·문구·한도·IRP, 대표 지적), 320 화면 정돈

| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v5.104 [PR #206](https://github.com/BBplayworld/vaultfolio/pull/206) | 11/14 | 배당 '12월 예정' 칩 360·375 겹침 정리(#205) — 640 미만 칩 축소 규칙 확대, 칸 내 다른 요소 diff 0 · COO 자체 승인(low) | PASS |
| v5.103 [PR #204](https://github.com/BBplayworld/vaultfolio/pull/204) | 11/14 | 320 화면 정돈(#203) — 맞추기 '항목 선택' 칸 좌측 정렬·말줄임, 성적표 측정불가 축 제목 한 줄(배당 칩은 부작용으로 제외·후속) · COO 자체 승인(low) | PASS |
| v5.101 [PR #200](https://github.com/BBplayworld/vaultfolio/pull/200) | 11/13 | 스크린샷 맞추기 정확도(#199, 대표 지적) — 한 장 안 칸 배치 일관(브로드컴 평단), 잘린 이름·'현금 \| 티커' 정리, IRP 등 다른 유형 보유분 후보·'새 항목으로 추가', 대표 5장 정답 38/42→42/42 · COO 자체 승인(medium) | PASS(운영 대표 5장 21/21) |
| v5.0 [PR #197](https://github.com/BBplayworld/vaultfolio/pull/197) | 11/13 | 스크린샷 등록 평단가를 맞게 읽고 맞게 말하기(#196) + 대표 지적 #198 — 종목명 끝 '('·'(수량)' 정리·두 줄 이름, '이 항목도 맞추기'·'같은 종목이 여러 곳에 있어요' 문구, 하루 인식 1인 30·전체 1500회 · COO 자체 승인(medium) | PASS(합성 6종 정확) |
| v4.99 [PR #194](https://github.com/BBplayworld/vaultfolio/pull/194) | 11/13 | 보유 현황 스크린샷 2줄 헤더(메리츠·키움)에서 평단가·현재가 바로 읽기(#193, 대표 지적) — 기존 평단을 현재가로 덮어쓰던 결함, 수익률 정합 검사로 교정 · COO 자체 승인(low) | PASS(운영 인식 메리츠 2/2·키움 8/8) |
| v4.98 [PR #192](https://github.com/BBplayworld/vaultfolio/pull/192) | 11/13 | 배당을 못 불러온 날 자산 성적표를 확정·기록하지 않기(#191) — 수익의 질·레버리지 '잠정'·점수 '—', 상단 '5축 중 N축 잠정'·칩 정합, 틀린 등급 저장 차단 · COO 자체 승인(low) | PASS |

<details>
<summary><b>📦 묶음 6 · 11/13 · v4.92~v4.97 (5건)</b> — 정합·정확도·신뢰성 — 돌아온·처음 온 사용자 숫자, 처음 맞는 결산, '일' 탭=홈, 모바일 숫자 한 줄, 배당 실패 처리·입력 날짜 한국 시간</summary>

| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.97 [PR #190](https://github.com/BBplayworld/vaultfolio/pull/190) | 11/13 | 배당 조회 실패를 '배당 없음'으로 굳히지 않기(안내 1줄·전부 실패 시 '—')·새 자산 입력 기본 날짜 한국 시간(#189) · COO 자체 승인(low) | PASS |
| v4.96 [PR #188](https://github.com/BBplayworld/vaultfolio/pull/188) | 11/13 | 달력·7일 막대 숫자 한 줄로·칸 증감 정확하게(#187) — 모바일에서 '원' 단위 줄바꿈 제거, 375 이상 1천만~1억 증감 억 소수 2자리 · COO 자체 승인(low) | PASS |
| v4.95 [PR #186](https://github.com/BBplayworld/vaultfolio/pull/186) | 11/13 | 버그·품질 묶음(#184) — 자산 변화 '일' 탭 숫자 = 홈(원인 포함), 달력 칸 증감 축약, 320 막대 값 한 줄·배당 칩 간격, 죽은 코드 정리 · COO 자체 승인(low) | PASS |
| v4.94 [PR #185](https://github.com/BBplayworld/vaultfolio/pull/185) | 11/13 | 처음 맞는 결산 열기(#183) — 11월 신규도 첫 결산 창에 결산·팁, 결산 이름 하나로, 체험 순자산 웰컴과 맞춤·가짜 급등 제거 · COO 자체 승인(medium) | PASS |
| v4.92 [PR #182](https://github.com/BBplayworld/vaultfolio/pull/182) | 11/13 | 돌아온·처음 온 사용자 숫자·문구 맞추기(#181) — 2주 넘게 쉬고 온 사용자의 7일 값 'M/D 이후'로 통일·체험 '전일 대비' 표시·세금 '이번 달' 지난 마감 아래로 · COO 자체 승인(low) | PASS |

</details>

<details>
<summary><b>📦 묶음 5 · 11/11~11/12 · v4.79~v4.90 (11건)</b> — 진입·첫 사용 — 신기능 진입 경로, 새 소식, 종목 한 장, 웰컴 바로 등록, 홈 팁 보유 필터, 시장 비교 타일, 세금 허브 행, 홈 '오늘'</summary>

| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| v4.90 [PR #178](https://github.com/BBplayworld/vaultfolio/pull/178) | 11/12 | 홈 '오늘'(#175) — 보유 시장 종가 1줄·가장 큰 원인 1줄(7월 접힘 결정 중 1줄만 노출, 원치 않으시면 이 부분만 되돌림)·7일 카드→최근 7일, 시장 타일 휴장 표기 · COO 자체 승인(medium) | PASS |
| v4.89 [PR #177](https://github.com/BBplayworld/vaultfolio/pull/177) | 11/12 | 세금 관리를 더보기 밖(상세 허브 하단 행)으로, 세금 화면에서 '상세' 탭 켜짐, 홈 원인 펼침 측정(#176) · COO 자체 승인(low) | PASS |
| v4.88 [PR #173](https://github.com/BBplayworld/vaultfolio/pull/173) | 11/12 | 자산 변화·주식 '시장과 비교' 도구 타일(#172, 대표 요청) + 홍보 도착 퍼널 측정(#174) + AI 프롬프트 대출 라벨 · COO 자체 승인(low) | PASS |
| v4.87 [PR #171](https://github.com/BBplayworld/vaultfolio/pull/171) | 11/12 | 홈 팁 보유 필터(#170) — 가진 자산에 맞는 기능만 권함, 시세 전부 실패 시 안내 문구, 320 배당 배지 · COO 자체 승인(low) | PASS |
| v4.86 [PR #169](https://github.com/BBplayworld/vaultfolio/pull/169) | 11/12 | 웰컴에서 바로 첫 자산 등록(#167) — 휴대폰 웹 설치 단계 삭제, 직접 입력 5종 · 대표 승인 | PASS |
| v4.85 [PR #168](https://github.com/BBplayworld/vaultfolio/pull/168) | 11/12 | 첫 등록 준비·정돈(#166) — 첫 저장 설치 안내 막힘 해제·웰컴 버튼별 GA·튜토리얼 정리·시세 부분 실패 미저장·배당 차트 숫자·0건 카드 추가하기 · COO 자체 승인(medium) | PASS |
| v4.84 [PR #165](https://github.com/BBplayworld/vaultfolio/pull/165) | 11/12 | 주가 차트 가격 눈금·현재가(펼친 행 전폭 80px)·매도 점·평단 칩 폴백, 새 소식 X 40px·Esc 포커스(#163) + 공통 로딩 UI(#164) · COO 자체 승인(medium) | PASS |
| v4.83 [PR #162](https://github.com/BBplayworld/vaultfolio/pull/162) | 11/11 | 신기능 진입 경로 개선(#161) — 상세·주식 도구 타일(시장·X-Ray·세금), 펼친 종목 이름 줄 미니 차트 입구, 성과 허브 행 3개, '총 N주' 중복 제거, 주간 방문 기록 버그 수정 · COO 자체 승인(medium) · 뺀 것: 세금 D-day·첫 카드 자동 펼침·이름 줄 '새'·GA 경로 구분·320/340 아이콘 | PASS |
| v4.82 [PR #160](https://github.com/BBplayworld/vaultfolio/pull/160) | 11/11 | 새 소식(#159) — 9월에 멈춘 공지를 '새 소식'으로 교체, 놓친 업데이트를 홈 팁 1개(결산 기간엔 결산 우선, 7일 1회)로 묶어 안내, 더보기 '새 소식 보기'. CLAUDE.md 버전 규칙 반영 · COO 자체 승인(medium) | PASS |
| v4.81 [PR #158](https://github.com/BBplayworld/vaultfolio/pull/158) | 11/11 | 종목 한 장(#157) — 여러 증권사 합친 평단선·1년/5년 가격 흐름·매수 점. 인증카드 변경 0, 서버로는 종목코드·기간만. 방향 알림 '뺀 것'에 매도 점 미표시 정정 추가 · COO 위임(medium) | PASS |
| v4.80 [PR #156](https://github.com/BBplayworld/vaultfolio/pull/156) | 11/11 | 인증카드에서 금액을 숨기면 종목 보유 수량도 함께 가림(#155, 평가금액 역산 차단) · COO 위임(low) | PASS |
| v4.79 [PR #154](https://github.com/BBplayworld/vaultfolio/pull/154) | 11/11 | 자산 변화 주 탭 '최근 7일' 변화 원인(홈과 같은 숫자)·종목 등락 연결·마감 기록 접힘(#153). 뺀 것: 움직인 종목 상·하위 3·매주 팁·대출 이자 추정(규모는 대표 기준 하한 아래). 홈 원인 줄 일부 이름 정정(숫자 불변). #152 ETF 속까지는 KIS 구성 데이터 게이트 실패로 보류 · COO 위임(medium) | PASS(체험 데이터, 원인 1줄·시작 행 일치) |

</details>

<details>
<summary><b>📦 묶음 4 · 11/09~11/11 · v4.55~v4.76 (16건)</b> — 결산 대비·흐름 — 실물 자산, 거래 연결 계좌, 환율 잔차, 12월 결산 대비 결함, 억 단위 오차, '오늘' 칩, 품질 묶음 2~5</summary>

| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
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

</details>

<details>
<summary><b>📦 묶음 3 · 11/07~11/08 · v4.45~v4.51 (4건)</b> — 입구·정돈 — 검색 입구·설치 안내·연말 세금 진입, 배당 투입 대비, 품질 정돈, 월 탭 자산 구성 변화</summary>

| 릴리스 | 머지일 | 내용 | 운영 스모크 |
|---|---|---|---|
| 4.51 [PR #95](https://github.com/BBplayworld/vaultfolio/pull/95) | 11/08 23:15 | 성과 월 탭 자산 구성 변화 블록(#83, 대표 위임 판단) ⚠️ 10월 결산 창 안 머지(판정 누락, 블록 추가뿐이라 유지·C39 추가) | PASS |
| 4.49 [PR #90](https://github.com/BBplayworld/vaultfolio/pull/90) | 11/08 | 품질 정돈 묶음(320 주식 행·FAB·힌트 히트영역·다크 배지·배당 배지·미사용 UI 정리) | PASS |
| 4.46 [PR #86](https://github.com/BBplayworld/vaultfolio/pull/86) | 11/07 | 배당 투입 대비 배당·더보기·설정 정돈·홈 도넛 정돈 | PASS |
| 4.45 [PR #85](https://github.com/BBplayworld/vaultfolio/pull/85) | 11/07 | 검색 입구 정비·설치 안내·연말 세금 진입 | PASS |

</details>

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
