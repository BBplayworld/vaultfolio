"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { cashTypes, loanTypes, stockCategories } from "@/config/asset-options";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// 부채 전용 고정 색상: loans 대출, tenant 임차보증금
const LIABILITY_COLORS = { loans: MAIN_PALETTE[1], tenant: MAIN_PALETTE[2] } as const;

// 최대값 → MAIN_PALETTE[0] 고정, 나머지는 [3~9] 순차 배정 (부채 고정색 [1],[2] 제외)
function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + (si++) % 7]));
}

function SectionBar({ items, total }: { items: { key: string; label: string; value: number; color: string }[]; total: number }) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
              {pct > 10 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
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
              <span className="text-xs text-foreground">{label}</span>
              <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">({formatShortCurrency(value)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TreemapItem = { name: string; value: number; color: string; pct: number };

const RADIAN = Math.PI / 180;

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct, value }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number;
  name: string; pct: number; value: number;
}) {
  if (pct < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
      <tspan x={x - 1} dy="-14" fontSize={10} fontWeight={700} fill="white">{name}</tspan>
      <tspan x={x} dy="15" fontSize={11} fontWeight={700} fill="rgba(255, 255, 255, 1)">{formatShortCurrency(value)}</tspan>
      <tspan x={x + 3} dy="15" fontSize={11} fontWeight={700} fill="rgba(255, 255, 255, 0.6)">{pct.toFixed(1)}%</tspan>
    </text>
  );
}

function AssetDonutChart({ items, netAsset }: { items: TreemapItem[]; netAsset: number }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={125}
            strokeWidth={2}
            stroke="var(--card)"
            labelLine={false}
            label={({ key, ...props }) => <DonutLabel key={key} {...props} />}
          >
            {items.map((item, i) => (
              <Cell key={i} fill={item.color} />
            ))}
          </Pie>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-10" fontSize={11} fill="var(--muted-foreground)">순자산</tspan>
            <tspan x="50%" dy="22" fontSize={16} fontWeight={700} fill="var(--foreground)">{formatShortCurrency(netAsset)}</tspan>
          </text>
          <Tooltip
            formatter={(value: number, _: string, entry: { payload?: { name?: string; pct?: number } }) => [
              `${formatShortCurrency(value)} (${entry.payload?.pct?.toFixed(1)}%)`,
              entry.payload?.name ?? "",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* 범례 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map(({ name, value, color, pct }) => (
          <div key={name} className="flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-foreground truncate">{name}</span>
            <span className="text-xs font-bold text-muted-foreground ml-auto">{pct.toFixed(1)}%</span>
            <span className="text-xs text-foreground">({formatShortCurrency(value)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssetDistributionCards() {
  const { assetData, getAssetSummary, exchangeRates } = useAssetData();
  const summary = getAssetSummary();

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  const totalAsset = summary.realEstateValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const totalLiability = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + totalLiability;

  // ── Treemap 데이터: 부동산 + 금융자산(통합) + 부채 통합
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

  // ── 금융자산 분포
  const financialTotal = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const finBase = [
    { key: "stocks", label: "주식", value: summary.stockValue },
    { key: "crypto", label: "암호화폐", value: summary.cryptoValue },
    { key: "cash", label: "현금성", value: summary.cashValue },
  ].filter((d) => d.value > 0);
  const finColors = assignColors(finBase);
  const financialBarItems = finBase.map((d, i) => ({ ...d, color: finColors[i] }));

  // ── 주식 카테고리 분포
  const stockCatBase = stockCategories
    .map((cat) => ({
      key: cat.value,
      label: cat.shortLabel,
      value: assetData.stocks.filter((s) => s.category === cat.value).reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency), 0),
    }))
    .filter((d) => d.value > 0);
  const stockCatColors = assignColors(stockCatBase);
  const stockCatBarItems = stockCatBase.map((d, i) => ({ ...d, color: stockCatColors[i] }));

  // ── 암호화폐 분포 (코인별)
  const cryptoBase = [...assetData.crypto]
    .map((coin) => ({ key: coin.id, label: coin.name || coin.symbol, value: coin.quantity * coin.currentPrice }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const cryptoColors = assignColors(cryptoBase);
  const cryptoBarItems = cryptoBase.map((d, i) => ({ ...d, color: cryptoColors[i] }));

  // ── 현금 유형별 분포
  const cashBase = cashTypes
    .map(({ value: type, label }) => ({
      key: type,
      label,
      value: assetData.cash.filter((c) => c.type === type).reduce((sum, c) => sum + c.balance * getMultiplier(c.currency), 0),
    }))
    .filter((d) => d.value > 0);
  const cashColors = assignColors(cashBase);
  const cashTypeBarItems = cashBase.map((d, i) => ({ ...d, color: cashColors[i] }));

  // ── 부채 분포
  const liabTopBase = [
    { key: "loans", label: "대출", value: summary.loanBalance },
    { key: "tenant", label: "임차보증금", value: summary.tenantDepositTotal },
  ].filter((d) => d.value > 0);
  const liabTopItems = liabTopBase.map((d) => ({ ...d, color: LIABILITY_COLORS[d.key as keyof typeof LIABILITY_COLORS] }));

  const loanBase = loanTypes
    .map(({ value: type, shortLabel: label }) => ({
      key: type,
      label,
      value: assetData.loans.filter((l) => l.type === type).reduce((s, l) => s + l.balance, 0),
    }))
    .filter((d) => d.value > 0);
  loanBase.push({ key: "tenant", label: "임차보증금", value: summary.tenantDepositTotal });

  const loanColors = assignColors(loanBase);
  const loanBarItems = loanBase.map((d, i) => ({ ...d, color: loanColors[i] }));

  const sortedRealEstate = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);
  const realEstateBase = sortedRealEstate.map((item) => ({ key: item.id, label: item.name, value: item.currentValue }));
  const realEstateColors = assignColors(realEstateBase);
  const realEstateBarItems = realEstateBase.map((d, i) => ({ ...d, color: realEstateColors[i] }));

  const tenantCount = assetData.realEstate.filter((re) => (re.tenantDeposit ?? 0) > 0).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── 자산 분포 카드 (Treemap) ── */}
      <Card className={`${ASSET_THEME.distributionCard.bg} ${ASSET_THEME.distributionCard.border} gap-2`}>
        <CardHeader className="pb-2">
          <CardTitle className={ASSET_THEME.primary.text}>자산 분포</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 overflow-hidden px-3 sm:px-6">
          {totalAsset === 0 ? (
            <div className="flex h-36 items-center justify-center text-muted-foreground text-sm">등록된 자산이 없습니다.</div>
          ) : (
            <div className="space-y-4 pb-2">
              {/* 순자산 요약 */}
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

              <AssetDonutChart items={treemapData} netAsset={summary.netAsset} />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className={`${ASSET_THEME.distributionCard.muted} text-xs`}>
            마지막 업데이트: {assetData.lastUpdated && !Number.isNaN(new Date(assetData.lastUpdated).getTime()) ? new Date(assetData.lastUpdated).toLocaleString("ko-KR") : ""}
          </p>
        </CardFooter>
      </Card>

      {/* ── 금융자산 분포 카드 ── */}
      {financialTotal > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={ASSET_THEME.primary.text}>금융자산 분포</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden pb-2 px-3 sm:px-6 space-y-5">
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
              <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>금융자산 구성</p>
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
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-xs">
              주식 <span className="font-bold text-foreground">{summary.stockCount}개</span>
              {summary.cryptoCount > 0 && <> · 암호화폐 <span className="font-bold text-foreground">{summary.cryptoCount}개</span></>}
              {summary.cashCount > 0 && <> · 현금성 <span className="font-bold text-foreground">{summary.cashCount}개</span></>}
              {" "}보유 중
            </p>
          </CardFooter>
        </Card>
      )}

      {/* ── 부동산 분포 카드 ── */}
      {summary.realEstateValue > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={ASSET_THEME.primary.text}>부동산 분포</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden pb-2 px-3 sm:px-6 space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
              <div>
                <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>부동산 총액</p>
                <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(summary.realEstateCost)}</p>
                <p className="text-[11px] text-foreground">{formatCurrency(summary.realEstateCost)}</p>
              </div>
            </div>

            {sortedRealEstate.length > 1 && (
              <div className="space-y-2">
                <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>부동산 구성</p>
                <SectionBar items={realEstateBarItems} total={summary.realEstateValue} />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-xs">총 <span className="font-bold text-foreground">{summary.realEstateCount}개</span> 부동산 보유 중</p>
          </CardFooter>
        </Card>
      )}

      {/* ── 부채 분포 카드 ── */}
      {totalLiability > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={ASSET_THEME.primary.text}>부채 분포</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden pb-2 px-3 sm:px-6 space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">총 부채</p>
                <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</p>
                <p className="text-[11px] text-foreground">{formatCurrency(totalLiability)}</p>
              </div>
              <div className="text-right space-y-1">
                {liabTopItems.map(({ key, label, value }) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{label} </span>
                    <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {liabTopItems.length > 1 && (
              <div className="space-y-2">
                <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>부채 구성</p>
                <SectionBar items={liabTopItems} total={totalLiability} />
              </div>
            )}

            {summary.loanBalance > 0 && loanBarItems.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${ASSET_THEME.text.muted}`}>대출 유형</span>
                  <span className={`font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(summary.loanBalance)}</span>
                </div>
                <SectionBar items={loanBarItems} total={summary.loanBalance} />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-xs">
              {assetData.loans.length > 0 && <>대출 <span className="font-bold text-foreground">{assetData.loans.length}건</span></>}
              {assetData.loans.length > 0 && tenantCount > 0 && " · "}
              {tenantCount > 0 && <>임차보증금 <span className="font-bold text-foreground">{tenantCount}건</span></>}
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
