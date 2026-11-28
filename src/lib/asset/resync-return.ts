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

/** 대기 중 창 감시 — 창이 한 번 열렸다가 닫혔는데 저장 신호로 대기가 소비되지 않았으면 취소로 보고 해제한다(D1) */
export function nextDialogWatch(seen: boolean, present: boolean): { seen: boolean; release: boolean } {
  if (present) return { seen: true, release: false };
  return { seen, release: seen };
}

/** 보유 현황 맞추기 창을 닫을 때 복귀 신호를 보낼지 — 결과 화면이고 되돌리지 않았을 때만(되돌린 뒤엔 복귀 목록 없음, #115) */
export function shouldNotifyResyncClose(step: string, undo: { done: boolean } | null): boolean {
  return step === "result" && !!undo && !undo.done;
}

/** 결과 화면 전환 직후 바깥 닫기 무시 시간(#368) — 연타의 둘째 탭이 작아진 창 바깥(오버레이)에 닿아 닫히지 않게 */
export const RESULT_CLOSE_GUARD_MS = 400;

/** 결과 화면에 들어온 시각(enteredAt)부터 guardMs 안이면 바깥 클릭·Escape 닫기를 막는다. 결과 화면이 아니면(null) 막지 않는다 */
export function isResultCloseGuarded(enteredAt: number | null, now: number, guardMs = RESULT_CLOSE_GUARD_MS): boolean {
  return enteredAt !== null && now - enteredAt >= 0 && now - enteredAt < guardMs;
}

/**
 * 되돌리기 토스트 id 칸(#368). sonner의 dismiss(id)는 삭제를 다음 프레임으로 미루므로,
 * 같은 id로 dismiss → 곧바로 재생성하면 늦게 온 삭제가 새 토스트를 지운다.
 * 토스트마다 새 id를 쓰고, 닫을 때는 지금 떠 있는 id만 돌려준다(재사용 0 → 경합 0).
 */
export function createUndoToastSlot(base: string) {
  let seq = 0;
  let current: string | null = null;
  return {
    /** 지금 떠 있는 되돌리기 토스트 id를 비우고 돌려준다(없으면 null) */
    take(): string | null {
      const id = current;
      current = null;
      return id;
    },
    /** 새 토스트 id — 이전 id와 겹치지 않는다 */
    next(): string {
      current = `${base}-${++seq}`;
      return current;
    },
  };
}
