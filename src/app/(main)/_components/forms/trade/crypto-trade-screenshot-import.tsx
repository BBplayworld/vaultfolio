"use client";

// 암호화폐 체결 내역 스크린샷 인식 — trade-screenshot-import.tsx(주식)와 대칭 구조.
// 코인은 국내/해외·증권사 분할 개념이 없어 증권사 select 대신 거래소(exchange) select만 두고,
// resolveMatch도 symbol 단일 매칭으로 단순화했다(S-4.30).

import { useState, useRef, useMemo } from "react";
import { ImageUp, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAssetData } from "@/contexts/asset-data-context";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { formatCurrency } from "@/lib/number-utils";
import { cryptoExchanges } from "@/config/asset-options";
import type { Crypto, AssetData } from "@/types/asset";
import type { CryptoTransaction } from "@/types/transaction";
import { computeNewPosition, findDuplicateTransaction, type PositionLike } from "@/lib/trade/trade-utils";
import { markCategoryRefreshed } from "@/lib/asset/asset-refresh-status";

interface ImportCryptoTrade {
  id: string;
  name: string;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  date: string;
  dateMissing?: boolean;
  exchangeHint?: string;
  selected: boolean;
}

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
    lockedByManual: false,
  };
}

interface CryptoTradeScreenshotImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 저장 성공 시 등록 건수와 함께 호출(FAB 다건 최신화 시퀀스가 완료 판단에 사용) */
  onSaved?: (count: number) => void;
}

export function CryptoTradeScreenshotImport({ open, onOpenChange, onSaved }: CryptoTradeScreenshotImportProps) {
  const { assetData, saveData } = useAssetData();
  const geminiUsage = useGeminiUsage();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [trades, setTrades] = useState<ImportCryptoTrade[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [reflectToHoldings, setReflectToHoldings] = useState(true);
  const [dupActions, setDupActions] = useState<Record<string, "overwrite" | "add">>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setTrades([]);
    setSelectedExchange("");
    setReflectToHoldings(true);
    setDupActions({});
    setIsParsing(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // symbol(대소문자 무관) 매칭 — 매칭 없으면 매수만 신규 등록 허용("new"), 매도는 계속 차단(null)
  type CryptoMatch = string | "new" | null;
  const matchMap = useMemo(() => {
    const m = new Map<string, CryptoMatch>(); // trade.id → cryptoId | "new" | null
    for (const t of trades) {
      const found = assetData.crypto.find((c) => c.symbol.toUpperCase() === t.symbol.toUpperCase());
      m.set(t.id, found?.id ?? (t.type === "buy" ? "new" : null));
    }
    return m;
  }, [trades, assetData.crypto]);

  const dupMap = useMemo(() => {
    const m = new Map<string, boolean>();
    const existing = assetData.cryptoTransactions || [];
    for (const t of trades) {
      const cryptoId = matchMap.get(t.id);
      m.set(t.id, cryptoId && cryptoId !== "new" ? !!findDuplicateTransaction(existing, "cryptoId", {
        assetId: cryptoId, date: t.date, quantity: t.quantity, price: t.price, type: t.type,
      }) : false);
    }
    return m;
  }, [trades, matchMap, assetData.cryptoTransactions]);

  const dupActionOf = (id: string): "overwrite" | "add" => dupActions[id] ?? "overwrite";

  const handleFileChange = async (file: File) => {
    if (!geminiUsage.canUse()) {
      toast.error(`오늘의 AI 인식 한도(${geminiUsage.limit}회)를 모두 사용했습니다.`);
      return;
    }
    setIsParsing(true);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("assetType", "crypto-trade");

    try {
      const res = await fetch("/api/parse-screenshot", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "파싱에 실패했습니다.");
        return;
      }
      if (!data.cryptoTrades || data.cryptoTrades.length === 0) {
        toast.error("인식된 거래가 없습니다. 다른 스크린샷을 시도해보세요.");
        return;
      }

      const imported: ImportCryptoTrade[] = data.cryptoTrades.map((t: Omit<ImportCryptoTrade, "selected">) => ({
        ...t,
        selected: true,
      }));

      setTrades(imported);
      if (imported[0]?.exchangeHint) setSelectedExchange(imported[0].exchangeHint);
      geminiUsage.increment("crypto-trade");
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
    if (matchMap.get(id) === null) return; // 미보유는 선택 불가
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
  };

  const registerList = trades.filter((t) => t.selected && matchMap.get(t.id) !== null);
  const addList = registerList.filter((t) => !(dupMap.get(t.id) && dupActionOf(t.id) === "overwrite"));
  const overwriteSkipCount = registerList.length - addList.length;

  const handleRegister = () => {
    if (registerList.length === 0) {
      toast.error("등록할 거래를 선택해주세요.");
      return;
    }
    if (!selectedExchange && registerList.some((t) => matchMap.get(t.id) === "new")) {
      toast.error("신규 코인 등록에는 거래소 선택이 필요합니다.");
      return;
    }
    if (addList.length === 0) {
      toast.success(`기존 거래 ${overwriteSkipCount}건을 유지했습니다.`);
      markCategoryRefreshed("crypto");
      onSaved?.(0);
      handleClose();
      return;
    }
    setIsRegistering(true);

    // 동일 코인 다건은 체결일 오름차순으로 순차 재계산해야 누적 평단이 정확
    const ordered = [...addList].sort((a, b) => a.date.localeCompare(b.date));
    const txs: CryptoTransaction[] = [];
    const posState = new Map<string, CryptoPosition>();
    // 완전 신규(미보유) 코인: 매수 스크린샷만으로 새 Crypto 생성 — 반영 여부와 무관하게 항상 생성
    const newlyCreated = new Map<string, Crypto>();
    const now = new Date().toISOString();

    ordered.forEach((t, i) => {
      const match = matchMap.get(t.id)!;
      const isNew = match === "new";
      const cryptoId = isNew ? `crypto_${Date.now()}_${i}` : match;
      let coin: Crypto;
      if (isNew) {
        coin = {
          id: cryptoId,
          name: t.name,
          symbol: t.symbol,
          exchange: selectedExchange,
          quantity: 0,
          averagePrice: 0,
          // 라이브 시세가 아직 없어 체결가로 임시 채움 — 다음 업비트 시세 갱신에서 자동 교정됨
          currentPrice: t.price,
          purchaseDate: t.date,
        } as Crypto;
        newlyCreated.set(cryptoId, coin);
      } else {
        coin = assetData.crypto.find((c) => c.id === cryptoId)!;
      }
      // 신규 코인은 참조할 기존 보유가 없어 항상 포지션을 만들어야 한다(반영 OFF와 양립 불가)
      const forceReflect = isNew || reflectToHoldings;
      const tx: CryptoTransaction = {
        id: `crtx_import_${Date.now()}_${i}`,
        cryptoId,
        symbol: t.symbol,
        name: t.name,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        date: t.date,
        reflected: forceReflect,
        reflectedAt: forceReflect ? now : undefined,
        reflectionId: forceReflect ? `ref_${Date.now()}_${i}` : undefined,
        createdAt: now,
      };
      txs.push(tx);

      if (!forceReflect) return;

      const cur = posState.get(cryptoId) ?? getCryptoPosition(coin);
      const preview = computeNewPosition(cur, tx);
      posState.set(cryptoId, { ...cur, quantity: preview.quantity, avgPrice: preview.avgPrice, source: "computed", effectiveDate: tx.date });
    });

    const newData: AssetData = {
      ...assetData,
      cryptoTransactions: [...(assetData.cryptoTransactions || []), ...txs],
      crypto: [
        ...assetData.crypto.map((c) => {
          const p = posState.get(c.id);
          if (!p) return c;
          return { ...c, quantity: p.quantity, averagePrice: p.avgPrice, positionSource: "computed" as const, positionEffectiveDate: p.effectiveDate };
        }),
        ...Array.from(newlyCreated.entries()).map(([id, base]) => {
          const p = posState.get(id)!;
          return { ...base, quantity: p.quantity, averagePrice: p.avgPrice, positionSource: "computed" as const, positionEffectiveDate: p.effectiveDate };
        }),
      ],
    };

    const success = saveData(newData);
    setIsRegistering(false);

    if (success) {
      toast.success(
        `${ordered.length}건의 거래가 등록되었습니다.` +
        (overwriteSkipCount > 0 ? ` (중복 ${overwriteSkipCount}건은 기존 유지)` : "")
      );
      markCategoryRefreshed("crypto");
      onSaved?.(ordered.length);
      handleClose();
    } else {
      toast.error("등록에 실패했습니다.");
    }
  };

  const formatPrice = (value: number) => formatCurrency(value);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageUp className="size-5 text-primary" />
            코인 거래 스크린샷 가져오기
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
                  거래소 앱의 체결 내역 화면을<br />스크린샷으로 찍어 업로드하세요
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">거래소</label>
              <Select value={selectedExchange || "기타"} onValueChange={setSelectedExchange}>
                <SelectTrigger className="h-9 text-sm w-full"><SelectValue placeholder="거래소 선택" /></SelectTrigger>
                <SelectContent>
                  {cryptoExchanges.map((ex) => (
                    <SelectItem key={ex.value} value={ex.label} className="text-sm">{ex.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex flex-row items-center gap-2 rounded-lg border p-3 cursor-pointer">
              <Checkbox checked={reflectToHoldings} onCheckedChange={(v) => setReflectToHoldings(!!v)} />
              <div className="leading-none">
                <span className="text-sm font-medium">보유 수량·평단에 반영</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  해제 시 거래 기록만 남기고 보유 수량/평단은 변경하지 않습니다
                </p>
              </div>
            </label>

            {trades.some((t) => t.selected && matchMap.get(t.id) === "new") && (
              <p className="text-xs text-muted-foreground">
                신규 코인 거래는 보유 반영 설정과 무관하게 항상 등록됩니다.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              인식된 거래 {trades.length}건 — 등록할 항목을 선택하세요
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {trades.map((t) => {
                const cryptoId = matchMap.get(t.id);
                const matched = cryptoId !== null;
                const isNew = cryptoId === "new";
                const active = matched && t.selected;
                const matchedCoin = matched && !isNew ? assetData.crypto.find((c) => c.id === cryptoId) : undefined;
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
                        <span className="text-[11px] text-muted-foreground">({t.symbol})</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{t.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
                        <span>{formatPrice(t.price)}</span>
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
                        ) : isNew ? (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            ✓ 신규 코인으로 추가됩니다{selectedExchange ? ` (${selectedExchange})` : ""}
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            ✓ {matchedCoin?.name} 보유{reflectToHoldings ? "에 반영" : " 거래내역에 기록"}
                          </p>
                        )
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          보유 코인 없음 — 가져오기 제외
                        </p>
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
                disabled={isRegistering || registerList.length === 0}
                className="flex-1 sm:flex-initial"
              >
                {isRegistering ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {addList.length}건 등록{overwriteSkipCount > 0 ? ` (유지 ${overwriteSkipCount})` : ""}
              </Button>
              <Button variant="outline" onClick={() => reset()} className="flex-1 sm:flex-initial">
                다시 촬영
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
