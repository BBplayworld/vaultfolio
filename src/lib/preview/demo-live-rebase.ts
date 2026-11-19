/**
 * preview/demo-live-rebase.ts — 체험·미리보기 데모의 스냅샷을 '실시간 시세 수준'으로 재기준(4.94 ui-review R1).
 * 데모 JSON의 주식·코인 가격은 고정값이지만 체험은 실시간 시세로 가격을 덮어쓴다. 스냅샷이 JSON 가격 수준이면
 * 전일 대비·7일·허브가 가짜 급등락이 된다. 시세가 얼마나 움직여도(0.4~2.5배 이상) 같은 배율로 스냅샷의 주식·코인 평가를 맞춘다.
 * 순수 함수만 둔다(저장 접근은 demo-snapshot-rebase.tsx). 부동산·현금·대출·투입원가는 시세 무관이라 건드리지 않는다.
 */

import type { AssetData, Crypto, DailyAssetSnapshot, MonthlyAssetSnapshot, Stock } from "@/types/asset";
import { buildLiveAttributionCurr, computeAttributionBetween } from "@/lib/report/asset-report";

type AttributionPoint = ReturnType<typeof buildLiveAttributionCurr>;
import { cryptoLabelKey, reviewKey, type StockLabels } from "@/lib/asset/stock-labels";
import { normalizeTicker } from "@/lib/finance/finance-service";

type Row = DailyAssetSnapshot | MonthlyAssetSnapshot;

/** 기준 평가액 — 오늘 이전 가장 늦은 enrich 일별 기록의 주식·코인(스케일 배율의 분모) */
export function pickRebaseRef(daily: DailyAssetSnapshot[], today: string): RebaseRef | null {
  const row = [...daily].filter((d) => d?.date && d.date < today && d.breakdown).sort((a, b) => b.date.localeCompare(a.date))[0];
  return row?.breakdown ? { stocks: row.breakdown.stocks, crypto: row.breakdown.crypto } : null;
}

export interface RebaseRef { stocks: number; crypto: number }

/** 배율 = 현재(실시간) 평가액 / 기준 평가액. 기준이 0이면 1 */
export const rebaseRatio = (live: number, ref: number): number => (ref > 0 && live >= 0 ? live / ref : 1);

/**
 * rows의 주식·코인 평가를 ks·kc배로 옮긴다. enrich 기록은 breakdown·netAsset·financialAsset·fxBase.USD(외화 주식 노출, 근사)를 함께,
 * net-only 기록은 기준 평가액 몫만큼 netAsset·financialAsset을 옮긴다. cost·fx·부동산·현금·대출은 그대로. 입력은 바꾸지 않는다.
 */
export function rebaseDemoRows<T extends Row>(rows: T[], ref: RebaseRef, ks: number, kc: number, costShift?: ReadonlyMap<string, number>, cryptoCostShift?: ReadonlyMap<string, number>): T[] {
  return rows.map((r) => {
    const b = r.breakdown;
    const dS = b ? b.stocks * (ks - 1) : ref.stocks * (ks - 1);
    const dC = b ? b.crypto * (kc - 1) : ref.crypto * (kc - 1);
    const next = { ...r, netAsset: Math.round(r.netAsset + dS + dC), financialAsset: Math.round(r.financialAsset + dS + dC) };
    if (b) {
      next.breakdown = { ...b, stocks: Math.round(b.stocks * ks), crypto: Math.round(b.crypto * kc) };
      if (r.fxBase) next.fxBase = { ...r.fxBase, USD: Math.round(r.fxBase.USD * ks) };
    }
    // 주식 투입원가 — 데모 평단을 옮긴 만큼 기록마다 더한다(demoCostShifts). 원인 분해가 평단 재기준 전과 같아진다
    const shift = r.cost && r.date ? costShift?.get(r.date) : undefined;
    if (r.cost && shift) next.cost = { ...r.cost, stock: r.cost.stock + shift, total: r.cost.total + shift };
    // 코인 투입원가 — 데모 코인 평단을 옮긴 만큼(#242 qa D2). 주식과 같은 방식, 칸만 crypto
    const cShift = r.cost && r.date ? cryptoCostShift?.get(r.date) : undefined;
    if (next.cost && cShift) next.cost = { ...next.cost, crypto: next.cost.crypto + cShift, total: next.cost.total + cShift };
    return next as T;
  });
}

/**
 * 데모 이름표의 '정한 날 가격'(base.price)을 실시간 시세 수준으로 옮긴다(#239 5.125).
 * 데모 시드의 정한 날 가격은 JSON 시세 눈금이라, 실시간 시세로 덮인 데모에서는 `정한 날 가격 대비 +500%`처럼 보인다.
 * 종목마다 같은 배율(실시간 시세 ÷ JSON 시세)을 곱해 '정한 날 가격 대비 %'가 시드 그대로(JSON 시세 ÷ 시드 기준가 − 1)가 되게 한다.
 *  - 시드 그대로인 항목만(이름표 종류·labeledAt이 시드와 같음). 사용자가 다시 붙인 항목은 그때의 실제 시세라 건드리지 않는다
 *  - base의 다른 필드(qty·priceAt·weight·모르는 필드)는 그대로. 언제나 시드에서 다시 계산한다(누적 곱셈 없음)
 *  - 점검 기록(reviews, 5.125 4차)의 그때 가격도 같은 배율로 옮긴다 — 시드에 같은 `t@at`이 있는 기록만(사용자가 데모에서 새로 남긴 기록은 그때의 실제 시세).
 *    rate(그때 산 날부터 %)는 평단 재기준 뒤 매입가 %와 같은 눈금이라 옮기지 않는다
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
  let reviews: StockLabels["reviews"] | null = null;
  const seedReviews = new Map((seed.reviews ?? []).map((r) => [reviewKey(r), r]));
  (labels.reviews ?? []).forEach((r, i) => {
    const s = seedReviews.get(reviewKey(r));
    const sp = seedPrices.get(r.t);
    const lp = livePrices.get(r.t);
    if (!s || !(sp !== undefined && sp > 0 && lp !== undefined && lp > 0)) return;
    const price = (s.price * lp) / sp;
    if (Math.abs(r.price - price) <= price * 1e-9) return;
    reviews ??= [...labels.reviews!];
    reviews[i] = { ...r, price };
  });
  if (!items && !reviews) return labels;
  return { ...labels, ...(items ? { items } : {}), ...(reviews ? { reviews } : {}) };
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

/**
 * 주식 + 코인 이름표 키별 시세(#242) — 코인 키(`c:`+심볼)의 정한 날 가격·기록 가격도 같은 배율(실시간 ÷ JSON 시세)로 옮기게 한다.
 * 안 옮기면 실시간 시세로 덮인 데모에서 코인 `정한 날 대비`가 현실 밖 값이 된다(C132). 부동산·실물 키는 시세가 없어 들어가지 않는다
 */
export function priceByAnyLabelKey(stocks: Pick<Stock, "ticker" | "category" | "currentPrice">[], crypto: Pick<Crypto, "symbol" | "currentPrice">[] = []): Map<string, number> {
  const m = priceByLabelKey(stocks);
  for (const c of crypto) {
    const k = cryptoLabelKey(c.symbol);
    if (k && c.currentPrice > 0 && !m.has(k)) m.set(k, c.currentPrice);
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
export function rebaseDemoAveragePrices<S extends Pick<Stock, "id" | "averagePrice" | "currentPrice" | "quantity">>(stocks: S[], seed: ReadonlyMap<string, DemoSeedStock>): S[] {
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

/**
 * 기록(스냅샷)마다 주식 투입원가에 더할 값 — 평단 재기준 전후로 그 기록 → 지금 구간의 원인 분해가 같아지게 한다(ui-review R2 재판정·qa D-2).
 * 평단은 지금 원가뿐 아니라 외화 원가 환율 재평가·실현손익에도 들어가므로 배율로 옮기면 넣은 돈·시세·매도가 어긋난다.
 * 그래서 실제 원인 분해 함수로 두 번 계산해(이전 평단 / 지금 평단, 같은 기록·같은 시세) 넣은 돈 효과의 차이를 그 기록 원가에 더한다.
 * 이 차이는 평단 차이에 선형이고 구간에 더해지는 꼴이라, 기록 → 기록 구간(월 결산)도 같이 맞는다.
 *  - prevData = 그 기록들과 맞는 평단(처음 주입 = 시드 평단, 새로고침 뒤 = 그때 저장된 평단). 기록은 prevData 기준 원가를 담고 있어야 한다
 *  - fx·fxBase·breakdown·cost가 모두 있는 기록만(그 밖은 0). 키 = 기록의 date
 */
export function demoCostShifts(
  rows: Row[],
  prevData: AssetData,
  nextData: AssetData,
  livePrev: AttributionPoint,
  liveNext: AttributionPoint,
  rates: { USD: number; JPY: number },
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.date || !r.cost || !r.fx || !r.fxBase || !r.breakdown || out.has(r.date)) continue;
    const asMonthly = { ...r, month: r.date.slice(0, 7) } as MonthlyAssetSnapshot;
    const a = computeAttributionBetween(asMonthly, livePrev, {}, prevData, rates);
    const b = computeAttributionBetween(asMonthly, liveNext, {}, nextData, rates);
    if (!a || !b) continue;
    const shift = b.savingEffect - a.savingEffect;
    if (shift !== 0) out.set(r.date, shift);
  }
  return out;
}

/** 지금 데이터의 평단만 바꾼 사본 — 시드·기준에 있는 id이고 수량이 같은 보유 건만 */
export function withAveragePrices(data: AssetData, avg: ReadonlyMap<string, DemoSeedStock>): AssetData {
  return { ...data, stocks: data.stocks.map((s) => { const a = avg.get(s.id); return a && s.quantity === a.quantity ? { ...s, averagePrice: a.averagePrice } : s; }) };
}

/**
 * 지금 데이터의 코인 평단만 바꾼 사본(#242 qa D2) — 기준에 있는 id이고 수량이 같은 코인만(주식 withAveragePrices와 같은 규칙).
 * 데모 코인 평단도 주식과 같이 실시간 배율로 옮긴다(rebaseDemoAveragePrices를 코인에도 쓴다) — 이름표의 코인 정한 날 가격(c: 키)과 같은 배율이라
 * `평단 대비`·`정한 날 대비`·조건 도달이 서로 모순되지 않는다. 코인 거래의 체결 단가는 옮기지 않는다:
 * 거래 금액은 원인 분해·올해 결산의 '넣은 돈'에 그대로 들어가 옮기면 결산 숫자가 번진다(C134 — 주식 거래 단가도 같은 이유로 그대로다)
 */
export function withCryptoAveragePrices(data: AssetData, avg: ReadonlyMap<string, DemoSeedStock>): AssetData {
  return { ...data, crypto: data.crypto.map((c) => { const a = avg.get(c.id); return a && c.quantity === a.quantity ? { ...c, averagePrice: a.averagePrice } : c; }) };
}

/** 시드 주식 목록 → id별 기준값 */
export function demoSeedStockMap(stocks: readonly Pick<Stock, "id" | "averagePrice" | "currentPrice" | "quantity">[]): Map<string, DemoSeedStock> {
  return new Map(stocks.map((s) => [s.id, { averagePrice: s.averagePrice, currentPrice: s.currentPrice, quantity: s.quantity }]));
}
