// 주식 Hero 기준가 없음 상태(ui-review) — 증감 줄 대신 안내 1줄, 이름 줄 유지
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CauseBlock, ChangeHero } from "../change-hero";

describe("ChangeHero 기준가 없음", () => {
  it("delta=null이면 change-hero-delta·시작→끝 없이 안내 문구만", () => {
    const html = renderToStaticMarkup(
      <ChangeHero title="하루 주식 수익" delta={null} start={0} end={0} message="기준가를 불러오지 못했어요. 잠시 후 다시 확인해 주세요" />,
    );
    expect(html).not.toContain("change-hero-delta");
    expect(html).not.toContain("change-hero-start");
    expect(html).toContain("기준가를 불러오지 못했어요");
    expect(html).toContain("하루 주식 수익");
  });
});

describe("CauseBlock 예측 배지 밀도", () => {
  const causes = (n: number) => ({
    causes: [
      { key: "price" as const, amount: 1_000_000, estimated: n >= 1 },
      { key: "fx" as const, amount: -50_000, estimated: n >= 2 },
      { key: "unrecorded" as const, amount: 300_000, estimated: n >= 3 },
      { key: "income" as const, amount: 500_000, estimated: false },
    ],
    deltaNet: 1_750_000,
    showUnrecordedHint: false,
  });
  const count = (html: string) => (html.match(/data-testid="cause-estimated-badge"/g) ?? []).length;
  it("예측 행 2개 이상이면 제목 옆 1개만, 행 배지 0", () => {
    const html = renderToStaticMarkup(<CauseBlock scope="year" mapped={causes(3)} estimatedLabel="일부 예측" />);
    expect(count(html)).toBe(1);
    expect(html.indexOf("cause-estimated-badge")).toBeLessThan(html.indexOf("cause-row-"));
  });
  it("예측 행 1개면 그 행에 둔다(월 탭 기존 동작)", () => {
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={causes(1)} estimatedLabel="예측" />);
    expect(count(html)).toBe(1);
    expect(html.indexOf("cause-estimated-badge")).toBeGreaterThan(html.indexOf("cause-row-price"));
  });
});

// ── 5.108 A2: 월 탭 원인 정렬 + `외 N개` ──
import { orderMonthCauses } from "../change-hero";
import type { SettlementCause, SettlementCauseKey } from "@/lib/report/settlement";

const mk = (rows: [SettlementCauseKey, number, boolean?][]): { causes: SettlementCause[]; deltaNet: number; showUnrecordedHint: boolean } => ({
  causes: rows.map(([key, amount, estimated]) => ({ key, amount, estimated: !!estimated })),
  deltaNet: rows.reduce((s, [, a]) => s + a, 0),
  showUnrecordedHint: false,
});
const F1 = mk([["price", 300_000], ["fx", -50_000], ["income", 100_000], ["unrecorded", 1_200_000]]);
const F2 = mk([["price", -200_000], ["valuation", 30_000], ["fx", 20_000], ["income", 2_000_000], ["unrecorded", -10_000]]);
const F3 = mk([["price", 500_000], ["income", -500_000], ["unrecorded", 500_000], ["fx", 10_000]]);
const keys = (html: string) => [...html.matchAll(/data-testid="(cause-row-[a-z]+)"/g)].map((m) => m[1]);
const sumTop = (html: string) => [...html.matchAll(/data-testid="cause-row-[a-z]+" data-value="(-?\d+)"/g)].slice(0, 2).reduce((s, m) => s + Number(m[1]), 0);
const restSum = (html: string) => Number(html.match(/data-value="(-?\d+)">[+−-][\d,]+원<\/span><span data-screenshot-hide/)?.[1]);

describe("월 탭 원인 정렬·접기(A2)", () => {
  it("F1 기록 안 된 변화 최대: 보임 = 기록 안 된 변화·시세, 외 2개 +50,000, 합 = 증감", () => {
    expect(orderMonthCauses(F1.causes).map((c) => c.key)).toEqual(["unrecorded", "price", "income", "fx"]);
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={F1} estimatedLabel="예측" />);
    expect(keys(html).slice(0, 2)).toEqual(["cause-row-unrecorded", "cause-row-price"]);
    expect(html).toContain("외 2개");
    expect(restSum(html)).toBe(50_000);
    expect(sumTop(html) + restSum(html)).toBe(F1.deltaNet);
    expect(html).toContain("grid-rows-[0fr]");
    expect(html).toContain('inert=""');
  });
  it("F2 순유입 최대: 보임 = 순유입·시세, 외 3개 +40,000", () => {
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={F2} estimatedLabel="예측" />);
    expect(keys(html).slice(0, 2)).toEqual(["cause-row-income", "cause-row-price"]);
    expect(html).toContain("외 3개");
    expect(restSum(html)).toBe(40_000);
    expect(sumTop(html) + restSum(html)).toBe(F2.deltaNet);
  });
  it("F3 동률: 기존 순서 유지(시세·순유입), 외 2개 +510,000", () => {
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={F3} estimatedLabel="예측" />);
    expect(keys(html).slice(0, 2)).toEqual(["cause-row-price", "cause-row-income"]);
    expect(restSum(html)).toBe(510_000);
    expect(orderMonthCauses(F3.causes).map((c) => c.key)).toEqual(["price", "income", "unrecorded", "fx"]);
  });
  it("정렬은 mapped를 바꾸지 않는다", () => {
    const before = F1.causes.map((c) => c.key).join();
    orderMonthCauses(F1.causes);
    expect(F1.causes.map((c) => c.key).join()).toBe(before);
  });
  it("3행 이하는 전부 표시·토글 없음(정렬 순)", () => {
    const m = mk([["price", 100], ["income", -900], ["fx", 5]]);
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={m} estimatedLabel="예측" />);
    expect(keys(html)).toEqual(["cause-row-income", "cause-row-price", "cause-row-fx"]);
    expect(html).not.toContain("외 ");
    expect(html).not.toContain("grid-rows-");
  });
  it("나머지 합 0원이면 외 N개 0원(muted)", () => {
    const m = mk([["price", 1000], ["income", 900], ["fx", 50], ["loan", -50]]);
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={m} estimatedLabel="예측" />);
    expect(html).toMatch(/text-muted-foreground" data-value="0">0원/);
  });
  it("예측 행이 접힌 쪽에만 있으면 외 줄에 배지 1개(testId 없음), 그룹 배지 없음", () => {
    const m = mk([["price", 1000], ["income", 900], ["fx", 50], ["loan", -40, true]]);
    const html = renderToStaticMarkup(<CauseBlock scope="month" mapped={m} estimatedLabel="예측" />);
    const toggle = html.slice(html.indexOf("외 2개"));
    expect(toggle.slice(0, 200)).toContain("예측");
  });
  it("연·주는 정렬·접기 없음: 고정 순서 그대로, 외 줄 없음", () => {
    for (const scope of ["year", "week"] as const) {
      const html = renderToStaticMarkup(<CauseBlock scope={scope} mapped={F1} estimatedLabel="예측" />);
      expect(keys(html)).toEqual(["cause-row-price", "cause-row-fx", "cause-row-income", "cause-row-unrecorded"]);
      expect(html).not.toContain("외 ");
      expect(html).not.toContain("grid-rows-");
    }
  });
});
