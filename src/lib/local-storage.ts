export const STORAGE_KEY_PREFIXES = {
  profit: "secretasset_profit:",
  notice: "secretasset_notice_seen_",
} as const;

export const STORAGE_KEYS = {
  assetData:            "secretasset_asset_data",
  dailySnapshots:       "secretasset_daily_snapshots",
  monthlySnapshots:     "secretasset_monthly_snapshots",
  exchangeRate:         "secretasset_exchange_rate",
  exchangeSyncDate:     "secretasset_exchange_last_sync_date",
  collapsibleUsed:      "secretasset_collapsible_used",
  noticeHideUntil:      "secretasset_notice_hide_until",
  geminiUsage:          "secretasset_gemini_usage",
  shareOwnerId:         "secretasset_share_owner_id",
  financeApiErrorCount: "secretasset_finance_api_error_count",
  stockMarkets:         "secretasset_stock_markets",
  exchangeHistory:      "secretasset_exchange_history",
  // Tutorial step state — 단일 키, 값은 { "0":"done", "1":"skipped", ... } 형태의 JSON
  tutorialStatus:       "secretasset_tutorial_status",
} as const;

const LEGACY_KEYS = {
  assetData:            "secretasset-asset-data",
  exchangeRate:         "exchange-rate-usd-krw",
  collapsibleUsed:      "stock-tab-collapsible-used",
  noticeHideUntil:      "secretasset-notice-hide-until",
  geminiUsage:          "secretasset-gemini-usage",
  financeApiErrorCount: "finance_api_error_count",
} as const;

// Tutorial status (Step 0~5 done/skipped/pending) — 단일 key·객체 값으로 통합
export type TutorialStepNum = 0 | 1 | 2 | 3 | 4 | 5;
export type TutorialStepStatus = "pending" | "done" | "skipped";
export type TutorialStatusMap = Record<TutorialStepNum, TutorialStepStatus>;

const TUTORIAL_DEFAULT: TutorialStatusMap = { 0: "pending", 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" };

export function readTutorialStatus(): TutorialStatusMap {
  if (typeof window === "undefined") return { ...TUTORIAL_DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tutorialStatus);
    if (!raw) return { ...TUTORIAL_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Record<string, TutorialStepStatus>>;
    const result: TutorialStatusMap = { ...TUTORIAL_DEFAULT };
    for (const step of [0, 1, 2, 3, 4, 5] as TutorialStepNum[]) {
      const v = parsed[String(step)];
      if (v === "done" || v === "skipped" || v === "pending") result[step] = v;
    }
    return result;
  } catch {
    return { ...TUTORIAL_DEFAULT };
  }
}

export function writeTutorialStatus(map: TutorialStatusMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.tutorialStatus, JSON.stringify(map));
}

// 튜토리얼 전체 스킵 — done이 아닌 step만 skipped로 기록 후 store 재초기화
export function skipAllTutorialSteps(): void {
  if (typeof window === "undefined") return;
  const map = readTutorialStatus();
  for (const step of [0, 1, 2, 3, 4, 5] as TutorialStepNum[]) {
    if (map[step] !== "done") map[step] = "skipped";
  }
  writeTutorialStatus(map);
}

import { runOneTimeMigrations } from "./one-time-migrations";

export function migrateStorageKeys(): void {
  if (typeof window === "undefined") return;
  const pairs: Array<[string, string]> = [
    [LEGACY_KEYS.assetData,            STORAGE_KEYS.assetData],
    [LEGACY_KEYS.exchangeRate,         STORAGE_KEYS.exchangeRate],
    [LEGACY_KEYS.collapsibleUsed,      STORAGE_KEYS.collapsibleUsed],
    [LEGACY_KEYS.noticeHideUntil,      STORAGE_KEYS.noticeHideUntil],
    [LEGACY_KEYS.geminiUsage,          STORAGE_KEYS.geminiUsage],
    [LEGACY_KEYS.financeApiErrorCount, STORAGE_KEYS.financeApiErrorCount],
  ];
  for (const [legacy, current] of pairs) {
    if (!localStorage.getItem(current)) {
      const old = localStorage.getItem(legacy);
      if (old) {
        localStorage.setItem(current, old);
        localStorage.removeItem(legacy);
      }
    }
  }

  // profit: prefix 레거시 캐시 키 일괄 제거 (secretasset_profit: 으로 교체됨)
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("profit:") && !key.startsWith(STORAGE_KEY_PREFIXES.profit)) {
      localStorage.removeItem(key);
    }
  }

  // 메뉴-앱가이드 보기 기능 변경으로 더 이상 사용하지 않는 키 제거
  localStorage.removeItem("secretasset_guide_dismissed");
  localStorage.removeItem("secretasset-guide-dismissed");

  cleanExpiredNoticeKeys();
  runOneTimeMigrations();
}

export function cleanExpiredNoticeKeys(): void {
  if (typeof window === "undefined") return;
  const prefix = STORAGE_KEY_PREFIXES.notice;
  const now = Date.now();
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    try {
      const val = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (val.expiresAt && val.expiresAt <= now) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}
