"use client";

import { LoadingNote, LOADING_LABEL } from "@/components/ui/loading-note";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { Wallet, BadgeDollarSign, Sprout } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor, PAGE_TITLE } from "@/config/theme";
import { KpiCard } from "../../layout/ui/kpi-card";
import { HubShareButton } from "../../layout/ui/hub-share-button";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { dividendQueryOptions, countFailedDividends, isDividendUnknown, DIVIDEND_FETCH_FAILED_MESSAGE } from "@/lib/finance/dividend-client";
import { useAssetNavigation, type ActivityTab } from "../../layout/navigation/navigation-context";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildGrowRows, growTotals, summarizeGrowRows } from "@/lib/asset/grow-rows";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { monthlyLogEntryCount } from "@/lib/report/monthly-log";
import type { SettlementWindow } from "@/lib/report/settlement";
import { pickFirstRecordStart, pickSettlementCard, resolveSettlementWindow, settlementRangeLabel, settlementWindowName } from "@/lib/report/settlement";
import { settlementDelta } from "./change-hero";
import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { HubChangeRows } from "./hub-change-rows";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

// dividend-chart.tsx와 동일 쿼리 키 → 캐시 공유 (자산 성적표에서도 재사용)
export function useDividendAnnualTotals() {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

  const stocksWithTicker = (() => {
    const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
    const grouped = groupStocksByTickerCategory(base);
    return Array.from(grouped.values()).map(mergeStockGroup);
  })();

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      return {
        ...dividendQueryOptions(ticker, type),
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const failedCount = countFailedDividends(queries);

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYM = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;

  let annualActual = 0;
  let annualEstimated = 0;
  // 지금 수량 기준 1년 배당(가정) — 매수일과 무관하게 올해 지급·예상 배당 전부를 지금 수량으로. 불리기 결론 카드 '앞으로 · 배당'(#239)
  let annualAtHeldQty = 0;
  stocksWithTicker.forEach((stock, i) => {
    const payouts = (queries[i]?.data as DividendPayoutResult[] | undefined) ?? [];
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      annualAtHeldQty += p.amountPerShare * stock.quantity * rate;
      if (stock.purchaseDate && p.payoutDate < stock.purchaseDate) continue;
      const amt = p.amountPerShare * stock.quantity * rate;
      if (p.payoutDate.slice(0, 7) <= currentYM) annualActual += amt;
      else annualEstimated += amt;
    }
  });

  return {
    isLoading,
    failedCount,
    annualActual: Math.round(annualActual),
    annualEstimated: Math.round(annualEstimated),
    annualTotal: Math.round(annualActual + annualEstimated),
    annualAtHeldQty: Math.round(annualAtHeldQty),
  };
}

// 허브 자산 변화 카드 설명 줄 — 이름은 settlementWindowName 1곳(4.94). settled는 배지가 이름이라 구간만, range는 이름=구간
function hubDescription(w: SettlementWindow | undefined, today: string): string {
  if (!w) return "다음 달부터 결산이 열려요";
  if (w.kind === "settled") return settlementRangeLabel(w);
  const { name, inProgress } = settlementWindowName(w, today);
  return inProgress ? `${name} · 진행 중` : name;
}

export function PerformanceHub() {
  const { assetData, getAssetSummary, snapshotVersion, exchangeRates } = useAssetData();
  const summary = getAssetSummary();
  const { navigate } = useAssetNavigation();

  const go = (tab: ActivityTab) => navigate({ type: "activity", tab });

  // 내 자산 불리기 카드(#239) — 금액·% 없이 사용자가 붙인 이름표 개수와 마지막 점검만. 불리기 화면 요약 줄과 같은 값(같은 함수)
  const { labels, ready: labelsReady } = useStockLabels();
  const [growNow] = useState(() => Date.now());
  const grow = useMemo(() => {
    const rows = buildGrowRows(assetData.stocks, exchangeRates, labels, growNow);
    return { hasRows: rows.length > 0, ...summarizeGrowRows(rows, labels, growNow, growTotals(assetData.stocks, exchangeRates)) };
  }, [assetData.stocks, exchangeRates, labels, growNow]);

  // 자산 변화 카드(#32 r2) — 결산 창(말일−3일~다음 달 10일, 비교 가능) 안이면 "N월 결산" 배지 + 구간 증감,
  // 창 밖이면 이번 달 진행 중 증감, 첫 달·자산 0건이면 금액 없이 안내. 증감은 결산 Hero와 같은 settlementDelta.
  const hasAssets = hasAnyAssets(assetData);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const changeCard = useMemo(() => {
    if (!hasAssets || snapshotVersion < 0) return null;
    const monthly = readMonthlySnapshots();
    const firstRecord = pickFirstRecordStart(readDailySnapshots(), assetData, today);
    const settled = pickSettlementCard(monthly, today, firstRecord);
    if (settled) return { window: settled, inWindow: true };
    const w = resolveSettlementWindow(monthly, today.slice(0, 7), today, firstRecord);
    return w.kind === "first_month" ? null : { window: w, inWindow: false };
  }, [hasAssets, snapshotVersion, today, assetData]);
  const change = changeCard ? settlementDelta(changeCard.window, summary.netAsset) : null;
  // 허브 행 2 `N개월` — 월 탭 월별 기록 카드와 같은 노출 조건(4.83). 자산 0이면 행 목록 전체가 없다
  const monthlyCount = useMemo(
    () => (hasAssets && snapshotVersion >= 0 ? monthlyLogEntryCount(readMonthlySnapshots(), today, summary.netAsset) : null),
    [hasAssets, snapshotVersion, today, summary.netAsset],
  );

  // 배당 — 올해 연간 합계 (실제 + 예상)
  const { isLoading: divLoading, failedCount: divFailed, annualActual, annualEstimated, annualTotal } = useDividendAnnualTotals();

  return (
    <div aria-busy={divLoading && annualTotal === 0 ? true : undefined} className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={PAGE_TITLE}>성과</h2>
        </div>
        <HubShareButton />
      </div>

      {/* 지난 접속 등락은 홈 Hero(순자산 헤더)로 통합 — 앱을 켜자마자 보는 정보라 중복 노출하지 않는다 */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div data-testid="hub-card-change" className="lg:row-span-2">
        <KpiCard
          icon={Wallet}
          title={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              자산 변화
              {changeCard?.window.kind === "settled" && (
                <span data-testid="hub-change-settlement-badge" className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {settlementWindowName(changeCard.window, today).name}
                </span>
              )}
            </span>
          }
          description={<span data-testid="hub-change-desc" className="tabular-nums">{hubDescription(changeCard?.window, today)}</span>}
          primary={change ? `${change.delta >= 0 ? "+" : ""}${formatPriceByMode(change.delta)}` : undefined}
          primaryClassName={change ? getProfitLossColor(change.delta) : undefined}
          secondary={change && change.pct !== null ? (
            <span className={`font-semibold tabular-nums ${getProfitLossColor(change.delta)}`}>
              {change.pct >= 0 ? "+" : ""}{change.pct.toFixed(1)}%
              <span className="text-muted-foreground font-medium ml-1.5">지난 기록 대비</span>
            </span>
          ) : null}
          onClick={() => navigate({
            type: "activity", tab: "change",
            init: changeCard?.inWindow
              ? { scope: "all", period: "month", month: changeCard.window.month, source: "card" }
              : { scope: "all", period: "month", source: "menu" },
          })}
          rows={hasAssets ? <HubChangeRows monthlyCount={monthlyCount} /> : undefined}
        />
        </div>

        <div data-testid="hub-card-dividend">
        <KpiCard
          icon={BadgeDollarSign}
          title="배당"
          description="올해 배당 (지급 + 예상)"
          primary={divLoading && annualTotal === 0 ? <span aria-hidden className={`inline-block h-7 w-28 rounded-md align-middle ${SKELETON_FILL}`} /> : isDividendUnknown(divFailed, annualTotal) ? <span className="text-muted-foreground">—</span> : formatPriceByMode(annualTotal)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={divLoading && annualTotal === 0 ? (
            <LoadingNote active label={LOADING_LABEL.dividend} className="min-h-5" />
          ) : !divLoading && (annualTotal > 0 || divFailed > 0) ? (
            <>
              {annualTotal > 0 && (
                <span className="text-muted-foreground">
                  지급 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualActual)}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  예상 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualEstimated)}</span>
                </span>
              )}
              {divFailed > 0 && <p className="text-sm font-normal text-muted-foreground text-pretty break-keep">{DIVIDEND_FETCH_FAILED_MESSAGE}</p>}
            </>
          ) : null}
          onClick={() => go("dividend")}
        />
        </div>

        <div data-testid="hub-card-report">
        <KpiCard
          icon={Sprout}
          title="내 자산 불리기"
          description="내 기준으로 지키고, 내가 점검해요"
          // 큰 값은 본문색 고정(주황·손익색 금지). 이름표 0개면 앱이 센 숫자·분류 없이 행동 문구만
          primary={!hasAssets || !labelsReady ? undefined : (
            <span data-testid="hub-report-primary" className="whitespace-nowrap">
              {!grow.hasRows ? "성적표 보기" : grow.keep + grow.check === 0 ? "이름표 붙이기" : `오래 둘 ${grow.keep} · 점검할 ${grow.check}`}
            </span>
          )}
          primaryClassName={ASSET_THEME.text.default}
          secondary={!hasAssets ? (
            <span data-testid="hub-report-secondary" data-kind="empty" className="text-muted-foreground">자산 등록 후 볼 수 있어요</span>
          ) : !labelsReady || !grow.hasRows || grow.keep + grow.check === 0 ? null : grow.keep > 0 ? (
            // '오래 둘'이 있으면 그 무게 — 불리기 화면 무게 줄 첫 묶음과 같은 함수의 같은 문자열 값. 색·경과 표시 없음
            <span data-testid="hub-report-secondary" data-kind="weight" data-pct={grow.weights.keep.pctText} className="whitespace-nowrap text-muted-foreground tabular-nums">
              오래 둘 자산이 내 주식의 <span className="font-semibold text-foreground">{grow.weights.keep.pctText}</span>
            </span>
          ) : grow.lastCheckText ? (
            <span data-testid="hub-report-secondary" data-kind="check" className="text-muted-foreground tabular-nums">{grow.lastCheckText}</span>
          ) : null}
          onClick={() => go("report")}
        />
        </div>
      </div>
    </div>
  );
}
