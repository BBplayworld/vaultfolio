// #132 U6 상세·주식 `등락률 순`(A19·A21) — 칩 값 높은 순(부호 그대로), 칩 없는 종목 맨 뒤, 동률은 평가금 순
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sortByChipRate } from "../today-chip";
import { featureTitleOf } from "@/lib/analytics/ga";

// 입력 = 평가금 순
const rows = [
  { id: "A", rate: -2 },
  { id: "B", rate: null },
  { id: "C", rate: 3 },
  { id: "D", rate: 1 },
  { id: "E", rate: null },
  { id: "F", rate: 1.04 }, // 표시 +1.0% = D와 동률 → 평가금 순(D가 앞)
  { id: "G", rate: 0.96 }, // 표시 +1.0%
];

describe("sortByChipRate", () => {
  it("+3 → +1(동률은 평가금 순) → −2 → 칩 없음(평가금 순)", () => {
    expect(sortByChipRate(rows, (r) => r.rate).map((r) => r.id)).toEqual(["C", "D", "F", "G", "A", "B", "E"]);
  });
  it("입력 배열은 바꾸지 않는다(비중 막대·인증카드 순서 불변)", () => {
    const copy = rows.map((r) => r.id);
    sortByChipRate(rows, (r) => r.rate);
    expect(rows.map((r) => r.id)).toEqual(copy);
  });
  it("전부 칩 없음이면 평가금 순 그대로", () => {
    expect(sortByChipRate(["x", "y", "z"], () => null)).toEqual(["x", "y", "z"]);
  });
});

describe("정렬 컨트롤 제거(#288 R1)", () => {
  const src = readFileSync("src/app/(main)/_components/views/detail/tabs/stock-tab.tsx", "utf8");
  it("선택 UI·메모리·등락률 분기 없음, 목록은 늘 평가금 순(mergedStocks)", () => {
    expect(src).not.toContain("StockSortSelect");
    expect(src).not.toContain("stockSortMemory");
    expect(src).not.toContain("sortByChipRate");
    expect(src).not.toContain('data-testid="stock-sort"');
    expect(src).toMatch(/filteredStocks=\{mergedStocks\}/);
    expect(src).toMatch(/barItems=\{barItems\}/);
  });
  it("GA title 맵은 유지(호출만 사라짐) — `상세·주식·등락률 순`", () => {
    expect(featureTitleOf("feature_use", { category: "stock_sort_rate" }, "detail:stocks")).toBe("상세·주식·등락률 순");
  });
});
