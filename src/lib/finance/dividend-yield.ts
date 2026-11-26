import type { Stock } from "@/types/asset";
import { dividendStockKey, type DividendCalcResult } from "@/lib/finance/dividend-calc";

// 배당 화면 "투입 대비 배당"(#4.46 #80) 순수 계산.
// 분자 = Hero와 같은 올해 배당(공용 계산 computeDividends의 종목별 값, #313), 분모 = 평단×지금 수량×(USD면 현재 환율).
// 평단 0 이하·JPY 종목은 분자·분모 모두에서 제외한다(배당 계산이 엔화를 환산하지 않음).

const YIELD_CATEGORIES = new Set(["domestic", "foreign", "irp", "isa", "pension"]);

export interface DividendYieldItem {
  /** 표시 단위 종목(ticker·카테고리로 묶은 행) — 제외 수는 이 단위로 센다 */
  stock: Stock;
}

export interface DividendYieldResult {
  /** 소수 첫째 자리 반올림 값 */
  pct: number;
  /** "3.2%" 또는 "0.1% 미만" */
  text: string;
  /** 계산에서 빠진 종목 수(평단 0 이하 + JPY) */
  excluded: number;
}

/** 계산 불가(분모 0·분자 0)면 null */
export function computeDividendYield(
  items: readonly DividendYieldItem[],
  usdRate: number,
  mode: "all" | "actual",
  calc: Pick<DividendCalcResult, "byStock">,
): DividendYieldResult | null {
  let numerator = 0;
  let denominator = 0;
  let excluded = 0;
  for (const { stock } of items) {
    if (!YIELD_CATEGORIES.has(stock.category)) continue;
    const currency = stock.currency;
    if (!(stock.averagePrice > 0) || (currency !== "KRW" && currency !== "USD")) {
      excluded += 1;
      continue;
    }
    const rate = currency === "USD" ? usdRate : 1;
    denominator += stock.averagePrice * stock.quantity * rate;
    const d = calc.byStock.get(dividendStockKey(stock));
    if (d) numerator += mode === "actual" ? d.paid : d.paid + d.expected;
  }
  if (!(denominator > 0) || !(numerator > 0)) return null;
  const raw = (numerator / denominator) * 100;
  const pct = Math.round(raw * 10) / 10;
  if (raw < 0.05) return { pct: 0, text: "0.1% 미만", excluded };
  return { pct, text: `${pct.toFixed(1)}%`, excluded };
}
