"use client";

import { LoadingNote, LOADING_LABEL } from "@/components/ui/loading-note";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Wallet, BadgeDollarSign, Sprout } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor, PAGE_TITLE } from "@/config/theme";
import { KpiCard } from "../../layout/ui/kpi-card";
import { HubShareButton } from "../../layout/ui/hub-share-button";
import { isDividendUnknown, DIVIDEND_FETCH_FAILED_MESSAGE } from "@/lib/finance/dividend-client";
import { useAssetNavigation, type ActivityTab } from "../../layout/navigation/navigation-context";
import { useDividendData } from "./use-dividend-data";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildGrowBoards, growStatus } from "@/lib/asset/grow-kinds";
import { useLatestAssetGrade } from "@/hooks/use-latest-asset-grade";
import { tierLabel } from "@/lib/report/asset-grade";
import { TIER_STYLE } from "./asset-report-view";
import { resetReportTab } from "./report-tab";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { monthlyLogEntryCount } from "@/lib/report/monthly-log";
import type { SettlementWindow } from "@/lib/report/settlement";
import { pickFirstRecordStart, pickSettlementCard, resolveSettlementWindow, settlementRangeLabel, settlementWindowName } from "@/lib/report/settlement";
import { settlementDelta } from "./change-hero";
import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { HubChangeRows } from "./hub-change-rows";
import { GUIDES } from "@/app/guide/guide-copy";

// 배당 차트와 같은 공용 훅·같은 쿼리 키 → 캐시·계산 공유 (자산 성적표에서도 재사용, #313)
export function useDividendAnnualTotals() {
  const { exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const { groups, calc, isLoading, failedCount } = useDividendData();

  // 지금 수량 기준 1년 배당(가정) — 매수일과 무관하게 올해 지급·예상 배당 전부를 지금 수량으로. 불리기 결론 카드 '앞으로 · 배당'(#239). 공용 계산 밖의 다른 정의(변경 0)
  let annualAtHeldQty = 0;
  for (const { stock, payouts } of groups) {
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) annualAtHeldQty += p.amountPerShare * stock.quantity * rate;
  }

  return {
    isLoading,
    failedCount,
    annualActual: Math.round(calc.annual.paid),
    // 예상 = 합계 − 지급(반올림 후) — 배당 결론 줄 E와 같은 식(C150)
    annualEstimated: Math.round(calc.annual.total) - Math.round(calc.annual.paid),
    annualTotal: Math.round(calc.annual.total),
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

  // 자산 성적표·불리기 카드(#239 6차) — 큰 값 = 성적표가 기록해 둔 최신 등급(재계산 없음, 홈 미니 트로피와 같은 값),
  // 둘째 줄 = 점검 차례 수(불리기 행 '점검 차례'와 같은 판정, #242부터 주식·코인·부동산·실물 전 종류 합). 화면 밖에서 차례를 알리는 유일한 신호다(푸시·홈 팁·알림 0)
  const { labels, ready: labelsReady } = useStockLabels();
  const latestGrade = useLatestAssetGrade();
  const [growNow] = useState(() => Date.now());
  const grow = useMemo(
    () => growStatus(buildGrowBoards(assetData, exchangeRates, labels, growNow)),
    [assetData, exchangeRates, labels, growNow],
  );

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
          title="자산 성적표·불리기"
          description="성적표와 내 자산 점검을 한곳에서"
          // 큰 값 = 등급(등급 낱말만 등급 색, 숫자는 본문색). 성적표를 아직 연 적 없으면 행동 문구
          primary={!hasAssets ? undefined : (
            <span data-testid="hub-report-primary" data-tier={latestGrade?.tier ?? ""} className="whitespace-nowrap">
              {latestGrade ? (
                <><span className={TIER_STYLE[latestGrade.tier].color}>{tierLabel(latestGrade.tier)}</span> <span className="tabular-nums">{latestGrade.overall.toFixed(1)}점</span></>
              ) : "등급 보기"}
            </span>
          )}
          primaryClassName={ASSET_THEME.text.default}
          secondary={!hasAssets ? (
            <span data-testid="hub-report-secondary" data-kind="empty" className="text-muted-foreground">자산 등록 후 볼 수 있어요</span>
          ) : !labelsReady || grow.kind === "empty" ? null : (
            <span data-testid="hub-report-secondary" data-kind={grow.kind} data-due={grow.due} className="whitespace-nowrap text-muted-foreground tabular-nums">
              {grow.kind === "due" ? <>점검 차례 <span className="font-semibold text-indigo-600 dark:text-indigo-200">{grow.due}{grow.unit}</span></>
                : grow.kind === "labeled" ? `장기 보유 ${grow.keep} · 점검 대상 ${grow.check}`
                  : "장기 보유·점검 대상 정하기"}
            </span>
          )}
          onClick={() => { resetReportTab(); go("report"); }} // 허브는 한 입구 — 기본 칸(내 자산 점검)으로 연다
        />
        </div>
      </div>

      {/* 투자 탭 폐지(5.145) — 시장 이야기는 공개 가이드로 안내(링크 1줄) */}
      <Link
        href="/guide/market-history"
        data-testid="hub-market-guide-link"
        className="inline-flex min-h-10 w-fit items-center rounded-md px-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="underline decoration-muted-foreground/40 underline-offset-4">{GUIDES["market-history"].linkLabel}</span>
        <span aria-hidden className="ml-1">›</span>
      </Link>
    </div>
  );
}
