"use client";

import { Camera, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { MAIN_PALETTE } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { ShareScreenshotDialog } from "./share/share-menu";
import { ToolMenu } from "./tool-menu";
import { useAssetNavigation, getBackLabel } from "../layout/navigation/navigation-context";

// 상단 아이콘 버튼 공용 크기 (한 단계 ↑)
const ICON_BTN = "inline-flex items-center justify-center h-10 sm:h-11 w-10 sm:w-11 rounded-lg shrink-0 transition-opacity hover:opacity-85";

function ShareScreenshotButton() {
  const [open, setOpen] = useState(false);
  const { assetData } = useAssetData();

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  if (!hasAssets) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${ICON_BTN} border-none text-white`}
        style={{ backgroundColor: MAIN_PALETTE[5] }}
        aria-label="인증샷"
        title="인증샷"
        data-tutorial="tutorial-screenshot-btn"
      >
        <Camera className="size-5 sm:size-6" />
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TopBar() {
  const { view, back, navigate } = useAssetNavigation();
  const title = getBackLabel(view);
  const isSubView = view.type !== "home";

  return (
    <div className="flex w-full items-center justify-between px-3 lg:px-12">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        {isSubView && (
          <>
            <button
              onClick={back}
              aria-label="뒤로가기"
              className="inline-flex items-center gap-1.5 sm:gap-2 -ml-1 sm:-ml-2 px-1.5 sm:px-2 py-1 rounded-md hover:bg-muted transition-colors min-w-0"
            >
              <ChevronLeft className="size-5 sm:size-6 shrink-0" />
              <span className="text-base sm:text-lg lg:text-xl font-semibold truncate">{title}</span>
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <ShareScreenshotButton />
        <ToolMenu />
      </div>
    </div>
  );
}
