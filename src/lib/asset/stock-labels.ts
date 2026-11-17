/**
 * asset/stock-labels.ts
 * 내 자산 불리기(#239, 5.125) — 주식 종목 이름표·점검 기록의 분리 저장 키.
 *  - 키: `secretasset.stock_labels`(점 구분 — clearAssetData의 `secretasset_` 접두 삭제에 걸리지 않는다, 실물 자산 #58 선례)
 *  - 전역 `localStorage`로만 읽고 쓴다. 모듈 캐시·IndexedDB 금지(체험 모드는 저장소 자체를 메모리로 바꿔 격리한다)
 *  - 저장하는 것: 이름표 종류, 붙인 시각, 점검한 시각, 점검 주기. 메모·금액·수량·비중은 저장하지 않는다
 *  - 삭제 표식: '정하지 않음'으로 되돌려도 항목을 지우지 않고 `label: null` + `at` 갱신(병합에서 예전 이름표가 되살아나지 않게)
 *  - 손상 값: 읽기는 빈 상태. 읽기·병합·내보내기 같은 자동 경로는 원문을 덮어쓰지 않는다. 사용자가 직접 저장할 때만 새 값으로 교체한다
 */

import { STORAGE_KEYS } from "@/lib/local-storage";

export type StockLabelKind = "keep" | "check";
export type StockLabelCycleMonths = 3 | 6 | 12;
export const STOCK_LABEL_CYCLES: readonly StockLabelCycleMonths[] = [3, 6, 12];

export interface StockLabelItem {
  /** null = 사용자가 '정하지 않음'으로 되돌린 삭제 표식 */
  label: StockLabelKind | null;
  /** 지금 이름표를 붙인 시각 */
  labeledAt: string;
  /** 마지막으로 '오늘 점검했어요'를 누른 시각 */
  checkedAt?: string;
  /** 이 항목을 마지막으로 바꾼 시각 — 병합 기준 */
  at: string;
}

export interface StockLabels {
  v: 1;
  cycle: { months: StockLabelCycleMonths | null; at: string };
  items: Record<string, StockLabelItem>;
}

/** 시각 문자열(ISO 또는 날짜만) → ms. 읽을 수 없으면 null */
export function stockLabelTime(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 8 || value.length > 40) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// 티커 키 — normalizeTicker 결과(영숫자로 시작, 해외는 `BRK/B`처럼 빗금 포함)만 받는다
const TICKER_KEY = /^[A-Za-z0-9][A-Za-z0-9./\-:_^=&]{0,23}$/;
/** 이름표 키로 쓸 수 있는 티커인지 — 아니면 화면에 행을 그리지 않는다(저장해도 다시 읽히지 않으므로) */
export const isStockLabelKey = (ticker: string): boolean => TICKER_KEY.test(ticker);
const isCycleMonths = (v: unknown): v is StockLabelCycleMonths => v === 3 || v === 6 || v === 12;

export function emptyStockLabels(): StockLabels {
  return { v: 1, cycle: { months: null, at: "" }, items: {} };
}

/**
 * 완화 파싱 — 전체 형태(v·items)가 맞지 않으면 null(= 없음·손상), 항목은 하나씩 검사해 잘못된 것만 뺀다.
 * 모르는 필드는 버린다(저장 형태를 이 파일이 아는 필드로 고정).
 */
export function parseStockLabels(value: unknown): StockLabels | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (!raw.items || typeof raw.items !== "object" || Array.isArray(raw.items)) return null;

  const items: Record<string, StockLabelItem> = {};
  for (const [ticker, entry] of Object.entries(raw.items as Record<string, unknown>)) {
    if (!TICKER_KEY.test(ticker)) continue;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (e.label !== "keep" && e.label !== "check" && e.label !== null) continue;
    if (stockLabelTime(e.at) === null || stockLabelTime(e.labeledAt) === null) continue;
    items[ticker] = {
      label: e.label,
      labeledAt: e.labeledAt as string,
      ...(stockLabelTime(e.checkedAt) !== null ? { checkedAt: e.checkedAt as string } : {}),
      at: e.at as string,
    };
  }

  const c = raw.cycle && typeof raw.cycle === "object" ? (raw.cycle as Record<string, unknown>) : null;
  const cycle = c && isCycleMonths(c.months) && stockLabelTime(c.at) !== null
    ? { months: c.months, at: c.at as string }
    : { months: null, at: "" };
  return { v: 1, cycle, items };
}

export type StockLabelsRead =
  | { state: "none"; value: null }
  | { state: "ok"; value: StockLabels }
  | { state: "corrupt"; value: null };

/** 저장소 상태 읽기 — 키 없음 / 정상 / 손상을 구분한다(자동 경로가 손상 원문을 덮지 않게) */
export function readStockLabelsState(): StockLabelsRead {
  if (typeof window === "undefined") return { state: "none", value: null };
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.stockLabels);
  } catch {
    return { state: "none", value: null };
  }
  if (raw === null) return { state: "none", value: null };
  try {
    const parsed = parseStockLabels(JSON.parse(raw));
    return parsed ? { state: "ok", value: parsed } : { state: "corrupt", value: null };
  } catch {
    return { state: "corrupt", value: null };
  }
}

/** 화면용 읽기 — 키 없음·손상은 빈 상태 */
export function readStockLabels(): StockLabels {
  return readStockLabelsState().value ?? emptyStockLabels();
}

/** 쓰기. 실패 시 throw */
export function writeStockLabels(value: StockLabels): void {
  localStorage.setItem(STORAGE_KEYS.stockLabels, JSON.stringify(value));
}

/** 명시 삭제 — 모든 데이터 삭제, `?demo=empty` 전용 */
export function clearStockLabels(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.stockLabels);
  } catch { /* 무시 */ }
}

// ─── 병합 ────────────────────────────────────────────────────────────────

// 키 순서를 고정한 직렬화 — 두 기기가 같은 값을 같은 문자열로 비교하게 한다
const itemKey = (i: StockLabelItem) => JSON.stringify([i.label, i.labeledAt, i.checkedAt ?? null, i.at]);
const cycleKey = (c: StockLabels["cycle"]) => JSON.stringify([c.months, c.at]);

/** `at`이 더 늦은 쪽. 같으면 직렬화 문자열이 큰 쪽(어느 기기에서 합쳐도 같은 결과) */
function newer<T>(a: T, b: T, atOf: (v: T) => string, keyOf: (v: T) => string): T {
  const ta = stockLabelTime(atOf(a)) ?? -Infinity;
  const tb = stockLabelTime(atOf(b)) ?? -Infinity;
  if (ta !== tb) return ta > tb ? a : b;
  return keyOf(a) >= keyOf(b) ? a : b;
}

/**
 * 티커별 `at` 최신 우선 병합(동기화 pull 전용). `label: null` 표식도 항목이라 더 새 표식이 예전 이름표를 이긴다.
 * `cycle`도 `at` 최신 우선. 교환법칙이 성립한다.
 */
export function mergeStockLabels(a: StockLabels, b: StockLabels): StockLabels {
  const items: Record<string, StockLabelItem> = {};
  const tickers = [...new Set([...Object.keys(a.items), ...Object.keys(b.items)])].sort();
  for (const t of tickers) {
    const ia = a.items[t];
    const ib = b.items[t];
    items[t] = ia && ib ? newer(ia, ib, (i) => i.at, itemKey) : (ia ?? ib);
  }
  return { v: 1, cycle: newer(a.cycle, b.cycle, (c) => c.at, cycleKey), items };
}

/** 값이 같은지(항목 순서 무관) */
export function sameStockLabels(a: StockLabels, b: StockLabels): boolean {
  const ka = Object.keys(a.items).sort();
  const kb = Object.keys(b.items).sort();
  if (ka.length !== kb.length || cycleKey(a.cycle) !== cycleKey(b.cycle)) return false;
  return ka.every((t, i) => t === kb[i] && itemKey(a.items[t]) === itemKey(b.items[t]));
}

/** 기록이 하나라도 있는지(표식 포함) — 수신에 필드가 없을 때 재-push 판정 */
export function hasStockLabelRecords(v: StockLabels): boolean {
  return Object.keys(v.items).length > 0 || v.cycle.months !== null;
}

// ─── 편집(순수 함수) ─────────────────────────────────────────────────────

/** 유효 이름표 수 — `label`이 null이 아닌 항목(보유 여부 무관). GA 0→1 판정용 */
export function countValidLabels(v: StockLabels): number {
  return Object.values(v.items).filter((i) => i.label !== null).length;
}

/**
 * 이름표 붙이기·바꾸기·되돌리기. 같은 값이면 그대로 돌려준다.
 * 점검 기록(checkedAt)은 이름표를 바꿔도 지우지 않는다(잘못 눌렀다 되돌려도 기록이 남게).
 */
export function setStockLabel(state: StockLabels, ticker: string, label: StockLabelKind | null, nowIso: string): StockLabels {
  const prev = state.items[ticker];
  if (prev && prev.label === label) return state;
  const next: StockLabelItem = {
    label,
    labeledAt: nowIso,
    ...(prev?.checkedAt ? { checkedAt: prev.checkedAt } : {}),
    at: nowIso,
  };
  return { ...state, items: { ...state.items, [ticker]: next } };
}

/** '오늘 점검했어요' — '점검할 자산' 항목만 */
export function markStockChecked(state: StockLabels, ticker: string, nowIso: string): StockLabels {
  const prev = state.items[ticker];
  if (!prev || prev.label !== "check") return state;
  return { ...state, items: { ...state.items, [ticker]: { ...prev, checkedAt: nowIso, at: nowIso } } };
}

/** 점검 주기 고르기(해제 없음, v1) */
export function setStockLabelCycle(state: StockLabels, months: StockLabelCycleMonths, nowIso: string): StockLabels {
  if (state.cycle.months === months) return state;
  return { ...state, cycle: { months, at: nowIso } };
}

// ─── 수신 처리(가져오기·동기화) ──────────────────────────────────────────

/**
 * payload 최상위 `stockLabels` 반영. asset-storage.applyImportedPayload 전용.
 *  - 파일 가져오기·데모·체험 주입(merge=false): 필드가 있으면 교체, 없으면 로컬을 손대지 않는다
 *  - 동기화 pull(merge=true): 티커별 병합. 로컬 원문이 손상이면 쓰지 않는다
 * @returns repush — 병합 결과가 수신값과 다르거나, 수신에 필드가 없는데 로컬 기록이 있으면 true(호출측이 다시 push)
 */
export function applyIncomingStockLabels(field: unknown, { merge }: { merge: boolean }): { repush: boolean } {
  const incoming = field === undefined ? null : parseStockLabels(field);
  if (!merge) {
    if (incoming) writeStockLabels(incoming);
    return { repush: false };
  }
  const local = readStockLabelsState();
  if (local.state === "corrupt") return { repush: false };
  if (!incoming) {
    // 필드 자체가 없을 때만(구버전 기기 push) 다시 올린다. 읽지 못한 값(더 새 형식일 수 있음)은 덮지 않는다
    return { repush: field === undefined && !!local.value && hasStockLabelRecords(local.value) };
  }
  const merged = local.value ? mergeStockLabels(local.value, incoming) : incoming;
  if (!local.value || !sameStockLabels(merged, local.value)) writeStockLabels(merged);
  return { repush: !sameStockLabels(merged, incoming) };
}

/** 내보내기용 — 정상으로 읽힐 때만 값을 돌려준다(키 없음·손상이면 필드를 넣지 않는다) */
export function readStockLabelsForExport(): StockLabels | undefined {
  const r = readStockLabelsState();
  return r.state === "ok" ? r.value : undefined;
}
