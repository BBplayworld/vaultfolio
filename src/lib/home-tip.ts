// 홈 알림/팁 통합 판정 (S-4.32 후속) — 백업·세금·결산(#4.36)·새 소식(#159)·끊긴 거래 잇기(#147)·자산 최신화·기능 팁을 우선순위대로 1개만 고른다.
// 판정 로직 자체는 기존 순수 함수를 그대로 재사용 — 여기서는 우선순위대로 조합만 한다.

import type { AssetData } from "@/types/asset";
import { shouldShowBackupNudge, daysSinceBackup } from "./asset/backup-status";
import { shouldShowRefreshNudge, getStaleCategories, heldRefreshCategories, type RefreshCategory } from "./asset/asset-refresh-status";
import { isTaxNoticeDismissed, getAssetDrivenHighlights, isImminentTaxMatch, todayKst, type TaxEventMatch } from "./tax-utils";
import { pickRecommendedFeature } from "./feature-usage";
import { readSeen, whatsNewTip } from "./whats-new";
import { readDailySnapshots, readMonthlySnapshots } from "./asset/snapshot-storage";
import { pickFirstRecordStart, pickSettlementCard, type SettlementWindow } from "./report/settlement";
import type { AppFeature } from "@/config/app-features";

export type HomeTip =
  | { kind: "backup"; days: number | null }
  | { kind: "tax"; matches: TaxEventMatch[] }
  | { kind: "settlement"; window: SettlementWindow; today: string } // today = 판정에 쓴 KST 날짜(문구 N월 계산도 같은 값)
  | { kind: "relink" } // 끊긴 거래 다시 잇기(#147)
  | { kind: "refresh"; staleCategories: RefreshCategory[] }
  | { kind: "whats_new"; count: number; title: string } // 새 소식(#159) — count = 안 본 항목 수, title = 맨 위 안 본 항목 제목
  | { kind: "feature"; feature: AppFeature };

export interface HomeTipInputs {
  assetData: AssetData;
  hasAssets: boolean;
  syncArmed: boolean;
  today?: string; // KST YYYY-MM-DD — 테스트 고정용, 기본값 todayKst()
  /** 이번 홈 마운트에서 이미 승자였던 backup·refresh 팁 — 그 종류의 '오늘 노출' 검사만 건너뛰어 effect 재실행에도 유지(#115) */
  keepShown?: "backup" | "refresh";
  /** 끊긴 거래 다시 잇기 후보가 있고 '그대로 두기'를 안 눌렀으며 체험·잠금이 아님(#147) — 호출부가 판정해 넘긴다 */
  hasRelink?: boolean;
  /** 새 소식 판정 허용 — 자산 불러오기 완료 + 체험·앱 잠금 아님(#159, 호출부가 판정) */
  whatsNewOk?: boolean;
  /** 이번 판정에서 기능 팁 후보에서만 뺄 id — 홈 지수 종가 줄이 '시장과 비교' 입구일 때(4.90). 다른 팁·dismiss 불변 */
  suppressFeatureIds?: readonly string[];
}

// 우선순위(#4.36 cto 판정, #159): 백업 > 임박 세금(이번 달 마감 0~6일) > 월 결산 창 > 새 소식 > 끊긴 거래 잇기(#147) > 그 외 세금 > 자산 최신화 > 저방문 기능
// 세금을 무조건 위에 두면 이번 달·다음 달 일정이 결산 창 내내 결산을 가린다 — 급한 마감만 결산보다 위
export function pickHomeTip({ assetData, hasAssets, syncArmed, today = todayKst(), keepShown, hasRelink, whatsNewOk, suppressFeatureIds }: HomeTipInputs): HomeTip | null {
  if (shouldShowBackupNudge({ hasAssets, syncArmed, assetLastUpdated: assetData.lastUpdated, keepShown: keepShown === "backup" })) {
    return { kind: "backup", days: daysSinceBackup() };
  }

  const taxMatches = isTaxNoticeDismissed() ? [] : getAssetDrivenHighlights(assetData, today);
  if (taxMatches.some((m) => isImminentTaxMatch(m, today))) return { kind: "tax", matches: taxMatches };

  // 결산 창(말일−3일~다음 달 10일, 첫 달 제외) — 판정은 허브 카드와 같은 pickSettlementCard 그대로
  if (hasAssets) {
    const win = pickSettlementCard(readMonthlySnapshots(), today, pickFirstRecordStart(readDailySnapshots(), assetData, today));
    if (win) return { kind: "settlement", window: win, today };
  }

  // 새 소식(#159): 결산 아래·relink 위 — 자산이 있고, 안 본 항목이 있으며 마지막으로 읽은 지 7일 이상(또는 기록 없음)일 때
  if (whatsNewOk && hasAssets) {
    const wn = whatsNewTip(readSeen(), { today });
    if (wn) return { kind: "whats_new", ...wn };
  }

  // 끊긴 거래 다시 잇기(#147 cto 판정): 결산 창 아래 — 결산 팁을 가리지 않는다
  if (hasRelink) return { kind: "relink" };

  if (taxMatches.length > 0) return { kind: "tax", matches: taxMatches };

  const held = heldRefreshCategories(assetData);
  if (shouldShowRefreshNudge({ hasAssets, assetLastUpdated: assetData.lastUpdated, held, keepShown: keepShown === "refresh" })) {
    return { kind: "refresh", staleCategories: getStaleCategories(assetData.lastUpdated, held) };
  }

  const feature = pickRecommendedFeature(assetData, suppressFeatureIds);
  if (feature) return { kind: "feature", feature };

  return null;
}
