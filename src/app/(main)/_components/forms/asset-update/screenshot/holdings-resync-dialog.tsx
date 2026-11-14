"use client";

// 보유 현황 맞추기(#91, 4.50) — 주식을 1건 이상 보유한 사람이 여는 스크린샷 대화상자.
// 증권사 화면 최대 5장을 순차 인식 → 변경 미리보기 → 맞추기 1회(저장 1회) → 결과·되돌리기.
// 순수 계산은 `@/lib/asset/resync`가 맡고, 이 파일은 상태·표시·저장 호출(클릭 핸들러에서만)만 한다.
// 0건 첫 등록·온보딩·/ratio 인계는 기존 StockScreenshotImport를 그대로 쓴다(이 컴포넌트는 진입 분기에서만 열린다).
// 코인은 `resync/crypto.ts` 어댑터로 같은 5함수를 쓴다(kind="crypto": 범위=거래소, 문구만 증권사→거래소·주식→코인).
import { useReturnFocusOnClose } from "@/lib/restore-focus";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, ImagePlus, Info, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NewDateRow } from "./new-date-row";
import { defaultNewPurchaseDate, isValidNewPurchaseDate } from "@/lib/asset/import-inherit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssetData } from "@/contexts/asset-data-context";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { SCREENSHOT_UPLOAD_NOTICE } from "@/config/security-copy";
import { cryptoExchanges, securitiesFirms, stockCategories } from "@/config/asset-options";
import { ASSET_THEME } from "@/config/theme";
import { track, trackParse } from "@/lib/analytics/ga";
import { getAssetData } from "@/lib/asset/asset-storage";
import { shouldNotifyResyncClose } from "@/lib/asset/resync-return";
import { lastRefreshedAt, markCategoryRefreshed, notifyCategoryRefreshed, restoreCategoryRefreshed } from "@/lib/asset/asset-refresh-status";
import {
  applyResync,
  buildUndoEntries,
  cryptoToStock,
  matchExchangeHint,
  parsedCryptoToRaw,
  stocksToCrypto,
  changeCount,
  computeDiff,
  defaultRemoveIds,
  isUnassignedBroker,
  mergeScreens,
  planUndo,
  resolveRow,
  PICK_NEW,
  resolveScreens,
  summarize,
  inheritedPreds,
  removeRowLabel,
  evaluateLink,
  type DiffResult,
  type DiffRow,
  type NeedsReason,
  type RawScreen,
  type RawScreenItem,
  type ResyncCounts,
  type ResyncSelection,
} from "@/lib/asset/resync";
import type { OverwriteEntry } from "@/lib/cloud-sync/overwrite-guard";
import type { Stock } from "@/types/asset";

const MAX_SHOTS = 5;
const LISTED_FIRMS: string[] = securitiesFirms.flatMap((g) => [...g.items]);
const LISTED_EXCHANGES: string[] = cryptoExchanges.map((e) => e.label);

export type ResyncKind = "stock" | "crypto";
// 주식·코인 공용: 달라지는 말은 증권사→거래소, 주식→코인뿐이다
const COPY = {
  stock: { broker: "증권사", unit: "주식", item: "종목", qty: "주" },
  crypto: { broker: "거래소", unit: "코인", item: "코인", qty: "개" },
} as const;
const KindCtx = createContext<ResyncKind>("stock");
const useKind = () => useContext(KindCtx);
const useT = () => COPY[useKind()];
const TOAST_ID = "holdings-resync-undo";
const ACCOUNT_OPTIONS = stockCategories.filter((c) => c.value !== "foreign" && c.value !== "unlisted");
const categoryShort = (c: Stock["category"]) => stockCategories.find((x) => x.value === c)?.shortLabel ?? c;
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });

type ShotStatus = "pending" | "parsing" | "ok" | "failed" | "truncated" | "limit";
interface Shot {
  id: number;
  file: File;
  url: string;
  status: ShotStatus;
  items: RawScreenItem[];
}

type Step = "upload" | "preview" | "result";

interface Props {
  kind?: ResyncKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NR = ({ children }: { children: React.ReactNode }) => <span className="whitespace-nowrap">{children}</span>;
const NOTICE_TAX = "팔아서 없어진 종목이면 매도 기록을 남겨야 양도세 계산에 들어가요";

/** 적용 1건의 되돌리기 사본 — 결과 화면 버튼과 닫은 뒤 토스트가 같은 사본을 쓴다(#115 C1) */
interface ResyncUndo {
  entries: OverwriteEntry[];
  done: boolean;
  kind: ResyncKind;
  prevRefreshedAt: string | null; // 적용 직전 refresh 메타
  appliedAt: string; // 적용 때 markCategoryRefreshed가 쓴 값 — 원복 비교용
}

export function HoldingsResyncDialog({ open, onOpenChange, kind = "stock" }: Props) {
  const { assetData, saveData, exchangeRates, syncTodayExchangeRate } = useAssetData();
  const geminiUsage = useGeminiUsage();
  const usdRate = exchangeRates.USD || 1380;
  const isCrypto = kind === "crypto";
  // 맞출 대상 목록(코인은 Stock 모양으로 옮긴 사본)
  const existing = useMemo<Stock[]>(() => (isCrypto ? assetData.crypto.map(cryptoToStock) : assetData.stocks), [isCrypto, assetData.crypto, assetData.stocks]);
  const resolveOpts = { usdRate, matchHint: isCrypto ? matchExchangeHint : undefined };

  const [step, setStep] = useState<Step>("upload");
  const [shots, setShots] = useState<Shot[]>([]);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(() => geminiUsage.remaining());
  const [failedRemoved, setFailedRemoved] = useState(false);
  const [brokerOverrides, setBrokerOverrides] = useState<Record<number, string>>({});
  const [accountOverrides, setAccountOverrides] = useState<Record<number, Stock["category"]>>({});
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [removeOv, setRemoveOv] = useState<Record<string, boolean>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [tickers, setTickers] = useState<Record<string, string>>({});
  const [fxText, setFxText] = useState("");
  const [newDate, setNewDate] = useState(() => defaultNewPurchaseDate());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ResyncCounts | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ skipped: number } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef(0);
  const startedRef = useRef(false);
  const undoRef = useRef<ResyncUndo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useReturnFocusOnClose(open); // FAB 시트 경유로 열렸다면 닫힘 후 FAB로 복귀(#118)
  const urlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (open) void syncTodayExchangeRate();
  }, [open, syncTodayExchangeRate]);

  // 단계가 바뀌면 새 제목으로 포커스를 옮긴다
  useEffect(() => {
    setScrolled(false);
    if (open && step !== "upload") titleRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      abortRef.current?.abort();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // ── 계산(전부 순수 함수, 저장 호출 없음) ──────────────────────────────
  const rawScreens = useMemo<RawScreen[]>(
    () =>
      shots
        .filter((s) => s.status !== "pending" && s.status !== "parsing")
        .map((s) => ({ index: s.id, status: s.status as RawScreen["status"], items: s.status === "ok" ? s.items : [] })),
    [shots],
  );
  const { resolved, diff } = useMemo(() => {
    const screens: RawScreen[] = failedRemoved ? [...rawScreens, { index: -1, status: "failed", items: [] }] : rawScreens;
    const res = resolveScreens(screens, existing, { ...resolveOpts, brokerOverrides, accountOverrides });
    const d = computeDiff(existing, mergeScreens(res), res);
    return { resolved: res, diff: d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawScreens, failedRemoved, existing, usdRate, brokerOverrides, accountOverrides, isCrypto]);

  const sel = useMemo<ResyncSelection>(() => {
    const remove = new Set<string>();
    for (const id of defaultRemoveIds(diff)) if (removeOv[id] !== false) remove.add(id);
    for (const [id, v] of Object.entries(removeOv)) if (v) remove.add(id);
    const fx = Number(fxText);
    return { include, remove, pick, qty, ticker: tickers, fx: fx > 0 ? fx : undefined, purchaseDate: newDate };
  }, [diff, removeOv, include, pick, qty, tickers, fxText, newDate]);
  const counts = useMemo(() => summarize(diff, sel, existing), [diff, sel, existing]);
  const changes = changeCount(counts);
  // 실제로 새로 만들어질 항목 수(이어받기 제외) — 매수일 1월 1일 안내 조건(#139 O1)
  const freshAdds = useMemo(() => applyResync(existing, diff, sel, { today: todayKst(), usdRate, now: 0 }).addedIds.length, [existing, diff, sel, usdRate]);
  // 새 종목 매수일 입력이 보일 때만 값 검증(#146) — 줄이 없으면 오류로 버튼이 잠기지 않는다
  const newDateInvalid = freshAdds > 0 && !isValidNewPurchaseDate(newDate, todayKst());

  // ── 닫기·초기화 ─────────────────────────────────────────────────────
  const resetAll = () => {
    abortRef.current?.abort();
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
    setStep("upload");
    setShots([]);
    setRunning(false);
    setFailedRemoved(false);
    setBrokerOverrides({});
    setAccountOverrides({});
    setInclude(new Set());
    setRemoveOv({});
    setPick({});
    setQty({});
    setTickers({});
    setFxText("");
    setNewDate(defaultNewPurchaseDate());
    setApplying(false);
    setApplied(null);
    setUndoInfo(null);
    setUndoing(false);
    startedRef.current = false;
  };

  const handleClose = () => {
    // 결과 화면에서 닫으면 닫은 직후 토스트에서만 되돌릴 수 있다(S7)
    const u = undoRef.current;
    if (step === "result" && u && !u.done) {
      // 토스트가 이 맞추기의 사본을 직접 붙잡는다(대화상자를 다시 열어도 다른 맞추기를 되돌리지 않게)
      toast("보유 현황을 맞췄어요", {
        id: TOAST_ID,
        duration: 8000,
        actionButtonStyle: { minHeight: 40 },
        action: { label: "되돌리기", onClick: () => void doUndo(u, true) },
      });
    }
    const applied = shouldNotifyResyncClose(step, u); // 되돌린 뒤 닫으면 복귀 신호 없음(#115 C3)
    onOpenChange(false);
    resetAll();
    if (applied) notifyCategoryRefreshed(kind); // 이어서 맞추기 복귀(#110) — 적용 후 닫을 때만
  };

  // ── 인식 ────────────────────────────────────────────────────────────
  const update = (id: number, patch: Partial<Shot>) => setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const recognizeOne = async (shot: Shot, signal: AbortSignal): Promise<"ok" | "limit-all" | "aborted"> => {
    update(shot.id, { status: "parsing" });
    try {
      const form = new FormData();
      form.append("image", shot.file);
      if (isCrypto) form.append("assetType", "crypto");
      const res = await fetch("/api/parse-screenshot", { method: "POST", body: form, signal });
      const data = (await res.json().catch(() => ({}))) as { stocks?: RawScreenItem[]; cryptos?: Parameters<typeof parsedCryptoToRaw>[0][]; code?: string };
      if (res.status === 429) {
        trackParse(kind, "limit");
        update(shot.id, { status: "limit" });
        return "limit-all";
      }
      // 서버는 실패한 호출도 차감하므로 응답을 받은 호출은 남은 횟수에 반영한다
      if (res.ok || res.status === 422) geminiUsage.increment(kind);
      setRemaining(geminiUsage.remaining());
      const parsed = isCrypto ? data.cryptos?.map((c) => parsedCryptoToRaw(c, usdRate)) : data.stocks;
      if (res.ok && parsed && parsed.length > 0) {
        trackParse(kind, "success");
        update(shot.id, { status: "ok", items: parsed });
      } else if (res.status === 422 && data.code === "truncated") {
        trackParse(kind, "fail");
        update(shot.id, { status: "truncated" });
      } else {
        trackParse(kind, res.ok ? "empty" : "fail");
        update(shot.id, { status: "failed" });
      }
      return "ok";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "aborted";
      trackParse(kind, "fail");
      update(shot.id, { status: "failed" });
      return "ok";
    }
  };

  const runRecognition = async (targets: Shot[]) => {
    if (running || targets.length === 0) return;
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let limitHit = false;
    for (const shot of targets) {
      if (ctrl.signal.aborted) break;
      if (limitHit || geminiUsage.remaining() <= 0) {
        if (!limitHit) trackParse(kind, "limit");
        update(shot.id, { status: "limit" });
        continue;
      }
      const r = await recognizeOne(shot, ctrl.signal);
      if (r === "aborted") break;
      if (r === "limit-all") limitHit = true;
    }
    if (!ctrl.signal.aborted) setRunning(false);
  };

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const room = MAX_SHOTS - shots.length;
    if (files.length > room) toast("5장까지 올릴 수 있어요");
    const added: Shot[] = files.slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      return { id: nextIdRef.current++, file, url, status: "pending", items: [] };
    });
    if (added.length > 0) setShots((prev) => [...prev, ...added]);
  };

  const removeShot = (shot: Shot) => {
    if (shot.status === "failed" || shot.status === "truncated" || shot.status === "limit") setFailedRemoved(true);
    URL.revokeObjectURL(shot.url);
    urlsRef.current.delete(shot.url);
    setShots((prev) => prev.filter((s) => s.id !== shot.id));
  };

  const retry = (shot: Shot) => {
    // 다시 시도에 성공해야만 실패 표시가 풀린다 — 성공한 장은 다시 부르지 않는다
    void runRecognition([shot]);
  };

  // ── 미리보기 진입 ───────────────────────────────────────────────────
  const goPreview = () => {
    setStep("preview");
    if (!startedRef.current) {
      startedRef.current = true;
      track("feature_use", { category: "resync_start" });
    }
  };

  // ── 적용(클릭 핸들러에서 저장 1회) ───────────────────────────────────
  const handleApply = () => {
    if (applying || changes === 0 || newDateInvalid) return;
    setApplying(true);
    setUndoInfo(null);
    setUndoing(false);
    // 저장 직전 최신 보유 현황으로 다시 계산한다(그 사이 시세 갱신 등으로 낡은 값을 덮지 않게)
    const fresh = getAssetData();
    const before = isCrypto ? fresh.crypto.map(cryptoToStock) : fresh.stocks;
    const res = resolveScreens(failedRemoved ? [...rawScreens, { index: -1, status: "failed", items: [] }] : rawScreens, before, { ...resolveOpts, brokerOverrides, accountOverrides });
    const d = computeDiff(before, mergeScreens(res), res);
    const result = applyResync(before, d, sel, { today: todayKst(), usdRate, now: Date.now() });
    const nextCrypto = isCrypto ? stocksToCrypto(fresh.crypto, before, result.stocks) : fresh.crypto;
    const ok = saveData(isCrypto ? { ...fresh, crypto: nextCrypto } : { ...fresh, stocks: result.stocks });
    if (!ok) {
      setApplying(false);
      toast.error("맞추기에 실패했어요");
      return;
    }
    toast.dismiss(TOAST_ID);
    const prevRefreshedAt = lastRefreshedAt(kind);
    const appliedAt = markCategoryRefreshed(kind, { notify: false }); // 결과 화면이 열려 있어 닫을 때 신호(handleClose)
    undoRef.current = { entries: isCrypto ? buildUndoEntries(fresh.crypto, nextCrypto, "crypto") : buildUndoEntries(fresh.stocks, result.stocks), done: false, kind, prevRefreshedAt, appliedAt };
    track("feature_use", { category: "resync_apply" });
    setApplied(result.counts);
    setApplying(false);
    setStep("result");
  };

  // ── 되돌리기(결과 화면 버튼·닫은 직후 토스트 두 곳뿐) ─────────────────
  // fromToast: 닫은 직후 토스트에서 부른 경우 — 이미 닫힌(초기화된) 대화상자 상태를 건드리지 않는다
  const doUndo = async (u: ResyncUndo | null = undoRef.current, fromToast = false) => {
    if (!u || u.done) return;
    u.done = true;
    if (!fromToast) setUndoing(true);
    // 되돌리는 순간 보유 현황을 새로 읽는다(낡은 값 금지)
    const plan = planUndo(u.entries, getAssetData());
    const ok = saveData(plan.data);
    if (!ok) {
      u.done = false;
      if (!fromToast) setUndoing(false);
      toast.error("되돌리지 못했어요");
      return;
    }
    restoreCategoryRefreshed(u.kind, u.prevRefreshedAt, u.appliedAt); // 맞춤 표시 원복(그 사이 다시 맞췄다면 유지)
    track("feature_use", { category: "resync_undo" });
    if (!fromToast) {
      setUndoInfo({ skipped: plan.skipped });
      setUndoing(false);
    }
    toast.dismiss(TOAST_ID);
    toast(plan.skipped > 0 ? `되돌렸어요. 직접 고친 항목 ${plan.skipped}건은 그대로 뒀어요` : "되돌렸어요", { duration: 2000 });
  };

  const parsedOk = shots.filter((s) => s.status === "ok").length;
  const pending = shots.filter((s) => s.status === "pending");
  const canStart = pending.length > 0 && !running && remaining > 0;

  const titleText = step === "upload" ? "스크린샷으로 보유 현황 맞추기" : step === "preview" ? "바뀌는 내용을 확인해 주세요" : "보유 현황을 맞췄어요";

  return (
    <KindCtx.Provider value={kind}>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        data-testid="resync-dialog"
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        aria-describedby={undefined}
        // 열린 직후 포커스는 창 제목으로 — 입력칸·버튼에 주면 모바일 키보드·오조작 위험(#118)
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={returnFocus}
        onEscapeKeyDown={(e) => {
          if (running || applying) e.preventDefault();
        }}
      >
        <DialogHeader className={`px-5 pt-5 pb-3 text-left ${scrolled ? "border-b border-border/40 dark:border-white/10" : ""}`}>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-base font-bold text-balance break-keep outline-none">
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div key={step} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)} className="scrollbar-themed min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          {step === "upload" && (
            <UploadStep
              failedRemoved={failedRemoved}
              shots={shots}
              running={running}
              remaining={remaining}
              resolved={resolved}
              existingBrokers={existingBrokers(existing, isCrypto ? LISTED_EXCHANGES : LISTED_FIRMS)}
              fileInputRef={fileInputRef}
              onFiles={addFiles}
              onRemove={removeShot}
              onRetry={retry}
              onBroker={(id, v) => setBrokerOverrides((p) => ({ ...p, [id]: v }))}
              onAccount={(id, v) => setAccountOverrides((p) => ({ ...p, [id]: v }))}
            />
          )}
          {step === "preview" && (
            <PreviewStep
              diff={diff}
              sel={sel}
              existing={existing}
              counts={counts}
              freshAdds={freshAdds}
              include={include}
              setInclude={setInclude}
              setRemoveOv={setRemoveOv}
              setPick={setPick}
              setQty={setQty}
              setTickers={setTickers}
              fxText={fxText}
              setFxText={setFxText}
              usdRate={usdRate}
              newDate={newDate}
              setNewDate={setNewDate}
            />
          )}
          {step === "result" && applied && (
            <div data-screenshot-hide data-testid="resync-result" className="space-y-2 rounded-xl bg-muted/40 p-4" aria-live="polite">
              <p className="text-sm text-foreground tabular-nums">{summaryParts({ ...applied, same: 0, needs: 0 })}</p>
              <p className="text-sm text-muted-foreground text-pretty break-keep">
                {undoInfo
                  ? undoInfo.skipped > 0
                    ? `되돌렸어요. 직접 고친 항목 ${undoInfo.skipped}건은 그대로 뒀어요`
                    : "되돌렸어요"
                  : "이 창을 닫기 전에는 되돌릴 수 있어요"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/40 px-5 pt-3 pb-5 sm:flex-row sm:justify-end">
          {step === "upload" && (
            <>
              {pending.length > 0 || running ? (
                <Button variant="brand" data-testid="resync-start" disabled={!canStart} onClick={() => void runRecognition(pending)}>
                  {running ? (
                    <>
                      <Loader2 className="size-4 motion-safe:animate-spin" />
                      인식 중
                    </>
                  ) : (
                    "인식하기"
                  )}
                </Button>
              ) : (
                parsedOk > 0 && (
                  <Button variant="brand" data-testid="resync-preview" onClick={goPreview}>
                    변경 내용 보기
                  </Button>
                )
              )}
              <Button variant="secondary" onClick={handleClose}>
                취소
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              {counts.needs > 0 && (
                <p className="text-sm text-muted-foreground text-pretty break-keep sm:mr-auto sm:self-center" aria-live="polite">
                  확인 필요 {counts.needs}개는 맞추지 않고 그대로 둬요
                </p>
              )}
              {changes === 0 && (
                <p className="text-sm text-muted-foreground text-pretty break-keep sm:mr-auto sm:self-center">바뀌는 내용이 없어요</p>
              )}
              <Button variant="brand" data-testid="resync-apply" disabled={applying || changes === 0 || newDateInvalid} onClick={handleApply}>
                {applying ? (
                  <>
                    <Loader2 className="size-4 motion-safe:animate-spin" />
                    맞추는 중
                  </>
                ) : (
                  "맞추기"
                )}
              </Button>
              <Button variant="secondary" onClick={() => setStep("upload")} disabled={applying}>
                뒤로
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              {!undoInfo && (
                <Button variant="secondary" data-testid="resync-undo" disabled={undoing} onClick={() => void doUndo()}>
                  되돌리기
                </Button>
              )}
              <Button variant="brand" data-testid="resync-close" onClick={handleClose}>
                닫기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </KindCtx.Provider>
  );
}

// ── 공통 조각 ─────────────────────────────────────────────────────────

function existingBrokers(stocks: Stock[], listed: string[]): string[] {
  return [...new Set(stocks.map((s) => s.broker ?? "").filter((b) => !isUnassignedBroker(b) && !listed.includes(b)))];
}

// ── 1단계 올리기·인식 ────────────────────────────────────────────────

interface UploadProps {
  failedRemoved: boolean;
  shots: Shot[];
  running: boolean;
  remaining: number;
  resolved: ReturnType<typeof resolveScreens>;
  existingBrokers: string[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFiles: (f: FileList | File[]) => void;
  onRemove: (s: Shot) => void;
  onRetry: (s: Shot) => void;
  onBroker: (id: number, v: string) => void;
  onAccount: (id: number, v: Stock["category"]) => void;
}

function UploadStep({ failedRemoved, shots, running, remaining, resolved, existingBrokers: mine, fileInputRef, onFiles, onRemove, onRetry, onBroker, onAccount }: UploadProps) {
  const T = useT();
  const kind = useKind();
  const [dragOver, setDragOver] = useState(false);
  const full = shots.length >= MAX_SHOTS;
  const done = shots.filter((s) => s.status === "ok").length;
  const finished = shots.filter((s) => s.status !== "pending" && s.status !== "parsing").length;
  const hadFailure = failedRemoved || shots.some((s) => s.status === "failed" || s.status === "truncated" || s.status === "limit");
  const unconfirmed = resolved.some((r) => r.status === "ok" && r.broker === undefined);

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground text-pretty break-keep">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{SCREENSHOT_UPLOAD_NOTICE}</span>
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {!full && (
        <button
          type="button"
          data-testid="resync-dropzone"
          disabled={running || remaining <= 0}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl p-6 text-center transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 ${dragOver ? "bg-muted/70" : "bg-muted/40 hover:bg-muted/60"}`}
        >
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-balance break-keep">{T.broker} 보유 {T.item} 화면을 골라 주세요</span>
          <span className="text-sm text-muted-foreground text-balance break-keep">최대 5장 · JPG, PNG, WEBP, HEIC · 장당 10MB</span>
        </button>
      )}
      <p className="text-sm text-muted-foreground text-pretty break-keep">
        {kind === "crypto" ? "보이는 코인 화면과 똑같이 맞춰요. 평단가가 화면에 없으면 기존 값을 그대로 둬요." : "보이는 종목 화면과 똑같이 맞춰요. 평단가와 매입 환율이 화면에 없으면 기존 값을 그대로 둬요."}
      </p>

      <div className="flex flex-col gap-1 text-sm tabular-nums text-muted-foreground" aria-live="polite">
        <span data-testid="resync-remaining">1장에 인식 1회 · 오늘 {remaining}회 남음</span>
        {remaining <= 0 && <span>오늘 인식 횟수를 다 썼어요</span>}
        {shots.length > 0 && finished > 0 && (
          <span>
            {shots.length}장 중 {done}장 인식했어요
          </span>
        )}
      </div>

      {shots.length > 0 && (
        <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 sm:grid-cols-5">
          {shots.map((s, i) => (
            <ShotThumb key={s.id} shot={s} index={i} remaining={remaining} running={running} onRemove={onRemove} onRetry={onRetry} />
          ))}
        </div>
      )}

      {resolved
        .filter((r) => r.status === "ok")
        .map((r) => {
          const i = shots.findIndex((s) => s.id === r.index);
          const hasLocal = shots.find((s) => s.id === r.index)?.items.some((it) => it.section !== "해외" && it.category !== "foreign");
          return (
            <div key={r.index} className="space-y-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium break-keep">사진 {i + 1}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={r.broker ?? ""} onValueChange={(v) => onBroker(r.index, v)}>
                  <SelectTrigger data-testid={`resync-broker-select-${r.index}`} className="h-10 w-full text-sm data-[size=default]:h-10 sm:max-w-[220px]">
                    <SelectValue placeholder={`${T.broker} 선택`} />
                  </SelectTrigger>
                  <SelectContent>
                    {r.broker && !mine.includes(r.broker) && !(kind === "crypto" ? LISTED_EXCHANGES : LISTED_FIRMS).includes(r.broker) && (
                      <SelectItem value={r.broker} className="text-sm">{r.broker}</SelectItem>
                    )}
                    {mine.map((b) => (
                      <SelectItem key={b} value={b} className="text-sm">{b}</SelectItem>
                    ))}
                    {kind === "crypto" &&
                      cryptoExchanges.map((ex) => (
                        <SelectItem key={ex.value} value={ex.label} className="text-sm">{ex.label}</SelectItem>
                      ))}
                    {kind === "stock" && securitiesFirms.map((group) => (
                      <div key={group.group}>
                        <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">{group.group}</div>
                        {group.items.map((firm) => (
                          <SelectItem key={firm} value={firm} className="text-sm">{firm}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {hasLocal && kind === "stock" && (
                  <Select value={r.account} onValueChange={(v) => onAccount(r.index, v as Stock["category"])}>
                    <SelectTrigger className="h-10 w-full text-sm data-[size=default]:h-10 sm:max-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
      {hadFailure && (
        <p data-testid="resync-incomplete-note" className="text-sm text-muted-foreground text-pretty break-keep">
          인식 못 한 장이 있어서 삭제는 모두 꺼 둘게요. 다시 시도가 성공하면 다시 계산해요
        </p>
      )}
      {unconfirmed && (
        <p className="text-sm text-muted-foreground text-pretty break-keep">{T.broker}를 고르지 않으면 이 화면에 없는 종목은 지우지 않아요</p>
      )}
    </div>
  );
}

function ShotThumb({ shot, index, remaining, running, onRemove, onRetry }: { shot: Shot; index: number; remaining: number; running: boolean; onRemove: (s: Shot) => void; onRetry: (s: Shot) => void }) {
  const T = useT();
  const busy = shot.status === "parsing";
  return (
    <div className="min-w-0 space-y-1.5" data-testid={`resync-thumb-${index}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt={`사진 ${index + 1}`} className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-sm text-white tabular-nums" aria-hidden>{index + 1}</span>
        {!busy && (
          <button
            type="button"
            data-testid={`resync-thumb-remove-${index}`}
            aria-label={`사진 ${index + 1} 빼기`}
            onClick={() => onRemove(shot)}
            className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white after:absolute after:-inset-2 after:content-['']"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div data-testid={`resync-thumb-status-${index}`} className="space-y-1 text-sm">
        {shot.status === "pending" && <p className="text-muted-foreground">대기 중</p>}
        {busy && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            인식 중
          </p>
        )}
        {shot.status === "ok" && (
          <p className="flex items-center gap-1 text-foreground">
            <Check className="size-4 text-brand" aria-hidden />
            {T.item} {shot.items.length}개
          </p>
        )}
        {(shot.status === "failed" || shot.status === "truncated" || shot.status === "limit") && (
          <>
            <p className="flex items-start gap-1 text-pretty break-keep">
              <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: ASSET_THEME.importantHex }} aria-hidden />
              <span className="min-w-0">
                {shot.status === "failed" && "인식하지 못했어요"}
                {shot.status === "truncated" && "일부만 인식됐어요"}
                {shot.status === "limit" && "오늘 인식 횟수를 다 썼어요"}
              </span>
            </p>
            {shot.status === "truncated" && <p className="text-muted-foreground text-pretty break-keep">나눠서 찍어 주세요</p>}
            {shot.status !== "truncated" && (
              <Button type="button" size="sm" variant="secondary" data-testid={`resync-retry-${index}`} className="min-h-10 max-w-full" disabled={running || remaining <= 0} onClick={() => onRetry(shot)}>
                다시 시도
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 2단계 변경 미리보기 ──────────────────────────────────────────────

interface PreviewProps {
  diff: DiffResult;
  sel: ResyncSelection;
  existing: Stock[];
  counts: ResyncCounts;
  /** 이어받기를 뺀 실제 신규 생성 건수 */
  freshAdds: number;
  include: Set<string>;
  setInclude: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRemoveOv: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPick: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setTickers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fxText: string;
  setFxText: (v: string) => void;
  usdRate: number;
  newDate: string;
  setNewDate: (v: string) => void;
}

function PreviewStep({ diff, sel, existing, counts, freshAdds, include, setInclude, setRemoveOv, setPick, setQty, setTickers, fxText, setFxText, usdRate, newDate, setNewDate }: PreviewProps) {
  const T = useT();
  const kind = useKind();
  const groupTitle = (broker: string, category: Stock["category"]) => (kind === "crypto" ? broker : `${broker} · ${categoryShort(category)}`);
  const [openKept, setOpenKept] = useState(false);
  const [openSame, setOpenSame] = useState(false);
  const changed = diff.rows.filter((r) => r.status === "add" || r.status === "change");
  const needs = diff.rows.filter((r) => r.status === "needs");
  const same = diff.rows.filter((r) => r.status === "same");

  // 같은 증권사·계좌 묶음 (증권사 미확정 장은 `증권사 미정`)
  const groups = new Map<string, DiffRow[]>();
  for (const r of changed) {
    const key = groupTitle(r.item!.broker ?? `${T.broker} 미정`, r.item!.category);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const removeScopes = diff.scopes.filter((s) => diff.removes.some((r) => r.scopeKey === s.key));
  // 새로 추가되는 종목의 매수일 기본값 안내(#139) — 이어받기를 뺀 실제 신규 생성이 있을 때만(O1)
  const hasNewAdd = freshAdds > 0;
  const inherits = inheritedPreds(diff, sel, existing);
  const hasNewForeign = diff.rows.some((r) => resolveRow(r, sel).type === "add" && r.item?.category === "foreign");
  const checkedRemoves = [...sel.remove];
  const foreignDeleteCandidate = diff.removes.some((r) => r.stock.category === "foreign") || diff.kept.some((s) => s.category === "foreign" && checkedRemoves.includes(s.id));
  const includeToggle = (id: string, on: boolean) =>
    setInclude((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const removeChecked = (id: string) => sel.remove.has(id);
  // 체크된 행이 이어받기에 쓰이면 지워지지 않으므로 '변경'(위 행이 '변경'인 것과 일치, #144)
  const inheritedIds = new Set([...inherits.values()].map((s) => s.id));
  const rowLabel = (id: string) => removeRowLabel(removeChecked(id), inheritedIds.has(id));
  const rowLabelClass = (id: string) => ({ 삭제: "text-destructive", 변경: "text-foreground", 유지: "text-muted-foreground" })[rowLabel(id)];
  const toggleRemove = (id: string, on: boolean) => setRemoveOv((p) => ({ ...p, [id]: on }));

  return (
    <div className="space-y-4">
      <p data-testid="resync-summary" aria-live="polite" aria-atomic className="text-sm text-foreground tabular-nums text-pretty break-keep">
        {summaryParts(counts)}
      </p>
      {diff.rows.some((r) => r.reasons.includes("brokerUnconfirmed")) && (
        <p className="text-sm text-muted-foreground text-pretty break-keep">{T.broker}를 못 정한 장이 있어서 삭제는 모두 꺼 뒀어요</p>
      )}

      {[...groups.entries()].map(([title, rows]) => (
        <section key={title} data-testid={`resync-group-${title}`} className="space-y-1 rounded-xl bg-muted/40 p-4" data-screenshot-hide>
          <GroupHead title={title} count={rows.length} />
          <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <ItemRow key={r.rowId} row={r} inherited={inherits.get(r.rowId)} qty={sel.qty[r.rowId]} />
            ))}
          </ul>
        </section>
      ))}

      {needs.length > 0 && (
        <section className="space-y-1 rounded-xl bg-muted/40 p-4" data-screenshot-hide>
          <GroupHead title="확인 필요" count={needs.length} />
          <ul className="divide-y divide-border/40">
            {needs.map((r) => (
              <NeedsRow
                key={r.rowId}
                row={r}
                sel={sel}
                included={include.has(r.rowId)}
                onInclude={(on) => includeToggle(r.rowId, on)}
                onPick={(id) => setPick((p) => ({ ...p, [r.rowId]: id }))}
                onQty={(n) => setQty((p) => ({ ...p, [r.rowId]: n }))}
                onTicker={(t) => setTickers((p) => ({ ...p, [r.rowId]: t }))}
              />
            ))}
          </ul>
        </section>
      )}

      {removeScopes.map((scope) => {
        const rows = diff.removes.filter((r) => r.scopeKey === scope.key);
        const off = rows.some((r) => r.offReason === "incomplete" || r.offReason === "half");
        return (
          <section key={scope.key} className="space-y-1 rounded-xl bg-muted/40 p-4" data-screenshot-hide>
            <GroupHead title={`${scope.broker} 화면에 없는 종목${kind === "crypto" ? "" : ` · ${categoryShort(scope.category)}`}`} count={rows.length} />
            {off && <p className="text-sm text-muted-foreground text-pretty break-keep">화면이 다 안 담겼을 수 있어요</p>}
            <ul className="divide-y divide-border/40">
              {rows.map((r) => (
                <CheckRow key={r.rowId} id={r.stock.id} testId={`resync-delete-check-${r.stock.id}`} checked={removeChecked(r.stock.id)} onChange={(on) => toggleRemove(r.stock.id, on)} name={r.stock.name} label={rowLabel(r.stock.id)} labelClass={rowLabelClass(r.stock.id)} sub={`수량 ${fmt(r.stock.quantity)}`} note={r.stock.inactiveStatus ? "거래정지·상장폐지 종목은 기본으로 그대로 둬요" : undefined} noteId={`resync-inactive-note-${r.stock.id}`} />
              ))}
            </ul>
            {foreignDeleteCandidate && rows.some((r) => r.stock.category === "foreign") && (
              <p className="text-sm text-muted-foreground text-pretty break-keep">{NOTICE_TAX}</p>
            )}
          </section>
        );
      })}

      {diff.kept.length > 0 && (
        <Collapsible open={openKept} onOpenChange={setOpenKept}>
          <CollapsibleTrigger data-testid="resync-kept-toggle" className="flex min-h-10 w-full items-center justify-between gap-2 text-left text-sm font-medium text-pretty break-keep">
            <span>
              스크린샷에 없는 다른 <NR>{T.broker}·미지정{kind === "stock" ? "·비상장" : ""}</NR> 종목 {diff.kept.length}개
              <span className="block text-sm font-normal text-muted-foreground">기본으로 그대로 둬요</span>
            </span>
            <ChevronDown className={`size-4 shrink-0 motion-safe:transition-[rotate] ${openKept ? "rotate-180" : ""}`} aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y divide-border/40 rounded-xl bg-muted/40 px-4 py-1" data-screenshot-hide>
              {diff.kept.map((s) => (
                <CheckRow
                  key={s.id}
                  id={s.id}
                  testId={`resync-kept-row-${s.id}`}
                  checked={removeChecked(s.id)}
                  onChange={(on) => toggleRemove(s.id, on)}
                  name={s.name}
                  label={rowLabel(s.id)}
                  labelClass={rowLabelClass(s.id)}
                  sub={s.category === "unlisted" ? "비상장은 직접 입력한 값이라 기본으로 둬요" : `${isUnassignedBroker(s.broker) ? `${T.broker} 미지정` : s.broker}${kind === "crypto" ? "" : ` · ${categoryShort(s.category)}`} · 수량 ${fmt(s.quantity)}`}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {same.length > 0 && (
        <Collapsible open={openSame} onOpenChange={setOpenSame}>
          <CollapsibleTrigger className="flex min-h-10 w-full items-center justify-between gap-2 text-left text-sm font-medium">
            <span>그대로 {same.length}건</span>
            <ChevronDown className={`size-4 shrink-0 motion-safe:transition-[rotate] ${openSame ? "rotate-180" : ""}`} aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y divide-border/40 rounded-xl bg-muted/40 px-4 py-1" data-screenshot-hide>
              {same.map((r) => (
                <li key={r.rowId} className="min-h-10 py-2.5">
                  <p className="truncate text-sm font-medium">{r.stock?.name ?? r.item!.name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    수량 {fmt(r.stock?.quantity ?? r.item!.quantity)}
                    {r.change?.avgKept ? ` · 평단은 화면에 없어 기존 값 유지` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {hasNewAdd && <NewDateRow prefix="resync" kind={kind} count={freshAdds} value={newDate} onChange={setNewDate} today={todayKst()} />}

      {hasNewForeign && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium break-keep">새 해외 종목 매입 환율</p>
            <p className="text-sm text-muted-foreground text-pretty break-keep">기본값은 오늘 환율이에요. 기존 종목은 그대로예요.</p>
          </div>
          <Input
            data-testid="resync-fx-input"
            inputMode="decimal"
            className="h-10 w-24 text-right tabular-nums"
            placeholder={String(Math.round(usdRate))}
            value={fxText}
            onChange={(e) => setFxText(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
      )}

      <div className="space-y-2">
        <p data-testid="resync-notice-1" className="flex items-start gap-2 text-sm text-muted-foreground text-pretty break-keep">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden />
          <span>거래 기록은 그대로 남아요. <NR>손익·세금</NR> 계산에 쓸 <NR>매수·매도</NR>는 거래 기록으로 남겨 주세요.</span>
        </p>
        <p data-testid="resync-notice-2" className="flex items-start gap-2 text-sm text-muted-foreground text-pretty break-keep">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600/70 dark:text-sky-400/70" aria-hidden />
          <span>바뀐 수량·평단은 이번 달 <NR>결산 증감</NR>에 함께 반영돼요</span>
        </p>
      </div>
    </div>
  );
}

function summaryParts(c: ResyncCounts) {
  const label: [keyof ResyncCounts, string][] = [["add", "추가"], ["change", "변경"], ["remove", "삭제"], ["same", "그대로"], ["needs", "확인 필요"]];
  const parts = label.filter(([k]) => c[k] > 0);
  if (parts.length === 0) return "바뀌는 내용이 없어요";
  return parts.map(([k, t], i) => (
    <span key={k} className="whitespace-nowrap">
      {i > 0 && " · "}
      {t} <span className="font-semibold">{c[k]}</span>
    </span>
  ));
}

function GroupHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold text-pretty break-keep">{title}</h3>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}건</span>
    </div>
  );
}

const Arrow = ({ a, b }: { a: string; b: string }) => (
  <span className="whitespace-nowrap">
    {a} → <span className="font-semibold text-foreground">{b}</span>
  </span>
);

function ItemRow({ row, inherited, qty }: { row: DiffRow; inherited?: Stock; qty?: number }) {
  const T = useT();
  const item = row.item!;
  // 같은 종목 이어받기는 적용 결과가 '변경'이라 기존 변경 행과 같은 모양으로 보인다(#144)
  const change = inherited ? evaluateLink(item, inherited, (qty ?? 0) > 0 ? qty : undefined) : row.change;
  const isAdd = row.status === "add" && !inherited;
  const parts: React.ReactNode[] = [];
  if (isAdd) {
    parts.push(<span key="q" className="whitespace-nowrap">수량 {fmt(item.quantity)}</span>);
    parts.push(<span key="a" className="whitespace-nowrap">{item.averagePriceEstimated ? "평단(추정)" : "평단"} {fmt(item.averagePrice)}</span>);
  } else if (change) {
    if (change.qty) parts.push(<Arrow key="q" a={`수량 ${fmt(change.qty.before)}`} b={fmt(change.qty.after)} />);
    if (change.avg) parts.push(<Arrow key="a" a={`평단 ${fmt(change.avg.before)}`} b={fmt(change.avg.after)} />);
    if (change.brokerFill) parts.push(<Arrow key="b" a={`${T.broker} 미지정`} b={change.brokerFill.to} />);
  }
  return (
    <li data-testid={`resync-row-${row.rowId}`} className="min-h-10 py-2.5 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{inherited?.name ?? row.stock?.name ?? item.name}</span>
        <span className={`shrink-0 text-sm ${isAdd ? "text-brand" : "text-foreground"}`}>{isAdd ? "추가" : "변경"}</span>
      </div>
      <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground tabular-nums">{parts}</p>
      {row.linkedBy === "unassigned" && !change?.brokerFill && <p className="text-sm text-muted-foreground">{T.broker} 미지정 줄과 연결</p>}
      {row.linkedBy === "name" && <p className="text-sm text-muted-foreground">종목명으로 연결</p>}
    </li>
  );
}

const REASON_TEXT: Partial<Record<NeedsReason, string>> = {
  qtyDecrease: "기존보다 수량이 줄었어요",
  quantityMissing: "화면에서 수량이 안 보였어요",
  tickerMissing: "종목 코드(티커)가 안 보였어요",
};

interface NeedsRowProps {
  row: DiffRow;
  sel: ResyncSelection;
  included: boolean;
  onInclude: (on: boolean) => void;
  onPick: (id: string) => void;
  onQty: (n: number) => void;
  onTicker: (t: string) => void;
}

function NeedsRow({ row, sel, included, onInclude, onPick, onQty, onTicker }: NeedsRowProps) {
  const T = useT();
  const item = row.item!;
  const cand = item.quantityCandidates;
  const blocked = row.reasons.includes("brokerUnconfirmed");
  const applicable = resolveRow(row, sel).type !== "skip";
  return (
    <li data-testid={`resync-needs-input-${row.rowId}`} className="space-y-2 py-2.5 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{row.stock?.name ?? item.name}</span>
        <span className="shrink-0 text-sm" style={{ color: ASSET_THEME.importantHex }}>
          {included && !applicable ? "제외됨" : "확인 필요"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground tabular-nums text-pretty break-keep">
        {item.broker ?? `${T.broker} 미정`} · 수량 {fmt(item.quantity)}
        {row.change?.qty ? ` (기존 ${fmt(row.change.qty.before)})` : ""}
      </p>
      {row.change?.brokerFill && <p className="text-sm text-muted-foreground text-pretty break-keep">{T.broker} 미지정 → {row.change.brokerFill.to}</p>}
      {row.linkedBy === "unassigned" && !row.change?.brokerFill && <p className="text-sm text-muted-foreground">{T.broker} 미지정 줄과 연결</p>}
      {row.linkedBy === "name" && <p className="text-sm text-muted-foreground">종목명으로 연결</p>}
      {row.reasons.map((r) => REASON_TEXT[r] && <p key={r} className="text-sm text-muted-foreground">{REASON_TEXT[r]}</p>)}
      {cand && <p className="text-sm text-muted-foreground tabular-nums text-pretty break-keep">두 장에서 수량이 달라요: {cand.map((q) => `${fmt(q)}${T.qty}`).join("·")}</p>}
      {row.reasons.includes("ambiguous") && row.candidates && (
        <div className="space-y-1">
          {row.reasons.includes("otherType") && row.candidates.length === 1 ? (
            <p className="text-sm text-muted-foreground text-pretty break-keep">고른 유형에는 이 종목이 없어요. 다른 계좌 항목을 맞출까요?</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-pretty break-keep">같은 종목이 여러 곳에 있어요. 어느 항목을 맞출까요?</p>
              {row.reasons.includes("otherType") ? (
                <p className="text-sm text-muted-foreground text-pretty break-keep">고른 유형에는 없고 다른 계좌에 있어요</p>
              ) : (
                row.reasons.includes("multiAccount") && <p className="text-sm text-muted-foreground text-pretty break-keep">계좌가 달라 하나로 정할 수 없었어요</p>
              )}
            </>
          )}
          <Select onValueChange={(id) => { onPick(id); onInclude(true); }}>
            <SelectTrigger className="h-10 w-full text-sm text-left data-[size=default]:h-10 [&_[data-slot=select-value]_span]:min-w-0 [&_[data-slot=select-value]_span]:truncate [&_[data-slot=select-value]_span]:leading-4"><SelectValue placeholder="항목 선택" /></SelectTrigger>
            <SelectContent>
              {row.candidates.map((c) => (
                <SelectItem key={c.id} value={c.id} className="min-h-10 text-sm">
                  <span className="flex flex-col">
                    <span className="text-pretty break-keep">
                      {isUnassignedBroker(c.broker) ? `${T.broker} 미지정` : c.broker} · {categoryShort(c.category)}
                      {c.description ? ` · ${c.description}` : ""}
                    </span>
                    <span className="text-muted-foreground tabular-nums">수량 {fmt(c.quantity)}{T.qty}{c.purchaseDate ? ` · 매수일 ${c.purchaseDate}` : ""}</span>
                  </span>
                </SelectItem>
              ))}
              {row.reasons.includes("otherType") && <SelectItem value={PICK_NEW} className="min-h-10 text-sm">새 항목으로 추가</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
      {(row.reasons.includes("quantityMissing") || cand) && (
        <label className="block space-y-1">
          <span className="block text-sm text-muted-foreground">{row.reasons.includes("quantityMissing") ? "수량을 직접 알려 주세요" : "맞는 수량을 입력해 주세요"}</span>
        <Input
          inputMode="decimal"
          aria-label={row.reasons.includes("quantityMissing") ? "수량을 직접 알려 주세요" : "맞는 수량을 입력해 주세요"}
          className="h-10 w-28 tabular-nums"
          placeholder={row.reasons.includes("quantityMissing") ? "수량" : String(item.quantity)}
          onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9.]/g, "")) || 0; onQty(n); if (n > 0) onInclude(true); }}
        />
        </label>
      )}
      {row.reasons.includes("tickerMissing") && (
        <label className="block space-y-1">
          <span className="block text-sm text-muted-foreground">티커를 직접 알려 주세요</span>
        <Input
          aria-label="티커를 직접 알려 주세요"
          className="h-10 w-32 font-mono"
          placeholder="예: AAPL"
          onChange={(e) => { const t = e.target.value.toUpperCase().replace(/[^A-Z0-9./]/g, "").slice(0, 8); onTicker(t); if (t) onInclude(true); }}
        />
        </label>
      )}
      {!blocked && (
        <label className="flex min-h-10 cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={included} onCheckedChange={(v) => onInclude(v === true)} className="relative mt-0.5 after:absolute after:-inset-3" />
          <span className="flex flex-col">
            <span>이 항목도 맞추기</span>
            <span className="text-sm text-muted-foreground text-pretty break-keep">체크하지 않으면 그대로 둬요</span>
          </span>
        </label>
      )}
    </li>
  );
}

function CheckRow({ id, testId, checked, onChange, name, label, labelClass, sub, note, noteId }: { note?: string; noteId?: string; id: string; testId: string; checked: boolean; onChange: (on: boolean) => void; name: string; label: string; labelClass: string; sub: string }) {
  return (
    <li className="min-h-10 [&:last-child>label]:pb-0">
      <label htmlFor={`resync-chk-${id}`} className="flex min-h-10 cursor-pointer items-start gap-3 py-2.5">
        <Checkbox id={`resync-chk-${id}`} data-testid={testId} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="relative mt-0.5 after:absolute after:-inset-3" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className={`shrink-0 text-sm ${labelClass}`}>{label}</span>
          </span>
          <span className="block text-sm text-muted-foreground tabular-nums text-pretty break-keep">{sub}</span>
          {note && <span data-testid={noteId} className="block text-sm text-muted-foreground text-pretty break-keep">{note}</span>}
        </span>
      </label>
    </li>
  );
}
