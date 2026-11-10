// 보유 현황 맞추기(#91) — 적용(순수). 거래 배열은 건드리지 않고 stocks만 새로 만든다.
// 연결 항목은 기존 객체에서 수량·평단(화면 실값)·증권사 채움만 바꾸고 id·매수일·매입 환율·메모·비활성 필드를 승계한다(S4·S5).
// #139: 매칭에 실패해 '추가'가 된 행이 이번에 지우는 같은 종목(티커·시장 같음)을 이어받는다 — 새 id·오늘 매수일로
// 다시 만들면 거래 기록(stockId)이 끊기고 매수일 이전 배당이 빠졌다. 정말 새 종목의 매수일은 올해 1월 1일(대표 결정 11-10).
import type { Stock } from "@/types/asset";
import { evaluateLink, type DiffResult, type DiffRow, type LinkChange } from "./diff";
import { sameBroker, tickerKey } from "./match";
import type { ResyncOptions } from "./types";

export interface ResyncSelection {
  /** 확인 필요 행 중 `맞추기에 포함`을 체크한 rowId */
  include: Set<string>;
  /** 삭제할 기존 항목 id (기본값은 defaultRemoveIds, 유지 묶음에서 체크하면 추가) */
  remove: Set<string>;
  /** 후보가 여럿인 행에서 고른 기존 항목 id */
  pick: Record<string, string>;
  /** 확인 필요 칸에서 사용자가 입력한 수량 */
  qty: Record<string, number>;
  /** 티커 미인식 신규 행의 입력 티커 */
  ticker: Record<string, string>;
  /** 신규 해외 종목 매입 환율(없으면 오늘 환율) */
  fx?: number;
}

export type RowAction =
  | { type: "skip" }
  | { type: "same"; stock: Stock }
  | { type: "change"; stock: Stock; change: LinkChange }
  | { type: "add"; qty: number; ticker: string };

/** 행 1개를 선택 상태에 맞춰 최종 동작으로 푼다. 확인 필요 행은 포함 체크 + 필요한 입력이 있어야만 적용된다 */
export function resolveRow(row: DiffRow, sel: ResyncSelection): RowAction {
  const item = row.item;
  if (!item || row.status === "remove") return { type: "skip" };

  if (row.status === "needs") {
    if (!sel.include.has(row.rowId)) return { type: "skip" };
    if (row.reasons.includes("brokerUnconfirmed")) return { type: "skip" };
    const qtyInput = sel.qty[row.rowId];
    if (row.reasons.includes("quantityMissing") && !(qtyInput > 0)) return { type: "skip" };
  }

  let stock = row.stock;
  if (row.reasons.includes("ambiguous")) {
    stock = row.candidates?.find((c) => c.id === sel.pick[row.rowId]);
    if (!stock) return { type: "skip" };
  }
  const qtyOverride = sel.qty[row.rowId] > 0 ? sel.qty[row.rowId] : undefined;

  if (stock) {
    const change = evaluateLink(item, stock, row.status === "needs" ? qtyOverride : undefined);
    return change.qty || change.avg || change.brokerFill ? { type: "change", stock, change } : { type: "same", stock };
  }
  const ticker = (row.reasons.includes("tickerMissing") ? sel.ticker[row.rowId] : item.ticker)?.trim() ?? "";
  if (!ticker) return { type: "skip" };
  return { type: "add", qty: (row.status === "needs" ? qtyOverride : undefined) ?? item.quantity, ticker };
}

export interface ResyncCounts {
  add: number;
  change: number;
  remove: number;
  same: number;
  /** 맞추지 않고 그대로 두는 확인 필요 */
  needs: number;
}

/** 미리보기 요약 1줄 건수. 변경 0(add+change+remove=0)이면 적용 버튼 비활성 */
export function summarize(diff: DiffResult, sel: ResyncSelection): ResyncCounts {
  const c: ResyncCounts = { add: 0, change: 0, remove: 0, same: 0, needs: 0 };
  for (const row of diff.rows) {
    const a = resolveRow(row, sel);
    if (a.type === "add") c.add += 1;
    else if (a.type === "change") c.change += 1;
    else if (a.type === "same") c.same += 1;
    else if (row.status === "needs") c.needs += 1;
  }
  c.remove = removableIds(diff, sel).size;
  return c;
}

/** 실제로 지울 id: 삭제 후보·유지 묶음에 있는 것만 인정하고, 이번에 연결·갱신된 항목은 지우지 않는다 */
export function removableIds(diff: DiffResult, sel: ResyncSelection): Set<string> {
  const allowed = new Set([...diff.removes.map((r) => r.stock.id), ...diff.kept.map((s) => s.id)]);
  return new Set([...sel.remove].filter((id) => allowed.has(id)));
}

export const changeCount = (counts: ResyncCounts) => counts.add + counts.change + counts.remove;

export interface ApplyResult {
  stocks: Stock[];
  counts: ResyncCounts;
  addedIds: string[];
}

/** 맞추기로 새로 추가되는 종목의 매수일 기본값 = 그해 1월 1일(today는 KST YYYY-MM-DD). 올해 배당이 빠지지 않게 하고 상세에서 고칠 수 있다(#139) */
export const resyncNewPurchaseDate = (today: string): string => `${today.slice(0, 4)}-01-01`;

/**
 * 결산 예측 구간(시작 스냅샷에 원가 없음)의 신규 투입 추정일(#139 qa D1).
 * 맞추기로 새로 만든 항목(id `stock_import_<ms>_N`/`crypto_import_<ms>_N`)이 매수일 기본값(만든 해 1월 1일)을 그대로 갖고 있으면
 * 실제로 자산에 들어온 날 = 만든 날(KST)로 본다 — 1월 1일을 쓰면 지난 1월 결산에 없던 매수가 소급되고 이번 달 매수가 시세로 읽힌다.
 * 직접 등록 신규 종목(id `stock_<ms>`, #142 4.75: 기본값 올해 1월 1일)도 같은 원칙. 그 밖(사용자가 매수일을 고친 항목·이어받은 기존 항목)은 purchaseDate 그대로. 상세 매수일·배당은 이 함수를 쓰지 않는다.
 */
export function resyncInflowDate(s: { id: string; purchaseDate: string }): string {
  // 직접 등록 id는 `stock_<ms>`로 끝이 고정 — 종목 나누기 새 행(`stock_<ms>_<N>`, 기준 종목 매수일 복사)은 제외(#142 qa D2)
  const m = /^(?:(?:stock|crypto)_import_(\d{10,})(?:_|$)|stock_(\d{10,})$)/.exec(s.id);
  if (!m) return s.purchaseDate;
  const created = new Date(Number(m[1] ?? m[2]) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return s.purchaseDate === resyncNewPurchaseDate(created) && s.purchaseDate < created ? created : s.purchaseDate;
}

const isForeignMarket = (c: Stock["category"]) => c === "foreign";

/**
 * 추가 행이 이어받을 기존 항목 — 이번에 지우는 항목 중 티커·시장(해외/국내 계열)이 같은 것.
 * 고르는 순서: 증권사 같음 → 계좌(category) 같음 → 매수일 이른 것 → 기존 순서. 이미 이어받은 항목은 제외
 */
function pickPredecessor(item: NonNullable<DiffRow["item"]>, ticker: string, pool: Stock[], taken: Set<string>): Stock | undefined {
  const tk = tickerKey(ticker);
  if (!tk) return undefined;
  const cands = pool.filter(
    (e) => !taken.has(e.id) && e.category !== "unlisted" && tickerKey(e.ticker) === tk && isForeignMarket(e.category) === isForeignMarket(item.category),
  );
  const rank = (e: Stock) => (item.broker && sameBroker(e.broker, item.broker) ? 0 : 2) + (e.category === item.category ? 0 : 1);
  return cands
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || (a.e.purchaseDate || "9999").localeCompare(b.e.purchaseDate || "9999") || a.i - b.i)[0]?.e;
}

export function applyResync(
  existing: Stock[],
  diff: DiffResult,
  sel: ResyncSelection,
  opts: ResyncOptions & { now: number },
): ApplyResult {
  const updated = new Map<string, Stock>();
  const added: Stock[] = [];
  const adds: { a: Extract<RowAction, { type: "add" }>; item: NonNullable<DiffRow["item"]> }[] = [];

  diff.rows.forEach((row) => {
    const a = resolveRow(row, sel);
    const item = row.item!;
    if (a.type === "change") {
      const next: Stock = { ...a.stock };
      if (a.change.qty) next.quantity = a.change.qty.after;
      if (a.change.avg) next.averagePrice = a.change.avg.after;
      if (a.change.brokerFill) next.broker = a.change.brokerFill.to;
      if (a.change.qty || a.change.avg) {
        next.positionSource = "manual";
        next.positionEffectiveDate = opts.today;
      }
      updated.set(a.stock.id, next);
    } else if (a.type === "add") {
      adds.push({ a, item });
    }
  });

  const removeIds = removableIds(diff, sel);
  for (const id of updated.keys()) removeIds.delete(id);
  const removing = existing.filter((e) => removeIds.has(e.id));
  const taken = new Set<string>();

  adds.forEach(({ a, item }) => {
    // 같은 종목을 지우고 다시 추가하는 경우 → 기존 기록 승계(id·매수일·매입 환율·메모·비활성 필드), 수량·평단·증권사·계좌만 화면 값
    const pred = pickPredecessor(item, a.ticker, removing, taken);
    if (pred) {
      taken.add(pred.id);
      removeIds.delete(pred.id);
      const change = evaluateLink(item, pred, a.qty);
      const next: Stock = { ...pred, category: item.category, positionSource: "manual", positionEffectiveDate: opts.today };
      if (change.qty) next.quantity = change.qty.after;
      if (change.avg) next.averagePrice = change.avg.after;
      if (item.broker) next.broker = item.broker;
      updated.set(pred.id, next);
      return;
    }
    const foreign = item.category === "foreign";
    const s: Stock = {
      id: `stock_import_${opts.now}_${added.length}`,
      category: item.category,
      name: item.name,
      ticker: a.ticker,
      quantity: a.qty,
      averagePrice: item.averagePrice,
      currentPrice: item.currentPrice > 0 ? item.currentPrice : item.averagePrice,
      currency: item.currency,
      purchaseDate: resyncNewPurchaseDate(opts.today),
      description: "",
      ...(item.broker ? { broker: item.broker } : {}),
      ...(foreign ? { purchaseExchangeRate: sel.fx && sel.fx > 0 ? sel.fx : opts.usdRate } : {}),
      positionSource: "manual",
      positionEffectiveDate: opts.today,
    };
    added.push(s);
  });

  const stocks = [...existing.filter((e) => !removeIds.has(e.id)).map((e) => updated.get(e.id) ?? e), ...added];
  return { stocks, counts: summarize(diff, sel), addedIds: added.map((s) => s.id) };
}
