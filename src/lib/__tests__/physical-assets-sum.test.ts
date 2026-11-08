// #58 실물 자산 — 합산 지점·자산 보유 판정 통일 (spec 10절 10, 12절 14)
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import { countAssets } from "@/lib/analytics/ga";
import { cashItem, emptyData, gold } from "./physical-fixtures";

const RATES = { USD: 1400, JPY: 900 };
const base = () => ({ ...emptyData(), cash: [cashItem("c1", 1_000_000)] });

describe("computeNetAsset / computeAssetCost", () => {
  it("실물 0건(키 없음·[])은 기존 값과 같다", () => {
    const a = computeNetAsset(base(), RATES);
    const b = computeNetAsset({ ...base(), physicalAssets: [] }, RATES);
    expect(b).toEqual(a);
    expect(a.physicalValue).toBe(0);
    expect(computeAssetCost(base(), RATES).physicalCost).toBe(0);
  });
  it("순자산 = 기존 순자산 + 실물 합계, 금융자산은 그대로", () => {
    const a = computeNetAsset(base(), RATES);
    const d = { ...base(), physicalAssets: [gold("P1"), gold("P2", { currentValue: 500_000, purchasePrice: 300_000 })] };
    const b = computeNetAsset(d, RATES);
    expect(b.physicalValue).toBe(2_500_000);
    expect(b.netAsset).toBe(a.netAsset + 2_500_000);
    expect(b.totalValue).toBe(a.totalValue + 2_500_000);
    expect(b.financialAsset).toBe(a.financialAsset);
    expect(computeAssetCost(d, RATES).physicalCost).toBe(1_800_000);
  });
  it("countAssets에 실물이 포함된다", () => {
    expect(countAssets({ ...emptyData(), physicalAssets: [gold()] })).toBe(1);
    expect(countAssets(emptyData())).toBe(0);
  });
});

describe("자산 보유 판정 통일 (인라인 5종 체인 0건)", () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== "__tests__" && n !== "node_modules") walk(p, out); }
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p);
    }
    return out;
  };
  it("realEstate·stocks·crypto·cash·loans 길이를 나란히 합치거나 모두 0/양수로 비교하는 코드가 없다", () => {
    // 정의(hasAnyAssets)와 건수 집계(storage-stats)만 예외
    const re = /(\w+)\.(?:realEstate|stocks)\.length\s*(?:>\s*0\s*\|\||===\s*0\s*&&|\+)[\s\S]{0,260}?\1\.loans\.length/;
    const allow = ["asset/asset-storage.ts", "asset/storage-stats.ts"];
    const hits = walk(join(process.cwd(), "src"))
      .filter((f) => !allow.some((a) => f.endsWith(a)))
      .filter((f) => re.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
