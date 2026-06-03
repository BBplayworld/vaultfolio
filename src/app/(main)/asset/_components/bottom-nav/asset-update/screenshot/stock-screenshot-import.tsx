"use client";

import { useState, useRef, useEffect } from "react";
import { ImageUp, Loader2, AlertTriangle, CheckSquare, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Stock, AssetData } from "@/types/asset";
import { saveAssetDataRaw } from "@/lib/asset-storage";
import { useAssetData } from "@/contexts/asset-data-context";
import { stockCategories, securitiesFirms } from "@/config/asset-options";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";

// securitiesFirms 전체 항목 flat 배열
const ALL_FIRMS = securitiesFirms.flatMap((g) => g.items);

// brokerHint 텍스트 → securitiesFirms 매칭 (부분 문자열 포함 여부로 판단)
function matchBrokerHint(hint: string): string | undefined {
  if (!hint) return undefined;
  const h = hint.replace(/\s/g, "");
  return ALL_FIRMS.find((f) => {
    const fn = f.replace(/\s/g, "");
    return fn.includes(h) || h.includes(fn);
  });
}

type ImportStock = Omit<Stock, "id"> & {
  id: string;
  section: "국내" | "해외" | "기타";
  selected: boolean;
  tickerInput?: string;
  originalCurrency?: "KRW" | "USD" | "JPY";
  broker?: string;
};

const DOMESTIC_CATEGORIES = new Set(["domestic", "isa", "irp", "pension", "unlisted"]);
const CATEGORY_OPTIONS = stockCategories.map((c) => ({ value: c.value, label: c.label }));
const BROKER_NONE = "__none__";

interface StockScreenshotImportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeTab?: string;
}

export function StockScreenshotImport({ open: externalOpen, onOpenChange, activeTab }: StockScreenshotImportProps = {}) {
  const { saveData, refreshData, assetData, exchangeRates, syncTodayExchangeRate } = useAssetData();
  const geminiUsage = useGeminiUsage();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const setIsOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  useEffect(() => {
    if (!isOpen) return;
    void syncTodayExchangeRate();
  }, [isOpen, syncTodayExchangeRate]);

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [stocks, setStocks] = useState<ImportStock[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setStocks([]);
    setIsParsing(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const handleFileChange = async (file: File) => {
    if (!geminiUsage.canUse()) {
      toast.error(`오늘의 AI 인식 한도(${geminiUsage.limit}회)를 모두 사용했습니다. 내일 다시 시도해주세요.`);
      return;
    }
    setIsParsing(true);
    setStep("upload");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/parse-screenshot", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "파싱에 실패했습니다.");
        return;
      }

      if (!data.stocks || data.stocks.length === 0) {
        toast.error("인식된 종목이 없습니다. 다른 스크린샷을 시도해보세요.");
        return;
      }

      // 동일 ticker:category 그룹 내 순서 카운터 (broker 기본값 지정용)
      const groupIndex = new Map<string, number>();

      const importStocks: ImportStock[] = data.stocks.map(
        (s: Stock & { section: "국내" | "해외" | "기타"; brokerHint?: string }) => {
          const resolvedCategory: Stock["category"] =
            s.section === "해외"
              ? "foreign"
              : activeTab && DOMESTIC_CATEGORIES.has(activeTab)
              ? (activeTab as Stock["category"])
              : s.category;

          const groupKey = `${s.ticker || s.name}:${resolvedCategory}`;
          const idx = (groupIndex.get(groupKey) ?? 0) + 1;
          groupIndex.set(groupKey, idx);

          // broker 자동 설정: brokerHint 매칭 우선, 없으면 동일 그룹 2번째부터 "항목 N"
          const matchedBroker = matchBrokerHint(s.brokerHint ?? "");
          const broker = matchedBroker ?? (idx > 1 ? `항목 ${idx}` : undefined);

          return {
            ...s,
            category: resolvedCategory,
            selected: true,
            broker,
          };
        }
      );

      setStocks(importStocks);
      geminiUsage.increment("stock");
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
    setStocks((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  };

  const toggleAll = () => {
    const allSelected = stocks.every((s) => s.selected);
    setStocks((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const updateCategory = (id: string, category: Stock["category"]) => {
    setStocks((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const usdRate = exchangeRates.USD || 1380;
        const wasForeign = s.category === "foreign";
        const becomeForeign = category === "foreign";
        if (!wasForeign && becomeForeign) {
          return {
            ...s, category,
            currentPrice: Math.round((s.currentPrice / usdRate) * 10000) / 10000,
            averagePrice: Math.round((s.averagePrice / usdRate) * 10000) / 10000,
            originalCurrency: "USD" as const,
          };
        }
        if (wasForeign && !becomeForeign) {
          const aiSawUSD = s.originalCurrency === "USD";
          if (aiSawUSD) {
            return {
              ...s, category,
              currentPrice: Math.round(s.currentPrice * usdRate),
              averagePrice: Math.round(s.averagePrice * usdRate),
              originalCurrency: "KRW" as const,
            };
          }
          return { ...s, category, originalCurrency: "KRW" as const };
        }
        return { ...s, category };
      })
    );
  };

  const updateTickerInput = (id: string, value: string) => {
    setStocks((prev) => prev.map((s) => (s.id === id ? { ...s, tickerInput: value } : s)));
  };

  const updateBroker = (id: string, value: string) => {
    setStocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, broker: value === BROKER_NONE ? undefined : value } : s))
    );
  };

  const handleRegister = () => {
    const selected = stocks.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.error("등록할 종목을 선택해주세요.");
      return;
    }

    const missingTicker = selected.filter((s) => !(s.tickerInput?.trim() || s.ticker || ""));
    if (missingTicker.length > 0) {
      toast.error(`티커(종목코드)를 입력해주세요: ${missingTicker.map((s) => s.name).join(", ")}`);
      return;
    }

    setIsRegistering(true);

    const usdRate = exchangeRates.USD || 1380;
    let hasTickerless = false;
    const newStocks: Stock[] = [];

    for (const stock of selected) {
      const { selected: _, section: __, tickerInput, originalCurrency: _origCurrency, ...stockData } = stock;
      const finalTicker = tickerInput?.trim() || stockData.ticker || "";
      const isForeign = stockData.category === "foreign";
      const isDomestic = DOMESTIC_CATEGORIES.has(stockData.category);
      const aiSawKRW = isForeign && stock.originalCurrency !== "USD" && stock.originalCurrency !== "JPY";

      let finalCurrentPrice = stockData.currentPrice;
      let finalAveragePrice = stockData.averagePrice;

      if (aiSawKRW && usdRate > 0) {
        finalCurrentPrice = Math.round((stockData.currentPrice / usdRate) * 10000) / 10000;
        finalAveragePrice = Math.round((stockData.averagePrice / usdRate) * 10000) / 10000;
      }

      const data: Stock = {
        ...stockData,
        ticker: finalTicker,
        currentPrice: finalCurrentPrice,
        averagePrice: finalAveragePrice,
        ...(isForeign ? { currency: "USD" as const, purchaseExchangeRate: usdRate } : {}),
        ...(isDomestic ? { currency: "KRW" as const } : {}),
        ...(stockData.broker ? { broker: stockData.broker } : {}),
      };
      if (isDomestic) delete (data as Partial<Stock>).purchaseExchangeRate;
      if (!finalTicker) hasTickerless = true;

      newStocks.push(data);
    }

    // 기존 stocks 유지 + 새 항목 추가 (항상 추가 방식)
    const newData: AssetData = { ...assetData, stocks: [...assetData.stocks, ...newStocks] };
    let success: boolean;
    if (hasTickerless) {
      success = saveAssetDataRaw(newData);
      if (success) refreshData();
    } else {
      success = saveData(newData);
    }

    setIsRegistering(false);

    if (success) {
      toast.success(`${selected.length}개 종목이 등록되었습니다.`);
      handleClose();
    } else {
      toast.error("등록에 실패했습니다.");
    }
  };

  const selectedCount = stocks.filter((s) => s.selected).length;
  const allSelected = stocks.length > 0 && stocks.every((s) => s.selected);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (isParsing) return;
        if (!open) handleClose(); else setIsOpen(true);
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-primary/40 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0"
        onPointerDownOutside={(e) => {
          const target = e.target as Element;
          if (target.tagName === "DIV" && target.className.includes("bg-black/80")) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {isParsing && <div className="absolute inset-0 z-10 rounded-lg cursor-wait" />}

        <DialogHeader>
          <DialogTitle>스크린샷으로 가져오기</DialogTitle>
          <DialogDescription>
            <span className="text-foreground">토스증권, 도미노 및 각종 증권 앱의 보유종목 화면을 선택하세요.</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: 업로드 */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
              본인 계좌 스크린샷을 본인 앱에 입력하는 행위로, 저작권·약관·개인정보 측면에서 문제없습니다.
            </div>

            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-10 transition-colors ${geminiUsage.canUse() ? "hover:border-primary/60 hover:bg-primary/10 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
              onClick={() => geminiUsage.canUse() && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {isParsing ? (
                <>
                  <Loader2 className="size-10 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">AI가 종목을 인식하는 중...</p>
                </>
              ) : (
                <>
                  <ImageUp className="size-10 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium">클릭하거나 이미지를 드래그하세요</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, HEIC · 최대 10MB</p>
                  </div>
                </>
              )}
            </div>

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

            <div className="flex justify-end">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${geminiUsage.remaining() <= 2 ? "bg-destructive/15 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                AI 인식 오늘 {geminiUsage.remaining()}회 남음
              </span>
            </div>

            {!geminiUsage.canUse() && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                오늘의 AI 인식 한도({geminiUsage.limit}회)를 모두 사용했습니다. 내일 다시 시도해주세요.
              </div>
            )}

            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="size-3" /> 등록 후 확인이 필요한 항목
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li><span className="text-foreground">토스증권, 도미노 외에도 종목명·수량·금액이 보이는 증권 계좌 화면</span>이면 대부분 인식됩니다.</li>
                <li><span className="text-foreground">평균단가</span>는 손익률로 역산됩니다. 등록 후 정확한 값으로 수정해주세요.</li>
                <li><span className="text-foreground">해외주식</span>은 달러(USD) 인식 시 그대로 저장하고, 원화로 인식된 경우 오늘 환율로 나눠 달러(USD)로 자동 환산합니다. 매입환율은 오늘 환율로, 매수일은 오늘 날짜로 설정되며 등록 후 수정 가능합니다.</li>
                <li><span className="text-foreground">ISA·IRP·연금저축 ETF</span>는 위 계좌 유형을 먼저 선택하면 카테고리가 자동 적용됩니다.</li>
                <li><span className="text-foreground">티커(종목코드)</span>가 미인식된 경우 미리보기에서 직접 입력해야 등록할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: 미리보기 */}
        {step === "preview" && stocks.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
              동일 카테고리·종목은 증권사 항목으로 구분되어 하나의 종목으로 통합 표시됩니다.
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleAll}
              >
                {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                전체 선택 ({selectedCount}/{stocks.length})
              </button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
                <X className="size-3 mr-1" /> 다시 업로드
              </Button>
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {stocks.map((stock) => {
                const isForeign = stock.category === "foreign";
                const usdRateLocal = exchangeRates.USD || 1380;
                const aiSawKRW = isForeign && stock.originalCurrency !== "USD" && stock.originalCurrency !== "JPY";
                const displayCurrentPrice = aiSawKRW && usdRateLocal > 0
                  ? Math.round((stock.currentPrice / usdRateLocal) * 10000) / 10000
                  : stock.currentPrice;
                const displayAveragePrice = aiSawKRW && usdRateLocal > 0
                  ? Math.round((stock.averagePrice / usdRateLocal) * 10000) / 10000
                  : stock.averagePrice;
                const fmtPrice = isForeign ? `$${displayCurrentPrice.toFixed(2)}` : formatCurrency(stock.currentPrice);
                const fmtAvg = isForeign ? `$${displayAveragePrice.toFixed(2)}` : formatCurrency(stock.averagePrice);
                const fmtTotal = isForeign ? `$${(stock.quantity * displayCurrentPrice).toFixed(2)}` : formatCurrency(stock.quantity * stock.currentPrice);

                return (
                  <div
                    key={stock.id}
                    className={`rounded-lg border p-3 transition-colors ${stock.selected ? "bg-card border-border" : "bg-muted/30 border-muted opacity-60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <button type="button" className="mt-0.5 flex-shrink-0" onClick={() => toggleSelect(stock.id)}>
                        {stock.selected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{stock.name}</span>
                          {!stock.ticker && (
                            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">티커 미확인</Badge>
                          )}
                          <Input
                            placeholder={stock.ticker ? stock.ticker : "티커 입력 (필수)"}
                            className={`h-6 w-28 text-xs px-2 font-mono ${stock.selected && !stock.ticker && !(stock.tickerInput?.trim()) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            value={stock.tickerInput ?? (stock.ticker || "")}
                            onChange={(e) => {
                              const raw = e.target.value.toUpperCase();
                              const filtered = isForeign
                                ? raw.replace(/[^A-Z0-9./]/g, "").replace(/\./g, "/").slice(0, 8)
                                : raw.replace(/[^A-Z0-9]/g, "").slice(0, 6);
                              updateTickerInput(stock.id, filtered);
                            }}
                          />
                          {isForeign && (
                            <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
                              {(stock.originalCurrency !== "USD" && stock.originalCurrency !== "JPY")
                                ? `KRW→USD 환산 (오늘 환율 ${(exchangeRates.USD || 1380).toLocaleString()}원)`
                                : "USD 그대로 저장"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span>수량 <span className={`font-semibold ${ASSET_THEME.primary.text}`}>{stock.quantity.toLocaleString()}주</span></span>
                          <span>현재가 <span className="font-semibold text-foreground">{fmtPrice}</span></span>
                          <span>평균단가(추정) <span className="font-semibold text-foreground">{fmtAvg}</span></span>
                          <span>평가금액 <span className={`font-semibold ${ASSET_THEME.important}`}>{fmtTotal}</span></span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select value={stock.category} onValueChange={(v) => updateCategory(stock.id, v as Stock["category"])}>
                            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={stock.broker ?? BROKER_NONE}
                            onValueChange={(v) => updateBroker(stock.id, v)}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="증권사 선택" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={BROKER_NONE} className="text-xs text-muted-foreground">증권사 선택 안 함</SelectItem>
                              {securitiesFirms.map((group) => (
                                <div key={group.group}>
                                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">{group.group}</div>
                                  {group.items.map((firm) => (
                                    <SelectItem key={firm} value={firm} className="text-xs">{firm}</SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>취소</Button>
          {step === "preview" && (
            <Button
              onClick={handleRegister}
              style={{ backgroundColor: MAIN_PALETTE[0] }}
              disabled={isRegistering || selectedCount === 0}
            >
              {isRegistering ? (
                <><Loader2 className="size-4 animate-spin mr-2" />등록 중...</>
              ) : (
                `${selectedCount}개 종목 등록`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
