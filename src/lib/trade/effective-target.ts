import type { Stock } from "@/types/asset";

// 거래 반영 대상(StockTargetPicker 값과 같은 모양) — 컴포넌트 의존 없이 순수 판정에 쓴다
export type EffectiveTarget =
  | { kind: "existing"; stockId: string }
  | { kind: "new"; broker: string; category: Stock["category"] };

// 신규 자산 등록의 증권사·종류가 같은 종목 보유 항목과 같으면 그 항목을 돌려준다(#259).
// - 증권사 빈 값은 비교하지 않는다(미선택 상태)
// - candidates는 같은 종목으로 확정된 보유 항목만 넘긴다(유사 이름 후보 등 다른 종목일 수 있는 항목 제외)
export function findSameComboStock(
  target: EffectiveTarget | undefined,
  candidates: readonly Stock[],
): Stock | undefined {
  if (target?.kind !== "new" || !target.broker) return undefined;
  return candidates.find((s) => s.broker === target.broker && s.category === target.category);
}

// 실효 대상 — 같은 증권사·종류 보유 항목이 있으면 그 기존 항목(existing), 아니면 입력 그대로.
// 저장·미리보기·중복 검사는 이 값을 쓰고, 화면의 선택 표시는 입력 target을 그대로 둔다
export function resolveEffectiveTarget(
  target: EffectiveTarget | undefined,
  candidates: readonly Stock[],
): EffectiveTarget | undefined {
  const same = findSameComboStock(target, candidates);
  return same ? { kind: "existing", stockId: same.id } : target;
}
