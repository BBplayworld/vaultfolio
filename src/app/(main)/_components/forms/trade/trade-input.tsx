"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { ImageUp, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAssetData } from "@/contexts/asset-data-context";
import { Stock, type Transaction } from "@/types/asset";
import type { PositionSnapshot } from "@/types/transaction";
import { validateReflection } from "@/lib/validate-reflection";
import { computeNewPosition, TRANSACTION_RETENTION_YEARS, findDuplicateTransaction } from "@/lib/trade-utils";
import { formatCurrency } from "@/lib/number-utils";
import { TradeScreenshotImport } from "./trade-screenshot-import";
import { groupStocksByTicker } from "../../views/detail/asset-detail-tabs";
import { stockCategories, securitiesFirms } from "@/config/asset-options";

// 거래 입력 폼 스키마
const tradeFormSchema = z.object({
  stockId: z.string().min(1, "종목을 선택해주세요"),
  type: z.enum(["buy", "sell"]),
  quantity: z.number().min(0).refine((v) => v > 0, "수량을 입력해주세요"),
  price: z.number().min(0).refine((v) => v > 0, "체결 단가를 입력해주세요"),
  date: z.string().min(1, "체결일을 선택해주세요"),
  exchangeRate: z.number().optional(),
  memo: z.string().optional(),
  reflected: z.boolean(),
});

type TradeFormValues = z.infer<typeof tradeFormSchema>;

const formatPrice = (value: number, currency: string) => {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
};

function getPositionSnapshot(stock: Stock): PositionSnapshot {
  return {
    stockId: stock.id,
    quantity: stock.quantity,
    avgPrice: stock.averagePrice,
    avgExchangeRate: stock.purchaseExchangeRate ?? 0,
    source: stock.positionSource ?? "manual",
    effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate,
    lockedByManual: stock.positionSource === "manual" || !stock.positionSource,
  };
}

export function TradeInput() {
  const { assetData, addTransaction, addTransactionWithPosition, exchangeRates } = useAssetData();
  const [isOpen, setIsOpen] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [priceInKrw, setPriceInKrw] = useState(false);
  const [dupPending, setDupPending] = useState<{ tx: Transaction; stock: Stock } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState(""); // 종목(티커) 대표 id
  const [selectedBroker, setSelectedBroker] = useState(""); // 증권사 (필수)
  const [filterCategory, setFilterCategory] = useState("all");
  const [lockedStock, setLockedStock] = useState(false); // 상세에서 종목 사전선택으로 진입

  // 보유 주식 목록 (delisted 제외)
  const stocks = assetData.stocks.filter((s) => s.inactiveStatus !== "delisted");

  // 카테고리 옵션 — 실제 보유 종목이 있는 카테고리만
  const categoryOptions = useMemo(() => {
    const present = new Set(stocks.map((s) => s.category));
    return stockCategories.filter((c) => present.has(c.value));
  }, [stocks]);

  // 종목 선택 목록 — 카테고리 필터 후 티커 기준 그룹화 (증권사별 분할 항목은 하위로)
  const stockGroups = useMemo(() => {
    const groups = Array.from(groupStocksByTicker(stocks).values());
    if (filterCategory === "all") return groups;
    return groups
      .map((g) => g.filter((s) => s.category === filterCategory))
      .filter((g) => g.length > 0);
  }, [stocks, filterCategory]);

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      stockId: "",
      type: "buy",
      quantity: 0,
      price: 0,
      date: new Date().toISOString().split("T")[0],
      memo: "",
      reflected: true,
    },
  });

  const selectedStockId = form.watch("stockId");
  const selectedStock = stocks.find((s) => s.id === selectedStockId);
  const isForeign = selectedStock?.currency === "USD" || selectedStock?.currency === "JPY";
  const isUsd = selectedStock?.currency === "USD";
  const tradeType = form.watch("type");
  const watchedQty = form.watch("quantity");
  const watchedPrice = form.watch("price");
  const watchedExRate = form.watch("exchangeRate");
  const reflected = form.watch("reflected");

  // 반영 후 예상 포지션 인라인 미리보기 (팝업 대체)
  const reflectionPreview = useMemo(() => {
    if (!reflected || !selectedStock || !(watchedQty > 0) || !(watchedPrice > 0)) return null;
    // 유효 체결 단가 — USD 원화 입력 시 달러 환산(저장 로직과 동일)
    let price = watchedPrice;
    if (selectedStock.currency === "USD" && priceInKrw) {
      const rate = watchedExRate || exchangeRates.USD;
      if (rate) price = Math.round((price / rate) * 1000) / 1000;
    }
    const pos = getPositionSnapshot(selectedStock);
    if (tradeType === "sell" && watchedQty > pos.quantity) return { oversell: true as const };
    const tentativeTx = { type: tradeType, quantity: watchedQty, price, exchangeRate: watchedExRate } as Transaction;
    return { before: pos, after: computeNewPosition(pos, tentativeTx) };
  }, [reflected, selectedStock, watchedQty, watchedPrice, watchedExRate, priceInKrw, tradeType, exchangeRates.USD]);

  // 종목(티커) 대표 목록 — 그룹당 1개
  const tickerReps = useMemo(() => stockGroups.map((g) => g[0]).filter(Boolean), [stockGroups]);

  // 종목(티커) + 증권사 → 보유 항목 라우팅. 분할 없으면 기존 보유, 분할 있으면 해당 증권사 항목.
  const resolveMatch = (ticker: string, name: string, broker: string): string => {
    const norm = (ticker || "").toUpperCase();
    const candidates = ticker
      ? stocks.filter((s) => s.ticker?.toUpperCase() === norm)
      : stocks.filter((s) => s.name === name);
    if (candidates.length === 0) return stocks.find((s) => s.name === name)?.id ?? "";
    if (broker) {
      const byBroker = candidates.find((s) => s.broker === broker);
      if (byBroker) return byBroker.id;
    }
    return candidates[0].id;
  };

  // (종목 + 증권사) 선택 시 실제 보유 stockId 해석 → form.stockId 반영. 상세 진입(locked)은 stockId 직접 사용.
  useEffect(() => {
    if (lockedStock) return;
    const rep = stocks.find((s) => s.id === selectedGroupId);
    if (!rep || !selectedBroker) { form.setValue("stockId", ""); return; }
    form.setValue("stockId", resolveMatch(rep.ticker || "", rep.name, selectedBroker));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedBroker, lockedStock, assetData.stocks]);

  // 체결일 입력 제한 — 미래 금지(max=오늘), 보존기간 밖 금지(min=오늘-N년)
  const todayStr = new Date().toISOString().split("T")[0];
  const minTradeDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - TRANSACTION_RETENTION_YEARS);
    return d.toISOString().split("T")[0];
  })();

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.stockId;
      if (id) {
        setMode("manual");
        setLockedStock(true);
        form.setValue("stockId", id);
        const s = assetData.stocks.find((x) => x.id === id);
        if (s) setFilterCategory(s.category);
      } else {
        setMode("select");
        setLockedStock(false);
      }
      setIsOpen(true);
    };
    window.addEventListener("trigger-add-trade", handler);
    return () => window.removeEventListener("trigger-add-trade", handler);
  }, [form, assetData.stocks]);

  const resetAndClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
    setMode("select");
    setPriceInKrw(false);
    setFilterCategory("all");
    setLockedStock(false);
    setDupPending(null);
    setSelectedGroupId("");
    setSelectedBroker("");
  }, [form]);

  const buildTransaction = (data: TradeFormValues): Transaction => {
    const stock = stocks.find((s) => s.id === data.stockId)!;
    // 해외(USD) 원화 입력 시 달러 환산 — 체결환율 우선, 없으면 현재환율
    let price = data.price;
    if (stock.currency === "USD" && priceInKrw) {
      const rate = data.exchangeRate || exchangeRates.USD;
      if (rate) price = Math.round((price / rate) * 1000) / 1000;
    }
    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: data.stockId,
      ticker: stock.ticker || "",
      stockName: stock.name,
      type: data.type,
      quantity: data.quantity,
      price,
      currency: stock.currency || "KRW",
      exchangeRate: data.exchangeRate,
      date: data.date,
      reflected: data.reflected,
      // 반영 식별자는 실제 반영 시점에 부여(빌드 시 부여하면 정합성 가드가 오진)
      reflectedAt: undefined,
      reflectionId: undefined,
      memo: data.memo,
      createdAt: new Date().toISOString(),
    };
  };

  // 실제 반영 직전에만 반영 식별자 부여
  const markReflected = (tx: Transaction): Transaction => ({
    ...tx,
    reflectedAt: new Date().toISOString(),
    reflectionId: `ref_${Date.now()}`,
  });

  // 반영 시 종목에 적용할 포지션 패치 계산
  const buildReflectionPatch = (tx: Transaction, stock: Stock): Partial<Stock> => {
    const pos = getPositionSnapshot(stock);
    const preview = computeNewPosition(pos, tx);
    return {
      quantity: preview.quantity,
      averagePrice: preview.avgPrice,
      purchaseExchangeRate: preview.avgExchangeRate || undefined,
      positionSource: "computed",
      positionEffectiveDate: tx.date,
    };
  };

  const onSubmit = (data: TradeFormValues) => {
    const stock = stocks.find((s) => s.id === data.stockId);
    if (!stock) return;

    const tx = buildTransaction(data);

    if (data.reflected) {
      const pos = getPositionSnapshot(stock);
      const guard = validateReflection(tx, pos);

      // 보유 초과 매도·중복 반영만 차단. 평단 재계산(manual_override)·과거날짜(backdated)는
      // 하단 인라인 미리보기로 사전 고지하므로 별도 팝업 없이 바로 반영.
      if (guard.level === "restrict") {
        if (guard.reason === "oversell") {
          form.setError("quantity", {
            message: `보유 수량(${guard.maxQty}주)을 초과합니다`,
          });
        } else if (guard.reason === "already_reflected") {
          toast.error("이미 반영된 거래입니다.");
        }
        return;
      }
    }

    const finalTx = tx.reflected ? markReflected(tx) : tx;

    // 중복 거래(증권사·날짜·수량·가격·유형 동일) 검사 → 확인 다이얼로그
    const dup = findDuplicateTransaction(assetData.transactions || [], {
      stockId: tx.stockId, date: tx.date, quantity: tx.quantity, price: tx.price, type: tx.type,
    });
    if (dup) {
      setDupPending({ tx: finalTx, stock });
      return;
    }

    commitTransaction(finalTx, stock);
  };

  // 거래 커밋(반영/미반영 분기) + 토스트 + 닫기
  const commitTransaction = (finalTx: Transaction, stock: Stock) => {
    const ok = finalTx.reflected
      ? addTransactionWithPosition(finalTx, stock.id, buildReflectionPatch(finalTx, stock))
      : addTransaction(finalTx);
    if (ok) {
      toast.success(finalTx.type === "buy" ? "매수 거래가 기록되었습니다." : "매도 거래가 기록되었습니다.");
      resetAndClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto touch-pan-y">
          <DialogHeader>
            <DialogTitle>{mode === "select" ? "거래 입력" : "거래 직접 입력"}</DialogTitle>
          </DialogHeader>

          {mode === "select" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/60 hover:bg-muted/90 dark:bg-muted/30 dark:hover:bg-muted/50 transition-colors text-left w-full"
                onClick={() => { setIsOpen(false); setScreenshotOpen(true); }}
              >
                <ImageUp className="size-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">스크린샷 가져오기</p>
                  <p className="text-xs text-muted-foreground">체결 내역 화면 자동 인식</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/60 hover:bg-muted/90 dark:bg-muted/30 dark:hover:bg-muted/50 transition-colors text-left w-full"
                onClick={() => setMode("manual")}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">직접 입력</p>
                  <p className="text-xs text-muted-foreground">매수/매도 거래 수동 입력</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          )}

          {mode === "manual" && !dupPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 카테고리 필터 (종목 사전선택 진입 시 숨김) */}
              {!lockedStock && categoryOptions.length > 0 && (
                <FormItem>
                  <FormLabel>카테고리</FormLabel>
                  <Select
                    value={filterCategory}
                    onValueChange={(v) => { setFilterCategory(v); setSelectedGroupId(""); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}

              {/* 종목(티커) 선택 — 상세 진입 시 읽기 전용 요약으로 대체 */}
              {!lockedStock && (
                <FormItem>
                  <FormLabel>종목</FormLabel>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="종목 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {tickerReps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.name} {rep.ticker ? `(${rep.ticker})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}

              {/* 증권사 선택 (필수) — 분할 없으면 기존 보유, 나뉜 보유 있으면 해당 항목에 반영 */}
              {!lockedStock && (
                <FormItem>
                  <FormLabel>증권사 *</FormLabel>
                  <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                    <SelectTrigger>
                      <SelectValue placeholder="증권사 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {securitiesFirms.map((g) => g.items.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      )))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    증권사별로 나뉜 보유가 있으면 해당 항목에, 분할이 없으면 기존 보유 종목에 반영됩니다.
                  </p>
                </FormItem>
              )}

              {/* 선택 종목 보유 정보 (사용자 확인용) */}
              {selectedStock && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-xs">
                  {lockedStock && (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      {stockCategories.find((c) => c.value === selectedStock.category)?.label ?? selectedStock.category}
                    </span>
                  )}
                  <span className="font-medium truncate">
                    {selectedStock.name}{selectedStock.ticker ? ` (${selectedStock.ticker})` : ""}
                  </span>
                  {selectedStock.broker && (
                    <span className="text-muted-foreground shrink-0">· {selectedStock.broker}</span>
                  )}
                  <span className="ml-auto text-muted-foreground shrink-0">보유 {selectedStock.quantity}주</span>
                </div>
              )}

              {/* 매수/매도 토글 */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>거래 유형</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === "buy" ? "default" : "secondary"}
                        className={field.value === "buy" ? "flex-1 bg-red-500 hover:bg-red-600 text-white" : "flex-1"}
                        onClick={() => field.onChange("buy")}
                      >
                        매수
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "sell" ? "default" : "secondary"}
                        className={field.value === "sell" ? "flex-1 bg-blue-500 hover:bg-blue-600 text-white" : "flex-1"}
                        onClick={() => field.onChange("sell")}
                      >
                        매도
                      </Button>
                    </div>
                  </FormItem>
                )}
              />

              {/* 수량 */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수량</FormLabel>
                    <FormControl>
                      <NumberInput
                        value={field.value}
                        onChange={field.onChange}
                        allowDecimals={isForeign}
                        maxDecimals={isForeign ? 6 : 0}
                        quickButtons={[
                          { label: "1", value: 1 },
                          { label: "5", value: 5 },
                          { label: "10", value: 10 },
                          { label: "50", value: 50 },
                        ]}
                      />
                    </FormControl>
                    {tradeType === "sell" && selectedStock && (
                      <p className="text-[11px] text-muted-foreground">
                        보유: {selectedStock.quantity}주
                        <button
                          type="button"
                          className="ml-2 text-primary underline"
                          onClick={() => field.onChange(selectedStock.quantity)}
                        >
                          전량
                        </button>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 체결 단가 */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>
                        체결 단가 {isUsd ? (priceInKrw ? "(원)" : "(USD)") : isForeign ? `(${selectedStock?.currency})` : "(원)"}
                      </FormLabel>
                      {isUsd && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                          <Checkbox
                            checked={priceInKrw}
                            onCheckedChange={(v) => setPriceInKrw(!!v)}
                            className="size-3.5"
                          />
                          원화로 입력
                        </label>
                      )}
                    </div>
                    <FormControl>
                      <NumberInput
                        value={field.value}
                        onChange={field.onChange}
                        allowDecimals={isForeign && !(isUsd && priceInKrw)}
                        maxDecimals={isUsd && priceInKrw ? 0 : isUsd ? 3 : isForeign ? 4 : 0}
                        quickButtons={[]}
                      />
                    </FormControl>
                    {isUsd && (
                      <p className="text-[11px] text-muted-foreground">
                        {priceInKrw
                          ? `KRW — 저장 시 달러로 환산 (÷ ${exchangeRates.USD ? Math.round(exchangeRates.USD).toLocaleString() : "..."})`
                          : "USD (소수점 3자리 가능)"}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 해외주식 환율 */}
              {isForeign && (
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        체결 환율 {selectedStock?.currency === "JPY" ? "(원/100¥)" : "(원/$)"}
                      </FormLabel>
                      <FormControl>
                        <NumberInput
                          value={field.value ?? 0}
                          onChange={field.onChange}
                          allowDecimals={true}
                          maxDecimals={2}
                          quickButtons={[]}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* 체결일 */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>체결일</FormLabel>
                    <FormControl>
                      <Input type="date" min={minTradeDate} max={todayStr} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 메모 */}
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>메모 (선택)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="거래 메모"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 반영 체크박스 */}
              <FormField
                control={form.control}
                name="reflected"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="leading-none">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        보유 수량에 즉시 반영
                      </FormLabel>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        해제 시 거래 기록만 남기고 포지션은 변경하지 않습니다
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {/* 반영 후 예상 포지션 미리보기 */}
              {reflectionPreview && selectedStock && (
                reflectionPreview.oversell ? (
                  <div className="rounded-lg bg-destructive/10 dark:bg-destructive/20 p-3 text-xs text-destructive font-medium">
                    보유 수량({selectedStock.quantity.toLocaleString()}주)을 초과합니다
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground">반영 후 예상 포지션</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">보유 수량</p>
                        <p className="tabular-nums">
                          <span className="text-muted-foreground">{reflectionPreview.before.quantity.toLocaleString()}</span>
                          <span className="text-muted-foreground/60"> → </span>
                          <span className="font-semibold">{reflectionPreview.after.quantity.toLocaleString()}주</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">평단가</p>
                        <p className="tabular-nums">
                          <span className="text-muted-foreground">{formatPrice(reflectionPreview.before.avgPrice, selectedStock.currency || "KRW")}</span>
                          <span className="text-muted-foreground/60"> → </span>
                          <span className="font-semibold">{formatPrice(reflectionPreview.after.avgPrice, selectedStock.currency || "KRW")}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" variant="brand">
                  {tradeType === "buy" ? "매수 기록" : "매도 기록"}
                </Button>
                <Button type="button" variant="secondary" onClick={resetAndClose}>
                  취소
                </Button>
              </DialogFooter>
            </form>
          </Form>
          )}

          {/* 중복 거래 확인 — 같은 Dialog 내 인라인(중첩 모달 회피) */}
          {mode === "manual" && dupPending && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 p-3 space-y-1 text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-500">이미 동일한 거래가 있습니다</p>
                <p className="text-muted-foreground text-xs">증권사·날짜·수량·체결가·유형이 동일한 거래가 이미 기록되어 있습니다.</p>
                <p className="tabular-nums">
                  <span className={dupPending.tx.type === "buy" ? "text-red-500 font-semibold" : "text-blue-500 font-semibold"}>
                    {dupPending.tx.type === "buy" ? "매수" : "매도"}
                  </span>{" "}
                  {dupPending.tx.date} · {dupPending.tx.quantity}주 · {formatPrice(dupPending.tx.price, dupPending.tx.currency)}
                </p>
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="brand" onClick={() => { setDupPending(null); toast.success("기존 거래를 유지했습니다."); resetAndClose(); }}>
                  덮어쓰기 (기존 유지)
                </Button>
                <Button type="button" variant="secondary" onClick={() => { if (dupPending) commitTransaction(dupPending.tx, dupPending.stock); }}>
                  새로 추가
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDupPending(null)}>
                  취소
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 거래 스크린샷 가져오기 */}
      <TradeScreenshotImport
        open={screenshotOpen}
        onOpenChange={setScreenshotOpen}
      />
    </>
  );
}
