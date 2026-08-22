// 저장 데이터 통계 — 설정 화면에서 "내 데이터가 얼마나 쌓였는지" 보여준다.
// 전체 키 순회가 필요한 동기 작업이므로 설정 진입 시 1회만 계산하고 홈에서는 호출하지 않는다.

import { getAssetData } from "@/lib/asset/asset-storage";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readDailyArchive } from "@/lib/asset/snapshot-archive";

export interface StorageStats {
  itemCount: number;        // 등록된 자산·부채 항목 수
  dailyCount: number;       // 보관 중인 일별 기록 수(최근 30일)
  archivedMonths: number;   // 장기 아카이브 개월 수
  monthlyCount: number;
  approxBytes: number;      // localStorage 사용량 근사치
}

export function computeStorageStats(): StorageStats {
  const data = getAssetData();
  const itemCount =
    data.realEstate.length + data.stocks.length + data.crypto.length +
    data.cash.length + data.loans.length;

  let approxBytes = 0;
  if (typeof window !== "undefined") {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith("secretasset")) continue;
        // UTF-16 저장이므로 문자 수 × 2바이트로 근사 (키 이름 길이 포함)
        approxBytes += ((localStorage.getItem(key)?.length ?? 0) + key.length) * 2;
      }
    } catch { /* 접근 실패 시 0 */ }
  }

  return {
    itemCount,
    dailyCount: readDailySnapshots().length,
    monthlyCount: readMonthlySnapshots().length,
    archivedMonths: Object.keys(readDailyArchive()).length,
    approxBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
