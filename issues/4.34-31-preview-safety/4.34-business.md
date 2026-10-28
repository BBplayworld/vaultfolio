# #31 preview 안전장치·데모 데이터 — 사업 (business.md)

사용자 기능이 아닌 팀 QA 인프라다. 사용자 지표·신규 GA 이벤트 없음(preview는 GA 미렌더).

## 성공 확인 방법 (관찰 가능)
1. qa 자동 점검 완주: #32 qa 단계에서 `?demo=1`(`dataset.demoReady="1"` 대기)만으로 사람 없이 끝까지 조작하고 `qa-report.md`에 스크린샷을 남긴다.
2. preview 동기화 요청 0건: `/api/sync` 호출이 없다. `isCloudSyncEnabled()` false와 `sync-client.ts` 가드를 단위 테스트로 보장한다(challenge 5장 a).
3. 대표 확인 요청 0건: #32 진행 중 QA·화면 확인 요청 코멘트나 `needs-human`이 없다.
4. 데모 payload 조건 충족: 2개월 이상 기록, 입출금·매수·매도·환율 변화·부동산 재평가 포함(테스트 c).

## 사용자 영향 없음 근거
- 운영(`VERCEL_ENV=production`)과 로컬 개발은 배지·버튼·데모 주입이 DOM에 없고 `demo` 쿼리도 무시한다. 운영 분기 값은 기존과 같고 테스트(b)로 보장한다.
- `WelcomeGuide` 등 운영 컴포넌트, 저장소 스키마·키, 서버 `/api/sync`는 변경하지 않는다. 데모 JSON은 동적 import라 운영 초기 번들에 들어가지 않는다.
- 롤백은 PR revert이고 운영 데이터 변경이 없다.

## 출시 알림
없음. 내부 인프라라 Threads·카페·블로그 게시 대상이 아니다.

## 팀이 출시 후 확인할 것
- 머지 후 운영에서 동기화 연결·push·pull이 이전과 같이 동작하고 PREVIEW 배지가 보이지 않는다(qa 회귀, 운영 영향이 있으면 즉시 revert 후보).
- #32 qa 단계에서 위 성공 기준 1~3이 실제로 충족되는지, 데모 payload에 부족한 유형이 있으면 같은 파일에 보강한다.
- 월이 바뀌었을 때(월 오프셋) 지난달 대비 변화가 0이 아닌지, 1~3월 주입 시 전년 달 삭제는 #32 보존 수정에 의존함을 확인한다.

## 교차 검토 (planner-designer)
spec.md와 일치한다: 성공 기준 1~4 = spec 완료 기준 10·15·6·7, 운영 무영향·동적 import·1~3월 의존성 모두 반영됨. 참고: "출시 후 운영 회귀"는 qa 회귀 항목이며 spec 완료 기준 4(production DOM 없음)로 사전 보증.

planner-designer 승인
