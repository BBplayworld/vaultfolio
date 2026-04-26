"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { ShareScreenshotDialog } from "./share-screenshot-dialog";
import { useAssetData } from "@/contexts/asset-data-context";
import { MAIN_PALETTE } from "@/config/theme";

export function ShareScreenshotButton() {
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
        className="inline-flex items-center gap-1 sm:gap-1.5 size-7 sm:size-auto sm:h-9 sm:px-3 sm:py-1.5 rounded-lg justify-center border-none text-white text-xs font-medium transition-opacity hover:opacity-85 shrink-0"
        style={{ backgroundColor: MAIN_PALETTE[7] }}
      >
        <Camera className="size-3.5 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">인증샷</span>
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
