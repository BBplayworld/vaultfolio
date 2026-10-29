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
