/**
 * asset/stock-labels.ts
 * 내 자산 불리기(#239, 5.125) — 주식 종목 이름표·점검 기록의 분리 저장 키.
 *  - 키: `secretasset.stock_labels`(점 구분 — clearAssetData의 `secretasset_` 접두 삭제에 걸리지 않는다, 실물 자산 #58 선례)
 *  - 전역 `localStorage`로만 읽고 쓴다. 모듈 캐시·IndexedDB 금지(체험 모드는 저장소 자체를 메모리로 바꿔 격리한다)
 *  - 저장하는 것: 이름표 종류, 붙인 시각, 점검한 시각, 점검 주기, 정한 날의 기준값 base(수량·주당 시세·비중),
 *    점검할 항목의 다시 볼 조건 plan(하한·상한·기간·메모 40자, 5.125 5차), 최상위 점검 기록 reviews(5.125 4차).
 *    평가금액·매입단가는 저장하지 않는다. 수량·메모가 들어가므로 이 키는 사용자 자산 데이터다(백업·E2EE 동기화로만 나간다)
 *  - 메모는 점검 한 장 밖으로 복사하지 않는다(카드 문장·허브·새 소식·reviews·GA 0). 읽을 때도 제어문자 제거·40자 절단
 *  - 모르는 필드 보존: 다음 버전이 더한 필드를 이 버전이 지우지 않는다(최상위·cycle·항목·base 4곳, 크기 상한 있음).
 *    계약 — 항목 안의 미래 필드는 '그 이름표 결정에 딸린 값'이다. 이름표를 바꿔도 남아야 하는 값은 최상위에 둔다
 *  - 삭제 표식: '정하지 않음'으로 되돌려도 항목을 지우지 않고 `label: null` + `at` 갱신(병합에서 예전 이름표가 되살아나지 않게)
 *  - 손상 값: 읽기는 빈 상태. 읽기·병합·내보내기 같은 자동 경로는 원문을 덮어쓰지 않는다. 사용자가 직접 저장할 때만 새 값으로 교체한다
 */

import { STORAGE_KEYS } from "@/lib/local-storage";

export type StockLabelKind = "keep" | "check";
export type StockLabelCycleMonths = 3 | 6 | 12;
export const STOCK_LABEL_CYCLES: readonly StockLabelCycleMonths[] = [3, 6, 12];

/** 정한 날의 기준값 — labeledAt이 새로 쓰일 때만 함께 쓴다. 화면에는 수량만 쓰고 시세·비중은 저장만 한다(v1) */
export interface StockLabelBase {
  /** 그 이름표 키를 쓰는 모든 보유 건의 수량 합(반올림 없음) */
  qty: number;
  /** 주당 시세 — 종목 통화 그대로(원화 환산 아님) */
  price?: number;
  /** 그 시세의 기준일 */
  priceAt?: string;
  /** 내 주식 안 비중(%) — 행 비중과 같은 분모 */
  weight?: number;
  [future: string]: unknown;
}

/** 다시 볼 조건 — '점검할' 결정에 딸린 값(이름표를 바꾸면 함께 사라진다). 모든 값은 사용자가 비운 칸에 직접 넣는다 */
export interface StockLabelPlan {
  /** 산 날부터 −down% 이하에 닿으면 점검 차례(1~90 정수) */
  down?: number;
  /** 산 날부터 +up% 이상에 닿으면 점검 차례(1~500 정수) */
  up?: number;
  /** 기간 — 비우면 점검할 기본 주기 */
  months?: StockLabelCycleMonths;
  /** 메모 40자 한 줄(제어문자 없음). 점검 한 장 안에서만 보인다 */
  memo?: string;
  /** 조건을 마지막으로 바꾼 시각 */
  at?: string;
  [future: string]: unknown;
}

export type StockReviewChoice = "same" | "keep" | "check" | "none";

/** 점검 기록 1건 — id는 저장하지 않고 `t@at`로 만든다. 손익·수량·점수는 저장하지 않는다(화면에 쓰지 않는 값 0) */
export interface StockLabelReview {
  /** 이름표 키(normalizeTicker) */
  t: string;
  at: string;
  /** 그때의 이름표 */
  from: StockLabelKind;
  /** same = 그대로 둠, 그 밖 = 옮긴 곳(none = 정하지 않음) */
  choice: StockReviewChoice;
  /** 그때 주당 시세(종목 통화, 양수) */
  price: number;
  /** 그때 산 날부터 %(소수 1자리) */
  rate: number;
  [future: string]: unknown;
}

export interface StockLabelItem {
  /** null = 사용자가 '정하지 않음'으로 되돌린 삭제 표식 */
  label: StockLabelKind | null;
  /** 지금 이름표를 붙인 시각 */
  labeledAt: string;
  /** 마지막으로 '오늘 점검했어요'를 누른 시각 */
  checkedAt?: string;
  /** 정한 날의 기준값. 없는 항목도 정상 항목이다(수량 비교만 생략) */
  base?: StockLabelBase;
  /** 다시 볼 조건 — label이 check일 때만 읽는다 */
  plan?: StockLabelPlan;
  /** 이 항목을 마지막으로 바꾼 시각 — 병합 기준 */
  at: string;
  [future: string]: unknown;
}

export interface StockLabels {
  v: 1;
  cycle: { months: StockLabelCycleMonths | null; at: string; [future: string]: unknown };
  items: Record<string, StockLabelItem>;
  /** 점검 기록 — 비면 키를 쓰지 않는다(이력 없는 값이 cb36907과 바이트가 같게). 정렬·티커당 12건으로 정규화된 값 */
  reviews?: StockLabelReview[];
  [future: string]: unknown;
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

// ─── 모르는 필드 보존 ────────────────────────────────────────────────────
// 직렬화 길이 상한 — 넘으면 그 객체의 모르는 필드를 전부 버린다(일부만 남기지 않는다)
export const STOCK_LABEL_EXTRA_LIMIT = { item: 2048, cycle: 8192, top: 8192, review: 256 } as const;
/** 티커당 남기는 점검 기록 수(3개월 주기로 3년) */
export const STOCK_REVIEW_LIMIT = 12;
/** 메모 최대 글자 수 */
export const STOCK_PLAN_MEMO_MAX = 40;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** 아는 필드와 위험 키를 뺀 나머지 */
function extrasOf(raw: Record<string, unknown>, known: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (known.includes(k) || UNSAFE_KEYS.has(k) || v === undefined) continue;
    out[k] = v;
  }
  return out;
}
const sizeOf = (extras: Record<string, unknown>) => (Object.keys(extras).length === 0 ? 0 : JSON.stringify(extras).length);
const within = (extras: Record<string, unknown>, limit: number) => (sizeOf(extras) <= limit ? extras : {});

const ITEM_KNOWN = ["label", "labeledAt", "checkedAt", "base", "plan", "at"] as const;
const BASE_KNOWN = ["qty", "price", "priceAt", "weight"] as const;
const PLAN_KNOWN = ["down", "up", "months", "memo", "at"] as const;
const REVIEW_KNOWN = ["t", "at", "from", "choice", "price", "rate"] as const;
const TOP_KNOWN = ["v", "cycle", "items", "reviews"] as const;
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** base 읽기 — qty가 유한한 양수가 아니면 base 전체를 없는 것으로 본다. 나머지 필드는 틀린 것만 뺀다 */
function parseBase(value: unknown): { base: StockLabelBase; extras: Record<string, unknown> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (!positive(b.qty)) return null;
  const weightOk = typeof b.weight === "number" && Number.isFinite(b.weight) && b.weight >= 0 && b.weight <= 100;
  return {
    base: {
      qty: b.qty,
      ...(positive(b.price) ? { price: b.price } : {}),
      ...(stockLabelTime(b.priceAt) !== null ? { priceAt: b.priceAt as string } : {}),
      ...(weightOk ? { weight: b.weight as number } : {}),
    },
    extras: extrasOf(b, BASE_KNOWN),
  };
}

// 제어문자(C0·C1)와 방향 제어 문자 — 메모 한 줄을 화면 그대로 글자로만 그리게
const isMemoStrip = (c: number) =>
  c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x200e || c === 0x200f || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);

/** 메모 정리 — 문자열이 아니면 undefined. 제어문자를 지우고 앞뒤 공백을 걷은 뒤 40자(코드 포인트)로 자른다. 비면 undefined */
export function cleanPlanMemo(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const kept = Array.from(value).filter((ch) => !isMemoStrip(ch.codePointAt(0)!)).join("").trim();
  const text = Array.from(kept).slice(0, STOCK_PLAN_MEMO_MAX).join("").trim();
  return text.length > 0 ? text : undefined;
}

const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
/** 조건 숫자 범위(redesign 5-3) */
export const STOCK_PLAN_RANGE = { down: [1, 90], up: [1, 500] } as const;

/** plan 읽기 — 틀린 필드만 뺀다. 아는 필드가 하나도 남지 않으면 null(plan 없음) */
export function parsePlan(value: unknown): { plan: StockLabelPlan; extras: Record<string, unknown> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const memo = cleanPlanMemo(p.memo);
  const plan: StockLabelPlan = {
    ...(intIn(p.down, ...STOCK_PLAN_RANGE.down) ? { down: p.down } : {}),
    ...(intIn(p.up, ...STOCK_PLAN_RANGE.up) ? { up: p.up } : {}),
    ...(isCycleMonths(p.months) ? { months: p.months } : {}),
    ...(memo !== undefined ? { memo } : {}),
  };
  if (Object.keys(plan).length === 0) return null;
  if (stockLabelTime(p.at) !== null) plan.at = p.at as string;
  return { plan, extras: extrasOf(p, PLAN_KNOWN) };
}

const REVIEW_FROM = new Set(["keep", "check"]);
const REVIEW_CHOICE = new Set(["same", "keep", "check", "none"]);
/** 기록 키 — 저장하지 않고 만든다 */
export const reviewKey = (r: { t: string; at: string }): string => `${r.t}@${r.at}`;

/** 기록 1건 읽기 — 하나라도 틀리면 그 건만 뺀다. 모르는 필드는 256B 안에서 보존 */
function parseReview(value: unknown): StockLabelReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.t !== "string" || !TICKER_KEY.test(r.t)) return null;
  if (stockLabelTime(r.at) === null) return null;
  if (typeof r.from !== "string" || !REVIEW_FROM.has(r.from)) return null;
  if (typeof r.choice !== "string" || !REVIEW_CHOICE.has(r.choice)) return null;
  if (!positive(r.price)) return null;
  if (typeof r.rate !== "number" || !Number.isFinite(r.rate)) return null;
  return {
    ...within(extrasOf(r, REVIEW_KNOWN), STOCK_LABEL_EXTRA_LIMIT.review),
    t: r.t, at: r.at as string, from: r.from as StockLabelKind, choice: r.choice as StockReviewChoice, price: r.price, rate: r.rate,
  };
}

/**
 * 기록 정규화 — 같은 키는 동률 규칙으로 하나, 정렬은 t 오름차순 → at 최신 먼저 → 키 문자열, 티커당 최신 12건.
 * 전순서라 top12(top12(A) ∪ top12(B)) = top12(A ∪ B) — 병합의 교환·결합·멱등이 성립한다.
 */
export function normalizeReviews(list: readonly StockLabelReview[]): StockLabelReview[] {
  const byKey = new Map<string, StockLabelReview>();
  for (const r of list) {
    const k = reviewKey(r);
    const prev = byKey.get(k);
    byKey.set(k, prev ? heavier(prev, r) : r);
  }
  const sorted = [...byKey.values()].sort((a, b) => {
    if (a.t !== b.t) return a.t < b.t ? -1 : 1;
    const ta = stockLabelTime(a.at)!;
    const tb = stockLabelTime(b.at)!;
    if (ta !== tb) return tb - ta;
    const ka = reviewKey(a);
    const kb = reviewKey(b);
    return ka === kb ? 0 : ka < kb ? -1 : 1;
  });
  const out: StockLabelReview[] = [];
  const seen = new Map<string, number>();
  for (const r of sorted) {
    const n = seen.get(r.t) ?? 0;
    if (n >= STOCK_REVIEW_LIMIT) continue;
    seen.set(r.t, n + 1);
    out.push(r);
  }
  return out;
}

/** 최상위 reviews 읽기 — 배열이 아니면 빈 목록 */
function parseReviews(value: unknown): StockLabelReview[] {
  if (!Array.isArray(value)) return [];
  return normalizeReviews(value.map(parseReview).filter((r): r is StockLabelReview => r !== null));
}

/**
 * 완화 파싱 — 전체 형태(v·items)가 맞지 않으면 null(= 없음·손상), 항목은 하나씩 검사해 잘못된 것만 뺀다.
 * 아는 필드는 검사한 값으로 쓰고, 모르는 필드는 버리지 않고 그대로 싣는다(크기 상한 안에서).
 */
export function parseStockLabels(value: unknown): StockLabels | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (!raw.items || typeof raw.items !== "object" || Array.isArray(raw.items)) return null;

  const items: Record<string, StockLabelItem> = {};
  for (const [ticker, entry] of Object.entries(raw.items as Record<string, unknown>)) {
    if (!TICKER_KEY.test(ticker)) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    if (e.label !== "keep" && e.label !== "check" && e.label !== null) continue;
    if (stockLabelTime(e.at) === null || stockLabelTime(e.labeledAt) === null) continue;
    const parsedBase = parseBase(e.base);
    // plan은 '점검할'에만 뜻이 있다 — 다른 이름표의 plan(손상 값)은 읽지 않는다(5-5)
    const parsedPlan = e.label === "check" ? parsePlan(e.plan) : null;
    let itemExtras = extrasOf(e, ITEM_KNOWN);
    let baseExtras = parsedBase?.extras ?? {};
    let planExtras = parsedPlan?.extras ?? {};
    // 상한은 항목 1개 기준(base·plan 안 포함)
    if (sizeOf(itemExtras) + sizeOf(baseExtras) + sizeOf(planExtras) > STOCK_LABEL_EXTRA_LIMIT.item) { itemExtras = {}; baseExtras = {}; planExtras = {}; }
    items[ticker] = {
      ...itemExtras,
      label: e.label,
      labeledAt: e.labeledAt as string,
      ...(stockLabelTime(e.checkedAt) !== null ? { checkedAt: e.checkedAt as string } : {}),
      ...(parsedBase ? { base: { ...baseExtras, ...parsedBase.base } } : {}),
      ...(parsedPlan ? { plan: { ...planExtras, ...parsedPlan.plan } } : {}),
      at: e.at as string,
    };
  }
  const reviews = parseReviews(raw.reviews);

  const c = raw.cycle && typeof raw.cycle === "object" && !Array.isArray(raw.cycle) ? (raw.cycle as Record<string, unknown>) : null;
  const cycleExtras = c ? within(extrasOf(c, ["months", "at"]), STOCK_LABEL_EXTRA_LIMIT.cycle) : {};
  const cycle = c && isCycleMonths(c.months) && stockLabelTime(c.at) !== null
    ? { ...cycleExtras, months: c.months, at: c.at as string }
    : { ...cycleExtras, months: null, at: "" };
  return { ...within(extrasOf(raw, TOP_KNOWN), STOCK_LABEL_EXTRA_LIMIT.top), v: 1, cycle, items, ...(reviews.length > 0 ? { reviews } : {}) };
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

// 키를 정렬한 재귀 직렬화 — 두 기기가 같은 값을 같은 문자열로 비교하게 한다.
// base와 모르는 필드까지 전부 들어간다(빼면 base만 다른 값이 다른 기기로 건너가지 않는다).
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 동률 규칙 — 직렬화가 긴 쪽, 길이도 같으면 문자열이 큰 쪽(base를 가진 값이 base 없는 같은 시각 값에 지지 않는다) */
function heavier<T>(a: T, b: T): T {
  const ka = canon(a);
  const kb = canon(b);
  if (ka.length !== kb.length) return ka.length > kb.length ? a : b;
  return ka >= kb ? a : b;
}

/** `at`이 더 늦은 쪽. 같으면 동률 규칙(어느 기기에서 합쳐도 같은 결과) */
function newer<T extends { at: string }>(a: T, b: T): T {
  const ta = stockLabelTime(a.at) ?? -Infinity;
  const tb = stockLabelTime(b.at) ?? -Infinity;
  if (ta !== tb) return ta > tb ? a : b;
  return heavier(a, b);
}

const topExtras = (v: StockLabels) => extrasOf(v, TOP_KNOWN);

/**
 * 티커별 `at` 최신 우선 병합(동기화 pull 전용). `label: null` 표식도 항목이라 더 새 표식이 예전 이름표를 이긴다.
 * 이긴 항목이 base·모르는 필드를 통째로 가져오고 진 쪽 값은 섞이지 않는다. `cycle`도 `at` 최신 우선.
 * 최상위 모르는 필드는 키별 합집합(같은 키가 다르면 동률 규칙). 교환법칙이 성립한다.
 * 점검 기록(reviews)은 items 승패와 무관하게 `t@at` 합집합 → 정규화(티커당 최신 12건). 이름표가 지거나 바뀌어도 이력은 남는다.
 */
export function mergeStockLabels(a: StockLabels, b: StockLabels): StockLabels {
  const items: Record<string, StockLabelItem> = {};
  const tickers = [...new Set([...Object.keys(a.items), ...Object.keys(b.items)])].sort();
  for (const t of tickers) {
    const ia = a.items[t];
    const ib = b.items[t];
    items[t] = ia && ib ? newer(ia, ib) : (ia ?? ib);
  }
  const ea = topExtras(a);
  const eb = topExtras(b);
  const extras: Record<string, unknown> = {};
  for (const k of [...new Set([...Object.keys(ea), ...Object.keys(eb)])].sort()) {
    extras[k] = k in ea && k in eb ? heavier(ea[k], eb[k]) : (k in ea ? ea[k] : eb[k]);
  }
  const reviews = normalizeReviews([...(a.reviews ?? []), ...(b.reviews ?? [])]);
  return { ...extras, v: 1, cycle: newer(a.cycle, b.cycle), items, ...(reviews.length > 0 ? { reviews } : {}) };
}

/** 값이 같은지(키 순서 무관, base·모르는 필드 포함) — 파싱한 값끼리 비교한다 */
export function sameStockLabels(a: StockLabels, b: StockLabels): boolean {
  return canon(a) === canon(b);
}

/** 기록이 하나라도 있는지(표식 포함) — 수신에 필드가 없을 때 재-push 판정 */
export function hasStockLabelRecords(v: StockLabels): boolean {
  return Object.keys(v.items).length > 0 || v.cycle.months !== null || (v.reviews?.length ?? 0) > 0;
}

// ─── 편집(순수 함수) ─────────────────────────────────────────────────────

/** 유효 이름표 수 — `label`이 null이 아닌 항목(보유 여부 무관). GA 0→1 판정용 */
export function countValidLabels(v: StockLabels): number {
  return Object.values(v.items).filter((i) => i.label !== null).length;
}

/**
 * 이름표 붙이기·바꾸기·되돌리기. 같은 값이면 그대로 돌려준다.
 * 값을 새로 정하는 편집이라 그 항목의 예전 base와 모르는 필드는 버린다(새 결정에 뜻 모르는 옛 값을 붙이지 않는다).
 * base는 labeledAt과 함께만 쓰인다 — '정하지 않음' 표식에는 쓰지 않는다.
 * 점검 기록(checkedAt)만은 이름표를 바꿔도 지우지 않는다(잘못 눌렀다 되돌려도 기록이 남게).
 */
export function setStockLabel(state: StockLabels, ticker: string, label: StockLabelKind | null, nowIso: string, base?: StockLabelBase): StockLabels {
  const prev = state.items[ticker];
  if (prev && prev.label === label) return state;
  const next: StockLabelItem = {
    label,
    labeledAt: nowIso,
    ...(prev?.checkedAt ? { checkedAt: prev.checkedAt } : {}),
    ...(label !== null && base && positive(base.qty) ? { base } : {}),
    at: nowIso,
  };
  return { ...state, items: { ...state.items, [ticker]: next } };
}

/**
 * 점검 시각 기록 — '오래 둘'·'점검할' 항목(5.125 4차: 오래 둘 12개월 재확인도 같은 기록). base·plan·모르는 필드는 그대로 둔다.
 * 오래 둘의 checkedAt은 12개월 재확인 기준일로만 쓴다(사용자 주기·점검할 차례에는 들어가지 않는다)
 */
export function markStockChecked(state: StockLabels, ticker: string, nowIso: string): StockLabels {
  const prev = state.items[ticker];
  if (!prev || prev.label === null) return state;
  return { ...state, items: { ...state.items, [ticker]: { ...prev, checkedAt: nowIso, at: nowIso } } };
}

/** 점검 주기 고르기(해제 없음, v1). 값을 새로 정하므로 cycle의 모르는 필드는 버린다 */
export function setStockLabelCycle(state: StockLabels, months: StockLabelCycleMonths, nowIso: string): StockLabels {
  if (state.cycle.months === months) return state;
  return { ...state, cycle: { months, at: nowIso } };
}

/** plan 정리 — 범위 밖 숫자·빈 메모를 뺀 값. 남는 것이 없으면 null */
export function cleanStockPlan(plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">): Omit<StockLabelPlan, "at"> | null {
  const parsed = parsePlan({ down: plan.down, up: plan.up, months: plan.months, memo: plan.memo });
  return parsed ? parsed.plan : null;
}

/**
 * 다시 볼 조건 쓰기 — '점검할' 항목에만. 조건·메모가 모두 비면 plan 키를 지운다. item.at = now(병합에서 항목과 함께 움직인다).
 * 값이 같으면 그대로 돌려준다.
 */
export function setStockPlan(state: StockLabels, ticker: string, plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">, nowIso: string): StockLabels {
  const prev = state.items[ticker];
  if (!prev || prev.label !== "check") return state;
  const next = cleanStockPlan(plan);
  const cur = prev.plan ? cleanStockPlan(prev.plan) : null;
  if (canon(next) === canon(cur)) return state;
  const { plan: _old, ...rest } = prev;
  const item: StockLabelItem = { ...rest, ...(next ? { plan: { ...next, at: nowIso } } : {}), at: nowIso };
  return { ...state, items: { ...state.items, [ticker]: item } };
}

/** 같은 티커의 마지막 '그대로 둠' 기록 — 차례 기준일·'점검 뒤' 가격에 쓴다. after가 있으면 그 시각 이후만 */
export function lastSameReview(v: StockLabels, ticker: string, after?: string): StockLabelReview | null {
  const floor = stockLabelTime(after) ?? -Infinity;
  // 정규화된 목록은 티커 안에서 최신 먼저
  return (v.reviews ?? []).find((r) => r.t === ticker && r.choice === "same" && stockLabelTime(r.at)! >= floor) ?? null;
}

/** 한 티커의 기록(최신 먼저) */
export const reviewsOf = (v: StockLabels, ticker: string): StockLabelReview[] => (v.reviews ?? []).filter((r) => r.t === ticker);

/**
 * 점검 한 장의 선택을 한 번에 기록한다(쓰기 1회 = 이 함수의 결과 1개).
 *  - same: 오래 둘·점검할 항목만. checkedAt = at = now, 기록 {from: label, choice: same}. base·plan은 그대로
 *  - keep·check·none이고 지금 이름표와 다를 때: setStockLabel과 같은 항목 교체(새 labeledAt·base) + 기록 {from, choice}.
 *    이 경로에서는 checkedAt을 지운다(이름표를 바꾸면 점검이 새로 시작한다, cto 6-②). plan도 함께 사라진다
 *  - 지금 이름표가 없거나 label:null에서 처음 정할 때: setStockLabel만(첫 결정은 기록하지 않는다)
 *  - snap(그때 시세·산 날부터 %)이 없으면 기록 없이 이름표·점검 시각만 바꾼다
 * 기록을 더한 뒤 그 티커를 다시 12건으로 자른다.
 */
export function recordReview(
  state: StockLabels,
  ticker: string,
  choice: StockReviewChoice,
  nowIso: string,
  snap: { price: number; rate: number } | null,
  base?: StockLabelBase,
): StockLabels {
  const prev = state.items[ticker];
  const from = prev?.label ?? null;
  let next: StockLabels;
  if (choice === "same") {
    if (from === null) return state;
    next = markStockChecked(state, ticker, nowIso);
  } else {
    const label = choice === "none" ? null : choice;
    if (from === label) return state;
    next = setStockLabel(state, ticker, label, nowIso, base);
    if (from === null) return next; // 첫 결정
    const { checkedAt: _c, ...item } = next.items[ticker];
    next = { ...next, items: { ...next.items, [ticker]: item } };
  }
  if (from === null || !snap || !positive(snap.price) || !Number.isFinite(snap.rate)) return next;
  const review: StockLabelReview = { t: ticker, at: nowIso, from, choice, price: snap.price, rate: Math.round(snap.rate * 10) / 10 };
  return { ...next, reviews: normalizeReviews([...(next.reviews ?? []), review]) };
}

const KST_DAY = (ms: number) => Math.floor((ms + 9 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));

/**
 * '다시 봄' 판정(GA 보조 지표) — 유효 이름표가 1개 이상이고 가장 이른 labeledAt의 날짜(KST)가 오늘보다 앞이면 true.
 * 화면을 연 시점의 저장소 값으로만 본다(새 저장 키·플래그 없음).
 */
export function isStockLabelRevisit(v: StockLabels, nowMs: number): boolean {
  const days = Object.values(v.items)
    .filter((i) => i.label !== null)
    .map((i) => stockLabelTime(i.labeledAt))
    .filter((ms): ms is number => ms !== null)
    .map(KST_DAY);
  return days.length > 0 && Math.min(...days) < KST_DAY(nowMs);
}

// ─── 수신 처리(가져오기·동기화) ──────────────────────────────────────────

/**
 * payload 최상위 `stockLabels` 반영. asset-storage.applyImportedPayload 전용.
 *  - 파일 가져오기·데모·체험 주입(merge=false): 필드가 있으면 교체(원문에 reviews 키가 없으면 로컬 기록 유지), 없으면 로컬을 손대지 않는다
 *  - 동기화 pull(merge=true): 티커별 병합. 로컬 원문이 손상이면 쓰지 않는다
 * @returns repush — 병합 결과가 수신값과 다르거나, 수신에 필드가 없는데 로컬 기록이 있으면 true(호출측이 다시 push)
 */
export function applyIncomingStockLabels(field: unknown, { merge }: { merge: boolean }): { repush: boolean } {
  const incoming = field === undefined ? null : parseStockLabels(field);
  if (!merge) {
    if (!incoming) return { repush: false };
    // 수신 원문에 reviews 키가 없으면(구버전 백업) items·cycle만 교체하고 이 기기의 점검 기록은 남긴다(cto 4-②)
    const hasReviewsField = !!field && typeof field === "object" && "reviews" in (field as Record<string, unknown>);
    const local = hasReviewsField ? null : readStockLabelsState();
    const keep = local?.state === "ok" ? local.value.reviews : undefined;
    writeStockLabels(keep && keep.length > 0 ? { ...incoming, reviews: keep } : incoming);
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
