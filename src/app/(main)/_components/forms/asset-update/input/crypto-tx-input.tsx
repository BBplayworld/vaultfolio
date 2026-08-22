"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { ImageUp, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAssetData } from "@/contexts/asset-data-context";
import type { Crypto, CryptoTransaction } from "@/types/asset";
import { computeNewPosition, findDuplicateTransaction, TRANSACTION_RETENTION_YEARS, type PositionLike } from "@/lib/trade/trade-utils";
import { validateReflection } from "@/lib/trade/validate-reflection";
import { formatCurrency } from "@/lib/number-utils";
import { CryptoTradeScreenshotImport } from "../../trade/crypto-trade-screenshot-import";

const cryptoTxFormSchema = z.object({
  cryptoId: z.string().min(1, "코인을 선택해주세요"),
  type: z.enum(["buy", "sell"]),
  quantity: z.number().min(0).refine((v) => v > 0, "수량을 입력해주세요"),
  price: z.number().min(0).refine((v) => v > 0, "체결 단가를 입력해주세요"),
  date: z.string().min(1, "날짜를 선택해주세요"),
  memo: z.string().optional(),
  reflected: z.boolean(),
});

type CryptoTxFormValues = z.infer<typeof cryptoTxFormSchema>;

// 코인 포지션(수량·평단) — 주식 PositionSnapshot과 동형이나 환율 개념이 없어 avgExchangeRate는
// 항상 0으로 둔다(trade-utils.ts의 PositionLike 구조만 충족하면 되므로 사용되지 않는다).
interface CryptoPosition extends PositionLike {
  cryptoId: string;
}

function getCryptoPosition(coin: Crypto): CryptoPosition {
  return {
    cryptoId: coin.id,
    quantity: coin.quantity,
    avgPrice: coin.averagePrice,
    avgExchangeRate: 0,
    source: coin.positionSource ?? "manual",
    effectiveDate: coin.positionEffectiveDate ?? coin.purchaseDate,
    lockedByManual: coin.positionSource === "manual" || !coin.positionSource,
  };
}

export function CryptoTxInput() {
  const { assetData, addCryptoTransaction, addCryptoTransactionWithPosition } = useAssetData();
  const [isOpen, setIsOpen] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [lockedCrypto, setLockedCrypto] = useState(false); // 특정 코인 사전선택 진입
  const [dupPending, setDupPending] = useState<{ tx: CryptoTransaction; coin: Crypto } | null>(null);

  const cryptoAssets = assetData.crypto;

  const form = useForm<CryptoTxFormValues>({
    resolver: zodResolver(cryptoTxFormSchema),
    defaultValues: {
      cryptoId: "",
      type: "buy",
      quantity: 0,
      price: 0,
      date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0],
      memo: "",
      reflected: true,
    },
  });

  const selectedCryptoId = form.watch("cryptoId");
  const txType = form.watch("type");
  const reflected = form.watch("reflected");
  const watchedQty = form.watch("quantity");
  const watchedPrice = form.watch("price");
  const selectedCrypto = cryptoAssets.find((c) => c.id === selectedCryptoId);

  // 반영 후 예상 포지션 인라인 미리보기 (주식 trade-input.tsx와 동일 패턴)
  const reflectionPreview = useMemo(() => {
    if (!reflected || !selectedCrypto || !(watchedQty > 0) || !(watchedPrice > 0)) return null;
    const pos = getCryptoPosition(selectedCrypto);
    if (txType === "sell" && watchedQty > pos.quantity) return { oversell: true as const };
    const tentativeTx = { type: txType, quantity: watchedQty, price: watchedPrice } as CryptoTransaction;
    return { before: pos, after: computeNewPosition(pos, tentativeTx) };
  }, [reflected, selectedCrypto, watchedQty, watchedPrice, txType]);

  // KST 기준(스냅샷·다른 "오늘" 계산과 동일 이유, cash-tx-input.tsx와 동형)
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - TRANSACTION_RETENTION_YEARS);
    return d.toISOString().split("T")[0];
  })();

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.cryptoId;
      if (id) {
        setMode("manual");
        setLockedCrypto(true);
        form.setValue("cryptoId", id);
      } else {
        setMode("select");
        setLockedCrypto(false);
      }
      setIsOpen(true);
    };
    window.addEventListener("trigger-add-crypto-tx", handler);
    return () => window.removeEventListener("trigger-add-crypto-tx", handler);
  }, [form]);

  const resetAndClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
    setMode("select");
    setLockedCrypto(false);
    setDupPending(null);
  }, [form]);

  const buildTx = (data: CryptoTxFormValues): CryptoTransaction => {
    const coin = cryptoAssets.find((c) => c.id === data.cryptoId)!;
    return {
      id: `crtx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cryptoId: data.cryptoId,
      symbol: coin.symbol,
      name: coin.name,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      date: data.date,
      memo: data.memo,
      reflected: data.reflected,
      reflectedAt: data.reflected ? new Date().toISOString() : undefined,
      reflectionId: data.reflected ? `ref_${Date.now()}` : undefined,
      createdAt: new Date().toISOString(),
    };
  };

  // 반영 시 코인에 적용할 포지션 패치(가중평균 재계산) — 주식 buildReflectionPatch와 동일 계약
  const buildReflectionPatch = (tx: CryptoTransaction, coin: Crypto): Partial<Crypto> => {
    const pos = getCryptoPosition(coin);
    const preview = computeNewPosition(pos, tx);
    return {
      quantity: preview.quantity,
      averagePrice: preview.avgPrice,
      positionSource: "computed",
      positionEffectiveDate: tx.date,
    };
  };

  const onSubmit = (data: CryptoTxFormValues) => {
    const coin = cryptoAssets.find((c) => c.id === data.cryptoId);
    if (!coin) return;

    const tx = buildTx(data);

    if (data.reflected) {
      const pos = getCryptoPosition(coin);
      const guard = validateReflection(tx, pos);
      if (guard.level === "restrict") {
        if (guard.reason === "oversell") {
          form.setError("quantity", { message: `보유 수량(${pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개)을 초과합니다` });
        } else if (guard.reason === "already_reflected") {
          toast.error("이미 반영된 거래입니다.");
        }
        return;
      }
    }

    const dup = findDuplicateTransaction(assetData.cryptoTransactions || [], "cryptoId", {
      assetId: tx.cryptoId, date: tx.date, quantity: tx.quantity, price: tx.price, type: tx.type,
    });
    if (dup) {
      setDupPending({ tx, coin });
      return;
    }
    commit(tx, coin);
  };

  const commit = (tx: CryptoTransaction, coin: Crypto) => {
    const ok = tx.reflected
      ? addCryptoTransactionWithPosition(tx, coin.id, buildReflectionPatch(tx, coin))
      : addCryptoTransaction(tx);
    if (ok) {
      toast.success(tx.type === "buy" ? "매수 거래가 기록되었습니다." : "매도 거래가 기록되었습니다.");
      resetAndClose();
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle>{mode === "select" ? "매수/매도 기록" : "매수/매도 직접 입력"}</DialogTitle>
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
                <p className="text-sm text-muted-foreground">체결 내역 화면 자동 인식</p>
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
                <p className="text-sm text-muted-foreground">매수/매도 거래 수동 입력</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}

        {mode === "manual" && !dupPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 코인 선택 (사전선택 진입 시 숨김) */}
              {!lockedCrypto && (
                <FormItem>
                  <FormLabel>코인</FormLabel>
                  <Select value={selectedCryptoId} onValueChange={(v) => form.setValue("cryptoId", v)}>
                    <SelectTrigger><SelectValue placeholder="코인 선택" /></SelectTrigger>
                    <SelectContent>
                      {cryptoAssets.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.symbol}){c.exchange ? ` · ${c.exchange}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}

              {selectedCrypto && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium truncate">{selectedCrypto.name} ({selectedCrypto.symbol})</span>
                  <span className="ml-auto text-muted-foreground shrink-0">보유 {selectedCrypto.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
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
                      <Button type="button" variant={field.value === "buy" ? "default" : "secondary"} className={field.value === "buy" ? "flex-1 bg-red-500 hover:bg-red-600 text-white" : "flex-1"} onClick={() => field.onChange("buy")}>매수</Button>
                      <Button type="button" variant={field.value === "sell" ? "default" : "secondary"} className={field.value === "sell" ? "flex-1 bg-blue-500 hover:bg-blue-600 text-white" : "flex-1"} onClick={() => field.onChange("sell")}>매도</Button>
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
                      <NumberInput value={field.value} onChange={field.onChange} allowDecimals maxDecimals={10} quickButtons={[]} />
                    </FormControl>
                    {txType === "sell" && selectedCrypto && (
                      <p className="text-sm text-muted-foreground">
                        보유: {selectedCrypto.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개
                        <button type="button" className="ml-2 text-primary underline" onClick={() => field.onChange(selectedCrypto.quantity)}>전량</button>
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
                    <FormLabel>체결 단가 (원)</FormLabel>
                    <FormControl>
                      <NumberInput value={field.value} onChange={field.onChange} quickButtons={[]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 체결일 */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>체결일</FormLabel>
                    <FormControl><Input type="date" min={minDate} max={todayStr} {...field} /></FormControl>
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
                    <FormControl><Textarea placeholder="거래 메모" className="resize-none" rows={2} {...field} /></FormControl>
                  </FormItem>
                )}
              />

              {/* 반영 체크박스 */}
              <FormField
                control={form.control}
                name="reflected"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="leading-none">
                      <FormLabel className="text-sm font-medium cursor-pointer">보유 수량에 즉시 반영</FormLabel>
                      <p className="text-sm text-muted-foreground mt-0.5">해제 시 거래 기록만 남기고 포지션은 변경하지 않습니다</p>
                    </div>
                  </FormItem>
                )}
              />

              {/* 반영 후 예상 포지션 미리보기 */}
              {reflectionPreview && selectedCrypto && (
                reflectionPreview.oversell ? (
                  <div className="rounded-lg bg-destructive/10 dark:bg-destructive/20 p-3 text-sm text-destructive font-medium">
                    보유 수량({selectedCrypto.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개)을 초과합니다
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">반영 후 예상 포지션</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-sm text-muted-foreground">보유 수량</p>
                        <p className="tabular-nums">
                          <span className="text-muted-foreground">{reflectionPreview.before.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}</span>
                          <span className="text-muted-foreground/60"> → </span>
                          <span className="font-semibold">{reflectionPreview.after.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">평단가</p>
                        <p className="tabular-nums">
                          <span className="text-muted-foreground">{formatCurrency(reflectionPreview.before.avgPrice)}</span>
                          <span className="text-muted-foreground/60"> → </span>
                          <span className="font-semibold">{formatCurrency(reflectionPreview.after.avgPrice)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" variant="brand">{txType === "buy" ? "매수 기록" : "매도 기록"}</Button>
                <Button type="button" variant="secondary" onClick={resetAndClose}>취소</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* 중복 확인 인라인 */}
        {dupPending && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 p-3 space-y-1 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-500">이미 동일한 거래가 있습니다</p>
              <p className="text-muted-foreground">코인·날짜·수량·체결가·유형이 동일한 기록이 이미 있습니다.</p>
              <p className="tabular-nums">
                {dupPending.tx.type === "buy" ? "매수" : "매도"} · {dupPending.tx.date} · {dupPending.tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개 · {formatCurrency(dupPending.tx.price)}
              </p>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="brand" onClick={() => { setDupPending(null); toast.success("기존 기록을 유지했습니다."); resetAndClose(); }}>기존 유지</Button>
              <Button type="button" variant="secondary" onClick={() => { if (dupPending) commit(dupPending.tx, dupPending.coin); }}>새로 추가</Button>
              <Button type="button" variant="secondary" onClick={() => setDupPending(null)}>취소</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <CryptoTradeScreenshotImport
      open={screenshotOpen}
      onOpenChange={setScreenshotOpen}
    />
    </>
  );
}
