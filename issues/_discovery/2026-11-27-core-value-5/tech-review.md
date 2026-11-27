# 5차 발굴 N1 tech-review — 혼합 매입환율 합친 행 손익 (developer, 2026-11-27)

기준 코드는 origin/main 1c4066f(v5.170)다. 스크래치 worktree에서 vitest로 재현했고, 끝난 뒤 지웠다. 구현·push·운영 접속은 하지 않았다.

## 1. 재현 결과 (숫자)

환율 USD 1,400 / JPY 950(100엔당). A는 10주·$100·현재 $120이고 매입환율 1,300이다. B는 같은 종목, 같은 수량이고 매입환율이 없다.

| 경우 | 헤더 `computeStockTotals` | 증권사별 합 | 합친 행 | 종목 한 장 | 절세 시뮬 |
|---|---|---|---|---|---|
| USD A(1300)+B(없음) | 660,000 | 660,000 | **760,000** | **760,000** | **760,000** (estimated=false) |
| USD A+B(0, 칸을 지움) | 660,000 | 660,000 | **760,000** | **760,000** | **760,000** |
| JPY A(900)+B(없음), 100주·¥2,000→¥2,500 | 1,050,000 | 1,050,000 | **1,150,000** | **1,150,000** | **−355,250,000** |
| 통제: 둘 다 있음(1300·1350) | 710,000 | 710,000 | 710,000 | 710,000 | 710,000 |
| 통제: 둘 다 없음 | 560,000 | 560,000 | 560,000 | 560,000 | 560,000 (estimated=true) |
| 통제: 국내 2건 | 200,000 | — | 200,000 | — | — |

- **재현됐다.** 혼합 그룹에서는 합친 행·종목 한 장·절세 시뮬이 헤더·증권사별 합보다 **10만 원 크다**. B 몫(10주×$100)이 원가 1,400이 아닌 1,300으로 잡혀서다. 원인은 `asset-detail-tabs.tsx:97-101`과 `tax-utils.ts:204-209`다.
- 절세 시뮬의 `estimated`는 혼합 그룹에서 false로 나온다. 절반이 추정인데도 '추정' 표시가 빠진다.
- **별건 N3(신규)**: 절세 시뮬은 JPY를 100배로 계산한다. 환율이 있는 엔화 종목 하나만 있어도 +575,000이 아니라 −177,625,000이다. `tax-utils.ts:220`은 100엔당 저장값을 그대로 원가 환율로 쓰고, 매도 환율은 1엔당(`:68`)이다. `:125` 실현손익의 `tx.exchangeRate`(100엔당)와 `krwMul`(1엔당)을 섞어 쓰는 문제도 같은 계열이다. N1과 원인이 다르므로 이슈를 따로 연다(권장).
- **별건 N4(신규)**: 거래 기록이 환율을 희석한다. 매입환율이 없는 보유(10주)에 매수 10주를 기록하면 체결 환율이 오늘 환율 1,400으로 채워진다(`resolveTradeRate`). 그런데 `computeNewPosition`(`trade-utils.ts:75-78`)이 0과 가중 평균을 내서 **700**을 저장한다. 이 경우는 저장값이 틀린 것이고, 원가가 절반으로 잡혀 헤더 손익까지 부풀린다. 저장 값 정책 변경이라 N1과 분리한다.

## 2. purchaseExchangeRate가 실제로 저장되는 값 (C162)

| 경로 | 코드 | 저장값 |
|---|---|---|
| 직접 입력, 달러 평단 | `stock-input.tsx:124`(currency만 설정), `:338`(빈칸 → `\|\| 0`) | 칸을 건드리지 않으면 **없음**, 입력 후 지우면 **0** |
| 직접 입력, 원화 평단 | `stock-input.tsx:122` | 입력값, 없으면 **오늘 환율** |
| 증권사 사진 인식 | `stock-screenshot-import.tsx:277` | 항상 **오늘 USD 환율** |
| 거래 기록(새 종목·기준분 0) | `trade-input.tsx:464` + `trade-form.ts:8` | 체결 환율, 빈칸이면 **오늘 환율** |
| 거래 기록(기존에 환율 없는 보유) | 같은 경로 + `trade-utils.ts:75` | **희석값**(N4) |
| 거래 내역 화면 수정 | `stock-trades-view.tsx:186` | 같은 계산, 0이면 **없음** |
| 재동기화 새 항목 | `apply.ts:287` | 화면 fx, 없으면 **오늘 환율** |
| 재동기화 승계 | `apply.ts:259` | **기존 값 유지**(없으면 없음) |
| 나누기 대화상자 | `stock-tab.tsx:537` | 기존 항목 값, 새 행은 첫 항목 값 |

'없음/0'은 직접 입력(달러)에서 생기고, 옛 데이터와 재동기화 승계로 남는다. 재현 픽스처는 A를 실제 함수 `resolveTradeRate`→`computeNewPosition`으로, B를 직접 입력의 '없음'과 '0' 두 값으로 만들었다.

## 3. 합치기 소비처 전수 (13곳)

| 파일:줄 | 사용 화면 | 영향 |
|---|---|---|
| `detail/tabs/stock-tab.tsx:241`(→ `:1281` 행, `StockDetailGrid` 환차·매입환율, `:1056` '그 외' 합) | 상세 › 주식 종목 행·펼침 | **있음** |
| 같은 hook → `share/share-card.tsx:509`(screenshotMode) | 인증카드 주식 행·'그 외' 합 | **있음**(금액이 가려지지 않으면 손익 % 변화) |
| `lib/finance/stock-page.ts:33` | 종목 한 장 머리 | **있음** |
| `lib/asset/grow-rows.ts:215-220` | 성적표 › 이름표 블록 수익률 | **있음** |
| `lib/tax-utils.ts:204`(복제 규칙) | 세금 › 연말 절세 시뮬 | **있음**(+estimated) |
| `lib/asset/grow-board.ts:299` | 불리기 판 | 없음(원가는 항목별 합, merged는 이름·날짜) |
| `detail/trades/stock-trades-view.tsx:89` | 거래내역 머리 | 없음(수량·평단·평가만) |
| `detail/stock-tools.tsx:27`, `xray/stock-xray-view.tsx:126`, `lib/xray/region-split.ts:15`, `activity/asset-report-view.tsx:236` | X-Ray 타일·X-Ray·지역 분할·성적표 집중도 | 없음(평가액 비중) |
| `activity/profit-chart.tsx:257` | 수익 차트 | 없음(기간 기준가 × 수량) |
| `activity/use-dividend-data.ts:62` | 배당 | 없음(표시용, 계산은 items) |
| `lib/finance/my-stock-today.ts:38` | 오늘 내 종목 | 없음(평가액) |

## 4. 수정안 (저장 변경 0)

- `mergeStockGroup(items, rates?)`에 선택 인자를 더한다. **rates가 있고 해외 그룹에 환율이 있음·없음이 섞일 때만** 합친 `purchaseExchangeRate = Σ(평단×수량×항목 환율, 미입력이면 지금 환율) / Σ(평단×수량)`로 계산한다. 단위는 저장 단위(JPY 100엔당)를 그대로 쓴다. 그러면 합친 원가와 환차는 항목별 합과 정확히 같아진다. 스크래치 검증 결과: USD 660,000=660,000, 환차 100,000=100,000, 합친 환율 1,350. JPY 1,050,000=1,050,000, 925.
- rates를 넘기는 곳은 영향 4곳뿐이다(`stock-tab.tsx:241`, `stock-page.ts:33`, `grow-rows.ts:215`, `tax-utils.ts:204`). 나머지 8곳은 손대지 않는다. `tax-utils`의 복제 규칙에도 같은 식을 넣고, 혼합이면 `estimated=true`로 둔다.
- **통제군은 불변이다**: 전부 있음과 전부 없음은 기존 분기를 그대로 탄다. 국내·KRW는 분기에 들어가지 않는다. USD 보기는 `computeStockMetrics`가 지금 환율을 쓰므로 영향이 없다. 단일 항목은 `length===1` 조기 반환이다.
- **기준 보유 0(C163)**: 항목 수량 0은 가중치가 0이라 영향이 없다(검증함). 그룹 합계 수량 0이면 Σ가 0이므로 지금 동작(`items[0]` 값)을 유지한다(검증함). 앱 거래로만 만든 종목은 환율이 항상 >0이라 혼합 분기에 들어가지 않는다. 혼합 분기는 직접 입력 '없음/0' 항목이 섞일 때만 탄다.
- **표시 결정 필요(ui-designer)**: 펼침 '매입환율' 칸(`stock-tab.tsx:687`)에 1,350처럼 지금 환율이 섞인 값이 뜬다. 권장안은 혼합일 때 문구를 '일부 미입력 (현재환율)'로 바꾸는 것이다(`groupItems`로 판정). 숫자를 그대로 두는 안과 함께 ui.md에서 정한다.
- **인증카드·screenshotMode**: 레이아웃·DOM은 0 변경이다. 혼합 그룹의 손익 숫자만 헤더 기준과 같아진다. 캡처 diff는 혼합 픽스처에서만 생기고 통제군에서는 0이어야 한다.
- **데이터 영향**: 저장·동기화·스냅샷·거래·공유 토큰·백업은 0이다. 성적표에서는 이름표 수익률(표시)만 바뀌고 스냅샷 계산은 0이다. 서버 전송도 0이다. 롤백하면 표시만 되돌아가고 기록 손실은 없다. 판독 경계일(머지일)을 기록한다(C144).
- **크기 줄이기**: 파일 5개(위 4곳 + asset-detail-tabs)에 단위 테스트 1개다. UI 문구 변경을 빼면 ui 단계를 생략할 수 있으나, 그 경우 '매입환율 1,350' 표시가 남는다.

## 5. N2 동반 여부 · risk

- **N2는 같은 릴리스에서 제외한다(권장).** 빈칸을 오늘 환율로 채우는 것은 저장 값 정책 변경이라 사업·CEO 판정이 필요하다. N1은 계산만 고치므로 N2 없이도 단독으로 완결된다. N2가 머지되면 새 혼합 그룹은 줄어들지만, 기존 기록과 재동기화 승계분에는 N1이 여전히 필요하다. N4(희석)와 N3(JPY 100배)는 별도 이슈로 올리는 것을 권장한다. N3는 표시 금액 오류가 크므로 우선순위를 높게 둔다.
- **risk: medium**(초안). 저장·스키마·서버·동기화 변경은 0이다. 다만 상세·종목 한 장·성적표·절세 시뮬·인증카드의 표시 손익이 바뀐다(혼합 그룹 한정). 머지 위임 조건 ④·⑤를 충족한다. 위임 가능 여부는 cto가 판정한다.

## 부록 — 재현 테스트 (스크래치, 커밋 안 함)

```ts
// N1 재현 — 같은 해외 종목을 증권사 A(매입환율 있음)·B(없음)에 나눠 담았을 때 손익 비교
import { describe, it, expect } from "vitest";
import { computeStockMetrics, computeStockTotals, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { buildStockGroupHead } from "@/lib/finance/stock-page";
import { getYearEndTaxSimulation } from "@/lib/tax-utils";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import { resolveTradeRate } from "@/lib/trade/trade-form";
import type { AssetData, Stock } from "@/types/asset";

const rates = { USD: 1400, JPY: 950 };
const base = (o: Partial<Stock>): Stock => ({ id: "x", category: "foreign", name: "애플", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 120, currency: "USD", purchaseDate: "2026-01-01", description: "", ...o } as Stock);
// A: 거래 기록 경로(resolveTradeRate → computeNewPosition)
const rateA = resolveTradeRate({ input: 1300, currentRate: rates.USD, isForeign: true })!;
const posA = computeNewPosition({ quantity: 0, avgPrice: 0, avgExchangeRate: 0, source: "manual", effectiveDate: "", lockedByManual: false }, { type: "buy", quantity: 10, price: 100, exchangeRate: rateA } as never);
const A = base({ id: "a", broker: "A증권", quantity: posA.quantity, averagePrice: posA.avgPrice, purchaseExchangeRate: posA.avgExchangeRate || undefined });
// B: 직접 입력 달러 평단, 환율 칸 미입력(없음) / 지움(0)
const B = base({ id: "b", broker: "B증권" });
const B0 = base({ id: "b0", broker: "B증권", purchaseExchangeRate: 0 });

function compare(items: Stock[]) {
  const header = computeStockTotals(items, rates);
  const brokerSum = items.reduce((s, it) => s + computeStockMetrics(it, rates).profit, 0);
  const row = computeStockMetrics(mergeStockGroup(items), rates).profit;
  const page = buildStockGroupHead(items, rates, "KRW").profit;
  const tax = getYearEndTaxSimulation({ stocks: items, transactions: [] } as unknown as AssetData, 2026, rates).candidates[0];
  return { header: header.totalProfit, brokerSum, row, page, tax: tax.unrealizedGainKrw, taxEstimated: tax.estimated };
}

describe("N1 혼합 매입환율 재현", () => {
  it("USD 혼합: 헤더=증권사합 ≠ 행=종목한장=절세", () => {
    const r = compare([A, B]);                  // header 660,000 / row·page·tax 760,000
    expect(r.header).toBe(r.brokerSum);
    expect(r.row).not.toBe(r.header);
    expect(r.page).toBe(r.row);
    expect(r.tax).toBe(r.row);
  });
  it("USD 0 환율도 동일", () => { const r = compare([A, B0]); expect(r.row).not.toBe(r.header); });
  it("JPY 혼합", () => {
    const J = (o: Partial<Stock>) => base({ ticker: "7203", name: "도요타", currency: "JPY", quantity: 100, averagePrice: 2000, currentPrice: 2500, ...o });
    const r = compare([J({ id: "ja", broker: "A", purchaseExchangeRate: 900 }), J({ id: "jb", broker: "B" })]);
    expect(r.row).not.toBe(r.header);           // 1,150,000 vs 1,050,000, tax −355,250,000(N3)
  });
  it("통제군 일치", () => {
    const both = compare([A, base({ id: "c", broker: "C", purchaseExchangeRate: 1350 })]);
    const none = compare([B, base({ id: "d", broker: "D" })]);
    for (const r of [both, none]) { expect(r.row).toBeCloseTo(r.header, 6); expect(r.tax).toBeCloseTo(r.header, 6); }
    const kr = (id: string) => base({ id, category: "domestic", ticker: "005930", currency: "KRW", averagePrice: 70000, currentPrice: 80000 });
    expect(computeStockMetrics(mergeStockGroup([kr("k1"), kr("k2")]), rates).profit).toBe(computeStockTotals([kr("k1"), kr("k2")], rates).totalProfit);
  });
  it("N4 희석", () => {
    const p = computeNewPosition({ quantity: 10, avgPrice: 100, avgExchangeRate: 0, source: "manual", effectiveDate: "", lockedByManual: false },
      { type: "buy", quantity: 10, price: 100, exchangeRate: resolveTradeRate({ input: undefined, currentRate: 1400, isForeign: true }) } as never);
    expect(p.avgExchangeRate).toBe(700);
  });
});

// 수정안 검증: 혼합일 때만 합친 환율 = Σ(원통화 원가 × 항목 환율|지금 환율) / Σ원통화 원가
function mergeFixed(items: Stock[], r: { USD: number; JPY: number }): Stock {
  const m = mergeStockGroup(items);
  if (items.length === 1) return m;
  const foreign = items[0].category === "foreign" && items[0].currency !== "KRW";
  const has = (it: Stock) => !!it.purchaseExchangeRate && it.purchaseExchangeRate > 0;
  if (!foreign || items.every(has) || !items.some(has)) return m;
  const cur = items[0].currency === "JPY" ? r.JPY : r.USD;
  const w = items.reduce((s, it) => s + it.averagePrice * it.quantity, 0);
  if (!(w > 0)) return m;
  return { ...m, purchaseExchangeRate: items.reduce((s, it) => s + (has(it) ? it.purchaseExchangeRate! : cur) * it.averagePrice * it.quantity, 0) / w };
}
// [A,B]·[A,B0]·JPY 혼합·[A,B,0주] 모두 행 손익·환차 = 항목 합(660,000/100,000, JPY 1,050,000/100,000), 합계 0주 그룹은 기존 값 1300 유지 — 6/6 통과
```
