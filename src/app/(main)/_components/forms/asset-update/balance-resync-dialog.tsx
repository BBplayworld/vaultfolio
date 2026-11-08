"use client";

// 현금·대출 잔액 맞추기(#93) — 카테고리 인자 1컴포넌트. FAB `직접 입력`(보유자)이 trigger-resync-balance로 연다.
// 저장은 getAssetData() 최신 목록에 applyBalanceEdits를 적용해 saveData 1회(C37). 합계·비중·순자산은 보여주지 않는다(C1).
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME } from "@/config/theme";
import { countAssets, track, trackAssetSave } from "@/lib/analytics/ga";
import { getAssetData } from "@/lib/asset/asset-storage";
import { markCategoryRefreshed } from "@/lib/asset/asset-refresh-status";
import {
  applyBalanceEdits, checkBalanceRow, formatBalanceText, maxDecimalsOf, orderBalanceRows, parseBalanceText, sanitizeBalanceText,
  type BalanceCategory, type BalanceCurrency,
} from "@/lib/asset/balance-edits";
import { getMultiplier } from "../../views/detail/asset-detail-tabs";

interface Row {
  id: string;
  name: string;
  balance: number;
  currency: BalanceCurrency;
}

const COPY = {
  cash: { title: "현금성 자산 잔액 맞추기", addLabel: "새 계좌 추가", addEvent: "trigger-add-cash" },
  loan: { title: "대출 잔액 맞추기", addLabel: "새 대출 추가", addEvent: "trigger-add-loan" },
} as const;

const fmtCurrent = (r: Row) => {
  const n = r.balance.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return r.currency === "KRW" ? `현재 ${n}원` : `현재 ${n} ${r.currency}`;
};

export function BalanceResyncDialog({ category }: { category: BalanceCategory }) {
  const { saveData, exchangeRates } = useAssetData();
  const copy = COPY[category];
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [flashCancel, setFlashCancel] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 열 때 1회: 최신 보유 목록을 읽어 행을 고정한다(열려 있는 동안 현재 값은 바뀌지 않음)
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ category?: BalanceCategory }>).detail?.category !== category) return;
      const fresh = getAssetData();
      const mul = (c?: string) => getMultiplier(c, exchangeRates);
      const list = category === "cash"
        ? orderBalanceRows("cash", fresh.cash, mul).map((c) => ({ id: c.id, name: c.name, balance: c.balance, currency: (c.currency ?? "KRW") as BalanceCurrency }))
        : orderBalanceRows("loan", fresh.loans, mul).map((l) => ({ id: l.id, name: l.name, balance: l.balance, currency: "KRW" as BalanceCurrency }));
      if (list.length === 0) {
        window.dispatchEvent(new CustomEvent(copy.addEvent, { detail: { mode: "manual" } }));
        return;
      }
      setRows(list);
      setTexts({});
      setSaveError("");
      setSaving(false);
      setOpen(true);
    };
    window.addEventListener("trigger-resync-balance", handler);
    return () => window.removeEventListener("trigger-resync-balance", handler);
  }, [category, copy.addEvent, exchangeRates]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const checks = useMemo(
    () => rows.map((r) => ({ row: r, next: parseBalanceText(texts[r.id] ?? ""), ...checkBalanceRow(category, r.balance, parseBalanceText(texts[r.id] ?? "")) })),
    [rows, texts, category],
  );
  const changedCount = checks.filter((c) => c.changed).length;
  const blocked = checks.some((c) => c.issue === "cash-zero");
  const canSave = changedCount > 0 && !blocked && !saving;

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    const edits: Record<string, number> = {};
    for (const c of checks) if (c.changed && c.next !== null && c.issue !== "cash-zero") edits[c.row.id] = c.next;
    // 저장 직전 최신 목록 기준으로 교체(렌더 시점 클로저 금지) — saveData는 1회
    const fresh = getAssetData();
    const cashRes = category === "cash" ? applyBalanceEdits(fresh.cash, edits) : null;
    const loanRes = category === "loan" ? applyBalanceEdits(fresh.loans, edits) : null;
    const applied = (cashRes ?? loanRes)?.applied ?? 0;
    if (applied === 0) {
      setSaving(false);
      setSaveError("바뀐 항목을 찾지 못했어요. 다시 열어 주세요");
      return;
    }
    const ok = saveData({ ...fresh, ...(cashRes ? { cash: cashRes.list } : {}), ...(loanRes ? { loans: loanRes.list } : {}) });
    if (!ok) {
      setSaving(false);
      setSaveError("저장하지 못했어요. 다시 시도해 주세요");
      return;
    }
    markCategoryRefreshed(category);
    trackAssetSave({ asset_type: category, method: "manual", result: "update" }, countAssets(fresh));
    track("feature_use", { category: "balance_resync" });
    toast(`잔액 ${applied}개를 고쳤어요`, { duration: 2500, closeButton: false });
    setSaving(false);
    setOpen(false);
  };

  // 변경 중에는 바깥 탭·Esc로 닫히지 않는다 — 취소 버튼에 짧은 링으로 안내
  const guard = (e: Event) => {
    if (changedCount === 0) return;
    e.preventDefault();
    setFlashCancel(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashCancel(false), 300);
  };

  const focusNext = (index: number) => {
    const inputs = bodyRef.current?.querySelectorAll<HTMLInputElement>("input[data-resync-input]");
    const next = inputs?.[index + 1];
    if (next) next.focus();
    else saveRef.current?.focus();
  };

  const goAdd = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(copy.addEvent, { detail: { mode: "manual" } }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="balance-resync-dialog"
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        onInteractOutside={guard}
        onEscapeKeyDown={guard}
      >
        <DialogHeader className="px-5 pt-5 pb-3 text-left">
          <DialogTitle className="text-base font-bold text-balance break-keep">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-pretty break-keep leading-relaxed">
            바뀐 잔액만 입력하세요. 입출금 기록은 생기지 않아요.
          </DialogDescription>
        </DialogHeader>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-themed px-5 pb-4 touch-pan-y">
          <ul className="divide-y divide-border/40">
            {checks.map(({ row, changed, issue }, i) => {
              const decimals = maxDecimalsOf(row.currency);
              const foreign = row.currency !== "KRW";
              const text = texts[row.id] ?? "";
              const errorId = `balance-resync-msg-${row.id}`;
              const isError = issue === "cash-zero";
              const isWarn = issue === "magnitude";
              return (
                <li key={row.id} data-testid={`balance-resync-row-${row.id}`} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium" title={row.name}>{row.name}</span>
                      {foreign && <span className="shrink-0 text-sm text-muted-foreground">{row.currency}</span>}
                      {changed && (
                        <span data-testid={`balance-resync-changed-${row.id}`} className="shrink-0 text-sm font-semibold text-brand motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">변경</span>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">{fmtCurrent(row)}</span>
                  </div>
                  <div className="relative">
                    {foreign && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{row.currency}</span>}
                    <Input
                      data-resync-input
                      data-testid={`balance-resync-input-${row.id}`}
                      inputMode={decimals > 0 ? "decimal" : "numeric"}
                      autoComplete="off"
                      placeholder="새 잔액"
                      aria-label={`${row.name} 새 잔액`}
                      aria-invalid={isError || undefined}
                      aria-describedby={issue ? errorId : undefined}
                      value={formatBalanceText(text)}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [row.id]: sanitizeBalanceText(e.target.value, decimals) }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNext(i); } }}
                      className={`h-10 text-right text-sm tabular-nums ${foreign ? "pl-12" : ""} ${changed ? "ring-1 ring-brand" : ""}`}
                    />
                  </div>
                  <div className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${issue ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden" aria-live="polite">
                      {issue && (
                        <p id={errorId} data-testid={`balance-resync-error-${row.id}`} className={`flex items-start gap-1.5 text-sm break-keep ${isError ? "text-destructive" : ""}`} style={isWarn ? { color: ASSET_THEME.importantHex } : undefined}>
                          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>
                            {isError ? "0원은 여기서 저장할 수 없어요" : "자릿수를 확인해 주세요"}
                            {isError && <span className="ml-1 text-muted-foreground">상세에서 관리할 수 있어요</span>}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            data-testid="balance-resync-add-link"
            disabled={changedCount > 0}
            onClick={goAdd}
            className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
            {copy.addLabel}
          </button>
        </div>

        <DialogFooter className="border-t border-border/40 px-5 pb-5 pt-3">
          {saveError && <p className="text-sm text-destructive sm:mr-auto sm:self-center" role="alert">{saveError}</p>}
          <Button ref={saveRef} type="button" variant="brand" data-testid="balance-resync-save" disabled={!canSave} onClick={handleSave} className="whitespace-nowrap tabular-nums">
            {saving && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
            {changedCount > 0 ? `바뀐 ${changedCount}개 저장` : "저장"}
          </Button>
          <Button type="button" variant="secondary" data-testid="balance-resync-cancel" onClick={() => setOpen(false)} className={flashCancel ? "motion-safe:ring-2 motion-safe:ring-ring/50" : ""}>
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
