// #58 실물 자산 — 결산 패턴 ①~⑥ × 월·연 탭 항등식(원인 합계 = Δ순자산), 수동 앵커·1월 경계, 실물 0건 main 동일 (spec 10절 7, 12절 15)
import { describe, expect, it } from "vitest";
import { computeChainCauses, computeSettlementCauses, matchRecordedTransfers } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionBetween, getAttributionItems } from "../asset-report";
import { resolveYearChain } from "../settlement";
import type { AssetData, MonthlyAssetSnapshot, PhysicalAsset } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
interface P { cash: number; stock?: number; phys?: number; physCost?: number; noPhysField?: boolean }
const snap = (month: string, date: string, o: P): MonthlyAssetSnapshot => {
  const { cash, stock = 0, phys = 0, physCost = phys, noPhysField = false } = o;
  return {
    month, date, netAsset: cash + stock + phys, financialAsset: cash + stock,
    breakdown: { realEstate: 0, stocks: stock, crypto: 0, cash, loans: 0, tenantDeposit: 0, ...(noPhysField ? {} : { physical: phys }) },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + stock + physCost, stock, crypto: 0, realEstate: 0, ...(noPhysField ? {} : { physical: physCost }) },
  };
};
const gold = (id: string, purchaseDate: string, purchasePrice: number, currentValue = purchasePrice): PhysicalAsset =>
  ({ id, type: "gold", name: "금", purchaseDate, purchasePrice, currentValue });
const wd = (id: string, date: string, amount: number) =>
  ({ id, cashId: "c", date, type: "withdrawal", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];
const LIVE_DUMMY = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const month = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) =>
  computeSettlementCauses({
    start, end, live: LIVE_DUMMY, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
const amt = (m: ReturnType<typeof month>, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
const sum = (m: ReturnType<typeof month>) => m.causes.reduce((s, c) => s + c.amount, 0);
const S = "2026-09-30", E = "2026-10-28";
const X = 3_000_000;

describe("월 탭 패턴 ①~⑥ — 원인 합계 = Δ순자산", () => {
  it("① 오래전 산 금을 처음 등록(현금 등록 사용자) → 기록 안 된 변화 +X", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2020-01-01", X)] };
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 10_000_000, phys: X }));
    expect([amt(m, "unrecorded"), amt(m, "income"), amt(m, "valuation")]).toEqual([X, 0, 0]);
    expect(sum(m)).toBe(m.deltaNet);
  });
  it("② 같은 상황, 현금 미등록 사용자 → 순유입 +X", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2020-01-01", X)] };
    const m = month(d, snap("2026-09", S, { cash: 0, stock: 5_000_000 }), snap("2026-10", E, { cash: 0, stock: 5_000_000, phys: X }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([X, 0]);
    expect(sum(m)).toBe(m.deltaNet);
  });
  it("③ 현금 잔액을 직접 줄이고 금 등록 → 0(풀 상쇄)", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2026-10-11", X)] };
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 7_000_000, phys: X }));
    expect(m.causes).toEqual([]);
    expect(m.deltaNet).toBe(0);
  });
  it("④ 기록된 출금 → 금 등록(±3일) → 0, 두 다리가 갈리지 않음", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2026-10-12", X)], cashTransactions: [wd("w", "2026-10-10", X)] };
    expect(matchRecordedTransfers(d, S, E, RATES)).toBe(X);
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 7_000_000, phys: X }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([0, 0]);
    expect(sum(m)).toBe(m.deltaNet);
  });
  it("④' 4일 차 출금은 짝이 아니다 → 순유입 −X · 기록 안 된 변화 +X", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2026-10-15", X)], cashTransactions: [wd("w", "2026-10-10", X)] };
    expect(matchRecordedTransfers(d, S, E, RATES)).toBe(0);
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 7_000_000, phys: X }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([-X, X]);
    expect(sum(m)).toBe(m.deltaNet);
  });
  it("⑤ 평가액만 수정 → 평가 갱신 ±Δ, 엔진에는 price:physical", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2020-01-01", X, X + 500_000)] };
    const start = snap("2026-09", S, { cash: 10_000_000, phys: X });
    const end = snap("2026-10", E, { cash: 10_000_000, phys: X + 500_000, physCost: X });
    const m = month(d, start, end);
    expect(m.causes.map((c) => [c.key, c.amount])).toEqual([["valuation", 500_000]]);
    const attr = computeAttributionBetween(start, end, {}, d, RATES, false)!;
    expect(attr.effects.find((e) => e.key === "price:physical")!.amount).toBe(500_000);
    expect(getAttributionItems(attr).map((i) => i.key)).toContain("price:physical");
    // 하락도 대칭
    const down = month(d, start, snap("2026-10", E, { cash: 10_000_000, phys: X - 200_000, physCost: X }));
    expect(amt(down, "valuation")).toBe(-200_000);
  });
  it("⑥ 변화 없는 달 → 실물 관련 원인 0", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2020-01-01", X)] };
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, phys: X }), snap("2026-10", E, { cash: 10_000_000, phys: X }));
    expect(m.causes).toEqual([]);
  });
  it("실물 삭제(매도) → 순유출 쪽으로 항등식 유지", () => {
    const d = data();
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, phys: X }), snap("2026-10", E, { cash: 10_000_000 }));
    expect(sum(m)).toBe(m.deltaNet);
    expect(m.deltaNet).toBe(-X);
  });
});

describe("연 탭(수동 앵커·1월 경계)에서도 항등식", () => {
  const anchorYear = 2026;
  it("작년 수동값 앵커 → 올해 enrich 달 → 실시간, 패턴 ①·⑤ 혼합, 합계 = Hero", () => {
    const TODAY = "2026-10-28";
    const d = { ...data(), physicalAssets: [gold("P", "2026-08-15", X, X + 400_000)] };
    const monthly = [
      snap("2026-08", "2026-08-28", { cash: 10_000_000, phys: X, physCost: X }),
      snap("2026-09", "2026-09-28", { cash: 10_000_000, phys: X + 200_000, physCost: X }),
      snap("2026-10", "2026-10-03", { cash: 10_000_000, phys: X + 200_000, physCost: X }),
    ];
    const live = { ...snap("2026-10", TODAY, { cash: 10_000_000, phys: X + 400_000, physCost: X }), _date: TODAY, _display: TODAY, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
    const anchor = 12_000_000;
    const points = resolveYearChain(monthly, anchorYear - 1, anchor, TODAY)!;
    const hero = live.netAsset - anchor;
    const r = computeChainCauses({ points, live, deltaNet: hero, endDate: TODAY, liveCash: 10_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(hero);
    expect(amt(r, "valuation")).toBe(400_000); // 9월 +20만 + 10월 +20만 (실측 구간)
  });
  it("1월 경계: 2027-01 연 탭 = 2026 앵커 + 2027 월만, 합계 = Hero", () => {
    const TODAY = "2027-01-20";
    const d = { ...data(), physicalAssets: [gold("P", "2020-01-01", X, X + 300_000)] };
    const monthly = [
      snap("2026-11", "2026-11-28", { cash: 10_000_000, phys: X, physCost: X }),
      snap("2026-12", "2026-12-28", { cash: 10_000_000, phys: X, physCost: X }),
      snap("2027-01", "2027-01-03", { cash: 10_000_000, phys: X + 100_000, physCost: X }),
    ];
    const live = { ...snap("2027-01", TODAY, { cash: 10_000_000, phys: X + 300_000, physCost: X }), _date: TODAY, _display: TODAY, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
    const points = resolveYearChain(monthly, 2026, null, TODAY)!;
    expect(points.map((p) => p.month)).toEqual(["2026-12"]);
    const hero = live.netAsset - monthly[1].netAsset;
    const r = computeChainCauses({ points, live, deltaNet: hero, endDate: TODAY, liveCash: 10_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(hero);
    expect(amt(r, "valuation")).toBe(300_000);
  });
  it("앵커가 수동값(스냅샷 없음)이고 올해 달이 없으면 실시간 단일 예측 구간에서도 합계 = Hero (실물 신규 포함)", () => {
    const TODAY = "2026-10-28";
    const d = { ...data(), physicalAssets: [gold("P", "2026-05-01", X)] };
    const live = { ...snap("2026-10", TODAY, { cash: 10_000_000, phys: X }), _date: TODAY, _display: TODAY, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
    const points = resolveYearChain([], 2025, 10_000_000, TODAY)!;
    const hero = live.netAsset - 10_000_000;
    const r = computeChainCauses({ points, live, deltaNet: hero, endDate: TODAY, liveCash: 10_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(hero);
  });
});

describe("실물 0건은 main과 같다 (C8)", () => {
  const withField = (o: P) => snap("x", "2026-10-01", o);
  it("physical 필드가 없는 스냅샷과 physical:0 스냅샷의 원인 effects가 같다 — 월 구간", () => {
    const a = computeAttributionBetween(snap("2026-09", S, { cash: 10_000_000, stock: 5_000_000, noPhysField: true }), snap("2026-10", E, { cash: 11_000_000, stock: 6_000_000, noPhysField: true }), {}, data(), RATES, false)!;
    const b = computeAttributionBetween(snap("2026-09", S, { cash: 10_000_000, stock: 5_000_000 }), snap("2026-10", E, { cash: 11_000_000, stock: 6_000_000 }), {}, data(), RATES, false)!;
    expect(b).toEqual(a);
    expect(a.effects.some((e) => e.key.endsWith(":physical"))).toBe(false);
    void withField;
  });
  it("구버전 스냅샷(필드 없음) → 신규 스냅샷(실물 있음) 구간도 항등식", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2026-10-02", X)] };
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, noPhysField: true }), snap("2026-10", E, { cash: 7_000_000, phys: X }));
    expect(sum(m)).toBe(m.deltaNet);
  });
  it("예측 경로(시작 스냅샷 레거시)에서 실물 매입일이 구간 안이면 매입으로 분리되고 합계 유지", () => {
    const d = { ...data(), physicalAssets: [gold("P", "2026-10-05", X)] };
    const legacy: MonthlyAssetSnapshot = { month: "2026-09", date: S, netAsset: 10_000_000, financialAsset: 10_000_000 };
    const end = snap("2026-10", E, { cash: 7_000_000, phys: X });
    const attr = computeAttributionBetween(legacy, end, {}, d, RATES, false)!;
    expect(attr.estimated).toBe(true);
    expect(attr.effects.find((e) => e.key === "buy:physical")!.amount).toBe(X);
    const m = month(d, legacy, end);
    expect(sum(m)).toBe(m.deltaNet);
  });
});
