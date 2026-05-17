"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeTicker } from "@/lib/finance-service";
import { STORAGE_KEYS } from "@/lib/local-storage";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { MAIN_PALETTE } from "@/config/theme";
import { stockCategories, quickButtonPresets, securitiesFirms } from "@/config/asset-options";
import { StockScreenshotImport } from "../screenshot/stock-screenshot-import";

const stockQuickButtons = [...quickButtonPresets.stock];

interface StockFormProps {
  editData?: Stock;
  onClose: () => void;
}

function StockForm({ editData, onClose }: StockFormProps) {
  const { addStock, updateStock, exchangeRates } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Stock["category"]>(editData?.category || "domestic");
  const [lookupState, setLookupState] = useState<"idle" | "success" | "failed">(
    editData ? "success" : "idle"
  );
  const [avgPriceInKrw, setAvgPriceInKrw] = useState(false);

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
    if (selectedCategory === "domestic") return "국내 주식 6자리 영문+숫자를 입력하세요. (예: 삼성전자 005930, ETF 0117V0)";
    if (selectedCategory === "foreign") return "미국 등 해외주식 티커를 입력하세요. (예: AAPL, TSLA, BRK/B)";
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
    // 해외주식 원화 입력 시 달러 환산
    if (isForeignStock && avgPriceInKrw) {
      const usdRate = exchangeRates.USD;
      if (!usdRate) { toast.error("환율 정보를 불러오지 못했습니다."); return; }
      data = {
        ...data,
        currency: "USD",
        averagePrice: Math.round(data.averagePrice / usdRate * 10000) / 10000,
        purchaseExchangeRate: data.purchaseExchangeRate || usdRate,
      };
    } else if (isForeignStock) {
      data = { ...data, currency: "USD" };
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
                  form.setValue("currency", value === "foreign" ? "USD" : "KRW");
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
                        maxLength={isUnlisted ? 20 : selectedCategory === "foreign" ? 8 : 6}
                        inputMode="text"
                        {...field}
                        onChange={(e) => {
                          const val = isUnlisted
                            ? e.target.value
                            : selectedCategory === "foreign"
                              ? e.target.value.toUpperCase().replace(/[^A-Z0-9./]/g, "").replace(/\./g, "/").slice(0, 8)
                              : e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
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
              className="h-9 px-3 text-white hover:opacity-90 border-none"
              style={{ backgroundColor: MAIN_PALETTE[0] }}
              disabled={isFetchingPrice}
              onClick={async () => {
                // 500 에러 횟수 체크
                const errorCount = parseInt(localStorage.getItem(STORAGE_KEYS.financeApiErrorCount) || "0");
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
                    localStorage.setItem(STORAGE_KEYS.financeApiErrorCount, newCount.toString());
                    toast.error(`서버 오류 발생 (${newCount}/3)`);
                    return;
                  }

                  // 성공 시 에러 카운트 초기화
                  localStorage.removeItem(STORAGE_KEYS.financeApiErrorCount);

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
            name="purchaseExchangeRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>매입 환율</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={String(exchangeRates.USD || 1380)}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>원/달러 (예: {exchangeRates.USD ? Math.round(exchangeRates.USD).toLocaleString() : "1380"})</FormDescription>
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
                <FormLabel style={{ color: MAIN_PALETTE[10] }}>수량 *</FormLabel>
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
                <div className="flex items-center justify-between">
                  <FormLabel style={{ color: MAIN_PALETTE[10] }}>평균단가 *</FormLabel>
                  {isForeignStock && (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={avgPriceInKrw}
                        onCheckedChange={(v) => setAvgPriceInKrw(!!v)}
                        className="size-3.5"
                      />
                      원화로 입력
                    </label>
                  )}
                </div>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    placeholder="0"
                    quickButtons={isForeignStock && avgPriceInKrw ? stockQuickButtons : isForeignStock ? [] : stockQuickButtons}
                    allowDecimals={isForeignStock && !avgPriceInKrw}
                    maxDecimals={isForeignStock && !avgPriceInKrw ? 3 : undefined}
                  />
                </FormControl>
                <FormDescription>
                  {isForeignStock
                    ? avgPriceInKrw
                      ? `KRW — 저장 시 달러로 환산 (현재 환율 ÷ ${exchangeRates.USD ? Math.round(exchangeRates.USD).toLocaleString() : "..."})`
                      : "USD (소수점 3자리 가능)"
                    : "KRW"}
                </FormDescription>
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
                    maxDecimals={isForeignStock ? 3 : undefined}
                  />
                </FormControl>
                <FormDescription>{isForeignStock ? "USD (소수점 3자리 가능)" : "KRW"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="broker"
          render={({ field }) => (
            <FormItem>
              <FormLabel>증권사</FormLabel>
              <Select onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)} value={field.value || "__none__"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="선택 안 함" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  {securitiesFirms.map((group) => (
                    group.items.map((firm) => (
                      <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                    ))
                  ))}
                </SelectContent>
              </Select>
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
            className="text-white hover:opacity-90 border-none"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
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
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Stock | undefined>();
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
  const [activeTab] = useState("all");

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode;
      if (mode === "screenshot") {
        setIsScreenshotOpen(true);
      } else {
        setEditingItem(undefined);
        setIsDialogOpen(true);
      }
    };
    window.addEventListener("trigger-add-stock", handler);
    return () => window.removeEventListener("trigger-add-stock", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      const item = assetData.stocks.find((s) => s.id === id);
      if (item) {
        setEditingItem(item);
        setIsDialogOpen(true);
      }
    };
    window.addEventListener("trigger-edit-stock", handler);
    return () => window.removeEventListener("trigger-edit-stock", handler);
  }, [assetData.stocks]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  return (
    <>
      <StockScreenshotImport open={isScreenshotOpen} onOpenChange={setIsScreenshotOpen} activeTab={activeTab} />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
    </>
  );
}
