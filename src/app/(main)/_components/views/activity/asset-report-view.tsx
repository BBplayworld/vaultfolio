"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, TrendingUp, Landmark, Sparkles, Microscope, ChevronRight, Banknote, Globe2, PieChart, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { formatPriceByMode, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { buildAssetReport, computeAttribution, computeApproxAttribution, computeFxExposure } from "@/lib/report/asset-report";
import { readExchangeHistory, fetchProfitRef, computePeriodStockProfitTotal } from "@/lib/profit-utils";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { normalizeTicker } from "@/lib/finance-service";
import { InlineSelector } from "../../layout/ui/inline-selector";
import type { DailyAssetSnapshot } from "@/types/asset";
import { computeBreakdown } from "@/lib/xray/stock-xray";
import { groupStocksByTicker, mergeStockGroup } from "../detail/asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { PromptPreviewDialog } from "../../layout/ui/prompt-preview-dialog";
import { AI_PROMPT_TEMPLATES, type AssetPromptContext } from "@/lib/ai-prompts";
import { useDividendAnnualTotals } from "./performance-hub";

function readDailySnapshots(): DailyAssetSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
    return raw ? (JSON.parse(raw) as DailyAssetSnapshot[]) : [];
  } catch {
    return [];
  }
}

// 부호 색상 텍스트 (상승=빨강/하락=파랑)
function Signed({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`font-semibold tabular-nums ${getProfitLossColor(value)} ${className}`}>
      {value >= 0 ? "+" : ""}{formatPriceByMode(value)}
    </span>
  );
}

// 섹션 외피 — 카드 내 서브 박스 공통
const BOX = "rounded-lg border border-border/10 bg-transparent dark:border-0 dark:bg-card p-4 space-y-3";
const SECTION_TITLE = "text-sm sm:text-base font-bold text-foreground";
const CAPTION = "text-sm text-muted-foreground";

// 카테고리 팔레트 할당 — 최대값=MAIN_PALETTE[0], 나머지 [3+i%7] (dashboard assignColors와 동일 관례,
// [1]/[2]는 대출·임차보증금 고정색이라 회피). 자산군별 기여 바 색상에 사용.
function assignCategoryColors(values: number[]): string[] {
  if (values.length === 0) return [];
  const maxIdx = values.reduce((mi, v, i) => (v > values[mi] ? i : mi), 0);
  let si = 0;
  return values.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + (si++) % 7]));
}

export function AssetReportView() {
  const { assetData, getAssetSummary, exchangeRates, snapshotVersion } = useAssetData();
  const { navigate } = useAssetNavigation();
  const summary = getAssetSummary();
  const report = useMemo(() => buildAssetReport(assetData, summary), [assetData, summary]);

  const [promptOpen, setPromptOpen] = useState(false);

  // 배당 (성과 허브·배당 차트와 동일 쿼리 키 → 캐시 공유)
  const { isLoading: divLoading, annualActual } = useDividendAnnualTotals();
  const divReady = !(divLoading && annualActual === 0);

  // 올해 주식 시세차익 (연초 대비, KIS 기준가 — performance-hub "수익" 카드와 동일 패턴, period만 yearly)
  const tickerList = useMemo(
    () => Array.from(new Set(
      assetData.stocks
        .filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted")
        .map((s) => normalizeTicker(s))
        .filter(Boolean),
    )).sort().join(","),
    [assetData.stocks],
  );
  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  const [yearlyRefData, setYearlyRefData] = useState<ProfitRefResponse | undefined>(undefined);
  const [kisUnavailable, setKisUnavailable] = useState(false);
  useEffect(() => {
    if (!profitBasisHydrated || !tickerList) return;
    const controller = new AbortController();
    setYearlyRefData(undefined);
    setKisUnavailable(false);
    fetchProfitRef(tickerList, "yearly", {
      signal: controller.signal,
      caller: "asset-report:yearly",
      basis: profitBasis,
      onProgress: (data) => setYearlyRefData({ ...data }),
      onKisUnavailable: () => setKisUnavailable(true),
    }).catch(() => { /* abort 등 무시 */ });
    return () => controller.abort();
  }, [profitBasisHydrated, tickerList, profitBasis]);

  // yearly 응답의 refPrice는 "1년 전 시점" 가격 — 현재가(daily)와 짝지어야 시세차익이 나옴
  // (computeDailyStockProfit는 prevPrice/prevDate 기반이라 yearly엔 부적합 → computePeriodStockProfitTotal 사용)
  const [dailyRefData, setDailyRefData] = useState<ProfitRefResponse | undefined>(undefined);
  useEffect(() => {
    if (!profitBasisHydrated || !tickerList) return;
    const controller = new AbortController();
    setDailyRefData(undefined);
    fetchProfitRef(tickerList, "daily", {
      signal: controller.signal,
      caller: "asset-report:yearly-daily-base",
      basis: profitBasis,
      onProgress: (data) => setDailyRefData({ ...data }),
      onKisUnavailable: () => setKisUnavailable(true),
    }).catch(() => { /* abort 등 무시 */ });
    return () => controller.abort();
  }, [profitBasisHydrated, tickerList, profitBasis]);

  const stockYearlyProfit = computePeriodStockProfitTotal(assetData.stocks, yearlyRefData, dailyRefData, exchangeRates);
  // 보유 주식 없으면 시세차익 0으로 즉시 확정(조회 대기 불필요)
  const stockYearlyReady = tickerList === "" || (yearlyRefData !== undefined && dailyRefData !== undefined && stockYearlyProfit !== null);
  const stockYearlyValue = tickerList === "" ? 0 : (stockYearlyProfit ?? 0);
  const interestCompareReady = !kisUnavailable && stockYearlyReady && divReady;

  // 환노출
  const fxExposures = useMemo(
    () => computeFxExposure(assetData, exchangeRates, summary.totalValue),
    [assetData, exchangeRates, summary.totalValue],
  );

  // 원인분해 델타
  const dailySnapshots = useMemo(
    () => readDailySnapshots(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );
  const enrichedCount = useMemo(
    () => dailySnapshots.filter((s) => s.breakdown && s.fx && s.fxBase && s.cost).length,
    [dailySnapshots],
  );
  const attribution = useMemo(() => computeAttribution(dailySnapshots), [dailySnapshots]);

  // 근사 원인분해 — 정밀(enriched 2건) 불가 시 레거시 스냅샷 + 환율 이력으로 첫날부터 2단 분해
  const [approxDays, setApproxDays] = useState<"1" | "7">("1");
  const approxAttribution = useMemo(() => {
    if (attribution) return null; // 정밀 모드 우선
    return computeApproxAttribution(dailySnapshots, readExchangeHistory(), Number(approxDays));
  }, [attribution, dailySnapshots, approxDays]);

  // 주식 집중도 (X-Ray 참조) — 핵심 분야 축
  const stockConcentration = useMemo(() => {
    if (assetData.stocks.length === 0) return null;
    const merged = Array.from(groupStocksByTicker(assetData.stocks).values()).map(mergeStockGroup);
    return computeBreakdown("theme", merged, exchangeRates);
  }, [assetData.stocks, exchangeRates]);

  const getPromptContext = (): AssetPromptContext => ({
    data: assetData,
    summary,
    exchangeRates,
  });

  const hasAssets = summary.totalValue > 0;
  const hasLoans = assetData.loans.length > 0;

  return (
    <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5 text-primary" />
          자산 성적표
          <span className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">Plus</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 min-w-0 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500`}>
        {!hasAssets ? (
          <p className={`${CAPTION} py-10 text-center`}>자산을 등록하면 성적표가 계산됩니다.</p>
        ) : (
          <>
            {/* ── Hero: 진짜 수익률 ── */}
            <div className="rounded-xl border border-border/10 bg-card dark:border-0 shadow-xs p-4 sm:p-5 space-y-4">
              <div>
                <p className={CAPTION}>순자산</p>
                <p className={`text-3xl sm:text-4xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>
                  {formatPriceByMode(summary.netAsset)}
                </p>
              </div>

              <div className="border-t border-border/40 pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`${SECTION_TITLE} flex items-center gap-1.5`}>
                    <TrendingUp className="size-4 text-primary" /> 번 돈 (평가손익)
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold">
                    <Signed value={report.totalProfit} />
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-3">
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={CAPTION}>총자산 수익률</span>
                      <span className={`text-base sm:text-lg font-bold tabular-nums ${getProfitLossColor(report.totalProfit)}`}>
                        {report.totalProfit >= 0 ? "+" : ""}{report.totalProfitRate.toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm tabular-nums">
                      <span className="text-muted-foreground">넣은 돈</span>{" "}
                      <span className="font-semibold text-foreground">{formatShortCurrency(report.totalCost)}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={CAPTION}>자기자본 수익률</span>
                      <span className={`text-base sm:text-lg font-bold tabular-nums ${getProfitLossColor(report.totalProfit)}`}>
                        {report.equity > 0 ? `${report.totalProfit >= 0 ? "+" : ""}${report.equityReturnRate.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm tabular-nums">
                      <span className="text-muted-foreground">자기자본(부채 차감)</span>{" "}
                      <span className="font-semibold text-foreground">{formatShortCurrency(report.equity)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 번 돈의 원천: 시세 + 환차 + 배당 (세그먼트 바 + 범례) ── */}
            <div className={BOX}>
              <div className="flex items-center gap-2">
                <PieChart className="size-4 text-primary" />
                <span className={SECTION_TITLE}>번 돈의 원천</span>
              </div>
              {(() => {
                const sources = [
                  { key: "price", label: "순수 시세손익", value: report.priceGain, color: MAIN_PALETTE[0], show: true },
                  { key: "fx", label: "환차익 (해외주식)", value: report.currencyGain, color: MAIN_PALETTE[3], show: report.currencyGain !== 0 },
                  { key: "dividend", label: "올해 배당 수령", value: annualActual, color: MAIN_PALETTE[4], show: true },
                ].filter((s) => s.show);
                const barRows = sources.filter((s) => s.key !== "dividend" || divReady);
                const totalAbs = barRows.reduce((sum, s) => sum + Math.abs(s.value), 0);
                return (
                  <div className="space-y-3">
                    {totalAbs > 0 && (
                      <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px">
                        {barRows.filter((s) => Math.abs(s.value) > 0).map((s) => (
                          <div
                            key={s.key}
                            style={{ width: `${(Math.abs(s.value) / totalAbs) * 100}%`, backgroundColor: s.color }}
                            title={s.label}
                          />
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {sources.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-2 text-sm sm:text-[15px]">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            {s.label}
                          </span>
                          {s.key === "dividend" && !divReady ? (
                            <span className={CAPTION}>조회 중…</span>
                          ) : s.key === "dividend" ? (
                            <span className="font-semibold tabular-nums text-foreground">
                              {s.value > 0 ? `+${formatPriceByMode(s.value)}` : "0원"}
                            </span>
                          ) : (
                            <Signed value={s.value} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── 자산군별 기여 ── */}
            {report.perClass.length > 0 && (
              <div className={BOX}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" />
                  <span className={SECTION_TITLE}>자산군별 기여</span>
                </div>
                <div className="space-y-3">
                  {(() => {
                    // 색상=카테고리(팔레트, value 기준 랭킹) · 길이=손익 크기 · 숫자=손익색(getProfitLossColor)
                    const colors = assignCategoryColors(report.perClass.map((c) => c.value));
                    const maxAbs = Math.max(...report.perClass.map((c) => Math.abs(c.profit)), 1);
                    return report.perClass.map((c, i) => {
                      const rate = c.cost > 0 ? (c.profit / c.cost) * 100 : 0;
                      const barPct = Math.max((Math.abs(c.profit) / maxAbs) * 100, 2);
                      return (
                        <div key={c.key} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2 text-sm sm:text-[15px]">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i] }} />
                              {c.label}
                            </span>
                            <span className="tabular-nums">
                              <Signed value={c.profit} />
                              {c.cost > 0 && (
                                <span className={`ml-1.5 text-sm font-semibold ${getProfitLossColor(c.profit)}`}>
                                  ({c.profit >= 0 ? "+" : ""}{rate.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: colors[i] }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ── 부채 실질 비용 ── */}
            {hasLoans && (
              <div className={BOX}>
                <div className="flex items-center gap-2">
                  <Banknote className="size-4 text-primary" />
                  <span className={SECTION_TITLE}>부채 실질 비용</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className={CAPTION}>연간 이자 추정</p>
                    <p className={`text-base sm:text-lg font-bold tabular-nums ${ASSET_THEME.liability}`}>
                      −{formatPriceByMode(Math.round(report.annualInterest))}
                    </p>
                    <p className="text-sm tabular-nums">
                      <span className="text-muted-foreground">월 약</span>{" "}
                      <span className={`font-semibold ${ASSET_THEME.liability}`}>−{formatShortCurrency(Math.round(report.monthlyInterest))}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className={CAPTION}>주식+배당 대비 연간 이자</p>
                    {kisUnavailable ? (
                      <p className={`text-base sm:text-lg font-bold ${CAPTION}`}>점검 중</p>
                    ) : interestCompareReady ? (
                      <p className="text-base sm:text-lg font-bold tabular-nums">
                        <Signed value={Math.round(stockYearlyValue + annualActual - report.annualInterest)} />
                      </p>
                    ) : (
                      <p className={`text-base sm:text-lg font-bold ${CAPTION}`}>조회 중…</p>
                    )}
                    <p className={CAPTION}>주식은 최근 1년, 배당은 올해 기준</p>
                  </div>
                </div>
                {/* 대출별 이자 상세 (연이자 내림차순) */}
                {report.loanInterest.length > 0 && (
                  <div className="space-y-1.5">
                    {report.loanInterest.map((l) => (
                      <div key={`${l.name}-${l.rate}`} className="flex items-baseline justify-between gap-2 text-sm sm:text-[15px]">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {l.name}
                          <span className="ml-1.5 tabular-nums">{l.rate}%</span>
                        </span>
                        <span className={`shrink-0 font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                          −{formatPriceByMode(Math.round(l.annual))}<span className="text-muted-foreground font-medium">/년</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
                  <span>부채비율 <span className="font-semibold text-foreground">{report.debtRatio.toFixed(1)}%</span></span>
                  {report.leverage > 0 && (
                    <span>레버리지 <span className="font-semibold text-foreground">{report.leverage.toFixed(2)}배</span></span>
                  )}
                </div>
                {interestCompareReady && (
                  <p className={`${CAPTION} text-pretty`}>
                    {stockYearlyValue + annualActual >= report.annualInterest
                      ? "최근 1년 주식 수익과 올해 배당이 연간 이자 부담을 상쇄하고 있습니다."
                      : "최근 1년 주식 수익과 올해 배당만으로는 연간 이자 부담을 채우지 못합니다."}
                    {" "}부동산은 시세가 자동 갱신되지 않아 이 비교에서 제외했습니다.
                  </p>
                )}
              </div>
            )}

            {/* ── 환노출 ── */}
            {fxExposures.length > 0 && (
              <div className={BOX}>
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 text-primary" />
                  <span className={SECTION_TITLE}>환노출</span>
                </div>
                <div className="space-y-2.5">
                  {fxExposures.map((fx) => (
                    <div key={fx.currency} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm sm:text-[15px]">
                        <span className="font-medium text-foreground">{fx.currency} 자산</span>
                        <span className="tabular-nums font-semibold text-foreground">
                          {formatShortCurrency(Math.round(fx.exposureKrw))}
                          <span className="ml-1.5 text-muted-foreground font-medium">({fx.ratio.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <p className="text-sm tabular-nums">
                        <span className="text-muted-foreground">환율 10원 변동 시 약</span>{" "}
                        <span className="font-semibold text-foreground">±{formatShortCurrency(Math.round(fx.per10Won))}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 주식 집중도 (X-Ray 참조) ── */}
            {stockConcentration && stockConcentration.total > 0 && (
              <button
                type="button"
                onClick={() => navigate({ type: "detail", tab: "stocks-xray" })}
                className="w-full text-left rounded-lg border border-border/10 bg-transparent dark:border-0 dark:bg-card p-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Microscope className="size-4 text-primary" />
                    <span className={SECTION_TITLE}>주식 집중도</span>
                  </span>
                  <span className={`flex items-center gap-1 ${CAPTION}`}>
                    주식 X-Ray <ChevronRight className="size-4" />
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {stockConcentration.items.slice(0, 3).map((it) => (
                    <span key={it.key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium tabular-nums">
                      {it.label} {(it.ratio * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </button>
            )}

            {/* ── 순자산 변화 원인분해 ── */}
            <div className={BOX}>
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                <span className={SECTION_TITLE}>순자산 변화 원인분해</span>
              </div>
              {attribution ? (
                <div className="space-y-3">
                  <p className={`${CAPTION} tabular-nums`}>
                    {attribution.fromDate} → {attribution.toDate} · Δ순자산 <Signed value={attribution.deltaNet} />
                  </p>
                  {(() => {
                    const rows = [
                      { label: "시세효과", value: attribution.priceEffect, color: MAIN_PALETTE[0] },
                      { label: "환율효과", value: attribution.fxEffect, color: MAIN_PALETTE[3] },
                      { label: "입출금효과", value: attribution.flowEffect, color: MAIN_PALETTE[6] },
                    ];
                    const totalAbs = rows.reduce((s, r) => s + Math.abs(r.value), 0) || 1;
                    return (
                      <>
                        <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px">
                          {rows.map((r) => (
                            <div key={r.label} style={{ width: `${(Math.abs(r.value) / totalAbs) * 100}%`, backgroundColor: r.color }} />
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          {rows.map((r) => (
                            <div key={r.label} className="flex items-center justify-between gap-2 text-sm sm:text-[15px]">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                                <span className="font-medium text-foreground">{r.label}</span>
                              </span>
                              <Signed value={r.value} />
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                  <p className={`${CAPTION} text-pretty`}>
                    시세·환율·입출금으로 나눈 근사치입니다. 데이터가 쌓일수록 정밀해집니다.
                  </p>
                </div>
              ) : approxAttribution ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`${CAPTION} tabular-nums`}>
                      {approxAttribution.fromDate} → {approxAttribution.toDate}
                    </p>
                    <InlineSelector
                      value={approxDays}
                      onChange={setApproxDays}
                      options={[{ value: "1", label: "전일" }, { value: "7", label: "7일 전" }]}
                      size="sm"
                      ariaLabel="비교 기준일"
                    />
                  </div>
                  <p className={`${CAPTION} tabular-nums`}>
                    Δ순자산 <Signed value={approxAttribution.deltaNet} />
                  </p>
                  {(() => {
                    const rows = [
                      { label: "환율효과 (근사)", value: approxAttribution.fxEffect, color: MAIN_PALETTE[3] },
                      { label: "시세·입출금 효과", value: approxAttribution.restEffect, color: MAIN_PALETTE[0] },
                    ];
                    const totalAbs = rows.reduce((s, r) => s + Math.abs(r.value), 0) || 1;
                    return (
                      <>
                        <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px">
                          {rows.map((r) => (
                            <div key={r.label} style={{ width: `${(Math.abs(r.value) / totalAbs) * 100}%`, backgroundColor: r.color }} />
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          {rows.map((r) => (
                            <div key={r.label} className="flex items-center justify-between gap-2 text-sm sm:text-[15px]">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                                <span className="font-medium text-foreground">{r.label}</span>
                              </span>
                              <Signed value={r.value} />
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                  <p className={`${CAPTION} text-pretty`}>
                    근사 추정입니다. 입출금과 시세의 분리는 접속 기록이 쌓이면 자동 제공됩니다.
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-1">
                  <p className={CAPTION}>데이터 쌓는 중 · 기록 {enrichedCount}일</p>
                  <p className={`${CAPTION} text-pretty`}>변화 원인분해는 접속 기록이 모이면 표시됩니다.</p>
                </div>
              )}
            </div>

            {/* ── AI 평가 프롬프트 ── */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-3">
              <div>
                <p className={`${SECTION_TITLE} flex items-center gap-1.5`}>
                  <Sparkles className="size-4 text-primary" /> AI 평가 프롬프트
                </p>
                <p className={`${CAPTION} mt-1 text-pretty`}>
                  자산 현황을 외부 AI(Grok·Gemini·GPT)에 붙여넣어 구조·리스크 진단을 받아보세요.
                </p>
              </div>
              <Button
                onClick={() => setPromptOpen(true)}
                style={{ backgroundColor: MAIN_PALETTE[0] }}
                className="text-white hover:opacity-90 border-none w-full"
              >
                AI 평가 프롬프트 확인 · 복사
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <PromptPreviewDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={<><Sparkles className="size-5 text-primary" />AI 평가용 자산 종합 현황</>}
        description="아래 프롬프트를 복사하여 Grok·Gemini·GPT 등 AI에게 자산 구조·리스크 진단을 요청하세요."
        tabs={AI_PROMPT_TEMPLATES.map((t) => ({
          id: t.id,
          label: t.label,
          sublabel: t.sublabel,
          getPrompt: () => t.generate(getPromptContext()),
        }))}
        copySuccessMessage="AI 평가 프롬프트가 복사되었습니다."
      />
    </Card>
  );
}
