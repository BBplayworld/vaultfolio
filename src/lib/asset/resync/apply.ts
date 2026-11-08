// 보유 현황 맞추기(#91) — 적용(순수). 거래 배열은 건드리지 않고 stocks만 새로 만든다.
// 연결 항목은 기존 객체에서 수량·평단(화면 실값)·증권사 채움만 바꾸고 id·매수일·매입 환율·메모·비활성 필드를 승계한다(S4·S5).
import type { Stock } from "@/types/asset";
import { evaluateLink, type DiffResult, type DiffRow, type LinkChange } from "./diff";
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

export function applyResync(
  existing: Stock[],
  diff: DiffResult,
  sel: ResyncSelection,
  opts: ResyncOptions & { now: number },
): ApplyResult {
  const updated = new Map<string, Stock>();
  const added: Stock[] = [];

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
        purchaseDate: opts.today,
        description: "",
        ...(item.broker ? { broker: item.broker } : {}),
        ...(foreign ? { purchaseExchangeRate: sel.fx && sel.fx > 0 ? sel.fx : opts.usdRate } : {}),
        positionSource: "manual",
        positionEffectiveDate: opts.today,
      };
      added.push(s);
    }
  });

  const removeIds = removableIds(diff, sel);
  for (const id of updated.keys()) removeIds.delete(id);
  const stocks = [...existing.filter((e) => !removeIds.has(e.id)).map((e) => updated.get(e.id) ?? e), ...added];
  return { stocks, counts: summarize(diff, sel), addedIds: added.map((s) => s.id) };
}
