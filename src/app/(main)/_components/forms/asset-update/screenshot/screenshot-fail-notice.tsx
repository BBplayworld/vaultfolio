"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { getAssetData } from "@/lib/asset/asset-storage";
import { track } from "@/lib/analytics/ga";
import { ASSET_THEME } from "@/config/theme";
import type { ScreenshotFail, ScreenshotFailAsset } from "@/lib/asset/screenshot-fail";
import { ADD_TRIGGER_EVENTS, dispatchAddStock, dispatchResyncBalance } from "@/app/(main)/_components/layout/navigation/asset-dispatch";

interface ScreenshotFailNoticeProps {
  fail: ScreenshotFail;
  assetType: ScreenshotFailAsset;
  /** 남은 AI 인식 횟수가 있어야 [다른 캡처 고르기]를 보인다(0이면 [직접 입력]만, brand 승격) */
  canRetry: boolean;
  onRetry: () => void;
  /** 직접 입력 도착지로 보낸 뒤 import 대화상자를 닫는다 */
  onClose: () => void;
  /** "add" = 온보딩 마법사: 항상 추가 폼(잔액 맞추기 분기 없음). onSaved 유무로 추론하지 않는다 */
  directInput?: "add";
}

/**
 * [직접 입력] 1회 = asset_add_start(manual) 1건 + 도착지 이벤트 1건. 박스가 직접 보낸다(FAB handleMethodSelect를 거치지 않음).
 * 현금·대출 보유자(마법사 제외)는 잔액 맞추기, 그 밖은 FAB manual과 같은 추가 폼.
 */
export function runDirectInput(assetType: ScreenshotFailAsset, directInput?: "add"): void {
  track("asset_add_start", { asset_type: assetType, method: "manual" });
  if (assetType === "stock") dispatchAddStock("manual");
  else if (directInput !== "add" && (assetType === "cash" || assetType === "loan") && (assetType === "cash" ? getAssetData().cash : getAssetData().loans).length > 0) dispatchResyncBalance(assetType);
  else window.dispatchEvent(new CustomEvent(ADD_TRIGGER_EVENTS[assetType], { detail: { mode: "manual" } }));
}

/** 추가 스크린샷 import 4종 공용 — 인식 실패·빈 결과 뒤 같은 대화상자에서 다음 행동을 남긴다(#99) */
export function ScreenshotFailNotice({ fail, assetType, canRetry, onRetry, onClose, directInput }: ScreenshotFailNoticeProps) {
  const { assetData } = useAssetData();
  const [manualDone, setManualDone] = useState(false);
  const resync =
    directInput !== "add" &&
    (assetType === "cash" ? assetData.cash.length > 0 : assetType === "loan" ? assetData.loans.length > 0 : false);

  const handleManual = () => {
    if (manualDone) return;
    setManualDone(true);
    runDirectInput(assetType, directInput);
    onClose();
  };

  return (
    <div
      role="alert"
      data-testid="screenshot-fail-notice"
      data-kind={fail.kind}
      data-screenshot-hide
      className="flex flex-col gap-3 rounded-lg bg-muted/50 px-4 py-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-5 shrink-0" style={{ color: ASSET_THEME.importantHex }} aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground text-pretty break-keep">{fail.title}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {canRetry && (
          <Button type="button" variant="brand" className="min-h-10 w-full sm:w-auto" data-testid="screenshot-fail-retry" onClick={onRetry}>
            다른 캡처 고르기
          </Button>
        )}
        <Button
          type="button"
          variant={canRetry ? "secondary" : "brand"}
          className="min-h-10 w-full sm:w-auto"
          data-testid="screenshot-fail-manual"
          disabled={manualDone}
          onClick={handleManual}
        >
          {resync ? "직접 입력으로 잔액 고치기" : "직접 입력으로 등록"}
        </Button>
      </div>
    </div>
  );
}
