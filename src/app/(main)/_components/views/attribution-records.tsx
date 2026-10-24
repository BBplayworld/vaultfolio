"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { formatShortCurrency } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { formatAttributionDate, type AttributionRecord } from "@/lib/report/asset-report";

// 원인분해 구간의 기록 내역(입출금·매매·대출) 시간순 펼침 — 홈 헤더·성과 순자산 변화 공용(S-4.33)
export function AttributionRecordList({ records, className = "" }: { records: AttributionRecord[]; className?: string }) {
  const [open, setOpen] = useState(false);
  if (records.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-mx-2 inline-flex min-h-10 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground motion-safe:active:scale-[0.96] transition-[color,transform]"
      >
        기록 내역 {records.length}건
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="max-h-64 overflow-y-auto space-y-1 motion-safe:animate-in motion-safe:fade-in-0">
          {records.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 flex items-baseline gap-2">
                <span className="shrink-0 w-11 text-xs tabular-nums text-muted-foreground">{formatAttributionDate(r.date)}</span>
                <span className="shrink-0 text-foreground">{r.label}</span>
                <span className="truncate text-muted-foreground">{r.title}</span>
              </span>
              <span className={`shrink-0 font-semibold tabular-nums ${getProfitLossColor(r.amount)}`}>
                {r.amount >= 0 ? "+" : "−"}{formatShortCurrency(Math.abs(r.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
