// #250 ⑯ — 현금 최초 등록 전에 입력한 매매는 순유입(넣은 돈) 유지. 거래 날짜가 아니라 createdAt(시스템 시각)으로 판정
import { describe, it, expect } from "vitest";
import { isCashTrackedForTrades } from "../settlement";
import type { AssetData } from "@/types/asset";

const REG = Date.UTC(2026, 10, 23, 3, 0, 0); // 현금 등록 시각
const mk = (txCreated: (string | undefined)[], cashId = `cash_${REG}`, cash = true) =>
  ({
    cash: cash ? [{ id: cashId }] : [],
    transactions: txCreated.map((c, i) => ({ id: `t${i}`, date: "2026-11-10", createdAt: c })),
    cryptoTransactions: [],
  }) as unknown as AssetData;
const base = { startCash: 0, endCash: 5_000_000, hasCashRecords: false, startDate: "2026-09-28", endDate: "2026-11-23" };
const before = new Date(REG - 86_400_000).toISOString();
const after = new Date(REG + 60_000).toISOString();

describe("isCashTrackedForTrades", () => {
  it("전: 매매 모두 현금 등록보다 먼저 입력 → 거짓(순유입 유지)", () => {
    expect(isCashTrackedForTrades(mk([before, before]), base)).toBe(false);
  });
  it("후: 등록 뒤 입력한 매매가 섞이면 참(내부 이동)", () => {
    expect(isCashTrackedForTrades(mk([before, after]), base)).toBe(true);
  });
  it("거래 날짜가 아닌 createdAt 기준 — 날짜가 등록 뒤여도 입력이 먼저면 거짓", () => {
    const a = mk([before]); (a.transactions[0] as { date: string }).date = "2026-11-23";
    expect(isCashTrackedForTrades(a, base)).toBe(false);
  });
  it("현금을 처음부터 가진 사용자·입출금 기록·시작 현금은 값 불변(참)", () => {
    expect(isCashTrackedForTrades(mk([before]), { ...base, startCash: 1 })).toBe(true);
    expect(isCashTrackedForTrades(mk([before]), { ...base, hasCashRecords: true })).toBe(true);
  });
  it("폴백: id·createdAt을 못 읽거나 매매가 없으면 종전대로 참, 현금 0이면 거짓", () => {
    expect(isCashTrackedForTrades(mk([before], "cash_demo"), base)).toBe(true);
    expect(isCashTrackedForTrades(mk([undefined]), base)).toBe(true);
    expect(isCashTrackedForTrades(mk([]), base)).toBe(true);
    expect(isCashTrackedForTrades(mk([before], "x", false), { ...base, endCash: 0 })).toBe(false);
  });
});
