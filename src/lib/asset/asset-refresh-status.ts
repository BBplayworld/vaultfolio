// 자산 최신화 상태 — 카테고리(주식·코인·현금·대출)별 마지막 갱신 시각을 기기 로컬에 기록해
// 30일 이상 방치된 카테고리가 있으면 홈에 넛지를 띄운다. backup-status.ts와 동일 패턴(S-4.30).

import { STORAGE_KEYS } from "@/lib/local-storage";

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

/** 보유현황 저장 성공 시 호출 — 단건 카드 클릭이든 다건 시퀀스든 동일하게 호출한다 */
export function markCategoryRefreshed(category: RefreshCategory): void {
  const meta = readMeta();
  writeMeta({ categories: { ...meta.categories, [category]: new Date().toISOString() } });
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
export function getStaleCategories(assetLastUpdated?: string): RefreshCategory[] {
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
    .filter((c) => c.stale)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
    .map((c) => c.category);
}

/**
 * 홈 배너 노출 여부. 모두 만족해야 한다.
 *  1. 자산이 있다
 *  2. 카테고리 중 하나 이상 최신화가 오래됐다(getStaleCategories 참고)
 *  3. 오늘 아직 안 띄웠다
 * 백업 넛지와의 동시 노출 배제는 호출측(RefreshNudge의 suppressed prop)이 담당한다.
 */
export function shouldShowRefreshNudge(opts: {
  hasAssets: boolean;
  assetLastUpdated?: string;
}): boolean {
  if (typeof window === "undefined") return false;
  if (!opts.hasAssets) return false;
  if (readMeta().nudgeShownOn === todayStr()) return false;
  return getStaleCategories(opts.assetLastUpdated).length > 0;
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
