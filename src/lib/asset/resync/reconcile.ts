// 5.161 맞추기 결과 대조 1줄 — 증권사 화면의 합계(screenTotal)와 '맞춘 뒤 앱 값'을 견준다(주식만).
// 순수 함수. 비교는 기기 메모리에서만 하고 저장·전송하지 않는다. 숨김 조건이 하나라도 있으면 줄을 보이지 않는다.
import type { Stock } from "@/types/asset";
import { inheritedPreds, resolveRow, type ApplyResult, type ResyncSelection } from "./apply";
import type { DiffResult } from "./diff";

/** 서버 응답 screenTotal(행과 분리된 필드) */
export interface ScreenTotalInfo {
  value: number;
  label: string;
  currency: "KRW" | "USD" | "JPY";
}

/** 허용 오차 = max(총액 × 0.5%, 1,000원). 0.5%는 /200으로 계산해 경계(정확히 같음)가 부동소수로 어긋나지 않게 한다 */
export const reconcileTolerance = (base: number): number => Math.max(base / 200, 1000);

/** 라벨 판정: '평가'가 있고 자산·예수금·예탁·추정·순이 없어야 예수금이 빠진 평가 합계로 본다. 공백은 무시 */
export function isStockTotalLabel(label: string): boolean {
  const l = label.replace(/\s/g, "");
  if (!l.includes("평가")) return false;
  return !["자산", "예수금", "예탁", "추정", "순"].some((w) => l.includes(w));
}

export interface ReconcileRow {
  name: string;
  /** 화면 행 평가액(원화) = 화면 수량 × 화면 현재가 × 환율. 화면에 값이 없으면 0 */
  screenValue: number;
  /** 맞춘 뒤 앱 평가액(원화) = 앱 수량 × 앱 현재가 × 환율 */
  appValue: number;
}

export interface ReconcileFlags {
  /** 인식에 성공한 장 수 */
  okShots: number;
  /** 실패·잘림·한도 장이 있거나 실패 장을 지운 상태 */
  shotProblem: boolean;
  /** 확인 필요 행 또는 적용하지 않은 화면 행이 있다 */
  unapplied: boolean;
  /** 대응 앱 종목의 현재가가 0 */
  stalePrice: boolean;
  /** 해외 종목이 있는데 환율을 아직 동기화하지 못했다(기본값) */
  foreignRateUnsynced: boolean;
  /** 되돌린 뒤 */
  undone: boolean;
}

export type ReconcileView =
  | { state: "hidden" }
  | { state: "match" }
  | { state: "diff"; ratePct: string; names: string[]; more: number };

export function reconcileTotal(input: { screenTotal: ScreenTotalInfo | null | undefined; rows: ReconcileRow[]; flags: ReconcileFlags }): ReconcileView {
  const { screenTotal: t, rows, flags: f } = input;
  if (!t || typeof t.value !== "number" || !Number.isFinite(t.value) || t.value <= 0 || t.currency !== "KRW") return { state: "hidden" };
  if (!isStockTotalLabel(t.label)) return { state: "hidden" };
  if (f.okShots !== 1 || f.shotProblem || f.unapplied || f.stalePrice || f.foreignRateUnsynced || f.undone) return { state: "hidden" };
  if (rows.length === 0) return { state: "hidden" };
  const appTotal = rows.reduce((s, r) => s + r.appValue, 0);
  const delta = Math.abs(appTotal - t.value);
  if (delta <= reconcileTolerance(t.value)) return { state: "match" };
  const off = rows
    .filter((r) => r.screenValue > 0 && Math.abs(r.appValue - r.screenValue) > reconcileTolerance(r.screenValue))
    .sort((a, b) => Math.abs(b.appValue - b.screenValue) - Math.abs(a.appValue - a.screenValue));
  return { state: "diff", ratePct: ((delta / t.value) * 100).toFixed(1), names: off.slice(0, 2).map((r) => r.name), more: Math.max(0, off.length - 2) };
}

/** 화면 문장(C138) — 상태별 1~2줄. 금액·종목 평가액은 싣지 않는다 */
export function reconcileLines(v: ReconcileView): string[] {
  if (v.state === "hidden") return [];
  if (v.state === "match") return ["증권사 화면 합계와 맞아요"];
  const second = v.names.length > 0 ? `차이가 큰 종목: ${v.names.join(", ")}${v.more > 0 ? ` 외 ${v.more}개` : ""}` : "화면에 안 담긴 종목이 있을 수 있어요";
  return [`증권사 화면 합계와 ${v.ratePct}% 달라요. 시세 시각이 달라 조금 다를 수 있어요`, second];
}

export const reconcileGaCategory = (v: ReconcileView): "resync_check_match" | "resync_check_diff" | "resync_check_none" =>
  v.state === "match" ? "resync_check_match" : v.state === "diff" ? "resync_check_diff" : "resync_check_none";

const mulOf = (currency: Stock["currency"] | undefined, rates: { USD: number; JPY: number }) => (currency === "USD" ? rates.USD : currency === "JPY" ? rates.JPY / 100 : 1);

/**
 * 화면 행 ↔ 맞춘 뒤 앱 종목을 이어 행별 값을 모은다. 같은 판정(resolveRow·inheritedPreds)을 쓰므로 applyResync 결과와 일치한다.
 * 화면 행 중 적용하지 않은 행이 있으면 unapplied. 화면에 안 보이는 앱 종목은 넣지 않는다.
 */
export function collectReconcileRows(input: {
  diff: DiffResult;
  sel: ResyncSelection;
  result: Pick<ApplyResult, "stocks" | "addedIds">;
  existing: Stock[];
  rates: { USD: number; JPY: number };
}): { rows: ReconcileRow[]; unapplied: boolean; stalePrice: boolean; hasForeign: boolean } {
  const { diff, sel, result, existing, rates } = input;
  const byId = new Map(result.stocks.map((s) => [s.id, s]));
  const inherits = inheritedPreds(diff, sel, existing);
  let addIdx = 0;
  let unapplied = false;
  let stalePrice = false;
  let hasForeign = false;
  const rows: ReconcileRow[] = [];
  for (const row of diff.rows) {
    const item = row.item;
    if (!item) continue;
    if (row.status === "needs") unapplied = true; // 확인 필요 행이 있으면 체크해도 숨긴다(값이 화면과 어긋날 수 있다)
    const a = resolveRow(row, sel);
    if (a.type === "skip") {
      unapplied = true;
      continue;
    }
    const id = a.type === "add" ? (inherits.get(row.rowId)?.id ?? result.addedIds[addIdx++]) : a.stock.id;
    const app = id ? byId.get(id) : undefined;
    if (!app) {
      unapplied = true;
      continue;
    }
    if (!(app.currentPrice > 0)) stalePrice = true;
    if (app.currency !== "KRW" || item.currency !== "KRW") hasForeign = true;
    // 수량을 직접 입력한 행(수량 미인식)은 화면 값이 없다 — 행별 비교에서 뺀다
    const screenValue = item.quantityMissing ? 0 : item.quantity * item.currentPrice * mulOf(item.currency, rates);
    rows.push({ name: item.name, screenValue, appValue: app.quantity * app.currentPrice * mulOf(app.currency, rates) });
  }
  return { rows, unapplied, stalePrice, hasForeign };
}
