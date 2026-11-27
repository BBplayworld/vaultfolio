"use client";

import { ResyncTxWarning } from "../resync-tx-warning";
import { lastRefreshedAt } from "@/lib/asset/asset-refresh-status";
import { shouldWarnTxAfterResync } from "@/lib/asset/balance-edits";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { track } from "@/lib/analytics/ga";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
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
import { TRANSACTION_RETENTION_YEARS } from "@/lib/trade/trade-utils";
import { todayKst } from "@/lib/tax-utils";
import { roundMoney } from "@/lib/trade/linked-record";
import { findDuplicateCashTx, isCashWithdrawalValid, isCashWithdrawalBelowFloor } from "@/lib/trade/cash-tx-utils";
import { formatCurrencyDisplay, groupStocksByTicker } from "../../../views/detail/asset-detail-tabs";
import type { CashTxDividendInput } from "@/lib/asset/cash-tx-tags";
import { DOT_WRAP_FIRST, DOT_WRAP_ROW, DotLead } from "../../../layout/ui/dot-wrap";
import { PastDateQuestion } from "../../common/past-date-question";
import { shouldAskPastDate } from "@/lib/trade/trade-form";
import { dividendQueryOptions } from "@/lib/finance/dividend-client";
import { latestPaidPayout, payoutMonthDay } from "@/lib/finance/dividend-calc";
import { dividendDateQueryArgs } from "../../../views/activity/use-dividend-data";
import { brokerCashDefault, nextAutoCash } from "@/lib/asset/broker-totals";

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

// 종목 칸의 '선택 안 함' 값(Radix Select는 빈 문자열 값을 받지 않는다)
const NO_STOCK = "none";
const KIND_BOX = "flex flex-row items-center gap-2 rounded-lg bg-muted/40 dark:bg-muted/20 p-3";
const KIND_LABEL = "flex min-h-10 min-w-0 flex-1 cursor-pointer flex-col justify-center leading-none";
const KIND_HELP = "mt-0.5 block text-sm leading-snug text-muted-foreground break-keep text-pretty";
// 정기 상자 도움말 2종 — 배당을 켜면 OFF 문구로 바뀐다(보이지 않는 쪽은 자리만 잡는다)
const RECURRING_HELP_ON = <>해제 시 <span className="whitespace-nowrap">비정기(성과급 등)로</span> 기록됩니다</>;
const RECURRING_HELP_OFF = "배당을 끄면 선택할 수 있어요";

export function CashTxInput() {
  const { assetData, addCashTransaction, addCashTransactionWithBalance } = useAssetData();
  const [isOpen, setIsOpen] = useState(false);
  const [lockedCash, setLockedCash] = useState(false); // 특정 계좌 사전선택 진입
  const [dupPending, setDupPending] = useState<{ tx: CashTransaction; cash: Cash; tag?: CashTxDividendInput } | null>(null);
  // 배당으로 받은 돈(#329) — 화면 상태일 뿐 현금 거래 레코드에는 들어가지 않는다(저장은 분리 키, cash-tx-tags)
  const [dividend, setDividend] = useState(false);
  const [dividendStock, setDividendStock] = useState(NO_STOCK);
  const [answered, setAnswered] = useState(false); // 과거 날짜 질문에 답했거나 체크박스를 직접 눌렀는지(화면 전용, 저장 0)
  const [dateStatus, setDateStatus] = useState(""); // 지급일 버튼을 누른 뒤 스크린리더 알림(화면 전용, #339)
  const [autoCashId, setAutoCashId] = useState<string | null>(null); // 증권사 현금 규칙이 채운 계좌 id(화면 전용, #339). 사용자가 계좌를 고르면 null

  const cashAccounts = assetData.cash;
  // 종목 칸 — 보유 주식을 티커 단위로, groupStocksByTicker 순서 그대로(정렬 신설 없음)
  const stockGroups = useMemo(() => groupStocksByTicker(assetData.stocks), [assetData.stocks]);
  const stockOptions = useMemo(
    () => Array.from(stockGroups.entries()).map(([key, items]) => ({ key, ticker: items[0].ticker || undefined, name: items[0].name || items[0].ticker || "" })),
    [stockGroups],
  );

  const form = useForm<CashTxFormValues>({
    resolver: zodResolver(cashTxFormSchema),
    defaultValues: {
      cashId: "",
      type: "deposit",
      amount: 0,
      date: todayKst(),
      recurring: false,
      memo: "",
      reflected: true,
    },
  });

  const openerRef = useRef<HTMLElement | null>(null);
  const cashAccountsRef = useRef(cashAccounts);
  cashAccountsRef.current = cashAccounts;
  const selectedCashId = form.watch("cashId");
  const txType = form.watch("type");
  const recurring = form.watch("recurring");
  const reflected = form.watch("reflected");
  const watchedDate = form.watch("date");
  const askPast = shouldAskPastDate({ date: watchedDate, today: todayKst() });
  // 질문이 떠 있고 아직 답하지 않았으면 경고는 숨긴다(질문과 겹치지 않게, ui.md 1절)
  const warnResync = (!askPast || answered) && shouldWarnTxAfterResync({ txDate: watchedDate, reflected, refreshedAtIso: lastRefreshedAt("cash") });
  const selectedCash = cashAccounts.find((c) => c.id === selectedCashId);
  const isForeign = !!selectedCash && selectedCash.currency !== "KRW"; // 계좌 미선택이면 원화 라벨(undefined 표시 방지)

  // 스냅샷·다른 "오늘" 계산과 동일하게 KST 기준 — UTC 자정 기준이면 한국시간 00~09시에 기록한
  // 거래가 하루 전 날짜로 저장돼 원인분해(income)에서 누락되고 "현금 잔액 직접 수정"으로 잘못 잡힌다.
  const todayStr = todayKst();
  const minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - TRANSACTION_RETENTION_YEARS);
    return d.toISOString().split("T")[0];
  })();

  // `M/D 지급일로` 버튼(#339) — 고른 종목의 배당 조회(배당 화면과 같은 쿼리 키·요청 형식)에서 확정·오늘 이전 최신 지급일.
  // 국내형 종목만 조회한다(해외 조회 날짜는 현지 기준일). 조회 중·실패·후보 없음이면 버튼 없음. 누를 때만 날짜를 바꾼다
  const pickedItems = dividend && dividendStock !== NO_STOCK ? stockGroups.get(dividendStock) : undefined;
  const dateArgs = txType === "deposit" && pickedItems ? dividendDateQueryArgs(pickedItems) : null;
  const dateQuery = useQuery({ ...dividendQueryOptions(dateArgs?.ticker ?? "", "domestic", "NAS"), enabled: !!dateArgs });
  const latestPaid = dateArgs && dateQuery.isSuccess ? latestPaidPayout(dateQuery.data, todayStr, minDate) : null;
  const [payM, payD] = latestPaid ? payoutMonthDay(latestPaid.payoutDate) : [0, 0];
  const dateApplied = !!latestPaid && watchedDate === latestPaid.payoutDate;
  const applyPayoutDate = () => {
    if (!latestPaid || dateApplied) return; // 적용됨 상태는 no-op(aria-disabled, GA 0)
    form.setValue("date", latestPaid.payoutDate, { shouldValidate: true });
    // 지표(#339): 버튼 누름 — category만(금액·종목·날짜 미전송)
    track("feature_use", { category: "cash_dividend_date" });
    setDateStatus(`날짜를 ${payM}월 ${payD}일로 바꿨어요`);
  };

  // 배당 종목 선택(#339) — 계좌 기본값은 여기서 1회 판정(effect 아님). 계좌 고정 진입·`선택 안 함`은 계좌를 건드리지 않는다.
  // 빈칸이거나 직전에 규칙이 채운 값일 때만 그 종목 증권사의 현금 계좌로(없으면 빈칸으로 되돌림). 금액 > 0이면 표시 통화가 바뀌는 교체는 하지 않는다
  const pickDividendStock = (v: string) => {
    setDividendStock(v);
    setDateStatus("");
    const items = v === NO_STOCK ? undefined : stockGroups.get(v);
    if (lockedCash || !items) return;
    const next = nextAutoCash({
      current: form.getValues("cashId"),
      auto: autoCashId,
      candidate: brokerCashDefault(items, cashAccounts),
      amount: form.getValues("amount"),
      cash: cashAccounts,
    });
    if (!next) return;
    form.setValue("cashId", next.cashId);
    setAutoCashId(next.auto);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ cashId?: string; dividend?: boolean }>).detail;
      // 배당 화면 칩에서 열림(#329): 입금·배당 체크로 시작. 현금 계좌가 1개면 그 계좌로 고정한다
      const id = detail?.cashId ?? (detail?.dividend && cashAccountsRef.current.length === 1 ? cashAccountsRef.current[0].id : undefined);
      if (id) {
        setLockedCash(true);
        form.setValue("cashId", id);
      } else {
        setLockedCash(false);
      }
      // 배당 화면 칩에서 열렸으면 닫힌 뒤 그 칩으로 포커스를 돌려준다(공용 Dialog는 열릴 때 포커스를 옮기지 않아 기본 복귀가 body로 간다)
      openerRef.current = detail?.dividend && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (detail?.dividend) {
        form.setValue("type", "deposit");
        form.setValue("recurring", false);
        setDividend(true);
        setDividendStock(NO_STOCK);
      }
      setIsOpen(true);
    };
    window.addEventListener("trigger-add-cash-tx", handler);
    return () => window.removeEventListener("trigger-add-cash-tx", handler);
  }, [form]);

  const toggleDividend = (on: boolean) => {
    setDividend(on);
    if (on) form.setValue("recurring", false); // 정기와 함께 켤 수 없다
    else setDividendStock(NO_STOCK);
  };

  const resetAndClose = useCallback(() => {
    form.reset();
    setIsOpen(false);
    setLockedCash(false);
    setDupPending(null);
    setAnswered(false);
    setDividend(false);
    setDividendStock(NO_STOCK);
    setDateStatus("");
    setAutoCashId(null);
  }, [form]);

  const buildTx = (data: CashTxFormValues): CashTransaction => {
    const cash = cashAccounts.find((c) => c.id === data.cashId)!;
    return {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cashId: data.cashId,
      type: data.type,
      amount: data.amount,
      currency: cash.currency || "KRW",
      recurring: data.type === "deposit" ? (dividend ? false : data.recurring) : undefined,
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
    balance: roundMoney(cash.balance + (tx.type === "deposit" ? tx.amount : -tx.amount), cash.currency || "KRW"),
  });

  const onSubmit = (data: CashTxFormValues) => {
    const cash = cashAccounts.find((c) => c.id === data.cashId);
    if (!cash) return;

    // 출금 반영 초과 가드 (주식 oversell 대칭)
    if (data.reflected && data.type === "withdrawal" && !isCashWithdrawalValid(cash.balance, data.amount)) {
      track("transaction_save", { asset_type: "cash", method: "manual", result: "blocked" });
      form.setError("amount", { message: `현재 잔액(${formatCurrencyDisplay(cash.balance, cash.currency)})을 초과합니다` });
      return;
    }
    // 전액 출금 → 잔액 0원은 저장할 수 없어 사전 차단
    if (data.reflected && data.type === "withdrawal" && isCashWithdrawalBelowFloor(cash.balance, data.amount, cash.currency)) {
      track("transaction_save", { asset_type: "cash", method: "manual", result: "blocked" });
      form.setError("amount", { message: `${cash.name} 잔액을 ${formatCurrencyDisplay(0, cash.currency)}으로 둘 수 없어요. 반영을 끄고 기록하거나 출금액을 줄여 주세요.` });
      return;
    }

    const tx = buildTx(data);
    // 배당 표시(#329) — 종목은 티커 + 지금 종목명만 넘긴다(금액·날짜는 거래 레코드에만 있다). 중복 확인을 거쳐도 그대로 실린다
    const picked = stockOptions.find((o) => o.key === dividendStock);
    const tag: CashTxDividendInput | undefined = dividend && data.type === "deposit"
      ? { ...(picked ? { stock: { ticker: picked.ticker, name: picked.name } } : {}) }
      : undefined;
    const dup = findDuplicateCashTx(assetData.cashTransactions || [], {
      cashId: tx.cashId, date: tx.date, amount: tx.amount, type: tx.type,
    });
    if (dup) {
      setDupPending({ tx, cash, tag });
      return;
    }
    commit(tx, cash, tag);
  };

  const commit = (tx: CashTransaction, cash: Cash, tag?: CashTxDividendInput) => {
    const ok = tx.reflected
      ? addCashTransactionWithBalance(tx, cash.id, balancePatch(tx, cash), tag)
      : addCashTransaction(tx, tag);
    if (ok) {
      track("transaction_save", { asset_type: "cash", method: "manual", result: tx.reflected ? "reflected" : "unreflected" });
      // 지표(#329): 배당 입금 기록 — category만(금액·종목·계좌 미전송)
      if (tag) track("feature_use", { category: "cash_dividend" });
      toast.success(tag ? "배당 입금을 기록했어요" : tx.type === "deposit" ? "입금을 기록했어요" : "출금을 기록했어요");
      resetAndClose();
    } else {
      toast.error("저장하지 못했어요. 입력값을 확인해 주세요.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto touch-pan-y"
        onCloseAutoFocus={(e) => {
          const opener = openerRef.current;
          openerRef.current = null;
          if (!opener?.isConnected) return; // 그 밖의 진입(FAB·현금 탭)은 기존 동작 그대로
          e.preventDefault();
          opener.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle>입출금 기록</DialogTitle>
        </DialogHeader>

        {!dupPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 계좌 칸 + 요약 상자 한 블록(#339, ui.md 3장) — 요약 상자는 항상 마운트하고 높이만 펼친다(design-system §6).
                  종목을 골라 계좌가 채워질 때 위쪽이 갑자기 늘어 방금 누른 칸이 튀지 않게. 간격 16px는 펼침 안쪽(빈 상태 높이 = 이전과 같음) */}
              <div data-testid="cash-tx-account-block">
                {/* 계좌 선택 (사전선택 진입 시 숨김) — 사용자가 고르면 규칙 값 표시를 지우고 이후 손대지 않는다 */}
                {!lockedCash && (
                  <FormItem>
                    <FormLabel>계좌</FormLabel>
                    <Select value={selectedCashId} onValueChange={(v) => { setAutoCashId(null); form.setValue("cashId", v); }}>
                      <SelectTrigger data-testid="cash-tx-account" data-autofill={selectedCashId && selectedCashId === autoCashId ? "broker" : "none"}><SelectValue placeholder="계좌 선택" /></SelectTrigger>
                      <SelectContent>
                        {cashAccounts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
                <div
                  inert={!selectedCash}
                  className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${selectedCash ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className={lockedCash ? "pt-0" : "pt-4"}>
                      {selectedCash && (
                        <div data-testid="cash-tx-account-summary" className="flex items-center gap-2 rounded-lg bg-muted/50 dark:bg-muted/40 px-3 py-2 text-sm">
                          <span className="font-medium truncate">{selectedCash.name}</span>
                          <span className="ml-auto text-muted-foreground shrink-0">잔액 {formatCurrencyDisplay(selectedCash.balance, selectedCash.currency)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 입금/출금 토글 */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>유형</FormLabel>
                    <div className="flex gap-2">
                      <Button type="button" variant={field.value === "deposit" ? "brand" : "secondary"} className="flex-1" onClick={() => field.onChange("deposit")}>입금</Button>
                      <Button type="button" variant={field.value === "withdrawal" ? "brand" : "secondary"} className="flex-1" onClick={() => { field.onChange("withdrawal"); toggleDividend(false); }}>출금</Button>
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
                    <FormMessage className="break-keep text-pretty" />
                  </FormItem>
                )}
              />

              {/* 입금 종류 (입금 시만) — 정기 / 배당은 함께 켤 수 없다. 배당을 켜면 정기는 해제·비활성(자리 유지, #329) */}
              {txType === "deposit" && (
                <div role="group" aria-label="입금 종류" data-testid="cash-tx-kind-group" className="space-y-2">
                  <div className={KIND_BOX}>
                    <Checkbox
                      id="cash-tx-recurring"
                      data-testid="cash-tx-recurring-check"
                      checked={!dividend && recurring}
                      disabled={dividend}
                      onCheckedChange={(v) => form.setValue("recurring", v === true)}
                      aria-describedby="cash-tx-recurring-help"
                    />
                    {/* label 단위로 두 상태를 겹친다(ui-review R1) — 보이는 묶음(제목 + 지금 도움말)과 자리만 잡는 묶음(제목 + 다른 상태 도움말).
                        긴 쪽이 높이를 정해 배당을 켜고 꺼도 상자 높이·아래 칸 위치가 그대로이고, 짧은 쪽은 세로 가운데라 체크박스 중심 = 글 중심 */}
                    <label htmlFor="cash-tx-recurring" className={`grid min-h-10 min-w-0 flex-1 items-center leading-none [&>*]:[grid-area:1/1] ${dividend ? "cursor-default" : "cursor-pointer"}`}>
                      <span className="flex flex-col">
                        <span className={`text-sm font-medium ${dividend ? "text-muted-foreground" : ""}`}>매월 정기 입금 (월급·목돈)</span>
                        <span id="cash-tx-recurring-help" data-testid="tx-help" className={KIND_HELP}>
                          {dividend ? RECURRING_HELP_OFF : RECURRING_HELP_ON}
                        </span>
                      </span>
                      <span aria-hidden className="invisible flex flex-col">
                        <span className="text-sm font-medium">매월 정기 입금 (월급·목돈)</span>
                        <span className={KIND_HELP}>{dividend ? RECURRING_HELP_ON : RECURRING_HELP_OFF}</span>
                      </span>
                    </label>
                  </div>
                  <div className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                    <div className="flex flex-row items-center gap-2">
                      <Checkbox
                        id="cash-tx-dividend"
                        data-testid="cash-tx-dividend-check"
                        checked={dividend}
                        onCheckedChange={(v) => toggleDividend(v === true)}
                        aria-describedby="cash-tx-dividend-help"
                      />
                      <label htmlFor="cash-tx-dividend" className={KIND_LABEL}>
                        <span className="text-sm font-medium">배당으로 받은 돈</span>
                        <span id="cash-tx-dividend-help" data-testid="cash-tx-dividend-help" className={KIND_HELP}>
                          <span className="whitespace-nowrap">성과 › 배당의</span> 받은 기록에 더해져요
                        </span>
                      </label>
                    </div>
                    {/* 종목 칸 — 항상 마운트하고 높이만 펼친다(design-system §6). 접힌 동안은 inert로 포커스·읽기에서 뺀다. 보유 주식 0이면 칸 없음 */}
                    {stockOptions.length > 0 && (
                      <div
                        inert={!dividend}
                        className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${dividend ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="space-y-2 pl-6 pt-3">
                            <label htmlFor="cash-tx-dividend-stock" className="block text-sm font-medium">종목 (선택)</label>
                            <Select value={dividendStock} onValueChange={pickDividendStock}>
                              <SelectTrigger
                                id="cash-tx-dividend-stock"
                                data-testid="cash-tx-dividend-stock"
                                className="relative w-full min-w-0 after:absolute after:inset-x-0 after:-inset-y-[3px] after:content-[''] [&>span]:truncate"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_STOCK}>선택 안 함</SelectItem>
                                {stockOptions.map((o) => (
                                  <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 날짜 */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    {/* 라벨 줄 오른쪽 `M/D 지급일로`(#339, ui.md 2장) — 24px 알약 + 음수 마진으로 라벨 줄 높이 유지, after로 히트 40px. 같은 요소에서 글자만 바뀐다(key 없음) */}
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel>날짜</FormLabel>
                      {latestPaid && (
                        <Button
                          type="button"
                          variant="secondary"
                          static={dateApplied}
                          data-testid="cash-tx-dividend-date-btn"
                          data-state={dateApplied ? "applied" : "ready"}
                          data-date={latestPaid.payoutDate}
                          aria-label={`${payM}/${payD} 지급일로 날짜 바꾸기`}
                          aria-disabled={dateApplied || undefined}
                          onClick={applyPayoutDate}
                          className={`relative -my-[5px] h-6 gap-1 rounded-full py-0 text-sm font-medium tabular-nums motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 after:absolute after:inset-x-0 after:-top-[13px] after:-bottom-[3px] after:content-[''] ${dateApplied ? "bg-transparent px-1.5 text-muted-foreground hover:bg-transparent has-[>svg]:px-1.5" : "px-2.5"}`}
                        >
                          {dateApplied && <Check aria-hidden className="size-3.5" />}
                          {payM}/{payD} 지급일로
                        </Button>
                      )}
                    </div>
                    <FormControl><Input type="date" min={minDate} max={todayStr} {...field} /></FormControl>
                    <span role="status" data-testid="cash-tx-dividend-date-status" className="sr-only">{dateApplied ? dateStatus : ""}</span>
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

              {/* 과거 날짜 질문 — 반영 체크박스 바로 위, 같은 reflected 값을 바꾸는 입구(#311) */}
              {askPast && (
                <PastDateQuestion
                  kind="cash"
                  answered={answered}
                  reflected={reflected}
                  onAnswer={(v) => { setAnswered(true); form.setValue("reflected", v); }}
                />
              )}

              {/* 반영 체크박스 */}
              <FormField
                control={form.control}
                name="reflected"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => { setAnswered(true); field.onChange(v); }} aria-describedby={warnResync ? "cash-tx-resync-warning-text" : undefined} /></FormControl>
                    <div className="leading-none">
                      <FormLabel className="text-sm font-medium cursor-pointer">현재 잔액에 즉시 반영</FormLabel>
                      <p data-testid="tx-help" className="text-sm text-muted-foreground mt-0.5 break-keep text-pretty">이미 잔액에 들어간 거래면 해제하세요. 기록만 남고 잔액은 그대로예요</p>
                    </div>
                  </FormItem>
                )}
              />

              <ResyncTxWarning
                category="cash"
                show={warnResync}
                refreshedAtIso={lastRefreshedAt("cash")}
                todayKst={todayStr}
                id="cash-tx-resync-warning-text"
              />

              {reflected && selectedCash && form.watch("amount") > 0 && (
                <div className="rounded-lg bg-muted/40 dark:bg-muted/25 p-3 text-sm">
                  <p className="text-muted-foreground">반영 후 예상 잔액</p>
                  <p className="tabular-nums mt-0.5">
                    <span className="text-muted-foreground">{formatCurrencyDisplay(selectedCash.balance, selectedCash.currency)}</span>
                    <span className="text-muted-foreground/60"> → </span>
                    <span className="font-semibold">{formatCurrencyDisplay(roundMoney(selectedCash.balance + (txType === "deposit" ? form.watch("amount") : -form.watch("amount")), selectedCash.currency || "KRW"), selectedCash.currency)}</span>
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
              <p data-testid="tx-help" className="text-muted-foreground break-keep text-pretty">계좌·날짜·금액·유형이 동일한 기록이 이미 있습니다.</p>
              {/* 조각마다 nowrap, 조각 사이에서만 줄바꿈. 가운뎃점은 뒤 조각 머리에 두고 줄 머리로 내려가면 잘려 보이지 않는다(dot-wrap, C152) */}
              <p data-testid="cash-tx-dup-summary" className={`flex flex-wrap gap-x-1 tabular-nums ${DOT_WRAP_ROW}`}>
                <span className={`whitespace-nowrap ${DOT_WRAP_FIRST}`}>{dupPending.tag ? "배당 입금" : dupPending.tx.type === "deposit" ? "입금" : "출금"}</span>
                <span className="whitespace-nowrap"><DotLead />{dupPending.tx.date}</span>
                <span className="whitespace-nowrap"><DotLead />{formatCurrencyDisplay(dupPending.tx.amount, dupPending.tx.currency)}</span>
              </p>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="brand" onClick={() => { setDupPending(null); toast.success("기존 기록을 그대로 뒀어요"); resetAndClose(); }}>기존 유지</Button>
              <Button type="button" variant="secondary" onClick={() => { if (dupPending) commit(dupPending.tx, dupPending.cash, dupPending.tag); }}>새로 추가</Button>
              <Button type="button" variant="secondary" onClick={() => setDupPending(null)}>취소</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
