"use client";

import { useAssetData } from "@/contexts/asset-data-context";
import { generateShareToken, STORAGE_KEYS, collectSnapshotsFromStorage } from "@/lib/asset-storage";
import { getProfitBasis } from "@/lib/profit-utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

/** 일별·월별 순자산 스냅샷 수집 — 정본은 asset-storage.collectSnapshotsFromStorage */
export { collectSnapshotsFromStorage as collectSnapshots };

/**
 * 공유 토큰 생성 → 서버 저장 → { url(start_url용), code(복원 코드용) } 반환.
 * PWA 설치 흐름·인앱 브라우저 게이트에서 공용 재사용한다.
 */
export function useShareArtifacts() {
  const { assetData, exchangeRates } = useAssetData();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const nickname = assetData.nickname || "";

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  /** 자산 없거나 서버 실패 시 null. pin이 있으면 v72Z(Zero-Knowledge), 없으면 서버 저장 거부됨. */
  const generateShareArtifacts = async (
    pin?: string,
  ): Promise<{ url: string; code: string } | null> => {
    if (!hasAssets) return null;

    const localKey = Math.random().toString(36).substring(2, 14);
    const token = generateShareToken(
      assetData, exchangeRates, pin || undefined, localKey,
      collectSnapshotsFromStorage(), getProfitBasis(), nickname || undefined,
    );

    const ownerId = localStorage.getItem(STORAGE_KEYS.shareOwnerId) ?? undefined;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, owner_id: ownerId }),
      });
      const json = await res.json() as { key?: string; owner_id?: string };
      if (json.owner_id) {
        localStorage.setItem(STORAGE_KEYS.shareOwnerId, json.owner_id);
      }
      if (json.key) {
        const code = `share:${json.key}_${localKey}`;
        return { url: `/#share=${code}&theme=${themeMode}`, code };
      }
    } catch {
      // 서버 실패 시 start_url 없이 폴백
    }
    return null;
  };

  return { generateShareArtifacts, hasAssets };
}
