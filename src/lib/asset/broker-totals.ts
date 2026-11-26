// 상세·주식 증권사별 합계(#319, 5.160) — 순수 함수(저장·React·서버 호출 없음).
// 평가·원가는 computeStockTotals를 묶음마다 그대로 호출한다(헤더와 값이 어긋나지 않게 재계산 금지).
// 화면 문자열의 합 = 헤더 문자열(C150): 원(달러 보기는 센트) 단위로 반올림한 뒤 최대 잔여 방식으로 흡수한다.
import type { Stock } from "@/types/asset";
import { matchBrokerHint } from "@/config/asset-options";
import { isUnassignedBroker, sameBroker } from "@/lib/asset/resync/match";
import { largestRemainderTenths } from "@/lib/ratio-preview/ratio-list";
import { computeStockTotals, type StockDisplayCurrency } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

export const UNASSIGNED_BROKER_LABEL = "증권사 미지정";

export interface BrokerTotalRow {
  /** 표시 이름(목록 증권사와 맞으면 목록 이름, 아니면 사용자가 쓴 글자) */
  name: string;
  unassigned: boolean;
  /** 같은 종목(티커)은 이 증권사 안에서 1개로 센다 */
  count: number;
  /** 표시 단위 정수: KRW=원, USD=센트. 행 합 = 헤더 반올림값 */
  valueUnits: number;
  profitUnits: number;
  /** 수익률 %, 원가 0이면 null */
  profitRate: number | null;
  /** 비중 0.1% 단위 정수(합 1000, 값이 모두 0이면 0) */
  shareTenths: number;
}

export interface BrokerTotals {
  rows: BrokerTotalRow[];
  /** 1 = 원, 100 = 센트(달러 보기) */
  scale: 1 | 100;
}

/** 합이 target이 되도록 정수로 반올림(최대 잔여). 음수 허용 */
export function apportionUnits(raws: number[], target: number): number[] {
  const floors = raws.map((r) => Math.floor(r + 1e-9));
  let remain = target - floors.reduce((a, b) => a + b, 0);
  if (raws.length === 0) return floors;
  const order = raws
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  let k = 0;
  while (remain > 0) {
    floors[order[k % order.length].i] += 1;
    remain -= 1;
    k += 1;
  }
  k = order.length - 1;
  while (remain < 0) {
    floors[order[((k % order.length) + order.length) % order.length].i] -= 1;
    remain += 1;
    k -= 1;
  }
  return floors;
}

interface Group {
  name: string;
  raw: string;
  unassigned: boolean;
  rows: Stock[];
}

export function computeBrokerTotals(
  stocks: Stock[],
  exchangeRates: { USD: number; JPY: number },
  displayCurrency: StockDisplayCurrency = "KRW",
): BrokerTotals {
  const scale: 1 | 100 = displayCurrency === "USD" ? 100 : 1;
  const usd = exchangeRates.USD > 0 ? exchangeRates.USD : 1;
  const toUnits = (krw: number) => (scale === 100 ? (krw / usd) * 100 : krw);

  // 상장폐지·수량 0 행은 뺀다(헤더 합계와 같은 정책)
  const live = stocks.filter((s) => s.inactiveStatus !== "delisted" && s.quantity > 0);
  const groups: Group[] = [];
  for (const s of live) {
    const unassigned = isUnassignedBroker(s.broker);
    let g = unassigned ? groups.find((x) => x.unassigned) : groups.find((x) => !x.unassigned && sameBroker(x.raw, s.broker));
    if (!g) {
      const raw = (s.broker ?? "").trim();
      g = { name: unassigned ? UNASSIGNED_BROKER_LABEL : matchBrokerHint(raw) ?? raw, raw, unassigned, rows: [] };
      groups.push(g);
    }
    g.rows.push(s);
  }
  if (groups.length === 0) return { rows: [], scale };

  const totals = groups.map((g) => computeStockTotals(g.rows, exchangeRates, displayCurrency));
  const all = computeStockTotals(live, exchangeRates, displayCurrency);
  // 헤더 표시: 평가금 = round(합계 환산), 손익 = round(Math.round(손익) 환산)
  const valueTarget = Math.round(toUnits(all.totalValue));
  const profitTarget = Math.round(toUnits(Math.round(all.totalProfit)));
  const values = apportionUnits(totals.map((t) => toUnits(t.totalValue)), valueTarget);
  const profits = apportionUnits(totals.map((t) => toUnits(t.totalProfit)), profitTarget);
  const shares = largestRemainderTenths(totals.map((t) => Math.max(0, t.totalValue)));

  const rows: BrokerTotalRow[] = groups.map((g, i) => ({
    name: g.name,
    unassigned: g.unassigned,
    count: new Set(g.rows.map((s) => (s.ticker ? `t:${s.ticker}` : s.id))).size,
    valueUnits: values[i],
    profitUnits: profits[i],
    profitRate: totals[i].totalCost > 0 ? totals[i].totalProfitRate : null,
    shareTenths: shares[i],
  }));
  // 평가금 내림차순, 미지정은 항상 맨 아래
  const rawValue = new Map(rows.map((r, i) => [r, totals[i].totalValue]));
  rows.sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || (rawValue.get(b) ?? 0) - (rawValue.get(a) ?? 0));
  return { rows, scale };
}
