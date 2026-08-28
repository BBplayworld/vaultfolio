// 기능 방문 기록 + 홈 "기능 활용 팁" 추천 로직 (신규 기능 릴리스 알림용, S-4.32).
// onboarding-wizard-status.ts와 동일한 "단일 키 + JSON 객체" 패턴. 기기 로컬 전용 — 서버 미전송,
// sync payload(buildExportPayload)에 포함하지 않는다(R14 패턴). 동의 UI 불필요(기존 로컬 전용 키들과 동일 원칙).

import { STORAGE_KEYS } from "./local-storage";
import { APP_FEATURES, type AppFeature } from "@/config/app-features";
import type { AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";

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

// 1순위: dismiss 안 된 isNew 항목(카탈로그 순서) — 2순위: dismiss 안 된 항목 중 방문횟수 오름차순(0회 우선),
// 동률은 카탈로그 순서. 전부 dismiss면 null(박스가 조용히 사라짐).
export function pickRecommendedFeature(): AppFeature | null {
  const state = readState();
  const candidates = APP_FEATURES.filter((f) => !state.dismissedTipIds.includes(f.id));
  if (candidates.length === 0) return null;

  const fresh = candidates.find((f) => f.isNew);
  if (fresh) return fresh;

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
