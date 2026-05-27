"use client";

import { Camera, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { MAIN_PALETTE } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { ShareScreenshotDialog } from "./share/share-menu";
import { useAssetNavigation, getBackLabel } from "../layout/navigation/navigation-context";
import { InlineSelector } from "../layout/ui/inline-selector";

type HomeTop = "detail" | "activity";
const HOME_TOP_OPTIONS: { value: HomeTop; label: string }[] = [
  { value: "detail", label: "상세" },
  { value: "activity", label: "성과" },
];

// 상단 아이콘 버튼 공용 크기 (한 단계 ↑)
const ICON_BTN = "inline-flex items-center justify-center h-9 sm:h-11 w-9 sm:w-11 rounded-lg shrink-0 transition-opacity hover:opacity-85";

function ShareScreenshotButton() {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("screenshot-dialog-toggle", { detail: { open: next } }));
    }
  };
  const { assetData } = useAssetData();

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
        aria-label="인증샷"
        title="인증샷"
        data-tutorial="tutorial-screenshot-btn"
      >
        <Camera className="size-5 sm:size-6" />
      </button>
      <ShareScreenshotDialog open={open} onOpenChange={setOpen} />
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
  const title = getBackLabel(view);
  const isSubView = view.type !== "home";

  // 우측 아이콘 노출 규칙
  // - 인증샷: 홈 / 상세 허브·주식 / 성과 순자산·수익
  // - 더보기: 홈만
  // - more 페이지: 모두 숨김
  const showShare =
    view.type === "home" ||
    (view.type === "detail" && (view.tab === "hub" || view.tab === "stocks")) || // stocks-xray는 제외
    false ||
    (view.type === "activity" && (view.tab === "hub" || view.tab === "netasset" || view.tab === "profit"));
  const showMore = view.type === "home";

  const onHomeTabChange = (tab: HomeTop) => {
    if (tab === "detail") navigate({ type: "detail", tab: "hub" });
    if (tab === "activity") navigate({ type: "activity", tab: "hub" });
  };

  return (
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
          <InlineSelector
            value={"" as HomeTop}
            onChange={onHomeTabChange}
            options={HOME_TOP_OPTIONS}
            size="xl"
            ariaLabel="페이지 선택"
          />
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {showShare && <ShareScreenshotButton />}
        {showMore && <MoreButton />}
      </div>
    </div>
  );
}
