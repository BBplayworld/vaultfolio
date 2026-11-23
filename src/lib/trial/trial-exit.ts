/**
 * trial/trial-exit.ts — 체험 종료 → 복귀 웰컴 전달값(#249). 순수 함수 + Storage 주입 읽기·쓰기만.
 * 넣는 값은 화면 키(viewToKey 결과 고정 문자열)뿐 — 종목·금액·건수·자산 데이터 0. URL·localStorage 0.
 * 허용 목록 밖 값·빈 값·읽기 실패는 전부 '없음'(= 현행 복귀). 대조는 Map(프로토타입 키 통과 금지).
 */

import { TRIAL_EXIT_FROM_KEY, TRIAL_EXIT_KEY } from "./trial-mode";

/** 복귀 등록 칸 시작 상태 — 웰컴 직접 입력 행 type과 같은 낱말 */
export type TrialExitAsset = "stock" | "crypto" | "cash" | "loan" | "real-estate";

/** GA 꼬리 인자 — asset_type(자산군) 또는 source(성과·상세). page_title 결정에만 쓰인다 */
export type TrialExitGa =
  | { asset_type: "stock" | "crypto" | "cash" | "loan" | "real_estate" | "physical" }
  | { source: "activity" | "detail" | "invest" };

export interface TrialExitTarget {
  asset: TrialExitAsset | null;
  ga: TrialExitGa | null;
}

const NONE: TrialExitTarget = { asset: null, ga: null };

const entries = (keys: string[], v: TrialExitTarget) => keys.map((k) => [k, v] as const);

/** 화면 키 → 등록 칸 상태·GA 꼬리 (spec 3-2 표) */
const TRIAL_EXIT_TARGETS = new Map<string, TrialExitTarget>([
  ...entries(["detail:stocks", "detail:stocks-xray", "detail:stocks-trades", "detail:stocks-item"], { asset: "stock", ga: { asset_type: "stock" } }),
  ...entries(["detail:crypto", "detail:crypto-transactions"], { asset: "crypto", ga: { asset_type: "crypto" } }),
  ...entries(["detail:cash", "detail:cash-transactions"], { asset: "cash", ga: { asset_type: "cash" } }),
  ...entries(["detail:loans", "detail:loan-transactions"], { asset: "loan", ga: { asset_type: "loan" } }),
  ...entries(["detail:real-estate"], { asset: "real-estate", ga: { asset_type: "real_estate" } }),
  ...entries(["detail:physical"], { asset: null, ga: { asset_type: "physical" } }),
  ...entries(["activity:hub", "activity:change", "activity:change-market", "activity:dividend", "activity:report"], { asset: null, ga: { source: "activity" } }),
  ...entries(["detail:hub", "tax"], { asset: null, ga: { source: "detail" } }),
  // 5.141 T2: 투자 탭에서 체험을 끝내면 `웰컴·체험·투자` 꼬리(문구·등록 칸 변화 0)
  ...entries(["invest"], { asset: null, ga: { source: "invest" } }),
]);

/** 화면 키 → 복귀 상태. home·more·settings·모르는 값·빈 값은 없음(현행) */
export function resolveTrialExit(viewKey: unknown): TrialExitTarget {
  if (typeof viewKey !== "string" || !viewKey) return NONE;
  return TRIAL_EXIT_TARGETS.get(viewKey) ?? NONE;
}

type SessionLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 체험 페이지 시작 누름(비인앱) — 둘째 키 → trial_exit 순으로 기록. 실패는 호출처가 무시(일반 웰컴 복귀) */
export function writeTrialExit(storage: SessionLike, viewKey: string): void {
  storage.setItem(TRIAL_EXIT_FROM_KEY, viewKey);
  storage.setItem(TRIAL_EXIT_KEY, "1");
}

/**
 * 복귀 웰컴 1회 소비 — trial_exit가 "1"일 때만 둘째 값을 읽고 두 키를 함께 지운다.
 * trial_exit가 없으면 둘째 키만 지운다(읽지 않음). 읽기 실패는 복귀 아님(현행 catch와 같음).
 */
export function consumeTrialExit(storage: SessionLike): { returned: boolean; from: string | null } {
  try {
    if (storage.getItem(TRIAL_EXIT_KEY) !== "1") {
      try { storage.removeItem(TRIAL_EXIT_FROM_KEY); } catch { /* 무시 */ }
      return { returned: false, from: null };
    }
    let from: string | null = null;
    try { from = storage.getItem(TRIAL_EXIT_FROM_KEY); } catch { /* 값 없음 = 현행 */ }
    storage.removeItem(TRIAL_EXIT_KEY);
    try { storage.removeItem(TRIAL_EXIT_FROM_KEY); } catch { /* 무시 */ }
    return { returned: true, from };
  } catch {
    return { returned: false, from: null };
  }
}
