# 6차 발굴 — developer 코드 근거 (2026-11-28)

기준 코드는 origin/main d9e318f(v5.172)이고 읽기만 했다. 작업 트리에 node_modules가 없어 vitest는 돌리지 않았다. 아래 숫자는 코드 식을 손으로 따라가 계산한 값이다. 기존 보류·기각 후보(N2, K-1, 옛 0 환율, 기존 희석값 보정 G, 해외 기준일 문구, 결산 배당 D, 공용 dialog 포커스 등)와 겹치는 것은 뺐다.

## 후보 1 (p2, 버그) 전량 매도 기록을 지우면 평단 0으로 복원된다 (주식·코인)
- **원인**: 전량 매도 시 `computeNewPosition`이 평단과 환율을 0으로 지운다(`src/lib/trade/trade-utils.ts:87-93`). 쓰기 경로(`trade-input.tsx:458-468`)가 이 값을 그대로 저장한다. 나중에 그 매도를 지우면 `reverseTransaction`은 매도분을 되돌릴 때 수량만 복원하고 평단은 현재 값(0)을 유지한다(`trade-utils.ts:144-149`). 그래서 기록에 없는 기준 보유분(직접 입력분)의 평단을 되살릴 수 없다.
- **경로**: 주식은 `stock-trades-view.tsx:159-189`에서 `rollbackStockTrade`(`trade-form.ts:61-70`)를 거쳐 `averagePrice: 0`을 저장한다. 코인은 `crypto-tx-view.tsx:98-117`의 `rollbackTransaction`으로 같은 일이 생긴다. 확인창(`delete-rollback-dialog.tsx:97`)에 `100 → 0원`이 그대로 보이고 막는 장치가 없다.
- **영향**: 복원된 행의 원가가 0이 되어 손익이 평가액 전체로 잡힌다. 상세 헤더, 증권사별 합계, 성적표, 절세 시뮬 손익이 부풀려진다. 입력한 평단을 잃는 것이므로 기록 손실이다.
- **경계**: 앱에서 기록한 매수로만 만든 보유는 역산 결과가 맞다(매수 역산 시 0주에서 다시 계산). 매도로 0주가 된 뒤 다시 매수했고, 그 이전 매도를 지우는 경우도 같은 결함이 생긴다. 성적표의 실현손익은 이 상황을 이미 'R=0 현행'으로 문서화했다(`asset-report.ts:1175`). 다만 삭제 롤백 쪽 결과는 어디에도 기록되어 있지 않다.
- **줄이는 안**: ① 확인창에서 결과가 `수량 > 0 · 평단 ≤ 0`이면 '평단을 알 수 없음'을 보여 주고 평단 입력을 받거나 삭제를 막는다(기존 데이터도 보호된다). ② 전량 매도 때 평단을 보존하는 쓰기 정책은 성적표 R 계산(`:1206` 가드)을 바꾸므로 별도로 판정한다. ①만 하면 저장·스키마·서버 전송 변경은 0이다.
```ts
// 재현 스케치(미실행) — src/lib/__tests__/full-sell-rollback.test.ts
import { it, expect } from "vitest";
import { computeNewPosition, rollbackTransaction } from "@/lib/trade/trade-utils";
import { rollbackStockTrade } from "@/lib/trade/trade-form";
const P = (q: number, a: number, r = 0) => ({ quantity: q, avgPrice: a, avgExchangeRate: r, source: "manual" as const, effectiveDate: "2026-01-01", lockedByManual: false });
const T = (id: string, type: "buy" | "sell", q: number, price: number, date: string) => ({ id, type, quantity: q, price, date, reflected: true, createdAt: `${date}T00:00:00Z` });
it("A 직접 입력 10주@100 → 전량 매도 → 매도 삭제", () => {
  const s = T("s", "sell", 10, 130, "2026-11-20");
  const now = computeNewPosition(P(10, 100), s);                 // {0, 0, 0}
  const r = rollbackStockTrade(P(now.quantity, now.avgPrice), [s], "s");
  expect(r.quantity).toBe(10);
  expect(r.avgPrice).toBe(100);                                  // 현재 0 → FAIL
});
it("B 직접 10@100 + 매수 10@120 → 전량 매도 → 매도 삭제", () => {
  const b = T("b", "buy", 10, 120, "2026-11-10"), s = T("s", "sell", 20, 130, "2026-11-20");
  const r = rollbackStockTrade(P(0, 0), [b, s], "s");            // 역산 기준분 10@-120 → 재계산 20@0
  expect(r.avgPrice).toBeCloseTo(110, 6);                        // 현재 0 → FAIL
});
it("C 코인 같은 경로", () => {
  const s = T("s", "sell", 1, 9e7, "2026-11-20");
  const now = computeNewPosition(P(1, 8e7), s);                  // {0, 0, 0}
  expect(rollbackTransaction(P(now.quantity, now.avgPrice), [s], "s").avgPrice).toBe(8e7); // 현재 0 → FAIL
});
```

## 후보 2 (p3, 줄이기) 호출처가 없는 Context 쓰기 함수 2개
- `updateTransaction`(`src/contexts/asset-data-context.tsx:250·1773-1784·2142`)은 src 안에 호출처가 0이다. 반영된 거래를 포지션 재계산 없이 고치는 함수라서, 나중에 누군가 다시 쓰면 수량·평단과 거래 기록이 어긋난다. 남겨 두면 함정이 된다.
- `addStockRaw`(`:229·1570·2122`)도 호출처가 0이다. 그런데 KB는 아직 살아 있는 경로로 적고 있다(`state-and-utils.md:41` '스크린샷 전용', `api-reference.md:241`, `qa-full-test-plan.md:454` push 신호 목록).
- 수정안: 두 함수와 인터페이스 항목, KB 3곳을 지운다. 동작 변경 0, risk:low이고 다른 릴리스에 함께 실을 수 있는 크기다. 재현 대신 `grep -rw "updateTransaction\|addStockRaw" src`의 결과가 context 파일 하나뿐인지 확인한다.

## 후보 3 — 0건
- 검토했으나 뺀 것: 동기화 pull의 추가 병합(`asset-storage.ts:280-298`)은 로컬에만 있는 거래를 되살리지만, 같은 보유 종목의 수량 변경은 원격 값을 따른다. 그래서 거래 기록과 포지션이 어긋날 수 있다. 다만 덮인 종목은 `detectOverwrites`(`overwrite-guard.ts:115-127`)가 'modified'로 알리고 되돌리기를 제공하며, 두 기기 동시 push 경쟁에서만 생긴다. 재현 근거가 약해 후보에서 뺐다.
- 배당 수량 역산 기준일(국내는 지급일, 해외는 현지 기준일)은 5.157 tech-review §8에서 이미 다뤘다. 상장폐지 혼합 그룹은 시세 패치가 티커 단위라 생기지 않는다.
