"use client";

// 끊긴 거래 다시 잇기(#147, 4.77) — 확인 화면 1개(종목 행 단위) → 적용 1회(저장 1회) → 결과·되돌리기·토스트.
// 계산은 `@/lib/asset/resync/relink`(순수)가 맡고, 이 파일은 상태·표시·저장 호출(클릭 핸들러에서만)만 한다.
// 홈 팁·거래내역 안내 줄이 `open-relink-dialog` 이벤트로 연다(RelinkHost는 (main) layout에 1회 마운트).
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssetData } from "@/contexts/asset-data-context";
import { track } from "@/lib/analytics/ga";
import { getAssetData } from "@/lib/asset/asset-storage";
import { applyRelink, buildUndoEntries, detectRelink, planUndo, RELINK_OFFER_ID, type RelinkRow, type RelinkTarget } from "@/lib/asset/resync";
import type { OverwriteEntry } from "@/lib/cloud-sync/overwrite-guard";
import { dismissTip } from "@/lib/feature-usage";
import { isTrialMode } from "@/lib/trial/trial-mode";
import type { AssetData } from "@/types/asset";

const TOAST_ID = "relink-undo-toast";
const NR = ({ children }: { children: React.ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

interface UndoPack {
  entries: OverwriteEntry[];
  done: boolean;
}

/** 이어 붙일 행 키 — 대상 1개면 S.id, 여럿이면 rowId(그룹) */
const rowKeyOf = (r: RelinkRow) => (r.targets.length === 1 ? r.targets[0].id : r.rowId);

/** (main) layout 마운트용 — 이벤트가 오기 전에는 아무것도 렌더하지 않는다 */
export function RelinkHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => {
      if (isTrialMode()) return; // 체험에서는 열지 않는다
      setOpen(true);
    };
    window.addEventListener("open-relink-dialog", onOpen);
    return () => window.removeEventListener("open-relink-dialog", onOpen);
  }, []);
  if (!open) return null;
  return <RelinkDialog onClose={() => setOpen(false)} />;
}

function RelinkDialog({ onClose }: { onClose: () => void }) {
  const { assetData, saveData } = useAssetData();
  const rows = useMemo(() => detectRelink(assetData), [assetData]);
  const [step, setStep] = useState<"confirm" | "result">("confirm");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [result, setResult] = useState<{ rows: number; txs: number } | null>(null);
  const [undone, setUndone] = useState<{ skipped: number } | null>(null);
  const undoRef = useRef<UndoPack | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    track("feature_use", { category: "relink", method: "view" });
  }, []);

  // 행별 체크 기본값: 대상 1개 = 체크됨, 2개 이상 = 미체크(이을 종목 선택 필수)
  const isChecked = (r: RelinkRow) => (r.targets.length === 1 ? checked[rowKeyOf(r)] !== false : checked[rowKeyOf(r)] === true && !!pick[r.rowId]);
  const targetOf = (r: RelinkRow): RelinkTarget | undefined => (r.targets.length === 1 ? r.targets[0] : r.targets.find((t) => t.id === pick[r.rowId]));
  const picks = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const r of rows) {
      const t = targetOf(r);
      if (t && isChecked(r)) out[r.rowId] = t.id;
    }
    return out;
  };
  const checkedCount = rows.filter(isChecked).length;

  const doUndo = async (u: UndoPack | null = undoRef.current, fromToast = false) => {
    if (!u || u.done) return;
    u.done = true;
    if (!fromToast) setUndoing(true);
    // 되돌리는 순간의 보유 현황을 새로 읽는다(낡은 값 금지, #84 R1 — 이은 뒤 직접 고친 항목은 그대로)
    const plan = planUndo(u.entries, getAssetData());
    if (!saveData(plan.data)) {
      u.done = false;
      if (!fromToast) setUndoing(false);
      toast.error("되돌리지 못했어요");
      return;
    }
    track("feature_use", { category: "relink", method: "undo" });
    if (!fromToast) {
      setUndone({ skipped: plan.skipped });
      setUndoing(false);
    }
    toast.dismiss(TOAST_ID);
    toast(plan.skipped > 0 ? `되돌렸어요. 직접 고친 항목 ${plan.skipped}건은 그대로 뒀어요` : "되돌렸어요", { duration: 2000 });
  };

  const handleClose = () => {
    // 결과 화면에서 닫으면 닫은 직후 토스트에서만 되돌릴 수 있다(맞추기와 같은 패턴)
    const u = undoRef.current;
    if (step === "result" && u && !u.done) {
      toast("끊긴 거래를 다시 이었어요", {
        id: TOAST_ID,
        testId: "relink-toast",
        duration: 8000,
        actionButtonStyle: { minHeight: 40 },
        action: { label: "되돌리기", onClick: () => void doUndo(u, true) },
      });
    }
    onClose();
  };

  const handleApply = () => {
    if (applying || checkedCount === 0) return;
    setApplying(true);
    // 적용 직전 최신 데이터로 다시 감지해 아직 유효한 행만 이어 붙인다(그 사이 동기화·직접 수정 반영)
    const before: AssetData = getAssetData();
    const res = applyRelink(before, picks());
    if (res.rows === 0) {
      setResult({ rows: 0, txs: 0 });
      setApplying(false);
      setStep("result");
      return;
    }
    if (!saveData(res.data)) {
      setApplying(false);
      toast.error("다시 잇지 못했어요");
      return;
    }
    toast.dismiss(TOAST_ID);
    undoRef.current = {
      done: false,
      entries: [
        ...buildUndoEntries(before.stocks, res.data.stocks, "stocks"),
        ...buildUndoEntries(before.crypto, res.data.crypto, "crypto"),
        ...buildUndoEntries(before.transactions ?? [], res.data.transactions ?? [], "transactions"),
        ...buildUndoEntries(before.cryptoTransactions ?? [], res.data.cryptoTransactions ?? [], "cryptoTransactions"),
      ],
    };
    track("feature_use", { category: "relink", method: "apply" });
    setResult({ rows: res.rows, txs: res.txs });
    setApplying(false);
    setStep("result");
  };

  // '그대로 두기' — 이 기기에서 홈 팁만 끈다(거래내역 안내 줄은 유지). X(닫기)는 아무것도 기록하지 않는다
  const handleKeep = () => {
    dismissTip(RELINK_OFFER_ID);
    window.dispatchEvent(new CustomEvent("relink-kept")); // 같은 세션 홈 팁 즉시 숨김(HomeTipBox가 수신)
    track("feature_use", { category: "relink", method: "keep" });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        data-testid="relink-dialog"
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus({ preventScroll: true }); }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 text-left">
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-base font-bold text-balance break-keep outline-none">
            {step === "confirm" ? "끊긴 거래 다시 잇기" : result && result.rows > 0 ? "끊긴 거래를 다시 이었어요" : "끊긴 거래 다시 잇기"}
          </DialogTitle>
          {step === "confirm" && (
            <DialogDescription className="text-sm text-muted-foreground text-pretty break-keep">
              예전에 보유 현황을 맞출 때 종목이 새로 만들어지며 떨어진 거래예요. 이으면 거래내역에 다시 보이고 매수일이 첫 매수일로 바뀌어요
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="scrollbar-themed min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-5 pb-4">
          {step === "confirm" && (
            <>
              {rows.length === 0 ? (
                <p data-testid="relink-empty" className="text-sm text-muted-foreground text-pretty break-keep">이을 거래가 더 없어요</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <RelinkRowView
                      key={r.rowId}
                      row={r}
                      checked={isChecked(r)}
                      target={targetOf(r)}
                      picked={pick[r.rowId]}
                      onCheck={(on) => setChecked((p) => ({ ...p, [rowKeyOf(r)]: on }))}
                      onPick={(id) => {
                        setPick((p) => ({ ...p, [r.rowId]: id }));
                        setChecked((p) => ({ ...p, [rowKeyOf(r)]: true })); // 고르면 자동 체크
                      }}
                    />
                  ))}
                </ul>
              )}
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty break-keep">
                  <Info className="mt-0.5 size-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden />
                  <span>수량·평단은 바뀌지 않아요</span>
                </p>
                <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty break-keep">
                  <Info className="mt-0.5 size-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden />
                  <span>전량 매도했거나 직접 지운 뒤 다시 산 종목이면 <NR>체크를 풀어 주세요</NR></span>
                </p>
              </div>
            </>
          )}
          {step === "result" && result && (
            <div data-screenshot-hide data-testid="relink-result" className="space-y-2 rounded-xl bg-muted/40 p-4" aria-live="polite">
              {result.rows > 0 ? (
                <>
                  <p className="text-sm text-foreground tabular-nums text-pretty break-keep">{result.rows}개 종목의 거래 {result.txs}건을 다시 이었어요</p>
                  <p className="text-sm text-muted-foreground text-pretty break-keep">
                    {undone ? (undone.skipped > 0 ? `되돌렸어요. 직접 고친 항목 ${undone.skipped}건은 그대로 뒀어요` : "되돌렸어요") : "이 창을 닫기 전에는 되돌릴 수 있어요"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-pretty break-keep">이을 거래가 더 없어요</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/40 px-5 pt-3 pb-5 sm:flex-row sm:justify-end">
          {step === "confirm" ? (
            <>
              <Button variant="brand" data-testid="relink-apply" disabled={applying || checkedCount === 0} onClick={handleApply}>
                {applying ? (
                  <>
                    <Loader2 className="size-4 motion-safe:animate-spin" />
                    잇는 중
                  </>
                ) : (
                  "다시 잇기"
                )}
              </Button>
              <Button variant="secondary" data-testid="relink-keep" disabled={applying} onClick={handleKeep}>
                그대로 두기
              </Button>
            </>
          ) : (
            <>
              {result && result.rows > 0 && !undone && (
                <Button variant="secondary" data-testid="relink-undo" disabled={undoing} onClick={() => void doUndo()}>
                  {undoing ? (
                    <>
                      <Loader2 className="size-4 motion-safe:animate-spin" />
                      되돌리는 중
                    </>
                  ) : (
                    "되돌리기"
                  )}
                </Button>
              )}
              <Button variant="brand" data-testid="relink-close" onClick={handleClose}>
                닫기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RelinkRowView({ row, checked, target, picked, onCheck, onPick }: {
  row: RelinkRow;
  checked: boolean;
  target?: RelinkTarget;
  picked?: string;
  onCheck: (on: boolean) => void;
  onPick: (id: string) => void;
}) {
  const multi = row.targets.length > 1;
  const key = rowKeyOf(row);
  const label = (t: RelinkTarget) => `${t.broker || (row.kind === "crypto" ? "거래소 미지정" : "증권사 미지정")} · 거래 ${t.count}건`;
  return (
    <li data-testid={`relink-row-${key}`} className="rounded-lg bg-muted/40 px-3 py-2.5">
      <label htmlFor={`relink-chk-${key}`} className="flex min-h-10 cursor-pointer items-start gap-3">
        <Checkbox
          id={`relink-chk-${key}`}
          data-testid={`relink-row-check-${key}`}
          checked={checked}
          disabled={multi && !picked}
          onCheckedChange={(v) => onCheck(v === true)}
          className="relative mt-0.5 after:absolute after:-inset-3"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-pretty break-keep">{row.targets[0].name}</span>
          {target && (
            <>
              <span className="block text-sm text-muted-foreground tabular-nums text-pretty break-keep">
                {target.broker ? `${target.broker} · ` : ""}거래 {target.count}건 다시 잇기
                <span className="block sm:inline">
                  <span className="hidden sm:inline"> · </span>
                  <NR>{target.firstDate} ~ {target.lastDate}</NR>
                </span>
              </span>
              {target.newPurchaseDate && (
                <span data-testid={`relink-row-date-${target.id}`} className="block text-sm text-muted-foreground tabular-nums text-pretty break-keep">
                  매수일 <NR>{target.currentPurchaseDate}</NR> → <span className="text-foreground"><NR>{target.newPurchaseDate}</NR></span>
                </span>
              )}
              {target.cut > 0 && (
                <span data-testid={`relink-row-cut-${target.id}`} className="block text-sm text-muted-foreground tabular-nums text-pretty break-keep">
                  이전 거래 {target.cut}건은 빼요
                </span>
              )}
            </>
          )}
        </span>
      </label>
      {multi && (
        <div className="mt-2">
          <Select value={picked ?? ""} onValueChange={onPick}>
            <SelectTrigger data-testid={`relink-row-target-${row.rowId}`} aria-label="이을 종목 고르기" className="h-10 w-full text-sm">
              <SelectValue placeholder="이을 종목 고르기" />
            </SelectTrigger>
            <SelectContent>
              {row.targets.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-sm">{label(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </li>
  );
}
