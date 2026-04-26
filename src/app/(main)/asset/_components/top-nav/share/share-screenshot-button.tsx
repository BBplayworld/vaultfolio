"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { ShareScreenshotDialog } from "./share-screenshot-dialog";

export function ShareScreenshotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-xs text-primary"
      >
        <Camera className="size-3.5 shrink-0" />
        <span className="font-medium hidden sm:inline">인증샷</span>
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
