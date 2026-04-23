"use client";

import { Info, ChevronDown } from "lucide-react";

const ALERT_DISMISSED_KEY = "secretasset-guide-dismissed";

export function GuideMiniButton() {
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
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-xs text-primary"
    >
      <Info className="size-3.5 shrink-0" />
      <span className="font-medium hidden sm:inline">앱 가이드</span>
      <ChevronDown className="size-3 opacity-60" />
    </button>
  );
}
