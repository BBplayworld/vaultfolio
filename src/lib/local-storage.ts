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
  guideDismissed:       "secretasset_guide_dismissed",
  geminiUsage:          "secretasset_gemini_usage",
  shareOwnerId:         "secretasset_share_owner_id",
  financeApiErrorCount: "secretasset_finance_api_error_count",
  stockMarkets:         "secretasset_stock_markets",
  exchangeHistory:      "secretasset_exchange_history",
  // Tutorial step state (Step 0~5 done/skipped)
  tutorialStep0Done:    "secretasset_tutorial_step0_done",
  tutorialStep0Skipped: "secretasset_tutorial_step0_skipped",
  tutorialStep1Done:    "secretasset_tutorial_step1_done",
  tutorialStep1Skipped: "secretasset_tutorial_step1_skipped",
  tutorialStep2Done:    "secretasset_tutorial_step2_done",
  tutorialStep2Skipped: "secretasset_tutorial_step2_skipped",
  tutorialStep3Done:    "secretasset_tutorial_step3_done",
  tutorialStep3Skipped: "secretasset_tutorial_step3_skipped",
  tutorialStep4Done:    "secretasset_tutorial_step4_done",
  tutorialStep4Skipped: "secretasset_tutorial_step4_skipped",
  tutorialStep5Done:    "secretasset_tutorial_step5_done",
  tutorialStep5Skipped: "secretasset_tutorial_step5_skipped",
} as const;

const LEGACY_KEYS = {
  assetData:            "secretasset-asset-data",
  exchangeRate:         "exchange-rate-usd-krw",
  collapsibleUsed:      "stock-tab-collapsible-used",
  noticeHideUntil:      "secretasset-notice-hide-until",
  guideDismissed:       "secretasset-guide-dismissed",
  geminiUsage:          "secretasset-gemini-usage",
  financeApiErrorCount: "finance_api_error_count",
} as const;

// 튜토리얼 전체 스킵 — done이 아닌 step만 skipped로 기록 후 store 재초기화
export function skipAllTutorialSteps(): void {
  if (typeof window === "undefined") return;
  const DONE_KEYS = [
    STORAGE_KEYS.tutorialStep0Done, STORAGE_KEYS.tutorialStep1Done,
    STORAGE_KEYS.tutorialStep2Done, STORAGE_KEYS.tutorialStep3Done,
    STORAGE_KEYS.tutorialStep4Done, STORAGE_KEYS.tutorialStep5Done,
  ] as const;
  const SKIPPED_KEYS = [
    STORAGE_KEYS.tutorialStep0Skipped, STORAGE_KEYS.tutorialStep1Skipped,
    STORAGE_KEYS.tutorialStep2Skipped, STORAGE_KEYS.tutorialStep3Skipped,
    STORAGE_KEYS.tutorialStep4Skipped, STORAGE_KEYS.tutorialStep5Skipped,
  ] as const;
  for (let i = 0; i < 6; i++) {
    if (!localStorage.getItem(DONE_KEYS[i])) {
      localStorage.setItem(SKIPPED_KEYS[i], "1");
    }
  }
}

import { runOneTimeMigrations } from "./one-time-migrations";

export function migrateStorageKeys(): void {
  if (typeof window === "undefined") return;
  const pairs: Array<[string, string]> = [
    [LEGACY_KEYS.assetData,            STORAGE_KEYS.assetData],
    [LEGACY_KEYS.exchangeRate,         STORAGE_KEYS.exchangeRate],
    [LEGACY_KEYS.collapsibleUsed,      STORAGE_KEYS.collapsibleUsed],
    [LEGACY_KEYS.noticeHideUntil,      STORAGE_KEYS.noticeHideUntil],
    [LEGACY_KEYS.guideDismissed,       STORAGE_KEYS.guideDismissed],
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
