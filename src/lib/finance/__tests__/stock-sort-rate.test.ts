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

describe("정렬 컨트롤·저장", () => {
  const src = readFileSync("src/app/(main)/_components/views/detail/tabs/stock-tab.tsx", "utf8");
  it("옵션 2개(평가금 순·등락률 순), 오름차순 토글 없음, 선택은 모듈 메모리(저장 키 0)", () => {
    const block = src.slice(src.indexOf("function StockSortSelect"), src.indexOf("export function StockTab"));
    expect(block.match(/<SelectItem /g)).toHaveLength(2);
    expect(block).toContain("평가금 순");
    expect(block).toContain("등락률 순");
    expect(src).toMatch(/let stockSortMemory: StockSort = "value";/);
    expect(src).not.toMatch(/localStorage\.setItem\([^)]*[Ss]ort/);
    expect(src).not.toMatch(/오름차순/);
  });
  it("정렬 결과는 상세·주식 목록에만 — 비중 막대·인증카드는 평가금 순 그대로", () => {
    expect(src.match(/filteredStocks=\{listStocks\}/g)).toHaveLength(1);
    expect(src).toMatch(/barItems=\{barItems\}/);
  });
  it("GA: 등락률 순을 고를 때 1건, title `상세·주식·등락률 순`", () => {
    expect(featureTitleOf("feature_use", { category: "stock_sort_rate" }, "detail:stocks")).toBe("상세·주식·등락률 순");
    expect(src).toMatch(/if \(v === "rate"\) track\("feature_use", \{ category: "stock_sort_rate" \}\)/);
  });
});
