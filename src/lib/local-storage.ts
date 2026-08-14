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
  // 공지 열람 상태 — 단일 키(값 { id, seenAt, expiresAt }). 릴리스마다 이 한 키를 덮어써 항상 1개만 존재.
  noticeSeen:           "secretasset_notice_seen",
  geminiUsage:          "secretasset_gemini_usage",
  shareOwnerId:         "secretasset_share_owner_id",
  financeApiErrorCount: "secretasset_finance_api_error_count",
  stockMarkets:         "secretasset_stock_markets",
  exchangeHistory:      "secretasset_exchange_history",
  // 일별 스냅샷 장기 아카이브 (30일 롤링에서 밀려난 기록의 월 단위 압축 보관)
  dailyArchive:         "secretasset_daily_archive",
  // 마지막 스냅샷 저장일 (기기 로컬 전용 — "지난 접속 이후" 브리핑 기준일)
  lastVisitDate:        "secretasset_last_visit_date",
  // 백업 메타 단일 키 — 값 { lastBackupAt?: ISO, nudgeShownOn?: YYYY-MM-DD }. 기기 로컬 전용
  backup:               "secretasset_backup",
  nickname:             "secretasset_nickname",
  // 기간별 수익 종가 기준 옵션 ("sameBusinessDay" | "kstAccessDay")
  profitBasis:          "secretasset_profit_basis",
  // Tutorial step state — 단일 키, 값은 { "0":"done", "1":"skipped", ... } 형태의 JSON
  tutorialStatus:       "secretasset_tutorial_status",
  // 주식 탭 원/달러 표시 화폐 ("KRW" | "USD")
  stockDisplayCurrency: "secretasset_stock_display_currency",
  // 클라우드 동기화 상태 키
  syncState:            "secretasset_sync",
  // 홈 세금 안내 배너 닫기 메타 — 값 { dismissedMonth: "YYYY-MM" }(KST). 기기 로컬 전용(월 단위 재노출)
  taxNotice:            "secretasset_tax_notice",
  // 온보딩 마법사 진행 상태 (S-4.29) — tutorialStatus(스팟라이트 튜토리얼)와 값을 공유하면 안 되는
  // 별개 기능이라 별도 키. 기기 로컬 전용
  onboardingWizardStatus: "secretasset_onboarding_wizard_status",
} as const;

const LEGACY_KEYS = {
  assetData:            "secretasset-asset-data",
  exchangeRate:         "exchange-rate-usd-krw",
  collapsibleUsed:      "stock-tab-collapsible-used",
  geminiUsage:          "secretasset-gemini-usage",
  financeApiErrorCount: "finance_api_error_count",
} as const;

// Tutorial status (Step 1~5 done/skipped/pending) — 단일 key·객체 값으로 통합
export type TutorialStepNum = 1 | 2 | 3 | 4 | 5;
export type TutorialStepStatus = "pending" | "done" | "skipped";
export type TutorialStatusMap = Record<TutorialStepNum, TutorialStepStatus>;

const TUTORIAL_DEFAULT: TutorialStatusMap = { 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" };

export function readTutorialStatus(): TutorialStatusMap {
  if (typeof window === "undefined") return { ...TUTORIAL_DEFAULT };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tutorialStatus);
    if (!raw) return { ...TUTORIAL_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Record<string, TutorialStepStatus>>;
    const result: TutorialStatusMap = { ...TUTORIAL_DEFAULT };
    for (const step of [1, 2, 3, 4, 5] as TutorialStepNum[]) {
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
  for (const step of [1, 2, 3, 4, 5] as TutorialStepNum[]) {
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

// 공지 열람 상태 읽기 — 만료됐으면 null(미열람 취급). 값 { id, seenAt, expiresAt }.
export function readNoticeSeenId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.noticeSeen);
    if (!raw) return null;
    const val = JSON.parse(raw);
    if (val?.expiresAt && val.expiresAt <= Date.now()) return null;
    return typeof val?.id === "string" ? val.id : null;
  } catch {
    return null;
  }
}

// 공지 열람 기록 — 단일 키를 덮어써 항상 1개만 유지.
export function markNoticeSeen(id: string, expiresAt: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.noticeSeen, JSON.stringify({ id, seenAt: Date.now(), expiresAt }));
  } catch { /* ignore */ }
}

// 공지 키 정리 — 단일 키(secretasset_notice_seen)만 남긴다.
//  - currentId 있으면(다이얼로그): 현재 공지의 레거시 per-id 키를 단일 키로 이관(열람 상태 보존) 후 레거시 전부 제거.
//  - currentId 없으면(init): 레거시 중 만료된 것만 제거(현재 공지 레거시 키는 다이얼로그가 이관하도록 남김).
//  - 단일 키가 만료면 제거.
export function cleanExpiredNoticeKeys(currentId?: string): void {
  if (typeof window === "undefined") return;
  const legacyPrefix = STORAGE_KEY_PREFIXES.notice; // "secretasset_notice_seen_" (접미 _ → 단일 키는 안 걸림)
  const now = Date.now();

  // 단일 키 만료 정리
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.noticeSeen);
    if (raw) {
      const val = JSON.parse(raw);
      if (val?.expiresAt && val.expiresAt <= now) localStorage.removeItem(STORAGE_KEYS.noticeSeen);
    }
  } catch { localStorage.removeItem(STORAGE_KEYS.noticeSeen); }

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(legacyPrefix)) continue;
    const id = key.slice(legacyPrefix.length);
    if (currentId) {
      // 현재 공지 레거시 키는 단일 키가 비어 있으면 이관(열람 상태 보존)
      if (id === currentId && !localStorage.getItem(STORAGE_KEYS.noticeSeen)) {
        localStorage.setItem(STORAGE_KEYS.noticeSeen, localStorage.getItem(key) ?? "{}");
      }
      localStorage.removeItem(key); // 이관 여부와 무관하게 레거시 per-id 키는 모두 제거
    } else {
      // init 경로: 만료된 레거시만 제거
      try {
        const val = JSON.parse(localStorage.getItem(key) ?? "{}");
        if (val?.expiresAt && val.expiresAt <= now) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  }
}
