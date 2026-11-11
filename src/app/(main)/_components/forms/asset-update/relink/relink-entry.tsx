"use client";

// 끊긴 거래 다시 잇기(#147) — 상세 거래내역 목록 위 안내 줄. 후보가 있는 동안 항상 보인다('그대로 두기'와 무관한 재진입 경로).
// 후보 0·체험·앱잠금·공유 대기 중에는 렌더하지 않는다. 클릭 → 확인 화면(RelinkHost).
import { useMemo } from "react";
import { ChevronRight, Info } from "lucide-react";

import { useAssetData } from "@/contexts/asset-data-context";
import { detectRelink, relinkTotalCount } from "@/lib/asset/resync";
import { isPwaLocked } from "@/lib/pwa/app-lock";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { dispatchOpenRelink } from "../../../layout/navigation/asset-dispatch";

export function RelinkEntry() {
  const { assetData, isSharePending } = useAssetData();
  const total = useMemo(() => {
    if (isTrialMode() || isPwaLocked() || isSharePending) return 0;
    return relinkTotalCount(detectRelink(assetData));
  }, [assetData, isSharePending]);
  if (total === 0) return null;
  return (
    <button
      type="button"
      data-testid="relink-entry"
      data-screenshot-hide
      onClick={dispatchOpenRelink}
      className="flex min-h-10 w-full items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <Info className="size-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden />
      <span className="min-w-0 flex-1 text-sm text-muted-foreground text-pretty break-keep">
        끊긴 거래 <span className="tabular-nums">{total}</span>건을 다시 이을 수 있어요
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
