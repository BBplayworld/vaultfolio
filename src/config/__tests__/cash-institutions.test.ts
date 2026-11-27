// #335(5.167) A — 현금 금융기관 선택 목록에 증권사 그룹. 공용 financialInstitutions·securitiesFirms 불변(대출 목록 diff 0)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cashInstitutionGroups, financialInstitutions, securitiesFirms } from "@/config/asset-options";
import { generateShareToken, parseShareToken } from "@/lib/asset/asset-storage";
import { cashItem, emptyData } from "@/lib/__tests__/physical-fixtures";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("cashInstitutionGroups", () => {
  it("7그룹 순서·라벨·항목 수, 43항목, 값 중복 0, '기타' 1개", () => {
    expect(cashInstitutionGroups.map((g) => [g.group, g.items.length])).toEqual([
      ["1금융권 (시중은행)", 9],
      ["인터넷전문은행", 3],
      ["지방은행", 7],
      ["2금융권", 8],
      ["대형 증권사", 10],
      ["온라인 증권사", 5],
      ["기타", 1],
    ]);
    const all = cashInstitutionGroups.flatMap((g) => g.items);
    expect(all).toHaveLength(43);
    expect(new Set(all).size).toBe(43);
    expect(all.filter((v) => v === "기타")).toHaveLength(1);
    expect(cashInstitutionGroups[5].items).toEqual(["키움증권", "유안타증권", "이베스트투자증권", "카카오페이증권", "토스증권"]);
  });

  it("공용 상수는 그대로(대출 목록 diff 0)", () => {
    expect(financialInstitutions.map((g) => g.group)).toEqual(["1금융권 (시중은행)", "인터넷전문은행", "지방은행", "2금융권", "기타"]);
    expect(financialInstitutions.flatMap((g) => g.items)).toHaveLength(28);
    expect(securitiesFirms.map((g) => g.group)).toEqual(["대형 증권사", "온라인/기타"]);
    expect(securitiesFirms[1].items).toContain("기타");
    const loan = read("app/(main)/_components/forms/asset-update/input/loan-input.tsx");
    expect(loan).toContain('(selectedType === "mortgage-stock" ? securitiesFirms : financialInstitutions).map');
    expect(loan).not.toContain("cashInstitutionGroups");
  });

  it("현금 선택 2곳만 새 목록을 쓴다", () => {
    for (const f of [
      "app/(main)/_components/forms/asset-update/input/cash-input.tsx",
      "app/(main)/_components/forms/asset-update/screenshot/cash-screenshot-import.tsx",
    ]) {
      const src = read(f);
      expect(src).toContain("cashInstitutionGroups.map((group)");
      expect(src).not.toContain("financialInstitutions");
    }
  });

  it("증권사 값 현금의 공유 토큰 왕복 — 값 그대로(DICT.ins 기존 항목, 토큰 diff 0)", async () => {
    const d = {
      ...emptyData(),
      cash: [
        { ...cashItem("a", 1_000_000), institution: "키움증권" },
        { ...cashItem("b", 2_000_000), institution: "이베스트투자증권" },
        { ...cashItem("c", 3_000_000), institution: "하나은행" },
        { ...cashItem("d", 4_000_000), institution: "내 CMA 직접입력" },
      ],
    };
    const parsed = await parseShareToken(await generateShareToken(d));
    if (!parsed || "pinRequired" in parsed) throw new Error("parse");
    expect(parsed.data.cash.map((c) => c.institution)).toEqual(["키움증권", "이베스트투자증권", "하나은행", "내 CMA 직접입력"]);
  });
});
