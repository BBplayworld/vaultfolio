"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Bitcoin, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

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
import { Crypto, cryptoSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { cryptoExchanges as exchanges, popularCryptos } from "@/config/asset-options";

interface CryptoFormProps {
  editData?: Crypto;
  onClose: () => void;
}

function CryptoForm({ editData, onClose }: CryptoFormProps) {
  const { addCrypto, updateCrypto } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<string>(editData?.symbol || "");

  const form = useForm<Crypto>({
    resolver: zodResolver(cryptoSchema),
    defaultValues: editData || {
      id: "",
      name: "",
      symbol: "",
      quantity: 0,
      averagePrice: 0,
      currentPrice: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
      exchange: "",
      description: "",
    },
  });

  const handleCryptoSelect = (symbol: string) => {
    setSelectedCrypto(symbol);
    const crypto = popularCryptos.find(c => c.symbol === symbol);
    if (crypto && crypto.symbol !== "other") {
      form.setValue("symbol", crypto.symbol);
      form.setValue("name", crypto.name);
    } else {
      form.setValue("symbol", "");
      form.setValue("name", "");
    }
  };

  const onSubmit = async (data: Crypto) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateCrypto(editData.id, data);
        if (success) {
          toast.success("암호화폐 정보가 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const newData = {
          ...data,
          id: `crypto_${Date.now()}`,
        };
        const success = addCrypto(newData);
        if (success) {
          toast.success("암호화폐 정보가 추가되었습니다.");
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
          name="symbol"
          render={() => (
            <FormItem>
              <FormLabel>암호화폐 선택 *</FormLabel>
              <Select
                onValueChange={(value) => {
                  handleCryptoSelect(value);
                }}
                defaultValue={selectedCrypto || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="암호화폐 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {popularCryptos.map((crypto) => (
                    <SelectItem key={crypto.symbol} value={crypto.symbol}>
                      {crypto.symbol === "other" ? crypto.name : `${crypto.name} (${crypto.symbol})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedCrypto === "other" && (
          <>
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>심볼 *</FormLabel>
                  <FormControl>
                    <Input placeholder="예: BTC" {...field} />
                  </FormControl>
                  <FormDescription>암호화폐 심볼 (예: BTC, ETH, XRP)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>암호화폐명 *</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 비트암호화폐" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="exchange"
          render={({ field }) => (
            <FormItem>
              <FormLabel>거래소</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="거래소 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {exchanges.map((exchange) => (
                    <SelectItem key={exchange.value} value={exchange.label}>
                      {exchange.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>수량 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={[]}
                    allowDecimals={true}
                  />
                </FormControl>
                <FormDescription>소수점 입력 가능</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="averagePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>평균단가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={[]}
                  />
                </FormControl>
                <FormDescription>원</FormDescription>
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
                  onChange={field.onChange}
                  placeholder="0"
                  quickButtons={[]}
                />
              </FormControl>
              <FormDescription>원</FormDescription>
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

export function CryptoInput() {
  const { assetData, deleteCrypto } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Crypto | undefined>();

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const success = deleteCrypto(id);
      if (success) {
        toast.success("삭제되었습니다.");
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    }
  };

  const handleEdit = (item: Crypto) => {
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

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Bitcoin className="size-5" />
                암호화폐 자산
              </CardTitle>
              <CardDescription>보유하고 있는 암호화폐 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  암호화폐 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto touch-pan-y">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "암호화폐 수정" : "암호화폐 추가"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "암호화폐 정보를 수정합니다." : "새로운 암호화폐 자산을 추가합니다."}
                  </DialogDescription>
                </DialogHeader>
                <CryptoForm editData={editingItem} onClose={handleDialogClose} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {assetData.crypto.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">등록된 암호화폐가 없습니다.</p>
                <p className="text-muted-foreground mt-1 text-xs">'암호화폐 추가' 버튼을 눌러 추가해 보세요.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {assetData.crypto.map((item) => {
                const totalCost = item.quantity * item.averagePrice;
                const currentValue = item.quantity * item.currentPrice;
                const profit = currentValue - totalCost;
                const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
                const holdingDays = calculateHoldingDays(item.purchaseDate);

                return (
                  <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                    {/* Layer 1: 종목 헤더 */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-b">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <Badge variant="outline" className={ASSET_THEME.categoryBox}>
                          {item.symbol}
                        </Badge>
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        {item.exchange && (
                          <span className="text-muted-foreground text-xs shrink-0">({item.exchange})</span>
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
                          {formatCurrencyDisplay(currentValue)}
                        </span>
                      </div>
                      <span className="hidden sm:inline text-border self-center">|</span>
                      <div className="flex flex-col items-end sm:items-start gap-1">
                        <span className="text-xs text-muted-foreground">평가손익</span>
                        <span className={`text-medium font-bold ${getProfitLossColor(profit)}`}>
                          {formatCurrencyDisplay(profit)}
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${getProfitLossColor(profit)}`}>
                            &nbsp;({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Layer 3: 가격 비교 */}
                    <div className="px-4 py-3 bg-muted/10 border-t">
                      <div className="flex items-start sm:items-center justify-between sm:justify-start gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">평균단가</span>
                          <span className="text-sm font-medium text-foreground">{formatCurrencyDisplay(item.averagePrice)}</span>
                        </div>
                        <span className="hidden sm:inline text-border self-center">|</span>
                        <div className="flex flex-col gap-0.5 items-end sm:items-start">
                          <span className="text-xs text-muted-foreground">현재가</span>
                          <span className="text-sm font-semibold text-primary">
                            {formatCurrencyDisplay(item.currentPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Layer 4: 보조 정보 */}
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t bg-muted/5">
                      <span className="flex items-center gap-1">
                        <span>수량</span>
                        <span className="font-medium font-semibold text-primary">
                          {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} 개
                        </span>
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
                        <span className="w-full mt-0.5 text-muted-foreground truncate">
                          # {item.description}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
