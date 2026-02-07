"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useAssetData } from "@/hooks/use-asset-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";

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
  const { addStock, updateStock, exchangeRate, setExchangeRate } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      averagePriceUSD: 0,
      currentPriceUSD: 0,
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
        {isForeignStock && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <FormLabel className="text-sm font-medium">환율 설정 (USD → KRW)</FormLabel>
            <div className="mt-2 flex items-center gap-2">
              <NumberInput
                value={exchangeRate}
                onChange={setExchangeRate}
                placeholder="1380"
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">원</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              해외주식의 USD 가격이 이 환율로 원화로 환산됩니다.
            </p>
          </div>
        )}

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

        <FormField
          control={form.control}
          name="ticker"
          render={({ field }) => (
            <FormItem>
              <FormLabel>티커</FormLabel>
              <FormControl>
                <Input placeholder="예: 005930" {...field} />
              </FormControl>
              <FormDescription>종목코드 또는 티커 심볼</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>수량 *</FormLabel>
                <FormControl>
                  <NumberInput value={field.value} onChange={field.onChange} placeholder="0" quickButtons={[]} />
                </FormControl>
                <FormDescription className="mt-1.5">주</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={isForeignStock ? "averagePriceUSD" : "averagePrice"}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>평균단가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      if (isForeignStock) {
                        form.setValue("averagePrice", value * exchangeRate);
                      }
                    }}
                    placeholder="0"
                    quickButtons={isForeignStock ? [] : stockQuickButtons}
                  />
                </FormControl>
                <FormDescription>{isForeignStock ? "USD" : "원"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={isForeignStock ? "currentPriceUSD" : "currentPrice"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>현재가 *</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    if (isForeignStock) {
                      form.setValue("currentPrice", value * exchangeRate);
                    }
                  }}
                  placeholder="0"
                  quickButtons={isForeignStock ? [] : stockQuickButtons}
                />
              </FormControl>
              <FormDescription>{isForeignStock ? "USD" : "원"}</FormDescription>
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
  const { assetData, deleteStock } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Stock | undefined>();

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

  const formatCurrencyDisplay = (value: number) => {
    return formatCurrency(value);
  };

  const getCategoryLabel = (category: string) => {
    return stockCategories.find((c) => c.value === category)?.label || category;
  };

  const getStocksByCategory = (category: string) => {
    return assetData.stocks.filter((stock) => stock.category === category);
  };

  const renderStockList = (stocks: Stock[]) => {
    if (stocks.length === 0) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">등록된 주식이 없습니다.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {stocks.map((item) => {
          const totalCost = item.quantity * item.averagePrice;
          const currentValue = item.quantity * item.currentPrice;
          const profit = currentValue - totalCost;
          const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
          const holdingDays = calculateHoldingDays(item.purchaseDate);
          const isForeign = item.category === "foreign";

          return (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex flex-1 gap-3">
                  <Avatar className="size-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {item.ticker?.substring(0, 2).toUpperCase() || item.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {getCategoryLabel(item.category)}
                      </span>
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.ticker && <span className="text-muted-foreground text-xs">({item.ticker})</span>}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">수량:</span>{" "}
                      <span className="font-medium text-right sm:text-left">{item.quantity.toLocaleString()}주</span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">평균단가:</span>{" "}
                      <span className="font-medium text-right sm:text-left">
                        {isForeign && item.averagePriceUSD ? (
                          <>
                            ${item.averagePriceUSD.toLocaleString()}
                            <span className="text-muted-foreground text-xs ml-1">
                              (₩{item.averagePrice.toLocaleString()})
                            </span>
                          </>
                        ) : (
                          formatCurrencyDisplay(item.averagePrice)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">현재가:</span>{" "}
                      <span className="font-medium text-right sm:text-left">
                        {isForeign && item.currentPriceUSD ? (
                          <>
                            ${item.currentPriceUSD.toLocaleString()}
                            <span className="text-muted-foreground text-xs ml-1">
                              (₩{item.currentPrice.toLocaleString()})
                            </span>
                          </>
                        ) : (
                          formatCurrencyDisplay(item.currentPrice)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">평가금액:</span>{" "}
                      <span className="font-medium text-right sm:text-left">{formatCurrencyDisplay(currentValue)}</span>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <span className="text-muted-foreground whitespace-nowrap">평가손익:</span>{" "}
                      <span className={`font-medium text-right sm:text-left ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {formatCurrencyDisplay(profit)} ({profitRate > 0 ? "+" : ""}
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
                  {item.description && <p className="text-muted-foreground mt-2 text-sm">{item.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="size-4" />
                  </Button>
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
            <div className="space-y-1.5">
              <CardTitle>주식 자산</CardTitle>
              <CardDescription>보유하고 있는 주식 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  주식 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <TabsList className="mb-4 grid w-full grid-cols-7">
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="domestic">국내</TabsTrigger>
              <TabsTrigger value="foreign">해외</TabsTrigger>
              <TabsTrigger value="irp">IRP</TabsTrigger>
              <TabsTrigger value="isa">ISA</TabsTrigger>
              <TabsTrigger value="pension">연금</TabsTrigger>
              <TabsTrigger value="unlisted">비상장</TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderStockList(assetData.stocks)}</TabsContent>
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
