// #259 같은 증권사·종류 조합 → 기존 항목 전환 판정 (거래 입력·스크린샷 거래 가져오기 공용)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findSameComboStock, resolveEffectiveTarget } from "@/lib/trade/effective-target";
import type { Stock } from "@/types/asset";

const stock = (id: string, broker: string, category: Stock["category"]): Stock =>
  ({ id, name: "삼성전자", ticker: "005930", category, currency: "KRW", broker, quantity: 10, averagePrice: 70000, currentPrice: 71000, purchaseDate: "2026-01-01" }) as Stock;
const held = [stock("a", "토스증권", "domestic"), stock("b", "토스증권", "isa"), stock("c", "키움증권", "domestic")];

describe("resolveEffectiveTarget (#259)", () => {
  it("같은 증권사·종류면 그 기존 항목", () => {
    expect(resolveEffectiveTarget({ kind: "new", broker: "토스증권", category: "domestic" }, held)).toEqual({ kind: "existing", stockId: "a" });
    expect(resolveEffectiveTarget({ kind: "new", broker: "토스증권", category: "isa" }, held)).toEqual({ kind: "existing", stockId: "b" });
  });
  it("증권사 또는 종류가 다르면 신규 그대로", () => {
    const t = { kind: "new" as const, broker: "토스증권", category: "pension" as const };
    expect(resolveEffectiveTarget(t, held)).toBe(t);
    const t2 = { kind: "new" as const, broker: "삼성증권", category: "domestic" as const };
    expect(resolveEffectiveTarget(t2, held)).toBe(t2);
  });
  it("증권사 빈 값은 비교하지 않는다", () => {
    const noBroker = [stock("x", "", "domestic")];
    const t = { kind: "new" as const, broker: "", category: "domestic" as const };
    expect(resolveEffectiveTarget(t, noBroker)).toBe(t);
    expect(findSameComboStock(t, noBroker)).toBeUndefined();
  });
  it("기존 선택·미선택·후보 없음은 그대로", () => {
    const ex = { kind: "existing" as const, stockId: "a" };
    expect(resolveEffectiveTarget(ex, held)).toBe(ex);
    expect(resolveEffectiveTarget(undefined, held)).toBeUndefined();
    const t = { kind: "new" as const, broker: "토스증권", category: "domestic" as const };
    expect(resolveEffectiveTarget(t, [])).toBe(t);
  });
  it("같은 조합 신규 선택 시 실효 대상이 existing이라 새 종목(newStocks)이 만들어지지 않는다", () => {
    // 두 호출부 모두 실효 대상이 existing이면 newStocks 경로(kind === 'new')를 타지 않는다
    const eff = resolveEffectiveTarget({ kind: "new", broker: "키움증권", category: "domestic" }, held);
    const newStocks = eff?.kind === "new" ? [eff] : [];
    expect(newStocks).toHaveLength(0);
  });
});

describe("호출부 연결 (#259)", () => {
  const root = path.resolve(__dirname, "../..");
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
  it("거래 입력은 실효 대상으로 stockId를 정하고 신규 초안은 같은 조합이면 만들지 않는다", () => {
    const src = read("app/(main)/_components/forms/trade/trade-input.tsx");
    expect(src).toContain("resolveEffectiveTarget(target, groupCandidates)");
    expect(src).toMatch(/!groupRep \|\| sameComboStock\) return undefined/);
  });
  it("스크린샷 가져오기는 시뮬레이션·중복검사·저장에 실효 대상을 쓰고 유사(fuzzy) 후보는 제외한다", () => {
    const src = read("app/(main)/_components/forms/trade/trade-screenshot-import.tsx");
    expect(src).toContain("c && !c.fuzzy ? c.list : []");
    expect(src).not.toMatch(/const target = targets\[t\.id\]!;/);
    expect(src).toMatch(/const target = effTargets\[t\.id\]!;/);
  });
});
