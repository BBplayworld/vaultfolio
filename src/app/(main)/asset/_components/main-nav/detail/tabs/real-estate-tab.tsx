"use client";

import { Pencil, Trash2, MapPin, CreditCard, ChevronDown, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { realEstateTypes } from "@/config/asset-options";
import { assignColors } from "../asset-detail-tabs";
import { RealEstate, Loan } from "@/types/asset";

const RE_CATEGORY_TABS = [
  { value: "all", label: "전체" },
  ...realEstateTypes.map(({ value, shortLabel }) => ({ value, label: shortLabel })),
] as const;

const CAT_LIST = ASSET_THEME.tabList3;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

function RealEstateCard({ item, profit, profitRate, pct, color, typeLabel, linkedLoans, onDelete }: {
  item: RealEstate; profit: number; profitRate: number; pct: number; color: string;
  typeLabel: string; linkedLoans: Loan[]; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <Building2 className="size-3.5 sm:size-4 text-white" />
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{item.name}</span>
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] px-1 py-0 leading-tight`}>{typeLabel}</Badge>
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-[11px] text-foreground">{formatShortCurrency(item.purchasePrice)} 매입</span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatShortCurrency(item.currentValue)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}</p>
                  <p className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                </div>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className={ASSET_THEME.cardActions}>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-real-estate", { detail: { id: item.id } }))}>
              <Pencil className="size-3" />
            </Button>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => onDelete(item.id)}>
              <Trash2 className="size-3" />
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
  const [activeCategory, setActiveCategory] = useState("all");
  const summary = getAssetSummary();

  const allSorted = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);
  const totalValue = summary.realEstateValue;

  const reBarColors = assignColors(allSorted.map((item) => ({ value: item.currentValue })));
  const barItems = allSorted.map((item, idx) => ({ item, value: item.currentValue, color: reBarColors[idx] }));

  const filteredItems = activeCategory === "all"
    ? allSorted
    : allSorted.filter((item) => item.type === activeCategory);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteRealEstate(id); toast.success("삭제되었습니다."); }
  };

  const renderCard = (item: RealEstate) => {
    const idx = allSorted.findIndex((r) => r.id === item.id);
    const profit = item.currentValue - item.purchasePrice;
    const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
    const pct = totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0;
    const color = reBarColors[idx] ?? MAIN_PALETTE[0];
    const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
    const typeLabel = realEstateTypes.find((t) => t.value === item.type)?.label ?? item.type;
    return (
      <RealEstateCard key={item.id} item={item} profit={profit} profitRate={profitRate} pct={pct} color={color} typeLabel={typeLabel} linkedLoans={linkedLoans} onDelete={handleDelete} />
    );
  };

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
            {summary.realEstateProfit >= 0 ? "+" : ""}{formatShortCurrency(summary.realEstateProfit)} ({summary.realEstateProfit >= 0 ? "+" : ""}{(summary.realEstateCost > 0 ? (summary.realEstateProfit / summary.realEstateCost) * 100 : 0).toFixed(1)}%)
          </p>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className={CAT_LIST}>
          {RE_CATEGORY_TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className={CAT_TRIGGER}>{label}</TabsTrigger>
          ))}
        </TabsList>

        {RE_CATEGORY_TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-3">
            {barItems.length > 0 && totalValue > 0 && (
              <div className="space-y-2">
                <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
                  {barItems.map(({ item, value: v, color }) => {
                    const pct = (v / totalValue) * 100;
                    return (
                      <div key={item.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${item.name}: ${pct.toFixed(1)}%`}>
                        {pct > 5 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
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

            {filteredItems.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground text-sm">등록된 부동산이 없습니다.</p>
              </div>
            ) : value === "all" ? (
              <div className="space-y-4 mt-8">
                {RE_CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                  const catItems = allSorted.filter((item) => item.type === cat.value);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat.value}>
                      <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                      <div className="space-y-2">{catItems.map(renderCard)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 mt-8">{filteredItems.map(renderCard)}</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
