// 5.102 v2 자산 구성 비교 표 — 상수 원문 대조·매핑·분위 경계·0건·금지어.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { EOK, HOUSEHOLD_COMPOSITION as C, HOUSEHOLD_NETWORTH_STATS } from "@/config/household-networth-stats";
import { mapMyComposition, quintileOf, sharePctOf, buildNetworthBenchmark } from "../networth-benchmark";
import { NetworthBenchmarkBlock } from "@/app/(main)/_components/views/activity/networth-benchmark-block";

const MAN = 10_000;
const groups = [C.all, ...C.quintiles];
// source-xlsx 기대표(금액 · 비중): 예금·주식 등 / 보증금 / 부동산 / 부채
const EXPECT: [string, number, string, number, string, number, string, number][] = [
  ["9,960만", 18, "3,730만", 7, "4억 298만", 71, "9,534만", 17],
  ["1,001만", 26, "1,422만", 37, "1,033만", 27, "2,758만", 71],
  ["3,515만", 23, "3,546만", 23, "6,869만", 45, "4,697만", 31],
  ["6,367만", 20, "3,509만", 11, "1억 9,548만", 62, "7,536만", 24],
  ["1억 873만", 19, "3,635만", 6, "4억 141만", 69, "1억 164만", 18],
  ["2억 8,031만", 16, "6,534만", 4, "13억 3,829만", 77, "2억 2,505만", 13],
];
const mineOf = (over: Partial<Parameters<typeof mapMyComposition>[0]> = {}) => ({ stockValue: 0, cryptoValue: 0, cashValue: 0, realEstateValue: 0, loanBalance: 0, tenantDepositTotal: 0, totalValue: 0, ...over });
const view = (netAsset: number, count: number, mine = mineOf({ realEstateValue: 1, totalValue: 1 })) =>
  buildNetworthBenchmark({ netAsset, realEstateCount: count, stats: HOUSEHOLD_NETWORTH_STATS, mine })!;

describe("구성 상수 원문 대조", () => {
  it("원문 값(원 단위) 그대로", () => {
    expect(C.all.savings).toBe(99_603_000);
    expect(C.all.estate).toBe(402_983_000);
    expect(C.quintiles[4].estate).toBe(1_338_285_000);
    expect(C.quintiles[1].deposit).toBe(35_455_000);
    expect(C.quintiles[3].debtRatioPct).toBe(17.5);
  });
  it("합이 ±0.1만원 안에서 맞는다", () => {
    for (const g of groups) {
      const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.1 * MAN + 1);
      near(g.savings + g.deposit, g.financial);
      near(g.estate + g.otherReal, g.realAsset);
      near(g.finDebt + g.rentDeposit, g.debt);
      near(g.financial + g.realAsset, g.asset);
      near(g.asset - g.debt, g.net);
    }
  });
  it("부채 비중이 원문 부채/자산과 정수에서 일치", () => {
    for (const g of groups) expect(sharePctOf(g.debt, g.asset)).toBe(Math.round(g.debtRatioPct));
  });
});

describe("화면 값 — 기대표 6집단", () => {
  const cases: [string, number | null][] = [["all", null], ["q0", 0], ["q1", 2], ["q2", 4], ["q3", 6], ["q4", 8]];
  cases.forEach(([name, decile], gi) => {
    it(name, () => {
      const stats = HOUSEHOLD_NETWORTH_STATS;
      const v = buildNetworthBenchmark({ netAsset: decile === null ? 0 : (decile === 0 ? 0 : (stats.brackets[decile].min as number)), realEstateCount: decile === null ? 0 : 1, stats, mine: mineOf({ realEstateValue: 1, totalValue: 1 }) })!;
      const e = EXPECT[gi];
      v.composition!.rows.forEach((r, i) => { expect(r.avgText).toBe(e[i * 2]); expect(r.sharePct).toBe(e[i * 2 + 1]); });
    });
  });
});

describe("기준 줄·분위 경계", () => {
  const basis = (n: number) => view(n, 1).composition!.basis;
  it("5개 범위가 P20·P40·P60·P80과 같다", () => {
    expect(basis(0)).toBe("순자산 5,108만 미만 가구(20%) 평균");
    expect(basis(1 * EOK)).toBe("순자산 5,108만~1억 6,472만 가구(20%) 평균");
    expect(basis(2 * EOK)).toBe("순자산 1억 6,472만~3억 3,050만 가구(20%) 평균");
    expect(basis(5 * EOK)).toBe("순자산 3억 3,050만~6억 9,380만 가구(20%) 평균");
    expect(basis(7 * EOK)).toBe("순자산 6억 9,380만 이상 가구(20%) 평균");
  });
  it("경계 금액은 위 분위(하한 포함)", () => {
    expect(basis(5108 * MAN - 1)).toContain("5,108만 미만");
    expect(basis(5108 * MAN)).toContain("5,108만~");
    expect(basis(69380 * MAN)).toContain("이상");
  });
  it("10분위→5분위 올림", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(quintileOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("매핑·내 비중", () => {
  it("예금·주식 등 = 주식+코인+현금, 부채 = 대출+받은 보증금, 보증금 행은 null", () => {
    const m = mapMyComposition(mineOf({ stockValue: 10, cryptoValue: 20, cashValue: 30, realEstateValue: 100, loanBalance: 5, tenantDepositTotal: 7, totalValue: 200 }));
    expect(m.amounts).toEqual([60, null, 100, 12]);
    const v = view(1 * EOK, 1, mineOf({ stockValue: 10, cryptoValue: 20, cashValue: 30, realEstateValue: 100, loanBalance: 5, tenantDepositTotal: 7, totalValue: 200 }));
    expect(v.composition!.rows.map((r) => r.minePct)).toEqual([30, null, 50, 6]);
  });
  it("부채 100% 초과는 그대로", () => {
    const v = view(0, 1, mineOf({ realEstateValue: 100, loanBalance: 140, totalValue: 100 }));
    expect(v.composition!.rows[3].minePct).toBe(140);
  });
});

describe("부동산 0건·렌더", () => {
  const mine = mineOf({ stockValue: 10, totalValue: 10 });
  const html0 = renderToStaticMarkup(<NetworthBenchmarkBlock netAsset={10} realEstateCount={0} mine={mine} />);
  const html1 = renderToStaticMarkup(<NetworthBenchmarkBlock netAsset={3 * EOK} realEstateCount={1} mine={mineOf({ realEstateValue: 3 * EOK, totalValue: 3 * EOK })} />);
  it("0건 — 전체 가구, 내 비중 열 없음", () => {
    expect(html0).toContain("전체 가구의 자산 구성");
    expect(html0.replace(/<[^>]+>/g, "")).toContain("전체 가구 평균");
    expect(html0).not.toContain("benchmark-comp-mine-");
    expect(html0).not.toContain("내 비중");
    expect(html0).toContain("9,960만");
  });
  it("1건 — 소제목·내 비중·보증금 —", () => {
    expect(html1).toContain("순자산이 비슷한 가구의 자산 구성");
    expect(html1).toContain('aria-label="앱에 없는 항목"');
    expect((html1.match(/benchmark-comp-row-\d/g) ?? []).length).toBe(4);
    expect(html1.indexOf("benchmark-comp-table")).toBeGreaterThan(html1.indexOf("benchmark-bars"));
    expect(html1.indexOf("benchmark-comp-note-1")).toBeLessThan(html1.indexOf("benchmark-source"));
  });
  it("금지어·손익색·화살표 0", () => {
    const comp = (h: string) => h.slice(h.indexOf('data-testid="benchmark-comp"'), h.indexOf('data-testid="benchmark-source"'));
    for (const h of [html0, html1]) {
      const t = comp(h);
      expect(t).not.toMatch(/많|적다|적어|높다|낮다|평균 이하|평균 이상|분위|[↑↓▲▼±]|rose-|blue-|orange-|<button|<a /);
      expect(t).not.toContain("(만원)");
    }
  });
  it("소스에 새 서열 문구 없음", () => {
    const src = readFileSync("src/app/(main)/_components/views/activity/networth-benchmark-block.tsx", "utf8");
    expect(src).not.toMatch(/text-(red|blue|rose)-/);
  });
});
