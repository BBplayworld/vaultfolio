/**
 * preview/demo-inject.ts
 * 데모 금고 주입 공용 절차 — preview 게이트(#31, ?demo=1)와 체험 게이트(#59, ?trial=1)가 함께 쓴다.
 * 데모 JSON은 이 파일에서만 동적 import한다(운영 번들 미포함, preview-safety 9번).
 * 저장은 호출 시점의 전역 localStorage로 간다 — 체험은 메모리 Storage 설치·검증 뒤에만 호출해야 한다.
 */

import { applyImportedPayload, clearPhysicalAssets, STORAGE_KEYS } from "@/lib/asset/asset-storage";
import { buildDemoRefreshMeta, kstToday, materializeDemo } from "@/lib/preview/demo-payload";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { markCurrentNoticeSeen } from "@/lib/home-tip";

/**
 * 데모 payload 주입 — 검증 실패 시 applyImportedPayload가 기존 데이터를 지우기 전에 throw한다.
 * nickname을 주면 주입본의 닉네임만 바꾼다(체험 #59: "" → Hero 기본 라벨 "순자산"). 데모 JSON 원본은 바꾸지 않는다.
 */
export async function injectDemoPayload({ nickname }: { nickname?: string } = {}): Promise<void> {
  const mod = await import("@/lib/preview/demo-data.json");
  const payload = materializeDemo(mod.default, kstToday());
  const next = nickname === undefined ? payload : withNickname(payload, nickname);
  applyImportedPayload(next);
  // 데모 주입은 교체 의미 — 데모 payload에 실물 키가 없으면(applyImportedPayload는 키 없음=로컬 유지) 기존 실물을 비운다(#58)
  const ad = (next as { assetData?: { physicalAssets?: unknown } }).assetData;
  if (!Array.isArray(ad?.physicalAssets)) clearPhysicalAssets();
  // assetRefresh는 clearAssetData의 보존 키라 import로 덮이지 않음 → 기존 키·형식으로 직접 기록(멱등)
  localStorage.setItem(STORAGE_KEYS.assetRefresh, JSON.stringify(buildDemoRefreshMeta()));
}

// materializeDemo 결과(새 객체)의 최상위·assetData 닉네임만 교체한 사본
function withNickname(payload: unknown, nickname: string): unknown {
  const p = payload as Record<string, unknown>;
  const assetData = p.assetData && typeof p.assetData === "object" ? { ...(p.assetData as Record<string, unknown>), nickname } : p.assetData;
  return { ...p, nickname, assetData };
}

/**
 * 데모 주입 직후: 튜토리얼 전체 건너뛰기(가져오기와 같은 skipAllTutorialSteps) + 현재 공지 읽음(GA 없음).
 * marker가 있으면 그 키에 "1"을 기록한다(preview 전용 표식 — 체험은 쓰지 않음).
 */
export function skipDemoTutorial({ marker }: { marker?: string } = {}): void {
  skipAllTutorialSteps();
  markCurrentNoticeSeen({ track: false });
  if (marker) localStorage.setItem(marker, "1");
  tutorialStore.getState().initTutorial();
}

/** 처리한 쿼리 제거 — 새로고침 시 재주입 방지. 해시·나머지 쿼리는 유지 */
export function stripQueryParams(keys: string[]): void {
  const url = new URL(window.location.href);
  for (const k of keys) url.searchParams.delete(k);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
