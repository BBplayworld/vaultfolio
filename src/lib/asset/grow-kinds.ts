/**
 * asset/grow-kinds.ts
 * 자산 불리기 확장(#242, 5.127) — 주식 외 자산(코인·부동산·실물)의 점검 칸 행과 전 종류 합 상태(순수 함수).
 *  - 코인 행: 상세 › 암호화폐와 같은 심볼 묶음(groupCryptoBySymbol·mergeCryptoGroup)·같은 식. 평가액 0인 묶음은 행을 만들지 않는다(탭과 같은 행 집합)
 *  - 부동산·실물 행: 자산 1건 = 행 1개. %는 매입가 대비(상세 카드와 같은 식), 값은 내가 넣은 숫자라 점수·막대·±% 조건·`정한 날 대비`가 없다
 *  - 묶음·차례 판정은 주식과 같은 함수(grow-board.labelFactsOf) — 계산 1벌
 *  - 이름표 키: 코인 `c:`+대문자 심볼, 부동산 `r:`+id, 실물 `p:`+id(stock-labels.ts). 키를 만들 수 없으면 행은 보이고 정할 수 없다
 *  - 앱은 자산을 고르거나 권하지 않는다 — 여기서 만드는 값은 내 기록에서 나온 사실뿐이다
 */

import type { AssetData, Crypto, PhysicalAsset, RealEstate } from "@/types/asset";
import type { CryptoTransaction } from "@/types/transaction";
import { groupCryptoBySymbol, mergeCryptoGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { cryptoLabelKey, physicalLabelKey, realLabelKey, type StockLabelBase, type StockLabels } from "@/lib/asset/stock-labels";
import { kstDayText, threeMonthsBefore } from "@/lib/asset/grow-rows";
import { buildBoardRows, holdScore, holdTextOf, holdingOf, labelFactsOf, type BoardRow, type BoardTotal } from "@/lib/asset/grow-board";

type Rates = { USD: number; JPY: number };

/** 점검 칸의 보기 — 순서 고정(주식 → 코인 → 부동산·실물) */
export type GrowView = "stock" | "crypto" | "own";
export const GROW_VIEWS: readonly { value: GrowView; label: string }[] = [
  { value: "stock", label: "주식" },
  { value: "crypto", label: "코인" },
  { value: "own", label: "부동산·실물" },
];

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;
const byOldest = (a: BoardRow, b: BoardRow) => {
  if (a.purchaseDate && b.purchaseDate && a.purchaseDate !== b.purchaseDate) return a.purchaseDate < b.purchaseDate ? -1 : 1;
  if (!a.purchaseDate !== !b.purchaseDate) return a.purchaseDate ? -1 : 1;
  return a.key.localeCompare(b.key);
};

/** 코인 키별 '이 앱에 기록한 매매 최근 3개월' 건수 — 주식 tradeCountsByLabelKey와 같은 조건(cryptoId로 잇고 반영 여부 무관) */
function cryptoTradeCounts(crypto: Crypto[], transactions: CryptoTransaction[], nowMs: number): Map<string, number> {
  const keyOf = new Map<string, string>();
  for (const c of crypto) { const k = cryptoLabelKey(c.symbol); if (k) keyOf.set(c.id, k); }
  const today = kstDayText(nowMs);
  const from = threeMonthsBefore(today);
  const counts = new Map<string, number>();
  for (const t of transactions) {
    const key = keyOf.get(t.cryptoId);
    if (!key || !DAY_TEXT.test(t.date) || t.date <= from || t.date > today) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 코인 행 — 오래 가진 순. 행 %·금액은 상세 › 암호화폐 묶음 카드와 같은 식(수량 × 현재가 − 수량 × 평단, 원화) */
export function buildCryptoRows(crypto: Crypto[], labels: StockLabels, nowMs: number, transactions: CryptoTransaction[] = []): BoardRow[] {
  const trades = cryptoTradeCounts(crypto, transactions, nowMs);
  const rows: BoardRow[] = [];
  for (const [groupKey, items] of groupCryptoBySymbol(crypto)) {
    const merged = mergeCryptoGroup(items);
    const value = merged.quantity * merged.currentPrice;
    if (!(value > 0)) continue;
    const cost = merged.quantity * merged.averagePrice;
    const profit = value - cost;
    const labelKey = cryptoLabelKey(merged.symbol);
    const rate = cost > 0 ? (profit / cost) * 100 : null;
    const held = holdingOf(merged.purchaseDate, nowMs);
    const nowPrice = items.find((it) => it.currentPrice > 0)?.currentPrice ?? null;
    rows.push({
      kind: "crypto",
      key: `c:${groupKey}`,
      labelKey,
      name: merged.name,
      groupStockIds: items.map((c) => c.id),
      rawTicker: merged.symbol || "",
      category: "crypto",
      rep: null,
      purchaseDate: held?.date ?? null,
      holdDays: held?.days ?? null,
      holdMonths: held?.months ?? null,
      holdText: holdTextOf(held),
      value,
      cost,
      profit,
      rate,
      priced: true,
      score: holdScore(profit, cost, held?.days ?? null, true),
      ...labelFactsOf(labels, labelKey, rate, nowPrice, nowMs),
      nowPrice,
      tradeCount: labelKey ? (trades.get(labelKey) ?? 0) : 0,
    });
  }
  return rows.sort(byOldest);
}

/** 코인 종합 카드 합계 — 상세 › 암호화폐 헤더 `평가손익`(getAssetSummary의 cryptoProfit·cryptoCost)과 같은 식·같은 범위(전 보유 건) */
export function cryptoTotal(crypto: Crypto[], rows: BoardRow[]): BoardTotal {
  const value = crypto.reduce((sum, c) => sum + c.quantity * c.currentPrice, 0);
  const cost = crypto.reduce((sum, c) => sum + c.quantity * c.averagePrice, 0);
  const profit = value - cost;
  return { priced: true, count: rows.length, profit, cost, rate: cost > 0 ? (profit / cost) * 100 : 0 };
}

/** 코인을 정하는 순간의 기준값 — 수량 합·지금 시세(원)·시세 기준일. 비중은 쓰지 않는다 */
export function buildCryptoLabelBase(crypto: Crypto[], labelKey: string): StockLabelBase | undefined {
  const mine = crypto.filter((c) => cryptoLabelKey(c.symbol) === labelKey);
  const qty = mine.reduce((sum, c) => sum + c.quantity, 0);
  if (!(Number.isFinite(qty) && qty > 0)) return undefined;
  const priced = mine.find((c) => c.currentPrice > 0);
  const priceDay = priced?.baseDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return { qty, ...(priced ? { price: priced.currentPrice } : {}), ...(priceDay ? { priceAt: priceDay } : {}) };
}

function ownRow(kind: "real" | "physical", a: Pick<RealEstate, "id" | "name" | "currentValue" | "purchasePrice" | "purchaseDate"> & { marketEstimate?: number; marketEstimateDate?: string }, labels: StockLabels, nowMs: number): BoardRow {
  const labelKey = kind === "real" ? realLabelKey(a.id) : physicalLabelKey(a.id);
  const value = Number.isFinite(a.currentValue) ? a.currentValue : 0;
  const cost = Number.isFinite(a.purchasePrice) ? a.purchasePrice : 0;
  const profit = value - cost;
  // 매입가 0원(실물은 허용)이면 %를 만들지 않는다 — 화면은 자리를 비운다(`—`·`0%` 없음)
  const rate = cost > 0 ? (profit / cost) * 100 : null;
  const held = holdingOf(a.purchaseDate, nowMs);
  return {
    kind,
    key: `${kind === "real" ? "r" : "p"}:${a.id}`,
    labelKey,
    name: a.name,
    groupStockIds: [a.id],
    rawTicker: "",
    category: kind,
    rep: null,
    own: {
      assetId: a.id,
      value,
      ...(kind === "real" && a.marketEstimate && a.marketEstimate > 0 ? { estimate: a.marketEstimate, ...(a.marketEstimateDate ? { estimateDate: a.marketEstimateDate } : {}) } : {}),
    },
    purchaseDate: held?.date ?? null,
    holdDays: held?.days ?? null,
    holdMonths: held?.months ?? null,
    holdText: holdTextOf(held),
    value,
    cost,
    profit,
    rate,
    priced: true,
    score: { state: "none" },
    ...labelFactsOf(labels, labelKey, rate, null, nowMs, false),
    nowPrice: null,
    tradeCount: 0,
  };
}

/** 부동산·실물 행 — 부동산이 위, 실물이 아래(섞지 않는다). 각각 오래 가진 순 */
export function buildOwnRows(realEstate: RealEstate[], physicalAssets: PhysicalAsset[], labels: StockLabels, nowMs: number): BoardRow[] {
  return [
    ...realEstate.map((r) => ownRow("real", r, labels, nowMs)).sort(byOldest),
    ...physicalAssets.map((p) => ownRow("physical", p, labels, nowMs)).sort(byOldest),
  ];
}

/** 부동산·실물 기록에 남길 값 — price = 그때 내 입력값(원), rate = 그때 매입가 대비 %(매입가 0이면 0). 평가액 0이면 기록하지 않는다. 화면·건수에는 쓰지 않는 값이다 */
export function ownSnap(row: BoardRow): { price: number; rate: number } | null {
  return row.own && row.own.value > 0 ? { price: row.own.value, rate: row.rate ?? 0 } : null;
}

export type GrowBoards = Record<GrowView, BoardRow[]>;

/** 세 보기의 행 — 허브 카드·세그먼트·점검 칸이 같은 함수로 만든다(수 정합 C84) */
export function buildGrowBoards(data: Pick<AssetData, "stocks" | "crypto" | "realEstate" | "physicalAssets" | "transactions" | "cryptoTransactions">, rates: Rates, labels: StockLabels, nowMs: number): GrowBoards {
  return {
    stock: buildBoardRows(data.stocks, rates, labels, nowMs, data.transactions ?? []),
    crypto: buildCryptoRows(data.crypto ?? [], labels, nowMs, data.cryptoTransactions ?? []),
    own: buildOwnRows(data.realEstate ?? [], data.physicalAssets ?? [], labels, nowMs),
  };
}

/** 가진 종류(행이 1개 이상인 보기) — 순서 고정 */
export const heldViews = (b: GrowBoards): GrowView[] => GROW_VIEWS.map((v) => v.value).filter((v) => b[v].length > 0);
/** 그 보기에 점검 차례 행이 있는지 */
export const viewHasDue = (b: GrowBoards, v: GrowView): boolean => b[v].some((r) => r.due);
/** 처음 열리는 보기 — 차례가 있는 종류 중 순서상 첫째, 없으면 가진 종류 중 첫째 */
export function firstGrowView(b: GrowBoards): GrowView | null {
  const held = heldViews(b);
  return held.find((v) => viewHasDue(b, v)) ?? held[0] ?? null;
}

export interface GrowStatus {
  kind: "due" | "labeled" | "first" | "empty";
  due: number;
  keep: number;
  check: number;
  count: number;
  /** 수 뒤에 붙는 단위 — 그 합에 부동산·실물이 1개라도 들어가면 `개`, 주식·코인만이면 `종목` */
  unit: "종목" | "개";
}

/**
 * 허브 셋째 카드 둘째 줄·세그먼트 `내 자산 점검` 둘째 줄의 상태 — 전 종류 합(5.125 boardStatus와 같은 판정을 세 보기에 더한 값).
 * due 수 = 각 보기 목록의 `점검 차례` 행 수의 합
 */
export function growStatus(b: GrowBoards): GrowStatus {
  const all = [...b.stock, ...b.crypto, ...b.own];
  const keep = all.filter((r) => r.labelState === "keep").length;
  const check = all.filter((r) => r.labelState === "check").length;
  const dueRows = all.filter((r) => r.due);
  const kind = all.length === 0 ? "empty" : dueRows.length > 0 ? "due" : keep + check > 0 ? "labeled" : "first";
  const withOwn = (kind === "due" ? dueRows : all).some((r) => r.kind === "real" || r.kind === "physical");
  return { kind, due: dueRows.length, keep, check, count: all.length, unit: withOwn ? "개" : "종목" };
}
