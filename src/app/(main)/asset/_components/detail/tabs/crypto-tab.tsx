"use client";

import { Pencil, Trash2, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { assignColors } from "../asset-detail-tabs";

export function CryptoTab() {
  const { assetData, deleteCrypto, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteCrypto(id);
      toast.success("삭제되었습니다.");
    }
  };

  const sorted = [...assetData.crypto]
    .map((coin) => {
      const value = coin.quantity * coin.currentPrice;
      const cost = coin.quantity * coin.averagePrice;
      const profit = value - cost;
      const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
      return { coin, value, cost, profit, profitRate };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = summary.cryptoValue;
  const totalProfit = summary.cryptoProfit;
  const totalCost = summary.cryptoCost;

  const cryptoColors = assignColors(sorted.map((d) => ({ value: d.value })));
  const barItems = sorted.map(({ coin, value }, idx) => ({ coin, value, color: cryptoColors[idx] }));

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 암호화폐 평가금액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(totalProfit))} ({totalProfit >= 0 ? "+" : ""}{((totalProfit / totalCost) * 100).toFixed(2)}%)
          </p>
        </div>
      </div>

      {barItems.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {barItems.map(({ coin, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={coin.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${coin.name}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {barItems.map(({ coin, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={coin.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{coin.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 암호화폐가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ coin, value, profit, profitRate }, idx) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            const color = cryptoColors[idx] ?? MAIN_PALETTE[0];
            const holdingDays = calculateHoldingDays(coin.purchaseDate);
            return (
              <Collapsible key={coin.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <span className="text-[10px] font-bold text-white">{(coin.symbol || coin.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{coin.name}</span>
                            {coin.symbol && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{coin.symbol}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-foreground">{coin.quantity.toLocaleString()}개</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                          <p className={`text-xs tabular-nums ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-crypto", { detail: { id: coin.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(coin.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <CollapsibleContent>
                    <div className="border-t divide-y divide-border/50">
                      <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                        <div><p className="text-xs text-muted-foreground">평균단가</p><p className="text-sm font-medium">{formatCurrency(coin.averagePrice)}</p></div>
                        <div><p className="text-xs text-muted-foreground">현재가</p><p className="text-sm font-semibold" style={{ color: MAIN_PALETTE[2] }}>{formatCurrency(coin.currentPrice)}</p></div>
                      </div>
                      <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
                        <span className="flex items-center gap-1"><Clock className="size-3" /><span className="font-medium text-foreground">{holdingDays.toLocaleString()}일 보유</span></span>
                        <span className="flex items-center gap-1"><Calendar className="size-3" /><span className="font-medium text-foreground">{coin.purchaseDate} 매수</span></span>
                        {coin.description && <span className="w-full text-primary truncate"># {coin.description}</span>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
