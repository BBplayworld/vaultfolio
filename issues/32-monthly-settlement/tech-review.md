# #32 tech-review — developer (2026-10-27, main 4234d0d 기준)

근거: spec.md(승인본), challenge.md, qa-report.md, 실제 코드. 결함 판정은 하지 않으며, 의심 사항은 `결함 의심:`으로 남긴다.

## 1. 영향 파일·모듈
| 구분 | 경로 | 변경 |
|---|---|---|
| 보존 | `src/contexts/asset-data-context.tsx:770` | `startsWith(currentYear)`를 `pruneMonthlySnapshots`로 교체. `:1102` 원타임 마이그레이션(키가 없을 때만 올해 daily를 씀)은 그대로 둔다 |
| 동기화 | `src/lib/asset/asset-storage.ts` | **변경 없음.** pull·백업 복원·`applySharedData`·`packSnapshots`(:589) 모두 이번 PR diff에서 제외한다(cto 재판정). F-SYNC는 동작이 그대로인지만 확인한다 |
| 순수 함수(신규) | `src/lib/report/settlement.ts` | `pruneMonthlySnapshots`, `resolveSettlementWindow`(21·25·35일 임계), `mapSettlementCauses`, `buildSettlementIcs` |
| 엔진 | `src/lib/report/asset-report.ts` | 래퍼 `computeAttributionBetween` export 1개만 추가한다(§5-1). 기존 함수의 시그니처와 동작은 바꾸지 않고, 기존 `asset-report.test.ts`는 수정 없이 통과해야 한다 |
| 화면 | `views/activity/`: 신규 `asset-change-view.tsx`(기간·범위 셸, 주 탭 목록, 월 결산 블록 1·2·3·7), `net-asset-chart.tsx`(`view` 제어 prop 추가, 월별 막대·목록과 `:213-222` 올해 필터 삭제), `profit-chart.tsx`(`period` 제어 prop, 내부 선택기 숨김), `performance-hub.tsx`(카드 4→3 + 결산 카드), `asset-report-view.tsx:423` growth |
| 내비 | `layout/navigation/navigation-context.tsx:8,19,44`(ActivityTab을 hub/change/dividend/report로, 옛 해시 리다이렉트), `asset-page-tabs.tsx:63-64`, `header-menu/top-bar.tsx:111`, `floating/floating-add-button.tsx:110`, `config/app-features.ts:84-95`, `stores/tutorial/tutorial-store.ts`(step5 profit) |
| 지표 | `src/lib/analytics/ga.ts`: GaEvent에 `settlement_view` 추가, `PARAM_VALUES.source`에 card·menu, `result`에 settled·in_progress·first_month 추가, `:191-192` 화면키를 `activity:change`로 / `__tests__/ga.test.ts` |

## 2. 저장소 스키마
- **스키마·저장 키는 바뀌지 않는다.** `MonthlyAssetSnapshot`(types/asset.ts:232)과 `secretasset_monthly_snapshots` 모두 그대로이고, 바뀌는 것은 보존 범위뿐이다(올해분 → 최근 13개월). 기존 데이터는 그대로 읽히므로 마이그레이션 코드는 필요 없다. 다만 "올해분만 있는 이전 버전 데이터"를 읽었을 때 정상 동작하는지는 테스트로 고정한다(완료 기준 8).
- **§5-1 합집합 병합은 v1에서 제외한다(cto 재판정).** 현재 pull은 받은 값이 비어 있지 않으면 통째로 교체하는데(:333), 이 동작을 그대로 둔다. 구버전 기기가 섞여 있어도 최악의 결과는 현행(올해분만 남음)과 같으므로 알려진 한계로 둔다. 병합은 후보 목록에서 착수 조건을 기다린다. 같은 달 충돌 규칙은 qa 결함 확인 2 ④의 "enrich 있는 쪽 우선 → date가 늦은 쪽 → 수신값" 순서를 그때 적용한다.

## 3. 서버 전송 값
- 새 API는 없다. `.ics`는 클라이언트 Blob으로 만든다.
- GA `settlement_view`에는 열거형 값 2개(`source`, `result`)만 실린다. 금액·날짜·자산 수는 보내지 않는다. 화이트리스트 필터(ga.ts:151)를 통과하지 못한 값은 버려진다.
- E2EE 동기화 payload에는 월 스냅샷이 최대 13건 들어가 1건 정도 늘어난다(pull 코드는 바꾸지 않음). 이 값은 암호문이라 서버가 내용을 볼 수 없다. 공유 토큰 길이도 최대 1건분 늘어난다(F-SHARE 길이 회귀 확인).

## 4. 위험 등급: **high** (cto 재판정에서 확정)
- 근거: WORKFLOW 6장 기준으로 두 항목이 판단이 애매하다. ① 결산 매핑이 사실상 금액 계산 규칙이다. ② 월 스냅샷 삭제 경로(보존 컷오프)를 바꾼다. "애매하면 높은 쪽" 규칙에 따라 high로 본다. 동기화 병합은 v1에서 빠졌다.
- 롤백은 PR revert로 한다. 보존 범위가 넓어지는 방향의 변경이라 되돌려도 데이터가 사라지지 않는다.

## 5. spec보다 커지는 부분과 줄이는 방법
1. **지난 달 결산 API가 없다.** 결함 의심 1: `computePeriodAttribution`은 끝점이 항상 최신 daily 또는 실시간 값이다(:1048). 그래서 "10/5 → 11/5"처럼 과거 두 시점을 잇는 구간을 계산할 수 없다. `AttributionPoint`·`resolveAttribution`도 export되어 있지 않다. 줄이는 방법: 새 경로를 만들지 않는다. `computeAttributionBetween(prevSnap, currSnap, …)` 래퍼 1개만 export한다. 이 래퍼는 `buildAttributionPoints` → `resolveAttribution(…, isFirstSegment=true)`만 호출하고 하이브리드 mid 분할은 하지 않는다(시작점이 레거시면 전체를 "예측"으로 표시). R29에 따라 경계 인자를 명시하고 key별 금액을 단정하는 테스트를 붙인다. 진행 중 구간은 기존 `computeAttributionSince`에 liveCurr를 넘겨 그대로 쓴다.
2. **`deposit` 귀속 문제.** 결함 의심 2: 엔진의 `deposit`은 기록된 임차보증금의 증감이다(라벨 "임차보증금 반환/증가"). spec은 이를 "기록 안 된 변화"로 보내는데, 그러면 기록이 있는데도 "입출금을 기록하면 더 정확해져요" 안내가 뜰 수 있다. 제안: 보증금은 부채 성격의 내부 이동이므로 내부 이동 풀(G)에 넣는다. planner-designer 확인이 필요하다.
3. **두 화면의 기간 탭이 겹친다.** `ProfitCard`와 `YearlyNetAssetChart`가 각자 기간 선택기를 갖고 있어, 바깥에 기간 탭을 하나 더 두면 같은 선택기가 두 번 보인다. 줄이는 방법: 두 컴포넌트를 분해하지 않는다. 제어 prop(`period`/`view`)과 선택기 숨김 prop만 추가한다.
4. **전체·주 탭.** 새 컴포넌트를 만들지 않고 기존 일별 탭의 데이터 경로(:191)를 최근 7일로 잘라 단순 목록으로 보여준다.
5. **월 선택기는 v1 필수 범위로 보지 않는다.** 카드가 여는 달과 현재 진행 구간만 먼저 구현하고, 선택기는 저장된 달의 `<select>` 1개로 최소화한다. 구현 시간이 넘치면 가장 먼저 줄일 후보로 둔다(완료 기준 10이 걸려 있어 cto 동의가 필요하다).

## 6. 테스트 계획 (vitest, `src/lib/report/__tests__/settlement.test.ts` 신규 + 기존 파일 보강)
- `pruneMonthlySnapshots`: 입력 [2025-10, 2025-11, 2025-12] + 현재월 2026-01이면 결과가 4건이다. **연 경계 2026-01·2027-01**(예: 2026-01~2026-12 + 현재월 2027-01이면 13건, 그 앞 달은 삭제)을 고정한다. 14번째로 오래된 달은 삭제된다. 현재월은 항상 남는다. 결과 건수는 입력(현재월 포함)보다 늘지 않는다. 올해분만 있는 구버전 입력은 그대로 유지된다. 비어 있거나 레거시(date 없음)인 입력도 확인한다.
- `resolveSettlementWindow`: §5-2 예시 ①②③, 1월 경계, 35일 초과 간격, 말일−3일부터 10일까지의 노출 창 경계, 첫 달 숨김.
- `mapSettlementCauses`: 키 15종 각각의 귀속 금액을 단정한다. 현금 등록 사용자의 매수 상쇄, 현금 미등록 사용자의 매수가 순유입으로 가는지, debt는 예외에서 빠지는지 확인한다. 항등식(합계 = Δ순자산)과 0원 항목 숨김도 확인한다.
- `computeAttributionBetween`: 월 스냅샷 2개 구간에서 key별 금액과 경계(R29)를 확인한다.
- `buildSettlementIcs`: VCALENDAR/VEVENT, UID·DTSTAMP·DTSTART, CRLF, `RRULE:FREQ=MONTHLY;BYMONTHDAY=-1`, 숫자 금액이 없는지 확인한다.
- `ga.test.ts`: 화면키가 `activity:change`로 바뀌었는지, settlement_view 파라미터 화이트리스트가 맞는지 확인한다. 기존 `asset-report.test.ts`는 **수정 없이** 통과해야 한다(엔진 미변경, 홈 헤더 회귀 확인). F-SYNC pull은 diff가 없으므로 기존 `asset-storage-merge.test.ts`가 그대로 통과하는지만 본다.

## 7. #31 의존과 구현 순서
- WORKFLOW 8장에 따라 #32 development는 #31이 main에 머지된 뒤에 `main`에서 분기한다(브랜치를 쌓지 않는다). 버전 번호는 그 시점에 배정한다(#31이 4.34를 받으면 #32는 4.35가 예상된다).
- #31 데모 JSON에 꼭 필요한 것(#31 spec에 전달): 월 스냅샷 3개월 이상(오늘 기준 월 오프셋, `date`와 enrich 포함), 레거시 월 1건(enrich·date 없음), 현금 등록/미등록 두 데모(`?demo=` 변형 또는 단위 테스트로 대체), 주식 매수 거래 1건 이상, 해외 종목 1개. 데모로 만들기 어려운 날짜 상황(예시 ②, 1월 경계)은 단위 테스트로 대신한다.
  - 블록 7용 `assetRefresh` 갱신 메타를 데모에 주입해야 한다(qa 결함 확인 2 ③). 일부 카테고리는 30일 넘게 지난 날짜로, 나머지는 최근 날짜로 넣는다. 또는 오래된 `assetLastUpdated`를 넣는다. `applyImportedPayload`만으로는 메타가 없어 블록 7이 비어 보인다. 보조로 블록 7 목록 함수는 메타를 인자로 받는 순수 함수로 만들어 단위 테스트한다.
- 구현 순서: ① 순수 함수 4개와 `computeAttributionBetween` + 테스트 → ② 보존 규칙 교체(pull은 변경 없음) → ③ 내비·해시·진입점 이전(ActivityTab 축소) → ④ 자산 변화 셸(제어 prop) → ⑤ 월 결산 블록과 허브 카드 → ⑥ GA·.ics → ⑦ KB 일괄 갱신 → PR 생성 → preview 확인.

## 교차 검토 (planner-designer)

판단: deposit은 내부 이동 풀(G)로 분류한다. 기록이 있는데 "기록 안 된 변화"와 "입출금을 기록하면 더 정확해져요" 안내가 뜨면 사용자가 혼동한다. 보증금 증감은 현금과 부채가 함께 움직여 순자산을 바꾸지 않는다는 점에서 debt와 같다. 결산 5항목에는 보증금 문구를 새로 노출하지 않는다. spec.md 매핑표(deposit 이동, G 정의, 결정 4-4 예외 문구)를 반영했고 ui.md는 변경 없음.
- 동의: 합집합 병합의 같은 달 충돌은 `date`가 늦은 쪽, 같으면 받은 값(spec 5-1 보완으로 채택). 래퍼 `computeAttributionBetween` 1개, 제어 prop, 주 탭 단순 목록은 spec·ui와 일치.
- 월 선택기는 `<select>` 최소화를 허용하되 비활성 달 표시와 `settlement-month-*` testid는 유지(완료 기준 10).
- 위험 등급은 cto 판정에 맡긴다.

planner-designer 승인

cto 재판정 반영 완료

정정 (planner-designer): 위 "같은 달 충돌은 date가 늦은 쪽" 동의와 "합집합 병합 채택" 취지는 cto 재판정으로 v1 제외되어 무효다. pull 경로는 변경하지 않으며 후보 목록으로 이관한다.
