// 홈 알림/팁 통합 판정 (S-4.32 후속) — 새 공지·백업·세금·자산 최신화·기능 팁 5종을 우선순위대로 1개만 고른다.
// 판정 로직 자체는 기존 순수 함수를 그대로 재사용 — 여기서는 우선순위대로 조합만 한다.
// 새 공지는 "필수 노출"(#4.24) — 신규 버전 업데이트 안내는 사용자가 실제로 보거나 닫기 전까지
// 다른 어떤 팁보다도 먼저 반드시 뜬다(안전 안내인 백업·세금보다도 우선).

import type { AssetData } from "@/types/asset";
import { shouldShowBackupNudge, daysSinceBackup } from "./asset/backup-status";
import { shouldShowRefreshNudge, getStaleCategories, type RefreshCategory } from "./asset/asset-refresh-status";
import { isTaxNoticeDismissed, getAssetDrivenHighlights, type TaxEventMatch } from "./tax-utils";
import { pickRecommendedFeature } from "./feature-usage";
import { readNoticeSeenId, markNoticeSeen } from "./local-storage";
import { NOTICE_ID } from "@/app/(main)/_components/layout/onboarding/notice";
import type { AppFeature } from "@/config/app-features";

export type HomeTip =
  | { kind: "backup"; days: number | null }
  | { kind: "tax"; matches: TaxEventMatch[] }
  | { kind: "refresh"; staleCategories: RefreshCategory[] }
  | { kind: "notice" }
  | { kind: "feature"; feature: AppFeature };

// 공지 열람 기록 TTL — 이 기간이 지나면 같은 버전이라도 "안 본 것"으로 되돌아가 다시 노출된다(안전장치).
// 보통은 다음 NOTICE_ID 변경 전에 사용자가 이미 클릭/닫기로 열람 처리하므로 실질적으로는 버전이 바뀔 때만 재노출된다.
const NOTICE_SEEN_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90일

/** 홈 팁·더보기 메뉴 등 "공지를 봤다"고 기록하는 모든 지점이 공유하는 단일 출처. */
export function markCurrentNoticeSeen(): void {
  markNoticeSeen(NOTICE_ID, Date.now() + NOTICE_SEEN_TTL_MS);
}

/**
 * 아직 최초 1회도 노출·열람되지 않은 새 공지가 있는지 — `home-tip-box.tsx`가 이 값이 true인 동안은
 * 다른 팁을 닫아서 생긴 세션 숨김 플래그(`SESSION_DISMISS_KEY`)를 무시하고 공지를 강제로 띄운다
 * (다른 팁의 X 닫기가 공지의 "최초 1회 노출" 보장을 가로막지 않게).
 */
export function isNoticeUnseen(): boolean {
  return readNoticeSeenId() !== NOTICE_ID;
}

export interface HomeTipInputs {
  assetData: AssetData;
  hasAssets: boolean;
  syncArmed: boolean;
}

// 새 공지(신규 버전 업데이트 안내)는 필수 노출 — 다른 어떤 안내보다 먼저 반드시 한 번은 뜬다.
// 그 다음은 위험도 순: 데이터 손실 위험(백업) > 마감 시한(세금) > 자산 최신화 > 신규 기능 > 저방문 기능
export function pickHomeTip({ assetData, hasAssets, syncArmed }: HomeTipInputs): HomeTip | null {
  if (isNoticeUnseen()) {
    return { kind: "notice" };
  }

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
