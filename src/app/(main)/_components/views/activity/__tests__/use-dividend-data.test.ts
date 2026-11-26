// #313(5.157) 배당 조회 대상 — 엔화 종목은 쿼리를 만들지 않고 수만 센다, 같은 종목 여러 계좌는 조회 1회·계산 행은 계좌별
import { describe, expect, it } from "vitest";
import { buildDividendGroups } from "../use-dividend-data";
import type { Stock } from "@/types/asset";

const s = (o: Partial<Stock>): Stock =>
  ({ id: "a", category: "domestic", name: "n", ticker: "005930", quantity: 10, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o }) as Stock;

describe("buildDividendGroups", () => {
  it("엔화 종목은 조회 대상에 없고 jpyCount로만 센다", () => {
    const { grouped, jpyCount } = buildDividendGroups([
      s({ id: "k" }),
      s({ id: "j1", ticker: "7203", category: "foreign", currency: "JPY" }),
      s({ id: "j2", ticker: "7203", category: "foreign", currency: "JPY", broker: "다른" }),
      s({ id: "j3", ticker: "6758", category: "foreign", currency: "JPY" }),
    ]);
    expect(grouped.map((g) => g.stock.ticker)).toEqual(["005930"]);
    expect(jpyCount).toBe(2);
  });
  it("같은 종목 두 계좌 → 조회 1묶음, 원본 행 2개(id 유지)", () => {
    const { grouped } = buildDividendGroups([s({ id: "A" }), s({ id: "B", broker: "나" })]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].items.map((i) => i.id)).toEqual(["A", "B"]);
    expect(grouped[0].stock.quantity).toBe(20);
  });
  it("상장폐지·비상장 제외, 거래정지 포함", () => {
    const { grouped } = buildDividendGroups([
      s({ id: "d", ticker: "D", inactiveStatus: "delisted" }),
      s({ id: "u", ticker: "U", category: "unlisted" }),
      s({ id: "h", ticker: "H", inactiveStatus: "halted" }),
    ]);
    expect(grouped.map((g) => g.stock.id)).toEqual(["h"]);
  });
});
