// 배당 공용 계산(#313, 5.157) — 차트·Hero·종목 표·성과 허브·성적표 입력·투입 대비 배당 분자의 단일 출처.
// 규칙(spec 4장): ① 계좌별 원본 행(stock.id)마다 먼저 계산한 뒤 월·카테고리·종목 키로 합친다(병합 행 × 지금 수량 금지)
// ② 반영된 거래가 있으면 지급일 시점 수량을 역산한다(지급일 당일 거래는 지급일 뒤로 본다)
// ③ 지급 = payoutDate <= 오늘(KST) && !isEstimated, 그 밖은 예상 ④ 엔화 행 제외 ⑤ 반올림은 소비처가 마지막 합산 뒤 1회.
// 순수 함수(React 의존 0). 서버로 보내는 값 0 — 수량·거래는 이 함수 안에서만 쓴다.
import type { Stock, Transaction } from "@/types/asset";
import type { DividendPayoutResult } from "./finance-service";

export const DIVIDEND_CATEGORY_KEYS = ["domestic", "foreign", "irp", "isa", "pension"] as const;
export type DividendCategory = typeof DIVIDEND_CATEGORY_KEYS[number];

export interface DividendRowInput {
  /** 계좌별 원본 행 — mergeStockGroup 결과를 넣지 않는다(id가 바뀌어 거래와 매칭이 끊긴다) */
  stock: Stock;
  payouts: DividendPayoutResult[];
}

export type QtyUsed = "derived" | "current";

export interface HeldQty {
  qty: number;
  qtyUsed: QtyUsed;
}

export type DividendMonthState = "none" | "inactive" | "paid" | "expected";

export interface DividendStockResult {
  key: string;
  category: DividendCategory;
  paid: number;
  expected: number;
  /** 외화(USD) 금액 — 원화 행은 0 */
  paidForeign: number;
  expectedForeign: number;
  perMonth: { paid: number[]; expected: number[]; paidForeign: number[]; expectedForeign: number[] };
  /** 월별 표시 상태(0..11): inactive = 지급은 있지만 그때 보유 0, paid = 모두 지급, expected = 하나라도 예상 */
  monthState: DividendMonthState[];
  /** 수량이 1주 이상 잡힌 첫 지급(없으면 undefined) — 표의 주당 표시용 */
  firstPayout?: DividendPayoutResult;
  /** 한 지급이라도 지금 수량 폴백을 썼으면 'current'(테스트용, 화면 표시 0) */
  qtyUsed: QtyUsed;
  /** 지금 수량 합(표시용) */
  heldQty: number;
}

export interface DividendCalcResult {
  months: Array<{ month: number; byCategory: Record<DividendCategory, { paid: number; expected: number }> }>;
  byStock: Map<string, DividendStockResult>;
  annual: { paid: number; expected: number; total: number };
}

/** groupStocksByTickerCategory와 같은 키 — 병합 행·원본 행이 같은 키를 낸다 */
export function dividendStockKey(stock: Pick<Stock, "id" | "ticker" | "category">): string {
  return stock.ticker ? `${stock.ticker}:${stock.category}` : stock.id;
}

/** 엔화 종목 — 배당 조회·계산에서 뺀다(서버가 일본 시장을 조회하지 않고, 엔화 환산 미지원) */
export function isDividendExcludedCurrency(stock: Pick<Stock, "currency">): boolean {
  return stock.currency === "JPY";
}

/** 지급 판정(날짜 기준) — 추정 행은 날짜가 지나도 예상, 확정이어도 미래 날짜면 예상 */
export function isDividendPaid(p: Pick<DividendPayoutResult, "payoutDate" | "isEstimated">, todayKst: string): boolean {
  return p.payoutDate <= todayKst && !p.isEstimated;
}

// 부동소수 누적 오차(0.3 − 0.1 − 0.2 ≠ 0)로 음수 폴백이 잘못 걸리지 않게 소수 8자리로 맞춘다
const roundQty = (q: number) => Math.round(q * 1e8) / 1e8 + 0; // +0: -0 → 0

/**
 * 지급일 시점 수량. 거래 수량 규칙은 reverseTransaction(src/lib/trade/trade-utils.ts)과 같다
 * (매수 되돌림 = −수량, 매도 되돌림 = +수량). 단 0으로 자르기 전 값으로 음수를 판정해 폴백한다.
 */
export function heldQtyAt(stock: Stock, txs: readonly Transaction[], payoutDate: string): HeldQty {
  const own = txs.filter((t) => t.stockId === stock.id && t.reflected);
  // 매수일 규칙 — 지급일 <= 매수일이면 0원(당일 매수 = 지급일 뒤 거래와 같은 기준)
  if (stock.purchaseDate && payoutDate <= stock.purchaseDate) {
    return { qty: 0, qtyUsed: own.length === 0 ? "current" : "derived" };
  }
  // 폴백 ① 반영 거래 0건 → 지금 수량
  if (own.length === 0) return { qty: stock.quantity, qtyUsed: "current" };
  // 폴백 ④ 지급일 뒤에 사용자가 수량을 직접 덮어썼으면 그 전 거래를 되돌리는 것은 의미가 없다
  if (stock.positionSource === "manual") {
    const effective = stock.positionEffectiveDate || stock.purchaseDate;
    if (effective && effective > payoutDate) return { qty: stock.quantity, qtyUsed: "current" };
  }
  let qty = stock.quantity;
  for (const t of own) {
    if (t.date < payoutDate) continue; // 지급일 당일 거래는 지급일 뒤로 본다(되돌린다)
    qty = t.type === "buy" ? qty - t.quantity : qty + t.quantity;
  }
  qty = roundQty(qty);
  // 폴백 ② 음수 ③ NaN
  if (Number.isNaN(qty) || qty < 0) return { qty: stock.quantity, qtyUsed: "current" };
  // 수량 0은 폴백이 아니다 — 그 시점에 갖고 있지 않았다
  return { qty, qtyUsed: "derived" };
}

const zeros = () => new Array<number>(12).fill(0);

export function computeDividends(
  rows: readonly DividendRowInput[],
  txs: readonly Transaction[],
  usdRate: number,
  todayKst: string,
): DividendCalcResult {
  const months: DividendCalcResult["months"] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    byCategory: Object.fromEntries(DIVIDEND_CATEGORY_KEYS.map((c) => [c, { paid: 0, expected: 0 }])) as Record<DividendCategory, { paid: number; expected: number }>,
  }));
  const byStock = new Map<string, DividendStockResult>();
  const annual = { paid: 0, expected: 0, total: 0 };

  for (const { stock, payouts } of rows) {
    const cat = (DIVIDEND_CATEGORY_KEYS as readonly string[]).includes(stock.category) ? (stock.category as DividendCategory) : null;
    if (!cat || isDividendExcludedCurrency(stock)) continue;
    const isUsd = stock.currency === "USD";
    const rate = isUsd ? usdRate : 1;
    const key = dividendStockKey(stock);
    let entry = byStock.get(key);
    if (!entry) {
      entry = {
        key, category: cat, paid: 0, expected: 0, paidForeign: 0, expectedForeign: 0,
        perMonth: { paid: zeros(), expected: zeros(), paidForeign: zeros(), expectedForeign: zeros() },
        monthState: new Array<DividendMonthState>(12).fill("none"),
        qtyUsed: "derived", heldQty: 0,
      };
      byStock.set(key, entry);
    }
    entry.heldQty += stock.quantity;

    for (const p of payouts) {
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (!(m >= 0 && m < 12)) continue;
      const { qty, qtyUsed } = heldQtyAt(stock, txs, p.payoutDate);
      if (qtyUsed === "current") entry.qtyUsed = "current";
      if (!(qty > 0)) {
        if (entry.monthState[m] === "none") entry.monthState[m] = "inactive";
        continue;
      }
      if (!entry.firstPayout) entry.firstPayout = p;
      const paid = isDividendPaid(p, todayKst);
      const amount = p.amountPerShare * qty * rate;
      const foreign = isUsd ? (p.amountForeign ?? p.amountPerShare) * qty : 0;
      if (paid) {
        months[m].byCategory[cat].paid += amount;
        entry.paid += amount;
        entry.paidForeign += foreign;
        entry.perMonth.paid[m] += amount;
        entry.perMonth.paidForeign[m] += foreign;
        annual.paid += amount;
        if (entry.monthState[m] !== "expected") entry.monthState[m] = "paid";
      } else {
        months[m].byCategory[cat].expected += amount;
        entry.expected += amount;
        entry.expectedForeign += foreign;
        entry.perMonth.expected[m] += amount;
        entry.perMonth.expectedForeign[m] += foreign;
        annual.expected += amount;
        entry.monthState[m] = "expected";
      }
      annual.total += amount;
    }
  }

  return { months, byStock, annual };
}

/** 월별 지급·예상·합계(반올림 전) — 차트 툴팁 합계·월 선택 Hero가 같은 값을 쓴다 */
export function monthSums(calc: DividendCalcResult): Array<{ paid: number; expected: number }> {
  return calc.months.map(({ byCategory }) => {
    let paid = 0;
    let expected = 0;
    for (const c of DIVIDEND_CATEGORY_KEYS) {
      paid += byCategory[c].paid;
      expected += byCategory[c].expected;
    }
    return { paid, expected };
  });
}
