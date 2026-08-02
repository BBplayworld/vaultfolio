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
import type { Loan, LoanTransaction } from "@/types/asset";
import { TRANSACTION_RETENTION_YEARS } from "@/lib/trade-utils";
import { findDuplicateLoanTx, isLoanRepaymentValid } from "@/lib/loan-tx-utils";
import { formatCurrency } from "@/lib/number-utils";

const loanTxFormSchema = z.object({
  loanId: z.string().min(1, "대출을 선택해주세요"),
  type: z.enum(["repay", "borrow"]),
  amount: z.number().min(0).refine((v) => v > 0, "금액을 입력해주세요"),
  date: z.string().min(1, "날짜를 선택해주세요"),
  memo: z.string().optional(),
  reflected: z.boolean(),
});

type LoanTxFormValues = z.infer<typeof loanTxFormSchema>;

export function LoanTxInput() {
  const { assetData, addLoanTransaction, addLoanTransactionWithBalance } = useAssetData();
  const [isOpen, setIsOpen] = useState(false);
  const [lockedLoan, setLockedLoan] = useState(false); // 특정 대출 사전선택 진입
  const [dupPending, setDupPending] = useState<{ tx: LoanTransaction; loan: Loan } | null>(null);

  const loans = assetData.loans;

  const form = useForm<LoanTxFormValues>({
    resolver: zodResolver(loanTxFormSchema),
    defaultValues: {
      loanId: "",
      type: "repay",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      memo: "",
      reflected: true,
    },
  });

  const selectedLoanId = form.watch("loanId");
  const txType = form.watch("type");
  const reflected = form.watch("reflected");
  const selectedLoan = loans.find((l) => l.id === selectedLoanId);

  const todayStr = new Date().toISOString().split("T")[0];
  const minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - TRANSACTION_RETENTION_YEARS);
    return d.toISOString().split("T")[0];
  })();

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.loanId;
      if (id) {
        setLockedLoan(true);
        form.setValue("loanId", id);
      } else {
        setLockedLoan(false);
      }
      setIsOpen(true);
    };
    window.addEventListener("trigger-add-loan-tx", handler);
    return () => window.removeEventListener("trigger-add-loan-tx", handler);
  }, [form]);

  const resetAndClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
    setLockedLoan(false);
    setDupPending(null);
  }, [form]);

  const buildTx = (data: LoanTxFormValues): LoanTransaction => ({
    id: `ltx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    loanId: data.loanId,
    type: data.type,
    amount: data.amount,
    date: data.date,
    memo: data.memo,
    reflected: data.reflected,
    reflectedAt: data.reflected ? new Date().toISOString() : undefined,
    reflectionId: data.reflected ? `ref_${Date.now()}` : undefined,
    createdAt: new Date().toISOString(),
  });

  // 반영 시 대출 잔액 패치 (상환=− / 추가대출=+)
  const balancePatch = (tx: LoanTransaction, loan: Loan): Partial<Loan> => ({
    balance: loan.balance + (tx.type === "repay" ? -tx.amount : tx.amount),
  });

  const onSubmit = (data: LoanTxFormValues) => {
    const loan = loans.find((l) => l.id === data.loanId);
    if (!loan) return;

    // 상환 반영 초과 가드 (현금 출금 가드 대칭)
    if (data.reflected && data.type === "repay" && !isLoanRepaymentValid(loan.balance, data.amount)) {
      form.setError("amount", { message: `현재 잔액(${formatCurrency(loan.balance)})을 초과합니다` });
      return;
    }

    const tx = buildTx(data);
    const dup = findDuplicateLoanTx(assetData.loanTransactions || [], {
      loanId: tx.loanId, date: tx.date, amount: tx.amount, type: tx.type,
    });
    if (dup) {
      setDupPending({ tx, loan });
      return;
    }
    commit(tx, loan);
  };

  const commit = (tx: LoanTransaction, loan: Loan) => {
    const ok = tx.reflected
      ? addLoanTransactionWithBalance(tx, loan.id, balancePatch(tx, loan))
      : addLoanTransaction(tx);
    if (ok) {
      toast.success(tx.type === "repay" ? "상환이 기록되었습니다." : "추가 대출이 기록되었습니다.");
      resetAndClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle>상환/대출 기록</DialogTitle>
        </DialogHeader>

        {!dupPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 대출 선택 (사전선택 진입 시 숨김) */}
              {!lockedLoan && (
                <FormItem>
                  <FormLabel>대출</FormLabel>
                  <Select value={selectedLoanId} onValueChange={(v) => form.setValue("loanId", v)}>
                    <SelectTrigger><SelectValue placeholder="대출 선택" /></SelectTrigger>
                    <SelectContent>
                      {loans.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}

              {selectedLoan && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium truncate">{selectedLoan.name}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">잔액 {formatCurrency(selectedLoan.balance)}</span>
                </div>
              )}

              {/* 상환/추가대출 토글 */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>유형</FormLabel>
                    <div className="flex gap-2">
                      <Button type="button" variant={field.value === "repay" ? "brand" : "secondary"} className="flex-1" onClick={() => field.onChange("repay")}>상환</Button>
                      <Button type="button" variant={field.value === "borrow" ? "brand" : "secondary"} className="flex-1" onClick={() => field.onChange("borrow")}>추가 대출</Button>
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
                    <FormLabel>금액 (원)</FormLabel>
                    <FormControl>
                      <NumberInput value={field.value} onChange={field.onChange} quickButtons={[]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormControl><Textarea placeholder="상환·대출 메모" className="resize-none" rows={2} {...field} /></FormControl>
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

              {reflected && selectedLoan && form.watch("amount") > 0 && (
                <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 text-sm">
                  <p className="text-muted-foreground">반영 후 예상 잔액</p>
                  <p className="tabular-nums mt-0.5">
                    <span className="text-muted-foreground">{formatCurrency(selectedLoan.balance)}</span>
                    <span className="text-muted-foreground/60"> → </span>
                    <span className="font-semibold">{formatCurrency(selectedLoan.balance + (txType === "repay" ? -form.watch("amount") : form.watch("amount")))}</span>
                  </p>
                </div>
              )}

              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" variant="brand">{txType === "repay" ? "상환 기록" : "추가 대출 기록"}</Button>
                <Button type="button" variant="secondary" onClick={resetAndClose}>취소</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* 중복 확인 인라인 */}
        {dupPending && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 p-3 space-y-1 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-500">이미 동일한 기록이 있습니다</p>
              <p className="text-muted-foreground">대출·날짜·금액·유형이 동일한 기록이 이미 있습니다.</p>
              <p className="tabular-nums">{dupPending.tx.type === "repay" ? "상환" : "추가 대출"} · {dupPending.tx.date} · {formatCurrency(dupPending.tx.amount)}</p>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="brand" onClick={() => { setDupPending(null); toast.success("기존 기록을 유지했습니다."); resetAndClose(); }}>기존 유지</Button>
              <Button type="button" variant="secondary" onClick={() => { if (dupPending) commit(dupPending.tx, dupPending.loan); }}>새로 추가</Button>
              <Button type="button" variant="secondary" onClick={() => setDupPending(null)}>취소</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
