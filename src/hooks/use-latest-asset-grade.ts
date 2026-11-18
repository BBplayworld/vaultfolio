"use client";

/**
 * hooks/use-latest-asset-grade.ts
 * 성적표 화면(asset-report-view.tsx)이 확정 시 일별 스냅샷에 기록해 둔 최신 등급을 읽는다(재계산·요청 없음, 성적표 미방문이면 null).
 * 홈 순자산 헤더 미니 트로피와 성과 허브 셋째 카드(자산 성적표·불리기)가 같은 값을 쓴다.
 */

import { useEffect, useState } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { readDailySnapshots } from "@/lib/asset/snapshot-storage";
import type { SnapshotGrade } from "@/types/asset";

export function useLatestAssetGrade(): SnapshotGrade | null {
  const { snapshotVersion } = useAssetData();
  const [grade, setGrade] = useState<SnapshotGrade | null>(null);
  useEffect(() => {
    const sorted = [...readDailySnapshots()].sort((a, b) => b.date.localeCompare(a.date));
    setGrade(sorted.find((s) => s.grade)?.grade ?? null);
  }, [snapshotVersion]);
  return grade;
}
