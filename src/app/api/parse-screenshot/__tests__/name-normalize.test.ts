import { describe, expect, it } from "vitest";
import { stripTrailingQuantity } from "../name-normalize";
import { lookupTicker } from "../ticker-map";

describe("stripTrailingQuantity (종목명 끝 수량 괄호)", () => {
  it("수량과 같으면 제거", () => {
    expect(stripTrailingQuantity("KODEX 미국빅테크10(104)", 104)).toBe("KODEX 미국빅테크10");
  });
  it("쉼표·공백 허용", () => {
    expect(stripTrailingQuantity("ACE 미국S&P500(1,314)", 1314)).toBe("ACE 미국S&P500");
    expect(stripTrailingQuantity("ACE 미국S&P500 ( 1,314 )", 1314)).toBe("ACE 미국S&P500");
  });
  it("수량과 다르면 보존", () => {
    expect(stripTrailingQuantity("TIGER 미국채10년(H)", 104)).toBe("TIGER 미국채10년(H)");
    expect(stripTrailingQuantity("KODEX 200(104)", 105)).toBe("KODEX 200(104)");
    expect(stripTrailingQuantity("TIGER 미국S&P500(합성)", 10)).toBe("TIGER 미국S&P500(합성)");
  });
  it("소수 수량", () => {
    expect(stripTrailingQuantity("ProShares X(12.5)", 12.5)).toBe("ProShares X");
  });
  it("영문 ETF", () => {
    expect(stripTrailingQuantity("QQQ(30)", 30)).toBe("QQQ");
  });
  it("수량 없음·이름만 괄호면 그대로", () => {
    expect(stripTrailingQuantity("KODEX 200(104)", 0)).toBe("KODEX 200(104)");
    expect(stripTrailingQuantity("(104)", 104)).toBe("(104)");
  });
  it("정상화 후 기존 종목 마스터 매칭 함수로 코드 확정", () => {
    const base = "KODEX 200";
    const code = lookupTicker(base);
    expect(code).toBeTruthy();
    expect(lookupTicker(stripTrailingQuantity("KODEX 200(104)", 104))).toBe(code);
  });
});
