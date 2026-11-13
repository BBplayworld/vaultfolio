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
    expect(stripTrailingQuantity("없는종목XYZ(104)", 105)).toBe("없는종목XYZ(104)");
    expect(stripTrailingQuantity("TIGER 미국S&P500(합성)", 10)).toBe("TIGER 미국S&P500(합성)");
  });
  it("소수 수량", () => {
    expect(stripTrailingQuantity("ProShares X(12.5)", 12.5)).toBe("ProShares X");
  });
  it("영문 ETF", () => {
    expect(stripTrailingQuantity("QQQ(30)", 30)).toBe("QQQ");
  });
  it("수량 없음·이름만 괄호면 그대로", () => {
    expect(stripTrailingQuantity("없는종목XYZ(104)", 0)).toBe("없는종목XYZ(104)");
    expect(stripTrailingQuantity("(104)", 104)).toBe("(104)");
  });
  it("정상화 후 기존 종목 마스터 매칭 함수로 코드 확정", () => {
    const base = "KODEX 200";
    const code = lookupTicker(base);
    expect(code).toBeTruthy();
    expect(lookupTicker(stripTrailingQuantity("KODEX 200(104)", 104))).toBe(code);
  });

  it("잘린 이름 끝 '('·'…' 제거 후 마스터 접두 일치로 코드 확정", () => {
    expect(stripTrailingQuantity("KODEX 미국빅테크10(", 104)).toBe("KODEX 미국빅테크10");
    expect(stripTrailingQuantity("KODEX 미국빅테크10…", 104)).toBe("KODEX 미국빅테크10");
    expect(lookupTicker(stripTrailingQuantity("KODEX 미국빅테크10(", 104))).toBeTruthy();
  });
  it("수량과 다른 숫자: 원본이 이미 마스터에 매칭되면 그대로(제거 불필요)", () => {
    const n = "KODEX 200(98)";
    const out = stripTrailingQuantity(n, 104);
    expect(lookupTicker(out)).toBe(lookupTicker("KODEX 200"));
  });
  it("마스터에 없는 이름의 다른 괄호 숫자는 보존", () => {
    expect(stripTrailingQuantity("없는종목XYZ(98)", 104)).toBe("없는종목XYZ(98)");
  });
  it("닫는 괄호 없는 (숫자 꼬리: 수량과 같으면 제거", () => {
    expect(stripTrailingQuantity("KODEX 미국빅테크10(104", 104)).toBe("KODEX 미국빅테크10");
    expect(stripTrailingQuantity("ACE 미국S&P500 (1,314", 1314)).toBe("ACE 미국S&P500");
  });
  it("닫는 괄호 없는 (숫자 꼬리: 수량과 달라도 마스터가 접두 일치하면 그대로 두고, 못 찾으면 보존", () => {
    expect(stripTrailingQuantity("없는종목XYZ(77", 5)).toBe("없는종목XYZ(77");
  });
  it("키움 2행 꼬리 `구분 | 티커`·말줄임 제거 (5.101)", () => {
    expect(stripTrailingQuantity("엔비디아 현금 | NVDA", 126)).toBe("엔비디아");
    expect(stripTrailingQuantity("테슬라 현금|TSLA", 460)).toBe("테슬라");
    expect(stripTrailingQuantity("비트마인 이머전… 현금 | BMNR", 45)).toBe("비트마인 이머전");
    expect(stripTrailingQuantity("디렉시온 테슬라(… 현금 | TSLL", 80)).toBe("디렉시온 테슬라");
  });
  it("줄바꿈 공백은 마스터 표기로 통일, 마스터에 없으면 그대로", () => {
    const code = lookupTicker("KODEX 미국빅테크10(H)");
    expect(code).toBeTruthy();
    expect(stripTrailingQuantity("KODEX 미국 빅테크10(H)", 174)).toBe("KODEX 미국빅테크10(H)");
    expect(stripTrailingQuantity("없는 종목 XYZ", 3)).toBe("없는 종목 XYZ");
  });
});
