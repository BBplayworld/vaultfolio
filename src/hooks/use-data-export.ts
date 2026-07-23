"use client";

// 데이터 내보내기 공용 훅 — 더보기·설정 두 화면이 같은 동작(토스트·튜토리얼 이벤트)을 공유한다.
// 백업 시각 기록은 exportAssetData 내부에서 처리되므로 여기서 따로 하지 않는다.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { exportAssetData } from "@/lib/asset-storage";

export function useDataExport() {
  // 내보내기 직후 백업 상태 표시를 갱신하기 위한 tick
  const [exportTick, setExportTick] = useState(0);

  const exportNow = useCallback((): boolean => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
      setExportTick((t) => t + 1);
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
      return true;
    } catch {
      toast.error("데이터 내보내기에 실패했습니다.");
      return false;
    }
  }, []);

  return { exportNow, exportTick };
}
