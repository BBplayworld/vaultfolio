import { describe, it, expect } from "vitest";
import { toUpbitMarket, fromUpbitMarket } from "../finance/upbit-service";
import { getCoinCacheSlot } from "../finance/coin-cache-slot";

describe("toUpbitMarket", () => {
  it("심볼을 원화 마켓 코드로 변환한다", () => {
    expect(toUpbitMarket("BTC")).toBe("KRW-BTC");
  });

  it("소문자·공백을 정규화한다", () => {
    expect(toUpbitMarket(" btc ")).toBe("KRW-BTC");
  });
});

describe("fromUpbitMarket", () => {
  it("마켓 코드에서 심볼을 추출한다", () => {
    expect(fromUpbitMarket("KRW-ETH")).toBe("ETH");
  });

  it("KRW 접두가 없으면 그대로 반환한다", () => {
    expect(fromUpbitMarket("ETH")).toBe("ETH");
  });

  it("왕복 변환이 보존된다", () => {
    expect(fromUpbitMarket(toUpbitMarket("SOL"))).toBe("SOL");
  });
});

describe("getCoinCacheSlot", () => {
  it("AC2: 1시간 슬롯 형식을 반환한다 (코인은 24시간 무휴장이라 항상 시간 슬롯)", () => {
    expect(getCoinCacheSlot()).toMatch(/^\d{4}-\d{2}-\d{2}-H\d{2}$/);
  });

  it("같은 시간 내 연속 호출은 동일한 슬롯이다", () => {
    expect(getCoinCacheSlot()).toBe(getCoinCacheSlot());
  });
});
