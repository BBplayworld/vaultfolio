"use client";

// 상세·주식 '증권사별' 접기 블록(#319, 5.160) — 읽기 전용. 열림 상태는 useState만(저장 키 0).
// 값은 computeBrokerTotals(헤더와 같은 computeStockTotals 재사용). 인증카드(screenshotMode)에서는 부르는 쪽이 렌더하지 않는다.
import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { computeBrokerTotals, type BrokerTotalRow } from "@/lib/asset/broker-totals";
import type { Stock } from "@/types/asset";
import type { StockDisplayCurrency } from "../asset-detail-tabs";
import { dispatchAddStock } from "../../../layout/navigation/asset-dispatch";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { track } from "@/lib/analytics/ga";

// `상세·주식·증권사별 열기` — 페이지 수명당 1회(증권사명·금액 미전송, 저장 키 0)
let brokerOpenSent = false;

/** 표시 문자열 — 헤더(formatCurrency·formatByDisplayCurrency)와 같은 모양. units = 원 또는 센트 */
export function formatBrokerUnits(units: number, scale: 1 | 100): string {
  if (scale === 100) return `$${(units / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${units.toLocaleString("ko-KR")}원`;
}

export const formatShareTenths = (t: number) => `${(t / 10).toFixed(1)}%`;

function BrokerRow({ row, scale, onResync }: { row: BrokerTotalRow; scale: 1 | 100; onResync: (broker?: string) => void }) {
  const zero = row.profitUnits === 0;
  const color = zero ? "text-muted-foreground" : getProfitLossColor(row.profitUnits);
  const sign = row.profitUnits > 0 ? "+" : "";
  const rate = row.profitRate === null ? "—" : `(${zero ? "" : sign}${(zero ? 0 : row.profitRate).toFixed(1)}%)`;
  return (
    <div data-testid="broker-row" data-broker={row.name} data-unassigned={row.unassigned} className="flex min-h-14 flex-wrap items-center gap-x-2 py-2 min-[360px]:flex-nowrap">
      <div className="flex min-w-16 flex-1 flex-col gap-0.5">
        <span data-testid="broker-row-name" className={`${ASSET_THEME.cardInfoName} break-keep`}>{row.name}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          <span data-testid="broker-row-count">{row.count}종목</span>
          {" · "}
          <span data-testid="broker-row-share" className="whitespace-nowrap">{formatShareTenths(row.shareTenths)}</span>
        </span>
      </div>
      <div className="shrink-0 text-right">
        <p data-testid="broker-row-value" className={`${ASSET_THEME.cardAmountMain} whitespace-nowrap ${ASSET_THEME.text.default}`}>{formatBrokerUnits(row.valueUnits, scale)}</p>
        <div data-testid="broker-row-profit" className={`${ASSET_THEME.cardAmountProfitRow} justify-end`}>
          <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${color}`}>{sign}{formatBrokerUnits(row.profitUnits, scale)}</span>
          <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${color}`}>{rate}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        data-testid="broker-row-resync"
        aria-label={`${row.name} 맞추기`}
        onClick={() => onResync(row.unassigned ? undefined : row.name)}
        className="h-10 min-w-10 shrink-0 px-2 text-sm text-muted-foreground active:scale-[0.96] max-[359px]:ml-auto max-[359px]:basis-full max-[359px]:justify-end"
      >
        맞추기
      </Button>
    </div>
  );
}

export function BrokerTotalsBlock({ stocks, exchangeRates, displayCurrency }: { stocks: Stock[]; exchangeRates: { USD: number; JPY: number }; displayCurrency: StockDisplayCurrency }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { rows, scale } = useMemo(() => computeBrokerTotals(stocks, exchangeRates, displayCurrency), [stocks, exchangeRates, displayCurrency]);
  if (rows.length < 2) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !brokerOpenSent) {
      brokerOpenSent = true;
      if (!isPreviewEnv()) track("feature_use", { category: "stock_broker_open" });
    }
  };
  const hasUnassigned = rows.some((r) => r.unassigned);

  return (
    <section data-testid="broker-totals" data-screenshot-hide className={`rounded-lg bg-card shadow-sm ${ASSET_THEME.listBox}`}>
      <button
        type="button"
        data-testid="broker-totals-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-10 w-full items-center gap-1.5 px-4 py-2.5 text-left motion-safe:transition-transform duration-150 active:scale-[0.99]"
      >
        <span className="text-sm font-semibold">증권사별</span>
        <span className="text-sm text-muted-foreground">· {rows.length}곳</span>
        <ChevronDown aria-hidden className={`ml-auto size-4 shrink-0 text-muted-foreground motion-safe:transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label="증권사별 합계"
        data-testid="broker-totals-panel"
        data-state={open ? "open" : "closed"}
        {...(open ? {} : { inert: true, "aria-hidden": true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-border px-4 pb-2 dark:divide-border/30">
            {rows.map((r) => (
              <BrokerRow key={r.unassigned ? "__unassigned" : r.name} row={r} scale={scale} onResync={(b) => dispatchAddStock("screenshot", b)} />
            ))}
          </div>
          {hasUnassigned && (
            <p data-testid="broker-totals-note" className="px-4 pb-3 text-sm text-muted-foreground text-pretty break-keep">증권사를 적지 않은 종목이에요.</p>
          )}
        </div>
      </div>
    </section>
  );
}
