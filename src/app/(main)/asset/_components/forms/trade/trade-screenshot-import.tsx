"use client";

import { useState, useRef, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAssetData } from "@/contexts/asset-data-context";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { formatCurrency } from "@/lib/number-utils";
import { securitiesFirms, matchBrokerHint } from "@/config/asset-options";
import type { Stock } from "@/types/asset";
import type { Transaction, PositionSnapshot } from "@/types/transaction";
import { computeNewPosition, findDuplicateTransaction } from "@/lib/trade-utils";

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

const formatPrice = (value: number, currency: string) => {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
};

function getPositionSnapshot(stock: Stock): PositionSnapshot {
  return {
    stockId: stock.id,
    quantity: stock.quantity,
    avgPrice: stock.averagePrice,
    avgExchangeRate: stock.purchaseExchangeRate ?? 0,
    source: stock.positionSource ?? "manual",
    effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate,
    lockedByManual: false,
  };
}

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
  const [selectedBroker, setSelectedBroker] = useState<string>("");
  const [reflectToHoldings, setReflectToHoldings] = useState(true);
  const [dupActions, setDupActions] = useState<Record<string, "overwrite" | "add">>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stocks = assetData.stocks.filter((s) => s.inactiveStatus !== "delisted");

  const reset = () => {
    setStep("upload");
    setTrades([]);
    setSelectedBroker("");
    setReflectToHoldings(true);
    setDupActions({});
    setIsParsing(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // 거래 → 보유 종목 매칭 결과
  // existing: 기존 보유에 반영 / split: 선택 증권사 보유로 새로 분할 생성 / none: 미보유(제외)
  type MatchInfo =
    | { kind: "existing"; stockId: string }
    | { kind: "split"; baseStockId: string }
    | { kind: "none" };

  // 종목명/티커 + 증권사로 보유 종목 매칭.
  // 선택 증권사 보유가 있으면 거기에, 없는데 다른 증권사 분할 보유가 있으면 선택 증권사로 새 분할 생성,
  // 증권사 미지정 단일 보유면 그대로 반영(방어).
  const resolveMatch = (ticker: string, name: string, broker: string): MatchInfo => {
    const norm = ticker.toUpperCase();
    const candidates = ticker
      ? stocks.filter((s) => s.ticker?.toUpperCase() === norm)
      : stocks.filter((s) => s.name === name);
    if (candidates.length === 0) {
      const byName = stocks.find((s) => s.name === name);
      return byName ? { kind: "existing", stockId: byName.id } : { kind: "none" };
    }
    if (broker) {
      const byBroker = candidates.find((s) => s.broker === broker);
      if (byBroker) return { kind: "existing", stockId: byBroker.id };
      // 선택 증권사 보유는 없지만 다른 증권사로 분할 관리 중 → 선택 증권사로 새 분할 생성
      if (candidates.some((s) => s.broker)) return { kind: "split", baseStockId: candidates[0].id };
    }
    return { kind: "existing", stockId: candidates[0].id };
  };

  // 거래별 매칭 정보 (selectedBroker·stocks 변경 시 재산출)
  const matchMap = useMemo(() => {
    const m = new Map<string, MatchInfo>();
    for (const t of trades) m.set(t.id, resolveMatch(t.ticker, t.name, selectedBroker));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, selectedBroker, assetData.stocks]);

  // 거래별 기존 중복 여부(기존 보유 매칭일 때만 — 분할 신규 생성은 중복 없음)
  const dupMap = useMemo(() => {
    const m = new Map<string, boolean>();
    const existing = assetData.transactions || [];
    for (const t of trades) {
      const info = matchMap.get(t.id);
      const stockId = info?.kind === "existing" ? info.stockId : "";
      m.set(t.id, stockId ? !!findDuplicateTransaction(existing, {
        stockId, date: t.date, quantity: t.quantity, price: t.price, type: t.type,
      }) : false);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, matchMap, assetData.transactions]);

  // 중복 행의 처리: 기본 overwrite
  const dupActionOf = (id: string): "overwrite" | "add" => dupActions[id] ?? "overwrite";

  const handleFileChange = async (file: File) => {
    if (!geminiUsage.canUse()) {
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
        toast.error(data.error || "파싱에 실패했습니다.");
        return;
      }
      if (!data.trades || data.trades.length === 0) {
        toast.error("인식된 거래가 없습니다. 다른 스크린샷을 시도해보세요.");
        return;
      }

      const importTrades: ImportTrade[] = data.trades.map((t: Omit<ImportTrade, "selected">) => ({
        ...t,
        selected: true,
      }));

      setTrades(importTrades);
      // 인식된 증권사명을 증권사 select에 자동 설정(매칭 실패 시 빈값 유지 → 수동 선택)
      const autoBroker = matchBrokerHint(importTrades[0]?.brokerHint ?? "");
      if (autoBroker) setSelectedBroker(autoBroker);
      geminiUsage.increment("trade");
      setStep("preview");
    } catch {
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
    if (matchMap.get(id)?.kind === "none") return; // 미보유(미매칭)는 선택 불가
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  // 선택됨 + 매칭됨(기존 반영 또는 분할 신규)
  const registerList = trades.filter((t) => t.selected && matchMap.get(t.id)?.kind !== "none");
  // 실제 추가 대상 = 위 중 (중복+덮어쓰기) 제외
  const addList = registerList.filter((t) => !(dupMap.get(t.id) && dupActionOf(t.id) === "overwrite"));
  const overwriteSkipCount = registerList.length - addList.length;

  const handleRegister = () => {
    if (!selectedBroker) {
      toast.error("증권사를 선택해주세요.");
      return;
    }
    if (registerList.length === 0) {
      toast.error("등록할 거래를 선택해주세요.");
      return;
    }
    if (addList.length === 0) {
      // 선택분이 모두 중복+덮어쓰기 → 기존 유지
      toast.success(`기존 거래 ${overwriteSkipCount}건을 유지했습니다.`);
      handleClose();
      return;
    }
    setIsRegistering(true);

    // 동일 종목 다건은 체결일 오름차순으로 순차 재계산해야 누적 평단이 정확
    const ordered = [...addList].sort((a, b) => a.date.localeCompare(b.date));

    const txs: Transaction[] = [];
    const posState = new Map<string, PositionSnapshot>();
    // 분할 신규 생성 종목: baseStockId → 새 stock(quantity 0 초기). 반영 ON일 때만 생성.
    const splitStocks = new Map<string, Stock>();
    const splitIdByBase = new Map<string, string>();
    const now = new Date().toISOString();

    ordered.forEach((t, i) => {
      const info = matchMap.get(t.id)!;
      if (info.kind === "none") return; // addList에서 제외되나 타입 좁힘 겸 방어
      let stockId: string;
      // 분할 신규(반영 ON): 선택 증권사 보유 종목을 새로 만들어 그 종목에 거래 반영
      if (info.kind === "split" && reflectToHoldings) {
        const existingNewId = splitIdByBase.get(info.baseStockId);
        if (existingNewId) {
          stockId = existingNewId;
        } else {
          const base = stocks.find((s) => s.id === info.baseStockId)!;
          stockId = `stock_${Date.now()}_${i}`;
          splitIdByBase.set(info.baseStockId, stockId);
          splitStocks.set(stockId, {
            ...base,
            id: stockId,
            broker: selectedBroker,
            quantity: 0,
            averagePrice: 0,
            purchaseDate: t.date,
          });
        }
      } else {
        // 기존 반영 또는 (반영 OFF인 분할은 기록만 → 기준 보유에 거래내역만 연결)
        stockId = info.kind === "split" ? info.baseStockId : info.stockId;
      }
      const stock = splitStocks.get(stockId) ?? stocks.find((s) => s.id === stockId)!;
      const tx: Transaction = {
        id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        stockId,
        ticker: t.ticker,
        stockName: t.name,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        currency: t.currency,
        // 스크린샷엔 체결환율이 없어 오늘자 환율 적용(주식 스샷 가져오기와 동일 방향)
        exchangeRate: t.currency === "USD" ? exchangeRates.USD
          : t.currency === "JPY" ? exchangeRates.JPY
            : undefined,
        date: t.date,
        // 반영 ON일 때만 포지션에 반영(reflectedAt·reflectionId 부여), OFF면 기록만
        reflected: reflectToHoldings,
        reflectedAt: reflectToHoldings ? now : undefined,
        reflectionId: reflectToHoldings ? `ref_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}` : undefined,
        createdAt: now,
      };
      txs.push(tx);

      if (!reflectToHoldings) return; // 기록만 — 포지션 누적 생략

      const cur = posState.get(stockId) ?? getPositionSnapshot(stock);
      const preview = computeNewPosition(cur, tx);
      posState.set(stockId, {
        ...cur,
        quantity: preview.quantity,
        avgPrice: preview.avgPrice,
        avgExchangeRate: preview.avgExchangeRate,
        source: "computed",
        effectiveDate: tx.date,
      });
    });

    // 반영 OFF면 포지션 패치 없음(기록만). 분할 신규 종목은 newStocks로, 기존 종목은 patch로 분리.
    const patches: { stockId: string; patch: Partial<Stock> }[] = [];
    const newStocks: Stock[] = [];
    for (const [stockId, p] of posState.entries()) {
      const patch: Partial<Stock> = {
        quantity: p.quantity,
        averagePrice: p.avgPrice,
        purchaseExchangeRate: p.avgExchangeRate || undefined,
        positionSource: "computed" as const,
        positionEffectiveDate: p.effectiveDate,
      };
      const splitBase = splitStocks.get(stockId);
      if (splitBase) newStocks.push({ ...splitBase, ...patch });
      else patches.push({ stockId, patch });
    }

    addTransactionsBatch(txs, patches, newStocks);
    toast.success(
      `${ordered.length}건의 거래가 등록되었습니다.` +
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
                <p className="text-[11px] text-muted-foreground">클릭 또는 드래그&amp;드롭</p>
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
            {/* 증권사 선택 — 전체 거래 공통, 필수 (스크린샷은 보통 한 증권사 화면) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">증권사 *</label>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger className="h-9 text-sm w-full"><SelectValue placeholder="증권사 선택" /></SelectTrigger>
                <SelectContent>
                  {securitiesFirms.map((g) => g.items.map((f) => (
                    <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>
                  )))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {!selectedBroker
                  ? "증권사를 먼저 선택하세요. 증권사별로 나뉜 보유가 있으면 해당 항목에, 분할이 없으면 기존 보유 종목에 반영됩니다."
                  : reflectToHoldings
                    ? "증권사별로 나뉜 보유가 있으면 해당 항목에 반영됩니다. 분할이 없으면 기존 보유에 그대로 반영됩니다."
                    : "기록만 저장 모드 — 증권사는 거래내역이 연결될 보유 항목 선택에만 사용됩니다."}
              </p>
            </div>

            {/* 반영 토글 — 수동 입력과 동일한 옵션 */}
            <label className="flex flex-row items-center gap-2 rounded-lg border p-3 cursor-pointer">
              <Checkbox checked={reflectToHoldings} onCheckedChange={(v) => setReflectToHoldings(!!v)} />
              <div className="leading-none">
                <span className="text-sm font-medium">보유 수량·평단에 반영</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  해제 시 거래 기록만 남기고 보유 수량/평단은 변경하지 않습니다
                </p>
              </div>
            </label>

            <p className="text-sm text-muted-foreground">
              인식된 거래 {trades.length}건 — 등록할 항목을 선택하세요
            </p>
            {trades.some((t) => t.currency !== "KRW") && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                ⓘ 해외 거래는 체결환율이 없어 <span className="font-medium">오늘자 환율</span>(USD {Math.round(exchangeRates.USD || 0).toLocaleString()}원)로 반영됩니다.
              </p>
            )}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {trades.map((t) => {
                const info = matchMap.get(t.id) ?? { kind: "none" as const };
                const matched = info.kind !== "none";
                const isSplit = info.kind === "split";
                const matchedStock = info.kind === "existing" ? stocks.find((s) => s.id === info.stockId) : undefined;
                const active = matched && t.selected;
                return (
                  <div
                    key={t.id}
                    className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${!matched ? "bg-muted/20 opacity-50 cursor-not-allowed"
                        : active ? "bg-card cursor-pointer" : "bg-muted/30 opacity-60 cursor-pointer"
                      }`}
                    onClick={() => toggleSelect(t.id)}
                  >
                    <button type="button" className="mt-0.5 shrink-0" disabled={!matched}>
                      {active
                        ? <CheckSquare className="size-4 text-primary" />
                        : <Square className="size-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${t.type === "buy" ? "text-red-500" : "text-blue-500"}`}>
                          {t.type === "buy" ? "매수" : "매도"}
                        </span>
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        {t.ticker && <span className="text-[11px] text-muted-foreground">({t.ticker})</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{t.quantity}주</span>
                        <span>{formatPrice(t.price, t.currency)}</span>
                        <span>{t.date}</span>
                      </div>
                      {matched ? (
                        dupMap.get(t.id) ? (
                          <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
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
                        ) : isSplit ? (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            ✓ {selectedBroker} 보유로 {reflectToHoldings ? "새로 추가" : "거래내역에 기록"}
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            ✓ {matchedStock?.broker ? `${matchedStock.broker} ` : ""}보유 종목{reflectToHoldings ? "에 반영" : " 거래내역에 기록"}
                          </p>
                        )
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          보유 종목 없음 — 가져오기 제외
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => { reset(); }} className="flex-1">
                다시 촬영
              </Button>
              <Button
                onClick={handleRegister}
                variant="brand"
                disabled={isRegistering || !selectedBroker || registerList.length === 0}
                className="flex-1"
              >
                {isRegistering ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {addList.length}건 등록{overwriteSkipCount > 0 ? ` (유지 ${overwriteSkipCount})` : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
