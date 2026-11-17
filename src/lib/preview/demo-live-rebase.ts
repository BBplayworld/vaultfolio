/**
 * preview/demo-live-rebase.ts — 체험·미리보기 데모의 스냅샷을 '실시간 시세 수준'으로 재기준(4.94 ui-review R1).
 * 데모 JSON의 주식·코인 가격은 고정값이지만 체험은 실시간 시세로 가격을 덮어쓴다. 스냅샷이 JSON 가격 수준이면
 * 전일 대비·7일·허브가 가짜 급등락이 된다. 시세가 얼마나 움직여도(0.4~2.5배 이상) 같은 배율로 스냅샷의 주식·코인 평가를 맞춘다.
 * 순수 함수만 둔다(저장 접근은 demo-snapshot-rebase.tsx). 부동산·현금·대출·투입원가는 시세 무관이라 건드리지 않는다.
 */

import type { DailyAssetSnapshot, MonthlyAssetSnapshot, Stock } from "@/types/asset";
import type { StockLabels } from "@/lib/asset/stock-labels";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { getMultiplier } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

type Row = DailyAssetSnapshot | MonthlyAssetSnapshot;

/** 기준 평가액 — 오늘 이전 가장 늦은 enrich 일별 기록의 주식·코인(스케일 배율의 분모) */
export function pickRebaseRef(daily: DailyAssetSnapshot[], today: string): RebaseRef | null {
  const row = [...daily].filter((d) => d?.date && d.date < today && d.breakdown).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!row?.breakdown) return null;
  return {
    stocks: row.breakdown.stocks, crypto: row.breakdown.crypto,
    // 주식 투입원가 재기준(5.125)의 기준 — 그 기록의 주식 원가와 환율
    ...(row.cost && row.fx ? { costStock: row.cost.stock, fx: { USD: row.fx.USD, JPY: row.fx.JPY } } : {}),
  };
}

export interface RebaseRef { stocks: number; crypto: number; costStock?: number; fx?: { USD: number; JPY: number } }

/** 배율 = 현재(실시간) 평가액 / 기준 평가액. 기준이 0이면 1 */
export const rebaseRatio = (live: number, ref: number): number => (ref > 0 && live >= 0 ? live / ref : 1);

/**
 * rows의 주식·코인 평가를 ks·kc배로 옮긴다. enrich 기록은 breakdown·netAsset·financialAsset·fxBase.USD(외화 주식 노출, 근사)를 함께,
 * net-only 기록은 기준 평가액 몫만큼 netAsset·financialAsset을 옮긴다. cost·fx·부동산·현금·대출은 그대로. 입력은 바꾸지 않는다.
 */
export function rebaseDemoRows<T extends Row>(rows: T[], ref: RebaseRef, ks: number, kc: number, kcost = 1): T[] {
  return rows.map((r) => {
    const b = r.breakdown;
    const dS = b ? b.stocks * (ks - 1) : ref.stocks * (ks - 1);
    const dC = b ? b.crypto * (kc - 1) : ref.crypto * (kc - 1);
    const next = { ...r, netAsset: Math.round(r.netAsset + dS + dC), financialAsset: Math.round(r.financialAsset + dS + dC) };
    if (b) {
      next.breakdown = { ...b, stocks: Math.round(b.stocks * ks), crypto: Math.round(b.crypto * kc) };
      if (r.fxBase) next.fxBase = { ...r.fxBase, USD: Math.round(r.fxBase.USD * ks) };
    }
    // 주식 투입원가 — 데모 평단을 실시간 배율로 옮긴 만큼(kcost = 옮긴 평단 원가 ÷ 시드 평단 원가). 넣은 돈 원인분해가 가짜 유입을 만들지 않게
    if (r.cost && kcost !== 1) {
      const dCost = r.cost.stock * (kcost - 1);
      next.cost = { ...r.cost, stock: Math.round(r.cost.stock + dCost), total: Math.round(r.cost.total + dCost) };
    }
    return next as T;
  });
}

/**
 * 데모 이름표의 '정한 날 가격'(base.price)을 실시간 시세 수준으로 옮긴다(#239 5.125).
 * 데모 시드의 정한 날 가격은 JSON 시세 눈금이라, 실시간 시세로 덮인 데모에서는 `정한 날 가격 대비 +500%`처럼 보인다.
 * 종목마다 같은 배율(실시간 시세 ÷ JSON 시세)을 곱해 '정한 날 가격 대비 %'가 시드 그대로(JSON 시세 ÷ 시드 기준가 − 1)가 되게 한다.
 *  - 시드 그대로인 항목만(이름표 종류·labeledAt이 시드와 같음). 사용자가 다시 붙인 항목은 그때의 실제 시세라 건드리지 않는다
 *  - base의 다른 필드(qty·priceAt·weight·모르는 필드)는 그대로. 언제나 시드에서 다시 계산한다(누적 곱셈 없음)
 *  - 바뀐 게 없으면 같은 객체를 돌려준다. 순수 함수 — 저장은 호출하는 쪽(demo-snapshot-rebase.tsx)
 */
export function rebaseDemoLabelPrices(
  labels: StockLabels,
  seed: StockLabels,
  seedPrices: ReadonlyMap<string, number>,
  livePrices: ReadonlyMap<string, number>,
): StockLabels {
  let items: StockLabels["items"] | null = null;
  for (const [key, s] of Object.entries(seed.items)) {
    const cur = labels.items[key];
    const seedBase = s.base?.price;
    if (!cur?.base || !seedBase || cur.label !== s.label || cur.labeledAt !== s.labeledAt) continue;
    const sp = seedPrices.get(key);
    const lp = livePrices.get(key);
    if (!(sp !== undefined && sp > 0 && lp !== undefined && lp > 0)) continue;
    const price = (seedBase * lp) / sp;
    if (cur.base.price !== undefined && Math.abs(cur.base.price - price) <= price * 1e-9) continue;
    items ??= { ...labels.items };
    items[key] = { ...cur, base: { ...cur.base, price } };
  }
  return items ? { ...labels, items } : labels;
}

/** 이름표 키(normalizeTicker)별 시세 — 현재가가 있는 첫 보유 건(grow-rows의 지금 시세와 같은 규칙) */
export function priceByLabelKey(stocks: Pick<Stock, "ticker" | "category" | "currentPrice">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stocks) {
    if (!s.ticker || !(s.currentPrice > 0)) continue;
    const k = normalizeTicker(s);
    if (!m.has(k)) m.set(k, s.currentPrice);
  }
  return m;
}

/** 데모 시드 주식(보유 건 id별) — 평단 재기준의 기준값 */
export type DemoSeedStock = Pick<Stock, "averagePrice" | "currentPrice" | "quantity">;

/**
 * 데모 주식의 평단(averagePrice)을 정한 날 가격과 같은 실시간 배율(지금 시세 ÷ JSON 시세)로 옮긴다(#239 5.125 ui-review R2).
 * 데모 평단은 JSON 시세 눈금이라 실시간 시세로 덮인 데모에서 `내 매입가 대비 +633.3%`처럼 보였다. 옮기면 매입가 대비 %가 체험(JSON 시세)과 같다.
 *  - 시드에 있는 id(demo_)이고 수량이 시드와 같은 보유 건만(데모에서 매매로 수량이 바뀐 건은 그때의 평단이라 그대로)
 *  - 해외 주식의 매입 환율(purchaseExchangeRate)·그 밖의 필드는 그대로. 언제나 시드에서 다시 계산(누적 곱셈 없음)
 *  - 바뀐 게 없으면 같은 배열을 돌려준다
 */
export function rebaseDemoAveragePrices<S extends Stock>(stocks: S[], seed: ReadonlyMap<string, DemoSeedStock>): S[] {
  let changed = false;
  const next = stocks.map((s) => {
    const sd = seed.get(s.id);
    if (!sd || s.quantity !== sd.quantity || !(sd.currentPrice > 0) || !(sd.averagePrice > 0) || !(s.currentPrice > 0)) return s;
    const avg = (sd.averagePrice * s.currentPrice) / sd.currentPrice;
    if (Math.abs(s.averagePrice - avg) <= avg * 1e-9) return s;
    changed = true;
    return { ...s, averagePrice: avg };
  });
  return changed ? next : stocks;
}

/** 주식 원가(수량 × 평단 × 지금 환율, 상장폐지 제외) — computeAssetCost의 stockCost와 같은 식 */
function stockCostOf(stocks: Stock[], rates: { USD: number; JPY: number }): number {
  return stocks.reduce((sum, s) => (s.inactiveStatus === "delisted" ? sum : sum + s.quantity * s.averagePrice * getMultiplier(s.currency, rates)), 0);
}

/**
 * 스냅샷 주식 투입원가에 곱할 배율 — 데모 평단을 옮긴 만큼만(환율 변화는 빼고).
 * 목표 = 지금 평단 원가 ÷ 시드 평단 원가(같은 수량·같은 지금 환율). 기준 기록이 이미 옮겨져 있으면(새로고침 뒤) 그만큼 나눈다
 * — 기준 기록 원가 ÷ 그 기록 환율에서의 시드 평단 원가. 시드에 없는 보유·수량이 바뀐 보유는 지금 평단 그대로 양쪽에 든다.
 */
export function demoCostRatio(stocks: Stock[], seed: ReadonlyMap<string, DemoSeedStock>, rates: { USD: number; JPY: number }, ref: RebaseRef): number {
  const seedAvg = stocks.map((s) => { const sd = seed.get(s.id); return sd && s.quantity === sd.quantity ? { ...s, averagePrice: sd.averagePrice } : s; });
  const target = rebaseRatio(stockCostOf(stocks, rates), stockCostOf(seedAvg, rates));
  const applied = ref.costStock !== undefined && ref.fx ? rebaseRatio(ref.costStock, stockCostOf(seedAvg, ref.fx)) : 1;
  return applied > 0 ? target / applied : target;
}

/** 시드 주식 목록 → id별 기준값 */
export function demoSeedStockMap(stocks: Stock[]): Map<string, DemoSeedStock> {
  return new Map(stocks.map((s) => [s.id, { averagePrice: s.averagePrice, currentPrice: s.currentPrice, quantity: s.quantity }]));
}
