"use client";

import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendFrequency } from "@/lib/finance/finance-service";
import type { DividendCalcResult, DividendMonthState } from "@/lib/finance/dividend-calc";
import type { Stock } from "@/types/asset";
import type { DividendGroup } from "./use-dividend-data";

const FREQUENCY_LABEL: Record<DividendFrequency, string> = {
  annual: "연간",
  semiannual: "반기",
  quarterly: "분기",
  monthly: "월배당",
};

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_GROUPS = [
  { key: "domestic", label: "국내주식", color: MAIN_PALETTE[3] },
  { key: "foreign", label: "해외주식", color: MAIN_PALETTE[5] },
  { key: "irp", label: "IRP", color: MAIN_PALETTE[6] },
  { key: "isa", label: "ISA", color: MAIN_PALETTE[4] },
  { key: "pension", label: "연금저축", color: MAIN_PALETTE[7] },
] as const;

interface StockDividendRow {
  stock: Stock;
  beforePurchaseMonths: number[];
  actualMonths: number[];
  estimatedMonths: number[];
  payoutMonths: number[];
  perShareForeign: number;
  perShareKRW: number;
  currency: string;
  annualTotal: number;
  annualForeign: number;
  annualActual: number;
  annualForeignActual: number;
  monthlyTotal: number;
  monthlyForeign: number;
  monthlyActual: number;
  monthlyForeignActual: number;
  frequency?: DividendFrequency;
}

interface Props {
  selectedMonth: number | undefined;
  /** 배당 차트와 같은 공용 훅 결과 — 표는 재계산하지 않고 종목별 값(calc.byStock)만 표시한다(#313) */
  groups: DividendGroup[];
  calc: DividendCalcResult;
}

const monthsIn = (state: DividendMonthState[], want: DividendMonthState) =>
  state.flatMap((st, i) => (st === want ? [i + 1] : []));
const cents = (v: number) => Math.round(v * 100) / 100;

export function MonthlyDividendStocks({ selectedMonth, groups, calc }: Props) {
  const { exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

  const rows: StockDividendRow[] = groups
    .map(({ key, stock, payouts }): StockDividendRow | null => {
      const d = calc.byStock.get(key);
      if (!d || payouts.length === 0) return null;
      const firstPayout = d.firstPayout ?? payouts[0];
      const currency = stock.currency === "USD" ? "USD" : "KRW";
      const rate = currency === "USD" ? usdRate : 1;
      // 배당월 배지: 그 달 지급이 모두 '지급'이면 N월, 하나라도 예상이면 N월 예정, 그때 보유 0이면 흐린 N월
      const actualMonths = monthsIn(d.monthState, "paid");
      const estimatedMonths = monthsIn(d.monthState, "expected");
      const m = selectedMonth !== undefined ? selectedMonth - 1 : -1;
      return {
        stock,
        beforePurchaseMonths: monthsIn(d.monthState, "inactive"),
        actualMonths,
        estimatedMonths,
        payoutMonths: [...actualMonths, ...estimatedMonths].sort((a, b) => a - b),
        perShareForeign: currency === "USD" ? (firstPayout.amountForeign ?? firstPayout.amountPerShare) : 0,
        perShareKRW: Math.round(firstPayout.amountPerShare * rate),
        currency,
        annualTotal: Math.round(d.paid + d.expected),
        annualForeign: cents(d.paidForeign + d.expectedForeign),
        annualActual: Math.round(d.paid),
        annualForeignActual: cents(d.paidForeign),
        monthlyTotal: m >= 0 ? Math.round(d.perMonth.paid[m] + d.perMonth.expected[m]) : 0,
        monthlyForeign: m >= 0 ? cents(d.perMonth.paidForeign[m] + d.perMonth.expectedForeign[m]) : 0,
        monthlyActual: m >= 0 ? Math.round(d.perMonth.paid[m]) : 0,
        monthlyForeignActual: m >= 0 ? cents(d.perMonth.paidForeign[m]) : 0,
        frequency: firstPayout.frequency,
      };
    })
    .filter((r): r is StockDividendRow => r !== null);

  const grouped = CATEGORY_GROUPS.map(({ key, label, color }) => {
    const items = rows.filter((r) => r.stock.category === key);
    const filtered = selectedMonth !== undefined
      ? items.filter((r) => r.payoutMonths.includes(selectedMonth))
      : items;
    return { key, label, color, filtered };
  }).filter(({ filtered }) => filtered.length > 0);

  if (grouped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        {selectedMonth !== undefined ? `${selectedMonth}월 배당 종목이 없습니다.` : "배당 데이터가 없습니다."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ key, label, color, filtered }) => (
        <div key={key} className="rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-muted-foreground">{label}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem_4.75rem_5.5rem_5.5rem] lg:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-1 sm:gap-x-2 lg:gap-x-3 px-2 sm:px-3 py-2 bg-muted/50 text-xs whitespace-nowrap text-muted-foreground border-b">
            <span>종목명</span>
            <span className="text-right">배당월</span>
            <span className="text-right">주당</span>
            <span data-testid="dividend-col-paid" className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 지급` : "지급금액"}</span>
            <span data-testid="dividend-col-total" className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 합계` : "합계"}</span>
          </div>
          <div className="divide-y">
            {filtered.map(({ stock, beforePurchaseMonths, actualMonths, estimatedMonths, perShareForeign, perShareKRW, currency, annualTotal, annualForeign, annualActual, annualForeignActual, monthlyTotal, monthlyForeign, monthlyActual, monthlyForeignActual, frequency }) => {
              const ticker = normalizeTicker(stock);
              const isDomestic = DOMESTIC_CATEGORIES.has(stock.category);
              const displayTotal = selectedMonth !== undefined ? monthlyTotal : annualTotal;
              const displayForeign = selectedMonth !== undefined ? monthlyForeign : annualForeign;
              const displayActual = selectedMonth !== undefined ? monthlyActual : annualActual;
              const displayForeignActual = selectedMonth !== undefined ? monthlyForeignActual : annualForeignActual;
              return (
                <div
                  key={stock.id}
                  className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem_4.75rem_5.5rem_5.5rem] lg:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-1 sm:gap-x-2 lg:gap-x-3 px-2 sm:px-3 py-2.5 items-center"
                  data-testid="dividend-stock-row"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p data-testid="dividend-stock-name" className="text-sm font-semibold truncate">{stock.name || ticker}</p>
                      {frequency && (
                        <Badge className={`hidden md:inline-flex ${ASSET_THEME.categoryBox} text-xs px-1 py-0 h-4 md:h-5 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      )}
                    </div>
                    {frequency && (
                      <div data-testid="dividend-stock-meta" className="flex items-center gap-x-1 md:hidden mt-0.5">
                        <Badge className={`${ASSET_THEME.categoryBox} text-xs px-1 py-0 h-4 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      </div>
                    )}
                    {stock.purchaseDate && <p className="text-xs text-muted-foreground mt-1">매수 {stock.purchaseDate}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-end">
                    {beforePurchaseMonths.map((m) => (
                      <Badge
                        key={`before-${m}`}
                        variant="outline"
                        className="text-xs px-2 py-0.5 h-6 opacity-25 cursor-default"
                      >
                        {m}월
                      </Badge>
                    ))}
                    {actualMonths.map((m) => (
                      <Badge
                        key={`actual-${m}`}
                        variant={m === selectedMonth ? "default" : "outline"}
                        className="text-xs px-2 py-0.5 h-6 font-semibold"
                        style={m !== selectedMonth ? { backgroundColor: `${MAIN_PALETTE[0]}22`, color: MAIN_PALETTE[0], borderColor: `${MAIN_PALETTE[0]}66` } : undefined}
                      >
                        {m}월
                      </Badge>
                    ))}
                    {estimatedMonths.map((m) => (
                      <Badge
                        key={`est-${m}`}
                        variant={m === selectedMonth ? "default" : "outline"}
                        className={`text-xs px-2 py-0.5 h-6 max-sm:px-[3px] max-sm:text-2xs max-sm:tracking-tighter ${m !== selectedMonth ? "border-dashed text-muted-foreground" : ""}`}
                      >
                        {m}월 예정
                      </Badge>
                    ))}
                  </div>
                  <div className="text-right">
                    {!isDomestic && currency === "USD" ? (
                      <>
                        <p className="text-xs tabular-nums" style={{ color: MAIN_PALETTE[10] }}>${perShareForeign.toFixed(4)}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{perShareKRW.toLocaleString()}원</p>
                      </>
                    ) : (
                      <p className="text-xs tabular-nums" style={{ color: MAIN_PALETTE[10] }}>{perShareKRW.toLocaleString()}원</p>
                    )}
                    <p className="text-xs tabular-nums break-keep text-muted-foreground">보유 {stock.quantity}주</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    {!isDomestic && currency === "USD" && displayForeignActual > 0 && (
                      <p className="text-xs tabular-nums text-muted-foreground">${displayForeignActual.toFixed(2)}</p>
                    )}
                    <p data-testid="dividend-paid-amount" className="text-xs xl:text-sm font-bold tabular-nums text-foreground">
                      {displayActual > 0 ? formatCurrency(displayActual) : <span className="text-muted-foreground">-</span>}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    {!isDomestic && currency === "USD" && (
                      <p className="text-xs tabular-nums text-muted-foreground ">${displayForeign.toFixed(2)}</p>
                    )}
                    <p data-testid="dividend-est-amount" className={`text-xs xl:text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                      {formatCurrency(displayTotal)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
