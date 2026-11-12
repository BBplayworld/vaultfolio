// AI 프롬프트 대출 종류 라벨 = 화면 라벨(asset-options loanTypes) — 예금담보대출이 전세자금대출로 적히던 버그 고정
import { describe, expect, it } from "vitest";
import { LOAN_TYPE } from "../ai-prompts";
import { loanTypes } from "@/config/asset-options";

describe("AI 프롬프트 대출 종류 라벨", () => {
  it("mortgage-deposit = 예금담보대출(전세자금대출 아님)", () => {
    expect(LOAN_TYPE["mortgage-deposit"]).toBe("예금담보대출");
    expect(Object.values(LOAN_TYPE)).not.toContain("전세자금대출");
  });
  it("모든 현행 대출 종류가 화면 라벨과 같다", () => {
    for (const t of loanTypes) expect(LOAN_TYPE[t.value]).toBe(t.label);
  });
  it("레거시 키는 현행 키와 같은 라벨", () => {
    expect(LOAN_TYPE.deposit_loan).toBe(LOAN_TYPE["mortgage-deposit"]);
    expect(LOAN_TYPE.home_mortgage).toBe(LOAN_TYPE["mortgage-home"]);
  });
});
