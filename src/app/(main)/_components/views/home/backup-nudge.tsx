"use client";

// 백업 넛지 — 이 앱은 localStorage 단일 저장소라 브라우저 데이터를 지우면 전부 사라진다.
// 오래 백업하지 않은 사용자에게만, 하루 한 번, 홈 최상단에서 권한다.
// 노출 조건은 backup-status.ts의 shouldShowBackupNudge가 단독으로 판단한다.

import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { exportAssetData } from "@/lib/asset-storage";
import { shouldShowBackupNudge, markNudgeShown, daysSinceBackup } from "@/lib/backup-status";

export function BackupNudge({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) {
  const { assetData, getAssetSummary } = useAssetData();
  const cs = useCloudSync();
  const [visible, setVisible] = useState(false);

  const hasAssets = getAssetSummary().totalValue > 0 || assetData.loans.length > 0;

  useEffect(() => {
    const show = shouldShowBackupNudge({
      hasAssets,
      syncArmed: cs.status === "armed",
      assetLastUpdated: assetData.lastUpdated,
    });
    if (show) markNudgeShown(); // 노출 시점에 기록 — 새로고침 반복으로 계속 뜨지 않게
    setVisible(show);
    onVisibilityChange?.(show);
  }, [hasAssets, cs.status, assetData.lastUpdated, onVisibilityChange]);

  if (!visible) return null;

  const days = daysSinceBackup();

  const handleBackup = () => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
      setVisible(false);
      onVisibilityChange?.(false);
    } catch {
      toast.error("데이터 내보내기에 실패했습니다.");
    }
  };

  const dismiss = () => {
    setVisible(false);
    onVisibilityChange?.(false);
  };

  return (
    <div className="rounded-xl bg-card dark:border-0 shadow-xs p-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-start gap-2">
        <ShieldAlert className="size-4 mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-[15px] font-semibold text-foreground text-pretty">
            {days === null ? "아직 백업한 적이 없어요" : `백업한 지 ${days}일 지났어요`}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 text-pretty">
            자산 기록은 이 기기에만 저장돼요. 브라우저 데이터를 지우면 복구할 수 없어요.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 -m-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
      <Button variant="brand" className="w-full" onClick={handleBackup}>
        지금 백업하기
      </Button>
    </div>
  );
}
