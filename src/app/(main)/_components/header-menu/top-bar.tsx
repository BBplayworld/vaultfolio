"use client";

import { IdCard, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { MAIN_PALETTE } from "@/config/theme";
import { cn } from "@/lib/utils";
import { useAssetData } from "@/contexts/asset-data-context";
import { HEADER_ENTRY_BTN_BRAND, HEADER_ICON_BTN } from "./menu-styles";
import { ShareScreenshotDialog } from "./share/share-menu";
import { recordVisit } from "@/lib/feature-usage";
import { useAssetNavigation, getBackLabel } from "../layout/navigation/navigation-context";
import { InlineSelector } from "../layout/ui/inline-selector";
import { PwaInstallButton } from "../pwa/pwa-install-button";
import { InstallNudge } from "../pwa/install-nudge";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { track } from "@/lib/analytics/ga";
import { hasAnyAssets } from "@/lib/asset/asset-storage";

type HomeTop = "detail" | "activity";
const HOME_TOP_OPTIONS: { value: HomeTop; label: string; dataTutorial?: string }[] = [
  { value: "detail", label: "상세", dataTutorial: "tutorial-detail-tab" },
  { value: "activity", label: "성과", dataTutorial: "tutorial-activity-tab" },
];

// 상단 아이콘 버튼 공용 크기 (한 단계 ↑) — menu-styles.ts의 HEADER_ICON_BTN
const ICON_BTN = HEADER_ICON_BTN;

function ShareScreenshotButton() {
  const [open, setOpenState] = useState(false);
  // 외부(홈 팁 등)에서 특정 카드 타입으로 바로 열어달라고 요청한 값 — dispatchOpenShareCard(variant)
  const [initialVariant, setInitialVariant] = useState<"stock" | "portfolio" | "type" | undefined>(undefined);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("screenshot-dialog-toggle", { detail: { open: next } }));
    }
  };
  const { assetData } = useAssetData();

  // 홈 기능 활용 팁 박스 등 외부에서 페이지 이동 없이 그 자리에서 여는 진입점(S-4.32)
  useEffect(() => {
    const handler = (e: Event) => {
      recordVisit("share-card");
      const detail = (e as CustomEvent<{ variant?: "stock" | "portfolio" | "type"; source?: "top_bar" | "home_tip" }>).detail;
      track("feature_use", { category: "share_card", method: "open", source: detail?.source ?? "home_tip" });
      setInitialVariant(detail?.variant);
      setOpen(true);
    };
    window.addEventListener("trigger-open-share-card", handler);
    return () => window.removeEventListener("trigger-open-share-card", handler);
  }, []);

  const hasAssets =
    hasAnyAssets(assetData);

  if (!hasAssets) return null;

  return (
    <>
      <button
        onClick={() => {
          recordVisit("share-card");
          track("feature_use", { category: "share_card", method: "open", source: "top_bar" });
          setOpen(true);
        }}
        className={`${ICON_BTN} ${HEADER_ENTRY_BTN_BRAND}`}
        aria-label="인증카드"
        title="인증카드"
        data-tutorial="tutorial-screenshot-btn"
        data-testid="top-bar-share-card"
      >
        <IdCard className="size-5 sm:size-6" />
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} initialVariant={initialVariant} />
    </>
  );
}

function MoreButton() {
  const { navigate } = useAssetNavigation();
  return (
    <button
      type="button"
      onClick={() => navigate({ type: "more" })}
      className={`${ICON_BTN} border-none text-white`}
      style={{ backgroundColor: MAIN_PALETTE[11] }}
      aria-label="더보기"
      title="더보기"
      data-tutorial="tutorial-tool-menu"
      id="tool-menu-trigger"
    >
      <MoreHorizontal className="size-5 sm:size-6" />
    </button>
  );
}

export function TopBar() {
  const { view, navigate, back } = useAssetNavigation();
  const { assetData, isSharePending } = useAssetData();
  const title = getBackLabel(view);
  const isSubView = view.type !== "home";

  // 웰컴가이드(자산 없음·공유 대기) 시 상단 상세/성과·더보기 영역 숨김
  const isWelcomeGuide =
    isSharePending ||
    !hasAnyAssets(assetData);

  // 우측 아이콘 노출 규칙 (PWA standalone 모드에선 CSS로 완전히 가림)
  const showShare =
    view.type === "home" ||
    (view.type === "detail" && (view.tab === "hub" || view.tab === "stocks")) ||
    (view.type === "activity" && (view.tab === "hub" || view.tab === "change"));
  // 체험 모드(#59): 더보기(공유·피드백·동기화·설정)·설치(설치 흐름이 /api/share 사용) 숨김, 인증카드(로컬 PNG)는 유지
  const trial = isTrialMode();
  const showMore = view.type === "home" && !isWelcomeGuide && !trial;
  const showInstall = !trial;

  const onHomeTabChange = (tab: HomeTop) => {
    if (tab === "detail") navigate({ type: "detail", tab: "hub" });
    if (tab === "activity") navigate({ type: "activity", tab: "hub" });
  };

  // 웰컴가이드 페이지에선 헤더 영역 자체를 렌더하지 않아 공간을 차지하지 않게 함
  if (isWelcomeGuide) return null;

  // 1차 허브 페이지(홈, 상세 허브, 성과 허브, 더보기)를 제외한 2단계/3단계 서브페이지는 pwa-show-header 클래스 부여
  const isNestedView =
    view.type === "settings" ||
    (view.type === "detail" && view.tab !== "hub") ||
    (view.type === "activity" && view.tab !== "hub");

  return (
    <header
      data-navbar-style="scroll"
      data-testid="top-bar"
      className={cn(
        "flex h-12 sm:h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 relative",
        "bg-background rounded-t-[inherit] overflow-x-clip",
        "mt-1",
        isNestedView && "pwa-show-header",
        view.type === "home" && "pwa-home-header"
      )}
    >
    <div className="flex w-full items-center justify-between px-3 lg:px-12">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        {isSubView ? (
          <button
            onClick={back}
            aria-label="뒤로가기"
            className="inline-flex items-center gap-1.5 sm:gap-2 -ml-1 sm:-ml-2 px-1.5 sm:px-2 py-1 rounded-md hover:bg-muted transition-colors min-w-0"
          >
            <ChevronLeft className="size-6 sm:size-7 shrink-0" />
            <span className="text-lg sm:text-2xl lg:text-2xl font-bold truncate">{title}</span>
          </button>
        ) : (
          <>
            {/* 홈 전용 공식 락업(앱 아이콘 타일 + 워드마크). 브라우저는 타일만, PWA는 워드마크까지.
                좌측 x는 헤더 px-3 패딩만으로 대시보드 카드 외곽 모서리와 정렬(추가 마진 금지). */}
            <BrandLockup />
            <div className="contents pwa-hide-actions">
              <InlineSelector
                value={"" as HomeTop}
                onChange={onHomeTabChange}
                options={HOME_TOP_OPTIONS}
                size="xl"
                className="ml-0 min-[360px]:ml-3"
                ariaLabel="페이지 선택"
              />
            </div>
          </>
        )}
      </div>
      {/* PWA에서는 설치·더보기만 숨기고 인증카드는 유지(#4.66). contents 래퍼라 브라우저 레이아웃은 그대로 */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="contents pwa-hide-actions">
          {showInstall && <PwaInstallButton />}
          {showInstall && <InstallNudge />}
        </div>
        {showShare && <ShareScreenshotButton />}
        <div className="contents pwa-hide-actions">
          {showMore && <MoreButton />}
        </div>
      </div>
    </div>
    </header>
  );
}
