import { describe, it, expect } from "vitest";
import { parseDailyCloseRows } from "../finance-service";

describe("parseDailyCloseRows", () => {
  it("최신순 응답을 날짜 오름차순으로, 무효 행은 제외", () => {
    const out = [
      { xymd: "20261112", clos: "102.5" },
      { xymd: "bad", clos: "1" },
      { xymd: "20261111", clos: "100" },
      { xymd: "20261110", clos: "0" },
    ];
    expect(parseDailyCloseRows(out, "xymd", "clos")).toEqual([
      { date: "2026-11-11", price: 100 },
      { date: "2026-11-12", price: 102.5 },
    ]);
  });
  it("배열이 아니면 빈 배열", () => expect(parseDailyCloseRows(undefined, "a", "b")).toEqual([]));
});
