// 보유 현황 맞추기 — 저장 계획(순수). applyResync가 만든 stocks를 거래·대출과 함께 한 번의 저장 데이터로 묶는다(#310, 5.156).
// 결함 수정: 맞추기에서 체크해 실제로 지운 종목의 거래는 직접 삭제(planDeleteStocks)와 같은 규칙으로 정리한다 —
// 남겨 두면 반영 거래가 reflectedTradeFlow·tradedStockIds에 계속 합산돼 결산·홈 원인에 잔차가 생겼다.
// 삭제 규칙 함수는 contexts에 있으므로 호출측이 넘긴다(lib → contexts 의존 금지, 규칙 재구현 금지).
import type { AssetData, Stock } from "@/types/asset";
import type { ApplyResult, ResyncSelection } from "./apply";
import type { DiffResult } from "./diff";
import { isUnassignedBroker, sameBroker, tickerKey } from "./match";

// ── 증권사 이관 후보 감지(#310) ─────────────────────────────────────────
// B 증권사 화면으로 맞출 때, 이번 장 범위 밖(diff.kept)에 남은 다른 증권사의 같은 종목(A)을 '옮겼나요?'로 묻는다.
// 판별 필드는 id·tickerKey·category·broker뿐(날짜·이름·메모 0, LEARNINGS 11-11). 결과는 질문뿐이고 기본 미체크(C36).
// v1: 같은 tickerKey·category로 남은 A가 정확히 1개, 화면 행도 정확히 1개일 때만(생존 id 고르기 규칙 0). 코인은 호출하지 않는다.

export interface TransferCandidate {
  /** 남아 있는 옛 증권사 종목(A) */
  from: Stock;
  /** B 화면 행 */
  rowId: string;
  /** B 증권사(화면 확정값) */
  toBroker: string;
  /** inherit = B 행이 추가(A id를 이어받음, 거래 재작성 0) / merge = B 행이 변경·그대로(B 종목에 합치고 거래 stockId A→B) */
  path: "inherit" | "merge";
  /** merge일 때 합칠 B 종목 */
  to?: Stock;
}

const sameKey = (a: { ticker?: string | null; category: Stock["category"] }, tk: string, category: Stock["category"]) => tickerKey(a.ticker) === tk && a.category === category;

/** 이관 후보(미리보기 행 순서). computeDiff 결과만 쓴다(순수) */
export function detectTransfers(diff: DiffResult): TransferCandidate[] {
  const out: TransferCandidate[] = [];
  for (const row of diff.rows) {
    const item = row.item;
    if (!item || item.broker === undefined) continue;
    if (row.status !== "add" && row.status !== "change" && row.status !== "same") continue;
    const tk = tickerKey(item.ticker);
    if (!tk || item.category === "unlisted") continue;
    if (row.status !== "add" && (!row.stock || row.stock.category !== item.category)) continue;
    // 같은 종목·같은 계좌 유형의 화면 행이 정확히 1개(확인 필요 행 포함해 센다)
    if (diff.rows.filter((r) => r.item && sameKey(r.item, tk, item.category)).length !== 1) continue;
    // 남은 옛 종목도 정확히 1개, 증권사 지정됨·B와 다름
    const olds = diff.kept.filter((s) => sameKey(s, tk, item.category));
    if (olds.length !== 1) continue;
    const a = olds[0];
    if (isUnassignedBroker(a.broker) || sameBroker(a.broker, item.broker)) continue;
    out.push(row.status === "add"
      ? { from: a, rowId: row.rowId, toBroker: item.broker, path: "inherit" }
      : { from: a, rowId: row.rowId, toBroker: item.broker, path: "merge", to: row.stock });
  }
  return out;
}

/** 카드에서 '옮김'으로 체크한 후보만(sel.transfer). 비어 있으면 [] — v5.152와 같은 결과 */
export function checkedTransfers(diff: DiffResult, sel: Pick<ResyncSelection, "transfer">): TransferCandidate[] {
  if (!sel.transfer || sel.transfer.size === 0) return [];
  return detectTransfers(diff).filter((c) => sel.transfer!.has(c.from.id));
}

/** 지운 종목 id 목록으로 거래를 정리한 데이터를 돌려주는 함수 — 호출측이 `planDeleteStocks(data, ids, rates)`를 넘긴다 */
export type PlanDeleteStocks = (data: AssetData, ids: string[]) => AssetData;

export interface ResyncSavePlan {
  /** 저장할 데이터 1건(stocks·transactions·loans를 함께) */
  data: AssetData;
  /** 증권사를 옮긴 종목 수(#310) */
  moved: number;
  /** 옮긴 종목에 이어진 거래 수 — 합치기는 stockId를 다시 쓴 건수, 이어받기는 A의 거래 수 그대로 */
  movedTx: number;
}

/**
 * 맞추기 적용 결과를 저장 데이터로 만든다. fresh = 저장 직전 getAssetData() 최신본, result = 같은 fresh.stocks로 계산한 applyResync 결과.
 * - 합치기(#310): 거래 stockId·대출 linkedStockId를 A→B로 다시 쓴다(그 밖의 필드·수량·평단·환율·reflected 불변).
 * - 결함 수정: 실제로 지운 종목(합치기 A 제외)의 거래는 planDeleteStocks 규칙으로 정리한다. 대출 연결은 직접 삭제처럼 그대로 둔다.
 * 바뀌지 않은 거래·대출은 같은 참조를 유지한다(되돌리기 목록에 안 들어감).
 */
export function planResyncSave(fresh: AssetData, result: Pick<ApplyResult, "stocks"> & Partial<Pick<ApplyResult, "transfers">>, planDelete: PlanDeleteStocks): ResyncSavePlan {
  const transfers = result.transfers ?? [];
  const remap = new Map(transfers.filter((t) => t.path === "merge" && t.toId !== t.fromId).map((t) => [t.fromId, t.toId]));
  const fromIds = new Set(transfers.map((t) => t.fromId));
  const txs = fresh.transactions ?? [];
  const movedTx = txs.filter((t) => fromIds.has(t.stockId)).length;
  let transactions = remap.size > 0 ? txs.map((t) => (remap.has(t.stockId) ? { ...t, stockId: remap.get(t.stockId)! } : t)) : fresh.transactions;
  const loans = remap.size > 0 ? fresh.loans.map((l) => (l.linkedStockId && remap.has(l.linkedStockId) ? { ...l, linkedStockId: remap.get(l.linkedStockId)! } : l)) : fresh.loans;
  const kept = new Set(result.stocks.map((s) => s.id));
  const deleted = fresh.stocks.filter((s) => !kept.has(s.id) && !remap.has(s.id)).map((s) => s.id);
  if (deleted.length > 0) transactions = planDelete({ ...fresh, transactions }, deleted).transactions ?? [];
  return { data: { ...fresh, stocks: result.stocks, transactions, loans }, moved: transfers.length, movedTx };
}

/** 지운 코인 id 목록으로 코인 거래를 정리한 데이터를 돌려주는 함수 — 호출측이 `planDeleteCryptos(data, ids, rates)`를 넘긴다 */
export type PlanDeleteCryptos = (data: AssetData, ids: string[]) => AssetData;

/**
 * 코인 맞추기 적용 결과를 저장 데이터로 만든다(5.161). 삭제 id = 저장 직전 fresh.crypto에 있고 nextCrypto에 없는 id —
 * 체크한 행 id가 아니라 실제로 사라진 id로 계산해, 이름이 바뀌어 매칭된 코인의 거래가 지워지지 않게 한다.
 * 거래 정리 규칙은 직접 삭제(planDeleteCryptos)를 그대로 쓴다. 지운 코인이 없으면 거래는 같은 참조로 둔다.
 */
export function planCryptoResyncSave(fresh: AssetData, nextCrypto: AssetData["crypto"], planDelete: PlanDeleteCryptos): AssetData {
  const kept = new Set(nextCrypto.map((c) => c.id));
  const deleted = fresh.crypto.filter((c) => !kept.has(c.id)).map((c) => c.id);
  if (deleted.length === 0) return { ...fresh, crypto: nextCrypto };
  return { ...fresh, crypto: nextCrypto, cryptoTransactions: planDelete(fresh, deleted).cryptoTransactions ?? [] };
}

/** 화면 상태(trade-view-store·stock-page-store)의 대상에서 없어진 종목 id를 걸러낸다. 그룹이 비면 null(호출측이 clear), 바뀐 게 없으면 같은 참조 */
export function pruneStockTarget<T extends { groupStockIds: string[]; initialStockId?: string | null }>(target: T, liveIds: Set<string>): T | null {
  const group = target.groupStockIds.filter((id) => liveIds.has(id));
  if (group.length === 0) return null;
  const initialGone = target.initialStockId != null && !liveIds.has(target.initialStockId);
  if (group.length === target.groupStockIds.length && !initialGone) return target;
  return { ...target, groupStockIds: group, ...(initialGone ? { initialStockId: null } : {}) };
}
