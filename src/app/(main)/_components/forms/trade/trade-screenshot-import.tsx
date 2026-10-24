"use client";

import { useState, useRef, useMemo } from "react";
import { track, trackParse } from "@/lib/analytics/ga";
import { ImageUp, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAssetData } from "@/contexts/asset-data-context";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { matchBrokerHint } from "@/config/asset-options";
import { normalizeStockName, findClosestNames } from "@/lib/name-match";
import type { Stock } from "@/types/asset";
import type { Transaction, PositionSnapshot } from "@/types/transaction";
import { computeNewPosition, findDuplicateTransaction } from "@/lib/trade/trade-utils";
import {
  StockTargetPicker,
  PositionChangePreview,
  formatPrice,
  getPositionSnapshot,
  type TradeTarget,
} from "./stock-target-picker";

interface ImportTrade {
  id: string;
  name: string;
  ticker: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  date: string;
  dateMissing?: boolean;
  section: "국내" | "해외" | "기타";
  currency: "KRW" | "USD" | "JPY";
  brokerHint?: string;
  selected: boolean;
}

// 거래별 반영 시뮬레이션 결과 — 미리보기 표시와 등록 시 포지션 패치에 공용
type SimResult =
  | { kind: "record" }
  | { kind: "oversell"; held: number }
  | { kind: "preview"; before: PositionSnapshot; after: PositionSnapshot };

interface TradeScreenshotImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeScreenshotImport({ open, onOpenChange }: TradeScreenshotImportProps) {
  const { assetData, addTransactionsBatch, exchangeRates } = useAssetData();
  const geminiUsage = useGeminiUsage();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [trades, setTrades] = useState<ImportTrade[]>([]);
  const [targets, setTargets] = useState<Record<string, TradeTarget | undefined>>({});
  const [reflectToHoldings, setReflectToHoldings] = useState(true);
  const [dupActions, setDupActions] = useState<Record<string, "overwrite" | "add">>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stocks = assetData.stocks.filter((s) => s.inactiveStatus !== "delisted");

  const reset = () => {
    setStep("upload");
    setTrades([]);
    setTargets({});
    setReflectToHoldings(true);
    setDupActions({});
    setIsParsing(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // 인식 종목의 보유 후보 — 티커 일치 → 종목명 일치 → (티커 미인식 시) 종목명 유사 일치(OCR 오타).
  // 증권사·계좌 자동 라우팅 없음. fuzzy=유사 일치로만 찾은 후보(자동 선택 금지)
  const candidatesOf = (t: { ticker: string; name: string }): { list: Stock[]; fuzzy: boolean } => {
    const norm = t.ticker.toUpperCase();
    const byTicker = t.ticker ? stocks.filter((s) => s.ticker?.toUpperCase() === norm) : [];
    if (byTicker.length > 0) return { list: byTicker, fuzzy: false };
    const inputName = normalizeStockName(t.name);
    const byName = stocks.filter((s) => normalizeStockName(s.name) === inputName);
    if (byName.length > 0 || t.ticker) return { list: byName, fuzzy: false };
    const close = new Set(findClosestNames(inputName, new Set(stocks.map((s) => normalizeStockName(s.name)))));
    return { list: stocks.filter((s) => close.has(normalizeStockName(s.name))), fuzzy: true };
  };

  const candidateMap = useMemo(() => {
    const m = new Map<string, { list: Stock[]; fuzzy: boolean }>();
    for (const t of trades) m.set(t.id, candidatesOf(t));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, assetData.stocks]);

  // 보유 없는 매도는 팔 자산이 없어 제외
  const isExcluded = (t: ImportTrade) => t.type === "sell" && (candidateMap.get(t.id)?.list.length ?? 0) === 0;
  // 반영 대상 확정 여부(신규는 증권사 필수)
  const isTargetReady = (target: TradeTarget | undefined) =>
    !!target && (target.kind === "existing" || !!target.broker);

  const defaultCategoryOf = (t: ImportTrade): Stock["category"] => (t.section === "해외" ? "foreign" : "domestic");

  // 동일 대상 묶음 키 — 기존은 stockId, 신규는 (종목, 증권사, 타입)
  const targetKey = (t: ImportTrade, target: TradeTarget) =>
    target.kind === "existing" ? target.stockId : `new|${(t.ticker || t.name).toUpperCase()}|${target.broker}|${target.category}`;

  // 거래별 기존 중복 여부(기존 보유 대상일 때만 — 신규 자산은 중복 없음)
  const dupMap = useMemo(() => {
    const m = new Map<string, boolean>();
    const existing = assetData.transactions || [];
    for (const t of trades) {
      const target = targets[t.id];
      const stockId = target?.kind === "existing" ? target.stockId : "";
      m.set(t.id, stockId ? !!findDuplicateTransaction(existing, "stockId", {
        assetId: stockId, date: t.date, quantity: t.quantity, price: t.price, type: t.type,
      }) : false);
    }
    return m;
  }, [trades, targets, assetData.transactions]);

  // 중복 행의 처리: 기본 overwrite
  const dupActionOf = (id: string): "overwrite" | "add" => dupActions[id] ?? "overwrite";

  // 선택됨 + 제외 아님
  const registerList = trades.filter((t) => t.selected && !isExcluded(t));
  const unresolvedCount = registerList.filter((t) => !isTargetReady(targets[t.id])).length;
  // 실제 추가 대상 = 위 중 (중복+덮어쓰기) 제외
  const addList = registerList.filter((t) => !(dupMap.get(t.id) && dupActionOf(t.id) === "overwrite"));
  const overwriteSkipCount = registerList.length - addList.length;

  const txExchangeRate = (currency: string) =>
    currency === "USD" ? exchangeRates.USD : currency === "JPY" ? exchangeRates.JPY : undefined;

  // 추가 대상을 체결일 오름차순으로 순차 반영 시뮬레이션 — 같은 대상 다건의 누적 평단까지 미리보기
  const simulation = useMemo(() => {
    const results = new Map<string, SimResult>();
    const finalPos = new Map<string, PositionSnapshot>();
    const ordered = addList
      .filter((t) => isTargetReady(targets[t.id]))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const t of ordered) {
      const target = targets[t.id]!;
      // 신규 자산은 참조할 기존 보유가 없어 항상 반영(반영 OFF와 양립 불가)
      if (target.kind === "existing" && !reflectToHoldings) {
        results.set(t.id, { kind: "record" });
        continue;
      }
      const key = targetKey(t, target);
      const base = target.kind === "existing" ? stocks.find((s) => s.id === target.stockId) : undefined;
      const cur: PositionSnapshot = finalPos.get(key) ?? (base
        ? getPositionSnapshot(base)
        : { stockId: key, quantity: 0, avgPrice: 0, avgExchangeRate: 0, source: "computed", effectiveDate: t.date, lockedByManual: false });
      if (t.type === "sell" && t.quantity > cur.quantity) {
        results.set(t.id, { kind: "oversell", held: cur.quantity });
        continue;
      }
      const p = computeNewPosition(cur, { type: t.type, quantity: t.quantity, price: t.price, exchangeRate: txExchangeRate(t.currency) } as Transaction);
      const after: PositionSnapshot = { ...cur, quantity: p.quantity, avgPrice: p.avgPrice, avgExchangeRate: p.avgExchangeRate, source: "computed", effectiveDate: t.date };
      results.set(t.id, { kind: "preview", before: cur, after });
      finalPos.set(key, after);
    }
    return { results, finalPos, ordered };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addList.map((t) => t.id).join(","), targets, reflectToHoldings, assetData.stocks, exchangeRates.USD, exchangeRates.JPY]);

  const oversellCount = [...simulation.results.values()].filter((r) => r.kind === "oversell").length;

  const handleFileChange = async (file: File) => {
    if (!geminiUsage.canUse()) {
      trackParse("trade", "limit");
      toast.error(`오늘의 AI 인식 한도(${geminiUsage.limit}회)를 모두 사용했습니다.`);
      return;
    }
    setIsParsing(true);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("assetType", "trade");

    try {
      const res = await fetch("/api/parse-screenshot", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        trackParse("trade", "fail");
        toast.error(data.error || "파싱에 실패했습니다.");
        return;
      }
      if (!data.trades || data.trades.length === 0) {
        trackParse("trade", "empty");
        toast.error("인식된 거래가 없습니다. 다른 스크린샷을 시도해보세요.");
        return;
      }

      const importTrades: ImportTrade[] = data.trades.map((t: Omit<ImportTrade, "selected">) => ({
        ...t,
        selected: true,
      }));

      // 대상 기본값: 후보 1개면 자동 선택, 미보유 매수는 신규(인식 증권사·국내/해외 프리필), 후보 2개 이상은 직접 선택
      const autoBroker = matchBrokerHint(importTrades[0]?.brokerHint ?? "") ?? "";
      const initTargets: Record<string, TradeTarget | undefined> = {};
      for (const t of importTrades) {
        const { list: c, fuzzy } = candidatesOf(t);
        if (c.length === 1 && !fuzzy) initTargets[t.id] = { kind: "existing", stockId: c[0].id };
        else if (c.length === 0 && t.type === "buy") initTargets[t.id] = { kind: "new", broker: autoBroker, category: defaultCategoryOf(t) };
      }

      setTrades(importTrades);
      setTargets(initTargets);
      geminiUsage.increment("trade");
      trackParse("trade", "success");
      setStep("preview");
    } catch {
      trackParse("trade", "fail");
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange(file);
  };

  const toggleSelect = (id: string) => {
    const t = trades.find((x) => x.id === id);
    if (!t || isExcluded(t)) return; // 보유 없는 매도는 선택 불가
    setTrades((prev) => prev.map((x) => (x.id === id ? { ...x, selected: !x.selected } : x)));
  };

  const handleRegister = () => {
    if (registerList.length === 0) {
      toast.error("등록할 거래를 선택해주세요.");
      return;
    }
    if (unresolvedCount > 0) {
      toast.error("반영할 자산 항목을 모두 선택해주세요.");
      return;
    }
    if (oversellCount > 0) {
      toast.error("보유 수량을 초과하는 매도가 있습니다.");
      return;
    }
    if (addList.length === 0) {
      // 선택분이 모두 중복+덮어쓰기 → 기존 유지
      toast.success(`기존 거래 ${overwriteSkipCount}건을 유지했습니다.`);
      handleClose();
      return;
    }
    setIsRegistering(true);

    const txs: Transaction[] = [];
    // 신규 자산: 묶음 키 → 새 Stock(quantity 0 초기). 반영 여부와 무관하게 항상 생성
    const newlyCreated = new Map<string, Stock>();
    const now = new Date().toISOString();

    simulation.ordered.forEach((t, i) => {
      const target = targets[t.id]!;
      const key = targetKey(t, target);
      let stockId: string;
      if (target.kind === "existing") {
        stockId = target.stockId;
      } else {
        const created = newlyCreated.get(key);
        if (created) {
          stockId = created.id;
        } else {
          stockId = `stock_${Date.now()}_${i}`;
          // 같은 종목 보유가 있으면 메타(티커·통화 등) 복제, 없으면 인식값으로 생성
          const base = candidateMap.get(t.id)?.list[0];
          newlyCreated.set(key, base ? {
            ...base,
            id: stockId,
            broker: target.broker,
            category: target.category,
            quantity: 0,
            averagePrice: 0,
            purchaseExchangeRate: undefined,
            positionSource: undefined,
            positionEffectiveDate: undefined,
            purchaseDate: t.date,
          } : {
            id: stockId,
            name: t.name,
            ticker: t.ticker || undefined,
            category: target.category,
            currency: t.currency,
            broker: target.broker,
            quantity: 0,
            averagePrice: 0,
            // 라이브 시세가 아직 없어 체결가로 임시 채움 — 다음 시세 갱신에서 정상 티커면 자동 교정됨
            currentPrice: t.price,
            purchaseDate: t.date,
          } as Stock);
        }
      }
      const reflect = simulation.results.get(t.id)?.kind === "preview";
      txs.push({
        id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        stockId,
        ticker: t.ticker,
        stockName: t.name,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        currency: t.currency,
        // 스크린샷엔 체결환율이 없어 오늘자 환율 적용(주식 스샷 가져오기와 동일 방향)
        exchangeRate: txExchangeRate(t.currency),
        date: t.date,
        // 반영(기존 반영 ON 또는 신규 자산)일 때만 reflectedAt·reflectionId 부여, 아니면 기록만
        reflected: reflect,
        reflectedAt: reflect ? now : undefined,
        reflectionId: reflect ? `ref_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}` : undefined,
        createdAt: now,
      });
    });

    // 시뮬레이션 최종 포지션 → 신규 자산은 newStocks로, 기존 자산은 patch로 분리
    const patches: { stockId: string; patch: Partial<Stock> }[] = [];
    const newStocks: Stock[] = [];
    for (const [key, p] of simulation.finalPos.entries()) {
      const patch: Partial<Stock> = {
        quantity: p.quantity,
        averagePrice: p.avgPrice,
        purchaseExchangeRate: p.avgExchangeRate || undefined,
        positionSource: "computed" as const,
        positionEffectiveDate: p.effectiveDate,
      };
      const created = newlyCreated.get(key);
      if (created) newStocks.push({ ...created, ...patch });
      else patches.push({ stockId: key, patch });
    }

    addTransactionsBatch(txs, patches, newStocks);
    track("transaction_save", { asset_type: "stock", method: "screenshot" });
    toast.success(
      `${txs.length}건의 거래가 등록되었습니다.` +
      (overwriteSkipCount > 0 ? ` (중복 ${overwriteSkipCount}건은 기존 유지)` : "")
    );
    setIsRegistering(false);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageUp className="size-5 text-primary" />
            거래 스크린샷 가져오기
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/30 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {isParsing ? (
              <>
                <Loader2 className="size-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">체결 내역 분석 중...</p>
              </>
            ) : (
              <>
                <ImageUp className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  증권 앱의 체결 내역 화면을<br />스크린샷으로 찍어 업로드하세요
                </p>
                <p className="text-sm text-muted-foreground">클릭 또는 드래그&amp;드롭</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            {/* 반영 토글 — 수동 입력과 동일한 옵션 */}
            <label className="flex flex-row items-center gap-2 rounded-lg border p-3 cursor-pointer">
              <Checkbox checked={reflectToHoldings} onCheckedChange={(v) => setReflectToHoldings(!!v)} />
              <div className="leading-none">
                <span className="text-sm font-medium">보유 수량·평단에 반영</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  해제 시 거래 기록만 남기고 보유 수량/평단은 변경하지 않습니다
                </p>
              </div>
            </label>

            {trades.some((t) => t.selected && targets[t.id]?.kind === "new") && (
              <p className="text-xs text-muted-foreground">
                신규 자산 거래는 보유 반영 설정과 무관하게 항상 등록됩니다.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              인식된 거래 {trades.length}건 — 거래마다 반영할 자산 항목을 선택하세요
            </p>
            {trades.some((t) => t.currency !== "KRW") && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⓘ 해외 거래는 체결환율이 없어 <span className="font-medium">오늘자 환율</span>(USD {Math.round(exchangeRates.USD || 0).toLocaleString()}원)로 반영됩니다.
              </p>
            )}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {trades.map((t) => {
                const excluded = isExcluded(t);
                const active = !excluded && t.selected;
                const target = targets[t.id];
                const { list: candidates, fuzzy: fuzzyCandidates } = candidateMap.get(t.id) ?? { list: [], fuzzy: false };
                const sim = simulation.results.get(t.id);
                const isDup = dupMap.get(t.id);
                const previewCurrency = target?.kind === "existing"
                  ? (stocks.find((s) => s.id === target.stockId)?.currency || "KRW")
                  : t.currency;
                return (
                  <div
                    key={t.id}
                    className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${excluded ? "bg-muted/20 opacity-50 cursor-not-allowed"
                        : active ? "bg-card cursor-pointer" : "bg-muted/30 opacity-60 cursor-pointer"
                      }`}
                    onClick={() => toggleSelect(t.id)}
                  >
                    <button type="button" className="mt-0.5 shrink-0" disabled={excluded}>
                      {active
                        ? <CheckSquare className="size-4 text-primary" />
                        : <Square className="size-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${t.type === "buy" ? "text-red-500" : "text-blue-500"}`}>
                            {t.type === "buy" ? "매수" : "매도"}
                          </span>
                          <span className="text-sm font-medium truncate">{t.name}</span>
                          {t.ticker && <span className="text-[11px] text-muted-foreground">({t.ticker})</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                          <span>{t.quantity}주</span>
                          <span>{formatPrice(t.price, t.currency)}</span>
                          <span>{t.date}</span>
                        </div>
                      </div>

                      {excluded ? (
                        <p className="text-[11px] text-muted-foreground">보유 종목 없음 — 가져오기 제외</p>
                      ) : active && (
                        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          {fuzzyCandidates && candidates.length > 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">인식된 종목명과 유사한 보유 항목입니다 — 확인 후 선택하세요</p>
                          )}
                          {/* 반영할 자산 항목 직접 선택 — 보유 후보 + 신규 자산 등록(매수만) */}
                          <StockTargetPicker
                            candidates={candidates}
                            value={target}
                            onChange={(v) => setTargets((prev) => ({ ...prev, [t.id]: v }))}
                            allowNew={t.type === "buy"}
                            defaultCategory={defaultCategoryOf(t)}
                            defaultBroker={matchBrokerHint(t.brokerHint ?? "") ?? ""}
                          />
                          {!target && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">반영할 자산 항목을 선택하세요</p>
                          )}
                          {target?.kind === "new" && !target.broker && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">신규 자산의 증권사를 선택하세요</p>
                          )}

                          {isDup && (
                            <div className="space-y-1">
                              <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ 이미 동일 거래가 있습니다</p>
                              <div className="inline-flex rounded-md border overflow-hidden text-[11px]">
                                {(["overwrite", "add"] as const).map((act) => (
                                  <button
                                    key={act}
                                    type="button"
                                    className={`px-2 py-1 transition-colors ${dupActionOf(t.id) === act ? "bg-brand text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted/50"}`}
                                    onClick={() => setDupActions((prev) => ({ ...prev, [t.id]: act }))}
                                  >
                                    {act === "overwrite" ? "덮어쓰기(기존 유지)" : "새로 추가"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 선택 자산의 변경 미리보기 */}
                          {sim?.kind === "preview" && (
                            <PositionChangePreview before={sim.before} after={sim.after} currency={previewCurrency} />
                          )}
                          {sim?.kind === "record" && (
                            <p className="text-[11px] text-muted-foreground">보유 수량·평단 변경 없이 거래내역에만 기록됩니다</p>
                          )}
                          {sim?.kind === "oversell" && (
                            <div className="rounded-lg bg-destructive/10 dark:bg-destructive/20 p-2 text-xs text-destructive font-medium">
                              보유 수량({sim.held.toLocaleString()}주)을 초과합니다
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                onClick={handleRegister}
                variant="brand"
                disabled={isRegistering || registerList.length === 0 || unresolvedCount > 0 || oversellCount > 0}
                className="flex-1 sm:flex-initial"
              >
                {isRegistering ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {addList.length}건 등록{overwriteSkipCount > 0 ? ` (유지 ${overwriteSkipCount})` : ""}
              </Button>
              <Button variant="outline" onClick={() => { reset(); }} className="flex-1 sm:flex-initial">
                다시 촬영
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
