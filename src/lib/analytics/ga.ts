/**
 * GA4(gtag) 사용자 행동 추적 래퍼 — 명세 S-4.28
 *
 * 원칙
 * - 전송값은 사전 정의 enum만(금액·수량·종목·티커·닉네임·assetId·공유키·URL 해시·에러 문구 금지).
 *   타입(union)으로 1차, 런타임 sanitizer로 2차 차단한다. 전송 직전 한국어 라벨로 치환(GA 화면 가독성).
 * - window.gtag가 없으면(로컬·preview — layout이 GA 스크립트를 렌더하지 않음) 전부 no-op.
 *   옵트아웃(ga-disable-*)은 gtag가 자체적으로 전송을 막는다.
 * - 내부 예외는 절대 호출부로 전파하지 않는다 — 계측이 저장·동기화·화면 흐름을 바꾸면 안 된다.
 * - page_location은 항상 origin + "/v/<화면키>"로 덮어써 URL 해시(#share·#sync)·쿼리(?url)가 나가지 않게 한다.
 */

import { APP_CONFIG } from "@/config/app";
import { STORAGE_KEYS } from "@/lib/local-storage";
import type { AssetData } from "@/types/asset";

// ─────────────────────────────────────────────────────────
// 이벤트·파라미터 사전 (GA4 맞춤 측정기준과 1:1 — 공용 파라미터 이름은 모든 이벤트에서 동일)
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
  | "feature_use";

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
  ],
  result: [
    "success", "fail", "empty", "limit", "cancel",
    "done", "skipped",
    "create", "update",
    "reflected", "unreflected", "blocked", "rollback",
    "invalid", "pin_mismatch", "ignored",
    "conflict", "error",
  ],
  source: ["web", "pwa", "inapp", "settings", "more", "home_tip", "share_card", "install", "fab", "wizard", "welcome", "dashboard", "top_bar", "detail"],
  category: ["xray", "tax_sim", "home_tip", "notice", "feedback", "theme"],
  step: ["1", "2", "3", "4", "5", "start", "stock", "crypto", "cash", "loan", "complete", "exit"],
  nav_source: ["tap", "back", "swipe", "initial"],
  content_type: ["stock", "portfolio", "type", "link"],
} as const;

type ParamKey = keyof typeof PARAM_VALUES;
export type GaParams = { [K in ParamKey]?: (typeof PARAM_VALUES)[K][number] };

// GA에 실제 전송되는 한국어 라벨 — GA 보고서·탐색 분석에서 해설 없이 바로 읽히도록.
// 코드 쪽 사전·타입은 영문 키 그대로 두고 전송 직전에만 치환한다. 같은 코드라도 매개변수별로 라벨이 다르다.
// Record<코드, string> 타입이라 사전에 값을 추가하고 라벨을 빠뜨리면 컴파일 오류가 난다.
const PARAM_LABELS: { [K in ParamKey]: Record<(typeof PARAM_VALUES)[K][number], string> } = {
  asset_type: {
    stock: "주식", crypto: "암호화폐", cash: "현금", loan: "대출", real_estate: "부동산", yearly_net_asset: "연도별 순자산",
  },
  method: {
    manual: "직접 입력", screenshot: "스크린샷",
    wizard: "마법사", import: "백업 가져오기", sync_connect: "동기화 연결", skip_install: "설치 없이 시작",
    save: "이미지 저장", share: "공유하기", copy: "이미지 복사", link: "링크 복사",
    enable: "켜기", connect: "연결", push: "클라우드 백업", pull: "클라우드 불러오기",
    export: "백업 내보내기", clear_all: "전체 삭제", clear_cache: "캐시 초기화",
    disable: "끄기", unlock: "잠금 해제",
    prompt_view: "설치 안내 노출", accepted: "설치 수락", dismissed: "설치 거절", installed: "설치 완료", inapp_move: "외부 브라우저 이동",
    open: "실행", click: "클릭", close: "닫기", view: "노출", sell_all: "전량 매도", rebuy: "재매수", step: "수량 조정", submit: "전송", toggle: "전환",
  },
  result: {
    success: "성공", fail: "실패", empty: "결과 없음", limit: "한도 초과", cancel: "취소",
    done: "완료", skipped: "건너뜀",
    create: "신규", update: "수정",
    reflected: "반영", unreflected: "미반영", blocked: "차단", rollback: "롤백",
    invalid: "유효하지 않음", pin_mismatch: "PIN 불일치", ignored: "무시됨",
    conflict: "충돌", error: "오류",
  },
  source: {
    web: "웹", pwa: "PWA 앱", inapp: "인앱 브라우저", settings: "설정", more: "더보기", home_tip: "홈 팁", share_card: "인증카드",
    install: "설치 화면", fab: "추가 버튼", wizard: "마법사", welcome: "웰컴", dashboard: "대시보드", top_bar: "상단바", detail: "상세",
  },
  category: {
    xray: "X-Ray", tax_sim: "절세 시뮬레이션", home_tip: "홈 팁", notice: "공지", feedback: "의견 보내기", theme: "테마",
  },
  step: {
    "1": "1단계", "2": "2단계", "3": "3단계", "4": "4단계", "5": "5단계",
    start: "시작", stock: "주식 단계", crypto: "암호화폐 단계", cash: "현금 단계", loan: "대출 단계", complete: "완료", exit: "중단",
  },
  nav_source: { tap: "탭", back: "뒤로가기", swipe: "스와이프", initial: "첫 진입" },
  content_type: { stock: "주식 카드", portfolio: "포트폴리오 카드", type: "투자 유형 카드", link: "공유 링크" },
};

/** 코드 → 전송 라벨(테스트·명세 대조용으로 공개) */
export function labelOf<K extends ParamKey>(key: K, code: (typeof PARAM_VALUES)[K][number]): string {
  return (PARAM_LABELS[key] as Record<string, string>)[code];
}
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

/** 사전에 정의된 키·값만 통과(AC2)시키고 한국어 라벨로 치환. 그 외 문자열·객체·배열·숫자는 제거 */
export function sanitizeParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!(k in PARAM_VALUES)) continue;
    const allowed = PARAM_VALUES[k as ParamKey] as readonly string[];
    if (typeof v === "string" && allowed.includes(v)) out[k] = (PARAM_LABELS[k as ParamKey] as Record<string, string>)[v];
  }
  return out;
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
  return `${origin}${screenPath(currentScreenKey)}`;
}

// 화면 키 → 사람용 한국어 제목(GA "페이지 및 화면" 보고서에 그대로 노출)
const SCREEN_TITLES: Record<string, string> = {
  home: "홈",
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
  "activity:netasset": "성과·순자산",
  "activity:profit": "성과·수익",
  "activity:dividend": "성과·배당",
  "activity:report": "성과·자산 성적표",
};

// ─────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────

/** 이벤트 전송. gtag 부재·예외 시 무시(AC1·AC4) */
export function track(name: GaEvent, params: GaParams = {}): void {
  try {
    const gtag = getGtag();
    if (!gtag) return;
    const payload: Record<string, unknown> = { ...sanitizeParams(params), page_location: pageLocation() };
    if (isDebug()) payload.debug_mode = true;
    gtag("event", name, payload);
  } catch {
    // 계측 실패는 무시
  }
}

/**
 * 화면 전환 page_view(AC7) — 가상 경로 /v/<화면키>, 같은 화면 연속 호출은 무시.
 * URL 해시·쿼리는 절대 포함하지 않는다(AC3).
 */
export function trackScreen(viewKey: string, navSource: NonNullable<GaParams["nav_source"]> = "tap"): void {
  try {
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
      nav_source: PARAM_LABELS.nav_source[navSource],
    };
    if (isDebug()) payload.debug_mode = true;
    gtag("event", "page_view", payload);
  } catch {
    // 무시
  }
}

export interface GaUserProps {
  app_mode: "pwa" | "web" | "inapp";
  asset_count_bucket: "0" | "1" | "2-5" | "6+";
  sync_enabled: "y" | "n";
  onboarding_state: "new" | "wizard_done" | "skipped";
  theme: "light" | "dark";
}

let lastUserPropsJson = "";

// 사용자 속성 전송 라벨(한국어)
const USER_PROP_LABELS: { [K in keyof GaUserProps]: Record<GaUserProps[K], string> } = {
  app_mode: { pwa: "PWA 앱", web: "웹 브라우저", inapp: "인앱 브라우저" },
  asset_count_bucket: { "0": "0개", "1": "1개", "2-5": "2~5개", "6+": "6개 이상" },
  sync_enabled: { y: "사용", n: "미사용" },
  onboarding_state: { new: "신규", wizard_done: "마법사 완료", skipped: "건너뜀" },
  theme: { light: "라이트", dark: "다크" },
};

function labelUserProps(props: GaUserProps): Record<keyof GaUserProps, string> {
  return {
    app_mode: USER_PROP_LABELS.app_mode[props.app_mode],
    asset_count_bucket: USER_PROP_LABELS.asset_count_bucket[props.asset_count_bucket],
    sync_enabled: USER_PROP_LABELS.sync_enabled[props.sync_enabled],
    onboarding_state: USER_PROP_LABELS.onboarding_state[props.onboarding_state],
    theme: USER_PROP_LABELS.theme[props.theme],
  };
}

/** 사용자 속성 갱신(AC10) — 값이 바뀔 때만 한국어 라벨로 전송 */
export function setUserProps(props: GaUserProps): void {
  try {
    const json = JSON.stringify(props);
    if (json === lastUserPropsJson) return;
    const gtag = getGtag();
    if (!gtag) return;
    lastUserPropsJson = json;
    gtag("set", "user_properties", labelUserProps(props));
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

export function assetCountBucket(n: number): GaUserProps["asset_count_bucket"] {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  return "6+";
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
    track("first_asset_saved", { asset_type: params.asset_type, method: params.method });
  } catch {
    // 무시
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetGaStateForTest(): void {
  currentScreenKey = "home";
  lastTrackedScreenKey = null;
  lastUserPropsJson = "";
}
