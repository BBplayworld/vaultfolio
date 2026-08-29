// 홈 알림/팁 통합 판정 (S-4.32 후속) — 백업·세금·자산 최신화·기능 팁 4종을 위험도 순으로 1개만 고른다.
// 판정 로직 자체는 기존 순수 함수를 그대로 재사용 — 여기서는 우선순위대로 조합만 한다.

import type { AssetData } from "@/types/asset";
import { shouldShowBackupNudge, daysSinceBackup } from "./asset/backup-status";
import { shouldShowRefreshNudge, getStaleCategories, type RefreshCategory } from "./asset/asset-refresh-status";
import { isTaxNoticeDismissed, getAssetDrivenHighlights, type TaxEventMatch } from "./tax-utils";
import { pickRecommendedFeature } from "./feature-usage";
import type { AppFeature } from "@/config/app-features";

export type HomeTip =
  | { kind: "backup"; days: number | null }
  | { kind: "tax"; matches: TaxEventMatch[] }
  | { kind: "refresh"; staleCategories: RefreshCategory[] }
  | { kind: "feature"; feature: AppFeature };

export interface HomeTipInputs {
  assetData: AssetData;
  hasAssets: boolean;
  syncArmed: boolean;
}

// 위험도 순: 데이터 손실 위험(백업) > 마감 시한(세금) > 자산 최신화 > 신규 기능 > 저방문 기능
export function pickHomeTip({ assetData, hasAssets, syncArmed }: HomeTipInputs): HomeTip | null {
  if (shouldShowBackupNudge({ hasAssets, syncArmed, assetLastUpdated: assetData.lastUpdated })) {
    return { kind: "backup", days: daysSinceBackup() };
  }

  if (!isTaxNoticeDismissed()) {
    const matches = getAssetDrivenHighlights(assetData);
    if (matches.length > 0) return { kind: "tax", matches };
  }

  if (shouldShowRefreshNudge({ hasAssets, assetLastUpdated: assetData.lastUpdated })) {
    return { kind: "refresh", staleCategories: getStaleCategories(assetData.lastUpdated) };
  }

  const feature = pickRecommendedFeature();
  if (feature) return { kind: "feature", feature };

  return null;
}
