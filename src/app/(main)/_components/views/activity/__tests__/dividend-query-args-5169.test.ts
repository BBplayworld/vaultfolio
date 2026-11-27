// #339(5.169) 배당 쿼리 인자 추출 — 배당 화면 쿼리 키 불변 + 현금 입금 폼 지급일 버튼 조회 게이트(국내·ISA·해외·엔화·혼합)
import { describe, expect, it } from "vitest";
import { dividendDateQueryArgs, dividendQueryArgs } from "../use-dividend-data";
import { dividendQueryOptions } from "@/lib/finance/dividend-client";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { Stock } from "@/types/asset";

const s = (o: Partial<Stock>): Stock =>
  ({ id: "a", category: "domestic", name: "n", ticker: "005930", quantity: 10, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o }) as Stock;

// 추출 전 use-dividend-data.ts의 계산 그대로(회귀 기준)
const OLD_DOMESTIC = new Set(["domestic", "irp", "isa", "pension"]);
const oldKey = (st: Stock) => ["dividend", "v11", normalizeTicker(st), OLD_DOMESTIC.has(st.category) ? "domestic" : "foreign"];

describe("dividendQueryArgs — 배당 화면 쿼리 키 불변", () => {
  const cases: Stock[] = [
    s({ ticker: "005930KQ" }),
    s({ category: "isa", ticker: "360750" }),
    s({ category: "irp", ticker: "069500" }),
    s({ category: "pension", ticker: "458730" }),
    s({ category: "foreign", ticker: "brk.b", currency: "USD" }),
    s({ category: "foreign", ticker: "AAPL", currency: "USD" }),
  ];
  it.each(cases.map((c) => [c.category, c.ticker, c]))("%s %s", (_c, _t, st) => {
    const { ticker, type } = dividendQueryArgs(st as Stock);
    expect([...dividendQueryOptions(ticker, type, "NAS").queryKey]).toEqual(oldKey(st as Stock));
  });
});

describe("dividendDateQueryArgs — 지급일 버튼 조회 게이트", () => {
  it("국내·ISA·IRP·연금 단독 → domestic 조회", () => {
    expect(dividendDateQueryArgs([s({})])).toEqual({ ticker: "005930", type: "domestic" });
    expect(dividendDateQueryArgs([s({ category: "isa", ticker: "360750" })])).toEqual({ ticker: "360750", type: "domestic" });
    expect(dividendDateQueryArgs([s({ category: "irp" })])).toEqual({ ticker: "005930", type: "domestic" });
    expect(dividendDateQueryArgs([s({ category: "pension" })])).toEqual({ ticker: "005930", type: "domestic" });
  });
  it("domestic + ISA 혼합(같은 티커 두 계좌) → 키 1개", () => {
    expect(dividendDateQueryArgs([s({ id: "a" }), s({ id: "b", category: "isa", ticker: "005930KS" })])).toEqual({ ticker: "005930", type: "domestic" });
  });
  it("해외(USD)·엔화·비상장·상장폐지·티커 없음 → null(요청 0)", () => {
    expect(dividendDateQueryArgs([s({ category: "foreign", ticker: "AAPL", currency: "USD" })])).toBeNull();
    expect(dividendDateQueryArgs([s({ category: "foreign", ticker: "7203", currency: "JPY" })])).toBeNull();
    expect(dividendDateQueryArgs([s({ category: "unlisted", ticker: "" })])).toBeNull();
    expect(dividendDateQueryArgs([s({ inactiveStatus: "delisted" } as Partial<Stock>)])).toBeNull();
    expect(dividendDateQueryArgs([s({ ticker: "" })])).toBeNull();
    expect(dividendDateQueryArgs([])).toBeNull();
  });
  it("domestic + foreign 혼합 묶음 → null(해외 기준일 섞임 방지)", () => {
    expect(dividendDateQueryArgs([s({ id: "a", ticker: "SPY" }), s({ id: "b", category: "foreign", ticker: "SPY", currency: "USD" })])).toBeNull();
  });
  it("상장폐지 행이 섞여도 살아 있는 국내 행이 있으면 조회", () => {
    expect(dividendDateQueryArgs([s({ id: "x", inactiveStatus: "delisted" } as Partial<Stock>), s({ id: "y", category: "isa" })])).toEqual({ ticker: "005930", type: "domestic" });
  });
});
