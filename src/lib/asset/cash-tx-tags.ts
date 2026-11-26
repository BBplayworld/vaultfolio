/**
 * asset/cash-tx-tags.ts
 * 받은 배당 기록(#329, 5.166) — 현금 입출금 거래에 붙이는 분류 표시의 분리 저장 키(#239 이름표 방식).
 *  - 키: `secretasset.cash_tx_tags`(점 구분 — clearAssetData의 `secretasset_` 접두 삭제에 걸리지 않는다. 구버전으로 롤백해도 남는다)
 *  - 형태: `{ v:1, [현금 거래 id]: { kind:"dividend", ticker?, stockName? } }`. 동기화·백업 payload에는 최상위 `cashTxTags`로 실린다(E2EE 안)
 *  - **금액·날짜·수량을 넣지 않는다.** 정본은 현금 거래 레코드 1곳이고 이 맵은 분류만 더한다(현금 거래 레코드·스키마·enum 변경 0)
 *  - 마이그레이션 코드 없음: 키 없음 = 빈 맵, 기존 레코드 재작성 0. 이전 버전 데이터 복원은 data-safety-5166.test.ts T1·T2가 고정한다
 *  - 전역 `localStorage`로만 읽고 쓴다. 모듈 캐시 금지(체험 모드는 저장소 자체를 메모리로 바꿔 격리한다)
 *  - 유효성 = 살아 있는 현금 거래 id와의 조인. 읽기·합계·배지·내보내기·재-push 비교는 모두 조인 뒤 값을 쓴다.
 *    거래가 사라진 항목(고아)은 저장소에 남기고 무시한다 — 덮임 되돌리기(#84)가 같은 id로 거래를 되살리면 표시도 돌아온다
 *  - 지우는 곳: 거래 삭제 2곳·계좌 삭제 1곳(항목 제거), 모든 데이터 삭제·`?demo=empty`·공유 링크 반영·데모 주입(키 clear). 그 밖에서는 지우지 않는다
 *  - 항목은 불변(현금 거래에 수정 기능이 없다) → 병합 = id 합집합. 같은 id가 다르면 동률 규칙(직렬화가 무거운 쪽)으로 어느 기기에서 합쳐도 같다
 *  - 관대 읽기: 항목 단위로 건너뛰고 모르는 필드는 보존한다. id는 `ctx_` 접두만 받는다(`__proto__`·`constructor` 차단).
 *    모르는 kind(다음 버전이 더한 분류)는 화면에 쓰지 않지만 저장·병합·내보내기에서 그대로 싣는다
 *  - 모르는 `v`·손상 원문: 읽기는 빈 상태. 수신·병합·삭제 같은 자동 경로는 원문을 덮지 않는다. 사용자가 배당 입금을 직접 저장할 때만 새 값으로 교체한다
 */

import { STORAGE_KEYS } from "@/lib/local-storage";

export interface CashTxTag {
  /** 분류 — 이 버전이 쓰는 값은 "dividend" 하나 */
  kind: string;
  /** 고른 종목의 티커(Stock.id가 아니다 — 종목을 지워도 남는다) */
  ticker?: string;
  /** 고른 순간의 종목명 */
  stockName?: string;
  [future: string]: unknown;
}

/** 배당 표시 — 화면이 쓰는 모양 */
export interface DividendTag { kind: "dividend"; ticker?: string; stockName?: string }

/** 배당 입금 저장 요청 — 폼이 컨텍스트 저장 함수에 넘긴다(금액·날짜 없음) */
export interface CashTxDividendInput { stock?: { ticker?: string; name?: string } }

export interface CashTxTags {
  /** 현금 거래 id → 항목 */
  items: Record<string, CashTxTag>;
  /** 최상위 모르는 필드(다음 버전이 더한 값) */
  extras: Record<string, unknown>;
}

export const CASH_TX_TAG_LIMIT = { item: 512, top: 4096, text: 80 } as const;
// 현금 거래 id — `ctx_<시각>_<난수>`(연결 기록 id도 같은 접두). 접두가 고정이라 위험 키(__proto__ 등)는 통과하지 못한다
const TX_ID = /^ctx_[A-Za-z0-9_.:-]{1,80}$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ITEM_KNOWN = ["kind", "ticker", "stockName"];

export const isCashTxTagId = (id: string): boolean => TX_ID.test(id);
export const emptyCashTxTags = (): CashTxTags => ({ items: {}, extras: {} });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 && t.length <= CASH_TX_TAG_LIMIT.text ? t : undefined;
};

/** 항목 1개 읽기 — kind가 문자열이 아니면 그 항목만 뺀다. 틀린 타입의 ticker·stockName은 그 필드만 뺀다 */
function parseItem(value: unknown): CashTxTag | null {
  if (!isObj(value)) return null;
  const kind = text(value.kind);
  if (!kind || kind.length > 24) return null;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (ITEM_KNOWN.includes(k) || UNSAFE_KEYS.has(k) || v === undefined) continue;
    extras[k] = v;
  }
  const ticker = text(value.ticker);
  const stockName = text(value.stockName);
  const keep = Object.keys(extras).length > 0 && JSON.stringify(extras).length <= CASH_TX_TAG_LIMIT.item ? extras : {};
  return { ...keep, kind, ...(ticker ? { ticker } : {}), ...(stockName ? { stockName } : {}) };
}

/** 완화 파싱 — 객체가 아니거나 `v`가 1이 아니면 null(= 손상·더 새 형식). 항목은 하나씩 검사해 잘못된 것만 뺀다 */
export function parseCashTxTags(value: unknown): CashTxTags | null {
  if (!isObj(value) || value.v !== 1) return null;
  const items: Record<string, CashTxTag> = {};
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "v" || UNSAFE_KEYS.has(k) || v === undefined) continue;
    if (k.startsWith("ctx_")) {
      const item = TX_ID.test(k) ? parseItem(v) : null;
      if (item) items[k] = item;
      continue;
    }
    extras[k] = v;
  }
  const keep = Object.keys(extras).length > 0 && JSON.stringify(extras).length <= CASH_TX_TAG_LIMIT.top ? extras : {};
  return { items, extras: keep };
}

/** 저장·payload 모양으로 — `{ v:1, ...모르는 필드, [id]: 항목 }` */
export function serializeCashTxTags(tags: CashTxTags): Record<string, unknown> {
  const out: Record<string, unknown> = { v: 1 };
  for (const k of Object.keys(tags.extras).sort()) out[k] = tags.extras[k];
  for (const k of Object.keys(tags.items).sort()) out[k] = tags.items[k];
  return out;
}

export type CashTxTagsRead =
  | { state: "none"; value: null }
  | { state: "ok"; value: CashTxTags }
  | { state: "corrupt"; value: null };

/** 저장소 상태 읽기 — 키 없음 / 정상 / 손상(모르는 v 포함)을 구분한다 */
export function readCashTxTagsState(): CashTxTagsRead {
  if (typeof window === "undefined") return { state: "none", value: null };
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.cashTxTags);
  } catch {
    return { state: "none", value: null };
  }
  if (raw === null) return { state: "none", value: null };
  try {
    const parsed = parseCashTxTags(JSON.parse(raw));
    return parsed ? { state: "ok", value: parsed } : { state: "corrupt", value: null };
  } catch {
    return { state: "corrupt", value: null };
  }
}

/** 쓰기. 실패 시 throw */
export function writeCashTxTags(tags: CashTxTags): void {
  localStorage.setItem(STORAGE_KEYS.cashTxTags, JSON.stringify(serializeCashTxTags(tags)));
}

/** 명시 삭제 — 모든 데이터 삭제·`?demo=empty`·공유 링크 반영·데모 주입 전용 */
export function clearCashTxTags(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.cashTxTags);
  } catch { /* 무시 */ }
}

// ─── 조인 ────────────────────────────────────────────────────────────────

type LiveIds = ReadonlySet<string> | readonly { id: string }[];
const idSet = (live: LiveIds): ReadonlySet<string> => (live instanceof Set ? live : new Set((live as readonly { id: string }[]).map((t) => t.id)));

/** 살아 있는 현금 거래 id와 조인 — 거래가 없는 항목(고아)을 뺀 사본. 저장소는 바꾸지 않는다 */
export function joinCashTxTags(tags: CashTxTags, live: LiveIds): CashTxTags {
  const ids = idSet(live);
  const items: Record<string, CashTxTag> = {};
  for (const [id, item] of Object.entries(tags.items)) if (ids.has(id)) items[id] = item;
  return { items, extras: tags.extras };
}

/** 화면용 — 살아 있는 거래에 붙은 배당 표시만(id → 표시). 키 없음·손상·모르는 kind는 빈 결과 */
export function readDividendTags(live: LiveIds): Record<string, DividendTag> {
  const r = readCashTxTagsState();
  if (r.state !== "ok") return {};
  const out: Record<string, DividendTag> = {};
  for (const [id, item] of Object.entries(joinCashTxTags(r.value, live).items)) {
    if (item.kind !== "dividend") continue;
    out[id] = { kind: "dividend", ...(item.ticker ? { ticker: item.ticker } : {}), ...(item.stockName ? { stockName: item.stockName } : {}) };
  }
  return out;
}

/** 내보내기용(동기화 push·백업 공용) — 조인 뒤 값. 키 없음·손상이거나 실을 것이 없으면 undefined(필드를 넣지 않는다) */
export function readCashTxTagsForExport(live: LiveIds): Record<string, unknown> | undefined {
  const r = readCashTxTagsState();
  if (r.state !== "ok") return undefined;
  const joined = joinCashTxTags(r.value, live);
  if (Object.keys(joined.items).length === 0 && Object.keys(joined.extras).length === 0) return undefined;
  return serializeCashTxTags(joined);
}

// ─── 병합 ────────────────────────────────────────────────────────────────

// 키를 정렬한 재귀 직렬화 — 두 기기가 같은 값을 같은 문자열로 비교한다
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 동률 규칙 — 직렬화가 긴 쪽, 길이도 같으면 문자열이 큰 쪽(어느 기기에서 합쳐도 같은 결과) */
function heavier<T>(a: T, b: T): T {
  const ka = canon(a);
  const kb = canon(b);
  if (ka.length !== kb.length) return ka.length > kb.length ? a : b;
  return ka >= kb ? a : b;
}

function unionBy<T>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    out[k] = k in a && k in b ? heavier(a[k], b[k]) : (k in a ? a[k] : b[k]);
  }
  return out;
}

/** id 합집합 병합 — 삭제 표식이 없다(삭제는 거래 쪽에서 일어나고 조인이 가린다). 교환·결합·멱등이 성립한다 */
export function mergeCashTxTags(a: CashTxTags, b: CashTxTags): CashTxTags {
  return { items: unionBy(a.items, b.items), extras: unionBy(a.extras, b.extras) };
}

export function sameCashTxTags(a: CashTxTags, b: CashTxTags): boolean {
  return canon(serializeCashTxTags(a)) === canon(serializeCashTxTags(b));
}

// ─── 편집 ────────────────────────────────────────────────────────────────

/**
 * 배당 표시 쓰기 — 현금 거래를 저장하기 **전에** 부른다(맵 먼저 → 거래 저장). 실패 시 throw(호출측이 저장을 중단한다).
 * 사용자가 직접 누른 저장이라, 저장소 원문이 손상이면 새 값으로 교체한다.
 * 종목은 티커 + 그때 종목명만 받는다. 금액·날짜는 인자로 받지 않는다(맵에 넣을 길이 없다).
 */
export function putDividendTag(txId: string, stock?: { ticker?: string; name?: string }): void {
  if (!isCashTxTagId(txId)) throw new Error("invalid cash tx id");
  const cur = readCashTxTagsState().value ?? emptyCashTxTags();
  const ticker = text(stock?.ticker);
  const stockName = text(stock?.name);
  const item: CashTxTag = { kind: "dividend", ...(ticker ? { ticker } : {}), ...(stockName ? { stockName } : {}) };
  writeCashTxTags({ ...cur, items: { ...cur.items, [txId]: item } });
}

/**
 * 항목 제거 — 거래 삭제 2곳·계좌 삭제 1곳·거래 저장 실패 회수 전용. 지울 것이 없으면 쓰지 않는다.
 * 손상 원문은 덮지 않는다(쓰기 0). 실패해도 throw하지 않는다(거래 삭제는 이미 끝났고 남은 항목은 조인이 가린다).
 */
export function removeCashTxTags(txIds: readonly string[]): void {
  try {
    const r = readCashTxTagsState();
    if (r.state !== "ok") return;
    const hit = txIds.filter((id) => Object.prototype.hasOwnProperty.call(r.value.items, id));
    if (hit.length === 0) return;
    const items = { ...r.value.items };
    for (const id of hit) delete items[id];
    writeCashTxTags({ ...r.value, items });
  } catch { /* 무시 */ }
}

// ─── 수신 처리(가져오기·동기화) ──────────────────────────────────────────

/**
 * payload 최상위 `cashTxTags` 반영. asset-storage.applyImportedPayload 전용 — **saveAssetData 뒤에** 부른다(조인 기준 = 방금 저장한 거래).
 *  - 필드 없음(구버전 기기 push·구 백업): 로컬을 손대지 않는다. 동기화 pull이고 살아 있는 로컬 항목이 있으면 repush
 *  - 못 읽는 수신(`v:2` 등): 덮지 않는다, repush false
 *  - 읽히는 수신: 로컬 ∪ 수신(id 합집합)을 쓴다. 로컬 원문이 손상이면 동기화 pull은 쓰지 않고, 파일 가져오기(사용자 복원)만 수신값으로 교체한다
 * @returns repush — 조인 뒤 병합 결과가 조인 뒤 수신값과 다를 때만 true. 고아 차이만으로는 true가 되지 않는다(재-push 반복 방지)
 */
export function applyIncomingCashTxTags(field: unknown, { merge, live }: { merge: boolean; live: LiveIds }): { repush: boolean } {
  const ids = idSet(live);
  const local = readCashTxTagsState();
  if (field === undefined) {
    if (!merge || local.state !== "ok") return { repush: false };
    return { repush: Object.keys(joinCashTxTags(local.value, ids).items).length > 0 };
  }
  const incoming = parseCashTxTags(field);
  if (!incoming) return { repush: false };
  if (local.state === "corrupt") {
    if (!merge) writeCashTxTags(incoming);
    return { repush: false };
  }
  const merged = local.value ? mergeCashTxTags(local.value, incoming) : incoming;
  if (!local.value || !sameCashTxTags(merged, local.value)) writeCashTxTags(merged);
  return { repush: merge && !sameCashTxTags(joinCashTxTags(merged, ids), joinCashTxTags(incoming, ids)) };
}
