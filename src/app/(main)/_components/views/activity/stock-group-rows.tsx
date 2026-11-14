"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { signed } from "./change-hero";

// 성과 주식 그룹 종목 목록(5.111) — 손익 큰 3종목 + `외 N개 ±합계` 접기
export const STOCK_ROW_VISIBLE = 3;

type OrderableRow = { hasRef: boolean; profitAmount: number; currentValue: number };

// |손익| 내림차순, 같으면 평가금액 내림차순, 기준가 없음은 맨 뒤(평가금액순). 입력 배열은 바꾸지 않는다
export function orderStockRows<T extends OrderableRow>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.hasRef !== b.r.hasRef) return a.r.hasRef ? -1 : 1;
      const byProfit = a.r.hasRef ? Math.abs(b.r.profitAmount) - Math.abs(a.r.profitAmount) : 0;
      return byProfit || b.r.currentValue - a.r.currentValue || a.i - b.i;
    })
    .map((x) => x.r);
}

// 나머지 행 손익 합(기준가 있는 행만) — 보이는 행 + 이 값 = 그룹 손익
export function sumStockProfit(rows: readonly OrderableRow[]): number {
  return rows.reduce((s, r) => s + (r.hasRef ? r.profitAmount : 0), 0);
}

// active: 기간 탭이 forceMount로 동시에 렌더되므로 비활성이 되면 접어 기간 전환 시 접힘으로 돌아가게 한다
export function StockGroupRows<T extends OrderableRow>({ items, renderRow, active = true }: {
  items: readonly T[];
  active?: boolean;
  renderRow: (row: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  const ordered = orderStockRows(items);
  if (ordered.length <= STOCK_ROW_VISIBLE + 1) return <div className="divide-y">{ordered.map(renderRow)}</div>;
  const top = ordered.slice(0, STOCK_ROW_VISIBLE);
  const rest = ordered.slice(STOCK_ROW_VISIBLE);
  const restHasRef = rest.some((r) => r.hasRef);
  const restSum = sumStockProfit(rest);
  return (
    <div className="divide-y">
      {top.map(renderRow)}
      <div>
        <div
          id={panelId}
          {...(open ? {} : { inert: true, "aria-hidden": true })}
          className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="divide-y">{rest.map(renderRow)}</div>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`flex min-h-10 w-full items-center gap-2 px-4 text-left text-sm outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150${open ? " border-t" : ""}`}
        >
          <span className="min-w-0 flex-1 text-muted-foreground">{open ? "접기" : `외 ${rest.length}개`}</span>
          {!open && restHasRef && (
            <span className={`shrink-0 font-semibold tabular-nums ${restSum === 0 ? "text-muted-foreground" : getProfitLossColor(restSum)}`} data-value={restSum}>
              {restSum === 0 ? formatPriceByMode(0) : signed(restSum)}
            </span>
          )}
          <span data-screenshot-hide aria-hidden className="flex size-4 shrink-0">
            <ChevronDown className={`size-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
      </div>
    </div>
  );
}
