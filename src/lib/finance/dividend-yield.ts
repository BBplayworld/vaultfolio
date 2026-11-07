import type { Stock } from "@/types/asset";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

// 배당 화면 "투입 대비 배당"(#4.46 #80) 순수 계산.
// 분자 = Hero와 같은 올해 배당(매수일 이전 지급 제외, 지급월 <= 이번 달 KST면 지급), 분모 = 평단×수량×(USD면 현재 환율).
// 평단 0 이하·JPY 종목은 분자·분모 모두에서 제외한다(배당 계산이 엔화를 환산하지 않음).

const YIELD_CATEGORIES = new Set(["domestic", "foreign", "irp", "isa", "pension"]);

export interface DividendYieldItem {
  stock: Stock;
  payouts: DividendPayoutResult[];
}

export interface DividendYieldResult {
  /** 소수 첫째 자리 반올림 값 */
  pct: number;
  /** "3.2%" 또는 "0.1% 미만" */
  text: string;
  /** 계산에서 빠진 종목 수(평단 0 이하 + JPY) */
  excluded: number;
}

export function currentYearMonthKst(now: number = Date.now()): string {
  const d = new Date(now + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 계산 불가(분모 0·분자 0)면 null */
export function computeDividendYield(
  items: DividendYieldItem[],
  usdRate: number,
  mode: "all" | "actual",
  currentYM: string = currentYearMonthKst(),
): DividendYieldResult | null {
  let numerator = 0;
  let denominator = 0;
  let excluded = 0;
  for (const { stock, payouts } of items) {
    if (!YIELD_CATEGORIES.has(stock.category)) continue;
    const currency = stock.currency;
    if (!(stock.averagePrice > 0) || (currency !== "KRW" && currency !== "USD")) {
      excluded += 1;
      continue;
    }
    const rate = currency === "USD" ? usdRate : 1;
    denominator += stock.averagePrice * stock.quantity * rate;
    for (const p of payouts) {
      if (stock.purchaseDate && p.payoutDate < stock.purchaseDate) continue;
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (!(m >= 0 && m < 12)) continue;
      const isPaid = p.payoutDate.slice(0, 7) <= currentYM;
      if (mode === "actual" && !isPaid) continue;
      numerator += p.amountPerShare * stock.quantity * rate;
    }
  }
  if (!(denominator > 0) || !(numerator > 0)) return null;
  const raw = (numerator / denominator) * 100;
  const pct = Math.round(raw * 10) / 10;
  if (raw < 0.05) return { pct: 0, text: "0.1% 미만", excluded };
  return { pct, text: `${pct.toFixed(1)}%`, excluded };
}
