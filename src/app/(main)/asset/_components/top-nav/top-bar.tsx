"use client";

import { Info, ChevronDown, Camera, Moon, Sun, CircleChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAIN_PALETTE } from "@/config/theme";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { useAssetData } from "@/contexts/asset-data-context";
import { ShareScreenshotDialog } from "./share/share-screenshot-dialog";
import { NavUser } from "./tool-menu";
import { rootUser } from "@/config/users";

const ALERT_DISMISSED_KEY = "secretasset-guide-dismissed";

const BTN_H = "h-9 sm:h-10";

function GuideMiniButton() {
  const handleClick = () => {
    const isDismissed = localStorage.getItem(ALERT_DISMISSED_KEY) === "1";
    if (isDismissed) {
      window.dispatchEvent(new CustomEvent("trigger-restore-guide"));
    } else {
      localStorage.setItem(ALERT_DISMISSED_KEY, "1");
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
        className={`inline-flex items-center gap-1 sm:gap-1.5 ${BTN_H} px-3 rounded-lg justify-center border-none text-white text-xs font-medium transition-opacity hover:opacity-85 shrink-0`}
        style={{ backgroundColor: MAIN_PALETTE[7] }}
      >
        <Camera className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">인증샷</span>
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function ThemeSwitcher() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const handleValueChange = async () => {
    const newTheme = themeMode === "dark" ? "light" : "dark";
    updateThemeMode(newTheme);
    setThemeMode(newTheme);
    await setValueToCookie("theme_mode", newTheme);
  };

  return (
    <Button size="icon" className={`${BTN_H} aspect-square`} onClick={handleValueChange}>
      {themeMode === "dark" ? <Sun className="size-4 sm:size-5" /> : <Moon className="size-4 sm:size-5" />}
    </Button>
  );
}

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-between px-3 lg:px-12">
      <div className="flex items-center gap-1 lg:gap-2">
        <GuideMiniButton />
      </div>
      <div className="flex items-center gap-2">
        <ShareScreenshotButton />
        <NavUser user={rootUser} />
        <ThemeSwitcher />
      </div>
    </div>
  );
}
