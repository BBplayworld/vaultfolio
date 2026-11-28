// 자산 최신화 상태 — 카테고리(주식·코인·현금·대출)별 마지막 갱신 시각을 기기 로컬에 기록해
// 30일 이상 방치된 카테고리가 있으면 홈에 넛지를 띄운다. backup-status.ts와 동일 패턴(S-4.30).

import { STORAGE_KEYS } from "@/lib/local-storage";
import { isUnassignedBroker, sameBroker } from "@/lib/asset/resync/match";
import type { AssetData, Stock } from "@/types/asset";

export type RefreshCategory = "stock" | "crypto" | "cash" | "loan";
export const REFRESH_CATEGORIES: RefreshCategory[] = ["stock", "crypto", "cash", "loan"];

/** 넛지를 띄우는 경과일 기준 (backup-status.ts NUDGE_AFTER_DAYS와 동일 값으로 통일) */
const NUDGE_AFTER_DAYS = 30;
/** 이력이 없는 신규 카테고리 유예 — 자산을 막 등록했는데 곧바로 넛지가 뜨지 않도록 */
const NEW_USER_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const todayStr = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

interface AssetRefreshMeta {
  categories?: Partial<Record<RefreshCategory, string>>; // lastUpdatedAt ISO
  nudgeShownOn?: string; // YYYY-MM-DD
  /** 증권사별 마지막 맞춘 날(#366, 5.179) — 맞추기 대화상자만 쓴다. 모양 검사는 parseBrokerSynced(관대) */
  brokers?: { stock?: unknown } & Record<string, unknown>;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function readMeta(): AssetRefreshMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.assetRefresh);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return isPlainObject(v) ? (v as AssetRefreshMeta) : {}; // null·배열·원시값은 빈 메타(#366 C1 — `"null"`이면 categories 읽기가 throw했다)
  } catch {
    return {};
  }
}

function writeMeta(patch: Partial<AssetRefreshMeta>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.assetRefresh, JSON.stringify({ ...readMeta(), ...patch }));
  } catch { /* 기록 실패 무시 */ }
}

/** 저장 완료 신호 — FAB가 "이어서 맞추기" 복귀에 쓴다(#110). 로컬 window 이벤트라 서버·저장과 무관 */
export const CATEGORY_REFRESHED_EVENT = "asset-category-refreshed";

export function notifyCategoryRefreshed(category: RefreshCategory): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent?.(new CustomEvent(CATEGORY_REFRESHED_EVENT, { detail: { category } }));
}

/**
 * 보유현황 저장 성공 시 호출 — 단건 카드 클릭이든 다건 시퀀스든 동일하게 호출한다.
 * 저장 후 창이 바로 닫히지 않거나(보유 현황 맞추기 결과 화면) 맞추기와 무관한 경로(거래 스크린샷)는 notify:false.
 */
export function markCategoryRefreshed(category: RefreshCategory, opts?: { notify?: boolean }): string {
  const meta = readMeta();
  const at = new Date().toISOString();
  writeMeta({ categories: { ...meta.categories, [category]: at } });
  if (opts?.notify !== false) notifyCategoryRefreshed(category);
  return at; // 되돌리기 비교용(appliedAt)
}

/**
 * 맞추기를 되돌렸을 때 refresh 메타 원복(compare-and-restore) — 현재 값이 이번 적용 때 쓴 값(appliedAt)과 같을 때만.
 * 그 사이 다른 경로로 다시 맞췄다면 지우지 않는다. prev가 null이면 그 자산군 키만 지운다. nudgeShownOn·다른 자산군은 보존, 신호 없음.
 */
export function restoreCategoryRefreshed(category: RefreshCategory, prev: string | null, appliedAt: string): boolean {
  const meta = readMeta();
  if (meta.categories?.[category] !== appliedAt) return false;
  const next = { ...meta.categories };
  if (prev) next[category] = prev;
  else delete next[category];
  writeMeta({ categories: next });
  return true;
}

/** 오늘(KST) 이미 맞춘 자산군인가 — lastRefreshedAt(UTC ISO)의 KST 날짜 == 오늘 */
export function isRefreshedToday(category: RefreshCategory): boolean {
  const iso = lastRefreshedAt(category);
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().split("T")[0] === todayStr();
}

/** 카테고리의 마지막 최신화 시각(ISO). 기록 없으면 null */
export function lastRefreshedAt(category: RefreshCategory): string | null {
  return readMeta().categories?.[category] ?? null;
}

/** 마지막 갱신 이후 경과 일수. 이력이 없으면 null */
export function daysSinceRefresh(category: RefreshCategory): number | null {
  const raw = readMeta().categories?.[category];
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/** 30일 이상(또는 이력 없음) 경과한 카테고리를 오래된 순으로. assetLastUpdated는 이력 없을 때 유예 판정용 */
export function getStaleCategories(assetLastUpdated?: string, held?: RefreshCategory[]): RefreshCategory[] {
  const meta = readMeta();
  const withDays = REFRESH_CATEGORIES.map((category) => {
    const raw = meta.categories?.[category];
    if (!raw) {
      if (!assetLastUpdated) return { category, days: null, stale: false };
      const since = Date.now() - new Date(assetLastUpdated).getTime();
      return { category, days: null, stale: Number.isFinite(since) && since >= NEW_USER_GRACE_DAYS * DAY_MS };
    }
    const days = Math.floor((Date.now() - new Date(raw).getTime()) / DAY_MS);
    return { category, days, stale: days >= NUDGE_AFTER_DAYS };
  });
  return withDays
    .filter((c) => c.stale && (!held || held.includes(c.category)))
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
    .map((c) => c.category);
}

/** 보유 자산군(배열 길이 > 0) — settlement-view getStaleRows와 같은 정의 */
export function heldRefreshCategories(d: Pick<AssetData, "stocks" | "crypto" | "cash" | "loans">): RefreshCategory[] {
  const out: RefreshCategory[] = [];
  if (d.stocks?.length) out.push("stock");
  if (d.crypto?.length) out.push("crypto");
  if (d.cash?.length) out.push("cash");
  if (d.loans?.length) out.push("loan");
  return out;
}

/**
 * 홈 배너 노출 여부. 모두 만족해야 한다.
 *  1. 자산이 있다
 *  2. 카테고리 중 하나 이상 최신화가 오래됐다(getStaleCategories 참고)
 *  3. 오늘 아직 안 띄웠다
 * 백업·세금과의 동시 노출 배제는 호출측(home-tip.ts의 pickHomeTip 우선순위)이 담당한다.
 */
export function shouldShowRefreshNudge(opts: {
  hasAssets: boolean;
  assetLastUpdated?: string;
  /** 지정하면 보유 자산군만 판정(미지정 = 전체) */
  held?: RefreshCategory[];
  /** 이번 홈 마운트에서 이미 보여 준 팁 유지용 — '오늘 노출' 검사만 건너뛴다(미지정 = 현행) */
  keepShown?: boolean;
}): boolean {
  if (typeof window === "undefined") return false;
  if (!opts.hasAssets) return false;
  if (!opts.keepShown && readMeta().nudgeShownOn === todayStr()) return false;
  return getStaleCategories(opts.assetLastUpdated, opts.held).length > 0;
}

/** 배너를 노출했을 때 — 오늘은 다시 띄우지 않는다 */
export function markRefreshNudgeShown(): void {
  writeMeta({ nudgeShownOn: todayStr() });
}

// ── 증권사별 마지막 맞춘 날(#366, 5.179) ─────────────────────────────
// 저장: 같은 키 `brokers.stock` 배열(증권사 이름을 객체 키로 쓰지 않는다 → `__proto__` 무관). 금액·수량·종목명 0.
// 쓰는 곳은 보유 현황 맞추기 대화상자 1곳(적용·변경 0 확인·되돌리기). 동기화·백업 payload에 넣지 않는다(키 자체가 기기 로컬).

export type BrokerSyncCategory = Exclude<Stock["category"], "unlisted">;
export const BROKER_SYNC_CATEGORIES: readonly BrokerSyncCategory[] = ["domestic", "foreign", "irp", "isa", "pension"];
export interface BrokerSyncEntry {
  broker: string;
  category: BrokerSyncCategory;
  /** KST YYYY-MM-DD */
  date: string;
  /** 맞춘 직후 그 범위(증권사 × 계좌)의 항목 수 — 지금 수와 다르면 표시하지 않는다(묶음 구성 가드) */
  count: number;
}
export type BrokerSyncScope = Omit<BrokerSyncEntry, "date">;
/** 되돌리기 사본 — had=false면 적용 전에 `stock` 키가 없었다 */
export interface BrokerSyncUndo {
  had: boolean;
  prev: unknown;
  applied: BrokerSyncEntry[];
}

const BROKER_NAME_MAX = 40;
const BROKER_ENTRIES_MAX = 60;
/** 기록·원복 직후 로컬 window 신호(저장 0) — 증권사별 블록이 다시 읽는다. asset-category-refreshed(FAB 복귀)와 섞지 않는다 */
export const BROKER_SYNCED_EVENT = "asset-broker-synced";

function validDate(v: unknown, today: string): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const back = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(back.getTime()) || back.toISOString().slice(0, 10) !== v) return false;
  return v <= today;
}

function validEntry(e: unknown, today: string): BrokerSyncEntry | null {
  if (!isPlainObject(e)) return null;
  const broker = hasOwn(e, "broker") ? e.broker : undefined;
  const category = hasOwn(e, "category") ? e.category : undefined;
  const date = hasOwn(e, "date") ? e.date : undefined;
  const count = hasOwn(e, "count") ? e.count : undefined;
  if (typeof broker !== "string" || broker.length > BROKER_NAME_MAX || isUnassignedBroker(broker)) return null;
  if (typeof category !== "string" || !(BROKER_SYNC_CATEGORIES as readonly string[]).includes(category)) return null;
  if (!validDate(date, today)) return null;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  return { broker, category: category as BrokerSyncCategory, date, count };
}

/** 메타 → 유효한 기록만(관대, throw 0). 같은 범위(sameBroker × category) 중복은 늦은 날짜 1개 */
export function parseBrokerSynced(meta: unknown, today: string = todayStr()): BrokerSyncEntry[] {
  try {
    if (!isPlainObject(meta) || !hasOwn(meta, "brokers")) return [];
    const b = meta.brokers;
    if (!isPlainObject(b) || !hasOwn(b, "stock")) return [];
    const list = b.stock;
    if (!Array.isArray(list)) return [];
    const out: BrokerSyncEntry[] = [];
    for (const raw of list) {
      const e = validEntry(raw, today);
      if (!e) continue;
      const i = out.findIndex((o) => o.category === e.category && sameBroker(o.broker, e.broker));
      if (i < 0) out.push(e);
      else if (e.date > out[i].date) out[i] = e;
    }
    return out;
  } catch {
    return [];
  }
}

/** 원문 문자열 → 기록(useSyncExternalStore 스냅샷용). 손상이면 [] */
export function brokerSyncedFromRaw(raw: string | null, today: string = todayStr()): BrokerSyncEntry[] {
  if (!raw) return [];
  try {
    return parseBrokerSynced(JSON.parse(raw), today);
  } catch {
    return [];
  }
}

/** 지금 저장된 원문(없으면 "") — 화면 구독 스냅샷. 서버 렌더는 "" */
export function readAssetRefreshRaw(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEYS.assetRefresh) ?? "";
  } catch {
    return "";
  }
}

export function subscribeBrokerSynced(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener?.(BROKER_SYNCED_EVENT, cb);
  return () => window.removeEventListener?.(BROKER_SYNCED_EVENT, cb);
}

function notifyBrokerSynced(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent?.(new CustomEvent(BROKER_SYNCED_EVENT));
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 범위마다 오늘 날짜를 남긴다(upsert: 같은 sameBroker × category를 지우고 추가, 최대 60개 — 넘치면 오래된 날짜부터 버림).
 * 다시 읽어 모든 범위가 들어갔는지 확인한다. 실패(범위 0·쓰기 실패)면 null — 그때는 아무것도 바뀌지 않는다.
 */
export function markBrokersSynced(scopes: BrokerSyncScope[], today: string = todayStr()): BrokerSyncUndo | null {
  if (scopes.length === 0 || typeof window === "undefined") return null;
  const meta = readMeta();
  const brokers = isPlainObject(meta.brokers) ? meta.brokers : null;
  const had = !!brokers && hasOwn(brokers, "stock");
  const prev = had ? brokers!.stock : undefined;
  let next = parseBrokerSynced(meta, today).filter((e) => !scopes.some((s) => s.category === e.category && sameBroker(s.broker, e.broker)));
  next.push(...scopes.map((s) => ({ broker: s.broker, category: s.category, date: today, count: s.count })));
  if (next.length > BROKER_ENTRIES_MAX) {
    next = next
      .map((e, i) => ({ e, i }))
      .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i)
      .slice(0, BROKER_ENTRIES_MAX)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.e);
  }
  writeMeta({ brokers: { ...(brokers ?? {}), stock: next } });
  const check = parseBrokerSynced(readMeta(), today);
  const ok = scopes.every((s) => check.some((e) => e.category === s.category && sameBroker(e.broker, s.broker) && e.date === today && e.count === s.count));
  if (!ok) return null;
  notifyBrokerSynced();
  return { had, prev, applied: next };
}

/** 되돌리기 원복(compare-and-restore) — 지금 값이 이번 적용 값과 같을 때만 이전 값으로(없었으면 `stock` 키 삭제). 그 사이 다시 맞췄으면 유지 */
export function restoreBrokersSynced(u: BrokerSyncUndo): boolean {
  const meta = readMeta();
  const brokers = isPlainObject(meta.brokers) ? meta.brokers : null;
  if (!brokers || !hasOwn(brokers, "stock") || !sameJson(brokers.stock, u.applied)) return false;
  const next: Record<string, unknown> = { ...brokers };
  if (u.had) next.stock = u.prev;
  else delete next.stock;
  writeMeta({ brokers: Object.keys(next).length > 0 ? next : undefined });
  notifyBrokerSynced();
  return true;
}

/** "모든 데이터 삭제" 전용 — clearAssetData는 이 키를 보존하므로 명시적으로 지운다 */
export function clearAssetRefreshStatus(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.assetRefresh);
  } catch { /* 무시 */ }
}
