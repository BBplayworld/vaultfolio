"use client";

// 가계 통계 블록의 '자세히' 펼침 — market-basis-toggle 패턴(항상 마운트, 접힘 inert, grid-rows 전환) 재사용. 화면 상태만, 저장·전송 없음.
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function BenchmarkMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        data-testid="benchmark-more-toggle"
        aria-expanded={open}
        aria-controls="benchmark-more-panel"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-md text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-transform"
      >
        {open ? "접기" : "자세히"}
        <ChevronDown aria-hidden className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id="benchmark-more-panel"
        data-testid="benchmark-more-panel"
        data-open={open ? "true" : "false"}
        {...(open ? {} : { inert: true, "aria-hidden": true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-[120ms] ${open ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
