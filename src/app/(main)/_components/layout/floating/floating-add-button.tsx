"use client";

import { useEffect, useState } from "react";
import { dispatchAddCashTx, dispatchAddCryptoTx, dispatchAddLoanTx, dispatchAddRealEstate, dispatchAddStock, dispatchAddTrade } from "@/app/(main)/_components/layout/navigation/asset-dispatch";
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ChevronLeft, ChevronRight, History, BadgeDollarSign, Pencil, ArrowLeftRight } from "lucide-react";
import { Z_LAYER } from "@/config/theme";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAssetData } from "@/contexts/asset-data-context";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAssetNavigation, type DetailTab } from "../navigation/navigation-context";
import { InfoHint } from "../ui/info-hint";
import type { RefreshCategory } from "@/lib/asset/asset-refresh-status";

type AssetType = "real-estate" | "stock" | "crypto" | "cash" | "loan" | "yearly-net-asset";
// hub: "보유 현황 업데이트" / "매수·매도 거래 기록" 상위 선택
// holdings: 카테고리별 보유현황 컴팩트 리스트(단건 전용)
// trade: 카테고리별 거래 기록 컴팩트 리스트(단건 전용)
// select-method: 보유현황 스크린샷/직접입력 선택(holdings에서만 진입)
type Step = "hub" | "holdings" | "trade" | "select-method";

// 시트 리스트 진입 stagger 공용 클래스 (모션 비활성 환경에선 즉시 표시)
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300";

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
  const [step, setStep] = useState<Step>("hub");
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const { exchangeRates, exchangeRateDate } = useAssetData();
  const { navigate, view } = useAssetNavigation();
  const { isStandalone } = usePWAInstall();
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

  // 하단 네비·넛지에서 시트 열기 이벤트 수신. detail.category가 있으면 hub/holdings를 건너뛰고
  // 해당 카테고리의 단건 흐름으로 바로 진입(넛지 CTA — 가장 오래된 카테고리 1개)
  useEffect(() => {
    const handler = (e: Event) => {
      const category = (e as CustomEvent<{ category?: RefreshCategory }>).detail?.category;
      setIsOpen(true);
      if (category) handleHoldingsClick(category as AssetType);
    };
    window.addEventListener("open-add-asset-sheet", handler);
    return () => window.removeEventListener("open-add-asset-sheet", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인증카드 다이얼로그 열림 상태 추적
  useEffect(() => {
    const handler = (e: Event) => {
      const open = (e as CustomEvent<{ open: boolean }>).detail?.open;
      setScreenshotOpen(!!open);
    };
    window.addEventListener("screenshot-dialog-toggle", handler);
    return () => window.removeEventListener("screenshot-dialog-toggle", handler);
  }, []);

  // 노출 페이지: 홈 + 상세 허브만. 상세 하위 탭·성과·더보기·인증카드에서는 숨김.
  const allowedByView = view.type === "home" || (view.type === "detail" && view.tab === "hub");
  const showBar = allowedByView && !screenshotOpen && !isStandalone;

  const resetState = () => {
    setStep("hub");
    setSelectedType(null);
  };

  // 단건: 카드의 "보유현황" 클릭 — 즉시 처리(기존 select-type→select-action 동작과 동일, 회귀 없음)
  const handleHoldingsClick = (type: AssetType) => {
    const asset = ASSET_TYPES.find((a) => a.type === type);
    setSelectedType(type);
    if (!asset?.hasScreenshot) {
      if (type === "real-estate") dispatchAddRealEstate();
      else if (type === "yearly-net-asset") {
        // 순자산 페이지(YearlyNetAssetChart)가 마운트되어야 trigger 이벤트 수신 가능.
        // 허브/다른 탭에서 진입 시 먼저 netasset 페이지로 이동 후 다음 tick에 dispatch
        navigate({ type: "activity", tab: "netasset" });
        setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT_MAP[type])), 50);
      }
      else window.dispatchEvent(new CustomEvent(EVENT_MAP[type]));
      setIsOpen(false);
      resetState();
    } else {
      setStep("select-method");
    }
  };

  const handleActionEdit = (type: AssetType) => {
    const asset = ASSET_TYPES.find((a) => a.type === type);
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
    if (step === "hub") return "자산 업데이트";
    if (step === "holdings") return "보유 현황 업데이트";
    if (step === "trade") return "매수/매도 거래 기록";
    return `${selectedAsset?.label} 추가`;
  };

  const buttonEl = (
    <button
      onClick={() => setIsOpen(true)}
      className="w-full max-w-xs flex items-center justify-center gap-2 rounded-2xl
      py-3 text-base font-bold active:scale-[0.98] transition-colors
      bg-[#5b6fbf]/10 text-foreground/90 hover:bg-[#5b6fbf]/20"
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
          style={{ zIndex: Z_LAYER.floating }}
          className={`pwa-fab-container fixed bottom-0 left-0 right-0 transition-[transform,opacity] duration-150
          ${isHidden ? "translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}
        >
          <div className="pointer-events-none absolute -top-4 left-0 right-0 h-4 bg-gradient-to-b from-transparent to-background" />
          <div
            className="relative bg-background/95 backdrop-blur-sm flex justify-center
            px-4 py-2 pb-[max(0.8rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="w-full max-w-[240px] flex items-center justify-center gap-1.5 rounded-xl
              py-2.5 text-sm font-bold active:scale-[0.98] transition-colors
              bg-[#5b6fbf]/10 text-foreground hover:bg-[#5b6fbf]/20"
              aria-label="자산 업데이트"
              data-tutorial="tutorial-fab"
            >
              <Plus className="size-4" />
              자산 업데이트
            </button>
          </div>
        </div>
      )}

      {/* PC: 페이지 컨텐츠 흐름 안의 인라인 버튼 (footer 위, max-width 상속, shadow/배경 없음) */}
      {showBar && isMobile === false && (
        <div className="pwa-fab-container w-full flex justify-center">
          {buttonEl}
        </div>
      )}

      <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          hideClose={isMobile}
          className={isMobile
            ? "rounded-t-2xl pb-10 max-h-[80vh] overflow-y-auto touch-pan-y"
            : "rounded-t-2xl pb-10"}
        >
          {isMobile && (
            <div
              className="absolute top-0 left-0 right-0 h-10 flex items-center justify-center cursor-grab touch-none z-50"
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
            >
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <SheetHeader className={isMobile ? "mb-4 mt-3" : "mb-4"}>
            <SheetTitle>{sheetTitle()}</SheetTitle>
          </SheetHeader>

          {step === "hub" && (
            <div className="flex flex-col gap-3 px-3">
              <div className="flex items-center gap-1.5 px-1">
                <p className="text-xs text-muted-foreground">어떤 메뉴를 써야 하는지 헷갈리나요?</p>
                <InfoHint summary="어떤 메뉴를 써야 하나요?" inModal>
                  <p>최초 등록이나 잔고가 어긋났을 때는 보유 현황 업데이트로 재동기화하세요.</p>
                  <p>이후 매수·매도할 때마다 거래 기록으로 남기면 손익·세금 계산이 정확해져요.</p>
                </InfoHint>
              </div>
              <button
                type="button"
                className={`flex items-center gap-3 px-4 py-4 rounded-xl bg-card hover:bg-accent transition-colors text-left ${ENTER}`}
                onClick={() => setStep("holdings")}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">보유 현황 업데이트</p>
                  <p className="text-sm text-muted-foreground">잔고 재동기화 · 이력 없음</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
              <button
                type="button"
                className={`flex items-center gap-3 px-4 py-4 rounded-xl bg-card hover:bg-accent transition-colors text-left ${ENTER}`}
                style={{ animationDelay: "40ms" }}
                onClick={() => setStep("trade")}
              >
                <ArrowLeftRight className="size-5 shrink-0" style={{ color: "#FF6B6B" }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">매수/매도 거래 기록</p>
                  <p className="text-sm text-muted-foreground">신규 종목 등록 가능 · 손익·세금 반영</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>

              <Separator className="my-1" />

              <div className="rounded-xl bg-card px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">환율 설정
                      <span className="text-sm text-muted-foreground ml-2 bg-muted/50 px-2 py-0.5 rounded">
                         {exchangeRateDate ? `기준일: ${exchangeRateDate}` : "외화 자산의 원화 환산 기준"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 justify-between">
                    <Label className="text-sm font-medium whitespace-nowrap">🇺🇸 USD</Label>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{exchangeRates.USD.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center gap-3 justify-between">
                    <Label className="text-sm font-medium whitespace-nowrap">🇯🇵 JPY (100¥)</Label>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{exchangeRates.JPY.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "holdings" && (
            <div className="flex flex-col gap-2 px-3">
              {ASSET_TYPES.map(({ type, label, icon: Icon, navigateTab }, i) => (
                <div
                  key={type}
                  className={`flex items-center gap-1 rounded-lg bg-card overflow-hidden ${ENTER}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2.5 py-3 px-3 text-left min-w-0"
                    onClick={() => handleHoldingsClick(type)}
                  >
                    <Icon className="size-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{type === "yearly-net-asset" ? "기록" : "업데이트"}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                  {navigateTab && (
                    <button
                      type="button"
                      aria-label={`${label} 탭으로 이동`}
                      className="shrink-0 p-3"
                      onClick={() => handleActionEdit(type)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                onClick={() => setStep("hub")}
              >
                <ChevronLeft className="size-4" />
                이전으로
              </button>
            </div>
          )}

          {step === "trade" && (
            <div className="flex flex-col gap-2 px-3">
              {ASSET_TYPES.filter((a) => a.hasScreenshot).map(({ type, label, icon: Icon }, i) => {
                const tradeLabel = type === "cash" ? "입출금 기록" : type === "loan" ? "상환·대출 기록" : "매수·매도 기록";
                const handler =
                  type === "stock" ? dispatchAddTrade
                  : type === "crypto" ? dispatchAddCryptoTx
                  : type === "cash" ? dispatchAddCashTx
                  : dispatchAddLoanTx;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card hover:bg-accent transition-colors text-left ${ENTER}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => { handler(); setIsOpen(false); resetState(); }}
                  >
                    <Icon className="size-5 shrink-0" style={{ color: "#FF6B6B" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{label}</p>
                      <p className="text-sm text-muted-foreground">{tradeLabel}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}

              <button
                type="button"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                onClick={() => setStep("hub")}
              >
                <ChevronLeft className="size-4" />
                이전으로
              </button>
            </div>
          )}

          {step === "select-method" && (
            <div className="flex flex-col gap-2 px-3">
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card hover:bg-accent transition-colors text-left"
                onClick={() => handleMethodSelect("screenshot")}
              >
                <ImageUp className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">스크린샷 가져오기</p>
                  <p className="text-sm text-muted-foreground">화면 자동 인식</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
              </button>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card hover:bg-accent transition-colors text-left"
                onClick={() => handleMethodSelect("manual")}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">직접 입력</p>
                  <p className="text-sm text-muted-foreground">숫자로 직접 입력</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                onClick={() => setStep("holdings")}
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
