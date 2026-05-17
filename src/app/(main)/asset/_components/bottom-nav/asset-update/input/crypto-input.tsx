"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import { Crypto, cryptoSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { cryptoExchanges as exchanges, popularCryptos } from "@/config/asset-options";
import { CryptoScreenshotImport } from "../screenshot/crypto-screenshot-import";
import { MAIN_PALETTE } from "@/config/theme";

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

  const getQuantityDescription = () => {
    if (selectedCrypto === "BTC") return "BTC (소수점 8자리 가능, 예: 0.00123456)";
    if (selectedCrypto === "ETH") return "ETH (소수점 8자리 가능, 예: 0.5)";
    if (selectedCrypto === "other" || !selectedCrypto) return "수량 (소수점 입력 가능)";
    return `${selectedCrypto} (소수점 입력 가능)`;
  };

  const getAvgPricePlaceholder = () => {
    if (selectedCrypto === "BTC") return "예: 130000000";
    if (selectedCrypto === "ETH") return "예: 4000000";
    if (selectedCrypto === "XRP") return "예: 3500";
    if (selectedCrypto === "SOL") return "예: 250000";
    return "0";
  };

  const getDescriptionPlaceholder = () => {
    if (selectedCrypto === "BTC") return "예: 장기 보유, 콜드월렛 보관";
    if (selectedCrypto === "ETH") return "예: 스테이킹 포함, 레저 보관";
    return "추가 정보 입력 (보관 방법, 메모 등)...";
  };

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel style={{ color: MAIN_PALETTE[10] }}>수량 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    quickButtons={[]}
                    allowDecimals={true}
                  />
                </FormControl>
                <FormDescription>{getQuantityDescription()}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="averagePrice"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel style={{ color: MAIN_PALETTE[10] }}>평균단가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={getAvgPricePlaceholder()}
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
                <Textarea placeholder={getDescriptionPlaceholder()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
            disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function CryptoInput() {
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Crypto | undefined>();
  const [isScreenshotOpen, setIsScreenshotOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode;
      setEditingItem(undefined);
      if (mode === "screenshot") {
        setIsScreenshotOpen(true);
      } else {
        setIsDialogOpen(true);
      }
    };
    window.addEventListener("trigger-add-crypto", handler);
    return () => window.removeEventListener("trigger-add-crypto", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const item = assetData.crypto.find((c) => c.id === id);
      if (item) { setEditingItem(item); setIsDialogOpen(true); }
    };
    window.addEventListener("trigger-edit-crypto", handler);
    return () => window.removeEventListener("trigger-edit-crypto", handler);
  }, [assetData.crypto]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  return (
    <>
      <CryptoScreenshotImport open={isScreenshotOpen} onOpenChange={setIsScreenshotOpen} />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
          <DialogHeader>
            <DialogTitle>{editingItem ? "암호화폐 수정" : "암호화폐 추가"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "암호화폐 정보를 수정합니다." : "새로운 암호화폐 자산을 추가합니다."}
            </DialogDescription>
          </DialogHeader>
          <CryptoForm editData={editingItem} onClose={handleDialogClose} />
        </DialogContent>
      </Dialog>
    </>
  );
}
