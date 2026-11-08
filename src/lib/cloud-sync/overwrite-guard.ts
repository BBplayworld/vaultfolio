/**
 * cloud-sync/overwrite-guard.ts — 동기화 pull로 내 수정이 덮였는지 감지하고 되돌리기 계획을 만든다(#4.47 #84).
 *
 * - 기준(baseline) = 이 앱 실행 안에서 마지막 push/pull 성공 시점의 사본(메모리만). 새 저장 키·sync 상태 필드·payload 변경 0.
 * - 감지·계획 함수는 순수(저장·push·notify 호출 없음). 저장은 호출측이 사용자 편집과 같은 경로로 수행한다.
 * - 기준이 없으면(앱 시작 직후 첫 pull 전) 감지하지 않는다 — 폴백 알림 없음.
 */
import type { AssetData } from "@/types/asset";

export type OverwriteColl =
  | "realEstate" | "stocks" | "crypto" | "cash" | "loans" | "physicalAssets"
  | "transactions" | "cashTransactions" | "loanTransactions" | "cryptoTransactions"
  | "yearlyNetAssets" | "nickname";

/** 표시·되돌리기 순서(spec: 자산류 → 거래 → 연도별 순자산 → 닉네임) */
const COLLS: OverwriteColl[] = [
  "realEstate", "stocks", "crypto", "cash", "loans", "physicalAssets",
  "transactions", "cashTransactions", "loanTransactions", "cryptoTransactions",
  "yearlyNetAssets", "nickname",
];
const ARRAY_COLLS = COLLS.filter((c) => c !== "nickname" && c !== "yearlyNetAssets") as Exclude<OverwriteColl, "nickname" | "yearlyNetAssets">[];

/**
 * 앱이 자동으로 쓰는 필드 — 사용자 입력이 아니므로 비교(내 변경 판정)에서 제외한다.
 * | 컬렉션 | 자동 갱신 필드 | 쓰는 곳 |
 * | stocks | currentPrice, baseDate, name(종목명 자동 보정), inactiveStatus/Reason/CheckedAt | asset-data-context 시세 동기화·일요일 종가 보정 |
 * | crypto | currentPrice, baseDate | 업비트 시세 동기화 |
 * | realEstate | marketEstimate* (추정 시세·근거 9개) — currentValue는 앱이 쓰지 않음(사용자 입력) | 실거래 추정 갱신 |
 * | yearlyNetAssets | 올해 항목(note "자동", 스냅샷마다 업서트) | 스냅샷 저장 |
 * | physicalAssets | 없음(평가액은 사용자 입력, 시세 연동 없음) — 저장은 분리 키지만 getAssetData가 합쳐 줘 일반 경로 | — |
 * | cash / loans / 거래 4종 | 없음(잔액·수량 반영은 사용자 거래 입력의 결과) | — |
 */
const COMMON_DERIVED = new Set(["currentPrice", "baseDate", "inactiveStatus", "inactiveReason", "inactiveCheckedAt"]);
const isDerived = (coll: OverwriteColl | undefined, k: string) => {
  if (k.startsWith("marketEstimate")) return true;
  if (coll === "stocks" && k === "name") return true;
  return COMMON_DERIVED.has(k);
};

type Rec = Record<string, unknown>;

export interface SyncSnapshot {
  items: Map<string, { coll: OverwriteColl; value: Rec }>;
  nickname: string;
}

export type OverwriteKind = "modified" | "resurrected" | "remoteDeleted";

export interface OverwriteEntry {
  key: string;
  coll: OverwriteColl;
  kind: OverwriteKind;
  label: string;
  /** 내 값(되돌릴 값). resurrected면 null(내가 지움) */
  mine: Rec | null;
  /** 덮인 직후의 값(R1 비교용). remoteDeleted면 null */
  landed: Rec | null;
}

const itemKey = (coll: OverwriteColl, v: Rec) => (coll === "yearlyNetAssets" ? `yearlyNetAssets:${String(v.year)}` : `${coll}:${String(v.id)}`);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function captureSnapshot(data: AssetData): SyncSnapshot {
  const items = new Map<string, { coll: OverwriteColl; value: Rec }>();
  const thisYear = new Date().getFullYear();
  for (const coll of [...ARRAY_COLLS, "yearlyNetAssets" as const]) {
    for (const v of (data[coll] ?? []) as unknown as Rec[]) {
      // 올해 연도별 순자산은 스냅샷마다 앱이 업서트("자동") — 내 변경이 아니다
      if (coll === "yearlyNetAssets" && (v.note === "자동" || v.year === thisYear)) continue;
      items.set(itemKey(coll, v), { coll, value: clone(v) });
    }
  }
  return { items, nickname: data.nickname ?? "" };
}

function stable(v: unknown, coll?: OverwriteColl): string {
  if (Array.isArray(v)) return `[${v.map((x) => stable(x)).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Rec;
    return `{${Object.keys(o)
      .filter((k) => !isDerived(coll, k) && o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
const same = (a: Rec | null | undefined, b: Rec | null | undefined, coll?: OverwriteColl) =>
  !a || !b ? a === b : stable(a, coll) === stable(b, coll);

const TYPE_LABEL: Record<string, string> = { buy: "매수", sell: "매도", deposit: "입금", withdrawal: "출금", repay: "상환", borrow: "추가 대출" };

export function labelOf(coll: OverwriteColl, v: Rec): string {
  const s = (x: unknown) => (typeof x === "string" ? x : "");
  switch (coll) {
    case "realEstate": case "stocks": case "crypto": case "cash": case "loans": case "physicalAssets":
      return s(v.name) || "이름 없음";
    case "transactions": case "cryptoTransactions":
      return `${s(v.stockName) || s(v.name) || s(v.symbol)} ${TYPE_LABEL[s(v.type)] ?? "거래"} ${s(v.date)}`.trim();
    case "cashTransactions":
      return `현금 ${TYPE_LABEL[s(v.type)] ?? "거래"} ${s(v.date)}`.trim();
    case "loanTransactions":
      return `대출 ${TYPE_LABEL[s(v.type)] ?? "거래"} ${s(v.date)}`.trim();
    case "yearlyNetAssets":
      return `연도별 순자산 ${String(v.year)}`;
    case "nickname":
      return "닉네임";
  }
}

/** baseline(마지막 동기화 성공 시점) · before(pull 직전 로컬) · after(pull 결과 로컬)로 덮인 내 변경을 찾는다. */
export function detectOverwrites(baseline: SyncSnapshot | null, before: SyncSnapshot, after: SyncSnapshot): OverwriteEntry[] {
  if (!baseline) return [];
  const out: OverwriteEntry[] = [];
  for (const [key, b] of baseline.items) {
    const me = before.items.get(key);
    const aft = after.items.get(key);
    if (me) {
      if (same(b.value, me.value, b.coll)) continue; // 내가 안 바꾼 항목
      if (!aft) out.push({ key, coll: b.coll, kind: "remoteDeleted", label: labelOf(b.coll, me.value), mine: me.value, landed: null });
      else if (!same(aft.value, me.value, b.coll)) out.push({ key, coll: b.coll, kind: "modified", label: labelOf(b.coll, me.value), mine: me.value, landed: aft.value });
    } else if (aft) {
      out.push({ key, coll: b.coll, kind: "resurrected", label: labelOf(b.coll, b.value), mine: null, landed: aft.value });
    }
  }
  if (baseline.nickname !== before.nickname && after.nickname !== before.nickname) {
    out.push({ key: "nickname", coll: "nickname", kind: "modified", label: "닉네임", mine: { value: before.nickname }, landed: { value: after.nickname } });
  }
  return sortEntries(out);
}

function sortEntries(list: OverwriteEntry[]): OverwriteEntry[] {
  return [...list].sort((a, b) => COLLS.indexOf(a.coll) - COLLS.indexOf(b.coll));
}

/** 같은 항목은 가장 최근에 덮인 내 값으로 합친다 */
export function mergeEntries(existing: OverwriteEntry[], incoming: OverwriteEntry[]): OverwriteEntry[] {
  const map = new Map(existing.map((e) => [e.key, e]));
  for (const e of incoming) map.set(e.key, e);
  return sortEntries([...map.values()]);
}

export interface RevertPlan {
  valid: OverwriteEntry[];
  /** R1: 덮인 뒤 현재 값이 달라져 목록에서 뺀 건수 */
  dropped: number;
}

/** R1 재계산 — 현재 값이 '덮인 직후 값'과 같은 항목만 되돌리기 대상 */
export function planRevert(entries: OverwriteEntry[], current: SyncSnapshot): RevertPlan {
  const valid = entries.filter((e) => {
    if (e.coll === "nickname") return current.nickname === String(e.landed?.value ?? "");
    const cur = current.items.get(e.key)?.value ?? null;
    if (e.kind === "remoteDeleted") return cur === null;
    return cur !== null && same(cur, e.landed, e.coll);
  });
  return { valid, dropped: entries.length - valid.length };
}

function pickDerived(coll: OverwriteColl, from: Rec | undefined): Rec {
  const out: Rec = {};
  if (!from) return out;
  for (const k of Object.keys(from)) if (isDerived(coll, k)) out[k] = from[k];
  return out;
}

/** 현재 데이터 위에 목록 항목만 내 값으로 되돌린 새 AssetData(순수). 목록 밖 항목·스냅샷은 건드리지 않는다. */
export function applyRevert(data: AssetData, valid: OverwriteEntry[]): AssetData {
  const next: AssetData = { ...data };
  for (const coll of [...ARRAY_COLLS, "yearlyNetAssets" as const]) {
    const entries = valid.filter((e) => e.coll === coll);
    if (entries.length === 0) continue;
    const list = [...((data[coll] ?? []) as unknown as Rec[])];
    for (const e of entries) {
      const idx = list.findIndex((v) => itemKey(coll, v) === e.key);
      if (e.kind === "resurrected") {
        if (idx >= 0) list.splice(idx, 1);
      } else if (e.mine) {
        const merged = { ...clone(e.mine), ...pickDerived(coll, idx >= 0 ? list[idx] : undefined) };
        if (idx >= 0) list[idx] = merged;
        else list.push(merged);
      }
    }
    (next as unknown as Rec)[coll] = list;
  }
  const nick = valid.find((e) => e.coll === "nickname");
  if (nick) next.nickname = String(nick.mine?.value ?? "");
  return next;
}

// ── 메모리 상태 (저장 안 함) ──
let baseline: SyncSnapshot | null = null;
let entries: OverwriteEntry[] = [];

export const getBaseline = () => baseline;
export const setBaseline = (s: SyncSnapshot | null) => { baseline = s; };
export const getEntries = () => entries;
export const setEntries = (e: OverwriteEntry[]) => { entries = e; };

/** 연결 끊기·다른 금고 연결·새로고침 상당 — 기준과 목록을 모두 폐기 */
export function resetOverwriteGuard(): void {
  baseline = null;
  entries = [];
}

/** push 직전 호출(동기) — 성공하면 commitPush로 기준 확정 */
export const beginPush = (data: AssetData): SyncSnapshot => captureSnapshot(data);
export const commitPush = (snap: SyncSnapshot): void => { baseline = snap; };

/** 자동 pull 직전 호출 — 기준이 없으면 감지하지 않는다(null) */
export function beginPull(data: AssetData, auto: boolean): SyncSnapshot | null {
  return auto && baseline ? captureSnapshot(data) : null;
}

/** pull 성공 직후 호출 — 덮인 내 변경을 목록에 합치고 기준을 갱신한다. 새로 덮인 건수를 반환 */
export function commitPull(before: SyncSnapshot | null, data: AssetData): { added: number; total: number } {
  const after = captureSnapshot(data);
  let added = 0;
  if (before) {
    const found = detectOverwrites(baseline, before, after);
    added = found.length;
    if (added > 0) entries = mergeEntries(entries, found);
  }
  baseline = after;
  return { added, total: entries.length };
}

/** 열 때·확정 때 재계산(R1) — 목록을 현재 값 기준으로 정리하고 정리 결과를 반환 */
export function refreshEntries(data: AssetData): RevertPlan {
  const plan = planRevert(entries, captureSnapshot(data));
  entries = plan.valid;
  return plan;
}
