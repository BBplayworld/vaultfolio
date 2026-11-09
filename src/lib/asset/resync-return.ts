// 이어서 맞추기(#110) — FAB 보유 현황 목록의 정렬·복귀 판정 순수 함수. 저장·스키마와 무관(읽기 파생).
import type { RefreshCategory } from "./asset-refresh-status";
import { REFRESH_CATEGORIES } from "./asset-refresh-status";

export const RESYNC_LABELS: Record<RefreshCategory, string> = { stock: "주식", crypto: "암호화폐", cash: "현금성 자산", loan: "대출" };

export function isRefreshCategory(type: string): type is RefreshCategory {
  return (REFRESH_CATEGORIES as string[]).includes(type);
}

/** 보유 자산군 우선 안정 정렬 — 기존 상대 순서 유지, 과거 순자산은 항상 맨 아래. ✓ 여부로는 재정렬하지 않는다 */
export function sortHoldingsRows<T extends { type: string }>(rows: T[], isHeld: (type: string) => boolean): T[] {
  const tail = rows.filter((r) => r.type === "yearly-net-asset");
  const rest = rows.filter((r) => r.type !== "yearly-net-asset");
  return [...rest.filter((r) => isHeld(r.type)), ...rest.filter((r) => !isHeld(r.type)), ...tail];
}

/** 복귀 상단 문구 — 보유 4종이 모두 오늘 맞춤이고 부동산·실물 미보유일 때만 "모두 맞췄어요" */
export function resyncNoticeText(
  category: RefreshCategory,
  opts: { held: RefreshCategory[]; refreshedToday: (c: RefreshCategory) => boolean; hasRealEstateOrPhysical: boolean },
): string {
  const allDone = opts.held.length > 0 && opts.held.every(opts.refreshedToday) && !opts.hasRealEstateOrPhysical;
  return allDone ? "보유한 자산을 모두 맞췄어요" : `${RESYNC_LABELS[category]} 맞췄어요`;
}

/** 저장 신호 소비 — 대기 중인 자산군과 같은 신호일 때만 복귀. 소비 후 대기는 비운다(중복 신호 무시) */
export function consumeResyncSignal(armed: RefreshCategory | null, signal: RefreshCategory): { resume: boolean; armed: RefreshCategory | null } {
  if (armed !== null && armed === signal) return { resume: true, armed: null };
  return { resume: false, armed };
}

/** 복귀 목록에서 방금 맞춘 자산군이 아닌 최신화 행을 누를 때만 GA 1회 */
export function shouldTrackResyncContinue(notice: RefreshCategory | null, pickedType: string): boolean {
  return notice !== null && isRefreshCategory(pickedType) && pickedType !== notice;
}
