"use client";

import { useEffect, useState } from "react";
import { dispatchAddRealEstate, dispatchAddStock } from "@/app/(main)/asset/_components/layout/navigation/asset-dispatch";
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ChevronLeft, History, BadgeDollarSign, ArrowRight, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAssetData } from "@/contexts/asset-data-context";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAssetNavigation, type DetailTab } from "../navigation/navigation-context";

type AssetType = "real-estate" | "stock" | "crypto" | "cash" | "loan" | "yearly-net-asset";
type Step = "select-type" | "select-action" | "select-method";

const ASSET_TYPES = [
  { type: "real-estate" as AssetType, label: "부동산", icon: Building2, hasScreenshot: false, navigateTab: "real-estate" as string | null },
  { type: "stock" as AssetType, label: "주식", icon: TrendingUp, hasScreenshot: true, navigateTab: "stocks" as string | null },
  { type: "crypto" as AssetType, label: "암호화폐", icon: Bitcoin, hasScreenshot: true, navigateTab: "crypto" as string | null },
  { type: "cash" as AssetType, label: "현금성 자산", icon: Wallet, hasScreenshot: true, navigateTab: "cash" as string | null },
  { type: "loan" as AssetType, label: "대출", icon: CreditCard, hasScreenshot: true, navigateTab: "loans" as string | null },
  { type: "yearly-net-asset" as AssetType, label: "과거 순자산", icon: History, hasScreenshot: false, navigateTab: null },
];

const EVENT_MAP: Record<AssetType, string> = {
  "real-estate": "trigger-add-real-estate",
  "stock": "trigger-add-stock",
  "crypto": "trigger-add-crypto",
  "cash": "trigger-add-cash",
  "loan": "trigger-add-loan",
  "yearly-net-asset": "trigger-add-yearly-net-asset",
};

export function FloatingAddButton() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("select-type");
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const { exchangeRates, exchangeRateDate, updateExchangeRate } = useAssetData();
  const { navigate, view } = useAssetNavigation();
  const [isHidden, setIsHidden] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  // 최상단(scrollY ≤ 50)에서만 노출 — 스크롤 다운 시 즉시 숨김
  useEffect(() => {
    const onScroll = () => {
      setIsHidden(window.scrollY > 50);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 인증샷 다이얼로그 열림 상태 추적
  useEffect(() => {
    const handler = (e: Event) => {
      const open = (e as CustomEvent<{ open: boolean }>).detail?.open;
      setScreenshotOpen(!!open);
    };
    window.addEventListener("screenshot-dialog-toggle", handler);
    return () => window.removeEventListener("screenshot-dialog-toggle", handler);
  }, []);

  // 노출 페이지: 홈 + 상세 허브만. 상세 하위 탭·성과·더보기·인증샷에서는 숨김.
  const allowedByView = view.type === "home" || (view.type === "detail" && view.tab === "hub");
  const showBar = allowedByView && !screenshotOpen;

  const resetState = () => {
    setStep("select-type");
    setSelectedType(null);
  };

  const handleTypeSelect = (type: AssetType) => {
    setSelectedType(type);
    setStep("select-action");
  };

  const handleActionAdd = () => {
    if (!selectedType) return;
    const asset = ASSET_TYPES.find((a) => a.type === selectedType);
    if (!asset?.hasScreenshot) {
      if (selectedType === "real-estate") dispatchAddRealEstate();
      else if (selectedType === "yearly-net-asset") {
        // 순자산 페이지(YearlyNetAssetChart)가 마운트되어야 trigger 이벤트 수신 가능.
        // 허브/다른 탭에서 진입 시 먼저 netasset 페이지로 이동 후 다음 tick에 dispatch
        navigate({ type: "activity", tab: "netasset" });
        setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT_MAP[selectedType])), 50);
      }
      else window.dispatchEvent(new CustomEvent(EVENT_MAP[selectedType]));
      setIsOpen(false);
      resetState();
    } else {
      setStep("select-method");
    }
  };

  const handleActionEdit = () => {
    if (!selectedType) return;
    const asset = ASSET_TYPES.find((a) => a.type === selectedType);
    if (!asset?.navigateTab) return;
    navigate({ type: "detail", tab: asset.navigateTab as DetailTab });
    setIsOpen(false);
    resetState();
  };

  const handleMethodSelect = (mode: "screenshot" | "manual") => {
    if (!selectedType) return;
    if (selectedType === "stock") dispatchAddStock(mode);
    else window.dispatchEvent(new CustomEvent(EVENT_MAP[selectedType], { detail: { mode } }));
    setIsOpen(false);
    resetState();
  };

  const selectedAsset = ASSET_TYPES.find((a) => a.type === selectedType);

  const sheetTitle = () => {
    if (step === "select-type") return "자산 선택";
    if (step === "select-action") return `${selectedAsset?.label}`;
    return `${selectedAsset?.label} 추가`;
  };

  const buttonEl = (
    <button
      onClick={() => setIsOpen(true)}
      className="w-full flex items-center justify-center gap-2 rounded-2xl text-white
      py-3.5 sm:py-4 text-base font-bold active:scale-[0.98] transition-all
      bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700"
      aria-label="자산 업데이트"
      data-tutorial="tutorial-fab"
    >
      <Plus className="size-5" />
      자산 업데이트
    </button>
  );

  return (
    <>
      {/* 모바일: 하단 고정 바 (배경·그라데이션·스크롤 hide 포함) */}
      {showBar && isMobile && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-150
          ${isHidden ? "translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}
        >
          <div className="pointer-events-none absolute -top-4 left-0 right-0 h-4 bg-gradient-to-b from-transparent to-background" />
          <div
            className="relative bg-background/95 backdrop-blur-sm
            px-4 py-2 pb-[max(0.8rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl text-white
              shadow-lg shadow-orange-500/20 py-3.5 text-base font-bold active:scale-[0.98] transition-all
              bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700"
              aria-label="자산 업데이트"
              data-tutorial="tutorial-fab"
            >
              <Plus className="size-5" />
              자산 업데이트
            </button>
          </div>
        </div>
      )}

      {/* PC: 페이지 컨텐츠 흐름 안의 인라인 버튼 (footer 위, max-width 상속, shadow/배경 없음) */}
      {showBar && isMobile === false && (
        <div className="w-full">
          {buttonEl}
        </div>
      )}

      <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          hideClose={isMobile}
          className={isMobile
            ? "rounded-t-2xl pb-10 max-h-[90vh] overflow-y-auto touch-pan-y"
            : "rounded-t-2xl pb-10"}
        >
          {isMobile && (
            <div
              className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-muted-foreground/30 cursor-grab touch-none"
              onPointerDown={(e) => {
                const startY = e.clientY;
                const target = e.currentTarget;
                const sheet = target.closest('[data-slot="sheet-content"]') as HTMLElement | null;
                if (!sheet) return;
                target.setPointerCapture(e.pointerId);
                const onMove = (ev: PointerEvent) => {
                  const dy = Math.max(0, ev.clientY - startY);
                  sheet.style.transform = `translateY(${dy}px)`;
                  sheet.style.transition = "none";
                };
                const onUp = (ev: PointerEvent) => {
                  const dy = Math.max(0, ev.clientY - startY);
                  sheet.style.transition = "";
                  sheet.style.transform = "";
                  target.removeEventListener("pointermove", onMove);
                  target.removeEventListener("pointerup", onUp);
                  target.removeEventListener("pointercancel", onUp);
                  if (dy > 80) setIsOpen(false);
                };
                target.addEventListener("pointermove", onMove);
                target.addEventListener("pointerup", onUp);
                target.addEventListener("pointercancel", onUp);
              }}
              aria-hidden="true"
            />
          )}
          <SheetHeader className={isMobile ? "mb-4 mt-3" : "mb-4"}>
            <SheetTitle>{sheetTitle()}</SheetTitle>
          </SheetHeader>

          {step === "select-type" && (
            <div className="flex flex-col gap-2 px-3">
              {ASSET_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                  onClick={() => handleTypeSelect(type)}
                >
                  <Icon className="size-5 text-primary shrink-0" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}

              <Separator className="my-1" />

              <div className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">환율 설정
                      <span className="text-xs text-muted-foreground ml-2 border p-1.5 rounded-md">
                        {exchangeRateDate ? `기준일: ${exchangeRateDate}` : "외화 자산의 원화 환산 기준"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap w-24">🇺🇸 USD</Label>
                    <div className="flex items-center gap-2 flex-1">
                      <NumberInput
                        value={exchangeRates.USD}
                        onChange={(val) => updateExchangeRate("USD", val)}
                        className="flex-1"
                        quickButtons={[]}
                        allowDecimals={true}
                        maxDecimals={1}
                      />
                      <span className="text-sm text-muted-foreground shrink-0">원</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm font-medium whitespace-nowrap w-24">🇯🇵 JPY (100¥)</Label>
                    <div className="flex items-center gap-2 flex-1">
                      <NumberInput
                        value={exchangeRates.JPY}
                        onChange={(val) => updateExchangeRate("JPY", val)}
                        className="flex-1"
                        quickButtons={[]}
                        allowDecimals={true}
                        maxDecimals={1}
                      />
                      <span className="text-sm text-muted-foreground shrink-0">원</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "select-action" && selectedAsset && (
            <div className="flex flex-col gap-2 px-3">
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                onClick={handleActionAdd}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">추가</p>
                  <p className="text-xs text-muted-foreground">새 {selectedAsset.label} 자산 등록</p>
                </div>
              </button>
              {selectedAsset.navigateTab && (
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                  onClick={handleActionEdit}
                >
                  <Pencil className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">수정</p>
                    <p className="text-xs text-muted-foreground">{selectedAsset.label} 탭으로 이동</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground ml-auto" />
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                onClick={() => setStep("select-type")}
              >
                <ChevronLeft className="size-4" />
                자산 유형 다시 선택
              </button>
            </div>
          )}

          {step === "select-method" && (
            <div className="flex flex-col gap-2 px-3">
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                onClick={() => handleMethodSelect("screenshot")}
              >
                <ImageUp className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">스크린샷 가져오기</p>
                  <p className="text-xs text-muted-foreground">스크린샷 화면 자동 인식</p>
                </div>
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                onClick={() => handleMethodSelect("manual")}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">직접 입력</p>
                  <p className="text-xs text-muted-foreground">수동으로 직접 입력</p>
                </div>
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                onClick={() => setStep("select-action")}
              >
                <ChevronLeft className="size-4" />
                이전으로
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
