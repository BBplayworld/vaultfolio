import { describe, expect, it } from "vitest";
import { formatShortCurrency, formatShortCurrencyDecimal } from "@/lib/number-utils";

// 기대값은 구현과 독립적으로 "정수 개수 → 문자열"로 만든다 (부동소수 연산 없이 문자열 자르기)
const addCommas = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const expectUnits = (units: number, digits: number): string => {
  const s = String(units).padStart(digits + 1, "0");
  const intPart = addCommas(String(Number(s.slice(0, -digits))));
  const frac = s.slice(-digits).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
};

describe("formatShortCurrencyDecimal — 억 단위 소수 둘째 자리 버림(#129)", () => {
  it("보고된 사례: 딱 떨어지는 값이 한 칸 더 버려지지 않는다", () => {
    expect(formatShortCurrencyDecimal(230_000_000)).toBe("2.3억원");
    expect(formatShortCurrencyDecimal(410_000_000)).toBe("4.1억원");
    expect(formatShortCurrencyDecimal(870_000_000)).toBe("8.7억원");
    expect(formatShortCurrencyDecimal(201_000_000)).toBe("2.01억원");
    expect(formatShortCurrencyDecimal(113_000_000)).toBe("1.13억원");
    expect(formatShortCurrencyDecimal(510_000_000)).toBe("5.1억원");
  });

  it("버림 규칙·끝 0 제거·천 단위 콤마 유지", () => {
    expect(formatShortCurrencyDecimal(100_000_000)).toBe("1억원");
    expect(formatShortCurrencyDecimal(644_450_000)).toBe("6.44억원");
    expect(formatShortCurrencyDecimal(660_097_840)).toBe("6.6억원");
    expect(formatShortCurrencyDecimal(612_000_000)).toBe("6.12억원");
    expect(formatShortCurrencyDecimal(1_200_000_000)).toBe("12억원");
    expect(formatShortCurrencyDecimal(123_456_789_000)).toBe("1,234.56억원");
    expect(formatShortCurrencyDecimal(239_999_999)).toBe("2.39억원");
  });

  it("1억~50억의 100만원 배수 전부가 정수 기준 기대 문자열과 같다", () => {
    const wrong: string[] = [];
    for (let k = 100; k <= 5000; k++) {
      const v = k * 1_000_000;
      const want = `${expectUnits(k, 2)}억원`;
      if (formatShortCurrencyDecimal(v) !== want) wrong.push(`${v}→${formatShortCurrencyDecimal(v)}`);
      if (formatShortCurrencyDecimal(-v) !== `-${want}`) wrong.push(`${-v}→${formatShortCurrencyDecimal(-v)}`);
    }
    expect(wrong).toEqual([]);
  });

  it("100만원 배수가 아닌 값(1만원 배수 일부)도 100만원 단위로 버린다", () => {
    const wrong: string[] = [];
    for (let v = 100_000_000; v <= 5_000_000_000; v += 1_230_000) {
      const want = `${expectUnits(Math.floor(v / 1_000_000), 2)}억원`;
      if (formatShortCurrencyDecimal(v) !== want) wrong.push(`${v}→${formatShortCurrencyDecimal(v)}`);
    }
    expect(wrong).toEqual([]);
  });

  it("음수는 부호만 붙고 같은 숫자", () => {
    expect(formatShortCurrencyDecimal(-230_000_000)).toBe("-2.3억원");
    expect(formatShortCurrencyDecimal(-201_000_000)).toBe("-2.01억원");
    expect(formatShortCurrencyDecimal(-2_900_000)).toBe("-2.9백만원");
    expect(formatShortCurrencyDecimal(-29_000)).toBe("-2.9만원");
    expect(formatShortCurrencyDecimal(-5_000)).toBe("-5,000원");
  });

  it("1억 미만 경계(백만·만·원)", () => {
    expect(formatShortCurrencyDecimal(0)).toBe("0원");
    expect(formatShortCurrencyDecimal(99_999_999)).toBe("99.99백만원");
    expect(formatShortCurrencyDecimal(1_000_000)).toBe("1백만원");
    expect(formatShortCurrencyDecimal(999_999)).toBe("99.99만원");
    expect(formatShortCurrencyDecimal(10_000)).toBe("1만원");
    expect(formatShortCurrencyDecimal(9_999)).toBe("9,999원");
    expect(formatShortCurrencyDecimal(2_900_000)).toBe("2.9백만원");
    expect(formatShortCurrencyDecimal(29_000)).toBe("2.9만원");
  });

  it("백만(1만원 배수)·만(100원 배수) 구간 전수", () => {
    const wrong: string[] = [];
    for (let k = 100; k <= 9999; k++) {
      const v = k * 10_000; // 100만~9,999만
      if (formatShortCurrencyDecimal(v) !== `${expectUnits(k, 2)}백만원`) wrong.push(`${v}→${formatShortCurrencyDecimal(v)}`);
    }
    for (let k = 100; k <= 9999; k++) {
      const v = k * 100; // 1만~99.99만
      if (formatShortCurrencyDecimal(v) !== `${expectUnits(k, 2)}만원`) wrong.push(`${v}→${formatShortCurrencyDecimal(v)}`);
    }
    expect(wrong).toEqual([]);
  });

  it("원 미만 소수는 전체 금액 표기와 같은 원 단위(반올림) 기준", () => {
    expect(formatShortCurrencyDecimal(229_999_999.6)).toBe("2.3억원"); // formatCurrency = 230,000,000원
    expect(formatShortCurrencyDecimal(229_999_999.4)).toBe("2.29억원"); // formatCurrency = 229,999,999원
  });
});

describe("formatShortCurrency — 억 단위 소수 첫째 자리 버림(같은 패턴 정수화)", () => {
  it("1억~50억의 100만원 배수 전부가 정수 기준 기대 문자열과 같다(부호 포함)", () => {
    const wrong: string[] = [];
    for (let k = 100; k <= 5000; k++) {
      const v = k * 1_000_000;
      const want = `${expectUnits(Math.floor(k / 10), 1)}억원`;
      if (formatShortCurrency(v) !== want) wrong.push(`${v}→${formatShortCurrency(v)}`);
      if (formatShortCurrency(-v) !== `-${want}`) wrong.push(`${-v}→${formatShortCurrency(-v)}`);
    }
    expect(wrong).toEqual([]);
  });

  it("경계·만원 구간 불변", () => {
    expect(formatShortCurrency(0)).toBe("0원");
    expect(formatShortCurrency(230_000_000)).toBe("2.3억원");
    expect(formatShortCurrency(1_200_000_000)).toBe("12억원");
    expect(formatShortCurrency(99_999_999)).toBe("9,999만원");
    expect(formatShortCurrency(-29_000)).toBe("-2만원");
    expect(formatShortCurrency(9_999)).toBe("9,999원");
  });
});
