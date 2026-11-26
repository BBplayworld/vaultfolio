// 5.164 #328 맞추기 결과 대조 1줄 — 증권사 화면의 합계(screenTotal)와 '맞춘 뒤 앱 값'을 견준다(주식만).
// 순수 함수. 비교는 기기 메모리에서만 하고 저장·전송하지 않는다. 숨김 조건이 하나라도 있으면 줄을 보이지 않는다.
// 합계는 행 인식과 분리된 전용 호출(assetType=stock-total)의 응답으로만 받는다 — 호출 조건·응답 해석·GA 구간도 여기서 정한다.
import type { Stock } from "@/types/asset";
import { inheritedPreds, resolveRow, type ApplyResult, type ResyncSelection } from "./apply";
import type { DiffResult } from "./diff";

/** 합계 전용 호출 응답 `{ screenTotal }`의 값 */
export interface ScreenTotalInfo {
  value: number;
  label: string;
  currency: "KRW" | "USD";
}

/** 합계 전용 호출의 모드 값·제한 시간(8초에 끊는다) */
export const SCREEN_TOTAL_MODE = "stock-total";
export const SCREEN_TOTAL_TIMEOUT_MS = 8000;

/**
 * 합계 전용 호출 상태(기기 메모리).
 * none = 보내지 않음 / pending = 보냈고 아직 응답 없음 / failed = 실패·429·시간 초과 / done = 200 응답(값 또는 null)
 */
export type ScreenTotalFetch = { status: "none" } | { status: "pending" } | { status: "failed" } | { status: "done"; total: ScreenTotalInfo | null };

/**
 * 인식 실행이 끝난 시점에 합계 호출을 보낼 장의 id(없으면 null).
 * 주식 AND 올린 장이 정확히 1장 AND 그 장이 ok AND 실패 장을 지운 적 없음 AND 그 장으로 부른 적 없음(한 장당 1회).
 */
export function screenTotalTarget(input: { kind: "stock" | "crypto"; shots: { id: number; status: string }[]; failedRemoved: boolean; asked: ReadonlySet<number> }): number | null {
  if (input.kind !== "stock" || input.failedRemoved || input.shots.length !== 1) return null;
  const only = input.shots[0];
  return only.status === "ok" && !input.asked.has(only.id) ? only.id : null;
}

/** 200 응답 본문 `{ screenTotal: {value,label,currency} | null }` 해석 — 모양이 하나라도 어긋나면 null(= 총액 없음) */
export function parseScreenTotalResponse(data: unknown): ScreenTotalInfo | null {
  const t = (data as { screenTotal?: unknown } | null)?.screenTotal;
  if (!t || typeof t !== "object") return null;
  const { value, label, currency } = t as Record<string, unknown>;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (typeof label !== "string" || !label.trim()) return null;
  if (currency !== "KRW" && currency !== "USD") return null;
  return { value, label, currency };
}

/** '맞추기'를 누른 순간의 판정용 합계 — 그때 받아 둔 값만 쓴다(미도착·실패는 null → 줄 숨김) */
export const settledScreenTotal = (f: ScreenTotalFetch): ScreenTotalInfo | null => (f.status === "done" ? f.total : null);

/** 허용 오차 = max(총액 × 0.5%, 1,000원). 0.5%는 /200으로 계산해 경계(정확히 같음)가 부동소수로 어긋나지 않게 한다 */
export const reconcileTolerance = (base: number): number => Math.max(base / 200, 1000);

/**
 * 라벨 판정: '평가'가 있고 자산·예수금·예탁·추정·순·손익이 없어야 예수금이 빠진 평가 합계로 본다(`총 평가손익`은 합계가 아니다). 공백은 무시.
 * 줄바꿈이 있거나 표 머리글 낱말(현재가·매입·단가·수익)이 든 라벨은 합계 라벨이 아니다(qa D-2: `현재가\n평가금액`).
 */
export function isStockTotalLabel(label: string): boolean {
  if (/[\r\n]/.test(label.trim())) return false;
  const l = label.replace(/\s/g, "");
  if (!l.includes("평가")) return false;
  return !["자산", "예수금", "예탁", "추정", "순", "손익", "현재가", "매입", "단가", "수익"].some((w) => l.includes(w));
}

/**
 * 상식 범위 검사(qa D-2) — 화면 합계라면 같은 화면에서 읽은 행들의 평가액 합보다 뚜렷이 작을 수 없다.
 * ① 행이 2개 이상인데 합계가 어느 한 행의 평가액(±0.5%)과 같고 행 합보다 허용 오차 넘게 작다 → 종목 한 줄을 합계로 읽은 것
 * ② 합계가 행 평가액 합의 50% 미만
 * 둘 중 하나면 믿지 않는다(줄 숨김). 합계가 행 합 이상이거나 앱 합계와 허용 오차 안에서 맞는 경우는 건드리지 않는다.
 */
export function isImplausibleScreenTotal(total: number, rows: Pick<ReconcileRow, "screenValue">[]): boolean {
  const values = rows.map((r) => r.screenValue).filter((v) => v > 0);
  if (values.length === 0) return false;
  const sum = values.reduce((s, v) => s + v, 0);
  if (total < sum / 2) return true;
  return values.length >= 2 && total < sum - reconcileTolerance(sum) && values.some((v) => Math.abs(total - v) <= v / 200);
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
  // 일치가 아닐 때만: 합계 값 자체가 상식 범위를 벗어나면(종목 한 줄을 합계로 읽음 등) 틀린 '달라요'를 내지 않고 숨긴다
  if (isImplausibleScreenTotal(t.value, rows)) return { state: "hidden" };
  const off = rows
    .filter((r) => r.screenValue > 0 && Math.abs(r.appValue - r.screenValue) > reconcileTolerance(r.screenValue))
    .sort((a, b) => Math.abs(b.appValue - b.screenValue) - Math.abs(a.appValue - a.screenValue));
  return { state: "diff", ratePct: ((delta / t.value) * 100).toFixed(1), names: off.slice(0, 2).map((r) => r.name), more: Math.max(0, off.length - 2) };
}

/**
 * 화면 문장(C138) — 일치일 때만 1줄. 차이·숨김은 줄 없음(CEO 판정 '축소 후 반영': 읽은 합계가 틀릴 수 있어 '달라요'는 말하지 않는다).
 * 차이 판정 자체(reconcileTotal의 diff)와 GA `resync_check_diff` 집계는 그대로다. 금액·종목 평가액은 싣지 않는다
 */
export function reconcileLines(v: ReconcileView): string[] {
  return v.state === "match" ? ["증권사 화면 합계와 맞아요"] : [];
}

/**
 * GA 구간(적용 1회당 1개, category만). skip = 합계 호출을 보냈으나 값을 받지 못했다(실패·429·시간 초과·미도착) —
 * 서버 사정이 `none`(총액 없음·숨김 조건) 비율에 섞이지 않게 따로 센다.
 */
export const reconcileGaCategory = (
  v: ReconcileView,
  fetchStatus: ScreenTotalFetch["status"] = "done",
): "resync_check_match" | "resync_check_diff" | "resync_check_none" | "resync_check_skip" =>
  fetchStatus === "pending" || fetchStatus === "failed"
    ? "resync_check_skip"
    : v.state === "match" ? "resync_check_match" : v.state === "diff" ? "resync_check_diff" : "resync_check_none";

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
