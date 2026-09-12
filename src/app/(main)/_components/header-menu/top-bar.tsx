"use client";

import { IdCard, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { MAIN_PALETTE } from "@/config/theme";
import { cn } from "@/lib/utils";
import { useAssetData } from "@/contexts/asset-data-context";
import { ShareScreenshotDialog } from "./share/share-menu";
import { recordVisit } from "@/lib/feature-usage";
import { useAssetNavigation, getBackLabel } from "../layout/navigation/navigation-context";
import { InlineSelector } from "../layout/ui/inline-selector";
import { PwaInstallButton } from "../pwa/pwa-install-button";

type HomeTop = "detail" | "activity";
const HOME_TOP_OPTIONS: { value: HomeTop; label: string; dataTutorial?: string }[] = [
  { value: "detail", label: "상세", dataTutorial: "tutorial-detail-tab" },
  { value: "activity", label: "성과", dataTutorial: "tutorial-activity-tab" },
];

// 상단 아이콘 버튼 공용 크기 (한 단계 ↑)
const ICON_BTN = "inline-flex items-center justify-center h-10 sm:h-11 w-10 sm:w-11 rounded-lg shrink-0 transition-opacity hover:opacity-85";

function ShareScreenshotButton() {
  const [open, setOpenState] = useState(false);
  // 외부(홈 팁 등)에서 특정 카드 타입으로 바로 열어달라고 요청한 값 — dispatchOpenShareCard(variant)
  const [initialVariant, setInitialVariant] = useState<"stock" | "portfolio" | undefined>(undefined);
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
      const detail = (e as CustomEvent<{ variant?: "stock" | "portfolio" }>).detail;
      setInitialVariant(detail?.variant);
      setOpen(true);
    };
    window.addEventListener("trigger-open-share-card", handler);
    return () => window.removeEventListener("trigger-open-share-card", handler);
  }, []);

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  if (!hasAssets) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${ICON_BTN} border-none text-white`}
        style={{ backgroundColor: MAIN_PALETTE[5] }}
        aria-label="인증카드"
        title="인증카드"
        data-tutorial="tutorial-screenshot-btn"
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
    (assetData.realEstate.length === 0 &&
      assetData.stocks.length === 0 &&
      assetData.crypto.length === 0 &&
      assetData.cash.length === 0 &&
      assetData.loans.length === 0);

  // 우측 아이콘 노출 규칙 (PWA standalone 모드에선 CSS로 완전히 가림)
  const showShare =
    view.type === "home" ||
    (view.type === "detail" && (view.tab === "hub" || view.tab === "stocks")) ||
    (view.type === "activity" && (view.tab === "hub" || view.tab === "netasset" || view.tab === "profit"));
  const showMore = view.type === "home" && !isWelcomeGuide;
  const showInstall = true;

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
      className={cn(
        "flex h-12 sm:h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 relative",
        "bg-background rounded-t-[inherit] overflow-hidden",
        "mt-1",
        isNestedView && "pwa-show-header"
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
            {/* 홈 화면 전용 서비스 로고 — "상세/성과" 세그먼트 왼쪽. 하위 화면(isSubView)에서는
                이 분기 자체가 안 렌더돼 뒤로가기 버튼만 보인다(기존과 동일).
                좌측 정렬 기준은 대시보드 최상단 카드의 텍스트 시작선이 아니라 **카드 색상 박스(bg-primary/10)
                자체의 외곽 모서리**(사용자 확인) — 이 모서리는 페이지 콘텐츠 영역(data-content-area)
                좌측 끝과 같은 지점이라, top-bar 컨테이너의 px-3 패딩만으로 이미 정렬된다. 추가
                마진 불필요(직전엔 카드 "텍스트" 시작선(px-4만큼 더 안쪽)에 맞추려 ml-4를 넣었다가
                모바일에서 카드보다 오른쪽으로 처지는 회귀 — 되돌림). */}
            <Logo size={22} className="text-foreground shrink-0" />
            <InlineSelector
              value={"" as HomeTop}
              onChange={onHomeTabChange}
              options={HOME_TOP_OPTIONS}
              size="xl"
              className="ml-2"
              ariaLabel="페이지 선택"
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pwa-hide-actions">
        {showInstall && <PwaInstallButton />}
        {showShare && <ShareScreenshotButton />}
        {showMore && <MoreButton />}
      </div>
    </div>
    </header>
  );
}
