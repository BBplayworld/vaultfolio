// 자산 최신화 상태 — 카테고리(주식·코인·현금·대출)별 마지막 갱신 시각을 기기 로컬에 기록해
// 30일 이상 방치된 카테고리가 있으면 홈에 넛지를 띄운다. backup-status.ts와 동일 패턴(S-4.30).

import { STORAGE_KEYS } from "@/lib/local-storage";
import type { AssetData } from "@/types/asset";

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
}

function readMeta(): AssetRefreshMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.assetRefresh);
    return raw ? (JSON.parse(raw) as AssetRefreshMeta) : {};
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

/** "모든 데이터 삭제" 전용 — clearAssetData는 이 키를 보존하므로 명시적으로 지운다 */
export function clearAssetRefreshStatus(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.assetRefresh);
  } catch { /* 무시 */ }
}
