"use client";

import { useState, useEffect } from "react";
import { Home, PieChart, TrendingUp, PlusCircle, Camera, MoreHorizontal } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAssetNavigation } from "../layout/navigation/navigation-context";
import { useAssetData } from "@/contexts/asset-data-context";
import { MAIN_PALETTE } from "@/config/theme";
import { ShareScreenshotDialog } from "../header-menu/share/share-menu";

type NavItem = {
  id: string;
  label: string;
  icon: typeof PieChart;
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "detail", label: "상세", icon: PieChart },
  { id: "activity", label: "성과", icon: TrendingUp },
  { id: "update", label: "업데이트", icon: PlusCircle },
  { id: "screenshot", label: "인증샷", icon: Camera },
  { id: "more", label: "더보기", icon: MoreHorizontal },
];

function getActiveId(viewType: string): string | null {
  if (viewType === "home") return "home";
  if (viewType === "detail") return "detail";
  if (viewType === "activity") return "activity";
  if (viewType === "more" || viewType === "settings") return "more";
  return null;
}

export function BottomNav() {
  const { isStandalone } = usePWAInstall();
  const { view, navigate } = useAssetNavigation();
  const { assetData, isSharePending } = useAssetData();
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|webos|blackberry|iemobile|opera mini/i.test(userAgent);
      document.documentElement.setAttribute("data-device", isMobile ? "mobile" : "pc");
    }
  }, []);

  if (!mounted) return null;

  // 웰컴가이드(자산 없음·공유 대기) 시 숨김
  const isWelcomeGuide =
    isSharePending ||
    (assetData.realEstate.length === 0 &&
      assetData.stocks.length === 0 &&
      assetData.crypto.length === 0 &&
      assetData.cash.length === 0 &&
      assetData.loans.length === 0);

  if (isWelcomeGuide) return null;

  const activeId = getActiveId(view.type);

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  const handleTap = (id: string) => {
    // 전 탭 햅틱 (안드로이드만 동작 — iOS는 Web Vibration 미지원으로 no-op)
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
    switch (id) {
      case "home":
        navigate({ type: "home" });
        break;
      case "detail":
        navigate({ type: "detail", tab: "hub" });
        break;
      case "activity":
        navigate({ type: "activity", tab: "hub" });
        break;
      case "update":
        window.dispatchEvent(new CustomEvent("open-add-asset-sheet"));
        break;
      case "screenshot":
        if (hasAssets) {
          setScreenshotOpen(true);
          window.dispatchEvent(new CustomEvent("screenshot-dialog-toggle", { detail: { open: true } }));
        }
        break;
      case "more":
        navigate({ type: "more" });
        break;
    }
  };

  const handleScreenshotChange = (open: boolean) => {
    setScreenshotOpen(open);
    window.dispatchEvent(new CustomEvent("screenshot-dialog-toggle", { detail: { open } }));
  };

  return (
    <>
      <nav className="pwa-nav-container fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around px-2 pt-2 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeId;
            const isCenter = id === "update";
            const isAction = id === "update" || id === "screenshot";

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTap(id)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[3.25rem] min-h-[44px] py-1.5 select-none transition-transform duration-100 active:scale-95 [-webkit-tap-highlight-color:transparent]"
                style={{ touchAction: "manipulation" }}
                aria-label={label}
              >
                {isCenter ? (
                  <div
                    className="flex items-center justify-center size-8 -mt-1 rounded-2xl text-white shadow-lg shadow-primary/30"
                    style={{ backgroundColor: MAIN_PALETTE[0] }}
                  >
                    <Icon className="size-5" />
                  </div>
                ) : (
                  <span
                    className={`flex items-center justify-center rounded-full px-3 py-1 transition-colors ${
                      isActive && !isAction ? "bg-primary/10" : ""
                    }`}
                  >
                    <Icon
                      className="size-5 transition-colors"
                      style={isActive ? { color: MAIN_PALETTE[0] } : undefined}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </span>
                )}
                <span
                  className={`text-[10px] leading-tight ${
                    isActive && !isAction
                      ? "font-semibold"
                      : "text-muted-foreground"
                  }`}
                  style={isActive && !isAction ? { color: MAIN_PALETTE[0] } : undefined}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <ShareScreenshotDialog open={screenshotOpen} onOpenChange={handleScreenshotChange} />
    </>
  );
}
