// #310(5.156) 증권사 이관 후보 감지 — 같은 tickerKey·category, 이번 장 범위 밖(kept)에 남은 다른 증권사 종목이 정확히 1개, 화면 행 정확히 1개
import { describe, expect, it } from "vitest";
import { computeDiff, detectTransfers, mergeScreens, pruneStockTarget, resolveScreens } from "..";
import { row, screen, st, USD } from "./fixtures";
import type { Stock } from "@/types/asset";
import type { RawScreen } from "../types";

const toss = { brokerHint: "토스증권" };
const diffOf = (existing: Stock[], screens: RawScreen[]) => {
  const resolved = resolveScreens(screens, existing, { usdRate: USD });
  return computeDiff(existing, mergeScreens(resolved), resolved);
};

const A = st("a", "005930", "domestic", "미래에셋증권", 10, 70_000);
const B = st("b", "005930", "domestic", "토스증권", 10, 70_000);
const K = st("k", "000660", "domestic", "토스증권", 1, 100_000);

describe("detectTransfers", () => {
  it("B 행이 추가 → 이어받기(inherit) 후보 1건", () => {
    const d = diffOf([A, K], [screen(0, [row("005930", 10, 70_000, toss), row("000660", 1, 100_000, toss)])]);
    const c = detectTransfers(d);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ path: "inherit", toBroker: "토스증권" });
    expect(c[0].from.id).toBe("a");
    expect(d.kept.map((s) => s.id)).toContain("a");
  });

  it("B가 이미 저장됨(그대로·변경 행) → 합치기(merge) 후보, to = B", () => {
    for (const qty of [10, 12]) {
      const d = diffOf([A, B], [screen(0, [row("005930", qty, 70_000, toss)])]);
      const c = detectTransfers(d);
      expect(c).toHaveLength(1);
      expect(c[0].path).toBe("merge");
      expect(c[0].to?.id).toBe("b");
      expect(c[0].from.id).toBe("a");
    }
  });

  it("해외 종목도 같은 규칙", () => {
    const fa = st("fa", "AAPL", "foreign", "미래에셋증권", 3, 150);
    const fb = st("fb", "AAPL", "foreign", "토스증권", 3, 150);
    const c = detectTransfers(diffOf([fa, fb], [screen(0, [row("AAPL", 3, 150, toss)])]));
    expect(c.map((x) => [x.from.id, x.to?.id])).toEqual([["fa", "fb"]]);
  });

  it("후보 0: 계좌 유형 다름(ISA·연금 등)", () => {
    const isa = st("a", "005930", "isa", "미래에셋증권", 10, 70_000);
    expect(detectTransfers(diffOf([isa, B], [screen(0, [row("005930", 10, 70_000, toss)])]))).toEqual([]);
  });

  it("후보 0: 같은 증권사(같은 범위라 kept가 아님)", () => {
    const same = st("a", "005930", "domestic", "토스 증권", 10, 70_000);
    expect(detectTransfers(diffOf([same, K], [screen(0, [row("005930", 10, 70_000, toss), row("000660", 1, 100_000, toss)])]))).toEqual([]);
  });

  it("후보 0: 옛 종목 증권사 미지정", () => {
    for (const broker of ["", "항목 1"]) {
      const un = st("a", "005930", "domestic", broker, 10, 70_000);
      expect(detectTransfers(diffOf([un, B], [screen(0, [row("005930", 10, 70_000, toss)])]))).toEqual([]);
    }
  });

  it("후보 0: 남은 옛 종목 2개", () => {
    const A2 = st("a2", "005930", "domestic", "삼성증권", 5, 70_000);
    expect(detectTransfers(diffOf([A, A2, B], [screen(0, [row("005930", 10, 70_000, toss)])]))).toEqual([]);
  });

  it("후보 0: 같은 종목 화면 행 2개(두 증권사 화면)", () => {
    const d = diffOf([A, B], [screen(0, [row("005930", 10, 70_000, toss)]), screen(1, [row("005930", 4, 70_000, { brokerHint: "키움증권" })])]);
    expect(d.rows.filter((r) => r.item?.ticker === "005930")).toHaveLength(2);
    expect(detectTransfers(d)).toEqual([]);
  });

  it("후보 0: 확인 필요 행(수량 미인식)·티커 다름", () => {
    expect(detectTransfers(diffOf([A, K], [screen(0, [row("005930", 1, 70_000, { ...toss, quantityMissing: true }), row("000660", 1, 100_000, toss)])]))).toEqual([]);
    expect(detectTransfers(diffOf([A, K], [screen(0, [row("000660", 1, 100_000, toss)])]))).toEqual([]);
  });

  it("후보 0: 비상장 옛 종목", () => {
    const u = st("a", "005930", "unlisted", "미래에셋증권", 10, 70_000);
    expect(detectTransfers(diffOf([u, K], [screen(0, [row("005930", 10, 70_000, toss), row("000660", 1, 100_000, toss)])]))).toEqual([]);
  });

  it("판별에 날짜·이름·메모를 쓰지 않는다", () => {
    const base = detectTransfers(diffOf([A, B], [screen(0, [row("005930", 10, 70_000, toss)])]));
    const odd = { ...A, name: "전혀 다른 이름", purchaseDate: "2010-01-01", description: "메모 다름" };
    const other = detectTransfers(diffOf([odd, B], [screen(0, [row("005930", 10, 70_000, toss)])]));
    expect(other.map((c) => [c.from.id, c.rowId, c.path])).toEqual(base.map((c) => [c.from.id, c.rowId, c.path]));
  });

  it("빈 데이터 → 0", () => {
    expect(detectTransfers(diffOf([], [screen(0, [row("005930", 10, 70_000, toss)])]))).toEqual([]);
  });
});

describe("pruneStockTarget(화면 상태 정리)", () => {
  const t = { groupStockIds: ["a", "b"], initialStockId: "a" as string | null, name: "x" };
  it("없는 id를 거르고 initialStockId가 사라지면 null", () => {
    expect(pruneStockTarget(t, new Set(["b"]))).toEqual({ ...t, groupStockIds: ["b"], initialStockId: null });
  });
  it("바뀐 게 없으면 같은 참조, 그룹이 비면 null", () => {
    expect(pruneStockTarget(t, new Set(["a", "b"]))).toBe(t);
    expect(pruneStockTarget(t, new Set(["z"]))).toBeNull();
    const noInit = { groupStockIds: ["a", "b"] };
    expect(pruneStockTarget(noInit, new Set(["a"]))).toEqual({ groupStockIds: ["a"] });
  });
});
