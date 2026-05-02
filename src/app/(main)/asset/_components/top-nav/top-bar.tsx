"use client";

import { Info, ChevronDown, Camera } from "lucide-react";
import { useState } from "react";
import { MAIN_PALETTE } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { ShareScreenshotDialog } from "./share/share-menu";
import { ToolMenu } from "./tool-menu";
import { ThemeSwitcher } from "./theme-menu";
import { rootUser } from "@/config/users";
import { STORAGE_KEYS } from "@/lib/local-storage";

const BTN_H = "h-9 sm:h-10";

function GuideMiniButton() {
  const handleClick = () => {
    const isDismissed = localStorage.getItem(STORAGE_KEYS.guideDismissed) === "1";
    if (isDismissed) {
      window.dispatchEvent(new CustomEvent("trigger-restore-guide"));
    } else {
      localStorage.setItem(STORAGE_KEYS.guideDismissed, "1");
      window.dispatchEvent(new CustomEvent("trigger-dismiss-guide"));
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 sm:gap-1.5 ${BTN_H} px-2 sm:px-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-xs text-primary`}
    >
      <Info className="size-3.5 shrink-0" />
      <span className="font-medium">앱 가이드</span>
      <ChevronDown className="size-3 opacity-60" />
    </button>
  );
}

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
        className={`inline-flex items-center gap-1 sm:gap-1.5 ${BTN_H} px-2 rounded-lg justify-center border-none text-white text-xs font-medium transition-opacity hover:opacity-85 shrink-0`}
        style={{ backgroundColor: MAIN_PALETTE[7] }}
      >
        <Camera className="size-3.5 sm:size-4 shrink-0" />
        <span className="whitespace-nowrap">인증샷</span>
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-between px-3 lg:px-12">
      <div className="flex items-center gap-1 sm:gap-2">
        <GuideMiniButton />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <ShareScreenshotButton />
        <ToolMenu user={rootUser} />
        <ThemeSwitcher />
      </div>
    </div>
  );
}
