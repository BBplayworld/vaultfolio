# 📋 시크릿에셋 대시보드

> **마지막 갱신: 2026-11-28 02:21 KST** · 운영 최신 **v5.172** (스모크 PASS 00:38) · 운영 결함 없음 (Vercel 차단 해제 — 160.79.106.144/28 허용)
> 반영 승인은 CEO 에이전트. 대표 결정은 risk:high·반려 영역 재시도·원칙 변경·결제·외부 게시만.
> 지난 기록: [archive/DASHBOARD-2026-11-20.md](archive/DASHBOARD-2026-11-20.md)

## 🟥 대표님 할 일
> 근거: 신규 유입 진단 [_discovery/2026-11-24-acquisition-diagnosis.md](issues/_discovery/2026-11-24-acquisition-diagnosis.md) — 신규 웰컴 도착 주 6대, 최대 구멍은 **검색 미색인**
1. **[이번 주·30분] 구글 서치콘솔 등록** → sitemap(`/sitemap.xml`) 제출 → 가이드 6편 색인 요청 (HTML 태그 방식이면 확인 코드를 팀에 전달 → 코드 반영, DNS 방식이면 불필요)
2. **[이번 주·15분] 네이버 서치어드바이저** sitemap 재제출 + 13개 URL 수집 요청(`/guide/year-end` 포함)
3. **[11/25·5분] GA CSV** — '페이지 제목 및 화면 클래스'(행 250) 11/18~24 · 11/11~17 · 10/28~11/24 + 홈 × 날짜(11/11~24) + **채널 그룹·세션 소스 표 2장**. 대표 기기 ga-optout 켜짐 여부 한 줄
4. **[주 20분] W48 홍보 초안 게시 — 준비 완료(qa PASS)**: [_discovery/2026-11-25-w48-draft.md](issues/_discovery/2026-11-25-w48-draft.md) 네이버 블로그 1편 + Threads 5개(11/25~30 분산). 각 초안 아래 '대표 게시 체크' 3줄 확인 후 게시
5. **[홍보 D-5] KIS 시세 방침 확인** — 대대적 홍보 권고 시점 12월 셋째 주~1월 첫 주(선행: 색인 확인 → 웰컴 개선 2주 판독 → 지수 3기능 끄기). 홍보는 대표가 따로 요청 시 착수
- (선택) GitHub에서 `diag-kis-close` 브랜치 삭제 — 팀 권한으로 403

## ⚙️ 운영 모드
- ~~11/26 22:55 ~ 11/27 09:00 KST: 전 에이전트 Fable 모델, 무중단 진행(대표 지시)~~ 종료(02:30~07:50 사용량 한도로 중단 구간 있음)

## ▶ 대표 결정 11/27 18:55: 장기 대기 해제·바로 진행 (판독은 비차단 기록)

## ~~⏸ 대기 상태 (11/27 15:40)~~ → 15:50 대표 지시로 4차 발굴 착수(상세·주식 4개 박스 포함)
- ~~진행할 신규 과제 없음(CEO 판정).~~ 다음 행동: **12/4 09:30 5.169 머지 진행**(G2 확인 → id 교체·문구 보강 → qa 증분 → CEO → 머지·스모크). 관측: 받은 배당 G2 ~12/4·G3 ~12/11, 웰컴 4주 ~12/25, 대조 1줄 철수선 ~12/25.

## 🔄 진행 중
| 릴리스 | 내용 | 상태 | 다음 |
|---|---|---|---|
| **5.175** [#354](https://github.com/BBplayworld/vaultfolio/issues/354)·#355·#356 | 전량 매도 삭제 평단 0 버그·다 판 코인 내역 접근·죽은 함수 정리 | planning · risk:medium · 위임 머지 | qa 재현 → 개발 |
| **5.174** [#352](https://github.com/BBplayworld/vaultfolio/issues/352) | 인증카드 레이어 UI·색상 정돈(대표 요청) · [PR #353](https://github.com/BBplayworld/vaultfolio/pull/353) | **v5.172 머지 11-28 00:22** · 운영 스모크 PASS 00:38 | — |
| **5.173** [#347](https://github.com/BBplayworld/vaultfolio/issues/347)·#348·#349·#350 | 해외 종목 숫자 신뢰(절세 엔화 100배·환율 섞인 합산 손익·매수 시 환율 희석)+새 소식 문구 | **v5.171 머지 11/27 22:29** · 운영 스모크 PASS 22:43 | — |
| **5.172** [#345](https://github.com/BBplayworld/vaultfolio/issues/345) | 웰컴 320 줄 나눔 정돈(G 펼침 칸 제거는 CEO 기각) | **v5.170 머지 11/27 21:06** · 운영 스모크 PASS 21:19 | — |
| **v5.153** [PR #312](https://github.com/BBplayworld/vaultfolio/pull/312) | #309 시세 신선도 | **운영 반영 11/26 17:50 KST** · 스모크 PASS | — |
| **v5.154** [PR #314](https://github.com/BBplayworld/vaultfolio/pull/314) | #310 증권사 이관 정리(risk:high, 대표 일괄 승인) | **운영 반영 11/26 17:55 KST** · 스모크 PASS | — |
| **v5.155** [PR #315](https://github.com/BBplayworld/vaultfolio/pull/315) | #313 배당 숫자 신뢰(bug) | **운영 반영 11/26 18:29 KST** · 스모크 PASS | 판독: 배당·성적표 경계 18:29 |
| **v5.156** [PR #316](https://github.com/BBplayworld/vaultfolio/pull/316) | #311 기록 입력 정확도 | **운영 반영 11/26 19:36 KST** · 스모크 PASS | — |
| **v5.157** [PR #318](https://github.com/BBplayworld/vaultfolio/pull/318) | #317 상세에서 보는 배당 | **운영 반영 11/26 19:53~57 KST** · 스모크 PASS | — |
| **v5.158** [PR #320](https://github.com/BBplayworld/vaultfolio/pull/320) | #319 상세·주식 증권사별 합계 | **운영 반영 11/26 20:26~38 KST** · 스모크 PASS | — |
| **v5.159** [PR #322](https://github.com/BBplayworld/vaultfolio/pull/322) | #321 맞추기 정확성 마감(코인 고아 거래·토스트 되돌리기) | **운영 반영 11/26 21:20~31 KST** · 스모크 PASS | 대조 1줄 → 재설계 후 재도입 |
| **v5.161** [PR #330](https://github.com/BBplayworld/vaultfolio/pull/330) | #325 웰컴 첫 문장·코인 거래소별 합계 + #326 320 배당 표 2단 | **운영 반영 11/27 00:42~53 KST** · 스모크 PASS | 웰컴 새 4주 판독(00:53~12/25) |
| ~~5.164~~ [#327](https://github.com/BBplayworld/vaultfolio/issues/327) | 저장 스키마 passthrough | **보류**(받은 배당 기록이 분리 키 방식이라 불필요, 예·적금 재개 시) | — |
| **v5.162** [PR #331](https://github.com/BBplayworld/vaultfolio/pull/331) | #328 맞추기 결과 대조 1줄('맞아요'만, 축소) | **운영 반영 11/27 02:03~14 KST** · 스모크 PASS | 철수선 4주(~12/25) |
| **5.165** [#332](https://github.com/BBplayworld/vaultfolio/issues/332) | 배당 표 2단 640 미만·max-[359px] 정리 · [PR #333](https://github.com/BBplayworld/vaultfolio/pull/333) | **운영 반영 11/27 08:30** · 화면 스모크 PASS(09:35 v5.164 스모크와 함께) | — |
| **v5.165** [PR #336](https://github.com/BBplayworld/vaultfolio/pull/336) | #335 증권사 현금 한 장 | **운영 반영 11/27 13:25~39** · 스모크 PASS | — |
| **5.168** [PR #338](https://github.com/BBplayworld/vaultfolio/pull/338) | #337 R3 평단만 맞춘 종목 맞춘 날 유지(과거 배당 과대 수정) | **운영 반영 11/27 14:29~40** · 스모크 PASS | — |
| **v5.167** [PR #342](https://github.com/BBplayworld/vaultfolio/pull/342) | #341 상세·주식 도구 타일 줄이기(대표 질문) | **운영 반영 11/27 18:33~45** · 스모크 PASS | 다음 C1 비중 범례 압축(11/28 착수) · 12/20 2단계 |
| **5.169** [#339](https://github.com/BBplayworld/vaultfolio/issues/339) | 배당 입금 지급일 버튼·증권사 현금 계좌 기본값 · [PR #340](https://github.com/BBplayworld/vaultfolio/pull/340) draft | **운영 반영 11/27 19:15~29** · 스모크 PASS | — |
| **5.171** [#343](https://github.com/BBplayworld/vaultfolio/issues/343) | 상세·주식 첫 화면 종목 보이기(X-Ray 단독·비중 범례 압축) · [PR #344](https://github.com/BBplayworld/vaultfolio/pull/344) | **v5.169 머지 11/27 20:13** · 운영 스모크 PASS 20:28 | — |
| **5.166** [#329](https://github.com/BBplayworld/vaultfolio/issues/329) | 받은 배당 기록(분리 키, risk:high) · [PR #334](https://github.com/BBplayworld/vaultfolio/pull/334) | **운영 반영 11/27 09:20~35** · 스모크 PASS(2기기 왕복은 로컬 prod 대체) · G1 통과 | 관측 G2 ~12/4 · G3 ~12/11 |
| **v5.160** [PR #324](https://github.com/BBplayworld/vaultfolio/pull/324) | #323 배당 문구·숫자 마감(지급일 수량 문구·예상 단일 정본·차트 320) | **운영 반영 11/26 22:50~23:04 KST** · 스모크 PASS | 320 배당 표 2단 → 별도 |
| **v5.152** [PR #307](https://github.com/BBplayworld/vaultfolio/pull/307) | #306 데이터 안전 회귀 테스트(앱 코드 0) | **운영 반영 11/26 04:30 KST** | — |
| **다음** | 상세·현금 320 현금 거래 9자리 출금 겹침 | 11/27 10:17 착수 예약 | 하루 1머지 |
| **v5.151** [PR #305](https://github.com/BBplayworld/vaultfolio/pull/305) | #304 홈 Hero·원인 행 표시 일치(bug) | **운영 반영 11/26 04:17 KST** · 운영 스모크 PASS | 가드레일: 홈 변동 원인 열기 기기 수·'숫자 안 맞음' 제보 0 |
| **v5.143** [PR #289](https://github.com/BBplayworld/vaultfolio/pull/289) | 투자 탭 폐지 → 상세·성과 2탭 | **운영 반영 11/24 14:56 KST** · 운영 스모크 PASS | 4주 판독(12/22 전후) |
| **v5.144** [PR #291](https://github.com/BBplayworld/vaultfolio/pull/291) | #288 R1 — 상세·성과 중복 입구·안 쓰는 버튼 4개 정리 | **운영 반영 11/25 01:13 KST** · 운영 스모크 PASS | 4주 판독(실패 기준: 핵심 4화면 중 2개 동시 3기기↓) · R2 12/20 후 |
| **v5.145** [PR #294](https://github.com/BBplayworld/vaultfolio/pull/294) | #293 대표 제보 — 과거 소급(미반영) 입출금이 성과 원인 순유입으로 | **운영 반영 11/25 20:19 KST** · 운영 스모크 PASS | — |
| **v5.146** [PR #296](https://github.com/BBplayworld/vaultfolio/pull/296) | #290·#292 상세 허브 '추가하기' 줄·웰컴 등록 버튼 첫 화면·다크 대비·홈 팁 계측 | **운영 반영 11/25 23:08 KST** · 운영 스모크 PASS | 판독 홈 팁 2주·웰컴 4주 |
| **v5.147** [PR #297](https://github.com/BBplayworld/vaultfolio/pull/297) | #295 '기록만' 의미 정리(#293 후속) — 배지·도움말 통일·기록만 삭제 확인·연 결산 '꺼낸 돈' | **운영 반영 11/26 00:20 KST** · 운영 스모크 PASS | — |
| **v5.148** [PR #299](https://github.com/BBplayworld/vaultfolio/pull/299) | #298 상세 목록 320 읽힘 — 종목명 어절 줄바꿈·거래 행 정돈 | **운영 반영 11/26 01:23 KST** · 운영 스모크 PASS | — |
| **v5.149** [PR #301](https://github.com/BBplayworld/vaultfolio/pull/301) | #300 320 읽힘 2차 — 코인·실물 금액 잘림·현금 요약·결산 문장 | **운영 반영 11/26 02:32 KST** · 운영 스모크 PASS | — |
| **v5.150** [PR #303](https://github.com/BBplayworld/vaultfolio/pull/303) | #302 월 탭 '순유입' 도움말 정정·상세 허브 설명 줄 제거·320 현금 거래 행 | **운영 반영 11/26 03:25 KST** · 운영 스모크 PASS | R1 판독 시 허브 설명 줄 제거가 첫 revert 후보 |

## 📅 다가오는 확인
- ~~판독 화면 머지 동결~~ 해제(대표 11/26: GA 표본 무의미, 계속 고도화)
- 11/25: GA CSV 기록 — 투자 탭·가이드 9편 기기 수, #249·#245 반응, D12 발굴(웰컴 빼기·사용 적은 화면 합치기)
- 12/20 전후: 투자 탭 4주 판독 → R4 방향
- 2027-01 첫 주: 시장 역사 연간 갱신 릴리스
- 11/27(금) 09시: 첫 월 결산 알림 수신
- 12월 첫 주: 가계금융복지조사 공표 → 통계 갱신

## ✅ 최근 머지
11/27 v5.162 #328 대조 1줄 축소(CEO·대표 사후 알림) · 11/27 v5.161 #325·#326 웰컴·코인 거래소별·320 배당 표(CEO) · 11/26 v5.160 #323 배당 문구·숫자 마감(CEO) · 11/26 v5.159 #321 맞추기 정확성(CEO) · 11/26 v5.158 #319 증권사별 합계(CEO) · 11/26 v5.157 #317 상세에서 보는 배당(CEO) · 11/26 v5.156 #311 기록 입력 정확도(CEO) · 11/26 v5.155 #313 배당 숫자 신뢰(CEO) · 11/26 v5.154 #310 증권사 이관(대표 일괄 승인·CEO) · 11/26 v5.153 #309 시세 신선도(CEO) · 11/26 v5.152 #306 데이터 안전 테스트(CEO) · 11/26 v5.151 #304 홈 Hero·원인 행(CEO) · 11/26 v5.150 #302 도움말·허브(CEO) · 11/26 v5.149 #300 320 2차(CEO) · 11/26 v5.148 #298 상세 목록 320(CEO) · 11/26 v5.147 #295 '기록만' 정리(CEO) · 11/25 v5.146 #290·#292 강화 1차(CEO) · 11/25 v5.145 #293 미반영 입출금 원인 반영(CEO, 대표 제보) · 11/25 v5.144 #288 R1 상세·성과 정리(CEO) · 11/24 v5.143 투자 탭 폐지(CEO) · v5.142 신규 현금 반복 표시 수정(대표 승인) · 11/23 v5.141 투자 탭 R3-3(CEO) · v5.140 투자 탭 R3-2(CEO) · v5.139 투자 탭 R3-1(CEO) · v5.138 홈 순자산 구성(CEO) · v5.137 홈 내 종목 오늘 외(CEO) · 11/22 v5.136 투자 탭 R2(CEO) · v5.135 투자 탭 고도화 R1(CEO) · v5.134 투자 탭(대표 승인) · 11/21 v5.133 연말 검색 가이드 · 11/20 v5.128 아침 알림 개편 · v5.129 Next.js 보안 패치 · v5.130 내 결정 표시 · v5.131 체험→내 자산 · v5.132 체험 보강 — 모두 운영 스모크 PASS
