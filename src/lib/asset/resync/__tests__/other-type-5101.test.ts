// 5.101 사진별 선택 유형 신뢰 — 고른 유형 안 1개면 자동 확정, 0개+다른 유형 있으면 후보로 묻기(IRP 노출), 2개 이상이면 그 범위 안에서 묻기
import { describe, expect, it } from "vitest";
import { PICK_NEW, applyResync, computeDiff, defaultRemoveIds, mergeScreens, resolveScreens, type ResyncSelection } from "..";
import { emptySel, row, screen, st, TODAY, USD } from "./fixtures";

const K = { brokerHint: "미래에셋" };
function runWith(existing: ReturnType<typeof st>[], account: "pension" | "irp" | "domestic", items = [row("005930", 10, 70000, K)]) {
  const resolved = resolveScreens([screen(0, items)], existing, { usdRate: USD, brokerOverrides: { 0: "미래에셋증권" }, accountOverrides: { 0: account } });
  const diff = computeDiff(existing, mergeScreens(resolved), resolved);
  const run = (sel: Partial<ResyncSelection>) =>
    applyResync(existing, diff, { ...emptySel(), remove: defaultRemoveIds(diff), ...sel }, { today: TODAY, usdRate: USD, now: 1_700_000_000_000 });
  return { diff, run };
}

describe("5.101 사진별 유형 + 같은 티커 다른 유형 보유", () => {
  const irp = st("irp1", "005930", "irp", "미래에셋증권", 5, 60000);
  it("연금저축 사진 + IRP만 보유: IRP가 후보로 노출되고 고르면 그 항목만 갱신", () => {
    const { diff, run } = runWith([irp, st("x", "000660", "irp", "미래에셋증권", 1, 1)], "pension");
    const r = diff.rows[0];
    expect(r.status).toBe("needs");
    expect(r.reasons).toEqual(expect.arrayContaining(["ambiguous", "otherType"]));
    expect(r.reasons).not.toContain("multiAccount");
    expect(r.candidates?.map((c) => c.id)).toEqual(["irp1"]);
    const out = run({ include: new Set([r.rowId]), pick: { [r.rowId]: "irp1" } });
    expect(out.stocks.find((s) => s.id === "irp1")?.quantity).toBe(10);
    expect(out.stocks.find((s) => s.id === "x")).toEqual(st("x", "000660", "irp", "미래에셋증권", 1, 1));
    expect(out.stocks).toHaveLength(2);
  });
  it("체크하지 않으면 아무것도 바뀌지 않는다", () => {
    const { diff, run } = runWith([irp], "pension");
    expect(run({}).stocks).toEqual([irp]);
    expect(diff.removes.map((x) => x.stock.id)).toEqual([]);
  });
  it("고른 유형에 정확히 1개면 자동 확정(다른 유형 IRP가 있어도 묻지 않음)", () => {
    const pen = st("pen1", "005930", "pension", "미래에셋증권", 3, 50000);
    const { diff } = runWith([irp, pen], "pension");
    expect(diff.rows[0]).toMatchObject({ status: expect.stringMatching(/change|same/), linkedBy: "exact", stock: { id: "pen1" } });
  });
  it("고른 유형에 2개 이상이면 묻되 같은 증권사·티커의 다른 유형(IRP)도 후보에 노출(고른 유형 먼저), IRP 선택 시 IRP만 갱신", () => {
    const p1 = st("p1", "005930", "pension", "미래에셋증권", 3, 1);
    const p2 = st("p2", "005930", "pension", "미래에셋증권", 4, 1);
    const { diff, run } = runWith([irp, p1, p2], "pension");
    const r = diff.rows[0];
    expect(r.reasons).toEqual(expect.arrayContaining(["ambiguous", "multiAccount"]));
    expect(r.reasons).not.toContain("otherType");
    expect(r.candidates?.map((c) => c.id)).toEqual(["p1", "p2", "irp1"]);
    const out = run({ include: new Set([r.rowId]), pick: { [r.rowId]: "irp1" } });
    expect(out.stocks.find((s) => s.id === "irp1")?.quantity).toBe(10);
    expect(out.stocks.find((s) => s.id === "p1")).toEqual(p1);
    expect(out.stocks.find((s) => s.id === "p2")).toEqual(p2);
  });
  it("삭제 범위 회귀: 연금저축 묶음의 삭제 후보는 IRP 선택과 무관, IRP 항목은 삭제되지 않는다", () => {
    const other = st("pen9", "000660", "pension", "미래에셋증권", 1, 1);
    const { diff, run } = runWith([irp, other], "pension");
    // 같은 증권사 연금저축 항목(화면에 없음)은 삭제 후보, 후보로 노출된 IRP는 보호
    expect(diff.removes.map((x) => x.stock.id)).toEqual(["pen9"]);
    const r = diff.rows[0];
    const out = run({ include: new Set([r.rowId]), pick: { [r.rowId]: "irp1" }, remove: new Set() });
    expect(out.stocks.map((s) => s.id).sort()).toEqual(["irp1", "pen9"]);
  });
  it("U2: '새 항목으로 추가' 선택 시 고른 유형으로 새 항목 추가, 기존 IRP 항목·삭제 판정 불변", () => {
    const { diff, run } = runWith([irp], "pension");
    const r = diff.rows[0];
    const out = run({ include: new Set([r.rowId]), pick: { [r.rowId]: PICK_NEW } });
    expect(out.counts).toMatchObject({ add: 1, change: 0, remove: 0 });
    expect(out.stocks.find((s) => s.id === "irp1")).toEqual(irp);
    const added = out.stocks.filter((s) => s.id !== "irp1");
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ ticker: "005930", category: "pension", quantity: 10 });
  });
});
