// 보유 현황 맞추기(#91) — 되돌리기 계획. cloud-sync/overwrite-guard.ts의 순수 함수(planRevert·applyRevert)만 재사용한다.
// 모듈 전역 상태(setEntries 등)는 쓰지 않아 #84 알림 목록을 건드리지 않는다. 사본은 호출측 클로저 메모리에만 둔다.
import type { AssetData, Stock } from "@/types/asset";
import {
  applyRevert,
  captureSnapshot,
  labelOf,
  planRevert,
  type OverwriteEntry,
} from "@/lib/cloud-sync/overwrite-guard";

type Rec = Record<string, unknown>;

/** 적용 전(before)·후(after) stocks로 되돌릴 항목 목록을 만든다. 변경=modified, 추가=resurrected(되돌리면 제거), 삭제=remoteDeleted(되돌리면 복원) */
export function buildUndoEntries(before: Stock[], after: Stock[]): OverwriteEntry[] {
  const out: OverwriteEntry[] = [];
  const beforeMap = new Map(before.map((s) => [s.id, s]));
  const afterMap = new Map(after.map((s) => [s.id, s]));
  for (const b of before) {
    const a = afterMap.get(b.id);
    if (!a) out.push({ key: `stocks:${b.id}`, coll: "stocks", kind: "remoteDeleted", label: labelOf("stocks", b as unknown as Rec), mine: b as unknown as Rec, landed: null });
    else if (a !== b) out.push({ key: `stocks:${b.id}`, coll: "stocks", kind: "modified", label: labelOf("stocks", b as unknown as Rec), mine: b as unknown as Rec, landed: a as unknown as Rec });
  }
  for (const a of after) {
    if (!beforeMap.has(a.id)) out.push({ key: `stocks:${a.id}`, coll: "stocks", kind: "resurrected", label: labelOf("stocks", a as unknown as Rec), mine: null, landed: a as unknown as Rec });
  }
  return out;
}

export interface UndoResult {
  data: AssetData;
  /** 실제로 되돌린 건수 */
  restored: number;
  /** R1: 맞춘 뒤 직접 고쳐서 그대로 둔 건수 */
  skipped: number;
}

/** 되돌리는 순간의 현재 데이터(getAssetData() 새로 읽은 값)에 적용한다. 거래 배열·다른 컬렉션은 그대로다 */
export function planUndo(entries: OverwriteEntry[], current: AssetData): UndoResult {
  const plan = planRevert(entries, captureSnapshot(current));
  return { data: applyRevert(current, plan.valid), restored: plan.valid.length, skipped: plan.dropped };
}
