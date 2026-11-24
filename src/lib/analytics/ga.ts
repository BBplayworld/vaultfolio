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
  asset_type: ["stock", "crypto", "cash", "loan", "real_estate", "physical", "yearly_net_asset"],
  method: [
    // 입력 방식
    "manual", "screenshot",
    // 웰컴 CTA
    "wizard", "import", "sync_connect",
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
    // 끊긴 거래 다시 잇기(#147): view·apply·undo·keep
    "apply", "undo", "keep",
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
  source: ["web", "pwa", "inapp", "settings", "more", "home_tip", "whats_new", "share_card", "install", "fab", "wizard", "welcome", "dashboard", "top_bar", "detail", "card", "menu", "settlement", "report", "home_week", "push", "activity", "invest"],
  category: ["xray", "tax_sim", "home_tip", "home_tip_notify", "persist_ok", "persist_denied", "whats_new", "feedback", "theme", "ai_prompt", "demo", "guide_open", "ratio_preview", "share_card", "app_guide", "install_nudge", "install_nudge_tap", "sync_overwrite_notice", "sync_overwrite_undo", "resync_start", "resync_apply", "resync_undo", "balance_resync", "resync_continue", "save_failed", "linked_trade", "change_scope_stock", "change_week_all", "stock_sort_rate", "relink", "settlement_ics", "home_cause_open", "home_market", "home_my_stock", "home_compose_cash", "home_compose_loan", "profit_basis_settings", "profit_basis_chart", "push_on", "push_off", "push_denied", "push_click_morning", "push_click_kr", "push_click_settle", "push_click_tax", "year_settlement", "grow_label", "grow_check", "grow_revisit", "grow_plan", "grow_grade_tab", "grow_pick", "grow_other_label", "home_tip_due", "stock_decision", "stock_check_tile", "stock_decision_view", "trade_new_stock", "trade_new_stock_linked", "invest_index_spx", "invest_index_ndx", "invest_index_kospi", "invest_three", "invest_decade", "invest_ratio", "invest_overlay", "invest_table", "invest_calc", "invest_rise_tab", "invest_pattern", "invest_year_pick", "invest_drop_open", "invest_phase_table", "invest_recession", "invest_range", "invest_my_start", "invest_my_xray", "guide_move"],
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

function pageLocation(screenKey: string = currentScreenKey): string {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_CONFIG.siteUrl;
  // /ratio 도착 URL의 허용 UTM만 가상 경로 뒤에 붙인다(캠페인 귀속, #63). 그 밖의 쿼리·해시는 제외
  const utm = typeof window !== "undefined" ? allowedUtmQuery(window.location.pathname, window.location.search) : "";
  return `${origin}${screenPath(screenKey)}${utm}`;
}

// 화면 키 → 사람용 한국어 제목(GA "페이지 및 화면" 보고서에 그대로 노출)
const SCREEN_TITLES: Record<string, string> = {
  home: "홈",
  ratio: "비중 미리보기",
  "guide:stock-ratio": "가이드·주식 비중",
  "guide:net-worth": "가이드·순자산 정리",
  "guide:year-end": "가이드·올해 결산",
  "guide:market-history": "가이드·시장 역사",
  "guide:index-returns-by-year": "가이드·연도별 수익률",
  "guide:rate-hike-years": "가이드·금리 인상기",
  "guide:recession-years": "가이드·경기침체",
  "guide:yield-spread-years": "가이드·금리차",
  "guide:recovery-years": "가이드·회복 기간",
  "guide:kospi-by-year": "가이드·코스피",
  "guide:monthly-buying": "가이드·매달 나눠 넣기",
  more: "더보기",
  settings: "설정",
  tax: "세금 관리",
  "detail:hub": "상세",
  "detail:stocks": "상세·주식",
  "detail:stocks-xray": "상세·주식 X-Ray",
  "detail:stocks-trades": "상세·주식 거래내역",
  "detail:stocks-item": "상세·주식·종목",
  "detail:real-estate": "상세·부동산",
  "detail:crypto": "상세·암호화폐",
  "detail:crypto-transactions": "상세·암호화폐 거래내역",
  "detail:cash": "상세·현금",
  "detail:cash-transactions": "상세·현금 거래내역",
  "detail:loans": "상세·대출",
  "detail:loan-transactions": "상세·대출 거래내역",
  "activity:hub": "성과",
  "activity:change": "성과·자산 변화",
  "activity:change-market": "성과·자산 변화·시장 비교",
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
  physical: "실물 자산",
  yearly_net_asset: "연도별 순자산",
};

// feature_use는 category로 기능 이름을 정한다. ratio_preview는 method·result로 단계별 title(ratioPreviewTitle), 그 밖은 /ratio 화면 title로 귀결
const CATEGORY_TITLES: Partial<Record<NonNullable<GaParams["category"]>, string>> = {
  xray: "X-Ray",
  tax_sim: "절세 시뮬레이션",
  home_tip: "홈 팁",
  home_tip_notify: "홈 팁·알림",
  persist_ok: "저장 보호·허용",
  persist_denied: "저장 보호·거부",
  whats_new: "새 소식",
  feedback: "의견 보내기",
  theme: "테마 변경",
  ai_prompt: "AI 프롬프트 복사",
  demo: "체험 모드",
  share_card: "인증카드 열기",
  app_guide: "앱 가이드 열기",
  guide_open: "웰컴·가이드 열기",
  install_nudge: "설치 안내",
  install_nudge_tap: "설치 안내 누름",
  sync_overwrite_notice: "동기화 덮임 알림",
  sync_overwrite_undo: "동기화 되돌리기",
  resync_start: "보유 현황 맞추기 시작",
  resync_apply: "보유 현황 맞추기 적용",
  resync_undo: "보유 현황 맞추기 되돌리기",
  balance_resync: "잔액 맞추기 저장",
  resync_continue: "이어서 맞추기",
  save_failed: "저장 실패",
  linked_trade: "거래 저장·계좌 함께 반영",
  change_scope_stock: "성과·자산 변화·주식",
  change_week_all: "성과·자산 변화·최근 7일",
  year_settlement: "성과·자산 변화·올해 결산", // 연 탭 올해 결산 블록이 값과 함께 그려졌을 때 1회(5.124). 금액·비율·상태 미전송
  // 투자 탭(#263): 지수 이름·동작만. 금액·배수·연도·보유 시장은 보내지 않는다
  invest_index_spx: "투자·지수·S&P 500",
  invest_index_ndx: "투자·지수·나스닥100",
  invest_index_kospi: "투자·지수·코스피",
  invest_three: "투자·세 지수",
  invest_decade: "투자·연대별",
  invest_ratio: "투자·내 비중 보기",
  invest_overlay: "투자·겹쳐 보기",
  invest_table: "투자·연도별 표",
  invest_calc: "투자·넣었다면 계산",
  invest_rise_tab: "투자·크게 오른 해",
  invest_pattern: "투자·하락 전 12개월",
  guide_move: "가이드·내 자산 이동",
  invest_year_pick: "투자·해 선택",
  invest_drop_open: "투자·하락 행 펼침",
  invest_phase_table: "투자·국면 표",
  invest_recession: "투자·침체 앞뒤",
  invest_range: "투자·보유 기간",
  invest_my_start: "투자·내 시작 해",
  invest_my_xray: "투자·내 주식 보기",
  stock_sort_rate: "상세·주식·등락률 순",
  relink: "끊긴 거래 다시 잇기",
  settlement_ics: "결산 캘린더 추가",
  home_cause_open: "홈 변동 원인 열기",
  profit_basis_settings: "종가 기준·변경·설정",
  profit_basis_chart: "종가 기준·변경·성과",
  home_market: "홈·오늘 시장", // 내부 판독명(4.90) — 사용자 문구의 '오늘' 금지와 무관
  home_compose_cash: "홈·순자산 구성·현금", // #250 금융 1종만 가진 홈의 현금 추가 누름(값·건수 미전송)
  home_compose_loan: "홈·순자산 구성·대출",
  home_my_stock: "홈·내 종목 오늘", // #246 홈 내 종목 줄 누름(기기 단위). 종목명·등락률·N 미전송
  // 시장 알림(#179) — 켜기·끄기·권한 거부·알림 누름(아침·국내·결산·세금 분리)(기기 단위 판독, 맞춤 정의 0)
  push_on: "알림 켜기",
  push_off: "알림 끄기",
  push_denied: "알림 권한 거부",
  push_click_morning: "알림·누름·아침",
  push_click_kr: "알림·누름·국내",
  push_click_settle: "알림·누름·결산",
  push_click_tax: "알림·누름·세금",
  // 내 자산 불리기(#239) — 매핑이 빠지면 화면 title `성과·자산 성적표`에 섞인다(5.125 5차: 이름 변경, 미머지라 단절 비용 0)
  grow_label: "내 자산 불리기·정함", // 정한 종목 0인 기기가 오래 둘·점검할을 처음 정할 때 1회(주 지표)
  grow_check: "내 자산 불리기·점검", // 점검 한 장에서 선택(그대로 둠·옮김·정하지 않음)으로 점검 기록 1건이 생길 때
  grow_revisit: "내 자산 불리기·다시 봄", // 정한 종목이 있고 가장 이른 정한 날이 오늘보다 앞인 기기가 화면을 열 때(로드당 1회, 저장 키 없음)
  grow_plan: "내 자산 불리기·조건", // 다시 볼 조건·메모를 처음 저장할 때(값·메모 미전송)
  // #242(5.127) — 앞의 4개(정함·점검·다시 봄·조건)는 주식 키만으로 판정한다. 주식 외는 아래 1개로만 잰다
  grow_pick: "내 자산 불리기·내 선택", // 값이 있는 `내 선택` 패널(건수·매수 문장)을 열 때 로드당 1회(주 지표). 종류·건수·종목 미전송
  grow_other_label: "내 자산 불리기·주식 외 정함", // 이 기기의 저장으로 코인·부동산·실물 유효 이름표가 0 → 1이 될 때 1회(동기화 수신은 0)
  // #245(5.130) 내 종목 화면이 내 결정을 안다 — 종목·값·건수 미전송. 판정 지표는 타일 title뿐, 나머지 3개는 관찰용
  home_tip_due: "홈 팁·점검 차례", // 홈 `점검 차례` 팁을 누를 때(기존 `홈 팁·누름`도 함께 나간다)
  stock_decision: "상세·주식·내 결정", // 점검 한 장 진입(종목 한 장 머리·차례 행 펼침 공통)을 누를 때
  stock_check_tile: "상세·주식·내 자산 점검", // 상세·주식 `내 자산 점검` 타일을 누를 때
  stock_decision_view: "상세·주식·내 결정 보임", // 상세·주식 목록에 정한 종목 행이 1개 이상일 때 페이지 수명당 1회(저장 키 0)
  grow_grade_tab: "내 자산 불리기·성적표 탭", // 6차 통합 화면에서 세그먼트 `자산 성적표`를 누를 때(로드당 1회) — 통합이 성적표를 묻었는지 판독
  // #258 처음 사는 종목도 거래로 기록 — 종목·금액·계좌 미전송. 저장 성공 뒤 1회(연결 저장이면 `_linked` 1회 더)
  trade_new_stock: "거래 입력·주식·새 종목",
  trade_new_stock_linked: "거래 입력·주식·새 종목·계좌 반영",
};

// /ratio 홍보 도착 퍼널 단계별 page_title(4.88) — 화면 도착('비중 미리보기')은 화면 title 그대로. 맞춤 정의 0
function ratioPreviewTitle(params: GaParams): string | undefined {
  if (params.method === "open") return "비중 미리보기·브라우저로 열기";
  if (params.method === "sample") return "비중 미리보기·예시";
  if (params.method === "click") return "비중 미리보기·저장 누름";
  if (params.method === "submit") {
    if (params.result === "success") return "비중 미리보기·인식 성공";
    if (params.result === "fail" || params.result === "empty" || params.result === "limit") return "비중 미리보기·인식 실패";
    if (params.result === "create") return "비중 미리보기·저장 완료"; // 인계 후 앱 화면에서 나가도 홈으로 섞이지 않게
  }
  return undefined;
}

// 웰컴 CTA 버튼별 page_title(onboarding_action method → 이름)
const WELCOME_ACTION_TITLES: Partial<Record<NonNullable<GaParams["method"]>, string>> = {
  wizard: "웰컴·스크린샷 등록",
  manual: "웰컴·직접 입력",
  import: "웰컴·가져오기",
  sync_connect: "웰컴·동기화 연결",
  trial_start: "웰컴·체험",
};

/**
 * 이벤트 → GA page_title(사용 기능 이름). 순수 함수.
 * 매핑이 없는 이벤트(삭제·앱 잠금 등)는 현재 화면 title, 화면 title도 없으면 undefined(title 생략).
 */
export function featureTitleOf(eventName: string, params: GaParams, currentScreenKey: string): string | undefined {
  const withAsset = (base: string) => (params.asset_type ? `${base}·${ASSET_TYPE_TITLES[params.asset_type]}` : base);
  switch (eventName) {
    case "welcome_view":
      // 앱 안 브라우저 도착은 분리(5.122 #234) — web·pwa는 '웰컴' 그대로(4.86 분모)
      return params.source === "inapp" ? "웰컴·인앱" : "웰컴";
    case "onboarding_action":
      // 웰컴 버튼별 분리 — 기기 단위로 어느 버튼이 눌렸는지 판독(맞춤 정의 0). 모르는 method는 "웰컴"
      // 체험 복귀(#249) 둘째 건 — 보던 화면의 자산군·성과·상세 꼬리(`웰컴·체험·주식` 등). 꼬리 인자 없으면 `웰컴·체험` 그대로
      if (params.method === "trial_start") {
        if (params.asset_type) return withAsset("웰컴·체험");
        if (params.source === "activity") return "웰컴·체험·성과";
        if (params.source === "detail") return "웰컴·체험·상세";
      }
      return (params.method && WELCOME_ACTION_TITLES[params.method]) || "웰컴";
    case "tutorial_begin":
    case "tutorial_step":
    case "tutorial_complete":
    case "wizard_step":
      return "온보딩";
    case "asset_add_start":
      return withAsset("자산 추가 시작");
    case "asset_save":
      return withAsset("자산 저장");
    case "first_asset_saved":
      // 기기당 1회 첫 저장은 일반 저장과 분리 — 첫 등록 도달 수를 title만으로 판독(맞춤 정의 0)
      return withAsset("첫 자산 저장");
    case "screenshot_parse":
      // 실패·빈 결과는 별도 title — 첫 등록 병목이 이 화면인지 판정(#99). success·limit은 현행
      return withAsset(params.result === "fail" || params.result === "empty" ? "스크린샷 등록 실패" : "스크린샷 등록");
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
      // '앱 설치'는 설치 완료(installed)만(5.122 #234). 인앱 외부 이동 누름·설치창(보임·수락·거절)은 별도 title
      if (params.method === "inapp_move") return "인앱·외부 이동";
      if (params.method === "prompt_view" || params.method === "accepted" || params.method === "dismissed") return "앱 설치·설치창";
      return "앱 설치";
    case "settlement_view":
      return "월 결산";
    case "theme_mode":
      return params.theme === "dark" ? "다크 모드 사용" : "라이트 모드 사용";
    case "feature_use": {
      // 홈 팁 누름은 보임·닫기와 분리 — 도착 전환 판독(새 파라미터 값 0)
      if (params.category === "home_tip_notify" && params.method === "click") return "홈 팁·알림·누름";
      if (params.category === "home_tip" && params.method === "click") return "홈 팁·누름";
      // 홈 7일 카드 누름(4.90)은 자산 변화 화면 진입 이벤트(source 없음·home_tip·whats_new)와 분리 — home_tip·whats_new 출처는 기존 title 유지
      if (params.category === "change_week_all" && params.source === "home_week") return "홈·7일";
      if (params.category === "ratio_preview") {
        const r = ratioPreviewTitle(params);
        if (r) return r;
        break;
      }
      // 가이드에서 시작한 체험은 웰컴 '체험 모드'와 분리(4.88)
      if (params.category === "demo" && currentScreenKey.startsWith("guide:")) return "가이드·체험";
      // 인앱 웰컴에서 시작한 체험(5.122 #234) — 진입점은 칩 1개(5.123), title '체험 모드·인앱'
      if (params.category === "demo" && params.source === "inapp") return "체험 모드·인앱";
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
    const prevKey = lastTrackedScreenKey;
    lastTrackedScreenKey = viewKey;
    const gtag = getGtag();
    if (!gtag) return;
    // 직전 화면 참여 시간 귀속(#131) — gtag는 직전 전송 이후 쌓인 참여 시간(_et)을 "다음에 나가는 이벤트"에 싣는다.
    // 새 화면 page_view가 먼저 나가면 이전 화면에 머문 시간이 새 title로 붙으므로, 직전 화면의 title·경로로
    // 비예약 커스텀 이벤트 screen_leave를 먼저 보내 그 시간을 털어낸다(user_engagement는 GA4 예약명이라 수동 전송 시 버려질 수 있음). page_view(조회수·활성 사용자) 호출은 그대로다.
    if (prevKey) {
      const flush: Record<string, unknown> = {
        page_location: pageLocation(prevKey),
        page_path: screenPath(prevKey),
        page_title: SCREEN_TITLES[prevKey] ?? prevKey,
      };
      if (isDebug()) flush.debug_mode = true;
      gtag("event", "screen_leave", flush);
    }
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
export function countAssets(data: Pick<AssetData, "stocks" | "crypto" | "cash" | "loans" | "realEstate"> & { physicalAssets?: unknown[] } | null | undefined): number {
  if (!data) return 0;
  return (data.stocks?.length ?? 0) + (data.crypto?.length ?? 0) + (data.cash?.length ?? 0) + (data.loans?.length ?? 0) + (data.realEstate?.length ?? 0) + (data.physicalAssets?.length ?? 0);
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
