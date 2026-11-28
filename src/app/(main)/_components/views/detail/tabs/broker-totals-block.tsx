"use client";

// 상세·주식 '증권사별' 접기 블록(#319, 5.160) — 읽기 전용. 열림 상태는 useState만(저장 키 0).
// 값은 computeBrokerTotals(헤더와 같은 computeStockTotals 재사용). 인증카드(screenshotMode)에서는 부르는 쪽이 렌더하지 않는다.
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { brokerCashByRow, computeBrokerTotals, type BrokerTotalRow } from "@/lib/asset/broker-totals";
import { brokerSyncedFromRaw, readAssetRefreshRaw, subscribeBrokerSynced } from "@/lib/asset/asset-refresh-status";
import { syncedLabel } from "@/lib/asset/broker-synced";
import { kstTodayString } from "@/lib/asset/import-inherit";
import { DOT_WRAP_FIRST, DOT_WRAP_ROW, DotLead } from "../../../layout/ui/dot-wrap";
import { formatPriceByMode } from "@/lib/number-utils";
import type { Cash, Stock } from "@/types/asset";
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

/** 합계 행 — 주식 증권사별·코인 거래소별(#325) 공용. onResync가 없으면 `맞추기` 버튼을 그리지 않는다(DOM 0). countText 기본 `N종목`.
 * cashText(#335, 주식 블록만)가 있을 때만 grid로 그리고 행 아래 독립 줄 `현금 N원`을 둔다. 없으면 기존 flex 마크업 그대로(코인 행 DOM 불변).
 * synced(#366, 주식 블록만)를 넘기면(null 포함) 메타 줄을 dot-wrap으로 그리고 `· M/D 맞춤` 조각을 둔다(null이면 조각 DOM 0). share=false면 비중 조각 0.
 * synced를 넘기지 않는 코인 행은 기존 인라인 `· 비중` 마크업 그대로. */
export function BrokerRow({ row, scale, onResync, countText, cashText, synced, share = true }: { row: BrokerTotalRow; scale: 1 | 100; onResync?: (broker?: string) => void; countText?: string; cashText?: string; synced?: { date: string; text: string } | null; share?: boolean }) {
  const zero = row.profitUnits === 0;
  const color = zero ? "text-muted-foreground" : getProfitLossColor(row.profitUnits);
  const sign = row.profitUnits > 0 ? "+" : "";
  const rate = row.profitRate === null ? "—" : `(${zero ? "" : sign}${(zero ? 0 : row.profitRate).toFixed(1)}%)`;
  const grid = cashText !== undefined;
  const left = (
    <div className={grid ? "col-start-1 row-start-1 flex min-w-0 flex-col gap-0.5" : "flex min-w-16 flex-1 flex-col gap-0.5"}>
      <span data-testid="broker-row-name" className={`${ASSET_THEME.cardInfoName} break-keep`}>{row.name}</span>
      {synced === undefined ? (
        <span className="text-sm text-muted-foreground tabular-nums">
          <span data-testid="broker-row-count" className="whitespace-nowrap">{countText ?? `${row.count}종목`}</span>
          {" "}
          <span data-testid="broker-row-share" className="whitespace-nowrap">· {formatShareTenths(row.shareTenths)}</span>
        </span>
      ) : (
        // 조각마다 nowrap, 줄바꿈은 조각 사이에서만(C152) — 줄 머리·끝에 `·`가 남지 않는 dot-wrap
        <p data-testid="broker-row-meta" className={`flex flex-wrap gap-x-1 text-sm text-muted-foreground tabular-nums ${DOT_WRAP_ROW}`}>
          <span data-testid="broker-row-count" className={`whitespace-nowrap ${DOT_WRAP_FIRST}`}>{countText ?? `${row.count}종목`}</span>
          {share && <span data-testid="broker-row-share" className="whitespace-nowrap"><DotLead />{formatShareTenths(row.shareTenths)}</span>}
          {synced && <span data-testid="broker-row-synced" data-date={synced.date} className="whitespace-nowrap"><DotLead />{synced.text}</span>}
        </p>
      )}
    </div>
  );
  // 금액 열은 shrink-0을 두지 않는다(E1) — 360 경계에서 손익 줄 `(율)`이 아래 줄로 내려가며 행 넘침이 0이 된다(평가금 nowrap 폭 아래로는 줄지 않음)
  // 맞추기 버튼이 없는 행(코인 거래소별)은 359px 이하에서 금액이 다음 줄로 내려가도 오른쪽 끝에 붙인다
  const right = (
    <div className={grid ? "col-start-2 row-start-1 justify-self-end text-right" : `text-right${onResync ? "" : " ml-auto"}`}>
      <p data-testid="broker-row-value" className={`${ASSET_THEME.cardAmountMain} whitespace-nowrap ${ASSET_THEME.text.default}`}>{formatBrokerUnits(row.valueUnits, scale)}</p>
      <div data-testid="broker-row-profit" className={`${ASSET_THEME.cardAmountProfitRow} flex-wrap justify-end`}>
        <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${color}`}>{sign}{formatBrokerUnits(row.profitUnits, scale)}</span>
        <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${color}`}>{rate}</span>
      </div>
    </div>
  );
  const resync = onResync && (
    <Button
      type="button"
      variant="ghost"
      data-testid="broker-row-resync"
      aria-label={`${row.name} 맞추기`}
      onClick={() => onResync(row.unassigned ? undefined : row.name)}
      className={`h-10 min-w-10 shrink-0 px-2 text-sm text-muted-foreground active:scale-[0.96] ${grid ? "col-start-3 row-start-1 max-[360px]:col-span-full max-[360px]:row-start-3 max-[360px]:justify-self-end" : "max-[360px]:ml-auto max-[360px]:basis-full max-[360px]:justify-end"}`}
    >
      맞추기
    </Button>
  );
  if (grid) {
    // DOM 순서: 좌 → 우 → 현금 → 맞추기(스크린리더가 금액 다음에 현금을 읽는다)
    return (
      <div data-testid="broker-row" data-broker={row.name} data-unassigned={row.unassigned} className="grid min-h-14 grid-cols-[minmax(4rem,1fr)_auto_auto] items-center gap-x-2 py-2 max-[360px]:grid-cols-[minmax(4rem,1fr)_auto]">
        {left}
        {right}
        <p data-testid="broker-row-cash" className="col-span-full row-start-2 mt-0.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap">현금 {cashText}</p>
        {resync}
      </div>
    );
  }
  return (
    <div data-testid="broker-row" data-broker={row.name} data-unassigned={row.unassigned} className="flex min-h-14 flex-wrap items-center gap-x-2 py-2 min-[360px]:flex-nowrap">
      {left}
      {right}
      {resync}
    </div>
  );
}

/** cash(#335): 부르는 쪽이 '전체' 탭에서만 넘긴다. 달러 보기(scale 100)에서는 현금 줄을 그리지 않는다($·원 혼재 방지) */
export function BrokerTotalsBlock({ stocks, exchangeRates, displayCurrency, cash }: { stocks: Stock[]; exchangeRates: { USD: number; JPY: number }; displayCurrency: StockDisplayCurrency; cash?: Cash[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { rows, scale } = useMemo(() => computeBrokerTotals(stocks, exchangeRates, displayCurrency), [stocks, exchangeRates, displayCurrency]);
  const cashByRow = useMemo(() => (cash && scale === 1 ? brokerCashByRow(rows, cash, exchangeRates) : null), [cash, scale, rows, exchangeRates]);
  // 증권사별 맞춘 날(#366) — 기기 로컬 메타 원문을 구독(맞추기·되돌리기 직후 신호). 서버 렌더는 "" → 조각 0
  const refreshRaw = useSyncExternalStore(subscribeBrokerSynced, readAssetRefreshRaw, () => "");
  const today = kstTodayString();
  const synced = useMemo(() => brokerSyncedFromRaw(refreshRaw, today), [refreshRaw, today]);
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
              <BrokerRow
                key={r.unassigned ? "__unassigned" : r.name}
                row={r}
                scale={scale}
                onResync={(b) => dispatchAddStock("screenshot", b)}
                cashText={cashByRow?.has(r.name) ? formatPriceByMode(cashByRow.get(r.name)!) : undefined}
                synced={syncedLabel(r, synced, today)}
              />
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
