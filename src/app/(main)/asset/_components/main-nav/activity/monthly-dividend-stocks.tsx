"use client";

import { useQueries } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance-service";
import type { DividendPayoutResult, DividendFrequency } from "@/lib/finance-service";
import type { Stock } from "@/types/asset";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";

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
  const json = await res.json();
  if (json.messages) {
    console.log(`[API Logs - ${ticker}]`, json.messages);
  }
  if (!res.ok) return [];
  return json.data || [];
}

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
}

export function MonthlyDividendStocks({ selectedMonth }: Props) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

  const stocksWithTicker = (() => {
    // 상장폐지 종목 제외 — 배당 받을 수 없음. 거래정지는 포함 (보유 중)
    const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
    const grouped = groupStocksByTickerCategory(base);
    return Array.from(grouped.values()).map(mergeStockGroup);
  })();

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      return {
        queryKey: ["dividend", "v11", ticker, type],
        queryFn: () => fetchDividend(ticker, type, "NAS"),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const rows: StockDividendRow[] = stocksWithTicker
    .map((stock, i): StockDividendRow | null => {
      const allPayouts: DividendPayoutResult[] = Array.isArray(queries[i]?.data)
        ? (queries[i].data as DividendPayoutResult[])
        : [];
      // 매수월(년-월)과 같은 달이면 매수일 이전 지급도 포함
      const purchaseYM = stock.purchaseDate ? stock.purchaseDate.slice(0, 7) : null;
      const payouts = stock.purchaseDate
        ? allPayouts.filter((p) => p.payoutDate.slice(0, 7) >= purchaseYM! || p.payoutDate >= stock.purchaseDate!)
        : allPayouts;
      if (allPayouts.length === 0) return null;

      const firstPayout = payouts[0] ?? allPayouts[0];
      if (!firstPayout) return null;
      const currency = firstPayout.currency || (stock.currency === "USD" ? "USD" : "KRW");
      const rate = currency === "USD" ? usdRate : 1;
      const beforePurchaseMonths = stock.purchaseDate
        ? [...new Set(
          allPayouts
            .filter((p) => p.payoutDate.slice(0, 7) < purchaseYM!)
            .map((p) => parseInt(p.payoutDate.split("-")[1], 10))
            .filter(Boolean)
        )].sort((a, b) => a - b)
        : [];
      // 지급 여부는 payoutDate의 년-월 <= 오늘(KST) 년-월 기준 (isEstimated 플래그보다 날짜 우선)
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const currentYM = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;
      const isPaid = (p: DividendPayoutResult) => p.payoutDate.slice(0, 7) <= currentYM;
      const actualMonths = [
        ...new Set(payouts.filter(isPaid).map((p) => parseInt(p.payoutDate.split("-")[1], 10)).filter(Boolean)),
      ].sort((a, b) => a - b);
      const estimatedMonths = [
        ...new Set(payouts.filter((p) => !isPaid(p)).map((p) => parseInt(p.payoutDate.split("-")[1], 10)).filter(Boolean)),
      ].sort((a, b) => a - b);
      const payoutMonths = [...new Set([...actualMonths, ...estimatedMonths])].sort((a, b) => a - b);

      const annualTotal = Math.round(
        payouts.reduce((sum, p) => sum + p.amountPerShare * stock.quantity * rate, 0)
      );
      const annualForeign =
        currency === "USD"
          ? Math.round(payouts.reduce((sum, p) => sum + (p.amountForeign ?? p.amountPerShare) * stock.quantity, 0) * 100) / 100
          : 0;
      const perShareForeign = currency === "USD" ? (firstPayout.amountForeign ?? firstPayout.amountPerShare) : 0;
      const perShareKRW = Math.round(firstPayout.amountPerShare * rate);
      const actualPayouts = payouts.filter(isPaid);
      const annualActual = Math.round(actualPayouts.reduce((sum, p) => sum + p.amountPerShare * stock.quantity * rate, 0));
      const annualForeignActual =
        currency === "USD"
          ? Math.round(actualPayouts.reduce((sum, p) => sum + (p.amountForeign ?? p.amountPerShare) * stock.quantity, 0) * 100) / 100
          : 0;
      const monthlyPayout = selectedMonth !== undefined
        ? payouts.find((p) => parseInt(p.payoutDate.split("-")[1], 10) === selectedMonth)
        : undefined;
      const monthlyTotal = monthlyPayout
        ? Math.round(monthlyPayout.amountPerShare * rate * stock.quantity)
        : 0;
      const monthlyForeign =
        currency === "USD" && monthlyPayout
          ? Math.round((monthlyPayout.amountForeign ?? monthlyPayout.amountPerShare) * stock.quantity * 100) / 100
          : 0;
      const monthlyActualPayout = selectedMonth !== undefined
        ? actualPayouts.find((p) => parseInt(p.payoutDate.split("-")[1], 10) === selectedMonth)
        : undefined;
      const monthlyActual = monthlyActualPayout
        ? Math.round(monthlyActualPayout.amountPerShare * rate * stock.quantity)
        : 0;
      const monthlyForeignActual =
        currency === "USD" && monthlyActualPayout
          ? Math.round((monthlyActualPayout.amountForeign ?? monthlyActualPayout.amountPerShare) * stock.quantity * 100) / 100
          : 0;

      return {
        stock,
        beforePurchaseMonths,
        actualMonths,
        estimatedMonths,
        payoutMonths,
        perShareForeign,
        perShareKRW,
        currency,
        annualTotal,
        annualForeign,
        annualActual,
        annualForeignActual,
        monthlyTotal,
        monthlyForeign,
        monthlyActual,
        monthlyForeignActual,
        frequency: firstPayout.frequency,
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
          <div className="grid grid-cols-[2fr_4rem_3rem_3rem_3rem] sm:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-2 sm:gap-x-3 px-3 py-2 bg-muted/50 text-xs sm:text-sm text-muted-foreground border-b">
            <span>종목명</span>
            <span className="text-right">배당월</span>
            <span className="text-right">주당</span>
            <span className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 지급` : "지급금액"}</span>
            <span className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 예상` : "예상금액"}</span>
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
                  className="grid grid-cols-[2fr_4rem_3rem_3rem_3rem] sm:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-2 sm:gap-x-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs sm:text-sm font-semibold truncate">{stock.name || ticker}</p>
                      <span className="hidden sm:inline text-xs text-muted-foreground font-mono shrink-0">{ticker}</span>
                      {frequency && (
                        <Badge className={`hidden sm:inline-flex ${ASSET_THEME.categoryBox} text-xs px-1 py-0 h-4 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:hidden mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{ticker}</span>
                      {frequency && (
                        <Badge className={`${ASSET_THEME.categoryBox} text-[10px] px-1 py-0 h-4 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      )}
                    </div>
                    {stock.purchaseDate && <p className="text-xs text-muted-foreground/60 mt-1">매수 {stock.purchaseDate}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-end">
                    {beforePurchaseMonths.map((m) => (
                      <Badge
                        key={`before-${m}`}
                        variant="outline"
                        className="text-[10px] sm:text-xs px-2 py-0.5 h-6 opacity-25 cursor-default"
                      >
                        {m}월
                      </Badge>
                    ))}
                    {actualMonths.map((m) => (
                      <Badge
                        key={`actual-${m}`}
                        variant={m === selectedMonth ? "default" : "outline"}
                        className="text-[10px] sm:text-xs px-2 py-0.5 h-6 font-semibold"
                        style={m !== selectedMonth ? { backgroundColor: `${MAIN_PALETTE[0]}22`, color: MAIN_PALETTE[0], borderColor: `${MAIN_PALETTE[0]}66` } : undefined}
                      >
                        {m}월
                      </Badge>
                    ))}
                    {estimatedMonths.map((m) => (
                      <Badge
                        key={`est-${m}`}
                        variant={m === selectedMonth ? "default" : "outline"}
                        className={`text-[10px] sm:text-xs px-2 py-0.5 h-6 ${m !== selectedMonth ? "border-dashed text-muted-foreground" : ""}`}
                      >
                        {m}월 예정
                      </Badge>
                    ))}
                  </div>
                  <div className="text-right">
                    {!isDomestic && currency === "USD" ? (
                      <>
                        <p className="text-xs sm:text-sm tabular-nums" style={{ color: MAIN_PALETTE[10] }}>${perShareForeign.toFixed(4)}</p>
                        <p className="text-xs sm:text-sm tabular-nums text-muted-foreground">{perShareKRW.toLocaleString()}원</p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm tabular-nums" style={{ color: MAIN_PALETTE[10] }}>{perShareKRW.toLocaleString()}원</p>
                    )}
                    <p className="text-[11px] sm:text-xs tabular-nums text-muted-foreground">보유 {stock.quantity}주</p>
                  </div>
                  <div className="text-right break-words">
                    {!isDomestic && currency === "USD" && displayForeignActual > 0 && (
                      <p className="text-xs sm:text-sm tabular-nums text-muted-foreground">${displayForeignActual.toFixed(2)}</p>
                    )}
                    <p className="text-xs sm:text-sm font-bold tabular-nums text-foreground">
                      {displayActual > 0 ? formatCurrency(displayActual) : <span className="text-muted-foreground">-</span>}
                    </p>
                  </div>
                  <div className="text-right break-words">
                    {!isDomestic && currency === "USD" && (
                      <p className="text-xs sm:text-sm tabular-nums text-muted-foreground ">${displayForeign.toFixed(2)}</p>
                    )}
                    <p className={`text-xs sm:text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>
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
