// #309 부분 실패 집계·시세 토스트 문구
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import { failedPriceTickers, isPriceAsOfTarget } from "../price-freshness";

describe("failedPriceTickers", () => {
  it("받으려던 티커 − 패치 티커(중복 1개)", () => {
    expect(failedPriceTickers(["AAPL", "005930", "TSLA", "AAPL"], ["AAPL"])).toEqual(["005930", "TSLA"]);
  });
  it("전부 성공이면 0", () => {
    expect(failedPriceTickers(["A", "B"], ["B", "A", "C"])).toEqual([]);
  });
  it("서킷으로 뒤 배치를 요청하지 못하면 그 배치도 실패", () => {
    const intended = ["A", "B", "C", "D", "E", "F"];
    // 첫 배치(A·B·C)에서 서킷 헤더 → 패치 0
    expect(failedPriceTickers(intended, [])).toHaveLength(6);
    // 첫 배치 성공·둘째 배치 서킷
    expect(failedPriceTickers(intended, ["A", "B", "C"])).toEqual(["D", "E", "F"]);
  });
});

describe("isPriceAsOfTarget", () => {
  const s = (p: Partial<Stock>) => ({ ticker: "005930", category: "domestic", ...p }) as Stock;
  it("티커 있음·비상장 아님·상장폐지 아님", () => {
    expect(isPriceAsOfTarget(s({}))).toBe(true);
    expect(isPriceAsOfTarget(s({ ticker: "" }))).toBe(false);
    expect(isPriceAsOfTarget(s({ category: "unlisted" }))).toBe(false);
    expect(isPriceAsOfTarget(s({ inactiveStatus: "delisted" }))).toBe(false);
    expect(isPriceAsOfTarget(s({ inactiveStatus: "halted" }))).toBe(true);
  });
});

describe("시세 토스트 문구(asset-data-context MSG)", () => {
  const src = readFileSync(path.resolve(__dirname, "../../../contexts/asset-data-context.tsx"), "utf8");
  const block = src.slice(src.indexOf("// 주식/환율 동기화"), src.indexOf("} as const;", src.indexOf("// 주식/환율 동기화")));
  const lines = block.split("\n").slice(1).filter((l) => l.includes(":"));
  it("5개 문구, 괄호·API·습니다 0, 해요체", () => {
    expect(lines).toHaveLength(5);
    for (const l of lines) {
      const text = l.slice(l.indexOf(":") + 1);
      expect(text).not.toMatch(/\[|\]|API|습니다/);
      expect(text).toMatch(/요["`]/);
    }
  });
  it("부분 실패 문구는 종목 수 + '종목은'", () => {
    expect(block).toContain("`${n}종목은 시세를 못 받아 이전 값으로 보여요`");
  });
});
