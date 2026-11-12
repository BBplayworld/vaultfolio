// 기능 방문 기록 + 홈 "기능 활용 팁" 추천 로직 (신규 기능 릴리스 알림용, S-4.32).
// onboarding-wizard-status.ts와 동일한 "단일 키 + JSON 객체" 패턴. 기기 로컬 전용 — 서버 미전송,
// sync payload(buildExportPayload)에 포함하지 않는다(R14 패턴). 동의 UI 불필요(기존 로컬 전용 키들과 동일 원칙).

import { STORAGE_KEYS } from "./local-storage";
import { APP_FEATURES, type AppFeature } from "@/config/app-features";
import type { AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";
import { track } from "@/lib/analytics/ga";
import { isTaxSimCandidate } from "@/lib/tax-utils";
import type { AssetData } from "@/types/asset";

interface FeatureUsageState {
  visits: Record<string, { count: number; lastVisitedAt: string }>;
  dismissedTipIds: string[];
}

const DEFAULT_STATE: FeatureUsageState = { visits: {}, dismissedTipIds: [] };

// AssetView → 방문 집계 버킷 키. "type" 또는 "type:tab" — 카탈로그 항목의 target과 1:1 대응.
export function viewToKey(view: AssetView): string {
  if (view.type === "detail" || view.type === "activity") return `${view.type}:${view.tab}`;
  return view.type;
}

function readState(): FeatureUsageState {
  if (typeof window === "undefined") return { visits: {}, dismissedTipIds: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.featureUsage);
    if (!raw) return { visits: {}, dismissedTipIds: [] };
    const parsed = JSON.parse(raw) as Partial<FeatureUsageState>;
    return {
      visits: parsed.visits && typeof parsed.visits === "object" ? parsed.visits : {},
      dismissedTipIds: Array.isArray(parsed.dismissedTipIds) ? parsed.dismissedTipIds : [],
    };
  } catch {
    return { visits: {}, dismissedTipIds: [] };
  }
}

function writeState(state: FeatureUsageState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.featureUsage, JSON.stringify(state));
  } catch { /* 저장 실패 무시 */ }
}

// 문자열 키를 직접 받는다 — navigate() 훅뿐 아니라 action형(인증카드 등) 항목도 자체 키로 기록 가능.
export function recordVisit(key: string): void {
  if (typeof window === "undefined") return;
  const state = readState();
  const prev = state.visits[key];
  state.visits[key] = { count: (prev?.count ?? 0) + 1, lastVisitedAt: new Date().toISOString() };
  writeState(state);
}

// 한 방문 키의 마지막 방문 시각(ISO) — `새` 표시 꺼짐 판정용. 기록 없으면 undefined
export function getLastVisitedAt(key: string): string | undefined {
  return readState().visits[key]?.lastVisitedAt;
}

export function isTipDismissed(id: string): boolean {
  return readState().dismissedTipIds.includes(id);
}

// 영구 dismiss — 재노출 없음(앱의 기존 "반복 리마인드 지양" 기조와 일치)
export function dismissTip(id: string): void {
  const state = readState();
  if (state.dismissedTipIds.includes(id)) return;
  state.dismissedTipIds.push(id);
  writeState(state);
}

function visitCountOf(feature: AppFeature, visits: FeatureUsageState["visits"]): number {
  const key = feature.visitKey ?? (feature.target ? viewToKey(feature.target) : feature.id);
  return visits[key]?.count ?? 0;
}

type TipHoldings = Pick<AssetData, "stocks" | "realEstate" | "crypto" | "cash" | "loans">;

const hasStock = (a: TipHoldings) => a.stocks.some((s) => s.quantity > 0);

// 보유 조건(#170): featureId → 조건. 표에 없는 항목은 항상 통과. 수량·건수만 쓴다(날짜·이름 금지).
const HOLDING_CONDITIONS: Record<string, (a: TipHoldings) => boolean> = {
  "tax-simulator": (a) => a.stocks.some(isTaxSimCandidate),
  stocks: hasStock,
  "stocks-xray": hasStock,
  dividend: hasStock,
  "market-compare": hasStock,
  "share-card": hasStock,
  "share-card-portfolio": hasStock,
  "share-card-type": hasStock,
  "real-estate": (a) => a.realEstate.length > 0,
  crypto: (a) => a.crypto.length > 0,
  cash: (a) => a.cash.length > 0,
  loans: (a) => a.loans.length > 0,
};

// dismiss 안 된 항목 중 보유 조건을 통과한 것의 방문횟수 오름차순(0회 우선),
// 동률은 카탈로그 순서. 후보 0이면 null(박스가 조용히 사라짐). 걸러진 항목은 dismiss 기록 없음.
// excludeIds = 이번 판정에서만 후보에서 빼는 id(홈 지수 종가 줄이 이미 입구일 때 '시장과 비교', 4.90) — dismiss 기록은 쓰지 않아 억제가 풀리면 되살아난다
export function pickRecommendedFeature(assetData: TipHoldings, excludeIds: readonly string[] = []): AppFeature | null {
  const state = readState();
  // tip:false 항목(새 소식 바로 가기 전용, 4.83)은 추천 후보에서 뺀다
  const candidates = APP_FEATURES.filter(
    (f) => f.tip !== false && !excludeIds.includes(f.id) && !state.dismissedTipIds.includes(f.id) && (HOLDING_CONDITIONS[f.id]?.(assetData) ?? true),
  );
  if (candidates.length === 0) return null;

  let best: AppFeature | null = null;
  let bestCount = Infinity;
  for (const f of candidates) {
    const count = visitCountOf(f, state.visits);
    if (count < bestCount) {
      best = f;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 기능 항목의 기존 이동 실행 — 홈 기능 팁(source=home_tip)과 새 소식 바로 가기(source=whats_new)가 공유.
 * dismiss는 하지 않는다(호출부 몫). action형은 action만, 그 외는 beforeNavigate → entryCategory GA(4.79) → target 이동.
 */
export function runFeatureEntry(feature: AppFeature, navigate: (view: AssetView) => void, source: "home_tip" | "whats_new"): void {
  if (feature.action) {
    feature.action();
    return;
  }
  feature.beforeNavigate?.();
  if (feature.entryCategory) track("feature_use", { category: feature.entryCategory, source });
  if (feature.target) navigate(feature.target);
}
