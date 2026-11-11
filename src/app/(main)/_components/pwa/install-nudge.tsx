"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAssetData } from "@/contexts/asset-data-context";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { countAssets, track } from "@/lib/analytics/ga";
import {
  dismissInstallNudge,
  getDismissed,
  getFirstSave,
  getNudgeShown,
  markNudgeShown,
  setNudgeVisible,
  subscribeFirstSave,
} from "@/lib/pwa/first-save-signal";
import { shouldShowInstallNudge } from "@/lib/pwa/install-nudge-policy";
import { useAssetNavigation } from "../layout/navigation/navigation-context";
import { PwaInstallFlow, type PwaInstallTrigger } from "./pwa-install-flow";

function NudgeCard({ trigger }: { trigger: PwaInstallTrigger }) {
  const { view } = useAssetNavigation();
  const { assetData } = useAssetData();
  const dismissed = useSyncExternalStore(subscribeFirstSave, getDismissed, () => false);
  const wizardOpen = useOnboardingWizardStore((s) => s.isOpen);
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isHome = view.type === "home";
  const assetCount = countAssets(assetData);

  // 열린 다이얼로그는 조건이 바뀔 때만 DOM에서 읽는다
  useEffect(() => {
    setDialogOpen(!!document.querySelector('[role="dialog"][data-state="open"]'));
  }, [isHome, assetCount, wizardOpen, dismissed]);

  const show = shouldShowInstallNudge({
    firstSave: true,
    dismissed,
    trial: isTrialMode(),
    inApp: trigger.isInApp,
    isMobile,
    isIOS: trigger.isIOS,
    isInstallable: trigger.isInstallable,
    isHome,
    assetCount,
    wizardOpen,
    dialogOpen,
  });

  // 카드가 보이는 동안 튜토리얼 말풍선은 양보한다(동시 노출 방지, 닫으면 이어서 진행)
  useEffect(() => {
    setNudgeVisible(show);
    return () => setNudgeVisible(false);
  }, [show]);

  // 노출 GA는 세션당 1회
  useEffect(() => {
    if (show && markNudgeShown()) track("feature_use", { category: "install_nudge" });
  }, [show]);

  // 노출된 뒤 홈을 벗어나면 닫힘 처리
  useEffect(() => {
    if (!isHome && getNudgeShown()) dismissInstallNudge();
  }, [isHome]);

  // 눌러도 인스턴스는 마운트 유지(설치 다이얼로그 보존), 카드만 숨긴다
  return (
    <div
      hidden={!show}
      className="absolute right-3 top-full mt-2 z-40 w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-card p-4 shadow-lg ring-1 ring-foreground/10"
      role="region"
      aria-label="홈 화면 추가 안내"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 break-keep text-pretty">
          <p className="text-sm font-semibold">홈 화면에 추가해 둘까요?</p>
          <p className="mt-1 text-xs text-muted-foreground">다음부터 아이콘 한 번으로 바로 열 수 있어요.</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-10" onClick={dismissInstallNudge}>
          나중에
        </Button>
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="h-10"
          onClick={() => {
            track("feature_use", { category: "install_nudge_tap" });
            dismissInstallNudge();
            trigger.onClick();
          }}
        >
          추가하기
        </Button>
      </div>
    </div>
  );
}

/** 첫 저장 직후 설치 안내 1회 카드 (상단바 설치 아이콘 옆, 모바일) — 설치 흐름은 PwaInstallFlow 재사용 */
export function InstallNudge() {
  const firstSave = useSyncExternalStore(subscribeFirstSave, getFirstSave, () => false);
  if (!firstSave || isTrialMode()) return null;
  return <PwaInstallFlow>{(t) => <NudgeCard trigger={t} />}</PwaInstallFlow>;
}
