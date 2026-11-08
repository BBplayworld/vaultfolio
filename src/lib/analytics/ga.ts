/**
 * GA4(gtag) 사용 기능 추적 래퍼 — 명세 S-4.28, 4.41(#68)에서 page_title 하나로 단순화
 *
 * 원칙
 * - 모든 이벤트·page_view는 { page_title(= 사용 기능 이름), page_location(가상 경로) }만 보낸다.
 *   맞춤 매개변수·사용자 속성은 보내지 않는다. 호출부의 의미 인자(asset_type·method 등)는
 *   featureTitleOf가 page_title을 정하는 데에만 쓰고 GA로 나가지 않는다.
 * - window.gtag가 없으면(로컬·preview — layout이 GA 스크립트를 렌더하지 않음) 전부 no-op.
 *   옵트아웃(ga-disable-*)은 gtag가 자체적으로 전송을 막는다.
 * - 내부 예외는 절대 호출부로 전파하지 않는다 — 계측이 저장·동기화·화면 흐름을 바꾸면 안 된다.
 * - page_location은 항상 origin + "/v/<화면키>"로 덮어써 URL 해시(#share·#sync)·쿼리(?url)가 나가지 않게 한다.
 * - 체험 모드(#59) 페이지에서는 track·trackScreen 전부 no-op(허용 목록 없음).
 */

import { APP_CONFIG } from "@/config/app";
import { allowedUtmQuery } from "@/lib/analytics/utm-allow";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { markFirstSave } from "@/lib/pwa/first-save-signal";
import type { AssetData } from "@/types/asset";

// ─────────────────────────────────────────────────────────
// 이벤트·파라미터 사전 (page_title 결정용 내부 타입 — GA로 전송하지 않는다)
// ─────────────────────────────────────────────────────────

export type GaEvent =
  | "welcome_view"
  | "onboarding_action"
  | "tutorial_begin"
  | "tutorial_complete"
  | "tutorial_step"
  | "wizard_step"
  | "first_asset_saved"
  | "asset_add_start"
  | "asset_save"
  | "asset_delete"
  | "screenshot_parse"
  | "transaction_save"
  | "transaction_delete"
  | "share"
  | "share_restore"
  | "sync_action"
  | "data_action"
  | "app_lock"
  | "pwa_install"
  | "feature_use"
  | "settlement_view"
  | "theme_mode";

export const PARAM_VALUES = {
  asset_type: ["stock", "crypto", "cash", "loan", "real_estate", "yearly_net_asset"],
  method: [
    // 입력 방식
    "manual", "screenshot",
    // 웰컴 CTA
    "wizard", "import", "sync_connect", "skip_install",
    // 공유
    "save", "share", "copy", "link",
    // 동기화
    "enable", "connect", "push", "pull",
    // 데이터 관리
    "export", "clear_all", "clear_cache",
    // 앱 잠금
    "disable", "unlock",
    // PWA
    "prompt_view", "accepted", "dismissed", "installed", "inapp_move",
    // 기능 사용 세부
    "open", "click", "close", "view", "sell_all", "rebuy", "step", "submit", "toggle",
    // AI 질문 복사(#54)
    "prompt_copy",
    // 체험 모드 종료 후 내 자산으로 시작(#59)
    "trial_start",
    // /ratio 예시로 먼저 보기(#66)
    "sample",
  ],
  result: [
    "success", "fail", "empty", "limit", "cancel",
    "done", "skipped",
    "create", "update",
    "reflected", "unreflected", "blocked", "rollback",
    "invalid", "pin_mismatch", "ignored",
    "conflict", "error",
    // 월말 결산(#32): 전월 결산(월 1회 방문자의 날짜 구간 포함) / 진행 중 구간 / 첫 달
    "settled", "in_progress", "first_month",
  ],
  source: ["web", "pwa", "inapp", "settings", "more", "home_tip", "share_card", "install", "fab", "wizard", "welcome", "dashboard", "top_bar", "detail", "card", "menu", "settlement", "report"],
  category: ["xray", "tax_sim", "home_tip", "notice", "feedback", "theme", "ai_prompt", "demo", "ratio_preview", "share_card", "app_guide", "install_nudge", "install_nudge_tap", "sync_overwrite_notice", "sync_overwrite_undo", "resync_start", "resync_apply", "resync_undo"],
  step: ["1", "2", "3", "4", "5", "start", "stock", "crypto", "cash", "loan", "complete", "exit"],
  content_type: ["stock", "portfolio", "type", "link"],
  // 화면 테마(#4.42) — 앱 시작 시 현재 모드, 전환 시 새 모드. page_title 결정에만 쓴다
  theme: ["dark", "light"],
} as const;

type ParamKey = keyof typeof PARAM_VALUES;
export type GaParams = { [K in ParamKey]?: (typeof PARAM_VALUES)[K][number] };
export type GaAssetType = NonNullable<GaParams["asset_type"]>;

// ─────────────────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────────────────

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const g = (window as unknown as { gtag?: unknown }).gtag;
  return typeof g === "function" ? (g as GtagFn) : null;
}

function isDebug(): boolean {
  try {
    return localStorage.getItem("ga-debug") === "1";
  } catch {
    return false;
  }
}

// 현재 화면 키 — 모든 이벤트의 page_location을 해시 없는 가상 경로로 고정
let currentScreenKey = "home";
let lastTrackedScreenKey: string | null = null;

const SCREEN_KEY_RE = /^[a-z0-9:-]{1,40}$/;

export function screenPath(viewKey: string): string {
  return `/v/${viewKey.replace(/:/g, "/")}`;
}

function pageLocation(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_CONFIG.siteUrl;
  // /ratio 도착 URL의 허용 UTM만 가상 경로 뒤에 붙인다(캠페인 귀속, #63). 그 밖의 쿼리·해시는 제외
  const utm = typeof window !== "undefined" ? allowedUtmQuery(window.location.pathname, window.location.search) : "";
  return `${origin}${screenPath(currentScreenKey)}${utm}`;
}

// 화면 키 → 사람용 한국어 제목(GA "페이지 및 화면" 보고서에 그대로 노출)
const SCREEN_TITLES: Record<string, string> = {
  home: "홈",
  ratio: "비중 미리보기",
  "guide:stock-ratio": "가이드·주식 비중",
  "guide:net-worth": "가이드·순자산 정리",
  more: "더보기",
  settings: "설정",
  tax: "세금 관리",
  "detail:hub": "상세",
  "detail:stocks": "상세·주식",
  "detail:stocks-xray": "상세·주식 X-Ray",
  "detail:stocks-trades": "상세·주식 거래내역",
  "detail:real-estate": "상세·부동산",
  "detail:crypto": "상세·암호화폐",
  "detail:crypto-transactions": "상세·암호화폐 거래내역",
  "detail:cash": "상세·현금",
  "detail:cash-transactions": "상세·현금 거래내역",
  "detail:loans": "상세·대출",
  "detail:loan-transactions": "상세·대출 거래내역",
  "activity:hub": "성과",
  "activity:change": "성과·자산 변화",
  "activity:change:composition": "성과·자산 변화·구성", // 현재 사용처 없음(#4.44에서 카드 제거) — 4.45 재사용 예정
  "activity:dividend": "성과·배당",
  "activity:report": "성과·자산 성적표",
};

// 자산 종류 → 기능 이름 접미사(예: "스크린샷 등록·주식")
const ASSET_TYPE_TITLES: Record<GaAssetType, string> = {
  stock: "주식",
  crypto: "암호화폐",
  cash: "현금",
  loan: "대출",
  real_estate: "부동산",
  yearly_net_asset: "연도별 순자산",
};

// feature_use는 category로 기능 이름을 정한다. ratio_preview는 /ratio 화면 title로 귀결(매핑 없음)
const CATEGORY_TITLES: Partial<Record<NonNullable<GaParams["category"]>, string>> = {
  xray: "X-Ray",
  tax_sim: "절세 시뮬레이션",
  home_tip: "홈 팁",
  notice: "홈 팁",
  feedback: "의견 보내기",
  theme: "테마 변경",
  ai_prompt: "AI 프롬프트 복사",
  demo: "체험 모드",
  share_card: "인증카드 열기",
  app_guide: "앱 가이드 열기",
  install_nudge: "설치 안내",
  install_nudge_tap: "설치 안내 누름",
  sync_overwrite_notice: "동기화 덮임 알림",
  sync_overwrite_undo: "동기화 되돌리기",
  resync_start: "보유 현황 맞추기 시작",
  resync_apply: "보유 현황 맞추기 적용",
  resync_undo: "보유 현황 맞추기 되돌리기",
};

/**
 * 이벤트 → GA page_title(사용 기능 이름). 순수 함수.
 * 매핑이 없는 이벤트(삭제·앱 잠금 등)는 현재 화면 title, 화면 title도 없으면 undefined(title 생략).
 */
export function featureTitleOf(eventName: string, params: GaParams, currentScreenKey: string): string | undefined {
  const withAsset = (base: string) => (params.asset_type ? `${base}·${ASSET_TYPE_TITLES[params.asset_type]}` : base);
  switch (eventName) {
    case "welcome_view":
    case "onboarding_action":
      return "웰컴";
    case "tutorial_begin":
    case "tutorial_step":
    case "tutorial_complete":
    case "wizard_step":
      return "온보딩";
    case "asset_add_start":
      return withAsset("자산 추가 시작");
    case "asset_save":
    case "first_asset_saved":
      return withAsset("자산 저장");
    case "screenshot_parse":
      return withAsset("스크린샷 등록");
    case "transaction_save":
      return withAsset("거래 입력");
    case "share":
      return params.method === "save" ? "인증카드 저장" : "공유";
    case "share_restore":
      return "공유";
    case "sync_action":
      return "기기 동기화";
    case "data_action":
      return params.method === "export" || params.method === "import" ? "백업" : "데이터 관리";
    case "pwa_install":
      return "앱 설치";
    case "settlement_view":
      return "월 결산";
    case "theme_mode":
      return params.theme === "dark" ? "다크 모드 사용" : "라이트 모드 사용";
    case "feature_use": {
      const t = params.category ? CATEGORY_TITLES[params.category] : undefined;
      if (t) return t;
      break;
    }
  }
  return SCREEN_TITLES[currentScreenKey];
}

function withTitle(payload: Record<string, unknown>, name: string, params: GaParams): Record<string, unknown> {
  const title = featureTitleOf(name, params, currentScreenKey);
  return title ? { page_title: title, ...payload } : payload;
}

// ─────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────

/** 이벤트 전송. gtag 부재·예외 시 무시(AC1·AC4) */
export function track(name: GaEvent, params: GaParams = {}): void {
  try {
    if (isTrialMode()) return;
    const gtag = getGtag();
    if (!gtag) return;
    const payload = withTitle({ page_location: pageLocation() }, name, params);
    if (isDebug()) payload.debug_mode = true;
    gtag("event", name, payload);
  } catch {
    // 계측 실패는 무시
  }
}

const THEME_SENT_KEY = "secretasset_ga_theme_sent";

/**
 * 화면 테마 사용 계측(#4.42) — 세션(sessionStorage)당 모드별 1회. 앱 시작 시 현재 모드, 설정에서 전환하면 새 모드로 1회 재전송.
 * 직전에 보낸 모드와 같으면 생략한다. 체험 모드는 track이 no-op이며 중복 기록도 하지 않는다.
 */
export function trackThemeMode(mode: "dark" | "light"): void {
  try {
    if (isTrialMode()) return;
    if (sessionStorage.getItem(THEME_SENT_KEY) === mode) return;
    sessionStorage.setItem(THEME_SENT_KEY, mode);
    track("theme_mode", { theme: mode });
  } catch {
    // 계측 실패는 무시
  }
}

/** trackThenNavigate 최대 대기(ms) — 이 시간 안에 전송 확인이 없어도 이동한다 */
export const NAVIGATE_TRACK_TIMEOUT_MS = 300;

/**
 * 이벤트를 보낸 뒤 페이지 이동(#59 체험 진입). gtag.js가 늦게 로드되면 이동과 함께 큐가 유실되므로
 * event_callback 또는 300ms 타임아웃 중 먼저 오는 쪽에서 1회만 이동한다. 체험 중·gtag 없음·예외는 즉시 이동.
 */
export function trackThenNavigate(
  name: GaEvent,
  params: GaParams,
  url: string,
  navigate: (url: string) => void = (u) => window.location.assign(u),
): void {
  let moved = false;
  const go = () => {
    if (moved) return;
    moved = true;
    navigate(url);
  };
  try {
    if (isTrialMode()) return go();
    const gtag = getGtag();
    if (!gtag) return go();
    const payload = withTitle(
      { page_location: pageLocation(), event_callback: go, event_timeout: NAVIGATE_TRACK_TIMEOUT_MS },
      name,
      params,
    );
    if (isDebug()) payload.debug_mode = true;
    gtag("event", name, payload);
    setTimeout(go, NAVIGATE_TRACK_TIMEOUT_MS);
  } catch {
    go();
  }
}

/**
 * 화면 전환 page_view(AC7) — 가상 경로 /v/<화면키>, 같은 화면 연속 호출은 무시.
 * URL 해시·쿼리는 절대 포함하지 않는다(AC3).
 */
export function trackScreen(viewKey: string): void {
  try {
    if (isTrialMode()) return;
    if (!SCREEN_KEY_RE.test(viewKey)) return;
    currentScreenKey = viewKey;
    if (lastTrackedScreenKey === viewKey) return;
    lastTrackedScreenKey = viewKey;
    const gtag = getGtag();
    if (!gtag) return;
    const payload: Record<string, unknown> = {
      page_location: pageLocation(),
      page_path: screenPath(viewKey),
      page_title: SCREEN_TITLES[viewKey] ?? viewKey,
    };
    if (isDebug()) payload.debug_mode = true;
    gtag("event", "page_view", payload);
  } catch {
    // 무시
  }
}

/** 앱 내부 자산 타입 표기(kebab) → GA asset_type 값. 사전 외 값은 undefined(sanitizer가 제거) */
export function toGaAssetType(t: string | null | undefined): GaAssetType | undefined {
  const v = (t ?? "").replace(/-/g, "_");
  return (PARAM_VALUES.asset_type as readonly string[]).includes(v) ? (v as GaAssetType) : undefined;
}

/** 스크린샷 AI 인식 결과 계측 — 거래 스크린샷(trade·crypto-trade)은 각각 stock·crypto로 집계 */
export function trackParse(
  type: "stock" | "crypto" | "cash" | "loan" | "trade" | "crypto-trade",
  result: "success" | "fail" | "empty" | "limit",
): void {
  const asset_type: GaAssetType = type === "trade" ? "stock" : type === "crypto-trade" ? "crypto" : type;
  track("screenshot_parse", { asset_type, result });
}

/** 보유 자산 건수(연도별 순자산 기록·거래내역 제외) */
export function countAssets(data: Pick<AssetData, "stocks" | "crypto" | "cash" | "loans" | "realEstate"> | null | undefined): number {
  if (!data) return 0;
  return (data.stocks?.length ?? 0) + (data.crypto?.length ?? 0) + (data.cash?.length ?? 0) + (data.loans?.length ?? 0) + (data.realEstate?.length ?? 0);
}

// ── 첫 자산 저장 1회 판정(AC8) — 기기당 1회, secretasset_ga_flags에 기록 ──

interface GaFlags {
  firstAssetSent?: true;
}

function readFlags(): GaFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.gaFlags);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as GaFlags) : {};
  } catch {
    return {};
  }
}

function writeFlags(flags: GaFlags): void {
  try {
    localStorage.setItem(STORAGE_KEYS.gaFlags, JSON.stringify(flags));
  } catch {
    // 무시
  }
}

/**
 * 사용자 직접 입력(수동·스크린샷)에 의한 자산 저장 계측.
 * prevAssetCount(저장 직전 보유 건수)가 0이면 first_asset_saved를 기기당 1회 함께 보낸다.
 * 공유 복원·백업 가져오기·동기화 pull은 이 함수를 호출하지 않으므로 자연히 제외된다.
 */
export function trackAssetSave(
  params: { asset_type: GaAssetType; method: "manual" | "screenshot"; result: "create" | "update" },
  prevAssetCount: number,
): void {
  track("asset_save", params);
  try {
    if (params.result !== "create" || prevAssetCount !== 0) return;
    const flags = readFlags();
    if (flags.firstAssetSent) return;
    writeFlags({ ...flags, firstAssetSent: true });
    markFirstSave(); // 설치 안내(#78) 세션 메모리 신호 — gtag 유무와 무관
    track("first_asset_saved", { asset_type: params.asset_type, method: params.method });
  } catch {
    // 무시
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetGaStateForTest(): void {
  currentScreenKey = "home";
  lastTrackedScreenKey = null;
}
