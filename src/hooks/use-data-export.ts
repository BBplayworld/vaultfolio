"use client";

// 데이터 내보내기 공용 훅 — 더보기·설정 두 화면이 같은 동작(토스트·튜토리얼 이벤트)을 공유한다.
// 백업 시각 기록은 exportAssetData 내부에서 처리되므로 여기서 따로 하지 않는다.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { exportAssetData } from "@/lib/asset/asset-storage";
import { useAssetData } from "@/contexts/asset-data-context";

// 화면 데이터와 저장소가 어긋난 순간의 백업은 최신 기록이 빠진 파일이 된다 — 두 호출처가 같은 문구를 쓴다.
export const EXPORT_STALE_MSG = "화면 데이터와 저장된 데이터가 달라 백업을 멈췄어요. 새로고침 후 다시 시도해 주세요.";

export function useDataExport() {
  const { assetData } = useAssetData();
  // 내보내기 직후 백업 상태 표시를 갱신하기 위한 tick
  const [exportTick, setExportTick] = useState(0);

  const exportNow = useCallback((): boolean => {
    try {
      if (!exportAssetData(assetData)) {
        toast.error(EXPORT_STALE_MSG);
        return false;
      }
      toast.success("자산 데이터가 다운로드되었습니다.");
      setExportTick((t) => t + 1);
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
      return true;
    } catch {
      toast.error("데이터 내보내기에 실패했습니다.");
      return false;
    }
  }, [assetData]);

  return { exportNow, exportTick };
}
