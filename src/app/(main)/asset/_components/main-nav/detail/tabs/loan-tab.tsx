"use client";

import { Pencil, Trash2, MapPin, TrendingUp, Banknote, CreditCard, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { loanTypes } from "@/config/asset-options";
import { Loan, RealEstate, Stock, Cash } from "@/types/asset";

const CAT_LIST = ASSET_THEME.tabList3Wrap;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3Wrap;

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

function LoanCard({ loan, pct, color, typeLabel, daysElapsed, daysRemaining, linkedRealEstate, linkedStock, linkedCash, onDelete }: {
  loan: Loan; pct: number; color: string; typeLabel: string; daysElapsed: number; daysRemaining: number | null;
  linkedRealEstate: RealEstate | null; linkedStock: Stock | null; linkedCash: Cash | null;
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
                <CreditCard className="size-3.5 sm:size-4 text-white" />
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{loan.name}</span>
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] px-1 py-0 leading-tight`}>{typeLabel}</Badge>
                  {loan.institution && <span className="text-xs text-muted-foreground shrink-0">({loan.institution})</span>}
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-xs text-muted-foreground">금리 {loan.interestRate}%</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.liability}`}>{formatShortCurrency(loan.balance)}</p>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        {!open && <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />}
        <CollapsibleContent>
          <div className="border-t divide-y divide-border/50">
            <div className="relative">
              <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>대출일</p>
                  <p className={ASSET_THEME.cardDetailValue}>{loan.startDate}</p>
                  <p className={ASSET_THEME.cardDetailMeta}>{formatDaysToYMD(daysElapsed)} 경과</p>
                </div>
                {loan.endDate && (
                  <div>
                    <p className={ASSET_THEME.cardDetailLabel}>만기일</p>
                    <p className={`${ASSET_THEME.cardDetailValueBold} ${ASSET_THEME.text.default}`}>{loan.endDate}</p>
                    {daysRemaining !== null && <p className={ASSET_THEME.cardDetailMeta}>{formatDaysToYMD(daysRemaining)} 남음</p>}
                  </div>
                )}
              </div>
              <div className={`absolute top-2 right-2 ${ASSET_THEME.cardActions}`}>
                <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-loan", { detail: { id: loan.id } }))}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => onDelete(loan.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {linkedRealEstate && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/5">
                <MapPin className="size-3 text-primary flex-shrink-0" />
                <span className={ASSET_THEME.cardDetailLabel}>연계 부동산</span>
                <span className="text-sm font-medium text-primary truncate">{linkedRealEstate.name}</span>
              </div>
            )}
            {linkedStock && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/5">
                <TrendingUp className="size-3 text-primary flex-shrink-0" />
                <span className={ASSET_THEME.cardDetailLabel}>연계 주식</span>
                <span className="text-sm font-medium text-primary truncate">{linkedStock.name}</span>
                {linkedStock.ticker && <span className={ASSET_THEME.cardDetailLabel}>({linkedStock.ticker})</span>}
              </div>
            )}
            {linkedCash && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/5">
                <Banknote className="size-3 text-primary flex-shrink-0" />
                <span className={ASSET_THEME.cardDetailLabel}>연계 예금</span>
                <span className="text-sm font-medium text-primary truncate">{linkedCash.name}</span>
              </div>
            )}
            {loan.description && <div className="px-4 py-2 text-sm text-primary bg-muted"># {loan.description}</div>}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const LOAN_CATEGORY_TABS = [
  { value: "all", label: "전체" },
  ...loanTypes.map(({ value, shortLabel }) => ({ value, label: shortLabel })),
] as const;

export function LoanTab() {
  const { assetData, deleteLoan, getAssetSummary } = useAssetData();
  const [activeCategory, setActiveCategory] = useState("all");
  const summary = getAssetSummary();
  const totalBalance = summary.loanBalance;

  const allLoans = [...assetData.loans]
    .filter((l) => l.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const filteredLoans = activeCategory === "all"
    ? allLoans
    : allLoans.filter((l) => l.type === activeCategory);

  const filteredTotal = filteredLoans.reduce((s, l) => s + l.balance, 0);

  const loanBarItems = filteredLoans.map((l) => ({
    loan: l,
    value: l.balance,
    color: LOAN_TYPE_COLORS[l.type] ?? MAIN_PALETTE[8],
  }));

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteLoan(id); toast.success("삭제되었습니다."); }
  };

  const renderLoanCard = (loan: Loan) => {
    const pct = totalBalance > 0 ? (loan.balance / totalBalance) * 100 : 0;
    const color = LOAN_TYPE_COLORS[loan.type] ?? MAIN_PALETTE[10];
    const typeLabel = loanTypes.find((t) => t.value === loan.type)?.label ?? loan.type;
    const daysElapsed = calculateHoldingDays(loan.startDate);
    const daysRemaining = loan.endDate ? calculateHoldingDays(loan.endDate) : null;
    const linkedRealEstate = loan.linkedRealEstateId ? assetData.realEstate.find((re) => re.id === loan.linkedRealEstateId) ?? null : null;
    const linkedStock = loan.linkedStockId ? assetData.stocks.find((s) => s.id === loan.linkedStockId) ?? null : null;
    const linkedCash = loan.linkedCashId ? assetData.cash.find((c) => c.id === loan.linkedCashId) ?? null : null;
    return (
      <LoanCard key={loan.id} loan={loan} pct={pct} color={color} typeLabel={typeLabel} daysElapsed={daysElapsed} daysRemaining={daysRemaining} linkedRealEstate={linkedRealEstate} linkedStock={linkedStock} linkedCash={linkedCash} onDelete={handleDelete} />
    );
  };

  return (
    <div className="space-y-4 mt-2">
      {/* 요약 헤더 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 대출 잔액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalBalance)}</p>
          <p className="text-xs text-foreground">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="text-right space-y-1">
          {loanBarItems.map((d) => (
            <div key={d.loan.id} className="text-xs">
              <span className="text-muted-foreground">{d.loan.name} </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 카테고리 서브탭 */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className={CAT_LIST}>
          {LOAN_CATEGORY_TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className={CAT_TRIGGER}>{label}</TabsTrigger>
          ))}
        </TabsList>

        {LOAN_CATEGORY_TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-3">
            {/* 비중 바 */}
            {loanBarItems.length > 0 && filteredTotal > 0 && (
              <div className="space-y-2">
                <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
                  {loanBarItems.map(({ loan, value: v, color }) => {
                    const pct = (v / filteredTotal) * 100;
                    return (
                      <div key={loan.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${loan.name}: ${pct.toFixed(1)}%`}>
                        {pct > 5 && <span className="text-white text-[11px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-2">
                  {loanBarItems.map(({ loan, value: v, color }) => {
                    const pct = (v / filteredTotal) * 100;
                    return (
                      <div key={loan.id} className="flex items-center gap-1">
                        <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs sm:text-sm text-foreground">{loan.name}</span>
                        <span className="text-xs sm:text-sm font-bold shrink-0" style={{ color: color }}>{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 대출 리스트 */}
            {filteredLoans.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground text-sm">등록된 대출이 없습니다.</p>
              </div>
            ) : value === "all" ? (
              <div className="space-y-4 mt-8">
                {LOAN_CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                  const catLoans = filteredLoans.filter((l) => l.type === cat.value);
                  if (catLoans.length === 0) return null;
                  return (
                    <div key={cat.value}>
                      <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                      <div className="space-y-2">{catLoans.map(renderLoanCard)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 mt-8">{filteredLoans.map(renderLoanCard)}</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
