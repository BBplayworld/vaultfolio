"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toGaAssetType, track } from "@/lib/analytics/ga";
import { ADD_TRIGGER_EVENTS, dispatchAddCashTx, dispatchAddCryptoTx, dispatchAddLoanTx, dispatchAddPhysical, dispatchAddRealEstate, dispatchAddStock, dispatchAddTrade, dispatchOpenYearlyNetAsset, dispatchResyncBalance } from "@/app/(main)/_components/layout/navigation/asset-dispatch";
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, ImageUp, ChevronLeft, ChevronRight, History, BadgeDollarSign, Pencil, ArrowLeftRight, Gem, Check } from "lucide-react";
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
import { CATEGORY_REFRESHED_EVENT, heldRefreshCategories, isRefreshedToday, REFRESH_CATEGORIES, type RefreshCategory } from "@/lib/asset/asset-refresh-status";
import { consumeResyncSignal, isRefreshCategory, nextDialogWatch, resyncNoticeText, shouldTrackResyncContinue, sortHoldingsRows } from "@/lib/asset/resync-return";
import { Button } from "@/components/ui/button";
import { getAssetData } from "@/lib/asset/asset-storage";
import { restoreFocusAfterDialog } from "@/lib/restore-focus";

type AssetType = "real-estate" | "stock" | "crypto" | "cash" | "loan" | "physical" | "yearly-net-asset";
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
  { type: "physical" as AssetType, label: "실물 자산", icon: Gem, hasScreenshot: false, navigateTab: "physical" as string | null },
  { type: "loan" as AssetType, label: "대출", icon: CreditCard, hasScreenshot: true, navigateTab: "loans" as string | null },
  { type: "yearly-net-asset" as AssetType, label: "과거 순자산", icon: History, hasScreenshot: false, navigateTab: null },
];

const EVENT_MAP: Record<AssetType, string> = ADD_TRIGGER_EVENTS;

export function FloatingAddButton() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("hub");
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const { exchangeRates, exchangeRateDate, assetData } = useAssetData();
  const { navigate, view } = useAssetNavigation();
  const { isStandalone } = usePWAInstall();
  const [isHidden, setIsHidden] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  // 현금·대출 보유자 여부 — select-method 진입 시 1회 판정(#93). 보유자는 추가가 아니라 잔액 맞추기로 간다
  const [holderResync, setHolderResync] = useState(false);
  // 이어서 맞추기(#110) — armed: 창이 열려 있는 최신화 자산군(메모리 1개), resumeNotice: 복귀 후 상단 줄에 쓸 자산군
  const armedRef = useRef<RefreshCategory | null>(null);
  const [resumeNotice, setResumeNotice] = useState<RefreshCategory | null>(null);
  const watchRef = useRef<MutationObserver | null>(null);
  // 시트 닫힘 포커스(#115) — openerRef: 열기 직전 포커스 요소, handoffRef: 방법 선택 등으로 다른 창이 이어서 열리면 true(복귀 생략, 잔액 맞추기 goAddRef와 같은 방식)
  const openerRef = useRef<HTMLElement | null>(null);
  const handoffRef = useRef(false);
  const openSheet = () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    handoffRef.current = false;
    setIsOpen(true);
  };
  const restoreSheetFocus = (e: Event) => {
    e.preventDefault();
    if (handoffRef.current) { handoffRef.current = false; return; } // 다음 창이 포커스를 가진다
    restoreFocusAfterDialog(openerRef.current, { skipIfOtherDialog: true });
  };
  const viewKey = `${view.type}:${(view as { tab?: string }).tab ?? ""}`;

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
      openSheet();
      if (category) handleHoldingsClick(category as AssetType);
    };
    window.addEventListener("open-add-asset-sheet", handler);
    return () => window.removeEventListener("open-add-asset-sheet", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 저장 완료 신호 — 대기 중인 자산군과 같을 때만 보유 현황 목록으로 복귀(취소·상세 편집·마법사는 대기 없음 → 무시)
  useEffect(() => {
    const handler = (e: Event) => {
      const category = (e as CustomEvent<{ category?: RefreshCategory }>).detail?.category;
      if (!category) return;
      const r = consumeResyncSignal(armedRef.current, category);
      armedRef.current = r.armed;
      if (!r.resume) return;
      setStep("holdings");
      setResumeNotice(category);
      setIsOpen(true);
    };
    window.addEventListener(CATEGORY_REFRESHED_EVENT, handler);
    return () => window.removeEventListener(CATEGORY_REFRESHED_EVENT, handler);
  }, []);

  // 대기 중 연 창이 저장 신호 없이 닫히면(취소) 대기 해제 — 이후 상세 편집 저장이 시트를 열지 않게
  const watchDialogCancel = () => {
    watchRef.current?.disconnect();
    let seen = false;
    const check = () => {
      const present = !!document.querySelector('[role="dialog"]:not([data-state="closed"]):not(#fab-sheet)');
      const r = nextDialogWatch(seen, present);
      seen = r.seen;
      if (!r.release) return;
      watchRef.current?.disconnect();
      watchRef.current = null;
      requestAnimationFrame(() => { armedRef.current = null; }); // 저장 신호는 같은 tick에 이미 소비됨
    };
    const ob = new MutationObserver(check);
    ob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    watchRef.current = ob;
  };
  useEffect(() => () => watchRef.current?.disconnect(), []);

  // 화면 이동(상세 탭 편집·성과 등)이면 복귀 대기 해제
  useEffect(() => {
    armedRef.current = null;
  }, [viewKey]);

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
    setHolderResync(false);
    setResumeNotice(null);
  };

  // 보유 현황 목록 — 열림·복귀 시 신선값 1회 판정(저장 직후 context 갱신 지연 방지). 보유 우선 정렬 + 오늘 맞춤(✓)
  const holdingsView = useMemo(() => {
    if (!isOpen || step !== "holdings") return null;
    const d = getAssetData();
    const heldRefresh = heldRefreshCategories(d);
    const hasRealEstate = (d.realEstate?.length ?? 0) > 0;
    const hasPhysical = (d.physicalAssets?.length ?? 0) > 0;
    const isHeld = (t: string) => (t === "real-estate" ? hasRealEstate : t === "physical" ? hasPhysical : isRefreshCategory(t) && heldRefresh.includes(t));
    const today = new Set(REFRESH_CATEGORIES.filter((c) => isRefreshedToday(c)));
    const rows = sortHoldingsRows(ASSET_TYPES, isHeld);
    const lastHeldIdx = rows.reduce((acc, r, i) => (isHeld(r.type) ? i : acc), -1);
    const hasUnheld = rows.some((r) => r.type !== "yearly-net-asset" && !isHeld(r.type));
    const firstTodo = rows.find((r) => isRefreshCategory(r.type) && isHeld(r.type) && !today.has(r.type))?.type ?? null;
    const notice = resumeNotice
      ? resyncNoticeText(resumeNotice, { held: heldRefresh, refreshedToday: (c) => today.has(c), hasRealEstateOrPhysical: hasRealEstate || hasPhysical })
      : null;
    return { rows, isHeld, today, divideAfter: lastHeldIdx >= 0 && hasUnheld ? lastHeldIdx : -1, firstTodo, notice };
  }, [isOpen, step, resumeNotice]);

  // 복귀 시 포커스 — 첫 미맞춤 보유 행(없으면 [완료])
  useEffect(() => {
    if (!isOpen || step !== "holdings" || !resumeNotice) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-resync-first="true"]');
      el?.focus({ preventScroll: true }); // 하단 [완료]로 포커스가 가도 상단 상태 줄이 가려지지 않게 스크롤 금지
      el?.closest<HTMLElement>('[data-slot="sheet-content"]')?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, step, resumeNotice]);

  // 단건: 카드의 "보유현황" 클릭 — 즉시 처리(기존 select-type→select-action 동작과 동일, 회귀 없음)
  const handleHoldingsClick = (type: AssetType) => {
    const asset = ASSET_TYPES.find((a) => a.type === type);
    if (shouldTrackResyncContinue(resumeNotice, type)) track("feature_use", { category: "resync_continue" });
    setSelectedType(type);
    if (!asset?.hasScreenshot) {
      track("asset_add_start", { asset_type: toGaAssetType(type), method: "manual" });
      if (type === "real-estate") dispatchAddRealEstate();
      else if (type === "physical") dispatchAddPhysical();
      else if (type === "yearly-net-asset") {
        // 연도별 순자산(YearlyNetAssetChart)이 마운트되어야 열 수 있다 — 이동 후 열기 요청 1회를 남기면
        // 차트가 마운트 시/이벤트 수신 시 꺼내 쓴다(타이머 없음). 이미 연 탭이면 이벤트로 바로 열린다.
        navigate({ type: "activity", tab: "change", init: { scope: "all", period: "year" } });
        dispatchOpenYearlyNetAsset();
      }
      else window.dispatchEvent(new CustomEvent(EVENT_MAP[type]));
      handoffRef.current = true;
      setIsOpen(false);
      resetState();
    } else {
      if (type === "cash" || type === "loan") {
        const fresh = getAssetData();
        setHolderResync((type === "cash" ? fresh.cash : fresh.loans).length > 0);
      } else setHolderResync(false);
      setStep("select-method");
    }
  };

  const handleActionEdit = (type: AssetType) => {
    const asset = ASSET_TYPES.find((a) => a.type === type);
    if (!asset?.navigateTab) return;
    armedRef.current = null;
    navigate({ type: "detail", tab: asset.navigateTab as DetailTab });
    setIsOpen(false);
    resetState();
  };

  const handleMethodSelect = (mode: "screenshot" | "manual") => {
    if (!selectedType) return;

    track("asset_add_start", { asset_type: toGaAssetType(selectedType), method: mode });
    if (selectedType === "stock") dispatchAddStock(mode);
    else if (mode === "manual" && holderResync && (selectedType === "cash" || selectedType === "loan")) dispatchResyncBalance(selectedType);
    else window.dispatchEvent(new CustomEvent(EVENT_MAP[selectedType], { detail: { mode } }));
    const armTarget = isRefreshCategory(selectedType) ? selectedType : null; // 마법사(directInput="add")는 FAB를 거치지 않아 대기 없음
    handoffRef.current = true;
    setIsOpen(false);
    resetState();
    armedRef.current = armTarget;
    if (armTarget) watchDialogCancel();
  };

  const selectedAsset = ASSET_TYPES.find((a) => a.type === selectedType);

  const sheetTitle = () => {
    if (step === "hub") return "자산 업데이트";
    if (step === "holdings") return "보유 현황 업데이트";
    if (step === "trade") return "매수/매도 거래 기록";
    if (holderResync) return `${selectedAsset?.label} 업데이트`;
    return `${selectedAsset?.label} 추가`;
  };

  const buttonEl = (
    <button
      onClick={openSheet}
      className="w-full max-w-xs flex items-center justify-center gap-2 rounded-xl
      py-3 text-base font-bold active:scale-[0.98] transition-colors
      bg-brand/10 text-foreground/90 hover:bg-brand/20 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="자산 업데이트"
      data-tutorial="tutorial-fab"
    >
      <Plus className="size-5" />
      자산 업데이트
    </button>
  );

  return (
    <>
      {/* 모바일: 하단 고정 바 (배경·헤어라인·스크롤 hide 포함) */}
      {showBar && isMobile && (
        <div
          style={{ zIndex: Z_LAYER.floating }}
          className={`pwa-fab-container fixed bottom-0 left-0 right-0 transition-[transform,opacity] duration-150
          ${isHidden ? "translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}
        >
          <div
            className="relative bg-background border-t border-border dark:border-t-0 flex justify-center
            px-4 py-2 pb-[max(0.8rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={openSheet}
              className="w-full max-w-[240px] flex items-center justify-center gap-1.5 rounded-xl
              py-2.5 text-sm font-bold active:scale-[0.98] transition-colors
              bg-brand/10 text-foreground hover:bg-brand/20 focus-visible:ring-2 focus-visible:ring-ring"
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

      <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { armedRef.current = null; resetState(); } }}>
        <SheetContent
          id="fab-sheet"
          onCloseAutoFocus={restoreSheetFocus}
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
                  if (dy > 80) { armedRef.current = null; setIsOpen(false); }
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
                className={`flex items-center gap-3 px-4 py-4 rounded-xl bg-card dark:bg-muted hover:bg-accent dark:hover:bg-accent transition-colors text-left ${ENTER}`}
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
                className={`flex items-center gap-3 px-4 py-4 rounded-xl bg-card dark:bg-muted hover:bg-accent dark:hover:bg-accent transition-colors text-left ${ENTER}`}
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

              <div className="rounded-xl bg-card dark:bg-muted px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">적용 환율
                      <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
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

          {step === "holdings" && holdingsView && (
            <div className="flex flex-col gap-2 px-3">
              {holdingsView.notice && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="fab-resync-notice"
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-medium text-foreground text-balance break-keep motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  <Check className="size-4 text-brand shrink-0" aria-hidden="true" />
                  {holdingsView.notice}
                </div>
              )}
              {holdingsView.rows.map(({ type, label, icon: Icon, navigateTab }, i) => {
                const held = holdingsView.isHeld(type);
                const checked = isRefreshCategory(type) && held && holdingsView.today.has(type);
                const sub = type === "yearly-net-asset" ? "기록" : !held ? "추가" : checked ? "오늘 맞춤" : "업데이트";
                return (
                  <div key={type} className="contents">
                    <div
                      className={`flex items-center gap-1 rounded-lg bg-card dark:bg-muted overflow-hidden ${resumeNotice ? "" : ENTER}`}
                      style={resumeNotice ? undefined : { animationDelay: `${i * 40}ms` }}
                    >
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-2.5 py-3 px-3 text-left min-w-0 active:scale-[0.98] transition-[background-color,scale]"
                        data-testid={type === "physical" ? "fab-asset-physical" : `fab-holdings-row-${type}`}
                        data-resync-first={holdingsView.firstTodo === type ? "true" : undefined}
                        aria-label={checked ? `${label}, 오늘 맞춤` : undefined}
                        onClick={() => handleHoldingsClick(type)}
                      >
                        <Icon className={`size-5 shrink-0 ${held || type === "yearly-net-asset" ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{sub}</p>
                        </div>
                        {checked && (
                          <span data-testid={`fab-holdings-checked-${type}`} className="shrink-0 flex">
                            <Check className="size-4 text-brand motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" aria-hidden="true" />
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      </button>
                      {navigateTab && !(type === "physical" && (assetData.physicalAssets?.length ?? 0) === 0) && ( // 실물 0건이면 이동할 탭이 비어 연필 숨김
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
                    {i === holdingsView.divideAfter && <div className="h-px bg-border/40 my-1" aria-hidden="true" />}
                  </div>
                );
              })}

              {resumeNotice ? (
                <Button
                  variant="brand"
                  className="w-full h-11 rounded-lg mt-1"
                  data-testid="fab-resync-done"
                  data-resync-first={holdingsView.firstTodo === null ? "true" : undefined}
                  onClick={() => { armedRef.current = null; setIsOpen(false); resetState(); }}
                >
                  완료
                </Button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm text-muted-foreground"
                  onClick={() => setStep("hub")}
                >
                  <ChevronLeft className="size-4" />
                  이전으로
                </button>
              )}
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
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card dark:bg-muted hover:bg-accent dark:hover:bg-accent transition-colors text-left ${ENTER}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => { handler(); handoffRef.current = true; setIsOpen(false); resetState(); }}
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
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card dark:bg-muted hover:bg-accent dark:hover:bg-accent transition-colors text-left"
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
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card dark:bg-muted hover:bg-accent dark:hover:bg-accent transition-colors text-left"
                onClick={() => handleMethodSelect("manual")}
              >
                <Plus className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">직접 입력</p>
                  <p className="text-sm text-muted-foreground">
                    {holderResync ? (selectedType === "loan" ? "대출별 잔액 고치기" : "계좌별 잔액 고치기") : "숫자로 직접 입력"}
                  </p>
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
