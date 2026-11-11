"use client";

import { LOADING_LABEL } from "@/components/ui/loading-note";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { niceAxisTicks, formatAxisWon, pickVisibleLabels } from "@/lib/finance/dividend-axis";
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import type { Stock } from "@/types/asset";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import { MonthlyDividendStocks } from "./monthly-dividend-stocks";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { InfoHint } from "../../layout/ui/info-hint";
import { InlineSelector } from "../../layout/ui/inline-selector";


const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_KEYS = ["domestic", "foreign", "irp", "isa", "pension"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  domestic: MAIN_PALETTE[3],
  foreign: MAIN_PALETTE[5],
  irp: MAIN_PALETTE[6],
  isa: MAIN_PALETTE[4],
  pension: MAIN_PALETTE[7],
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  domestic: "국내주식",
  foreign: "해외주식",
  irp: "IRP",
  isa: "ISA",
  pension: "연금저축",
};

const chartConfig = Object.fromEntries(
  CATEGORY_KEYS.map((k) => [k, { label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k] }])
) as ChartConfig;

const commonAxisProps = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

/** 막대 위 합계 라벨 — 이웃과 겹치면 큰 값만 남긴다(#4.85). 막대 폭 = 칸 폭 × 0.8(기본 카테고리 간격) */
function makeTotalLabel(values: number[]) {
  const labels = values.map((v) => (v > 0 ? formatShortCurrency(v) : ""));
  return function TotalLabel(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const w = Number(width);
    if (!labels[index]) return null;
    const visible = pickVisibleLabels(values, labels, w / 0.8);
    if (!visible.has(index)) return null;
    return (
      <text x={Number(x) + w / 2} y={Number(y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
        {labels[index]}
      </text>
    );
  };
}

async function fetchDividend(ticker: string, type: string, excd: string): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd });
  const res = await fetch(`/api/finance/dividend?${params}`);
  const json = await res.json();
  if (json.messages) {
    console.log(`[API Logs - ${ticker}]`, json.messages);
  }
  if (!res.ok) return [];
  return json.data || [];
}

interface StockDividendInfo {
  stock: Stock;
  payouts: DividendPayoutResult[];
}

type ActualEstimatedFields = {
  [K in CategoryKey as `${K}Actual`]: number;
} & {
  [K in CategoryKey as `${K}Estimated`]: number;
};

interface MonthlyTotal extends ActualEstimatedFields {
  month: string;
  total: number;
  totalActual: number;
  totalEstimated: number;
  domestic: number;
  foreign: number;
  irp: number;
  isa: number;
  pension: number;
}

function buildMonthlyTotals(items: StockDividendInfo[], usdRate: number): MonthlyTotal[] {
  const actual: Record<CategoryKey, number[]> = {
    domestic: new Array(12).fill(0),
    foreign: new Array(12).fill(0),
    irp: new Array(12).fill(0),
    isa: new Array(12).fill(0),
    pension: new Array(12).fill(0),
  };
  const estimated: Record<CategoryKey, number[]> = {
    domestic: new Array(12).fill(0),
    foreign: new Array(12).fill(0),
    irp: new Array(12).fill(0),
    isa: new Array(12).fill(0),
    pension: new Array(12).fill(0),
  };

  // 지급 여부는 payoutDate의 년-월 <= 오늘(KST) 년-월 기준 (isEstimated 플래그보다 날짜 우선)
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYM = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;

  for (const { stock, payouts } of items) {
    const cat = CATEGORY_KEYS.includes(stock.category as CategoryKey)
      ? (stock.category as CategoryKey)
      : null;
    if (!cat) continue;
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      if (stock.purchaseDate && p.payoutDate < stock.purchaseDate) continue;
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) {
        const isPaid = p.payoutDate.slice(0, 7) <= currentYM;
        const bucket = isPaid ? actual : estimated;
        bucket[cat][m] += p.amountPerShare * stock.quantity * rate;
      }
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const da = Math.round(actual.domestic[i]);
    const fa = Math.round(actual.foreign[i]);
    const ia = Math.round(actual.irp[i]);
    const sa = Math.round(actual.isa[i]);
    const pa = Math.round(actual.pension[i]);
    const de = Math.round(estimated.domestic[i]);
    const fe = Math.round(estimated.foreign[i]);
    const ie = Math.round(estimated.irp[i]);
    const se = Math.round(estimated.isa[i]);
    const pe = Math.round(estimated.pension[i]);
    const totalActual = da + fa + ia + sa + pa;
    const totalEstimated = de + fe + ie + se + pe;
    return {
      month: `${i + 1}월`,
      total: totalActual + totalEstimated,
      totalActual,
      totalEstimated,
      domestic: da + de,
      foreign: fa + fe,
      irp: ia + ie,
      isa: sa + se,
      pension: pa + pe,
      domesticActual: da,
      foreignActual: fa,
      irpActual: ia,
      isaActual: sa,
      pensionActual: pa,
      domesticEstimated: de,
      foreignEstimated: fe,
      irpEstimated: ie,
      isaEstimated: se,
      pensionEstimated: pe,
    };
  });
}


export function DividendCard({ isActive = true }: { isActive?: boolean }) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [estimateMode, setEstimateMode] = useState<"all" | "actual">("all");

  const stocksWithTicker = (() => {
    // 상장폐지 종목 제외 — 배당 받을 수 없음. 거래정지는 포함 (보유 중)
    const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
    const grouped = groupStocksByTickerCategory(base);
    return Array.from(grouped.values()).map(mergeStockGroup);
  })();

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      const excd = "NAS";
      return {
        queryKey: ["dividend", "v11", ticker, type],
        queryFn: () => fetchDividend(ticker, type, excd),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
        enabled: isActive,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const loadedCount = queries.filter((q) => !q.isLoading).length;
  const totalCount = queries.length;

  const dividendItems: StockDividendInfo[] = stocksWithTicker.map((stock, i) => ({
    stock,
    payouts: Array.isArray(queries[i]?.data) ? (queries[i].data as DividendPayoutResult[]) : [],
  }));

  const monthlyTotals = buildMonthlyTotals(dividendItems, usdRate);
  // 막대 높이 최댓값 기준 둥근 Y축 눈금 + 겹치지 않는 값 라벨
  const maxBar = Math.max(0, ...monthlyTotals.map((m) => (estimateMode === "actual" ? m.totalActual : m.total)));
  const yTicks = niceAxisTicks(maxBar);
  const TotalLabel = makeTotalLabel(monthlyTotals.map((m) => (estimateMode === "actual" ? m.totalActual : m.total)));
  const annualActual = monthlyTotals.reduce((sum, m) => sum + m.totalActual, 0);
  const annualEstimated = monthlyTotals.reduce((sum, m) => sum + m.totalEstimated, 0);
  const annualTotal = annualActual + annualEstimated;

  // 월 선택 시: 그 월의 실제 상태(과거→지급, 미래→예상)로 라벨·금액 결정. 토글 무시.
  // 월 미선택 시: 우측 토글(예상/실제)에 따라 연간 금액·라벨 결정.
  const isActualOnly = estimateMode === "actual";
  const nowMonthKST = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  const isPastMonth = selectedMonth !== undefined && selectedMonth <= nowMonthKST;
  const monthRow = selectedMonth !== undefined ? monthlyTotals[selectedMonth - 1] : undefined;

  const heroValue = selectedMonth !== undefined
    ? (isPastMonth ? (monthRow?.totalActual ?? 0) : (monthRow?.totalEstimated ?? 0))
    : (isActualOnly ? annualActual : annualTotal);
  const heroLabel = selectedMonth !== undefined
    ? `${selectedMonth}월 ${isPastMonth ? "지급 배당" : "예상 배당"}`
    : (isActualOnly ? "올해 지급 배당" : "올해 예상 배당");
  const heroStatus: "actual" | "estimated" | null = selectedMonth !== undefined
    ? (isPastMonth ? "actual" : "estimated")
    : null;

  // 투입 대비 배당(#4.46) — 조회가 모두 끝난 뒤에만 계산
  const dividendYield = !isLoading && annualTotal > 0 ? computeDividendYield(dividendItems, usdRate, estimateMode) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className={ASSET_THEME.contentCard}>
        <CardHeader className={ASSET_THEME.contentPad}>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="shrink-0 whitespace-nowrap">배당</CardTitle>
                <InfoHint summary="아직 안 받은 달은 예상치이고, 해외는 입금일이 한 달쯤 밀릴 수 있어요.">
                  <p>미지급 월은 <span className="font-semibold text-foreground">예상치</span>이며, 기업 결정에 따라 변동될 수 있습니다.</p>
                  <p>해외 주식은 현지 기준일과 국내 입금일 차이로 한 달 정도 오차가 발생할 수 있습니다. (예: 3월 기준 배당 → 4월 실제 입금)</p>
                  <p><span className="font-semibold text-foreground">매수일</span> 이전 지급분은 계산에서 제외됩니다.</p>
                  <p>투입 대비 배당은 올해 배당 ÷ 보유 주식 매입금액이에요. 예상분은 작년 지급 기록으로 추정한 값이라 실제와 다를 수 있어요. 평단이 없거나 엔화인 종목은 뺀 값이에요.</p>
                </InfoHint>
              </div>
              {/* 월 선택 배지와 설명이 같은 칸을 공유 — 선택·해제해도 헤더 높이가 변하지 않아 차트가 밀리지 않는다 */}
              <div className="grid min-h-6 items-center [&>*]:[grid-area:1/1]" data-testid="dividend-sub-slot">
                <CardDescription className={selectedMonth !== undefined ? "invisible" : undefined}>보유 주식 기준 올해 배당금</CardDescription>
                {selectedMonth !== undefined && (
                  <Badge asChild variant="outline">
                    <button
                      type="button"
                      data-testid="dividend-month-badge"
                      onClick={() => setSelectedMonth(undefined)}
                      className="relative z-10 h-6 justify-self-start cursor-pointer overflow-visible px-2.5 text-xs after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:bg-accent focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/40 motion-safe:transition-[transform,background-color,box-shadow] motion-safe:active:scale-[0.96] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
                    >
                      {selectedMonth}월 · 전체 보기 ×
                    </button>
                  </Badge>
                )}
              </div>
            </div>
            <div className={selectedMonth !== undefined ? "opacity-40 pointer-events-none" : ""}>
              <InlineSelector
                value={estimateMode}
                onChange={setEstimateMode}
                options={[
                  { value: "all", label: "예상 포함" },
                  { value: "actual", label: "지급만" },
                ]}
                ariaLabel="배당 표시 모드"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className={`space-y-6 ${ASSET_THEME.contentPad}`}>
          {/* Hero — 연간 / 선택 월 배당 */}
          {annualTotal > 0 && (
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground font-semibold">{heroLabel}</p>
                {heroStatus === "actual" && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    지급
                  </span>
                )}
                {heroStatus === "estimated" && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground">
                    예상치
                  </span>
                )}
              </div>
              <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                {formatPriceByMode(heroValue)}
              </p>
              {dividendYield && (
                <div
                  data-testid="dividend-yield"
                  aria-hidden={selectedMonth !== undefined}
                  className={`mt-2 transition-opacity duration-150 motion-reduce:transition-none ${
                    selectedMonth !== undefined ? "opacity-0 select-none" : "opacity-100"
                  }`}
                >
                  <p className="flex items-baseline gap-1.5 leading-tight">
                    <span className="text-sm font-medium text-muted-foreground">투입 대비 배당</span>
                    <span data-testid="dividend-yield-value" className="text-base font-semibold tabular-nums text-foreground whitespace-nowrap">
                      {dividendYield.text}
                    </span>
                  </p>
                  <p data-testid="dividend-yield-caption" className="mt-1 text-[11px] leading-relaxed text-muted-foreground text-pretty break-keep">
                    <span className="whitespace-nowrap">보유 주식 매입금액 기준 ·</span>{" "}
                    <span className="whitespace-nowrap">해외는 현재 환율</span>
                    {dividendYield.excluded > 0 && (
                      <>
                        {" "}
                        <span className="whitespace-nowrap">· <span className="tabular-nums">{dividendYield.excluded}</span>종목 제외</span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>{LOADING_LABEL.dividend}</span>
                <span className="tabular-nums">{loadedCount} / {totalCount}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: totalCount > 0 ? `${(loadedCount / totalCount) * 100}%` : "0%" }}
                />
              </div>
              <div className="space-y-1.5">
                {stocksWithTicker.slice(0, 8).map((stock, i) => {
                  const q = queries[i];
                  const done = q && !q.isLoading;
                  return (
                    <div key={stock.id} className="flex items-center justify-between px-1 py-0.5">
                      <span className="text-sm text-foreground truncate max-w-[60%]">{stock.name || stock.ticker}</span>
                      <span className={`text-xs ${done ? "text-primary" : "text-muted-foreground"}`}>
                        {done ? "완료" : "불러오는 중…"}
                      </span>
                    </div>
                  );
                })}
                {stocksWithTicker.length > 8 && (
                  <p className="text-xs text-muted-foreground px-1">외 {stocksWithTicker.length - 8}개 종목...</p>
                )}
              </div>
            </div>
          )}

          {!isLoading && annualTotal === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">올해 배당 데이터가 없습니다.</p>
                <p className="text-muted-foreground text-sm mt-1">
                  보유 주식에 배당금이 없거나 KIS API가 설정되지 않았습니다.
                </p>
              </div>
            </div>
          ) : (
            !isLoading && (
              <ChartContainer config={chartConfig} className="h-[200px] w-[calc(100%+1rem)] -ml-4 sm:ml-0 sm:w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyTotals}
                    margin={{ top: 24, right: 10, bottom: 5, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activePayload) return;
                      const monthStr = data.activePayload[0]?.payload?.month as string;
                      const m = parseInt(monthStr, 10);
                      if (!m) return;
                      setSelectedMonth((prev) => (prev === m ? undefined : m));
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" {...commonAxisProps} />
                    <YAxis
                      {...commonAxisProps}
                      ticks={yTicks}
                      domain={[0, yTicks[yTicks.length - 1]]}
                      tickFormatter={(v) => formatAxisWon(v)}
                      width={55}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const monthData = payload[0]?.payload as MonthlyTotal;
                        const month = monthData?.month;
                        const totalActual = monthData?.totalActual ?? 0;
                        const totalEstimated = monthData?.totalEstimated ?? 0;
                        const total = totalActual + totalEstimated;

                        // 카테고리별 실제/예상 합산
                        const catRows = CATEGORY_KEYS
                          .map((cat) => {
                            const a = (monthData?.[`${cat}Actual` as keyof MonthlyTotal] as number) ?? 0;
                            const e = (monthData?.[`${cat}Estimated` as keyof MonthlyTotal] as number) ?? 0;
                            return { cat, actual: a, estimated: e, total: a + e };
                          })
                          .filter((r) => r.total > 0);

                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm space-y-1 min-w-[140px]">
                            <p className="font-semibold text-foreground">{month}</p>
                            {catRows.map(({ cat, actual, estimated }) => (
                              <div key={cat} className="space-y-0.5">
                                {actual > 0 && (
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                                      {CATEGORY_LABELS[cat]}
                                    </span>
                                    <span className="font-medium tabular-nums">{formatShortCurrency(actual)}</span>
                                  </div>
                                )}
                                {estimated > 0 && (
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <span className="inline-block w-2 h-2 rounded-full shrink-0 opacity-40" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                                      {CATEGORY_LABELS[cat]} (예상)
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">{formatShortCurrency(estimated)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="border-t pt-1 flex justify-between font-semibold">
                              <span>합계</span>
                              <span className="tabular-nums">{formatShortCurrency(total)}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    {/* 실제 지급 Bar — 역순 선언으로 domestic이 맨 위에 쌓임 */}
                    {[...CATEGORY_KEYS].reverse().map((cat, idx) => {
                      const isLast = idx === CATEGORY_KEYS.length - 1;
                      const actualOnly = estimateMode === "actual";
                      return (
                        <Bar
                          key={`${cat}-actual`}
                          dataKey={`${cat}Actual`}
                          stackId="a"
                          name={CATEGORY_LABELS[cat]}
                          fill={CATEGORY_COLORS[cat]}
                          radius={isLast && actualOnly ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        >
                          {monthlyTotals.map((_, monthIdx) => (
                            <Cell
                              key={`cell-actual-${monthIdx}`}
                              opacity={selectedMonth === undefined ? 1 : monthIdx + 1 === selectedMonth ? 1 : 0.3}
                            />
                          ))}
                          {isLast && actualOnly && (
                            <LabelList dataKey="totalActual" content={TotalLabel} />
                          )}
                        </Bar>
                      );
                    })}
                    {/* 예상 지급 Bar — estimateMode가 "all"일 때만 노출 */}
                    {estimateMode === "all" && [...CATEGORY_KEYS].reverse().map((cat, idx) => {
                      const isLast = idx === CATEGORY_KEYS.length - 1;
                      return (
                        <Bar
                          key={`${cat}-estimated`}
                          dataKey={`${cat}Estimated`}
                          stackId="a"
                          name={`${CATEGORY_LABELS[cat]} (예상)`}
                          fill={CATEGORY_COLORS[cat]}
                          fillOpacity={0.35}
                          radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        >
                          {monthlyTotals.map((_, monthIdx) => (
                            <Cell
                              key={`cell-estimated-${monthIdx}`}
                              opacity={selectedMonth === undefined ? 1 : monthIdx + 1 === selectedMonth ? 1 : 0.3}
                            />
                          ))}
                          {isLast && (
                            <LabelList dataKey="total" content={TotalLabel} />
                          )}
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )
          )}

          {/* 카테고리 범례 */}
          {!isLoading && annualTotal > 0 && (() => {
            const activeCats = CATEGORY_KEYS.filter((cat) =>
              monthlyTotals.some((m) => ((m[cat as keyof MonthlyTotal] as number) ?? 0) > 0)
            );
            if (activeCats.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
                {activeCats.map((cat) => (
                  <div key={cat} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    <span className="text-sm text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                  </div>
                ))}
                {estimateMode === "all" && (
                  <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
                    <span className="text-sm text-muted-foreground">예상 (옅음)</span>
                  </div>
                )}
              </div>
            );
          })()}

          {!isLoading && annualTotal > 0 && (
            <MonthlyDividendStocks selectedMonth={selectedMonth} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
