"use client";

import { useEffect, useState } from "react";

import { track } from "@/lib/analytics/ga";
import { useAssetData } from "@/contexts/asset-data-context";
import { isPwaLocked, PWA_UNLOCKED_EVENT } from "@/lib/pwa/app-lock";
import { isTrialMode } from "@/lib/trial/trial-mode";
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";
import { canOpenHandoff, peekHandoff, takeHandoff } from "@/lib/ratio-preview/handoff";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import { StockScreenshotImport } from "../forms/asset-update/screenshot/stock-screenshot-import";

/**
 * /ratio → 앱 인계 호스트(#63). (main) layout에 1줄로 마운트된다.
 * 마운트 시 인계가 없으면 영구히 null(구독·확인 창 마운트 없음). 있으면 열기 조건이 풀릴 때 1회 소비해
 * 기존 StockScreenshotImport를 initialParsed로 연다. 튜토리얼 activeStep은 조건이 아니다(design-final Q2).
 */
export function RatioHandoffHost() {
  const [hasHandoff] = useState(() => peekHandoff() !== null);
  if (!hasHandoff) return null;
  return <HandoffGate />;
}

function HandoffGate() {
  const { isDataLoaded, isSharePending } = useAssetData();
  const wizardIsOpen = useOnboardingWizardStore((s) => s.isOpen);
  // isPwaLocked는 반응형이 아니라 잠금 해제 이벤트에서 재평가한다
  const [unlockTick, setUnlockTick] = useState(0);
  const [parsed, setParsed] = useState<ParsedStock[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onUnlock = () => setUnlockTick((n) => n + 1);
    window.addEventListener(PWA_UNLOCKED_EVENT, onUnlock);
    return () => window.removeEventListener(PWA_UNLOCKED_EVENT, onUnlock);
  }, []);

  useEffect(() => {
    if (parsed) return;
    if (!canOpenHandoff({ isDataLoaded, pwaLocked: isPwaLocked(), isSharePending, wizardIsOpen, isTrialMode: isTrialMode() })) return;
    const raw = takeHandoff(); // 1회 소비. 만료(null)면 열지 않는다
    if (!raw) return;
    setParsed(raw);
    setOpen(true);
  }, [parsed, isDataLoaded, isSharePending, wizardIsOpen, unlockTick]);

  if (!parsed) return null;
  return (
    <StockScreenshotImport
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setParsed(null); // 닫히면 언마운트
      }}
      initialParsed={parsed}
      onSaved={() => track("feature_use", { category: "ratio_preview", method: "submit", result: "create" })}
    />
  );
}
