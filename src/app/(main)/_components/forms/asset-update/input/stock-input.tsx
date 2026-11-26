"use client";

import { resolveQuotedName } from "@/lib/trade/new-stock";
import { useReturnFocusOnClose } from "@/lib/restore-focus";
import { markCategoryRefreshed } from "@/lib/asset/asset-refresh-status";
import { useState, useEffect } from "react";
import { countAssets, trackAssetSave } from "@/lib/analytics/ga";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { resyncNewPurchaseDate } from "@/lib/asset/resync/apply";
import { todayKst } from "@/lib/tax-utils";
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
import { HoldingsResyncDialog } from "../screenshot/holdings-resync-dialog";
import { TickerSearchField } from "../../common/ticker-search-field";

interface StockFormProps {
  editData?: Stock;
  onClose: () => void;
}

function StockForm({ editData, onClose }: StockFormProps) {
  const { addStock, updateStock, exchangeRates, assetData } = useAssetData();
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
      // 신규 기본값 = 올해 1월 1일(KST, #139와 동일). 수정 경로는 저장된 매수일 유지(editData)
      purchaseDate: resyncNewPurchaseDate(todayKst()),
      description: "",
    },
  });

  const isForeignStock = selectedCategory === "foreign";
  const isUnlisted = selectedCategory === "unlisted";
  const isEtfCategory = selectedCategory === "irp" || selectedCategory === "isa" || selectedCategory === "pension";

  const getTickerPlaceholder = () => {
    if (selectedCategory === "domestic") return "예: 삼성전자 또는 005930";
    if (selectedCategory === "foreign") return "예: 애플, Apple 또는 AAPL";
    if (isEtfCategory) return "예: TIGER 미국S&P500 또는 360750";
    if (isUnlisted) return "예: 비상장 종목명 또는 코드";
    return "종목명 또는 종목코드";
  };

  const getNamePlaceholder = () => {
    if (selectedCategory === "domestic") return "예: 삼성전자";
    if (selectedCategory === "foreign") return "예: Apple Inc.";
    if (isEtfCategory) return "예: TIGER 미국S&P500";
    if (isUnlisted) return "예: (주)비상장기업";
    return "종목명 입력";
  };

  const getTickerDescription = () => {
    if (selectedCategory === "domestic") return "종목명 또는 종목코드로 검색하세요. (예: 삼성전자 / 005930)";
    if (selectedCategory === "foreign") return "종목명(한글·영문) 또는 티커로 검색하세요. (예: 애플 / Apple / AAPL)";
    if (isEtfCategory) return "종목명 또는 ETF 종목코드로 검색하세요. (예: TIGER 미국S&P500 / 360750)";
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
          markCategoryRefreshed("stock");
          trackAssetSave({ asset_type: "stock", method: "manual", result: "update" }, countAssets(assetData));
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
          markCategoryRefreshed("stock");
          trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, countAssets(assetData));
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

  // 티커/종목명으로 현재가 조회 (조회 버튼·자동완성 선택 공용)
  const fetchPrice = async (ticker: string, category: string) => {
    const errorCount = parseInt(localStorage.getItem(STORAGE_KEYS.financeApiErrorCount) || "0");
    if (errorCount >= 3) {
      toast.error("연속된 서버 오류로 조회가 비활성화되었습니다. 직접 입력해 주세요.");
      return;
    }
    const normalized = normalizeTicker({ ticker, category: category as Stock["category"] });
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
      localStorage.removeItem(STORAGE_KEYS.financeApiErrorCount);
      const data = await res.json();
      if (data && data[normalized]) {
        form.setValue("currentPrice", data[normalized].price);
        // 해외주식: API 반환 name 그대로 사용 / 국내 등: 종목코드·심볼 형식이면 무시(공용 규칙)
        const resolvedName = resolveQuotedName(data[normalized].name, category);
        if (resolvedName) form.setValue("name", resolvedName);
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
    } catch {
      setLookupState("failed");
      toast.error("조회 중 오류가 발생했습니다.");
    } finally {
      setIsFetchingPrice(false);
    }
  };

  // ─── 종목명·코드 자동완성 검색(공용 TickerSearchField) — 선택하면 폼 값을 채우고 현재가를 조회 ───
  const searchMarket: "kr" | "us" | null =
    selectedCategory === "foreign" ? "us" : selectedCategory === "unlisted" ? null : "kr";

  const selectResult = (r: { ticker: string; name: string }) => {
    form.setValue("ticker", r.ticker);
    form.setValue("name", r.name);
    void fetchPrice(r.ticker, form.getValues("category"));
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
                  // 카테고리 전환 시 이전 종목코드·종목명·현재가 초기화
                  form.setValue("ticker", "");
                  form.setValue("name", "");
                  form.setValue("currentPrice", 0);
                  form.setValue("baseDate", "");
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
                  <FormLabel>{isUnlisted ? "티커 (종목코드) *" : "종목코드 · 종목명 검색 *"}</FormLabel>
                  <FormControl>
                    <TickerSearchField
                      market={searchMarket}
                      searchDisabled={!!editData}
                      resetKey={selectedCategory}
                      value={field.value ?? ""}
                      onValueChange={(val) => {
                        // 검색 겸용: 종목코드·종목명 모두 허용. 비상장은 자유 입력.
                        field.onChange(isUnlisted ? val : val.slice(0, 40));
                      }}
                      onSelect={selectResult}
                      inputRef={field.ref}
                      inputProps={{
                        name: field.name,
                        onBlur: field.onBlur,
                        placeholder: getTickerPlaceholder(),
                        maxLength: isUnlisted ? 20 : 40,
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {!editData && !isUnlisted && (
            <Button
              type="button"
              variant="brand"
              className="h-9 px-3"
              disabled={isFetchingPrice}
              onClick={() => { void fetchPrice(form.getValues("ticker") ?? "", form.getValues("category")); }}
            >
              {isFetchingPrice ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              <span className="ml-2 hidden sm:inline">조회</span>
            </Button>
          )}
        </div>

        <FormDescription className="text-sm leading-relaxed -mt-2">
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
                  <FormDescription className="text-sm text-amber-500">조회 실패 — 직접 입력해 주세요.</FormDescription>
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
                <FormLabel style={{ color: "var(--accent-teal)" }}>수량 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    maxLength={12}
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
                  <FormLabel style={{ color: "var(--accent-teal)" }}>평단가 *</FormLabel>
                  {isForeignStock && (
                    <label className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer select-none">
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
                    maxLength={15}
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
                    maxLength={15}
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
                <Input
                  type="date"
                  className="w-full text-sm"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e);
                  }}
                />
              </FormControl>
              {!editData && (
                <FormDescription className="break-keep text-pretty">기본값은 올해 1월 1일이에요. 실제 매수일을 알면 수정해 주세요.</FormDescription>
              )}
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

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            variant="brand"
            disabled={isSubmitting || (!editData && !isUnlisted && lookupState === "idle")}
            title={(!editData && !isUnlisted && lookupState === "idle") ? "티커 조회를 먼저 진행해주세요" : undefined}
          >
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


export function StockInput() {
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const returnFocus = useReturnFocusOnClose(isDialogOpen); // FAB 시트 경유로 열렸다면 닫힘 후 FAB로 복귀(#118)
  const [editingItem, setEditingItem] = useState<Stock | undefined>();
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);
  const [activeTab] = useState("all");
  // 보유 현황 맞추기 분기(#91): 스크린샷 대화상자를 열 때 주식 보유 ≥1건이면 새 대화상자, 아니면 기존 첫 등록. 열 때 1회 고정
  const [useResync, setUseResync] = useState(false);
  const [wasScreenshotOpen, setWasScreenshotOpen] = useState(false);
  const [initialBroker, setInitialBroker] = useState<string | undefined>(); // 증권사별 합계 행의 '맞추기'(#319) — 닫으면 사라진다
  if (isScreenshotOpen !== wasScreenshotOpen) {
    setWasScreenshotOpen(isScreenshotOpen);
    if (isScreenshotOpen) setUseResync(assetData.stocks.length > 0);
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode;
      if (mode === "screenshot") {
        const b = (e as CustomEvent).detail?.broker;
        setInitialBroker(typeof b === "string" && b ? b : undefined);
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
      {useResync ? (
        <HoldingsResyncDialog
          open={isScreenshotOpen}
          onOpenChange={(v) => {
            setIsScreenshotOpen(v);
            if (!v) setInitialBroker(undefined);
          }}
          initialBroker={initialBroker}
        />
      ) : (
        <StockScreenshotImport open={isScreenshotOpen} onOpenChange={setIsScreenshotOpen} activeTab={activeTab} />
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onCloseAutoFocus={returnFocus} className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
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
