# JPY 배당 환율 1 의심 — QA 판정 (main 1a5e017)

**판정: 기각(현재 사용자 영향 없음). 잠재 결함(휴면 코드)으로만 기록.**

## 근거
1. JPY 종목은 등록 가능(스키마 `currency: KRW|USD|JPY`, 스크린샷·거래 입력)하나, 배당 API는 해외를 KIS `period-rights`의 PRDT_TYPE_CD 512/513/529(미국 거래소)로만 조회한다(`finance-service.ts` fetchDividendOverseas). 운영 `/api/finance/dividend?ticker=7203&type=foreign` → `{"data":[]}`, AAPL은 USD 응답 정상. 일본 종목 배당 payout이 앱에 도달하지 않는다.
2. 4곳 중 `dividend-chart.tsx`·`performance-hub.tsx`는 `currency==="USD"?usdRate:1`로 JPY=1이 맞지만 JPY payout이 비어 있어 합산 0(엔화가 원화로 표시되는 경로 없음). `monthly-dividend-stocks.tsx`는 payout.currency 기준(JPY면 1)이나 동일하게 데이터 없음. `dividend-yield.ts`는 JPY를 분자·분모에서 명시 제외(+테스트 존재)라 해당 없음.

## 재현 조건 (잠재)
KIS가 일본 종목 배당을 반환하도록 API가 확장되거나(예: TSE 조회 추가), 미국 티커와 동일한 코드를 가진 JPY 종목을 등록하면 엔화 수치가 환율 1로 원화 합산(100엔당 환율 대비 약 9배 과대, rate≈JPY/100 필요).

## 영향 범위
현재: 없음(기존 사용자 배당 금액 정확). 일본 종목은 배당 합계에서 조용히 누락(과소)될 뿐. 향후 일본 배당 지원 시 4곳 환산에 `JPY: rates.JPY/100` 분기 추가 필요(그때 결함으로 승격).
