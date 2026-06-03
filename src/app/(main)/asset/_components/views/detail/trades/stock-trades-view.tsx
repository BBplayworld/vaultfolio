"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowLeftRight, Trash2, TrendingUp, TrendingDown, CalendarSearch } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTradeViewStore } from "@/stores/trade-view-store";
import { dispatchAddTrade } from "../../../layout/navigation/asset-dispatch";
import { formatCurrency } from "@/lib/number-utils";
import { getMultiplier, mergeStockGroup } from "../asset-detail-tabs";
import { rollbackTransaction } from "@/lib/trade-utils";
import { DeleteRollbackDialog } from "../../../forms/trade/guards/delete-rollback-dialog";
import { stockCategories } from "@/config/asset-options";
import { ASSET_THEME, getProfitLossColor, MAIN_PALETTE } from "@/config/theme";
import type { Stock, Transaction } from "@/types/asset";
import type { PositionSnapshot, PositionPreview } from "@/types/transaction";

const formatPrice = (value: number, currency: string) => {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
};

type DatePreset = "1m" | "3m" | "1y" | "all";
type TypeFilter = "all" | "buy" | "sell";

const DATE_PRESETS = [
  { value: "1m" as DatePreset, label: "1개월" },
  { value: "3m" as DatePreset, label: "3개월" },
  { value: "1y" as DatePreset, label: "1년" },
  { value: "all" as DatePreset, label: "전체" },
];

const TYPE_FILTERS = [
  { value: "all" as TypeFilter, label: "전체" },
  { value: "buy" as TypeFilter, label: "매수" },
  { value: "sell" as TypeFilter, label: "매도" },
];

function presetFrom(preset: DatePreset): string {
  if (preset === "all") return "0000-01-01";
  const d = new Date();
  if (preset === "1m") d.setMonth(d.getMonth() - 1);
  else if (preset === "3m") d.setMonth(d.getMonth() - 3);
  else if (preset === "1y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

export function StockTradesView() {
  const { assetData, exchangeRates, deleteTransaction, deleteTransactionWithPosition } = useAssetData();
  const target = useTradeViewStore((s) => s.target);
  const isMobile = useIsMobile();

  const [brokerScope, setBrokerScope] = useState<string>(target?.initialStockId ?? "all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ tx: Transaction; stock: Stock; preview: PositionPreview } | null>(null);

  // 그룹 종목(증권사별 항목) — 현재 보유 데이터에서 해석
  const groupStocks = useMemo(
    () => assetData.stocks.filter((s) => target?.groupStockIds.includes(s.id)),
    [assetData.stocks, target],
  );

  const currency = groupStocks[0]?.currency || "KRW";
  const mul = getMultiplier(currency, exchangeRates);

  // 증권사 토글 옵션 (단일 증권사면 토글 생략)
  const brokerOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "all", label: "전체" }];
    for (const s of groupStocks) opts.push({ value: s.id, label: s.broker || "미지정" });
    return opts;
  }, [groupStocks]);

  const scopeIds = useMemo(
    () => (brokerScope === "all" ? groupStocks.map((s) => s.id) : [brokerScope]),
    [brokerScope, groupStocks],
  );

  // 헤더 보유 요약 — 전체면 그룹 병합, 개별이면 해당 종목
  const summaryStock = useMemo<Stock | null>(() => {
    if (groupStocks.length === 0) return null;
    if (brokerScope === "all") return mergeStockGroup(groupStocks);
    return groupStocks.find((s) => s.id === brokerScope) ?? null;
  }, [groupStocks, brokerScope]);

  // 날짜 범위
  const { fromDate, toDate } = useMemo(() => {
    if (customOpen && (customFrom || customTo)) {
      return { fromDate: customFrom || "0000-01-01", toDate: customTo || "9999-12-31" };
    }
    return { fromDate: presetFrom(datePreset), toDate: "9999-12-31" };
  }, [customOpen, customFrom, customTo, datePreset]);

  const filtered = useMemo(() => {
    const idSet = new Set(scopeIds);
    return (assetData.transactions || [])
      .filter((tx) => idSet.has(tx.stockId))
      .filter((tx) => typeFilter === "all" || tx.type === typeFilter)
      .filter((tx) => tx.date >= fromDate && tx.date <= toDate)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [assetData.transactions, scopeIds, typeFilter, fromDate, toDate]);

  // 기간 요약 — 매수/매도 합계
  const stats = useMemo(() => {
    let buyQty = 0, buyAmt = 0, sellQty = 0, sellAmt = 0;
    for (const tx of filtered) {
      const amt = tx.price * tx.quantity * (tx.currency === "KRW" ? 1 : mul);
      if (tx.type === "buy") { buyQty += tx.quantity; buyAmt += amt; }
      else { sellQty += tx.quantity; sellAmt += amt; }
    }
    return { buyQty, buyAmt, sellQty, sellAmt };
  }, [filtered, mul]);

  // 윈도잉 — 모바일 자동 무한스크롤 / PC 더보기 버튼. 기기 저장 특성상 렌더 DOM 제한.
  const STEP = isMobile === false ? 40 : 20;
  const [visibleCount, setVisibleCount] = useState(STEP);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 필터·플랫폼 변경 시 초기 건수로 리셋
  useEffect(() => { setVisibleCount(STEP); }, [scopeIds, typeFilter, fromDate, toDate, STEP]);

  const visibleTx = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  const grouped = useMemo(() => {
    return visibleTx.reduce<Record<string, Transaction[]>>((acc, tx) => {
      (acc[tx.date] ??= []).push(tx);
      return acc;
    }, {});
  }, [visibleTx]);

  // 모바일: 하단 근처 도달 시 자동 추가 로드
  useEffect(() => {
    if (isMobile === false || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => c + STEP);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, hasMore, STEP]);

  const handleDeleteClick = (tx: Transaction) => {
    const stock = groupStocks.find((s) => s.id === tx.stockId);
    if (!stock) return;
    if (!tx.reflected) {
      deleteTransaction(tx.id);
      toast.success("거래가 삭제되었습니다.");
      return;
    }
    // 현재 보유 포지션 — 거래로그에 없는 수동 보유분을 역산으로 보존하기 위한 기준점
    const currentPosition: PositionSnapshot = {
      stockId: stock.id,
      quantity: stock.quantity,
      avgPrice: stock.averagePrice,
      avgExchangeRate: stock.purchaseExchangeRate ?? 0,
      source: stock.positionSource ?? "manual",
      effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate,
      lockedByManual: false,
    };
    const allTx = (assetData.transactions || []).filter((t) => t.stockId === stock.id);
    const rolledBack = rollbackTransaction(currentPosition, allTx, tx.id);
    setDeleteTarget({
      tx, stock,
      preview: { quantity: rolledBack.quantity, avgPrice: rolledBack.avgPrice, avgExchangeRate: rolledBack.avgExchangeRate },
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const { tx, stock, preview } = deleteTarget;
    deleteTransactionWithPosition(tx.id, stock.id, {
      quantity: preview.quantity,
      averagePrice: preview.avgPrice,
      purchaseExchangeRate: preview.avgExchangeRate || undefined,
      positionSource: "computed",
    });
    toast.success("거래가 삭제되고 포지션이 롤백되었습니다.");
    setDeleteTarget(null);
  };

  if (!target || groupStocks.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground text-sm">조회할 종목을 먼저 선택해 주세요.</p>
        </CardContent>
      </Card>
    );
  }

  const categoryLabel = stockCategories.find((c) => c.value === target.category)?.label ?? target.category;
  const currentVal = summaryStock ? summaryStock.quantity * summaryStock.currentPrice * (currency === "KRW" ? 1 : mul) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="size-4" style={{ color: MAIN_PALETTE[0] }} />
          거래내역
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종목 헤더 */}
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{target.name}</span>
            {target.ticker && <span className="text-sm font-mono text-muted-foreground">({target.ticker})</span>}
            <Badge variant="outline" className="text-[10px] py-0">{categoryLabel}</Badge>
          </div>
          {summaryStock && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">보유 수량</p>
                <p className="font-semibold tabular-nums">{summaryStock.quantity.toLocaleString()}주</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">평단가</p>
                <p className="font-semibold tabular-nums">{formatPrice(summaryStock.averagePrice, currency)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">평가금액</p>
                <p className="font-semibold tabular-nums" style={{ color: MAIN_PALETTE[10] }}>{formatCurrency(Math.round(currentVal))}</p>
              </div>
            </div>
          )}
        </div>

        {/* 증권사 토글 (분할된 경우만) */}
        {groupStocks.length > 1 && (
          <div className="flex justify-start overflow-x-auto">
            <InlineSelector value={brokerScope} onChange={setBrokerScope} options={brokerOptions} size="sm" ariaLabel="증권사 선택" />
          </div>
        )}

        {/* 매수/매도 + 거래 입력 */}
        <div className="flex items-center justify-between gap-2">
          <InlineSelector value={typeFilter} onChange={setTypeFilter} options={TYPE_FILTERS} ariaLabel="거래 유형 필터" />
          <Button
            size="sm"
            variant="brand"
            className="h-8"
            onClick={() => dispatchAddTrade(brokerScope === "all" ? groupStocks[0].id : brokerScope)}
          >
            <ArrowLeftRight className="size-3.5" /> 거래 입력
          </Button>
        </div>

        {/* 날짜 검색 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <InlineSelector
              value={datePreset}
              onChange={(v) => { setDatePreset(v); setCustomOpen(false); setCustomFrom(""); setCustomTo(""); }}
              options={DATE_PRESETS}
              size="sm"
              ariaLabel="기간 프리셋"
            />
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] sm:text-[13px] transition-colors ${customOpen ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarSearch className="size-3.5" /> 직접 설정
            </button>
          </div>
          {customOpen && (
            <div className="flex items-center gap-2">
              <Input type="date" className="h-8 text-sm" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-muted-foreground text-sm shrink-0">~</span>
              <Input type="date" className="h-8 text-sm" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>

        {/* 기간 요약 스탯 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] text-red-500"><TrendingUp className="size-3" /> 매수</p>
            <p className="font-bold tabular-nums">{stats.buyQty.toLocaleString()}주</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(Math.round(stats.buyAmt))}</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] text-blue-500"><TrendingDown className="size-3" /> 매도</p>
            <p className="font-bold tabular-nums">{stats.sellQty.toLocaleString()}주</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(Math.round(stats.sellAmt))}</p>
          </div>
        </div>

        {/* 거래 리스트 */}
        {filtered.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">해당 조건의 거래내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">총 {filtered.length.toLocaleString()}건</p>
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="text-[11px] text-muted-foreground mb-1.5">{date}</p>
                <div className="space-y-1.5">
                  {txs.map((tx) => {
                    const amt = tx.price * tx.quantity * (tx.currency === "KRW" ? 1 : mul);
                    return (
                      <div key={tx.id} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm group/item">
                        <span className={`text-xs font-bold shrink-0 w-8 ${tx.type === "buy" ? "text-red-500" : "text-blue-500"}`}>
                          {tx.type === "buy" ? "매수" : "매도"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="tabular-nums">
                            {tx.quantity.toLocaleString()}주 <span className="text-muted-foreground">· {formatPrice(tx.price, tx.currency)}</span>
                          </p>
                          {brokerScope === "all" && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {groupStocks.find((s) => s.id === tx.stockId)?.broker || "미지정"}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold tabular-nums ${getProfitLossColor(tx.type === "buy" ? 1 : -1)}`}>
                            {tx.type === "buy" ? "+" : "-"}{formatCurrency(Math.round(amt))}
                          </p>
                          {tx.reflected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">반영</span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          className={`${ASSET_THEME.cardActionButton} text-muted-foreground hover:text-destructive shrink-0`}
                          onClick={() => handleDeleteClick(tx)}
                          title="삭제"
                          aria-label="거래 삭제"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 더보기 — PC는 버튼, 모바일은 자동 로드 sentinel */}
            {hasMore && (
              isMobile === false ? (
                <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={() => setVisibleCount((c) => c + STEP)}>
                  더보기 (남은 {(filtered.length - visibleCount).toLocaleString()}건)
                </Button>
              ) : (
                <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                  <span className="text-[11px] text-muted-foreground">불러오는 중…</span>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>

      {deleteTarget && (
        <DeleteRollbackDialog
          open={!!deleteTarget}
          tx={deleteTarget.tx}
          stock={deleteTarget.stock}
          rollbackPreview={deleteTarget.preview}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Card>
  );
}
