"use client";

import { useState, useRef } from "react";
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
import { stockCategories } from "@/config/asset-options";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";

type ImportStock = Omit<Stock, "id"> & {
  id: string;
  section: "국내" | "해외" | "기타";
  selected: boolean;
  tickerInput?: string; // 티커 미인식 시 사용자 직접 입력값
  originalCurrency?: "KRW" | "USD" | "JPY"; // AI 원본 인식 통화 (환산 분기용)
};

type ConflictMode = "merge" | "reset";

// stock-input 탭에서 국내 카테고리로 매핑 가능한 값
const DOMESTIC_CATEGORIES = new Set(["domestic", "isa", "irp", "pension", "unlisted"]);

const CATEGORY_OPTIONS = stockCategories.map((c) => ({ value: c.value, label: c.label }));

const makeConflictKey = (ticker: string, category: string, isForeign: boolean) =>
  isForeign ? ticker : `${ticker}:${category}`;

interface StockScreenshotImportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeTab?: string; // stock-input의 현재 활성 카테고리 탭
}

export function StockScreenshotImport({ open: externalOpen, onOpenChange, activeTab }: StockScreenshotImportProps = {}) {
  const { saveData, refreshData, assetData, exchangeRates } = useAssetData();
  const geminiUsage = useGeminiUsage();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;

  const setIsOpen = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [step, setStep] = useState<"upload" | "conflict" | "preview">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [stocks, setStocks] = useState<ImportStock[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [conflictMode, setConflictMode] = useState<ConflictMode>("merge");
  const [conflictCount, setConflictCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setStocks([]);
    setIsParsing(false);
    setConflictMode("merge");
    setConflictCount(0);
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

      // 기존 보유 종목 복합 키 Set: 해외는 ticker 단독, 국내/기타는 ticker:category
      const existingKeys = new Set(
        assetData.stocks
          .map((s) => s.ticker ? makeConflictKey(s.ticker, s.category, s.category === "foreign") : null)
          .filter(Boolean) as string[]
      );

      const importStocks: ImportStock[] = data.stocks.map(
        (s: Stock & { section: "국내" | "해외" | "기타" }) => {
          // 해외 섹션은 항상 foreign 카테고리 고정
          if (s.section === "해외") return { ...s, category: "foreign" as const, selected: true };
          // 국내/기타: 탭이 국내 카테고리 중 하나면 해당 카테고리 우선 적용, 아니면 AI 탐지 카테고리 유지
          const resolvedCategory = activeTab && DOMESTIC_CATEGORIES.has(activeTab) ? activeTab as Stock["category"] : s.category;
          return { ...s, category: resolvedCategory, selected: true };
        }
      );

      // 중복 탐지: importStock의 (ticker, category) 복합 키가 기존에 존재하는 경우만 중복
      const duplicates = importStocks.filter((s) => {
        const ticker = s.tickerInput?.trim() || s.ticker;
        if (!ticker) return false;
        return existingKeys.has(makeConflictKey(ticker, s.category, s.section === "해외"));
      });

      setStocks(importStocks);
      geminiUsage.increment("stock");

      if (duplicates.length > 0) {
        setConflictCount(duplicates.length);
        setStep("conflict");
      } else {
        setStep("preview");
      }
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileChange(file);
    }
  };

  const toggleSelect = (id: string) => {
    setStocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const toggleAll = () => {
    const allSelected = stocks.every((s) => s.selected);
    setStocks((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const updateCategory = (id: string, category: Stock["category"]) => {
    setStocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, category } : s))
    );
  };

  const updateTickerInput = (id: string, value: string) => {
    setStocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, tickerInput: value } : s))
    );
  };

  const handleRegister = () => {
    const selected = stocks.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.error("등록할 종목을 선택해주세요.");
      return;
    }

    // 티커 필수 validation: 선택된 종목 중 티커가 없는 항목 검사
    const missingTicker = selected.filter((s) => {
      const finalTicker = s.tickerInput?.trim() || s.ticker || "";
      return !finalTicker;
    });
    if (missingTicker.length > 0) {
      toast.error(`티커(종목코드)를 입력해주세요: ${missingTicker.map((s) => s.name).join(", ")}`);
      return;
    }

    setIsRegistering(true);

    // 1) 완성된 stocks 배열을 순수 계산으로 만든다 (React state 비동기 문제 방지)
    // merge: 해외주식은 ticker 단독, 나머지는 (ticker, category) 복합 키 기준 교체, 나머지 유지
    // reset: 기존 주식 전부 삭제
    const importedKeys = new Set(
      selected
        .map((s) => {
          const ticker = s.tickerInput?.trim() || s.ticker;
          return ticker ? makeConflictKey(ticker, s.category, s.section === "해외") : null;
        })
        .filter(Boolean) as string[]
    );
    const mutableStocks: Stock[] =
      conflictMode === "reset"
        ? []
        : assetData.stocks.filter((s) => {
          if (!s.ticker) return true;
          return !importedKeys.has(makeConflictKey(s.ticker, s.category, s.category === "foreign"));
        });
    let hasTickerless = false;

    const usdRate = exchangeRates.USD || 1380;

    for (const stock of selected) {
      const { selected: _, section: __, tickerInput, originalCurrency: _origCurrency, ...stockData } = stock;
      const finalTicker = tickerInput?.trim() || stockData.ticker || "";

      // 최종 카테고리 기준으로 판단 (미리보기에서 변경된 카테고리 반영)
      const isForeign = stockData.category === "foreign";
      // 국내 카테고리는 무조건 KRW — 섹션이 "해외"였더라도 카테고리가 국내면 원화 처리
      const isDomestic = DOMESTIC_CATEGORIES.has(stockData.category);

      // AI가 원화(KRW)로 인식한 해외주식 → USD로 환산 필요
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
      };
      if (isDomestic) delete (data as Partial<Stock>).purchaseExchangeRate;

      if (!finalTicker) {
        hasTickerless = true;
      }
      // 스크린샷 종목 전부 push (중복은 위에서 이미 기존 목록에서 제거됨)
      mutableStocks.push(data);
    }

    // 2) 한 번에 저장 — ticker 없는 종목이 있으면 superRefine 우회 저장
    const newData: AssetData = { ...assetData, stocks: mutableStocks };
    let success: boolean;
    if (hasTickerless) {
      success = saveAssetDataRaw(newData);
      if (success) refreshData(); // Raw 저장은 setAssetData를 호출하지 않으므로 수동 동기화
    } else {
      success = saveData(newData);
    }

    setIsRegistering(false);

    if (success) {
      toast.success(`${selected.length}개 종목이 ${conflictMode === "reset" ? "등록" : "반영"}되었습니다.`);
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
        if (isParsing) return; // AI 인식 중 닫힘 차단
        if (!open) handleClose(); else setIsOpen(true);
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-primary/40"
        onPointerDownOutside={(e) => e.preventDefault()} // 항상 바깥 클릭 차단
        onEscapeKeyDown={(e) => e.preventDefault()} // 항상 ESC 차단
      >
        {/* AI 인식 중 전체 클릭 차단 오버레이 */}
        {isParsing && (
          <div className="absolute inset-0 z-10 rounded-lg cursor-wait" />
        )}

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

        {/* Step 2: 중복 처리 선택 */}
        {step === "conflict" && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                기존 보유 종목과 <span className="font-semibold">{conflictCount}개</span> 중복됩니다.
                처리 방식을 선택해주세요.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className={`w-full rounded-lg border p-4 text-left transition-colors ${conflictMode === "merge"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
                  }`}
                onClick={() => setConflictMode("merge")}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${conflictMode === "merge" ? "border-primary" : "border-muted-foreground"
                    }`}>
                    {conflictMode === "merge" && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">덮어쓰기</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      중복 종목을 스크린샷 기준으로 교체하고, 나머지 기존 종목은 유지합니다.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`w-full rounded-lg border p-4 text-left transition-colors ${conflictMode === "reset"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
                  }`}
                onClick={() => setConflictMode("reset")}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${conflictMode === "reset" ? "border-primary" : "border-muted-foreground"
                    }`}>
                    {conflictMode === "reset" && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">초기화 후 등록</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      기존 주식을 모두 삭제하고 스크린샷 종목으로 대체합니다.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 미리보기 */}
        {step === "preview" && stocks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleAll}
              >
                {allSelected
                  ? <CheckSquare className="size-4 text-primary" />
                  : <Square className="size-4" />}
                전체 선택 ({selectedCount}/{stocks.length})
              </button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
                <X className="size-3 mr-1" /> 다시 업로드
              </Button>
            </div>

            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {stocks.map((stock) => (
                <div
                  key={stock.id}
                  className={`rounded-lg border p-3 transition-colors ${stock.selected ? "bg-card border-border" : "bg-muted/30 border-muted opacity-60"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="mt-0.5 flex-shrink-0"
                      onClick={() => toggleSelect(stock.id)}
                    >
                      {stock.selected
                        ? <CheckSquare className="size-4 text-primary" />
                        : <Square className="size-4 text-muted-foreground" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{stock.name}</span>
                        {stock.ticker ? (
                          <span className="text-xs font-mono text-muted-foreground">({stock.ticker})</span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                            티커 미확인
                          </Badge>
                        )}
                        {!stock.ticker && (
                          <Input
                            placeholder="티커 입력 (필수)"
                            className={`h-6 w-32 text-xs px-2 ${stock.selected && !(stock.tickerInput?.trim())
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                              }`}
                            value={stock.tickerInput ?? ""}
                            onChange={(e) => updateTickerInput(stock.id, e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))}
                          />
                        )}
                        {stock.category === "foreign" && (
                          <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
                            {(stock.originalCurrency !== "USD" && stock.originalCurrency !== "JPY")
                              ? `KRW→USD 환산 (오늘 환율 ${(exchangeRates.USD || 1380).toLocaleString()}원)`
                              : "USD 그대로 저장"}
                          </Badge>
                        )}
                        {conflictMode === "merge" && stock.ticker &&
                          assetData.stocks.some((s) => s.ticker === stock.ticker) && (
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                              교체
                            </Badge>
                          )}
                      </div>

                      {(() => {
                        const isForeign = stock.category === "foreign";
                        const usdRateLocal = exchangeRates.USD || 1380;
                        const aiSawKRW = isForeign && stock.originalCurrency !== "USD" && stock.originalCurrency !== "JPY";

                        // 원화 인식 해외주식은 환산 후 표시, 달러 인식은 그대로 표시
                        const displayCurrentPrice = aiSawKRW && usdRateLocal > 0
                          ? Math.round((stock.currentPrice / usdRateLocal) * 10000) / 10000
                          : stock.currentPrice;
                        const displayAveragePrice = aiSawKRW && usdRateLocal > 0
                          ? Math.round((stock.averagePrice / usdRateLocal) * 10000) / 10000
                          : stock.averagePrice;

                        const fmtPrice = isForeign
                          ? `$${displayCurrentPrice.toFixed(2)}`
                          : formatCurrency(stock.currentPrice);
                        const fmtAvg = isForeign
                          ? `$${displayAveragePrice.toFixed(2)}`
                          : formatCurrency(stock.averagePrice);
                        const fmtTotal = isForeign
                          ? `$${(stock.quantity * displayCurrentPrice).toFixed(2)}`
                          : formatCurrency(stock.quantity * stock.currentPrice);
                        return (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>
                              수량 <span className={`font-semibold ${ASSET_THEME.primary.text}`}>{stock.quantity.toLocaleString()}주</span>
                            </span>
                            <span>
                              현재가 <span className="font-semibold text-foreground">{fmtPrice}</span>
                            </span>
                            <span>
                              평균단가(추정) <span className="font-semibold text-foreground">{fmtAvg}</span>
                            </span>
                            <span>
                              평가금액 <span className={`font-semibold ${ASSET_THEME.important}`}>{fmtTotal}</span>
                            </span>
                          </div>
                        );
                      })()}

                      <Select
                        value={stock.category}
                        onValueChange={(v) => updateCategory(stock.id, v as Stock["category"])}
                      >
                        <SelectTrigger className="h-7 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          {step === "conflict" && (
            <Button onClick={() => setStep("preview")}>
              다음
            </Button>
          )}
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
