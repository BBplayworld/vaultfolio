/**
 * preview/demo-inject.ts
 * 데모 금고 주입 공용 절차 — preview 게이트(#31, ?demo=1)와 체험 게이트(#59, ?trial=1)가 함께 쓴다.
 * 데모 JSON은 이 파일에서만 동적 import한다(운영 번들 미포함, preview-safety 9번).
 * 저장은 호출 시점의 전역 localStorage로 간다 — 체험은 메모리 Storage 설치·검증 뒤에만 호출해야 한다.
 */

import { applyImportedPayload, clearPhysicalAssets, STORAGE_KEYS } from "@/lib/asset/asset-storage";
import { buildDemoRefreshMeta, kstToday, materializeDemo } from "@/lib/preview/demo-payload";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { getClassification, upsertClassifications, type StockClassification } from "@/lib/xray/classification-store";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";

/**
 * 데모 payload 주입 — 검증 실패 시 applyImportedPayload가 기존 데이터를 지우기 전에 throw한다.
 * nickname을 주면 주입본의 닉네임만 바꾼다(체험 #59: "" → Hero 기본 라벨 "순자산"). 데모 JSON 원본은 바꾸지 않는다.
 * mode = 주입 모드(preview 게이트 "demo" / 체험 게이트 "trial"). 체험에는 등급 기록 시드를 넣지 않는다(withoutSeedGrades).
 */
export async function injectDemoPayload({ nickname, mode = "demo" }: { nickname?: string; mode?: "demo" | "trial" } = {}): Promise<void> {
  const mod = await import("@/lib/preview/demo-data.json");
  const materialized = materializeDemo(mod.default, kstToday());
  const payload = mode === "trial" ? withoutSeedGrades(materialized) : materialized;
  const next = nickname === undefined ? payload : withNickname(payload, nickname);
  applyImportedPayload(next);
  // 데모 주입은 교체 의미 — 데모 payload에 실물 키가 없으면(applyImportedPayload는 키 없음=로컬 유지) 기존 실물을 비운다(#58)
  const ad = (next as { assetData?: { physicalAssets?: unknown } }).assetData;
  if (!Array.isArray(ad?.physicalAssets)) clearPhysicalAssets();
  // assetRefresh는 clearAssetData의 보존 키라 import로 덮이지 않음 → 기존 키·형식으로 직접 기록(멱등)
  localStorage.setItem(STORAGE_KEYS.assetRefresh, JSON.stringify(buildDemoRefreshMeta()));
  // X-Ray 분류 캐시(기기 캐시, 백업·동기화 대상 아님) — 비어 있는 필드만 채운다. 이미 받은 분류는 덮지 않는다(#239 5.125)
  upsertClassifications(demoClassificationPatches((next as { xrayClassifications?: unknown }).xrayClassifications, getClassification));
}

/** 데모 시드 분류 → 캐시에 없는 필드만 담은 패치(순수). `_comment` 같은 밑줄 키·객체가 아닌 값은 건너뛴다 */
export function demoClassificationPatches(
  seed: unknown,
  current: (ticker: string) => StockClassification | undefined,
): Record<string, StockClassification> {
  const out: Record<string, StockClassification> = {};
  if (!seed || typeof seed !== "object") return out;
  for (const [ticker, v] of Object.entries(seed as Record<string, unknown>)) {
    if (ticker.startsWith("_") || !v || typeof v !== "object") continue;
    const cur = current(ticker) ?? {};
    const patch = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => cur[k] === undefined));
    if (Object.keys(patch).length > 0) out[ticker] = patch as StockClassification;
  }
  return out;
}

/** 오늘 기준으로 materialize한 데모 payload(주입본과 같은 날짜) — 주입하지 않고 읽기만 한다. 데모 이름표 가격 재기준(#239 5.125)이 시드 값을 얻는 데 쓴다 */
export async function loadDemoPayload(): Promise<Record<string, unknown>> {
  const mod = await import("@/lib/preview/demo-data.json");
  return materializeDemo(mod.default, kstToday());
}

/**
 * 등급 기록 시드(snapshots의 grade, #239 6차)를 뺀 사본 — 체험 전용. 체험은 JSON 시세로 계산한 등급이 시드와 달라
 * 실제로 없는 `▲ 0.5 … 대비` 변화가 생기고, 첫 허브 `등급 보기`가 새 기기 실사용자와 같은 상태라 시드를 넣지 않는다(오케스트레이터 판단 11/18).
 */
export function withoutSeedGrades(payload: unknown): unknown {
  const p = payload as Record<string, unknown>;
  const snaps = p.snapshots as { daily?: unknown[]; monthly?: unknown[] } | undefined;
  if (!snaps || typeof snaps !== "object") return payload;
  const strip = (rows: unknown[] | undefined) => rows?.map((r) => {
    if (!r || typeof r !== "object" || !("grade" in r)) return r;
    const { grade: _g, ...rest } = r as Record<string, unknown>;
    return rest;
  });
  return { ...p, snapshots: { ...snaps, ...(snaps.daily ? { daily: strip(snaps.daily) } : {}), ...(snaps.monthly ? { monthly: strip(snaps.monthly) } : {}) } };
}

// materializeDemo 결과(새 객체)의 최상위·assetData 닉네임만 교체한 사본
function withNickname(payload: unknown, nickname: string): unknown {
  const p = payload as Record<string, unknown>;
  const assetData = p.assetData && typeof p.assetData === "object" ? { ...(p.assetData as Record<string, unknown>), nickname } : p.assetData;
  return { ...p, nickname, assetData };
}

/**
 * 데모 주입 직후: 튜토리얼 전체 건너뛰기(가져오기와 같은 skipAllTutorialSteps). 새 소식 읽음은 기록하지 않는다(#159 — 새 브라우저 데모는 새 소식 팁이 첫 팁).
 * marker가 있으면 그 키에 "1"을 기록한다(preview 전용 표식 — 체험은 쓰지 않음).
 */
export function skipDemoTutorial({ marker }: { marker?: string } = {}): void {
  skipAllTutorialSteps();
  if (marker) localStorage.setItem(marker, "1");
  tutorialStore.getState().initTutorial();
}

/** 처리한 쿼리 제거 — 새로고침 시 재주입 방지. 해시·나머지 쿼리는 유지 */
export function stripQueryParams(keys: string[]): void {
  const url = new URL(window.location.href);
  for (const k of keys) url.searchParams.delete(k);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
