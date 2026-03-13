"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Bitcoin } from "lucide-react";
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
import { Crypto, cryptoSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";

// 주요 거래소 목록
const exchanges = [
  { value: "upbit", label: "업비트" },
  { value: "bithumb", label: "빗썸" },
  { value: "coinone", label: "코인원" },
  { value: "korbit", label: "코빗" },
  { value: "binance", label: "바이낸스" },
  { value: "bybit", label: "바이비트" },
  { value: "okx", label: "OKX" },
  { value: "coinbase", label: "코인베이스" },
  { value: "kraken", label: "크라켄" },
  { value: "other", label: "기타" },
] as const;

// 주요 암호화폐 목록
const popularCryptos = [
  { symbol: "BTC", name: "비트코인" },
  { symbol: "ETH", name: "이더리움" },
  { symbol: "XRP", name: "리플" },
  { symbol: "ADA", name: "카르다노" },
  { symbol: "SOL", name: "솔라나" },
  { symbol: "DOGE", name: "도지코인" },
  { symbol: "MATIC", name: "폴리곤" },
  { symbol: "DOT", name: "폴카닷" },
  { symbol: "AVAX", name: "아발란체" },
  { symbol: "LINK", name: "체인링크" },
  { symbol: "UNI", name: "유니스왑" },
  { symbol: "ATOM", name: "코스모스" },
  { symbol: "LTC", name: "라이트코인" },
  { symbol: "BCH", name: "비트코인캐시" },
  { symbol: "NEAR", name: "니어프로토콜" },
  { symbol: "APT", name: "앱토스" },
  { symbol: "ARB", name: "아비트럼" },
  { symbol: "OP", name: "옵티미즘" },
  { symbol: "SUI", name: "수이" },
  { symbol: "HBAR", name: "헤데라" },
  { symbol: "other", name: "직접 입력" },
] as const;

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
          toast.success("코인 정보가 수정되었습니다.");
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
          toast.success("코인이 추가되었습니다.");
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
          render={({ field }) => (
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
                  <FormDescription>코인 심볼 (예: BTC, ETH, XRP)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>코인명 *</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 비트코인" {...field} />
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
                코인 자산
              </CardTitle>
              <CardDescription>보유하고 있는 암호화폐 자산을 관리합니다.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingItem(undefined)}>
                  <Plus className="mr-2 size-4" />
                  코인 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "코인 수정" : "코인 추가"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "코인 정보를 수정합니다." : "새로운 암호화폐 자산을 추가합니다."}
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
                <p className="text-muted-foreground text-sm">등록된 코인이 없습니다.</p>
                <p className="text-muted-foreground text-xs">위의 버튼을 눌러 코인을 추가하세요.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {assetData.crypto.map((item) => {
                const totalCost = item.quantity * item.averagePrice;
                const currentValue = item.quantity * item.currentPrice;
                const profit = currentValue - totalCost;
                const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
                const holdingDays = calculateHoldingDays(item.purchaseDate);

                return (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3">
                      {/* 제목과 버튼 영역 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <span className="rounded bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600">
                            {item.symbol}
                          </span>
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.exchange && (
                            <span className="text-muted-foreground text-xs">({item.exchange})</span>
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
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">수량:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${ASSET_THEME.asset.strong}`}>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} 개</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">평균단가:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${ASSET_THEME.primary.text}`}>{formatCurrencyDisplay(item.averagePrice)}</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">현재가:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{formatCurrencyDisplay(item.currentPrice)}</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">평가금액:</span>{" "}
                            <span className="font-medium text-right sm:text-left">{formatCurrencyDisplay(currentValue)}</span>
                          </div>
                          <div className="flex justify-between gap-2 sm:block">
                            <span className="text-muted-foreground whitespace-nowrap">평가손익:</span>{" "}
                            <span className={`font-medium text-right sm:text-left ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {formatCurrencyDisplay(profit)} ({profit > 0 ? "+" : ""}
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
