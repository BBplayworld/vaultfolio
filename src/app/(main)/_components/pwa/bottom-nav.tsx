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
        <div className="flex items-center justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeId;
            const isCenter = id === "update";
            const isAction = id === "update" || id === "screenshot";

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTap(id)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[3.5rem] py-1 transition-colors"
                aria-label={label}
              >
                {isCenter ? (
                  <div
                    className="flex items-center justify-center size-8 rounded-full text-white"
                    style={{ backgroundColor: MAIN_PALETTE[0] }}
                  >
                    <Icon className="size-5" />
                  </div>
                ) : (
                  <Icon
                    className="size-5"
                    style={isActive ? { color: MAIN_PALETTE[0] } : undefined}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
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
