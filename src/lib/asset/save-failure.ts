// 자동 저장 경로(시세 동기화·스냅샷·마이그레이션·공유 반영·닉네임)의 저장 실패 알림 — 반환값을 버리던 호출부 공용 헬퍼(#93 p2-6).
// 시세 갱신마다 반복 노출되지 않도록 세션(페이지 로드)당 1회만 알린다. 사용자 편집 경로(saveData)는 각자 실패 토스트가 있어 대상 아님.
import { toast } from "sonner";
import { track } from "@/lib/analytics/ga";
import { saveAssetData } from "@/lib/asset/asset-storage";
import type { AssetData } from "@/types/asset";

let notified = false;

/** saveAssetData 호출 + 실패 시 세션당 1회 토스트·계측. 저장 데이터·반환값은 그대로 */
export function saveAssetDataNotify(data: AssetData): boolean {
  const ok = saveAssetData(data);
  if (!ok && !notified && typeof window !== "undefined") {
    notified = true;
    toast.error("저장하지 못했어요. 백업 파일을 내려받아 두세요", { duration: 6000 });
    track("feature_use", { category: "save_failed" });
  }
  return ok;
}

/** 테스트 전용 — 세션 가드 초기화 */
export function __resetSaveFailureForTest(): void {
  notified = false;
}
