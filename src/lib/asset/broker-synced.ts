// 증권사별 마지막 맞춘 날(#366, 5.179) — 쓰기 범위·종목 수·표시 문자열 계산과 '변경 0 확인' 본체.
// 저장은 asset-refresh-status(같은 키 brokers.stock)만 거친다. assetData·동기화·서버 호출 0.
import type { Stock } from "@/types/asset";
import { getAssetData } from "@/lib/asset/asset-storage";
import { track } from "@/lib/analytics/ga";
import {
  BROKER_SYNC_CATEGORIES,
  lastRefreshedAt,
  markBrokersSynced,
  markCategoryRefreshed,
  type BrokerSyncCategory,
  type BrokerSyncEntry,
  type BrokerSyncScope,
  type BrokerSyncUndo,
} from "@/lib/asset/asset-refresh-status";
import { changeCount, isUnassignedBroker, resolveRow, sameBroker, summarize, type DiffResult, type ResyncSelection } from "@/lib/asset/resync";

const BROKER_NAME_MAX = 40;
const isSyncCategory = (c: Stock["category"]): c is BrokerSyncCategory => (BROKER_SYNC_CATEGORIES as readonly string[]).includes(c);

/** 범위(증권사 × 계좌)의 항목 수 — 상장폐지·수량 0 제외, 같은 티커도 항목마다 센다(BrokerTotalRow.count와 다른 정의) */
export function scopeCount(stocks: readonly Stock[], broker: string, category: BrokerSyncCategory): number {
  return stocks.filter((s) => s.category === category && sameBroker(s.broker, broker) && s.inactiveStatus !== "delisted" && s.quantity > 0).length;
}

/**
 * 날짜를 쓸 수 있는 범위(spec 4장) — 맞추기를 누른 순간 다시 계산한 diff 기준.
 * ① 실패·잘림·한도·실패 장 제거·증권사 미확정 장이 하나라도 있으면 0 ② 후보 = 확정 장의 증권사 × 계좌(비상장 제외)
 * ③ 그 범위에 맞추지 않는 확인 필요 행이 있거나, 적용 뒤에도 남는 삭제 후보가 있으면 제외. count는 afterStocks 기준.
 */
export function writableScopes(d: DiffResult, sel: ResyncSelection, afterStocks: readonly Stock[]): BrokerSyncScope[] {
  if (d.incomplete) return [];
  const blocked = new Set<string>();
  const keyOf = (broker: string, category: Stock["category"]) => {
    const s = d.scopes.find((x) => x.category === category && sameBroker(x.broker, broker));
    return s?.key;
  };
  for (const row of d.rows) {
    if (row.status !== "needs" || resolveRow(row, sel).type !== "skip") continue;
    const broker = row.item?.broker;
    if (broker === undefined) return []; // 증권사 미확정 행(incomplete와 같은 뜻)
    const cats = new Set<Stock["category"]>([row.item!.category]);
    if (row.stock) cats.add(row.stock.category);
    for (const c of row.candidates ?? []) cats.add(c.category);
    for (const c of cats) {
      const k = keyOf(broker, c);
      if (k) blocked.add(k);
    }
  }
  const after = new Map(afterStocks.map((s) => [s.id, s]));
  for (const r of d.removes) {
    const left = after.get(r.stock.id);
    if (left && left.category === r.stock.category && sameBroker(left.broker, r.stock.broker) && r.scopeKey) blocked.add(r.scopeKey);
  }
  const out: BrokerSyncScope[] = [];
  const clash = new Set<number>();
  d.scopes.forEach((s) => {
    if (blocked.has(s.key) || !isSyncCategory(s.category) || isUnassignedBroker(s.broker) || s.broker.length > BROKER_NAME_MAX) return;
    const j = out.findIndex((o) => o.category === s.category && sameBroker(o.broker, s.broker));
    if (j >= 0) {
      clash.add(j); // 같은 증권사로 읽히는 두 범위 — 어느 쪽 날짜인지 모호하니 둘 다 쓰지 않는다
      return;
    }
    out.push({ broker: s.broker, category: s.category, count: scopeCount(afterStocks, s.broker, s.category) });
  });
  return out.filter((_, i) => !clash.has(i));
}

/** KST 올해면 `M/D`, 다른 해면 `YYYY.M.D` */
export function formatSyncedDate(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return date.slice(0, 4) === today.slice(0, 4) ? `${m}/${d}` : `${y}.${m}.${d}`;
}

/**
 * 증권사별 행의 맞춘 날 — 행의 live 종목이 가진 모든 계좌에 기록이 있고 각 종목 수가 지금과 같을 때만 그중 가장 이른 날.
 * 하나라도 없거나 수가 다르면 null(거짓보다 생략). 미지정 행·비상장만 있는 행은 null.
 */
export function syncedLabel(
  row: { name: string; unassigned: boolean; scopeCounts?: Partial<Record<BrokerSyncCategory, number>> },
  entries: readonly BrokerSyncEntry[],
  today: string,
): { date: string; text: string } | null {
  if (row.unassigned || !row.scopeCounts) return null;
  const need = (Object.entries(row.scopeCounts) as [BrokerSyncCategory, number][]).filter(([, n]) => n > 0);
  if (need.length === 0) return null;
  let earliest: string | null = null;
  for (const [cat, n] of need) {
    const e = entries.find((x) => x.category === cat && sameBroker(x.broker, row.name));
    if (!e || e.count !== n) return null;
    if (earliest === null || e.date < earliest) earliest = e.date;
  }
  return earliest ? { date: earliest, text: `${formatSyncedDate(earliest, today)} 맞춤` } : null;
}

// ── 변경 0 확인(경로 B) ──────────────────────────────────────────────
export interface ConfirmSameDeps {
  getStocks: () => Stock[];
  markBrokers: (scopes: BrokerSyncScope[]) => BrokerSyncUndo | null;
  lastRefreshed: () => string | null;
  markRefreshed: () => string;
  track: () => void;
}

/** 실제 쓰기 경로 — 대화상자와 테스트가 같은 함수를 쓴다 */
export const confirmSameDeps: ConfirmSameDeps = {
  getStocks: () => getAssetData().stocks,
  markBrokers: (scopes) => markBrokersSynced(scopes),
  lastRefreshed: () => lastRefreshedAt("stock"),
  markRefreshed: () => markCategoryRefreshed("stock", { notify: false }), // 결과 화면이 열려 있어 닫을 때 신호(handleClose)
  track: () => track("feature_use", { category: "resync_confirm_same" }),
};

export type ConfirmSameResult = { ok: true; brokers: BrokerSyncUndo; prevRefreshedAt: string | null; appliedAt: string } | { ok: false };

/**
 * 변경 0 확인 — 자산 저장·적용 계산·대조 없이 맞춘 날과 주식 맞춘 시각만 남긴다.
 * diffOf: 누른 순간의 보유 현황으로 diff를 다시 만든다(memo 값 금지). 그 사이 바뀔 내용이 생겼거나 쓸 범위가 0이면 실패.
 */
export function confirmSameResync(diffOf: (stocks: Stock[]) => DiffResult, sel: ResyncSelection, deps: ConfirmSameDeps = confirmSameDeps): ConfirmSameResult {
  const stocks = deps.getStocks();
  const d = diffOf(stocks);
  if (changeCount(summarize(d, sel, stocks)) > 0) return { ok: false };
  const scopes = writableScopes(d, sel, stocks);
  if (scopes.length === 0) return { ok: false };
  const brokers = deps.markBrokers(scopes);
  if (!brokers) return { ok: false };
  const prevRefreshedAt = deps.lastRefreshed();
  const appliedAt = deps.markRefreshed();
  deps.track();
  return { ok: true, brokers, prevRefreshedAt, appliedAt };
}

/** 변경 있음(경로 A) — 자산 저장 성공 뒤 쓸 수 있는 범위에 날짜를 남긴다. 범위 0이거나 쓰기 실패면 null(자산 저장이 정본이라 문구 0) */
export function markAppliedResync(d: DiffResult, sel: ResyncSelection, afterStocks: readonly Stock[]): BrokerSyncUndo | null {
  const scopes = writableScopes(d, sel, afterStocks);
  return scopes.length > 0 ? markBrokersSynced(scopes) : null;
}
