// #311(5.158) 기록 입력 정확도 — 체결 환율 단일 값(0 저장 금지), 0 거래 백업 왕복 불변
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTradeRate, roundTradePrice, shouldAskPastDate } from "../trade/trade-form";
import { applyImportedPayload, getAssetData, saveAssetData } from "../asset/asset-storage";
import { computeForeignRealizedGain, todayKst } from "../tax-utils";
import { emptyData, g, memoryStorage } from "./physical-fixtures";
import type { AssetData } from "@/types/asset";

describe("resolveTradeRate — 칸 = 미리보기 = 저장값", () => {
  it.each([
    // [칸 값, 현재 환율, 해외 여부, 기대]
    [1350, 1400, true, 1350], // 사용자가 고친 값
    [0, 1400, true, 1400], // 칸을 지움(NumberInput이 0 전달) → 현재 환율, 0 저장 0건
    [undefined, 1400, true, 1400], // 칸이 비어 있음
    [-5, 1400, true, 1400], // 음수도 값 없음
    [0, 0, true, undefined], // 환율 미수신 → undefined(현행)
    [undefined, 0, true, undefined],
    [1350, 0, true, 1350], // 미수신이어도 직접 넣은 값은 저장
    [1350, 1400, false, undefined], // 국내 종목 — 앞서 고른 해외 종목 칸 값이 남지 않게
    [undefined, 0, false, undefined],
  ] as const)("칸 %s · 현재 %s · 해외 %s → %s", (input, currentRate, isForeign, expected) => {
    expect(resolveTradeRate({ input, currentRate, isForeign })).toBe(expected);
  });
  it("어떤 조합에서도 0을 돌려주지 않는다", () => {
    for (const input of [undefined, 0, -1, 1, 1400]) {
      for (const currentRate of [0, 900, 1400]) {
        for (const isForeign of [true, false]) {
          expect(resolveTradeRate({ input, currentRate, isForeign })).not.toBe(0);
        }
      }
    }
  });
});

describe("체결 환율 0 기존 거래 — 백업 왕복 불변(저장 변경 0)", () => {
  beforeEach(() => {
    g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
    g.localStorage = memoryStorage();
  });
  afterEach(() => {
    delete g.window; delete g.localStorage;
    vi.useRealTimers();
  });
  const legacy = (): AssetData => ({
    ...emptyData(),
    stocks: [{ id: "s1", category: "foreign", name: "Apple", ticker: "AAPL", quantity: 5, averagePrice: 100, purchaseExchangeRate: 1300, currentPrice: 200, currency: "USD", purchaseDate: "2026-01-10" } as AssetData["stocks"][number]],
    transactions: [
      { id: "t1", stockId: "s1", ticker: "AAPL", stockName: "Apple", type: "buy", quantity: 10, price: 100, currency: "USD", exchangeRate: 1300, date: "2026-01-10", reflected: true, createdAt: "2026-01-10T00:00:00.000Z" },
      { id: "t2", stockId: "s1", ticker: "AAPL", stockName: "Apple", type: "sell", quantity: 10, price: 130, currency: "USD", exchangeRate: 0, date: "2026-06-10", reflected: true, createdAt: "2026-06-10T00:00:00.000Z" },
    ] as AssetData["transactions"],
  });
  it("0 저장 거래를 저장→백업 내보내기(JSON)→복원해도 거래 값과 세금 추정이 같다", () => {
    const rates = { USD: 1400, JPY: 900 };
    expect(saveAssetData(legacy())).toBe(true);
    const before = getAssetData();
    const gainBefore = computeForeignRealizedGain(before, 2026, rates);
    const file = JSON.parse(JSON.stringify({ assetData: before }));
    applyImportedPayload(file);
    const after = getAssetData();
    expect(after.transactions).toEqual(before.transactions);
    expect(after.transactions.find((t) => t.id === "t2")?.exchangeRate).toBe(0); // 기존 레코드는 다시 쓰지 않는다
    expect(computeForeignRealizedGain(after, 2026, rates)).toEqual(gainBefore);
    expect(gainBefore!.gainKrw).toBeCloseTo(10 * 130 * 1400 - 10 * 100 * 1300, 0); // 매도 대금 0원이 아니다
  });
});

describe("과거 날짜 질문 표시 조건(KST)", () => {
  afterEach(() => vi.useRealTimers());
  it("오늘·빈 날짜·신규 자산이면 묻지 않고, 어제면 묻는다", () => {
    expect(shouldAskPastDate({ date: "2026-11-26", today: "2026-11-26" })).toBe(false);
    expect(shouldAskPastDate({ date: "", today: "2026-11-26" })).toBe(false);
    expect(shouldAskPastDate({ date: "2026-11-25", today: "2026-11-26" })).toBe(true);
    expect(shouldAskPastDate({ date: "2026-11-25", today: "2026-11-26", isNewSelected: true })).toBe(false);
  });
  it("KST 00~09시: UTC로는 아직 전날이어도 KST 어제 날짜면 묻는다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T15:30:00Z")); // KST 11-26 00:30, UTC 11-25
    expect(todayKst()).toBe("2026-11-26");
    expect(shouldAskPastDate({ date: "2026-11-25", today: todayKst() })).toBe(true);
    expect(shouldAskPastDate({ date: "2026-11-26", today: todayKst() })).toBe(false);
  });
  it("KST 23:59: 같은 날은 묻지 않는다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T14:59:00Z")); // KST 11-26 23:59
    expect(shouldAskPastDate({ date: "2026-11-26", today: todayKst() })).toBe(false);
  });
});

describe("현재가 넣기 반올림 — 단가 칸 자릿수", () => {
  it("USD 3자리·JPY 4자리·KRW 0자리", () => {
    expect(roundTradePrice(187.23456, "USD")).toBe(187.235);
    expect(roundTradePrice(1234.567891, "JPY")).toBe(1234.5679);
    expect(roundTradePrice(71_850.6, "KRW")).toBe(71_851);
    expect(roundTradePrice(71_850.4, undefined)).toBe(71_850);
  });
});
