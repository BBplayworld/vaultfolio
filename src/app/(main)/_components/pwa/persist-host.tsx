"use client";

// 렌더 없는 Host — 데이터 로드 완료 + 자산 있음이면 저장 보호(persist)를 1회 요청한다(5.115).
import { useEffect } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { ensureStoragePersist } from "@/lib/pwa/persist-storage";

export function PersistHost() {
  const { assetData, getAssetSummary, isDataLoaded } = useAssetData();
  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;

  useEffect(() => {
    if (!isDataLoaded || !hasAssets || isTrialMode()) return;
    void ensureStoragePersist();
  }, [isDataLoaded, hasAssets]);

  return null;
}
