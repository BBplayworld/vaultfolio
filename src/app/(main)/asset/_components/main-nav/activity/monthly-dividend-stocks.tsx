"use client";

import { useQueries } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance-service";
import type { DividendPayoutResult, DividendFrequency } from "@/lib/finance-service";
import type { Stock } from "@/types/asset";

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

async function fetchDividend(ticker: string, type: string, excd: string): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd });
  const res = await fetch(`/api/finance/dividend?${params}`);
  if (!res.ok) return [];
  return res.json();
}

interface StockDividendRow {
  stock: Stock;
  payoutMonths: number[];
  perShareForeign: number;
  perShareKRW: number;
  currency: string;
  annualTotal: number;
  annualForeign: number;
  frequency?: DividendFrequency;
}

interface Props {
  selectedMonth: number | undefined;
}

export function MonthlyDividendStocks({ selectedMonth }: Props) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

  const stocksWithTicker = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted");

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      return {
        queryKey: ["dividend", ticker, type],
        queryFn: () => fetchDividend(ticker, type, "NAS"),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const rows: StockDividendRow[] = stocksWithTicker
    .map((stock, i): StockDividendRow | null => {
      const payouts: DividendPayoutResult[] = Array.isArray(queries[i]?.data)
        ? (queries[i].data as DividendPayoutResult[])
        : [];
      if (payouts.length === 0) return null;

      const currency = payouts[0].currency || (stock.currency === "USD" ? "USD" : "KRW");
      const rate = currency === "USD" ? usdRate : 1;
      const payoutMonths = [
        ...new Set(payouts.map((p) => parseInt(p.payoutDate.split("-")[1], 10)).filter(Boolean)),
      ].sort((a, b) => a - b);

      const annualTotal = Math.round(
        payouts.reduce((sum, p) => sum + p.amountPerShare * stock.quantity * rate, 0)
      );
      const annualForeign =
        currency === "USD"
          ? Math.round(payouts.reduce((sum, p) => sum + (p.amountForeign ?? p.amountPerShare) * stock.quantity, 0) * 100) / 100
          : 0;
      const perShareForeign = currency === "USD" ? (payouts[0].amountForeign ?? payouts[0].amountPerShare) : 0;
      const perShareKRW = Math.round(payouts[0].amountPerShare * rate);

      return {
        stock,
        payoutMonths,
        perShareForeign,
        perShareKRW,
        currency,
        annualTotal,
        annualForeign,
        frequency: payouts[0].frequency,
      };
    })
    .filter((r): r is StockDividendRow => r !== null);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground text-center py-3">배당 정보 조회 중...</p>;
  }

  const grouped = CATEGORY_GROUPS.map(({ key, label, color }) => {
    const items = rows.filter((r) => r.stock.category === key);
    const filtered = selectedMonth !== undefined
      ? items.filter((r) => r.payoutMonths.includes(selectedMonth))
      : items;
    return { key, label, color, filtered };
  }).filter(({ filtered }) => filtered.length > 0);

  if (grouped.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
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
            <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
          </div>
          <div className="grid grid-cols-[1fr_5rem_3rem_4rem] sm:grid-cols-[1fr_8rem_4rem_5.5rem] gap-x-2 sm:gap-x-3 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground border-b">
            <span>종목명</span>
            <span className="text-right">배당월</span>
            <span className="text-right">주당</span>
            <span className="text-right">연간예상</span>
          </div>
          <div className="divide-y">
            {filtered.map(({ stock, payoutMonths, perShareForeign, perShareKRW, currency, annualTotal, annualForeign, frequency }) => {
              const ticker = normalizeTicker(stock);
              const isDomestic = DOMESTIC_CATEGORIES.has(stock.category);
              return (
                <div
                  key={stock.id}
                  className="grid grid-cols-[1fr_5rem_3rem_4rem] sm:grid-cols-[1fr_8rem_4rem_5.5rem] gap-x-2 sm:gap-x-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs sm:text-sm font-semibold truncate">{stock.name || ticker}</p>
                      {frequency && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">{ticker}</p>
                  </div>
                  <div className="flex flex-wrap gap-0.5 justify-end max-w-[8rem]">
                    {payoutMonths.map((m) => (
                      <Badge
                        key={m}
                        variant={m === selectedMonth ? "default" : "outline"}
                        className="text-xs px-1 py-0 h-4"
                      >
                        {m}월
                      </Badge>
                    ))}
                  </div>
                  <div className="text-right">
                    {!isDomestic && currency === "USD" ? (
                      <>
                        <p className="text-xs sm:text-sm tabular-nums text-muted-foreground">${perShareForeign.toFixed(4)}</p>
                        <p className="text-xs sm:text-sm tabular-nums text-muted-foreground/60">{perShareKRW.toLocaleString()}원</p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm tabular-nums text-muted-foreground">{perShareKRW.toLocaleString()}원</p>
                    )}
                  </div>
                  <div className="text-right">
                    {!isDomestic && currency === "USD" && (
                      <p className="text-xs sm:text-sm tabular-nums text-muted-foreground/60">${annualForeign.toFixed(2)}</p>
                    )}
                    <p className={`text-xs sm:text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                      {formatCurrency(annualTotal)}
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
