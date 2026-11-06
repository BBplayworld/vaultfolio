"use client";

import { Receipt, ChevronRight } from "lucide-react";
import { Stock } from "@/types/asset";
import { isForeignTaxSeason, isTaxSimCandidate } from "@/lib/tax-utils";
import { useTaxViewStore } from "@/stores/tax-view-store";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";

interface TaxSeasonStripProps {
  stocks: Stock[];
}

/**
 * 상세 > 주식 연말 세금 진입 줄 (KST 11/1~12/31 + 해외주식 시뮬 대상 보유 시 노출)
 * - 클릭 → 세금 관리 > 시뮬레이터 탭 (tool-menu와 동일 이동)
 * - data-screenshot-hide: 캡처 제외 마커
 */
export function TaxSeasonStrip({ stocks }: TaxSeasonStripProps) {
  const { navigate } = useAssetNavigation();

  if (!isForeignTaxSeason() || !stocks.some(isTaxSimCandidate)) return null;

  return (
    <button
      type="button"
      data-screenshot-hide
      onClick={() => {
        useTaxViewStore.getState().setInitialTab("simulator");
        navigate({ type: "tax" });
      }}
      className="w-full flex items-center gap-2 px-3 py-2.5 min-h-10 rounded-lg dark:rounded-xl bg-muted/50 dark:bg-card dark:shadow-sm hover:bg-muted/70 dark:hover:bg-muted/30 transition-colors text-left"
      aria-label="세금 계산해 보기"
    >
      <Receipt className="size-4 shrink-0 text-primary" />
      <span className="flex-1 min-w-0 text-sm font-medium break-keep text-pretty">
        해외주식 양도소득은 1년 단위로 합산해 기본공제를 적용해요
      </span>
      <span className="text-[11px] text-muted-foreground shrink-0">세금 계산해 보기</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
