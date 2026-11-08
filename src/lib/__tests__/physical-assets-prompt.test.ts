// #58 AI 프롬프트 — 실물 0건이면 기존 프롬프트와 바이트 동일, 1건 이상이면 '실물 자산' 절이 추가된다
import { describe, expect, it } from "vitest";
import { AI_PROMPT_TEMPLATES } from "@/lib/ai-prompts";
import type { AssetData, AssetSummary } from "@/types/asset";
import { emptyData, gold } from "./physical-fixtures";

const summary = (o: Partial<AssetSummary> = {}): AssetSummary => ({
  totalValue: 10_000_000, totalCost: 9_000_000, totalProfit: 1_000_000, totalProfitRate: 11.1,
  realEstateValue: 0, realEstateCost: 0, realEstateProfit: 0, stockValue: 0, stockCost: 0, stockProfit: 0, stockCurrencyGain: 0, stockFxProfit: 0,
  cryptoValue: 0, cryptoCost: 0, cryptoProfit: 0, physicalValue: 0, physicalCost: 0, physicalProfit: 0,
  cashValue: 10_000_000, loanBalance: 0, tenantDepositTotal: 0, netAsset: 10_000_000,
  realEstateCount: 0, stockCount: 0, cryptoCount: 0, cashCount: 1, loanCount: 0, physicalCount: 0, ...o,
});
const gen = (data: AssetData, s: AssetSummary) => AI_PROMPT_TEMPLATES.map((t) => t.generate({ data, summary: s, exchangeRates: { USD: 1400, JPY: 900 } } as never));

describe("AI 프롬프트 × 실물", () => {
  it("실물 0건(키 없음·[])은 절이 없고 두 결과가 같다", () => {
    const a = gen(emptyData(), summary());
    const b = gen({ ...emptyData(), physicalAssets: [] }, summary());
    expect(b).toEqual(a);
    expect(a.join("\n")).not.toContain("실물 자산");
  });
  it("실물이 있으면 이름·종류·평가액이 든 '실물 자산' 절이 데이터 요약에 들어간다", () => {
    const out = gen({ ...emptyData(), physicalAssets: [gold("P1")] }, summary({ physicalValue: 2_000_000, physicalCost: 1_500_000, physicalProfit: 500_000, physicalCount: 1 }));
    expect(out[0]).toContain("💎 실물 자산");
    expect(out[0]).toContain("금 10돈 (금)");
    expect(out[0]).toContain("직접 입력");
  });
});
