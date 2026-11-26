"use client";

import { LOADING_LABEL } from "@/components/ui/loading-note";
import { useState } from "react";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { niceAxisTicks, formatAxisWon, pickVisibleLabels } from "@/lib/finance/dividend-axis";
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME, MAIN_PALETTE, PAGE_TITLE } from "@/config/theme";
import { isDividendUnknown, DIVIDEND_FETCH_FAILED_MESSAGE, jpyDividendNotice } from "@/lib/finance/dividend-client";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import { monthSums, nextDividendMonth, roundedAnnual, type DividendCalcResult } from "@/lib/finance/dividend-calc";
import { MonthlyDividendStocks } from "./monthly-dividend-stocks";
import { useDividendData } from "./use-dividend-data";
import { InfoHint } from "../../layout/ui/info-hint";
import { DOT_WRAP_FIRST, DOT_WRAP_ROW, DotLead } from "../../layout/ui/dot-wrap";
import { kstTodayString } from "@/lib/asset/import-inherit";


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
    const slot = w / 0.8;
    const visible = pickVisibleLabels(values, labels, slot);
    if (!visible.has(index)) return null;
    // 라벨 x를 plot 영역 [8, 폭−8] 안으로 clamp(320에서 1월·12월 라벨 잘림 방지, 5.162).
    // plot 좌우 끝은 막대 칸 기하(칸 폭 = w/0.8, 막대 앞 여백 10%)에서 역산한다.
    const center = Number(x) + w / 2;
    const plotLeft = center - (index + 0.5) * slot;
    const plotWidth = values.length * slot;
    const half = labels[index].length * 4;
    const labelX = Math.min(Math.max(center, plotLeft + 8 + half), plotLeft + plotWidth - 8 - half);
    return (
      <text x={labelX} y={Number(y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
        {labels[index]}
      </text>
    );
  };
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

// 공용 계산(computeDividends) 결과를 차트 행으로 — 막대 칸은 카테고리별 표시 반올림, 합계(total·totalActual·totalEstimated)는
// 반올림 전 월 합을 1회 반올림한 값이라 툴팁 합계 = 월 선택 Hero 금액(#313)
export function buildMonthlyTotals(calc: DividendCalcResult): MonthlyTotal[] {
  const sums = monthSums(calc);
  return calc.months.map(({ month, byCategory }, i) => {
    const row = { month: `${month}월` } as MonthlyTotal;
    for (const cat of CATEGORY_KEYS) {
      const a = Math.round(byCategory[cat].paid);
      const e = Math.round(byCategory[cat].expected);
      row[`${cat}Actual`] = a;
      row[`${cat}Estimated`] = e;
      row[cat] = a + e;
    }
    row.totalActual = Math.round(sums[i].paid);
    row.totalEstimated = Math.round(sums[i].expected);
    // 합 = 지급 + 예상(roundedAnnual과 같은 규칙, 5.162)
    row.total = row.totalActual + row.totalEstimated;
    return row;
  });
}


export function DividendCard({ isActive = true }: { isActive?: boolean }) {
  const { exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);

  const { groups, calc, isLoading, loadedCount, failedCount, totalCount, jpyCount } = useDividendData({ enabled: isActive });

  const monthlyTotals = buildMonthlyTotals(calc);
  // 막대 높이 최댓값 기준 둥근 Y축 눈금 + 겹치지 않는 값 라벨
  const maxBar = Math.max(0, ...monthlyTotals.map((m) => m.total));
  const yTicks = niceAxisTicks(maxBar);
  const TotalLabel = makeTotalLabel(monthlyTotals.map((m) => m.total));
  // 연 합계는 공용 계산의 반올림 전 합을 1회 반올림 — 허브 카드·성적표 입력과 같은 값
  const { paid: annualActual, expected: annualExpected, total: annualTotal } = roundedAnnual(calc);

  // 월 선택 시: 그 달의 지급 합·예상 합 데이터로 라벨·금액 결정(날짜 기준 판정, #313).
  // 지급·예상이 섞인 달(주로 이번 달)은 `{m}월 배당` + 합계 + `일부 예상`. 둘 다 0인 달만 월 번호로 지급/예상 라벨을 고른다.
  // 월 미선택 시: 연간 지급+예상 합계(차트는 늘 지급+예상, 지급·예상 구분은 결론 줄).
  const nowMonthKST = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  const monthRow = selectedMonth !== undefined ? monthlyTotals[selectedMonth - 1] : undefined;
  const monthStatus: "actual" | "estimated" | "mixed" | null = selectedMonth === undefined || !monthRow
    ? null
    : monthRow.totalActual > 0 && monthRow.totalEstimated > 0
      ? "mixed"
      : monthRow.totalEstimated > 0
        ? "estimated"
        : monthRow.totalActual > 0 || selectedMonth <= nowMonthKST
          ? "actual"
          : "estimated";

  const heroValue = monthStatus !== null
    ? (monthStatus === "mixed" ? monthRow!.total : monthStatus === "actual" ? monthRow!.totalActual : monthRow!.totalEstimated)
    : annualTotal;
  const heroLabel = monthStatus !== null
    ? `${selectedMonth}월 ${monthStatus === "mixed" ? "배당" : monthStatus === "actual" ? "지급 배당" : "예상 배당"}`
    : "올해 배당";
  const heroStatus = monthStatus;

  // 투입 대비 배당(#4.46) — 조회가 모두 끝난 뒤에만 계산
  const dividendYield = !isLoading && annualTotal > 0 ? computeDividendYield(groups, usdRate, "all", calc) : null;
  // 엔화 종목 안내(#313) — 엔화만 있어 빈 화면이면 빈 화면 둘째 줄이 대신한다
  const jpyOnly = jpyCount > 0 && groups.length === 0;
  // 결론 줄(#317) — 지급·예상은 Hero 합계를 나눈 값(줄 합 = Hero), 다음 지급 달·종목 수는 계산 결과에서 고르기만 한다
  const next = annualTotal > 0 ? nextDividendMonth(calc, kstTodayString()) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className={ASSET_THEME.contentCard}>
        <CardHeader className={ASSET_THEME.contentPad}>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className={`shrink-0 whitespace-nowrap ${PAGE_TITLE}`}>배당</CardTitle>
              <InfoHint summary="지급일이 안 된 배당은 예상치이고, 해외는 입금일이 한 달쯤 밀릴 수 있어요.">
                <p className="break-keep">거래 기록이 있으면 지급일에 갖고 있던 수량, 없으면 지금 수량으로 계산해요. 판 종목은 빠져요. 액면분할한 종목은 분할 전 배당이 실제와 다를 수 있어요.</p>
                <p className="break-keep">투입 대비 배당은 올해 배당 ÷ 보유 주식 매입금액이에요. 예상분은 작년 지급 기록으로 추정한 값이라 실제와 다를 수 있어요. 평단이 없거나 엔화인 종목은 뺀 값이에요.</p>
              </InfoHint>
            </div>
            {/* 월 선택 배지와 설명이 같은 칸을 공유 — 선택·해제해도 헤더 높이가 변하지 않아 차트가 밀리지 않는다 */}
            <div className="grid min-h-6 items-center [&>*]:[grid-area:1/1]" data-testid="dividend-sub-slot">
              <CardDescription className={selectedMonth !== undefined ? "invisible" : undefined}>지급일에 보유한 수량 기준 · 세전 추정</CardDescription>
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
        </CardHeader>
        <CardContent className={`space-y-6 ${ASSET_THEME.contentPad}`}>
          {/* Hero — 연간 / 선택 월 배당 */}
          {annualTotal > 0 && (
            <div>
              <div className="flex items-center gap-2">
                <p data-testid="dividend-hero-label" className="text-sm text-muted-foreground font-semibold">{heroLabel}</p>
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
                {heroStatus === "mixed" && (
                  <span data-testid="dividend-hero-mixed" className="shrink-0 whitespace-nowrap text-xs font-semibold px-1.5 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground">
                    일부 예상
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                {formatPriceByMode(heroValue)}
              </p>
              {/* 결론 줄(#317) — 월 선택 시 투입 대비 배당과 같이 숨기되 높이는 유지(차트 안 밀림) */}
              <p
                data-testid="dividend-conclusion"
                data-paid={annualActual}
                data-expected={annualExpected}
                data-next-month={next?.month ?? ""}
                data-next-count={next?.count ?? ""}
                aria-hidden={selectedMonth !== undefined}
                className={`mt-1 flex flex-wrap gap-x-1 gap-y-0.5 text-sm text-muted-foreground tabular-nums transition-opacity duration-150 motion-reduce:transition-none ${DOT_WRAP_ROW} ${
                  selectedMonth !== undefined ? "opacity-0 select-none" : "opacity-100"
                }`}
              >
                {annualActual > 0 && (
                  <span data-testid="dividend-conclusion-paid" className={`whitespace-nowrap ${DOT_WRAP_FIRST}`}>
                    지급 <span className="font-semibold text-foreground">{formatPriceByMode(annualActual)}</span>
                  </span>
                )}
                {annualExpected > 0 && (
                  <span data-testid="dividend-conclusion-expected" className={`whitespace-nowrap ${annualActual > 0 ? "" : DOT_WRAP_FIRST}`}>
                    {annualActual > 0 && <DotLead />}예상 <span className="font-semibold">{formatPriceByMode(annualExpected)}</span>
                  </span>
                )}
                {next && (
                  <span data-testid="dividend-conclusion-next" className={`whitespace-nowrap ${annualActual > 0 || annualExpected > 0 ? "" : DOT_WRAP_FIRST}`}>
                    {(annualActual > 0 || annualExpected > 0) && <DotLead />}다음 지급 <span className="font-semibold text-foreground">{next.month}월 {next.count}종목</span>
                  </span>
                )}
              </p>
              {dividendYield && (
                <div
                  data-testid="dividend-yield"
                  aria-hidden={selectedMonth !== undefined}
                  className={`mt-3 transition-opacity duration-150 motion-reduce:transition-none ${
                    selectedMonth !== undefined ? "opacity-0 select-none" : "opacity-100"
                  }`}
                >
                  <p className="flex items-baseline gap-1.5 leading-tight">
                    <span className="text-sm font-medium text-muted-foreground">투입 대비 배당</span>
                    <span data-testid="dividend-yield-value" className="text-base font-semibold tabular-nums text-foreground whitespace-nowrap">
                      {dividendYield.text}
                    </span>
                  </p>
                  <p data-testid="dividend-yield-caption" className="mt-1 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep">
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
                {groups.slice(0, 8).map(({ stock, isLoading: loading }) => {
                  const done = !loading;
                  return (
                    <div key={stock.id} className="flex items-center justify-between px-1 py-0.5">
                      <span className="text-sm text-foreground truncate max-w-[60%]">{stock.name || stock.ticker}</span>
                      <span className={`text-xs ${done ? "text-primary" : "text-muted-foreground"}`}>
                        {done ? "완료" : "불러오는 중…"}
                      </span>
                    </div>
                  );
                })}
                {groups.length > 8 && (
                  <p className="text-xs text-muted-foreground px-1">외 {groups.length - 8}개 종목...</p>
                )}
              </div>
            </div>
          )}

          {!isLoading && failedCount > 0 && (
            <p className="text-sm text-muted-foreground text-pretty break-keep">{DIVIDEND_FETCH_FAILED_MESSAGE}</p>
          )}

          {!isLoading && jpyCount > 0 && !jpyOnly && (
            <p data-testid="dividend-jpy-notice" className="text-sm text-muted-foreground text-pretty break-keep">{jpyDividendNotice(jpyCount)}</p>
          )}

          {!isLoading && annualTotal === 0 ? (
            isDividendUnknown(failedCount, annualTotal) ? null : (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">올해 배당이 아직 없어요</p>
                <p data-testid={jpyOnly ? "dividend-jpy-notice" : undefined} className="text-muted-foreground text-sm mt-1 text-pretty break-keep">
                  {jpyOnly ? jpyDividendNotice(jpyCount) : "보유 종목에서 올해 받을 배당이 없어요"}
                </p>
              </div>
            </div>
            )
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
                    {[...CATEGORY_KEYS].reverse().map((cat) => {
                      return (
                        <Bar
                          key={`${cat}-actual`}
                          dataKey={`${cat}Actual`}
                          stackId="a"
                          name={CATEGORY_LABELS[cat]}
                          fill={CATEGORY_COLORS[cat]}
                          radius={[0, 0, 0, 0]}
                        >
                          {monthlyTotals.map((_, monthIdx) => (
                            <Cell
                              key={`cell-actual-${monthIdx}`}
                              opacity={selectedMonth === undefined ? 1 : monthIdx + 1 === selectedMonth ? 1 : 0.3}
                            />
                          ))}
                        </Bar>
                      );
                    })}
                    {/* 예상 지급 Bar — 늘 노출(지급 진함 + 예상 옅음) */}
                    {[...CATEGORY_KEYS].reverse().map((cat, idx) => {
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
                {annualExpected > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
                    <span className="text-sm text-muted-foreground">예상 (옅음)</span>
                  </div>
                )}
              </div>
            );
          })()}

          {!isLoading && annualTotal > 0 && (
            <MonthlyDividendStocks selectedMonth={selectedMonth} groups={groups} calc={calc} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
