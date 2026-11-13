// 보유 현황 맞추기(#91) — 추가·변경·삭제·그대로·확인 필요 분류와 삭제 범위(S1)·삭제 기본 해제(S2). 순수 함수.
// 범위 = 확정된 장에 나온 (증권사 × Stock.category) 조합. 비상장(unlisted)은 범위 밖이라 항상 유지 묶음이다.
import type { Stock } from "@/types/asset";
import { isUnassignedBroker, matchExisting, sameBroker, tickerKey, type LinkKind } from "./match";
import { sameQty } from "./merge";
import type { MergedItem, ResolvedScreen } from "./types";

export type RowStatus = "add" | "change" | "remove" | "same" | "needs";
export type NeedsReason =
  | "qtyDecrease" // ②③ 연결인데 수량이 줄었다(S3)
  | "ambiguous" // 후보 2건 이상(④)
  | "multiAccount" // ambiguous 중 후보가 같은 증권사·같은 유형(DC·IRP 등 계좌만 다름) — 문구 구분용
  | "qtyConflict" // 두 장 수량이 다르다(K1)
  | "brokerUnconfirmed" // 증권사 미확정 장
  | "quantityMissing" // 수량 미인식(서버 플래그)
  | "tickerMissing"; // 티커 미인식 신규

/** 평단: 화면 실값은 이 비율을 넘어야 변경, 역산값은 이 비율을 넘을 때만 '기존 값 유지' 표시 */
export const AVG_REAL_TOLERANCE = 0.001;
export const AVG_ESTIMATED_NOTE_TOLERANCE = 0.01;

export interface LinkChange {
  qty: { before: number; after: number } | null;
  avg: { before: number; after: number } | null;
  /** 역산 평단이 기존과 1% 넘게 달라 기존 값을 유지했다 */
  avgKept: boolean;
  brokerFill: { from: string | undefined; to: string } | null;
  qtyDecrease: boolean;
}

export interface DiffRow {
  rowId: string;
  status: RowStatus;
  reasons: NeedsReason[];
  item?: MergedItem;
  /** 연결된(또는 삭제 후보인) 기존 항목 */
  stock?: Stock;
  candidates?: Stock[];
  linkedBy?: LinkKind;
  change?: LinkChange;
  scopeKey?: string;
}

export interface ScopeInfo {
  key: string;
  broker: string;
  category: Stock["category"];
  existingCount: number;
  removeCount: number;
  /** 삭제 후보가 기존 종목의 절반 이상 — 이 조합만 기본 체크 해제 */
  half: boolean;
}

export interface RemoveRow extends DiffRow {
  status: "remove";
  stock: Stock;
  /** 기본 삭제 체크 여부 */
  defaultChecked: boolean;
  /** 기본 해제 사유 */
  offReason?: "incomplete" | "half" | "inactive";
}

export interface DiffResult {
  /** 화면에 있는 종목 행(추가·변경·그대로·확인 필요) — 병합 순서 */
  rows: DiffRow[];
  /** `○○ 화면에 없는 종목` 삭제 후보 */
  removes: RemoveRow[];
  /** 유지 묶음(스크린샷에 없는 증권사·계좌·증권사 미지정·비상장). 기본은 유지 */
  kept: Stock[];
  scopes: ScopeInfo[];
  /** 실패·잘림·한도 미인식 장 또는 증권사 미확정 장이 있다(모든 범위 기본 해제) */
  incomplete: boolean;
}

const scopeKeyOf = (broker: string, category: Stock["category"]) => `${broker.replace(/\s/g, "")}|${category}`;

/** 연결된 기존 항목과 화면 값을 비교한다(수량·평단·증권사 채움). qtyOverride는 확인 필요 칸에서 사용자가 정한 수량 */
export function evaluateLink(item: MergedItem, stock: Stock, qtyOverride?: number): LinkChange {
  const useQty = qtyOverride ?? (item.quantityMissing ? undefined : item.quantity);
  const qty = useQty !== undefined && !sameQty(useQty, stock.quantity) ? { before: stock.quantity, after: useQty } : null;
  let avg: LinkChange["avg"] = null;
  let avgKept = false;
  if (item.averagePrice > 0 && stock.averagePrice > 0) {
    const rel = Math.abs(item.averagePrice - stock.averagePrice) / stock.averagePrice;
    if (!item.averagePriceEstimated) {
      if (rel > AVG_REAL_TOLERANCE) avg = { before: stock.averagePrice, after: item.averagePrice };
    } else if (rel > AVG_ESTIMATED_NOTE_TOLERANCE) {
      avgKept = true;
    }
  }
  const brokerFill = item.broker && isUnassignedBroker(stock.broker) ? { from: stock.broker || undefined, to: item.broker } : null;
  return { qty, avg, avgKept, brokerFill, qtyDecrease: !!qty && qty.after < qty.before };
}

export function computeDiff(existing: Stock[], items: MergedItem[], screens: ResolvedScreen[]): DiffResult {
  const incomplete = screens.some((s) => s.status !== "ok" || s.broker === undefined);
  const used = new Set<string>();
  const rows: DiffRow[] = [];
  const touchedScopes = new Map<string, { broker: string; category: Stock["category"] }>();
  const protectedIds = new Set<string>();

  const sameKeyRows = (it: MergedItem) =>
    items.filter(
      (o) =>
        o.broker !== undefined &&
        it.broker !== undefined &&
        o.category === it.category &&
        sameBroker(o.broker, it.broker) &&
        (tickerKey(o.ticker) ? tickerKey(o.ticker) === tickerKey(it.ticker) : !tickerKey(it.ticker) && o.name === it.name),
    ).length;

  for (const item of items) {
    const rowId = `i${item.seq}`;
    if (item.broker === undefined) {
      rows.push({ rowId, status: "needs", reasons: ["brokerUnconfirmed"], item });
      continue;
    }
    const m = matchExisting(
      { ticker: item.ticker, name: item.name, category: item.category, broker: item.broker },
      existing,
      used,
      Math.max(1, sameKeyRows(item)),
    );
    const reasons: NeedsReason[] = [];
    if (item.quantityMissing) reasons.push("quantityMissing");
    if (item.quantityCandidates) reasons.push("qtyConflict");

    if (m.kind === "ambiguous") {
      m.candidates.forEach((c) => protectedIds.add(c.id));
      touchedScopes.set(scopeKeyOf(item.broker, item.category), { broker: item.broker, category: item.category });
      // 후보 전부 같은 증권사·같은 계좌 유형이면 계좌만 다른 경우(저장 데이터로는 구분 불가)
      const [c0, ...cRest] = m.candidates;
      const multiAccount = cRest.every((c) => c.category === c0.category && sameBroker(c.broker, c0.broker));
      rows.push({ rowId, status: "needs", reasons: ["ambiguous", ...(multiAccount ? ["multiAccount" as const] : []), ...reasons], item, candidates: m.candidates });
      continue;
    }
    if (m.kind === "linked") {
      used.add(m.stock.id);
      protectedIds.add(m.stock.id);
      touchedScopes.set(scopeKeyOf(item.broker, item.category), { broker: item.broker, category: item.category });
      touchedScopes.set(scopeKeyOf(item.broker, m.stock.category), { broker: item.broker, category: m.stock.category });
      const change = evaluateLink(item, m.stock);
      if ((m.linkedBy === "unassigned" || m.linkedBy === "name") && change.qtyDecrease) reasons.push("qtyDecrease");
      const changed = !!(change.qty || change.avg || change.brokerFill);
      rows.push({
        rowId,
        status: reasons.length > 0 ? "needs" : changed ? "change" : "same",
        reasons,
        item,
        stock: m.stock,
        linkedBy: m.linkedBy,
        change,
      });
      continue;
    }
    touchedScopes.set(scopeKeyOf(item.broker, item.category), { broker: item.broker, category: item.category });
    if (!tickerKey(item.ticker)) reasons.push("tickerMissing");
    rows.push({ rowId, status: reasons.length > 0 ? "needs" : "add", reasons, item });
  }

  // 삭제 범위: 확정된 장에 나온 조합 안에서 어느 장에도 없는 기존 항목
  const scopes: ScopeInfo[] = [...touchedScopes.entries()].map(([key, s]) => {
    const inScope = existing.filter((e) => e.category === s.category && e.category !== "unlisted" && sameBroker(e.broker, s.broker));
    const removeCount = inScope.filter((e) => !protectedIds.has(e.id)).length;
    return { key, broker: s.broker, category: s.category, existingCount: inScope.length, removeCount, half: removeCount * 2 >= inScope.length };
  });

  const removes: RemoveRow[] = [];
  const kept: Stock[] = [];
  for (const e of existing) {
    if (protectedIds.has(e.id)) continue;
    const scope = e.category === "unlisted" ? undefined : scopes.find((s) => s.category === e.category && sameBroker(e.broker, s.broker));
    if (!scope) {
      kept.push(e);
      continue;
    }
    const offReason: RemoveRow["offReason"] = incomplete ? "incomplete" : scope.half ? "half" : e.inactiveStatus ? "inactive" : undefined;
    removes.push({
      rowId: `rm:${e.id}`,
      status: "remove",
      reasons: [],
      stock: e,
      scopeKey: scope.key,
      defaultChecked: !offReason,
      offReason,
    });
  }

  return { rows, removes, kept, scopes, incomplete };
}

/** 기본 삭제 체크 id (S2 반영). 유지 묶음은 기본 비어 있다 */
export const defaultRemoveIds = (diff: DiffResult): Set<string> => new Set(diff.removes.filter((r) => r.defaultChecked).map((r) => r.stock.id));
