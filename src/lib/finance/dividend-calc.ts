// 배당 공용 계산(#313, 5.157) — 차트·Hero·종목 표·성과 허브·성적표 입력·투입 대비 배당 분자의 단일 출처.
// 규칙(spec 4장): ① 계좌별 원본 행(stock.id)마다 먼저 계산한 뒤 월·카테고리·종목 키로 합친다(병합 행 × 지금 수량 금지)
// ② 반영된 거래가 있으면 지급일 시점 수량을 역산한다(지급일 당일 거래는 지급일 뒤로 본다)
// ③ 지급 = payoutDate <= 오늘(KST) && !isEstimated, 그 밖은 예상 ④ 엔화 행 제외 ⑤ 반올림은 소비처가 마지막 합산 뒤 1회.
// ⑥ 지난 달 추정(isPastEstimate)은 계산·표시에서 뺀다(#376, 5.183) — 이번 달 추정은 예상으로 남긴다.
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

/**
 * 지난 달 추정(#376, 5.183) — 추정 행(isEstimated) 중 지급 달이 이번 달(KST)보다 앞선 것. 실제로 없었던 지급이라
 * 금액·배지·주당 어디에도 넣지 않는다. 이번 달 추정은 늦게 반영될 수 있어 예상으로 남긴다.
 * 서버(route.ts)도 지난 달 추정을 만들지 않지만 캐시가 30일이라 이 클라이언트 규칙이 정본이다.
 */
export function isPastEstimate(p: Pick<DividendPayoutResult, "payoutDate" | "isEstimated">, todayKst: string): boolean {
  return !!p.isEstimated && p.payoutDate.slice(0, 7) < todayKst.slice(0, 7);
}

/**
 * 현금 입금 폼 `M/D 지급일로` 버튼의 후보(#339, 5.169) — 확정 지급(isDividendPaid, 추정·미래 제외) 중
 * payoutDate가 minDate(폼 3년 보관 하한) 이상인 가장 늦은 1건. 없으면 null. 순수 함수.
 */
export function latestPaidPayout<T extends Pick<DividendPayoutResult, "payoutDate" | "isEstimated">>(
  payouts: readonly T[],
  todayKst: string,
  minDate: string,
): T | null {
  let best: T | null = null;
  for (const p of payouts) {
    if (!p.payoutDate || !isDividendPaid(p, todayKst) || p.payoutDate < minDate) continue;
    if (!best || p.payoutDate > best.payoutDate) best = p;
  }
  return best;
}

/**
 * 표 `최근 1주당`(#377, 5.184) — 지난 달 추정을 뺀 확정 회차(추정 아님·이번 달 이하) 중 지급일이 가장 늦은 1건.
 * 서버(route.ts inferEstimatedPayouts)가 예상 금액으로 쓰는 '최신 실지급'과 같은 회차다. 사용자 수량과 무관.
 * 확정 회차가 없으면 남은 회차(예상·미래 확정) 중 가장 이른 1건, 그것도 없으면 null. 순수 함수.
 */
export function latestPerSharePayout<T extends Pick<DividendPayoutResult, "payoutDate" | "isEstimated">>(
  payouts: readonly T[],
  todayKst: string,
): T | null {
  const nowMonth = todayKst.slice(0, 7);
  let latest: T | null = null;
  let earliest: T | null = null;
  for (const p of payouts) {
    if (!p.payoutDate || isPastEstimate(p, todayKst)) continue;
    if (!p.isEstimated && p.payoutDate.slice(0, 7) <= nowMonth) {
      if (!latest || p.payoutDate >= latest.payoutDate) latest = p; // 같은 날이면 나중 행(서버 정렬과 같음)
    } else if (!earliest || p.payoutDate < earliest.payoutDate) {
      earliest = p;
    }
  }
  return latest ?? earliest;
}

/** "YYYY-MM-DD" → [월, 일](앞자리 0 없음). Date 객체를 쓰지 않는다(시간대 밀림 방지) */
export function payoutMonthDay(date: string): [number, number] {
  const [, m, d] = date.split("-");
  return [Number(m), Number(d)];
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
      if (isPastEstimate(p, todayKst)) continue; // 지난 달 추정 제외(⑥)
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

/**
 * 다음 지급 달(#317, 5.159) — 새 금액 계산이 아니라 computeDividends 결과에서 고르기만 한다.
 * 오늘(KST) 달 이상에서 예상(perMonth.expected)이 있는 가장 이른 달과 그 달에 예상이 있는 종목 키 수. 없으면 null.
 * keys를 주면 그 키만 본다(종목 한 장 = 그룹 안 키).
 */
export function nextDividendMonth(
  calc: DividendCalcResult,
  todayKst: string,
  keys?: readonly string[],
): { month: number; count: number } | null {
  const nowMonth = parseInt(todayKst.split("-")[1], 10);
  const set = keys ? new Set(keys) : null;
  const entries = Array.from(calc.byStock.values()).filter((r) => !set || set.has(r.key));
  for (let m = Math.max(nowMonth, 1); m <= 12; m++) {
    const count = entries.filter((r) => r.perMonth.expected[m - 1] > 0).length;
    if (count > 0) return { month: m, count };
  }
  return null;
}

/**
 * 연 합계 단일 정본(5.162, C150) — 지급·예상을 각각 먼저 반올림한 뒤 합산한다.
 * 결론 줄·Hero·허브·성적표 입력이 모두 이 값을 쓰므로 지급 + 예상 = 합계, 예상 문자열이 화면마다 같다.
 */
export function roundedAnnual(calc: Pick<DividendCalcResult, "annual">): { paid: number; expected: number; total: number } {
  const paid = Math.round(calc.annual.paid);
  const expected = Math.round(calc.annual.expected);
  return { paid, expected, total: paid + expected };
}
