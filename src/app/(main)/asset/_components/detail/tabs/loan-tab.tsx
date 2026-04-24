"use client";

import { Pencil, Trash2, MapPin, TrendingUp, Banknote, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { loanTypes, loanTypeOrder } from "@/config/asset-options";

export const LOAN_TYPE_COLORS: Record<string, string> = {
  "credit": MAIN_PALETTE[1],
  "minus": MAIN_PALETTE[2],
  "mortgage-home": MAIN_PALETTE[0],
  "mortgage-stock": MAIN_PALETTE[9],
  "mortgage-insurance": MAIN_PALETTE[3],
  "mortgage-deposit": MAIN_PALETTE[4],
  "mortgage-other": MAIN_PALETTE[8],
};

function formatDaysToYMD(days: number): string {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d = days - years * 365 - months * 30;
  const parts = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  if (d > 0 || parts.length === 0) parts.push(`${d}일`);
  return parts.join(" ");
}

export function LoanTab() {
  const { assetData, deleteLoan, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const totalBalance = summary.loanBalance;

  const loanTypeBarItems = loanTypes
    .map(({ value: type, shortLabel: label }) => {
      const total = assetData.loans.filter((l) => l.type === type).reduce((s, l) => s + l.balance, 0);
      return { type, label, value: total, color: LOAN_TYPE_COLORS[type] ?? MAIN_PALETTE[8] };
    })
    .filter((d) => d.value > 0);

  const sorted = [...assetData.loans]
    .filter((l) => l.balance > 0)
    .sort((a, b) => {
      const typeOrder = loanTypeOrder.indexOf(a.type) - loanTypeOrder.indexOf(b.type);
      return typeOrder !== 0 ? typeOrder : b.balance - a.balance;
    });

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteLoan(id); toast.success("삭제되었습니다."); }
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 대출 잔액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalBalance)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="text-right space-y-1">
          {loanTypeBarItems.map((d) => (
            <div key={d.type} className="text-xs">
              <span className="text-muted-foreground">{d.label} </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {loanTypeBarItems.length > 0 && totalBalance > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {loanTypeBarItems.map(({ type, label, value: v, color }) => {
              const pct = (v / totalBalance) * 100;
              return (
                <div key={type} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {loanTypeBarItems.map(({ type, label, value: v, color }) => {
              const pct = (v / totalBalance) * 100;
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
          <p className="text-muted-foreground text-sm">등록된 대출이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((loan, idx) => {
            const pct = totalBalance > 0 ? (loan.balance / totalBalance) * 100 : 0;
            const color = LOAN_TYPE_COLORS[loan.type] ?? MAIN_PALETTE[idx % 5];
            const typeLabel = loanTypes.find((t) => t.value === loan.type)?.label ?? loan.type;
            const daysElapsed = calculateHoldingDays(loan.startDate);
            const daysRemaining = loan.endDate ? calculateHoldingDays(loan.endDate) : null;
            const linkedRealEstate = loan.linkedRealEstateId ? assetData.realEstate.find((re) => re.id === loan.linkedRealEstateId) : null;
            const linkedStock = loan.linkedStockId ? assetData.stocks.find((s) => s.id === loan.linkedStockId) : null;
            const linkedCash = loan.linkedCashId ? assetData.cash.find((c) => c.id === loan.linkedCashId) : null;
            return (
              <Collapsible key={loan.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <CreditCard className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{loan.name}</span>
                            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                            {loan.institution && <span className="text-xs text-muted-foreground shrink-0">({loan.institution})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">금리 {loan.interestRate}%</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.liability}`}>-{formatShortCurrency(loan.balance)}</p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-loan", { detail: { id: loan.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(loan.id)}>
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
                        <div>
                          <p className="text-xs text-muted-foreground">대출일</p>
                          <p className="text-sm font-medium">{loan.startDate}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDaysToYMD(daysElapsed)} 경과</p>
                        </div>
                        {loan.endDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">만기일</p>
                            <p className={`text-sm font-semibold ${ASSET_THEME.primary.text}`}>{loan.endDate}</p>
                            {daysRemaining !== null && <p className="text-[11px] text-muted-foreground">{formatDaysToYMD(daysRemaining)} 남음</p>}
                          </div>
                        )}
                      </div>
                      {linkedRealEstate && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <MapPin className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 부동산</span>
                          <span className="font-medium text-primary truncate">{linkedRealEstate.name}</span>
                        </div>
                      )}
                      {linkedStock && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <TrendingUp className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 주식</span>
                          <span className="font-medium text-primary truncate">{linkedStock.name}</span>
                          {linkedStock.ticker && <span className="text-muted-foreground">({linkedStock.ticker})</span>}
                        </div>
                      )}
                      {linkedCash && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <Banknote className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 예금</span>
                          <span className="font-medium text-primary truncate">{linkedCash.name}</span>
                        </div>
                      )}
                      {loan.description && <div className="px-4 py-2 text-xs text-primary bg-muted/5"># {loan.description}</div>}
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
