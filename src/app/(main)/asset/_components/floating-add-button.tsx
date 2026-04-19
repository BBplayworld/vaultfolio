"use client";

import { useState } from "react";
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ChevronLeft, History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type AssetType = "real-estate" | "stock" | "crypto" | "cash" | "loan" | "yearly-net-asset";
type Step = "select-type" | "select-method";

const ASSET_TYPES = [
  { type: "real-estate" as AssetType, label: "부동산", icon: Building2, hasScreenshot: false },
  { type: "stock" as AssetType, label: "주식", icon: TrendingUp, hasScreenshot: true },
  { type: "crypto" as AssetType, label: "암호화폐", icon: Bitcoin, hasScreenshot: true },
  { type: "cash" as AssetType, label: "현금성 자산", icon: Wallet, hasScreenshot: true },
  { type: "loan" as AssetType, label: "대출", icon: CreditCard, hasScreenshot: true },
  { type: "yearly-net-asset" as AssetType, label: "과거 순자산", icon: History, hasScreenshot: false },
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

  const resetState = () => {
    setStep("select-type");
    setSelectedType(null);
  };

  const handleTypeSelect = (type: AssetType, hasScreenshot: boolean) => {
    if (!hasScreenshot) {
      window.dispatchEvent(new CustomEvent(EVENT_MAP[type]));
      setIsOpen(false);
      resetState();
    } else {
      setSelectedType(type);
      setStep("select-method");
    }
  };

  const handleMethodSelect = (mode: "screenshot" | "manual") => {
    if (!selectedType) return;
    window.dispatchEvent(new CustomEvent(EVENT_MAP[selectedType], { detail: { mode } }));
    setIsOpen(false);
    resetState();
  };

  const selectedAsset = ASSET_TYPES.find((a) => a.type === selectedType);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg
        px-6 py-3.5 sm:px-10 sm:py-4.5 text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="자산 추가"
      >
        <Plus className="size-5" />
        자산 추가
      </button>

      <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <SheetContent side={isMobile ? "top" : "right"} className="rounded-t-2xl pb-10">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {step === "select-type" ? "자산 유형 선택" : `${selectedAsset?.label} 추가 방법`}
            </SheetTitle>
          </SheetHeader>

          {step === "select-type" && (
            <div className="flex flex-col gap-2">
              {ASSET_TYPES.map(({ type, label, icon: Icon, hasScreenshot }) => (
                <button
                  key={type}
                  type="button"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
                  onClick={() => handleTypeSelect(type, hasScreenshot)}
                >
                  <Icon className="size-5 text-primary shrink-0" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          )}

          {step === "select-method" && (
            <div className="flex flex-col gap-2">
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
                onClick={() => setStep("select-type")}
              >
                <ChevronLeft className="size-4" />
                자산 유형 다시 선택
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
