"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAssetData } from "@/contexts/asset-data-context";
import type { Cash, CashTransaction } from "@/types/asset";
import { TRANSACTION_RETENTION_YEARS } from "@/lib/trade-utils";
import { findDuplicateCashTx, isCashWithdrawalValid } from "@/lib/cash-tx-utils";
import { formatCurrencyDisplay } from "../../../views/detail/asset-detail-tabs";

const cashTxFormSchema = z.object({
  cashId: z.string().min(1, "계좌를 선택해주세요"),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.number().min(0).refine((v) => v > 0, "금액을 입력해주세요"),
  date: z.string().min(1, "날짜를 선택해주세요"),
  recurring: z.boolean(),
  memo: z.string().optional(),
  reflected: z.boolean(),
});

type CashTxFormValues = z.infer<typeof cashTxFormSchema>;

export function CashTxInput() {
  const { assetData, addCashTransaction, addCashTransactionWithBalance } = useAssetData();
  const [isOpen, setIsOpen] = useState(false);
  const [lockedCash, setLockedCash] = useState(false); // 특정 계좌 사전선택 진입
  const [dupPending, setDupPending] = useState<{ tx: CashTransaction; cash: Cash } | null>(null);

  const cashAccounts = assetData.cash;

  const form = useForm<CashTxFormValues>({
    resolver: zodResolver(cashTxFormSchema),
    defaultValues: {
      cashId: "",
      type: "deposit",
      amount: 0,
      date: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0],
      recurring: false,
      memo: "",
      reflected: true,
    },
  });

  const selectedCashId = form.watch("cashId");
  const txType = form.watch("type");
  const reflected = form.watch("reflected");
  const selectedCash = cashAccounts.find((c) => c.id === selectedCashId);
  const isForeign = selectedCash?.currency !== "KRW";

  // 스냅샷·다른 "오늘" 계산과 동일하게 KST 기준 — UTC 자정 기준이면 한국시간 00~09시에 기록한
  // 거래가 하루 전 날짜로 저장돼 원인분해(income)에서 누락되고 "현금 잔액 직접 수정"으로 잘못 잡힌다.
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - TRANSACTION_RETENTION_YEARS);
    return d.toISOString().split("T")[0];
  })();

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.cashId;
      if (id) {
        setLockedCash(true);
        form.setValue("cashId", id);
      } else {
        setLockedCash(false);
      }
      setIsOpen(true);
    };
    window.addEventListener("trigger-add-cash-tx", handler);
    return () => window.removeEventListener("trigger-add-cash-tx", handler);
  }, [form]);

  const resetAndClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
    setLockedCash(false);
    setDupPending(null);
  }, [form]);

  const buildTx = (data: CashTxFormValues): CashTransaction => {
    const cash = cashAccounts.find((c) => c.id === data.cashId)!;
    return {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cashId: data.cashId,
      type: data.type,
      amount: data.amount,
      currency: cash.currency || "KRW",
      recurring: data.type === "deposit" ? data.recurring : undefined,
      date: data.date,
      memo: data.memo,
      reflected: data.reflected,
      reflectedAt: data.reflected ? new Date().toISOString() : undefined,
      reflectionId: data.reflected ? `ref_${Date.now()}` : undefined,
      createdAt: new Date().toISOString(),
    };
  };

  // 반영 시 계좌 잔액 패치 (입금=+ / 출금=−)
  const balancePatch = (tx: CashTransaction, cash: Cash): Partial<Cash> => ({
    balance: cash.balance + (tx.type === "deposit" ? tx.amount : -tx.amount),
  });

  const onSubmit = (data: CashTxFormValues) => {
    const cash = cashAccounts.find((c) => c.id === data.cashId);
    if (!cash) return;

    // 출금 반영 초과 가드 (주식 oversell 대칭)
    if (data.reflected && data.type === "withdrawal" && !isCashWithdrawalValid(cash.balance, data.amount)) {
      form.setError("amount", { message: `현재 잔액(${formatCurrencyDisplay(cash.balance, cash.currency)})을 초과합니다` });
      return;
    }

    const tx = buildTx(data);
    const dup = findDuplicateCashTx(assetData.cashTransactions || [], {
      cashId: tx.cashId, date: tx.date, amount: tx.amount, type: tx.type,
    });
    if (dup) {
      setDupPending({ tx, cash });
      return;
    }
    commit(tx, cash);
  };

  const commit = (tx: CashTransaction, cash: Cash) => {
    const ok = tx.reflected
      ? addCashTransactionWithBalance(tx, cash.id, balancePatch(tx, cash))
      : addCashTransaction(tx);
    if (ok) {
      toast.success(tx.type === "deposit" ? "입금이 기록되었습니다." : "출금이 기록되었습니다.");
      resetAndClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle>입출금 기록</DialogTitle>
        </DialogHeader>

        {!dupPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 계좌 선택 (사전선택 진입 시 숨김) */}
              {!lockedCash && (
                <FormItem>
                  <FormLabel>계좌</FormLabel>
                  <Select value={selectedCashId} onValueChange={(v) => form.setValue("cashId", v)}>
                    <SelectTrigger><SelectValue placeholder="계좌 선택" /></SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}

              {selectedCash && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium truncate">{selectedCash.name}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">잔액 {formatCurrencyDisplay(selectedCash.balance, selectedCash.currency)}</span>
                </div>
              )}

              {/* 입금/출금 토글 */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>유형</FormLabel>
                    <div className="flex gap-2">
                      <Button type="button" variant={field.value === "deposit" ? "brand" : "secondary"} className="flex-1" onClick={() => field.onChange("deposit")}>입금</Button>
                      <Button type="button" variant={field.value === "withdrawal" ? "brand" : "secondary"} className="flex-1" onClick={() => field.onChange("withdrawal")}>출금</Button>
                    </div>
                  </FormItem>
                )}
              />

              {/* 금액 */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>금액 {isForeign ? `(${selectedCash?.currency})` : "(원)"}</FormLabel>
                    <FormControl>
                      <NumberInput value={field.value} onChange={field.onChange} allowDecimals={isForeign} maxDecimals={isForeign ? 2 : 0} quickButtons={[]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 정기/비정기 (입금 시만) */}
              {txType === "deposit" && (
                <FormField
                  control={form.control}
                  name="recurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="leading-none">
                        <FormLabel className="text-sm font-medium cursor-pointer">매월 정기 입금 (월급·목돈)</FormLabel>
                        <p className="text-sm text-muted-foreground mt-0.5">해제 시 비정기(성과급 등)로 기록됩니다</p>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {/* 날짜 */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>날짜</FormLabel>
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
                    <FormControl><Textarea placeholder="입출금 메모" className="resize-none" rows={2} {...field} /></FormControl>
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
                      <FormLabel className="text-sm font-medium cursor-pointer">현재 잔액에 즉시 반영</FormLabel>
                      <p className="text-sm text-muted-foreground mt-0.5">해제 시 기록만 남기고 잔액은 변경하지 않습니다 (과거 소급용)</p>
                    </div>
                  </FormItem>
                )}
              />

              {reflected && selectedCash && form.watch("amount") > 0 && (
                <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 text-sm">
                  <p className="text-muted-foreground">반영 후 예상 잔액</p>
                  <p className="tabular-nums mt-0.5">
                    <span className="text-muted-foreground">{formatCurrencyDisplay(selectedCash.balance, selectedCash.currency)}</span>
                    <span className="text-muted-foreground/60"> → </span>
                    <span className="font-semibold">{formatCurrencyDisplay(selectedCash.balance + (txType === "deposit" ? form.watch("amount") : -form.watch("amount")), selectedCash.currency)}</span>
                  </p>
                </div>
              )}

              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" variant="brand">{txType === "deposit" ? "입금 기록" : "출금 기록"}</Button>
                <Button type="button" variant="secondary" onClick={resetAndClose}>취소</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* 중복 확인 인라인 */}
        {dupPending && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 p-3 space-y-1 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-500">이미 동일한 입출금이 있습니다</p>
              <p className="text-muted-foreground">계좌·날짜·금액·유형이 동일한 기록이 이미 있습니다.</p>
              <p className="tabular-nums">{dupPending.tx.type === "deposit" ? "입금" : "출금"} · {dupPending.tx.date} · {formatCurrencyDisplay(dupPending.tx.amount, dupPending.tx.currency)}</p>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="brand" onClick={() => { setDupPending(null); toast.success("기존 기록을 유지했습니다."); resetAndClose(); }}>기존 유지</Button>
              <Button type="button" variant="secondary" onClick={() => { if (dupPending) commit(dupPending.tx, dupPending.cash); }}>새로 추가</Button>
              <Button type="button" variant="secondary" onClick={() => setDupPending(null)}>취소</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
