"use client";

import { Pencil, Trash2, Calendar, Clock, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, formatHoldingPeriod } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { assignColors } from "../asset-detail-tabs";

function CryptoCard({ coin, value, profit, profitRate, pct, color, onDelete }: {
  coin: { id: string; symbol?: string; name: string; quantity: number; averagePrice: number; currentPrice: number; purchaseDate: string; description?: string };
  value: number; profit: number; profitRate: number; pct: number; color: string;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <span className="text-[9px] sm:text-[10px] font-bold text-white">{(coin.symbol || coin.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?"}</span>
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{coin.name}</span>
                  {coin.symbol && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{coin.symbol}</span>}
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-xs text-foreground">{coin.quantity.toLocaleString()}개</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}</p>
                  <p className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                </div>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className={ASSET_THEME.cardActions}>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-crypto", { detail: { id: coin.id } }))}>
              <Pencil className="size-3.5" />
            </Button>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => onDelete(coin.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        {!open && <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />}
        <CollapsibleContent>
          <div className="border-t divide-y divide-border/50">
            <div className="grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 bg-muted/10">
              <div><p className={ASSET_THEME.cardDetailLabel}>매입가</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(coin.averagePrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 매입금액</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(coin.averagePrice * coin.quantity)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>현재가</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: MAIN_PALETTE[10] }}>{formatCurrency(coin.currentPrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 평가금액</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: MAIN_PALETTE[10] }}>{formatCurrency(coin.currentPrice * coin.quantity)}</p></div>
            </div>
            <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
              <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(coin.purchaseDate)} 보유</span></span>
              <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{coin.purchaseDate} 매수</span></span>
              {coin.description && <span className="w-full text-primary truncate"># {coin.description}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

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
          <p className="text-xs text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(totalProfit))} ({totalProfit >= 0 ? "+" : ""}{(totalCost > 0 ? (totalProfit / totalCost) * 100 : 0).toFixed(2)}%)
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
                  {pct > 5 && <span className="text-white text-[11px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-2">
            {barItems.map(({ coin, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={coin.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs sm:text-sm text-foreground">{coin.name}</span>
                  <span className="text-xs sm:text-sm font-bold shrink-0" style={{ color: color }}>{pct.toFixed(1)}%</span>
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
            return (
              <CryptoCard key={coin.id} coin={coin} value={value} profit={profit} profitRate={profitRate} pct={pct} color={color} onDelete={handleDelete} />
            );
          })}
        </div>
      )}
    </div>
  );
}
