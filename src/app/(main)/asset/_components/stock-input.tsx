"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, TrendingUp, Calendar, Clock, Search, Loader2, LayoutGrid, Flag, Globe, Landmark, Coins, ShieldCheck, Lock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { normalizeTicker } from "@/lib/finance-service";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Stock, stockSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { stockCategories, quickButtonPresets } from "@/config/asset-options";

const stockQuickButtons = [...quickButtonPresets.stock];

interface StockFormProps {
  editData?: Stock;
  onClose: () => void;
}

function StockForm({ editData, onClose }: StockFormProps) {
  const { addStock, updateStock } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Stock["category"]>(editData?.category || "domestic");
  const [lookupState, setLookupState] = useState<"idle" | "success" | "failed">(
    editData ? "success" : "idle"
  );

  const form = useForm<Stock>({
    resolver: zodResolver(stockSchema),
    defaultValues: editData || {
      id: "",
      category: "domestic",
      name: "",
      ticker: "",
      quantity: 0,
      averagePrice: 0,
      currentPrice: 0,
      currency: "KRW",
      purchaseDate: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const isForeignStock = selectedCategory === "foreign";
  const isUnlisted = selectedCategory === "unlisted";
  const isEtfCategory = selectedCategory === "irp" || selectedCategory === "isa" || selectedCategory === "pension";
  const watchedCurrency = form.watch("currency");

  const getTickerPlaceholder = () => {
    if (selectedCategory === "domestic") return "예: 005930 (삼성전자)";
    if (selectedCategory === "foreign") return "예: AAPL (애플)";
    if (isEtfCategory) return "예: 360750 (TIGER 미국S&P500)";
    if (isUnlisted) return "예: 비상장 종목명 또는 코드";
    return "종목코드 입력";
  };

  const getNamePlaceholder = () => {
    if (selectedCategory === "domestic") return "예: 삼성전자";
    if (selectedCategory === "foreign") return "예: Apple Inc.";
    if (isEtfCategory) return "예: TIGER 미국S&P500";
    if (isUnlisted) return "예: (주)비상장기업";
    return "종목명 입력";
  };

  const getTickerDescription = () => {
    if (selectedCategory === "domestic") return "국내 주식 6자리 숫자를 입력하세요. (예: 삼성전자 005930)";
    if (selectedCategory === "foreign") return "미국 등 해외주식 티커를 입력하세요. (예: AAPL, TSLA)";
    if (isEtfCategory) return "국내 상장 ETF 종목코드 6자리를 입력하세요. (예: S&P500 ETF → 360750)";
    if (isUnlisted) return "비상장 주식은 증권 API 조회가 불가합니다. 종목코드 또는 식별 코드를 자유롭게 입력하세요.";
    return "";
  };

  const onSubmit = async (data: Stock) => {
    // 1차: 신규 입력 시 조회를 하지 않은 경우 등록 차단
    if (!editData && !isUnlisted && lookupState === "idle") {
      toast.error("티커 조회를 먼저 진행해주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateStock(editData.id, data);
        if (success) {
          toast.success("주식 정보가 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const newData = {
          ...data,
          id: `stock_${Date.now()}`,
        };
        const success = addStock(newData);
        if (success) {
          toast.success("주식이 추가되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      }
    } catch (error) {
      toast.error("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>카테고리</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedCategory(value as Stock["category"]);
                  form.setValue("currency", "KRW");
                  setLookupState(value === "unlisted" ? "success" : "idle");
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="주식 카테고리 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {stockCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>티커 (종목코드) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder={getTickerPlaceholder()}
                        maxLength={selectedCategory === "foreign" ? 5 : isUnlisted ? 20 : 6}
                        inputMode={isForeignStock || isUnlisted ? "text" : "numeric"}
                        {...field}
                        onChange={(e) => {
                          const val = selectedCategory === "foreign"
                            ? e.target.value.toUpperCase().replace(/[^A-Z]/g, "")
                            : e.target.value;
                          field.onChange(val);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {!editData && !isUnlisted && (
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3"
              disabled={isFetchingPrice}
              onClick={async () => {
                // 500 에러 횟수 체크
                const errorCount = parseInt(localStorage.getItem("finance_api_error_count") || "0");
                if (errorCount >= 3) {
                  toast.error("연속된 서버 오류로 조회가 비활성화되었습니다. 직접 입력해 주세요.");
                  return;
                }

                const ticker = form.getValues("ticker");
                const category = form.getValues("category");
                const normalized = normalizeTicker({ ticker, category });

                if (!normalized) {
                  toast.error("올바른 티커 형식을 입력해주세요.");
                  return;
                }

                setIsFetchingPrice(true);
                try {
                  const res = await fetch(`/api/finance?type=stock&tickers=${normalized}`);

                  if (res.status === 500) {
                    const newCount = errorCount + 1;
                    localStorage.setItem("finance_api_error_count", newCount.toString());
                    toast.error(`서버 오류 발생 (${newCount}/3)`);
                    return;
                  }

                  // 성공 시 에러 카운트 초기화
                  localStorage.removeItem("finance_api_error_count");

                  const data = await res.json();

                  if (data && data[normalized]) {
                    form.setValue("currentPrice", data[normalized].price);
                    // 해외주식: API 반환 name 그대로 사용
                    // 국내 등: 종목코드·심볼 형식("005930", "005930.KS")이면 무시
                    const fetchedName = data[normalized].name || "";
                    const isForeign = form.getValues("category") === "foreign";
                    const isCodeLike = /^\d{6}/.test(fetchedName) || /\.\w{2,}$/.test(fetchedName);
                    if (fetchedName && (isForeign || !isCodeLike)) {
                      form.setValue("name", fetchedName);
                    }
                    if (data[normalized].updated_at) {
                      form.setValue("baseDate", data[normalized].updated_at);
                    }
                    setLookupState("success");
                    toast.success("주식 정보를 성공적으로 가져왔습니다.");
                  } else if (data.error) {
                    setLookupState("failed");
                    toast.error(data.error);
                  } else {
                    setLookupState("failed");
                    toast.error("주식 정보를 찾을 수 없습니다.");
                  }
                } catch (e) {
                  setLookupState("failed");
                  toast.error("조회 중 오류가 발생했습니다.");
                } finally {
                  setIsFetchingPrice(false);
                }
              }}
            >
              {isFetchingPrice ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              <span className="ml-2 hidden sm:inline">조회</span>
            </Button>
          )}
        </div>

        <FormDescription className="text-[11px] leading-relaxed -mt-2">
          <span className="text-primary/70">{getTickerDescription()}</span>
        </FormDescription>

        {lookupState !== "idle" && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>종목명 *</FormLabel>
                <FormControl>
                  <Input placeholder={getNamePlaceholder()} {...field} />
                </FormControl>
                {lookupState === "failed" && (
                  <FormDescription className="text-[11px] text-amber-500">조회 실패 — 직접 입력해 주세요.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isForeignStock && (
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>통화</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="통화 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="KRW">원화 (KRW)</SelectItem>
                    <SelectItem value="USD">달러 (USD)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isForeignStock && watchedCurrency !== "KRW" && (
          <FormField
            control={form.control}
            name="purchaseExchangeRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>매입 환율</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={watchedCurrency === "JPY" ? "900" : "1300"}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>
                  {watchedCurrency === "JPY" ? "원/100엔 (예: 900)" : "원/달러 (예: 1380)"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={ASSET_THEME.important}>수량 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={[]}
                    allowDecimals={isForeignStock}
                    maxDecimals={isForeignStock ? 2 : undefined}
                  />
                </FormControl>
                <FormDescription className="mt-1.5">{isForeignStock ? "소수점 2자리 가능" : "주"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="averagePrice"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={ASSET_THEME.important}>평균단가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    placeholder="0"
                    quickButtons={isForeignStock ? [] : stockQuickButtons}
                    allowDecimals={isForeignStock}
                    maxDecimals={isForeignStock ? 2 : undefined}
                  />
                </FormControl>
                <FormDescription>{form.watch("currency")} {isForeignStock && "(소수점 2자리 가능)"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {lookupState !== "idle" && (
          <FormField
            control={form.control}
            name="currentPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>현재가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    placeholder="0"
                    quickButtons={isForeignStock ? [] : stockQuickButtons}
                    allowDecimals={isForeignStock}
                    maxDecimals={isForeignStock ? 2 : undefined}
                  />
                </FormControl>
                <FormDescription>{form.watch("currency")} {isForeignStock && "(소수점 2자리 가능)"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="purchaseDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매수일 *</FormLabel>
              <FormControl>
                <Input type="date" className="w-full max-w-[160px] sm:max-w-full text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Textarea placeholder="추가 정보 입력..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || (!editData && !isUnlisted && lookupState === "idle")}
            title={(!editData && !isUnlisted && lookupState === "idle") ? "티커 조회를 먼저 진행해주세요" : undefined}
          >
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function StockInput() {
  const { assetData, deleteStock, exchangeRates } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Stock | undefined>();
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

  useEffect(() => {
    const handler = () => { setEditingItem(undefined); setIsDialogOpen(true); };
    window.addEventListener("trigger-add-stock", handler);
    return () => window.removeEventListener("trigger-add-stock", handler);
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const success = deleteStock(id);
      if (success) {
        toast.success("삭제되었습니다.");
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    }
  };

  const handleEdit = (item: Stock) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  const formatCurrencyDisplay = (value: number, currency: string = "KRW") => {
    if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return formatCurrency(value);
  };

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  const getCategoryLabel = (category: string) => {
    return stockCategories.find((c) => c.value === category)?.label || category;
  };

  // 매입 환율 기준 단위당 원화 환산율 (방어: 입력 없으면 현재 환율 → 환차익 0)
  const getPurchaseRatePerUnit = (stock: Stock): number => {
    if (!stock.purchaseExchangeRate || stock.purchaseExchangeRate <= 0) {
      return getMultiplier(stock.currency);
    }
    return stock.currency === "JPY" ? stock.purchaseExchangeRate / 100 : stock.purchaseExchangeRate;
  };

  const getStocksByCategory = (category: string) => {
    let stocks = assetData.stocks;
    if (category !== "all") {
      stocks = stocks.filter((stock) => stock.category === category);
    }

    // 평가금액(현재가 * 수량 * 환율) 순으로 내림차순 정렬
    return [...stocks].sort((a, b) => {
      const valA = a.quantity * a.currentPrice * getMultiplier(a.currency);
      const valB = b.quantity * b.currentPrice * getMultiplier(b.currency);
      return valB - valA;
    });
  };

  const renderStockList = (stocks: Stock[]) => {
    if (stocks.length === 0) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">등록된 주식이 없습니다.</p>
            <p className="text-muted-foreground mt-1 text-xs">'주식 추가' 버튼을 눌러 추가해 보세요.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-4 lg:gap-5">
        {stocks.map((item) => {
          const krwMultiplier = getMultiplier(item.currency);
          const isForeign = item.category === "foreign" && item.currency !== "KRW";
          const purchaseRatePerUnit = getPurchaseRatePerUnit(item);

          const totalCostInCurrency = item.quantity * item.averagePrice;
          const currentValueInCurrency = item.quantity * item.currentPrice;

          const currentValueInKRW = currentValueInCurrency * krwMultiplier;
          // 해외주식: 매입원가는 매입 환율 기준으로 환산 (환차손익 정확 반영)
          const totalCostInKRW = isForeign
            ? totalCostInCurrency * purchaseRatePerUnit
            : totalCostInCurrency * krwMultiplier;

          const profitInKRW = currentValueInKRW - totalCostInKRW;
          const profitRate = totalCostInKRW > 0 ? (profitInKRW / totalCostInKRW) * 100 : 0;

          const holdingDays = calculateHoldingDays(item.purchaseDate);
          const currencyGain = isForeign
            ? (krwMultiplier - purchaseRatePerUnit) * item.quantity * item.averagePrice
            : 0;
          const currencyGainRate =
            isForeign && purchaseRatePerUnit > 0
              ? ((krwMultiplier - purchaseRatePerUnit) / purchaseRatePerUnit) * 100
              : 0;


          return (
            <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Layer 1: 종목 헤더 */}
              <div className={`${ASSET_THEME.inputHeader}`}>
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <Badge variant="outline" className={ASSET_THEME.categoryBox}>
                    {getCategoryLabel(item.category)}
                  </Badge>
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.ticker && (
                    <span className="text-muted-foreground text-xs font-mono shrink-0">({item.ticker})</span>
                  )}
                  {item.baseDate === todayStr && (
                    <span className={`${ASSET_THEME.todayBox}`}>
                      조회 기준일: {item.baseDate}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => handleEdit(item)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Layer 2: 핵심 지표 */}
              <div className="flex flex-row items-start justify-between sm:justify-start gap-4 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">평가금액</span>
                  <span className={`text-medium font-bold ${ASSET_THEME.important}`}>
                    {formatCurrencyDisplay(currentValueInKRW)}
                  </span>
                </div>
                <span className="hidden sm:inline text-border self-center">|</span>
                <div className="flex flex-col items-end sm:items-start gap-0.5">
                  <span className="text-xs text-muted-foreground">평가손익</span>
                  <span className={`text-medium font-bold ${getProfitLossColor(profitInKRW)}`}>
                    {formatCurrencyDisplay(profitInKRW)}
                  </span>
                  <span className={`text-xs font-semibold ${getProfitLossColor(profitInKRW)}`}>
                    ({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(2)}%)
                  </span>
                  {isForeign && (
                    <span className={`text-xs font-medium ${getProfitLossColor(currencyGain)}`}>
                      (환차손익 {formatCurrencyDisplay(Math.round(currencyGain))} 포함)
                    </span>
                  )}
                </div>
              </div>

              {/* Layer 3: 가격 비교 */}
              <div className="px-4 py-3 bg-muted/10 border-t">
                <div className="flex items-start sm:items-center justify-between sm:justify-start gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">평균단가</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrencyDisplay(item.averagePrice, item.currency)}
                      {isForeign && (
                        <span className="text-xs text-muted-foreground">
                          &nbsp;(₩{(item.averagePrice * krwMultiplier).toLocaleString('ko-KR', { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-border self-center">|</span>
                  <div className="flex flex-col gap-0.5 items-end sm:items-start">
                    <span className="text-xs text-muted-foreground">현재가</span>
                    <span className="text-sm font-semibold text-primary">
                      {formatCurrencyDisplay(item.currentPrice, item.currency)}
                      {isForeign && (
                        <span className="text-xs text-muted-foreground">
                          &nbsp;(₩{(item.currentPrice * krwMultiplier).toLocaleString('ko-KR', { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Layer 3b: 환차손익 (해외주식 외화 종목만) */}
              {isForeign && (
                <div className="px-4 py-3 bg-muted/10 border-t">
                  <div className="flex items-start sm:items-center justify-between sm:justify-start gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">환차손익</span>
                      <span className={`text-sm font-semibold ${getProfitLossColor(currencyGain)}`}>
                        {formatCurrencyDisplay(Math.round(currencyGain))}
                        <span className="text-xs ml-1">
                          ({currencyGainRate >= 0 ? "+" : ""}{currencyGainRate.toFixed(2)}%)
                        </span>
                      </span>
                    </div>
                    <span className="hidden sm:inline text-border self-center">|</span>
                    <div className="flex flex-col gap-0.5 items-end sm:items-start">
                      <span className="text-xs text-muted-foreground">매입환율</span>
                      <span className="text-xs text-foreground">
                        {item.purchaseExchangeRate && item.purchaseExchangeRate > 0
                          ? item.currency === "JPY"
                            ? `¥100 = ₩${item.purchaseExchangeRate.toLocaleString()}`
                            : `$1 = ₩${item.purchaseExchangeRate.toLocaleString()}`
                          : "미입력 (현재환율 기준)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Layer 4: 연계 주식담보대출 */}
              {(() => {
                const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === item.id);
                if (linkedLoans.length === 0) return null;
                return (
                  <div className="px-4 py-2.5 border-t space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground">주식담보대출</p>
                    {linkedLoans.map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between text-xs rounded-md bg-rose-500/5 border border-rose-200/30 dark:border-rose-900/30 px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CreditCard className="size-3 text-rose-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">{loan.name}</span>
                          {loan.institution && (
                            <span className="hidden sm:inline text-muted-foreground">({loan.institution})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                            -{formatCurrency(loan.balance)}
                          </span>
                          <span className="text-muted-foreground">{loan.interestRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Layer 5: 보조 정보 */}
              <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t bg-muted/5">
                <span className="flex items-center gap-1">
                  <span>수량</span>
                  <span className={`font-medium font-semibold text-foreground ${ASSET_THEME.primary.text}`}>{item.quantity.toLocaleString()}주</span>
                </span>
                <span className="hidden sm:inline text-border">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  <span className="font-medium text-foreground">{holdingDays.toLocaleString()}일 보유</span>
                </span>
                <span className="hidden sm:inline text-border">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  <span className="font-medium text-foreground">{item.purchaseDate} 매수</span>
                </span>
                {item.description && (
                  <span className="w-full mt-0.5 text-primary truncate">
                    # {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5" />
                  <CardTitle>주식 자산</CardTitle>
                </div>
              </div>
              <CardDescription>보유하고 있는 주식 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  주식 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "주식 수정" : "주식 추가"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "주식 정보를 수정합니다." : "새로운 주식 자산을 추가합니다."}
                  </DialogDescription>
                </DialogHeader>
                <StockForm editData={editingItem} onClose={handleDialogClose} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4 grid w-full grid-cols-7 h-13 p-1 gap-1">
              {(
                [
                  { value: "all", icon: LayoutGrid, label: "전체" },
                  { value: "domestic", icon: Flag, label: "국내" },
                  { value: "foreign", icon: Globe, label: "해외" },
                  { value: "irp", icon: Landmark, label: "IRP" },
                  { value: "isa", icon: Coins, label: "ISA" },
                  { value: "pension", icon: ShieldCheck, label: "연금" },
                  { value: "unlisted", icon: Lock, label: "비상장" },
                ] as const
              ).map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={[
                    "h-10 py-1",
                    "bg-muted/60 text-muted-foreground border border-border py-2 cursor-pointer transition-all",
                    "hover:bg-accent hover:text-foreground hover:border-primary/50",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary",
                    "dark:data-[state=active]:bg-primary/30 dark:data-[state=active]:text-foreground dark:data-[state=active]:border-primary",
                  ].join(" ")}
                >
                  <span className="text-xs sm:text-sm">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="all">
              {(() => {
                if (assetData.stocks.length === 0) return renderStockList([]);

                // 평가금액(현재가 * 수량 * 환율) 순으로 내림차순 정렬
                const sortedStocks = [...assetData.stocks].sort((a, b) => {
                  const valA = a.quantity * a.currentPrice * getMultiplier(a.currency);
                  const valB = b.quantity * b.currentPrice * getMultiplier(b.currency);
                  if (Math.abs(valA - valB) > 0.01) return valB - valA;

                  // 금액이 같으면 이름순
                  return a.name.localeCompare(b.name);
                });

                // 카테고리별로 그룹화
                const grouped = sortedStocks.reduce(
                  (acc, stock) => {
                    if (!acc[stock.category]) acc[stock.category] = [];
                    acc[stock.category].push(stock);
                    return acc;
                  },
                  {} as Record<string, Stock[]>,
                );

                return (
                  <div className="space-y-8">
                    {stockCategories
                      .filter((cat) => grouped[cat.value])
                      .map((cat) => (
                        <div key={cat.value} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm font-bold ${ASSET_THEME.categoryBox}`}>{cat.label}</h3>
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground">{grouped[cat.value].length}개 항목</span>
                          </div>
                          {renderStockList(grouped[cat.value])}
                        </div>
                      ))}
                  </div>
                );
              })()}
            </TabsContent>
            <TabsContent value="domestic">{renderStockList(getStocksByCategory("domestic"))}</TabsContent>
            <TabsContent value="foreign">{renderStockList(getStocksByCategory("foreign"))}</TabsContent>
            <TabsContent value="irp">{renderStockList(getStocksByCategory("irp"))}</TabsContent>
            <TabsContent value="isa">{renderStockList(getStocksByCategory("isa"))}</TabsContent>
            <TabsContent value="pension">{renderStockList(getStocksByCategory("pension"))}</TabsContent>
            <TabsContent value="unlisted">{renderStockList(getStocksByCategory("unlisted"))}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
