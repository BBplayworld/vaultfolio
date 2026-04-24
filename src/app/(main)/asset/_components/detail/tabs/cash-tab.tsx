"use client";

import { Pencil, Trash2, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { cashTypes } from "@/config/asset-options";
import { getMultiplier, formatCurrencyDisplay } from "../asset-detail-tabs";

export const CASH_TYPE_COLORS: Record<string, string> = {
  deposit: MAIN_PALETTE[0],
  savings: MAIN_PALETTE[4],
  bank: MAIN_PALETTE[5],
  cma: MAIN_PALETTE[6],
  cash: MAIN_PALETTE[3],
};

export function CashTab() {
  const { assetData, deleteCash, getAssetSummary, exchangeRates } = useAssetData();
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

  const sorted = [...assetData.cash]
    .map((item) => ({ item, value: item.balance * mul(item.currency) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteCash(id); toast.success("삭제되었습니다."); }
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

      {cashTypeData.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {cashTypeData.map(({ type, label, value: v }) => {
              const pct = (v / totalValue) * 100;
              const color = CASH_TYPE_COLORS[type] ?? MAIN_PALETTE[8];
              return (
                <div key={type} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {cashTypeData.map(({ type, label, value: v }) => {
              const pct = (v / totalValue) * 100;
              const color = CASH_TYPE_COLORS[type] ?? MAIN_PALETTE[8];
              return (
                <div key={type} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{label}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 현금성 자산이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ item, value }, idx) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            const color = CASH_TYPE_COLORS[item.type] ?? MAIN_PALETTE[idx % 5];
            const typeLabel = cashTypes.find((t) => t.value === item.type)?.label ?? item.type;
            const linkedLoans = assetData.loans.filter((l) => l.linkedCashId === item.id);
            return (
              <Collapsible key={item.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <Banknote className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{item.name}</span>
                            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                            {item.institution && <span className="text-xs text-muted-foreground shrink-0">({item.institution})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                          {item.currency !== "KRW" && <p className="text-xs text-muted-foreground">{formatCurrencyDisplay(item.balance, item.currency)}</p>}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-cash", { detail: { id: item.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
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
          })}
        </div>
      )}
    </div>
  );
}
