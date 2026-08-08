"use client";

import React from "react";
import { Pencil, Trash2, Calendar, Clock, CreditCard, ChevronDown, Scissors, Globe, ArrowLeftRight, History } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatHoldingPeriod, formatShortCurrency } from "@/lib/number-utils";
import { DataSourceBadge } from "../../data-source-badge";
import { ASSET_THEME, ASSET_THEME_SHOT, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { stockCategories, securitiesFirms } from "@/config/asset-options";
import { normalizeTicker } from "@/lib/finance-service";
import { DetailSummaryHeader, ProfitMetric } from "../detail-summary-header";
import { AnnualizedReturn } from "../annualized-return";
import { StockInsightStrip } from "../xray/stock-insight-strip";
import { Stock, Loan } from "@/types/asset";
import { assignColors, getMultiplier, formatCurrencyDisplay, getPurchaseRatePerUnit, computeStockMetrics, groupStocksByTickerCategory, groupStocksByTicker, mergeStockGroup, formatByDisplayCurrency, StockDisplayCurrency } from "../asset-detail-tabs";
import { fetchProfitRef, computeDailyStockProfit } from "@/lib/profit-utils";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import { DOMESTIC_STOCK_DOMAIN_MAP } from "@/app/api/parse-screenshot/ticker-map";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { dispatchAddTrade } from "../../../layout/navigation/asset-dispatch";
import { useAssetNavigation } from "../../../layout/navigation/navigation-context";
import { useTradeViewStore } from "@/stores/trade-view-store";


const ETF_DOMAIN: Record<string, string> = {
  TIGER: "www.tigeretf.com",
  KODEX: "www.samsungfund.com",
  ACE: "www.aceetf.co.kr",
  KINDEX: "www.aceetf.co.kr",
  HANARO: "www.hanaroetf.com",
  SOL: "www.shinhansec.com",
  RISE: "www.kbam.co.kr",
  KBSTAR: "www.kbam.co.kr",
  ARIRANG: "www.hanwhafund.co.kr",
  BIG: "www.hanwhafund.co.kr",
  PLUS: "www.hanwhafund.co.kr",
  KOSEF: "www.wooriasset.co.kr",
  TIMEFOLIO: "www.timefolio.co.kr",
};

function getEtfDomain(name: string): string | null {
  const upper = name.toUpperCase();
  for (const [brand, domain] of Object.entries(ETF_DOMAIN)) {
    if (upper.startsWith(brand + " ") || upper === brand) return domain;
  }
  return null;
}

export const CATEGORY_TABS = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "해외" },
  { value: "irp", label: "IRP" },
  { value: "isa", label: "ISA" },
  { value: "pension", label: "연금" },
  { value: "unlisted", label: "비상장" },
] as const;

function StockIcon({ ticker, name, isForeign, color, screenshotMode = false }: { ticker: string; name: string; isForeign: boolean; color: string; screenshotMode?: boolean }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (ticker || name).replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase() || "";

  const foreignLogoSrc = isForeign && ticker && /^[A-Z]+$/.test(ticker) ? `/api/logo?ticker=${ticker}` : null;
  const etfDomain = !isForeign ? getEtfDomain(name) : null;
  const stockDomain = !isForeign && !etfDomain ? (DOMESTIC_STOCK_DOMAIN_MAP[ticker] ?? null) : null;

  const logoSrc = foreignLogoSrc
    ?? (etfDomain ? `/api/logo?domain=${encodeURIComponent(etfDomain)}` : null)
    ?? (stockDomain ? `/api/logo?domain=${encodeURIComponent(stockDomain)}` : null);

  const showLogo = !!logoSrc && !imgError;
  const showInitial = !logoSrc;

  // 인증카드(캡처 DOM)는 뷰포트 반응형 금지 — SHOT 토큰으로 데스크톱 값 고정(R25)
  const sizeCls = screenshotMode ? ASSET_THEME_SHOT.icon : "size-6 sm:size-7";
  const initialCls = screenshotMode ? ASSET_THEME_SHOT.iconInitial : "text-[9px] sm:text-[10px]";

  return (
    <div className={`${sizeCls} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`} style={{ backgroundColor: color }}>
      {showLogo ? (
        <img src={logoSrc} alt={name} className={`${sizeCls} rounded-full object-cover`} onError={() => setImgError(true)} />
      ) : showInitial ? (
        <span className={`${initialCls} font-bold text-white`}>{initial}</span>
      ) : null}
    </div>
  );
}

// 인증카드에서 재사용하는 공유 타입
export interface StockRowData {
  stock: Stock;
  color: string;
  pct: number;
  currentVal: number;
  profit: number;
  profitRate: number;
}

// 주식 비중 바 + 범례
export function StockBarChart({ items, total }: {
  items: { stock: Stock; value: number; color: string }[];
  total: number;
}) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ stock, value: v, color }) => {
          const pct = (v / total) * 100;
          return (
            <div key={stock.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${stock.name}: ${pct.toFixed(1)}%`}>
              {/* 바 내부 % 텍스트 제거 — 밝은 배경 위 흰글씨 저대비 방지. %는 아래 범례에서 크게 표기 */}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-2">
        {items.map(({ stock, value: v, color }) => {
          const pct = (v / total) * 100;
          return (
            <div key={stock.id} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm text-foreground truncate">{stock.name}</span>
              <span className="text-sm sm:text-base font-bold text-muted-foreground shrink-0">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

// 환차손익 Hint — Globe 아이콘 + hover/터치 팝오버 (가이드 §3 패턴)
function CurrencyGainHint({ value, formatter }: { value: number; formatter: (v: number) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="환차손익 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        >
          <Globe className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" sideOffset={4} className="w-auto p-2.5 text-sm tabular-nums">
        <p>
          <span className="text-muted-foreground">환차손익 </span>
          <span className={getProfitLossColor(value)}>{value >= 0 ? "+" : ""}{formatter(value)}</span>
          <span className="text-muted-foreground"> 포함</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}


/**
 * 선택된 카테고리의 주식 데이터 계산 훅.
 * ShareCard, StockTab 등에서 공통 사용.
 */
export function useFilteredStockData(activeCategory: string, displayCurrency: StockDisplayCurrency = "KRW") {
  const { assetData, exchangeRates, getAssetSummary, dataResetVersion } = useAssetData();
  const summary = getAssetSummary();
  const queryClient = useQueryClient();

  const mul = (currency?: string) => getMultiplier(currency, exchangeRates);

  const stocksWithTicker = assetData.stocks.filter(
    (s) => s.ticker && s.category !== "unlisted" && s.currentPrice > 0 && s.inactiveStatus !== "delisted",
  );
  // 중복 제거 + 알파벳 정렬 → 다른 컴포넌트(profit-chart 등)와 동일한 캐시 키 보장
  const tickerList = Array.from(new Set(stocksWithTicker.map((s) => normalizeTicker(s)).filter(Boolean))).sort().join(",");

  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  const { data: refData } = useQuery({
    queryKey: ["profit", "daily", profitBasis, tickerList],
    queryFn: ({ signal }) => fetchProfitRef(tickerList, "daily", { signal, caller: "stock-tab:useQuery", basis: profitBasis }),
    staleTime: 5 * 60 * 1000,
    enabled: tickerList.length > 0 && profitBasisHydrated,
  });

  // 데이터 삭제/불러오기 시 진행 중인 profit 쿼리 전부 강제 취소
  const prevResetVersionRef = useRef(dataResetVersion);
  useEffect(() => {
    if (prevResetVersionRef.current === dataResetVersion) return;
    prevResetVersionRef.current = dataResetVersion;
    queryClient.cancelQueries({ queryKey: ["profit"] });
  }, [dataResetVersion, queryClient]);

  const marketMap = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
    } catch { return {}; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerList]);

  const filteredStocks = useMemo(() => {
    const base =
      activeCategory === "all"
        ? assetData.stocks
        : assetData.stocks.filter((s) => s.category === activeCategory);
    return [...base].sort(
      (a, b) =>
        b.quantity * b.currentPrice * mul(b.currency) -
        a.quantity * a.currentPrice * mul(a.currency),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetData.stocks, activeCategory, exchangeRates]);

  // 상장폐지(delisted) 종목은 평가·매입원가 합계에서 제외(asset-data-context.tsx getAssetSummary와 동일 정책) — 리스트 표시는 filteredStocks 그대로 유지
  const activeStocks = filteredStocks.filter((st) => st.inactiveStatus !== "delisted");
  const totalValue = activeStocks.reduce(
    (s, st) => s + st.quantity * st.currentPrice * mul(st.currency),
    0,
  );
  const totalCost = activeStocks.reduce((s, st) => {
    const isForeign = st.category === "foreign" && st.currency !== "KRW";
    // USD 모드: 매입환율 대신 항상 현재환율로 원가 계산 → 환차익 소거
    const rate = displayCurrency === "USD" ? mul(st.currency) : (isForeign ? getPurchaseRatePerUnit(st, mul(st.currency)) : mul(st.currency));
    return s + st.quantity * st.averagePrice * rate;
  }, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const groupByTickerOnly = activeCategory === "all";
  const groupKeyOf = (s: Stock) =>
    groupByTickerOnly
      ? (s.ticker ? `t:${s.ticker}` : s.id)
      : (s.ticker ? `${s.ticker}:${s.category}` : s.id);

  const groupedStocks = useMemo(
    () => groupByTickerOnly ? groupStocksByTicker(filteredStocks) : groupStocksByTickerCategory(filteredStocks),
    [filteredStocks, groupByTickerOnly],
  );

  // 그룹 대표(병합) 목록 — KRW 환산 금액 기준 재정렬
  const mergedStocks = useMemo(() => {
    const seen = new Set<string>();
    const reps: Stock[] = [];
    for (const s of filteredStocks) {
      const key = groupKeyOf(s);
      if (seen.has(key)) continue;
      seen.add(key);
      reps.push(mergeStockGroup(groupedStocks.get(key) ?? [s]));
    }
    return reps.sort(
      (a, b) =>
        b.quantity * b.currentPrice * mul(b.currency) -
        a.quantity * a.currentPrice * mul(a.currency),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStocks, groupedStocks, exchangeRates]);

  const barValues = mergedStocks.map((st) => ({ value: st.quantity * st.currentPrice * mul(st.currency) }));
  const barColors = assignColors(barValues);
  const barItems = mergedStocks.map((st, idx) => ({
    stock: st,
    value: barValues[idx].value,
    color: barColors[idx],
  }));

  // 일별 수익 계산 — 선택된 카테고리(filteredStocks)만 합산
  // profit-chart는 항상 전체 기준이므로 카테고리별 값과 다를 수 있음
  const { dailyProfit, dailyProfitRate } = useMemo(
    () => computeDailyStockProfit(filteredStocks, refData, exchangeRates),
    [refData, filteredStocks, exchangeRates],
  );

  return { filteredStocks, groupedStocks, groupKeyOf, mergedStocks, totalValue, totalCost, totalProfit, totalProfitRate, barItems, barColors, summary, mul, exchangeRates, dailyProfit, dailyProfitRate, refData, marketMap };
}

// 오늘 등락 칩 — 누적 손익과 구분되게 뮤트 배경 칩에 담고, 방향(▲빨강/▼파랑)만 값에 색.
function TodayChangeChip({ rate, className = "" }: { rate: number; className?: string }) {
  return (
    <span className={`${ASSET_THEME.todayBox} ${className}`}>
      <span className="text-muted-foreground">오늘</span>
      <span className={getProfitLossColor(rate)}>{rate >= 0 ? "▲" : "▼"}{Math.abs(rate).toFixed(1)}%</span>
    </span>
  );
}

// 아이콘 + 이름/수량/비중 + 금액/손익 공통 헤더
export function StockRowHeader({ stock, color, pct, currentVal, profit, profitRate, categoryLabels, maskFn, screenshotMode = false, displayCurrency = "KRW", usdRate = 1, dailyRate }: StockRowData & {
  categoryLabels?: string[];
  maskFn?: (v: number) => string;
  screenshotMode?: boolean;
  displayCurrency?: StockDisplayCurrency;
  usdRate?: number;
  dailyRate?: number | null;
}) {
  const fmt = maskFn ?? ((v: number) => formatByDisplayCurrency(v, displayCurrency, usdRate));
  const hideAmounts = !!maskFn && maskFn(123456).includes("•");
  const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
  // 인증카드(캡처 DOM)는 뷰포트 반응형 금지 — SHOT 토큰으로 데스크톱 값 고정(R25)
  const nameCls = screenshotMode ? ASSET_THEME_SHOT.cardInfoName : ASSET_THEME.cardInfoName;
  const amountCls = screenshotMode ? ASSET_THEME_SHOT.cardAmountMain : ASSET_THEME.cardAmountMain;
  const badgeCls = screenshotMode ? ASSET_THEME_SHOT.badge : "text-[10px] sm:text-[11px] px-1 py-0 sm:ml-1 leading-tight";
  return (
    <>
      <StockIcon ticker={normalizeTicker(stock)} name={stock.name} isForeign={isForeign} color={color} screenshotMode={screenshotMode} />
      <div className={`${ASSET_THEME.cardInfoLeft} min-w-0`}>
        <div className={ASSET_THEME.cardInfoTitle}>
          {/* 이름은 모바일·PC 공통 전체 노출하되 최대 2줄, 2줄 초과분만 말줄임(하드컷 제거) */}
          <span className={`${nameCls} line-clamp-2`} title={stock.name.length > 18 ? stock.name : undefined}>
            {stock.name}
          </span>
          {stock.inactiveStatus === "halted" && (
            <Badge variant="outline" className={`text-amber-600 border-amber-600 ${badgeCls}`}>거래정지</Badge>
          )}
          {stock.inactiveStatus === "delisted" && (
            <Badge variant="outline" className={`text-red-600 border-red-600 ${badgeCls}`}>상장폐지</Badge>
          )}
        </div>
        <div className={`${ASSET_THEME.cardInfoMeta} flex-wrap`}>
          <span className="text-sm text-foreground tabular-nums">{stock.quantity.toLocaleString()}주</span>
          {/* 인증카드는 비중 정보를 상단 범례로 통합 — 리스트 행에서는 % 미노출 */}
          {!screenshotMode && (
            <>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm font-semibold text-primary">{pct.toFixed(1)}%</span>
            </>
          )}
          {/* 종목별 오늘 등락 — 우측이 3줄로 늘어지지 않게 좌측 메타 줄에 배치. 장중 미확정/기준가 없으면 미표시 */}
          {!screenshotMode && dailyRate !== null && dailyRate !== undefined && (
            <TodayChangeChip rate={dailyRate} className="text-[11px]" />
          )}
        </div>
      </div>
      <div className={ASSET_THEME.cardInfoRight}>
        <p className={`${amountCls} ${ASSET_THEME.text.default}`}>{fmt(currentVal)}</p>
        <div className={ASSET_THEME.cardAmountProfitRow}>
          <span className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>
            {!hideAmounts && (profit >= 0 ? "+" : "")}{fmt(Math.round(profit))}
          </span>
          <span className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</span>
        </div>
      </div>
    </>
  );
}

// 종목 단일 로우 (인증카드용 — 편집/삭제 버튼 없음)
export function StockRowItem({ stock, color, pct, currentVal, profit, profitRate, maskFn, screenshotMode = false }: StockRowData & { maskFn?: (v: number) => string; screenshotMode?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${ASSET_THEME.primary.bgLight} px-2 rounded-md w-full min-w-0`}>
      <StockRowHeader stock={stock} color={color} pct={pct} currentVal={currentVal} profit={profit} profitRate={profitRate} maskFn={maskFn} screenshotMode={screenshotMode} />
    </div>
  );
}

// 주식 요약 헤더
export function StockSummaryHeader({ totalValue, totalProfit, totalProfitRate, currencyGain, maskFn, screenshotMode = false, displayCurrency, onDisplayCurrencyChange, usdRate = 1, disableUsd = false, dailyRate }: {
  totalValue: number;
  totalProfit: number;
  totalProfitRate: number;
  currencyGain?: number;
  maskFn?: (v: number) => string;
  screenshotMode?: boolean;
  displayCurrency?: StockDisplayCurrency;
  onDisplayCurrencyChange?: (v: StockDisplayCurrency) => void;
  usdRate?: number;
  disableUsd?: boolean;
  dailyRate?: number | null;
}) {
  const currency = displayCurrency ?? "KRW";
  const fmtFull = maskFn ?? ((v: number) => formatByDisplayCurrency(v, currency, usdRate, "full"));
  const fmt = maskFn ?? ((v: number) => formatByDisplayCurrency(v, currency, usdRate));
  const hideAmounts = !!maskFn && maskFn(123456).includes("•");
  return (
    <DetailSummaryHeader
      label="총 주식 평가금액"
      value={totalValue}
      valueClass={ASSET_THEME.text.default}
      formatFull={fmtFull}
      formatShort={fmt}
      screenshotMode={screenshotMode}
      headerAction={!screenshotMode ? (
        <div className="min-h-7 flex items-center">
          {onDisplayCurrencyChange && (
            <InlineSelector
              size="sm"
              value={currency}
              onChange={onDisplayCurrencyChange}
              options={[{ value: "KRW", label: "원화" }, { value: "USD", label: "달러" }] as const}
              disabledValues={disableUsd ? (["USD"] as const) : undefined}
              disabledTitle="해외주식 보유 시 이용 가능"
              ariaLabel="주식 표시 화폐 선택"
            />
          )}
        </div>
      ) : undefined}
      inline={
        <span className="inline-flex items-baseline gap-x-2 flex-wrap">
          <ProfitMetric
            label="평가손익"
            profit={totalProfit}
            rate={totalProfitRate}
            formatShort={fmt}
            hideAmountSign={hideAmounts}
            screenshotMode={screenshotMode}
            prefix={!screenshotMode && currencyGain !== undefined && currencyGain !== 0
              ? <CurrencyGainHint value={Math.round(currencyGain)} formatter={fmt} />
              : undefined}
          />
          {!screenshotMode && dailyRate !== null && dailyRate !== undefined && (
            <TodayChangeChip rate={dailyRate} className="text-xs" />
          )}
        </span>
      }
    />
  );
}

interface StockCardProps {
  stock: Stock;
  color: string;
  pct: number;
  currentVal: number;
  profit: number;
  profitRate: number;
  isForeign: boolean;
  krwMul: number;
  currencyGain: number;
  currencyGainRate: number;
  linkedLoans: Loan[];
  onDelete: (id: string) => void;
  onDeleteGroup?: (ids: string[]) => void;
  categoryLabels: string[];
  defaultOpen?: boolean;
  onFirstInteract?: () => void;
  isFirstVisit?: boolean;
  subItems?: Stock[];
  exchangeRates?: { USD: number; JPY: number };
  totalValue?: number;
  groupItems?: Stock[];
  marketMap?: Record<string, string>;
  screenshotMode?: boolean;
  maskFn?: (v: number) => string;
  displayCurrency?: StockDisplayCurrency;
  dailyRate?: number | null;
}

interface SplitItem {
  quantity: string;
  averagePrice: string;
  broker: string;
  avgPriceInKrw: boolean;
}

function SplitStockDialog({ stock, groupItems, open, onClose }: { stock: Stock; groupItems: Stock[]; open: boolean; onClose: () => void }) {
  const { saveData, assetData, exchangeRates } = useAssetData();
  const isForeign = stock.category === "foreign";
  const maxQty = stock.quantity;
  const groupIds = new Set(groupItems.map((s) => s.id));

  const makeInitialItems = (): SplitItem[] => {
    // 이미 증권사 정보가 있으면(분할됐거나 단일 증권사 지정) 기존 항목 로드
    if (groupItems.length > 1 || groupItems[0]?.broker) {
      return groupItems.map((s) => ({
        quantity: String(s.quantity),
        averagePrice: String(s.averagePrice),
        broker: s.broker || "__none__",
        avgPriceInKrw: false,
      }));
    }
    return [
      { quantity: "", averagePrice: String(stock.averagePrice), broker: stock.broker || "__none__", avgPriceInKrw: false },
      { quantity: "", averagePrice: String(stock.averagePrice), broker: "__none__", avgPriceInKrw: false },
    ];
  };

  const [items, setItems] = useState<SplitItem[]>(makeInitialItems);

  const totalEntered = items.reduce((s, it) => {
    const v = parseFloat(it.quantity);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const remaining = Math.round((maxQty - totalEntered) * 1e6) / 1e6;
  // 증권사 유니크 검증 — 미지정(__none__) 제외
  const selectedBrokers = items.map((it) => it.broker).filter((b) => b !== "__none__");
  const hasDupBroker = new Set(selectedBrokers).size !== selectedBrokers.length;
  const isValid = items.every((it) => {
    const v = parseFloat(it.quantity);
    return !isNaN(v) && v > 0;
  }) && Math.abs(remaining) < 1e-9 && !hasDupBroker;

  const updateItem = (idx: number, field: keyof SplitItem, val: string | boolean) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const addRow = () => setItems((prev) => [...prev, { quantity: "", averagePrice: String(stock.averagePrice), broker: "__none__", avgPriceInKrw: false }]);
  const removeRow = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSplit = () => {
    if (!isValid) return;
    const baseStock = groupItems[0];
    const usdRate = exchangeRates.USD;
    const newItems: Stock[] = items.map((it, idx) => {
      let avg = it.averagePrice ? parseFloat(it.averagePrice) : baseStock.averagePrice;
      if (isForeign && it.avgPriceInKrw && usdRate) {
        avg = Math.round(avg / usdRate * 10000) / 10000;
      }
      // 매입환율은 기존 항목 값을 보존(증권사별 환율 덮어쓰기 방지). 새로 추가된 행만 첫 항목 값을 기본 상속
      const existing = groupItems[idx];
      return {
        ...baseStock,
        id: existing?.id ?? `stock_${Date.now()}_${idx}`,
        quantity: parseFloat(it.quantity),
        averagePrice: avg,
        broker: it.broker === "__none__" ? undefined : it.broker,
        purchaseExchangeRate: existing ? existing.purchaseExchangeRate : baseStock.purchaseExchangeRate,
      };
    });
    const otherStocks = assetData.stocks.filter((s) => !groupIds.has(s.id));
    saveData({ ...assetData, stocks: [...otherStocks, ...newItems] });
    toast.success(`${items.length}개 항목으로 나뉘었습니다.`);
    onClose();
  };

  const getAvgPlaceholder = (item: SplitItem) => isForeign && !item.avgPriceInKrw ? `$${stock.averagePrice}` : `₩${(isForeign ? Math.round(stock.averagePrice * exchangeRates.USD) : stock.averagePrice).toLocaleString()}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{stock.name} 나누기</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <p className="text-sm text-muted-foreground">총 {maxQty.toLocaleString()}주를 항목별로 나눕니다.</p>
          {items.map((it, idx) => (
            <div key={idx} className="rounded-md border border-border/60 bg-muted/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">항목 {idx + 1}</span>
                {items.length > 2 && (
                  <Button size="icon" variant="ghost" className="size-6 -mr-1" onClick={() => removeRow(idx)}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
              {isForeign && (
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none w-fit">
                  <Checkbox checked={it.avgPriceInKrw} onCheckedChange={(v) => updateItem(idx, "avgPriceInKrw", !!v)} className="size-3.5" />
                  원화로 입력 (저장 시 달러 환산)
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">수량</label>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 text-sm tabular-nums"
                      placeholder="0"
                      value={it.quantity}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const filtered = isForeign ? raw.replace(/[^0-9.]/g, "") : raw.replace(/[^0-9]/g, "");
                        updateItem(idx, "quantity", filtered);
                      }}
                    />
                    <span className="text-sm text-muted-foreground shrink-0">주</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    평단가{isForeign && (it.avgPriceInKrw ? " (KRW)" : " (USD)")}
                  </label>
                  <Input
                    className="h-8 text-sm tabular-nums"
                    placeholder={getAvgPlaceholder(it)}
                    value={it.averagePrice}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const filtered = (isForeign && !it.avgPriceInKrw)
                        ? raw.replace(/[^0-9.]/g, "").replace(/^(\d*\.\d{0,3}).*$/, "$1")
                        : raw.replace(/[^0-9]/g, "");
                      updateItem(idx, "averagePrice", filtered);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">증권사</label>
                <Select value={it.broker} onValueChange={(v) => updateItem(idx, "broker", v)}>
                  <SelectTrigger className="h-8 text-sm w-full"><SelectValue placeholder="선택 안 함" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">선택 안 함</SelectItem>
                    {securitiesFirms.map((g) => g.items.map((f) => (
                      <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                    )))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full h-8 text-sm" onClick={addRow}>+ 항목 추가</Button>
          <p className={`text-sm tabular-nums ${Math.abs(remaining) < 1e-9 ? "text-muted-foreground" : "text-destructive font-semibold"}`}>
            남은 수량: {remaining.toLocaleString()}주
          </p>
          {hasDupBroker && (
            <p className="text-sm text-destructive font-semibold">동일 증권사를 중복 선택할 수 없습니다.</p>
          )}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" disabled={!isValid} onClick={handleSplit} style={{ backgroundColor: MAIN_PALETTE[0] }} className="text-white hover:opacity-90 border-none">나누기</Button>
          <Button variant="secondary" size="sm" onClick={onClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockDetailGrid({ stock, isForeign, krwMul, currencyGain, currencyGainRate, displayCurrency = "KRW", usdRate = 1 }: {
  stock: Stock; isForeign: boolean; krwMul: number; currencyGain: number; currencyGainRate: number;
  displayCurrency?: StockDisplayCurrency; usdRate?: number;
}) {
  // 종목 원통화(primary)와 선택 화폐가 다를 때만 환산 보조줄 노출 (중복 정보 방지)
  const showSecondary = displayCurrency !== stock.currency;
  const secondaryText = (rawValue: number) => {
    const krw = rawValue * krwMul;
    return displayCurrency === "USD" ? formatByDisplayCurrency(krw, "USD", usdRate) : `₩${krw.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
  };
  const currencyGainDisplay = displayCurrency === "USD" ? formatByDisplayCurrency(currencyGain, "USD", usdRate) : formatCurrencyDisplay(Math.round(currencyGain));
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 bg-muted/10">
        <div>
          <p className={ASSET_THEME.cardDetailLabel}>평단가</p>
          <p className={ASSET_THEME.cardDetailValue}>{formatCurrencyDisplay(stock.averagePrice, stock.currency)}</p>
          {showSecondary && <p className={ASSET_THEME.cardDetailPriceKRW}>{secondaryText(stock.averagePrice)}</p>}
        </div>
        <div>
          <p className={ASSET_THEME.cardDetailLabel}>총 매입금액</p>
          <p className={ASSET_THEME.cardDetailValue}>{formatCurrencyDisplay(stock.averagePrice * stock.quantity, stock.currency)}</p>
          {showSecondary && <p className={ASSET_THEME.cardDetailPriceKRW}>{secondaryText(stock.averagePrice * stock.quantity)}</p>}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className={ASSET_THEME.cardDetailLabel}>현재가</p>
            <DataSourceBadge kind="realtime" />
          </div>
          <p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrencyDisplay(stock.currentPrice, stock.currency)}</p>
          {showSecondary && <p className={ASSET_THEME.cardDetailPriceKRW} style={{ color: "var(--accent-teal)" }}>{secondaryText(stock.currentPrice)}</p>}
        </div>
        <div>
          <p className={ASSET_THEME.cardDetailLabel}>총 평가금액</p>
          <p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrencyDisplay(stock.currentPrice * stock.quantity, stock.currency)}</p>
          {showSecondary && <p className={ASSET_THEME.cardDetailPriceKRW} style={{ color: "var(--accent-teal)" }}>{secondaryText(stock.currentPrice * stock.quantity)}</p>}
        </div>
      </div>
      {isForeign && displayCurrency !== "USD" && (
        <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/5">
          <div>
            <p className={ASSET_THEME.cardDetailLabel}>환차손익</p>
            <p className={`${ASSET_THEME.cardDetailValueBold} ${getProfitLossColor(currencyGain)}`}>
              {currencyGainDisplay}
              <span className="block text-sm font-semibold">({currencyGainRate >= 0 ? "+" : ""}{currencyGainRate.toFixed(2)}%)</span>
            </p>
          </div>
          <div>
            <p className={ASSET_THEME.cardDetailLabel}>매입환율</p>
            <p className={`${ASSET_THEME.cardDetailValue} tabular-nums`}>
              {stock.purchaseExchangeRate && stock.purchaseExchangeRate > 0
                ? stock.currency === "JPY" ? `¥100=₩${stock.purchaseExchangeRate.toLocaleString()}` : `$1=₩${stock.purchaseExchangeRate.toLocaleString()}`
                : "미입력 (현재환율)"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// 거래입력·거래내역 — 라벨형 버튼으로 구분(아이콘만 쓰던 기존 혼선 해소)
function TradeActionRow({ stockId, onViewTrades }: { stockId: string; onViewTrades: (id: string) => void }) {
  return (
    <div className="px-3 py-2 flex items-center gap-2 bg-muted/5">
      <Button variant="secondary" size="sm" className="h-8 flex-1 text-sm gap-1" onClick={() => dispatchAddTrade(stockId)}>
        <ArrowLeftRight className="size-3.5" /> 거래입력
      </Button>
      <Button variant="secondary" size="sm" className="h-8 flex-1 text-sm gap-1" onClick={() => onViewTrades(stockId)}>
        <History className="size-3.5" /> 거래내역
      </Button>
    </div>
  );
}

function SubStockCard({ stock, idx, onDelete, exchangeRates, totalValue, onViewTrades, displayCurrency = "KRW" }: {
  stock: Stock; idx: number; onDelete: (id: string) => void;
  exchangeRates: { USD: number; JPY: number }; totalValue: number;
  onViewTrades: (stockId: string) => void;
  displayCurrency?: StockDisplayCurrency;
}) {
  const [open, setOpen] = useState(false);
  const m = computeStockMetrics(stock, exchangeRates, totalValue, displayCurrency);
  const usdRate = exchangeRates.USD;
  const fmt = (v: number) => formatByDisplayCurrency(v, displayCurrency, usdRate);
  const label = stock.broker || `항목 ${idx + 1}`;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={ASSET_THEME.subCard}>
        <div className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 ${ASSET_THEME.subCardHeader}`}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left">
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              <div className={`${ASSET_THEME.cardInfoLeft} min-w-0`}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={`${ASSET_THEME.cardInfoName} truncate`}>{label}</span>
                </div>
                <div className={`${ASSET_THEME.cardInfoMeta} flex-wrap`}>
                  <span className="text-sm text-foreground tabular-nums">{stock.quantity.toLocaleString()}주</span>
                  <span className="text-sm text-muted-foreground">·</span>
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] sm:text-[10px] py-0 leading-tight shrink-0`}>
                    {stockCategories.find((c) => c.value === stock.category)?.shortLabel ?? stock.category}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-end ml-auto mr-2 sm:mr-4 shrink-0">
                <span className="text-sm font-medium text-foreground tabular-nums">{fmt(Math.round(m.currentVal))}</span>
                <span className={`text-sm font-bold tabular-nums ${getProfitLossColor(m.profit)}`}>
                  {m.profit >= 0 ? "+" : ""}{fmt(Math.round(m.profit))} ({m.profitRate >= 0 ? "+" : ""}{m.profitRate.toFixed(1)}%)
                </span>
              </div>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className={ASSET_THEME.cardExpandBox}>
            <StockDetailGrid stock={stock} isForeign={m.isForeign} krwMul={m.krwMul} currencyGain={m.currencyGain} currencyGainRate={m.currencyGainRate} displayCurrency={displayCurrency} usdRate={usdRate} />
            <TradeActionRow stockId={stock.id} onViewTrades={onViewTrades} />
            <div className={ASSET_THEME.cardActions}>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => {
                if (!confirm("정말 삭제하시겠습니까?")) return;
                onDelete(stock.id);
              }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground bg-muted/5">
              <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(stock.purchaseDate)} 보유</span></span>
              <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{stock.purchaseDate} 매수</span></span>
              <AnnualizedReturn totalRatePct={m.profitRate} sinceDate={stock.purchaseDate} />
              {stock.description && <span className="w-full text-primary truncate"># {stock.description}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function StockCard({ stock, color, pct, currentVal, profit, profitRate, isForeign, krwMul, currencyGain, currencyGainRate, linkedLoans, onDelete, onDeleteGroup, categoryLabels, defaultOpen = false, onFirstInteract, isFirstVisit = false, subItems, exchangeRates = { USD: 1, JPY: 1 }, totalValue = 0, groupItems, marketMap, screenshotMode = false, maskFn, displayCurrency = "KRW", dailyRate }: StockCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const usdRate = exchangeRates.USD;
  const [splitOpen, setSplitOpen] = useState(false);
  const hasSubItems = !!subItems && subItems.length > 0;
  const effectiveGroupItems = groupItems ?? [stock];

  const { navigate } = useAssetNavigation();
  const setTradeTarget = useTradeViewStore((s) => s.setTarget);
  const openTrades = (initialStockId: string | null) => {
    setTradeTarget({
      groupStockIds: effectiveGroupItems.map((s) => s.id),
      name: stock.name,
      ticker: stock.ticker || "",
      category: stock.category,
      initialStockId,
    });
    navigate({ type: "detail", tab: "stocks-trades" });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onFirstInteract?.();
  };

  // 인증카드 모드 — 헤더 + 비중 그라데이션 바만 노출 (펼침·상세·버튼 미렌더)
  if (screenshotMode) {
    return (
      <div className={`${ASSET_THEME.cardWrapper} mb-3`}>
        <div className={ASSET_THEME_SHOT.cardHeader}>
          <div className={ASSET_THEME_SHOT.cardTriggerButton}>
            <StockRowHeader
              stock={stock}
              color={color}
              pct={pct}
              currentVal={currentVal}
              profit={profit}
              profitRate={profitRate}
              categoryLabels={categoryLabels}
              maskFn={maskFn}
              screenshotMode
            />
          </div>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={handleOpenChange} className="mb-2">
        <div className={ASSET_THEME.cardWrapper}>
          <div className={ASSET_THEME.cardHeader}>
            <CollapsibleTrigger asChild>
              <button className={ASSET_THEME.cardTriggerButton}>
                <StockRowHeader stock={stock} color={color} pct={pct} currentVal={currentVal} profit={profit} profitRate={profitRate} categoryLabels={categoryLabels} displayCurrency={displayCurrency} usdRate={usdRate} dailyRate={dailyRate} />
                <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          </div>
          <div className="h-0.5 w-full bg-muted">
            <div className={`h-full transition-all${isFirstVisit ? " animate-pulse" : ""}`} style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          {!open && (
            <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />
          )}
          <CollapsibleContent>
            <div className={ASSET_THEME.cardExpandBox}>
              <div className={`flex items-start gap-2 px-4 py-2.5 ${ASSET_THEME.cardSection}`}>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground break-all">{stock.name}</span>
                  {stock.ticker && (
                    <span className="text-sm font-mono font-medium text-muted-foreground">
                      ({stock.ticker}{marketMap?.[normalizeTicker(stock)] ? ` · ${marketMap[normalizeTicker(stock)]}` : ""})
                    </span>
                  )}
                  {categoryLabels?.map((label) => (
                    <Badge key={label} variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] sm:text-[10px] py-0 leading-tight`}>{label}</Badge>
                  ))}
                </div>
                <span className="text-sm text-foreground font-semibold shrink-0 whitespace-nowrap tabular-nums">총 {stock.quantity.toLocaleString()}주</span>
              </div>
              <div>
                <StockDetailGrid stock={stock} isForeign={isForeign} krwMul={krwMul} currencyGain={currencyGain} currencyGainRate={currencyGainRate} displayCurrency={displayCurrency} usdRate={usdRate} />
              </div>
              {/* 비분할 종목: 라벨형 거래입력·거래내역. 분할 종목은 각 증권사 항목에 노출 */}
              {!hasSubItems && <TradeActionRow stockId={stock.id} onViewTrades={openTrades} />}
              <div className={ASSET_THEME.cardActions}>
                <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="증권사별 나누기" onClick={() => setSplitOpen(true)}>
                  <Scissors className="size-3.5" />
                </Button>
                <Button size="icon" variant="secondary" className={`${ASSET_THEME.cardActionButton}${hasSubItems && effectiveGroupItems.length > 1 ? " !opacity-20 cursor-not-allowed" : ""}`} disabled={hasSubItems && effectiveGroupItems.length > 1} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => {
                  if (!confirm("정말 삭제하시겠습니까?")) return;
                  if (effectiveGroupItems.length === 1) {
                    onDelete(effectiveGroupItems[0].id);
                  } else {
                    onDeleteGroup?.(effectiveGroupItems.map((s) => s.id));
                  }
                }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {linkedLoans.length > 0 && (
                <div className={ASSET_THEME.cardLoanSection}>
                  <p className={ASSET_THEME.cardLoanTitle}><CreditCard className="size-3" />주식담보대출</p>
                  {linkedLoans.map((loan) => (
                    <div key={loan.id} className={ASSET_THEME.cardLoanItem}>
                      <span className={ASSET_THEME.cardLoanName}>{loan.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`font-bold tabular-nums ${ASSET_THEME.liability}`}>-{formatByDisplayCurrency(loan.balance, displayCurrency, usdRate, "full")}</span>
                        <span className={ASSET_THEME.cardLoanRate}>{loan.interestRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!hasSubItems && (
                <div className={`px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground ${ASSET_THEME.cardSectionMeta}`}>
                  <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(stock.purchaseDate)} 보유</span></span>
                  <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{stock.purchaseDate} 매수</span></span>
                  <AnnualizedReturn totalRatePct={profitRate} sinceDate={stock.purchaseDate} />
                  {stock.description && <span className="w-full text-primary truncate"># {stock.description}</span>}
                </div>
              )}
              {hasSubItems && (
                <div className={`px-3 py-2.5 space-y-1.5 ${ASSET_THEME.subItemsWell}`}>
                  <p className="text-sm font-semibold text-muted-foreground px-1 pb-0.5">증권사별 항목</p>
                  {subItems!.map((sub, idx) => (
                    <SubStockCard key={sub.id} stock={sub} idx={idx} onDelete={onDelete} exchangeRates={exchangeRates} totalValue={totalValue} onViewTrades={openTrades} displayCurrency={displayCurrency} />
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
      {splitOpen && <SplitStockDialog stock={stock} groupItems={effectiveGroupItems} open={splitOpen} onClose={() => setSplitOpen(false)} />}
    </>
  );
}

// 카테고리 탭 + 비중바 + 종목 목록 — 주식 상세/인증카드 공통 영역
export interface StockCategorySectionProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  filteredStocks: Stock[];
  totalValue: number;
  barItems: { stock: Stock; value: number; color: string }[];
  barColors: string[];
  emptyMessage?: string;
  screenshotMode: boolean;
  renderItem: (stock: Stock, isFirstOverall: boolean, color: string) => React.ReactNode;
  /** 종목 리스트 최대 노출 개수 — 초과분은 "외 N종목" 요약행. 비중바도 같은 개수로 축약(인증카드용) */
  maxItems?: number;
  /** 금액 마스킹 함수(인증카드 "금액 표시" 오프) — "외 N종목" 요약행 금액에 적용 */
  maskFn?: (v: number) => string;
  /** "외 N종목" 손익 합산용 — 미전달 시 요약행은 평가금액만 노출 */
  exchangeRates?: { USD: number; JPY: number };
}

export function StockCategorySection({
  activeCategory,
  onCategoryChange,
  filteredStocks,
  totalValue,
  barItems,
  barColors,
  emptyMessage = "등록된 주식이 없습니다.",
  screenshotMode = false,
  renderItem,
  maxItems,
  maskFn,
  exchangeRates,
}: StockCategorySectionProps) {
  const colorOf = (stock: Stock) => {
    const idx = barItems.findIndex((b) => b.stock.id === stock.id);
    return idx >= 0 ? barColors[idx] : MAIN_PALETTE[0];
  };
  const legendTextCls = screenshotMode ? ASSET_THEME_SHOT.legendText : "text-sm sm:text-base";

  return (
    <div className={`${screenshotMode ? "px-1" : "px-1 sm:px-2"} space-y-3`}>
      {/* 비중 바 — maxItems 지정 시 상위 N개 + "기타" 집계(인증카드 축약).
          범례(색점 + 이름 + 비중%)는 주식 탭·인증카드 공통으로 노출한다.
          인증카드는 캡처 폭 480px 고정이라 반응형 대신 SHOT 토큰 값을 쓴다(R25). */}
      {barItems.length > 0 && totalValue > 0 && (() => {
        const barShown = maxItems ? barItems.slice(0, maxItems) : barItems;
        const barRest = maxItems ? barItems.slice(maxItems) : [];
        const restValue = barRest.reduce((s, b) => s + b.value, 0);
        const restPct = (restValue / totalValue) * 100;
        const ETC_COLOR = "#9ca3af";
        return (
          <div className="space-y-2">
            <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
              {barShown.map(({ stock, value: v, color }) => {
                const pct = (v / totalValue) * 100;
                return (
                  <div key={stock.id} className="overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${stock.name}: ${pct.toFixed(1)}%`} />
                );
              })}
              {barRest.length > 0 && restPct > 0 && (
                <div className="overflow-hidden transition-all" style={{ width: `${restPct}%`, backgroundColor: ETC_COLOR }} title={`그 외: ${restPct.toFixed(1)}%`} />
              )}
            </div>
            <div className={screenshotMode ? ASSET_THEME_SHOT.legendGrid : "grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-2"}>
              {barShown.map(({ stock, value: v, color }) => {
                const pct = (v / totalValue) * 100;
                return (
                  <div key={stock.id} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className={`${legendTextCls} text-foreground truncate`}>{stock.name}</span>
                    <span className={`${legendTextCls} font-bold shrink-0`} style={{ color: color }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
              {barRest.length > 0 && restPct > 0 && (
                <div className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ETC_COLOR }} />
                  <span className={`${legendTextCls} text-muted-foreground truncate`}>그 외 {barRest.length}종목</span>
                  <span className={`${legendTextCls} font-bold shrink-0 text-muted-foreground`}>{restPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 종목 리스트 — 주식 상세/인증카드 공통 */}
      {filteredStocks.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      ) : (() => {
        const shown = maxItems ? filteredStocks.slice(0, maxItems) : filteredStocks;
        const rest = maxItems ? filteredStocks.slice(maxItems) : [];
        const restValue = rest.reduce((sum, s) => sum + (barItems.find((b) => b.stock.id === s.id)?.value ?? 0), 0);
        // 종합 수익률 = (Σ평가 − Σ원가) / Σ원가 — 개별 수익률 평균이 아님(useFilteredStockData와 동일 공식).
        // 상장폐지 종목은 총계 기준과 맞추기 위해 합산에서 제외한다.
        const restActive = exchangeRates ? rest.filter((s) => s.inactiveStatus !== "delisted") : [];
        const restCost = restActive.reduce((sum, s) => sum + computeStockMetrics(s, exchangeRates!).cost, 0);
        const restCurrentVal = restActive.reduce((sum, s) => sum + computeStockMetrics(s, exchangeRates!).currentVal, 0);
        const restProfit = restCurrentVal - restCost;
        const restProfitRate = restCost > 0 ? (restProfit / restCost) * 100 : 0;
        const fmt = maskFn ?? formatShortCurrency;
        const hideAmounts = !!maskFn && maskFn(123456).includes("•");
        const restAmountCls = screenshotMode ? ASSET_THEME_SHOT.cardAmountMain : ASSET_THEME.cardAmountMain;
        return (
          <div className={`space-y-2 ${screenshotMode ? "mt-7" : "mt-8"}`}>
            {shown.map((s, i) => renderItem(s, i === 0, colorOf(s)))}
            {/* "외 N종목" 요약 — 별도 박스를 두지 않고 위 종목 카드와 같은 래퍼·아이콘 자리(spacer)를 써서 좌우·상하 정렬을 맞춘다 */}
            {rest.length > 0 && (
              <div className={ASSET_THEME.cardWrapper}>
                <div className={screenshotMode ? ASSET_THEME_SHOT.cardHeader : ASSET_THEME.cardHeader}>
                  <div className={screenshotMode ? ASSET_THEME_SHOT.cardTriggerButton : ASSET_THEME.cardTriggerButton}>
                    <span className={`${screenshotMode ? ASSET_THEME_SHOT.icon : "size-6 sm:size-7"} shrink-0`} aria-hidden />
                    <div className={`${ASSET_THEME.cardInfoLeft} min-w-0`}>
                      <span className="text-sm text-muted-foreground">그 외 {rest.length}종목</span>
                    </div>
                    <div className={ASSET_THEME.cardInfoRight}>
                      <p className={`${restAmountCls} ${ASSET_THEME.text.default}`}>{fmt(restValue)}</p>
                      {exchangeRates && restCost > 0 && (
                        <div className={ASSET_THEME.cardAmountProfitRow}>
                          <span className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(restProfit)}`}>
                            {!hideAmounts && (restProfit >= 0 ? "+" : "")}{fmt(Math.round(restProfit))}
                          </span>
                          <span className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(restProfit)}`}>({restProfitRate >= 0 ? "+" : ""}{restProfitRate.toFixed(1)}%)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export function StockTab() {
  const { assetData, deleteStock, saveData } = useAssetData();
  const [activeCategory, setActiveCategory] = useState("all");
  const [hasInteracted, setHasInteracted] = useState(() => {
    try { return !!localStorage.getItem(STORAGE_KEYS.collapsibleUsed); } catch { return true; }
  });
  const [displayCurrency, setDisplayCurrency] = useState<StockDisplayCurrency>(() => {
    try { return localStorage.getItem(STORAGE_KEYS.stockDisplayCurrency) === "USD" ? "USD" : "KRW"; } catch { return "KRW"; }
  });

  // 해외주식(환율 적용 대상) 보유 여부 — 없으면 달러 선택 불가, 원화로 고정
  const hasForeignStock = useMemo(
    () => assetData.stocks.some((s) => s.category === "foreign" && s.currency !== "KRW"),
    [assetData.stocks],
  );
  // 원/달러 기능은 "해외" 카테고리 탭에서만 노출·적용
  const showCurrencyToggle = activeCategory === "foreign" && hasForeignStock;
  const effectiveDisplayCurrency: StockDisplayCurrency = showCurrencyToggle ? displayCurrency : "KRW";

  const handleDisplayCurrencyChange = (v: StockDisplayCurrency) => {
    setDisplayCurrency(v);
    try { localStorage.setItem(STORAGE_KEYS.stockDisplayCurrency, v); } catch { /* ignore */ }
  };

  // 비해외주식의 currency/purchaseExchangeRate 정리 (1회성 마이그레이션)
  useEffect(() => {
    const dirty = assetData.stocks.filter(
      (s) => s.category !== "foreign" && (s.currency !== "KRW" || s.purchaseExchangeRate != null)
    );
    if (dirty.length === 0) return;
    const fixed = assetData.stocks.map((s) => {
      if (s.category === "foreign") return s;
      const next = { ...s, currency: "KRW" as const };
      delete next.purchaseExchangeRate;
      return next;
    });
    // saveData 유지 — API 파생값이 아니라 실제 사용자 데이터(currency·purchaseExchangeRate)를
    // 정정하는 것이라 타 기기 전파가 옳고, dirty가 비면 1회로 수렴한다.
    // refreshData()로 바꾸면 진행 중 시세 sync를 abort하고 saveSnapshotsBlockedRef를 세워
    // 그 세션의 오늘자 스냅샷 저장이 통째로 스킵된다(해제는 syncTodayStockPrices 안에서만 일어남).
    saveData({ ...assetData, stocks: fixed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFirstInteract = () => {
    if (hasInteracted) return;
    setHasInteracted(true);
    try { localStorage.setItem(STORAGE_KEYS.collapsibleUsed, "1"); } catch { /* ignore */ }
  };

  const visibleCategories = useMemo(() => {
    const activeCats = new Set(assetData.stocks.map((s) => s.category));
    return CATEGORY_TABS.filter((tab) => {
      if (tab.value === "all") return true;
      return activeCats.has(tab.value);
    });
  }, [assetData.stocks]);

  useEffect(() => {
    if (!visibleCategories.some((tab) => tab.value === activeCategory)) {
      setActiveCategory("all");
    }
  }, [visibleCategories, activeCategory]);

  const { groupedStocks, groupKeyOf, mergedStocks, totalValue, totalProfit, totalProfitRate, barItems, barColors, summary, exchangeRates, refData, dailyProfitRate, marketMap } =
    useFilteredStockData(activeCategory, effectiveDisplayCurrency);

  const getCategoryLabel = (cat: string) => stockCategories.find((c) => c.value === cat)?.label ?? cat;

  const handleDelete = (id: string) => {
    toast.success("삭제되었습니다.");
    deleteStock(id);
  };

  const handleDeleteGroup = (ids: string[]) => {
    const idSet = new Set(ids);
    saveData({ ...assetData, stocks: assetData.stocks.filter((s) => !idSet.has(s.id)) });
    toast.success("삭제되었습니다.");
  };

  return (
    <Card className={ASSET_THEME.contentCard}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle>주식</CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 ${ASSET_THEME.contentPad}`}>
        {/* 요약 헤더 */}
        <StockSummaryHeader
          totalValue={totalValue}
          totalProfit={totalProfit}
          totalProfitRate={totalProfitRate}
          currencyGain={effectiveDisplayCurrency === "USD" ? 0 : (activeCategory === "foreign" || activeCategory === "all" ? summary.stockCurrencyGain : 0)}
          displayCurrency={effectiveDisplayCurrency}
          onDisplayCurrencyChange={activeCategory === "foreign" ? handleDisplayCurrencyChange : undefined}
          usdRate={exchangeRates.USD}
          disableUsd={!hasForeignStock}
          dailyRate={dailyProfitRate}
        />

        {/* X-Ray 인사이트 스트립 (인증카드 제외) */}
        <StockInsightStrip stocks={assetData.stocks} exchangeRates={exchangeRates} />

        {/* 카테고리 selector */}
        <div className="flex justify-start">
          <InlineSelector
            value={activeCategory}
            onChange={setActiveCategory}
            options={visibleCategories}
            ariaLabel="주식 카테고리 선택"
          />
        </div>

        {/* 비중바 + 종목 목록 (인증카드과 공통) */}
        <StockCategorySection
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          filteredStocks={mergedStocks}
          totalValue={totalValue}
          barItems={barItems}
          barColors={barColors}
          screenshotMode={false}
          renderItem={(stock, isFirst, color) => {
            const groupKey = groupKeyOf(stock);
            const groupItems = groupedStocks.get(groupKey) ?? [stock];
            const m = computeStockMetrics(stock, exchangeRates, totalValue, effectiveDisplayCurrency);
            const linkedLoans = groupItems.flatMap((s) => assetData.loans.filter((l) => l.linkedStockId === s.id));
            const categoryLabels = Array.from(new Set(groupItems.map((s) => s.category))).map(getCategoryLabel);
            // 종목별 오늘 등락 — 홈(전일 순자산)·성과(집계 일별수익)와 중복 없는 개별 종목 단위
            const { dailyProfitRate: dailyRate } = computeDailyStockProfit(groupItems, refData, exchangeRates);
            return (
              <StockCard
                key={groupKey}
                stock={stock}
                color={color}
                pct={m.pct}
                currentVal={m.currentVal}
                profit={m.profit}
                profitRate={m.profitRate}
                dailyRate={dailyRate}
                isForeign={m.isForeign}
                krwMul={m.krwMul}
                currencyGain={m.currencyGain}
                currencyGainRate={m.currencyGainRate}
                linkedLoans={linkedLoans}
                onDelete={handleDelete}
                onDeleteGroup={handleDeleteGroup}
                categoryLabels={categoryLabels}
                defaultOpen={isFirst && !hasInteracted}
                onFirstInteract={isFirst && !hasInteracted ? handleFirstInteract : undefined}
                isFirstVisit={isFirst && !hasInteracted}
                subItems={groupItems.length > 1 || (groupItems.length > 0 && !!groupItems[0]?.broker) ? groupItems : undefined}
                groupItems={groupItems}
                exchangeRates={exchangeRates}
                totalValue={totalValue}
                marketMap={marketMap}
                displayCurrency={effectiveDisplayCurrency}
              />
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
