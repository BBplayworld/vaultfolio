"use client";

// 각주 접힘(5.138 D-2): 기본은 접어 두고 버튼(40px)으로 연다. 열어도 원문 그대로. 접힘 패턴은 period-honest(grid-rows 전환·inert) 재사용.
import { Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function FoldNote({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div data-testid={testId} className="mt-1">
      <button type="button" aria-expanded={open} aria-controls={id} data-testid={`${testId}-button`} onClick={() => setOpen((o) => !o)} className="inline-flex min-h-10 items-center gap-1 rounded-md text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Info aria-hidden className="size-4" />{label}
      </button>
      <div id={id} {...(open ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
