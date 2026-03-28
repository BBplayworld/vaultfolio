"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, TrendingUp, Search, Loader2, LayoutGrid, Flag, Globe, Landmark, Coins, ShieldCheck, Lock } from "lucide-react";
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
import { Stock, stockSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

const stockCategories = [
  { value: "domestic", label: "국내주식" },
  { value: "foreign", label: "해외주식" },
  { value: "irp", label: "IRP" },
  { value: "isa", label: "ISA" },
  { value: "pension", label: "연금저축펀드" },
  { value: "unlisted", label: "비상장주식" },
] as const;

// 주식 가격 빠른 입력 버튼 (백만원 단위)
const stockQuickButtons = [
  { label: "10만", value: 100000 },
  { label: "50만", value: 500000 },
  { label: "100만", value: 1000000 },
  { label: "500만", value: 5000000 },
];

interface StockFormProps {
  editData?: Stock;
  onClose: () => void;
}

function StockForm({ editData, onClose }: StockFormProps) {
  const { addStock, updateStock } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Stock["category"]>(editData?.category || "domestic");

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

  const onSubmit = async (data: Stock) => {
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
                        placeholder={selectedCategory === "foreign" ? "예: AAPL" : "예: 005930"}
                        maxLength={selectedCategory === "foreign" ? 5 : 6}
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
          {!editData && (
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
                    toast.success("주식 정보를 성공적으로 가져왔습니다.");
                  } else if (data.error) {
                    toast.error(data.error);
                  } else {
                    toast.error("주식 정보를 찾을 수 없습니다.");
                  }
                } catch (e) {
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
          {selectedCategory === "foreign" ? (
            <><span className="text-primary/70">미국 등 해외주식 티커를 입력하세요. (예: AAPL, TSLA)</span></>
          ) : (
            <>
              <span className="text-primary/70">국내 주식은 6자리 숫자를 입력하세요. (예: 삼성전자 005930)</span>
            </>
          )}
        </FormDescription>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>종목명 *</FormLabel>
              <FormControl>
                <Input placeholder="예: 삼성전자" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    <SelectItem value="JPY">엔화 (JPY)</SelectItem>
                  </SelectContent>
                </Select>
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
                <FormLabel className={ASSET_THEME.asset.strong}>수량 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={[]}
                    allowDecimals={isForeignStock}
                    maxDecimals={isForeignStock ? 1 : undefined}
                  />
                </FormControl>
                <FormDescription className="mt-1.5">{isForeignStock ? "소수점 1자리 가능" : "주"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="averagePrice"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={ASSET_THEME.asset.strong}>평균단가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    placeholder="0"
                    quickButtons={isForeignStock ? [] : stockQuickButtons}
                    allowDecimals={isForeignStock}
                    maxDecimals={isForeignStock ? 1 : undefined}
                  />
                </FormControl>
                <FormDescription>{form.watch("currency")} {isForeignStock && "(소수점 1자리 가능)"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  maxDecimals={isForeignStock ? 1 : undefined}
                />
              </FormControl>
              <FormDescription>{form.watch("currency")} {isForeignStock && "(소수점 1자리 가능)"}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="purchaseDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매수일 *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
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
          <Button type="submit" disabled={isSubmitting}>
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
      <div className="space-y-4">
        {stocks.map((item) => {
          const krwMultiplier = getMultiplier(item.currency);

          const totalCostInCurrency = item.quantity * item.averagePrice;
          const currentValueInCurrency = item.quantity * item.currentPrice;

          const totalCostInKRW = totalCostInCurrency * krwMultiplier;
          const currentValueInKRW = currentValueInCurrency * krwMultiplier;

          const profitInKRW = currentValueInKRW - totalCostInKRW;
          const profitRate = totalCostInKRW > 0 ? (profitInKRW / totalCostInKRW) * 100 : 0;

          const holdingDays = calculateHoldingDays(item.purchaseDate);
          const isForeign = item.category === "foreign" && item.currency !== "KRW";

          return (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3">
                {/* 제목과 버튼 영역 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {getCategoryLabel(item.category)}
                    </span>
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.ticker && <span className="text-muted-foreground text-xs">({item.ticker})</span>}
                    {item.baseDate === todayStr && (
                      <span>&nbsp;&nbsp;<span className="text-xs font-bold text-rose-500 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/20">조회 기준일: {item.baseDate}</span></span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* 내용 영역 */}
                <div className="w-full">
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
                    <div className="flex justify-between gap-2 sm:block">
                      <span className={`text-muted-foreground whitespace-nowrap`}>평균단가:</span>{" "}
                      <span className={`font-medium text-right sm:text-left`}>
                        {formatCurrencyDisplay(item.averagePrice, item.currency)}
                        {isForeign && (
                          <span className="text-muted-foreground text-xs ml-1">
                            (₩{(item.averagePrice * krwMultiplier).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">현재가:</span>{" "}
                      <span className={`font-medium text-right sm:text-left ${ASSET_THEME.primary.text}`}>
                        {formatCurrencyDisplay(item.currentPrice, item.currency)}
                        {isForeign && (
                          <span className="text-muted-foreground text-xs ml-1">
                            (₩{(item.currentPrice * krwMultiplier).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">수량:</span>{" "}
                      <span className={`font-medium text-right sm:text-left ${ASSET_THEME.asset.strong}`}>{item.quantity.toLocaleString()}주</span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">평가금액:</span>{" "}
                      <span className={`font-medium text-right sm:text-left ${ASSET_THEME.asset.strong}`}>{formatCurrencyDisplay(currentValueInCurrency, item.currency)} ({formatCurrencyDisplay(currentValueInKRW)})</span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">평가손익:</span>{" "}
                      <span className={`font-medium text-right sm:text-left ${getProfitLossColor(profitInKRW)}`}>
                        {formatCurrencyDisplay(profitInKRW)} ({profitRate > 0 ? "+" : ""}
                        {profitRate.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">보유일수:</span>{" "}
                      <span className="font-medium text-right sm:text-left">{holdingDays.toLocaleString()}일</span>
                    </div>
                    <div className="col-span-1 flex justify-between gap-2 sm:col-span-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">매수일:</span>{" "}
                      <span className="font-medium text-right sm:text-left">{item.purchaseDate}</span>
                    </div>
                  </div>
                  {item.description && <p className={`text-foreground mt-2 text-sm ${ASSET_THEME.primary.text}`}># {item.description}</p>}
                </div>
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
              <DialogContent className="max-h-[90vh] overflow-y-auto touch-pan-y">
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
                            <h3 className="text-sm font-bold text-muted-foreground">{cat.label}</h3>
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
