# #252 tech-review — 등록 당일 재접속 없으면 다음 날 '신규 현금 +X' 반복 (p2)
기준: `origin/issue-5.134`(e6cd751). 재현은 vf-5134 임시 테스트(삭제 완료, 변경 0).

## ① 원인·재현 (확정)
- `saveSnapshots`(`src/contexts/asset-data-context.tsx` 667) 호출은 2곳뿐: `initAndSync`(앱 열 때, 928)·자산 0→양수 전환(944). 등록·수정·삭제 뒤 재호출 없음.
- 키 구조: 일별 `secretasset_daily_snapshots`의 `date` 1행/일(평일=오늘, **일요일=토요일 행 upsert**), 월별 `month` 1행/월(`date`=마지막 기록일), 연 `assetData.yearlyNetAssets`. `lastVisitDate`=저장일.
- 흐름: D일 열기 → 행 D=등록 전 → 등록 → D+1 열기 → `previousVisitDate`=D → Hero 시작점=행 D(등록 전) → 같은 원인이 '전일 대비'로 다시 나옴.
- 재현(`computeAttributionView`, 정밀 분기):

| 경우 | 현행 D+1 | 행 D를 등록 후로 갱신 시 D+1 | D 당일 Hero(갱신 후) |
|---|---|---|---|
| 신규 현금 500만 | 신규 현금 +500만 | 원인 없음(Δ0) | 신규 현금 +500만 유지 |
| 주식 매수 기록 | 주식 매수 +71만 | 원인 없음 | 유지 |
| **당일 입금 기록 100만** | 현금 입금 +100만 | **현금 입금 +100만 / 현금 정리 −100만 (유령 짝)** | 유지 |

- 유령 짝 원인: 현금·대출 기록은 Hero 경로에서 시작일 당일을 **포함**(`inFlowWindow` ②, `isFirstSegment=true`) — "시작 행은 그날 기록 전"을 전제. 주식·코인은 이미 제외, 월 결산(`change-hero.tsx` 287·323)도 `includeStartDay=false`. **같은 날 앱을 두 번 연 사용자는 지금도 이 짝을 본다**(두 번째 열기가 행 D를 덮어씀) — 기존 잠재 결함.
- 결론: 행 갱신만 하면 반복은 사라지지만 입금 기록 있는 날마다 짝이 생긴다 → **갱신 + 시작일 경계 보정을 같이** 해야 한다.

## ② 갱신 방식 비교
| 안 | 내용 | 부작용 |
|---|---|---|
| A. 등록 직후 `saveSnapshots` 재호출 | 그대로 재사용 | 편집마다 `/api/finance/profit` 호출(KIS 부하·서킷), 월·연 행 갱신, 연 upsert가 `setAssetData`→assetData 의존 effect면 **무한 루프 위험**, 결산 수치 변동(#237 판독) → 비권고 |
| **B. 오늘 일별 행만 재계산 (권고)** | `ASSET_USER_EDIT_EVENT`(모든 사용자 편집의 단일 신호, 동기화 push 트리거와 동일)로 오늘 행만 같은 수식으로 다시 씀 | 네트워크 0, assetData 쓰기 0(루프·push 추가 0). 아래 조건 필요 |

B 세부(구현 최소):
1. `saveSnapshots`의 행 계산부(nab·cost·fxBase·enrich)를 모듈 함수로 추출해 두 곳이 공유(수식 중복 금지). 마지막 `refMap`과 저장일을 ref에 보관.
2. 갱신 조건: 평일 · 오늘 행 존재 · 이번 세션에서 오늘 `saveSnapshots` 성공(ref 날짜=오늘) · `saveSnapshotsBlockedRef`·`isBackgroundWorkBlocked()` 아님. 종가는 보관한 refMap, 신규 종목은 `currentPrice`(saveSnapshots 폴백과 동일). `grade` 보존. `setSnapshotVersion`만 올림. 월·연 행·`lastVisitDate`는 건드리지 않음.
3. **일요일은 갱신 안 함**: 일요일 Hero의 시작점이 토요일 행이라 갱신하면 그날 등록이 Hero에서 사라진다(③ 위반). 남는 한계: 일요일 등록은 월요일에 'M/D 이후'로 한 번 더 보임.
4. 경계 보정(`asset-report.ts` `computeAttributionSince`→`resolveAttribution`, `getAttributionRecords` 같은 술어): **시작점이 정밀(enriched)일 때만**, 시작일 당일 현금·대출 기록은 `createdAt`(KST 날짜) > 시작일인 것만 포함(=그날 행이 닫힌 뒤 소급 입력). 예측(레거시) 분기·#251 `estimatePeriodInflows`·결산(`computeAttributionBetween`) 변경 0. 기존 2026-08 P1 테스트(578·597·723)는 픽스처 `createdAt`=실행 시각이라 그대로 통과하는 구조(개발 때 확인 필수).

부작용 점검(B 기준):
- 원인 분해: 합계=Δ순자산 불변, 반복·유령 짝 제거. 구버전이 쓴 '등록 전' 행 + 같은 날 입금 기록은 다음 날 `현금 입금`→`신규 현금` 이름만 바뀜(금액 동일, 수익 이름 아님, 배포 당일·혼재 기기 한정).
- 7일 카드: 오늘 막대가 편집 즉시 반영(지금은 재접속 때). 표시 동작 변화 → qa 확인.
- 월·연 결산·#237: 월·연 행 불변 → 영향 0. 4.94 처음 결산: 시작 행(R+1일)이 그날 편집을 포함하게 되어 `includeStartDay=false`와 일치(지금은 그날 기록이 어느 구간에도 안 잡힘) — R일 행은 계속 제외라 회귀 없음.
- #251 예측 분해: 레거시 시작점 전용, 갱신 행은 정밀 → 상호작용 0.
- 동기화: 일별 행은 E2EE payload(`collectSnapshotsFromStorage`)에 이미 포함. **형식 불변, 내용 갱신 시점만 빨라짐**. 갱신이 push 디바운스(2.5초) 전에 끝나므로 같은 push에 실림. pull은 일별을 통째 교체 — 구버전 기기 행이 오면 현행 동작(반복)으로 돌아갈 뿐 손실 0.
- 스키마·저장 키·마이그레이션·공유 토큰 변경 0. 롤백: 행 형식 동일, 구버전은 같은 날 기록에 유령 짝(재접속 사용자의 현행과 같음), 기록 손실 0.
- 서버 전송 증가 0(갱신은 네트워크 없음, 동기화는 암호문 그대로).

## ③ 오늘 등록 → 오늘 Hero '신규' 유지
Hero·일 탭·주 탭 모두 시작점 후보가 `_date < 오늘`(실시간 끝점)이라 오늘 행 갱신과 무관 — 재현으로 확인(위 표 4열). 일요일은 2번 조건으로 보호.

## ④ 테스트·규모·등급
- 단위(신규 2파일 ~14건): 행 계산 추출 함수 = 기존 saveSnapshots 결과와 동일(골든)·grade 보존 / 갱신 함수: 오늘 행 없음·일요일·ref 날짜 불일치·차단 시 no-op, 다른 행 deep-equal 불변 / 원인: 신규 현금·대출·주식 매수·삭제·잔액 직접 수정 D+1 반복 0, D 당일 신규 유지, 당일 입금 짝 0, 소급 입력(createdAt 다음 날) 포함, 구버전 '등록 전' 행 이름 전환, 레거시 시작점 현행 유지, 기록 목록=원인 일치, 합계=Δ 불변.
- 기존 전체 스위트 무수정 통과(특히 asset-report P1·forecast-cash-split-251·settlement-first-record·week-attribution·use-day-hero).
- 규모: `asset-data-context.tsx`(추출+ref+리스너), `asset-report.ts`(경계 술어 2곳), `week-attribution.ts`(전달). UI 변경 0.
- **위험 등급 초안: `risk:high`** — 스키마 변경은 0이나 동기화되는 저장 값의 쓰기 경로 추가(위임 조건 ④ 불충족)와 원인 경계 규칙 변경(금액 계산 규칙 해석). cto가 '쓰기 시점만, 형식 불변'을 ④ 충족으로 보면 medium 가능 — cto 판정.
- 줄이는 안: 경계 보정의 `createdAt` 술어를 빼고 단순 '당일 제외'로 하면 2026-08 P1 테스트가 깨진다(소급 입력 회귀) → 비권고. 행 갱신 없이 Hero만 고치는 안은 행 작성 시각이 없어 판별 불가(시각 필드 추가=스키마 변경) → 비권고. B가 최소.
