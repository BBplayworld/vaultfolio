# 팀 현재 상태 (매 실행 끝에 전체 덮어쓰기)

마지막 갱신: 2026-10-31 09:53 (cto: D 자율 발굴 4차 선정 — 결산 AI 질문 프롬프트)

## 대표 결정 대기
- 없음 (v4.34 반영 완료 — PR #37 → main b44168f)

## 보류 알림 (새벽 실행분, 다음 09:53 실행이 전달 후 비움)
- 없음

## 다음 정기 실행 지시
- [선정 2026-10-31 09:53] 결산 AI 질문 프롬프트(feature, p1) — `issues/4.xx-new-settlement-ai-prompt/4.xx-challenge.md` 통과(축소). 이슈 생성(status:planning) 후 planning ① 방향 정의. **v4.36 머지 후 다음 버전(4.37)으로 개발 시작**(planning·design-review는 선행 가능). 홈 팁·공지로 알리기 금지(#51 오염)
- [선정 2026-10-30 17:54] E3 결산 창 홈 팁 + p2 동승 2건(홈 Hero 375 금액 줄바꿈·하단 고지 break-keep) — `issues/4.36-51-settlement-home-tip/4.36-challenge.md` 통과(축소). 이슈 생성(type:feature, p1, status:planning) 후 planning ① 방향 정의. **2026-11-26까지 머지돼야 11월 결산 창 측정**
- #48 지표 판독 전(마감 2026-12-25경) #33·체험 모드 착수 금지(같은 첫 화면 퍼널 → 효과 측정 오염)
- 자율 과제 기준: 월 활성 사용자 100명 직접 기여 서비스 과제 우선, 소규모 신뢰성 수정은 p2 동승(대표 2026-10-29)

## 진행 중
| 이슈 | 버전 | 단계 | 담당 | 다음 할 일 |
|---|---|---|---|---|
| #51 결산 창 홈 팁 (p1) + p2 동승 | 4.36 | development 완료 → ui-review | ui-designer → qa | preview UI 검수(`issues/4.36-51-settlement-home-tip/4.36-dev-notes.md`), 이후 qa |
| #45 백업 iOS 신뢰 | — | rejected | — | 대표 미반영 판단(2026-10-29), 닫음 |
| #33 시드2 투자 유형 온보딩 | — | on-hold | — | #48 지표 판독(2026-12-25경) 후 판정 — 그 전 착수 시 측정 오염 |
| #34 시드3 채널 운영 | — | on-hold | — | 대표 지시로 보류 |

## 열린 릴리스
- **v4.36** = #51 · 브랜치 `issue-4.36` · 기준 8d5c9e1 = qa 최종 PASS = preview 200 · UI 승인 @5964511(이후 화면 diff 0), ui 최종 확인 @8d5c9e1 기록 후 owner-review · PR #52 · preview https://secretasset-git-issue-436-bbplayworlds-projects.vercel.app/?demo=1 · 위험 low · cto(COO) 재점검 전부 PASS · decision-brief 재작성(`issues/4.36-51-settlement-home-tip/4.36-decision-brief.md`, 권고 반영, 🟥 문안 포함) · 기한 11/26 머지 시 11월 측정 · 가드레일(닫기÷노출)은 기기 수로 판독(기준 창 노출 이벤트 중복 집계)

## 막힌 것
- 운영 사용자 도메인 secretasset.xyz는 클라우드 환경 네트워크 정책에 막힘(403) → 운영 스모크는 Vercel 운영 별칭으로 대체. 대표가 허용 도메인에 추가하면 해소
- 없음

## 확인 필요 (첫 실행에서 처리)
- 2차 라운드 스펙(평가금액 알림, 목표 설정, 온보딩 마법사) 실제 구현 여부: changelog상 알림·신선도·목표 설정은 철회(4.22 후속), 온보딩 마법사는 4.29에서 구현 — 코드로 재확인
- 현재 테스트: vitest 32파일 439건 통과 (2026-10-30, issue-4.35 9ee9171)
- 가장 큰 버전: 4.35(#48·#46, 열림) → 다음 배정 4.36
- GA4 데이터 보존 기간(2개월/14개월) — 첫 화면 재배열 지표 판독 기한 결정. 에이전트 GA 조회 수단 없음(판독 한계)

## 후보 목록 (cto 2026-10-31 09:53 4차 순위 — #48 판독 전 첫 화면 퍼널 동결, #51 홈 팁 칸 무접촉)
- **[선정 2026-10-31] 결산 AI 질문 프롬프트** (feature, p1) — `issues/4.xx-new-settlement-ai-prompt/4.xx-challenge.md`. 결산 화면 버튼 1개+기존 PromptPreviewDialog, `feature_use` ai_prompt 계측(성적표 기준선 포함). v4.36 머지 후 4.37
- [선정 2026-10-30, v4.36 owner-review] E3 결산 창 홈 팁 #51
- [2위, #48 판독 후] G2 SSR 소개 문구·sitemap 확장 — 사실: `(main)/page.tsx` `!isDataLoaded`면 null(크롤러 본문 0), sitemap 루트 1건. 검색 유입 코호트가 #48 분모를 바꿔 판독 후. #34 재개와 묶기
- [3위, 판독 후] G3 #33 투자 유형 온보딩 — #48과 같은 첫 화면 퍼널(오염). 판독(2026-12-25경) 또는 8주 경과 정성 판정 후
- [4위, 판독 후] E2/G1 체험 모드(#31 데모 주입 재사용) — 오염 + 위험 medium+. 새 URL 금지 유지
- [후속 후보] 결산 AI 프롬프트 v2: 연 탭·금액 가리기 옵션 — v1 지표 확인 후
- [후속 후보] E3 v2: 첫 달 사용자 "다음 결산 N월 말" 안내 — E3 지표 확인 후
- [p2 동승 후보, type:bug(UI)] 홈 순자산 추이 막대 라벨 320 "6.43억/원" 단위 분리 · 시세 갱신 토스트 375 "업데이트/했습니다" 끊김 · Hero 증감 2행 라벨 `ml-1.5` → 컨테이너 `gap-x-1.5` — 다음 릴리스(4.37) 동승
- [p2 동승 후보, type:bug qa 확정 B3] FAB "과거 순자산" 50ms 고정 대기(`floating-add-button.tsx:111`)
- [p2 동승 후보, 정리] home-tip `kstToday` preview 모듈 import 정리(v4.36 qa 권고, 동작 동일)
- [type:bug(UI) U2] 배당 종목 표 375 붕괴 — M, 성장 직접 기여 약해 대기
- [type:improvement B1+U1] 홈 Hero 원인 어휘 통일 + 라벨 정리 — 기존 화면 의미 변경, 대기
- [type:improvement U3] 필터 칩·"변동 원인 보기" 40px(InlineSelector 공용) + 다크 선택 칸 — 공용 파급, 대기
- [type:improvement P3] 백업 내보내기·가져오기 설정 "데이터" 통합 — 대기
- [type:simplify D3] 미사용 엔진 함수 정리 — p2 동승 가능
- [UI] 공용 `InfoHint` 히트영역 40px + break-keep / 연 차트 375 라벨 겹침·빈 상태 문구 불일치
- [type:improvement, risk:high 스키마] 새로 등록한 자산·계좌를 결산 원인에서 분리(등록일 필드)
- [type:improvement, COO] 연 탭 "대출" 값 예측 구간 시세 잔차 상한 재검토
- [type:improvement] 동기화 pull 같은 달 충돌 `date` 늦은 쪽 우선
- [반려] #45 백업 JSON·공유 PNG iOS 신뢰 — 재제안 금지
- [탈락] P2 "Plus" 배지 제거 — 현행 유지

## 지표
- 월 활성 사용자: 약 50명 (2026-10 기준, 집계 방식 미정 — GA 이벤트 `.claude/specs/4.28-ga-event-tracking.md` 참고)
- 목표: 100명 이상

