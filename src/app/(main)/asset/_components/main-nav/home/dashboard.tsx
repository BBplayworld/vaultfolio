"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { cashTypes, loanTypes, realEstateTypes, stockCategories } from "@/config/asset-options";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const LIABILITY_COLORS = { loans: MAIN_PALETTE[1], tenant: MAIN_PALETTE[2] } as const;
export { LIABILITY_COLORS };

function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + (si++) % 7]));
}

export function SectionBar({ items, total }: { items: { key: string; label: string; value: number; color: string }[]; total: number }) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
              {pct > 5 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-bold text-primary">{pct.toFixed(1)}%</span>
              <span className="text-xs text-foreground">({formatShortCurrency(value)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type TreemapItem = { key: string; name: string; value: number; color: string; pct: number };

const RADIAN = Math.PI / 180;

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct, value, activeTab, itemKey, maskFn }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number;
  name: string; pct: number; value: number; activeTab?: string; itemKey?: string;
  maskFn?: (v: number) => string;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  if (pct < 5) return null;
  if (activeTab && activeTab !== "all" && itemKey !== activeTab) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
      <tspan x={x - 1} dy="-16" fontSize={10} fontWeight={700} fill="white">{name}</tspan>
      <tspan x={x} dy="16" fontSize={12} fontWeight={700} fill="rgba(255, 255, 255, 1)">{fmt(value)}</tspan>
      <tspan x={x + 3} dy="16" fontSize={12} fontWeight={700} fill="rgba(255, 255, 255, 0.6)">{pct.toFixed(1)}%</tspan>
    </text>
  );
}

export function AssetDonutChart({ items, netAsset, activeTab, onSegmentClick, screenshotMode = false, maskFn }: {
  items: TreemapItem[];
  netAsset: number;
  activeTab?: string;
  onSegmentClick?: (key: string) => void;
  screenshotMode?: boolean;
  maskFn?: (v: number) => string;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={screenshotMode ? 220 : 260} className={screenshotMode ? "" : "sm:!h-[360px]"} style={screenshotMode ? { pointerEvents: "none" } : undefined}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius={screenshotMode ? 45 : 55}
            outerRadius={screenshotMode ? 110 : 130}
            strokeWidth={2}
            stroke="var(--card)"
            labelLine={false}
            label={({ key, ...props }) => <DonutLabel key={key} itemKey={key} activeTab={activeTab} maskFn={maskFn} {...props} />}
            onClick={(data) => { if (!screenshotMode && data?.key && onSegmentClick) onSegmentClick(data.key as string); }}
            style={{ cursor: screenshotMode ? "default" : "pointer" }}
          >
            {items.map((item, i) => {
              const isAll = !activeTab || activeTab === "all";
              const isActive = item.key === activeTab;
              return (
                <Cell
                  key={i}
                  fill={item.color}
                  style={{
                    opacity: isAll || isActive ? 1 : 0.1,
                    filter: isActive ? "brightness(1.15)" : undefined,
                    transition: "opacity 0.2s, filter 0.2s",
                    cursor: screenshotMode ? "default" : "pointer",
                  }}
                />
              );
            })}
          </Pie>
          {(() => {
            const isAll = !activeTab || activeTab === "all";
            const active = isAll ? null : items.find((it) => it.key === activeTab);
            return (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                {active ? (
                  <>
                    <tspan x="50%" dy="-18" fontSize={12} fontWeight={700} fill="var(--muted-foreground)">{active.name}</tspan>
                    <tspan x="50%" dy="24" fontSize={18} fontWeight={700} fill="var(--foreground)">{fmt(active.value)}</tspan>
                    <tspan x="50%" dy="20" fontSize={14} fontWeight={600} fill="var(--muted-foreground)">{active.pct.toFixed(1)}%</tspan>
                  </>
                ) : (
                  <>
                    <tspan x="50%" dy="-12" fontSize={12} fill="var(--muted-foreground)">순자산</tspan>
                    <tspan x="50%" dy="26" fontSize={18} fontWeight={700} fill={screenshotMode ? ASSET_THEME.importantHex : "var(--foreground)"}>{formatShortCurrency(netAsset)}</tspan>
                  </>
                )}
              </text>
            );
          })()}
          {!screenshotMode && (
            <Tooltip
              formatter={(value: number, _: string, entry: { payload?: { name?: string; pct?: number } }) => [
                `${fmt(value)} (${entry.payload?.pct?.toFixed(1)}%)`,
                entry.payload?.name ?? "",
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {/* 범례 */}
      <div className={`grid gap-x-2 ${screenshotMode ? "gap-y-0.5 grid-cols-1 pointer-events-none" : "gap-y-1 grid-cols-1 sm:grid-cols-2"}`}>
        {items.map(({ key, name, value, color, pct }) => {
          const isAll = !activeTab || activeTab === "all";
          const isActive = key === activeTab;
          return (
            <div
              key={name}
              className={`flex items-center gap-1 min-w-0 rounded-md transition-all ${screenshotMode ? "px-1 py-1" : "px-1.5 py-2 cursor-pointer"} ${isActive && !screenshotMode ? "bg-muted" : !screenshotMode ? "hover:bg-muted/50" : ""}`}
              style={{ opacity: isAll || isActive ? 1 : 0.35 }}
              onClick={() => { if (!screenshotMode && onSegmentClick) onSegmentClick(key); }}
            >
              <span className={`rounded-full flex-shrink-0 ${screenshotMode ? "size-2" : "size-2.5"}`} style={{ backgroundColor: color }} />
              <span className={`text-foreground truncate ${screenshotMode ? "text-[10px]" : "text-xs"}`}>{name}</span>
              <span className={`font-bold text-muted-foreground ml-auto ${screenshotMode ? "text-[10px]" : "text-xs"}`}>{pct.toFixed(1)}%</span>
              <span className={`text-foreground ${screenshotMode ? "text-[10px]" : "text-xs"}`}>({fmt(value)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 자산 분포 도닛차트에 필요한 treemapData를 계산하는 후크.
 * ShareCard 등 다른 컨포넌트에서 재사용 가능.
 */
export function useAssetTreemapData() {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const totalAsset = summary.realEstateValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const financialAssetValue = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const liabilityValue = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + liabilityValue;

  const treemapRawAssets = [
    { key: "realEstate", name: "부동산", value: summary.realEstateValue },
    { key: "financial", name: "금융자산", value: financialAssetValue },
  ].filter((d) => d.value > 0);

  const assetPaletteColors = assignColors(treemapRawAssets);
  const treemapData: TreemapItem[] = [
    ...treemapRawAssets.map((d, i) => ({
      ...d,
      color: assetPaletteColors[i],
      pct: grossTotal > 0 ? (d.value / grossTotal) * 100 : 0,
    })),
    ...(liabilityValue > 0
      ? [{
        key: "liability",
        name: "부채",
        value: liabilityValue,
        color: LIABILITY_COLORS.loans,
        pct: grossTotal > 0 ? (liabilityValue / grossTotal) * 100 : 0,
      }]
      : []),
  ];

  return { treemapData, summary };
}

export function Dashboard() {
  const { assetData, getAssetSummary, exchangeRates } = useAssetData();
  const summary = getAssetSummary();
  const [activeDetailTab, setActiveDetailTab] = useState<string>("");

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  const totalAsset = summary.realEstateValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const totalLiability = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + totalLiability;

  const financialAssetValue = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const liabilityValue = summary.loanBalance + summary.tenantDepositTotal;
  const treemapRawAssets = [
    { key: "realEstate", name: "부동산", value: summary.realEstateValue },
    { key: "financial", name: "금융자산", value: financialAssetValue },
  ].filter((d) => d.value > 0);
  const assetPaletteColors = assignColors(treemapRawAssets);
  const treemapData: TreemapItem[] = [
    ...treemapRawAssets.map((d, i) => ({ ...d, color: assetPaletteColors[i], pct: grossTotal > 0 ? (d.value / grossTotal) * 100 : 0 })),
    ...(liabilityValue > 0 ? [{ key: "liability", name: "부채", value: liabilityValue, color: LIABILITY_COLORS.loans, pct: grossTotal > 0 ? (liabilityValue / grossTotal) * 100 : 0 }] : []),
  ];

  const financialTotal = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const finBase = [
    { key: "stocks", label: "주식", value: summary.stockValue },
    { key: "crypto", label: "암호화폐", value: summary.cryptoValue },
    { key: "cash", label: "현금성", value: summary.cashValue },
  ].filter((d) => d.value > 0);
  const finColors = assignColors(finBase);
  const financialBarItems = finBase.map((d, i) => ({ ...d, color: finColors[i] }));

  const stockCatBase = stockCategories
    .map((cat) => ({
      key: cat.value,
      label: cat.shortLabel,
      value: assetData.stocks.filter((s) => s.category === cat.value).reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency), 0),
    }))
    .filter((d) => d.value > 0);
  const stockCatColors = assignColors(stockCatBase);
  const stockCatBarItems = stockCatBase.map((d, i) => ({ ...d, color: stockCatColors[i] }));

  const cryptoBase = [...assetData.crypto]
    .map((coin) => ({ key: coin.id, label: coin.name || coin.symbol, value: coin.quantity * coin.currentPrice }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const cryptoColors = assignColors(cryptoBase);
  const cryptoBarItems = cryptoBase.map((d, i) => ({ ...d, color: cryptoColors[i] }));

  const cashBase = cashTypes
    .map(({ value: type, label }) => ({
      key: type,
      label,
      value: assetData.cash.filter((c) => c.type === type).reduce((sum, c) => sum + c.balance * getMultiplier(c.currency), 0),
    }))
    .filter((d) => d.value > 0);
  const cashColors = assignColors(cashBase);
  const cashTypeBarItems = cashBase.map((d, i) => ({ ...d, color: cashColors[i] }));

  const liabTopBase = [
    { key: "loans", label: "대출", value: summary.loanBalance },
    { key: "tenant", label: "임차보증금", value: summary.tenantDepositTotal },
  ].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const liabTopItems = liabTopBase.map((d) => ({ ...d, color: LIABILITY_COLORS[d.key as keyof typeof LIABILITY_COLORS], pct: grossTotal > 0 ? (d.value / grossTotal) * 100 : 0 }));

  const loanBase = loanTypes
    .map(({ value: type, shortLabel: label }) => ({
      key: type,
      label,
      value: assetData.loans.filter((l) => l.type === type).reduce((s, l) => s + l.balance, 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const loanColors = (() => {
    const colors = assignColors(loanBase);
    if (loanBase.length === 0) return colors;
    const maxIdx = loanBase.reduce((mi, it, i) => (it.value > loanBase[mi].value ? i : mi), 0);
    colors[maxIdx] = LIABILITY_COLORS.loans;
    return colors;
  })();
  const loanBarItems = loanBase.map((d, i) => ({ ...d, color: loanColors[i] }));

  const sortedRealEstate = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);

  const realEstateCatBase = realEstateTypes
    .map(({ value: type, label }) => ({
      key: type,
      label,
      value: assetData.realEstate.filter((r) => r.type === type).reduce((s, r) => s + r.currentValue, 0),
    }))
    .filter((d) => d.value > 0);
  const realEstateCatColors = assignColors(realEstateCatBase);
  const realEstateCatBarItems = realEstateCatBase.map((d, i) => ({ ...d, color: realEstateCatColors[i] }));

  const tenantCount = assetData.realEstate.filter((re) => (re.tenantDeposit ?? 0) > 0).length;

  const availableTabs = [
    "all",
    financialTotal > 0 ? "financial" : null,
    summary.realEstateValue > 0 ? "realEstate" : null,
    totalLiability > 0 ? "liability" : null,
  ].filter(Boolean) as string[];

  const resolvedTab = availableTabs.includes(activeDetailTab) ? activeDetailTab : "all";

  const TAB_META = [
    { value: "all", label: "전체", condition: true },
    { value: "financial", label: "금융자산", condition: financialTotal > 0 },
    { value: "realEstate", label: "부동산", condition: summary.realEstateValue > 0 },
    { value: "liability", label: "부채", condition: totalLiability > 0 },
  ];
  const visibleTabs = TAB_META.filter((t) => t.condition);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── 자산 분포 카드 (통합) ── */}
      <Card className={`lg:col-span-2 ${ASSET_THEME.distributionCard.bg} ${ASSET_THEME.distributionCard.border} gap-2`}>
        <CardHeader className="pb-2">
          <CardTitle className={ASSET_THEME.primary.text}>자산 분포</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 overflow-hidden px-3 sm:px-6">
          {totalAsset === 0 ? (
            <div className="flex h-36 items-center justify-center text-muted-foreground text-sm">등록된 자산이 없습니다.</div>
          ) : (
            <Tabs value={resolvedTab} onValueChange={setActiveDetailTab}>
              {/* ── 상단 탭 버튼 ── */}
              {visibleTabs.length > 0 && (
                <TabsList className={ASSET_THEME.tabList2}>
                  {visibleTabs.map(({ value, label }) => (
                    <TabsTrigger key={value} value={value} className={ASSET_THEME.tabTrigger2}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              {/* ── 순자산 요약 + DonutChart / 세부 콘텐츠 2컬럼 ── */}
              <div className="py-3 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* col-1: 순자산 요약 + DonutChart */}
                <div className="space-y-4">
                  <div className={`flex items-center justify-between rounded-lg ${ASSET_THEME.primary.bgLight} border px-4 py-3`}>
                    <div>
                      <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>순자산</p>
                      <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(summary.netAsset)}</p>
                      <p className={`text-[11px] ${ASSET_THEME.text.default}`}>{formatCurrency(summary.netAsset)}</p>
                    </div>
                    <div className="text-right space-y-1.5">
                      <div className="text-xs"><span className={ASSET_THEME.distributionCard.muted}>총 자산 </span><span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(totalAsset)}</span></div>
                      <div className="text-xs"><span className={ASSET_THEME.distributionCard.muted}>총 부채 </span><span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</span></div>
                    </div>
                  </div>

                  <AssetDonutChart
                    items={treemapData}
                    netAsset={summary.netAsset}
                    activeTab={resolvedTab}
                    onSegmentClick={setActiveDetailTab}
                  />
                </div>

                {/* col-2: 세부 분포 탭 콘텐츠 */}
                <div>
                  <TabsContent value="all" className="mt-0 space-y-5 lg:pt-0 pt-2">
                    <div className={`rounded-lg ${ASSET_THEME.primary.bgLight} border px-4 py-3 space-y-2`}>
                      <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>자산 구성</p>
                      {treemapData.filter((d) => d.key !== "liability").map(({ key, name, value, color, pct }) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-foreground">{name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                            <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalLiability > 0 && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                        <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>부채 구성</p>
                        {liabTopItems.map(({ key, label, value, color, pct }) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-foreground">{label}</span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(value)}</span>
                              <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {totalAsset > 0 && totalLiability > 0 && (() => {
                      const ltv = (totalLiability / totalAsset) * 100;
                      const ltvColor = ltv < 40 ? MAIN_PALETTE[4] : ltv < 70 ? MAIN_PALETTE[3] : MAIN_PALETTE[1];
                      const ltvLabel = ltv < 40 ? "안전" : ltv < 70 ? "주의" : "위험";
                      return (
                        <div className="rounded-lg border px-4 py-3 space-y-2" style={{ borderColor: ltvColor + "55", backgroundColor: ltvColor + "11" }}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">LTV (부채비율)</p>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: ltvColor, backgroundColor: ltvColor + "22" }}>{ltvLabel}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(ltv, 100)}%`, backgroundColor: ltvColor }} />
                            </div>
                            <span className="text-sm font-extrabold tabular-nums" style={{ color: ltvColor }}>{ltv.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>0%</span>
                            <span style={{ color: MAIN_PALETTE[4] }}>40% 안전</span>
                            <span style={{ color: MAIN_PALETTE[3] }}>70% 주의</span>
                            <span style={{ color: MAIN_PALETTE[1] }}>위험</span>
                          </div>
                        </div>
                      );
                    })()}
                  </TabsContent>

                  {financialTotal > 0 && (
                    <TabsContent value="financial" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>금융자산 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(financialTotal)}</p>
                          <p className="text-[11px] text-foreground">{formatCurrency(financialTotal)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          {financialBarItems.map(({ key, label, value }) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{label} </span>
                              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className={`text-xs font-semibold ${ASSET_THEME.text.default}`}>금융자산 구성</p>
                        <SectionBar items={financialBarItems} total={financialTotal} />
                      </div>

                      {summary.stockValue > 0 && stockCatBarItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${ASSET_THEME.text.muted}`}>주식</span>
                            <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(summary.stockValue)}</span>
                          </div>
                          <SectionBar items={stockCatBarItems} total={summary.stockValue} />
                        </div>
                      )}

                      {summary.cryptoValue > 0 && cryptoBarItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${ASSET_THEME.text.muted}`}>암호화폐</span>
                            <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(summary.cryptoValue)}</span>
                          </div>
                          <SectionBar items={cryptoBarItems} total={summary.cryptoValue} />
                        </div>
                      )}

                      {summary.cashValue > 0 && cashTypeBarItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${ASSET_THEME.text.muted}`}>현금성 자산</span>
                            <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(summary.cashValue)}</span>
                          </div>
                          <SectionBar items={cashTypeBarItems} total={summary.cashValue} />
                        </div>
                      )}

                      <p className="text-muted-foreground text-xs pb-1">
                        주식 <span className="font-bold text-foreground">{summary.stockCount}개</span>
                        {summary.cryptoCount > 0 && <> · 암호화폐 <span className="font-bold text-foreground">{summary.cryptoCount}개</span></>}
                        {summary.cashCount > 0 && <> · 현금성 <span className="font-bold text-foreground">{summary.cashCount}개</span></>}
                        {" "}보유 중
                      </p>
                    </TabsContent>
                  )}

                  {summary.realEstateValue > 0 && (
                    <TabsContent value="realEstate" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
                        <div>
                          <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>부동산 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(summary.realEstateValue)}</p>
                          <p className="text-[11px] text-foreground">{formatCurrency(summary.realEstateValue)}</p>
                        </div>
                      </div>

                      {realEstateCatBarItems.length > 0 && (
                        <div className="space-y-2">
                          <p className={`text-xs font-semibold ${ASSET_THEME.text.default}`}>부동산 구성</p>
                          <SectionBar items={realEstateCatBarItems} total={summary.realEstateValue} />
                        </div>
                      )}

                      {realEstateCatBarItems.map(({ key: catKey, label: catLabel, value: catTotal, color: catColor }) => {
                        const items = sortedRealEstate
                          .filter((r) => r.type === catKey)
                          .map((r) => ({ key: r.id, label: r.name, value: r.currentValue, color: catColor }));
                        if (items.length === 0) return null;
                        const colors = assignColors(items);
                        const coloredItems = items.map((d, i) => ({ ...d, color: colors[i] }));
                        return (
                          <div key={catKey} className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-semibold ${ASSET_THEME.text.muted}`}>{catLabel}</span>
                              <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(catTotal)}</span>
                            </div>
                            <SectionBar items={coloredItems} total={catTotal} />
                          </div>
                        );
                      })}

                      <p className="text-muted-foreground text-xs pb-1">총 <span className="font-bold text-foreground">{summary.realEstateCount}개</span> 부동산 보유 중</p>
                    </TabsContent>
                  )}

                  {totalLiability > 0 && (
                    <TabsContent value="liability" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">부채 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</p>
                          <p className="text-[11px] text-foreground">{formatCurrency(totalLiability)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          {liabTopItems.map(({ key, label, value, pct }) => (
                            <div key={key} className="text-xs">
                              <span className="text-muted-foreground">{label} </span>
                              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                              <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {liabTopItems.length > 0 && (
                        <div className="space-y-2">
                          <p className={`text-xs font-semibold ${ASSET_THEME.text.default}`}>부채 구성</p>
                          <SectionBar items={liabTopItems} total={totalLiability} />
                        </div>
                      )}

                      {summary.loanBalance > 0 && loanBarItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${ASSET_THEME.text.muted}`}>대출</span>
                            <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(summary.loanBalance)}</span>
                          </div>
                          <SectionBar items={loanBarItems} total={summary.loanBalance} />
                        </div>
                      )}

                      <p className="text-muted-foreground text-xs pb-1">
                        {assetData.loans.length > 0 && <>대출 <span className="font-bold text-foreground">{assetData.loans.length}건</span></>}
                        {assetData.loans.length > 0 && tenantCount > 0 && " · "}
                        {tenantCount > 0 && <>임차보증금 <span className="font-bold text-foreground">{tenantCount}건</span></>}
                      </p>
                    </TabsContent>
                  )}
                </div>
              </div>
            </Tabs>
          )}
        </CardContent>
        <CardFooter>
          <p className={`${ASSET_THEME.distributionCard.muted} text-xs`}>
            마지막 업데이트: {assetData.lastUpdated && !Number.isNaN(new Date(assetData.lastUpdated).getTime()) ? new Date(assetData.lastUpdated).toLocaleString("ko-KR") : ""}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
