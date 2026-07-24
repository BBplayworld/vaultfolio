"use client";

import React, { useMemo } from "react";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { computeStockMetrics, mergeStockGroup, assignColors, getMultiplier, groupStocksByTicker } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { useAssetTreemapData } from "@/app/(main)/_components/views/home/dashboard";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { APP_CONFIG } from "@/config/app";

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

  // 핵심 자산 — 전 자산군(주식·코인·부동산·현금) 개별 보유를 KRW 평가액 기준 상위 랭킹.
  // 매입가 있는 주식·코인·부동산은 수익률(rate) 병기, 현금(원금=현재가)만 평가액.
  const coreHoldings = useMemo(() => {
    const items: { name: string; kind: string; value: number; rate?: number; quantity?: number }[] = [];
    // 주식은 증권사별로 나뉜 동일 종목을 항목(티커)별로 통합
    const activeStocks = assetData.stocks.filter((s) => s.inactiveStatus !== "delisted");
    for (const grp of groupStocksByTicker(activeStocks).values()) {
      const s = mergeStockGroup(grp);
      const m = computeStockMetrics(s, rates, 1); // 비중 분모 무관 — profitRate만 사용(환차익 포함 정확값)
      items.push({ name: s.name, kind: "주식", value: s.quantity * s.currentPrice * getMultiplier(s.currency, rates), rate: m.profitRate, quantity: s.quantity });
    }
    for (const c of assetData.crypto) {
      const rate = c.averagePrice > 0 ? ((c.currentPrice - c.averagePrice) / c.averagePrice) * 100 : undefined;
      items.push({ name: c.name, kind: "코인", value: c.quantity * c.currentPrice, rate });
    }
    for (const r of assetData.realEstate) {
      // 매입가가 있을 때만 수익률 — 미입력(0)이면 나눗셈 불가라 생략(코인 averagePrice 가드와 동일).
      // 공식은 상세 부동산 탭과 동일: (현재시세 − 매입가) / 매입가
      const rate = r.purchasePrice > 0 ? ((r.currentValue - r.purchasePrice) / r.purchasePrice) * 100 : undefined;
      items.push({ name: r.name, kind: "부동산", value: r.currentValue, rate });
    }
    for (const c of assetData.cash ?? []) {
      items.push({ name: c.name, kind: "현금", value: c.balance * getMultiplier(c.currency, rates) });
    }
    const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
    const colors = assignColors(sorted.map((i) => ({ value: i.value })));
    return sorted.map((it, idx) => ({ ...it, color: colors[idx] }));
  }, [assetData, rates]);
  const coreTop = coreHoldings.slice(0, CORE_MAX);
  const coreRestCount = coreHoldings.length - coreTop.length;

  // 포트폴리오 구성 — 자산군 단위 비중(금액 없이 색상 바 + 비중%). 바이럴 요소이자 자산규모 비노출.
  const classBar = useMemo(() => {
    const base = [
      { key: "stock", label: "주식", value: summary.stockValue },
      { key: "realEstate", label: "부동산", value: summary.realEstateValue },
      { key: "crypto", label: "코인", value: summary.cryptoValue },
      { key: "cash", label: "현금", value: summary.cashValue },
    ].filter((d) => d.value > 0);
    const colors = assignColors(base);
    const total = base.reduce((s, d) => s + d.value, 0);
    return { items: base.map((d, i) => ({ ...d, color: colors[i] })), total };
  }, [summary]);

  // 금액류만 마스킹 — 비중%·수익률%는 항상 노출
  const amountMask = hideAmounts ? (_: number) => "••••" : formatShortCurrency;
  const netMask = hideAmounts ? (_: number) => "••••" : formatPriceByMode;

  const now = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  return (
    <div ref={cardRef} className="space-y-4 p-3 rounded-2xl bg-background dark:bg-card">

      {/* 브랜딩 헤더 */}
      <div className="flex items-center px-1 pt-0.5">
        <span className="text-base font-bold tracking-tight text-foreground">{APP_CONFIG.name}</span>
      </div>

      {/* 대표 지표 — 순자산 전폭 hero(1순위) + 수익률·수익금 한 줄(2순위) */}
      <div className="rounded-lg bg-muted/20 dark:bg-muted/10 p-3.5 space-y-2">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">순자산</p>
          <p className={`text-2xl sm:text-3xl font-bold tabular-nums leading-tight break-keep ${ASSET_THEME.important}`}>{netMask(summary.netAsset)}</p>
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
                  <span className="text-sm font-bold text-primary tabular-nums">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전 자산 통합 랭킹 — 좌(이름·종류·수량) / 우(금액·비중%·수익률%) 2줄 구조 */}
      {coreTop.length > 0 && (
        <div className="rounded-lg bg-muted/20 dark:bg-muted/10 p-3.5 space-y-2.5">
          <p className="text-sm font-bold text-foreground">핵심 자산 Top {coreTop.length}</p>
          <div className="space-y-2.5">
            {coreTop.map((it, idx) => {
              const pct = summary.totalValue > 0 ? (it.value / summary.totalValue) * 100 : 0;
              return (
                <div key={`${it.kind}-${it.name}-${idx}`} className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${idx === 0 ? "font-bold text-foreground" : "text-foreground"}`}>{it.name}</p>
                    {/* 보유 비중은 이름 바로 아래(좌측)로 — 우측은 금액·수익률만 남겨 시선 이동을 줄인다 */}
                    <p className="text-sm text-muted-foreground truncate">
                      {it.kind}{it.quantity !== undefined ? ` · ${it.quantity.toLocaleString()}주` : ""}
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-semibold tabular-nums" style={{ color: it.color }}>{pct.toFixed(1)}%</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-foreground">{amountMask(Math.round(it.value))}</p>
                    {it.rate !== undefined && (
                      <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(it.rate)}`}>
                        {it.rate >= 0 ? "+" : ""}{it.rate.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {coreRestCount > 0 && (
            <p className="text-sm text-muted-foreground text-right">외 {coreRestCount}개 자산</p>
          )}
        </div>
      )}

      {/* 푸터 */}
      <div className="flex items-center justify-end pt-1">
        <span className="text-sm text-muted-foreground">{now}</span>
      </div>
    </div>
  );
}
