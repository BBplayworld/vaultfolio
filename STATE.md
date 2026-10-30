# 팀 현재 상태 (매 실행 끝에 전체 덮어쓰기)

마지막 갱신: 2026-10-30 (developer: v4.35 development — #48·#46 구현·push, preview 확인)

## 대표 결정 대기
- 없음 (v4.34 반영 완료 — PR #37 → main b44168f)

## 보류 알림 (새벽 실행분, 다음 09:53 실행이 전달 후 비움)
- 🆕 `[시크릿에셋] 새 과제: #48 첫 화면 \"가치 먼저\" 재배열 + 링크 미리보기 정비` (개선, p1) — 첫 화면을 히어로→신뢰 한 줄→예시 미리보기→시작 CTA로, 보안 3카드는 접힘·모바일 웹 \"바로 시작\" 노출·OG 이미지(금액 없음). 지표: 28일 first_asset_saved÷welcome_view 상대 +30%, 설치율 가드레일. 링크 https://github.com/BBplayworld/vaultfolio/issues/48 (PushNotification만, 이슈 @멘션 불필요)

## 다음 정기 실행 지시
- [선정 2026-10-29] 첫 화면 "가치 먼저" 재배열 + OG 최소 동승 — `issues/4.35-48-welcome-value-first/4.35-challenge.md` 통과(축소 반영). 이슈 생성(type:improvement, p1, status:planning) 후 planning ① 방향 정의
- 자율 과제 기준: 월 활성 사용자 100명 직접 기여 서비스 과제 우선, 소규모 신뢰성 수정은 p2 동승(대표 2026-10-29)

## 진행 중
| 이슈 | 버전 | 단계 | 담당 | 다음 할 일 |
|---|---|---|---|---|
| #48 첫 화면 가치 먼저 + 링크 미리보기 (p1) | 4.35 | development 완료 → ui-review | ui-designer → qa | preview UI 검수(`issues/4.35-48-welcome-value-first/4.35-dev-notes.md`), 이후 qa |
| #46 주식·대출 입력 날짜 KST (p2 동승) | 4.35 | development 완료 → qa | qa | `issues/4.35-46-trade-date-kst/4.35-dev-notes.md` |
| #45 백업 iOS 신뢰 | — | rejected | — | 대표 미반영 판단(2026-10-29), 닫음 |
| #33 시드2 투자 유형 온보딩 | — | on-hold | — | 첫 화면 재배열 지표 확인 후 판정 |
| #34 시드3 채널 운영 | — | on-hold | — | 대표 지시로 보류 |

## 열린 릴리스
- **v4.35** = #48, #46 · 브랜치 `issue-4.35`(main c5a7a48에서 분기) · 최신 9ee9171 · preview https://secretasset-git-issue-435-bbplayworlds-projects.vercel.app · 릴리스 PR은 오케스트레이터 생성 예정 · 위험 low(스키마·저장 키 변경 없음)

## 막힌 것
- 운영 사용자 도메인 secretasset.xyz는 클라우드 환경 네트워크 정책에 막힘(403) → 운영 스모크는 Vercel 운영 별칭으로 대체. 대표가 허용 도메인에 추가하면 해소
- 없음

## 확인 필요 (첫 실행에서 처리)
- 2차 라운드 스펙(평가금액 알림, 목표 설정, 온보딩 마법사) 실제 구현 여부: changelog상 알림·신선도·목표 설정은 철회(4.22 후속), 온보딩 마법사는 4.29에서 구현 — 코드로 재확인
- 현재 테스트: vitest 32파일 439건 통과 (2026-10-30, issue-4.35 9ee9171)
- 가장 큰 버전: 4.35(#48·#46, 열림) → 다음 배정 4.36
- GA4 데이터 보존 기간(2개월/14개월) — 첫 화면 재배열 지표 판독 기한 결정. 에이전트 GA 조회 수단 없음(판독 한계)

## 후보 목록 (자율 발굴 탈락·대기, cto 2026-10-29 2차 순위 — 서비스 성장 우선)
- **[선정 2026-10-29 2차] E1 첫 화면 가치 우선 재배열 + G2 OG 이미지·twitter 카드 최소 동승** — `issues/4.35-48-welcome-value-first/4.35-challenge.md`
- [2위, type:feature] E3 결산 창 홈 팁(home-tip `pickHomeTip`) + 첫 달 사용자 "다음 결산 N월 말" + 기존 .ics 연결 — 재방문·S. 화면·지표가 달라 묶지 않음. 다음 자율 과제 1순위(같은 릴리스 별도 이슈 가능)
- [3위, type:feature] G3 #33 투자 유형 온보딩 재개 — 원칙 4장 2순위와 같은 방향, 팀 판정 가능. E1 히어로 주 버튼 자리에 얹는 후속, E1 지표 확인 후
- [4위, type:feature] E2/G1 "예시로 먼저 둘러보기" 체험 모드(#31 데모 주입 재사용) — M·위험 medium+(실데이터 격리). E1 효과 확인 후. 새 URL 금지 조건 유지
- [5위, type:improvement] G2 나머지: sitemap 확장·홈 서버 렌더(크롤러 본문) — 구조 변경 비용 큼, #34 블로그 재개 때
- [p2 동승] #46 거래·대출 입력 날짜 KST(D1) — 다음 릴리스에 함께
- [p2 동승 후보, type:bug qa 확정 B3] FAB "과거 순자산" 50ms 고정 대기(`floating-add-button.tsx:111`) — 소규모, 주력 제외
- [type:bug(UI) U2] 배당 종목 표 375 붕괴 — M, 기존 사용자 체감. 성장 직접 기여 약해 대기
- [type:improvement B1+U1] 홈 Hero 원인 어휘 통일 + 라벨 정리 + 375 금액 줄바꿈 — 기존 사용자 화면 품질, 대기
- [type:improvement U3] 필터 칩·"변동 원인 보기" 40px(InlineSelector 공용) + 다크 선택 칸 — 소규모
- [type:improvement P3] 백업 내보내기·가져오기 설정 "데이터" 통합 — 대기
- [type:simplify D3] 미사용 엔진 함수 정리 — 사용자 영향 0, p2 동승 가능
- [UI] 공용 `InfoHint` 히트영역 40px + break-keep / 연 차트 375 라벨 겹침·빈 상태 문구 불일치
- [type:improvement, risk:high 스키마] 새로 등록한 자산·계좌를 결산 원인에서 분리(등록일 필드) — 스키마 변경
- [type:improvement, COO] 연 탭 "대출" 값 예측 구간 시세 잔차 상한 문제 재검토
- [type:improvement] 동기화 pull 같은 달 충돌 `date` 늦은 쪽 우선
- [반려] #45 백업 JSON·공유 PNG iOS 신뢰 — 대표 미반영(2026-10-29, 성장 기여 낮음). 재제안 금지
- [탈락] P2 "Plus" 배지 제거 — 현행 유지 판정

## 지표
- 월 활성 사용자: 약 50명 (2026-10 기준, 집계 방식 미정 — GA 이벤트 `.claude/specs/4.28-ga-event-tracking.md` 참고)
- 목표: 100명 이상
