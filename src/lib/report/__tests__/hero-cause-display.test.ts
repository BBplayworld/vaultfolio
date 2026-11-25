// 5.153 #304 홈 Hero·원인 행 표시 — 만원 정수 최대 나머지 배분(합 = Hero, 0만원·부호 반전 0)
import { describe, expect, it } from "vitest";
import { allocateManwon, formatHeroDelta, formatSignedShort, heroCauseTexts, heroManwon } from "../hero-cause-display";

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe("heroManwon — Hero 정본(0 방향 버림)", () => {
  it("양수·음수·경계", () => {
    expect(heroManwon(25_900)).toBe(2);
    expect(heroManwon(-25_900)).toBe(-2);
    expect(heroManwon(10_000)).toBe(1);
    expect(heroManwon(-9_999)).toBe(-0);
    expect(heroManwon(125_000_000)).toBe(12_500);
  });
});

describe("formatHeroDelta·formatSignedShort", () => {
  it("음수는 U+2212, 양수는 +, Hero는 ▲/▼ 접두", () => {
    expect(formatHeroDelta(25_900)).toBe("▲ +2만원");
    expect(formatHeroDelta(-25_900)).toBe("▼ −2만원");
    expect(formatHeroDelta(-12_345_678)).toBe("▼ −1,234만원");
    expect(formatSignedShort(-125_000_000)).toBe("−1.2억원");
    expect(formatHeroDelta(-125_000_000)).not.toContain("-");
  });
});

describe("allocateManwon", () => {
  it("빈 배열", () => expect(allocateManwon([], 3)).toEqual([]));
  it("원인 1개 = 정본 그대로", () => {
    expect(allocateManwon([25_900], 2)).toEqual([2]);
    expect(allocateManwon([-25_900], -2)).toEqual([-2]);
  });
  it("상쇄 +30.4만·−10.2만, Hero 20만", () => {
    expect(allocateManwon([304_000, -102_000], 20)).toEqual([30, -10]);
  });
  it("반올림 합 초과: 15.6·30·5.7 → 51 (나머지 큰 행에 1)", () => {
    expect(allocateManwon([156_000, 300_000, 57_000], 51)).toEqual([15, 30, 6]);
  });
  it("반올림 합 미달: 15.4·5.4·10.4 → 31 (동률은 절댓값 큰 행)", () => {
    expect(allocateManwon([154_000, 54_000, 104_000], 31)).toEqual([16, 5, 10]);
  });
  it("음수 3행: −15.6·−5.7·+10.4 → −10 (0 방향 버림 정본)", () => {
    const v = allocateManwon([-156_000, -57_000, 104_000], -10);
    expect(sum(v)).toBe(-10);
    expect(v.map(Math.sign)).toEqual([-1, -1, 1]);
  });
  it("0만원 금지: 1만 미만 양수 행은 최소 1", () => {
    const v = allocateManwon([205_000, 5_000], 21);
    expect(v).toEqual([20, 1]);
  });
  it("부호 반전·0 금지: −1.0만 행에 +1이 가면 0이 되므로 절댓값 큰 같은 방향 행으로 넘긴다", () => {
    // 바닥 [30, −1] = 29, 정본 30 → +1. 나머지 순서상 −1.0만(frac 0)·30.0만(frac 0) 동률 → 절댓값 큰 30만 행
    const v = allocateManwon([300_000, -10_000], 30);
    expect(v).toEqual([31, -1]);
    // 나머지 큰 −1.0x만 행이 먼저지만 0이 되므로 넘긴다
    const w = allocateManwon([300_000, -10_001], 30);
    expect(w[1]).toBe(-1);
    expect(sum(w)).toBe(30);
  });
  it("조정량이 행 수보다 크면 순환해도 합 = 정본, 제약 유지", () => {
    const v = allocateManwon([150_000, 150_000], 33);
    expect(sum(v)).toBe(33);
    expect(v.every((t) => t > 0)).toBe(true);
  });
  it("1억 이상 여럿: 배분 단위는 만원", () => {
    expect(allocateManwon([125_000_000, 34_600], 12_503)).toEqual([12_500, 3]);
  });
});

describe("heroCauseTexts — 행 글자", () => {
  it("원인 1개면 Hero 본문과 같은 글자", () => {
    for (const d of [25_900, -25_900, 125_000_000, -125_000_000, 99_999]) {
      expect(heroCauseTexts([d], d)[0]).toBe(formatHeroDelta(d).slice(2));
    }
  });
  it("여러 행 순서 유지", () => {
    expect(heroCauseTexts([156_000, 300_000, 57_000], 513_000)).toEqual(["+15만원", "+30만원", "+6만원"]);
    expect(heroCauseTexts([304_000, -102_000], 202_000)).toEqual(["+30만원", "−10만원"]);
  });
});
