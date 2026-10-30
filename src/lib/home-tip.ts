// 홈 알림/팁 통합 판정 (S-4.32 후속) — 새 공지·백업·세금·결산(#4.36)·자산 최신화·기능 팁 6종을 우선순위대로 1개만 고른다.
// 판정 로직 자체는 기존 순수 함수를 그대로 재사용 — 여기서는 우선순위대로 조합만 한다.
// 새 공지는 "필수 노출"(#4.24) — 신규 버전 업데이트 안내는 사용자가 실제로 보거나 닫기 전까지
// 다른 어떤 팁보다도 먼저 반드시 뜬다(안전 안내인 백업·세금보다도 우선).

import type { AssetData } from "@/types/asset";
import { track } from "@/lib/analytics/ga";
import { shouldShowBackupNudge, daysSinceBackup } from "./asset/backup-status";
import { shouldShowRefreshNudge, getStaleCategories, type RefreshCategory } from "./asset/asset-refresh-status";
import { isTaxNoticeDismissed, getAssetDrivenHighlights, isImminentTaxMatch, todayKst, type TaxEventMatch } from "./tax-utils";
import { pickRecommendedFeature } from "./feature-usage";
import { readNoticeSeenId, markNoticeSeen } from "./local-storage";
import { readMonthlySnapshots } from "./asset/snapshot-storage";
import { pickSettlementCard, type SettlementWindow } from "./report/settlement";
import { NOTICE_ID } from "@/app/(main)/_components/layout/onboarding/notice";
import type { AppFeature } from "@/config/app-features";

export type HomeTip =
  | { kind: "backup"; days: number | null }
  | { kind: "tax"; matches: TaxEventMatch[] }
  | { kind: "settlement"; window: SettlementWindow; today: string } // today = 판정에 쓴 KST 날짜(문구 N월 계산도 같은 값)
  | { kind: "refresh"; staleCategories: RefreshCategory[] }
  | { kind: "notice" }
  | { kind: "feature"; feature: AppFeature };

// 공지 열람 기록 TTL — 이 기간이 지나면 같은 버전이라도 "안 본 것"으로 되돌아가 다시 노출된다(안전장치).
// 보통은 다음 NOTICE_ID 변경 전에 사용자가 이미 클릭/닫기로 열람 처리하므로 실질적으로는 버전이 바뀔 때만 재노출된다.
const NOTICE_SEEN_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90일

/**
 * 홈 팁·더보기 메뉴 등 "공지를 봤다"고 기록하는 모든 지점이 공유하는 단일 출처.
 * track=false: 홈 팁 X 닫기·preview 데모 주입(#4.36) — 열람 기록만 남기고 GA notice view는 보내지 않는다(열람 지표와 섞지 않음)
 */
export function markCurrentNoticeSeen({ track: sendView = true }: { track?: boolean } = {}): void {
  markNoticeSeen(NOTICE_ID, Date.now() + NOTICE_SEEN_TTL_MS);
  if (sendView) track("feature_use", { category: "notice", method: "view" });
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
  today?: string; // KST YYYY-MM-DD — 테스트 고정용, 기본값 todayKst()
}

// 새 공지(신규 버전 업데이트 안내)는 필수 노출 — 다른 어떤 안내보다 먼저 반드시 한 번은 뜬다.
// 그 다음(#4.36 cto 판정): 백업 > 임박 세금(이번 달 마감 0~6일) > 월 결산 창 > 그 외 세금 > 자산 최신화 > 신규 기능 > 저방문 기능
// 세금을 무조건 위에 두면 이번 달·다음 달 일정이 결산 창 내내 결산을 가린다 — 급한 마감만 결산보다 위
export function pickHomeTip({ assetData, hasAssets, syncArmed, today = todayKst() }: HomeTipInputs): HomeTip | null {
  if (isNoticeUnseen()) {
    return { kind: "notice" };
  }

  if (shouldShowBackupNudge({ hasAssets, syncArmed, assetLastUpdated: assetData.lastUpdated })) {
    return { kind: "backup", days: daysSinceBackup() };
  }

  const taxMatches = isTaxNoticeDismissed() ? [] : getAssetDrivenHighlights(assetData, today);
  if (taxMatches.some((m) => isImminentTaxMatch(m, today))) return { kind: "tax", matches: taxMatches };

  // 결산 창(말일−3일~다음 달 10일, 첫 달 제외) — 판정은 허브 카드와 같은 pickSettlementCard 그대로
  if (hasAssets) {
    const win = pickSettlementCard(readMonthlySnapshots(), today);
    if (win) return { kind: "settlement", window: win, today };
  }

  if (taxMatches.length > 0) return { kind: "tax", matches: taxMatches };

  if (shouldShowRefreshNudge({ hasAssets, assetLastUpdated: assetData.lastUpdated })) {
    return { kind: "refresh", staleCategories: getStaleCategories(assetData.lastUpdated) };
  }

  const feature = pickRecommendedFeature();
  if (feature) return { kind: "feature", feature };

  return null;
}
