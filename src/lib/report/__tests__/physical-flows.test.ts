// #58 C42 자산 간 흐름 표 R1~R8 (spec 3-7·완료 기준 25) — 같은 달 Δ0 / 달 경계 / R6 일부 매도(안내 이행·미이행). 합계 = Δ순자산
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeChainCauses, computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { resolveYearChain } from "../settlement";
import type { AssetData, MonthlyAssetSnapshot, PhysicalAsset } from "@/types/asset";
import { PURCHASE_PRICE_HELP } from "@/app/(main)/_components/forms/asset-update/input/physical-input";

const RATES = { USD: 1400, JPY: 900 };
const data = (physicalAssets: PhysicalAsset[] = []): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], physicalAssets,
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const gold = (id: string, purchaseDate: string, purchasePrice: number, currentValue = purchasePrice): PhysicalAsset =>
  ({ id, type: "gold", name: "금", purchaseDate, purchasePrice, currentValue });
// 현금 1,000만·대출 3,000만 사용자, 시세 변화 0
const snap = (month: string, date: string, o: { cash?: number; loans?: number; phys?: number; physCost?: number }): MonthlyAssetSnapshot => {
  const { cash = 10_000_000, loans = 30_000_000, phys = 0, physCost = phys } = o;
  return {
    month, date, netAsset: cash + phys - loans, financialAsset: cash,
    breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash, loans, tenantDeposit: 0, physical: phys },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + physCost, stock: 0, crypto: 0, realEstate: 0, physical: physCost },
  };
};
const LIVE_DUMMY = {} as Parameters<typeof computeSettlementCauses>[0]["live"];
const month = (d: AssetData, a: MonthlyAssetSnapshot, b: MonthlyAssetSnapshot) =>
  computeSettlementCauses({ start: a, end: b, live: LIVE_DUMMY, deltaNet: b.netAsset - a.netAsset, startDate: a.date!, endDate: b.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
const amt = (m: ReturnType<typeof month>, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
const sum = (m: ReturnType<typeof month>) => m.causes.reduce((s, c) => s + c.amount, 0);
const X = 3_000_000;
const S = "2026-09-30", E = "2026-10-28";
const A0 = snap("2026-09", S, {});
const P = (id = "P") => gold(id, "2020-01-01", X);

describe("R1~R5 같은 달: Δ0, 기록 안 된 변화 0, 대출·부채 상환 라벨 0", () => {
  it("R1 현금으로 금 매입(현금 직접 수정)", () => {
    const m = month(data([P()]), A0, snap("2026-10", E, { cash: 10_000_000 - X, phys: X }));
    expect(m.deltaNet).toBe(0);
    expect(m.causes).toEqual([]);
  });
  it("R3 대출로 매입", () => {
    const m = month(data([P()]), A0, snap("2026-10", E, { loans: 30_000_000 + X, phys: X }));
    expect(m.causes).toEqual([]);
    expect(amt(m, "loan")).toBe(0);
  });
  it("R4 전량 매도 → 현금", () => {
    const start = snap("2026-09", S, { phys: X });
    const m = month(data(), start, snap("2026-10", E, { cash: 10_000_000 + X }));
    expect(m.causes).toEqual([]);
  });
  it("R5 매도 대금으로 대출 상환: 부채 상환 라벨 0(결산에 대출 항목 없음)", () => {
    const start = snap("2026-09", S, { phys: X });
    const m = month(data(), start, snap("2026-10", E, { loans: 30_000_000 - X }));
    expect(m.causes).toEqual([]);
    expect(m.causes.map((c) => c.key)).not.toContain("loan");
  });
});

describe("R1·R3 달 경계: 두 달 값, 합 0", () => {
  it("R1 등록 10월·현금 맞추기 11월 → 10월 기록 안 된 변화 +X, 11월 −X", () => {
    const oct = month(data([P()]), A0, snap("2026-10", "2026-10-30", { phys: X }));
    const nov = month(data([P()]), snap("2026-10", "2026-10-30", { phys: X }), snap("2026-11", "2026-11-28", { cash: 10_000_000 - X, phys: X }));
    expect(amt(oct, "unrecorded")).toBe(X);
    expect(amt(nov, "unrecorded")).toBe(-X);
    expect(amt(oct, "unrecorded") + amt(nov, "unrecorded")).toBe(0);
    expect(sum(oct)).toBe(oct.deltaNet);
    expect(sum(nov)).toBe(nov.deltaNet);
  });
  it("R3 등록 10월·대출 맞추기 11월 → 10월 기록 안 된 변화 +X, 11월 대출 −X, 합 항등식", () => {
    const oct = month(data([P()]), A0, snap("2026-10", "2026-10-30", { phys: X }));
    const nov = month(data([P()]), snap("2026-10", "2026-10-30", { phys: X }), snap("2026-11", "2026-11-28", { loans: 30_000_000 + X, phys: X }));
    expect(amt(oct, "unrecorded")).toBe(X);
    expect(amt(nov, "loan")).toBe(-X);
    expect(sum(oct)).toBe(oct.deltaNet);
    expect(sum(nov)).toBe(nov.deltaNet);
  });
});

describe("R6 일부 매도 (cto 가 채택)", () => {
  const sold = 1_000_000;
  const start = snap("2026-09", S, { phys: X });
  const cashAfter = 10_000_000 + sold;
  it("안내 이행(평가액·매입가를 판 금액만큼 함께 줄임): Δ0·평가 갱신 0·잔차 0", () => {
    const m = month(data([gold("P", "2020-01-01", X - sold)]), start, snap("2026-10", E, { cash: cashAfter, phys: X - sold, physCost: X - sold }));
    expect(m.deltaNet).toBe(0);
    expect(m.causes).toEqual([]);
  });
  it("안내 미이행(매입가 그대로): 평가 갱신 −X와 기록 안 된 변화 +X로 갈린다(새 한계 아님, 고정)", () => {
    const m = month(data([gold("P", "2020-01-01", X, X - sold)]), start, snap("2026-10", E, { cash: cashAfter, phys: X - sold, physCost: X }));
    expect(m.deltaNet).toBe(0);
    expect(amt(m, "valuation")).toBe(-sold);
    expect(amt(m, "unrecorded")).toBe(sold);
    expect(sum(m)).toBe(0);
  });
  it("연 탭(체인)에서도 두 경우 합계 = Δ순자산", () => {
    const TODAY = "2026-10-28";
    for (const follow of [true, false]) {
      const d = data([gold("P", "2020-01-01", follow ? X - sold : X, X - sold)]);
      const end = snap("2026-10", TODAY, { cash: cashAfter, phys: X - sold, physCost: follow ? X - sold : X });
      const live = { ...end, _date: TODAY, _display: TODAY, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
      const anchor = start.netAsset;
      const pts = resolveYearChain([snap("2026-09", S, { phys: X })], 2025, anchor, TODAY)!;
      const r = computeChainCauses({ points: pts, live, deltaNet: end.netAsset - anchor, endDate: TODAY, liveCash: cashAfter, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
      expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(end.netAsset - anchor);
    }
  });
  it("매입가 도움말: 수정 모드에만 일부 매도 안내, 등록 모드는 기존 문구 불변", () => {
    expect(PURCHASE_PRICE_HELP.edit).toBe("일부 팔았다면 평가액과 매입가를 판 금액만큼 함께 줄여 주세요.");
    expect(PURCHASE_PRICE_HELP.create).toBe("비우면 현재 평가액과 같게 기록돼요(손익 0).");
    const src = readFileSync("src/app/(main)/_components/forms/asset-update/input/physical-input.tsx", "utf8");
    expect(src).toContain('PURCHASE_PRICE_HELP[editData ? "edit" : "create"]');
  });
});

describe("R2·R7·R8", () => {
  it("R8 평가액만 수정: 평가 갱신 ±Δ", () => {
    const m = month(data(), snap("2026-09", S, { phys: X }), snap("2026-10", E, { phys: X + 500_000, physCost: X }));
    expect(amt(m, "valuation")).toBe(500_000);
  });
  it("R7 현금 항목 삭제 + 실물 등록: 같은 달이면 상쇄 0, 달이 갈리면 두 달 합 0", () => {
    const same = month(data([P()]), A0, snap("2026-10", E, { cash: 10_000_000 - X, phys: X }));
    expect(same.causes).toEqual([]);
  });
});
