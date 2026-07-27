"use client";

import React, { useMemo } from "react";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { computeStockMetrics, mergeStockGroup, getMultiplier, groupStocksByTicker } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { useAssetTreemapData } from "@/app/(main)/_components/views/home/dashboard";
import { useAssetData } from "@/contexts/asset-data-context";
import { SHARE_SAFE_PALETTE, getProfitLossColor } from "@/config/theme";
import { APP_CONFIG } from "@/config/app";
import { useNickname } from "@/hooks/use-nickname";

// 인증샷 축약 상수 — 하단 주식 전용 섹션을 없애고 통합 랭킹 하나로 흡수했으므로 노출 개수 확대
const CORE_MAX = 8;

export interface ShareCardProps {
  hideAmounts: boolean;
  cardRef: React.RefObject<HTMLDivElement>;
}

export function ShareCard({ hideAmounts, cardRef }: ShareCardProps) {
  // 공통 훅 사용 — 중복 로직 없음
  const { summary } = useAssetTreemapData();
  const { assetData, exchangeRates: rates } = useAssetData();
  const [nickname] = useNickname();

  // 포트폴리오 구성 — 자산군(주식·부동산·코인·현금) 단위로 먼저 색을 배정한다.
  // 최대 비중 자산군 = SHARE_SAFE_PALETTE[0](인디고), 나머지는 비중 순.
  // 핵심 자산 목록은 이 색을 그대로 물려받아 바 색 = 종목 색점이 1:1로 매칭된다.
  const classBar = useMemo(() => {
    const base = [
      { key: "stock", label: "주식", value: summary.stockValue },
      { key: "realEstate", label: "부동산", value: summary.realEstateValue },
      { key: "crypto", label: "코인", value: summary.cryptoValue },
      { key: "cash", label: "현금", value: summary.cashValue },
    ].filter((d) => d.value > 0);
    const total = base.reduce((s, d) => s + d.value, 0);
    const rankOrder = [...base].sort((a, b) => b.value - a.value);
    const colorByLabel = new Map(rankOrder.map((d, i) => [d.label, SHARE_SAFE_PALETTE[i % SHARE_SAFE_PALETTE.length]]));
    const items = base.map((d) => ({ ...d, color: colorByLabel.get(d.label)! }));
    return { items, total, colorByLabel };
  }, [summary]);

  // 핵심 자산 — 전 자산군(주식·코인·부동산·현금) 개별 보유를 KRW 평가액 기준 상위 랭킹.
  // 색은 classBar에서 배정한 자산군 색을 그대로 물려받는다.
  const coreHoldings = useMemo(() => {
    const items: { name: string; kind: string; value: number }[] = [];
    // 주식은 증권사별로 나뉜 동일 종목을 항목(티커)별로 통합
    const activeStocks = assetData.stocks.filter((s) => s.inactiveStatus !== "delisted");
    for (const grp of groupStocksByTicker(activeStocks).values()) {
      const s = mergeStockGroup(grp);
      items.push({ name: s.name, kind: "주식", value: s.quantity * s.currentPrice * getMultiplier(s.currency, rates) });
    }
    for (const c of assetData.crypto) {
      items.push({ name: c.name, kind: "코인", value: c.quantity * c.currentPrice });
    }
    for (const r of assetData.realEstate) {
      items.push({ name: r.name, kind: "부동산", value: r.currentValue });
    }
    for (const c of assetData.cash ?? []) {
      items.push({ name: c.name, kind: "현금", value: c.balance * getMultiplier(c.currency, rates) });
    }
    const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
    return sorted.map((it) => ({ ...it, color: classBar.colorByLabel.get(it.kind) ?? SHARE_SAFE_PALETTE[0] }));
  }, [assetData, rates, classBar]);
  const coreTop = coreHoldings.slice(0, CORE_MAX);
  const coreRestCount = coreHoldings.length - coreTop.length;

  // 금액류만 마스킹 — 비중%·수익률%는 항상 노출
  const amountMask = hideAmounts ? (_: number) => "••••" : formatShortCurrency;
  const netMask = hideAmounts ? (_: number) => "••••" : formatPriceByMode;

  const now = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const siteHost = APP_CONFIG.siteUrl.replace(/^https?:\/\//, "");

  return (
    <div ref={cardRef} className="space-y-4 p-3 rounded-2xl bg-background dark:bg-card">

      {/* 닉네임 pill(신원 요소) — 닉네임 있을 때만 렌더 */}
      {nickname && (
        <div className="flex items-center justify-end px-1 pt-0.5">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">@{nickname}</span>
        </div>
      )}

      {/* 대표 지표 — 순자산 전폭 hero(1순위) + 수익률·수익금 한 줄(2순위) */}
      <div className="rounded-lg bg-muted/20 dark:bg-muted/10 p-3.5 space-y-2">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">순자산</p>
          <p className="text-3xl font-bold tabular-nums leading-tight break-keep text-foreground">{netMask(summary.netAsset)}</p>
        </div>
        {/* 수익금·수익률 — 좁은 폭(320px)에서 넘치면 항목째 줄바꿈(숫자는 nowrap으로 통짜 유지) */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border/40 pt-2">
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-sm font-semibold text-muted-foreground">수익금</span>
            <span className={`text-lg font-bold tabular-nums ${getProfitLossColor(summary.totalProfit)}`}>
              {summary.totalProfit >= 0 ? "+" : ""}{amountMask(Math.round(summary.totalProfit))}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-sm font-semibold text-muted-foreground">수익률</span>
            <span className={`text-lg font-bold tabular-nums ${getProfitLossColor(summary.totalProfitRate)}`}>
              {summary.totalProfitRate >= 0 ? "+" : ""}{summary.totalProfitRate.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>

      {/* 포트폴리오 구성 바 — 자산군 비중(색상 + %) */}
      {classBar.items.length > 0 && classBar.total > 0 && (
        <div className="rounded-lg bg-muted/20 dark:bg-muted/10 p-3.5 space-y-2.5">
          <p className="text-sm font-bold text-foreground">포트폴리오 구성</p>
          <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
            {classBar.items.map(({ key, label, value, color }) => {
              const pct = (value / classBar.total) * 100;
              return <div key={key} className="transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`} />;
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {classBar.items.map(({ key, label, value, color }) => {
              const pct = (value / classBar.total) * 100;
              return (
                <div key={key} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전 자산 통합 랭킹 — 1줄 압축(색점·종목명·비중%·금액) */}
      {coreTop.length > 0 && (
        <div className="rounded-lg bg-muted/20 dark:bg-muted/10 p-3.5 space-y-2.5">
          <p className="text-sm font-bold text-foreground">핵심 자산 Top {coreTop.length}</p>
          <div className="space-y-2">
            {coreTop.map((it, idx) => {
              const pct = summary.totalValue > 0 ? (it.value / summary.totalValue) * 100 : 0;
              return (
                <div key={`${it.kind}-${it.name}-${idx}`} className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
                  <p className={`flex-1 min-w-0 truncate text-sm ${idx === 0 ? "font-bold text-foreground" : "text-foreground"}`}>{it.name}</p>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: it.color }}>{pct.toFixed(1)}%</span>
                  <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{amountMask(Math.round(it.value))}</span>
                </div>
              );
            })}
          </div>
          {coreRestCount > 0 && (
            <p className="text-sm text-muted-foreground text-right">외 {coreRestCount}개 자산</p>
          )}
        </div>
      )}

      {/* 푸터 — 브랜드명 + 도메인 + 날짜 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-foreground font-semibold">{APP_CONFIG.name}</span>
          <span className="text-sm text-muted-foreground">{siteHost}</span>
        </div>
        <span className="text-sm text-muted-foreground">{now}</span>
      </div>
    </div>
  );
}
