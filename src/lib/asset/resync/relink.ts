// 맞추기로 끊긴 거래 다시 잇기(#147, 4.77) — 감지·적용(순수). 저장·React·push 호출 없음.
// v4.73 이전 맞추기·첫 등록 `교체/초기화 후 등록`은 기존 종목을 지우고 새 id(`stock_import_<ms>_N`·`crypto_import_<ms>_N`)·매수일 = 만든 날로 다시 만들어
// 거래 기록(stockId·cryptoId)이 옛 id를 가리킨 채 남았다(고아). 남은 근거는 고아 거래(ticker·symbol·date)뿐이라 사용자 확인 후에만 잇는다.
// 적용으로 바뀌는 값은 후보 거래의 stockId/cryptoId와 대상 종목의 purchaseDate뿐(수량·평단·매입 환율·positionSource 변경 0).
import type { AssetData, Crypto, Stock } from "@/types/asset";
import type { CryptoTransaction, Transaction } from "@/types/transaction";
import { reverseTransaction, type PositionLike } from "@/lib/trade/trade-utils";
import { tickerKey } from "./match";

export type RelinkKind = "stock" | "crypto";

/** '그대로 두기'가 기록하는 기존 `secretasset_feature_usage.dismissedTipIds` 항목 id(기기 로컬, 동기화 제외) */
export const RELINK_OFFER_ID = "relink-offer";

export interface RelinkTarget {
  /** 이을 종목(S) id */
  id: string;
  name: string;
  /** 증권사(주식)·거래소(코인) */
  broker?: string;
  /** 이을 거래 id(날짜 오름차순) */
  txIds: string[];
  count: number;
  firstDate: string;
  lastDate: string;
  /** 전량 매도·역산 일관성(A2)으로 빠진 거래 건수 합 k */
  cut: number;
  currentPurchaseDate: string;
  /** 첫 매수일로 바뀔 때만 값이 있다(현재 매수일보다 이를 때) */
  newPurchaseDate?: string;
}

export interface RelinkRow {
  /** `stock:<S.id>`·`crypto:<S.id>` — 대상이 여럿이면 `stock:multi:<시장>:<키>` */
  rowId: string;
  kind: RelinkKind;
  /** 대상 1개면 기본 체크, 2개 이상이면 이을 종목 선택 필수 */
  targets: RelinkTarget[];
}

interface NTx {
  id: string;
  oldId: string;
  key: string;
  market: "domestic" | "foreign" | "crypto";
  type: "buy" | "sell";
  quantity: number;
  price: number;
  exchangeRate?: number;
  date: string;
  reflected: boolean;
  createdAt: string;
}

interface NItem {
  id: string;
  name: string;
  broker?: string;
  key: string;
  market: NTx["market"];
  purchaseDate: string;
  quantity: number;
  avgPrice: number;
  avgExchangeRate: number;
  source: "manual" | "computed";
  effectiveDate: string;
}

const IMPORT_ID = /^(?:stock|crypto)_import_(\d{10,})_\d+$/;
const EPS = 1e-9;

const kstDateOf = (ms: number) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
const cmpTx = (a: Pick<NTx, "date" | "createdAt" | "id">, b: Pick<NTx, "date" | "createdAt" | "id">) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** '대상 종목 생성 이전' 거래인가 — 날짜는 사용자가 임의 지정하므로 기록 시각 우선 */
const recordedBefore = (t: Pick<NTx, "date" | "createdAt">, importMs: number, created: string) => {
  const ms = Date.parse(t.createdAt);
  return Number.isNaN(ms) ? t.date <= created : ms <= importMs;
};

const stockItem = (s: Stock): NItem => ({
  id: s.id, name: s.name, broker: s.broker, key: tickerKey(s.ticker), market: s.category === "foreign" ? "foreign" : "domestic",
  purchaseDate: s.purchaseDate, quantity: s.quantity, avgPrice: s.averagePrice, avgExchangeRate: s.purchaseExchangeRate ?? 0,
  source: s.positionSource ?? "manual", effectiveDate: s.positionEffectiveDate ?? s.purchaseDate,
});
const cryptoItem = (c: Crypto): NItem => ({
  id: c.id, name: c.name, broker: c.exchange, key: (c.symbol ?? "").trim().toUpperCase(), market: "crypto",
  purchaseDate: c.purchaseDate, quantity: c.quantity, avgPrice: c.averagePrice, avgExchangeRate: 0,
  source: c.positionSource ?? "manual", effectiveDate: c.positionEffectiveDate ?? c.purchaseDate,
});
const stockTx = (t: Transaction): NTx => ({
  id: t.id, oldId: t.stockId, key: tickerKey(t.ticker), market: t.currency === "KRW" ? "domestic" : "foreign", type: t.type, quantity: t.quantity,
  price: t.price, exchangeRate: t.exchangeRate, date: t.date, reflected: t.reflected, createdAt: t.createdAt,
});
const cryptoTx = (t: CryptoTransaction): NTx => ({
  id: t.id, oldId: t.cryptoId, key: (t.symbol ?? "").trim().toUpperCase(), market: "crypto", type: t.type, quantity: t.quantity,
  price: t.price, date: t.date, reflected: t.reflected, createdAt: t.createdAt,
});

/** 대상 종목 S 1개의 후보(규칙 2~5·7). 없으면 null */
function detectForItem(s: NItem, created: string, importMs: number, orphans: NTx[], own: NTx[]): RelinkTarget | null {
  // 2. 고아 묶음 G(옛 id별): 키·시장 같고 모든 거래의 기록 시각(createdAt, 사용자 수정 불가) ≤ 대상 종목 생성 시각. 파싱 불가면 거래 날짜 ≤ 만든 날로 대체
  const byOld = new Map<string, NTx[]>();
  for (const t of orphans) if (t.key === s.key && t.market === s.market) byOld.set(t.oldId, [...(byOld.get(t.oldId) ?? []), t]);
  const merged = [...byOld.values()].filter((g) => g.every((t) => recordedBefore(t, importMs, created))).flat().sort(cmpTx); // 3. 여러 세대는 합쳐 한 줄(A1)
  if (merged.length === 0) return null;

  // 4. 전량 매도 구분: 합친 줄에서 매도 뒤 누적 ≤ 0이면 그 회차는 끝 — 마지막으로 끝난 지점 이후만 후보
  let cum = 0;
  let from = 0;
  merged.forEach((t, i) => {
    if (!t.reflected) return;
    cum += t.type === "buy" ? t.quantity : -t.quantity;
    if (t.type === "sell" && cum <= EPS) {
      cum = 0;
      from = i + 1;
    }
  });
  const cycle = merged.slice(from);
  if (cycle.length === 0) return null;

  // 5. 역산 일관성(A2): S 현재 포지션에서 (S 자기 반영 거래 + 후보)를 날짜 역순으로 역산할 때 수량이 0 미만이 되지 않는 가장 긴 뒤쪽 구간만 남긴다
  const candIds = new Set(cycle.map((t) => t.id));
  const line = [...own.filter((t) => t.reflected), ...cycle].sort(cmpTx);
  let pos: PositionLike = { quantity: s.quantity, avgPrice: s.avgPrice, avgExchangeRate: s.avgExchangeRate, source: s.source, effectiveDate: s.effectiveDate, lockedByManual: false };
  let cutAt = -1;
  for (let i = line.length - 1; i >= 0; i--) {
    const t = line[i];
    if (!t.reflected) continue;
    if (t.type === "buy" && pos.quantity - t.quantity < -EPS) {
      cutAt = i;
      break;
    }
    const prev = reverseTransaction(pos, t);
    pos = { ...pos, quantity: prev.quantity, avgPrice: prev.avgPrice, avgExchangeRate: prev.avgExchangeRate };
  }
  const kept = line.slice(cutAt + 1).filter((t) => candIds.has(t.id));
  if (kept.length === 0) return null;

  // 7. 새 매수일 = 남은 후보 중 가장 이른 매수 날짜(현재 매수일보다 이를 때만)
  const firstBuy = kept.find((t) => t.type === "buy")?.date;
  return {
    id: s.id,
    name: s.name,
    ...(s.broker ? { broker: s.broker } : {}),
    txIds: kept.map((t) => t.id),
    count: kept.length,
    firstDate: kept[0].date,
    lastDate: kept[kept.length - 1].date,
    cut: merged.length - kept.length,
    currentPurchaseDate: s.purchaseDate,
    ...(firstBuy && firstBuy < s.purchaseDate ? { newPurchaseDate: firstBuy } : {}),
  };
}

function detectKind(kind: RelinkKind, items: NItem[], txs: NTx[]): RelinkRow[] {
  const ids = new Set(items.map((i) => i.id));
  const orphans = txs.filter((t) => !ids.has(t.oldId));
  if (orphans.length === 0) return [];
  const found: { s: NItem; target: RelinkTarget }[] = [];
  for (const s of items) {
    // 1. 대상 종목 S: 맞추기·첫 등록이 만든 id, 매수일 = 만든 날 또는 만든 해 1월 1일(사용자가 고친 매수일은 제외)
    const m = IMPORT_ID.exec(s.id);
    if (!m || !s.key) continue;
    const created = kstDateOf(Number(m[1]));
    if (s.purchaseDate !== created && s.purchaseDate !== `${created.slice(0, 4)}-01-01`) continue;
    const target = detectForItem(s, created, Number(m[1]), orphans, txs.filter((t) => t.oldId === s.id));
    if (target) found.push({ s, target });
  }
  // 6. 같은 키 S가 1개면 그 S, 2개 이상이면 이을 종목 선택
  const groups = new Map<string, { s: NItem; target: RelinkTarget }[]>();
  for (const f of found) groups.set(`${f.s.market}:${f.s.key}`, [...(groups.get(`${f.s.market}:${f.s.key}`) ?? []), f]);
  return [...groups.entries()].map(([gk, list]) => ({
    rowId: list.length === 1 ? `${kind}:${list[0].s.id}` : `${kind}:multi:${gk}`,
    kind,
    targets: list.map((f) => f.target),
  }));
}

/** 끊긴 거래를 다시 이을 수 있는 종목 행(주식·코인). 후보 0이면 빈 배열 */
export function detectRelink(data: Pick<AssetData, "stocks" | "crypto" | "transactions" | "cryptoTransactions">): RelinkRow[] {
  return [
    ...detectKind("stock", (data.stocks ?? []).filter((s) => s.category !== "unlisted").map(stockItem), (data.transactions ?? []).map(stockTx)),
    ...detectKind("crypto", (data.crypto ?? []).map(cryptoItem), (data.cryptoTransactions ?? []).map(cryptoTx)),
  ];
}

/** 안내 줄 합계 — 대상이 여럿인 행은 첫 대상 기준(선택 전 대략값) */
export const relinkTotalCount = (rows: RelinkRow[]): number => rows.reduce((n, r) => n + r.targets[0].count, 0);

export interface RelinkApplyResult {
  data: AssetData;
  /** 실제로 이은 종목 수 */
  rows: number;
  /** 실제로 이은 거래 건수 */
  txs: number;
}

/**
 * 적용 — picks(rowId → 고른 대상 S.id)를 적용 직전 데이터로 다시 감지해 아직 유효한 행만 이어 새 AssetData를 돌려준다(순수).
 * 바뀌는 값: 후보 거래의 stockId/cryptoId, 대상 종목 purchaseDate(새 매수일이 있을 때). 그 밖 0. 다시 돌리면 후보 0(멱등).
 */
export function applyRelink(data: AssetData, picks: Record<string, string>): RelinkApplyResult {
  const rows = detectRelink(data);
  const stockMap = new Map<string, string>(); // 거래 id → S.id
  const cryptoMap = new Map<string, string>();
  const dates = new Map<string, string>(); // `${kind}:${S.id}` → 새 매수일
  let rowCount = 0;
  let txCount = 0;
  for (const row of rows) {
    const target = row.targets.find((t) => t.id === picks[row.rowId]);
    if (!target) continue;
    rowCount += 1;
    txCount += target.count;
    for (const id of target.txIds) (row.kind === "stock" ? stockMap : cryptoMap).set(id, target.id);
    if (target.newPurchaseDate) dates.set(`${row.kind}:${target.id}`, target.newPurchaseDate);
  }
  if (rowCount === 0) return { data, rows: 0, txs: 0 };
  return {
    rows: rowCount,
    txs: txCount,
    data: {
      ...data,
      stocks: data.stocks.map((s) => (dates.has(`stock:${s.id}`) ? { ...s, purchaseDate: dates.get(`stock:${s.id}`)! } : s)),
      crypto: data.crypto.map((c) => (dates.has(`crypto:${c.id}`) ? { ...c, purchaseDate: dates.get(`crypto:${c.id}`)! } : c)),
      transactions: (data.transactions ?? []).map((t) => (stockMap.has(t.id) ? { ...t, stockId: stockMap.get(t.id)! } : t)),
      cryptoTransactions: (data.cryptoTransactions ?? []).map((t) => (cryptoMap.has(t.id) ? { ...t, cryptoId: cryptoMap.get(t.id)! } : t)),
    },
  };
}
