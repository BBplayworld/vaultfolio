# QA 보고서 — #32 (주의: 아직 코드 QA 단계 아님. planning 검토 중 "결함 의심 확인"만 수행)

## 결함 확인

### 의심
saveSnapshots가 월 스냅샷을 `s.month.startsWith(currentYear)`로 걸러 1월 첫 접속 시 전년 월 스냅샷이 전부 삭제된다 (challenge.md ②).

### 판정: 확정

### 근거
- 코드: `src/contexts/asset-data-context.tsx:770` `allMonthly.filter(s => s.month.startsWith(currentYear) && s.month !== currentMonth)` 후 `:780`에서 그 결과만 localStorage에 저장. currentYear는 `:643` 현재 KST 월의 앞 4자리. 주석(`:766`)도 "올해 12개월치 유지"로 의도된 동작이나, 연 경계를 고려하지 않음. 도입 커밋 492ca47 이후 유지.
- 재현: 동일 로직을 최소 복제한 임시 vitest(저장 후 삭제함)에서 입력 [2025-10, 2025-11, 2025-12] + 현재월 2026-01 -> 결과 ['2026-01'] (전년 3건 전부 소실, `toContain("2025-11")` 실패).
- 되살아나는 경로 없음: 동기화 pull(`asset-storage.ts:333`)은 수신 monthly를 그대로 교체(수신분이 비면 로컬 유지)하며 다른 기기도 같은 필터로 잘린 상태. 공유 토큰(`applySharedData` :961)과 백업 복원도 저장된 스냅샷을 그대로 복원할 뿐 재구성 없음. 월 스냅샷용 장기 아카이브 없음(아카이브는 daily 전용). 원타임 마이그레이션(:1097)은 키가 없을 때 올해 daily만 사용.
- 비고: 소스에는 순수 함수 분리가 없어 동일 로직 복제로 검증함.

### 영향 범위
- 이미 발생 중인 구조적 결함: 운영 사용자는 매년 1월 첫 접속 시 전년 월 스냅샷을 잃는다. 직전 연말(2025->2026) 경계에서 이미 소실됐을 것이며 복구 불가(daily는 30일 롤링, 연 앵커는 netAsset만 보존).
- 매년 1월 영향 화면: 순자산 차트 월 탭(`net-asset-chart.tsx:222` 역시 올해만 표시), 성적표 습관 점수·월간 원인분해(prevMonth 기준, `asset-report-view.tsx:317`), 신규 "12월 결산"(11월 비교값 없음). 1월에는 이번 달 1건만 남음.
- 수정 방향(참고): 보존 기준을 "올해"에서 "최근 N개월(예: 13~24개월)"로 변경하고 차트는 표시 시 연 필터 분리, 기존 데이터 무손실이라 스키마 변경·마이그레이션은 불필요.

### 임시 파일 점검
`src/__qa_tmp__/` 삭제 확인. `git status -s`에 남은 변경은 사전 존재한 .claude/agents, CLAUDE.md, docs/ops 수정뿐(본 작업 무관).

### 결함 확인 2 — tech-review.md 결함 의심 4건 (2026-10-27, main 4234d0d, 코드 읽기 기반 판정)

| # | 의심 | 판정 |
|---|---|---|
| ① | 엔진 끝점이 항상 오늘이라 과거 구간 API 부재 | 해당 없음(신규 기능 설계 사항) |
| ② | deposit이 "기록 안 된 변화"로 분류돼 기록이 있어도 안내 노출 | 해당 없음(신규 기능 설계 사항) — spec 보완 필요 |
| ③ | getStaleCategories가 payload 밖 갱신 기록 사용 | 해당 없음(신규 기능 설계 사항) — #31 데모 준비 사항 |
| ④ | 공유 토큰 복원 기기의 월 스냅샷이 병합 시 정상 기록을 덮어씀 | 해당 없음(신규 기능 설계 사항) — 현행 교체 동작은 별도 관찰 |

**① 해당 없음.** `computePeriodAttribution`(asset-report.ts:1037)은 `liveCurr ?? pickAttributionCurr(dailyPoints)`를 끝점으로 쓴다. 이 함수의 계약은 "오늘까지의 1w/1m/3m/ytd 기간 분해"이며 기존 화면(홈·성적표)은 모두 이 계약대로 정확히 동작한다. 과거 두 시점 구간은 현재 어떤 화면에도 없는 신규 요구(지난 달 결산)라서 기존 사용자에게 잘못 표시되는 값이 없다. `computeAttributionBetween` 래퍼 신설은 기능 추가이고 결함 수정이 아니다. 영향 범위: 없음.

**② 해당 없음.** 현행 코드에는 "기록 안 된 변화" 개념과 안내 문구가 없다. `deposit`(asset-report.ts:728,749)은 임차보증금 증감 효과이고 현행 화면에서는 라벨 "임차보증금 반환/증가"로 정상 표시된다. 문제는 신규 spec.md:64 매핑(`deposit` -> 기록 안 된 변화)과 :68 안내 규칙이 결합할 때만 생기며, 이는 spec 설계 보완 사항이다. 권고: spec 소유자가 deposit을 내부 이동 풀(G)로 옮기거나 "기록 안 된 변화" 임계 계산에서 제외하도록 확정하고, mapSettlementCauses 테스트에 "보증금 변동만 있는 달은 안내 미노출" 케이스를 추가한다. 영향 범위: 구현 시 보증금 보유 사용자에게만 해당(구현 전이라 운영 영향 없음).

**③ 해당 없음.** `getStaleCategories`(asset-refresh-status.ts:55)는 localStorage `assetRefresh` 메타와 `assetLastUpdated` 유예(NEW_USER_GRACE_DAYS)를 쓰는 홈 배너용 함수이며 의도된 설계다(이력 없는 신규 사용자는 유예 후 stale). 결산 블록 7이 이를 재사용할 때 데모 payload(`applyImportedPayload`)만으로는 메타가 없어 비어 보일 수 있으나, 이는 데모 데이터 준비 사항이다. 영향 범위: 운영 영향 없음. #31 데모 spec에 "assetRefresh 메타 또는 오래된 lastUpdated 주입"을 포함시키거나 블록 7을 순수 함수(메타를 인자로 받음)로 테스트한다.

**④ 해당 없음.** 월 스냅샷 합집합 병합(`mergeMonthlySnapshots`)은 아직 코드에 없는 신규 설계이고, 현행 pull(asset-storage.ts:333)은 수신분이 비어 있지 않으면 통째로 교체한다. 따라서 "병합이 덮어쓴다"는 현재 재현 대상이 아니다. 참고 관찰: 공유 토큰은 month·netAsset·financialAsset만 인코딩(`packSnapshots` :594, `unpackSnapshots` :607)해 enrich/date가 없고, `applySharedData`(asset-data-context.tsx:952-961)는 복원 후 `notifyAssetUserEdit()`으로 push를 트리거한다. 그래서 현행 코드에서도 복원 기기가 push하면 다른 기기가 enrich 없는 월 스냅샷으로 교체될 수 있다(결산 정확도 저하는 신규 기능이 enrich를 쓰기 시작할 때 비로소 사용자에게 드러남). 병합 구현 시 같은 달 충돌 규칙을 "enrich 있는 쪽 우선, 동률이면 date가 늦은 쪽, 그다음 수신값"으로 정하고 테스트로 고정할 것(tech-review 제안과 같은 방향이되 enrich 유무를 1순위로 둔다). 영향 범위: 공유 토큰 복원 후 동기화하는 사용자, 신규 기능 출시 후.

참고: 소스 수정·임시 테스트 없음(읽기 전용 판정). 앞선 "결함 확인"(1월 전년 월 스냅샷 삭제)은 확정 상태 유지.
