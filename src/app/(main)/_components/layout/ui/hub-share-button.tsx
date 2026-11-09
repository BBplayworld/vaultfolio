"use client";

import { IdCard } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { HEADER_ENTRY_BTN_INVERT, HEADER_ICON_BTN } from "../../header-menu/menu-styles";
import { dispatchOpenShareCard } from "../navigation/asset-dispatch";

// PWA 전용 인증카드 발송 버튼(상세·성과 허브 제목 줄, #4.66) — 대화상자·리스너 없이 이벤트만 보낸다(열기는 top-bar 인스턴스).
// 브라우저에서는 .pwa-only-action이 숨김(상단 바 아이콘이 있음). 튜토리얼 속성 없음.
export function HubShareButton() {
  const { assetData } = useAssetData();
  if (!hasAnyAssets(assetData)) return null;
  return (
    <button
      type="button"
      onClick={() => dispatchOpenShareCard(undefined, "top_bar")}
      className={`${HEADER_ICON_BTN} ${HEADER_ENTRY_BTN_INVERT} pwa-only-action`}
      aria-label="인증카드"
      title="인증카드"
      data-testid="hub-share-card"
    >
      <IdCard className="size-5 sm:size-6" />
    </button>
  );
}
