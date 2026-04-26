"use client";

import { Pencil, Trash2, CreditCard, Banknote, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { cashTypes } from "@/config/asset-options";
import { getMultiplier, formatCurrencyDisplay } from "../asset-detail-tabs";
import { Cash, Loan } from "@/types/asset";

const CASH_CATEGORY_TABS = [
  { value: "all", label: "전체" },
  ...cashTypes.map(({ value, shortLabel }) => ({ value, label: shortLabel })),
] as const;

const CAT_LIST = ASSET_THEME.tabList3;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

export const CASH_TYPE_COLORS: Record<string, string> = {
  deposit: MAIN_PALETTE[0],
  savings: MAIN_PALETTE[4],
  bank: MAIN_PALETTE[5],
  cma: MAIN_PALETTE[6],
  cash: MAIN_PALETTE[3],
};

function CashCard({ item, value, pct, color, typeLabel, linkedLoans, onDelete }: {
  item: Cash; value: number; pct: number; color: string; typeLabel: string;
  linkedLoans: Loan[]; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <Banknote className="size-3.5 sm:size-4 text-white" />
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{item.name}</span>
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] px-1 py-0 leading-tight`}>{typeLabel}</Badge>
                  {item.institution && <span className="text-[11px] text-muted-foreground shrink-0">({item.institution})</span>}
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-[11px] font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                {item.currency !== "KRW" && <p className="text-[11px] text-muted-foreground">{formatCurrencyDisplay(item.balance, item.currency)}</p>}
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className={ASSET_THEME.cardActions}>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-cash", { detail: { id: item.id } }))}>
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
            {linkedLoans.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5 bg-muted/10">
                <p className="text-[11px] font-semibold text-muted-foreground">예금담보대출</p>
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
            {item.description && <div className="px-4 py-2 text-xs text-primary bg-muted/5"># {item.description}</div>}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CashTab() {
  const { assetData, deleteCash, getAssetSummary, exchangeRates } = useAssetData();
  const [activeCategory, setActiveCategory] = useState("all");
  const summary = getAssetSummary();

  const mul = (currency?: string) => getMultiplier(currency, exchangeRates);
  const totalValue = summary.cashValue;

  const cashTypeData = cashTypes
    .map(({ value: type, label }) => {
      const items = assetData.cash.filter((c) => c.type === type);
      const value = items.reduce((sum, c) => sum + c.balance * mul(c.currency), 0);
      return { type, label, value };
    })
    .filter((d) => d.value > 0);

  const allSorted = [...assetData.cash]
    .map((item) => ({ item, value: item.balance * mul(item.currency) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const filteredSorted = activeCategory === "all"
    ? allSorted
    : allSorted.filter(({ item }) => item.type === activeCategory);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteCash(id); toast.success("삭제되었습니다."); }
  };

  const renderCard = ({ item, value }: { item: Cash; value: number }, idx: number) => {
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const color = CASH_TYPE_COLORS[item.type] ?? MAIN_PALETTE[idx % 5];
    const typeLabel = cashTypes.find((t) => t.value === item.type)?.label ?? item.type;
    const linkedLoans = assetData.loans.filter((l) => l.linkedCashId === item.id);
    return <CashCard key={item.id} item={item} value={value} pct={pct} color={color} typeLabel={typeLabel} linkedLoans={linkedLoans} onDelete={handleDelete} />;
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 현금성 자산</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right space-y-1">
          {cashTypeData.map((d) => (
            <div key={d.type} className="text-xs">
              <span className="text-muted-foreground">{d.label} </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className={CAT_LIST}>
          {CASH_CATEGORY_TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className={CAT_TRIGGER}>{label}</TabsTrigger>
          ))}
        </TabsList>

        {CASH_CATEGORY_TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-3">
            {allSorted.length > 0 && totalValue > 0 && (
              <div className="space-y-2">
                <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
                  {allSorted.map(({ item, value: v }, idx) => {
                    const pct = (v / totalValue) * 100;
                    const color = CASH_TYPE_COLORS[item.type] ?? MAIN_PALETTE[idx % 5];
                    return (
                      <div key={item.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${item.name}: ${pct.toFixed(1)}%`}>
                        {pct > 5 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {allSorted.map(({ item, value: v }, idx) => {
                    const pct = (v / totalValue) * 100;
                    const color = CASH_TYPE_COLORS[item.type] ?? MAIN_PALETTE[idx % 5];
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

            {filteredSorted.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground text-sm">등록된 현금성 자산이 없습니다.</p>
              </div>
            ) : value === "all" ? (
              <div className="space-y-4 mt-8">
                {CASH_CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                  const catItems = allSorted.filter(({ item }) => item.type === cat.value);
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
              <div className="space-y-2 mt-8">{filteredSorted.map(renderCard)}</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
