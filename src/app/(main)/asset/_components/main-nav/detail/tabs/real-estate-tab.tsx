"use client";

import { Pencil, Trash2, MapPin, CreditCard, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { realEstateTypes } from "@/config/asset-options";
import { Building2 } from "lucide-react";
import { assignColors } from "../asset-detail-tabs";
import { RealEstate, Loan } from "@/types/asset";

function RealEstateCard({ item, profit, profitRate, pct, color, holdingDays, typeLabel, linkedLoans, onDelete }: {
  item: RealEstate; profit: number; profitRate: number; pct: number; color: string; holdingDays: number;
  typeLabel: string; linkedLoans: Loan[]; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className={`flex items-center gap-6 px-3 py-2.5 ${ASSET_THEME.primary.bgLight} transition-colors hover:bg-primary/20`}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <Building2 className="size-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm truncate">{item.name}</span>
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-foreground">{formatShortCurrency(item.purchasePrice)} 매입</span>
                  <span className="text-xs text-muted-foreground">{`${holdingDays.toLocaleString()}일 보유`}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(item.currentValue)}</p>
                <p className={`text-xs tabular-nums ${getProfitLossColor(profit)}`}>
                  {profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                </p>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-real-estate", { detail: { id: item.id } }))}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="outline" className="size-8" onClick={() => onDelete(item.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        {!open && <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />}
        <CollapsibleContent>
          <div className="border-t divide-y divide-border/50">
            <div className="grid grid-cols-3 px-4 py-2.5 gap-2 bg-muted/10">
              <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">매입가</p>
                <p className="text-sm font-medium tabular-nums">{formatShortCurrency(item.purchasePrice)}</p>
              </div>
              <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">실거래가</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: MAIN_PALETTE[5] }}>{formatShortCurrency(item.currentValue)}</p>
              </div>
              <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">평가손익</p>
                <p className={`text-sm font-bold tabular-nums ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}</p>
              </div>
            </div>
            {item.address && (
              <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground bg-muted/5">
                <MapPin className="size-3 flex-shrink-0" />
                <span className="truncate">{item.address}</span>
              </div>
            )}
            {(item.tenantDeposit ?? 0) > 0 && (
              <div className="flex items-center justify-between px-4 py-2 text-xs bg-muted/10">
                <span className="text-muted-foreground">임차인보증금</span>
                <span className={`font-semibold ${ASSET_THEME.liability}`}>{formatShortCurrency(item.tenantDeposit!)}</span>
              </div>
            )}
            {linkedLoans.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">주택담보대출</p>
                {linkedLoans.map((loan) => (
                  <div key={loan.id} className={ASSET_THEME.liabilityBadge}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CreditCard className="size-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground truncate">{loan.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>-{formatShortCurrency(loan.balance)}</span>
                      <span className="text-muted-foreground">{loan.interestRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function RealEstateTab() {
  const { assetData, deleteRealEstate, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const sorted = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);
  const totalValue = summary.realEstateValue;

  const reBarColors = assignColors(sorted.map((item) => ({ value: item.currentValue })));
  const barItems = sorted.map((item, idx) => ({ item, value: item.currentValue, color: reBarColors[idx] }));

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 부동산 평가금액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(summary.realEstateProfit)}`}>
            {summary.realEstateProfit >= 0 ? "+" : ""}{formatShortCurrency(summary.realEstateProfit)} ({summary.realEstateProfit >= 0 ? "+" : ""}{((summary.realEstateProfit / summary.realEstateCost) * 100).toFixed(1)}%)
          </p>
        </div>
      </div>

      {barItems.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {barItems.map(({ item, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={item.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${item.name}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {barItems.map(({ item, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={item.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{item.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 부동산이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item, idx) => {
            const profit = item.currentValue - item.purchasePrice;
            const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
            const holdingDays = calculateHoldingDays(item.purchaseDate);
            const pct = totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0;
            const color = reBarColors[idx] ?? MAIN_PALETTE[0];
            const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
            const typeLabel = realEstateTypes.find((t) => t.value === item.type)?.label ?? item.type;
            return (
              <RealEstateCard key={item.id} item={item} profit={profit} profitRate={profitRate} pct={pct} color={color} holdingDays={holdingDays} typeLabel={typeLabel} linkedLoans={linkedLoans} onDelete={(id) => { if (confirm("정말 삭제하시겠습니까?")) { deleteRealEstate(id); toast.success("삭제되었습니다."); } }} />
            );
          })}
        </div>
      )}
    </div>
  );
}
