"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { importAssetData } from "@/lib/asset-storage";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { useAssetData } from "@/contexts/asset-data-context";
import { useAssetNavigation } from "@/app/(main)/asset/_components/layout/navigation/navigation-context";

/**
 * 자산 데이터 가져오기(JSON) 공용 훅 — tool-menu·welcome-guide 공유.
 * 숨김 file input ref와 핸들러를 반환한다.
 */
export function useAssetImport() {
  const { bumpSnapshotVersion, initAndSync } = useAssetData();
  const { navigate } = useAssetNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const { assetData: imported, snapshotRestored } = await importAssetData(file);
      useProfitBasisStore.getState().hydrate(); // 복원된 종가 기준 옵션을 store에 반영
      toast.success("자산 데이터를 불러왔습니다.");
      if (snapshotRestored) toast.info("순자산 히스토리(일별·월별)도 복원되었습니다.");
      bumpSnapshotVersion(); // 차트(useDailySnapshots/useMonthlySnapshots) localStorage 재구독 트리거
      skipAllTutorialSteps();
      tutorialStore.getState().initTutorial();
      navigate({ type: "home" }); // 가져오기 후 항상 홈으로 (웰컴/더보기 등 어느 화면에서 들어와도)
      void initAndSync(imported); // 주식 현재가 갱신은 백그라운드 처리
    } catch (error) {
      console.error("[데이터 가져오기 실패]:", error);
      toast.error("데이터 가져오기에 실패했습니다. 파일 형식을 확인해주세요.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return { fileInputRef, isImporting, openFilePicker, handleFileChange };
}
