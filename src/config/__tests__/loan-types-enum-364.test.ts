// #364(5.178) — 대출 유형 선택지(loanTypes)와 저장 스키마 enum 일치. 'tenant'(임차보증금)처럼 고를 수 있지만 저장이 0건인 선택지 재발 방지
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loanTypes } from "@/config/asset-options";
import { loanSchema, type AssetData } from "@/types/asset";
import { getAssetData, saveAssetData } from "@/lib/asset/asset-storage";
import { emptyData, g, memoryStorage } from "@/lib/__tests__/physical-fixtures";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const values = loanTypes.map((t) => t.value as string);
const loan = (type: string, i: number) =>
  ({ id: `l${i}`, type, name: `대출${i}`, balance: 1_000_000, interestRate: 4, startDate: "2025-01-01" }) as unknown as AssetData["loans"][number];

beforeEach(() => { g.window = globalThis; g.localStorage = memoryStorage(); });
afterEach(() => { delete g.window; delete g.localStorage; });

describe("loanTypes ↔ loanSchema.type enum", () => {
  it("선택지 값 집합 = 스키마 enum 값 집합(중복 0)", () => {
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...loanSchema.shape.type.options].sort());
  });

  it("임차보증금(tenant)은 선택지에 없다(부동산 tenantDeposit이 정본)", () => {
    expect(values).not.toContain("tenant");
    expect(loanTypes.some((t) => (t.label as string).includes("임차"))).toBe(false);
  });

  it("스키마는 tenant를 받지 않는다(이번 수정은 스키마 변경 0 — 선택지 쪽을 맞춤)", () => {
    expect(loanSchema.safeParse(loan("tenant", 0)).success).toBe(false);
  });
});

describe("두 입력 경로", () => {
  it("대출 폼: 선택지 전부가 폼 resolver(loanSchema)를 통과한다", () => {
    for (const [i, v] of values.entries()) expect(loanSchema.safeParse(loan(v, i)).success, v).toBe(true);
  });

  it("스크린샷 가져오기: 선택지 전부가 저장 관문(saveAssetData)을 통과하고 다시 읽어도 유형이 같다", () => {
    const loans = values.map((v, i) => loan(v, i));
    expect(saveAssetData({ ...emptyData(), loans })).toBe(true);
    expect(getAssetData().loans.map((l) => l.type)).toEqual(values);
  });

  it("폼·스크린샷 드롭다운·대출 탭 칸은 모두 loanTypes 한 출처에서 만든다", () => {
    const form = read("app/(main)/_components/forms/asset-update/input/loan-input.tsx");
    const shot = read("app/(main)/_components/forms/asset-update/screenshot/loan-screenshot-import.tsx");
    const tab = read("app/(main)/_components/views/detail/tabs/loan-tab.tsx");
    expect(form).toMatch(/\{loanTypes\.map\(\(type\) =>/);
    expect(shot).toMatch(/const LOAN_TYPE_OPTIONS = loanTypes\.map\(/);
    expect(shot).toMatch(/\{LOAN_TYPE_OPTIONS\.map\(\(opt\) =>/);
    expect(tab).toMatch(/\.\.\.loanTypes\.map\(/);
    for (const src of [form, shot, tab]) expect(src).not.toMatch(/["']tenant["']/);
  });
});
