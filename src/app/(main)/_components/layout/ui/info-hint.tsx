"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// 부수 설명 공용 Hint — 데스크톱 hover · 모바일 터치(탭) 모두 동작
// 가이드 §3 패턴 (radix Tooltip 대신 Popover + pointerType 필터)
export function InfoHint({ children, side = "bottom" }: { children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="설명 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors inline-flex items-center"
        >
          <Info className="size-3.5 sm:size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} sideOffset={4} className="w-72 p-2.5 text-[11px] leading-relaxed text-left space-y-1">
        {children}
      </PopoverContent>
    </Popover>
  );
}
