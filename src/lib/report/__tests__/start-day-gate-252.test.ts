// #252 시작일 당일 경계 보정 — Hero 경로(computeAttributionSince)에서 시작점이 정밀 일별 행일 때만
// 시작일 당일 현금 기록을 createdAt(KST 날짜) > 시작일인 것만 포함. 결산·성적표·월 행·레거시 시작점은 main과 같다.
// D=2026-11-25(수), D+1=11-26(목). 주식 20주×100만 고정, 환율 고정.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeAttributionView } from "@/app/(main)/_components/views/activity/week-attribution";
import { snapOf, summaryOf } from "@/app/(main)/_components/views/activity/__tests__/week-fixtures";
import { computeAttributionBetween } from "../asset-report";
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";

const M = 1_000_000;
const RATES = { USD: 1400, JPY: 900 };
const D = "2026-11-25";
const D1 = "2026-11-26";
const EH = { "2026-11-24": RATES, [D]: RATES, [D1]: RATES };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-26T03:00:00Z")); });
afterEach(() => vi.useRealTimers());

const data = (cashBalance: number, cashTx: unknown[] = []): AssetData => ({
  realEstate: [],
  stocks: [{ id: "stk1", category: "domestic", name: "합성주식A", ticker: "000001", quantity: 20, averagePrice: 900_000, currentPrice: M, currency: "KRW", purchaseDate: "2026-10-01" }],
  crypto: [],
  cash: cashBalance > 0 ? [{ id: "csh1", type: "bank", name: "합성계좌", balance: cashBalance, currency: "KRW" }] : [],
  loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: cashTx, loanTransactions: [], cryptoTransactions: [], physicalAssets: [],
  lastUpdated: "2026-11-25T03:00:00.000Z", nickname: "",
} as unknown as AssetData);

const dep = (amount: number, date: string, createdAt?: string) => ({
  id: "ctx1", cashId: "csh1", type: "deposit", amount, currency: "KRW", date, reflected: true, ...(createdAt ? { createdAt } : {}),
});

const view = (live: AssetData, daily: DailyAssetSnapshot[], sinceDate: string, monthly: MonthlyAssetSnapshot[] = []) =>
  computeAttributionView({ assetData: live, rates: RATES, summary: summaryOf(live, RATES), daily, monthly, exchangeHistory: EH, sinceDate });
const rows = (dRow: AssetData, d1Before: AssetData = data(0)) => [snapOf(d1Before, RATES, "2026-11-24"), snapOf(dRow, RATES, D)];
const sum = (v: NonNullable<ReturnType<typeof view>>) => v.causes.reduce((a, c) => a + c.amount, 0);

describe("S1·S2 신규 현금 반복", () => {
  const live = data(5 * M);
  it("행 D가 등록 후(재계산됨)면 D+1 원인 없음", () => {
    const v = view(live, rows(live), D)!;
    expect(v.attr.deltaNet).toBe(0);
    expect(v.causes).toHaveLength(0);
  });
  it("행 D가 등록 전(구버전 행)이면 금액 그대로 반복 — 현행 동작, 합계=Δ순자산", () => {
    const v = view(live, rows(data(0)), D)!;
    expect(v.attr.deltaNet).toBe(5 * M);
    expect(sum(v)).toBe(5 * M);
  });
  it("D 당일 Hero(시작점=행 D 이전)는 신규 현금 유지", () => {
    const v = view(live, rows(live), "2026-11-24")!;
    expect(v.attr.deltaNet).toBe(5 * M);
    expect(sum(v)).toBe(5 * M);
  });
});

describe("S3 당일 입금 기록 — 유령 짝 없음", () => {
  const live = data(M, [dep(M, D, "2026-11-25T14:00:00+09:00")]);
  it("D+1: 시작일 당일 기록(createdAt=D)은 제외 → 원인·기록 0", () => {
    const v = view(live, rows(live), D)!;
    expect(v.attr.incomeEffect).toBe(0);
    expect(v.records).toHaveLength(0);
    expect(v.causes).toHaveLength(0);
    expect(v.attr.startDayGated).toBe(true);
  });
  it("D 당일: 현금 입금 +100만 유지(기록 목록=원인)", () => {
    const v = view(live, rows(live, data(0)), "2026-11-24")!;
    expect(v.attr.incomeEffect).toBe(M);
    expect(v.records).toHaveLength(1);
    expect(v.records[0].amount).toBe(M);
  });
});

describe("S4 소급 입력 — 행이 닫힌 뒤 입력은 포함(P1 유지)", () => {
  const live = data(M, [dep(M, D, "2026-11-26T09:00:00+09:00")]);
  it("createdAt=D+1·date=D → D+1 입금 +100만 포함, 합계=Δ순자산", () => {
    const v = view(live, rows(data(0)), D)!;
    expect(v.attr.incomeEffect).toBe(M);
    expect(v.records).toHaveLength(1);
    expect(sum(v)).toBe(v.attr.deltaNet);
  });
  it("UTC로는 D지만 KST로는 D+1인 createdAt(D 15:30Z=D+1 00:30 KST)은 포함", () => {
    const l = data(M, [dep(M, D, "2026-11-25T15:30:00.000Z")]);
    expect(view(l, rows(data(0)), D)!.attr.incomeEffect).toBe(M);
  });
});

describe("createdAt 없는 옛 기록·레거시 시작점·결산은 종전과 같다", () => {
  it("createdAt 없는 옛 기록: 시작일 당일이어도 종전대로 포함", () => {
    const l = data(M, [dep(M, D)]);
    expect(view(l, rows(data(0)), D)!.attr.incomeEffect).toBe(M);
  });
  it("레거시 시작점(netAsset만): 보정 없음 — createdAt=D여도 포함", () => {
    const l = data(M, [dep(M, D, "2026-11-25T14:00:00+09:00")]);
    const legacy = { date: D, netAsset: 20 * M, financialAsset: 20 * M } as DailyAssetSnapshot;
    const v = view(l, [snapOf(data(0), RATES, "2026-11-24"), legacy], D)!;
    expect(v.attr.estimated).toBe(true);
    expect(v.attr.startDayGated).toBeUndefined();
    expect(v.attr.incomeEffect).toBe(M);
  });
  it("월 행 시작점은 보정 대상 아님(월 행은 편집 때 갱신되지 않는다)", () => {
    const l = data(M, [dep(M, D, "2026-11-25T14:00:00+09:00")]);
    const monthly = [{ ...snapOf(data(0), RATES, D), month: "2026-11" } as unknown as MonthlyAssetSnapshot];
    const v = view(l, [], D, monthly)!;
    expect(v.attr.startDayGated).toBeUndefined();
    expect(v.attr.incomeEffect).toBe(M);
  });
  it("C143 결산 경로: computeAttributionBetween·computePeriodAttribution은 createdAt 무관하게 main과 같이 시작일 당일 포함", () => {
    const l = data(M, [dep(M, D, "2026-11-25T14:00:00+09:00")]);
    const prevM = { ...snapOf(data(0), RATES, D), month: "2026-11" } as unknown as MonthlyAssetSnapshot;
    const currM = { ...snapOf(l, RATES, D1), month: "2026-12" } as unknown as MonthlyAssetSnapshot;
    const between = computeAttributionBetween(prevM, currM, EH, l, RATES, true)!;
    expect(between.incomeEffect).toBe(M);
    expect(between.startDayGated).toBeUndefined();
  });
});
