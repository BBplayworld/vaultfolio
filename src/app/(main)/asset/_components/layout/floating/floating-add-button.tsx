"use client";

import { useEffect, useRef, useState } from "react";
import { dispatchAddRealEstate, dispatchAddStock } from "@/app/(main)/asset/_components/layout/navigation/asset-dispatch";
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ChevronLeft, History, BadgeDollarSign, ArrowRight, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { MAIN_PALETTE } from "@/config/theme";
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
  const { navigate } = useAssetNavigation();
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY.current;
      if (Math.abs(dy) < 10) return;
      if (y < 100) setIsHidden(false);
      else setIsHidden(dy > 0);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  return (
    <>
      {/* 하단 고정 바 — 배경 페이지와 자연스럽게 이어지도록 상단 그라데이션 페이드 + solid bg */}
      {/* 숨김 시 그라데이션(-top-4 = 16px overshoot)까지 함께 화면 밖으로 밀어내야 잔상 라인이 안 보임 */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300
        ${isHidden ? "translate-y-[calc(100%+1rem)]" : "translate-y-0"}`}
      >
        {/* 상단 그라데이션 페이드 — 스크롤되는 콘텐츠가 바 위로 자연스럽게 흐려짐 */}
        <div className="pointer-events-none absolute -top-4 left-0 right-0 h-4 bg-gradient-to-b from-transparent to-background" />
        <div
          className="relative bg-background/95 backdrop-blur-sm
          px-4 sm:px-6 py-2 sm:py-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] sm:pb-[max(1.2rem,env(safe-area-inset-bottom))] flex justify-center"
        >
          <button
            onClick={() => setIsOpen(true)}
            style={{ backgroundColor: MAIN_PALETTE[11] }}
            className="flex items-center gap-2 rounded-full text-white
            shadow-md px-5 py-3 text-sm font-semibold active:scale-95 transition-opacity hover:opacity-85"
            aria-label="자산 추가"
            data-tutorial="tutorial-fab"
          >
            <Plus className="size-5" />
            자산 업데이트
          </button>
        </div>
      </div>

      <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <SheetContent side={isMobile ? "top" : "right"} className="rounded-t-2xl pb-10">
          <SheetHeader className="mb-4">
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
