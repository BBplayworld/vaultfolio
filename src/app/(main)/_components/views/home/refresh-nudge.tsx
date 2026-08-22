"use client";

// 자산 최신화 넛지 — 홈·성적표 등 앱의 모든 해석(원인분해·성적표·X-Ray)은 최근 데이터를 전제한다.
// 카테고리(주식·코인·현금·대출) 중 하나라도 30일 넘게 최신화하지 않았으면, 하루 한 번, 홈 최상단에서 권한다.
// 백업 넛지와 동시에 뜨지 않는다(넛지 과다 노출 방지 — 백업 넛지가 우선).
// 노출 조건은 asset-refresh-status.ts의 shouldShowRefreshNudge가 단독으로 판단한다.

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import {
  shouldShowRefreshNudge,
  markRefreshNudgeShown,
  getStaleCategories,
} from "@/lib/asset/asset-refresh-status";

const CATEGORY_LABEL: Record<string, string> = {
  stock: "주식",
  crypto: "암호화폐",
  cash: "현금성 자산",
  loan: "대출",
};

export function RefreshNudge({ suppressed }: { suppressed: boolean }) {
  const { assetData, getAssetSummary } = useAssetData();
  const [visible, setVisible] = useState(false);

  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;
  const staleCategories = getStaleCategories(assetData.lastUpdated);

  useEffect(() => {
    if (suppressed) { setVisible(false); return; }
    const show = shouldShowRefreshNudge({ hasAssets, assetLastUpdated: assetData.lastUpdated });
    if (show) markRefreshNudgeShown();
    setVisible(show);
  }, [suppressed, hasAssets, assetData.lastUpdated]);

  if (!visible || staleCategories.length === 0) return null;

  const dismiss = () => setVisible(false);

  const handleRefresh = () => {
    // 다건 처리는 지원하지 않음 — 가장 오래된 카테고리 1개로 바로 진입
    window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: staleCategories[0] } }));
    setVisible(false);
  };

  const label = `${CATEGORY_LABEL[staleCategories[0]]} 최신화가 오래됐어요`;
  const extraNote = staleCategories.length > 1 ? `그 외 ${staleCategories.length - 1}곳도 최신화가 필요해요.` : "";

  return (
    <div className="rounded-xl bg-card dark:border-0 shadow-xs p-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-start gap-2">
        <RefreshCw className="size-4 mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty">{label}</p>
          <p className="text-sm text-muted-foreground mt-0.5 text-pretty">
            보유 현황이 오래되면 순자산 원인분해·성적표가 실제와 달라질 수 있어요. {extraNote}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 -m-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
      <Button variant="brand" className="w-full" onClick={handleRefresh}>
        지금 최신화하기
      </Button>
    </div>
  );
}
